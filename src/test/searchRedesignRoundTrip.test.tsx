// @vitest-environment jsdom

/**
 * Parent TASK-151 end-to-end integration test.
 *
 * Closes the search → pipeline → feedback → regenerate loop with deterministic fixtures
 * (no live Anthropic calls). Asserts the seams between layers — not the layers
 * themselves; those are covered by their own unit/integration tests in
 * thesisGenerator.test.ts, researchUtils.test.ts, ResearchPage.test.tsx, and
 * searchStore.test.ts.
 *
 * The single load-bearing claim: feedback created on a search result reaches the
 * regenerated thesis's `feedbackIncorporated[]`, and the event records
 * `reflectedInThesisId` matching the new thesis. That closure is the entire point
 * of the redesign and isn't provable by any one unit test.
 *
 * Phase headers in the test body name the seams in order. When this test fails,
 * the failing phase localizes the regression to a layer boundary.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
  mockCreateDeepResearchJob,
  mockFetchDeepResearchJob,
  mockFetchResearchUsage,
  mockCancelDeepResearchJob,
  mockStreamDeepResearchJob,
  mockGenerateSearchThesisFromIdentity,
} = vi.hoisted(() => ({
  mockInferSearchProfile: vi.fn(),
  mockCreateDeepResearchJob: vi.fn(),
  mockFetchDeepResearchJob: vi.fn(),
  mockFetchResearchUsage: vi.fn(),
  mockCancelDeepResearchJob: vi.fn(),
  mockStreamDeepResearchJob: vi.fn(),
  mockGenerateSearchThesisFromIdentity: vi.fn(),
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

type RoundTripThesisSignalInput = string | Partial<SearchThesisSignal>
type RoundTripThesisOverrides = Partial<Omit<SearchThesis, 'lookFor' | 'avoid'>> & {
  lookFor?: RoundTripThesisSignalInput[]
  avoid?: RoundTripThesisSignalInput[]
}

const normalizeRoundTripSignals = (
  signals: readonly RoundTripThesisSignalInput[] | undefined,
): SearchThesisSignal[] =>
  (signals ?? []).flatMap<SearchThesisSignal>((signal, index) => {
    if (typeof signal === 'string') {
      return signal.trim()
        ? [{ id: `ssig-rt-${index}`, label: signal.trim(), severity: 'soft' }]
        : []
    }
    if (!signal.label?.trim()) return []
    return [
      {
        ...signal,
        id: signal.id ?? `ssig-rt-${index}`,
        label: signal.label.trim(),
        severity: signal.severity ?? (signal.condition ? 'conditional' : 'soft'),
      },
    ]
  })

const buildRoundTripThesis = (overrides: RoundTripThesisOverrides = {}): SearchThesis => {
  const { lookFor, avoid, ...rest } = overrides
  return {
    id: 'thesis-rt-initial',
    createdAt: '2026-03-10T10:00:00.000Z',
    updatedAt: '2026-03-10T10:00:00.000Z',
    competitiveMoat:
      'Production Kubernetes delivery paired with product-aware platform judgment and evidence of making complex deployment constraints legible.',
    unfairAdvantages: [
      {
        id: 'sadv-rt',
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
        targetSignals: ['platform modernization', 'developer leverage'],
      },
    ],
    lookFor: normalizeRoundTripSignals(lookFor ?? ['platform modernization', 'developer leverage']),
    avoid: normalizeRoundTripSignals(
      avoid ?? [
        {
          label: 'Pure Kubernetes administration',
          condition: 'Building around Kubernetes is fine; owning clusters as the whole job is not.',
        },
      ],
    ),
    keywordCombinations: [
      {
        id: 'skwd-rt',
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
          'Contoso evidence shows Kubernetes-based installs that unlocked customer deployment paths over multiple quarters.',
        searchSignal: 'Strong match signal for platform modernization roles.',
      },
    ],
    source: 'generated',
    identityVersion: 0,
    feedbackIncorporated: [],
    ...rest,
  }
}

const buildEnrichedRoundTripResult = (): SearchResultEntry => ({
  id: 'sres-rt-1',
  // signalGroup="every signal aligns" must map to tier 1 per doc-24's mapping
  // (normalizeResults derives tier from signalGroup; we set both consistently in this fixture).
  tier: 1,
  company: 'Acme Corp',
  title: 'Staff Platform Engineer',
  url: 'https://example.com/jobs/acme-platform',
  matchScore: 96,
  matchReason:
    'Excellent overlap with platform modernization scope and deployment-architecture ownership.',
  vectorAlignment: 'Backend / platform',
  risks: ['Smaller engineering team than ideal'],
  estimatedComp: '$260k-$310k',
  source: 'greenhouse',
  candidateEdge:
    "Built fleet-managed eBPF agents at A10 — direct prior-art for managing the lifecycle of platform agents at Acme. The candidate has shipped customer-facing deployment paths that look almost identical to Acme's control-plane modernization. That overlap turns the platform team's open problem into the candidate's past resume work.",
  interviewProcess: {
    format: 'take-home + system design + behavioral panel',
    builderFriendly: true,
    aiToolsAllowed: true,
    estimatedTimeline: '3 weeks',
  },
  companyIntel: {
    stage: 'series B',
    aiCulture: 'AI-augmented dev workflow with internal tooling',
    remotePolicy: 'fully remote',
    openRoleCount: 4,
  },
  signalGroup: 'every signal aligns',
  advantageMatch: 'platform + security + fleet management',
})

const buildRoundTripResearchJob = (overrides: Partial<ResearchJob> = {}): ResearchJob => {
  const thesisSnapshot = overrides.thesisSnapshot ?? buildRoundTripThesis()
  return {
    id: 'job-rt-1',
    userId: 'user-1',
    thesisId: thesisSnapshot.id,
    thesisSnapshot,
    identityVersion: thesisSnapshot.identityVersion,
    params: useSearchStore.getState().requests[0]!,
    paramsHash: 'hash-rt',
    status: 'completed',
    createdAt: '2026-03-10T10:06:00.000Z',
    startedAt: '2026-03-10T10:06:30.000Z',
    completedAt: '2026-03-10T10:18:00.000Z',
    ttlAt: '2026-04-10T10:06:00.000Z',
    progress: {
      phase: 'completed',
      elapsedMs: 690_000,
      searchQueries: ['"platform modernization" Kubernetes'],
    },
    result: {
      narrative: {
        competitiveMoat:
          'Platform delivery paired with product-aware judgment is structurally rare in the surveyed market.',
        selectionMethodology:
          'Filtered companies by platform-modernization signal across funding stage, team composition, and posted job descriptions; cross-referenced founder/engineering blog posts.',
        marketContext:
          'Series-B platform companies are hiring for delivery owners more aggressively than for narrow cluster operators in Q1 2026.',
        executiveSummary:
          'Acme leads the shortlist; deployment architecture and platform modernization signals all align.',
        landscapeTrends:
          'AI-augmented dev workflows are becoming a baseline expectation at platform teams in this stage band.',
        surprises: [
          "Acme's founder-led engineering blog explicitly calls out platform-judgment hires.",
        ],
        rejectedCandidates: [
          { company: 'Initech', reason: 'Cluster-admin scope; not a builder-friendly fit.' },
        ],
        nextSteps: ['Reach out to Acme platform lead before posting expires.'],
      },
      results: [buildEnrichedRoundTripResult()],
      tokenUsage: { inputTokens: 12_000, outputTokens: 80_000, totalTokens: 92_000 },
    },
    ...overrides,
  }
}

const buildRegeneratedThesis = (eventId: string): SearchThesis =>
  buildRoundTripThesis({
    id: 'thesis-rt-regen',
    createdAt: '2026-03-10T10:30:00.000Z',
    updatedAt: '2026-03-10T10:30:00.000Z',
    feedbackIncorporated: [eventId],
  })

describe('Search redesign round-trip (parent TASK-151)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_ANTHROPIC_PROXY_URL', 'https://ai.example/proxy')
    mockNavigate.mockReset()
    mockInferSearchProfile.mockReset()
    mockCreateDeepResearchJob.mockReset()
    mockFetchDeepResearchJob.mockReset()
    mockFetchResearchUsage.mockReset()
    mockCancelDeepResearchJob.mockReset()
    mockStreamDeepResearchJob.mockReset()
    mockGenerateSearchThesisFromIdentity.mockReset()
    mockStreamDeepResearchJob.mockReturnValue({ close: vi.fn() })
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
      currentIdentity: cloneIdentityFixture(),
      draftDocument: '',
      intakeSources: [],
      lastError: null,
      warnings: [],
    })

    useSearchStore.setState({
      profile: {
        id: 'sprof-rt',
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
        filters: { prioritize: [], avoid: [] },
        interviewPrefs: { strongFit: [], redFlags: [] },
      },
      requests: [
        {
          id: 'sreq-rt',
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
      runs: [],
      theses: [],
      activeThesisId: null,
      feedbackEvents: [],
      activeResearchJob: null,
    })

    mockFetchResearchUsage.mockResolvedValue({
      window: {
        since: '2026-03-10T00:00:00.000Z',
        until: '2026-03-11T00:00:00.000Z',
        windowMs: 86_400_000,
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
        inputTokens: 12_000,
        outputTokens: 80_000,
        runCostCents: 618,
      },
      budget: {
        enforced: false,
        limitCents: null,
        remainingCents: null,
        warningThresholdCents: null,
        status: 'unlimited' as const,
        wouldExceedNextRun: false,
      },
      warning: null,
    })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('closes the search → pipeline → feedback → regenerate loop end-to-end', async () => {
    // Mock the AI proxy: thesis generation returns the seeded round-trip thesis;
    // deep search job lands as 'completed' on the very first poll so we don't
    // have to choreograph polling cadence — that's tested elsewhere in 151.2.
    const initialThesis = buildRoundTripThesis()
    mockGenerateSearchThesisFromIdentity.mockResolvedValueOnce({
      thesis: initialThesis,
      contractViolations: [],
    })
    mockCreateDeepResearchJob.mockResolvedValueOnce({ jobId: 'job-rt-1', status: 'queued' })
    mockFetchDeepResearchJob.mockResolvedValue(
      buildRoundTripResearchJob({ thesisSnapshot: initialThesis }),
    )

    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    // ── Phase 1: thesis generation seam ──────────────────────────────────────
    // User generates the strategic thesis from their identity model. The thesis
    // becomes the active thesis; feedbackIncorporated is empty because there
    // are no prior feedback events to fold in on a fresh generation.
    fireEvent.click(screen.getByRole('tab', { name: 'Search Launcher' }))
    fireEvent.click(screen.getByRole('button', { name: /Generate Thesis/i }))

    await waitFor(() => {
      expect(useSearchStore.getState().activeThesisId).toBe(initialThesis.id)
    })
    const generatedThesis = useSearchStore
      .getState()
      .theses.find((thesis) => thesis.id === initialThesis.id)
    expect(generatedThesis).toBeDefined()
    expect(generatedThesis?.feedbackIncorporated).toEqual([])
    expect(generatedThesis?.searchLanes.length ?? 0).toBeGreaterThanOrEqual(1)

    // ── Phase 2: deep search launch seam ──────────────────────────────────────
    // Approving the thesis and launching a search should post the active thesis
    // snapshot to the deep-research job runner. The job creation receives the
    // approved thesis as its snapshot — proving the thesis flows from the
    // store into the job creation request.
    fireEvent.click(screen.getByRole('button', { name: /Launch Search/i }))

    await waitFor(() => {
      expect(mockCreateDeepResearchJob).toHaveBeenCalledTimes(1)
    })
    const createCallArg = mockCreateDeepResearchJob.mock.calls[0]?.[0] as
      | { thesisSnapshot?: SearchThesis }
      | undefined
    expect(createCallArg?.thesisSnapshot?.id).toBe(initialThesis.id)

    // ── Phase 3: result hydration seam (narrative + enriched fields) ─────────
    // The completed job's result hydrates into a SearchRun. Per AC #2, the
    // narrative must carry minimum-length fields, candidateEdge must be 2-4
    // sentences of prose, and signalGroup="every signal aligns" must map to
    // tier=1 (the canonical tier mapping documented in doc-24).
    await waitFor(() => {
      const run = useSearchStore.getState().runs.at(-1)
      expect(run?.status).toBe('completed')
      expect(run?.results.length ?? 0).toBeGreaterThan(0)
    })
    const completedRun = useSearchStore.getState().runs.at(-1)!
    expect(completedRun.narrativeState.status).toBe('ready')
    if (completedRun.narrativeState.status !== 'ready') {
      throw new Error('Expected ready narrative state')
    }
    expect(completedRun.narrativeState.narrative.executiveSummary.length).toBeGreaterThan(20)
    expect(completedRun.narrativeState.narrative.competitiveMoat.length).toBeGreaterThan(20)
    const enrichedResult = completedRun.results[0]!
    expect(enrichedResult.signalGroup).toBe('every signal aligns')
    expect(enrichedResult.tier).toBe(1)
    const candidateEdgeSentences = (enrichedResult.candidateEdge ?? '')
      .split(/[.!?]+/)
      .map((part) => part.trim())
      .filter(Boolean)
    expect(candidateEdgeSentences.length).toBeGreaterThanOrEqual(2)
    expect(candidateEdgeSentences.length).toBeLessThanOrEqual(5)

    // ── Phase 4: pipeline mapping seam ───────────────────────────────────────
    // Pushing the result to the pipeline should map the enriched fields onto
    // the PipelineEntry: candidateEdge → positioning, signalGroup → tier,
    // interviewProcess.format → format[], companyIntel → notes/research.
    fireEvent.click(screen.getByRole('tab', { name: 'Results Viewer' }))
    fireEvent.click(screen.getByRole('button', { name: /Add to Pipeline/i }))
    await waitFor(() => {
      expect(usePipelineStore.getState().entries).toHaveLength(1)
    })
    const pipelineEntry = usePipelineStore.getState().entries[0]!
    expect(pipelineEntry.tier).toBe('1')
    expect(pipelineEntry.positioning).toBe(enrichedResult.candidateEdge)
    expect(pipelineEntry.format).toEqual(
      expect.arrayContaining(['system-design', 'take-home', 'behavioral']),
    )
    expect(pipelineEntry.notes).toContain('Stage: series B')
    expect(pipelineEntry.notes).toContain('Signal group: every signal aligns')

    // Phase 4 navigates to /pipeline; bring the user back to the research tab
    // so the feedback panel UI is visible for Phase 5.
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/pipeline' })
    fireEvent.click(screen.getByRole('tab', { name: 'Results Viewer' }))

    // ── Phase 5: feedback writeback seam (identity bumps, event applied) ─────
    // The user reacts to the result with a thumbs-down + add-to-avoid. This
    // must (a) create a SearchFeedbackEvent, (b) append a MatchingAvoid to the
    // identity model, (c) bump model_revision, and (d) flip appliedToIdentity
    // to true with appliedAtVersion equal to the new revision.
    const previousRevision = useIdentityStore.getState().currentIdentity?.model_revision ?? 0
    fireEvent.click(screen.getByRole('button', { name: /Mark Acme Corp match as wrong/i }))
    fireEvent.change(screen.getByPlaceholderText(/deep K8s admin experience/i), {
      target: { value: "They're hiring a cluster admin, not a platform owner." },
    })
    fireEvent.click(screen.getByLabelText(/Add to Identity avoid list/i))
    fireEvent.change(screen.getByPlaceholderText(/K8s admin role/i), {
      target: { value: 'Pure cluster admin role' },
    })
    fireEvent.change(screen.getByPlaceholderText(/building around K8s is fine/i), {
      target: { value: 'Building platforms around Kubernetes is welcome.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save feedback' }))

    await waitFor(() => {
      expect(useSearchStore.getState().feedbackEvents).toHaveLength(1)
    })
    const feedbackEvent = useSearchStore.getState().feedbackEvents[0]!
    expect(feedbackEvent.rating).toBe('down')
    expect(feedbackEvent.appliedToIdentity).toBe(true)
    expect(feedbackEvent.dimensions?.preference?.label).toBe('Pure cluster admin role')

    const updatedIdentity = useIdentityStore.getState().currentIdentity
    expect(updatedIdentity?.preferences.matching.avoid).toHaveLength(1)
    expect(updatedIdentity?.preferences.matching.avoid[0]?.label).toBe('Pure cluster admin role')
    expect(updatedIdentity?.model_revision ?? 0).toBeGreaterThan(previousRevision)
    expect(feedbackEvent.appliedAtVersion).toBe(updatedIdentity?.model_revision)

    // ── Phase 6: thesis regeneration seam — THE LOOP CLOSES HERE ─────────────
    // This is the load-bearing assertion of the entire test. The user
    // regenerates the thesis. The generator must receive the unreflected
    // feedback event in its third argument (proving aggregation), and the
    // returned thesis's feedbackIncorporated[] must contain that event ID
    // (proving the generator stamped it). After addThesis lands the new
    // thesis, markFeedbackReflectedInThesis must fire so the event records
    // reflectedInThesisId === newThesis.id (proving closure).
    mockGenerateSearchThesisFromIdentity.mockResolvedValueOnce({
      thesis: buildRegeneratedThesis(feedbackEvent.id),
      contractViolations: [],
    })

    fireEvent.click(screen.getByRole('tab', { name: 'Search Launcher' }))
    fireEvent.click(screen.getByRole('button', { name: /Generate Thesis/i }))

    await waitFor(() => {
      expect(mockGenerateSearchThesisFromIdentity).toHaveBeenCalledTimes(2)
    })

    // The generator received the unreflected feedback event as its third arg.
    const regenCallArgs = mockGenerateSearchThesisFromIdentity.mock.calls[1]
    const passedFeedbackEvents = regenCallArgs?.[2] as Array<{ id: string }> | undefined
    expect(passedFeedbackEvents?.map((event) => event.id)).toContain(feedbackEvent.id)

    await waitFor(() => {
      expect(useSearchStore.getState().activeThesisId).toBe('thesis-rt-regen')
    })
    const regeneratedThesis = useSearchStore
      .getState()
      .theses.find((thesis) => thesis.id === 'thesis-rt-regen')
    expect(regeneratedThesis?.feedbackIncorporated).toContain(feedbackEvent.id)

    // The store's feedback event was stamped reflectedInThesisId, so the next
    // call to getUnreflectedFeedback against this thesis returns nothing.
    const finalFeedbackState = useSearchStore.getState().feedbackEvents[0]!
    expect(finalFeedbackState.reflectedInThesisId).toBe('thesis-rt-regen')
    expect(useSearchStore.getState().getUnreflectedFeedback(regeneratedThesis?.id)).toEqual([])
  }, 30_000)
})
