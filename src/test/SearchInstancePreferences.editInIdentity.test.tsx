// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SearchInstancePreferences } from '../routes/research/searchWorkspaceComponents'

afterEach(() => {
  cleanup()
})

const baseIdentity: React.ComponentProps<typeof SearchInstancePreferences>['identityBase'] = {
  constraints: {
    compensation: '$220k base',
    locations: ['Denver'],
    clearance: '',
    companySize: '',
  },
  filters: { prioritize: [], avoid: [] },
  interviewPrefs: { strongFit: [], redFlags: [] },
}

describe('SearchInstancePreferences "Edit in Identity" retrofit', () => {
  it('invokes the onNavigateToIdentity callback when the button is clicked', () => {
    const onNavigateToIdentity = vi.fn()
    render(
      <SearchInstancePreferences
        identityBase={baseIdentity}
        activeThesis={null}
        onUpdateOverrides={() => {}}
        onEditThesisSignals={() => {}}
        onNavigateToIdentity={onNavigateToIdentity}
      />,
    )

    screen.getByRole('button', { name: 'Edit in Identity' }).click()
    expect(onNavigateToIdentity).toHaveBeenCalledTimes(1)
    expect(screen.getAllByText('Interview prep advantages')).toHaveLength(2)
    expect(screen.getAllByText('Interview process risks')).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'Edit look-for signals' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Edit avoid signals' })).toBeNull()
    expect(
      screen.getByText('Generate or select a thesis to edit look-for and avoid signals.'),
    ).toBeTruthy()
  })

  it('component contract: parent owns the navigation shape — the button just fires the callback', () => {
    // The retrofit lives on the caller (ResearchPage's onNavigateToIdentity prop
    // implementation). This test pins the button's contract: it MUST call the
    // prop on click. ResearchPage's implementation passes
    // navigate({ to: '/identity', search: { focus: 'preferences', return: '/research' } })
    // which is verified by the bridge tests in IdentityMapPage.deepLink.test.tsx
    // (focus + return processing) and by manual eye-check on the dev server.
    const callbacks: Array<() => void> = []
    const onNavigateToIdentity = vi.fn(() => callbacks.push(() => {}))
    render(
      <SearchInstancePreferences
        identityBase={baseIdentity}
        activeThesis={null}
        onUpdateOverrides={() => {}}
        onEditThesisSignals={() => {}}
        onNavigateToIdentity={onNavigateToIdentity}
      />,
    )

    const button = screen.getByRole('button', { name: 'Edit in Identity' })
    expect(button.tagName).toBe('BUTTON')
    expect(button.getAttribute('type')).toBe('button')
    button.click()
    expect(onNavigateToIdentity).toHaveBeenCalledTimes(1)
  })

  it('routes search-stage signal edits to the thesis strategy surface', () => {
    const onEditThesisSignals = vi.fn()
    render(
      <SearchInstancePreferences
        identityBase={baseIdentity}
        activeThesis={{
          id: 'sthesis-preferences',
          createdAt: '2026-04-01T00:00:00.000Z',
          updatedAt: '2026-04-01T00:00:00.000Z',
          narrative: '',
          competitiveMoat: '',
          unfairAdvantages: [],
          searchLanes: [],
          interviewStrategy: '',
          lookFor: [],
          avoid: [{ id: 'ssig-avoid-hard', label: 'Pure Cluster Admin', severity: 'hard' }],
          keywordCombinations: [],
          skillDepthMap: [],
          source: 'generated',
          identityVersion: 1,
          feedbackIncorporated: [],
        }}
        onUpdateOverrides={() => {}}
        onEditThesisSignals={onEditThesisSignals}
        onNavigateToIdentity={() => {}}
      />,
    )

    expect(screen.queryByLabelText('Prioritize')).toBeNull()
    expect(screen.queryByLabelText('Avoid')).toBeNull()
    expect(screen.getByText('Pure Cluster Admin')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Edit look-for signals' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit avoid signals' }))

    expect(onEditThesisSignals).toHaveBeenCalledTimes(2)
    expect(onEditThesisSignals).toHaveBeenNthCalledWith(1, 'lookFor')
    expect(onEditThesisSignals).toHaveBeenNthCalledWith(2, 'avoid')
  })

  it('renders empty thesis signal readout placeholders without enabling edits', () => {
    render(
      <SearchInstancePreferences
        identityBase={baseIdentity}
        activeThesis={{
          id: 'sthesis-empty-signals',
          createdAt: '2026-04-01T00:00:00.000Z',
          updatedAt: '2026-04-01T00:00:00.000Z',
          narrative: '',
          competitiveMoat: '',
          unfairAdvantages: [],
          searchLanes: [],
          interviewStrategy: '',
          lookFor: [],
          avoid: [],
          keywordCombinations: [],
          skillDepthMap: [],
          source: 'generated',
          identityVersion: 1,
          feedbackIncorporated: [],
        }}
        onUpdateOverrides={() => {}}
        onEditThesisSignals={() => {}}
        onNavigateToIdentity={() => {}}
      />,
    )

    const signalReadout = screen.getByText('Thesis search signals').closest('.research-field')
    expect(
      Array.from(signalReadout?.querySelectorAll('dd') ?? []).map((entry) => entry.textContent),
    ).toEqual(['—', '—'])
  })

  it('keeps interview-stage preference edits in the preference panel', () => {
    const onUpdateOverrides = vi.fn()
    render(
      <SearchInstancePreferences
        identityBase={baseIdentity}
        activeThesis={{
          id: 'sthesis-preferences',
          createdAt: '2026-04-01T00:00:00.000Z',
          updatedAt: '2026-04-01T00:00:00.000Z',
          narrative: '',
          competitiveMoat: '',
          unfairAdvantages: [],
          searchLanes: [],
          interviewStrategy: '',
          lookFor: [],
          avoid: [],
          keywordCombinations: [],
          skillDepthMap: [],
          searchOverrides: {
            constraints: baseIdentity.constraints,
            interviewPrefs: { strongFit: [], redFlags: [] },
            hiddenSkillIds: [],
          },
          source: 'generated',
          identityVersion: 1,
          feedbackIncorporated: [],
        }}
        onUpdateOverrides={onUpdateOverrides}
        onEditThesisSignals={() => {}}
        onNavigateToIdentity={() => {}}
      />,
    )

    fireEvent.change(screen.getByLabelText('Interview prep advantages'), {
      target: { value: 'distributed systems, internal platforms' },
    })
    fireEvent.change(screen.getByLabelText('Interview process risks'), {
      target: { value: 'noisy on-call' },
    })

    expect(onUpdateOverrides).toHaveBeenCalledWith({
      interviewPrefs: {
        strongFit: ['distributed systems', 'internal platforms'],
        redFlags: [],
      },
    })
    expect(onUpdateOverrides).toHaveBeenCalledWith({
      interviewPrefs: {
        strongFit: [],
        redFlags: ['noisy on-call'],
      },
    })
  })
})
