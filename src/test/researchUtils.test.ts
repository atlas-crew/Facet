import { describe, expect, it } from 'vitest'
import type {
  SearchProfile,
  SearchRequestMaxResults,
  SearchResultEntry,
  SearchThesis,
} from '../types/search'
import {
  buildInterviewProcessSignals,
  buildRequestDraft,
  createPipelineEntryDraft,
  emptyProfile,
  groupByTier,
  joinTags,
  normalizeMaxResults,
  parseInterviewFormatPhrases,
  splitTags,
  toPipelineTier,
  upsertVectorConfig,
} from '../routes/research/researchUtils'

const baseProfile: SearchProfile = {
  id: 'sprof-1',
  inferredAt: '2026-03-10T10:00:00.000Z',
  inferredFromResumeVersion: 4,
  skills: [],
  vectors: [
    {
      vectorId: 'platform',
      priority: 3,
      description: 'Platform',
      targetRoleTitles: ['Platform Lead'],
      searchKeywords: ['platform'],
    },
    {
      vectorId: 'backend',
      priority: 1,
      description: 'Backend',
      targetRoleTitles: ['Staff Backend Engineer'],
      searchKeywords: ['backend'],
    },
    {
      vectorId: 'security',
      priority: 2,
      description: 'Security',
      targetRoleTitles: ['Security Engineer'],
      searchKeywords: ['security'],
    },
  ],
  workSummary: [],
  openQuestions: [],
  constraints: {
    compensation: '$250k',
    locations: ['Remote'],
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
}

const baseThesis: Pick<SearchThesis, 'searchLanes' | 'searchOverrides'> = {
  searchLanes: [
    {
      id: 'backend-lane',
      title: 'Backend systems',
      rationale: 'Find senior backend roles.',
      targetSignals: ['backend'],
    },
    {
      id: 'security-lane',
      title: 'Security platform',
      rationale: 'Find security platform roles.',
      targetSignals: ['security'],
    },
  ],
}

const maxResults: SearchRequestMaxResults = {
  tier1: 5,
  tier2: 10,
  tier3: 15,
}

const searchResult: SearchResultEntry = {
  id: 'sres-1',
  tier: 2,
  company: 'Acme Corp',
  title: 'Staff Platform Engineer',
  url: 'https://example.com/jobs/1',
  matchScore: 92,
  matchReason: 'Strong platform fit',
  vectorAlignment: 'backend',
  risks: ['Smaller team'],
  estimatedComp: '$260k-$310k',
  source: 'greenhouse',
}

describe('researchUtils', () => {
  it('normalizes comma-separated tag input', () => {
    expect(splitTags('')).toEqual([])
    expect(splitTags('alpha,, beta, ,gamma')).toEqual(['alpha', 'beta', 'gamma'])
    expect(splitTags('single-value')).toEqual(['single-value'])
    expect(splitTags('   ,   ,  ')).toEqual([])
    expect(joinTags(['alpha', 'beta'])).toBe('alpha, beta')
    expect(joinTags([])).toBe('')
    expect(splitTags(joinTags(['cafe', 'naive', 'platform security']))).toEqual([
      'cafe',
      'naive',
      'platform security',
    ])
  })

  it('builds an empty profile shape with the provided resume version', () => {
    expect(emptyProfile(7)).toEqual({
      skills: [],
      vectors: [],
      workSummary: [],
      openQuestions: [],
      source: {
        kind: 'resume',
        label: 'Resume fallback',
      },
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
      inferredFromResumeVersion: 7,
    })
    expect(emptyProfile(0).inferredFromResumeVersion).toBe(0)
    expect(emptyProfile(-1).inferredFromResumeVersion).toBe(-1)
    expect(emptyProfile(Number.MAX_SAFE_INTEGER).inferredFromResumeVersion).toBe(
      Number.MAX_SAFE_INTEGER,
    )
  })

  it('upserts vector configs and keeps them sorted by priority', () => {
    const inserted = upsertVectorConfig([], 'backend', { priority: 2, description: 'Backend' })
    expect(inserted).toHaveLength(1)
    expect(inserted[0]?.vectorId).toBe('backend')

    const updated = upsertVectorConfig(
      [
        {
          vectorId: 'platform',
          priority: 3,
          description: '',
          targetRoleTitles: [],
          searchKeywords: [],
        },
        {
          vectorId: 'backend',
          priority: 2,
          description: '',
          targetRoleTitles: [],
          searchKeywords: [],
        },
      ],
      'platform',
      { priority: 1, searchKeywords: ['internal tools'] },
    )

    expect(updated.map((vector) => vector.vectorId)).toEqual(['platform', 'backend'])
    expect(updated[0]?.searchKeywords).toEqual(['internal tools'])

    const preservedId = upsertVectorConfig(updated, 'backend', {
      vectorId: 'should-not-win' as never,
      priority: 5,
    })
    expect(preservedId.find((vector) => vector.priority === 5)?.vectorId).toBe('backend')

    const appended = upsertVectorConfig(updated, 'new-vector', {})
    expect(appended.find((vector) => vector.vectorId === 'new-vector')?.priority).toBe(3)

    const tiedPriority = upsertVectorConfig(
      [
        {
          vectorId: 'alpha',
          priority: 1,
          description: '',
          targetRoleTitles: [],
          searchKeywords: [],
        },
        {
          vectorId: 'beta',
          priority: 1,
          description: '',
          targetRoleTitles: [],
          searchKeywords: [],
        },
      ],
      'gamma',
      { priority: 1 },
    )
    expect(tiedPriority.map((vector) => vector.vectorId)).toEqual(['alpha', 'beta', 'gamma'])
  })

  it('upserts vector configs without mutating existing entries', () => {
    const original = [
      {
        vectorId: 'backend',
        priority: 2,
        description: 'Backend systems',
        targetRoleTitles: ['Staff Backend Engineer'],
        searchKeywords: ['backend'],
      },
      {
        vectorId: 'platform',
        priority: 1,
        description: 'Platform systems',
        targetRoleTitles: ['Staff Platform Engineer'],
        searchKeywords: ['platform'],
      },
    ]
    const snapshot = structuredClone(original)

    const updated = upsertVectorConfig(original, 'backend', {
      priority: 3,
      searchKeywords: ['distributed systems'],
    })

    expect(original).toEqual(snapshot)
    expect(updated).not.toBe(original)
    expect(updated.find((vector) => vector.vectorId === 'backend')).toMatchObject({
      priority: 3,
      searchKeywords: ['distributed systems'],
    })
    expect(original[0]).toEqual(snapshot[0])
  })

  it('builds a request draft from thesis lanes', () => {
    expect(buildRequestDraft(baseProfile, baseThesis)).toEqual({
      focusLanes: ['backend-lane', 'security-lane'],
      focusVectors: [],
      companySizeOverride: '',
      salaryAnchorOverride: '$250k',
      geoExpand: true,
      customKeywords: '',
      maxResults: { tier1: 5, tier2: 10, tier3: 10 },
    })

    expect(buildRequestDraft(null).focusLanes).toEqual([])

    const singleVectorProfile: SearchProfile = {
      ...baseProfile,
      vectors: [baseProfile.vectors[0]!],
    }
    const emptyVectorProfile: SearchProfile = {
      ...baseProfile,
      vectors: [],
    }
    const originalOrder = baseProfile.vectors.map((vector) => vector.vectorId)
    expect(buildRequestDraft(singleVectorProfile).focusLanes).toEqual([])
    expect(buildRequestDraft(emptyVectorProfile, baseThesis).focusLanes).toEqual([
      'backend-lane',
      'security-lane',
    ])
    expect(baseProfile.vectors.map((vector) => vector.vectorId)).toEqual(originalOrder)
  })

  it('prefers thesis searchOverrides over profile constraints when building a request draft', () => {
    const draftFromThesis = buildRequestDraft(baseProfile, {
      ...baseThesis,
      searchOverrides: {
        constraints: {
          compensation: '$340k total',
          locations: ['Tampa Bay'],
          clearance: '',
          companySize: 'growth',
        },
        interviewPrefs: { strongFit: [], redFlags: [] },
        hiddenSkillIds: [],
      },
    })

    expect(draftFromThesis.salaryAnchorOverride).toBe('$340k total')
    expect(draftFromThesis.companySizeOverride).toBe('growth')
    expect(draftFromThesis).not.toHaveProperty('locations')

    // When the override compensation is empty/whitespace, fall back to profile.
    const draftWithEmptyOverride = buildRequestDraft(baseProfile, {
      ...baseThesis,
      searchOverrides: {
        constraints: {
          compensation: '   ',
          locations: [],
          clearance: '',
          companySize: '',
        },
        interviewPrefs: { strongFit: [], redFlags: [] },
        hiddenSkillIds: [],
      },
    })
    expect(draftWithEmptyOverride.salaryAnchorOverride).toBe('$250k')
    expect(draftWithEmptyOverride.companySizeOverride).toBe('')

    // When no thesis override layer exists, behavior matches the profile-only path.
    expect(buildRequestDraft(baseProfile, null)).toEqual(buildRequestDraft(baseProfile))
  })

  it('groups tiered results and clamps max results inputs', () => {
    const grouped = groupByTier([
      { ...searchResult, id: 'tier-1', tier: 1 },
      { ...searchResult, id: 'tier-2', tier: 2 },
      { ...searchResult, id: 'tier-3', tier: 3 },
    ])

    expect(grouped.tier1).toHaveLength(1)
    expect(grouped.tier2).toHaveLength(1)
    expect(grouped.tier3).toHaveLength(1)
    expect(groupByTier([])).toEqual({ tier1: [], tier2: [], tier3: [] })
    expect(
      groupByTier([
        { ...searchResult, id: 'tier-0', tier: 0 as unknown as SearchResultEntry['tier'] },
        { ...searchResult, id: 'tier-negative', tier: -1 as unknown as SearchResultEntry['tier'] },
        { ...searchResult, id: 'tier-float', tier: 1.5 as unknown as SearchResultEntry['tier'] },
        {
          ...searchResult,
          id: 'tier-nan',
          tier: Number.NaN as unknown as SearchResultEntry['tier'],
        },
        { ...searchResult, id: 'tier-4', tier: 4 as unknown as SearchResultEntry['tier'] },
        { ...searchResult, id: 'tier-valid', tier: 3 },
      ]),
    ).toEqual({
      tier1: [],
      tier2: [],
      tier3: [{ ...searchResult, id: 'tier-valid', tier: 3 }],
    })
    const results: SearchResultEntry[] = [
      { ...searchResult, id: 'stable-tier-1', tier: 1 },
      { ...searchResult, id: 'stable-tier-2', tier: 2 },
    ]
    const resultsSnapshot = structuredClone(results)
    groupByTier(results)
    expect(results).toEqual(resultsSnapshot)

    const clamped = normalizeMaxResults(maxResults, 'tier1', '0')
    expect(clamped.tier1).toBe(1)
    expect(clamped.tier2).toBe(10)
    expect(clamped.tier3).toBe(15)
    expect(normalizeMaxResults(maxResults, 'tier1', '2.9').tier1).toBe(2)
    expect(normalizeMaxResults(maxResults, 'tier2', '-5').tier2).toBe(1)
    expect(normalizeMaxResults(maxResults, 'tier3', 'abc').tier3).toBe(15)
    expect(normalizeMaxResults(maxResults, 'tier1', '').tier1).toBe(5)
    expect(normalizeMaxResults(maxResults, 'tier2', '   ').tier2).toBe(10)
    expect(normalizeMaxResults(maxResults, 'tier1', '9999999').tier1).toBe(9999999)
    expect(normalizeMaxResults(maxResults, 'tier2', '1e9').tier2).toBe(1)

    const maxResultsSnapshot = structuredClone(maxResults)
    const adjusted = normalizeMaxResults(maxResults, 'tier3', '12')
    expect(maxResults).toEqual(maxResultsSnapshot)
    expect(adjusted).not.toBe(maxResults)
    expect(adjusted.tier3).toBe(12)
  })

  it('maps search results into pipeline drafts and rejects unsupported tiers', () => {
    expect(toPipelineTier(1)).toBe('1')
    expect(toPipelineTier(2)).toBe('2')
    expect(toPipelineTier(3)).toBe('3')
    expect(toPipelineTier(0)).toBeNull()
    expect(toPipelineTier(-1)).toBeNull()
    expect(toPipelineTier(1.5)).toBeNull()
    expect(toPipelineTier(Number.NaN)).toBeNull()
    expect(toPipelineTier(Number.POSITIVE_INFINITY)).toBeNull()
    expect(toPipelineTier(4)).toBeNull()

    expect(createPipelineEntryDraft(searchResult, 'backend')).toEqual({
      company: 'Acme Corp',
      role: 'Staff Platform Engineer',
      tier: '2',
      status: 'researching',
      comp: '$260k-$310k',
      url: 'https://example.com/jobs/1',
      contact: '',
      vectorId: 'backend',
      jobDescription: '',
      jobDescriptionSourceUrl: null,
      jdAnalysisId: null,
      presetId: null,
      resumeVariant: '',
      resumeGeneration: null,
      positioning: 'backend',
      skillMatch: 'Strong platform fit',
      nextStep: 'Review opportunity and tailor resume',
      notes: 'Risks:\n- Smaller team',
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
      research: {
        status: 'seeded',
        summary: 'Strong platform fit · Risks: Smaller team',
        jobDescriptionSummary: '',
        interviewSignals: [],
        people: [],
        sources: [
          {
            label: 'Acme Corp job posting',
            url: 'https://example.com/jobs/1',
            kind: 'job-posting',
          },
          {
            label: 'Search result via greenhouse',
            kind: 'search-result',
          },
        ],
        searchQueries: [],
        lastInvestigatedAt: '',
      },
    })

    expect(
      createPipelineEntryDraft(
        {
          ...searchResult,
          jobDescription:
            '  Own platform reliability, developer experience, and release automation.  ',
          jobDescriptionSourceUrl: 'https://example.com/jobs/1',
        },
        'backend',
      ),
    ).toMatchObject({
      jobDescription: 'Own platform reliability, developer experience, and release automation.',
      jobDescriptionSourceUrl: 'https://example.com/jobs/1',
      jdAnalysisId: null,
    })

    const unprovenancedDraft = createPipelineEntryDraft(
      {
        ...searchResult,
        jobDescription: 'Source URL did not validate, so research text should be dropped.',
        jobDescriptionSourceUrl: 'https://other.example/jobs/1',
      },
      'backend',
    )
    expect(unprovenancedDraft?.jobDescription).toBe('')
    expect(unprovenancedDraft?.jobDescriptionSourceUrl).toBeNull()

    expect(
      createPipelineEntryDraft(
        {
          ...searchResult,
          jobDescription: 'Same-origin job text should be retained.',
          jobDescriptionSourceUrl: 'HTTPS://example.com/jobs/1?utm=search#details',
        },
        'backend',
      ),
    ).toMatchObject({
      jobDescription: 'Same-origin job text should be retained.',
      jobDescriptionSourceUrl: 'https://example.com/jobs/1?utm=search#details',
    })
    expect(
      createPipelineEntryDraft(
        {
          ...searchResult,
          jobDescription: 'Different paths on the same origin are accepted as provenance.',
          jobDescriptionSourceUrl: 'https://example.com/jobs/12',
        },
        'backend',
      )?.jobDescription,
    ).toBe('Different paths on the same origin are accepted as provenance.')
    expect(
      createPipelineEntryDraft(
        {
          ...searchResult,
          jobDescription: 'Protocol mismatch should be dropped.',
          jobDescriptionSourceUrl: 'http://example.com/jobs/1',
        },
        'backend',
      )?.jobDescription,
    ).toBe('')
    for (const sourceUrl of [
      'not a url',
      '',
      'javascript:alert(1)',
      'data:text/plain,foo',
      '//example.com/jobs/1',
    ]) {
      const draft = createPipelineEntryDraft(
        {
          ...searchResult,
          jobDescription: 'Malformed provenance should be dropped without throwing.',
          jobDescriptionSourceUrl: sourceUrl,
        },
        'backend',
      )
      expect(draft?.jobDescription).toBe('')
      expect(draft?.jobDescriptionSourceUrl).toBeNull()
    }
    expect(
      createPipelineEntryDraft(
        {
          ...searchResult,
          jobDescription: 'Default https port should match provenance.',
          jobDescriptionSourceUrl: 'https://example.com:443/jobs/1',
        },
        'backend',
      )?.jobDescription,
    ).toBe('Default https port should match provenance.')
    expect(
      createPipelineEntryDraft(
        {
          ...searchResult,
          jobDescription: 'Credentials in source URL should not change origin provenance.',
          jobDescriptionSourceUrl: 'https://user:pw@example.com/jobs/1',
        },
        'backend',
      )?.jobDescription,
    ).toBe('Credentials in source URL should not change origin provenance.')

    expect(
      createPipelineEntryDraft(
        { ...searchResult, tier: 4 as unknown as SearchResultEntry['tier'] },
        'backend',
      ),
    ).toBeNull()

    expect(
      createPipelineEntryDraft({ ...searchResult, estimatedComp: undefined, risks: [] }, '', {
        searchQueries: ['Acme staff engineer remote'],
      }),
    ).toMatchObject({
      comp: '',
      notes: '',
      vectorId: null,
      research: {
        status: 'seeded',
        searchQueries: ['Acme staff engineer remote'],
      },
    })
    expect(
      createPipelineEntryDraft({ ...searchResult, source: 'lever', risks: [] }, 'backend')?.research
        ?.sources[1]?.label,
    ).toBe('Search result via lever')

    const multiRiskDraft = createPipelineEntryDraft(
      {
        ...searchResult,
        risks: ['Smaller team', 'Heavy on-call rotation', 'Comp band unclear'],
      },
      'backend',
    )
    expect(multiRiskDraft?.notes).toContain(
      'Risks:\n- Smaller team\n- Heavy on-call rotation\n- Comp band unclear',
    )

    const partialIntelDraft = createPipelineEntryDraft(
      {
        ...searchResult,
        companyIntel: {
          stage: 'seed',
          aiCulture: '',
          remotePolicy: '',
        },
        risks: [],
      },
      'backend',
    )
    expect(partialIntelDraft?.notes).toBe('Stage: seed')
    expect(partialIntelDraft?.notes).not.toContain('AI culture:')
    expect(partialIntelDraft?.notes).not.toContain('Remote policy:')
    expect(partialIntelDraft?.notes).not.toContain('Open roles:')

    const zeroOpenRolesDraft = createPipelineEntryDraft(
      {
        ...searchResult,
        companyIntel: {
          stage: '',
          aiCulture: '',
          remotePolicy: '',
          openRoleCount: 0,
        },
        risks: [],
      },
      'backend',
    )
    expect(zeroOpenRolesDraft?.notes).toBe('')

    expect(
      createPipelineEntryDraft(
        { ...searchResult, matchReason: '', risks: ['Comp unclear'] },
        'backend',
      )?.research?.summary,
    ).toBe('Risks: Comp unclear')
  })

  it('maps search results into pipeline drafts without mutating the source result', () => {
    const enriched: SearchResultEntry = {
      ...searchResult,
      risks: ['Heavy on-call rotation'],
      companyIntel: {
        stage: 'series B',
        aiCulture: 'AI-augmented dev workflow',
        remotePolicy: 'fully remote',
        openRoleCount: 4,
      },
      interviewProcess: {
        format: 'take-home + system design',
        builderFriendly: true,
        aiToolsAllowed: true,
        estimatedTimeline: '3 weeks',
      },
    }
    const risksRef = enriched.risks
    const intelRef = enriched.companyIntel
    const processRef = enriched.interviewProcess
    const snapshot = structuredClone(enriched)

    createPipelineEntryDraft(enriched, 'backend')

    expect(enriched).toEqual(snapshot)
    expect(enriched.risks).toBe(risksRef)
    expect(enriched.companyIntel).toBe(intelRef)
    expect(enriched.interviewProcess).toBe(processRef)
  })

  it('parses interviewProcess.format phrases into the strict InterviewFormat enum', () => {
    expect(parseInterviewFormatPhrases('take-home + system design + behavioral panel')).toEqual([
      'system-design',
      'take-home',
      'behavioral',
      'peer-panel',
    ])
    expect(parseInterviewFormatPhrases('hr screen, hm chat, technical deep-dive')).toEqual([
      'hr-screen',
      'hm-screen',
      'tech-discussion',
    ])
    expect(parseInterviewFormatPhrases('leetcode + onsite coding')).toEqual([
      'live-coding',
      'leetcode',
    ])
    expect(parseInterviewFormatPhrases('founder chat, presentation')).toEqual([
      'exec',
      'presentation',
    ])
    expect(parseInterviewFormatPhrases('System Design + LEETCODE')).toEqual([
      'system-design',
      'leetcode',
    ])
    expect(parseInterviewFormatPhrases('system design + system design')).toEqual(['system-design'])
    expect(parseInterviewFormatPhrases('system design; leetcode and onsite coding')).toEqual([
      'system-design',
      'live-coding',
      'leetcode',
    ])
    expect(parseInterviewFormatPhrases('mystery process')).toEqual([])
    expect(parseInterviewFormatPhrases('')).toEqual([])
  })

  it('builds interview process signals from enriched fields', () => {
    expect(buildInterviewProcessSignals(undefined)).toEqual([])
    expect(
      buildInterviewProcessSignals({
        format: '',
        builderFriendly: false,
        aiToolsAllowed: false,
      }),
    ).toEqual([])
    expect(
      buildInterviewProcessSignals({
        format: '   ',
        builderFriendly: false,
        aiToolsAllowed: false,
        estimatedTimeline: '   ',
      }),
    ).toEqual([])
    expect(
      buildInterviewProcessSignals({
        format: 'system design',
        builderFriendly: true,
        aiToolsAllowed: false,
        estimatedTimeline: '3 weeks',
      }),
    ).toEqual(['Format: system design', 'Timeline: 3 weeks', 'Builder-friendly process'])
    expect(
      buildInterviewProcessSignals({
        format: '',
        builderFriendly: false,
        aiToolsAllowed: true,
      }),
    ).toEqual(['AI tools allowed during interviews'])
    expect(
      buildInterviewProcessSignals({
        format: '',
        builderFriendly: true,
        aiToolsAllowed: true,
      }),
    ).toEqual(['Builder-friendly process', 'AI tools allowed during interviews'])
  })

  it('maps enriched search result fields onto the pipeline draft', () => {
    const enriched: SearchResultEntry = {
      ...searchResult,
      tier: 1,
      candidateEdge:
        'Built fleet-managed eBPF agents at A10 — direct prior-art for Acme platform team.',
      advantageMatch: 'platform + security + fleet management',
      signalGroup: 'every signal aligns',
      interviewProcess: {
        format: 'take-home + system design + behavioral panel',
        builderFriendly: true,
        aiToolsAllowed: true,
        estimatedTimeline: '3 weeks',
      },
      companyIntel: {
        stage: 'series B',
        aiCulture: 'AI-augmented dev workflow',
        remotePolicy: 'fully remote',
        openRoleCount: 4,
      },
      risks: ['Heavy on-call rotation'],
    }

    const draft = createPipelineEntryDraft(enriched, 'platform')

    expect(draft).toMatchObject({
      tier: '1',
      vectorId: 'platform',
      positioning:
        'Built fleet-managed eBPF agents at A10 — direct prior-art for Acme platform team.',
      skillMatch: 'Strong platform fit\n\nplatform + security + fleet management',
      format: ['system-design', 'take-home', 'behavioral', 'peer-panel'],
    })
    expect(draft?.notes).toContain('Signal group: every signal aligns')
    expect(draft?.notes).toContain('Stage: series B')
    expect(draft?.notes).toContain('AI culture: AI-augmented dev workflow')
    expect(draft?.notes).toContain('Remote policy: fully remote')
    expect(draft?.notes).toContain('Open roles: 4')
    expect(draft?.notes).toContain('Risks:\n- Heavy on-call rotation')
    expect(draft?.research?.summary).toContain('Stage: series B')
    expect(draft?.research?.summary).toContain('AI culture: AI-augmented dev workflow')
    expect(draft?.research?.interviewSignals).toEqual([
      'Format: take-home + system design + behavioral panel',
      'Timeline: 3 weeks',
      'Builder-friendly process',
      'AI tools allowed during interviews',
      'Signal group: every signal aligns',
    ])
  })

  it('falls back to vectorAlignment when candidateEdge is missing or whitespace', () => {
    const draft = createPipelineEntryDraft({ ...searchResult, candidateEdge: '   ' }, 'backend')
    expect(draft?.positioning).toBe('backend')
  })

  it('drops unrecognised format phrases without leaking invalid enum values', () => {
    const draft = createPipelineEntryDraft(
      {
        ...searchResult,
        interviewProcess: {
          format: 'mystery custom assessment',
          builderFriendly: false,
          aiToolsAllowed: false,
        },
      },
      'backend',
    )
    expect(draft?.format).toEqual([])
    // Phrase still surfaces via research.interviewSignals so context isn't lost.
    expect(draft?.research?.interviewSignals).toContain('Format: mystery custom assessment')
  })
})
