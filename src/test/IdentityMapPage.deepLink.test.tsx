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
          severity: 'hard',
        },
      ],
    },
  }
  useIdentityStore.setState({ currentIdentity: identity, mapSelection: null })
  return identity
}

// jsdom doesn't implement scrollIntoView; the focus effect calls it on a
// band element. Stub once at module load so all suites see it.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn()
}

beforeEach(() => {
  mockNavigate.mockReset()
  mockUseSearch.mockReset()
  mockUseSearch.mockReturnValue({})
  if (typeof Element !== 'undefined') {
    // Reset the spy each test so call counts are isolated.
    Element.prototype.scrollIntoView = vi.fn()
  }
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

describe('IdentityMapPage reverse-sync (state → URL)', () => {
  it('writes the serialized selection to the URL when mapSelection changes from null', async () => {
    seedIdentityWithMatchRule()
    mockUseSearch.mockReturnValue({})

    render(<IdentityMapPage />)
    useIdentityStore.getState().setMapSelection({
      type: 'match-rule',
      kind: 'prioritize',
      id: 'rule-prio-1',
    })

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({
          to: '/identity',
          search: expect.objectContaining({ sel: 'match-rule:prioritize:rule-prio-1' }),
          replace: true,
        }),
      )
    })
  })

  it('does NOT write to URL when selection already matches the URL (no-op preserves return param)', async () => {
    seedIdentityWithMatchRule()
    mockUseSearch.mockReturnValue({
      sel: 'match-rule:prioritize:rule-prio-1',
      return: '/research',
    })

    render(<IdentityMapPage />)

    // Forward dispatches setMapSelection(rule-prio-1) → mapSelection now matches URL.
    await waitFor(() => {
      expect(useIdentityStore.getState().mapSelection?.type).toBe('match-rule')
    })

    // Reverse-sync's signature write has shape `search: { sel, return }`. The
    // forward stale-cleanup path uses `search: (prev) => ...` (a function), so
    // we filter for the static-object shape to count only reverse writes.
    const reverseWrites = mockNavigate.mock.calls.filter(([arg]) => {
      if (!arg || arg.to !== '/identity' || arg.replace !== true) return false
      return typeof arg.search === 'object' && arg.search !== null
    })
    expect(reverseWrites).toHaveLength(0)
  })

  it('drops the `return` param on the first reverse-sync write after user diverges from the deep-linked selection (Decision 3)', async () => {
    seedIdentityWithMatchRule()
    mockUseSearch.mockReturnValue({
      sel: 'match-rule:prioritize:rule-prio-1',
      return: '/research',
    })

    render(<IdentityMapPage />)

    await waitFor(() => {
      expect(useIdentityStore.getState().mapSelection?.type).toBe('match-rule')
    })
    mockNavigate.mockClear()

    // User diverges to a different rule on the Map.
    useIdentityStore.getState().setMapSelection({
      type: 'match-rule',
      kind: 'avoid',
      id: 'rule-avoid-1',
    })

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({
          to: '/identity',
          search: { sel: 'match-rule:avoid:rule-avoid-1', return: undefined },
          replace: true,
        }),
      )
    })
  })
})

describe('IdentityMapPage return-URL breadcrumb', () => {
  it('renders the "Back to {origin}" affordance when a valid return URL is present', () => {
    seedIdentityWithMatchRule()
    mockUseSearch.mockReturnValue({ return: '/research' })

    render(<IdentityMapPage />)

    expect(screen.getByRole('button', { name: '← Back to Research' })).toBeTruthy()
  })

  it('preserves origin name across query strings on the return URL', () => {
    seedIdentityWithMatchRule()
    mockUseSearch.mockReturnValue({ return: '/pipeline?entry=pipe-77' })

    render(<IdentityMapPage />)

    expect(screen.getByRole('button', { name: '← Back to Pipeline' })).toBeTruthy()
  })

  it('does NOT render the affordance when the return URL is missing', () => {
    seedIdentityWithMatchRule()
    mockUseSearch.mockReturnValue({})

    render(<IdentityMapPage />)

    expect(screen.queryByRole('button', { name: /Back to/ })).toBeNull()
  })

  it('does NOT render the affordance when the return URL fails the internal-prefix allowlist', () => {
    seedIdentityWithMatchRule()
    mockUseSearch.mockReturnValue({ return: 'https://evil.com/x' })

    render(<IdentityMapPage />)

    expect(screen.queryByRole('button', { name: /Back to/ })).toBeNull()
  })

  it('clicking the affordance clears mapSelection and navigates to the validated URL', async () => {
    seedIdentityWithMatchRule()
    useIdentityStore.setState({
      mapSelection: { type: 'match-rule', kind: 'prioritize', id: 'rule-prio-1' },
    })
    mockUseSearch.mockReturnValue({ return: '/research' })

    render(<IdentityMapPage />)

    screen.getByRole('button', { name: '← Back to Research' }).click()

    await waitFor(() => {
      expect(useIdentityStore.getState().mapSelection).toBeNull()
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/research' })
    })
  })
})

describe('IdentityMapPage focus extension (?focus=<band>)', () => {
  it('scrolls the matching band into view when focus is valid', async () => {
    seedIdentityWithMatchRule()
    mockUseSearch.mockReturnValue({ focus: 'preferences' })

    render(<IdentityMapPage />)

    await waitFor(() => {
      const scrollFn = Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>
      expect(scrollFn).toHaveBeenCalled()
    })
  })

  it('shows generic stale notice when focus value is unknown and clears the focus param', async () => {
    seedIdentityWithMatchRule()
    mockUseSearch.mockReturnValue({ focus: 'not-a-band' })

    render(<IdentityMapPage />)

    await waitFor(() => {
      const notice = screen.queryByRole('status')
      expect(notice).not.toBeNull()
      expect(notice?.textContent ?? '').toContain(
        "That link target isn't there anymore. Dropped you at the Identity Map landing instead.",
      )
    })
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({ to: '/identity', replace: true }),
    )
  })

  it('does not run the focus effect when no focus param is present', async () => {
    seedIdentityWithMatchRule()
    mockUseSearch.mockReturnValue({})

    render(<IdentityMapPage />)
    await Promise.resolve()

    const scrollFn = Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>
    expect(scrollFn).not.toHaveBeenCalled()
  })

  it('honors focus alongside selection (sel + focus + return all coexist on landing)', async () => {
    seedIdentityWithMatchRule()
    mockUseSearch.mockReturnValue({
      sel: 'match-rule:prioritize:rule-prio-1',
      focus: 'preferences',
      return: '/research',
    })

    render(<IdentityMapPage />)

    await waitFor(() => {
      // Selection dispatched
      expect(useIdentityStore.getState().mapSelection?.type).toBe('match-rule')
    })
    // Focus scrolled
    const scrollFn = Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>
    expect(scrollFn).toHaveBeenCalled()
    // Breadcrumb rendered
    expect(screen.getByRole('button', { name: '← Back to Research' })).toBeTruthy()
  })

  it('reverse-sync drops the focus param on the first divergent write (parallel to return)', async () => {
    seedIdentityWithMatchRule()
    mockUseSearch.mockReturnValue({
      sel: 'match-rule:prioritize:rule-prio-1',
      focus: 'preferences',
    })

    render(<IdentityMapPage />)
    await waitFor(() => {
      expect(useIdentityStore.getState().mapSelection?.type).toBe('match-rule')
    })
    mockNavigate.mockClear()

    // User diverges to a different rule.
    useIdentityStore.getState().setMapSelection({
      type: 'match-rule',
      kind: 'avoid',
      id: 'rule-avoid-1',
    })

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({
          to: '/identity',
          search: expect.objectContaining({
            sel: 'match-rule:avoid:rule-avoid-1',
            return: undefined,
            focus: undefined,
          }),
          replace: true,
        }),
      )
    })
  })
})
