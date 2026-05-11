// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import {
  SearchAssumptionsDisclosure,
  SearchInstancePreferences,
  SearchThesisWorkspace,
} from '../routes/research/searchWorkspaceComponents'
import type { SearchProfileConstraints, SearchThesis } from '../types/search'

afterEach(() => {
  cleanup()
  window.sessionStorage.clear()
})

const buildPreferenceConstraints = (
  overrides: Partial<SearchProfileConstraints> = {},
): SearchProfileConstraints => ({
  salary: { min: 220000, max: 220000, currency: 'USD' },
  locations: ['Denver'],
  clearance: '',
  companySize: '',
  industriesToAvoid: [],
  fundingStagesAcceptable: [],
  remotePolicies: [],
  remotePolicyNote: '',
  employmentTypes: [],
  ...overrides,
})

const baseIdentity: React.ComponentProps<typeof SearchInstancePreferences>['identityBase'] = {
  constraints: buildPreferenceConstraints(),
  filters: { prioritize: [], avoid: [] },
  interviewPrefs: { strongFit: [], redFlags: [] },
}

const buildPreferenceThesis = (
  constraints: Partial<SearchProfileConstraints> = {},
): SearchThesis => ({
  id: 'sthesis-preferences',
  createdAt: '2026-04-01T00:00:00.000Z',
  updatedAt: '2026-04-01T00:00:00.000Z',
  competitiveMoat: '',
  unfairAdvantages: [],
  searchLanes: [],
  lookFor: [],
  avoid: [],
  keywordCombinations: [],
  skillDepthMap: [],
  searchOverrides: {
    constraints: buildPreferenceConstraints(constraints),
    interviewPrefs: { strongFit: [], redFlags: [] },
    hiddenSkillIds: [],
  },
  source: 'generated',
  identityVersion: 1,
  feedbackIncorporated: [],
})

describe('SearchInstancePreferences', () => {
  it('routes search-stage signal edits to the thesis strategy surface', () => {
    const onEditThesisSignals = vi.fn()
    render(
      <SearchInstancePreferences
        identityBase={baseIdentity}
        activeThesis={{
          id: 'sthesis-preferences',
          createdAt: '2026-04-01T00:00:00.000Z',
          updatedAt: '2026-04-01T00:00:00.000Z',
          competitiveMoat: '',
          unfairAdvantages: [],
          searchLanes: [],
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
          competitiveMoat: '',
          unfairAdvantages: [],
          searchLanes: [],
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
          competitiveMoat: '',
          unfairAdvantages: [],
          searchLanes: [],
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

  it('persists hard-constraint chip toggles with bank labels instead of raw values', () => {
    window.sessionStorage.setItem('facet.research.hardConstraintsOpen', 'open')
    const onUpdateOverrides = vi.fn()
    render(
      <SearchInstancePreferences
        identityBase={baseIdentity}
        activeThesis={buildPreferenceThesis()}
        onUpdateOverrides={onUpdateOverrides}
        onEditThesisSignals={() => {}}
      />,
    )

    expect(screen.getByRole('button', { name: 'Series A' })).toBeTruthy()
    expect(screen.queryByText('series-a')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Adtech' }))
    expect(onUpdateOverrides).toHaveBeenLastCalledWith({
      constraints: expect.objectContaining({ industriesToAvoid: ['adtech'] }),
    })

    fireEvent.click(screen.getByRole('button', { name: 'Series A' }))
    expect(onUpdateOverrides).toHaveBeenLastCalledWith({
      constraints: expect.objectContaining({ fundingStagesAcceptable: ['series-a'] }),
    })

    fireEvent.click(screen.getByRole('button', { name: 'Remote friendly' }))
    expect(onUpdateOverrides).toHaveBeenLastCalledWith({
      constraints: expect.objectContaining({ remotePolicies: ['remote-friendly'] }),
    })

    fireEvent.click(screen.getByRole('button', { name: 'W-2 full-time' }))
    expect(onUpdateOverrides).toHaveBeenLastCalledWith({
      constraints: expect.objectContaining({ employmentTypes: ['w2-fulltime'] }),
    })
  })

  it('protects salary min and max edits from crossing', () => {
    window.sessionStorage.setItem('facet.research.hardConstraintsOpen', 'open')
    const onUpdateOverrides = vi.fn()
    render(
      <SearchInstancePreferences
        identityBase={baseIdentity}
        activeThesis={buildPreferenceThesis({
          salary: { min: 200000, max: 300000, currency: 'USD' },
        })}
        onUpdateOverrides={onUpdateOverrides}
        onEditThesisSignals={() => {}}
      />,
    )

    fireEvent.change(screen.getByLabelText('Salary minimum amount'), {
      target: { value: '350000' },
    })
    expect(onUpdateOverrides).toHaveBeenLastCalledWith({
      constraints: expect.objectContaining({
        salary: { min: 350000, max: 350000, currency: 'USD' },
      }),
    })

    fireEvent.change(screen.getByLabelText('Salary maximum amount'), {
      target: { value: '100000' },
    })
    expect(onUpdateOverrides).toHaveBeenLastCalledWith({
      constraints: expect.objectContaining({
        salary: { min: 100000, max: 100000, currency: 'USD' },
      }),
    })
  })

  it('binds clearance to the 3-state selector', () => {
    window.sessionStorage.setItem('facet.research.hardConstraintsOpen', 'open')
    const onUpdateOverrides = vi.fn()
    render(
      <SearchInstancePreferences
        identityBase={baseIdentity}
        activeThesis={buildPreferenceThesis()}
        onUpdateOverrides={onUpdateOverrides}
        onEditThesisSignals={() => {}}
      />,
    )

    fireEvent.change(screen.getByLabelText('Clearance requirement'), {
      target: { value: 'required' },
    })
    expect(onUpdateOverrides).toHaveBeenLastCalledWith({
      constraints: expect.objectContaining({ clearance: 'required' }),
    })

    fireEvent.change(screen.getByLabelText('Clearance requirement'), {
      target: { value: 'not-required' },
    })
    expect(onUpdateOverrides).toHaveBeenLastCalledWith({
      constraints: expect.objectContaining({ clearance: 'not-required' }),
    })

    fireEvent.change(screen.getByLabelText('Clearance requirement'), {
      target: { value: '' },
    })
    expect(onUpdateOverrides).toHaveBeenLastCalledWith({
      constraints: expect.objectContaining({ clearance: '' }),
    })
  })

  it('persists the hard-constraint disclosure state per browser session', () => {
    const { unmount } = render(
      <SearchInstancePreferences
        identityBase={baseIdentity}
        activeThesis={buildPreferenceThesis()}
        onUpdateOverrides={() => {}}
        onEditThesisSignals={() => {}}
      />,
    )

    const details = screen.getByText('Hard constraints').closest('details')
    expect(details?.open).toBe(false)

    if (!details) throw new Error('Hard constraints details did not render')
    details.open = true
    fireEvent(details, new Event('toggle'))
    expect(window.sessionStorage.getItem('facet.research.hardConstraintsOpen')).toBe('open')

    unmount()
    render(
      <SearchInstancePreferences
        identityBase={baseIdentity}
        activeThesis={buildPreferenceThesis()}
        onUpdateOverrides={() => {}}
        onEditThesisSignals={() => {}}
      />,
    )

    expect(screen.getByText('Hard constraints').closest('details')?.open).toBe(true)
  })
})

describe('Search assumptions transparency', () => {
  it('renders assumption claims with Correct actions', () => {
    const onCorrectAssumption = vi.fn()

    render(
      <SearchAssumptionsDisclosure
        assumptions={[
          {
            id: 'assumption-visa',
            claim: 'Candidate can work in the US without sponsorship.',
            source: 'explicit-fallback',
            rationale: 'Visa status was not specified.',
            confidence: 'low',
            overridable: true,
          },
          {
            id: 'assumption-location',
            claim: 'Remote US is acceptable outside Denver.',
            source: 'inferred',
            confidence: 'high',
            overridable: false,
          },
        ]}
        onCorrectAssumption={onCorrectAssumption}
      />,
    )

    expect(screen.getByText('Assumptions (2)')).toBeTruthy()
    expect(screen.getByText('Candidate can work in the US without sponsorship.')).toBeTruthy()
    expect(screen.getByText(/low confidence/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Correct?' }))
    expect(onCorrectAssumption).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'assumption-visa' }),
    )
  })

  it('shows thesis assumptions at the top of the thesis workspace', () => {
    render(
      <SearchThesisWorkspace
        activeThesis={{
          id: 'sthesis-assumptions',
          createdAt: '2026-04-01T00:00:00.000Z',
          updatedAt: '2026-04-01T00:00:00.000Z',
          competitiveMoat: 'A strong moat.',
          unfairAdvantages: [],
          searchLanes: [],
          lookFor: [],
          avoid: [],
          keywordCombinations: [],
          skillDepthMap: [],
          assumptions: [
            {
              id: 'assumption-comp',
              claim: 'Compensation floor is a target, not a hard floor.',
              source: 'assumed-default',
              confidence: 'medium',
              overridable: true,
            },
          ],
          source: 'generated',
          identityVersion: 1,
          feedbackIncorporated: [],
        }}
        isGeneratingThesis={false}
        isSearching={false}
        hasIdentity={true}
        correctionsDraft=""
        onCorrectionsChange={() => {}}
        directiveDraft=""
        onDirectiveChange={() => {}}
        onRegenerate={() => {}}
        onCorrectAssumption={() => {}}
      />,
    )

    const thesisWorkspace = screen.getByLabelText('Search thesis workspace')
    expect(within(thesisWorkspace).getByText('Assumptions (1)')).toBeTruthy()
    expect(
      within(thesisWorkspace).getByText('Compensation floor is a target, not a hard floor.'),
    ).toBeTruthy()
  })
})
