import type { DurableMetadata } from './durable'

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
  people: PipelineResearchPerson[]
  sources: PipelineResearchSource[]
  searchQueries: string[]
  lastInvestigatedAt: string
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
}
