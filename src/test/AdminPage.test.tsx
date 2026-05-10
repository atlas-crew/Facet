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
    vi.restoreAllMocks()
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
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'Admin access required.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
    ))

    render(<AdminPage />)

    await waitFor(() => {
      expect(screen.getByText('Admin access is required to view webhook receipts.')).toBeTruthy()
    })
  })
})
