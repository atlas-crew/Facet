import { beforeEach, describe, expect, it, vi } from 'vitest'
import { migrateSearchState, useSearchStore } from '../store/searchStore'
import type { SearchRequest, SearchThesis, SearchThesisSignal } from '../types/search'
import { DEFAULT_SEARCH_MAX_RESULTS } from '../types/search'
import { DEFAULT_LOCAL_WORKSPACE_ID } from '../types/durable'

type TestThesisSignalInput = string | Partial<SearchThesisSignal>
type SearchThesisTestOverrides = Partial<Omit<SearchThesis, 'lookFor' | 'avoid'>> & {
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

const buildSearchThesis = (overrides: SearchThesisTestOverrides = {}): SearchThesis => {
  const { lookFor, avoid, ...rest } = overrides
  return {
    id: 'sthesis-1',
    createdAt: '2026-04-20T10:00:00.000Z',
    updatedAt: '2026-04-20T10:00:00.000Z',
    narrative: 'A saved thesis narrative.\n\nSecond paragraph.\n\nThird paragraph.',
    competitiveMoat: 'A specific platform moat with strong identity evidence.',
    unfairAdvantages: [],
    searchLanes: [
      {
        id: 'lane-1',
        title: 'Platform modernization',
        rationale:
          'This lane targets strategic platform migration work. It matches the candidate evidence well.',
        targetSignals: ['platform modernization'],
      },
    ],
    interviewStrategy: 'Anchor on deployment architecture.',
    lookFor: normalizeTestSignals(lookFor ?? ['platform modernization']),
    avoid: normalizeTestSignals(avoid),
    keywordCombinations: [],
    skillDepthMap: [
      {
        skill: 'Kubernetes',
        depth: 'strong',
        context: 'Specific customer deployment evidence from the identity model.',
        searchSignal: 'Strong match signal.',
      },
    ],
    source: 'generated',
    identityVersion: 1,
    feedbackIncorporated: [],
    ...rest,
  }
}

const legacyFocusVectorRequestKey = 'focus' + 'Vectors'

const expectedSearchRequestKeys = [
  'companySizeOverride',
  'createdAt',
  'customKeywords',
  'durableMeta',
  'excludeCompanies',
  'focusLanes',
  'geoExpand',
  'id',
  'maxResults',
  'resumeVariants',
  'salaryAnchorOverride',
]

const searchRequestKeyCoverage: Record<keyof SearchRequest, true> = {
  companySizeOverride: true,
  createdAt: true,
  customKeywords: true,
  durableMeta: true,
  excludeCompanies: true,
  focusLanes: true,
  geoExpand: true,
  id: true,
  maxResults: true,
  resumeVariants: true,
  salaryAnchorOverride: true,
}

describe('searchStore', () => {
  beforeEach(() => {
    useSearchStore.setState({
      profile: null,
      requests: [],
      runs: [],
      theses: [],
      activeThesisId: null,
      feedbackEvents: [],
      activeResearchJob: null,
    })
  })

  it('sets and updates the profile', () => {
    const profile = useSearchStore.getState().setProfile({
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
      inferredFromResumeVersion: 1,
    })

    expect(profile.id).toMatch(/^sprof-/)

    useSearchStore.getState().updateProfileSkills([
      {
        id: 'skl-1',
        name: 'TypeScript',
        category: 'backend',
        depth: 'strong',
      },
    ])
    useSearchStore.getState().updateProfileConstraints({
      salary: { min: 250000, max: 250000, currency: 'USD' },
      locations: ['Remote'],
      clearance: '',
      companySize: '',
    })
    useSearchStore.getState().updateProfileFilters({
      prioritize: [{ label: 'platform', severity: 'soft' }],
      avoid: [{ label: 'ad tech', severity: 'hard' }],
    })
    useSearchStore.getState().updateProfileInterviewPrefs({
      strongFit: ['staff scope'],
      redFlags: ['unclear ownership'],
    })

    const updated = useSearchStore.getState().profile
    expect(updated?.skills).toHaveLength(1)
    expect(updated?.constraints.salary).toEqual({ min: 250000, max: 250000, currency: 'USD' })
    expect(updated?.filters.prioritize).toEqual([{ label: 'platform', severity: 'soft' }])
    expect(updated?.interviewPrefs.strongFit).toEqual(['staff scope'])
    expect(updated?.durableMeta?.workspaceId).toBe(DEFAULT_LOCAL_WORKSPACE_ID)
    expect(updated?.durableMeta?.revision).toBe(4)
  })

  it('adds, updates, and deletes requests', () => {
    const request = useSearchStore.getState().addRequest({
      companySizeOverride: 'growth',
      salaryAnchorOverride: '$250k total',
      geoExpand: true,
      customKeywords: 'developer productivity',
      excludeCompanies: ['OldCo'],
      maxResults: { tier1: 5, tier2: 10, tier3: 8 },
    })

    expect(request.id).toMatch(/^sreq-/)
    expect(useSearchStore.getState().requests).toHaveLength(1)
    expect(request.durableMeta?.workspaceId).toBe(DEFAULT_LOCAL_WORKSPACE_ID)
    expect(request.durableMeta?.revision).toBe(0)

    const before = useSearchStore.getState().requests[0]
    useSearchStore.getState().updateRequest(request.id, {
      customKeywords: 'platform engineering',
      durableMeta: {
        workspaceId: 'ignored-workspace',
        tenantId: 'tenant-x',
        userId: 'user-y',
        schemaVersion: 7,
        revision: 22,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    })

    expect(useSearchStore.getState().requests[0]?.customKeywords).toBe('platform engineering')
    expect(useSearchStore.getState().requests[0]?.durableMeta?.workspaceId).toBe(
      DEFAULT_LOCAL_WORKSPACE_ID,
    )
    expect(useSearchStore.getState().requests[0]?.durableMeta?.createdAt).toBe(
      before?.durableMeta?.createdAt,
    )
    expect(useSearchStore.getState().requests[0]?.durableMeta?.revision).toBe(1)

    useSearchStore.getState().deleteRequest(request.id)
    expect(useSearchStore.getState().requests).toEqual([])
  })

  it('adds runs and filters them by request id', () => {
    const requestOne = useSearchStore.getState().addRequest({
      companySizeOverride: '',
      salaryAnchorOverride: '',
      geoExpand: true,
      customKeywords: '',
      excludeCompanies: [],
      maxResults: { tier1: 5, tier2: 10, tier3: 10 },
    })
    const requestTwo = useSearchStore.getState().addRequest({
      companySizeOverride: '',
      salaryAnchorOverride: '',
      geoExpand: false,
      customKeywords: '',
      excludeCompanies: [],
      maxResults: { tier1: 3, tier2: 6, tier3: 6 },
    })

    const runOne = useSearchStore.getState().addRun({
      requestId: requestOne.id,
      status: 'running',
      results: [],
      searchLog: ['query 1'],
    })
    useSearchStore.getState().addRun({
      requestId: requestTwo.id,
      status: 'completed',
      results: [],
      searchLog: ['query 2'],
    })

    useSearchStore.getState().updateRun(runOne.id, {
      status: 'completed',
      results: [
        {
          id: 'sres-1',
          tier: 1,
          company: 'Acme',
          title: 'Staff Engineer',
          url: 'https://example.com/jobs/1',
          matchScore: 94,
          matchReason: 'Excellent fit',
          vectorAlignment: 'backend',
          risks: [],
          source: 'web_search',
        },
      ],
    })

    const requestOneRuns = useSearchStore.getState().getRunsForRequest(requestOne.id)
    expect(requestOneRuns).toHaveLength(1)
    expect(requestOneRuns[0]?.status).toBe('completed')
    expect(requestOneRuns[0]?.durableMeta?.workspaceId).toBe(DEFAULT_LOCAL_WORKSPACE_ID)
    expect(requestOneRuns[0]?.durableMeta?.revision).toBe(1)

    useSearchStore.getState().deleteRequest(requestOne.id)
    expect(useSearchStore.getState().runs).toHaveLength(1)
    expect(useSearchStore.getState().runs[0]?.requestId).toBe(requestTwo.id)
  })

  it('clears run staleness review metadata when identity version changes without a new review', () => {
    const request = useSearchStore.getState().addRequest({
      companySizeOverride: '',
      salaryAnchorOverride: '',
      geoExpand: true,
      customKeywords: '',
      excludeCompanies: [],
      maxResults: { tier1: 5, tier2: 10, tier3: 10 },
    })
    const run = useSearchStore.getState().addRun({
      requestId: request.id,
      status: 'completed',
      results: [],
      searchLog: [],
      identityVersion: 2,
      stalenessReview: {
        decision: 'accepted-current',
        reviewedAt: '2026-04-28T00:00:00.000Z',
        reviewedIdentityVersion: 3,
        artifactIdentityVersionAtReview: 2,
        mutationLabel: 'Kubernetes depth correction',
        mutationFields: ['skills.Kubernetes.depth'],
        mutationFromRevision: 2,
        mutationToRevision: 3,
        reason: 'Generated from an older identity revision.',
      },
    })

    useSearchStore.getState().updateRun(run.id, { identityVersion: 2 })
    expect(useSearchStore.getState().runs[0]?.stalenessReview).toMatchObject({
      decision: 'accepted-current',
      reviewedIdentityVersion: 3,
    })

    useSearchStore.getState().updateRun(run.id, { identityVersion: 3 })
    expect(useSearchStore.getState().runs[0]?.stalenessReview).toMatchObject({
      decision: 'accepted-current',
      reviewedIdentityVersion: 3,
    })

    useSearchStore.getState().updateRun(run.id, { identityVersion: 4 })

    expect(useSearchStore.getState().runs[0]?.identityVersion).toBe(4)
    expect(useSearchStore.getState().runs[0]?.stalenessReview).toBeUndefined()
  })

  it('sanitizes explicit run staleness review patches while preserving fresh identity-version reviews', () => {
    const request = useSearchStore.getState().addRequest({
      companySizeOverride: '',
      salaryAnchorOverride: '',
      geoExpand: true,
      customKeywords: '',
      excludeCompanies: [],
      maxResults: { tier1: 5, tier2: 10, tier3: 10 },
    })
    const run = useSearchStore.getState().addRun({
      requestId: request.id,
      status: 'completed',
      results: [],
      searchLog: [],
      identityVersion: 2,
    })
    const validReview = {
      decision: 'not-stale' as const,
      reviewedAt: '2026-04-28T00:00:00.000Z',
      reviewedIdentityVersion: 5,
      artifactIdentityVersionAtReview: 2,
      mutationLabel: 'Kubernetes depth correction',
      mutationFields: ['skills.Kubernetes.depth'],
      mutationFromRevision: 4,
      mutationToRevision: 5,
      reason: 'Reviewed from batch staleness panel.',
    }

    useSearchStore.getState().updateRun(run.id, {
      stalenessReview: { ...validReview, reviewedAt: '' },
    })
    expect(useSearchStore.getState().runs[0]?.stalenessReview).toBeUndefined()

    useSearchStore.getState().updateRun(run.id, {
      identityVersion: 5,
      stalenessReview: validReview,
    })

    expect(useSearchStore.getState().runs[0]?.identityVersion).toBe(5)
    expect(useSearchStore.getState().runs[0]?.stalenessReview).toMatchObject({
      decision: 'not-stale',
      reviewedIdentityVersion: 5,
    })
  })

  it('returns whether thesis staleness review metadata was persisted', () => {
    const thesis = useSearchStore.getState().addThesis(
      buildSearchThesis({
        identityVersion: 5,
        durableMeta: {
          workspaceId: DEFAULT_LOCAL_WORKSPACE_ID,
          tenantId: null,
          userId: null,
          schemaVersion: 1,
          revision: 0,
          createdAt: '2026-04-20T10:00:00.000Z',
          updatedAt: '2026-04-20T10:00:00.000Z',
        },
      }),
    )
    const validReview = {
      decision: 'accepted-current' as const,
      reviewedAt: '2026-04-28T00:00:00.000Z',
      reviewedIdentityVersion: 5,
      artifactIdentityVersionAtReview: 5,
      mutationLabel: 'Kubernetes depth correction',
      mutationFields: ['skills.Kubernetes.depth'],
      mutationFromRevision: 4,
      mutationToRevision: 5,
      reason: 'Generated from an older identity revision.',
    }

    expect(
      useSearchStore.getState().markThesisStalenessReview(thesis.id, {
        ...validReview,
        reviewedIdentityVersion: 4,
        mutationToRevision: 4,
      }),
    ).toBe(false)
    expect(useSearchStore.getState().theses[0]?.stalenessReview).toBeUndefined()
    expect(
      useSearchStore.getState().markThesisStalenessReview(thesis.id, {
        ...validReview,
        reviewedAt: '',
      }),
    ).toBe(false)
    expect(useSearchStore.getState().markThesisStalenessReview(thesis.id, validReview)).toBe(true)

    const updated = useSearchStore.getState().theses[0]
    expect(updated?.stalenessReview).toMatchObject({
      decision: 'accepted-current',
      reviewedIdentityVersion: 5,
    })
    expect(updated?.updatedAt).not.toBe(thesis.updatedAt)
    expect(updated?.durableMeta?.revision).toBe(1)
  })

  it('returns false without mutating when thesis staleness review id is unknown', () => {
    const thesis = useSearchStore.getState().addThesis(
      buildSearchThesis({
        identityVersion: 3,
        durableMeta: {
          workspaceId: DEFAULT_LOCAL_WORKSPACE_ID,
          tenantId: null,
          userId: null,
          schemaVersion: 1,
          revision: 4,
          createdAt: '2026-04-20T10:00:00.000Z',
          updatedAt: '2026-04-20T10:00:00.000Z',
        },
      }),
    )
    const review = {
      decision: 'accepted-current' as const,
      reviewedAt: '2026-04-28T00:00:00.000Z',
      reviewedIdentityVersion: 3,
      artifactIdentityVersionAtReview: 3,
      mutationLabel: 'Kubernetes depth correction',
      mutationFields: ['skills.Kubernetes.depth'],
      mutationFromRevision: 2,
      mutationToRevision: 3,
      reason: 'Generated from an older identity revision.',
    }

    expect(useSearchStore.getState().markThesisStalenessReview('missing-thesis', review)).toBe(
      false,
    )

    expect(useSearchStore.getState().theses).toHaveLength(1)
    expect(useSearchStore.getState().theses[0]?.updatedAt).toBe(thesis.updatedAt)
    expect(useSearchStore.getState().theses[0]?.durableMeta?.revision).toBe(4)
    expect(useSearchStore.getState().theses[0]?.stalenessReview).toBeUndefined()
  })

  it('clears thesis staleness review metadata when identity version advances past the review', () => {
    const thesis = useSearchStore.getState().addThesis(
      buildSearchThesis({
        identityVersion: 2,
        stalenessReview: {
          decision: 'accepted-current',
          reviewedAt: '2026-04-28T00:00:00.000Z',
          reviewedIdentityVersion: 3,
          artifactIdentityVersionAtReview: 2,
          mutationLabel: 'Kubernetes depth correction',
          mutationFields: ['skills.Kubernetes.depth'],
          mutationFromRevision: 2,
          mutationToRevision: 3,
          reason: 'Generated from an older identity revision.',
        },
      }),
    )

    useSearchStore.getState().saveThesisRevision(thesis.id, { identityVersion: 3 })
    expect(useSearchStore.getState().theses[0]?.stalenessReview).toMatchObject({
      decision: 'accepted-current',
      reviewedIdentityVersion: 3,
    })

    useSearchStore.getState().saveThesisRevision(thesis.id, { identityVersion: 4 })
    expect(useSearchStore.getState().theses[0]?.stalenessReview).toBeUndefined()
  })

  it('sanitizes explicit thesis staleness review patches on revision save', () => {
    const thesis = useSearchStore.getState().addThesis(
      buildSearchThesis({
        identityVersion: 2,
      }),
    )
    const validReview = {
      decision: 'accepted-current' as const,
      reviewedAt: '2026-04-28T00:00:00.000Z',
      reviewedIdentityVersion: 3,
      artifactIdentityVersionAtReview: 2,
      mutationLabel: 'Kubernetes depth correction',
      mutationFields: ['skills.Kubernetes.depth'],
      mutationFromRevision: 2,
      mutationToRevision: 3,
      reason: 'Generated from an older identity revision.',
    }

    useSearchStore.getState().saveThesisRevision(thesis.id, {
      stalenessReview: { ...validReview, mutationFields: [] },
    })
    expect(useSearchStore.getState().theses[0]?.stalenessReview).toBeUndefined()

    useSearchStore.getState().saveThesisRevision(thesis.id, {
      stalenessReview: validReview,
    })
    expect(useSearchStore.getState().theses[0]?.stalenessReview).toMatchObject({
      decision: 'accepted-current',
      reviewedIdentityVersion: 3,
    })
  })

  it('treats profile updaters as no-ops when no profile exists and supports clear/delete run', () => {
    useSearchStore
      .getState()
      .updateProfileSkills([
        { id: 'skl-1', name: 'TypeScript', category: 'backend', depth: 'strong' },
      ])
    useSearchStore
      .getState()
      .updateProfileConstraints({
        salary: { min: 0, max: 0 },
        locations: [],
        clearance: '',
        companySize: '',
      })
    useSearchStore.getState().updateProfileFilters({ prioritize: [], avoid: [] })
    useSearchStore.getState().updateProfileInterviewPrefs({ strongFit: [], redFlags: [] })
    expect(useSearchStore.getState().profile).toBeNull()

    useSearchStore.getState().setProfile({
      skills: [],
      workSummary: [],
      openQuestions: [],
      constraints: { salary: { min: 0, max: 0 }, locations: [], clearance: '', companySize: '' },
      filters: { prioritize: [], avoid: [] },
      interviewPrefs: { strongFit: [], redFlags: [] },
      inferredFromResumeVersion: 1,
    })

    const request = useSearchStore.getState().addRequest({
      companySizeOverride: '',
      salaryAnchorOverride: '',
      geoExpand: true,
      customKeywords: '',
      excludeCompanies: [],
      maxResults: { tier1: 5, tier2: 10, tier3: 10 },
    })
    const firstRun = useSearchStore.getState().addRun({
      requestId: request.id,
      status: 'pending',
      results: [],
      searchLog: [],
    })
    useSearchStore.getState().addRun({
      requestId: request.id,
      status: 'completed',
      results: [],
      searchLog: [],
    })

    useSearchStore.getState().deleteRun(firstRun.id)
    expect(useSearchStore.getState().runs).toHaveLength(1)

    useSearchStore.getState().clearProfile()
    expect(useSearchStore.getState().profile).toBeNull()
  })

  it('stores thesis revisions and tracks the active thesis', () => {
    const first = useSearchStore.getState().addThesis(
      buildSearchThesis({
        unfairAdvantages: [
          {
            id: 'sadv-1',
            combination: 'Kubernetes plus product judgment',
            targetCompanyProfile: 'Platform modernization teams',
          },
        ],
        interviewStrategy: 'Preserve this interview strategy.',
        lookFor: ['platform modernization', 'developer leverage'],
        keywordCombinations: [
          { id: 'skwd-1', query: '"platform modernization"', lane: 'lane-1', noiseLevel: 'low' },
        ],
        feedbackIncorporated: ['sfe-1'],
      }),
    )

    expect(first.id).toBe('sthesis-1')
    expect(useSearchStore.getState().activeThesisId).toBe(first.id)

    const savedRevision = useSearchStore.getState().saveThesisRevision(first.id, {
      narrative: 'Edited narrative.\n\nSecond paragraph.\n\nThird paragraph.',
      searchLanes: [
        {
          id: 'lane-1',
          title: 'Developer platform modernization',
          rationale:
            'This lane narrows the search to platform modernization. It keeps the search away from pure operations.',
          targetSignals: ['developer platform'],
        },
      ],
    })

    expect(savedRevision?.id).toBe(first.id)
    expect(savedRevision).toMatchObject({
      source: 'user-edited',
      narrative: 'Edited narrative.\n\nSecond paragraph.\n\nThird paragraph.',
      unfairAdvantages: first.unfairAdvantages,
      interviewStrategy: first.interviewStrategy,
      lookFor: first.lookFor,
      keywordCombinations: first.keywordCombinations,
      feedbackIncorporated: first.feedbackIncorporated,
    })
    expect(useSearchStore.getState().activeThesisId).toBe(savedRevision?.id)
    expect(useSearchStore.getState().theses).toHaveLength(1)

    useSearchStore.getState().setActiveThesis(first.id)
    expect(useSearchStore.getState().activeThesisId).toBe(first.id)
    useSearchStore.getState().setActiveThesis('missing-thesis')
    expect(useSearchStore.getState().activeThesisId).toBeNull()
    expect(useSearchStore.getState().saveThesisRevision('missing-thesis', {})).toBeNull()
    expect(() => useSearchStore.getState().addThesis(buildSearchThesis({ id: first.id }))).toThrow(
      /duplicate search thesis id/i,
    )
  })

  it('threads per-search overrides through saveThesisRevision and toggle/correction helpers', () => {
    const thesis = useSearchStore.getState().addThesis(buildSearchThesis())

    const updated = useSearchStore.getState().updateThesisOverrides(thesis.id, {
      constraints: {
        salary: { min: 240000, max: 340000, currency: 'USD' },
        locations: ['Tampa Bay'],
        clearance: '',
        companySize: 'mid-market',
        remotePolicyNote: 'Distributed team with quarterly retreats',
      },
    })

    expect(updated?.searchOverrides?.constraints.salary).toEqual({
      min: 240000,
      max: 340000,
      currency: 'USD',
    })
    expect(updated?.searchOverrides?.constraints.remotePolicyNote).toBe(
      'Distributed team with quarterly retreats',
    )
    expect(updated?.searchOverrides).not.toHaveProperty('filters')
    expect(updated?.lookFor.map((signal) => signal.label)).toEqual(['platform modernization'])
    expect(updated?.avoid).toEqual([])
    expect(updated?.searchOverrides?.interviewPrefs.strongFit).toEqual([])
    expect(updated?.searchOverrides?.hiddenSkillIds).toEqual([])
    expect(updated?.source).toBe('user-edited')

    const afterToggleOn = useSearchStore.getState().toggleThesisHiddenSkill(thesis.id, 'skl-rust')
    expect(afterToggleOn?.searchOverrides?.hiddenSkillIds).toEqual(['skl-rust'])
    const afterToggleOff = useSearchStore.getState().toggleThesisHiddenSkill(thesis.id, 'skl-rust')
    expect(afterToggleOff?.searchOverrides?.hiddenSkillIds).toEqual([])

    const withCorrections = useSearchStore
      .getState()
      .setThesisUserCorrections(
        thesis.id,
        'Drop Kubernetes admin framing — focus on platform leverage.',
      )
    expect(withCorrections?.userCorrections).toBe(
      'Drop Kubernetes admin framing — focus on platform leverage.',
    )

    const withDirective = useSearchStore
      .getState()
      .setThesisCustomDirective(
        thesis.id,
        'Research adjacent CTO roles at platform-modernization startups.',
      )
    expect(withDirective?.customDirective).toBe(
      'Research adjacent CTO roles at platform-modernization startups.',
    )

    expect(useSearchStore.getState().updateThesisOverrides('missing-thesis', {})).toBeNull()
  })

  it('migrates persisted profile, request, and run metadata and safely defaults invalid state', () => {
    const migrated = migrateSearchState({
      profile: {
        id: 'legacy-profile',
        skills: [],
        vectors: [{ vectorId: 'legacy-backend' }],
        workSummary: [],
        openQuestions: [],
        constraints: { salary: { min: 0, max: 0 }, locations: [], clearance: '', companySize: '' },
        filters: {
          prioritize: ['platform ownership'],
          avoid: [
            {
              label: 'Kubernetes admin roles',
              condition: 'k8s admin',
              severity: 'conditional',
            },
          ],
        },
        interviewPrefs: { strongFit: [], redFlags: [] },
        inferredFromResumeVersion: 2,
        inferredAt: '2025-02-01T00:00:00.000Z',
      },
      requests: [
        {
          id: 'legacy-request',
          [legacyFocusVectorRequestKey]: ['backend'],
          unknownLegacyField: 'drop-me',
          companySizeOverride: '',
          salaryAnchorOverride: '',
          geoExpand: true,
          customKeywords: '',
          excludeCompanies: [],
          maxResults: { tier1: 5, tier2: 10, tier3: 10 },
          createdAt: '2025-02-02T00:00:00.000Z',
        },
      ],
      runs: [
        {
          id: 'legacy-run',
          requestId: 'legacy-request',
          status: 'completed',
          results: [],
          searchLog: [],
          createdAt: '2025-02-03T00:00:00.000Z',
        },
      ],
    })

    expect(migrated.profile?.durableMeta?.workspaceId).toBe(DEFAULT_LOCAL_WORKSPACE_ID)
    expect(migrated.profile?.durableMeta?.createdAt).toBe('2025-02-01T00:00:00.000Z')
    expect(migrated.requests[0].durableMeta?.createdAt).toBe('2025-02-02T00:00:00.000Z')
    expect(migrated.runs[0].durableMeta?.createdAt).toBe('2025-02-03T00:00:00.000Z')
    expect(migrated.profile?.constraints.industriesToAvoid).toEqual([])
    expect(migrated.profile?.constraints.fundingStagesAcceptable).toEqual([])
    expect(migrated.profile?.constraints.remotePolicies).toEqual([])
    expect(migrated.profile?.constraints.remotePolicyNote).toBe('')
    expect(migrated.profile?.constraints.employmentTypes).toEqual([])
    expect(migrated.profile?.filters.prioritize).toEqual([
      { label: 'platform ownership', severity: 'soft' },
    ])
    expect(migrated.profile?.filters.avoid).toEqual([
      {
        label: 'Kubernetes admin roles',
        condition: 'k8s admin',
        severity: 'conditional',
      },
    ])
    expect(migrated.profile).not.toHaveProperty('vectors')
    expect(migrated.requests[0]).not.toHaveProperty(legacyFocusVectorRequestKey)
    expect(migrated.requests[0]).not.toHaveProperty('unknownLegacyField')

    expect(migrateSearchState('bad-state')).toEqual({
      profile: null,
      requests: [],
      runs: [],
      theses: [],
      activeThesisId: null,
      feedbackEvents: [],
      activeResearchJob: null,
    })

    expect(
      migrateSearchState({
        profile: null,
        requests: [],
        runs: [],
        theses: [buildSearchThesis({ id: 'sthesis-legacy' })],
        activeThesisId: 'sthesis-legacy',
      }),
    ).toMatchObject({
      theses: [expect.objectContaining({ id: 'sthesis-legacy' })],
      activeThesisId: 'sthesis-legacy',
    })

    expect(
      migrateSearchState({
        profile: null,
        requests: [],
        runs: [],
        theses: [{ id: 'partial-thesis' }],
        activeThesisId: 'partial-thesis',
      }).theses[0],
    ).toMatchObject({
      id: 'partial-thesis',
      narrative: '',
      searchLanes: [],
      avoid: [],
      skillDepthMap: [],
    })

    const migratedLegacyThesis = migrateSearchState({
      profile: null,
      requests: [],
      runs: [],
      theses: [
        {
          ...buildSearchThesis({ id: 'legacy-thesis-missing-row-ids' }),
          unfairAdvantages: [
            {
              combination: 'Legacy advantage',
              depth: 'strong',
              targetCompanyProfile: 'Platform teams',
            },
          ],
          keywordCombinations: [
            {
              query: '"legacy platform"',
              lane: 'lane-1',
              noiseLevel: 'low',
            },
          ],
        },
      ],
      activeThesisId: 'legacy-thesis-missing-row-ids',
    }).theses[0]
    expect(migratedLegacyThesis?.unfairAdvantages[0]?.id).toMatch(/^sadv-/)
    expect(migratedLegacyThesis?.keywordCombinations[0]?.id).toMatch(/^skwd-/)

    expect(
      migrateSearchState({
        profile: null,
        requests: [
          {
            id: 'sreq-legacy',
            createdAt: '2026-03-11T00:00:00.000Z',
            focusLanes: [],
            companySizeOverride: '',
            salaryAnchorOverride: '',
            geoExpand: false,
            customKeywords: '',
            excludeCompanies: [],
            maxResults: { tier1: 5, tier2: 10, tier3: 10 },
          },
        ],
        runs: [
          {
            id: 'srun-legacy',
            requestId: 'sreq-legacy',
            createdAt: '2026-03-11T00:00:00.000Z',
            status: 'running',
            results: [],
            searchLog: [],
          },
        ],
        theses: [buildSearchThesis({ id: 'sthesis-legacy' })],
        activeResearchJob: {
          jobId: 'job-legacy',
          runId: 'srun-legacy',
          requestId: 'sreq-legacy',
          thesisId: 'sthesis-legacy',
          status: 'running',
        },
      }).activeResearchJob,
    ).toMatchObject({
      jobId: 'job-legacy',
      runId: 'srun-legacy',
      requestId: 'sreq-legacy',
      thesisId: 'sthesis-legacy',
      status: 'running',
      lastObservedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    })

    expect(
      migrateSearchState({
        profile: null,
        requests: [],
        runs: [],
        activeResearchJob: { jobId: 'job-missing-fields' },
      }).activeResearchJob,
    ).toBeNull()
    expect(
      migrateSearchState({
        profile: null,
        requests: [],
        runs: [],
        activeResearchJob: [],
      }).activeResearchJob,
    ).toBeNull()
  })

  it('hydrates missing request defaults with independent max result objects', () => {
    expect(Object.keys(searchRequestKeyCoverage).sort()).toEqual(expectedSearchRequestKeys)

    const migrated = migrateSearchState({
      requests: [
        {
          id: 'minimal-request-1',
          createdAt: '2026-03-12T00:00:00.000Z',
        },
        {
          id: 'minimal-request-2',
          createdAt: '2026-03-12T00:01:00.000Z',
        },
      ],
    })

    expect(migrated.requests[0]).toMatchObject({
      focusLanes: [],
      companySizeOverride: '',
      salaryAnchorOverride: '',
      geoExpand: true,
      customKeywords: '',
      excludeCompanies: [],
      maxResults: DEFAULT_SEARCH_MAX_RESULTS,
    })
    expect(migrated.requests[0].maxResults).not.toBe(DEFAULT_SEARCH_MAX_RESULTS)
    expect(migrated.requests[0].maxResults).not.toBe(migrated.requests[1].maxResults)

    migrated.requests[0].maxResults.tier1 = 99
    expect(migrated.requests[1].maxResults.tier1).toBe(DEFAULT_SEARCH_MAX_RESULTS.tier1)
  })

  it('sanitizes malformed persisted request fields during migration', () => {
    const migrated = migrateSearchState({
      requests: [
        {
          id: 'malformed-request-1',
          createdAt: '2026-03-12T00:00:00.000Z',
          focusLanes: ['keep-lane', 7, null, 'keep-too'],
          companySizeOverride: 'huge',
          salaryAnchorOverride: null,
          geoExpand: 'true',
          customKeywords: 42,
          excludeCompanies: ['OldCo', 7, null, 'NewCo'],
          maxResults: { tier1: 7, tier2: 'bad', tier3: null },
        },
        {
          id: 'malformed-request-2',
          createdAt: '2026-03-12T00:01:00.000Z',
          focusLanes: 'not-an-array',
          companySizeOverride: '  mid-market  ',
          salaryAnchorOverride: 'Keep salary',
          geoExpand: false,
          customKeywords: 'Keep keywords',
          excludeCompanies: 'not-an-array',
          maxResults: [],
        },
        {
          id: 'malformed-request-3',
          createdAt: '2026-03-12T00:02:00.000Z',
          companySizeOverride: 42,
          geoExpand: null,
          maxResults: { tier1: -1, tier2: Number.NaN, tier3: 2.7 },
        },
      ],
    })

    expect(migrated.requests[0]).toMatchObject({
      focusLanes: ['keep-lane', 'keep-too'],
      companySizeOverride: '',
      salaryAnchorOverride: '',
      geoExpand: true,
      customKeywords: '',
      excludeCompanies: ['OldCo', 'NewCo'],
      maxResults: {
        tier1: 7,
        tier2: DEFAULT_SEARCH_MAX_RESULTS.tier2,
        tier3: DEFAULT_SEARCH_MAX_RESULTS.tier3,
      },
    })
    expect(migrated.requests[1]).toMatchObject({
      focusLanes: [],
      companySizeOverride: 'mid-market',
      salaryAnchorOverride: 'Keep salary',
      geoExpand: false,
      customKeywords: 'Keep keywords',
      excludeCompanies: [],
      maxResults: DEFAULT_SEARCH_MAX_RESULTS,
    })
    expect(migrated.requests[2]).toMatchObject({
      companySizeOverride: '',
      geoExpand: true,
      maxResults: {
        tier1: DEFAULT_SEARCH_MAX_RESULTS.tier1,
        tier2: DEFAULT_SEARCH_MAX_RESULTS.tier2,
        tier3: 3,
      },
    })
  })

  it('preserves populated search constraint banks during migration', () => {
    const migrated = migrateSearchState({
      profile: {
        id: 'profile-with-banks',
        skills: [],
        workSummary: [],
        openQuestions: [],
        constraints: {
          salary: { min: 0, max: 0 },
          locations: [],
          clearance: '',
          companySize: '',
          industriesToAvoid: ['adtech'],
          fundingStagesAcceptable: ['series-a'],
          remotePolicies: ['remote-only'],
          remotePolicyNote: 'Open to distributed teams',
          employmentTypes: ['w2-fulltime'],
        },
        filters: { prioritize: [], avoid: [] },
        interviewPrefs: { strongFit: [], redFlags: [] },
        inferredFromResumeVersion: 2,
        inferredAt: '2025-02-01T00:00:00.000Z',
      },
    })

    expect(migrated.profile?.constraints).toMatchObject({
      industriesToAvoid: ['adtech'],
      fundingStagesAcceptable: ['series-a'],
      remotePolicies: ['remote-only'],
      remotePolicyNote: 'Open to distributed teams',
      employmentTypes: ['w2-fulltime'],
    })
  })

  it('migrates legacy profile compensation strings into salary bands', () => {
    const migrated = migrateSearchState({
      profile: {
        id: 'profile-with-legacy-compensation',
        skills: [],
        workSummary: [],
        openQuestions: [],
        constraints: {
          compensation: '$120k-$160k',
          locations: [],
          clearance: '',
          companySize: '',
        },
        filters: { prioritize: [], avoid: [] },
        interviewPrefs: { strongFit: [], redFlags: [] },
        inferredFromResumeVersion: 2,
        inferredAt: '2025-02-01T00:00:00.000Z',
      },
    })

    expect(migrated.profile?.constraints).not.toHaveProperty('compensation')
    expect(migrated.profile?.constraints.salary).toEqual({
      min: 120000,
      max: 160000,
      currency: 'USD',
    })
  })

  it('falls back once when legacy compensation strings cannot be parsed', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const migrated = migrateSearchState({
      profile: {
        id: 'profile-with-malformed-compensation',
        skills: [],
        workSummary: [],
        openQuestions: [],
        constraints: {
          compensation: 'competitive enough',
          locations: [],
          clearance: '',
          companySize: '',
        },
        filters: { prioritize: [], avoid: [] },
        interviewPrefs: { strongFit: [], redFlags: [] },
        inferredFromResumeVersion: 2,
        inferredAt: '2025-02-01T00:00:00.000Z',
      },
      theses: [
        buildSearchThesis({
          id: 'sthesis-malformed-compensation',
          searchOverrides: {
            constraints: {
              compensation: 'market-based',
              locations: [],
              clearance: '',
              companySize: '',
            },
            interviewPrefs: { strongFit: [], redFlags: [] },
            hiddenSkillIds: [],
          } as unknown as SearchThesis['searchOverrides'],
        }),
      ],
    })

    expect(migrated.profile?.constraints.salary).toEqual({ min: 0, max: 0 })
    expect(migrated.theses[0]?.searchOverrides?.constraints.salary).toEqual({ min: 0, max: 0 })
    expect(warnSpy).toHaveBeenCalledTimes(1)
    warnSpy.mockRestore()
  })

  it('migrates legacy thesis filters into canonical signal entries idempotently', () => {
    const legacyThesis = {
      ...buildSearchThesis({ id: 'sthesis-legacy-filter-migration' }),
      lookFor: [
        'Platform leverage',
        null,
        'Developer productivity',
        '',
        '   ',
      ] as unknown as string[],
      avoid: [
        {
          label: 'Pure Kubernetes administration',
          condition: 'Building around Kubernetes is fine.',
        },
        null,
        undefined,
      ],
      searchOverrides: {
        constraints: {
          compensation: '$240k base',
          locations: ['Remote US'],
          clearance: '',
          companySize: 'growth',
        },
        filters: {
          prioritize: [
            'platform leverage',
            '',
            '   ',
            null,
            { label: 'Nope' },
            'AI infrastructure',
          ],
          avoid: ['pure kubernetes administration', '\n', undefined, false, 'Crypto volatility'],
        },
        interviewPrefs: {
          strongFit: ['systems design'],
          redFlags: ['trivia-heavy loop'],
        },
        hiddenSkillIds: ['skl-rust'],
      },
    }

    const migrated = migrateSearchState({
      profile: null,
      requests: [],
      runs: [],
      theses: [legacyThesis],
      activeThesisId: legacyThesis.id,
    }).theses[0]

    expect(migrated?.lookFor.map((signal) => signal.label)).toEqual([
      'Platform leverage',
      'Developer productivity',
      'AI infrastructure',
    ])
    expect(migrated?.lookFor.every((signal) => signal.id.startsWith('ssig-'))).toBe(true)
    expect(migrated?.lookFor.every((signal) => signal.severity === 'soft')).toBe(true)
    expect(migrated?.avoid).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Pure Kubernetes administration',
          condition: 'Building around Kubernetes is fine.',
          severity: 'conditional',
        }),
        expect.objectContaining({
          label: 'Crypto volatility',
          severity: 'soft',
        }),
      ]),
    )
    expect(migrated?.searchOverrides).not.toHaveProperty('filters')
    expect(migrated?.searchOverrides?.constraints.salary).toEqual({
      min: 240000,
      max: 240000,
      currency: 'USD',
    })
    expect(migrated?.searchOverrides?.interviewPrefs.strongFit).toEqual(['systems design'])
    expect(migrated?.searchOverrides?.hiddenSkillIds).toEqual(['skl-rust'])

    const remigrated = migrateSearchState({
      profile: null,
      requests: [],
      runs: [],
      theses: migrated ? [migrated] : [],
      activeThesisId: migrated?.id,
    }).theses[0]

    expect(remigrated?.lookFor).toEqual(migrated?.lookFor)
    expect(remigrated?.avoid).toEqual(migrated?.avoid)
    expect(remigrated?.searchOverrides).not.toHaveProperty('filters')
  })

  it('leaves already-migrated thesis signals unchanged', () => {
    const alreadyMigrated = buildSearchThesis({
      id: 'sthesis-already-migrated',
      lookFor: [{ id: 'ssig-look-for-existing', label: 'Platform leverage', severity: 'soft' }],
      avoid: [
        {
          id: 'ssig-avoid-existing',
          label: 'Pure Kubernetes administration',
          condition: 'Only if admin is the whole role.',
          severity: 'conditional',
        },
        {
          id: 'ssig-avoid-hard-existing',
          label: 'Gambling platforms',
          condition: 'Even when platform scope is strong.',
          severity: 'hard',
        },
      ],
      searchOverrides: {
        constraints: {
          salary: { min: 240000, max: 240000, currency: 'USD' },
          locations: ['Remote US'],
          clearance: '',
          companySize: 'growth',
        },
        interviewPrefs: {
          strongFit: ['systems design'],
          redFlags: [],
        },
        hiddenSkillIds: [],
      },
    })

    const migrated = migrateSearchState({
      profile: null,
      requests: [],
      runs: [],
      theses: [alreadyMigrated],
      activeThesisId: alreadyMigrated.id,
    }).theses[0]

    expect(migrated?.lookFor).toEqual(alreadyMigrated.lookFor)
    expect(migrated?.avoid).toEqual(alreadyMigrated.avoid)
    expect(migrated?.searchOverrides).not.toHaveProperty('filters')
  })

  it('tracks active async research job metadata for reload rejoin', () => {
    useSearchStore.getState().updateActiveResearchJob({ status: 'running' })
    expect(useSearchStore.getState().activeResearchJob).toBeNull()

    useSearchStore.getState().setActiveResearchJob({
      jobId: 'job-1',
      runId: 'srun-1',
      requestId: 'sreq-1',
      thesisId: 'sthesis-1',
      status: 'queued',
      lastObservedAt: '2026-03-10T10:00:00.000Z',
    })

    useSearchStore.getState().updateActiveResearchJob({
      status: 'running',
      startedAt: '2026-03-10T10:01:00.000Z',
    })

    expect(useSearchStore.getState().activeResearchJob).toMatchObject({
      jobId: 'job-1',
      status: 'running',
      startedAt: '2026-03-10T10:01:00.000Z',
    })

    useSearchStore.getState().clearActiveResearchJob('other-job')
    expect(useSearchStore.getState().activeResearchJob?.jobId).toBe('job-1')

    useSearchStore.getState().clearActiveResearchJob('job-1')
    expect(useSearchStore.getState().activeResearchJob).toBeNull()
  })

  describe('feedback events', () => {
    const baseEventInput = {
      runId: 'srun-1',
      resultId: 'sres-1',
      rating: 'down' as const,
      reason: 'Role requires Go at production depth',
      appliedToIdentity: false,
    }

    it('adds a feedback event with a generated id and timestamp', () => {
      const event = useSearchStore.getState().addFeedbackEvent(baseEventInput)

      expect(event.id).toMatch(/^sfe-/)
      expect(event.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
      expect(event.updatedAt).toBe(event.createdAt)
      expect(event.runId).toBe('srun-1')
      expect(event.rating).toBe('down')
      expect(event.appliedToIdentity).toBe(false)
      expect(useSearchStore.getState().feedbackEvents).toHaveLength(1)
    })

    it('accepts structured dimensions when provided', () => {
      const event = useSearchStore.getState().addFeedbackEvent({
        ...baseEventInput,
        dimensions: {
          skill: { name: 'Go', suggestedDepth: 'basic' },
          preference: { category: 'avoid', label: 'Go-heavy roles', condition: 'unless adjacent' },
        },
      })

      expect(event.dimensions?.skill?.name).toBe('Go')
      expect(event.dimensions?.preference?.category).toBe('avoid')
      expect(event.dimensions?.preference?.condition).toBe('unless adjacent')
    })

    it('marks a feedback event as applied with the identity version that absorbed it', () => {
      vi.useFakeTimers()
      try {
        vi.setSystemTime(new Date('2026-04-20T10:00:00.000Z'))
        const event = useSearchStore.getState().addFeedbackEvent(baseEventInput)
        expect(event.updatedAt).toBe('2026-04-20T10:00:00.000Z')

        vi.setSystemTime(new Date('2026-04-20T10:05:00.000Z'))
        useSearchStore.getState().markFeedbackApplied(event.id, 7)

        const stored = useSearchStore.getState().feedbackEvents[0]
        expect(stored.appliedToIdentity).toBe(true)
        expect(stored.appliedAtVersion).toBe(7)
        expect(stored.updatedAt).toBe('2026-04-20T10:05:00.000Z')
      } finally {
        vi.useRealTimers()
      }
    })

    it('does not touch other events when marking one as applied', () => {
      const a = useSearchStore.getState().addFeedbackEvent(baseEventInput)
      const b = useSearchStore
        .getState()
        .addFeedbackEvent({ ...baseEventInput, resultId: 'sres-2' })

      useSearchStore.getState().markFeedbackApplied(a.id, 3)

      const events = useSearchStore.getState().feedbackEvents
      const byId = Object.fromEntries(events.map((e) => [e.id, e]))
      expect(byId[a.id].appliedToIdentity).toBe(true)
      expect(byId[b.id].appliedToIdentity).toBe(false)
    })

    it('marks a batch of events as reflected in a thesis', () => {
      vi.useFakeTimers()
      try {
        vi.setSystemTime(new Date('2026-04-20T11:00:00.000Z'))
        const a = useSearchStore.getState().addFeedbackEvent(baseEventInput)
        const b = useSearchStore
          .getState()
          .addFeedbackEvent({ ...baseEventInput, resultId: 'sres-2' })
        const c = useSearchStore
          .getState()
          .addFeedbackEvent({ ...baseEventInput, resultId: 'sres-3' })

        vi.setSystemTime(new Date('2026-04-20T11:07:00.000Z'))
        useSearchStore.getState().markFeedbackReflectedInThesis([a.id, c.id], 'sthesis-42')

        const events = useSearchStore.getState().feedbackEvents
        const byId = Object.fromEntries(events.map((e) => [e.id, e]))
        expect(byId[a.id].reflectedInThesisId).toBe('sthesis-42')
        expect(byId[a.id].updatedAt).toBe('2026-04-20T11:07:00.000Z')
        expect(byId[b.id].reflectedInThesisId).toBeUndefined()
        expect(byId[b.id].updatedAt).toBe('2026-04-20T11:00:00.000Z')
        expect(byId[c.id].reflectedInThesisId).toBe('sthesis-42')
        expect(byId[c.id].updatedAt).toBe('2026-04-20T11:07:00.000Z')
      } finally {
        vi.useRealTimers()
      }
    })

    it('getUnreflectedFeedback returns only applied events not yet reflected in the current thesis', () => {
      const store = useSearchStore.getState()
      const unapplied = store.addFeedbackEvent(baseEventInput)
      const appliedA = store.addFeedbackEvent({ ...baseEventInput, resultId: 'sres-a' })
      const appliedB = store.addFeedbackEvent({ ...baseEventInput, resultId: 'sres-b' })

      useSearchStore.getState().markFeedbackApplied(appliedA.id, 1)
      useSearchStore.getState().markFeedbackApplied(appliedB.id, 2)
      useSearchStore.getState().markFeedbackReflectedInThesis([appliedA.id], 'sthesis-current')

      const unreflected = useSearchStore.getState().getUnreflectedFeedback('sthesis-current')

      const ids = unreflected.map((e) => e.id)
      expect(ids).toContain(appliedB.id)
      expect(ids).not.toContain(appliedA.id)
      expect(ids).not.toContain(unapplied.id)
    })

    it('getUnreflectedFeedback without a thesisId returns every applied event (fresh-thesis case)', () => {
      const store = useSearchStore.getState()
      const unapplied = store.addFeedbackEvent(baseEventInput)
      const applied = store.addFeedbackEvent({ ...baseEventInput, resultId: 'sres-2' })
      useSearchStore.getState().markFeedbackApplied(applied.id, 1)
      useSearchStore.getState().markFeedbackReflectedInThesis([applied.id], 'sthesis-old')

      const result = useSearchStore.getState().getUnreflectedFeedback()
      const ids = result.map((e) => e.id)
      expect(ids).toEqual([applied.id])
      expect(ids).not.toContain(unapplied.id)
    })

    it('getFeedbackEventsForRun filters by runId', () => {
      const store = useSearchStore.getState()
      const run1a = store.addFeedbackEvent({ ...baseEventInput, runId: 'srun-1' })
      const run1b = store.addFeedbackEvent({
        ...baseEventInput,
        runId: 'srun-1',
        resultId: 'sres-x',
      })
      store.addFeedbackEvent({ ...baseEventInput, runId: 'srun-2' })

      const events = useSearchStore.getState().getFeedbackEventsForRun('srun-1')
      expect(events).toHaveLength(2)
      expect(events.map((e) => e.id).sort()).toEqual([run1a.id, run1b.id].sort())
    })

    it('migrates persisted state without feedbackEvents to an empty array', () => {
      const migrated = migrateSearchState({
        profile: null,
        requests: [],
        runs: [],
      })
      expect(migrated.feedbackEvents).toEqual([])
    })

    it('preserves existing thesis durable metadata timestamps during migration', () => {
      const migrated = migrateSearchState({
        profile: null,
        requests: [],
        runs: [],
        theses: [
          buildSearchThesis({
            durableMeta: {
              workspaceId: DEFAULT_LOCAL_WORKSPACE_ID,
              tenantId: null,
              userId: null,
              schemaVersion: 1,
              revision: 7,
              createdAt: '2026-04-20T10:00:00.000Z',
              updatedAt: '2026-04-22T12:34:56.000Z',
            },
          }),
        ],
      })

      expect(migrated.theses[0]?.durableMeta?.revision).toBe(7)
      expect(migrated.theses[0]?.durableMeta?.updatedAt).toBe('2026-04-22T12:34:56.000Z')
    })

    it('cascade-deletes feedback events when the referenced run is deleted', () => {
      const store = useSearchStore.getState()
      const keeper = store.addFeedbackEvent({ ...baseEventInput, runId: 'srun-keep' })
      const doomed = store.addFeedbackEvent({ ...baseEventInput, runId: 'srun-doomed' })
      useSearchStore.setState({
        requests: [
          {
            id: 'sreq-1',
            createdAt: '2026-03-11T00:00:00.000Z',
            focusLanes: [],
            companySizeOverride: '',
            salaryAnchorOverride: '',
            geoExpand: false,
            customKeywords: '',
            excludeCompanies: [],
            maxResults: { tier1: 5, tier2: 10, tier3: 10 },
          },
        ],
        runs: [
          {
            id: 'srun-keep',
            requestId: 'sreq-1',
            createdAt: '2026-03-11T00:00:00.000Z',
            status: 'completed',
            results: [],
            searchLog: [],
          },
          {
            id: 'srun-doomed',
            requestId: 'sreq-1',
            createdAt: '2026-03-11T00:00:00.000Z',
            status: 'completed',
            results: [],
            searchLog: [],
          },
        ],
        theses: [
          buildSearchThesis({
            feedbackIncorporated: [keeper.id, doomed.id],
          }),
        ],
      })

      useSearchStore.getState().deleteRun('srun-doomed')

      const events = useSearchStore.getState().feedbackEvents
      expect(events.map((e) => e.id)).toEqual([keeper.id])
      expect(events.find((e) => e.id === doomed.id)).toBeUndefined()
      expect(useSearchStore.getState().theses[0]?.feedbackIncorporated).toEqual([keeper.id])
    })

    it('cascade-deletes feedback events for every run when a request is deleted', () => {
      const store = useSearchStore.getState()
      const eventRunA = store.addFeedbackEvent({ ...baseEventInput, runId: 'srun-a' })
      const eventRunB = store.addFeedbackEvent({ ...baseEventInput, runId: 'srun-b' })
      const eventRunC = store.addFeedbackEvent({ ...baseEventInput, runId: 'srun-c' })
      useSearchStore.setState({
        runs: [
          {
            id: 'srun-a',
            requestId: 'sreq-doomed',
            createdAt: '2026-03-11T00:00:00.000Z',
            status: 'completed',
            results: [],
            searchLog: [],
          },
          {
            id: 'srun-b',
            requestId: 'sreq-doomed',
            createdAt: '2026-03-11T00:00:00.000Z',
            status: 'completed',
            results: [],
            searchLog: [],
          },
          {
            id: 'srun-c',
            requestId: 'sreq-keep',
            createdAt: '2026-03-11T00:00:00.000Z',
            status: 'completed',
            results: [],
            searchLog: [],
          },
        ],
        requests: [
          {
            id: 'sreq-doomed',
            createdAt: '2026-03-11T00:00:00.000Z',
            focusLanes: [],
            companySizeOverride: '',
            salaryAnchorOverride: '',
            geoExpand: false,
            customKeywords: '',
            excludeCompanies: [],
            maxResults: { tier1: 5, tier2: 10, tier3: 10 },
          },
          {
            id: 'sreq-keep',
            createdAt: '2026-03-11T00:00:00.000Z',
            focusLanes: [],
            companySizeOverride: '',
            salaryAnchorOverride: '',
            geoExpand: false,
            customKeywords: '',
            excludeCompanies: [],
            maxResults: { tier1: 5, tier2: 10, tier3: 10 },
          },
        ],
        theses: [
          buildSearchThesis({
            feedbackIncorporated: [eventRunA.id, eventRunB.id, eventRunC.id],
          }),
        ],
      })

      useSearchStore.getState().deleteRequest('sreq-doomed')

      const events = useSearchStore.getState().feedbackEvents
      expect(events.map((e) => e.id)).toEqual([eventRunC.id])
      expect(events.find((e) => e.id === eventRunA.id)).toBeUndefined()
      expect(events.find((e) => e.id === eventRunB.id)).toBeUndefined()
      expect(useSearchStore.getState().theses[0]?.feedbackIncorporated).toEqual([eventRunC.id])
    })

    it('preserves persisted feedbackEvents across migration when their run survives', () => {
      const existing = {
        id: 'sfe-existing',
        runId: 'srun-legacy',
        resultId: 'sres-legacy',
        rating: 'up' as const,
        appliedToIdentity: true,
        appliedAtVersion: 4,
        createdAt: '2025-12-01T00:00:00.000Z',
      }
      const migrated = migrateSearchState({
        profile: null,
        requests: [
          {
            id: 'sreq-legacy',
            createdAt: '2026-03-11T00:00:00.000Z',
            focusLanes: [],
            companySizeOverride: '',
            salaryAnchorOverride: '',
            geoExpand: false,
            customKeywords: '',
            excludeCompanies: [],
            maxResults: { tier1: 5, tier2: 10, tier3: 10 },
          },
        ],
        runs: [
          {
            id: 'srun-legacy',
            requestId: 'sreq-legacy',
            createdAt: '2026-03-11T00:00:00.000Z',
            status: 'completed',
            results: [],
            searchLog: [],
          },
        ],
        feedbackEvents: [existing],
      })
      expect(migrated.feedbackEvents).toEqual([existing])
    })

    it('prunes orphaned feedback and thesis feedback references during migration', () => {
      const migrated = migrateSearchState({
        profile: null,
        requests: [
          {
            id: 'sreq-live',
            createdAt: '2026-03-11T00:00:00.000Z',
            focusLanes: [],
            companySizeOverride: '',
            salaryAnchorOverride: '',
            geoExpand: false,
            customKeywords: '',
            excludeCompanies: [],
            maxResults: { tier1: 5, tier2: 10, tier3: 10 },
          },
        ],
        runs: [
          {
            id: 'srun-live',
            requestId: 'sreq-live',
            createdAt: '2026-03-11T00:00:00.000Z',
            status: 'completed',
            results: [],
            searchLog: [],
          },
          {
            id: 'srun-orphan',
            requestId: 'sreq-missing',
            createdAt: '2026-03-11T00:00:00.000Z',
            status: 'completed',
            results: [],
            searchLog: [],
          },
        ],
        theses: [
          buildSearchThesis({
            feedbackIncorporated: ['sfe-live', 'sfe-orphan'],
          }),
        ],
        feedbackEvents: [
          {
            id: 'sfe-live',
            runId: 'srun-live',
            resultId: 'sres-live',
            rating: 'up' as const,
            appliedToIdentity: true,
            createdAt: '2026-03-11T00:00:00.000Z',
          },
          {
            id: 'sfe-orphan',
            runId: 'srun-orphan',
            resultId: 'sres-orphan',
            rating: 'down' as const,
            appliedToIdentity: true,
            createdAt: '2026-03-11T00:00:00.000Z',
          },
        ],
        activeThesisId: 'sthesis-1',
        activeResearchJob: {
          jobId: 'job-orphan',
          requestId: 'sreq-live',
          runId: 'srun-orphan',
          thesisId: 'sthesis-1',
          status: 'running' as const,
          startedAt: '2026-03-11T00:00:00.000Z',
        },
      })

      expect(migrated.runs.map((run) => run.id)).toEqual(['srun-live'])
      expect(migrated.feedbackEvents.map((event) => event.id)).toEqual(['sfe-live'])
      expect(migrated.theses[0]?.feedbackIncorporated).toEqual(['sfe-live'])
      expect(migrated.activeResearchJob).toBeNull()
    })
  })
})
