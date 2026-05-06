import type { AudienceTagged, TaggedNote } from './audience'

export type MatchRequirementPriority = 'core' | 'important' | 'supporting'

export type MatchAssetKind = 'bullet' | 'skill' | 'project' | 'profile' | 'philosophy'

export type MatchGapSeverity = 'high' | 'medium' | 'low'

export type MatchOverallFit = 'strong' | 'moderate' | 'weak' | 'filter-out'

export type MatchConfidence = 'high' | 'medium' | 'low'

export type MatchRecommendation = 'apply' | 'consider' | 'skip'

export type MatchVectorStrength = 'strong' | 'moderate' | 'weak'

export type SkillRequirementStrength = 'required' | 'preferred' | 'nice-to-have'

export type SkillMatchQuality = 'strong' | 'moderate' | 'weak' | 'negative'

export type WatchOutType = 'avoid_skill' | 'filter_risk' | 'awareness_item' | 'comp_concern'

export type WatchOutSeverity = 'hard' | 'soft'

export interface MatchRequirement extends AudienceTagged {
  id: string
  label: string
  priority: MatchRequirementPriority
  evidence: string
  tags: string[]
  keywords: string[]
}

export interface MatchAdvantageHypothesis extends AudienceTagged {
  id: string
  claim: string
  requirementIds: string[]
}

export interface MatchedVector extends AudienceTagged {
  vectorId: string
  title: string
  priority: 'high' | 'medium' | 'low'
  matchStrength: MatchVectorStrength
  evidence: string[]
  thesisApplies: boolean
  thesisFitExplanation: string
}

export interface SkillMatch extends AudienceTagged {
  skillName: string
  jdRequirement: string
  requirementStrength: SkillRequirementStrength
  userDepth: 'expert' | 'strong' | 'hands-on-working' | 'architectural' | 'conceptual' | 'working' | 'basic' | 'avoid'
  userPositioning: string
  matchQuality: SkillMatchQuality
  presentationGuidance: string
}

export interface FilterTrigger extends AudienceTagged {
  filterId: string
  label: string
  weight: 'high' | 'medium' | 'low'
  jdEvidence: string
}

export interface AvoidTrigger extends AudienceTagged {
  filterId: string
  label: string
  severity: 'hard' | 'soft'
  jdEvidence: string
}

export interface RelevantAwareness extends AudienceTagged {
  awarenessId: string
  topic: string
  severity: 'high' | 'medium' | 'low'
  appliesBecause: string
  action: string
}

export interface WatchOut extends AudienceTagged {
  type: WatchOutType
  referenceId: string
  description: string
  severity: WatchOutSeverity
  suggestedAction: string
}

export interface VectorAwareMatchResult {
  id: string
  generatedAt: string
  identityVersion: number
  company: string
  role: string
  jobDescription: string
  overallFit: MatchOverallFit
  fitScore: number
  confidence: MatchConfidence
  oneLineSummary: string
  matchedVectors: MatchedVector[]
  primaryVectorId: string | null
  skillMatches: SkillMatch[]
  strengthsToLead: TaggedNote[]
  watchOuts: WatchOut[]
  triggeredPrioritize: FilterTrigger[]
  triggeredAvoid: AvoidTrigger[]
  relevantAwareness: RelevantAwareness[]
  recommendation: MatchRecommendation
  rationale: string
  warnings: TaggedNote[]
}

// MatchRequirementCoverage extends MatchRequirement which already extends
// AudienceTagged — no additional mixin needed.
export interface MatchRequirementCoverage extends MatchRequirement {
  coverageScore: number
  matchedAssetCount: number
  matchedTags: string[]
}

export interface MatchAssetScore extends AudienceTagged {
  kind: MatchAssetKind
  id: string
  label: string
  sourceLabel: string
  text: string
  tags: string[]
  matchedTags: string[]
  matchedKeywords: string[]
  matchedRequirementIds: string[]
  score: number
}

export interface MatchGap extends AudienceTagged {
  requirementId: string
  label: string
  severity: MatchGapSeverity
  reason: string
  tags: string[]
}

export interface MatchAdvantage extends AudienceTagged {
  id: string
  claim: string
  requirementIds: string[]
  evidence: MatchAssetScore[]
}

export interface JdMatchExtraction {
  summary: string
  company: string
  role: string
  requirements: MatchRequirement[]
  advantageHypotheses: MatchAdvantageHypothesis[]
  positioningRecommendations: TaggedNote[]
  gapFocus: TaggedNote[]
  warnings: TaggedNote[]
}

export interface PreparedMatchJobDescription {
  content: string
  wordCount: number
  truncated: boolean
}

export interface MatchReport {
  generatedAt: string
  identityVersion: number
  company: string
  role: string
  summary: string
  jobDescription: string
  matchScore: number
  requirements: MatchRequirementCoverage[]
  topBullets: MatchAssetScore[]
  topSkills: MatchAssetScore[]
  topProjects: MatchAssetScore[]
  topProfiles: MatchAssetScore[]
  topPhilosophy: MatchAssetScore[]
  gaps: MatchGap[]
  advantages: MatchAdvantage[]
  positioningRecommendations: TaggedNote[]
  gapFocus: TaggedNote[]
  warnings: TaggedNote[]
}

export interface MatchHistoryEntry {
  id: string
  createdAt: string
  company: string
  role: string
  matchScore: number
  requirementCount: number
  gapCount: number
  summary: string
}
