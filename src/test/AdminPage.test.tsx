// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AdminPage } from '../routes/admin/AdminPage'

const hostedSessionMocks = vi.hoisted(() => ({
  getHostedAccessToken: vi.fn(),
}))

vi.mock('../utils/hostedSession', () => ({
  getHostedAccessToken: hostedSessionMocks.getHostedAccessToken,
}))

vi.mock('../utils/hostedApi', () => ({
  getHostedApiBaseUrl: () => 'https://facet.example',
}))

describe('AdminPage', () => {
  beforeEach(() => {
    cleanup()
    hostedSessionMocks.getHostedAccessToken.mockResolvedValue('admin-token')
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
    window.history.replaceState(null, '', '/')
  })

  it('renders webhook receipts and expands payload JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          webhooks: [
            {
              event_id: 'evt_recent',
              event_type: 'checkout.session.completed',
              tenant_id: 'tenant-1',
              account_id: 'account-1',
              processed_at: '2026-03-14T12:00:00.000Z',
              payload: { id: 'evt_recent', livemode: false },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    render(<AdminPage />)

    await waitFor(() => {
      expect(screen.getByText('checkout.session.completed')).toBeTruthy()
    })
    expect(fetchMock).toHaveBeenCalledWith('https://facet.example/admin/webhooks?limit=100', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer admin-token',
        'Content-Type': 'application/json',
      },
    })

    fireEvent.click(screen.getByRole('button', { name: /Mar 14, 2026/i }))

    expect(screen.getByText(/"livemode": false/)).toBeTruthy()
  })

  it('shows a forbidden state for non-admin API responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'Admin access required.' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )

    render(<AdminPage />)

    await waitFor(() => {
      expect(screen.getByText('Admin access is required to view webhook receipts.')).toBeTruthy()
    })
  })

  it('shows a forbidden state for non-admin actor API responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/admin/actors')) {
          return Promise.resolve(
            new Response(JSON.stringify({ error: 'Admin access required.' }), {
              status: 403,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }

        return Promise.resolve(
          new Response(JSON.stringify({ webhooks: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }),
    )

    render(<AdminPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Actors' }))

    await waitFor(() => {
      expect(screen.getByText('Admin access is required to view platform actors.')).toBeTruthy()
    })
  })

  it('shows a forbidden state for non-admin workspace API responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/admin/workspaces')) {
          return Promise.resolve(
            new Response(JSON.stringify({ error: 'Admin access required.' }), {
              status: 403,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }

        return Promise.resolve(
          new Response(JSON.stringify({ webhooks: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }),
    )

    render(<AdminPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Workspaces' }))

    await waitFor(() => {
      expect(screen.getByText('Admin access is required to view platform workspaces.')).toBeTruthy()
    })
  })

  it('shows a forbidden state for non-admin billing API responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/admin/billing')) {
          return Promise.resolve(
            new Response(JSON.stringify({ error: 'Admin access required.' }), {
              status: 403,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }

        return Promise.resolve(
          new Response(JSON.stringify({ webhooks: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }),
    )

    render(<AdminPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Billing' }))

    await waitFor(() => {
      expect(screen.getByText('Admin access is required to view platform billing.')).toBeTruthy()
    })
  })

  it('shows a sign-in state for workspace and billing views when no admin token is available', async () => {
    hostedSessionMocks.getHostedAccessToken.mockResolvedValue(null)
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    render(<AdminPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Workspaces' }))

    await waitFor(() => {
      expect(
        screen.getByText('Sign in with an admin account to view platform workspaces.'),
      ).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Billing' }))

    await waitFor(() => {
      expect(
        screen.getByText('Sign in with an admin account to view platform billing.'),
      ).toBeTruthy()
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows backend errors for workspace and billing API failures', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/admin/workspaces')) {
        return Promise.resolve(
          new Response(JSON.stringify({ error: 'Workspace service unavailable.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }
      if (url.includes('/admin/billing')) {
        return Promise.resolve(
          new Response(JSON.stringify({ error: 'Billing service unavailable.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      return Promise.resolve(
        new Response(JSON.stringify({ webhooks: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<AdminPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Workspaces' }))

    await waitFor(() => {
      expect(screen.getByText('Workspace service unavailable. (500)')).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Billing' }))

    await waitFor(() => {
      expect(screen.getByText('Billing service unavailable. (500)')).toBeTruthy()
    })
  })

  it('shows raw network failures for workspace and billing API requests', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/admin/workspaces')) {
        return Promise.reject(new Error('Workspace network failed.'))
      }
      if (url.includes('/admin/billing')) {
        return Promise.reject(new Error('Billing network failed.'))
      }

      return Promise.resolve(
        new Response(JSON.stringify({ webhooks: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<AdminPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Workspaces' }))

    await waitFor(() => {
      expect(screen.getByText('Workspace network failed.')).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Billing' }))

    await waitFor(() => {
      expect(screen.getByText('Billing network failed.')).toBeTruthy()
    })
  })

  it('shows token retrieval failures for workspace and billing views', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ webhooks: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    hostedSessionMocks.getHostedAccessToken
      .mockResolvedValueOnce('admin-token')
      .mockRejectedValueOnce(new Error('Workspace token failed.'))

    const { unmount } = render(<AdminPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Workspaces' }))

    await waitFor(() => {
      expect(screen.getByText('Workspace token failed.')).toBeTruthy()
    })

    unmount()
    cleanup()

    hostedSessionMocks.getHostedAccessToken
      .mockResolvedValueOnce('admin-token')
      .mockRejectedValueOnce(new Error('Billing token failed.'))

    render(<AdminPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Billing' }))

    await waitFor(() => {
      expect(screen.getByText('Billing token failed.')).toBeTruthy()
    })
  })

  it('renders actors and debounces email search into the query string', async () => {
    window.history.replaceState(null, '', '/admin')
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/admin/actors')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              actors: [
                {
                  owner_user_id: 'user-1',
                  tenant_id: 'tenant-1',
                  account_id: 'account-1',
                  email: 'member@example.com',
                  created_at: '2026-03-14T12:00:00.000Z',
                  workspace_count: 2,
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        )
      }

      return Promise.resolve(
        new Response(JSON.stringify({ webhooks: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<AdminPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Actors' }))

    await waitFor(() => {
      expect(screen.getByText('member@example.com')).toBeTruthy()
    })
    expect(fetchMock).toHaveBeenCalledWith('https://facet.example/admin/actors?limit=100', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer admin-token',
        'Content-Type': 'application/json',
      },
    })

    fireEvent.change(screen.getByLabelText('Email search'), {
      target: { value: 'nick@example.com' },
    })

    expect(window.location.search).toBe('')

    await waitFor(() => {
      expect(window.location.search).toBe('?q=nick%40example.com')
      expect(fetchMock).toHaveBeenCalledWith(
        'https://facet.example/admin/actors?limit=100&q=nick%40example.com',
        {
          method: 'GET',
          headers: {
            Authorization: 'Bearer admin-token',
            'Content-Type': 'application/json',
          },
        },
      )
    })
  })

  it('opens the actors section when the admin URL includes an actor search query', async () => {
    window.history.replaceState(null, '', '/admin?q=member%40example.com')
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/admin/actors')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              actors: [
                {
                  owner_user_id: 'user-1',
                  tenant_id: 'tenant-1',
                  account_id: 'account-1',
                  email: 'member@example.com',
                  created_at: '2026-03-14T12:00:00.000Z',
                  workspace_count: 2,
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        )
      }

      return Promise.resolve(
        new Response(JSON.stringify({ webhooks: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<AdminPage />)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        'https://facet.example/admin/actors?limit=100&q=member%40example.com',
        expect.any(Object),
      )
    })
    expect(screen.getByRole('button', { name: 'Actors' }).getAttribute('aria-current')).toBe('true')
  })

  it('renders workspaces from the subnav and fetches with tenant and user filters', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/admin/workspaces')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              workspaces: [
                {
                  workspace_id: 'workspace-1',
                  tenant_id: 'tenant-1',
                  owner_user_id: 'user-1',
                  name: 'Acme workspace',
                  owner_email: 'owner@example.com',
                  revision: 7,
                  snapshot_revision: 7,
                  updated_at: '2026-03-14T12:00:00.000Z',
                  snapshot_exported_at: '2026-03-14T12:30:00.000Z',
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        )
      }

      return Promise.resolve(
        new Response(JSON.stringify({ webhooks: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<AdminPage />)

    expect(screen.getByRole('button', { name: 'Workspaces' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Billing' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Workspaces' }))

    await waitFor(() => {
      expect(screen.getByText('Acme workspace')).toBeTruthy()
    })
    expect(fetchMock).toHaveBeenCalledWith('https://facet.example/admin/workspaces?limit=100', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer admin-token',
        'Content-Type': 'application/json',
      },
    })

    fireEvent.change(screen.getByLabelText('Tenant ID'), {
      target: { value: '  tenant-2  ' },
    })
    fireEvent.change(screen.getByLabelText('User ID'), {
      target: { value: '  user-2  ' },
    })

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        'https://facet.example/admin/workspaces?limit=100&tenant_id=tenant-2&user_id=user-2',
        {
          method: 'GET',
          headers: {
            Authorization: 'Bearer admin-token',
            'Content-Type': 'application/json',
          },
        },
      )
    })
  })

  it('highlights workspace rows when the live revision differs from the snapshot revision', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/admin/workspaces')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                workspaces: [
                  {
                    workspace_id: 'workspace-drifted',
                    tenant_id: 'tenant-1',
                    owner_user_id: 'user-1',
                    name: 'Needs export',
                    owner_email: 'owner@example.com',
                    revision: 9,
                    snapshot_revision: 7,
                    updated_at: '2026-03-14T12:00:00.000Z',
                    snapshot_exported_at: null,
                  },
                ],
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          )
        }

        return Promise.resolve(
          new Response(JSON.stringify({ webhooks: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }),
    )

    render(<AdminPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Workspaces' }))

    await waitFor(() => {
      expect(screen.getByText('Needs export')).toBeTruthy()
    })
    const driftRow = screen.getByTestId('workspace-drift-row')
    expect(driftRow.className).toContain('admin-row-drift')
    expect(driftRow.textContent).toContain('-')
  })

  it('renders billing rows with extracted subscription status including null subscriptions', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/admin/billing')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              billing: [
                {
                  tenant_id: 'tenant-1',
                  account_id: 'account-1',
                  owner_email: 'paid@example.com',
                  updated_at: '2026-03-14T12:00:00.000Z',
                  customer: { id: 'cus_123' },
                  subscription: { id: 'sub_123', status: 'active' },
                  entitlement: {
                    planId: 'ai-pro',
                    status: 'active',
                    effectiveThrough: '2026-06-14T12:00:00.000Z',
                  },
                },
                {
                  tenant_id: 'tenant-override',
                  account_id: 'account-override',
                  owner_email: 'override@example.com',
                  subscription_status: 'past_due',
                  entitlement_summary: 'Pro seats: 2',
                  updated_at: '2026-03-14T12:30:00.000Z',
                  customer: { id: 'cus_override' },
                  subscription: { id: 'sub_override', status: 'active' },
                  entitlement: { seats: 2 },
                },
                {
                  tenant_id: 'tenant-malformed',
                  account_id: 'account-malformed',
                  owner_email: 'malformed@example.com',
                  entitlement_summary: 'Free',
                  updated_at: null,
                  customer: { id: 'cus_malformed' },
                  subscription: { status: 123 },
                  entitlement: { seats: 1 },
                },
                {
                  tenant_id: 'tenant-2',
                  account_id: 'account-2',
                  owner_email: 'free@example.com',
                  subscription_status: null,
                  entitlement_summary: 'Free',
                  updated_at: '2026-03-15T12:00:00.000Z',
                  customer: { id: 'cus_456' },
                  subscription: null,
                  entitlement: { seats: 1 },
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        )
      }

      return Promise.resolve(
        new Response(JSON.stringify({ webhooks: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<AdminPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Billing' }))

    await waitFor(() => {
      expect(screen.getByText('paid@example.com')).toBeTruthy()
    })
    expect(screen.getByText('active')).toBeTruthy()
    expect(screen.getByText(/ai-pro \/ active \/ through/i)).toBeTruthy()
    expect(screen.getByText('past_due')).toBeTruthy()
    expect(screen.getAllByText('No subscription').length).toBe(2)

    fireEvent.change(screen.getByLabelText('Tenant ID'), {
      target: { value: '  tenant-1  ' },
    })
    fireEvent.change(screen.getByLabelText('Account ID'), {
      target: { value: '  account-1  ' },
    })

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        'https://facet.example/admin/billing?limit=100&tenant_id=tenant-1&account_id=account-1',
        {
          method: 'GET',
          headers: {
            Authorization: 'Bearer admin-token',
            'Content-Type': 'application/json',
          },
        },
      )
    })
  })

  it('distinguishes default and filtered empty states for workspaces and billing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/admin/workspaces')) {
          return Promise.resolve(
            new Response(JSON.stringify({ workspaces: [] }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
        if (url.includes('/admin/billing')) {
          return Promise.resolve(
            new Response(JSON.stringify({ billing: [] }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }

        return Promise.resolve(
          new Response(JSON.stringify({ webhooks: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }),
    )

    render(<AdminPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Workspaces' }))

    await waitFor(() => {
      expect(screen.getByText('No workspaces found.')).toBeTruthy()
    })
    fireEvent.change(screen.getByLabelText('Tenant ID'), {
      target: { value: 'tenant-empty' },
    })
    await waitFor(() => {
      expect(screen.getByText('No workspaces match the current filters.')).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Billing' }))

    await waitFor(() => {
      expect(screen.getByText('No billing accounts found.')).toBeTruthy()
    })
    fireEvent.change(screen.getByLabelText('Account ID'), {
      target: { value: 'account-empty' },
    })
    await waitFor(() => {
      expect(screen.getByText('No billing accounts match the current filters.')).toBeTruthy()
    })
  })

  it('refreshes workspace and billing views from the shared reload button', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/admin/workspaces')) {
        return Promise.resolve(
          new Response(JSON.stringify({ workspaces: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }
      if (url.includes('/admin/billing')) {
        return Promise.resolve(
          new Response(JSON.stringify({ billing: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }

      return Promise.resolve(
        new Response(JSON.stringify({ webhooks: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<AdminPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Workspaces' }))

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.filter(([input]) => String(input).includes('/admin/workspaces'))
          .length,
      ).toBe(1)
    })
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.filter(([input]) => String(input).includes('/admin/workspaces'))
          .length,
      ).toBe(2)
    })

    fireEvent.click(screen.getByRole('button', { name: 'Billing' }))

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.filter(([input]) => String(input).includes('/admin/billing')).length,
      ).toBe(1)
    })
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.filter(([input]) => String(input).includes('/admin/billing')).length,
      ).toBe(2)
    })
  })

  it('falls back to empty states for malformed workspace and billing arrays', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/admin/workspaces')) {
          return Promise.resolve(
            new Response(JSON.stringify({}), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
        if (url.includes('/admin/billing')) {
          return Promise.resolve(
            new Response(JSON.stringify({}), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }

        return Promise.resolve(
          new Response(JSON.stringify({ webhooks: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }),
    )

    render(<AdminPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Workspaces' }))

    await waitFor(() => {
      expect(screen.getByText('No workspaces found.')).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Billing' }))

    await waitFor(() => {
      expect(screen.getByText('No billing accounts found.')).toBeTruthy()
    })
  })

  it('renders sparse workspace and billing records without required identifiers', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/admin/workspaces')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                workspaces: [
                  {
                    tenant_id: null,
                    owner_user_id: null,
                    name: 'Sparse workspace',
                    owner_email: null,
                    revision: null,
                    snapshot_revision: null,
                    updated_at: null,
                    snapshot_exported_at: null,
                  },
                ],
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          )
        }
        if (url.includes('/admin/billing')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                billing: [
                  {
                    tenant_id: null,
                    account_id: null,
                    owner_email: 'sparse@example.com',
                    subscription_status: null,
                    entitlement_summary: null,
                    updated_at: null,
                    customer: null,
                    subscription: null,
                    entitlement: null,
                  },
                ],
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          )
        }

        return Promise.resolve(
          new Response(JSON.stringify({ webhooks: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }),
    )

    render(<AdminPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Workspaces' }))

    await waitFor(() => {
      expect(screen.getByText('Sparse workspace')).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Billing' }))

    await waitFor(() => {
      expect(screen.getByText('sparse@example.com')).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: 'sparse@example.com' }))

    expect(screen.getByText(/"customer": null/)).toBeTruthy()
    expect(screen.getByText(/"subscription": null/)).toBeTruthy()
    expect(screen.getByText(/"entitlement": null/)).toBeTruthy()
  })

  it('expands billing rows to show formatted customer subscription and entitlement JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/admin/billing')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                billing: [
                  {
                    tenant_id: 'tenant-1',
                    account_id: 'account-1',
                    owner_email: 'paid@example.com',
                    subscription_status: 'active',
                    entitlement_summary: 'Pro seats: 5',
                    updated_at: '2026-03-14T12:00:00.000Z',
                    customer: { id: 'cus_123' },
                    subscription: { id: 'sub_123', status: 'active' },
                    entitlement: { plan: 'pro', seats: 5 },
                  },
                ],
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          )
        }

        return Promise.resolve(
          new Response(JSON.stringify({ webhooks: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }),
    )

    render(<AdminPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Billing' }))

    await waitFor(() => {
      expect(screen.getByText('paid@example.com')).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'paid@example.com' }))

    expect(screen.getByText(/"customer":/)).toBeTruthy()
    expect(screen.getByText(/"id": "cus_123"/)).toBeTruthy()
    expect(screen.getByText(/"subscription":/)).toBeTruthy()
    expect(screen.getByText(/"entitlement":/)).toBeTruthy()
  })
})
