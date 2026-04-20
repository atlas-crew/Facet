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

export interface MatchRequirement {
  id: string
  label: string
  priority: MatchRequirementPriority
  evidence: string
  tags: string[]
  keywords: string[]
}

export interface MatchAdvantageHypothesis {
  id: string
  claim: string
  requirementIds: string[]
}

export interface MatchedVector {
  vectorId: string
  title: string
  priority: 'high' | 'medium' | 'low'
  matchStrength: MatchVectorStrength
  evidence: string[]
  thesisApplies: boolean
  thesisFitExplanation: string
}

export interface SkillMatch {
  skillName: string
  jdRequirement: string
  requirementStrength: SkillRequirementStrength
  userDepth: 'expert' | 'strong' | 'hands-on-working' | 'architectural' | 'conceptual' | 'working' | 'basic' | 'avoid'
  userPositioning: string
  matchQuality: SkillMatchQuality
  presentationGuidance: string
}

export interface FilterTrigger {
  filterId: string
  label: string
  weight: 'high' | 'medium' | 'low'
  jdEvidence: string
}

export interface AvoidTrigger {
  filterId: string
  label: string
  severity: 'hard' | 'soft'
  jdEvidence: string
}

export interface RelevantAwareness {
  awarenessId: string
  topic: string
  severity: 'high' | 'medium' | 'low'
  appliesBecause: string
  action: string
}

export interface WatchOut {
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
  strengthsToLead: string[]
  watchOuts: WatchOut[]
  triggeredPrioritize: FilterTrigger[]
  triggeredAvoid: AvoidTrigger[]
  relevantAwareness: RelevantAwareness[]
  recommendation: MatchRecommendation
  rationale: string
  warnings: string[]
}

export interface MatchRequirementCoverage extends MatchRequirement {
  coverageScore: number
  matchedAssetCount: number
  matchedTags: string[]
}

export interface MatchAssetScore {
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

export interface MatchGap {
  requirementId: string
  label: string
  severity: MatchGapSeverity
  reason: string
  tags: string[]
}

export interface MatchAdvantage {
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
  positioningRecommendations: string[]
  gapFocus: string[]
  warnings: string[]
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
  positioningRecommendations: string[]
  gapFocus: string[]
  warnings: string[]
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
