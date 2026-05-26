import { describe, expect, it } from 'vitest'
import type { ResumeData } from '../types'
import type { JDAnalysis } from '../types/jdAnalysis'
import { type AudienceAssignment, type AudienceTag, untagged, untaggedNote } from '../types/audience'
import { applyRulesBasedAudiences } from '../utils/audienceRules'
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

const jdAnalysis: JDAnalysis = applyRulesBasedAudiences({
  id: 'analysis-1',
  pipelineEntryId: 'pipe-1',
  jdTextHash: 'abc123',
  identityVersion: 7,
  modelVersion: 'jd-analysis.v1.test',
  audienceRulesVersion: 'audience-rules.v1',
  generatedAt: '2026-04-30T12:00:00.000Z',
  updatedAt: '2026-04-30T12:00:00.000Z',
  warnings: [
    untaggedNote('Parser confidence is low for this JD section.'),
    untaggedNote('Parser confidence is low for this JD section.'),
  ],
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
  watchOuts: [
    untagged({
      type: 'filter_risk',
      referenceId: 'watch-hard',
      description: 'JD contains a hard filter that needs internal review.',
      severity: 'hard',
      suggestedAction: 'Confirm before assembling the resume.',
    }),
    untagged({
      type: 'filter_risk',
      referenceId: 'watch-soft',
      description: 'Candidate-facing prep concern.',
      severity: 'soft',
      suggestedAction: 'Discuss during interview prep.',
    }),
  ],
  triggeredPrioritize: [
    untagged({
      filterId: 'filter-platform',
      label: 'Platform-heavy role',
      weight: 'high',
      jdEvidence: 'Own deployment platforms.',
    }),
    untagged({
      filterId: 'filter-evidence-light',
      label: 'Evidence-light filter',
      weight: 'medium',
      jdEvidence: '',
    }),
  ],
  triggeredAvoid: [],
  relevantAwareness: [],
  positioningRecommendations: [untaggedNote('Lead with platform delivery.'), untaggedNote('Tie Kubernetes to developer velocity.')],
  requirementCoverageScore: 0.8,
  matchedRequirementIds: ['req-1'],
  matchedKeywords: ['Kubernetes', 'platform'],
})

const countOccurrences = (value: string, search: string): number =>
  value.split(search).length - 1

const audienceAssignment = (...inferred: AudienceTag[]): AudienceAssignment => ({
  inferred,
  asserted: null,
})

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
    expect(projection.skill_gaps).toEqual([])
    expect(projection.matched_keywords).toEqual(['Kubernetes', 'platform'])
    expect(projection.positioning_note).toContain('Platform-heavy role: Own deployment platforms.')
    expect(projection.positioning_note).toContain('Evidence-light filter')
    expect(projection.positioning_note).not.toContain('Evidence-light filter:')
    expect(projection.positioning_note).toContain(
      'JD contains a hard filter that needs internal review. Confirm before assembling the resume.',
    )
    expect(projection.positioning_note).toContain('Parser confidence is low for this JD section.')
    expect(countOccurrences(projection.positioning_note, 'Parser confidence is low for this JD section.')).toBe(1)
    expect(projection.positioning_note).not.toContain('Infrastructure as code')
    expect(projection.positioning_note).not.toContain('Candidate-facing prep concern.')
    expect(projection.vector_strategy).toContain('Platform / DevEx: strong')
  })

  it('honors explicit internal audience tags before extracting Build content', () => {
    const platformVector = jdAnalysis.matchedVectors[0]
    const platformBullet = jdAnalysis.evidenceMapping.topBullets[0]
    const terraformGap = jdAnalysis.gaps[0]
    const terraformSkill = jdAnalysis.skillMatches[1]

    const explicitAudienceAnalysis: JDAnalysis = {
      ...jdAnalysis,
      warnings: [
        { text: 'Internal parser warning.', audiences: audienceAssignment('internal') },
        { text: 'Candidate prep warning.', audiences: audienceAssignment('candidate') },
      ],
      matchedVectors: [
        {
          ...platformVector,
          audiences: audienceAssignment('internal'),
        },
      ],
      evidenceMapping: {
        ...jdAnalysis.evidenceMapping,
        topBullets: [
          {
            ...platformBullet,
            audiences: audienceAssignment('internal'),
          },
          {
            ...platformBullet,
            id: 'bullet-2',
            label: 'Candidate-only backend reliability',
            matchedKeywords: ['reliability'],
            audiences: audienceAssignment('candidate'),
          },
        ],
      },
      skillMatches: [
        {
          ...terraformSkill,
          skillName: 'Internal weak skill',
          audiences: audienceAssignment('internal'),
        },
        {
          ...terraformSkill,
          skillName: 'Candidate weak skill',
          audiences: audienceAssignment('candidate'),
        },
      ],
      gaps: [
        {
          ...terraformGap,
          label: 'Internal gap',
          audiences: audienceAssignment('internal'),
        },
        {
          ...terraformGap,
          label: 'Candidate gap',
          audiences: audienceAssignment('candidate'),
        },
      ],
      gapFocus: [
        { text: 'Internal gap focus.', audiences: audienceAssignment('internal') },
        { text: 'Candidate gap focus.', audiences: audienceAssignment('candidate') },
      ],
      positioningRecommendations: [
        { text: 'Internal positioning line.', audiences: audienceAssignment('internal') },
        { text: 'Candidate positioning line.', audiences: audienceAssignment('candidate') },
      ],
      watchOuts: [
        {
          ...jdAnalysis.watchOuts[0],
          description: 'Internal watch-out.',
          suggestedAction: 'Keep this in Build.',
          audiences: audienceAssignment('internal'),
        },
        {
          ...jdAnalysis.watchOuts[0],
          description: 'Candidate watch-out.',
          suggestedAction: 'Keep this in prep.',
          audiences: audienceAssignment('candidate'),
        },
      ],
      triggeredPrioritize: [
        {
          ...jdAnalysis.triggeredPrioritize[0],
          label: 'Internal trigger',
          jdEvidence: 'Internal evidence.',
          audiences: audienceAssignment('internal'),
        },
        {
          ...jdAnalysis.triggeredPrioritize[0],
          label: 'Candidate trigger',
          jdEvidence: 'Candidate evidence.',
          audiences: audienceAssignment('candidate'),
        },
      ],
    }

    const projection = buildProjectionFromJDAnalysis(explicitAudienceAnalysis, resumeData)

    expect(projection.suggested_target_line).toBe('Internal positioning line.')
    expect(projection.bullet_adjustments.map((adjustment) => adjustment.bullet_id)).toEqual([
      'bullet-1',
    ])
    expect(projection.skill_gaps).toEqual(['Internal gap focus.', 'Internal gap', 'Internal weak skill'])
    expect(projection.positioning_note).toContain('Internal trigger: Internal evidence.')
    expect(projection.positioning_note).toContain('Internal watch-out. Keep this in Build.')
    expect(projection.positioning_note).toContain('Internal parser warning.')
    expect(projection.positioning_note).not.toContain('Candidate')
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
