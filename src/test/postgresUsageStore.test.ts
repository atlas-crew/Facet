import { describe, expect, it, vi } from 'vitest'

async function loadUsageStore() {
  // @ts-expect-error runtime-tested local proxy module
  return import('../../proxy/postgresUsageStore.js') as Promise<{
    createPostgresUsageStore(pool: {
      query: (sql: string, params: unknown[]) => Promise<{
        rows?: Array<Record<string, unknown>>
        rowCount?: number
      }>
    }): {
      recordCall(record: {
        userId: string
        tenantId: string
        accountId: string
        feature: string
        model: string
        inputTokens: number
        outputTokens: number
        estCostCents: number
        status?: 'ok' | 'upstream_error'
      }): Promise<void>
      reserveDailyFeatureCall(request: {
        userId: string
        tenantId: string
        accountId: string
        feature: string
        usageDate: string
        cap: number
      }): Promise<{ allowed: boolean; count: number }>
      refundDailyFeatureCall(request: {
        userId: string
        tenantId: string
        accountId: string
        feature: string
        usageDate: string
      }): Promise<void>
      getSpendCentsSince(request: { since: string }): Promise<number>
    }
  }>
}

const baseRecord = {
  userId: 'user-1',
  tenantId: 'tenant-1',
  accountId: 'account-1',
  feature: 'prep.generate',
  model: 'claude-opus-4-8',
  inputTokens: 1234,
  outputTokens: 567,
  estCostCents: 10,
}

describe('postgresUsageStore', () => {
  it('inserts a row with the full record and defaults status to ok', async () => {
    const { createPostgresUsageStore } = await loadUsageStore()
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 })
    const store = createPostgresUsageStore({ query })

    await store.recordCall(baseRecord)

    expect(query).toHaveBeenCalledTimes(1)
    const [sql, params] = query.mock.calls[0] as [string, unknown[]]
    expect(sql).toMatch(/INSERT INTO public\.ai_call_usage/)
    expect(params).toEqual([
      'user-1',
      'tenant-1',
      'account-1',
      'prep.generate',
      'claude-opus-4-8',
      1234,
      567,
      10,
      'ok',
    ])
  })

  it('passes through an explicit status value', async () => {
    const { createPostgresUsageStore } = await loadUsageStore()
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 })
    const store = createPostgresUsageStore({ query })

    await store.recordCall({ ...baseRecord, status: 'upstream_error' })

    const [, params] = query.mock.calls[0] as [string, unknown[]]
    expect(params[8]).toBe('upstream_error')
  })

  it('clamps negative / NaN / Infinity token counts to zero before insert', async () => {
    const { createPostgresUsageStore } = await loadUsageStore()
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 })
    const store = createPostgresUsageStore({ query })

    await store.recordCall({
      ...baseRecord,
      inputTokens: -5,
      outputTokens: Number.NaN,
      estCostCents: Number.POSITIVE_INFINITY,
    })

    const [, params] = query.mock.calls[0] as [string, unknown[]]
    expect(params[5]).toBe(0) // inputTokens
    expect(params[6]).toBe(0) // outputTokens
    expect(params[7]).toBe(0) // estCostCents
  })

  it('rounds fractional positive costs up before insert', async () => {
    const { createPostgresUsageStore } = await loadUsageStore()
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 })
    const store = createPostgresUsageStore({ query })

    await store.recordCall({
      ...baseRecord,
      estCostCents: 0.17,
    })

    const [, params] = query.mock.calls[0] as [string, unknown[]]
    expect(params[7]).toBe(1)
  })

  it('swallows database errors without rejecting — observability failure must not cascade', async () => {
    const { createPostgresUsageStore } = await loadUsageStore()
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const query = vi.fn().mockRejectedValue(new Error('connection refused'))
    const store = createPostgresUsageStore({ query })

    // Must resolve (not reject) — the AI response path depends on this.
    await expect(store.recordCall(baseRecord)).resolves.toBeUndefined()

    expect(errorSpy).toHaveBeenCalledTimes(1)
    expect(errorSpy.mock.calls[0][0]).toMatch(/failed to record ai_call_usage/)
    errorSpy.mockRestore()
  })

  it('atomically reserves a daily feature call below the cap', async () => {
    const { createPostgresUsageStore } = await loadUsageStore()
    const query = vi.fn().mockResolvedValue({
      rows: [{ request_count: '2' }],
      rowCount: 1,
    })
    const store = createPostgresUsageStore({ query })

    await expect(store.reserveDailyFeatureCall({
      userId: 'user-1',
      tenantId: 'tenant-1',
      accountId: 'account-1',
      feature: 'prep.generate',
      usageDate: '2026-04-24',
      cap: 5,
    })).resolves.toEqual({ allowed: true, count: 2 })

    expect(query).toHaveBeenCalledTimes(1)
    const [sql, params] = query.mock.calls[0] as [string, unknown[]]
    expect(sql).toMatch(/INSERT INTO public\.ai_feature_daily_usage/)
    expect(sql).toMatch(/ON CONFLICT \(usage_date, tenant_id, account_id, user_id, feature\)/)
    expect(sql).toMatch(/request_count < \$6/)
    expect(params).toEqual([
      '2026-04-24',
      'user-1',
      'tenant-1',
      'account-1',
      'prep.generate',
      5,
    ])
  })

  it('reports a denied reservation when the daily feature cap is already reached', async () => {
    const { createPostgresUsageStore } = await loadUsageStore()
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [{ request_count: '5' }], rowCount: 1 })
    const store = createPostgresUsageStore({ query })

    await expect(store.reserveDailyFeatureCall({
      userId: 'user-1',
      tenantId: 'tenant-1',
      accountId: 'account-1',
      feature: 'prep.generate',
      usageDate: '2026-04-24',
      cap: 5,
    })).resolves.toEqual({ allowed: false, count: 5 })

    expect(query).toHaveBeenCalledTimes(2)
    expect(query.mock.calls[1][0]).toMatch(/SELECT request_count/)
  })

  it('skips the database when a daily feature cap is disabled', async () => {
    const { createPostgresUsageStore } = await loadUsageStore()
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 })
    const store = createPostgresUsageStore({ query })

    await expect(store.reserveDailyFeatureCall({
      userId: 'user-1',
      tenantId: 'tenant-1',
      accountId: 'account-1',
      feature: 'prep.generate',
      usageDate: '2026-04-24',
      cap: 0,
    })).resolves.toEqual({ allowed: true, count: 0 })

    expect(query).not.toHaveBeenCalled()
  })

  it('refunds a daily feature reservation without decrementing below zero', async () => {
    const { createPostgresUsageStore } = await loadUsageStore()
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 })
    const store = createPostgresUsageStore({ query })

    await store.refundDailyFeatureCall({
      userId: 'user-1',
      tenantId: 'tenant-1',
      accountId: 'account-1',
      feature: 'prep.generate',
      usageDate: '2026-04-24',
    })

    expect(query).toHaveBeenCalledWith(
      expect.stringMatching(/GREATEST\(request_count - 1, 0\)/),
      [
        '2026-04-24',
        'tenant-1',
        'account-1',
        'user-1',
        'prep.generate',
      ],
    )
  })

  it('sums successful AI spend since a timestamp', async () => {
    const { createPostgresUsageStore } = await loadUsageStore()
    const query = vi.fn().mockResolvedValue({
      rows: [{ spend_cents: '123' }],
      rowCount: 1,
    })
    const store = createPostgresUsageStore({ query })

    await expect(store.getSpendCentsSince({
      since: '2026-04-24T10:00:00.000Z',
    })).resolves.toBe(123)

    expect(query).toHaveBeenCalledWith(
      expect.stringMatching(/SUM\(est_cost_cents\)/),
      ['2026-04-24T10:00:00.000Z'],
    )
  })
})
