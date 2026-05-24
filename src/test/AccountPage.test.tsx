// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AccountPage } from '../routes/account/AccountPage'
import { useHostedAppStore } from '../store/hostedAppStore'
import type { FacetHostedAccountContext } from '../types/hosted'

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, resolve, reject }
}

const hostedSessionMocks = vi.hoisted(() => ({
  getFacetDeploymentMode: vi.fn(() => 'hosted'),
  signOutHostedSession: vi.fn(),
}))

const locationMocks = vi.hoisted(() => ({
  reloadPage: vi.fn(),
}))

vi.mock('../utils/hostedSession', () => ({
  getFacetDeploymentMode: hostedSessionMocks.getFacetDeploymentMode,
  signOutHostedSession: hostedSessionMocks.signOutHostedSession,
}))

vi.mock('../utils/windowLocation', () => ({
  reloadPage: locationMocks.reloadPage,
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
    hostedSessionMocks.getFacetDeploymentMode.mockReturnValue('hosted')
    hostedSessionMocks.signOutHostedSession.mockReset()
    hostedSessionMocks.signOutHostedSession.mockResolvedValue(undefined)
    locationMocks.reloadPage.mockReset()

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

  it('signs out of the current hosted browser session from the account card', async () => {
    render(<AccountPage />)

    fireEvent.click(screen.getByRole('button', { name: /sign out/i }))

    await waitFor(() => {
      expect(hostedSessionMocks.signOutHostedSession).toHaveBeenCalledTimes(1)
    })
    expect(locationMocks.reloadPage).toHaveBeenCalledTimes(1)
  })

  it('disables the sign-out button while the hosted session is ending', async () => {
    const signOut = createDeferred<void>()
    hostedSessionMocks.signOutHostedSession.mockReturnValue(signOut.promise)

    render(<AccountPage />)

    fireEvent.click(screen.getByRole('button', { name: /sign out/i }))

    const button = screen.getByRole('button', { name: /signing out/i })
    expect(button).toHaveProperty('disabled', true)
    expect(locationMocks.reloadPage).not.toHaveBeenCalled()

    signOut.resolve(undefined)

    await waitFor(() => {
      expect(locationMocks.reloadPage).toHaveBeenCalledTimes(1)
    })
  })

  it('announces hosted sign-out failures without reloading', async () => {
    hostedSessionMocks.signOutHostedSession.mockRejectedValue(new Error('Network error'))

    render(<AccountPage />)

    fireEvent.click(screen.getByRole('button', { name: /sign out/i }))

    expect((await screen.findByRole('alert')).textContent).toContain('Network error')
    expect(locationMocks.reloadPage).not.toHaveBeenCalled()
  })
})
