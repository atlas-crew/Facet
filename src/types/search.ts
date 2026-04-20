import type { DurableMetadata } from './durable'

export type SearchSkillCategory =
  | 'backend'
  | 'frontend'
  | 'platform'
  | 'devops'
  | 'cloud'
  | 'data'
  | 'ai-ml'
  | 'security'
  | 'architecture'
  | 'leadership'
  | 'product'
  | 'domain'
  | 'other'

export type SearchSkillDepth =
  | 'expert'
  | 'strong'
  | 'hands-on-working'
  | 'architectural'
  | 'conceptual'
  | 'working'
  | 'basic'
  | 'avoid'

export type SearchCompanySize =
  | 'startup'
  | 'growth'
  | 'mid-market'
  | 'enterprise'
  | 'public'
  | 'any'

export type SearchRunStatus = 'pending' | 'running' | 'completed' | 'failed'

export type SearchProfileSourceKind = 'identity' | 'resume'

export interface SearchProfileSource {
  kind: SearchProfileSourceKind
  label: string
}

export interface SkillCatalogEntry {
  id: string
  name: string
  category: SearchSkillCategory
  depth: SearchSkillDepth
  context?: string
  positioning?: string
}

export interface VectorSearchConfig {
  vectorId: string
  priority: number
  description: string
  targetRoleTitles: string[]
  searchKeywords: string[]
}

export interface SearchWorkSummaryEntry {
  title: string
  summary: string
}

export interface SearchProfileConstraints {
  compensation: string
  locations: string[]
  clearance: string
  companySize: SearchCompanySize | ''
}

export interface SearchProfileFilters {
  prioritize: string[]
  avoid: string[]
}

export interface SearchInterviewPrefs {
  strongFit: string[]
  redFlags: string[]
}

export interface SearchProfile {
  id: string
  durableMeta?: DurableMetadata
  source?: SearchProfileSource
  skills: SkillCatalogEntry[]
  vectors: VectorSearchConfig[]
  workSummary: SearchWorkSummaryEntry[]
  openQuestions: string[]
  constraints: SearchProfileConstraints
  filters: SearchProfileFilters
  interviewPrefs: SearchInterviewPrefs
  inferredAt: string
  inferredFromResumeVersion: number
}

export interface SearchRequestMaxResults {
  tier1: number
  tier2: number
  tier3: number
}

export interface SearchRequest {
  id: string
  durableMeta?: DurableMetadata
  createdAt: string
  focusVectors: string[]
  companySizeOverride: SearchCompanySize | ''
  salaryAnchorOverride: string
  geoExpand: boolean
  customKeywords: string
  excludeCompanies: string[]
  maxResults: SearchRequestMaxResults
}

export interface SearchResultInterviewProcess {
  format: string
  builderFriendly: boolean
  aiToolsAllowed: boolean
  estimatedTimeline?: string
}

export interface SearchResultCompanyIntel {
  stage: string
  aiCulture: string
  remotePolicy: string
  openRoleCount?: number
}

export interface SearchResultEntry {
  id: string
  tier: 1 | 2 | 3
  company: string
  title: string
  url: string
  location?: string
  matchScore: number
  matchReason: string
  vectorAlignment: string
  risks: string[]
  estimatedComp?: string
  source: string

  /** "Why this candidate wins here" narrative from deep research. */
  candidateEdge?: string
  /** Interview process intelligence for this company/role. */
  interviewProcess?: SearchResultInterviewProcess
  /** Company intelligence gathered during research. */
  companyIntel?: SearchResultCompanyIntel
  /** Signal convergence grouping: "every signal aligns", "most signals converge", etc. */
  signalGroup?: string
  /** Which unfair advantage combination from the search thesis drove this match. */
  advantageMatch?: string
}

export interface SearchTokenUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

export interface SearchRun {
  id: string
  durableMeta?: DurableMetadata
  requestId: string
  createdAt: string
  status: SearchRunStatus
  results: SearchResultEntry[]
  searchLog: string[]
  error?: string
  tokenUsage?: SearchTokenUsage
}

// ── Search Thesis ──────────────────────────────────────────────

export type SearchThesisSource = 'generated' | 'user-edited'

export type SearchUrgency = 'critical' | 'active' | 'exploratory'

export type SearchNoiseLevel = 'low' | 'medium' | 'high'

export interface SearchUnfairAdvantage {
  /** Skill combination that creates competitive edge. */
  combination: string
  /** Semantic depth description for this combination. */
  depth: string
  /** What kind of company this advantage targets. */
  targetCompanyProfile: string
}

export interface SearchLane {
  id: string
  /** Strategic search angle title. */
  title: string
  /** Why this lane exists — the strategic rationale. */
  rationale: string
  /** Competitive landscape context: why this is rare or valuable. */
  competitiveContext?: string
  /** Signals to look for in companies matching this lane. */
  targetSignals: string[]
}

export interface SearchThesisAvoid {
  label: string
  /** Qualifying condition: "building around k8s is fine, being a k8s admin is not". */
  condition?: string
}

export interface SearchTimeline {
  urgency: SearchUrgency
  deadline?: string
  /** How urgency affects search strategy. */
  strategyImpact: string
}

export interface SearchKeywordCombination {
  /** Search query string, e.g. '"platform engineer" + security'. */
  query: string
  /** Which SearchLane.id this keyword combination targets. */
  lane: string
  noiseLevel: SearchNoiseLevel
}

export interface SearchSkillDepthEntry {
  skill: string
  /** Semantic depth level from identity model. */
  depth: string
  /** Evidence context: "4+ years daily use at WAF company". */
  context: string
  /** How to use this skill in search: "Strong match signal. List first." */
  searchSignal: string
  /** Honest framing: "Not a K8s admin. Building around it is fine." */
  calibration?: string
}

/**
 * Strategic hypothesis that drives deep research execution.
 * Generated in Phase 1 (thesis generation), reviewed and corrected
 * by the user, then used as input to Phase 2 (deep research).
 */
export interface SearchThesis {
  id: string
  createdAt: string
  updatedAt: string

  /** What makes this candidate structurally different. */
  competitiveMoat: string
  /** Rare skill combinations with depth validation. */
  unfairAdvantages: SearchUnfairAdvantage[]
  /** 2-4 strategic angles to search along, each with rationale. */
  searchLanes: SearchLane[]
  /** Connects candidate archetype to interview format advantage. */
  interviewStrategy: string
  /** Signals to look for in target companies. */
  lookFor: string[]
  /** What to avoid, with qualifying conditions. */
  avoid: SearchThesisAvoid[]

  /** Search urgency and timeline constraints. */
  timeline?: SearchTimeline
  /** Specific search queries per lane with noise level. */
  keywordCombinations: SearchKeywordCombination[]
  /** Per-skill semantic depth with context and search guidance. */
  skillDepthMap: SearchSkillDepthEntry[]

  /** Whether this thesis was AI-generated or user-edited. */
  source: SearchThesisSource
  /** Which identity model version this was derived from. */
  identityVersion: number
  /** IDs of feedback events that informed this thesis. */
  feedbackIncorporated: string[]
}

export const DEFAULT_SEARCH_MAX_RESULTS: SearchRequestMaxResults = {
  tier1: 5,
  tier2: 10,
  tier3: 10,
}
