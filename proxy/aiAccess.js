import { FACET_AI_FEATURE_KEYS } from './aiFeatures.js'

export { FACET_AI_FEATURE_KEYS }

export function isFacetAiFeatureKey(value) {
  return typeof value === 'string' && FACET_AI_FEATURE_KEYS.includes(value)
}

export function resolveHostedAiAccess(state, feature) {
  const entitlement = state?.entitlement
  if (
    !entitlement ||
    !Array.isArray(entitlement.features) ||
    !entitlement.features.includes(feature)
  ) {
    return {
      allowed: false,
      reason: 'upgrade_required',
    }
  }

  if (entitlement.status === 'paid') {
    return {
      allowed: false,
      reason: 'upgrade_required',
    }
  }

  if (
    entitlement.status === 'expired' ||
    (entitlement.effectiveThrough && new Date(entitlement.effectiveThrough) < new Date())
  ) {
    return {
      allowed: false,
      reason: 'access_expired',
    }
  }

  if (entitlement.status === 'active') {
    return {
      allowed: true,
      reason: null,
    }
  }

  if (entitlement.status === 'refunded') {
    return {
      allowed: false,
      reason: 'billing_issue',
    }
  }

  return {
    allowed: false,
    reason: 'upgrade_required',
  }
}

export function createHostedAiErrorPayload(reason, feature) {
  if (reason === 'billing_issue') {
    return {
      code: 'ai_access_denied',
      reason,
      feature,
      error: 'AI access is unavailable until billing is resolved for this hosted account.',
    }
  }

  if (reason === 'access_expired') {
    return {
      code: 'ai_access_denied',
      reason,
      feature,
      error: 'Your AI Pro access has expired. Purchase again to continue using AI features.',
    }
  }

  return {
    code: 'ai_access_denied',
    reason: 'upgrade_required',
    feature,
    error: 'Upgrade to AI Pro to use this hosted AI feature.',
  }
}
