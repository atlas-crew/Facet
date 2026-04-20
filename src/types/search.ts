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

  /** Run-level reasoning narrative (5-layer structure from doc-24 Output Contract). */
  narrative?: SearchRunNarrative
  /** Links to the ResearchJob record that produced this run (for rejoin after tab close). */
  jobId?: string
  /** Thesis id this run was generated from. */
  thesisId?: string
  /**
   * Immutable thesis snapshot at the time this run was created. Preserves reproducibility
   * when the source thesis is later edited — the run remains anchored to its original inputs.
   */
  thesisSnapshot?: SearchThesis
  /** `identity.model_revision` at generation time (TASK-159) for staleness detection. */
  identityVersion?: number
  /**
   * Output-contract violations flagged during normalization. Consumers surface these as
   * quality warnings and offer a "regenerate" affordance. An empty or omitted array means
   * the narrative and results satisfied the contract.
   */
  contractViolations?: string[]
}

// ── Run-Level Narrative (doc-24 Output Contract: Reasoning Layers) ─────────────

export interface SearchNarrativeLaneSummary {
  lane: string
  narrative: string
  topCompanies: string[]
}

export interface SearchObjectiveRecommendation {
  /** E.g., "security-domain leverage", "compensation optimization", "portfolio-as-interview". */
  objective: string
  recommendedCompanies: string[]
  rationale: string
}

export interface SearchRejectedCandidate {
  company: string
  reason: string
}

export interface SearchNarrativeReference {
  id: string | number
  url: string
  title?: string
}

export type SearchVisualizationType = 'mermaid-gantt' | 'mermaid-xychart' | 'mermaid-other'

export interface SearchVisualization {
  type: SearchVisualizationType
  /** Mermaid source code, preserved verbatim (not re-serialized). */
  source: string
  caption?: string
}

export type ApplicationPlanPhaseName = 'materials' | 'outreach' | 'prep' | 'close' | string

export interface ApplicationPlanTask {
  label: string
  /** ISO date (e.g., "2026-02-27"). */
  startDate: string
  durationDays: number
  /** Labels of other tasks in the same plan that must complete first. */
  dependencies?: string[]
}

export interface ApplicationPlanPhase {
  name: ApplicationPlanPhaseName
  tasks: ApplicationPlanTask[]
}

export interface ApplicationPlan {
  /** ISO date the plan begins. */
  startDate: string
  /** ISO date target for a signed offer (from SearchTimeline.deadline when set). */
  targetOfferDate?: string
  phases: ApplicationPlanPhase[]
  /** Optional Mermaid Gantt diagram source — preserved verbatim if provided. */
  mermaidDiagram?: string
}

/**
 * Run-level envelope the model produces alongside SearchResultEntry[].
 *
 * Five distinct narrative layers identified from reference search outputs
 * (Where Builders Beat Leetcoders, Platform and Security Platform Job Search Report):
 *
 *   1. Opening — competitiveMoat, selectionMethodology, marketContext, scoringRubric
 *   2. Lane structure — laneSummaries
 *   3. Closing — landscapeTrends, objectiveRecommendations, applicationPlan, visualizations
 *   4. Top-of-output summary — executiveSummary (compression of everything above)
 *   5. Feedback surfaces — surprises, rejectedCandidates, nextSteps, references
 *
 * Prose fields may contain `[cite:<id>]` inline markers resolved via TASK-184's Citation
 * type. The `references[]` field here holds resolved footnote URLs for numbered-citation
 * rendering mode.
 */
export interface SearchRunNarrative {
  // Opening layers — the argument before results
  competitiveMoat: string
  selectionMethodology: string
  marketContext: string
  scoringRubric?: string[]

  // Lane structure
  laneSummaries?: SearchNarrativeLaneSummary[]

  // Closing layers — synthesis after results
  landscapeTrends?: string
  objectiveRecommendations?: SearchObjectiveRecommendation[]
  applicationPlan?: ApplicationPlan
  visualizations?: SearchVisualization[]

  // Top-of-output summary
  executiveSummary: string

  // Feedback surfaces
  surprises?: string[]
  rejectedCandidates?: SearchRejectedCandidate[]
  nextSteps?: string[]
  references?: SearchNarrativeReference[]
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

  /**
   * Cohesive 3-5 paragraph strategic explanation weaving moat → advantages → lanes → signals
   * into a single story the user reads top-to-bottom. Required: users evaluate whether to
   * commit to Phase 2 deep research by reading this argument, so without it the thesis is a
   * structured dataset but not persuasive.
   */
  narrative: string

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

// ── Research Job (TASK-161 storage + runner; type definition lives here) ─────

export type ResearchJobStatus = 'queued' | 'running' | 'completed' | 'canceled' | 'failed'

export interface ResearchJobProgress {
  /** Current phase label (e.g., "analyzing thesis", "searching lane 2"). */
  phase: string
  /** Milliseconds elapsed since startedAt. */
  elapsedMs: number
  /** Web search queries executed so far. */
  searchQueries: string[]
  /** Optional thinking-text excerpts streamed from the model. */
  thinkingExcerpts?: string[]
  /** Number of intermediate findings produced so far. */
  findingsCount?: number
}

export interface ResearchJobResult {
  narrative: SearchRunNarrative
  results: SearchResultEntry[]
  tokenUsage: SearchTokenUsage
}

export interface ResearchJobError {
  code: string
  message: string
  retriable: boolean
}

/**
 * Durable job record for Phase 2 async deep research (TASK-161 runs this server-side).
 *
 * Persisted so a 10-20 minute run survives tab close, page reload, network switches, and
 * multi-device access. Client creates via POST /research/jobs, then polls GET /research/jobs/:id
 * (or subscribes via SSE) for status updates. The terminal `result` carries everything the
 * client needs to hydrate a SearchRun.
 */
export interface ResearchJob {
  id: string
  userId: string
  thesisId: string
  /** Immutable thesis snapshot — runs do not mutate when the source thesis evolves. */
  thesisSnapshot: SearchThesis
  /** `identity.model_revision` at job creation time (TASK-159). */
  identityVersion: number
  params: SearchRequest
  status: ResearchJobStatus
  createdAt: string
  startedAt?: string
  completedAt?: string
  progress?: ResearchJobProgress
  result?: ResearchJobResult
  error?: ResearchJobError
  /** ISO timestamp at which the job record becomes eligible for cleanup. */
  ttlAt: string
}

export const DEFAULT_SEARCH_MAX_RESULTS: SearchRequestMaxResults = {
  tier1: 5,
  tier2: 10,
  tier3: 10,
}
