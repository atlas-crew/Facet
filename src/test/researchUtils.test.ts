import { describe, expect, it } from 'vitest'
import type { SearchProfile, SearchRequestMaxResults, SearchResultEntry } from '../types/search'
import {
  buildRequestDraft,
  createPipelineEntryDraft,
  emptyProfile,
  groupByTier,
  joinTags,
  normalizeMaxResults,
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
        { vectorId: 'platform', priority: 3, description: '', targetRoleTitles: [], searchKeywords: [] },
        { vectorId: 'backend', priority: 2, description: '', targetRoleTitles: [], searchKeywords: [] },
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
      presetId: null,
      resumeVariant: '',
      positioning: 'backend',
      skillMatch: 'Strong platform fit',
      nextStep: 'Review opportunity and tailor resume',
      notes: 'Smaller team',
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
    })

    expect(
      createPipelineEntryDraft(
        { ...searchResult, tier: 4 as unknown as SearchResultEntry['tier'] },
        'backend',
      ),
    ).toBeNull()

    expect(createPipelineEntryDraft({ ...searchResult, estimatedComp: undefined, risks: [] }, '')).toMatchObject({
      comp: '',
      notes: '',
      vectorId: null,
    })
  })
})
