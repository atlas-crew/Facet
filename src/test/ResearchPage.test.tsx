// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { DeepResearchStreamHandlers } from '../utils/deepSearchClient'
import type { ResearchJob, SearchThesis } from '../types/search'
import { defaultResumeData } from '../store/defaultData'
import { useCoverLetterStore } from '../store/coverLetterStore'
import { useIdentityStore } from '../store/identityStore'
import { usePipelineStore } from '../store/pipelineStore'
import { usePrepStore } from '../store/prepStore'
import { useResumeStore } from '../store/resumeStore'
import { useSearchStore } from '../store/searchStore'
import { resolveStorage } from '../store/storage'
import { adaptIdentityToSearchProfile } from '../utils/identitySearchProfile'
import { cloneIdentityFixture } from './fixtures/identityFixture'

const { mockNavigate } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
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
  const actual = await vi.importActual<typeof import('@tanstack/react-router')>('@tanstack/react-router')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('../utils/searchProfileInference', async () => {
  const actual = await vi.importActual<typeof import('../utils/searchProfileInference')>('../utils/searchProfileInference')
  return {
    ...actual,
    inferSearchProfile: (...args: Parameters<typeof actual.inferSearchProfile>) =>
      mockInferSearchProfile(...args),
  }
})

vi.mock('../utils/deepSearchClient', async () => {
  const actual = await vi.importActual<typeof import('../utils/deepSearchClient')>('../utils/deepSearchClient')
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
  const actual = await vi.importActual<typeof import('../utils/thesisGenerator')>('../utils/thesisGenerator')
  return {
    ...actual,
    generateSearchThesisFromIdentity: (
      ...args: Parameters<typeof actual.generateSearchThesisFromIdentity>
    ) => mockGenerateSearchThesisFromIdentity(...args),
  }
})

const buildTestThesis = (overrides: Partial<SearchThesis> = {}): SearchThesis => ({
  id: 'thesis-1',
  createdAt: '2026-03-10T10:00:00.000Z',
  updatedAt: '2026-03-10T10:00:00.000Z',
  narrative: 'A default test thesis.',
  competitiveMoat: 'Default moat.',
  unfairAdvantages: [],
  searchLanes: [],
  interviewStrategy: 'Default strategy.',
  lookFor: [],
  avoid: [],
  keywordCombinations: [],
  skillDepthMap: [{ skill: 'TypeScript', depth: 'strong', context: 'Test', searchSignal: 'Test' }],
  source: 'generated',
  identityVersion: 0,
  feedbackIncorporated: [],
  ...overrides,
})

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
      templates: [],
    })

    useIdentityStore.setState({
      currentIdentity: null,
      draftDocument: '',
      scanResult: null,
      lastError: null,
      warnings: [],
    })

    useSearchStore.setState({
      profile: {
        id: 'sprof-1',
        inferredAt: '2026-03-10T10:00:00.000Z',
        inferredFromResumeVersion: 1,
        skills: [],
        vectors: [
          {
            vectorId: 'backend',
            priority: 1,
            description: 'Platform-heavy backend roles',
            targetRoleTitles: ['Staff Engineer'],
            searchKeywords: ['distributed systems'],
          },
        ],
        workSummary: [],
        openQuestions: [],
        constraints: {
          compensation: '',
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
          focusVectors: ['backend'],
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
      activeResearchJob: null,
    })

    mockInferSearchProfile.mockResolvedValue({
      skills: [{ id: 'skl-1', name: 'TypeScript', category: 'backend', depth: 'strong' }],
      vectors: [
        {
          vectorId: 'backend',
          priority: 1,
          description: 'Core backend roles',
          targetRoleTitles: ['Staff Engineer'],
          searchKeywords: ['distributed systems'],
        },
      ],
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
        narrative: [
          'This thesis positions Alex as a platform engineer whose strongest signal is translating infrastructure complexity into reliable product delivery. The search should privilege companies where platform leverage, deployment architecture, and customer-facing reliability all matter together.',
          'The unfair advantage is the pairing of Kubernetes delivery work with clear product-facing judgment. That combination should show up in roles that need someone to design around infrastructure constraints without turning the job into pure cluster administration.',
          'The strongest lanes are platform modernization and developer-productivity infrastructure. Both lanes let the candidate use depth in Kubernetes while keeping the search calibrated toward systems ownership, architecture judgment, and cross-functional delivery.',
        ].join('\n\n'),
        competitiveMoat:
          'Production Kubernetes delivery paired with product-aware platform judgment and evidence of making complex deployment constraints legible.',
        unfairAdvantages: [
          {
            id: 'sadv-generated',
            combination: 'Kubernetes delivery plus product judgment',
            depth: 'strong production evidence',
            targetCompanyProfile: 'Platform teams modernizing deployment paths',
          },
        ],
        searchLanes: [
          {
            id: 'lane-platform',
            title: 'Platform modernization',
            rationale:
              'This lane targets companies whose deployment model is becoming strategically important. It is strong because the candidate can connect infrastructure implementation to product delivery outcomes.',
            competitiveContext: 'Look for teams modernizing delivery without hiring for narrow cluster operations.',
            targetSignals: ['on-prem delivery', 'platform modernization'],
          },
          {
            id: 'lane-devex',
            title: 'Developer productivity infrastructure',
            rationale:
              'This lane targets teams where platform work is measured by developer leverage. It fits because the candidate evidence connects infrastructure tradeoffs to faster product delivery.',
            competitiveContext: 'Look for teams that treat internal platform work as product leverage.',
            targetSignals: ['developer productivity', 'internal platform'],
          },
        ],
        interviewStrategy: 'Lead with deployment architecture tradeoffs and product delivery outcomes.',
        lookFor: ['platform modernization', 'developer leverage'],
        avoid: [{ label: 'Pure Kubernetes administration', condition: 'Building around Kubernetes is fine; owning clusters as the whole job is not.' }],
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
            context: 'Contoso evidence shows Kubernetes-based installs that unlocked customer deployment paths.',
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

    await waitFor(() => {
      expect(usePipelineStore.getState().entries).toHaveLength(1)
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/pipeline' })
    }, { timeout: 10000 })

    const entry = usePipelineStore.getState().entries[0]
    expect(entry).toBeDefined()
    expect(entry!.company).toBe('Acme Corp')
    expect(entry!.role).toBe('Staff Platform Engineer')
    expect(entry!.tier).toBe('1')
    expect(entry!.status).toBe('researching')
    expect(entry!.vectorId).toBe('backend')
  }, 10000)

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
    expect(screen.getByText('Your resume-backed profile is ready for targeted searches.')).toBeTruthy()
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
    expect(screen.getByText('Your search profile is being driven by the identity model.')).toBeTruthy()
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
      )
      expect(useSearchStore.getState().activeThesisId).toBe('thesis-generated')
    })

    const narrative = screen.getByLabelText('Thesis narrative')
    fireEvent.change(narrative, {
      target: { value: 'Edited thesis narrative.\n\nSecond paragraph.\n\nThird paragraph.' },
    })
    fireEvent.change(screen.getByLabelText('Advantage 1 combination'), {
      target: { value: 'Deployment architecture plus product judgment' },
    })
    fireEvent.change(screen.getByLabelText('Interview strategy'), {
      target: { value: 'Open with tradeoffs, then map evidence to platform leverage.' },
    })
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
    fireEvent.change(screen.getByLabelText('Keyword 1 query'), {
      target: { value: '"developer platform" modernization' },
    })
    fireEvent.change(screen.getByLabelText('Keyword 1 lane'), {
      target: { value: 'lane-devex' },
    })
    fireEvent.change(screen.getByLabelText('Keyword 1 noise'), {
      target: { value: 'medium' },
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
      narrative: 'Edited thesis narrative.\n\nSecond paragraph.\n\nThird paragraph.',
      unfairAdvantages: [
        expect.objectContaining({ combination: 'Deployment architecture plus product judgment' }),
      ],
      interviewStrategy: 'Open with tradeoffs, then map evidence to platform leverage.',
      lookFor: ['platform modernization', 'internal developer leverage'],
      timeline: expect.objectContaining({
        urgency: 'critical',
        deadline: '2026-06-01',
        strategyImpact: 'Prioritize roles with active platform modernization mandates.',
      }),
      keywordCombinations: [
        {
          query: '"developer platform" modernization',
          lane: 'lane-devex',
          noiseLevel: 'medium',
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

  const openBatchReviewFromSkillWriteback = async () => {
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
    })
    useCoverLetterStore.getState().addTemplate({
      id: 'letter-1',
      name: 'Acme',
      header: '',
      greeting: '',
      paragraphs: [],
      signOff: '',
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
    useSearchStore.setState((state) => ({
      ...state,
      theses: [thesis],
      activeThesisId: thesis.id,
      runs: [{
        ...state.runs[0]!,
        identityVersion: 2,
        thesisId: thesis.id,
        thesisSnapshot: thesis,
      }],
    }))
    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Search Launcher' }))
    fireEvent.change(screen.getByLabelText('Thesis narrative'), {
      target: { value: 'Unsaved thesis edits should survive identity writeback.' },
    })
    fireEvent.change(screen.getByLabelText('Look-for signals'), {
      target: { value: 'unsaved platform signal' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Write skill depth 1 back to Identity' }))

    const confirmPanel = screen
      .getByText('Confirm Identity writeback')
      .closest('[role="region"]') as HTMLElement
    expect(confirmPanel.textContent).toContain('move it from v2 to v3')
    expect(confirmPanel.textContent).toContain(
      '3 downstream artifacts may need review: 1 search run, 1 prep deck, and 1 cover letter.',
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
    expect(confirmPanel.textContent).toContain('Depth: expert')

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
    expect(screen.getByLabelText('Thesis narrative')).toHaveProperty(
      'value',
      'Unsaved thesis edits should survive identity writeback.',
    )
    expect(screen.getByLabelText('Look-for signals')).toHaveProperty(
      'value',
      'unsaved platform signal',
    )
    expect(screen.getByText(/Updated Identity skill "Kubernetes"/)).toBeTruthy()
    expect(screen.getByText('Downstream impact queued')).toBeTruthy()
    expect(screen.getAllByText(/3 downstream artifacts may need review/).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Review impacted artifacts' }))
    const stalenessReview = screen
      .getByText('Batch staleness review')
      .closest('[role="region"]') as HTMLElement
    return { identity, stalenessReview }
  }

  it('writes thesis skill-depth corrections back to Identity after confirmation', async () => {
    const { stalenessReview } = await openBatchReviewFromSkillWriteback()
    expect(stalenessReview.textContent).toContain('Search run')
    expect(stalenessReview.textContent).toContain('Acme prep deck')
    expect(stalenessReview.textContent).toContain('Acme cover letter')
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
    expect(stalenessReview.textContent).toContain('refresh requests stay disabled')
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
    expect(useIdentityStore.getState().currentIdentity?.skills.groups[0]?.items[0]?.enriched_by)
      .not
      .toBe('user')
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

  it('keeps keyword combinations disabled until a thesis lane exists', async () => {
    const thesis = buildTestThesis({ id: 'thesis-empty-lanes' })
    useSearchStore.setState((state) => ({
      ...state,
      theses: [thesis],
      activeThesisId: thesis.id,
    }))

    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Search Launcher' }))

    expect(screen.getByRole('button', { name: 'Add keyword' })).toHaveProperty('disabled', true)

    fireEvent.click(screen.getByRole('button', { name: 'Add lane' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add keyword' }))
    fireEvent.change(screen.getByLabelText('Keyword 1 query'), {
      target: { value: '"new platform lane"' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save thesis edits' }))

    await waitFor(() => {
      expect(useSearchStore.getState().theses[0]?.keywordCombinations[0]).toMatchObject({
        query: '"new platform lane"',
        lane: expect.stringMatching(/^slane-/),
        noiseLevel: 'medium',
      })
    })
  })

  it('blocks saving keyword combinations linked to missing lanes', async () => {
    const thesis = buildTestThesis({
      id: 'thesis-invalid-keyword-lane',
      searchLanes: [
        {
          id: 'lane-platform',
          title: 'Platform modernization',
          rationale: 'This lane targets platform modernization. It fits the thesis.',
          targetSignals: ['platform modernization'],
        },
      ],
      keywordCombinations: [
        {
          id: 'skwd-orphan',
          query: '"orphan keyword"',
          lane: 'missing-lane',
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
    fireEvent.click(screen.getByRole('button', { name: 'Save thesis edits' }))

    expect(screen.getByRole('alert').textContent).toContain(
      '1 keyword combination is linked to a removed lane.',
    )
    expect(screen.getByText('Choose a current search lane before saving.')).toBeTruthy()
    expect(useSearchStore.getState().theses[0]?.keywordCombinations[0]?.lane).toBe(
      'missing-lane',
    )
  })

  it('keeps orphan keyword combinations blocked after adding a new lane', async () => {
    const thesis = buildTestThesis({
      id: 'thesis-rebind-orphan-keyword',
      searchLanes: [
        {
          id: 'lane-platform',
          title: 'Platform modernization',
          rationale: 'This lane targets platform modernization. It fits the thesis.',
          targetSignals: ['platform modernization'],
        },
      ],
      keywordCombinations: [
        {
          id: 'skwd-orphan',
          query: '"orphan keyword"',
          lane: 'missing-lane',
          noiseLevel: 'high',
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
    fireEvent.click(screen.getByRole('button', { name: 'Add lane' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save thesis edits' }))

    expect(screen.getByRole('alert').textContent).toContain(
      '1 keyword combination is linked to a removed lane.',
    )
    expect(useSearchStore.getState().theses[0]?.keywordCombinations[0]).toMatchObject({
      id: 'skwd-orphan',
      query: '"orphan keyword"',
      lane: 'missing-lane',
      noiseLevel: 'high',
    })
  })

  it('restores thesis draft state when discarding edits after a save error', async () => {
    const thesis = buildTestThesis({
      id: 'thesis-discard-restore',
      narrative: 'Original narrative.',
      lookFor: ['platform, observability'],
      searchLanes: [
        {
          id: 'lane-platform',
          title: 'Platform modernization',
          rationale: 'This lane targets platform modernization. It fits the thesis.',
          targetSignals: ['platform modernization'],
        },
      ],
      keywordCombinations: [
        {
          id: 'skwd-orphan',
          query: '"orphan keyword"',
          lane: 'missing-lane',
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
    fireEvent.change(screen.getByLabelText('Thesis narrative'), {
      target: { value: 'Unsaved narrative.' },
    })
    fireEvent.change(screen.getByLabelText('Look-for signals'), {
      target: { value: 'changed signal' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save thesis edits' }))
    expect(screen.getByRole('alert').textContent).toContain(
      '1 keyword combination is linked to a removed lane.',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Discard edits' }))

    expect(screen.getByLabelText('Thesis narrative')).toHaveProperty('value', 'Original narrative.')
    expect(screen.getByLabelText('Look-for signals')).toHaveProperty('value', 'platform, observability')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('button', { name: 'Discard edits' })).toHaveProperty('disabled', true)
  })

  it('falls back to medium noise when a keyword noise value is invalid', async () => {
    const thesis = buildTestThesis({
      id: 'thesis-invalid-noise',
      searchLanes: [
        {
          id: 'lane-platform',
          title: 'Platform modernization',
          rationale: 'This lane targets platform modernization. It fits the thesis.',
          targetSignals: ['platform modernization'],
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
    fireEvent.change(screen.getByLabelText('Keyword 1 noise'), {
      target: { value: 'invalid' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save thesis edits' }))

    await waitFor(() => {
      expect(useSearchStore.getState().theses[0]?.keywordCombinations[0]?.noiseLevel).toBe(
        'medium',
      )
    })
  })

  it('adds and removes unfair advantage rows with stable ids', async () => {
    const thesis = buildTestThesis({
      id: 'thesis-advantage-crud',
      unfairAdvantages: [
        {
          id: 'sadv-original',
          combination: 'Original combination',
          depth: 'Original depth',
          targetCompanyProfile: 'Original target company profile',
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
    fireEvent.click(screen.getByRole('button', { name: 'Add advantage' }))
    fireEvent.change(screen.getByLabelText('Advantage 2 combination'), {
      target: { value: 'New combination' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save thesis edits' }))

    await waitFor(() => {
      expect(useSearchStore.getState().theses[0]?.unfairAdvantages).toHaveLength(2)
    })
    expect(useSearchStore.getState().theses[0]?.unfairAdvantages[1]).toMatchObject({
      id: expect.stringMatching(/^sadv-/),
      combination: 'New combination',
      depth: 'Describe the depth signal',
      targetCompanyProfile: 'Describe the target company profile',
    })

    fireEvent.click(screen.getAllByRole('button', { name: 'Remove advantage' })[1]!)
    fireEvent.click(screen.getByRole('button', { name: 'Save thesis edits' }))

    await waitFor(() => {
      expect(useSearchStore.getState().theses[0]?.unfairAdvantages).toEqual([
        {
          id: 'sadv-original',
          combination: 'Original combination',
          depth: 'Original depth',
          targetCompanyProfile: 'Original target company profile',
        },
      ])
    })
  })

  it('removes a keyword combination directly without disturbing siblings', async () => {
    const thesis = buildTestThesis({
      id: 'thesis-remove-keyword',
      searchLanes: [
        {
          id: 'lane-platform',
          title: 'Platform modernization',
          rationale: 'This lane targets platform modernization. It fits the thesis.',
          targetSignals: ['platform modernization'],
        },
      ],
      keywordCombinations: [
        {
          id: 'skwd-1',
          query: '"platform modernization"',
          lane: 'lane-platform',
          noiseLevel: 'low',
        },
        {
          id: 'skwd-2',
          query: '"developer platform"',
          lane: 'lane-platform',
          noiseLevel: 'high',
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
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove keyword' })[1]!)
    fireEvent.click(screen.getByRole('button', { name: 'Save thesis edits' }))

    await waitFor(() => {
      expect(useSearchStore.getState().theses[0]?.keywordCombinations).toEqual([
        {
          id: 'skwd-1',
          query: '"platform modernization"',
          lane: 'lane-platform',
          noiseLevel: 'low',
        },
      ])
    })
  })

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
    fireEvent.change(screen.getByLabelText('Thesis narrative'), {
      target: { value: 'Edited narrative without touching look-for text.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save thesis edits' }))

    await waitFor(() => {
      expect(useSearchStore.getState().theses[0]?.lookFor).toEqual([
        'k8s, observability',
        'developer platform',
      ])
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

    expect(useSearchStore.getState().profile?.vectors).toEqual(resumeProfile?.vectors)
    expect(useSearchStore.getState().profile?.constraints).toEqual(resumeProfile?.constraints)
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

  it('surfaces upgrade messaging when hosted AI profile inference is paywalled', async () => {
    useSearchStore.setState((state) => ({ ...state, profile: null, requests: [], runs: [] }))
    mockInferSearchProfile.mockRejectedValueOnce(
      new Error('Upgrade to AI Pro to use this hosted AI feature.'),
    )

    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('button', { name: /Build Profile from Resume/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Upgrade to AI Pro')
    })
  })

  it('surfaces billing-issue messaging without blocking the rest of the page', async () => {
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

    expect(screen.getByRole('tab', { name: 'Profile Editor' })).toBeTruthy()
  })

  it('hides the stale warning when resume and profile versions match', async () => {
    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    expect(screen.queryByText(/current resume data is version/i)).toBeNull()
  })

  it('runs inference and switches to the search tab', async () => {
    useSearchStore.setState((state) => ({ ...state, profile: null, requests: [], runs: [] }))
    const { ResearchPage } = await import('../routes/research/ResearchPage')

    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('button', { name: /Build Profile from Resume/i }))

    await waitFor(() => {
      expect(useSearchStore.getState().profile?.skills).toHaveLength(1)
    })

    expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe('research-tab-search')
  })

  it('shows inference failures from the API', async () => {
    useSearchStore.setState((state) => ({ ...state, profile: null, requests: [], runs: [] }))
    mockInferSearchProfile.mockRejectedValueOnce(new Error('Inference blew up'))

    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('button', { name: /Build Profile from Resume/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Inference blew up')
    })
  })

  it('passes excluded companies into launched searches and stores successful results', async () => {
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

    mockFetchDeepResearchJob.mockResolvedValueOnce({
      id: 'job-new',
      userId: 'user-1',
      thesisId: 'thesis-1',
      thesisSnapshot: {
        id: 'thesis-1',
        createdAt: '2026-03-10T10:00:00.000Z',
        updatedAt: '2026-03-10T10:00:00.000Z',
        narrative: 'A default test thesis.',
        competitiveMoat: 'Default moat.',
        unfairAdvantages: [],
        searchLanes: [],
        interviewStrategy: 'Default strategy.',
        lookFor: [],
        avoid: [],
        keywordCombinations: [],
        skillDepthMap: [{ skill: 'TypeScript', depth: 'strong', context: 'Test', searchSignal: 'Test' }],
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
      progress: { phase: 'completed', elapsedMs: 120000, searchQueries: ['principal backend engineer'] },
      result: {
        narrative: {
          competitiveMoat: 'The candidate has a durable platform moat with production evidence.',
          selectionMethodology: 'The search filtered for senior platform roles with strong backend overlap.',
          marketContext: 'Platform hiring remains active in companies investing in internal leverage.',
          executiveSummary: 'NewCo is the best current fit because the role needs principal-level backend platform ownership and the candidate evidence maps cleanly to that scope.',
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
            matchReason: 'Very strong match',
            vectorAlignment: 'backend',
            risks: [],
            source: 'greenhouse',
            candidateEdge: 'The candidate has shipped backend platforms at staff scope. NewCo needs principal-level platform ownership, so the evidence maps directly to the role.',
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
    expect(mockCreateDeepResearchJob.mock.calls[0]?.[0].params.excludeCompanies).toEqual(['LaterCo', 'OldCo'])
    expect(useSearchStore.getState().runs.at(-1)?.results[0]?.company).toBe('NewCo')
    expect(screen.getByText('The candidate has a durable platform moat with production evidence.')).toBeTruthy()
    expect(screen.getByText(/shipped backend platforms at staff scope/)).toBeTruthy()
    expect(screen.getByText('Series B · AI-native engineering workflows · Remote-first')).toBeTruthy()
    expect(screen.getByText('Architecture screen and work sample · 3 weeks')).toBeTruthy()
    expect(screen.getByText('candidateEdge for NewCo is shorter than expected.')).toBeTruthy()
  })

  it('shows an error when AI endpoint configuration is missing', async () => {
    vi.stubEnv('VITE_ANTHROPIC_PROXY_URL', '')
    useSearchStore.setState((state) => ({ ...state, profile: null, requests: [], runs: [] }))
    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('button', { name: /Build Profile from Resume/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('AI research is disabled')
    })
  })

  it('shows an error when search launch is missing the AI endpoint', async () => {
    vi.stubEnv('VITE_ANTHROPIC_PROXY_URL', '')
    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Search Launcher' }))
    fireEvent.click(screen.getByRole('button', { name: /Launch Search/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('AI research is disabled')
    })
  })

  it('shows an error and returns to the profile tab when search launches without a profile', async () => {
    useSearchStore.setState((state) => ({ ...state, profile: null, requests: [], runs: [] }))
    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Search Launcher' }))
    fireEvent.click(screen.getByRole('button', { name: /Launch Search/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Build or restore a search profile')
    })

    expect(screen.getByRole('tab', { name: 'Profile Editor' }).getAttribute('aria-selected')).toBe('true')
  })

  it('disables profile inference while the request is in flight', async () => {
    let resolveInference: ((value: Awaited<ReturnType<typeof mockInferSearchProfile>>) => void) | undefined
    mockInferSearchProfile.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveInference = resolve
        }),
    )

    useSearchStore.setState((state) => ({ ...state, profile: null, requests: [], runs: [] }))
    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    const button = screen.getByRole('button', { name: /Build Profile from Resume/i })
    fireEvent.click(button)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Build Profile from Resume/i }).hasAttribute('disabled')).toBe(true)
    })

    expect(mockInferSearchProfile).toHaveBeenCalledWith(
      expect.objectContaining({ version: defaultResumeData.version }),
      'https://ai.example/proxy',
    )

    resolveInference?.({
      skills: [],
      vectors: [],
      workSummary: [],
      openQuestions: [],
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Run Search/i }).hasAttribute('disabled')).toBe(false)
    })
  })

  it('shows the running search state while a search is in flight', async () => {
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
      expect(screen.getByRole('tab', { name: 'Results Viewer' }).getAttribute('aria-selected')).toBe('true')
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
      .mockResolvedValueOnce(buildResearchJob({
        id: 'job-stream',
        thesisSnapshot,
        status: 'running',
        progress: { phase: 'searching', elapsedMs: 1000, searchQueries: ['staff platform'] },
      }))
      .mockResolvedValueOnce(buildResearchJob({
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
      }))
    useSearchStore.setState((state) => ({
      ...state,
      runs: [{
        ...state.runs[0]!,
        status: 'running',
        results: [],
        searchLog: [],
        thesisId: thesisSnapshot.id,
        thesisSnapshot,
        jobId: 'job-stream',
      }],
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
    mockFetchDeepResearchJob.mockResolvedValue(buildResearchJob({ id: 'job-visibility', status: 'running' }))
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
    mockFetchDeepResearchJob.mockResolvedValue(buildResearchJob({
      id: 'job-stream-error',
      status: 'running',
      progress: { phase: 'running', elapsedMs: 1000, searchQueries: ['backend platform'] },
    }))
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
        .mockResolvedValueOnce(buildResearchJob({
          id: 'job-poll-retry',
          status: 'completed',
          progress: { phase: 'completed', elapsedMs: 120000, searchQueries: ['backend platform'] },
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
        }))
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
    mockFetchDeepResearchJob.mockResolvedValue(buildResearchJob({ id: 'job-cancel', status: 'running' }))
    mockCancelDeepResearchJob.mockResolvedValueOnce(buildResearchJob({ id: 'job-cancel', status: 'canceled' }))
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
      expect(mockCancelDeepResearchJob).toHaveBeenCalledWith('https://ai.example/proxy', 'job-cancel')
      expect(useSearchStore.getState().activeResearchJob).toBeNull()
    })
    expect(useSearchStore.getState().runs[0]?.error).toContain('canceled')
  })

  it('retries a failed run from its preserved thesis snapshot', async () => {
    const thesisSnapshot = buildTestThesis({
      id: 'thesis-retry',
      narrative: 'Preserved thesis narrative.',
    })
    useSearchStore.setState((state) => ({
      ...state,
      runs: [{
        ...state.runs[0]!,
        status: 'failed',
        error: 'Provider timed out.',
        thesisId: thesisSnapshot.id,
        thesisSnapshot,
      }],
    }))

    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Results Viewer' }))
    fireEvent.click(screen.getByRole('button', { name: 'Retry preserved thesis' }))

    await waitFor(() => {
      expect(mockCreateDeepResearchJob).toHaveBeenCalledWith(expect.objectContaining({
        thesisSnapshot: expect.objectContaining({
          id: 'thesis-retry',
          narrative: 'Preserved thesis narrative.',
          competitiveMoat: 'Default moat.',
        }),
      }))
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
    mockFetchDeepResearchJob.mockResolvedValueOnce(buildResearchJob({
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
        results: [{
          ...useSearchStore.getState().runs[0]!.results[0]!,
          company: 'NotifyCo',
          candidateEdge: 'NotifyCo needs platform leverage and this candidate has directly comparable evidence.',
        }],
        tokenUsage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      },
    }))
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

    const profileTab = screen.getByRole('tab', { name: 'Profile Editor' })
    const searchTab = screen.getByRole('tab', { name: 'Search Launcher' })
    const resultsTab = screen.getByRole('tab', { name: 'Results Viewer' })

    fireEvent.keyDown(profileTab, { key: 'ArrowRight' })
    expect(searchTab.getAttribute('aria-selected')).toBe('true')

    fireEvent.keyDown(searchTab, { key: 'ArrowLeft' })
    expect(profileTab.getAttribute('aria-selected')).toBe('true')

    fireEvent.keyDown(profileTab, { key: 'End' })
    expect(resultsTab.getAttribute('aria-selected')).toBe('true')

    fireEvent.keyDown(resultsTab, { key: 'Home' })
    expect(profileTab.getAttribute('aria-selected')).toBe('true')

    fireEvent.keyDown(profileTab, { key: 'ArrowLeft' })
    expect(resultsTab.getAttribute('aria-selected')).toBe('true')

    fireEvent.keyDown(resultsTab, { key: 'ArrowRight' })
    expect(profileTab.getAttribute('aria-selected')).toBe('true')
  })

  it('shows the empty results state when no runs exist', async () => {
    useSearchStore.setState((state) => ({ ...state, runs: [] }))
    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Results Viewer' }))
    expect(screen.getByText('No runs yet')).toBeTruthy()
  })

  it('lets the user add, edit, remove, and clear skills', async () => {
    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('button', { name: /Add Skill/i }))
    fireEvent.change(screen.getByLabelText('Skill name'), { target: { value: 'React' } })
    fireEvent.change(screen.getByLabelText('Skill context'), { target: { value: 'UI systems' } })

    await waitFor(() => {
      expect(useSearchStore.getState().profile?.skills[0]?.name).toBe('React')
    })

    fireEvent.click(screen.getByRole('button', { name: 'Remove skill React' }))

    await waitFor(() => {
      expect(useSearchStore.getState().profile?.skills).toHaveLength(0)
    })

    fireEvent.click(screen.getByRole('button', { name: /Clear Profile/i }))
    expect(useSearchStore.getState().profile).toBeNull()
    expect(screen.getByText('No search profile yet')).toBeTruthy()
  })

  it('lets the user change focus vectors before launching search', async () => {
    const additionalVector = useResumeStore.getState().data.vectors.find((vector) => vector.id !== 'backend')
    expect(additionalVector).toBeTruthy()

    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Search Launcher' }))
    fireEvent.click(screen.getByRole('checkbox', { name: additionalVector?.label ?? '' }))
    fireEvent.click(screen.getByRole('button', { name: /Launch Search/i }))

    await waitFor(() => {
      expect(mockCreateDeepResearchJob).toHaveBeenCalledTimes(1)
    })

    expect(mockCreateDeepResearchJob.mock.calls[0]?.[0].params.focusVectors).toContain(additionalVector?.id)
  })

  it('switches active runs and shows failed-run details', async () => {
    useSearchStore.setState((state) => ({
      ...state,
      requests: [
        ...state.requests,
        {
          id: 'sreq-2',
          createdAt: '2026-03-10T11:05:00.000Z',
          focusVectors: ['backend'],
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

  it('lets the user choose a different vector before pushing a result to the pipeline', async () => {
    const alternateVector = useResumeStore.getState().data.vectors.find((vector) => vector.id !== 'backend')
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
