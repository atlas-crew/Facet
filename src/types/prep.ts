import type { DurableMetadata } from './durable'
import type { InterviewFormat } from './pipeline'

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

export const PREP_CARD_CONFIDENCE_VALUES = ['nailed_it', 'okay', 'needs_work'] as const satisfies readonly PrepCardConfidence[]

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
    people: PrepPipelineResearchPersonContext[]
    sources: PrepPipelineResearchSourceContext[]
    searchQueries: string[]
    lastInvestigatedAt?: string
  }
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

export function isPrepStackAlignmentConfidence(value: unknown): value is PrepStackAlignmentConfidence {
  return typeof value === 'string' && (PREP_STACK_ALIGNMENT_CONFIDENCE_VALUES as readonly string[]).includes(value)
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

export interface PrepCard {
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
  updatedAt?: string

  script?: string
  scriptLabel?: string
  warning?: string
  storyBlocks?: PrepStoryBlock[]
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
  companyUrl?: string
  skillMatch?: string
  positioning?: string
  roundType?: InterviewFormat
  notes?: string
  companyResearch?: string
  jobDescription?: string
  rules?: string[]
  donts?: string[]
  questionsToAsk?: PrepQuestionToAsk[]
  numbersToKnow?: PrepNumbersToKnow
  stackAlignment?: PrepStackAlignmentRow[]
  categoryGuidance?: Record<string, string>
  contextGaps?: PrepContextGap[]
  contextGapAnswers?: Record<string, string>
  roundNumber?: number
  roundDebriefs?: PrepRoundDebrief[]
  generatedAt?: string
  updatedAt: string
  cards: PrepCard[]
  studyProgress?: Record<string, PrepCardStudyState>
}

export interface PrepContractViolation {
  kind: 'missing-field' | 'short-prose' | 'missing-coaching' | 'missing-intel' | 'missing-landmine'
  cardId?: string
  field: string
  message: string
  severity: 'error' | 'warning'
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
  identityContext?: PrepIdentityContext
  pipelineEntryContext?: PrepPipelineEntryContext
  donts?: string[]
  questionsToAsk?: PrepQuestionToAsk[]
  categoryGuidance?: Record<string, string>
  contextGaps?: PrepContextGap[]
  contextGapAnswers?: Record<string, string>
  priorRoundDebriefs?: PrepRoundDebrief[]
  priorRoundCards?: PrepCard[]
  resumeContext: Record<string, unknown>
}
