/**
 * Postgres-backed AI call usage log.
 *
 * Fire-and-forget writer for the `ai_call_usage` table. Every successful
 * Anthropic proxy call records one row keyed on the authenticated actor,
 * the feature tag, the resolved model, token counts, and the server-side
 * estimated cost in cents (from proxy/pricing.js).
 *
 * Failures to insert are logged but never surfaced to the caller — the AI
 * response must not depend on observability bookkeeping. Bad data that
 * would fail a CHECK constraint is clamped client-side so the insert is
 * as resilient as possible.
 *
 * @param {import('pg').Pool} pool
 */
export function createPostgresUsageStore(pool) {
  return {
    /**
     * Record a single successful AI call. Returns a Promise for test
     * ergonomics; production callers should not await it.
     *
     * @param {object} record
     * @param {string} record.userId
     * @param {string} record.tenantId
     * @param {string} record.accountId
     * @param {string} record.feature
     * @param {string} record.model
     * @param {number} record.inputTokens
     * @param {number} record.outputTokens
     * @param {number} record.estCostCents
     * @param {'ok'|'upstream_error'} [record.status]
     */
    async recordCall(record) {
      const status = record.status ?? 'ok'
      const inputTokens = clampNonNegativeInt(record.inputTokens)
      const outputTokens = clampNonNegativeInt(record.outputTokens)
      const estCostCents = clampNonNegativeInt(record.estCostCents)

      try {
        await pool.query(
          `INSERT INTO public.ai_call_usage
             (user_id, tenant_id, account_id, feature, model,
              input_tokens, output_tokens, est_cost_cents, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            record.userId,
            record.tenantId,
            record.accountId,
            record.feature,
            record.model,
            inputTokens,
            outputTokens,
            estCostCents,
            status,
          ],
        )
      } catch (error) {
        // Never propagate — observability failures must not break user calls.
        console.error('[proxy.usage] failed to record ai_call_usage row', {
          feature: record.feature,
          model: record.model,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    },
  }
}

function clampNonNegativeInt(value) {
  if (!Number.isFinite(value)) return 0
  const floored = Math.floor(value)
  return floored < 0 ? 0 : floored
}
