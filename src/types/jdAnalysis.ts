import type { TaggedNote } from './audience'
import type {
  AvoidTrigger,
  FilterTrigger,
  JdMatchExtraction,
  MatchedVector,
  MatchAdvantage,
  MatchConfidence,
  MatchGap,
  MatchOverallFit,
  MatchRecommendation,
  MatchRequirementCoverage,
  MatchAssetScore,
  RelevantAwareness,
  SkillMatch,
  WatchOut,
} from './match'

export const JD_ANALYSIS_MODEL_VERSION = 'jd-analysis.v1.match-multipass-sonnet'

export interface JdAnalysisEvidenceMapping {
  topBullets: MatchAssetScore[]
  topSkills: MatchAssetScore[]
  topProjects: MatchAssetScore[]
  topProfiles: MatchAssetScore[]
  topPhilosophy: MatchAssetScore[]
}

export interface JDAnalysis {
  id: string
  pipelineEntryId: string
  jdTextHash: string
  identityVersion: number
  modelVersion: string
  // Stamp for the audience-rules engine (src/utils/audienceRules.ts).
  // Mismatch on hydration triggers re-application; LLM-asserted tags are
  // preserved across rules-version bumps.
  audienceRulesVersion: string
  generatedAt: string
  updatedAt: string
  warnings: TaggedNote[]

  company: string
  role: string
  summary: string
  analyzedJobDescription: string
  jobDescriptionWordCount: number
  jobDescriptionTruncated: boolean

  requirements: MatchRequirementCoverage[]
  overallFit: MatchOverallFit
  fitScore: number
  confidence: MatchConfidence
  recommendation: MatchRecommendation
  oneLineSummary: string
  rationale: string

  matchedVectors: MatchedVector[]
  primaryVectorId: string | null
  skillMatches: SkillMatch[]
  evidenceMapping: JdAnalysisEvidenceMapping

  strengthsToLead: TaggedNote[]
  advantages: MatchAdvantage[]
  advantageHypotheses: JdMatchExtraction['advantageHypotheses']
  gaps: MatchGap[]
  gapFocus: TaggedNote[]
  watchOuts: WatchOut[]

  triggeredPrioritize: FilterTrigger[]
  triggeredAvoid: AvoidTrigger[]
  relevantAwareness: RelevantAwareness[]

  positioningRecommendations: TaggedNote[]
  requirementCoverageScore: number
  matchedRequirementIds: string[]
  matchedKeywords: string[]
}

export type JDAnalysisDriftReason = 'jd-text' | 'identity-version' | 'model-version'

export interface JDAnalysisDriftStatus {
  stale: boolean
  reasons: JDAnalysisDriftReason[]
}
