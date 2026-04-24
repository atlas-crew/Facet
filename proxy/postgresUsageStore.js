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
      const estCostCents = clampNonNegativeCostCents(record.estCostCents)

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

    /**
     * Atomically reserve one daily feature call for an actor.
     *
     * @param {object} request
     * @param {string} request.userId
     * @param {string} request.tenantId
     * @param {string} request.accountId
     * @param {string} request.feature
     * @param {string} request.usageDate YYYY-MM-DD in UTC
     * @param {number} request.cap Inclusive daily cap
     * @returns {Promise<{allowed: boolean, count: number}>}
     */
    async reserveDailyFeatureCall(request) {
      const cap = clampNonNegativeInt(request.cap)
      if (cap <= 0) {
        return { allowed: true, count: 0 }
      }

      const result = await pool.query(
        `INSERT INTO public.ai_feature_daily_usage
           (usage_date, user_id, tenant_id, account_id, feature, request_count)
         VALUES ($1, $2, $3, $4, $5, 1)
         ON CONFLICT (usage_date, tenant_id, account_id, user_id, feature)
         DO UPDATE SET
           request_count = public.ai_feature_daily_usage.request_count + 1,
           updated_at = now()
         WHERE public.ai_feature_daily_usage.request_count < $6
         RETURNING request_count`,
        [
          request.usageDate,
          request.userId,
          request.tenantId,
          request.accountId,
          request.feature,
          cap,
        ],
      )

      const row = result.rows?.[0]
      if (row) {
        return {
          allowed: true,
          count: clampNonNegativeInt(row.request_count),
        }
      }

      const existing = await pool.query(
        `SELECT request_count
           FROM public.ai_feature_daily_usage
          WHERE usage_date = $1
            AND tenant_id = $2
            AND account_id = $3
            AND user_id = $4
            AND feature = $5`,
        [
          request.usageDate,
          request.tenantId,
          request.accountId,
          request.userId,
          request.feature,
        ],
      )

      return {
        allowed: false,
        count: clampNonNegativeInt(existing.rows?.[0]?.request_count ?? cap),
      }
    },

    /**
     * Refund a previously reserved daily feature call after upstream failure.
     *
     * @param {object} request
     * @param {string} request.userId
     * @param {string} request.tenantId
     * @param {string} request.accountId
     * @param {string} request.feature
     * @param {string} request.usageDate YYYY-MM-DD in UTC
     */
    async refundDailyFeatureCall(request) {
      await pool.query(
        `UPDATE public.ai_feature_daily_usage
            SET request_count = GREATEST(request_count - 1, 0),
                updated_at = now()
          WHERE usage_date = $1
            AND tenant_id = $2
            AND account_id = $3
            AND user_id = $4
            AND feature = $5`,
        [
          request.usageDate,
          request.tenantId,
          request.accountId,
          request.userId,
          request.feature,
        ],
      )
    },

    /**
     * Sum logged hosted AI spend since an ISO timestamp.
     *
     * @param {{ since: string }} request
     * @returns {Promise<number>}
     */
    async getSpendCentsSince(request) {
      const result = await pool.query(
        `SELECT COALESCE(SUM(est_cost_cents), 0)::integer AS spend_cents
           FROM public.ai_call_usage
          WHERE created_at >= $1
            AND status = 'ok'`,
        [request.since],
      )
      return clampNonNegativeInt(result.rows?.[0]?.spend_cents ?? 0)
    },
  }
}

function clampNonNegativeInt(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 0
  const floored = Math.floor(numeric)
  return floored < 0 ? 0 : floored
}

function clampNonNegativeCostCents(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 0
  const ceiled = Math.ceil(numeric)
  return ceiled < 0 ? 0 : ceiled
}
