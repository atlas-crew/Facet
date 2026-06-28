/**
 * Static pricing table for Anthropic Claude models.
 *
 * Cents per million tokens at the retail Anthropic API rates. If Anthropic
 * changes pricing, update the entries here and redeploy the proxy. Keeping
 * this server-side and static is deliberate: we want deterministic cost
 * estimates at log time, and we do not want pricing to drift silently.
 *
 * Values sourced from Anthropic's public API pricing (2026-Q1). Legacy 4.x
 * and current 4.x rates are identical in the public pricing; we keep both
 * keys enumerated for auditability.
 */
const MODEL_PRICING = {
  // Opus 4.x (legacy + current)
  'claude-opus-4-20250514': { inputCentsPerMillion: 1500, outputCentsPerMillion: 7500 },
  'claude-opus-4-7':        { inputCentsPerMillion: 1500, outputCentsPerMillion: 7500 },
  'claude-opus-4-8':        { inputCentsPerMillion: 1500, outputCentsPerMillion: 7500 },
  // Sonnet 4.x (legacy + current)
  'claude-sonnet-4-20250514': { inputCentsPerMillion: 300, outputCentsPerMillion: 1500 },
  'claude-sonnet-4-6':        { inputCentsPerMillion: 300, outputCentsPerMillion: 1500 },
  // Haiku 4.x
  'claude-haiku-4-5-20251001': { inputCentsPerMillion: 80, outputCentsPerMillion: 400 },
}

/**
 * Compute an estimated cost in whole cents for a single Anthropic call.
 *
 * Unknown models return 0 and emit a single-line warning so the row still
 * lands (preserving the usage signal) and the operator is nudged to update
 * the pricing table. Rounds up to the next whole cent so underestimation
 * cannot silently accumulate.
 *
 * @param {string} model         Resolved model id (not an alias)
 * @param {number} inputTokens   Non-negative token count from response.usage
 * @param {number} outputTokens  Non-negative token count from response.usage
 * @returns {number}             Integer cents, >= 0
 */
export function estimateCostCents(model, inputTokens, outputTokens) {
  const pricing = MODEL_PRICING[model]
  if (!pricing) {
    console.warn(
      `[proxy.pricing] no entry for model ${model}; cost logged as 0. Update proxy/pricing.js.`,
    )
    return 0
  }
  const safeInput = Number.isFinite(inputTokens) && inputTokens > 0 ? inputTokens : 0
  const safeOutput = Number.isFinite(outputTokens) && outputTokens > 0 ? outputTokens : 0
  // Cents, fractional, summed across input + output.
  const fractionalCents =
    (safeInput * pricing.inputCentsPerMillion +
      safeOutput * pricing.outputCentsPerMillion) /
    1_000_000
  // Ceil so partial-cent costs never round down to zero. For a real-world
  // integer-cents ledger we prefer to slightly over-report than under-report.
  return Math.ceil(fractionalCents)
}

export const PRICING_TABLE = MODEL_PRICING
