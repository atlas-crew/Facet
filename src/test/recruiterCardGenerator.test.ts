import { describe, expect, it } from 'vitest'
import { cloneIdentityFixture } from './fixtures/identityFixture'
import type { JDAnalysis } from '../types/jdAnalysis'
import { untagged, untaggedNote } from '../types/audience'
import { applyRulesBasedAudiences, type JDAnalysisLike } from '../utils/audienceRules'
import { createRecruiterCard } from '../utils/recruiterCardGenerator'

// Build a fixture by running a draft through the rules engine so audience
// tags match production. Without this, fixture items default to
// 'unclassified' and never reach the recruiter projection.
const buildJdAnalysisFixture = (): JDAnalysis => {
  const draft: JDAnalysisLike = {
    id: 'analysis-1',
    pipelineEntryId: 'pipe-1',
    jdTextHash: 'abc123',
    identityVersion: 3,
    modelVersion: 'jd-analysis.v1.test',
    generatedAt: '2026-04-03T12:00:00.000Z',
    updatedAt: '2026-04-03T12:00:00.000Z',
    warnings: [untaggedNote('Do not overclaim direct SRE ownership.')],
    company: 'Atlas',
    role: 'Staff Platform Engineer',
    summary: 'Strong platform fit with credible migration and reliability evidence.',
    analyzedJobDescription: 'Lead platform modernization and improve developer velocity.',
    jobDescriptionWordCount: 6,
    jobDescriptionTruncated: false,
    requirements: [
      untagged({
        id: 'req-platform',
        label: 'Platform engineering',
        priority: 'core',
        evidence: 'Own platform modernization.',
        tags: ['platform'],
        keywords: ['platform'],
        coverageScore: 0.92,
        matchedAssetCount: 3,
        matchedTags: ['platform'],
      }),
      untagged({
        id: 'req-reliability',
        label: 'Reliability leadership',
        priority: 'important',
        evidence: 'Improve reliability.',
        tags: ['reliability'],
        keywords: ['reliability'],
        coverageScore: 0.58,
        matchedAssetCount: 1,
        matchedTags: ['reliability'],
      }),
    ],
    overallFit: 'strong',
    fitScore: 0.84,
    confidence: 'high',
    recommendation: 'apply',
    oneLineSummary: 'Strong platform match.',
    rationale: 'Candidate evidence supports backend platform ownership.',
    matchedVectors: [],
    primaryVectorId: null,
    skillMatches: [
      untagged({
        skillName: 'Kubernetes',
        jdRequirement: 'Own Kubernetes-backed platform delivery.',
        requirementStrength: 'required',
        userDepth: 'strong',
        userPositioning: 'Lead with Kubernetes platform migration stories.',
        matchQuality: 'strong',
        presentationGuidance: 'Lead with Kubernetes platform migration stories.',
      }),
    ],
    evidenceMapping: {
      topBullets: [
        untagged({
          kind: 'bullet',
          id: 'platform-migration',
          label: 'Platform migration',
          sourceLabel: 'Contoso Networks',
          text: 'Ported the platform to Kubernetes-based installs.',
          tags: ['platform', 'kubernetes'],
          matchedTags: ['platform'],
          matchedKeywords: ['platform'],
          matchedRequirementIds: ['req-platform'],
          score: 0.96,
        }),
      ],
      topSkills: [],
      topProjects: [
        untagged({
          kind: 'project',
          id: 'proj-onprem',
          label: 'On-prem rollout',
          sourceLabel: 'Projects',
          text: 'Expanded delivery into customer environments.',
          tags: ['delivery'],
          matchedTags: ['delivery'],
          matchedKeywords: ['rollout'],
          matchedRequirementIds: ['req-platform'],
          score: 0.77,
        }),
      ],
      topProfiles: [],
      topPhilosophy: [],
    },
    strengthsToLead: [untaggedNote('Credible platform modernization track record.')],
    advantages: [
      untagged({
        id: 'adv-platform',
        claim: 'Brings credible platform modernization evidence.',
        requirementIds: ['req-platform'],
        evidence: [],
      }),
    ],
    advantageHypotheses: [],
    gaps: [
      untagged({
        requirementId: 'req-reliability',
        label: 'Reliability leadership',
        // High severity ensures the rules engine adds 'recruiter' to the
        // audience set so this surfaces as a Likely Concern.
        severity: 'high',
        reason: 'Less explicit ownership over SRE-style incident programs.',
        tags: ['reliability'],
      }),
    ],
    gapFocus: [untaggedNote('Clarify how platform work improved operational reliability.')],
    watchOuts: [],
    triggeredPrioritize: [],
    triggeredAvoid: [],
    relevantAwareness: [],
    positioningRecommendations: [
      untaggedNote('Lead with platform modernization and customer-environment delivery.'),
    ],
    requirementCoverageScore: 0.84,
    matchedRequirementIds: ['req-platform'],
    matchedKeywords: ['platform'],
  }
  return applyRulesBasedAudiences(draft)
}

describe('recruiterCardGenerator', () => {
  it('builds a recruiter-facing card from the active JD analysis', () => {
    const result = createRecruiterCard({
      id: 'recruiter-1',
      identity: cloneIdentityFixture(),
      jdAnalysis: buildJdAnalysisFixture(),
    })

    expect(result).toMatchObject({
      id: 'recruiter-1',
      company: 'Atlas',
      role: 'Staff Platform Engineer',
      candidateName: 'Alex Example',
      candidateTitle: 'Staff Platform Engineer',
      matchScore: 0.84,
      summary: 'Strong platform fit with credible migration and reliability evidence.',
    })
    expect(result.recruiterHook).toContain('84% match')
    expect(result.suggestedIntro).toContain('Kubernetes')
    expect(result.topReasons).toContain('Brings credible platform modernization evidence.')
    expect(result.proofPoints).toContain('Contoso Networks: Ported the platform to Kubernetes-based installs.')
    expect(result.skillHighlights).toEqual(['Kubernetes'])
    expect(result.likelyConcerns).toContain(
      'Reliability leadership: Less explicit ownership over SRE-style incident programs.',
    )
    expect(result.actionCta).toContain('Atlas')
    expect(result.matchScoreMethodology).toContain('Match %')
  })
})
