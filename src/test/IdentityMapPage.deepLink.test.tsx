// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { IdentityMapPage } from '../routes/identity/IdentityMapPage'
import { useIdentityStore } from '../store/identityStore'
import { cloneIdentityFixture } from './fixtures/identityFixture'

const mockNavigate = vi.fn()
const mockUseSearch = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
  useSearch: () => mockUseSearch(),
}))

const seedIdentityWithMatchRule = () => {
  const identity = cloneIdentityFixture()
  identity.preferences = {
    ...identity.preferences,
    matching: {
      prioritize: [
        {
          id: 'rule-prio-1',
          label: 'High autonomy roles',
          description: 'Roles that let me drive decisions end-to-end.',
          weight: 'high',
        },
      ],
      avoid: [
        {
          id: 'rule-avoid-1',
          label: 'Pure management tracks',
          description: 'Roles where IC time is below 30%.',
          weight: 'high',
        },
      ],
    },
  }
  useIdentityStore.setState({ currentIdentity: identity, mapSelection: null })
  return identity
}

beforeEach(() => {
  mockNavigate.mockReset()
  mockUseSearch.mockReset()
  mockUseSearch.mockReturnValue({})
  useIdentityStore.setState({
    currentIdentity: null,
    mapSelection: null,
  })
})

afterEach(() => {
  cleanup()
})

describe('IdentityMapPage deep-link forward bridge', () => {
  it('honors a valid `?sel=` deep link by dispatching setMapSelection on first hydration', async () => {
    seedIdentityWithMatchRule()
    mockUseSearch.mockReturnValue({ sel: 'match-rule:prioritize:rule-prio-1' })

    render(<IdentityMapPage />)

    await waitFor(() => {
      expect(useIdentityStore.getState().mapSelection).toEqual({
        type: 'match-rule',
        kind: 'prioritize',
        id: 'rule-prio-1',
      })
    })
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('shows variant-specific stale notice and clears the URL param when entity is missing', async () => {
    seedIdentityWithMatchRule()
    mockUseSearch.mockReturnValue({ sel: 'match-rule:avoid:rule-does-not-exist' })

    render(<IdentityMapPage />)

    await waitFor(() => {
      const notice = screen.queryByRole('status')
      expect(notice).not.toBeNull()
      expect(notice?.textContent ?? '').toContain(
        "That match rule isn't there anymore. Dropped you at the Identity Map landing instead.",
      )
    })
    expect(useIdentityStore.getState().mapSelection).toBeNull()
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({ to: '/identity', replace: true }),
    )
  })

  it('shows generic "link target" stale notice when the param fails to parse (unknown variant)', async () => {
    seedIdentityWithMatchRule()
    mockUseSearch.mockReturnValue({ sel: 'future-variant:abc' })

    render(<IdentityMapPage />)

    await waitFor(() => {
      const notice = screen.queryByRole('status')
      expect(notice).not.toBeNull()
      expect(notice?.textContent ?? '').toContain(
        "That link target isn't there anymore. Dropped you at the Identity Map landing instead.",
      )
    })
  })

  it('honor-once: re-rendering with the same `?sel=` does not re-dispatch setMapSelection', async () => {
    seedIdentityWithMatchRule()
    mockUseSearch.mockReturnValue({ sel: 'match-rule:prioritize:rule-prio-1' })

    const { rerender } = render(<IdentityMapPage />)
    await waitFor(() => {
      expect(useIdentityStore.getState().mapSelection?.type).toBe('match-rule')
    })

    // User clicks elsewhere on the Map — selection cleared in store, URL still has `sel`.
    useIdentityStore.setState({ mapSelection: null })
    rerender(<IdentityMapPage />)

    // Selection stays null because the deep-link handler has already honored this `sel`.
    await Promise.resolve()
    expect(useIdentityStore.getState().mapSelection).toBeNull()
  })

  it('does not run the deep-link effect when no `sel` param is present', async () => {
    seedIdentityWithMatchRule()
    mockUseSearch.mockReturnValue({})

    render(<IdentityMapPage />)

    await Promise.resolve()
    expect(useIdentityStore.getState().mapSelection).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('waits for identity hydration before honoring the deep link', async () => {
    // No identity seeded yet — store has currentIdentity: null.
    mockUseSearch.mockReturnValue({ sel: 'match-rule:prioritize:rule-prio-1' })

    const { rerender } = render(<IdentityMapPage />)

    // Effect bails on first render because identity is null.
    await Promise.resolve()
    expect(useIdentityStore.getState().mapSelection).toBeNull()

    // Now hydrate identity; effect re-runs and honors the link.
    seedIdentityWithMatchRule()
    rerender(<IdentityMapPage />)

    await waitFor(() => {
      expect(useIdentityStore.getState().mapSelection?.type).toBe('match-rule')
    })
  })

  it('dismiss button clears the stale notice', async () => {
    seedIdentityWithMatchRule()
    mockUseSearch.mockReturnValue({ sel: 'match-rule:avoid:rule-missing' })

    render(<IdentityMapPage />)

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeNull()
    })
    screen.getByText('Dismiss').click()
    await waitFor(() => {
      expect(screen.queryByRole('status')).toBeNull()
    })
  })
})
