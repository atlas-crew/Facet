import { describe, expect, it } from 'vitest'
import type { SearchProfile, SearchRequestMaxResults, SearchResultEntry } from '../types/search'
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
    expect(joinTags(['alpha', 'beta'])).toBe('alpha, beta')
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
  })

  it('builds a request draft from the top two priority vectors', () => {
    expect(buildRequestDraft(baseProfile)).toEqual({
      focusVectors: ['backend', 'security'],
      companySizeOverride: '',
      salaryAnchorOverride: '$250k',
      geoExpand: true,
      customKeywords: '',
      maxResults: { tier1: 5, tier2: 10, tier3: 10 },
    })

    expect(buildRequestDraft(null).focusVectors).toEqual([])

    const singleVectorProfile: SearchProfile = {
      ...baseProfile,
      vectors: [baseProfile.vectors[0]!],
    }
    const originalOrder = baseProfile.vectors.map((vector) => vector.vectorId)
    expect(buildRequestDraft(singleVectorProfile).focusVectors).toEqual(['platform'])
    expect(baseProfile.vectors.map((vector) => vector.vectorId)).toEqual(originalOrder)
  })

  it('prefers thesis searchOverrides over profile constraints when building a request draft', () => {
    const draftFromThesis = buildRequestDraft(baseProfile, {
      constraints: {
        compensation: '$340k total',
        locations: ['Tampa Bay'],
        clearance: '',
        companySize: 'growth',
      },
    })

    expect(draftFromThesis.salaryAnchorOverride).toBe('$340k total')
    expect(draftFromThesis.companySizeOverride).toBe('growth')

    // When the override compensation is empty/whitespace, fall back to profile.
    const draftWithEmptyOverride = buildRequestDraft(baseProfile, {
      constraints: {
        compensation: '   ',
        locations: [],
        clearance: '',
        companySize: '',
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

    const clamped = normalizeMaxResults(maxResults, 'tier1', '0')
    expect(clamped.tier1).toBe(1)
    expect(clamped.tier2).toBe(10)
    expect(clamped.tier3).toBe(15)
    expect(normalizeMaxResults(maxResults, 'tier2', '-5').tier2).toBe(1)
    expect(normalizeMaxResults(maxResults, 'tier3', 'abc').tier3).toBe(15)
  })

  it('maps search results into pipeline drafts and rejects unsupported tiers', () => {
    expect(toPipelineTier(1)).toBe('1')
    expect(toPipelineTier(2)).toBe('2')
    expect(toPipelineTier(3)).toBe('3')
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
    expect(parseInterviewFormatPhrases('mystery process')).toEqual([])
    expect(parseInterviewFormatPhrases('')).toEqual([])
  })

  it('builds interview process signals from enriched fields', () => {
    expect(buildInterviewProcessSignals(undefined)).toEqual([])
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
