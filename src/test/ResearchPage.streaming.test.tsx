// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { DeepResearchStreamHandlers } from '../utils/deepSearchClient'
import type {
  ResearchJob,
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
    model: 'claude-opus-4-8',
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
          model: 'claude-opus-4-8',
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

  it('renders stream events and hydrates completed jobs from the complete event', async () => {
    const thesisSnapshot = buildTestThesis({ id: 'thesis-stream' })
    let streamHandlers: DeepResearchStreamHandlers | undefined
    mockStreamDeepResearchJob.mockImplementationOnce(((
      _endpoint: string,
      _jobId: string,
      handlers: DeepResearchStreamHandlers,
    ) => {
      streamHandlers = handlers
      return { close: vi.fn() }
    }) as typeof mockStreamDeepResearchJob)
    mockFetchDeepResearchJob
      .mockResolvedValueOnce(
        buildResearchJob({
          id: 'job-stream',
          thesisSnapshot,
          status: 'running',
          progress: { phase: 'searching', elapsedMs: 1000, searchQueries: ['staff platform'] },
        }),
      )
      .mockResolvedValueOnce(
        buildResearchJob({
          id: 'job-stream',
          thesisSnapshot,
          status: 'completed',
          progress: { phase: 'completed', elapsedMs: 120000, searchQueries: ['staff platform'] },
          result: {
            narrative: {
              competitiveMoat: 'Stream-completed moat.',
              selectionMethodology: 'Stream-completed methodology.',
              marketContext: 'Stream-completed context.',
              executiveSummary: 'Stream completion produced a final result.',
            },
            results: [],
            tokenUsage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          },
        }),
      )
    useSearchStore.setState((state) => ({
      ...state,
      runs: [
        {
          ...state.runs[0]!,
          status: 'running',
          results: [],
          searchLog: [],
          thesisId: thesisSnapshot.id,
          thesisSnapshot,
          jobId: 'job-stream',
        },
      ],
      activeResearchJob: {
        jobId: 'job-stream',
        runId: 'srun-1',
        requestId: 'sreq-1',
        thesisId: thesisSnapshot.id,
        status: 'running',
        lastObservedAt: '2026-03-10T10:06:00.000Z',
      },
    }))

    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    await waitFor(() => {
      expect(mockStreamDeepResearchJob).toHaveBeenCalledWith(
        'https://ai.example/proxy',
        'job-stream',
        expect.any(Object),
      )
      expect(streamHandlers).toBeDefined()
    })

    await act(async () => {
      streamHandlers?.onEvent({ type: 'thinking', data: 'Checking source quality' })
      streamHandlers?.onEvent({ type: 'search_query', data: 'staff platform remote' })
    })

    expect(screen.getByText('Thinking: Checking source quality')).toBeTruthy()
    expect(screen.getByText('Search: staff platform remote')).toBeTruthy()

    await act(async () => {
      streamHandlers?.onEvent({ type: 'complete', data: 'job-stream' })
    })

    await waitFor(() => {
      expect(useSearchStore.getState().runs[0]?.status).toBe('completed')
    })
    expect(mockFetchDeepResearchJob).toHaveBeenCalledWith('https://ai.example/proxy', 'job-stream')
  })

  it('closes the live stream while hidden and reopens it when visible', async () => {
    const streamClose = vi.fn()
    mockStreamDeepResearchJob.mockReturnValue({ close: streamClose })
    mockFetchDeepResearchJob.mockResolvedValue(
      buildResearchJob({ id: 'job-visibility', status: 'running' }),
    )
    useSearchStore.setState((state) => ({
      ...state,
      runs: [{ ...state.runs[0]!, status: 'running', jobId: 'job-visibility' }],
      activeResearchJob: {
        jobId: 'job-visibility',
        runId: 'srun-1',
        requestId: 'sreq-1',
        thesisId: 'thesis-1',
        status: 'running',
        lastObservedAt: '2026-03-10T10:06:00.000Z',
      },
    }))

    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    await waitFor(() => {
      expect(mockStreamDeepResearchJob).toHaveBeenCalledTimes(1)
    })

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    document.dispatchEvent(new Event('visibilitychange'))
    await waitFor(() => {
      expect(streamClose).toHaveBeenCalledTimes(1)
    })

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    document.dispatchEvent(new Event('visibilitychange'))
    await waitFor(() => {
      expect(mockStreamDeepResearchJob).toHaveBeenCalledTimes(2)
    })
  })

  it('falls back to polling when the live stream reports an error', async () => {
    const streamClose = vi.fn()
    let streamHandlers: DeepResearchStreamHandlers | undefined
    mockStreamDeepResearchJob.mockImplementationOnce(((
      _endpoint: string,
      _jobId: string,
      handlers: DeepResearchStreamHandlers,
    ) => {
      streamHandlers = handlers
      return { close: streamClose }
    }) as typeof mockStreamDeepResearchJob)
    mockFetchDeepResearchJob.mockResolvedValue(
      buildResearchJob({
        id: 'job-stream-error',
        status: 'running',
        progress: { phase: 'running', elapsedMs: 1000, searchQueries: ['backend platform'] },
      }),
    )
    useSearchStore.setState((state) => ({
      ...state,
      runs: [{ ...state.runs[0]!, status: 'running', jobId: 'job-stream-error' }],
      activeResearchJob: {
        jobId: 'job-stream-error',
        runId: 'srun-1',
        requestId: 'sreq-1',
        thesisId: 'thesis-1',
        status: 'running',
        lastObservedAt: '2026-03-10T10:06:00.000Z',
      },
    }))

    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    await waitFor(() => {
      expect(screen.getByText('Live stream + polling')).toBeTruthy()
      expect(streamHandlers).toBeDefined()
    })

    await act(async () => {
      streamHandlers?.onError?.(new Error('SSE dropped'))
    })

    expect(streamClose).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Polling')).toBeTruthy()
  })

  it('surfaces polling errors and recovers on the next scheduled poll', async () => {
    vi.useFakeTimers()
    try {
      mockFetchDeepResearchJob
        .mockRejectedValueOnce(new Error('Temporary poll failure'))
        .mockResolvedValueOnce(
          buildResearchJob({
            id: 'job-poll-retry',
            status: 'completed',
            progress: {
              phase: 'completed',
              elapsedMs: 120000,
              searchQueries: ['backend platform'],
            },
            result: {
              narrative: {
                competitiveMoat: 'Recovered polling moat.',
                selectionMethodology: 'Recovered polling methodology.',
                marketContext: 'Recovered polling context.',
                executiveSummary: 'Recovered polling summary.',
              },
              results: [],
              tokenUsage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            },
          }),
        )
      useSearchStore.setState((state) => ({
        ...state,
        runs: [{ ...state.runs[0]!, status: 'running', jobId: 'job-poll-retry' }],
        activeResearchJob: {
          jobId: 'job-poll-retry',
          runId: 'srun-1',
          requestId: 'sreq-1',
          thesisId: 'thesis-1',
          status: 'running',
          lastObservedAt: '2026-03-10T10:06:00.000Z',
        },
      }))

      const { ResearchPage } = await import('../routes/research/ResearchPage')
      render(<ResearchPage />)

      await act(async () => {
        await Promise.resolve()
      })
      expect(screen.getByRole('alert').textContent).toContain('Temporary poll failure')

      await act(async () => {
        vi.advanceTimersByTime(2000)
        await Promise.resolve()
        await Promise.resolve()
      })

      expect(useSearchStore.getState().runs[0]?.status).toBe('completed')
      expect(mockFetchDeepResearchJob).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('cancels the active research job and clears the server-side run state', async () => {
    mockFetchDeepResearchJob.mockResolvedValue(
      buildResearchJob({ id: 'job-cancel', status: 'running' }),
    )
    mockCancelDeepResearchJob.mockResolvedValueOnce(
      buildResearchJob({ id: 'job-cancel', status: 'canceled' }),
    )
    useSearchStore.setState((state) => ({
      ...state,
      runs: [{ ...state.runs[0]!, status: 'running', jobId: 'job-cancel' }],
      activeResearchJob: {
        jobId: 'job-cancel',
        runId: 'srun-1',
        requestId: 'sreq-1',
        thesisId: 'thesis-1',
        status: 'running',
        lastObservedAt: '2026-03-10T10:06:00.000Z',
      },
    }))

    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'Cancel deep research' }))

    await waitFor(() => {
      expect(mockCancelDeepResearchJob).toHaveBeenCalledWith(
        'https://ai.example/proxy',
        'job-cancel',
      )
      expect(useSearchStore.getState().activeResearchJob).toBeNull()
    })
    expect(useSearchStore.getState().runs[0]?.error).toContain('canceled')
  })

  it('retries a failed run with current identity evidence metadata when identity is loaded', async () => {
    const identity = cloneIdentityFixture()
    identity.model_revision = 4
    useIdentityStore.setState({
      currentIdentity: identity,
      draftDocument: JSON.stringify(identity, null, 2),
    })
    const thesisSnapshot = buildTestThesis({
      id: 'thesis-retry',
      identityVersion: 2,
    })
    useSearchStore.setState((state) => ({
      ...state,
      runs: [
        {
          ...state.runs[0]!,
          status: 'failed',
          error: 'Provider timed out.',
          thesisId: thesisSnapshot.id,
          thesisSnapshot,
        },
      ],
    }))

    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Results Viewer' }))
    fireEvent.click(
      screen.getByRole('button', { name: 'Retry preserved thesis with current Identity' }),
    )

    await waitFor(() => {
      expect(mockCreateDeepResearchJob).toHaveBeenCalledWith(
        expect.objectContaining({
          thesisSnapshot: expect.objectContaining({
            id: 'thesis-retry',
            competitiveMoat: 'Default moat.',
            identityVersion: 4,
          }),
        }),
      )
      expect(mockCreateDeepResearchJob.mock.calls[0]?.[0].thesisSnapshot.identityFields).toContain(
        'skills.TypeScript.depth',
      )
    })
  })

  it('retries a failed run from profile evidence when no identity is loaded', async () => {
    const thesisSnapshot = buildTestThesis({
      id: 'thesis-retry-profile',
      identityVersion: 2,
    })
    useSearchStore.setState((state) => ({
      ...state,
      runs: [
        {
          id: 'run-retry-profile',
          requestId: 'sreq-1',
          createdAt: '2026-03-10T10:06:00.000Z',
          status: 'failed',
          thesisId: thesisSnapshot.id,
          thesisSnapshot,
          searchLog: [],
          narrativeState: { status: 'failed', error: 'canceled', contractViolations: [] },
          results: [],
          error: 'canceled',
        },
      ],
      activeRunId: 'run-retry-profile',
    }))

    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Results Viewer' }))
    fireEvent.click(screen.getByRole('button', { name: 'Retry preserved thesis' }))

    await waitFor(() => {
      expect(mockCreateDeepResearchJob).toHaveBeenCalledWith(
        expect.objectContaining({
          thesisSnapshot: expect.objectContaining({
            id: 'thesis-retry-profile',
            competitiveMoat: 'Default moat.',
            identityVersion: 2,
          }),
        }),
      )
      expect(
        mockCreateDeepResearchJob.mock.calls[0]?.[0].thesisSnapshot.identityFields,
      ).toBeUndefined()
      expect(useSearchStore.getState().runs.at(-1)?.identityVersion).toBe(2)
    })
  })

  it('regenerates a contract-violating run from profile evidence when no identity is loaded', async () => {
    const thesisSnapshot = buildTestThesis({
      id: 'thesis-regenerate-profile',
      identityVersion: 2,
    })
    useSearchStore.setState((state) => ({
      ...state,
      runs: [
        {
          id: 'run-regenerate-profile',
          requestId: 'sreq-1',
          createdAt: '2026-03-10T10:06:00.000Z',
          status: 'completed',
          thesisId: thesisSnapshot.id,
          thesisSnapshot,
          searchLog: [],
          narrativeState: {
            status: 'ready',
            narrative: {
              competitiveMoat: 'Short.',
              selectionMethodology: 'Short.',
              marketContext: 'Short.',
              executiveSummary: 'Short.',
            },
            contractViolations: ['executiveSummary too short'],
          },
          results: [],
        },
      ],
      activeRunId: 'run-regenerate-profile',
    }))

    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Results Viewer' }))
    fireEvent.click(screen.getByRole('button', { name: 'Regenerate from preserved thesis' }))

    await waitFor(() => {
      expect(mockCreateDeepResearchJob).toHaveBeenCalledWith(
        expect.objectContaining({
          thesisSnapshot: expect.objectContaining({
            id: 'thesis-regenerate-profile',
            identityVersion: 2,
          }),
        }),
      )
      expect(
        mockCreateDeepResearchJob.mock.calls[0]?.[0].thesisSnapshot.identityFields,
      ).toBeUndefined()
    })
  })

  it('sends a desktop notification when a hidden job completes', async () => {
    const notificationConstructor = vi.fn()
    Object.defineProperty(notificationConstructor, 'permission', {
      configurable: true,
      value: 'granted',
    })
    Object.defineProperty(notificationConstructor, 'requestPermission', {
      configurable: true,
      value: vi.fn(),
    })
    vi.stubGlobal('Notification', notificationConstructor)
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    mockFetchDeepResearchJob.mockResolvedValueOnce(
      buildResearchJob({
        id: 'job-notify',
        status: 'completed',
        progress: { phase: 'completed', elapsedMs: 120000, searchQueries: ['principal platform'] },
        result: {
          narrative: {
            competitiveMoat: 'Notification moat.',
            selectionMethodology: 'Notification methodology.',
            marketContext: 'Notification context.',
            executiveSummary: 'Notification summary.',
          },
          results: [
            {
              ...useSearchStore.getState().runs[0]!.results[0]!,
              company: 'NotifyCo',
              candidateEdge:
                'NotifyCo needs platform leverage and this candidate has directly comparable evidence.',
            },
          ],
          tokenUsage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        },
      }),
    )
    useSearchStore.setState((state) => ({
      ...state,
      runs: [{ ...state.runs[0]!, status: 'running', jobId: 'job-notify' }],
      activeResearchJob: {
        jobId: 'job-notify',
        runId: 'srun-1',
        requestId: 'sreq-1',
        thesisId: 'thesis-1',
        status: 'running',
        lastObservedAt: '2026-03-10T10:06:00.000Z',
      },
    }))

    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    await waitFor(() => {
      expect(notificationConstructor).toHaveBeenCalledWith(
        'Facet deep research is ready',
        expect.objectContaining({ body: 'Your completed search report is available in Research.' }),
      )
    })
  })

  it('marks the run as failed when search execution errors', async () => {
    seedLaunchThesis({ id: 'thesis-failed-run' })
    mockCreateDeepResearchJob.mockRejectedValueOnce(new Error('Search execution failed hard'))
    const { ResearchPage } = await import('../routes/research/ResearchPage')

    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Search Launcher' }))
    fireEvent.click(screen.getByRole('button', { name: /Launch Search/i }))

    await waitFor(() => {
      expect(useSearchStore.getState().runs.at(-1)?.status).toBe('failed')
    })

    expect(useSearchStore.getState().runs.at(-1)?.error).toBe('Search execution failed hard')
  })

  it('supports keyboard navigation across tabs', async () => {
    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    const searchTab = screen.getByRole('tab', { name: 'Search Launcher' })
    const resultsTab = screen.getByRole('tab', { name: 'Results Viewer' })

    expect(searchTab.getAttribute('aria-selected')).toBe('true')

    fireEvent.keyDown(searchTab, { key: 'ArrowRight' })
    expect(resultsTab.getAttribute('aria-selected')).toBe('true')

    fireEvent.keyDown(resultsTab, { key: 'ArrowLeft' })
    expect(searchTab.getAttribute('aria-selected')).toBe('true')

    fireEvent.keyDown(searchTab, { key: 'End' })
    expect(resultsTab.getAttribute('aria-selected')).toBe('true')

    fireEvent.keyDown(resultsTab, { key: 'Home' })
    expect(searchTab.getAttribute('aria-selected')).toBe('true')

    fireEvent.keyDown(searchTab, { key: 'ArrowLeft' })
    expect(resultsTab.getAttribute('aria-selected')).toBe('true')

    fireEvent.keyDown(resultsTab, { key: 'ArrowRight' })
    expect(searchTab.getAttribute('aria-selected')).toBe('true')
  })

  it('shows the empty results state when no runs exist', async () => {
    useSearchStore.setState((state) => ({ ...state, runs: [] }))
    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Results Viewer' }))
    expect(screen.getByText('No runs yet')).toBeTruthy()
  })

  it('removes legacy skill add/edit affordances and still supports clearing the profile', async () => {
    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    // Skills are now identity-owned and read-only in the search workspace. The pre-redesign
    // affordances ("Add Skill" button, free-text name/context inputs, "Remove skill X" buttons)
    // should no longer be present.
    expect(screen.queryByRole('button', { name: /Add Skill/i })).toBeNull()
    expect(screen.queryByLabelText('Skill name')).toBeNull()
    expect(screen.queryByLabelText('Skill context')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Search Launcher' })).toBeTruthy()
    expect(screen.getByText('Focus lanes')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Clear Profile/i }))
    expect(useSearchStore.getState().profile).toBeNull()
    expect(screen.getByText('No search profile yet')).toBeTruthy()
    expect(screen.getByText(/Create a profile to launch search/i)).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Search Launcher' })).toBeNull()
    expect(screen.queryByText('Focus lanes')).toBeNull()
  })

  it('lets the user change focus lanes before launching search', async () => {
    const thesis = seedLaunchThesis({
      id: 'thesis-focus-lanes',
      searchLanes: [
        {
          id: 'lane-platform',
          title: 'Platform modernization',
          rationale: 'Find platform modernization roles.',
          targetSignals: ['platform'],
        },
        {
          id: 'lane-devex',
          title: 'Developer productivity',
          rationale: 'Find developer productivity infrastructure roles.',
          targetSignals: ['developer productivity'],
        },
      ],
    })
    const laneToRemove = thesis.searchLanes[1]!

    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Search Launcher' }))
    fireEvent.click(screen.getByRole('checkbox', { name: laneToRemove.title }))
    fireEvent.click(screen.getByRole('button', { name: /Launch Search/i }))

    await waitFor(() => {
      expect(mockCreateDeepResearchJob).toHaveBeenCalledTimes(1)
    })

    expect(mockCreateDeepResearchJob.mock.calls[0]?.[0].params.focusLanes).toEqual([
      'lane-platform',
    ])
  })

  it('binds search launcher overrides into the submitted research request', async () => {
    seedLaunchThesis({ id: 'thesis-launcher-bindings' })

    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Search Launcher' }))
    fireEvent.change(screen.getByLabelText('Company size override'), {
      target: { value: 'enterprise' },
    })
    fireEvent.change(screen.getByLabelText('Salary anchor override'), {
      target: { value: '$280k base / $420k total' },
    })
    fireEvent.change(screen.getByLabelText('Custom keywords'), {
      target: { value: 'edge platform, reliability leadership' },
    })
    fireEvent.click(
      screen.getByRole('checkbox', {
        name: /Expand geography beyond preferred locations when fit is otherwise strong/i,
      }),
    )
    fireEvent.change(screen.getByLabelText('Tier 1 max'), { target: { value: '3' } })
    fireEvent.change(screen.getByLabelText('Tier 2 max'), { target: { value: '7' } })
    fireEvent.change(screen.getByLabelText('Tier 3 max'), { target: { value: '11' } })
    fireEvent.click(screen.getByRole('button', { name: /Launch Search/i }))

    await waitFor(() => {
      expect(mockCreateDeepResearchJob).toHaveBeenCalledTimes(1)
    })

    expect(mockCreateDeepResearchJob.mock.calls[0]?.[0].params).toEqual(
      expect.objectContaining({
        companySizeOverride: 'enterprise',
        salaryAnchorOverride: '$280k base / $420k total',
        customKeywords: 'edge platform, reliability leadership',
        geoExpand: false,
        maxResults: { tier1: 3, tier2: 7, tier3: 11 },
      }),
    )
    expect(useSearchStore.getState().requests.at(-1)).toEqual(
      expect.objectContaining({
        companySizeOverride: 'enterprise',
        salaryAnchorOverride: '$280k base / $420k total',
        customKeywords: 'edge platform, reliability leadership',
        geoExpand: false,
        maxResults: { tier1: 3, tier2: 7, tier3: 11 },
      }),
    )
    expect(screen.getByLabelText('Company size override')).toHaveProperty('value', 'enterprise')
    expect(screen.getByLabelText('Salary anchor override')).toHaveProperty(
      'value',
      '$280k base / $420k total',
    )
    expect(screen.getByLabelText('Custom keywords')).toHaveProperty(
      'value',
      'edge platform, reliability leadership',
    )
  })

  it('switches active runs and shows failed-run details', async () => {
    useSearchStore.setState((state) => ({
      ...state,
      requests: [
        ...state.requests,
        {
          id: 'sreq-2',
          createdAt: '2026-03-10T11:05:00.000Z',
          focusLanes: ['lane-platform'],
          companySizeOverride: '',
          salaryAnchorOverride: '',
          geoExpand: true,
          customKeywords: 'staff+platform',
          excludeCompanies: [],
          maxResults: { tier1: 5, tier2: 10, tier3: 10 },
        },
      ],
      runs: [
        state.runs[0],
        {
          id: 'srun-2',
          requestId: 'sreq-2',
          createdAt: '2026-03-10T11:06:00.000Z',
          status: 'failed',
          results: [],
          searchLog: ['staff platform remote'],
          narrativeState: { status: 'pending' },
          error: 'Rate limit hit',
          tokenUsage: { inputTokens: 50, outputTokens: 0, totalTokens: 50 },
        },
      ],
    }))

    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Results Viewer' }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Select search run' }), {
      target: { value: 'srun-2' },
    })

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Rate limit hit')
    })

    expect(screen.getByText(/staff platform remote/i)).toBeTruthy()
    expect(screen.getByText(/Tokens: 50/i)).toBeTruthy()
  })

  it('resyncs the launcher request draft when the active thesis changes', async () => {
    const firstThesis = seedLaunchThesis({ id: 'thesis-result-edge-first' })
    const secondThesis = buildTestThesis({
      id: 'thesis-result-edge-second',
      searchLanes: [
        {
          id: 'lane-security',
          title: 'Security platform',
          rationale: 'Find security-platform roles.',
          targetSignals: ['security platform'],
        },
      ],
      searchOverrides: {
        constraints: {
          salary: { min: 240000, max: 410000, currency: 'USD' },
          locations: ['Remote'],
          clearance: '',
          companySize: 'public',
          industriesToAvoid: [],
          fundingStagesAcceptable: [],
          remotePolicies: [],
          remotePolicyNote: '',
          employmentTypes: [],
        },
        interviewPrefs: { strongFit: [], redFlags: [] },
        hiddenSkillIds: [],
      },
    })
    useSearchStore.setState((state) => ({
      ...state,
      theses: [firstThesis, secondThesis],
      activeThesisId: firstThesis.id,
    }))

    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Search Launcher' }))
    expect(screen.getByLabelText('Company size override')).toHaveProperty('value', '')
    act(() => {
      useSearchStore.setState((state) => ({ ...state, activeThesisId: secondThesis.id }))
    })
    await waitFor(() => {
      expect(screen.getByLabelText('Company size override')).toHaveProperty('value', 'public')
    })
    expect(screen.getByLabelText('Salary anchor override')).toHaveProperty('value', '$240k-$410k')
    expect(screen.getByRole('checkbox', { name: 'Security platform' })).toHaveProperty(
      'checked',
      true,
    )
  })

  it('renders empty log and tier states for a completed run with no results', async () => {
    useSearchStore.setState((state) => ({
      ...state,
      requests: [
        ...state.requests,
        {
          id: 'sreq-empty',
          createdAt: '2026-03-10T11:05:00.000Z',
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
          id: 'srun-empty',
          requestId: 'sreq-empty',
          createdAt: '2026-03-10T11:06:00.000Z',
          status: 'completed',
          results: [],
          searchLog: [],
          narrativeState: { status: 'pending' },
        },
      ],
    }))

    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Results Viewer' }))
    expect(screen.getByText('No query log was returned for this run.')).toBeTruthy()
    expect(screen.getAllByText('No matches in this tier.')).toHaveLength(3)
    expect(
      screen.getAllByText('0').filter((node) => node.className.includes('research-tier-badge')),
    ).toHaveLength(3)
  })

  it.each([0, -1, 4] as const)(
    'rejects pushing a rendered result when its tier is invalid: %s',
    async (invalidTier) => {
      let returnInvalidTier = false
      const invalidTierResult = {
        ...useSearchStore.getState().runs[0]!.results[0]!,
      }
      Object.defineProperty(invalidTierResult, 'tier', {
        configurable: true,
        get: () => (returnInvalidTier ? invalidTier : 1),
      })
      useSearchStore.setState((state) => ({
        ...state,
        runs: [
          {
            ...state.runs[0]!,
            results: [invalidTierResult as SearchResultEntry],
          },
        ],
      }))

      const { ResearchPage } = await import('../routes/research/ResearchPage')
      render(<ResearchPage />)

      fireEvent.click(screen.getByRole('tab', { name: 'Results Viewer' }))
      fireEvent.change(screen.getByRole('combobox', { name: 'Select search run' }), {
        target: { value: 'srun-1' },
      })
      const addToPipeline = screen.getByRole('button', { name: /Add to Pipeline/i })
      returnInvalidTier = true
      fireEvent.click(addToPipeline)

      expect(screen.getByRole('alert').textContent).toContain('Search result tier was invalid')
      expect(usePipelineStore.getState().entries).toHaveLength(0)
    },
  )

  it('selects the next available run when the active run is removed', async () => {
    useSearchStore.setState((state) => ({
      ...state,
      requests: [
        ...state.requests,
        {
          id: 'sreq-empty',
          createdAt: '2026-03-10T11:05:00.000Z',
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
        state.runs[0]!,
        {
          id: 'srun-empty',
          requestId: 'sreq-empty',
          createdAt: '2026-03-10T11:06:00.000Z',
          status: 'completed',
          results: [],
          searchLog: [],
          narrativeState: { status: 'pending' },
        },
      ],
    }))

    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Results Viewer' }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Select search run' }), {
      target: { value: 'srun-1' },
    })

    act(() => {
      useSearchStore.setState((state) => ({
        ...state,
        runs: state.runs.filter((run) => run.id !== 'srun-1'),
      }))
    })

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Select search run' })).toHaveProperty(
        'value',
        'srun-empty',
      )
    })
    expect(screen.getByText('No query log was returned for this run.')).toBeTruthy()
  })

  it('shows the empty results state when the selected run is removed and no runs remain', async () => {
    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Results Viewer' }))
    expect(screen.getByRole('combobox', { name: 'Select search run' })).toHaveProperty(
      'value',
      'srun-1',
    )

    act(() => {
      useSearchStore.setState((state) => ({
        ...state,
        runs: [],
      }))
    })

    await waitFor(() => {
      expect(screen.getByText('No runs yet')).toBeTruthy()
    })
    expect(screen.queryByRole('combobox', { name: 'Select search run' })).toBeNull()
  })

  it('records a thumbs-up feedback event without writing back to identity', async () => {
    const identity = cloneIdentityFixture()
    const previousRevision = identity.model_revision ?? 0
    useIdentityStore.setState({
      currentIdentity: identity,
      draftDocument: '',
      intakeSources: [],
      lastError: null,
      warnings: [],
    })

    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Results Viewer' }))
    fireEvent.click(screen.getByRole('button', { name: /Mark Acme Corp match as good/i }))
    fireEvent.change(screen.getByPlaceholderText(/interview process matches my preference/i), {
      target: { value: 'Liked the builder-friendly process.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save feedback' }))

    await waitFor(() => {
      expect(useSearchStore.getState().feedbackEvents).toHaveLength(1)
    })

    const event = useSearchStore.getState().feedbackEvents[0]!
    expect(event.rating).toBe('up')
    expect(event.reason).toBe('Liked the builder-friendly process.')
    expect(event.appliedToIdentity).toBe(false)
    expect(event.runId).toBe('srun-1')
    expect(event.resultId).toBe('sres-1')
    // No avoid checkbox was toggled, so the identity model is unchanged.
    const updatedIdentity = useIdentityStore.getState().currentIdentity
    expect(updatedIdentity?.preferences.matching.avoid).toEqual([])
    expect(updatedIdentity?.model_revision ?? 0).toBe(previousRevision)
  })

  it('writes a thumbs-down avoid entry back to Identity and marks the event applied', async () => {
    const identity = cloneIdentityFixture()
    const previousRevision = identity.model_revision ?? 0
    useIdentityStore.setState({
      currentIdentity: identity,
      draftDocument: '',
      intakeSources: [],
      lastError: null,
      warnings: [],
    })

    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Results Viewer' }))
    fireEvent.click(screen.getByRole('button', { name: /Mark Acme Corp match as wrong/i }))
    fireEvent.change(screen.getByPlaceholderText(/deep K8s admin experience/i), {
      target: { value: 'Pure cluster-admin work — not my fit.' },
    })
    fireEvent.click(screen.getByLabelText(/Add to Identity avoid list/i))
    fireEvent.change(screen.getByPlaceholderText(/K8s admin role/i), {
      target: { value: 'Cluster admin role' },
    })
    fireEvent.change(screen.getByPlaceholderText(/building around K8s is fine/i), {
      target: { value: 'Building platforms around Kubernetes is fine.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save feedback' }))

    await waitFor(() => {
      expect(useSearchStore.getState().feedbackEvents).toHaveLength(1)
    })

    const event = useSearchStore.getState().feedbackEvents[0]!
    expect(event.rating).toBe('down')
    expect(event.reason).toBe('Pure cluster-admin work — not my fit.')
    expect(event.dimensions?.preference).toEqual({
      category: 'avoid',
      label: 'Cluster admin role',
      condition: 'Building platforms around Kubernetes is fine.',
    })
    expect(event.appliedToIdentity).toBe(true)
    expect(event.appliedAtVersion).toBeDefined()

    const updatedIdentity = useIdentityStore.getState().currentIdentity
    expect(updatedIdentity?.preferences.matching.avoid).toHaveLength(1)
    const newAvoid = updatedIdentity?.preferences.matching.avoid[0]
    expect(newAvoid?.label).toBe('Cluster admin role')
    expect(newAvoid?.condition).toBe('Building platforms around Kubernetes is fine.')
    expect(newAvoid?.severity).toBe('conditional')
    expect(updatedIdentity?.model_revision).toBeGreaterThan(previousRevision)
    expect(event.appliedAtVersion).toBe(updatedIdentity?.model_revision)
  })

  it('blocks avoid writeback when the avoid label is empty', async () => {
    const identity = cloneIdentityFixture()
    useIdentityStore.setState({
      currentIdentity: identity,
      draftDocument: '',
      intakeSources: [],
      lastError: null,
      warnings: [],
    })

    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Results Viewer' }))
    fireEvent.click(screen.getByRole('button', { name: /Mark Acme Corp match as wrong/i }))
    fireEvent.click(screen.getByLabelText(/Add to Identity avoid list/i))
    // Clear the label that was pre-filled with the company name.
    fireEvent.change(screen.getByPlaceholderText(/K8s admin role/i), {
      target: { value: '   ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save feedback' }))

    expect(screen.getByRole('alert').textContent).toMatch(/Add an avoid label/i)
    expect(useSearchStore.getState().feedbackEvents).toHaveLength(0)
    expect(useIdentityStore.getState().currentIdentity?.preferences.matching.avoid).toEqual([])
  })

  it('lets the user choose a different vector before pushing a result to the pipeline', async () => {
    const alternateVector = useResumeStore
      .getState()
      .data.vectors.find((vector) => vector.id !== 'backend')
    expect(alternateVector).toBeTruthy()

    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Results Viewer' }))

    const resultsPanel = screen.getByRole('tabpanel')
    const selects = within(resultsPanel).getAllByRole('combobox')
    fireEvent.change(selects.at(-1) ?? selects[0], {
      target: { value: alternateVector?.id },
    })
    fireEvent.click(screen.getByRole('button', { name: /Add to Pipeline/i }))

    await waitFor(() => {
      expect(usePipelineStore.getState().entries).toHaveLength(1)
    })

    expect(usePipelineStore.getState().entries[0]?.vectorId).toBe(alternateVector?.id)
  })
})
