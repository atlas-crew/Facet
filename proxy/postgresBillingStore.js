/**
 * Postgres-backed billing store.
 *
 * Drop-in replacement for createFileHostedBillingStore / createInMemoryHostedBillingStore.
 * Implements the same { getAccountState, upsertAccountState } interface.
 *
 * @param {import('pg').Pool} pool
 */
export function createPostgresBillingStore(pool) {
  return {
    async getAccountState(tenantId, accountId) {
      const { rows } = await pool.query(
        `SELECT tenant_id, account_id, customer, subscription, entitlement
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
        billingSubscription: row.subscription ?? null,
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
      const subscription = entry.billingSubscription ?? null
      const entitlement = entry.entitlement ?? null

      const { rows } = await pool.query(
        `INSERT INTO billing_accounts (tenant_id, account_id, customer, subscription, entitlement, updated_at)
         VALUES ($1, $2, $3, $4, $5, now())
         ON CONFLICT (tenant_id, account_id) DO UPDATE SET
           customer = EXCLUDED.customer,
           subscription = EXCLUDED.subscription,
           entitlement = EXCLUDED.entitlement,
           updated_at = now()
         RETURNING tenant_id, account_id, customer, subscription, entitlement`,
        [tenantId, accountId, JSON.stringify(customer), JSON.stringify(subscription), JSON.stringify(entitlement)],
      )

      const row = rows[0]
      return {
        tenantId: row.tenant_id,
        accountId: row.account_id,
        billingCustomer: row.customer ?? null,
        billingSubscription: row.subscription ?? null,
        entitlement: row.entitlement ?? null,
      }
    },
  }
}
