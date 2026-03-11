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
}
