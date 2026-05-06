import { describe, expect, it } from 'vitest'
import {
  type AudienceAssignment,
  type TaggedNote,
  effectiveAudiences,
  noteText,
  notesText,
  resolveAudiences,
} from '../types/audience'
import { filterInsights, notesForAudience, projectForAudience } from '../utils/audienceFilter'
import { AUDIENCE_RULES_VERSION, applyRulesBasedAudiences, type JDAnalysisLike } from '../utils/audienceRules'
import type { MatchAssetScore } from '../types/match'

const baseAssignment = (inferred: AudienceAssignment['inferred'] = ['unclassified']): AudienceAssignment => ({
  inferred,
  asserted: null,
})

const taggedAsset = (overrides: Partial<MatchAssetScore> = {}): MatchAssetScore => ({
  kind: 'bullet',
  id: overrides.id ?? 'asset-1',
  label: 'sample',
  sourceLabel: 'Role',
  text: 'sample text',
  tags: [],
  matchedTags: [],
  matchedKeywords: [],
  matchedRequirementIds: [],
  score: overrides.score ?? 0.5,
  audiences: overrides.audiences ?? baseAssignment(),
  ...overrides,
})

const baseAnalysis = (): JDAnalysisLike => ({
  id: 'analysis-1',
  pipelineEntryId: 'pipe-1',
  jdTextHash: 'hash',
  identityVersion: 1,
  modelVersion: 'jd-analysis.v1.match-multipass-sonnet',
  generatedAt: '2026-05-06T00:00:00.000Z',
  updatedAt: '2026-05-06T00:00:00.000Z',
  warnings: [],
  company: 'Acme',
  role: 'Staff Eng',
  summary: '',
  analyzedJobDescription: '',
  jobDescriptionWordCount: 0,
  jobDescriptionTruncated: false,
  requirements: [],
  overallFit: 'strong',
  fitScore: 0.8,
  confidence: 'high',
  recommendation: 'apply',
  oneLineSummary: '',
  rationale: '',
  matchedVectors: [],
  primaryVectorId: null,
  skillMatches: [],
  evidenceMapping: { topBullets: [], topSkills: [], topProjects: [], topProfiles: [], topPhilosophy: [] },
  strengthsToLead: [],
  advantages: [],
  advantageHypotheses: [],
  gaps: [],
  gapFocus: [],
  watchOuts: [],
  triggeredPrioritize: [],
  triggeredAvoid: [],
  relevantAwareness: [],
  positioningRecommendations: [],
  requirementCoverageScore: 0,
  matchedRequirementIds: [],
  matchedKeywords: [],
})

describe('audience module — type helpers', () => {
  it('resolveAudiences picks asserted when non-empty', () => {
    const assignment: AudienceAssignment = { inferred: ['candidate'], asserted: ['recruiter'] }
    expect(resolveAudiences(assignment)).toEqual({ effective: ['recruiter'], source: 'asserted' })
  })

  it('resolveAudiences falls back to inferred when asserted is null', () => {
    const assignment: AudienceAssignment = { inferred: ['candidate'], asserted: null }
    expect(resolveAudiences(assignment)).toEqual({ effective: ['candidate'], source: 'inferred' })
  })

  it('resolveAudiences falls back to inferred when asserted is empty (LLM ran, no override)', () => {
    const assignment: AudienceAssignment = { inferred: ['candidate'], asserted: [] }
    expect(resolveAudiences(assignment)).toEqual({ effective: ['candidate'], source: 'inferred' })
  })

  it('effectiveAudiences is a thin accessor for hot paths', () => {
    expect(effectiveAudiences({ inferred: ['recruiter'], asserted: null })).toEqual(['recruiter'])
  })

  it('noteText/notesText extract text from TaggedNote arrays', () => {
    const notes: TaggedNote[] = [
      { text: 'one', audiences: baseAssignment(['candidate']) },
      { text: 'two', audiences: baseAssignment(['recruiter']) },
    ]
    expect(noteText(notes[0]!)).toBe('one')
    expect(notesText(notes)).toEqual(['one', 'two'])
  })
})

describe('audience module — filter helpers', () => {
  it('filterInsights keeps items whose effective audiences include the requested audience', () => {
    const items = [
      taggedAsset({ id: 'a', audiences: baseAssignment(['recruiter']) }),
      taggedAsset({ id: 'b', audiences: baseAssignment(['candidate']) }),
      taggedAsset({ id: 'c', audiences: baseAssignment(['recruiter', 'candidate']) }),
    ]
    expect(filterInsights(items, 'recruiter').map((i) => i.id)).toEqual(['a', 'c'])
    expect(filterInsights(items, 'candidate').map((i) => i.id)).toEqual(['b', 'c'])
  })

  it('filterInsights respects asserted-overrides-inferred', () => {
    const items = [
      taggedAsset({
        id: 'asserted-recruiter',
        audiences: { inferred: ['candidate'], asserted: ['recruiter'] },
      }),
    ]
    expect(filterInsights(items, 'candidate')).toEqual([])
    expect(filterInsights(items, 'recruiter').map((i) => i.id)).toEqual(['asserted-recruiter'])
  })

  it('"unclassified" sentinel never reaches a production audience by default', () => {
    const items = [taggedAsset({ id: 'orphan', audiences: baseAssignment(['unclassified']) })]
    expect(filterInsights(items, 'recruiter')).toEqual([])
    expect(filterInsights(items, 'candidate')).toEqual([])
    expect(filterInsights(items, 'hiring_manager')).toEqual([])
    expect(filterInsights(items, 'internal')).toEqual([])
  })

  it('notesForAudience filters TaggedNote arrays by audience', () => {
    const notes: TaggedNote[] = [
      { text: 'recruiter-only', audiences: baseAssignment(['recruiter']) },
      { text: 'both', audiences: baseAssignment(['recruiter', 'candidate']) },
      { text: 'candidate-only', audiences: baseAssignment(['candidate']) },
    ]
    expect(notesText(notesForAudience(notes, 'recruiter'))).toEqual(['recruiter-only', 'both'])
  })

  it('projectForAudience filters every tagged array on JDAnalysis to the requested audience', () => {
    const tagged = applyRulesBasedAudiences({
      ...baseAnalysis(),
      gaps: [
        { requirementId: 'r1', label: 'low gap', severity: 'low', reason: '', tags: [], audiences: baseAssignment() },
        { requirementId: 'r2', label: 'high gap', severity: 'high', reason: '', tags: [], audiences: baseAssignment() },
      ],
      evidenceMapping: {
        topBullets: [taggedAsset({ id: 'asset-strong', score: 0.9 })],
        topSkills: [],
        topProjects: [],
        topProfiles: [],
        topPhilosophy: [],
      },
    })

    const recruiterView = projectForAudience(tagged, 'recruiter')
    // High-severity gap was promoted to recruiter; low-severity was not.
    expect(recruiterView.gaps.map((g) => g.label)).toEqual(['high gap'])
    // Strong-score evidence stays in the recruiter projection.
    expect(recruiterView.evidenceMapping.topBullets.map((b) => b.id)).toEqual(['asset-strong'])
    expect(recruiterView.audience).toBe('recruiter')

    const candidateView = projectForAudience(tagged, 'candidate')
    // Both gaps reach the candidate (gap default + high-severity overlap).
    expect(candidateView.gaps.map((g) => g.label).sort()).toEqual(['high gap', 'low gap'])
  })

  it('projectForAudience preserves untagged arrays (defense for partial fixtures)', () => {
    // matchedKeywords is a string[] field — should pass through unchanged.
    const analysis = applyRulesBasedAudiences(baseAnalysis())
    const projection = projectForAudience(analysis, 'recruiter')
    expect(projection.matchedKeywords).toEqual([])
  })
})

describe('audienceRules — applyRulesBasedAudiences', () => {
  it('stamps the rules version on a fresh analysis', () => {
    const analysis = applyRulesBasedAudiences(baseAnalysis())
    expect(analysis.audienceRulesVersion).toBe(AUDIENCE_RULES_VERSION)
  })

  it('is idempotent on same-version input (returns input unchanged)', () => {
    const analysis = applyRulesBasedAudiences(baseAnalysis())
    const second = applyRulesBasedAudiences(analysis as JDAnalysisLike)
    expect(second).toBe(analysis)
  })

  it('re-applies when version matches but TaggedNote fields are still string[] (TASK-226)', () => {
    // Reproducer: a JDAnalysis can be stamped at the current rules version
    // and still carry legacy string[] notes if a sanitize path trimmed
    // strings before the rules engine ran. Stamp-only checking would
    // short-circuit here and leak the type lie. The shape-aware guard must
    // detect the mismatch and re-apply rules.
    const stale = {
      ...applyRulesBasedAudiences(baseAnalysis()),
      // Type lie: claim current version, but warnings is string[].
      warnings: ['legacy string'] as unknown as TaggedNote[],
    }

    const refreshed = applyRulesBasedAudiences(stale as JDAnalysisLike)

    expect(refreshed.warnings).toEqual([
      { text: 'legacy string', audiences: { inferred: ['internal'], asserted: null } },
    ])
  })

  it('re-applies rules when audienceRulesVersion is missing or stale', () => {
    const stale = { ...applyRulesBasedAudiences(baseAnalysis()), audienceRulesVersion: 'audience-rules.v0' }
    const refreshed = applyRulesBasedAudiences(stale as JDAnalysisLike)
    expect(refreshed.audienceRulesVersion).toBe(AUDIENCE_RULES_VERSION)
  })

  it('preserves LLM-asserted tags across re-application', () => {
    const tagged = applyRulesBasedAudiences({
      ...baseAnalysis(),
      gaps: [
        {
          requirementId: 'r1',
          label: 'x',
          severity: 'low',
          reason: '',
          tags: [],
          audiences: { inferred: ['candidate'], asserted: ['recruiter', 'hiring_manager'] },
        },
      ],
    })
    const stale = { ...tagged, audienceRulesVersion: 'audience-rules.v0' }
    const refreshed = applyRulesBasedAudiences(stale as JDAnalysisLike)
    expect(refreshed.gaps[0]!.audiences.asserted).toEqual(['recruiter', 'hiring_manager'])
  })

  it('promotes high-severity gaps to recruiter audience', () => {
    const analysis = applyRulesBasedAudiences({
      ...baseAnalysis(),
      gaps: [
        {
          requirementId: 'r1',
          label: 'severe',
          severity: 'high',
          reason: '',
          tags: [],
          audiences: baseAssignment(),
        },
      ],
    })
    expect(effectiveAudiences(analysis.gaps[0]!.audiences).sort()).toEqual(['candidate', 'recruiter'])
  })

  it('strips recruiter/HM from negative skill matches', () => {
    const analysis = applyRulesBasedAudiences({
      ...baseAnalysis(),
      skillMatches: [
        {
          skillName: 'X',
          jdRequirement: '',
          requirementStrength: 'preferred',
          userDepth: 'basic',
          userPositioning: '',
          matchQuality: 'negative',
          presentationGuidance: '',
          audiences: baseAssignment(),
        },
      ],
    })
    const audiences = effectiveAudiences(analysis.skillMatches[0]!.audiences)
    expect(audiences).toContain('candidate')
    expect(audiences).not.toContain('recruiter')
    expect(audiences).not.toContain('hiring_manager')
  })

  it('upgrades string[] inputs to TaggedNote[] with default audiences', () => {
    const analysis = applyRulesBasedAudiences({
      ...baseAnalysis(),
      positioningRecommendations: ['Lead with platform work'] as unknown as string[],
      warnings: ['JD truncated'] as unknown as string[],
    })
    expect(analysis.positioningRecommendations[0]).toMatchObject({
      text: 'Lead with platform work',
      audiences: { inferred: expect.arrayContaining(['candidate', 'recruiter']), asserted: null },
    })
    expect(analysis.warnings[0]).toMatchObject({
      text: 'JD truncated',
      audiences: { inferred: ['internal'], asserted: null },
    })
  })
})
