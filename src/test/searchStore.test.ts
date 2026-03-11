import { beforeEach, describe, expect, it } from 'vitest'
import {
  migrateSearchState,
  useSearchStore,
} from '../store/searchStore'
import { DEFAULT_LOCAL_WORKSPACE_ID } from '../types/durable'

describe('searchStore', () => {
  beforeEach(() => {
    useSearchStore.setState({
      profile: null,
      requests: [],
      runs: [],
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
    })
  })
})
