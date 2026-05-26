import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  type AudienceAssignment,
  type TaggedNote,
  effectiveAudiences,
  noteText,
  notesText,
  resolveAudiences,
} from '../types/audience'
import {
  buildUnclassifiedAudienceSummary,
  filterInsights,
  formatAudienceLabel,
  notesForAudience,
  projectForAudience,
  setAudienceOverrideForInsight,
  type UnclassifiedAudienceInsight,
} from '../utils/audienceFilter'
import {
  AUDIENCE_RULES_VERSION,
  applyRulesBasedAudiences,
  type JDAnalysisLike,
} from '../utils/audienceRules'
import type { JDAnalysis } from '../types/jdAnalysis'
import type { MatchAssetScore } from '../types/match'

const baseAssignment = (
  inferred: AudienceAssignment['inferred'] = ['unclassified'],
): AudienceAssignment => ({
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
  evidenceMapping: {
    topBullets: [],
    topSkills: [],
    topProjects: [],
    topProfiles: [],
    topPhilosophy: [],
  },
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

afterEach(() => {
  vi.restoreAllMocks()
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
  it('formatAudienceLabel normalizes audience and collection labels', () => {
    expect(formatAudienceLabel('requirements')).toBe('Requirements')
    expect(formatAudienceLabel('evidenceMapping.topBullets')).toBe('Evidence Mapping Top Bullets')
    expect(formatAudienceLabel('hiring_manager')).toBe('Hiring Manager')
    expect(formatAudienceLabel('foo_bar-baz')).toBe('Foo Bar Baz')
  })

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
        {
          requirementId: 'r1',
          label: 'low gap',
          severity: 'low',
          reason: '',
          tags: [],
          audiences: baseAssignment(),
        },
        {
          requirementId: 'r2',
          label: 'high gap',
          severity: 'high',
          reason: '',
          tags: [],
          audiences: baseAssignment(),
        },
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

  it('projectForAudience exposes unclassified counts and insight metadata', () => {
    const analysis: JDAnalysis = {
      ...applyRulesBasedAudiences(baseAnalysis()),
      requirements: [
        {
          id: 'req-platform',
          label: 'Platform ownership',
          priority: 'core',
          evidence: 'Owns distributed systems.',
          tags: [],
          keywords: [],
          coverageScore: 0.4,
          matchedAssetCount: 0,
          matchedTags: [],
          audiences: { inferred: ['recruiter'], asserted: ['unclassified'] },
        },
      ],
      strengthsToLead: [
        {
          text: 'Lead with platform migration work.',
          audiences: baseAssignment(['candidate']),
        },
      ],
      evidenceMapping: {
        topBullets: [
          taggedAsset({ id: 'orphan-proof', audiences: baseAssignment(['unclassified']) }),
        ],
        topSkills: [],
        topProjects: [],
        topProfiles: [],
        topPhilosophy: [],
      },
    }

    const projection = projectForAudience(analysis, 'candidate')

    expect(projection.requirements).toEqual([])
    expect(projection.evidenceMapping.topBullets).toEqual([])
    expect(projection.strengthsToLead.map((note) => note.text)).toEqual([
      'Lead with platform migration work.',
    ])
    expect(projection.unclassifiedCount).toBe(2)
    expect(projection.unclassifiedTotal).toBe(3)
    expect(projection.unclassifiedRatio).toBeCloseTo(2 / 3)
    expect(projection.unclassifiedInsights.map((insight) => insight.collection)).toEqual([
      'requirements',
      'evidenceMapping.topBullets',
    ])
    expect(projection.unclassifiedInsights[0]).toMatchObject({
      key: 'analysis-1:requirements:0',
      analysisId: 'analysis-1',
      analysisLabel: 'Acme - Staff Eng',
      index: 0,
      label: 'Requirements: Platform ownership',
      text: 'Owns distributed systems.',
    })
  })

  it('buildUnclassifiedAudienceSummary uses fallback fields for sparse insight labels', () => {
    const analysis: JDAnalysis = {
      ...applyRulesBasedAudiences(baseAnalysis()),
      warnings: [
        {
          text: '   ',
          audiences: baseAssignment(['unclassified']),
        },
      ],
      skillMatches: [
        {
          skillName: 'Rust',
          jdRequirement: '',
          requirementStrength: 'preferred',
          userDepth: 'strong',
          userPositioning: '',
          matchQuality: 'strong',
          presentationGuidance: 'Position Rust as systems ownership.',
          audiences: baseAssignment(['unclassified']),
        },
      ],
    }

    const summary = buildUnclassifiedAudienceSummary(analysis)

    expect(summary.totalTaggedCount).toBe(2)
    expect(summary.unclassifiedRatio).toBe(1)
    expect(summary.insights).toEqual([
      expect.objectContaining({
        label: 'Warnings: Unclassified insight',
        text: 'Unclassified insight',
      }),
      expect.objectContaining({
        label: 'Skill Matches: Rust',
        text: 'Position Rust as systems ownership.',
      }),
    ])
  })

  it('warns once in dev when unclassified insights exceed the review threshold', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const analysis: JDAnalysis = {
      ...applyRulesBasedAudiences({
        ...baseAnalysis(),
        id: 'analysis-warn-threshold',
        updatedAt: '2026-05-06T00:00:01.000Z',
      }),
      warnings: [
        {
          text: 'Unrouted warning.',
          audiences: baseAssignment(['unclassified']),
        },
      ],
    }

    projectForAudience(analysis, 'candidate')
    projectForAudience(analysis, 'candidate')

    expect(warnSpy).toHaveBeenCalledTimes(import.meta.env.DEV ? 1 : 0)
    if (import.meta.env.DEV) {
      expect(warnSpy.mock.calls[0]?.[0]).toContain('unclassified')
      expect(warnSpy.mock.calls[0]?.[1]).toMatchObject({
        analysisId: 'analysis-warn-threshold',
        audience: 'candidate',
        unclassifiedCount: 1,
      })
    }
  })

  it('does not warn when unclassified insight ratio is at the threshold', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const analysis: JDAnalysis = {
      ...applyRulesBasedAudiences({
        ...baseAnalysis(),
        id: 'analysis-warn-boundary',
        updatedAt: '2026-05-06T00:00:02.000Z',
      }),
      warnings: [
        {
          text: 'One unclassified warning.',
          audiences: baseAssignment(['unclassified']),
        },
      ],
      strengthsToLead: Array.from({ length: 9 }, (_, index) => ({
        text: `Candidate note ${index + 1}`,
        audiences: baseAssignment(['candidate']),
      })),
    }

    projectForAudience(analysis, 'candidate')

    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('warns again for a different audience or updated analysis snapshot', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const analysis: JDAnalysis = {
      ...applyRulesBasedAudiences({
        ...baseAnalysis(),
        id: 'analysis-warn-keying',
        updatedAt: '2026-05-06T00:00:03.000Z',
      }),
      warnings: [
        {
          text: 'Unrouted warning.',
          audiences: baseAssignment(['unclassified']),
        },
      ],
    }

    projectForAudience(analysis, 'candidate')
    projectForAudience(analysis, 'recruiter')
    projectForAudience({ ...analysis, updatedAt: '2026-05-06T00:00:04.000Z' }, 'candidate')

    expect(warnSpy).toHaveBeenCalledTimes(import.meta.env.DEV ? 3 : 0)
  })

  it('evicts old dev warning keys after the warning cache limit', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const protectedAnalysis: JDAnalysis = {
      ...applyRulesBasedAudiences({
        ...baseAnalysis(),
        id: 'analysis-warning-lru-0',
        updatedAt: '2026-05-06T00:01:00.000Z',
      }),
      warnings: [{ text: 'Unrouted warning 0.', audiences: baseAssignment(['unclassified']) }],
    }

    projectForAudience(protectedAnalysis, 'candidate')
    for (let index = 1; index <= 199; index += 1) {
      projectForAudience(
        {
          ...protectedAnalysis,
          id: `analysis-warning-lru-${index}`,
          updatedAt: `2026-05-06T00:01:${String(index).padStart(2, '0')}.000Z`,
          warnings: [
            {
              text: `Unrouted warning ${index}.`,
              audiences: baseAssignment(['unclassified']),
            },
          ],
        },
        'candidate',
      )
    }
    const callsAtCapacity = warnSpy.mock.calls.length
    projectForAudience(protectedAnalysis, 'candidate')
    expect(warnSpy).toHaveBeenCalledTimes(callsAtCapacity)

    projectForAudience(
      {
        ...protectedAnalysis,
        id: 'analysis-warning-lru-200',
        updatedAt: '2026-05-06T00:01:200.000Z',
        warnings: [{ text: 'Unrouted warning 200.', audiences: baseAssignment(['unclassified']) }],
      },
      'candidate',
    )
    const callsAfterEviction = warnSpy.mock.calls.length
    expect(callsAfterEviction).toBe(callsAtCapacity + (import.meta.env.DEV ? 1 : 0))

    projectForAudience(protectedAnalysis, 'candidate')
    expect(warnSpy).toHaveBeenCalledTimes(callsAfterEviction + (import.meta.env.DEV ? 1 : 0))
  })

  it('caches unclassified summaries until the analysis update stamp changes', () => {
    const analysis: JDAnalysis = {
      ...applyRulesBasedAudiences({
        ...baseAnalysis(),
        id: 'analysis-summary-cache',
        updatedAt: '2026-05-06T00:02:00.000Z',
      }),
      warnings: [{ text: 'First warning.', audiences: baseAssignment(['unclassified']) }],
    }

    const first = buildUnclassifiedAudienceSummary(analysis)
    expect(buildUnclassifiedAudienceSummary(analysis)).toBe(first)

    analysis.updatedAt = '2026-05-06T00:02:01.000Z'
    analysis.warnings = [
      ...analysis.warnings,
      { text: 'Second warning.', audiences: baseAssignment(['unclassified']) },
    ]

    const second = buildUnclassifiedAudienceSummary(analysis)
    expect(second).not.toBe(first)
    expect(second.unclassifiedCount).toBe(2)
  })

  it('applies manual audience overrides for unclassified insight review', () => {
    const analysis: JDAnalysis = {
      ...applyRulesBasedAudiences(baseAnalysis()),
      warnings: [
        {
          text: 'Needs manual routing.',
          audiences: { inferred: ['internal'], asserted: ['recruiter', 'unclassified'] },
        },
      ],
    }
    const insight = buildUnclassifiedAudienceSummary(analysis).insights[0]!

    const updated = setAudienceOverrideForInsight(analysis, insight, 'candidate')

    expect(updated.warnings[0]!.audiences.asserted).toEqual(['recruiter', 'candidate'])
    expect(projectForAudience(updated, 'candidate').warnings.map((note) => note.text)).toEqual([
      'Needs manual routing.',
    ])

    const inferredOnlyAnalysis: JDAnalysis = {
      ...analysis,
      id: 'analysis-inferred-unclassified',
      warnings: [
        {
          text: 'Only inferred unclassified.',
          audiences: baseAssignment(['unclassified']),
        },
      ],
    }
    const inferredOnlyInsight = buildUnclassifiedAudienceSummary(inferredOnlyAnalysis).insights[0]!
    const updatedInferredOnly = setAudienceOverrideForInsight(
      inferredOnlyAnalysis,
      inferredOnlyInsight,
      'candidate',
    )
    expect(updatedInferredOnly.warnings[0]!.audiences.asserted).toEqual(['candidate'])

    const evidenceAnalysis: JDAnalysis = {
      ...analysis,
      id: 'analysis-evidence-override',
      evidenceMapping: {
        ...analysis.evidenceMapping,
        topBullets: [
          taggedAsset({ id: 'orphan-proof', audiences: baseAssignment(['unclassified']) }),
        ],
      },
      warnings: [],
    }
    const evidenceInsight = buildUnclassifiedAudienceSummary(evidenceAnalysis).insights[0]!
    const updatedEvidence = setAudienceOverrideForInsight(
      evidenceAnalysis,
      evidenceInsight,
      'candidate',
    )
    expect(updatedEvidence.evidenceMapping.topBullets[0]!.audiences.asserted).toEqual(['candidate'])
    expect(
      projectForAudience(updatedEvidence, 'candidate').evidenceMapping.topBullets.map(
        (asset) => asset.id,
      ),
    ).toEqual(['orphan-proof'])

    const duplicateAudienceAnalysis: JDAnalysis = {
      ...analysis,
      id: 'analysis-duplicate-audience',
      warnings: [
        {
          text: 'Already candidate tagged.',
          audiences: { inferred: ['internal'], asserted: ['candidate', 'unclassified'] },
        },
      ],
    }
    const duplicateAudienceInsight =
      buildUnclassifiedAudienceSummary(duplicateAudienceAnalysis).insights[0]!
    const updatedDuplicateAudience = setAudienceOverrideForInsight(
      duplicateAudienceAnalysis,
      duplicateAudienceInsight,
      'candidate',
    )
    expect(updatedDuplicateAudience.warnings[0]!.audiences.asserted).toEqual(['candidate'])

    const badInsight: UnclassifiedAudienceInsight = {
      ...duplicateAudienceInsight,
      collection: 'summary' as UnclassifiedAudienceInsight['collection'],
    }
    expect(setAudienceOverrideForInsight(duplicateAudienceAnalysis, badInsight, 'candidate')).toBe(
      duplicateAudienceAnalysis,
    )
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
    const stale = {
      ...applyRulesBasedAudiences(baseAnalysis()),
      audienceRulesVersion: 'audience-rules.v0',
    }
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
    expect(effectiveAudiences(analysis.gaps[0]!.audiences).sort()).toEqual([
      'candidate',
      'recruiter',
    ])
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
