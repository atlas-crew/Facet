import { beforeEach, describe, expect, it } from 'vitest'
import {
  migrateSearchState,
  useSearchStore,
} from '../store/searchStore'
import type { SearchThesis } from '../types/search'
import { DEFAULT_LOCAL_WORKSPACE_ID } from '../types/durable'

const buildSearchThesis = (overrides: Partial<SearchThesis> = {}): SearchThesis => ({
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
  lookFor: ['platform modernization'],
  avoid: [],
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
  ...overrides,
})

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
      vectors: [],
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
    useSearchStore.getState().updateProfileVectors([
      {
        vectorId: 'backend',
        priority: 1,
        description: 'Platform-heavy backend roles',
        targetRoleTitles: ['Staff Engineer'],
        searchKeywords: ['distributed systems'],
      },
    ])
    useSearchStore.getState().updateProfileConstraints({
      compensation: '$250k',
      locations: ['Remote'],
      clearance: '',
      companySize: '',
    })
    useSearchStore.getState().updateProfileFilters({
      prioritize: ['platform'],
      avoid: ['ad tech'],
    })
    useSearchStore.getState().updateProfileInterviewPrefs({
      strongFit: ['staff scope'],
      redFlags: ['unclear ownership'],
    })

    const updated = useSearchStore.getState().profile
    expect(updated?.skills).toHaveLength(1)
    expect(updated?.vectors[0]?.vectorId).toBe('backend')
    expect(updated?.constraints.compensation).toBe('$250k')
    expect(updated?.filters.prioritize).toEqual(['platform'])
    expect(updated?.interviewPrefs.strongFit).toEqual(['staff scope'])
    expect(updated?.durableMeta?.workspaceId).toBe(DEFAULT_LOCAL_WORKSPACE_ID)
    expect(updated?.durableMeta?.revision).toBe(5)
  })

  it('adds, updates, and deletes requests', () => {
    const request = useSearchStore.getState().addRequest({
      focusVectors: ['backend'],
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
    expect(useSearchStore.getState().requests[0]?.durableMeta?.workspaceId).toBe(DEFAULT_LOCAL_WORKSPACE_ID)
    expect(useSearchStore.getState().requests[0]?.durableMeta?.createdAt).toBe(before?.durableMeta?.createdAt)
    expect(useSearchStore.getState().requests[0]?.durableMeta?.revision).toBe(1)

    useSearchStore.getState().deleteRequest(request.id)
    expect(useSearchStore.getState().requests).toEqual([])
  })

  it('adds runs and filters them by request id', () => {
    const requestOne = useSearchStore.getState().addRequest({
      focusVectors: ['backend'],
      companySizeOverride: '',
      salaryAnchorOverride: '',
      geoExpand: true,
      customKeywords: '',
      excludeCompanies: [],
      maxResults: { tier1: 5, tier2: 10, tier3: 10 },
    })
    const requestTwo = useSearchStore.getState().addRequest({
      focusVectors: ['leadership'],
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

  it('treats profile updaters as no-ops when no profile exists and supports clear/delete run', () => {
    useSearchStore.getState().updateProfileSkills([{ id: 'skl-1', name: 'TypeScript', category: 'backend', depth: 'strong' }])
    useSearchStore.getState().updateProfileVectors([{ vectorId: 'backend', priority: 1, description: '', targetRoleTitles: [], searchKeywords: [] }])
    useSearchStore.getState().updateProfileConstraints({ compensation: '', locations: [], clearance: '', companySize: '' })
    useSearchStore.getState().updateProfileFilters({ prioritize: [], avoid: [] })
    useSearchStore.getState().updateProfileInterviewPrefs({ strongFit: [], redFlags: [] })
    expect(useSearchStore.getState().profile).toBeNull()

    useSearchStore.getState().setProfile({
      skills: [],
      vectors: [],
      workSummary: [],
      openQuestions: [],
      constraints: { compensation: '', locations: [], clearance: '', companySize: '' },
      filters: { prioritize: [], avoid: [] },
      interviewPrefs: { strongFit: [], redFlags: [] },
      inferredFromResumeVersion: 1,
    })

    const request = useSearchStore.getState().addRequest({
      focusVectors: [],
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
    const first = useSearchStore.getState().addThesis(buildSearchThesis({
      unfairAdvantages: [
        {
          id: 'sadv-1',
          combination: 'Kubernetes plus product judgment',
          depth: 'strong',
          targetCompanyProfile: 'Platform modernization teams',
        },
      ],
      interviewStrategy: 'Preserve this interview strategy.',
      lookFor: ['platform modernization', 'developer leverage'],
      keywordCombinations: [
        { id: 'skwd-1', query: '"platform modernization"', lane: 'lane-1', noiseLevel: 'low' },
      ],
      feedbackIncorporated: ['sfe-1'],
    }))

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
    expect(() => useSearchStore.getState().addThesis(buildSearchThesis({ id: first.id })))
      .toThrow(/duplicate search thesis id/i)
  })

  it('migrates persisted profile, request, and run metadata and safely defaults invalid state', () => {
    const migrated = migrateSearchState({
      profile: {
        id: 'legacy-profile',
        skills: [],
        vectors: [],
        workSummary: [],
        openQuestions: [],
        constraints: { compensation: '', locations: [], clearance: '', companySize: '' },
        filters: { prioritize: [], avoid: [] },
        interviewPrefs: { strongFit: [], redFlags: [] },
        inferredFromResumeVersion: 2,
        inferredAt: '2025-02-01T00:00:00.000Z',
      },
      requests: [
        {
          id: 'legacy-request',
          focusVectors: ['backend'],
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

    expect(migrateSearchState('bad-state')).toEqual({
      profile: null,
      requests: [],
      runs: [],
      theses: [],
      activeThesisId: null,
      feedbackEvents: [],
      activeResearchJob: null,
    })

    expect(migrateSearchState({
      profile: null,
      requests: [],
      runs: [],
      theses: [buildSearchThesis({ id: 'sthesis-legacy' })],
      activeThesisId: 'sthesis-legacy',
    })).toMatchObject({
      theses: [expect.objectContaining({ id: 'sthesis-legacy' })],
      activeThesisId: 'sthesis-legacy',
    })

    expect(migrateSearchState({
      profile: null,
      requests: [],
      runs: [],
      theses: [{ id: 'partial-thesis' }],
      activeThesisId: 'partial-thesis',
    }).theses[0]).toMatchObject({
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

    expect(migrateSearchState({
      profile: null,
      requests: [],
      runs: [],
      activeResearchJob: {
        jobId: 'job-legacy',
        runId: 'srun-legacy',
        requestId: 'sreq-legacy',
        thesisId: 'sthesis-legacy',
        status: 'running',
      },
    }).activeResearchJob).toMatchObject({
      jobId: 'job-legacy',
      runId: 'srun-legacy',
      requestId: 'sreq-legacy',
      thesisId: 'sthesis-legacy',
      status: 'running',
      lastObservedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    })

    expect(migrateSearchState({
      profile: null,
      requests: [],
      runs: [],
      activeResearchJob: { jobId: 'job-missing-fields' },
    }).activeResearchJob).toBeNull()
    expect(migrateSearchState({
      profile: null,
      requests: [],
      runs: [],
      activeResearchJob: [],
    }).activeResearchJob).toBeNull()
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
      const event = useSearchStore.getState().addFeedbackEvent(baseEventInput)

      useSearchStore.getState().markFeedbackApplied(event.id, 7)

      const stored = useSearchStore.getState().feedbackEvents[0]
      expect(stored.appliedToIdentity).toBe(true)
      expect(stored.appliedAtVersion).toBe(7)
    })

    it('does not touch other events when marking one as applied', () => {
      const a = useSearchStore.getState().addFeedbackEvent(baseEventInput)
      const b = useSearchStore.getState().addFeedbackEvent({ ...baseEventInput, resultId: 'sres-2' })

      useSearchStore.getState().markFeedbackApplied(a.id, 3)

      const events = useSearchStore.getState().feedbackEvents
      const byId = Object.fromEntries(events.map((e) => [e.id, e]))
      expect(byId[a.id].appliedToIdentity).toBe(true)
      expect(byId[b.id].appliedToIdentity).toBe(false)
    })

    it('marks a batch of events as reflected in a thesis', () => {
      const a = useSearchStore.getState().addFeedbackEvent(baseEventInput)
      const b = useSearchStore.getState().addFeedbackEvent({ ...baseEventInput, resultId: 'sres-2' })
      const c = useSearchStore.getState().addFeedbackEvent({ ...baseEventInput, resultId: 'sres-3' })

      useSearchStore.getState().markFeedbackReflectedInThesis([a.id, c.id], 'sthesis-42')

      const events = useSearchStore.getState().feedbackEvents
      const byId = Object.fromEntries(events.map((e) => [e.id, e]))
      expect(byId[a.id].reflectedInThesisId).toBe('sthesis-42')
      expect(byId[b.id].reflectedInThesisId).toBeUndefined()
      expect(byId[c.id].reflectedInThesisId).toBe('sthesis-42')
    })

    it('getUnreflectedFeedback returns only applied events not yet reflected in the current thesis', () => {
      const store = useSearchStore.getState()
      const unapplied = store.addFeedbackEvent(baseEventInput)
      const appliedA = store.addFeedbackEvent({ ...baseEventInput, resultId: 'sres-a' })
      const appliedB = store.addFeedbackEvent({ ...baseEventInput, resultId: 'sres-b' })

      useSearchStore.getState().markFeedbackApplied(appliedA.id, 1)
      useSearchStore.getState().markFeedbackApplied(appliedB.id, 2)
      useSearchStore
        .getState()
        .markFeedbackReflectedInThesis([appliedA.id], 'sthesis-current')

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
      useSearchStore
        .getState()
        .markFeedbackReflectedInThesis([applied.id], 'sthesis-old')

      const result = useSearchStore.getState().getUnreflectedFeedback()
      const ids = result.map((e) => e.id)
      expect(ids).toEqual([applied.id])
      expect(ids).not.toContain(unapplied.id)
    })

    it('getFeedbackEventsForRun filters by runId', () => {
      const store = useSearchStore.getState()
      const run1a = store.addFeedbackEvent({ ...baseEventInput, runId: 'srun-1' })
      const run1b = store.addFeedbackEvent({ ...baseEventInput, runId: 'srun-1', resultId: 'sres-x' })
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

    it('cascade-deletes feedback events when the referenced run is deleted', () => {
      const store = useSearchStore.getState()
      const keeper = store.addFeedbackEvent({ ...baseEventInput, runId: 'srun-keep' })
      const doomed = store.addFeedbackEvent({ ...baseEventInput, runId: 'srun-doomed' })
      useSearchStore.setState({
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
      })

      useSearchStore.getState().deleteRun('srun-doomed')

      const events = useSearchStore.getState().feedbackEvents
      expect(events.map((e) => e.id)).toEqual([keeper.id])
      expect(events.find((e) => e.id === doomed.id)).toBeUndefined()
    })

    it('cascade-deletes feedback events for every run when a request is deleted', () => {
      const store = useSearchStore.getState()
      const eventRunA = store.addFeedbackEvent({ ...baseEventInput, runId: 'srun-a' })
      const eventRunB = store.addFeedbackEvent({ ...baseEventInput, runId: 'srun-b' })
      const eventRunC = store.addFeedbackEvent({ ...baseEventInput, runId: 'srun-c' })
      useSearchStore.setState({
        runs: [
          { id: 'srun-a', requestId: 'sreq-doomed', createdAt: '2026-03-11T00:00:00.000Z', status: 'completed', results: [], searchLog: [] },
          { id: 'srun-b', requestId: 'sreq-doomed', createdAt: '2026-03-11T00:00:00.000Z', status: 'completed', results: [], searchLog: [] },
          { id: 'srun-c', requestId: 'sreq-keep', createdAt: '2026-03-11T00:00:00.000Z', status: 'completed', results: [], searchLog: [] },
        ],
        requests: [
          { id: 'sreq-doomed', createdAt: '2026-03-11T00:00:00.000Z', focusVectors: [], companySizeOverride: '', salaryAnchorOverride: '', geoExpand: false, customKeywords: '', excludeCompanies: [], maxResults: { tier1: 5, tier2: 10, tier3: 10 } },
          { id: 'sreq-keep', createdAt: '2026-03-11T00:00:00.000Z', focusVectors: [], companySizeOverride: '', salaryAnchorOverride: '', geoExpand: false, customKeywords: '', excludeCompanies: [], maxResults: { tier1: 5, tier2: 10, tier3: 10 } },
        ],
      })

      useSearchStore.getState().deleteRequest('sreq-doomed')

      const events = useSearchStore.getState().feedbackEvents
      expect(events.map((e) => e.id)).toEqual([eventRunC.id])
      expect(events.find((e) => e.id === eventRunA.id)).toBeUndefined()
      expect(events.find((e) => e.id === eventRunB.id)).toBeUndefined()
    })

    it('preserves persisted feedbackEvents across migration', () => {
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
        requests: [],
        runs: [],
        feedbackEvents: [existing],
      })
      expect(migrated.feedbackEvents).toEqual([existing])
    })
  })
})
