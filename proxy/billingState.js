import { readFile, writeFile } from 'node:fs/promises'

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function cloneValue(value) {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }

  return JSON.parse(JSON.stringify(value))
}

function normalizeBillingCustomer(value) {
  if (!isRecord(value)) {
    return null
  }

  const customerId = typeof value.customerId === 'string' ? value.customerId.trim() : ''
  if (!customerId) {
    return null
  }

  return {
    provider: 'stripe',
    customerId,
  }
}

function normalizeBillingSubscription(value) {
  if (!isRecord(value)) {
    return null
  }

  const subscriptionId = typeof value.subscriptionId === 'string' ? value.subscriptionId.trim() : ''
  const planId = value.planId === 'ai-pro' ? 'ai-pro' : null
  const status =
    value.status === 'trialing' ||
    value.status === 'active' ||
    value.status === 'past_due' ||
    value.status === 'canceled'
      ? value.status
      : null

  if (!subscriptionId || !planId || !status) {
    return null
  }

  return {
    provider: 'stripe',
    subscriptionId,
    planId,
    status,
  }
}

function normalizeEntitlement(value) {
  if (!isRecord(value)) {
    return null
  }

  const planId = value.planId === 'free' || value.planId === 'ai-pro' ? value.planId : null
  const status =
    value.status === 'inactive' ||
    value.status === 'trial' ||
    value.status === 'active' ||
    value.status === 'grace' ||
    value.status === 'delinquent'
      ? value.status
      : null
  const features = Array.isArray(value.features)
    ? value.features.filter((feature) => typeof feature === 'string')
    : []
  const effectiveThrough =
    value.effectiveThrough == null
      ? null
      : typeof value.effectiveThrough === 'string'
        ? value.effectiveThrough
        : null

  if (!planId || !status) {
    return null
  }

  return {
    planId,
    status,
    source: 'stripe',
    features,
    effectiveThrough,
  }
}

function normalizeStateEntry(value) {
  if (!isRecord(value)) {
    return null
  }

  const tenantId = typeof value.tenantId === 'string' ? value.tenantId.trim() : ''
  const accountId = typeof value.accountId === 'string' ? value.accountId.trim() : ''
  if (!tenantId || !accountId) {
    return null
  }

  return {
    tenantId,
    accountId,
    billingCustomer: normalizeBillingCustomer(value.billingCustomer),
    billingSubscription: normalizeBillingSubscription(value.billingSubscription),
    entitlement: normalizeEntitlement(value.entitlement),
  }
}

function normalizeBillingDirectory(value) {
  if (!isRecord(value) || !Array.isArray(value.accounts)) {
    throw new Error('Hosted billing file must contain an "accounts" array.')
  }

  return value.accounts.map(normalizeStateEntry).filter(Boolean)
}

function keyFor(tenantId, accountId) {
  return `${tenantId}:${accountId}`
}

export function createInMemoryHostedBillingStore(records = []) {
  const state = new Map(records.map((entry) => {
    const normalized = normalizeStateEntry(entry)
    return normalized ? [keyFor(normalized.tenantId, normalized.accountId), normalized] : null
  }).filter(Boolean))

  return {
    async getAccountState(tenantId, accountId) {
      return cloneValue(state.get(keyFor(tenantId, accountId)) ?? null)
    },
    async upsertAccountState(entry) {
      const normalized = normalizeStateEntry(entry)
      if (!normalized) {
        throw new Error('Invalid billing state entry.')
      }
      state.set(keyFor(normalized.tenantId, normalized.accountId), normalized)
      return cloneValue(normalized)
    },
  }
}

export function createFileHostedBillingStore(filePath) {
  if (!filePath) {
    throw new Error('Hosted billing requires HOSTED_BILLING_FILE.')
  }

  const readAccounts = async () => {
    const raw = await readFile(filePath, 'utf8')
    return normalizeBillingDirectory(JSON.parse(raw))
  }

  return {
    async getAccountState(tenantId, accountId) {
      const accounts = await readAccounts()
      return cloneValue(
        accounts.find((account) => account.tenantId === tenantId && account.accountId === accountId) ?? null,
      )
    },
    async upsertAccountState(entry) {
      const normalized = normalizeStateEntry(entry)
      if (!normalized) {
        throw new Error('Invalid billing state entry.')
      }

      const accounts = await readAccounts()
      const next = accounts.filter((account) => keyFor(account.tenantId, account.accountId) !== keyFor(normalized.tenantId, normalized.accountId))
      next.push(normalized)
      await writeFile(filePath, JSON.stringify({ accounts: next }, null, 2))
      return cloneValue(normalized)
    },
  }
}
