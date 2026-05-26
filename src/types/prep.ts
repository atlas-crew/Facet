import type { DurableMetadata } from './durable'
import type { ArtifactStalenessReview } from './artifactMeta'
import type { InterviewFormat } from './pipeline'
import type { JDAnalysis } from './jdAnalysis'

export type PrepCategory =
  | 'opener'
  | 'behavioral'
  | 'technical'
  | 'project'
  | 'metrics'
  | 'situational'

export const PREP_CATEGORY_VALUES = [
  'opener',
  'behavioral',
  'technical',
  'project',
  'metrics',
  'situational',
] as const satisfies readonly PrepCategory[]

export type PrepWorkspaceMode = 'edit' | 'homework' | 'live'

export type PrepCardConfidence = 'nailed_it' | 'okay' | 'needs_work'

export const PREP_CARD_CONFIDENCE_VALUES = [
  'nailed_it',
  'okay',
  'needs_work',
] as const satisfies readonly PrepCardConfidence[]

export type PrepContextGapPriority = 'required' | 'recommended' | 'optional'

export const PREP_CONTEXT_GAP_PRIORITY_VALUES = [
  'required',
  'recommended',
  'optional',
] as const satisfies readonly PrepContextGapPriority[]

export interface PrepContextGap {
  id: string
  section: string
  question: string
  why: string
  feedbackTarget?: string
  priority: PrepContextGapPriority
}

export interface PrepDeepDive {
  id?: string
  title: string
  content: string
}

export type PrepConditionalTone = 'pivot' | 'trap' | 'escalation'

export const PREP_CONDITIONAL_TONE_VALUES = [
  'pivot',
  'trap',
  'escalation',
] as const satisfies readonly PrepConditionalTone[]

export interface PrepConditional {
  id?: string
  /**
   * Default semantics:
   * - trigger: interviewer pushback or follow-up angle
   * - response: coached answer or pivot
   *
   * Trap semantics:
   * - trigger: the interviewer trap or misleading framing
   * - response: the candidate's reframe
   */
  trigger: string
  response: string
  tone?: PrepConditionalTone
}

export type PrepCardRoundStatus = 'worked' | 'fumbled' | 'untested' | 'practice-this'

export const PREP_CARD_ROUND_STATUS_VALUES = [
  'worked',
  'fumbled',
  'untested',
  'practice-this',
] as const satisfies readonly PrepCardRoundStatus[]

export interface PrepMetric {
  id?: string
  value: string
  label: string
}

export interface PrepIdentityMetricCandidate {
  roleId: string
  roleTitle: string
  company: string
  bulletId: string
  metricKey: string
  metricValue: string
  suggestedLabel: string
  evidence: string
}

export interface PrepIdentityContext {
  candidate_metrics?: PrepIdentityMetricCandidate[]
  fallback_candidate_metrics?: PrepIdentityMetricCandidate[]
  [key: string]: unknown
}

export interface PrepPipelineResearchPersonContext {
  name: string
  title?: string
  company?: string
  profileUrl?: string
  relevance?: string
}

export interface PrepPipelineResearchSourceContext {
  label: string
  url?: string
  kind: string
}

/**
 * Per-round slice of pipeline context handed to the prep generator when a
 * specific `PipelineRound` is targeted for prep-gen. Carries the round's
 * identity and — critically — the user-sourced interviewer list. No research-
 * discovered people ever flow in here: AI-inferred interviewer identities are
 * unreliable (see doc-30 §Interviewer Capture and the ai-inference-vs-user-
 * input rule). If `interviewers[]` is empty, the generator must not emit any
 * interviewer intel for the deck.
 */
export interface PrepPipelineRoundInterviewerContext {
  id: string
  name: string
  title?: string
  linkedInUrl?: string
  /**
   * Pre-populated intel from prior T3 research on this person. Step 5 of
   * doc-30 writes here; step 4 passes through whatever the pipeline store
   * already holds (typically undefined until T3 runs).
   */
  intel?: PrepInterviewerIntel
  lineThatLands?: string
}

export interface PrepPipelineRoundContext {
  id: string
  label: string
  format: InterviewFormat
  scheduledFor?: string
  interviewers: PrepPipelineRoundInterviewerContext[]
}

export interface PrepPipelineEntryContext {
  company: string
  role: string
  tier: string
  status: string
  appMethod: string
  response: string
  nextStep?: string
  formats: string[]
  url?: string
  positioning?: string
  skillMatch?: string
  notes?: string
  research?: {
    status: string
    summary?: string
    jobDescriptionSummary?: string
    interviewSignals: string[]
    sources: PrepPipelineResearchSourceContext[]
    searchQueries: string[]
    lastInvestigatedAt?: string
  }
  /**
   * Populated when the prep-gen targets a specific round on this entry.
   * Absence means deck-generation is at the entry level (pre-panel-known)
   * and the generator should not emit interviewer intel.
   */
  round?: PrepPipelineRoundContext
}

export interface PrepNumbersToKnow {
  candidate?: PrepMetric[]
  company?: PrepMetric[]
}

export type PrepStackAlignmentConfidence =
  | 'Strong'
  | 'Solid'
  | 'Working knowledge'
  | 'Adjacent experience'
  | 'Gap'

export const PREP_STACK_ALIGNMENT_CONFIDENCE_VALUES = [
  'Strong',
  'Solid',
  'Working knowledge',
  'Adjacent experience',
  'Gap',
] as const satisfies readonly PrepStackAlignmentConfidence[]

export function isPrepStackAlignmentConfidence(
  value: unknown,
): value is PrepStackAlignmentConfidence {
  return (
    typeof value === 'string' &&
    (PREP_STACK_ALIGNMENT_CONFIDENCE_VALUES as readonly string[]).includes(value)
  )
}

export interface PrepStackAlignmentRow {
  theirTech: string
  yourMatch: string
  confidence: PrepStackAlignmentConfidence
}

export type PrepStoryBlockLabel = 'problem' | 'solution' | 'result' | 'closer' | 'note'

export const PREP_STORY_BLOCK_LABEL_VALUES = [
  'problem',
  'solution',
  'result',
  'closer',
  'note',
] as const satisfies readonly PrepStoryBlockLabel[]

export interface PrepStoryBlock {
  label: PrepStoryBlockLabel
  text: string
}

export interface PrepQuestionToAsk {
  question: string
  context: string
}

export interface PrepFollowUp {
  id?: string
  question: string
  answer: string
  context?: string
}

export interface PrepInterviewerIntel {
  role?: string
  background?: string
  stack?: string
  caresAbout?: string
  yourAngle?: string
  keyTell?: string
  linkedInPositioning?: string
  education?: string
}

export const PREP_COMPANY_AI_POSTURE_STRENGTH_VALUES = [
  'strong',
  'moderate',
  'weak',
  'unknown',
] as const

export type PrepCompanyAiPostureStrength = (typeof PREP_COMPANY_AI_POSTURE_STRENGTH_VALUES)[number]

export interface PrepCompanyAiPosture {
  strength: PrepCompanyAiPostureStrength
  narrative: string
  signals?: string[]
}

export interface PrepCompanyIntel {
  whatTheyDo?: string
  scale?: string
  theRole?: string
  stack?: string
  team?: string
  aiPosture?: PrepCompanyAiPosture
  other?: Record<string, string>
}

export const PREP_INTERVIEWER_LIKELY_ROLE_VALUES = [
  'hiring-manager',
  'above-hm',
  'peer',
  'skip-level',
  'cross-functional',
  'recruiter',
  'unknown',
] as const

export type PrepInterviewerLikelyRole = (typeof PREP_INTERVIEWER_LIKELY_ROLE_VALUES)[number]

export interface PrepInterviewer {
  id: string
  name: string
  title?: string
  linkedInUrl?: string
  intel: PrepInterviewerIntel
  likelyRole?: PrepInterviewerLikelyRole
  coachingNote?: string
  /**
   * One-liner tuned to this interviewer's known concern — mirrors what
   * they care about back at them. Grounded in `intel.caresAbout`; should
   * reference a specific observed concern, never a generic platitude.
   */
  lineThatLands?: string
  metInRounds?: number[]
  notes?: string
}

export interface PrepRoundDebriefIntel {
  teamCulture?: string
  aiUsage?: string
  topChallenge?: string
  volume?: string
  securityPosture?: string
  goodSigns?: string[]
  redFlags?: string[]
  other?: Record<string, string>
}

export interface PrepRoundDebrief {
  round: number
  date: string
  intel: PrepRoundDebriefIntel
  questionsAsked: string[]
  surprises: string[]
  newIntel: string[]
  notes?: string
}

export interface PrepCardRoundState {
  round: number
  status: PrepCardRoundStatus
  notes?: string
}

export interface PrepStoryVariant {
  id: string
  label: string
  storyBlocks: PrepStoryBlock[]
  keyPoints?: string[]
  roleContext?: string
  when?: string
}

export interface PrepAnchorSubDecision {
  id: string
  title: string
  tag?: string
  blocks: PrepStoryBlock[]
  pushbackResponse?: string
  honestTradeoff?: string
}

export interface PrepDecisionOption {
  option: string
  whenRight: string
  tradeoff: string
}

export interface PrepDecisionTreeNode {
  title: string
  options?: PrepDecisionOption[]
  recommendation?: string
  trap?: string
}

export interface PrepPhasedFrameworkPhase {
  phase: string
  timeframe?: string
  bullets: string[]
}

export const PREP_SCRIPT_KIND_VALUES = [
  // `opener` and `closer` intentionally overlap with PrepCardKind values;
  // this enum names the script's rhetorical role, not the card's shape.
  'opener',
  'honest-bridge',
  'closer',
  'line-that-lands',
  'pivot',
] as const

export type PrepScriptKind = (typeof PREP_SCRIPT_KIND_VALUES)[number]

export function isPrepScriptKind(value: unknown): value is PrepScriptKind {
  return typeof value === 'string' && (PREP_SCRIPT_KIND_VALUES as readonly string[]).includes(value)
}

export function parsePrepScriptKind(value: unknown): PrepScriptKind | undefined {
  const normalized = typeof value === 'string' ? value.trim() : ''
  return isPrepScriptKind(normalized) ? normalized : undefined
}

export const PREP_CARD_KIND_VALUES = [
  'opener',
  'intel',
  'story',
  'anchor',
  'scenario',
  'deep-dive',
  'closer',
  'reference',
  'followup-qa',
] as const

export type PrepCardKind = (typeof PREP_CARD_KIND_VALUES)[number]

export function isPrepCardKind(value: unknown): value is PrepCardKind {
  return typeof value === 'string' && (PREP_CARD_KIND_VALUES as readonly string[]).includes(value)
}

export function parsePrepCardKind(value: unknown): PrepCardKind | undefined {
  const normalized = typeof value === 'string' ? value.trim() : ''
  return isPrepCardKind(normalized) ? normalized : undefined
}

/**
 * `category` is the topical bucket users scan by; `kind` is the card's
 * structural/rendering shape. They may match for openers, but they are
 * independent axes: a technical card can still be a story-shaped card.
 * Missing legacy kinds fall back through tag/interviewer/category inference; explicit
 * malformed kinds return undefined so callers choose their boundary behavior.
 */
export function resolvePrepCardKind(
  value: unknown,
  context: { category?: unknown; tags?: unknown; interviewerIds?: unknown } = {},
): PrepCardKind | undefined {
  const parsed = parsePrepCardKind(value)
  if (parsed) return parsed
  if (value !== undefined && value !== null) return undefined

  const tags = Array.isArray(context.tags)
    ? context.tags.flatMap((tag) => (typeof tag === 'string' ? [tag.trim().toLowerCase()] : []))
    : []

  // Inference priority is intentionally legacy-shape based, not the PREP_CARD_KIND_VALUES order.
  if (tags.includes('intel')) return 'intel'
  if (Array.isArray(context.interviewerIds) && context.interviewerIds.length >= 1) {
    return 'intel'
  }
  if (context.category === 'opener') return 'opener'
  return 'story'
}

export interface PrepCardBase {
  id: string
  deckId?: string
  category: PrepCategory
  title: string
  tags: string[]
  timeBudgetMinutes?: number
  notes?: string
  source?: 'ai' | 'manual' | 'imported'
  company?: string
  role?: string
  vectorId?: string
  pipelineEntryId?: string | null
  /**
   * IDs of interviewers this card is tuned for. References
   * `PrepDeck.interviewers[].id`. Intel cards typically have exactly
   * one; a story card may be tagged to multiple panelists.
   */
  interviewerIds?: string[]
  updatedAt?: string

  script?: string
  /**
   * Structural script role used by renderers and generators. Keep
   * `scriptLabel` as prose for the user's eyes.
   */
  scriptKind?: PrepScriptKind
  scriptLabel?: string
  /** Expanded same-question answer when the interviewer asks for more detail. */
  pushbackScript?: string
  pushbackLabel?: string
  /** Optional backup narrative when the same requirement has a second credible proof point. */
  alternativeTitle?: string
  alternativeScript?: string
  warning?: string
  storyBlocks?: PrepStoryBlock[]
  storyVariants?: PrepStoryVariant[]
  keyPoints?: string[]
  followUps?: PrepFollowUp[]
  deepDives?: PrepDeepDive[]
  conditionals?: PrepConditional[]
  metrics?: PrepMetric[]
  tableData?: {
    headers: string[]
    rows: string[][]
  }
  perRoundState?: PrepCardRoundState[]
}

export interface PrepOpenerCard extends PrepCardBase {
  kind: 'opener'
}

export interface PrepIntelCard extends PrepCardBase {
  kind: 'intel'
}

export interface PrepStoryCard extends PrepCardBase {
  kind: 'story'
}

export interface PrepAnchorCard extends PrepCardBase {
  kind: 'anchor'
  storyBlocks: PrepStoryBlock[]
  subDecisions: PrepAnchorSubDecision[]
}

export interface PrepScenarioCard extends PrepCardBase {
  kind: 'scenario'
  whyLikely: string
  decisionTree?: PrepDecisionTreeNode[]
  phasedFramework?: PrepPhasedFrameworkPhase[]
}

export interface PrepDeepDiveCard extends PrepCardBase {
  kind: 'deep-dive'
}

export interface PrepCloserCard extends PrepCardBase {
  kind: 'closer'
}

export interface PrepReferenceCard extends PrepCardBase {
  kind: 'reference'
}

export interface PrepFollowUpQACard extends PrepCardBase {
  kind: 'followup-qa'
}

export type PrepCard =
  | PrepOpenerCard
  | PrepIntelCard
  | PrepStoryCard
  | PrepAnchorCard
  | PrepScenarioCard
  | PrepDeepDiveCard
  | PrepCloserCard
  | PrepReferenceCard
  | PrepFollowUpQACard

export type PrepCardPatch = Partial<Omit<PrepCardBase, 'id' | 'deckId'>> &
  Partial<Pick<PrepAnchorCard, 'subDecisions'>> &
  Partial<Pick<PrepScenarioCard, 'whyLikely' | 'decisionTree' | 'phasedFramework'>> & {
    kind?: PrepCardKind
  }

export function isOpenerCard(card: PrepCard): card is PrepOpenerCard {
  return card.kind === 'opener'
}

export function isIntelCard(card: PrepCard): card is PrepIntelCard {
  return card.kind === 'intel'
}

export function isStoryCard(card: PrepCard): card is PrepStoryCard {
  return card.kind === 'story'
}

export function isAnchorCard(card: PrepCard): card is PrepAnchorCard {
  return card.kind === 'anchor'
}

export function isScenarioCard(card: PrepCard): card is PrepScenarioCard {
  return card.kind === 'scenario'
}

export function isDeepDiveCard(card: PrepCard): card is PrepDeepDiveCard {
  return card.kind === 'deep-dive'
}

export function isCloserCard(card: PrepCard): card is PrepCloserCard {
  return card.kind === 'closer'
}

export function isReferenceCard(card: PrepCard): card is PrepReferenceCard {
  return card.kind === 'reference'
}

export function isFollowUpQACard(card: PrepCard): card is PrepFollowUpQACard {
  return card.kind === 'followup-qa'
}

export interface PrepCardStudyState {
  confidence?: PrepCardConfidence
  attempts: number
  needsWorkCount: number
  lastReviewedAt?: string
}

export interface PrepDeck {
  id: string
  durableMeta?: DurableMetadata
  title: string
  company: string
  role: string
  vectorId?: string
  pipelineEntryId: string | null
  /**
   * Set when the deck was generated for a specific `PipelineRound`. Links
   * deck.interviewers[] back to the user-sourced names in the pipeline (the
   * generator does not populate interviewers unless a round ID is supplied).
   */
  pipelineRoundId?: string | null
  companyUrl?: string
  skillMatch?: string
  positioning?: string
  roundType?: InterviewFormat
  notes?: string
  /**
   * Reusable drill framework for technical/situational "How would you..."
   * answers. Live mode renders it on technical and situational sections, and
   * regeneration preserves it when the model omits a fresh value.
   */
  answerTemplate?: string
  companyResearch?: string
  companyIntel?: PrepCompanyIntel
  /**
   * Structured distillation of interviewer intel derived from company
   * research + pipeline entry context. Each panel member / technical
   * round interviewer gets one entry. Cards reference these via
   * `PrepCard.interviewerIds`.
   */
  interviewers?: PrepInterviewer[]
  jobDescription?: string
  jdAnalysisId?: string | null
  jdAnalysisGeneratedAt?: string | null
  jdAnalysisModelVersion?: string | null
  jdTextHash?: string | null
  rules?: string[]
  donts?: string[]
  questionsToAsk?: PrepQuestionToAsk[]
  numbersToKnow?: PrepNumbersToKnow
  stackAlignment?: PrepStackAlignmentRow[]
  categoryGuidance?: Record<string, string>
  contextGaps?: PrepContextGap[]
  contextGapAnswers?: Record<string, string>
  contractViolations?: PrepContractViolation[]
  openerCardId?: string
  closerCardId?: string
  roundNumber?: number
  roundDebriefs?: PrepRoundDebrief[]
  generatedAt?: string
  identityVersion?: number
  /** Field-level dependencies are preserved when supplied; prep generators can populate this for precision beyond version fallback. */
  identityFields?: string[]
  /** Last batch staleness review decision recorded for this artifact. */
  stalenessReview?: ArtifactStalenessReview
  updatedAt: string
  cards: PrepCard[]
  studyProgress?: Record<string, PrepCardStudyState>
}

export const PREP_CONTRACT_VIOLATION_KINDS = [
  'missing-field',
  'invalid-field',
  'short-prose',
  'missing-coaching',
  'missing-intel',
  'missing-landmine',
] as const

export type PrepContractViolationKind = (typeof PREP_CONTRACT_VIOLATION_KINDS)[number]

export const PREP_CONTRACT_VIOLATION_SEVERITIES = ['error', 'warning'] as const

export type PrepContractViolationSeverity = (typeof PREP_CONTRACT_VIOLATION_SEVERITIES)[number]

export interface PrepContractViolation {
  kind: PrepContractViolationKind
  cardId?: string
  field: string
  message: string
  severity: PrepContractViolationSeverity
}

export interface PrepGenerationResult {
  deck: PrepDeck
  companyResearchSummary: string
  contractViolations: PrepContractViolation[]
}

export interface PrepGenerationRequest {
  company: string
  role: string
  vectorId?: string
  vectorLabel?: string
  roundNumber?: number
  companyUrl?: string
  skillMatch?: string
  positioning?: string
  roundType?: InterviewFormat
  notes?: string
  companyResearch?: string
  jobDescription: string
  jdAnalysis: JDAnalysis
  identityContext?: PrepIdentityContext
  pipelineEntryContext?: PrepPipelineEntryContext
  /**
   * When set, the deck is scoped to a specific `PipelineRound`. The generator
   * uses the round's user-sourced interviewer names as the source of truth
   * for `PrepDeck.interviewers[]`; when unset, no interviewer intel is
   * emitted (doc-30 §Interviewer Capture — no AI-inferred identities).
   */
  pipelineRoundId?: string | null
  donts?: string[]
  questionsToAsk?: PrepQuestionToAsk[]
  categoryGuidance?: Record<string, string>
  contextGaps?: PrepContextGap[]
  contextGapAnswers?: Record<string, string>
  priorRoundDebriefs?: PrepRoundDebrief[]
  priorRoundCards?: PrepCard[]
  resumeContext: Record<string, unknown>
}
