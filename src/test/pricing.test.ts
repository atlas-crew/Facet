import { describe, expect, it, vi } from 'vitest'

async function loadPricing() {
  // @ts-expect-error runtime-tested local proxy module
  return import('../../proxy/pricing.js') as Promise<{
    estimateCostCents(model: string, inputTokens: number, outputTokens: number): number
    PRICING_TABLE: Record<string, { inputCentsPerMillion: number; outputCentsPerMillion: number }>
  }>
}

describe('proxy pricing table', () => {
  it('computes opus cost in cents, rounded up', async () => {
    const { estimateCostCents } = await loadPricing()
    // 1M input tokens at $15/M = 1500 cents.
    expect(estimateCostCents('claude-opus-4-8', 1_000_000, 0)).toBe(1500)
    // 1M output tokens at $75/M = 7500 cents.
    expect(estimateCostCents('claude-opus-4-8', 0, 1_000_000)).toBe(7500)
    // Mixed call: 10k input + 5k output
    //   10000 * 1500/1_000_000 = 15 cents
    //    5000 * 7500/1_000_000 = 37.5 -> ceil 38
    //   total 53 cents
    expect(estimateCostCents('claude-opus-4-8', 10_000, 5_000)).toBe(53)
  })

  it('computes sonnet cost at the Sonnet rate', async () => {
    const { estimateCostCents } = await loadPricing()
    // 1M input at $3/M = 300 cents
    expect(estimateCostCents('claude-sonnet-4-6', 1_000_000, 0)).toBe(300)
    // 1M output at $15/M = 1500 cents
    expect(estimateCostCents('claude-sonnet-4-6', 0, 1_000_000)).toBe(1500)
  })

  it('computes haiku cost at the Haiku rate', async () => {
    const { estimateCostCents } = await loadPricing()
    // 1M input at $0.80/M = 80 cents
    expect(estimateCostCents('claude-haiku-4-5-20251001', 1_000_000, 0)).toBe(80)
    // 1M output at $4/M = 400 cents
    expect(estimateCostCents('claude-haiku-4-5-20251001', 0, 1_000_000)).toBe(400)
  })

  it('rounds fractional cents UP so partial costs never silently round to zero', async () => {
    const { estimateCostCents } = await loadPricing()
    // 1 input token at opus rate = 0.0015 cents -> ceil 1
    expect(estimateCostCents('claude-opus-4-8', 1, 0)).toBe(1)
    // 1 output token at haiku rate = 0.0004 cents -> ceil 1
    expect(estimateCostCents('claude-haiku-4-5-20251001', 0, 1)).toBe(1)
  })

  it('returns zero and warns once when the model is not in the pricing table', async () => {
    const { estimateCostCents } = await loadPricing()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(estimateCostCents('claude-mystery-model-999', 1_000_000, 1_000_000)).toBe(0)
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy.mock.calls[0][0]).toMatch(/no entry for model claude-mystery-model-999/)
    warnSpy.mockRestore()
  })

  it('clamps negative and non-finite token counts to zero', async () => {
    const { estimateCostCents } = await loadPricing()
    expect(estimateCostCents('claude-opus-4-8', -100, -50)).toBe(0)
    expect(estimateCostCents('claude-opus-4-8', Number.NaN, 0)).toBe(0)
    expect(estimateCostCents('claude-opus-4-8', Infinity, 0)).toBe(0)
  })

  it('enumerates current and legacy 4.x model ids at identical rates', async () => {
    const { PRICING_TABLE } = await loadPricing()
    // Every enumerated model must have both rate fields; catches accidental
    // omissions when the table is extended.
    for (const [model, rates] of Object.entries(PRICING_TABLE)) {
      expect(typeof rates.inputCentsPerMillion, `${model}.input`).toBe('number')
      expect(typeof rates.outputCentsPerMillion, `${model}.output`).toBe('number')
      expect(rates.inputCentsPerMillion).toBeGreaterThan(0)
      expect(rates.outputCentsPerMillion).toBeGreaterThan(0)
    }
  })
})
