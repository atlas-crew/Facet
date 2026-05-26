import type { AudienceAssignment, AudienceTag } from '../../types/audience'
import type { JDAnalysis } from '../../types/jdAnalysis'
import { AUDIENCE_RULES_VERSION } from '../../utils/audienceRules'

const audienceAssignment = (
  audiences: AudienceTag[],
  asserted: AudienceTag[] | null = audiences,
): AudienceAssignment => ({
  inferred: audiences,
  asserted,
})

export const candidateAudience = (): AudienceAssignment => audienceAssignment(['candidate'])

export const recruiterAudience = (): AudienceAssignment => audienceAssignment(['recruiter'])

export const internalAudience = (): AudienceAssignment => audienceAssignment(['internal'])

export const buildAudienceJdAnalysisFixture = (): JDAnalysis => ({
  id: 'jd-analysis-audience-test',
  pipelineEntryId: 'pipe-audience-test',
  jdTextHash: 'jdhash-audience-test',
  identityVersion: 3,
  modelVersion: 'jd-analysis.v1.match-multipass-sonnet',
  audienceRulesVersion: AUDIENCE_RULES_VERSION,
  generatedAt: '2026-04-20T12:00:00.000Z',
  updatedAt: '2026-04-20T12:00:00.000Z',
  warnings: [
    {
      text: 'Internal calibration note only.',
      audiences: internalAudience(),
    },
  ],
  company: 'Acme',
  role: 'Staff Engineer',
  summary: 'Distributed systems and platform tooling.',
  analyzedJobDescription: 'Build distributed systems and platform tooling.',
  jobDescriptionWordCount: 6,
  jobDescriptionTruncated: false,
  requirements: [
    {
      id: 'req-candidate-core',
      label: 'Operate Kubernetes-backed platforms',
      priority: 'core',
      evidence: 'Role needs practical platform operations.',
      tags: ['platform'],
      keywords: ['kubernetes'],
      coverageScore: 0.9,
      matchedAssetCount: 2,
      matchedTags: ['platform'],
      audiences: candidateAudience(),
    },
    {
      id: 'req-recruiter-only',
      label: 'Recruiter advocacy summary',
      priority: 'supporting',
      evidence: 'Useful for recruiter-facing framing, not prep.',
      tags: ['advocacy'],
      keywords: ['advocacy'],
      coverageScore: 0.4,
      matchedAssetCount: 0,
      matchedTags: [],
      audiences: recruiterAudience(),
    },
  ],
  overallFit: 'strong',
  fitScore: 0.82,
  confidence: 'high',
  recommendation: 'apply',
  oneLineSummary: 'Strong platform fit.',
  rationale: 'The role maps to backend platform evidence.',
  matchedVectors: [],
  primaryVectorId: 'backend',
  skillMatches: [
    {
      skillName: 'Kubernetes',
      jdRequirement: 'Operate Kubernetes-backed platforms',
      requirementStrength: 'required',
      userDepth: 'strong',
      userPositioning: 'Built platforms around Kubernetes workloads.',
      matchQuality: 'strong',
      presentationGuidance: 'Frame platform ownership without overclaiming admin depth.',
      audiences: candidateAudience(),
    },
    {
      skillName: 'Recruiter advocacy',
      jdRequirement: 'Summarize fit for recruiter handoff',
      requirementStrength: 'nice-to-have',
      userDepth: 'working',
      userPositioning: 'Recruiter handoff framing.',
      matchQuality: 'moderate',
      presentationGuidance: 'Recruiter-only pitch note.',
      audiences: recruiterAudience(),
    },
  ],
  evidenceMapping: {
    topBullets: [
      {
        kind: 'bullet',
        id: 'bullet-candidate',
        label: 'Platform reliability bullet',
        sourceLabel: 'Northwind',
        text: 'Reduced incident volume by 38%.',
        tags: ['platform'],
        matchedTags: ['platform'],
        matchedKeywords: ['incident'],
        matchedRequirementIds: ['req-candidate-core'],
        score: 0.92,
        audiences: candidateAudience(),
      },
      {
        kind: 'bullet',
        id: 'bullet-recruiter-only',
        label: 'Recruiter-only proof',
        sourceLabel: 'Recruiter Notes',
        text: 'Recruiter advocacy proof point.',
        tags: ['advocacy'],
        matchedTags: ['advocacy'],
        matchedKeywords: ['advocacy'],
        matchedRequirementIds: ['req-recruiter-only'],
        score: 0.4,
        audiences: recruiterAudience(),
      },
    ],
    topSkills: [],
    topProjects: [],
    topProfiles: [],
    topPhilosophy: [],
  },
  strengthsToLead: [
    {
      text: 'Lead with platform reliability.',
      audiences: candidateAudience(),
    },
    {
      text: 'Recruiter should emphasize keyword overlap.',
      audiences: recruiterAudience(),
    },
  ],
  advantages: [
    {
      id: 'adv-candidate',
      claim: 'Credible platform migration evidence.',
      requirementIds: ['req-candidate-core'],
      evidence: [],
      audiences: candidateAudience(),
    },
    {
      id: 'adv-recruiter',
      claim: 'Recruiter-facing advocacy claim.',
      requirementIds: ['req-recruiter-only'],
      evidence: [],
      audiences: recruiterAudience(),
    },
  ],
  advantageHypotheses: [
    {
      id: 'hyp-candidate',
      claim: 'Candidate should discuss migration tradeoffs.',
      requirementIds: ['req-candidate-core'],
      audiences: candidateAudience(),
    },
    {
      id: 'hyp-recruiter',
      claim: 'Recruiter-only screening shortcut.',
      requirementIds: ['req-recruiter-only'],
      audiences: recruiterAudience(),
    },
  ],
  gaps: [
    {
      requirementId: 'req-candidate-core',
      label: 'Explain Kubernetes operations boundary',
      severity: 'low',
      reason: 'Candidate should frame platform ownership without overclaiming admin work.',
      tags: ['platform'],
      audiences: candidateAudience(),
    },
    {
      requirementId: 'req-recruiter-only',
      label: 'Recruiter-only gap framing',
      severity: 'medium',
      reason: 'Recruiter-only risk language.',
      tags: ['advocacy'],
      audiences: recruiterAudience(),
    },
  ],
  gapFocus: [
    {
      text: 'Clarify the Kubernetes operations boundary.',
      audiences: candidateAudience(),
    },
    {
      text: 'Recruiter-only objection handling.',
      audiences: recruiterAudience(),
    },
  ],
  watchOuts: [
    {
      type: 'filter_risk',
      referenceId: 'watch-candidate',
      description: 'Do not overclaim Kubernetes administration.',
      severity: 'soft',
      suggestedAction: 'Bridge back to platform migration experience.',
      audiences: candidateAudience(),
    },
    {
      type: 'filter_risk',
      referenceId: 'watch-recruiter',
      description: 'Recruiter-only concern.',
      severity: 'conditional',
      suggestedAction: 'Use only in recruiter handoff.',
      audiences: recruiterAudience(),
    },
  ],
  triggeredPrioritize: [],
  triggeredAvoid: [],
  relevantAwareness: [
    {
      awarenessId: 'awareness-platform-boundary',
      topic: 'Platform ownership boundary',
      severity: 'medium',
      appliesBecause: 'The role mixes platform operations and application support.',
      action: 'Prepare a crisp boundary statement.',
      audiences: candidateAudience(),
    },
  ],
  positioningRecommendations: [
    {
      text: 'Lead with platform migration and reliability outcomes.',
      audiences: candidateAudience(),
    },
    {
      text: 'Recruiter-only positioning note.',
      audiences: recruiterAudience(),
    },
  ],
  requirementCoverageScore: 0.8,
  matchedRequirementIds: ['req-candidate-core'],
  matchedKeywords: ['distributed systems', 'platform tooling'],
})
