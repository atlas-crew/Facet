export const FACET_AI_FEATURE_KEYS = [
  'build.jd-analysis',
  'build.bullet-reframe',
  'match.jd-analysis',
  'research.profile-inference',
  'research.search',
  'prep.generate',
  'letters.generate',
  'linkedin.generate',
  'debrief.generate',
]

const HOSTED_ALLOWED_STATUSES = new Set(['trial', 'active', 'grace'])

export function isFacetAiFeatureKey(value) {
  return typeof value === 'string' && FACET_AI_FEATURE_KEYS.includes(value)
}

export function resolveHostedAiAccess(state, feature) {
  const entitlement = state?.entitlement
  if (!entitlement || !Array.isArray(entitlement.features) || !entitlement.features.includes(feature)) {
    return {
      allowed: false,
      reason: 'upgrade_required',
    }
  }

  // Check time-boxed access window (one-time purchases)
  if (entitlement.effectiveThrough && new Date(entitlement.effectiveThrough) < new Date()) {
    return {
      allowed: false,
      reason: 'access_expired',
    }
  }

  if (HOSTED_ALLOWED_STATUSES.has(entitlement.status)) {
    return {
      allowed: true,
      reason: null,
    }
  }

  if (entitlement.status === 'delinquent') {
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
