import { describe, expect, it } from 'vitest'
import type { ResumeData } from '../types'
import type { JDAnalysis } from '../types/jdAnalysis'
import { untagged, untaggedNote } from '../types/audience'
import { buildProjectionFromJDAnalysis } from '../utils/buildProjection'

const resumeData: ResumeData = {
  version: 3,
  meta: {
    name: 'Jane Smith',
    email: 'jane@example.com',
    phone: '',
    location: '',
    links: [],
  },
  vectors: [
    { id: 'backend', label: 'Backend Engineering', color: '#2563EB' },
    { id: 'platform', label: 'Platform / DevEx', color: '#0D9488' },
  ],
  target_lines: [],
  profiles: [],
  skill_groups: [],
  roles: [
    {
      id: 'role-1',
      company: 'ExampleCo',
      title: 'Staff Engineer',
      dates: '2020-present',
      vectors: { backend: 'include', platform: 'include' },
      bullets: [
        {
          id: 'bullet-1',
          text: 'Built Kubernetes deployment tooling.',
          vectors: { platform: 'include' },
        },
        {
          id: 'bullet-2',
          text: 'Led backend reliability work.',
          vectors: { backend: 'include' },
        },
      ],
    },
  ],
  projects: [],
  education: [],
  certifications: [],
}

const jdAnalysis: JDAnalysis = {
  id: 'analysis-1',
  pipelineEntryId: 'pipe-1',
  jdTextHash: 'abc123',
  identityVersion: 7,
  modelVersion: 'jd-analysis.v1.test',
  audienceRulesVersion: 'audience-rules.v1',
  generatedAt: '2026-04-30T12:00:00.000Z',
  updatedAt: '2026-04-30T12:00:00.000Z',
  warnings: [],
  company: 'Atlas',
  role: 'Staff Platform Engineer',
  summary: 'Platform-heavy role.',
  analyzedJobDescription: 'Own deployment platforms.',
  jobDescriptionWordCount: 3,
  jobDescriptionTruncated: false,
  requirements: [],
  overallFit: 'strong',
  fitScore: 0.87,
  confidence: 'high',
  recommendation: 'apply',
  oneLineSummary: 'Lead with platform delivery.',
  rationale: 'Platform evidence is the strongest match.',
  matchedVectors: [
    untagged({
      vectorId: 'platform',
      title: 'Platform / DevEx',
      priority: 'high',
      matchStrength: 'strong',
      evidence: ['Own deployment platforms.'],
      thesisApplies: true,
      thesisFitExplanation: 'The role asks for platform ownership.',
    }),
    untagged({
      vectorId: 'missing-vector',
      title: 'Missing',
      priority: 'low',
      matchStrength: 'weak',
      evidence: [],
      thesisApplies: false,
      thesisFitExplanation: '',
    }),
  ],
  primaryVectorId: 'platform',
  skillMatches: [
    untagged({
      skillName: 'Kubernetes',
      jdRequirement: 'Own deployment platforms.',
      requirementStrength: 'required',
      userDepth: 'strong',
      userPositioning: 'Lead with Kubernetes work.',
      matchQuality: 'strong',
      presentationGuidance: 'Mention Kubernetes early.',
    }),
    untagged({
      skillName: 'Terraform',
      jdRequirement: 'Own infrastructure as code.',
      requirementStrength: 'preferred',
      userDepth: 'basic',
      userPositioning: 'Add only if true.',
      matchQuality: 'weak',
      presentationGuidance: 'Treat as a gap.',
    }),
  ],
  evidenceMapping: {
    topBullets: [
      untagged({
        kind: 'bullet',
        id: 'bullet-1',
        label: 'Kubernetes deployment tooling',
        sourceLabel: 'ExampleCo',
        text: 'Built Kubernetes deployment tooling.',
        tags: ['platform'],
        matchedTags: ['platform'],
        matchedKeywords: ['Kubernetes'],
        matchedRequirementIds: ['req-1'],
        score: 0.92,
      }),
      untagged({
        kind: 'bullet',
        id: 'unknown-bullet',
        label: 'Unknown',
        sourceLabel: 'Unknown',
        text: 'Not in the current resume store.',
        tags: [],
        matchedTags: [],
        matchedKeywords: [],
        matchedRequirementIds: [],
        score: 0.6,
      }),
    ],
    topSkills: [],
    topProjects: [],
    topProfiles: [],
    topPhilosophy: [],
  },
  strengthsToLead: [untaggedNote('Kubernetes')],
  advantages: [],
  advantageHypotheses: [],
  gaps: [
    untagged({
      requirementId: 'req-2',
      label: 'Terraform',
      severity: 'medium',
      reason: 'Terraform evidence is light.',
      tags: ['terraform'],
    }),
  ],
  gapFocus: [untaggedNote('Infrastructure as code')],
  watchOuts: [],
  triggeredPrioritize: [],
  triggeredAvoid: [],
  relevantAwareness: [],
  positioningRecommendations: [untaggedNote('Lead with platform delivery.'), untaggedNote('Tie Kubernetes to developer velocity.')],
  requirementCoverageScore: 0.8,
  matchedRequirementIds: ['req-1'],
  matchedKeywords: ['Kubernetes', 'platform'],
}

describe('buildProjectionFromJDAnalysis', () => {
  it('maps canonical JD analysis into the legacy Build projection shape', () => {
    const projection = buildProjectionFromJDAnalysis(jdAnalysis, resumeData)

    expect(projection.primary_vector).toBe('platform')
    expect(projection.suggested_vectors).toEqual(['platform'])
    expect(projection.suggested_target_line).toBe('Lead with platform delivery.')
    expect(projection.suggested_variables).toEqual({
      company: 'Atlas',
      role: 'Staff Platform Engineer',
    })
    expect(projection.bullet_adjustments).toEqual([
      {
        bullet_id: 'bullet-1',
        recommended_priority: 'include',
        reason: 'Kubernetes deployment tooling is relevant to this role. Matches Kubernetes.',
      },
    ])
    expect(projection.skill_gaps).toEqual(['Infrastructure as code', 'Terraform'])
    expect(projection.matched_keywords).toEqual(['Kubernetes', 'platform'])
    expect(projection.positioning_note).toContain('Tie Kubernetes to developer velocity.')
    expect(projection.vector_strategy).toContain('Platform / DevEx: strong')
  })

  it('falls back to the first resume vector when analysis vectors are stale', () => {
    const projection = buildProjectionFromJDAnalysis(
      {
        ...jdAnalysis,
        primaryVectorId: 'missing-vector',
        matchedVectors: jdAnalysis.matchedVectors.filter((vector) => vector.vectorId === 'missing-vector'),
      },
      resumeData,
    )

    expect(projection.primary_vector).toBe('backend')
    expect(projection.suggested_vectors).toEqual(['backend'])
  })
})
