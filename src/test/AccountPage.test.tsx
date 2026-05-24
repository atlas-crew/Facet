// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AccountPage } from '../routes/account/AccountPage'
import { useHostedAppStore } from '../store/hostedAppStore'
import type { FacetHostedAccountContext } from '../types/hosted'

vi.mock('../utils/hostedSession', () => ({
  getFacetDeploymentMode: () => 'hosted',
}))

const hostedContext = (
  overrides: Partial<FacetHostedAccountContext> = {},
): FacetHostedAccountContext => ({
  deploymentMode: 'hosted',
  account: {
    tenantId: 'tenant-1',
    accountId: 'account-1',
    deploymentMode: 'hosted',
    defaultWorkspaceId: 'ws-1',
  },
  actor: {
    userId: 'user-1',
    tenantId: 'tenant-1',
    email: 'member@example.com',
  },
  memberships: [],
  billingCustomer: null,
  billingPass: null,
  entitlement: null,
  ...overrides,
})

describe('AccountPage', () => {
  beforeEach(() => {
    useHostedAppStore.setState({
      deploymentMode: 'hosted',
      bootstrapStatus: 'ready',
      endpoint: 'https://facet.example',
      bearerToken: 'token-123',
      context: hostedContext(),
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('confirms a pending extension pass while current access is active', () => {
    useHostedAppStore.setState({
      context: hostedContext({
        billingPass: {
          provider: 'stripe',
          paymentIntentId: 'pi_paid_extension',
          planId: 'ai-pro',
          status: 'paid',
          purchasedAt: '2026-05-10T12:00:00.000Z',
          activatedAt: null,
          expiresAt: null,
        },
        entitlement: {
          planId: 'ai-pro',
          status: 'active',
          source: 'stripe',
          features: ['research.search'],
          effectiveThrough: '2099-05-10T12:00:00.000Z',
        },
      }),
    })

    render(<AccountPage />)

    expect(screen.getByText('Active')).toBeTruthy()
    expect(screen.getByText(/Additional 90-day pass purchased/)).toBeTruthy()
  })

  it('shows a ready pass instead of expired purchase copy when active access lapsed', () => {
    useHostedAppStore.setState({
      context: hostedContext({
        billingPass: {
          provider: 'stripe',
          paymentIntentId: 'pi_paid_extension',
          planId: 'ai-pro',
          status: 'paid',
          purchasedAt: '2026-05-10T12:00:00.000Z',
          activatedAt: null,
          expiresAt: null,
        },
        entitlement: {
          planId: 'ai-pro',
          status: 'active',
          source: 'stripe',
          features: ['research.search'],
          effectiveThrough: '2020-05-10T12:00:00.000Z',
        },
      }),
    })

    render(<AccountPage />)

    expect(screen.getByText('Purchased')).toBeTruthy()
    expect(screen.getByText(/The 90-day access window starts on first AI use/)).toBeTruthy()
    expect(screen.queryByText(/Purchase a new pass to continue/)).toBeNull()
  })

  it('renders expired and refunded access states without a pending pass', () => {
    useHostedAppStore.setState({
      context: hostedContext({
        billingPass: {
          provider: 'stripe',
          paymentIntentId: 'pi_expired',
          planId: 'ai-pro',
          status: 'expired',
          purchasedAt: '2026-01-01T12:00:00.000Z',
          activatedAt: '2026-01-01T12:00:00.000Z',
          expiresAt: '2026-04-01T12:00:00.000Z',
        },
        entitlement: {
          planId: 'ai-pro',
          status: 'expired',
          source: 'stripe',
          features: ['research.search'],
          effectiveThrough: '2026-04-01T12:00:00.000Z',
        },
      }),
    })

    const { rerender } = render(<AccountPage />)

    expect(screen.getByText('Expired')).toBeTruthy()
    expect(screen.getByText(/Purchase a new pass to continue/)).toBeTruthy()

    useHostedAppStore.setState({
      context: hostedContext({
        billingPass: {
          provider: 'stripe',
          paymentIntentId: 'pi_refunded',
          planId: 'ai-pro',
          status: 'refunded',
          purchasedAt: '2026-01-01T12:00:00.000Z',
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
      }),
    })
    rerender(<AccountPage />)

    expect(screen.getByText('Refunded')).toBeTruthy()
    expect(screen.getByText(/There's an issue with your access/)).toBeTruthy()
  })
})
