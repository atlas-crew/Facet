/**
 * Postgres-backed billing store.
 *
 * Drop-in replacement for createFileHostedBillingStore / createInMemoryHostedBillingStore.
 * Implements the same { getAccountState, upsertAccountState, findAccountStateByPaymentIntentId } interface.
 *
 * @param {import('pg').Pool} pool
 */
export function createPostgresBillingStore(pool) {
  return {
    async getAccountState(tenantId, accountId) {
      const { rows } = await pool.query(
        `SELECT tenant_id, account_id, customer, pass, entitlement
         FROM billing_accounts
         WHERE tenant_id = $1 AND account_id = $2`,
        [tenantId, accountId],
      )

      if (rows.length === 0) {
        return null
      }

      const row = rows[0]
      return {
        tenantId: row.tenant_id,
        accountId: row.account_id,
        billingCustomer: row.customer ?? null,
        billingPass: row.pass ?? null,
        entitlement: row.entitlement ?? null,
      }
    },

    async upsertAccountState(entry) {
      const tenantId = typeof entry.tenantId === 'string' ? entry.tenantId.trim() : ''
      const accountId = typeof entry.accountId === 'string' ? entry.accountId.trim() : ''
      if (!tenantId || !accountId) {
        throw new Error('Invalid billing state entry.')
      }

      const customer = entry.billingCustomer ?? null
      const pass = entry.billingPass ?? null
      const entitlement = entry.entitlement ?? null

      const { rows } = await pool.query(
        `INSERT INTO billing_accounts (tenant_id, account_id, customer, pass, entitlement, updated_at)
         VALUES ($1, $2, $3, $4, $5, now())
         ON CONFLICT (tenant_id, account_id) DO UPDATE SET
           customer = EXCLUDED.customer,
           pass = EXCLUDED.pass,
           entitlement = EXCLUDED.entitlement,
           updated_at = now()
         RETURNING tenant_id, account_id, customer, pass, entitlement`,
        [tenantId, accountId, JSON.stringify(customer), JSON.stringify(pass), JSON.stringify(entitlement)],
      )

      const row = rows[0]
      return {
        tenantId: row.tenant_id,
        accountId: row.account_id,
        billingCustomer: row.customer ?? null,
        billingPass: row.pass ?? null,
        entitlement: row.entitlement ?? null,
      }
    },

    async findAccountStateByPaymentIntentId(paymentIntentId) {
      const normalizedPaymentIntentId = typeof paymentIntentId === 'string' ? paymentIntentId.trim() : ''
      if (!normalizedPaymentIntentId) {
        return null
      }

      const { rows } = await pool.query(
        `SELECT tenant_id, account_id, customer, pass, entitlement
         FROM billing_accounts
         WHERE pass->>'paymentIntentId' = $1
            OR pass->'history' @> jsonb_build_array(jsonb_build_object('paymentIntentId', $1::text))
         LIMIT 1`,
        [normalizedPaymentIntentId],
      )

      if (rows.length === 0) {
        return null
      }

      const row = rows[0]
      return {
        tenantId: row.tenant_id,
        accountId: row.account_id,
        billingCustomer: row.customer ?? null,
        billingPass: row.pass ?? null,
        entitlement: row.entitlement ?? null,
      }
    },
  }
}
