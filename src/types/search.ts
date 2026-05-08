import type { DurableMetadata } from './durable'
import type { ArtifactStalenessReview } from './artifactMeta'

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

// TASK-196.1 bank values are mirrored into identity preferences.
export const INDUSTRY_BANK = [
  'adtech',
  'gambling',
  'tobacco',
  'firearms-defense',
  'oil-and-gas-extraction',
  'predatory-lending',
  'social-media-engagement',
  'crypto-speculation',
  'mlm',
] as const
export type SearchIndustry = (typeof INDUSTRY_BANK)[number]

// Keep in sync with INDUSTRY_BANK; Record makes missing labels a type error.
export const INDUSTRY_LABELS: Record<SearchIndustry, string> = {
  adtech: 'Adtech',
  gambling: 'Gambling',
  tobacco: 'Tobacco',
  'firearms-defense': 'Firearms / defense',
  'oil-and-gas-extraction': 'Oil and gas extraction',
  'predatory-lending': 'Predatory lending',
  'social-media-engagement': 'Social media engagement',
  'crypto-speculation': 'Crypto speculation',
  mlm: 'Multi-level marketing',
}

export const FUNDING_STAGE_BANK = [
  'bootstrapped',
  'pre-seed',
  'seed',
  'series-a',
  'series-b',
  'series-c-plus',
  'late-stage-private',
  'profitable-private',
  'public',
] as const
export type SearchFundingStage = (typeof FUNDING_STAGE_BANK)[number]

// Keep in sync with FUNDING_STAGE_BANK; Record makes missing labels a type error.
export const FUNDING_STAGE_LABELS: Record<SearchFundingStage, string> = {
  bootstrapped: 'Bootstrapped',
  'pre-seed': 'Pre-seed',
  seed: 'Seed',
  'series-a': 'Series A',
  'series-b': 'Series B',
  'series-c-plus': 'Series C+',
  'late-stage-private': 'Late-stage private',
  'profitable-private': 'Profitable private',
  public: 'Public',
}

export const REMOTE_POLICY_BANK = [
  'remote-only',
  'remote-friendly',
  'hybrid',
  'onsite-only',
] as const
export type SearchRemotePolicy = (typeof REMOTE_POLICY_BANK)[number]

// Keep in sync with REMOTE_POLICY_BANK; Record makes missing labels a type error.
export const REMOTE_POLICY_LABELS: Record<SearchRemotePolicy, string> = {
  'remote-only': 'Remote only',
  'remote-friendly': 'Remote friendly',
  hybrid: 'Hybrid',
  'onsite-only': 'Onsite only',
}

export const EMPLOYMENT_TYPE_BANK = ['w2-fulltime', '1099-contract', 'either-acceptable'] as const
export type SearchEmploymentType = (typeof EMPLOYMENT_TYPE_BANK)[number]

// Keep in sync with EMPLOYMENT_TYPE_BANK; Record makes missing labels a type error.
export const EMPLOYMENT_TYPE_LABELS: Record<SearchEmploymentType, string> = {
  'w2-fulltime': 'W-2 full-time',
  '1099-contract': '1099 contract',
  'either-acceptable': 'Either acceptable',
}

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

export interface SearchWorkSummaryEntry {
  title: string
  summary: string
}

export interface SearchProfileConstraints {
  compensation: string
  locations: string[]
  clearance: string
  companySize: SearchCompanySize | ''
  industriesToAvoid?: SearchIndustry[]
  fundingStagesAcceptable?: SearchFundingStage[]
  remotePolicies?: SearchRemotePolicy[]
  remotePolicyNote?: string
  employmentTypes?: SearchEmploymentType[]
}

export type SearchProfileFilterSeverity = 'hard' | 'soft' | 'conditional'

export interface SearchProfileFilterEntry {
  label: string
  condition?: string
  severity: SearchProfileFilterSeverity
}

export interface SearchProfileFilters {
  prioritize: SearchProfileFilterEntry[]
  avoid: SearchProfileFilterEntry[]
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
  focusLanes: string[]
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

export const CITATION_TYPE_VALUES = [
  'careers',
  'public',
  'review',
  'index',
  'github',
  'news',
  'other',
] as const

export type CitationType = (typeof CITATION_TYPE_VALUES)[number]

export interface Citation {
  /** Marker id used by prose as [cite:<id>]. */
  id: string
  /** Human-readable source label, e.g. "PostHog" or "Built In". */
  source: string
  url?: string
  type?: CitationType
  /** Optional note about which factual claim this citation supports. */
  claim?: string
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
  /** Claim-level citations referenced by [cite:<id>] markers in this result's prose. */
  citations?: Citation[]

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
  /** Raw public job description text when a source posting exposes it. Not inferred analysis. */
  jobDescription?: string
  /** Same-origin source URL required for jobDescription to be preserved. */
  jobDescriptionSourceUrl?: string
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
  /** Identity fields this run used, when generation can provide field-level dependencies. */
  identityFields?: string[]
  /** Last batch staleness review decision recorded for this artifact. */
  stalenessReview?: ArtifactStalenessReview
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

export type SearchAssumptionSource = 'inferred' | 'assumed-default' | 'explicit-fallback'

export type SearchAssumptionConfidence = 'high' | 'medium' | 'low'

export interface SearchAssumption {
  id: string
  /** Gap-filled claim the model used while generating search output. */
  claim: string
  source: SearchAssumptionSource
  /** Why this assumption was needed, e.g. an unspecified visa or location field. */
  rationale?: string
  confidence: SearchAssumptionConfidence
  /** Whether the user can correct this through the identity correction flow. */
  overridable: boolean
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
  citations?: Citation[]
  assumptions?: SearchAssumption[]
}

// ── Search Thesis ──────────────────────────────────────────────

export type SearchThesisSource = 'generated' | 'generated-fallback' | 'user-edited'

export type SearchUrgency = 'critical' | 'active' | 'exploratory'

export type SearchNoiseLevel = 'low' | 'medium' | 'high'

export interface SearchUnfairAdvantage {
  id: string
  /** Skill combination that creates competitive edge. */
  combination: string
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

export type SearchThesisSignalSeverity = 'hard' | 'soft' | 'conditional'

export interface SearchThesisSignal {
  id: string
  label: string
  condition?: string
  severity: SearchThesisSignalSeverity
}

export interface SearchTimeline {
  urgency: SearchUrgency
  deadline?: string
  /** How urgency affects search strategy. */
  strategyImpact: string
}

export interface SearchKeywordCombination {
  id: string
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
 * Per-search instance parameters inferred by the LLM from identity context and the search angle,
 * editable by the user without touching the base identity model. Each thesis carries its own copy
 * so two parallel searches can diverge (e.g., one explores adjacent titles with a relaxed comp
 * floor; another stays in the home lane with a strict location filter).
 */
export interface SearchInstanceOverrides {
  constraints: SearchProfileConstraints
  interviewPrefs: SearchInterviewPrefs
  /** Skill ids hidden from this search only — does not remove from identity. */
  hiddenSkillIds: string[]
}

/**
 * Strategic hypothesis that drives deep research execution.
 * Generated in Phase 1 (thesis generation), reviewed and corrected
 * by the user, then used as input to Phase 2 (deep research).
 */
export interface SearchThesis {
  id: string
  durableMeta?: DurableMetadata
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
  lookFor: SearchThesisSignal[]
  /** What to avoid, with qualifying conditions. */
  avoid: SearchThesisSignal[]

  /** Search urgency and timeline constraints. */
  timeline?: SearchTimeline
  /** Specific search queries per lane with noise level. */
  keywordCombinations: SearchKeywordCombination[]
  /** Per-skill semantic depth with context and search guidance. */
  skillDepthMap: SearchSkillDepthEntry[]
  /** Gap-filled inputs from Phase 1 thesis generation that the user should verify. */
  assumptions?: SearchAssumption[]

  /**
   * Per-search constraints/filters/interview prefs/hidden skills. Inferred by the generator
   * from identity context the first time, then user-editable. Distinct from identity defaults so
   * a per-search edit (e.g., "for this lane I'll consider lower comp") does not pollute the
   * identity model. Optional for backward compatibility with theses created before this layer.
   */
  searchOverrides?: SearchInstanceOverrides

  /**
   * User-supplied free-text correction notes. Submitted explicitly via "Regenerate with
   * corrections" — the next generation pass receives this as guidance and the field clears
   * once the new thesis is saved.
   */
  userCorrections?: string

  /**
   * Free-text directive that steers the generator toward a search angle the LLM could not
   * have inferred ("I want to research adjacent job titles", "explore early-stage CTO roles").
   * Unlike userCorrections, this is intent-shaping and persists across regenerations.
   */
  customDirective?: string

  /** Whether this thesis was AI-generated or user-edited. */
  source: SearchThesisSource
  /** Which identity model version this was derived from. */
  identityVersion: number
  /** Identity fields this thesis used, when generation can provide field-level dependencies. */
  identityFields?: string[]
  /** Last batch staleness review decision recorded for this artifact. */
  stalenessReview?: ArtifactStalenessReview
  /** IDs of feedback events that informed this thesis. */
  feedbackIncorporated: string[]
}

// ── Search Feedback Events (TASK-163) ─────────────────────────────────────

export type SearchFeedbackRating = 'up' | 'down'

/** User's suggested depth correction, e.g., "this should be 'conceptual' not 'strong'". */
export interface SearchFeedbackSkillDimension {
  name: string
  suggestedDepth?: string
}

export interface SearchFeedbackPreferenceDimension {
  category: 'prioritize' | 'avoid'
  label: string
  /** Qualifying condition, e.g., "building around k8s is fine, being a k8s admin is not". */
  condition?: string
}

export interface SearchFeedbackVectorDimension {
  title: string
  thesis?: string
}

/**
 * Structured signal attached to a feedback event. Each sub-field is optional; a
 * single event may carry any combination of skill, preference, and vector dimensions.
 */
export interface SearchFeedbackDimensions {
  skill?: SearchFeedbackSkillDimension
  preference?: SearchFeedbackPreferenceDimension
  vector?: SearchFeedbackVectorDimension
}

/**
 * A user reaction to a specific search result (thumbs up/down with optional reason and
 * structured dimensions). Persisted for two downstream consumers:
 *   1. Identity writeback (TASK-151.3) — `appliedToIdentity` flips true once absorbed.
 *   2. Thesis regeneration (TASK-151.1) — `reflectedInThesisId` records which thesis
 *      first incorporated the event, enabling `getUnreflectedFeedback()` queries.
 */
export interface SearchFeedbackEvent {
  id: string
  /** SearchRun this event was raised against. */
  runId: string
  /** SearchResultEntry within the run that the user reacted to. */
  resultId: string
  rating: SearchFeedbackRating
  /** Optional free-text rationale from the user. */
  reason?: string
  /** Structured signal derived from the reason (skill correction, preference add, etc.). */
  dimensions?: SearchFeedbackDimensions
  /** Whether the identity model has absorbed this event. Flipped by TASK-151.3 writeback. */
  appliedToIdentity: boolean
  /** `identity.model_revision` when absorption happened (TASK-159). */
  appliedAtVersion?: number
  /** Id of the first thesis that was regenerated with this event incorporated. */
  reflectedInThesisId?: string
  createdAt: string
  /** Most recent mutation time for merge conflict resolution. Optional for legacy snapshots. */
  updatedAt?: string
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
  /** Output-contract issues found after the model response was normalized. */
  contractViolations?: string[]
}

export interface ResearchJobError {
  code: string
  message: string
  retriable: boolean
}

export interface ResearchUsageBudgetWarning {
  code: 'research_budget_near_limit'
  message: string
  projectedRemainingCents: number | null
  limitCents: number | null
}

export interface ResearchUsageSnapshot {
  window: {
    since: string
    until: string
    windowMs: number
  }
  usage: {
    completedJobCount: number
    inFlightJobCount: number
    tokens: SearchTokenUsage
    spendCents: number
    completedSpendCents: number
    reservedCents: number
  }
  estimate: {
    model: string
    inputTokens: number
    outputTokens: number
    runCostCents: number
  }
  budget: {
    enforced: boolean
    limitCents: number | null
    remainingCents: number | null
    warningThresholdCents: number | null
    status: 'unlimited' | 'ok' | 'warning' | 'over'
    wouldExceedNextRun: boolean
  }
  warning: ResearchUsageBudgetWarning | null
}

export interface DeepResearchIdentityEvidence {
  archetype: string
  arc: string[]
  profiles: Array<{
    id: string
    tags: string[]
    text: string
  }>
  paioHighlights: string[]
  calibrations: string[]
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
  tenantId?: string | null
  accountId?: string | null
  thesisId: string
  /** Immutable thesis snapshot — runs do not mutate when the source thesis evolves. */
  thesisSnapshot: SearchThesis
  /** Raw identity evidence that keeps Phase 2 from over-compressing the approved thesis. */
  identityEvidence?: DeepResearchIdentityEvidence
  /** Client-owned output contract sent to the runner prompt at job creation time. */
  promptContract?: string
  /** `identity.model_revision` at job creation time (TASK-159). */
  identityVersion: number
  params: SearchRequest
  /** Stable duplicate-submit guard for thesisId + params + userId. */
  paramsHash: string
  status: ResearchJobStatus
  createdAt: string
  startedAt?: string
  heartbeatAt?: string
  completedAt?: string
  progress?: ResearchJobProgress
  result?: ResearchJobResult
  error?: ResearchJobError
  /** ISO timestamp at which the job record becomes eligible for cleanup. */
  ttlAt: string
}

export interface ActiveResearchJobState {
  jobId: string
  runId: string
  requestId: string
  thesisId: string
  status: ResearchJobStatus
  startedAt?: string
  lastObservedAt: string
}

export const DEFAULT_SEARCH_MAX_RESULTS: SearchRequestMaxResults = {
  tier1: 5,
  tier2: 10,
  tier3: 10,
}

export const EMPTY_SEARCH_INSTANCE_OVERRIDES: SearchInstanceOverrides = {
  constraints: {
    compensation: '',
    locations: [],
    clearance: '',
    companySize: '',
    industriesToAvoid: [],
    fundingStagesAcceptable: [],
    remotePolicies: [],
    remotePolicyNote: '',
    employmentTypes: [],
  },
  interviewPrefs: {
    strongFit: [],
    redFlags: [],
  },
  hiddenSkillIds: [],
}
