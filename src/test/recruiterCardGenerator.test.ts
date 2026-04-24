import { describe, expect, it } from 'vitest'
import { cloneIdentityFixture } from './fixtures/identityFixture'
import type { MatchReport } from '../types/match'
import { createRecruiterCard } from '../utils/recruiterCardGenerator'

const matchReportFixture: MatchReport = {
  generatedAt: '2026-04-03T12:00:00.000Z',
  identityVersion: 3,
  company: 'Atlas',
  role: 'Staff Platform Engineer',
  summary: 'Strong platform fit with credible migration and reliability evidence.',
  jobDescription: 'Lead platform modernization and improve developer velocity.',
  matchScore: 0.84,
  requirements: [
    {
      id: 'req-platform',
      label: 'Platform engineering',
      priority: 'core',
      evidence: 'Own platform modernization.',
      tags: ['platform'],
      keywords: ['platform'],
      coverageScore: 0.92,
      matchedAssetCount: 3,
      matchedTags: ['platform'],
    },
    {
      id: 'req-reliability',
      label: 'Reliability leadership',
      priority: 'important',
      evidence: 'Improve reliability.',
      tags: ['reliability'],
      keywords: ['reliability'],
      coverageScore: 0.58,
      matchedAssetCount: 1,
      matchedTags: ['reliability'],
    },
  ],
  topBullets: [
    {
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
    },
  ],
  topSkills: [
    {
      kind: 'skill',
      id: 'skill-kubernetes',
      label: 'Kubernetes',
      sourceLabel: 'Platform',
      text: 'Kubernetes',
      tags: ['platform', 'kubernetes'],
      matchedTags: ['platform'],
      matchedKeywords: ['kubernetes'],
      matchedRequirementIds: ['req-platform'],
      score: 0.88,
    },
  ],
  topProjects: [
    {
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
    },
  ],
  topProfiles: [
    {
      kind: 'profile',
      id: 'profile-platform',
      label: 'Platform profile',
      sourceLabel: 'Profiles',
      text: 'I make infrastructure tradeoffs legible for product teams.',
      tags: ['platform'],
      matchedTags: ['platform'],
      matchedKeywords: ['infrastructure'],
      matchedRequirementIds: ['req-platform'],
      score: 0.74,
    },
  ],
  topPhilosophy: [
    {
      kind: 'philosophy',
      id: 'absorb-complexity',
      label: 'Absorb complexity',
      sourceLabel: 'Philosophy',
      text: 'I absorb platform complexity so product teams can move faster.',
      tags: ['platform', 'devex'],
      matchedTags: ['platform'],
      matchedKeywords: ['complexity'],
      matchedRequirementIds: ['req-platform'],
      score: 0.73,
    },
  ],
  gaps: [
    {
      requirementId: 'req-reliability',
      label: 'Reliability leadership',
      severity: 'medium',
      reason: 'Less explicit ownership over SRE-style incident programs.',
      tags: ['reliability'],
    },
  ],
  advantages: [
    {
      id: 'adv-platform',
      claim: 'Brings credible platform modernization evidence.',
      requirementIds: ['req-platform'],
      evidence: [],
    },
  ],
  positioningRecommendations: [
    'Lead with platform modernization and customer-environment delivery.',
    'Frame reliability work through enablement and migration discipline.',
  ],
  gapFocus: ['Clarify how platform work improved operational reliability.'],
  warnings: ['Do not overclaim direct SRE ownership.'],
}

describe('recruiterCardGenerator', () => {
  it('builds a recruiter-facing card from the current identity and match report', () => {
    const result = createRecruiterCard({
      id: 'recruiter-1',
      identity: cloneIdentityFixture(),
      report: matchReportFixture,
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
    expect(result.gapBridges).toContain(
      'Clarify how platform work improved operational reliability.',
    )
    expect(result.notes).toContain('Do not overclaim direct SRE ownership.')
  })
})
