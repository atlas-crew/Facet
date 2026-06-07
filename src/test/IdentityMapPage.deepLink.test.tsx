// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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

const queryStaleNotice = () =>
  screen.queryByText(/Dropped you at the Identity Map landing instead\./)

const expectBlob = (value: Blob | MediaSource | undefined): Blob => {
  expect(value).toBeInstanceOf(Blob)
  return value as Blob
}

const setupExportMocks = (
  expectedFilename = 'identity-canonical-person.json',
  url = 'blob:identity-map',
) => ({
  createObjectUrlMock: vi.spyOn(URL, 'createObjectURL').mockReturnValue(url),
  revokeObjectUrlMock: vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined),
  anchorClickMock: vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    expect(this.href).toContain(url)
    expect(this.download).toBe(expectedFilename)
  }),
})

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
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('IdentityMapPage deep-link forward bridge', () => {
  it('opens the import-only route from the Map topbar import affordance', () => {
    seedIdentityWithMatchRule()

    render(<IdentityMapPage />)
    fireEvent.click(screen.getByRole('button', { name: /Identity Import/i }))

    expect(mockNavigate).toHaveBeenCalledWith({ to: '/identity/import' })
  })

  it('hides the Map export action until a canonical identity exists', () => {
    render(<IdentityMapPage />)

    expect(screen.queryByRole('button', { name: /Export Identity/i })).toBeNull()
  })

  it('exports the canonical identity model from the Map topbar', async () => {
    const identity = seedIdentityWithMatchRule()
    identity.identity.name = 'Canonical Person'
    identity.identity.email = 'canonical@example.com'
    const { createObjectUrlMock, revokeObjectUrlMock, anchorClickMock } = setupExportMocks()

    render(<IdentityMapPage />)
    vi.useFakeTimers()

    fireEvent.click(screen.getByRole('button', { name: /Export Identity/i }))

    expect(createObjectUrlMock).toHaveBeenCalledTimes(1)
    const blob = expectBlob(createObjectUrlMock.mock.calls[0]?.[0])
    expect(blob.type).toBe('application/json')
    await expect(blob.text()).resolves.toBe(JSON.stringify(identity, null, 2))
    expect(anchorClickMock).toHaveBeenCalledTimes(1)
    expect(
      screen.getAllByText(
        'Prepared export file for identity-canonical-person.json. Check your browser downloads.',
      ).length,
    ).toBeGreaterThan(0)

    await vi.advanceTimersByTimeAsync(60_000)
    expect(revokeObjectUrlMock).toHaveBeenCalledWith('blob:identity-map')
  })

  it('falls back to identity.json when the identity name has no filename-safe text', async () => {
    const identity = seedIdentityWithMatchRule()
    identity.identity.name = '  !!!  '
    const { createObjectUrlMock, anchorClickMock } = setupExportMocks('identity.json')

    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: /Export Identity/i }))

    expect(createObjectUrlMock).toHaveBeenCalledTimes(1)
    const blob = expectBlob(createObjectUrlMock.mock.calls[0]?.[0])
    await expect(blob.text()).resolves.toBe(JSON.stringify(identity, null, 2))
    expect(anchorClickMock).toHaveBeenCalledTimes(1)
  })

  it('caps long identity-name slugs at 64 filename characters', () => {
    const identity = seedIdentityWithMatchRule()
    identity.identity.name = 'A'.repeat(80)
    useIdentityStore.setState({ currentIdentity: identity })
    const expectedSlug = 'a'.repeat(64)
    const { anchorClickMock } = setupExportMocks(`identity-${expectedSlug}.json`)

    render(<IdentityMapPage />)
    fireEvent.click(screen.getByRole('button', { name: /Export Identity/i }))

    expect(anchorClickMock).toHaveBeenCalledTimes(1)
  })

  it('trims a filename slug hyphen introduced by truncation', () => {
    const identity = seedIdentityWithMatchRule()
    identity.identity.name = `${'A'.repeat(63)} B`
    useIdentityStore.setState({ currentIdentity: identity })
    const expectedSlug = 'a'.repeat(63)
    const { anchorClickMock } = setupExportMocks(`identity-${expectedSlug}.json`)

    render(<IdentityMapPage />)
    fireEvent.click(screen.getByRole('button', { name: /Export Identity/i }))

    expect(anchorClickMock).toHaveBeenCalledTimes(1)
  })

  it('surfaces an export failure when the blob URL cannot be created', () => {
    seedIdentityWithMatchRule()
    const consoleErrorMock = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      throw new Error('boom')
    })
    const revokeObjectUrlMock = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)

    render(<IdentityMapPage />)
    vi.useFakeTimers()
    fireEvent.click(screen.getByRole('button', { name: /Export Identity/i }))

    expect(
      screen.getByText('Could not start identity export: boom').closest('[role="alert"]'),
    ).not.toBeNull()
    expect(consoleErrorMock).toHaveBeenCalledWith(
      'Could not start identity export.',
      expect.any(Error),
    )
    expect(revokeObjectUrlMock).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(screen.getByText('Could not start identity export: boom')).toBeTruthy()
  })

  it('revokes a created object URL when the download click fails', () => {
    seedIdentityWithMatchRule()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:partial-export')
    const revokeObjectUrlMock = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      throw new Error('click boom')
    })

    render(<IdentityMapPage />)
    fireEvent.click(screen.getByRole('button', { name: /Export Identity/i }))

    expect(revokeObjectUrlMock).toHaveBeenCalledWith('blob:partial-export')
    expect(
      screen.getByText('Could not start identity export: click boom').closest('[role="alert"]'),
    ).not.toBeNull()
  })

  it('revokes the prior export URL before starting a repeated export', () => {
    const identity = seedIdentityWithMatchRule()
    identity.identity.name = 'Canonical Person'
    const createObjectUrlMock = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValueOnce('blob:first-export')
      .mockReturnValueOnce('blob:second-export')
    const revokeObjectUrlMock = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const anchorClickMock = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        expect(this.download).toBe('identity-canonical-person.json')
      })

    render(<IdentityMapPage />)
    vi.useFakeTimers()

    fireEvent.click(screen.getByRole('button', { name: /Export Identity/i }))
    fireEvent.click(screen.getByRole('button', { name: /Export Identity/i }))

    expect(createObjectUrlMock).toHaveBeenCalledTimes(2)
    expect(anchorClickMock).toHaveBeenCalledTimes(2)
    expect(revokeObjectUrlMock).toHaveBeenCalledWith('blob:first-export')
  })

  it('revokes an active export URL when the Map unmounts', () => {
    seedIdentityWithMatchRule()
    const { revokeObjectUrlMock } = setupExportMocks('identity-alex-example.json')

    const { unmount } = render(<IdentityMapPage />)
    vi.useFakeTimers()

    fireEvent.click(screen.getByRole('button', { name: /Export Identity/i }))
    unmount()

    expect(revokeObjectUrlMock).toHaveBeenCalledWith('blob:identity-map')
  })

  it('auto-dismisses and manually dismisses the export notice', async () => {
    seedIdentityWithMatchRule()
    setupExportMocks('identity-alex-example.json')

    render(<IdentityMapPage />)
    vi.useFakeTimers()

    fireEvent.click(screen.getByRole('button', { name: /Export Identity/i }))
    expect(
      screen.getByText(
        'Prepared export file for identity-alex-example.json. Check your browser downloads.',
      ),
    ).toBeTruthy()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(
      screen.queryByText(
        'Prepared export file for identity-alex-example.json. Check your browser downloads.',
      ),
    ).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /Export Identity/i }))
    const notice = screen
      .getByText(
        'Prepared export file for identity-alex-example.json. Check your browser downloads.',
      )
      .closest('.identity-map-notice') as HTMLElement
    fireEvent.click(within(notice).getByRole('button', { name: 'Dismiss' }))
    expect(
      screen.queryByText(
        'Prepared export file for identity-alex-example.json. Check your browser downloads.',
      ),
    ).toBeNull()
  })

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
    expect(queryStaleNotice()).toBeNull()
  })

  it('shows variant-specific stale notice and clears the URL param when entity is missing', async () => {
    seedIdentityWithMatchRule()
    mockUseSearch.mockReturnValue({ sel: 'match-rule:avoid:rule-does-not-exist' })

    render(<IdentityMapPage />)

    await waitFor(() => {
      const notice = queryStaleNotice()
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
      const notice = queryStaleNotice()
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
    expect(queryStaleNotice()).toBeNull()
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
      expect(queryStaleNotice()).not.toBeNull()
    })
    screen.getByText('Dismiss').click()
    await waitFor(() => {
      expect(queryStaleNotice()).toBeNull()
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
      const notice = queryStaleNotice()
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

describe('IdentityMapPage sel/focus stale-notice interaction (TASK-218)', () => {
  it('preserves sel-stale notice when focus is valid', async () => {
    // Bug scenario: ?sel=<invalid>&focus=<valid>. The sel forward effect sets
    // a stale notice; before the fix, the focus effect's setStaleNotice(null)
    // clobbered it on the same render. The notice should remain visible so
    // the user understands why their selection was dropped.
    seedIdentityWithMatchRule()
    mockUseSearch.mockReturnValue({
      sel: 'match-rule:prioritize:rule-does-not-exist',
      focus: 'preferences',
    })

    render(<IdentityMapPage />)

    await waitFor(() => {
      const notice = queryStaleNotice()
      expect(notice).not.toBeNull()
      expect(notice?.textContent ?? '').toContain("That match rule isn't there anymore")
    })
    // Focus path still scrolls the band into view.
    const scrollFn = Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>
    expect(scrollFn).toHaveBeenCalled()
  })

  it('preserves focus-stale notice when sel is valid', async () => {
    // Symmetric bug scenario: ?sel=<valid>&focus=<invalid>. The focus effect
    // sets a stale notice; before the fix, the sel forward effect's
    // setStaleNotice(null) clobbered it on the same render.
    seedIdentityWithMatchRule()
    mockUseSearch.mockReturnValue({
      sel: 'match-rule:prioritize:rule-prio-1',
      focus: 'not-a-band',
    })

    render(<IdentityMapPage />)

    await waitFor(() => {
      const notice = queryStaleNotice()
      expect(notice).not.toBeNull()
      expect(notice?.textContent ?? '').toContain("That link target isn't there anymore")
    })
    // Sel path still dispatches the selection.
    expect(useIdentityStore.getState().mapSelection?.type).toBe('match-rule')
  })
})
