import { describe, expect, it } from 'vitest'
import { resolveAiAccess } from '../utils/aiAccess'
import type { FacetHostedAccessContext } from '../types/hosted'
import { FACET_AI_FEATURE_KEYS, FACET_PAID_AI_FEATURES } from '../types/hosted'

const hostedContext = (
  overrides: Partial<FacetHostedAccessContext> = {},
): FacetHostedAccessContext => ({
  deploymentMode: 'hosted',
  account: {
    tenantId: 'tenant-1',
    accountId: 'account-1',
    deploymentMode: 'hosted',
    defaultWorkspaceId: 'workspace-1',
  },
  actor: {
    userId: 'user-1',
    tenantId: 'tenant-1',
    email: 'user@example.com',
  },
  memberships: [
    {
      workspaceId: 'workspace-1',
      role: 'owner',
      isDefault: true,
    },
  ],
  billingCustomer: {
    provider: 'stripe',
    customerId: 'cus_123',
  },
  billingSubscription: {
    provider: 'stripe',
    subscriptionId: 'sub_123',
    planId: 'ai-pro',
    status: 'active',
  },
  entitlement: {
    planId: 'ai-pro',
    status: 'active',
    source: 'stripe',
    features: [...FACET_PAID_AI_FEATURES],
    effectiveThrough: '2099-04-01T00:00:00.000Z',
  },
  ...overrides,
})

describe('resolveAiAccess', () => {
  it('keeps the hosted proxy feature allowlist in sync with the shared feature keys', async () => {
    const { FACET_AI_FEATURE_KEYS: proxyFeatureKeys } =
      // @ts-expect-error runtime-tested local proxy module
      await import('../../proxy/aiFeatures.js')

    expect(proxyFeatureKeys).toEqual(FACET_AI_FEATURE_KEYS)
  })

  it('allows paid hosted AI features for active entitlements', () => {
    expect(resolveAiAccess(hostedContext(), 'research.search')).toEqual({
      allowed: true,
      source: 'hosted-entitlement',
      reason: null,
    })

    expect(resolveAiAccess(hostedContext(), 'match.jd-analysis')).toEqual({
      allowed: true,
      source: 'hosted-entitlement',
      reason: null,
    })

    expect(resolveAiAccess(hostedContext(), 'linkedin.generate')).toEqual({
      allowed: true,
      source: 'hosted-entitlement',
      reason: null,
    })

    expect(resolveAiAccess(hostedContext(), 'debrief.generate')).toEqual({
      allowed: true,
      source: 'hosted-entitlement',
      reason: null,
    })

    expect(resolveAiAccess(hostedContext(), 'identity.deepen')).toEqual({
      allowed: true,
      source: 'hosted-entitlement',
      reason: null,
    })
  })

  it('allows hosted trial and grace access', () => {
    expect(
      resolveAiAccess(
        hostedContext({
          entitlement: {
            planId: 'ai-pro',
            status: 'trial',
            source: 'stripe',
            features: [...FACET_PAID_AI_FEATURES],
            effectiveThrough: '2099-04-01T00:00:00.000Z',
          },
        }),
        'prep.generate',
      ),
    ).toEqual({
      allowed: true,
      source: 'hosted-entitlement',
      reason: null,
    })

    expect(
      resolveAiAccess(
        hostedContext({
          entitlement: {
            planId: 'ai-pro',
            status: 'grace',
            source: 'stripe',
            features: [...FACET_PAID_AI_FEATURES],
            effectiveThrough: '2099-04-01T00:00:00.000Z',
          },
        }),
        'letters.generate',
      ),
    ).toEqual({
      allowed: true,
      source: 'hosted-entitlement',
      reason: null,
    })
  })

  it('requires upgrade when hosted entitlement is missing or feature is not included', () => {
    expect(
      resolveAiAccess(
        hostedContext({
          entitlement: null,
          billingCustomer: null,
          billingSubscription: null,
        }),
        'build.bullet-reframe',
      ),
    ).toEqual({
      allowed: false,
      source: 'none',
      reason: 'upgrade_required',
    })

    expect(
      resolveAiAccess(
        hostedContext({
          entitlement: {
            planId: 'ai-pro',
            status: 'active',
            source: 'stripe',
            features: ['prep.generate'],
            effectiveThrough: '2099-04-01T00:00:00.000Z',
          },
        }),
        'research.search',
      ),
    ).toEqual({
      allowed: false,
      source: 'none',
      reason: 'upgrade_required',
    })

    expect(
      resolveAiAccess(
        hostedContext(),
        'unknown.feature' as unknown as import('../types/hosted').FacetAiFeatureKey,
      ),
    ).toEqual({
      allowed: false,
      source: 'none',
      reason: 'upgrade_required',
    })
  })

  it('denies hosted AI access with a billing issue when entitlement is delinquent', () => {
    expect(
      resolveAiAccess(
        hostedContext({
          billingSubscription: {
            provider: 'stripe',
            subscriptionId: 'sub_123',
            planId: 'ai-pro',
            status: 'past_due',
          },
          entitlement: {
            planId: 'ai-pro',
            status: 'delinquent',
            source: 'stripe',
            features: [...FACET_PAID_AI_FEATURES],
            effectiveThrough: '2099-04-01T00:00:00.000Z',
          },
        }),
        'build.bullet-reframe',
      ),
    ).toEqual({
      allowed: false,
      source: 'none',
      reason: 'billing_issue',
    })
  })

  it('denies hosted AI access when the entitlement date has expired', () => {
    expect(
      resolveAiAccess(
        hostedContext({
          entitlement: {
            planId: 'ai-pro',
            status: 'active',
            source: 'stripe',
            features: [...FACET_PAID_AI_FEATURES],
            effectiveThrough: '2020-01-01T00:00:00.000Z',
          },
        }),
        'identity.deepen',
      ),
    ).toEqual({
      allowed: false,
      source: 'none',
      reason: 'access_expired',
    })
  })

  it('allows self-hosted AI when the operator-configured proxy is available', () => {
    expect(
      resolveAiAccess(
        {
          deploymentMode: 'self-hosted',
          selfHostedAi: {
            proxyConfigured: true,
            managedBy: 'operator',
          },
        },
        'research.profile-inference',
      ),
    ).toEqual({
      allowed: true,
      source: 'self-hosted-operator',
      reason: null,
    })
  })

  it('denies self-hosted AI when the operator has not configured a proxy', () => {
    expect(
      resolveAiAccess(
        {
          deploymentMode: 'self-hosted',
          selfHostedAi: {
            proxyConfigured: false,
            managedBy: 'operator',
          },
        },
        'research.profile-inference',
      ),
    ).toEqual({
      allowed: false,
      source: 'none',
      reason: 'self_hosted_proxy_unavailable',
    })
  })
})
