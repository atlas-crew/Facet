import { describe, expect, it, vi } from 'vitest'

async function loadUsageStore() {
  // @ts-expect-error runtime-tested local proxy module
  return import('../../proxy/postgresUsageStore.js') as Promise<{
    createPostgresUsageStore(pool: {
      query: (sql: string, params: unknown[]) => Promise<unknown>
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
    }
  }>
}

const baseRecord = {
  userId: 'user-1',
  tenantId: 'tenant-1',
  accountId: 'account-1',
  feature: 'prep.generate',
  model: 'claude-opus-4-7',
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
      'claude-opus-4-7',
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
})
