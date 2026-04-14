import type { DurableMetadata } from './durable'

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

export interface PrepDeepDive {
  id?: string
  title: string
  content: string
}

export interface PrepMetric {
  id?: string
  value: string
  label: string
}

export interface PrepFollowUp {
  id?: string
  question: string
  answer: string
}

export interface PrepCard {
  id: string
  deckId?: string
  category: PrepCategory
  title: string
  tags: string[]
  notes?: string
  source?: 'ai' | 'manual' | 'imported'
  company?: string
  role?: string
  vectorId?: string
  pipelineEntryId?: string | null
  updatedAt?: string

  script?: string
  warning?: string
  followUps?: PrepFollowUp[]
  deepDives?: PrepDeepDive[]
  metrics?: PrepMetric[]
  tableData?: {
    headers: string[]
    rows: string[][]
  }
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
  vectorId: string
  pipelineEntryId: string | null
  companyUrl?: string
  skillMatch?: string
  positioning?: string
  notes?: string
  companyResearch?: string
  jobDescription?: string
  generatedAt?: string
  updatedAt: string
  cards: PrepCard[]
  studyProgress?: Record<string, PrepCardStudyState>
}

export interface PrepGenerationRequest {
  company: string
  role: string
  vectorId: string
  vectorLabel: string
  companyUrl?: string
  skillMatch?: string
  positioning?: string
  notes?: string
  companyResearch?: string
  jobDescription: string
  resumeContext: Record<string, unknown>
}
