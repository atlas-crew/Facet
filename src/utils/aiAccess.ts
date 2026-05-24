import type {
  FacetAiAccessContext,
  FacetAiAccessDecision,
  FacetAiFeatureKey,
} from '../types/hosted'

export function resolveAiAccess(
  context: FacetAiAccessContext,
  feature: FacetAiFeatureKey,
): FacetAiAccessDecision {
  if (context.deploymentMode === 'self-hosted') {
    return context.selfHostedAi.proxyConfigured
      ? {
          allowed: true,
          source: 'self-hosted-operator',
          reason: null,
        }
      : {
          allowed: false,
          source: 'none',
          reason: 'self_hosted_proxy_unavailable',
        }
  }

  const entitlement = context.entitlement
  if (!entitlement || !entitlement.features.includes(feature)) {
    return {
      allowed: false,
      source: 'none',
      reason: 'upgrade_required',
    }
  }

  if (entitlement.status === 'paid') {
    const hasPaidPass =
      context.billingPass?.status === 'paid' ||
      context.billingPass?.history?.some((pass) => pass.status === 'paid')

    return hasPaidPass
      ? {
          allowed: true,
          source: 'hosted-entitlement',
          reason: null,
        }
      : {
          allowed: false,
          source: 'none',
          reason: 'upgrade_required',
        }
  }

  if (
    entitlement.status === 'expired' ||
    (entitlement.effectiveThrough && new Date(entitlement.effectiveThrough) < new Date())
  ) {
    return {
      allowed: false,
      source: 'none',
      reason: 'access_expired',
    }
  }

  if (entitlement.status === 'active') {
    return {
      allowed: true,
      source: 'hosted-entitlement',
      reason: null,
    }
  }

  if (entitlement.status === 'refunded') {
    return {
      allowed: false,
      source: 'none',
      reason: 'billing_issue',
    }
  }

  return {
    allowed: false,
    source: 'none',
    reason: 'upgrade_required',
  }
}
