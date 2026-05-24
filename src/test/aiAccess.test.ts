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
  billingPass: {
    provider: 'stripe',
    paymentIntentId: 'pi_123',
    planId: 'ai-pro',
    status: 'active',
    purchasedAt: '2026-04-01T00:00:00.000Z',
    activatedAt: '2026-04-01T00:00:00.000Z',
    expiresAt: '2099-04-01T00:00:00.000Z',
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

  it('keeps the hosted proxy access gate fail-closed for non-active pass states', async () => {
    const { resolveHostedAiAccess } =
      // @ts-expect-error runtime-tested local proxy module
      await import('../../proxy/aiAccess.js')

    expect(
      resolveHostedAiAccess(
        {
          billingPass: {
            provider: 'stripe',
            paymentIntentId: 'pi_paid',
            planId: 'ai-pro',
            status: 'paid',
            purchasedAt: '2026-04-01T00:00:00.000Z',
            activatedAt: null,
            expiresAt: null,
          },
          entitlement: {
            planId: 'ai-pro',
            status: 'paid',
            source: 'stripe',
            features: ['research.search'],
            effectiveThrough: null,
          },
        },
        'research.search',
      ),
    ).toEqual({
      allowed: false,
      reason: 'upgrade_required',
    })

    expect(
      resolveHostedAiAccess(
        {
          billingPass: {
            provider: 'stripe',
            paymentIntentId: 'pi_refunded',
            planId: 'ai-pro',
            status: 'refunded',
            purchasedAt: '2026-04-01T00:00:00.000Z',
            activatedAt: null,
            expiresAt: null,
          },
          entitlement: {
            planId: 'ai-pro',
            status: 'refunded',
            source: 'stripe',
            features: ['research.search'],
            effectiveThrough: null,
          },
        },
        'research.search',
      ),
    ).toEqual({
      allowed: false,
      reason: 'billing_issue',
    })
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

  it('allows purchased passes before the first hosted AI use activates the window', () => {
    expect(
      resolveAiAccess(
        hostedContext({
          billingPass: {
            provider: 'stripe',
            paymentIntentId: 'pi_123',
            planId: 'ai-pro',
            status: 'paid',
            purchasedAt: '2026-04-01T00:00:00.000Z',
            activatedAt: null,
            expiresAt: null,
          },
          entitlement: {
            planId: 'ai-pro',
            status: 'paid',
            source: 'stripe',
            features: [...FACET_PAID_AI_FEATURES],
            effectiveThrough: null,
          },
        }),
        'prep.generate',
      ),
    ).toEqual({
      allowed: true,
      source: 'hosted-entitlement',
      reason: null,
    })
  })

  it('requires upgrade when a paid entitlement has no matching paid pass', () => {
    expect(
      resolveAiAccess(
        hostedContext({
          billingPass: null,
          entitlement: {
            planId: 'ai-pro',
            status: 'paid',
            source: 'stripe',
            features: [...FACET_PAID_AI_FEATURES],
            effectiveThrough: null,
          },
        }),
        'letters.generate',
      ),
    ).toEqual({
      allowed: false,
      source: 'none',
      reason: 'upgrade_required',
    })
  })

  it('allows purchased passes stored in pass history before activation', () => {
    expect(
      resolveAiAccess(
        hostedContext({
          billingPass: {
            provider: 'stripe',
            paymentIntentId: 'pi_refunded_current',
            planId: 'ai-pro',
            status: 'refunded',
            purchasedAt: '2026-04-02T00:00:00.000Z',
            activatedAt: null,
            expiresAt: null,
            history: [
              {
                provider: 'stripe',
                paymentIntentId: 'pi_paid_history',
                planId: 'ai-pro',
                status: 'paid',
                purchasedAt: '2026-04-01T00:00:00.000Z',
                activatedAt: null,
                expiresAt: null,
              },
            ],
          },
          entitlement: {
            planId: 'ai-pro',
            status: 'paid',
            source: 'stripe',
            features: [...FACET_PAID_AI_FEATURES],
            effectiveThrough: null,
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
          billingPass: null,
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

  it('denies hosted AI access with a billing issue when entitlement is refunded', () => {
    expect(
      resolveAiAccess(
        hostedContext({
          billingPass: {
            provider: 'stripe',
            paymentIntentId: 'pi_123',
            planId: 'ai-pro',
            status: 'refunded',
            purchasedAt: '2026-04-01T00:00:00.000Z',
            activatedAt: '2026-04-01T00:00:00.000Z',
            expiresAt: '2099-04-01T00:00:00.000Z',
          },
          entitlement: {
            planId: 'ai-pro',
            status: 'refunded',
            source: 'stripe',
            features: [...FACET_PAID_AI_FEATURES],
            effectiveThrough: null,
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

    expect(
      resolveAiAccess(
        hostedContext({
          billingPass: {
            provider: 'stripe',
            paymentIntentId: 'pi_123',
            planId: 'ai-pro',
            status: 'expired',
            purchasedAt: '2026-04-01T00:00:00.000Z',
            activatedAt: '2026-04-01T00:00:00.000Z',
            expiresAt: '2020-01-01T00:00:00.000Z',
          },
          entitlement: {
            planId: 'ai-pro',
            status: 'expired',
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
