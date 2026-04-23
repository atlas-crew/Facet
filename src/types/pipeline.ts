import type { DurableMetadata } from './durable'
import type { PrepInterviewerIntel } from './prep'
import type { PipelineResumeGenerationState } from './resumeGeneration'

export type PipelineStatus =
  | 'researching'
  | 'applied'
  | 'screening'
  | 'interviewing'
  | 'offer'
  | 'accepted'
  | 'rejected'
  | 'withdrawn'
  | 'closed'

export type PipelineTier = '1' | '2' | '3' | 'watch'

export type ApplicationMethod =
  | 'direct-apply'
  | 'referral'
  | 'recruiter-inbound'
  | 'recruiter-outbound'
  | 'cold-email'
  | 'linkedin'
  | 'unknown'

export type ResponseType =
  | 'none'
  | 'auto-reject'
  | 'human-reject'
  | 'screen-scheduled'
  | 'interview-scheduled'
  | 'direct-to-hm'

export type InterviewFormat =
  | 'hr-screen'
  | 'hm-screen'
  | 'tech-discussion'
  | 'system-design'
  | 'take-home'
  | 'live-coding'
  | 'leetcode'
  | 'pair-programming'
  | 'behavioral'
  | 'peer-panel'
  | 'cross-team'
  | 'exec'
  | 'presentation'

export const INTERVIEW_FORMAT_VALUES = [
  'hr-screen',
  'hm-screen',
  'tech-discussion',
  'system-design',
  'take-home',
  'live-coding',
  'leetcode',
  'pair-programming',
  'behavioral',
  'peer-panel',
  'cross-team',
  'exec',
  'presentation',
] as const satisfies readonly InterviewFormat[]

export type RejectionStage =
  | 'resume-screen'
  | 'recruiter-screen'
  | 'hm-screen'
  | 'technical'
  | 'final'
  | 'offer-declined'
  | 'withdrew'
  | 'ghosted'
  | ''

export interface PipelineHistoryEntry {
  date: string
  note: string
}

export type PipelineResearchStatus = 'seeded' | 'investigated'

export type PipelineResearchSourceKind =
  | 'job-posting'
  | 'search-result'
  | 'company'
  | 'people'
  | 'review'
  | 'other'

export interface PipelineResearchSource {
  label: string
  url?: string
  kind: PipelineResearchSourceKind
}

export interface PipelineResearchPerson {
  name: string
  title: string
  company: string
  profileUrl?: string
  relevance: string
}

export interface PipelineResearchSnapshot {
  status: PipelineResearchStatus
  summary: string
  jobDescriptionSummary: string
  interviewSignals: string[]
  /**
   * @deprecated T2 investigation no longer discovers people (see
   * `pipelineInvestigation.ts` commit 8231992 and doc-30 §Interviewer Capture).
   * Historical entries may still carry values here; readers should ignore them.
   * Interviewer names live on `PipelineRound.interviewers[]` — user-sourced.
   */
  people: PipelineResearchPerson[]
  sources: PipelineResearchSource[]
  searchQueries: string[]
  lastInvestigatedAt: string
}

export type PipelineRoundOutcome =
  | 'pending'
  | 'advanced'
  | 'rejected'
  | 'ghosted'
  | 'completed'

export const PIPELINE_ROUND_OUTCOME_VALUES = [
  'pending',
  'advanced',
  'rejected',
  'ghosted',
  'completed',
] as const satisfies readonly PipelineRoundOutcome[]

/**
 * A named interviewer on a specific round. Always user-sourced — we do not
 * auto-discover interviewers via AI (see doc-30 §Interviewer Capture and the
 * `ai-inference-vs-user-input` rule). `dossier` is populated by T3 per-person
 * research at prep-gen time.
 */
export interface PipelineInterviewer {
  id: string
  name: string
  title?: string
  linkedInUrl?: string
  /**
   * T3 research output. Populated on prep-gen-intent; empty until then. The
   * shape is intentionally `PrepInterviewerIntel` (from `./prep`) so the prep
   * generator reads dossiers directly without re-deriving.
   */
  dossier?: PrepInterviewerIntel
  /**
   * One-liner tuned to this interviewer's known concern. Grounded in
   * `dossier.caresAbout`; composed by T3 alongside the dossier itself.
   */
  lineThatLands?: string
  researchedAt?: string
}

/**
 * A distinct interview round within a pipeline entry. Rounds are first-class
 * to support per-round scheduling, interviewer capture, prep-deck linkage, and
 * outcome tracking. The calendar view reads this shape aggregated across
 * entries. See doc-30 §Target Shape.
 */
export interface PipelineRound {
  id: string
  /** Human label: "HM screen", "Doug technical", "Panel", etc. */
  label: string
  format: InterviewFormat
  /** ISO 8601; nullable until scheduling is known. */
  scheduledFor?: string
  durationMinutes?: number
  interviewers: PipelineInterviewer[]
  /** Link to the generated PrepDeck. One prep deck per round in v1. */
  prepDeckId?: string
  outcome?: PipelineRoundOutcome
  outcomeAt?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface PipelineEntry {
  id: string
  durableMeta?: DurableMetadata
  company: string
  role: string
  tier: PipelineTier
  status: PipelineStatus
  comp: string
  url: string
  contact: string

  // Facet integration
  vectorId: string | null
  jobDescription: string
  presetId: string | null
  resumeVariant: string
  resumeGeneration: PipelineResumeGenerationState | null

  // Positioning
  positioning: string
  skillMatch: string
  nextStep: string
  notes: string

  // Outcome tracking
  appMethod: ApplicationMethod
  response: ResponseType
  daysToResponse: number | null
  rounds: number | null
  format: InterviewFormat[]
  rejectionStage: RejectionStage
  rejectionReason: string
  offerAmount: string

  // Dates
  dateApplied: string
  dateClosed: string
  lastAction: string
  createdAt: string

  // History
  history: PipelineHistoryEntry[]
  research?: PipelineResearchSnapshot

  /**
   * Structured interview rounds per doc-30. Optional until UI/generator wiring
   * lands; empty or undefined arrays are treated as "no structured rounds yet."
   * The legacy scalar `rounds: number | null` above remains for backcompat and
   * will be derived from `interviewRounds.length` in a later pass.
   */
  interviewRounds?: PipelineRound[]
}
