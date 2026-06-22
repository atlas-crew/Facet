// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type {
  ResearchJob,
  SearchProfile,
  SearchResultEntry,
  SearchThesis,
  SearchThesisSignal,
} from '../types/search'
import { defaultResumeData } from '../store/defaultData'
import { useCoverLetterStore } from '../store/coverLetterStore'
import { useIdentityStore } from '../store/identityStore'
import { usePipelineStore } from '../store/pipelineStore'
import { usePrepStore } from '../store/prepStore'
import { useResumeStore } from '../store/resumeStore'
import { useSearchStore } from '../store/searchStore'
import { resolveStorage } from '../store/storage'
import { FacetAiProxyError } from '../utils/aiProxyErrors'
import { adaptIdentityToSearchProfile } from '../utils/identitySearchProfile'
import { cloneIdentityFixture } from './fixtures/identityFixture'

const { mockNavigate, mockResearchSearch } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockResearchSearch: { review: undefined as 'stale' | undefined },
}))

const {
  mockInferSearchProfile,
  mockInferSearchProfileFromIdentity,
  mockCreateDeepResearchJob,
  mockFetchDeepResearchJob,
  mockFetchResearchUsage,
  mockCancelDeepResearchJob,
  mockStreamDeepResearchJob,
  mockGenerateSearchThesisFromIdentity,
  mockFetchAiProxyCapabilities,
  mockGenerateCoverLetter,
  mockGenerateInterviewPrep,
} = vi.hoisted(() => ({
  mockInferSearchProfile: vi.fn(),
  mockInferSearchProfileFromIdentity: vi.fn(),
  mockCreateDeepResearchJob: vi.fn(),
  mockFetchDeepResearchJob: vi.fn(),
  mockFetchResearchUsage: vi.fn(),
  mockCancelDeepResearchJob: vi.fn(),
  mockStreamDeepResearchJob: vi.fn(),
  mockGenerateSearchThesisFromIdentity: vi.fn(),
  mockFetchAiProxyCapabilities: vi.fn(),
  mockGenerateCoverLetter: vi.fn(),
  mockGenerateInterviewPrep: vi.fn(),
}))

vi.mock('@tanstack/react-router', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-router')>('@tanstack/react-router')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearch: () => mockResearchSearch,
  }
})

vi.mock('../utils/searchProfileInference', async () => {
  const actual = await vi.importActual<typeof import('../utils/searchProfileInference')>(
    '../utils/searchProfileInference',
  )
  return {
    ...actual,
    inferSearchProfile: (...args: Parameters<typeof actual.inferSearchProfile>) =>
      mockInferSearchProfile(...args),
    inferSearchProfileFromIdentity: (
      ...args: Parameters<typeof actual.inferSearchProfileFromIdentity>
    ) => mockInferSearchProfileFromIdentity(...args),
  }
})

vi.mock('../utils/deepSearchClient', async () => {
  const actual = await vi.importActual<typeof import('../utils/deepSearchClient')>(
    '../utils/deepSearchClient',
  )
  return {
    ...actual,
    createDeepResearchJob: (...args: Parameters<typeof actual.createDeepResearchJob>) =>
      mockCreateDeepResearchJob(...args),
    fetchDeepResearchJob: (...args: Parameters<typeof actual.fetchDeepResearchJob>) =>
      mockFetchDeepResearchJob(...args),
    fetchResearchUsage: (...args: Parameters<typeof actual.fetchResearchUsage>) =>
      mockFetchResearchUsage(...args),
    cancelDeepResearchJob: (...args: Parameters<typeof actual.cancelDeepResearchJob>) =>
      mockCancelDeepResearchJob(...args),
    streamDeepResearchJob: (...args: Parameters<typeof actual.streamDeepResearchJob>) =>
      mockStreamDeepResearchJob(...args),
  }
})

vi.mock('../utils/thesisGenerator', async () => {
  const actual = await vi.importActual<typeof import('../utils/thesisGenerator')>(
    '../utils/thesisGenerator',
  )
  return {
    ...actual,
    generateSearchThesisFromIdentity: (
      ...args: Parameters<typeof actual.generateSearchThesisFromIdentity>
    ) => mockGenerateSearchThesisFromIdentity(...args),
  }
})

vi.mock('../utils/coverLetterGenerator', async () => {
  const actual = await vi.importActual<typeof import('../utils/coverLetterGenerator')>(
    '../utils/coverLetterGenerator',
  )
  return {
    ...actual,
    generateCoverLetter: (...args: Parameters<typeof actual.generateCoverLetter>) =>
      mockGenerateCoverLetter(...args),
  }
})

vi.mock('../utils/prepGenerator', async () => {
  const actual =
    await vi.importActual<typeof import('../utils/prepGenerator')>('../utils/prepGenerator')
  return {
    ...actual,
    generateInterviewPrep: (...args: Parameters<typeof actual.generateInterviewPrep>) =>
      mockGenerateInterviewPrep(...args),
  }
})

vi.mock('../utils/llmProxy', async () => {
  const actual = await vi.importActual<typeof import('../utils/llmProxy')>('../utils/llmProxy')
  return {
    ...actual,
    fetchAiProxyCapabilities: (...args: Parameters<typeof actual.fetchAiProxyCapabilities>) =>
      mockFetchAiProxyCapabilities(...args),
  }
})

type TestThesisSignalInput = string | Partial<SearchThesisSignal>
type TestThesisOverrides = Partial<Omit<SearchThesis, 'lookFor' | 'avoid'>> & {
  lookFor?: TestThesisSignalInput[]
  avoid?: TestThesisSignalInput[]
}

const normalizeTestSignals = (
  signals: readonly TestThesisSignalInput[] | undefined,
): SearchThesisSignal[] =>
  (signals ?? []).flatMap<SearchThesisSignal>((signal, index) => {
    if (typeof signal === 'string') {
      return signal.trim()
        ? [{ id: `ssig-test-${index}`, label: signal.trim(), severity: 'soft' }]
        : []
    }
    if (!signal.label?.trim()) return []
    return [
      {
        ...signal,
        id: signal.id ?? `ssig-test-${index}`,
        label: signal.label.trim(),
        severity: signal.severity ?? (signal.condition ? 'conditional' : 'soft'),
      },
    ]
  })

const buildTestThesis = (overrides: TestThesisOverrides = {}): SearchThesis => {
  const { lookFor, avoid, ...rest } = overrides
  return {
    id: 'thesis-1',
    createdAt: '2026-03-10T10:00:00.000Z',
    updatedAt: '2026-03-10T10:00:00.000Z',
    competitiveMoat: 'Default moat.',
    unfairAdvantages: [],
    searchLanes: [
      {
        id: 'lane-platform',
        title: 'Platform modernization',
        rationale: 'Default test lane for thesis-driven launch coverage.',
        targetSignals: ['platform'],
      },
    ],
    lookFor: normalizeTestSignals(lookFor),
    avoid: normalizeTestSignals(avoid),
    keywordCombinations: [],
    skillDepthMap: [
      { skill: 'TypeScript', depth: 'strong', context: 'Test', searchSignal: 'Test' },
    ],
    source: 'generated',
    identityVersion: 0,
    feedbackIncorporated: [],
    ...rest,
  }
}

const buildResearchJob = (overrides: Partial<ResearchJob> = {}): ResearchJob => {
  const thesisSnapshot = overrides.thesisSnapshot ?? buildTestThesis()
  return {
    id: 'job-new',
    userId: 'user-1',
    thesisId: thesisSnapshot.id,
    thesisSnapshot,
    identityVersion: thesisSnapshot.identityVersion,
    params: useSearchStore.getState().requests[0]!,
    paramsHash: 'hash',
    status: 'running',
    createdAt: '2026-03-10T10:06:00.000Z',
    ttlAt: '2026-04-10T10:06:00.000Z',
    progress: { phase: 'queued', elapsedMs: 0, searchQueries: [] },
    ...overrides,
  }
}

const seedLaunchThesis = (overrides: TestThesisOverrides = {}): SearchThesis => {
  const thesis = buildTestThesis(overrides)
  useSearchStore.setState((state) => ({
    ...state,
    theses: [thesis],
    activeThesisId: thesis.id,
  }))
  return thesis
}

const buildResearchUsage = () => ({
  window: {
    since: '2026-03-10T00:00:00.000Z',
    until: '2026-03-11T00:00:00.000Z',
    windowMs: 86400000,
  },
  usage: {
    completedJobCount: 0,
    inFlightJobCount: 0,
    tokens: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    spendCents: 0,
    completedSpendCents: 0,
    reservedCents: 0,
  },
  estimate: {
    model: 'claude-opus-4-7',
    inputTokens: 12000,
    outputTokens: 80000,
    runCostCents: 618,
  },
  budget: {
    enforced: true,
    limitCents: 1000,
    remainingCents: 382,
    warningThresholdCents: 800,
    status: 'warning' as const,
    wouldExceedNextRun: false,
  },
  warning: {
    code: 'research_budget_near_limit' as const,
    message: 'This run is projected to put deep research near the configured budget ceiling.',
    projectedRemainingCents: 382,
    limitCents: 1000,
  },
})

describe('ResearchPage', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_ANTHROPIC_PROXY_URL', 'https://ai.example/proxy')
    mockNavigate.mockReset()
    mockResearchSearch.review = undefined
    mockInferSearchProfile.mockReset()
    mockInferSearchProfileFromIdentity.mockReset()
    mockCreateDeepResearchJob.mockReset()
    mockFetchDeepResearchJob.mockReset()
    mockFetchResearchUsage.mockReset()
    mockCancelDeepResearchJob.mockReset()
    mockStreamDeepResearchJob.mockReset()
    mockGenerateSearchThesisFromIdentity.mockReset()
    mockFetchAiProxyCapabilities.mockReset()
    mockGenerateCoverLetter.mockReset()
    mockGenerateInterviewPrep.mockReset()
    mockStreamDeepResearchJob.mockReturnValue({ close: vi.fn() })
    mockFetchAiProxyCapabilities.mockResolvedValue({
      modelCapabilities: {
        opus: {
          available: true,
          model: 'claude-opus-4-7',
          phase1FallbackModel: 'claude-sonnet-4-6',
          phase2Required: true,
        },
        sonnet: { available: true, model: 'claude-sonnet-4-6' },
        haiku: { available: true, model: 'claude-haiku-4-5-20251001' },
      },
    })
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    })
    resolveStorage().removeItem('facet-search-data')
    resolveStorage().removeItem('facet-pipeline-data')
    resolveStorage().removeItem('facet-prep-data')
    resolveStorage().removeItem('vector-resume-data')

    useResumeStore.setState({
      data: JSON.parse(JSON.stringify(defaultResumeData)),
      past: [],
      future: [],
      canUndo: false,
      canRedo: false,
    })

    usePipelineStore.setState({
      entries: [],
      sortField: 'tier',
      sortDir: 'asc',
      filters: { tier: 'all', status: 'all', search: '' },
    })

    usePrepStore.setState({
      decks: [],
      activeDeckId: null,
      activeMode: 'edit',
    })

    useCoverLetterStore.setState({
      letters: [],
      snapshots: [],
      activeLetterId: null,
      templates: [],
    })

    useIdentityStore.setState({
      currentIdentity: null,
      draftDocument: '',
      intakeSources: [],
      lastError: null,
      warnings: [],
    })

    useSearchStore.setState({
      profile: {
        id: 'sprof-1',
        inferredAt: '2026-03-10T10:00:00.000Z',
        inferredFromResumeVersion: 1,
        skills: [],
        workSummary: [],
        openQuestions: [],
        constraints: {
          salary: { min: 0, max: 0 },
          locations: [],
          clearance: '',
          companySize: '',
        },
        filters: {
          prioritize: [],
          avoid: [],
        },
        interviewPrefs: {
          strongFit: [],
          redFlags: [],
        },
      },
      requests: [
        {
          id: 'sreq-1',
          createdAt: '2026-03-10T10:05:00.000Z',
          focusLanes: ['lane-platform'],
          companySizeOverride: '',
          salaryAnchorOverride: '',
          geoExpand: true,
          customKeywords: '',
          excludeCompanies: [],
          maxResults: { tier1: 5, tier2: 10, tier3: 10 },
        },
      ],
      runs: [
        {
          id: 'srun-1',
          requestId: 'sreq-1',
          createdAt: '2026-03-10T10:06:00.000Z',
          status: 'completed',
          searchLog: ['staff platform engineer remote'],
          narrativeState: { status: 'pending' },
          results: [
            {
              id: 'sres-1',
              tier: 1,
              company: 'Acme Corp',
              title: 'Staff Platform Engineer',
              url: 'https://example.com/jobs/1',
              matchScore: 96,
              matchReason: 'Excellent overlap with platform and backend scope.',
              vectorAlignment: 'Backend / platform',
              risks: ['Company is smaller than ideal'],
              estimatedComp: '$250k-$320k',
              source: 'greenhouse',
            },
          ],
        },
      ],
      theses: [],
      activeThesisId: null,
      feedbackEvents: [],
      activeResearchJob: null,
    })

    mockInferSearchProfile.mockResolvedValue({
      skills: [{ id: 'skl-1', name: 'TypeScript', category: 'backend', depth: 'strong' }],
      workSummary: [],
      openQuestions: [],
    })
    mockCreateDeepResearchJob.mockResolvedValue({
      jobId: 'job-new',
      status: 'queued',
    })
    mockFetchDeepResearchJob.mockResolvedValue(buildResearchJob())
    mockFetchResearchUsage.mockResolvedValue(buildResearchUsage())
    mockGenerateSearchThesisFromIdentity.mockResolvedValue({
      thesis: buildTestThesis({
        id: 'thesis-generated',
        competitiveMoat:
          'Production Kubernetes delivery paired with product-aware platform judgment and evidence of making complex deployment constraints legible.',
        unfairAdvantages: [
          {
            id: 'sadv-generated',
            combination: 'Kubernetes delivery plus product judgment',
            targetCompanyProfile: 'Platform teams modernizing deployment paths',
          },
        ],
        searchLanes: [
          {
            id: 'lane-platform',
            title: 'Platform modernization',
            rationale:
              'This lane targets companies whose deployment model is becoming strategically important. It is strong because the candidate can connect infrastructure implementation to product delivery outcomes.',
            competitiveContext:
              'Look for teams modernizing delivery without hiring for narrow cluster operations.',
            targetSignals: ['on-prem delivery', 'platform modernization'],
          },
          {
            id: 'lane-devex',
            title: 'Developer productivity infrastructure',
            rationale:
              'This lane targets teams where platform work is measured by developer leverage. It fits because the candidate evidence connects infrastructure tradeoffs to faster product delivery.',
            competitiveContext:
              'Look for teams that treat internal platform work as product leverage.',
            targetSignals: ['developer productivity', 'internal platform'],
          },
        ],
        lookFor: ['platform modernization', 'developer leverage'],
        avoid: [
          {
            label: 'Pure Kubernetes administration',
            condition:
              'Building around Kubernetes is fine; owning clusters as the whole job is not.',
          },
        ],
        timeline: {
          urgency: 'active',
          deadline: '2026-05-01',
          strategyImpact: 'Prioritize active platform openings with clear modernization signals.',
        },
        keywordCombinations: [
          {
            id: 'skwd-generated',
            query: '"platform modernization" Kubernetes',
            lane: 'lane-platform',
            noiseLevel: 'low',
          },
        ],
        skillDepthMap: [
          {
            skill: 'Kubernetes',
            depth: 'strong',
            context:
              'Contoso evidence shows Kubernetes-based installs that unlocked customer deployment paths.',
            searchSignal: 'Strong match signal for platform modernization roles.',
          },
        ],
      }),
      contractViolations: [],
    })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('pushes a result into the pipeline', async () => {
    const { ResearchPage } = await import('../routes/research/ResearchPage')

    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Results Viewer' }))
    fireEvent.click(screen.getByRole('button', { name: /Add to Pipeline/i }))

    await waitFor(
      () => {
        expect(usePipelineStore.getState().entries).toHaveLength(1)
        expect(mockNavigate).toHaveBeenCalledWith({ to: '/pipeline' })
      },
      { timeout: 10000 },
    )

    const entry = usePipelineStore.getState().entries[0]
    expect(entry).toBeDefined()
    expect(entry!.company).toBe('Acme Corp')
    expect(entry!.role).toBe('Staff Platform Engineer')
    expect(entry!.tier).toBe('1')
    expect(entry!.status).toBe('researching')
    expect(entry!.vectorId).toBe('backend')
  }, 10000)

  it('renders resume directives and copies bullet text from result cards', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    useSearchStore.setState((state) => ({
      ...state,
      requests: state.requests.map((request) => ({
        ...request,
        resumeVariants: [
          { id: 'platform', label: 'Platform' },
          { id: 'security-platform', label: 'Security Platform' },
        ],
      })),
      runs: state.runs.map((run) => ({
        ...run,
        results: run.results.map((result) => ({
          ...result,
          recommendedVariant: 'security-platform',
          bulletEdits: [
            {
              emphasis: 'lead',
              text: 'I led platform security delivery that cut edge incident triage 31%.',
              rationale: 'The posting asks for platform security ownership.',
            },
            {
              emphasis: 'supporting',
              text: 'I partnered across product and infra teams to ship reliable developer workflows.',
            },
          ],
          keywordsToInclude: ['platform security', 'edge incident triage', 'developer workflows'],
        })),
      })),
    }))
    const { ResearchPage } = await import('../routes/research/ResearchPage')

    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Results Viewer' }))
    fireEvent.click(screen.getByText('Resume directives'))

    expect(screen.getByText('Security Platform')).toBeTruthy()
    expect(screen.getByText('Top-of-resume edits')).toBeTruthy()
    expect(screen.getByText('Lead')).toBeTruthy()
    expect(screen.getByText('platform security')).toBeTruthy()
    expect(screen.getByText('edge incident triage')).toBeTruthy()

    fireEvent.click(
      screen.getAllByRole('button', { name: /Copy resume bullet for Acme Corp/i })[0]!,
    )
    expect(writeText).toHaveBeenCalledWith(
      'I led platform security delivery that cut edge incident triage 31%.',
    )
  })

  it('omits the resume directive panel when optional directive fields are absent', async () => {
    const { ResearchPage } = await import('../routes/research/ResearchPage')

    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Results Viewer' }))

    expect(screen.queryByText('Resume directives')).toBeNull()
  })

  it('surfaces run-level assumptions and routes corrections to Identity', async () => {
    useSearchStore.setState((state) => ({
      ...state,
      runs: state.runs.map((run) => ({
        ...run,
        narrativeState: {
          status: 'ready',
          contractViolations: [],
          narrative: {
            competitiveMoat: 'A durable platform moat grounded in production delivery evidence.',
            selectionMethodology:
              'Filtered for platform roles with senior ownership and remote viability.',
            marketContext: 'Platform hiring remains active for teams modernizing delivery systems.',
            executiveSummary:
              'This search prioritizes platform roles where senior backend ownership and deployment architecture matter together, while avoiding roles that reduce the scope to cluster administration.',
            assumptions: [
              {
                id: 'assumption-remote',
                claim: 'Remote US roles are acceptable outside Denver.',
                source: 'inferred',
                rationale: 'Hybrid preference only named Denver.',
                confidence: 'high',
                overridable: true,
              },
            ],
          },
        },
      })),
    }))

    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Results Viewer' }))

    expect(screen.getByText('Assumptions (1)')).toBeTruthy()
    expect(screen.getByText('Remote US roles are acceptable outside Denver.')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Correct?' }))

    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/identity',
      search: { focus: 'preferences', return: '/research' },
    })
  })

  it('shows the stale profile warning when resume data is newer than the inferred profile', async () => {
    useResumeStore.setState((state) => ({
      ...state,
      data: {
        ...state.data,
        version: 2,
      },
    }))

    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    expect(screen.getByLabelText('Search readiness').textContent).toContain(
      'Resume stale (v1 vs v2)',
    )
    expect(screen.getByLabelText('Search readiness').textContent).toContain(
      'Resume fallback stays available in-session when Identity is not active',
    )
  })

  it('shows search readiness context and a primary run-search action for resume fallback profiles', async () => {
    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    expect(screen.getByRole('button', { name: 'Run Search' })).toBeTruthy()
    expect(screen.getByLabelText('Search readiness').textContent).toContain('Resume fallback')
    expect(screen.getByText('Search Readiness')).toBeTruthy()
    expect(
      screen.getByText('Your resume-backed profile is ready for targeted searches.'),
    ).toBeTruthy()
  })

  it('shows identity-backed readiness context when the profile syncs from identity', async () => {
    const identity = cloneIdentityFixture()
    useIdentityStore.setState({
      currentIdentity: identity,
      draftDocument: JSON.stringify(identity, null, 2),
    })

    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    await waitFor(() => {
      expect(screen.getByLabelText('Search readiness').textContent).toContain('Identity model')
    })

    expect(screen.getByRole('button', { name: 'Run Search' })).toBeTruthy()
    expect(
      screen.getByText('Your search profile is being driven by the identity model.'),
    ).toBeTruthy()
  })

  it('imports the deterministic identity profile even when AI identity enhancement fails', async () => {
    const identity = cloneIdentityFixture()
    useIdentityStore.setState({
      currentIdentity: identity,
      draftDocument: JSON.stringify(identity, null, 2),
    })
    useSearchStore.setState({ profile: null })
    mockInferSearchProfileFromIdentity.mockRejectedValueOnce(new Error('proxy 500'))

    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Refresh from Identity' }))

    await waitFor(() => {
      expect(useSearchStore.getState().profile?.source?.kind).toBe('identity')
      expect(screen.queryByRole('alert')).toBeNull()
      expect(
        screen.getByText(
          /Imported Identity profile\. AI narrative refresh was unavailable; using the Identity model profile\. proxy 500/,
        ),
      ).toBeTruthy()
    })
  })

  it('applies AI identity enhancement when the imported profile remains current', async () => {
    const identity = cloneIdentityFixture()
    mockInferSearchProfileFromIdentity.mockResolvedValueOnce({
      workSummary: [{ title: 'AI summary', summary: 'Richer search narrative.' }],
      openQuestions: ['AI follow-up question'],
    })
    useIdentityStore.setState({
      currentIdentity: identity,
      draftDocument: JSON.stringify(identity, null, 2),
    })
    useSearchStore.setState({ profile: null })

    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Refresh from Identity' }))

    await waitFor(() => {
      const profile = useSearchStore.getState().profile
      expect(profile?.workSummary[0]?.title).toBe('AI summary')
      expect(profile?.openQuestions).toEqual(['AI follow-up question'])
      expect(screen.queryByText(/AI narrative refresh was unavailable/)).toBeNull()
    })
  })

  it('does not apply stale AI identity enhancement after the imported profile changes', async () => {
    const identity = cloneIdentityFixture()
    let resolveEnhancement: (
      value: Pick<SearchProfile, 'workSummary' | 'openQuestions'>,
    ) => void = () => {}
    mockInferSearchProfileFromIdentity.mockImplementationOnce(
      () =>
        new Promise<Pick<SearchProfile, 'workSummary' | 'openQuestions'>>((resolve) => {
          resolveEnhancement = resolve
        }),
    )
    useIdentityStore.setState({
      currentIdentity: identity,
      draftDocument: JSON.stringify(identity, null, 2),
    })
    useSearchStore.setState({ profile: null })

    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Refresh from Identity' }))

    await waitFor(() => {
      expect(useSearchStore.getState().profile?.source?.kind).toBe('identity')
    })
    const importedProfile = useSearchStore.getState().profile
    if (!importedProfile) {
      throw new Error('Expected identity profile to be imported before AI enhancement resolves.')
    }

    useSearchStore.getState().setProfile({
      ...importedProfile,
      workSummary: [{ title: 'Manual search edit', summary: 'Keep this local edit.' }],
    })
    await act(async () => {
      resolveEnhancement({
        workSummary: [{ title: 'AI enhancement', summary: 'This arrived too late.' }],
        openQuestions: ['Late question'],
      })
    })

    await waitFor(() => {
      expect(useSearchStore.getState().profile?.workSummary[0]?.title).toBe('Manual search edit')
    })
  })

  it('does not show a stale AI failure notice after the imported profile changes', async () => {
    const identity = cloneIdentityFixture()
    let rejectEnhancement: (reason?: unknown) => void = () => {}
    mockInferSearchProfileFromIdentity.mockImplementationOnce(
      () =>
        new Promise<Pick<SearchProfile, 'workSummary' | 'openQuestions'>>((_, reject) => {
          rejectEnhancement = reject
        }),
    )
    useIdentityStore.setState({
      currentIdentity: identity,
      draftDocument: JSON.stringify(identity, null, 2),
    })
    useSearchStore.setState({ profile: null })

    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Refresh from Identity' }))

    await waitFor(() => {
      expect(useSearchStore.getState().profile?.source?.kind).toBe('identity')
    })
    const importedProfile = useSearchStore.getState().profile
    if (!importedProfile) {
      throw new Error('Expected identity profile to be imported before AI enhancement rejects.')
    }

    useSearchStore.getState().setProfile({
      ...importedProfile,
      workSummary: [{ title: 'Manual search edit', summary: 'Keep this local edit.' }],
    })
    await act(async () => {
      rejectEnhancement(new Error('proxy 500'))
    })

    await waitFor(() => {
      expect(screen.queryByText(/AI narrative refresh was unavailable/)).toBeNull()
      expect(useSearchStore.getState().profile?.workSummary[0]?.title).toBe('Manual search edit')
    })
  })

  it('clears a prior AI failure notice when identity refresh succeeds later', async () => {
    const identity = cloneIdentityFixture()
    mockInferSearchProfileFromIdentity
      .mockRejectedValueOnce(new Error('proxy 500'))
      .mockResolvedValueOnce({
        workSummary: [{ title: 'AI summary', summary: 'Richer search narrative.' }],
        openQuestions: ['AI follow-up question'],
      })
    useIdentityStore.setState({
      currentIdentity: identity,
      draftDocument: JSON.stringify(identity, null, 2),
    })
    useSearchStore.setState({ profile: null })

    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Refresh from Identity' }))
    await waitFor(() => {
      expect(screen.getByText(/AI narrative refresh was unavailable/)).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Refresh from Identity' }))
    await waitFor(() => {
      const profile = useSearchStore.getState().profile
      expect(profile?.workSummary[0]?.title).toBe('AI summary')
      expect(screen.queryByText(/AI narrative refresh was unavailable/)).toBeNull()
    })
  })

  it('prevents overlapping identity refresh requests from the page action', async () => {
    const identity = cloneIdentityFixture()
    let resolveEnhancement: (
      value: Pick<SearchProfile, 'workSummary' | 'openQuestions'>,
    ) => void = () => {}
    mockInferSearchProfileFromIdentity.mockImplementationOnce(
      () =>
        new Promise<Pick<SearchProfile, 'workSummary' | 'openQuestions'>>((resolve) => {
          resolveEnhancement = resolve
        }),
    )
    useIdentityStore.setState({
      currentIdentity: identity,
      draftDocument: JSON.stringify(identity, null, 2),
    })
    useSearchStore.setState({ profile: null })

    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    const refreshButton = screen.getByRole('button', { name: 'Refresh from Identity' })
    fireEvent.click(refreshButton)

    await waitFor(() => {
      const busyButton = screen.getByRole('button', { name: 'Refreshing…' })
      expect(busyButton).toHaveProperty('disabled', true)
      expect(mockInferSearchProfileFromIdentity).toHaveBeenCalledTimes(1)
    })
    fireEvent.click(screen.getByRole('button', { name: 'Refreshing…' }))
    expect(mockInferSearchProfileFromIdentity).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveEnhancement({
        workSummary: [{ title: 'AI enhancement', summary: 'The only in-flight request applies.' }],
        openQuestions: ['AI question'],
      })
    })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Refresh from Identity' })).toHaveProperty(
        'disabled',
        false,
      )
      expect(useSearchStore.getState().profile?.workSummary[0]?.title).toBe('AI enhancement')
    })
  })

  it('generates, edits, and saves a search thesis revision from identity', async () => {
    const identity = cloneIdentityFixture()
    useIdentityStore.setState({
      currentIdentity: identity,
      draftDocument: JSON.stringify(identity, null, 2),
    })

    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Search Launcher' }))
    fireEvent.click(screen.getByRole('button', { name: /Generate Thesis/i }))

    await waitFor(() => {
      expect(mockGenerateSearchThesisFromIdentity).toHaveBeenCalledWith(
        identity,
        'https://ai.example/proxy',
        [],
        {},
      )
      expect(useSearchStore.getState().activeThesisId).toBe('thesis-generated')
    })

    // Unfair advantages are now identity-canonical (read-only in research). Edited on Identity → Self Model.
    fireEvent.change(screen.getByLabelText('Look-for signals'), {
      target: { value: 'platform modernization, internal developer leverage' },
    })
    fireEvent.change(screen.getByLabelText('Timeline urgency'), {
      target: { value: 'critical' },
    })
    fireEvent.change(screen.getByLabelText('Timeline deadline'), {
      target: { value: '2026-06-01' },
    })
    fireEvent.change(screen.getByLabelText('Timeline strategy impact'), {
      target: { value: 'Prioritize roles with active platform modernization mandates.' },
    })
    fireEvent.click(screen.getAllByRole('button', { name: 'Move lane up' })[1]!)
    fireEvent.change(screen.getByLabelText('Lane 1 title'), {
      target: { value: 'Developer platform modernization' },
    })
    fireEvent.change(screen.getByLabelText('Skill depth 1 search signal'), {
      target: { value: 'Prioritize roles where Kubernetes unlocks product delivery.' },
    })
    fireEvent.change(screen.getByLabelText('Skill depth 1 calibration'), {
      target: { value: 'Avoid cluster-admin-only roles.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save thesis edits' }))

    await waitFor(() => {
      expect(useSearchStore.getState().theses).toHaveLength(1)
    })
    const savedThesis = useSearchStore.getState().theses.at(-1)
    expect(savedThesis).toMatchObject({
      source: 'user-edited',
      lookFor: [
        expect.objectContaining({ label: 'platform modernization' }),
        expect.objectContaining({ label: 'internal developer leverage' }),
      ],
      timeline: expect.objectContaining({
        urgency: 'critical',
        deadline: '2026-06-01',
        strategyImpact: 'Prioritize roles with active platform modernization mandates.',
      }),
      // Keyword combinations come straight from the LLM mock — the UI no longer
      // exposes per-combo edits (task-252), so the generated combo passes through
      // unchanged save-after-save.
      keywordCombinations: [
        {
          query: '"platform modernization" Kubernetes',
          lane: 'lane-platform',
          noiseLevel: 'low',
        },
      ],
      skillDepthMap: [
        expect.objectContaining({
          searchSignal: 'Prioritize roles where Kubernetes unlocks product delivery.',
          calibration: 'Avoid cluster-admin-only roles.',
        }),
      ],
    })
    expect(savedThesis?.searchLanes[0]).toMatchObject({
      id: 'lane-devex',
      title: 'Developer platform modernization',
    })
  })

  it('offers and accepts a Sonnet fallback when Opus thesis generation is unavailable', async () => {
    const identity = cloneIdentityFixture()
    useIdentityStore.setState({
      currentIdentity: identity,
      draftDocument: JSON.stringify(identity, null, 2),
    })
    mockGenerateSearchThesisFromIdentity
      .mockRejectedValueOnce(
        new FacetAiProxyError('Opus is currently unavailable.', {
          status: 503,
          code: 'ai_capability_unavailable',
          reason: 'opus_unavailable',
          feature: 'research.thesis',
        }),
      )
      .mockResolvedValueOnce({
        thesis: buildTestThesis({
          id: 'thesis-sonnet-fallback',
          source: 'generated-fallback',
        }),
        contractViolations: [],
      })

    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Search Launcher' }))
    fireEvent.click(screen.getByRole('button', { name: /Generate Thesis/i }))

    const fallbackButton = await screen.findByRole('button', { name: 'Use Sonnet fallback' })
    fireEvent.click(fallbackButton)

    await waitFor(() => {
      expect(mockGenerateSearchThesisFromIdentity).toHaveBeenCalledTimes(2)
    })
    expect(mockGenerateSearchThesisFromIdentity.mock.calls[1]?.[3]).toEqual(
      expect.objectContaining({ modelFallback: 'sonnet' }),
    )
    expect(useSearchStore.getState().theses.at(-1)?.source).toBe('generated-fallback')
    expect(screen.getByText('Generated with Sonnet fallback')).toBeTruthy()
  })

  it('lets the user decline the Sonnet fallback when Opus is unavailable', async () => {
    const identity = cloneIdentityFixture()
    useIdentityStore.setState({
      currentIdentity: identity,
      draftDocument: JSON.stringify(identity, null, 2),
    })
    mockGenerateSearchThesisFromIdentity.mockRejectedValueOnce(
      new FacetAiProxyError('Opus is currently unavailable.', {
        status: 503,
        code: 'ai_capability_unavailable',
        reason: 'opus_unavailable',
        feature: 'research.thesis',
      }),
    )

    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Search Launcher' }))
    fireEvent.click(screen.getByRole('button', { name: /Generate Thesis/i }))

    fireEvent.click(await screen.findByRole('button', { name: 'Wait for Opus' }))

    expect(mockGenerateSearchThesisFromIdentity).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Use Sonnet fallback' })).toBeNull()
    expect(screen.getByText('Thesis generation paused until Opus is available.')).toBeTruthy()
  })

  it('shows Regenerate with Opus when a fallback thesis exists and Opus returns', async () => {
    const identity = cloneIdentityFixture()
    useIdentityStore.setState({
      currentIdentity: identity,
      draftDocument: JSON.stringify(identity, null, 2),
    })
    seedLaunchThesis({ id: 'thesis-fallback-existing', source: 'generated-fallback' })

    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Search Launcher' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Regenerate with Opus' }))

    await waitFor(() => {
      expect(mockGenerateSearchThesisFromIdentity).toHaveBeenCalledWith(
        identity,
        'https://ai.example/proxy',
        [],
        {},
      )
    })
  })

  const openBatchReviewFromSkillWriteback = async ({
    includeSavedThesis = false,
  }: { includeSavedThesis?: boolean } = {}) => {
    const identity = cloneIdentityFixture()
    identity.model_revision = 2
    useIdentityStore.setState({
      currentIdentity: identity,
      draftDocument: JSON.stringify(identity, null, 2),
    })
    const deckId = usePrepStore.getState().createDeck({
      title: 'Acme prep',
      company: 'Acme',
      role: 'Staff Platform Engineer',
      identityVersion: 2,
    })
    usePrepStore.getState().addCard(deckId, {
      title: 'Platform story',
      category: 'technical',
      kind: 'story',
    })
    useCoverLetterStore.getState().createLetter({
      id: 'letter-1',
      content: {
        name: 'Acme',
        header: '',
        greeting: '',
        paragraphs: [],
        signOff: '',
      },
      pipelineEntryId: 'pipeline-acme',
      sourceResumeId: 'resume-acme',
      sourceResumeHash: 'hash-acme',
      identityVersion: 2,
    })
    const thesis = buildTestThesis({
      id: 'thesis-writeback',
      identityVersion: 2,
      skillDepthMap: [
        {
          skill: 'Kubernetes',
          depth: 'architectural',
          context: 'Architected Kubernetes delivery paths for customer environments.',
          searchSignal: 'Prioritize architecture-heavy platform roles.',
          calibration: 'Avoid cluster-administration-only roles.',
        },
      ],
    })
    const savedThesis = includeSavedThesis
      ? buildTestThesis({
          id: 'thesis-saved-stale',
          identityVersion: 2,
          skillDepthMap: [
            {
              skill: 'Kubernetes',
              depth: 'working',
              context: 'Older Kubernetes context should be regenerated.',
              searchSignal: 'Older platform search signal.',
            },
          ],
        })
      : null
    useSearchStore.setState((state) => ({
      ...state,
      theses: savedThesis ? [thesis, savedThesis] : [thesis],
      activeThesisId: thesis.id,
      runs: [
        {
          ...state.runs[0]!,
          identityVersion: 2,
          thesisId: thesis.id,
          thesisSnapshot: thesis,
        },
      ],
    }))
    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Search Launcher' }))
    fireEvent.change(screen.getByLabelText('Look-for signals'), {
      target: { value: 'unsaved platform signal' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Write skill depth 1 back to Identity' }))

    const confirmPanel = screen
      .getByText('Confirm Identity writeback')
      .closest('[role="region"]') as HTMLElement
    expect(confirmPanel.textContent).toContain('move it from v2 to v3')
    expect(confirmPanel.textContent).toContain(
      includeSavedThesis
        ? '4 downstream artifacts may need review: 1 search thesis, 1 search run, 1 prep deck, and 1 cover letter.'
        : '3 downstream artifacts may need review: 1 search run, 1 prep deck, and 1 cover letter.',
    )
    expect(confirmPanel.textContent).toContain('Search run')
    expect(confirmPanel.textContent).toContain('Acme prep deck')
    expect(confirmPanel.textContent).toContain('Acme cover letter')
    fireEvent.change(screen.getByLabelText('Skill depth 1 depth'), {
      target: { value: 'expert' },
    })
    fireEvent.change(screen.getByLabelText('Skill depth 1 context'), {
      target: { value: 'Current visible thesis row context wins.' },
    })
    expect(confirmPanel.textContent).toContain('Depth: strong → expert')

    fireEvent.click(within(confirmPanel).getByRole('button', { name: 'Apply to Identity' }))

    const updatedIdentity = useIdentityStore.getState().currentIdentity
    const updatedSkill = updatedIdentity?.skills.groups[0]?.items[0]
    expect(updatedIdentity?.model_revision).toBe(3)
    expect(updatedSkill).toMatchObject({
      name: 'Kubernetes',
      depth: 'expert',
      depthSource: 'corrected',
      context: 'Current visible thesis row context wins.',
      positioning:
        'Prioritize architecture-heavy platform roles.\n\nAvoid cluster-administration-only roles.',
      enriched_by: 'user',
    })
    expect(screen.getByLabelText('Look-for signals')).toHaveProperty(
      'value',
      'unsaved platform signal',
    )
    expect(screen.getByText(/Updated Identity skill "Kubernetes"/)).toBeTruthy()
    expect(screen.getByText('Downstream impact queued')).toBeTruthy()
    expect(
      screen.getAllByText(
        includeSavedThesis
          ? /4 downstream artifacts may need review/
          : /3 downstream artifacts may need review/,
      ).length,
    ).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Review impacted artifacts' }))
    const stalenessReview = screen
      .getByText('Batch staleness review')
      .closest('[role="region"]') as HTMLElement
    return { identity, savedThesisId: savedThesis?.id ?? null, stalenessReview }
  }

  it('writes thesis skill-depth corrections back to Identity after confirmation', async () => {
    const { stalenessReview } = await openBatchReviewFromSkillWriteback()
    expect(stalenessReview.textContent).toContain('Search run')
    expect(stalenessReview.textContent).toContain('Acme prep deck')
    expect(stalenessReview.textContent).toContain('Acme cover letter')
    // TASK-158 AC #4: value-level identity diff renders before the artifact list
    const diffList = within(stalenessReview).getByLabelText(
      'Identity changes that triggered this review',
    )
    expect(diffList.textContent).toContain('skills.Kubernetes.depth')
    expect(diffList.textContent).toContain('strong → expert')
    fireEvent.click(
      within(stalenessReview).getByRole('button', {
        name: 'Save accept current artifact for Search run',
      }),
    )
    expect(stalenessReview.textContent).toContain('Status: Accepted current artifact.')
    fireEvent.click(
      within(stalenessReview).getByRole('button', {
        name: 'Save not stale decision for Acme prep deck',
      }),
    )
    expect(stalenessReview.textContent).toContain('Status: Marked not stale.')
    fireEvent.click(
      within(stalenessReview).getByRole('button', {
        name: 'Save not stale decision for Acme cover letter',
      }),
    )
    expect(stalenessReview.textContent).toContain(
      'Search run refreshes start a new deep research job',
    )
    expect(useSearchStore.getState().runs[0]?.stalenessReview).toMatchObject({
      decision: 'accepted-current',
      reviewedIdentityVersion: 3,
      mutationLabel: 'Kubernetes depth correction',
      artifactIdentityVersionAtReview: 2,
      mutationFromRevision: 2,
      mutationToRevision: 3,
    })
    expect(usePrepStore.getState().decks[0]?.stalenessReview).toMatchObject({
      decision: 'not-stale',
      reviewedIdentityVersion: 3,
      mutationLabel: 'Kubernetes depth correction',
      artifactIdentityVersionAtReview: 2,
    })
    expect(useCoverLetterStore.getState().templates[0]?.stalenessReview).toMatchObject({
      decision: 'not-stale',
      reviewedIdentityVersion: 3,
      mutationLabel: 'Kubernetes depth correction',
      artifactIdentityVersionAtReview: 2,
    })
    expect(mockNavigate).not.toHaveBeenCalledWith({ to: '/identity' })
    expect(screen.queryByText('Downstream impact queued')).toBeNull()
    fireEvent.click(
      within(stalenessReview).getByRole('button', {
        name: 'Close batch review',
      }),
    )
    expect(screen.queryByText('Batch staleness review')).toBeNull()
    expect(screen.getByText(/Decisions were saved on reviewed artifacts/)).toBeTruthy()
  })

  it('opens the batch staleness review from the routed stale-review request', async () => {
    mockResearchSearch.review = 'stale'
    const identity = cloneIdentityFixture()
    identity.model_revision = 5
    useIdentityStore.setState({
      currentIdentity: identity,
      draftDocument: JSON.stringify(identity, null, 2),
    })
    useSearchStore.setState((state) => ({
      ...state,
      theses: [
        buildTestThesis({
          id: 'thesis-route-stale',
          identityVersion: 3,
          identityFields: ['skills.Kubernetes.depth'],
        }),
      ],
      activeThesisId: null,
      runs: [],
    }))

    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    const stalenessReview = await screen.findByText('Batch staleness review')
    const reviewRegion = stalenessReview.closest('[role="region"]') as HTMLElement
    expect(reviewRegion.textContent).toContain(
      '1 downstream artifact may need review: 1 search thesis.',
    )
    expect(reviewRegion.textContent).toContain('Saved search thesis')
    expect(reviewRegion.textContent).toContain(
      'Generated from identity v3 before this correction moves identity to v5',
    )
  })

  it('records the generation-start identity version when Identity changes during thesis generation', async () => {
    const identity = cloneIdentityFixture()
    identity.model_revision = 4
    useIdentityStore.setState({
      currentIdentity: identity,
      draftDocument: JSON.stringify(identity, null, 2),
    })
    let resolveGenerate:
      | ((value: { thesis: SearchThesis; contractViolations: string[] }) => void)
      | undefined
    mockGenerateSearchThesisFromIdentity.mockReturnValueOnce(
      new Promise<{ thesis: SearchThesis; contractViolations: string[] }>((resolve) => {
        resolveGenerate = resolve
      }),
    )

    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Search Launcher' }))
    fireEvent.click(screen.getByRole('button', { name: /Generate Thesis/i }))

    await waitFor(() => {
      expect(mockGenerateSearchThesisFromIdentity).toHaveBeenCalledTimes(1)
    })

    act(() => {
      useIdentityStore.setState({
        currentIdentity: {
          ...identity,
          model_revision: 6,
        },
      })
    })

    const respond = resolveGenerate
    if (!respond) throw new Error('Expected thesis generation to be in flight.')
    await act(async () => {
      respond({
        thesis: buildTestThesis({
          id: 'thesis-generated-drift',
          identityVersion: 99,
        }),
        contractViolations: [],
      })
    })

    await waitFor(() => {
      expect(useSearchStore.getState().activeThesisId).toBe('thesis-generated-drift')
    })
    expect(useSearchStore.getState().theses.at(-1)?.identityVersion).toBe(4)
    expect(useIdentityStore.getState().currentIdentity?.model_revision).toBe(6)
  })

  it('refreshes stale saved search theses from the batch review', async () => {
    const { savedThesisId, stalenessReview } = await openBatchReviewFromSkillWriteback({
      includeSavedThesis: true,
    })
    expect(savedThesisId).toBe('thesis-saved-stale')
    expect(stalenessReview.textContent).toContain('Saved search thesis')
    expect(stalenessReview.textContent).toContain(
      '4 downstream artifacts may need review: 1 search thesis, 1 search run, 1 prep deck, and 1 cover letter.',
    )

    mockGenerateSearchThesisFromIdentity.mockResolvedValueOnce({
      thesis: buildTestThesis({
        id: 'thesis-refresh-generated',
        identityVersion: 3,
        lookFor: ['latest platform signal'],
        skillDepthMap: [
          {
            skill: 'Kubernetes',
            depth: 'expert',
            context: 'Current Identity correction is now reflected in the thesis.',
            searchSignal: 'Prioritize architecture-heavy platform roles.',
          },
        ],
      }),
      contractViolations: [],
    })

    fireEvent.click(
      within(stalenessReview).getByRole('button', {
        name: 'Refresh Saved search thesis with latest Identity',
      }),
    )

    await waitFor(() => {
      expect(mockGenerateSearchThesisFromIdentity).toHaveBeenCalledTimes(1)
    })
    expect(mockGenerateSearchThesisFromIdentity.mock.calls[0]?.[0]).toMatchObject({
      model_revision: 3,
    })
    expect(mockGenerateSearchThesisFromIdentity.mock.calls[0]?.[1]).toBe('https://ai.example/proxy')
    expect(mockGenerateSearchThesisFromIdentity.mock.calls[0]?.[2]).toEqual([])

    await waitFor(() => {
      expect(stalenessReview.textContent).toContain('Status: Refreshed with latest Identity.')
    })
    expect(
      within(stalenessReview).getByRole('button', {
        name: 'Save accept current artifact for Saved search thesis',
      }),
    ).toHaveProperty('disabled', true)
    expect(
      within(stalenessReview).getByRole('button', {
        name: 'Save not stale decision for Saved search thesis',
      }),
    ).toHaveProperty('disabled', true)
    const refreshedThesis = useSearchStore
      .getState()
      .theses.find((thesisItem) => thesisItem.id === savedThesisId)
    expect(refreshedThesis).toMatchObject({
      id: savedThesisId,
      identityVersion: 3,
      lookFor: [expect.objectContaining({ label: 'latest platform signal' })],
    })
    expect(refreshedThesis?.stalenessReview).toMatchObject({
      decision: 'accepted-current',
      reviewedIdentityVersion: 3,
      artifactIdentityVersionAtReview: 3,
      mutationLabel: 'Kubernetes depth correction',
      mutationFromRevision: 2,
      mutationToRevision: 3,
    })
    expect(useSearchStore.getState().activeThesisId).toBe('thesis-writeback')
    expect(
      screen.getByText(/Saved search thesis refreshed with the latest Identity context/),
    ).toBeTruthy()
  })

  it('routes the prep deck refresh button to the prep deck handler (TASK-244)', async () => {
    const { stalenessReview } = await openBatchReviewFromSkillWriteback()
    // The prep deck is created with no pipeline entry seeded in pipelineStore,
    // so the dispatch should land in runPrepDeckRefresh and surface the
    // "no pipeline entry" notice rather than the legacy "Refresh pending" no-op.
    const refreshButton = within(stalenessReview).getByRole('button', {
      name: 'Refresh Acme prep deck with latest Identity',
    })
    expect(refreshButton).toBeTruthy()
    fireEvent.click(refreshButton)
    await waitFor(() => {
      expect(
        screen.getByText(
          /Acme prep deck cannot be refreshed because (it has no linked pipeline entry|its pipeline entry is no longer available)/,
        ),
      ).toBeTruthy()
    })
  })

  it('routes the cover letter refresh button to the cover letter handler (TASK-158 AC #6)', async () => {
    const { stalenessReview } = await openBatchReviewFromSkillWriteback()
    // The cover letter is created with a pipelineEntryId that has no matching entry seeded,
    // so the dispatch should land in runCoverLetterRefresh and surface the "no pipeline entry"
    // notice rather than the legacy "Refresh pending" / no-op for non-thesis types.
    const refreshButton = within(stalenessReview).getByRole('button', {
      name: 'Refresh Acme cover letter with latest Identity',
    })
    expect(refreshButton).toBeTruthy()
    fireEvent.click(refreshButton)
    await waitFor(() => {
      expect(
        screen.getByText(
          /Acme cover letter cannot be refreshed because its pipeline entry is no longer available/,
        ),
      ).toBeTruthy()
    })
    // Confirm the button label is type-specific and the action did NOT call generateCoverLetter
    // (the missing-entry guard fires before the AI call).
    expect(mockGenerateCoverLetter).not.toHaveBeenCalled()
  })

  it('requires cost confirmation before refreshing a stale search run', async () => {
    const { stalenessReview } = await openBatchReviewFromSkillWriteback()
    const originalRun = useSearchStore.getState().runs[0]!

    const refreshButton = stalenessReview.querySelector<HTMLButtonElement>(
      'button[aria-label="Refresh Search run with latest Identity"]',
    )
    if (!refreshButton) throw new Error('Expected search run refresh button.')
    fireEvent.click(refreshButton)

    const confirmPanel = within(stalenessReview)
      .getByText('Confirm search run refresh')
      .closest('.research-warning') as HTMLElement
    expect(confirmPanel.textContent).toContain('$6.18')
    expect(confirmPanel.textContent).toContain('claude-opus-4-7')
    expect(
      screen
        .getAllByRole('status')
        .some((node) => node.textContent === 'Confirm search run refresh for Search run.'),
    ).toBe(true)
    expect(mockCreateDeepResearchJob).not.toHaveBeenCalled()

    fireEvent.click(within(confirmPanel).getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByText('Confirm search run refresh')).toBeNull()
    expect(mockCreateDeepResearchJob).not.toHaveBeenCalled()
    expect(useSearchStore.getState().runs[0]).toMatchObject({
      id: originalRun.id,
      status: originalRun.status,
      results: originalRun.results,
    })
    expect(useSearchStore.getState().runs[0]?.stalenessReview).toBeUndefined()
  })

  it('warns when the run refresh estimate would exceed the research budget', async () => {
    mockFetchResearchUsage.mockResolvedValue({
      ...buildResearchUsage(),
      budget: {
        ...buildResearchUsage().budget,
        status: 'over',
        wouldExceedNextRun: true,
      },
    })
    const { stalenessReview } = await openBatchReviewFromSkillWriteback()

    await waitFor(() => {
      expect(screen.getByText(/Budget blocked|Budget near limit|Budget ok/)).toBeTruthy()
    })
    fireEvent.click(
      within(stalenessReview).getByRole('button', {
        name: 'Refresh Search run with latest Identity',
      }),
    )

    expect(screen.getByText(/this run would exceed the configured budget/)).toBeTruthy()
    expect(mockCreateDeepResearchJob).not.toHaveBeenCalled()
  })

  it('regenerates a stale search run after cost confirmation and records the review', async () => {
    const { stalenessReview } = await openBatchReviewFromSkillWriteback()
    const refreshedResult: SearchResultEntry = {
      ...useSearchStore.getState().runs[0]!.results[0]!,
      company: 'RefreshCo',
      candidateEdge:
        'RefreshCo needs platform leverage and this candidate has directly comparable evidence.',
    }
    mockFetchDeepResearchJob.mockResolvedValueOnce(
      buildResearchJob({
        id: 'job-new',
        status: 'completed',
        thesisSnapshot: {
          ...useSearchStore.getState().runs[0]!.thesisSnapshot!,
          identityVersion: 3,
        },
        progress: { phase: 'completed', elapsedMs: 120000, searchQueries: ['fresh platform'] },
        result: {
          narrative: {
            competitiveMoat: 'Refreshed moat.',
            selectionMethodology: 'Refreshed methodology.',
            marketContext: 'Refreshed market context.',
            executiveSummary: 'Refreshed summary.',
          },
          results: [refreshedResult],
          tokenUsage: { inputTokens: 4, outputTokens: 5, totalTokens: 9 },
        },
      }),
    )
    mockCreateDeepResearchJob.mockResolvedValueOnce({
      jobId: 'job-new',
      status: 'queued',
      usage: {
        ...buildResearchUsage(),
        estimate: { ...buildResearchUsage().estimate, runCostCents: 777 },
      },
      warning: {
        code: 'research_budget_near_limit',
        message: 'Refresh is projected near the budget ceiling.',
        projectedRemainingCents: 123,
        limitCents: 1000,
      },
    })

    fireEvent.click(
      within(stalenessReview).getByRole('button', {
        name: 'Refresh Search run with latest Identity',
      }),
    )
    fireEvent.click(
      within(stalenessReview).getByRole('button', {
        name: 'Confirm and refresh search run',
      }),
    )

    await waitFor(() => {
      expect(mockCreateDeepResearchJob).toHaveBeenCalledTimes(1)
    })
    const submitted = mockCreateDeepResearchJob.mock.calls[0]?.[0]
    expect(submitted).toMatchObject({
      endpoint: 'https://ai.example/proxy',
      thesisSnapshot: expect.objectContaining({
        id: 'thesis-writeback',
        identityVersion: 3,
        identityFields: [
          'skills.Kubernetes.depth',
          'skills.Kubernetes.context',
          'skills.Kubernetes.positioning',
        ],
      }),
      params: expect.objectContaining({ id: 'sreq-1' }),
    })

    await waitFor(() => {
      expect(useSearchStore.getState().runs[0]?.status).toBe('completed')
    })
    expect(useSearchStore.getState().runs[0]).toMatchObject({
      results: [expect.objectContaining({ company: 'RefreshCo' })],
      stalenessReview: expect.objectContaining({
        decision: 'accepted-current',
        reviewedIdentityVersion: 3,
        artifactIdentityVersionAtReview: 3,
        mutationLabel: 'Kubernetes depth correction',
        mutationFromRevision: 2,
        mutationToRevision: 3,
      }),
    })
    expect(stalenessReview.textContent).toContain('Status: Refreshed with latest Identity.')
  })

  it('disables other refresh actions while run refresh confirmation is open', async () => {
    const { stalenessReview } = await openBatchReviewFromSkillWriteback()

    fireEvent.click(
      within(stalenessReview).getByRole('button', {
        name: 'Refresh Search run with latest Identity',
      }),
    )

    expect(screen.getByText('Confirm search run refresh')).toBeTruthy()
    expect(
      within(stalenessReview).getByRole('button', {
        name: 'Refresh Acme prep deck with latest Identity',
      }),
    ).toHaveProperty('disabled', true)
    expect(
      within(stalenessReview).getByRole('button', {
        name: 'Refresh Acme cover letter with latest Identity',
      }),
    ).toHaveProperty('disabled', true)
  })

  it('skips the search run review stamp when Identity drifts during refresh', async () => {
    const { identity, stalenessReview } = await openBatchReviewFromSkillWriteback()
    const driftResult: SearchResultEntry = {
      ...useSearchStore.getState().runs[0]!.results[0]!,
      company: 'DriftCo',
      candidateEdge:
        'DriftCo needs platform leverage and this candidate has directly comparable evidence.',
    }
    let resolveJob: ((job: ResearchJob) => void) | undefined
    mockFetchDeepResearchJob.mockReturnValueOnce(
      new Promise<ResearchJob>((resolve) => {
        resolveJob = resolve
      }),
    )

    fireEvent.click(
      within(stalenessReview).getByRole('button', {
        name: 'Refresh Search run with latest Identity',
      }),
    )
    fireEvent.click(
      within(stalenessReview).getByRole('button', {
        name: 'Confirm and refresh search run',
      }),
    )

    await waitFor(() => {
      expect(mockFetchDeepResearchJob).toHaveBeenCalledTimes(1)
    })
    expect(
      screen.getByText(
        'Deep research refresh is running for Search run; this can take 60-120 seconds.',
      ),
    ).toBeTruthy()
    const visualProgress = within(stalenessReview).getByText(
      'Deep research refresh is running; this can take 60-120 seconds.',
    )
    expect(visualProgress.getAttribute('role')).toBeNull()
    expect(visualProgress.getAttribute('aria-live')).toBeNull()
    act(() => {
      useIdentityStore.setState({
        currentIdentity: {
          ...identity,
          model_revision: 4,
        },
      })
    })
    await act(async () => {
      resolveJob?.(
        buildResearchJob({
          id: 'job-new',
          status: 'completed',
          thesisSnapshot: {
            ...useSearchStore.getState().runs[0]!.thesisSnapshot!,
            identityVersion: 3,
          },
          progress: { phase: 'completed', elapsedMs: 120000, searchQueries: ['drift search'] },
          result: {
            narrative: {
              competitiveMoat: 'Drift moat.',
              selectionMethodology: 'Drift methodology.',
              marketContext: 'Drift market context.',
              executiveSummary: 'Drift summary.',
            },
            results: [driftResult],
            tokenUsage: { inputTokens: 7, outputTokens: 8, totalTokens: 15 },
          },
        }),
      )
    })

    await waitFor(() => {
      expect(useSearchStore.getState().runs[0]?.results[0]?.company).toBe('DriftCo')
    })
    expect(useSearchStore.getState().runs[0]?.stalenessReview).toBeUndefined()
    expect(
      screen.getByText(/Identity or review context changed during search run refresh/),
    ).toBeTruthy()
  })

  it('skips the search run review stamp when the batch review closes during refresh', async () => {
    const { stalenessReview } = await openBatchReviewFromSkillWriteback()
    const closedReviewResult: SearchResultEntry = {
      ...useSearchStore.getState().runs[0]!.results[0]!,
      company: 'ClosedReviewCo',
      candidateEdge:
        'ClosedReviewCo needs platform leverage and this candidate has directly comparable evidence.',
    }
    let resolveJob: ((job: ResearchJob) => void) | undefined
    mockFetchDeepResearchJob.mockReturnValueOnce(
      new Promise<ResearchJob>((resolve) => {
        resolveJob = resolve
      }),
    )

    fireEvent.click(
      within(stalenessReview).getByRole('button', {
        name: 'Refresh Search run with latest Identity',
      }),
    )
    fireEvent.click(
      within(stalenessReview).getByRole('button', {
        name: 'Confirm and refresh search run',
      }),
    )

    await waitFor(() => {
      expect(mockFetchDeepResearchJob).toHaveBeenCalledTimes(1)
    })
    fireEvent.click(within(stalenessReview).getByText('Close batch review'))
    await act(async () => {
      resolveJob?.(
        buildResearchJob({
          id: 'job-new',
          status: 'completed',
          thesisSnapshot: {
            ...useSearchStore.getState().runs[0]!.thesisSnapshot!,
            identityVersion: 3,
          },
          progress: { phase: 'completed', elapsedMs: 120000, searchQueries: ['closed review'] },
          result: {
            narrative: {
              competitiveMoat: 'Closed review moat.',
              selectionMethodology: 'Closed review methodology.',
              marketContext: 'Closed review market context.',
              executiveSummary: 'Closed review summary.',
            },
            results: [closedReviewResult],
            tokenUsage: { inputTokens: 10, outputTokens: 11, totalTokens: 21 },
          },
        }),
      )
    })

    await waitFor(() => {
      expect(useSearchStore.getState().runs[0]?.results[0]?.company).toBe('ClosedReviewCo')
    })
    expect(useSearchStore.getState().runs[0]?.stalenessReview).toBeUndefined()
    expect(
      screen.getByText(/Identity or review context changed during search run refresh/),
    ).toBeTruthy()
  })

  it('blocks search run refresh confirmation when another research job starts first', async () => {
    const { stalenessReview } = await openBatchReviewFromSkillWriteback()

    fireEvent.click(
      within(stalenessReview).getByRole('button', {
        name: 'Refresh Search run with latest Identity',
      }),
    )
    expect(screen.getByText('Confirm search run refresh')).toBeTruthy()

    act(() => {
      useSearchStore.getState().setActiveResearchJob({
        jobId: 'job-other',
        runId: 'srun-1',
        requestId: 'sreq-1',
        thesisId: 'thesis-writeback',
        status: 'running',
        lastObservedAt: '2026-03-10T10:07:00.000Z',
      })
    })

    fireEvent.click(within(stalenessReview).getByText('Confirm and refresh search run'))

    expect(mockCreateDeepResearchJob).not.toHaveBeenCalled()
    expect(screen.queryByText('Confirm search run refresh')).toBeNull()
    expect(
      screen.getByText(
        'A deep research job is already running. Wait for it to finish before refreshing a search run.',
      ),
    ).toBeTruthy()
  })

  it('blocks opening run refresh confirmation while another research job is active', async () => {
    const { stalenessReview } = await openBatchReviewFromSkillWriteback()
    act(() => {
      useSearchStore.getState().setActiveResearchJob({
        jobId: 'job-active-before-queue',
        runId: 'srun-1',
        requestId: 'sreq-1',
        thesisId: 'thesis-writeback',
        status: 'running',
        lastObservedAt: '2026-03-10T10:07:00.000Z',
      })
    })

    const refreshButton = stalenessReview.querySelector<HTMLButtonElement>(
      'button[aria-label="Refresh Search run with latest Identity"]',
    )
    if (!refreshButton) throw new Error('Expected search run refresh button.')
    fireEvent.click(refreshButton)

    expect(screen.queryByText('Confirm search run refresh')).toBeNull()
    expect(mockCreateDeepResearchJob).not.toHaveBeenCalled()
    expect(
      screen.getByText(
        'A deep research job is already running. Wait for it to finish before refreshing a search run.',
      ),
    ).toBeTruthy()
  })

  it('blocks search run refresh confirmation when Identity drifts before submit', async () => {
    const { identity, stalenessReview } = await openBatchReviewFromSkillWriteback()

    fireEvent.click(
      within(stalenessReview).getByRole('button', {
        name: 'Refresh Search run with latest Identity',
      }),
    )
    const confirmButton = within(stalenessReview).getByRole('button', {
      name: 'Confirm and refresh search run',
    })

    act(() => {
      useIdentityStore.setState({
        currentIdentity: {
          ...identity,
          model_revision: 4,
        },
      })
    })
    fireEvent.click(confirmButton)

    expect(mockCreateDeepResearchJob).not.toHaveBeenCalled()
    expect(
      screen.getByText(
        /Identity changed before refresh could run|Identity changed after batch review opened/,
      ),
    ).toBeTruthy()
  })

  it('leaves the original search run intact when refresh preflight fails', async () => {
    const { stalenessReview } = await openBatchReviewFromSkillWriteback()
    const originalRun = structuredClone(useSearchStore.getState().runs[0]!)
    mockCreateDeepResearchJob.mockRejectedValueOnce(new Error('billing limit reached'))

    fireEvent.click(
      within(stalenessReview).getByRole('button', {
        name: 'Refresh Search run with latest Identity',
      }),
    )
    fireEvent.click(
      within(stalenessReview).getByRole('button', {
        name: 'Confirm and refresh search run',
      }),
    )

    await waitFor(() => {
      expect(screen.getByText('billing limit reached')).toBeTruthy()
    })
    expect(useSearchStore.getState().runs[0]).toMatchObject({
      id: originalRun.id,
      status: originalRun.status,
      results: originalRun.results,
      searchLog: originalRun.searchLog,
    })
    expect(useSearchStore.getState().runs[0]?.stalenessReview).toBe(originalRun.stalenessReview)
  })

  it('blocks search run refresh when the preserved thesis snapshot is missing', async () => {
    const { stalenessReview } = await openBatchReviewFromSkillWriteback()
    act(() => {
      useSearchStore.getState().updateRun('srun-1', { thesisSnapshot: undefined })
    })

    fireEvent.click(
      within(stalenessReview).getByRole('button', {
        name: 'Refresh Search run with latest Identity',
      }),
    )

    expect(mockCreateDeepResearchJob).not.toHaveBeenCalled()
    expect(
      screen.getByText(
        'Search run cannot be refreshed because its original thesis snapshot is missing.',
      ),
    ).toBeTruthy()
  })

  it('blocks search run refresh when the original search request is missing', async () => {
    const { stalenessReview } = await openBatchReviewFromSkillWriteback()
    act(() => {
      useSearchStore.setState((state) => ({ ...state, requests: [] }))
    })

    fireEvent.click(
      within(stalenessReview).getByRole('button', {
        name: 'Refresh Search run with latest Identity',
      }),
    )

    expect(mockCreateDeepResearchJob).not.toHaveBeenCalled()
    expect(
      screen.getByText(
        'Search run cannot be refreshed because its original search request is missing.',
      ),
    ).toBeTruthy()
  })

  it('surfaces terminal search run refresh failures after the job starts', async () => {
    const { stalenessReview } = await openBatchReviewFromSkillWriteback()
    mockFetchDeepResearchJob.mockResolvedValueOnce(
      buildResearchJob({
        id: 'job-new',
        status: 'failed',
        error: {
          code: 'provider_error',
          message: 'proxy lost the research job',
          retriable: true,
        },
      }),
    )

    fireEvent.click(
      within(stalenessReview).getByRole('button', {
        name: 'Refresh Search run with latest Identity',
      }),
    )
    fireEvent.click(
      within(stalenessReview).getByRole('button', {
        name: 'Confirm and refresh search run',
      }),
    )

    await waitFor(() => {
      expect(
        screen.getByText('Search run refresh did not complete: proxy lost the research job'),
      ).toBeTruthy()
    })
    expect(useSearchStore.getState().runs[0]?.stalenessReview).toBeUndefined()
  })

  it('surfaces terminal search run refresh cancelation after the job starts', async () => {
    const { stalenessReview } = await openBatchReviewFromSkillWriteback()
    mockFetchDeepResearchJob.mockResolvedValueOnce(
      buildResearchJob({
        id: 'job-new',
        status: 'canceled',
      }),
    )

    fireEvent.click(
      within(stalenessReview).getByRole('button', {
        name: 'Refresh Search run with latest Identity',
      }),
    )
    fireEvent.click(
      within(stalenessReview).getByRole('button', {
        name: 'Confirm and refresh search run',
      }),
    )

    await waitFor(() => {
      expect(
        screen.getByText('Search run refresh did not complete: Deep research job was canceled.'),
      ).toBeTruthy()
    })
    expect(useSearchStore.getState().runs[0]?.stalenessReview).toBeUndefined()
  })

  it('discards a thesis refresh result when Identity changes mid-refresh', async () => {
    const { identity, savedThesisId, stalenessReview } = await openBatchReviewFromSkillWriteback({
      includeSavedThesis: true,
    })
    let resolveRefresh:
      | ((value: { thesis: SearchThesis; contractViolations: string[] }) => void)
      | undefined
    const refreshPromise = new Promise<{ thesis: SearchThesis; contractViolations: string[] }>(
      (resolve) => {
        resolveRefresh = resolve
      },
    )
    mockGenerateSearchThesisFromIdentity.mockReturnValueOnce(refreshPromise)

    fireEvent.click(
      within(stalenessReview).getByRole('button', {
        name: 'Refresh Saved search thesis with latest Identity',
      }),
    )
    await waitFor(() => {
      expect(mockGenerateSearchThesisFromIdentity).toHaveBeenCalledTimes(1)
    })

    act(() => {
      useIdentityStore.setState({
        currentIdentity: {
          ...identity,
          model_revision: 4,
        },
      })
    })
    await act(async () => {
      resolveRefresh?.({
        thesis: buildTestThesis({
          id: 'thesis-refresh-generated',
          identityVersion: 3,
        }),
        contractViolations: [],
      })
      await refreshPromise
    })

    await waitFor(() => {
      expect(
        screen.getByText(/Identity or review context changed during thesis refresh/),
      ).toBeTruthy()
    })
    const staleThesis = useSearchStore
      .getState()
      .theses.find((thesisItem) => thesisItem.id === savedThesisId)
    expect(staleThesis).toMatchObject({
      identityVersion: 2,
    })
  })

  it('blocks stale thesis refresh when the target thesis has unsaved edits', async () => {
    const { savedThesisId, stalenessReview } = await openBatchReviewFromSkillWriteback({
      includeSavedThesis: true,
    })

    act(() => {
      useSearchStore.getState().setActiveThesis(savedThesisId)
    })
    await waitFor(() => {
      expect(screen.getByLabelText('Look-for signals')).toBeTruthy()
    })
    fireEvent.change(screen.getByLabelText('Look-for signals'), {
      target: { value: 'unsaved look-for marker' },
    })

    fireEvent.click(
      within(stalenessReview).getByRole('button', {
        name: 'Refresh Saved search thesis with latest Identity',
      }),
    )

    expect(mockGenerateSearchThesisFromIdentity).not.toHaveBeenCalled()
    expect(
      screen.getByText(/Save or discard thesis edits before refreshing this stale thesis/),
    ).toBeTruthy()
    // identityVersion still 2 proves the refresh did not run — a successful refresh would bump to 3.
    expect(
      useSearchStore.getState().theses.find((thesis) => thesis.id === savedThesisId),
    ).toMatchObject({
      identityVersion: 2,
    })
  })

  it('ignores a second thesis refresh while one is already running', async () => {
    const { stalenessReview } = await openBatchReviewFromSkillWriteback({
      includeSavedThesis: true,
    })
    let resolveRefresh:
      | ((value: { thesis: SearchThesis; contractViolations: string[] }) => void)
      | undefined
    const refreshPromise = new Promise<{ thesis: SearchThesis; contractViolations: string[] }>(
      (resolve) => {
        resolveRefresh = resolve
      },
    )
    mockGenerateSearchThesisFromIdentity.mockReturnValueOnce(refreshPromise)
    const refreshButton = within(stalenessReview).getByRole('button', {
      name: 'Refresh Saved search thesis with latest Identity',
    })

    fireEvent.click(refreshButton)
    fireEvent.click(refreshButton)

    expect(mockGenerateSearchThesisFromIdentity).toHaveBeenCalledTimes(1)
    expect(refreshButton).toHaveProperty('disabled', true)
    await act(async () => {
      resolveRefresh?.({
        thesis: buildTestThesis({
          id: 'thesis-refresh-generated',
          identityVersion: 3,
        }),
        contractViolations: [],
      })
      await refreshPromise
    })
  })

  it('surfaces thesis refresh generator failures and clears the refreshing state', async () => {
    const { stalenessReview } = await openBatchReviewFromSkillWriteback({
      includeSavedThesis: true,
    })
    mockGenerateSearchThesisFromIdentity.mockRejectedValueOnce(new Error('proxy down'))
    const refreshButton = within(stalenessReview).getByRole('button', {
      name: 'Refresh Saved search thesis with latest Identity',
    })

    fireEvent.click(refreshButton)

    await waitFor(() => {
      expect(screen.getByText('proxy down')).toBeTruthy()
    })
    expect(refreshButton).toHaveProperty('disabled', false)
    expect(mockGenerateSearchThesisFromIdentity).toHaveBeenCalledTimes(1)
  })

  it('closes batch review while preserving saved decisions when Identity is cleared', async () => {
    const { stalenessReview } = await openBatchReviewFromSkillWriteback()
    fireEvent.click(
      within(stalenessReview).getByRole('button', {
        name: 'Save accept current artifact for Search run',
      }),
    )

    act(() => {
      useIdentityStore.setState({ currentIdentity: null, draftDocument: '' })
    })

    expect(screen.queryByText('Batch staleness review')).toBeNull()
    expect(screen.getByText(/Identity cleared after batch review opened/)).toBeTruthy()
    expect(screen.getByText(/Saved artifact decisions remain recorded/)).toBeTruthy()
    expect(screen.getByText(/reopen the review after loading Identity/)).toBeTruthy()
  })

  it('closes batch review while preserving saved decisions when Identity revision changes', async () => {
    const { identity, stalenessReview } = await openBatchReviewFromSkillWriteback()
    fireEvent.click(
      within(stalenessReview).getByRole('button', {
        name: 'Save accept current artifact for Search run',
      }),
    )

    act(() => {
      useIdentityStore.setState({
        currentIdentity: {
          ...identity,
          model_revision: 4,
        },
      })
    })

    expect(screen.queryByText('Batch staleness review')).toBeNull()
    expect(screen.getByText(/Identity changed after batch review opened/)).toBeTruthy()
    expect(screen.getByText(/Saved artifact decisions remain recorded/)).toBeTruthy()
    expect(screen.getByText(/generate a new impact notice/)).toBeTruthy()
  })

  it('cancels pending identity writeback when Identity is cleared mid-confirmation', async () => {
    const identity = cloneIdentityFixture()
    identity.model_revision = 2
    useIdentityStore.setState({
      currentIdentity: identity,
      draftDocument: JSON.stringify(identity, null, 2),
    })
    const thesis = buildTestThesis({
      id: 'thesis-writeback-cleared',
      identityVersion: 2,
      skillDepthMap: [
        {
          skill: 'Kubernetes',
          depth: 'architectural',
          context: 'Architected Kubernetes delivery paths for customer environments.',
          searchSignal: 'Prioritize architecture-heavy platform roles.',
          calibration: 'Avoid cluster-administration-only roles.',
        },
      ],
    })
    useSearchStore.setState((state) => ({
      ...state,
      theses: [thesis],
      activeThesisId: thesis.id,
    }))
    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Search Launcher' }))
    fireEvent.click(screen.getByRole('button', { name: 'Write skill depth 1 back to Identity' }))
    expect(screen.getByText('Confirm Identity writeback')).toBeTruthy()

    act(() => {
      useIdentityStore.setState({
        currentIdentity: null,
        draftDocument: '',
      })
    })

    await waitFor(() => {
      expect(screen.queryByText('Confirm Identity writeback')).toBeNull()
    })
    expect(screen.getByText(/Identity changed after confirmation opened/)).toBeTruthy()
  })

  it('cancels identity writeback when the selected skill changes after confirmation opens', async () => {
    const identity = cloneIdentityFixture()
    identity.model_revision = 2
    useIdentityStore.setState({
      currentIdentity: identity,
      draftDocument: JSON.stringify(identity, null, 2),
    })
    const thesis = buildTestThesis({
      id: 'thesis-writeback-stale-skill',
      identityVersion: 2,
      skillDepthMap: [
        {
          skill: 'Kubernetes',
          depth: 'architectural',
          context: 'Architected Kubernetes delivery paths for customer environments.',
          searchSignal: 'Prioritize architecture-heavy platform roles.',
          calibration: 'Avoid cluster-administration-only roles.',
        },
      ],
    })
    useSearchStore.setState((state) => ({
      ...state,
      theses: [thesis],
      activeThesisId: thesis.id,
    }))
    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Search Launcher' }))
    fireEvent.click(screen.getByRole('button', { name: 'Write skill depth 1 back to Identity' }))
    fireEvent.change(screen.getByLabelText('Skill depth 1 skill'), {
      target: { value: 'Rust' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Apply to Identity' }))

    expect(screen.getByRole('alert').textContent).toContain(
      'The selected thesis skill changed after confirmation opened.',
    )
    expect(useIdentityStore.getState().currentIdentity?.model_revision).toBe(2)
  })

  it('cancels identity writeback when Identity changes after confirmation opens', async () => {
    const identity = cloneIdentityFixture()
    identity.model_revision = 2
    useIdentityStore.setState({
      currentIdentity: identity,
      draftDocument: JSON.stringify(identity, null, 2),
    })
    const thesis = buildTestThesis({
      id: 'thesis-writeback-stale-identity',
      identityVersion: 2,
      skillDepthMap: [
        {
          skill: 'Kubernetes',
          depth: 'architectural',
          context: 'Architected Kubernetes delivery paths for customer environments.',
          searchSignal: 'Prioritize architecture-heavy platform roles.',
          calibration: 'Avoid cluster-administration-only roles.',
        },
      ],
    })
    useSearchStore.setState((state) => ({
      ...state,
      theses: [thesis],
      activeThesisId: thesis.id,
    }))
    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Search Launcher' }))
    fireEvent.click(screen.getByRole('button', { name: 'Write skill depth 1 back to Identity' }))
    identity.model_revision = 3
    fireEvent.click(screen.getByRole('button', { name: 'Apply to Identity' }))

    expect(screen.getByRole('alert').textContent).toContain(
      'Identity changed after confirmation opened.',
    )
    expect(useIdentityStore.getState().currentIdentity?.model_revision).toBe(3)
  })

  it('blocks identity writeback when thesis positioning fields are empty', async () => {
    const identity = cloneIdentityFixture()
    identity.model_revision = 2
    useIdentityStore.setState({
      currentIdentity: identity,
      draftDocument: JSON.stringify(identity, null, 2),
    })
    const thesis = buildTestThesis({
      id: 'thesis-writeback-empty-positioning',
      identityVersion: 2,
      skillDepthMap: [
        {
          skill: 'Kubernetes',
          depth: 'architectural',
          context: 'Architected Kubernetes delivery paths for customer environments.',
          searchSignal: '   ',
          calibration: '   ',
        },
      ],
    })
    useSearchStore.setState((state) => ({
      ...state,
      theses: [thesis],
      activeThesisId: thesis.id,
    }))
    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Search Launcher' }))
    fireEvent.click(screen.getByRole('button', { name: 'Write skill depth 1 back to Identity' }))
    fireEvent.click(screen.getByRole('button', { name: 'Apply to Identity' }))

    expect(screen.getByRole('alert').textContent).toContain(
      'Add a search signal or calibration note before writing positioning back to Identity.',
    )
    expect(useIdentityStore.getState().currentIdentity?.model_revision).toBe(2)
    expect(
      useIdentityStore.getState().currentIdentity?.skills.groups[0]?.items[0]?.enriched_by,
    ).not.toBe('user')
  })

  it('blocks identity writeback when the thesis skill is not in Identity', async () => {
    const identity = cloneIdentityFixture()
    identity.model_revision = 2
    useIdentityStore.setState({
      currentIdentity: identity,
      draftDocument: JSON.stringify(identity, null, 2),
    })
    const thesis = buildTestThesis({
      id: 'thesis-writeback-missing-skill',
      identityVersion: 2,
      skillDepthMap: [
        {
          skill: 'Made-up Skill',
          depth: 'architectural',
          context: 'Context.',
          searchSignal: 'Signal.',
          calibration: 'Calibration.',
        },
      ],
    })
    useSearchStore.setState((state) => ({
      ...state,
      theses: [thesis],
      activeThesisId: thesis.id,
    }))
    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Search Launcher' }))
    fireEvent.click(screen.getByRole('button', { name: 'Write skill depth 1 back to Identity' }))

    expect(screen.getByRole('alert').textContent).toContain(
      'Could not find "Made-up Skill" in the Identity skill model.',
    )
    expect(screen.queryByText('Confirm Identity writeback')).toBeNull()
    expect(useIdentityStore.getState().currentIdentity?.model_revision).toBe(2)
  })

  it('blocks identity writeback when skill depth is unsupported', async () => {
    const identity = cloneIdentityFixture()
    identity.model_revision = 2
    useIdentityStore.setState({
      currentIdentity: identity,
      draftDocument: JSON.stringify(identity, null, 2),
    })
    const invalidDepth = 'operator-grade' as SearchThesis['skillDepthMap'][number]['depth']
    const thesis = buildTestThesis({
      id: 'thesis-writeback-invalid-depth',
      identityVersion: 2,
      skillDepthMap: [
        {
          skill: 'Kubernetes',
          depth: invalidDepth,
          context: 'Context.',
          searchSignal: 'Signal.',
          calibration: 'Calibration.',
        },
      ],
    })
    useSearchStore.setState((state) => ({
      ...state,
      theses: [thesis],
      activeThesisId: thesis.id,
    }))
    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Search Launcher' }))
    fireEvent.click(screen.getByRole('button', { name: 'Write skill depth 1 back to Identity' }))

    expect(screen.getByRole('alert').textContent).toContain(
      'Choose a supported identity depth before writing "Kubernetes" back to Identity.',
    )
    expect(screen.queryByText('Confirm Identity writeback')).toBeNull()
    expect(useIdentityStore.getState().currentIdentity?.model_revision).toBe(2)
  })

  it('blocks identity writeback when skill depth becomes unsupported after confirmation opens', async () => {
    const identity = cloneIdentityFixture()
    identity.model_revision = 2
    useIdentityStore.setState({
      currentIdentity: identity,
      draftDocument: JSON.stringify(identity, null, 2),
    })
    const thesis = buildTestThesis({
      id: 'thesis-writeback-invalid-depth-confirm',
      identityVersion: 2,
      skillDepthMap: [
        {
          skill: 'Kubernetes',
          depth: 'architectural',
          context: 'Context.',
          searchSignal: 'Signal.',
          calibration: 'Calibration.',
        },
      ],
    })
    useSearchStore.setState((state) => ({
      ...state,
      theses: [thesis],
      activeThesisId: thesis.id,
    }))
    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Search Launcher' }))
    fireEvent.click(screen.getByRole('button', { name: 'Write skill depth 1 back to Identity' }))
    fireEvent.change(screen.getByLabelText('Skill depth 1 depth'), {
      target: { value: 'operator-grade' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Apply to Identity' }))

    expect(screen.getByRole('alert').textContent).toContain(
      'Choose a supported identity depth before writing "Kubernetes" back to Identity.',
    )
    expect(useIdentityStore.getState().currentIdentity?.model_revision).toBe(2)
  })

  it('cancels pending identity writeback without modifying Identity', async () => {
    const identity = cloneIdentityFixture()
    identity.model_revision = 2
    useIdentityStore.setState({
      currentIdentity: identity,
      draftDocument: JSON.stringify(identity, null, 2),
    })
    const thesis = buildTestThesis({
      id: 'thesis-writeback-cancel',
      identityVersion: 2,
      skillDepthMap: [
        {
          skill: 'Kubernetes',
          depth: 'architectural',
          context: 'Context.',
          searchSignal: 'Signal.',
          calibration: 'Calibration.',
        },
      ],
    })
    useSearchStore.setState((state) => ({
      ...state,
      theses: [thesis],
      activeThesisId: thesis.id,
    }))
    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Search Launcher' }))
    fireEvent.click(screen.getByRole('button', { name: 'Write skill depth 1 back to Identity' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel Identity writeback' }))

    expect(screen.queryByText('Confirm Identity writeback')).toBeNull()
    expect(screen.getByText('Identity writeback canceled.')).toBeTruthy()
    expect(useIdentityStore.getState().currentIdentity?.model_revision).toBe(2)
  })

  it('groups skill-depth entries into proposed/confirmed/surfaced sections with counts', async () => {
    const identity = cloneIdentityFixture()
    identity.skills.groups[0]!.items = [
      { name: 'Kubernetes', tags: ['platform'], depth: 'strong' },
      { name: 'Terraform', tags: ['platform'], depth: 'working' },
    ]
    useIdentityStore.setState({
      currentIdentity: identity,
      draftDocument: JSON.stringify(identity, null, 2),
    })
    const thesis = buildTestThesis({
      id: 'thesis-skill-depth-groups',
      skillDepthMap: [
        {
          skill: 'Kubernetes',
          depth: 'expert',
          context: 'Architected delivery paths.',
          searchSignal: 'Prioritize architecture.',
        },
        {
          skill: 'Terraform',
          depth: 'working',
          context: 'Wrote modules at Contoso.',
          searchSignal: 'Mid-signal match.',
        },
        {
          skill: 'Rust',
          depth: 'working',
          context: 'Side projects.',
          searchSignal: 'Surface-only.',
        },
      ],
    })
    useSearchStore.setState((state) => ({
      ...state,
      theses: [thesis],
      activeThesisId: thesis.id,
    }))
    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Search Launcher' }))

    expect(screen.getByText('Depth changes proposed (1)')).toBeTruthy()
    expect(screen.getByText('Depths confirmed (1)')).toBeTruthy()
    expect(screen.getByText('New skills surfaced (1)')).toBeTruthy()

    const proposedDetails = screen
      .getByText('Depth changes proposed (1)')
      .closest('details') as HTMLDetailsElement
    const confirmedDetails = screen
      .getByText('Depths confirmed (1)')
      .closest('details') as HTMLDetailsElement
    const surfacedDetails = screen
      .getByText('New skills surfaced (1)')
      .closest('details') as HTMLDetailsElement

    expect(proposedDetails.open).toBe(true)
    expect(confirmedDetails.open).toBe(false)
    expect(surfacedDetails.open).toBe(true)

    // Proposed and surfaced entries expose the existing Write back button.
    // (Surfaced entries surface a helpful "skill not in Identity" error on click;
    // the writeback handler is the canonical place that decides whether the
    // mutation is valid, so keeping the affordance preserves that feedback path.)
    expect(
      screen.getByRole('button', { name: 'Write skill depth 1 back to Identity' }),
    ).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Write skill depth 3 back to Identity' }),
    ).toBeTruthy()
    // Confirmed entries have no Write back button — depth already matches Identity.
    expect(
      screen.queryByRole('button', { name: 'Write skill depth 2 back to Identity' }),
    ).toBeNull()
  })

  it('renders explanatory empty-state copy when no skill-depth entries exist', async () => {
    const identity = cloneIdentityFixture()
    useIdentityStore.setState({
      currentIdentity: identity,
      draftDocument: JSON.stringify(identity, null, 2),
    })
    const thesis = buildTestThesis({
      id: 'thesis-skill-depth-empty',
      skillDepthMap: [],
    })
    useSearchStore.setState((state) => ({
      ...state,
      theses: [thesis],
      activeThesisId: thesis.id,
    }))
    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Search Launcher' }))

    expect(screen.getByText('Depth changes proposed (0)')).toBeTruthy()
    expect(screen.getByText('Depths confirmed (0)')).toBeTruthy()
    expect(screen.getByText('New skills surfaced (0)')).toBeTruthy()
    expect(
      screen.getByText('No depth changes proposed. The thesis depths match your identity.'),
    ).toBeTruthy()
    expect(screen.getByText('No confirmed depths yet.')).toBeTruthy()
    expect(
      screen.getByText('No new skills surfaced. The thesis stayed within your identity skill set.'),
    ).toBeTruthy()
  })

  it('uses the reviewed active thesis when launching deep research', async () => {
    const identity = cloneIdentityFixture()
    identity.model_revision = 4
    useIdentityStore.setState({
      currentIdentity: identity,
      draftDocument: JSON.stringify(identity, null, 2),
    })

    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Search Launcher' }))
    fireEvent.click(screen.getByRole('button', { name: /Generate Thesis/i }))

    await waitFor(() => {
      expect(useSearchStore.getState().activeThesisId).toBe('thesis-generated')
    })

    fireEvent.click(screen.getByRole('button', { name: /Launch Search/i }))

    await waitFor(() => {
      expect(mockCreateDeepResearchJob).toHaveBeenCalledTimes(1)
    })

    expect(mockCreateDeepResearchJob.mock.calls[0]?.[0].thesisSnapshot.id).toBe('thesis-generated')
    const launchedRun = useSearchStore.getState().runs.at(-1)
    expect(launchedRun?.identityVersion).toBe(4)
    expect(launchedRun?.identityFields).toContain('skills.Kubernetes.depth')
  })

  it('records the launch-start identity version when Identity changes while creating a research job', async () => {
    const identity = cloneIdentityFixture()
    identity.model_revision = 4
    useIdentityStore.setState({
      currentIdentity: identity,
      draftDocument: JSON.stringify(identity, null, 2),
    })
    let resolveCreate:
      | ((value: {
          jobId: string
          status: 'queued'
          usage?: undefined
          warning?: undefined
        }) => void)
      | undefined
    mockCreateDeepResearchJob.mockReturnValueOnce(
      new Promise<{ jobId: string; status: 'queued'; usage?: undefined; warning?: undefined }>(
        (resolve) => {
          resolveCreate = resolve
        },
      ),
    )

    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Search Launcher' }))
    fireEvent.click(screen.getByRole('button', { name: /Generate Thesis/i }))

    await waitFor(() => {
      expect(useSearchStore.getState().activeThesisId).toBe('thesis-generated')
    })

    fireEvent.click(screen.getByRole('button', { name: /Launch Search/i }))

    await waitFor(() => {
      expect(mockCreateDeepResearchJob).toHaveBeenCalledTimes(1)
    })

    act(() => {
      useIdentityStore.setState({
        currentIdentity: {
          ...identity,
          model_revision: 7,
        },
      })
    })

    const respond = resolveCreate
    if (!respond) throw new Error('Expected research job creation to be in flight.')
    await act(async () => {
      respond({ jobId: 'job-drift', status: 'queued' })
    })

    await waitFor(() => {
      expect(useSearchStore.getState().runs.at(-1)?.jobId).toBe('job-drift')
    })
    const launchedRun = useSearchStore.getState().runs.at(-1)
    expect(launchedRun?.identityVersion).toBe(4)
    expect(useSearchStore.getState().activeResearchJob?.jobId).toBe('job-drift')
    expect(useIdentityStore.getState().currentIdentity?.model_revision).toBe(7)
  })

  it('surfaces Phase 2 Opus unavailability without dropping the preserved thesis', async () => {
    const identity = cloneIdentityFixture()
    useIdentityStore.setState({
      currentIdentity: identity,
      draftDocument: JSON.stringify(identity, null, 2),
    })
    const thesis = seedLaunchThesis({ id: 'thesis-phase-2-preserved' })
    mockCreateDeepResearchJob.mockRejectedValueOnce(
      new FacetAiProxyError(
        'Deep research requires Opus, which is currently unavailable. Your reviewed thesis is preserved; try again when Opus returns.',
        {
          status: 503,
          code: 'ai_capability_unavailable',
          reason: 'opus_unavailable',
          feature: 'research.deep-search',
        },
      ),
    )

    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Search Launcher' }))
    fireEvent.click(screen.getByRole('button', { name: /Launch Search/i }))

    await waitFor(() => {
      expect(mockCreateDeepResearchJob).toHaveBeenCalledTimes(1)
      expect(screen.getByRole('alert').textContent).toContain('Deep research requires Opus')
    })
    const failedRun = useSearchStore.getState().runs.at(-1)
    expect(failedRun?.status).toBe('failed')
    expect(failedRun?.thesisSnapshot?.id).toBe(thesis.id)
    expect(useSearchStore.getState().activeThesisId).toBe(thesis.id)
  })

  it('propagates per-search overrides from the active thesis into both request params and snapshot', async () => {
    const identity = cloneIdentityFixture()
    useIdentityStore.setState({
      currentIdentity: identity,
      draftDocument: JSON.stringify(identity, null, 2),
    })
    // Active thesis carries an override layer with concrete per-search values. After launch,
    // these should be visible to the deep-research backend on BOTH channels:
    //   - params.companySizeOverride / salaryAnchorOverride (used by the runner's filter logic)
    //   - thesisSnapshot.searchOverrides (used by the LLM as per-search context)
    useSearchStore.setState((state) => ({
      ...state,
      theses: [
        buildTestThesis({
          id: 'thesis-with-overrides',
          lookFor: ['platform leverage'],
          avoid: ['ad tech'],
          searchOverrides: {
            constraints: {
              salary: { min: 340000, max: 340000, currency: 'USD' },
              locations: ['Tampa Bay'],
              clearance: 'None',
              companySize: 'growth',
            },
            interviewPrefs: {
              strongFit: ['take-home portfolio'],
              redFlags: ['leetcode-only loops'],
            },
            hiddenSkillIds: [],
          },
        }),
      ],
      activeThesisId: 'thesis-with-overrides',
    }))

    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Search Launcher' }))
    fireEvent.click(screen.getByRole('button', { name: /Launch Search/i }))

    await waitFor(() => {
      expect(mockCreateDeepResearchJob).toHaveBeenCalledTimes(1)
    })

    const submitted = mockCreateDeepResearchJob.mock.calls[0]?.[0]
    // P1.1 — request params reflect the per-search overrides, not the identity defaults.
    expect(submitted?.params.companySizeOverride).toBe('growth')
    expect(submitted?.params.salaryAnchorOverride).toBe('$340k')
    // P1.2 — thesisSnapshot preserves the full override layer for downstream LLM context.
    expect(submitted?.thesisSnapshot.searchOverrides).toEqual({
      constraints: {
        salary: { min: 340000, max: 340000, currency: 'USD' },
        locations: ['Tampa Bay'],
        clearance: 'None',
        companySize: 'growth',
      },
      interviewPrefs: {
        strongFit: ['take-home portfolio'],
        redFlags: ['leetcode-only loops'],
      },
      hiddenSkillIds: [],
    })
  })

  it('marks incorporated feedback reflected when saving a reviewed thesis', async () => {
    const thesis = buildTestThesis({
      id: 'thesis-feedback',
      feedbackIncorporated: ['sfe-1'],
    })
    useSearchStore.setState((state) => ({
      ...state,
      theses: [thesis],
      activeThesisId: thesis.id,
      feedbackEvents: [
        {
          id: 'sfe-1',
          createdAt: '2026-03-10T10:00:00.000Z',
          runId: 'srun-1',
          resultId: 'sres-1',
          rating: 'down',
          appliedToIdentity: true,
          appliedAtVersion: 2,
        },
      ],
    }))

    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Search Launcher' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save thesis edits' }))

    await waitFor(() => {
      expect(useSearchStore.getState().feedbackEvents[0]?.reflectedInThesisId).toBe(thesis.id)
    })
  })

  it('removes keyword rows linked to a deleted thesis lane', async () => {
    const thesis = buildTestThesis({
      id: 'thesis-keyword-reconcile',
      searchLanes: [
        {
          id: 'lane-platform',
          title: 'Platform modernization',
          rationale: 'This lane targets platform modernization. It fits the thesis.',
          targetSignals: ['platform modernization'],
        },
        {
          id: 'lane-devex',
          title: 'Developer productivity infrastructure',
          rationale: 'This lane targets developer leverage. It fits the thesis.',
          targetSignals: ['developer productivity'],
        },
      ],
      keywordCombinations: [
        {
          id: 'skwd-1',
          query: '"platform modernization"',
          lane: 'lane-platform',
          noiseLevel: 'low',
        },
      ],
    })
    useSearchStore.setState((state) => ({
      ...state,
      theses: [thesis],
      activeThesisId: thesis.id,
    }))

    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Search Launcher' }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove lane' })[0]!)
    expect(screen.getByText(/Dropped 1 linked keyword combination/)).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Save thesis edits' }))

    await waitFor(() => {
      expect(useSearchStore.getState().theses[0]?.searchLanes.map((lane) => lane.id)).toEqual([
        'lane-devex',
      ])
    })
    expect(useSearchStore.getState().theses[0]?.keywordCombinations).toEqual([])
  })

  // Removed: 'adds and removes unfair advantage rows with stable ids'.
  // Unfair advantages are now identity-canonical (Self Model band on Identity).
  // Research displays them read-only and snapshots from identity at thesis-gen time.

  it('clears optional timeline metadata when urgency is removed', async () => {
    const thesis = buildTestThesis({
      id: 'thesis-clear-timeline',
      timeline: {
        urgency: 'active',
        deadline: '2026-05-01',
        strategyImpact: 'Prioritize active searches.',
      },
    })
    useSearchStore.setState((state) => ({
      ...state,
      theses: [thesis],
      activeThesisId: thesis.id,
    }))

    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Search Launcher' }))
    fireEvent.change(screen.getByLabelText('Timeline urgency'), {
      target: { value: '' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save thesis edits' }))

    await waitFor(() => {
      expect(useSearchStore.getState().theses[0]?.timeline).toBeUndefined()
    })
  })

  it('requires timeline strategy impact before saving an urgent thesis timeline', async () => {
    const thesis = buildTestThesis({
      id: 'thesis-timeline-validation',
      timeline: {
        urgency: 'active',
        strategyImpact: 'Prioritize active searches.',
      },
    })
    useSearchStore.setState((state) => ({
      ...state,
      theses: [thesis],
      activeThesisId: thesis.id,
    }))

    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Search Launcher' }))
    fireEvent.change(screen.getByLabelText('Look-for signals'), {
      target: { value: 'fresh platform signal' },
    })
    fireEvent.change(screen.getByLabelText('Timeline strategy impact'), {
      target: { value: '   ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save thesis edits' }))

    expect(screen.getByRole('alert').textContent).toContain(
      'Timeline strategy impact is required before saving thesis edits.',
    )
    expect(screen.getByText('Add strategy impact before saving this timeline.')).toBeTruthy()
    expect(screen.getByLabelText('Look-for signals')).toHaveProperty(
      'value',
      'fresh platform signal',
    )
    expect(useSearchStore.getState().theses[0]?.timeline?.strategyImpact).toBe(
      'Prioritize active searches.',
    )
  })

  it('restores timeline details when urgency is toggled off and back on before save', async () => {
    const thesis = buildTestThesis({
      id: 'thesis-timeline-toggle-restore',
      timeline: {
        urgency: 'active',
        deadline: '2026-06-01',
        strategyImpact: 'Prioritize active searches.',
      },
    })
    useSearchStore.setState((state) => ({
      ...state,
      theses: [thesis],
      activeThesisId: thesis.id,
    }))

    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Search Launcher' }))
    fireEvent.change(screen.getByLabelText('Timeline urgency'), {
      target: { value: '' },
    })
    expect(screen.getByLabelText('Timeline deadline')).toHaveProperty('value', '')
    fireEvent.change(screen.getByLabelText('Timeline urgency'), {
      target: { value: 'critical' },
    })

    expect(screen.getByLabelText('Timeline deadline')).toHaveProperty('value', '2026-06-01')
    expect(screen.getByLabelText('Timeline strategy impact')).toHaveProperty(
      'value',
      'Prioritize active searches.',
    )
  })

  it('preserves unchanged look-for entries that contain commas', async () => {
    const thesis = buildTestThesis({
      id: 'thesis-look-for-commas',
      lookFor: ['k8s, observability', 'developer platform'],
    })
    useSearchStore.setState((state) => ({
      ...state,
      theses: [thesis],
      activeThesisId: thesis.id,
    }))

    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Search Launcher' }))
    // Edit a non-look-for field (skill calibration) to mark the draft dirty
    // without touching the look-for text — verifies look-for is not re-tokenized
    // when other thesis fields change.
    fireEvent.change(screen.getByLabelText('Skill depth 1 calibration'), {
      target: { value: 'Calibration edit that should not re-tokenize look-for.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save thesis edits' }))

    await waitFor(() => {
      expect(useSearchStore.getState().theses[0]?.lookFor.map((signal) => signal.label)).toEqual([
        'k8s, observability',
        'developer platform',
      ])
    })
  })

  it('preserves existing thesis signal metadata when editing look-for labels', async () => {
    const thesis = buildTestThesis({
      id: 'thesis-prioritize-metadata',
      lookFor: [
        {
          id: 'ssig-platform-existing',
          label: 'platform modernization',
          condition: 'only with product ownership',
          severity: 'hard',
        },
      ],
    })
    useSearchStore.setState((state) => ({
      ...state,
      theses: [thesis],
      activeThesisId: thesis.id,
    }))

    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Search Launcher' }))
    fireEvent.change(screen.getByLabelText('Look-for signals'), {
      target: { value: 'platform modernization, PLATFORM MODERNIZATION, developer leverage' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save thesis edits' }))

    await waitFor(() => {
      expect(useSearchStore.getState().theses[0]?.lookFor).toEqual([
        expect.objectContaining({
          id: 'ssig-platform-existing',
          label: 'platform modernization',
          condition: 'only with product ownership',
          severity: 'hard',
        }),
        expect.objectContaining({
          label: 'developer leverage',
          severity: 'soft',
        }),
      ])
    })
  })

  it('adds avoid signals in canonical signal shape from the thesis editor', async () => {
    const thesis = buildTestThesis({
      id: 'thesis-add-avoid-signal',
      avoid: [],
    })
    useSearchStore.setState((state) => ({
      ...state,
      theses: [thesis],
      activeThesisId: thesis.id,
    }))

    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Search Launcher' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add avoid signal' }))
    fireEvent.change(screen.getByLabelText('Avoid 1 label'), {
      target: { value: 'Defense-only platforms' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save thesis edits' }))

    await waitFor(() => {
      const added = useSearchStore.getState().theses[0]?.avoid[0]
      expect(added).toEqual(
        expect.objectContaining({
          label: 'Defense-only platforms',
          condition: '',
          severity: 'soft',
        }),
      )
      expect(added?.id).toMatch(/^ssig-/)
    })
  })

  it('does not resync an identity-backed profile when the derived payload is unchanged', async () => {
    const identity = cloneIdentityFixture()
    const identityProfile = adaptIdentityToSearchProfile(identity, {
      resumeVersion: defaultResumeData.version,
    })
    const originalSetProfile = useSearchStore.getState().setProfile
    const setProfileSpy = vi.fn((nextProfile: Parameters<typeof originalSetProfile>[0]) =>
      originalSetProfile(nextProfile),
    )

    useIdentityStore.setState({
      currentIdentity: identity,
      draftDocument: JSON.stringify(identity, null, 2),
    })
    useSearchStore.setState((state) => ({
      ...state,
      profile: {
        ...identityProfile,
        id: 'sprof-identity',
        inferredAt: '2026-04-11T12:00:00.000Z',
      },
      setProfile: setProfileSpy,
    }))

    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    await waitFor(() => {
      expect(screen.getByLabelText('Search readiness').textContent).toContain('Identity model')
    })

    expect(setProfileSpy).not.toHaveBeenCalled()
  })

  it('derives identity skill depths from available evidence instead of flattening to working', async () => {
    const identity = cloneIdentityFixture()
    identity.skills.groups[0]!.items = [
      { name: 'Kubernetes', tags: ['platform', 'kubernetes'] },
      { name: 'Go', tags: ['go'] },
      { name: 'React', depth: 'expert', tags: ['react'] },
    ]

    useIdentityStore.setState({
      currentIdentity: identity,
      draftDocument: JSON.stringify(identity, null, 2),
    })

    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    await waitFor(() => {
      expect(useSearchStore.getState().profile?.source?.kind).toBe('identity')
    })

    const skillDepths = Object.fromEntries(
      (useSearchStore.getState().profile?.skills ?? []).map((skill) => [skill.name, skill.depth]),
    )

    expect(skillDepths.Kubernetes).toBe('strong')
    expect(skillDepths.Go).toBe('basic')
    expect(skillDepths.React).toBe('expert')
  })

  it('restores the prior resume-backed profile after leaving identity mode', async () => {
    const resumeProfile = structuredClone(useSearchStore.getState().profile)
    const identity = cloneIdentityFixture()
    const { ResearchPage } = await import('../routes/research/ResearchPage')

    useIdentityStore.setState({
      currentIdentity: identity,
      draftDocument: JSON.stringify(identity, null, 2),
    })

    render(<ResearchPage />)

    await waitFor(() => {
      expect(useSearchStore.getState().profile?.source?.kind).toBe('identity')
    })

    useIdentityStore.setState({
      currentIdentity: null,
      draftDocument: '',
    })

    await waitFor(() => {
      expect(useSearchStore.getState().profile?.source?.kind).toBe('resume')
    })

    expect(useSearchStore.getState().profile).not.toHaveProperty('vectors')
    expect(useSearchStore.getState().profile?.constraints).toMatchObject({
      ...resumeProfile?.constraints,
      industriesToAvoid: [],
      fundingStagesAcceptable: [],
      remotePolicies: [],
      remotePolicyNote: '',
      employmentTypes: [],
    })
  })

  it('wires tabs to their tabpanel content', async () => {
    const { ResearchPage } = await import('../routes/research/ResearchPage')

    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Search Launcher' }))

    const panel = screen.getByRole('tabpanel')
    expect(panel.getAttribute('aria-labelledby')).toBe('research-tab-search')
  })

  it('shows auto-excluded companies from closed pipeline entries', async () => {
    usePipelineStore.setState((state) => ({
      ...state,
      entries: [
        {
          id: 'pipe-closed',
          company: 'OldCo',
          role: 'Staff Engineer',
          tier: '2',
          status: 'rejected',
          comp: '',
          url: '',
          contact: '',
          vectorId: 'backend',
          jobDescription: '',
          presetId: null,
          resumeVariant: '',
          resumeGeneration: null,
          positioning: '',
          skillMatch: '',
          nextStep: '',
          notes: '',
          appMethod: 'unknown',
          response: 'none',
          daysToResponse: null,
          rounds: null,
          format: [],
          rejectionStage: '',
          rejectionReason: '',
          offerAmount: '',
          dateApplied: '',
          dateClosed: '',
          lastAction: '2026-03-10',
          createdAt: '2026-03-10',
          history: [],
        },
      ],
    }))

    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Search Launcher' }))
    expect(screen.getByText('OldCo')).toBeTruthy()
  })

  it('surfaces billing-issue messaging without blocking the rest of the page', async () => {
    seedLaunchThesis({ id: 'thesis-billing-test' })
    mockCreateDeepResearchJob.mockRejectedValueOnce(
      new Error('AI access is unavailable until billing is resolved for this hosted account.'),
    )

    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Search Launcher' }))
    fireEvent.click(screen.getByRole('button', { name: /Launch Search/i }))

    await waitFor(() => {
      const alerts = screen.getAllByRole('alert')
      expect(alerts.some((alert) => alert.textContent?.includes('billing is resolved'))).toBe(true)
    })

    expect(screen.getByRole('tab', { name: 'Search Launcher' })).toBeTruthy()
  })

  it('hides the stale warning when resume and profile versions match', async () => {
    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    expect(screen.queryByText(/current resume data is version/i)).toBeNull()
  })

  it('passes excluded companies into launched searches and stores successful results', async () => {
    const identity = cloneIdentityFixture()
    identity.model_revision = 2
    useIdentityStore.setState({
      currentIdentity: identity,
      draftDocument: JSON.stringify(identity, null, 2),
    })
    usePipelineStore.setState((state) => ({
      ...state,
      entries: [
        {
          id: 'pipe-rejected',
          company: 'OldCo',
          role: 'Staff Engineer',
          tier: '2',
          status: 'rejected',
          comp: '',
          url: '',
          contact: '',
          vectorId: 'backend',
          jobDescription: '',
          presetId: null,
          resumeVariant: '',
          resumeGeneration: null,
          positioning: '',
          skillMatch: '',
          nextStep: '',
          notes: '',
          appMethod: 'unknown',
          response: 'none',
          daysToResponse: null,
          rounds: null,
          format: [],
          rejectionStage: '',
          rejectionReason: '',
          offerAmount: '',
          dateApplied: '',
          dateClosed: '',
          lastAction: '2026-03-10',
          createdAt: '2026-03-10',
          history: [],
        },
        {
          id: 'pipe-closed',
          company: 'LaterCo',
          role: 'Principal Engineer',
          tier: '1',
          status: 'closed',
          comp: '',
          url: '',
          contact: '',
          vectorId: 'backend',
          jobDescription: '',
          presetId: null,
          resumeVariant: '',
          resumeGeneration: null,
          positioning: '',
          skillMatch: '',
          nextStep: '',
          notes: '',
          appMethod: 'unknown',
          response: 'none',
          daysToResponse: null,
          rounds: null,
          format: [],
          rejectionStage: '',
          rejectionReason: '',
          offerAmount: '',
          dateApplied: '',
          dateClosed: '',
          lastAction: '2026-03-10',
          createdAt: '2026-03-10',
          history: [],
        },
      ],
    }))

    seedLaunchThesis({ id: 'thesis-completed-job' })
    mockFetchDeepResearchJob.mockResolvedValueOnce({
      id: 'job-new',
      userId: 'user-1',
      thesisId: 'thesis-1',
      thesisSnapshot: {
        id: 'thesis-1',
        createdAt: '2026-03-10T10:00:00.000Z',
        updatedAt: '2026-03-10T10:00:00.000Z',
        competitiveMoat: 'Default moat.',
        unfairAdvantages: [],
        searchLanes: [],
        lookFor: [],
        avoid: [],
        keywordCombinations: [],
        skillDepthMap: [
          { skill: 'TypeScript', depth: 'strong', context: 'Test', searchSignal: 'Test' },
        ],
        source: 'generated',
        identityVersion: 0,
        feedbackIncorporated: [],
      },
      identityVersion: 0,
      params: useSearchStore.getState().requests[0]!,
      paramsHash: 'hash',
      status: 'completed',
      createdAt: '2026-03-10T10:06:00.000Z',
      startedAt: '2026-03-10T10:06:00.000Z',
      completedAt: '2026-03-10T10:08:00.000Z',
      ttlAt: '2026-04-10T10:06:00.000Z',
      progress: {
        phase: 'completed',
        elapsedMs: 120000,
        searchQueries: ['principal backend engineer'],
      },
      result: {
        narrative: {
          competitiveMoat: 'The candidate has a durable platform moat with production evidence.',
          selectionMethodology:
            'The search filtered for senior platform roles with strong backend overlap.',
          marketContext:
            'Platform hiring remains active in companies investing in internal leverage.',
          executiveSummary:
            'NewCo is the best current fit because the role needs principal-level backend platform ownership and the candidate evidence maps cleanly to that scope [cite:market-report].',
          citations: [
            {
              id: 'market-report',
              source: 'Market Report',
              url: 'https://example.com/market',
              type: 'news',
              claim: 'Platform hiring remains active',
            },
          ],
        },
        contractViolations: ['candidateEdge for NewCo is shorter than expected.'],
        results: [
          {
            id: 'sres-new',
            tier: 1,
            company: 'NewCo',
            title: 'Principal Engineer',
            url: 'https://example.com/jobs/new',
            matchScore: 95,
            matchReason: 'Very strong match [cite:newco-careers]',
            vectorAlignment: 'backend',
            risks: [],
            source: 'greenhouse',
            candidateEdge:
              'The candidate has shipped backend platforms at staff scope. NewCo needs principal-level platform ownership, so the evidence maps directly to the role [cite:newco-careers].',
            citations: [
              {
                id: 'newco-careers',
                source: 'NewCo Careers',
                url: 'https://example.com/jobs/new',
                type: 'careers',
                claim: 'Principal platform ownership role',
              },
            ],
            companyIntel: {
              stage: 'Series B',
              aiCulture: 'AI-native engineering workflows',
              remotePolicy: 'Remote-first',
            },
            interviewProcess: {
              format: 'Architecture screen and work sample',
              estimatedTimeline: '3 weeks',
            },
          },
        ],
        tokenUsage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      },
    })

    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Search Launcher' }))
    fireEvent.click(screen.getByRole('button', { name: /Launch Search/i }))

    await waitFor(() => {
      expect(useSearchStore.getState().runs.at(-1)?.status).toBe('completed')
    })

    expect(mockCreateDeepResearchJob).toHaveBeenCalledTimes(1)
    expect(mockCreateDeepResearchJob.mock.calls[0]?.[0].params.excludeCompanies).toEqual([
      'LaterCo',
      'OldCo',
    ])
    expect(useSearchStore.getState().runs.at(-1)?.results[0]?.company).toBe('NewCo')
    expect(
      screen.getByText('The candidate has a durable platform moat with production evidence.'),
    ).toBeTruthy()
    expect(screen.getByText(/shipped backend platforms at staff scope/)).toBeTruthy()
    expect(screen.getAllByText('Market Report').length).toBeGreaterThan(0)
    expect(screen.getAllByText('NewCo Careers').length).toBeGreaterThan(0)
    expect(
      screen.getByText('Series B · AI-native engineering workflows · Remote-first'),
    ).toBeTruthy()
    expect(screen.getByText('Architecture screen and work sample · 3 weeks')).toBeTruthy()
    expect(screen.getByText('candidateEdge for NewCo is shorter than expected.')).toBeTruthy()
    expect(screen.getByText('Research job used an earlier Identity version')).toBeTruthy()
    expect(
      screen.getByText(/This search ran against identity v0; the current identity model is v2/),
    ).toBeTruthy()
  })

  it('stamps the current identity revision when rerunning a stale completed research job', async () => {
    const identity = cloneIdentityFixture()
    identity.model_revision = 4
    useIdentityStore.setState({
      currentIdentity: identity,
      draftDocument: JSON.stringify(identity, null, 2),
    })
    seedLaunchThesis({ id: 'thesis-stale-rerun', identityVersion: 2 })
    mockFetchDeepResearchJob.mockResolvedValueOnce(
      buildResearchJob({
        id: 'job-stale-rerun',
        status: 'completed',
        thesisSnapshot: buildTestThesis({ id: 'thesis-stale-rerun', identityVersion: 2 }),
        identityVersion: 2,
        result: {
          narrative: {
            competitiveMoat: 'Stale moat.',
            selectionMethodology: 'Stale methodology.',
            marketContext: 'Stale market context.',
            executiveSummary: 'Stale summary.',
          },
          results: [],
          tokenUsage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        },
      }),
    )

    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Search Launcher' }))
    fireEvent.click(screen.getByRole('button', { name: /Launch Search/i }))

    await waitFor(() => {
      expect(screen.getByText('Research job used an earlier Identity version')).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Rerun with current Identity' }))

    await waitFor(() => {
      expect(mockCreateDeepResearchJob).toHaveBeenCalledTimes(2)
    })
    const rerunRequest = mockCreateDeepResearchJob.mock.calls[1]?.[0]
    expect(rerunRequest?.thesisSnapshot).toMatchObject({
      id: 'thesis-stale-rerun',
      identityVersion: 4,
    })
    expect(rerunRequest?.thesisSnapshot.identityFields).toContain('skills.TypeScript.depth')
    expect(useSearchStore.getState().runs.at(-1)?.identityVersion).toBe(4)
  })

  it('shows an error when search launch is missing the AI endpoint', async () => {
    vi.stubEnv('VITE_ANTHROPIC_PROXY_URL', '')
    seedLaunchThesis({ id: 'thesis-missing-endpoint' })
    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Search Launcher' }))
    fireEvent.click(screen.getByRole('button', { name: /Launch Search/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('AI research is disabled')
    })
  })

  it('blocks search launch until an active thesis exists', async () => {
    // Keep the default profile in place; this test exercises the no-thesis blocker,
    // not the no-profile empty state (which is covered elsewhere).
    useSearchStore.setState((state) => ({ ...state, requests: [], runs: [] }))
    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Search Launcher' }))

    expect(
      screen
        .getByRole('button', { name: /Generate a thesis to launch search/i })
        .hasAttribute('disabled'),
    ).toBe(true)
    expect(mockCreateDeepResearchJob).not.toHaveBeenCalled()
  })

  it('shows the running search state while a search is in flight', async () => {
    seedLaunchThesis({ id: 'thesis-running-state' })
    let resolveCreate: ((value: { jobId: string; status: 'queued' }) => void) | undefined
    mockCreateDeepResearchJob.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve
        }),
    )

    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Search Launcher' }))
    fireEvent.click(screen.getByRole('button', { name: /Launch Search/i }))

    await waitFor(() => {
      expect(
        screen.getByRole('tab', { name: 'Results Viewer' }).getAttribute('aria-selected'),
      ).toBe('true')
    })

    expect(screen.getByText('running')).toBeTruthy()

    resolveCreate?.({ jobId: 'job-pending', status: 'queued' })

    await waitFor(() => {
      expect(useSearchStore.getState().activeResearchJob?.jobId).toBe('job-pending')
    })
  })

  it('shows deep research budget status and the estimated run cost near launch', async () => {
    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    await screen.findByText('Budget near limit')
    expect(screen.getByText('$3.82 left')).toBeTruthy()
    expect(screen.getByText(/Est\. run: \$6\.18 · \$3\.82 left/)).toBeTruthy()
    expect(mockFetchResearchUsage).toHaveBeenCalledWith('https://ai.example/proxy')
  })

  it('keeps the header research budget badge dev-only', async () => {
    const { shouldShowResearchBudgetBadge } =
      await import('../routes/research/researchBudgetVisibility')

    expect(shouldShowResearchBudgetBadge({ DEV: true })).toBe(true)
    expect(shouldShowResearchBudgetBadge({ DEV: false })).toBe(false)
    expect(shouldShowResearchBudgetBadge()).toBe(import.meta.env.DEV)
  })

  it('omits the header research budget badge when the dev-only gate is off', async () => {
    vi.resetModules()
    vi.doMock('../routes/research/researchBudgetVisibility', () => ({
      shouldShowResearchBudgetBadge: () => false,
    }))
    const { ResearchPage } = await import('../routes/research/ResearchPage')

    render(<ResearchPage />)

    await waitFor(() => {
      expect(mockFetchResearchUsage).toHaveBeenCalledWith('https://ai.example/proxy')
    })
    expect(screen.queryByText('Budget near limit')).toBeNull()
    expect(screen.queryByText('$3.82 left')).toBeNull()

    vi.doUnmock('../routes/research/researchBudgetVisibility')
    vi.resetModules()
  })

})
