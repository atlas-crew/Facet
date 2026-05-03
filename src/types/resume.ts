import type { ResumeData } from '../types'
import type { ResumeGenerationSourceKind } from './resumeGeneration'

export type ResumeOriginType = 'vector' | 'ephemeral_vector' | 'dynamic'

export interface ResumeOrigin {
  type: ResumeOriginType
  vectorId?: string | null
  vectorIds?: string[]
  generationSource?: ResumeGenerationSourceKind
  pipelineEntryId?: string | null
}

export interface ResumeEntity {
  id: string
  content: ResumeData
  contentHash: string
  origin: ResumeOrigin
  identityVersion: number | null
  pipelineEntryId?: string | null
  createdAt: string
  updatedAt: string
}

export interface ResumeSnapshot {
  id: string
  sourceResumeId: string
  pipelineEntryId: string
  content: ResumeData
  contentHash: string
  origin: ResumeOrigin
  identityVersion: number | null
  createdAt: string
}

export interface ResumeWorkspaceData {
  data: ResumeData
  resumes: ResumeEntity[]
  snapshots: ResumeSnapshot[]
  activeResumeId: string | null
}
