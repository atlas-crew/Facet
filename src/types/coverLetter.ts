import type { ComponentPriority, VectorId } from '../types'
import type { ArtifactStalenessReview } from './artifactMeta'
import type { DurableMetadata } from './durable'

export interface CoverLetterParagraph {
  id: string
  label?: string
  text: string
  refinement?: string
  vectors: Record<VectorId, ComponentPriority>
}

export interface CoverLetterContent {
  name: string
  header: string
  greeting: string
  paragraphs: CoverLetterParagraph[]
  signOff: string
}

export interface CoverLetterTemplate extends CoverLetterContent {
  id: string
  durableMeta?: DurableMetadata
  source?: 'manual' | 'match' | 'pipeline'
  pipelineEntryId?: string
  generatedAt?: string
  identityVersion?: number
  /** Field-level dependencies are preserved when supplied; letter generation can populate this for precision beyond version fallback. */
  identityFields?: string[]
  /** Last batch staleness review decision recorded for this artifact. */
  stalenessReview?: ArtifactStalenessReview
}

export interface CoverLetter extends CoverLetterContent {
  id: string
  durableMeta?: DurableMetadata
  pipelineEntryId: string
  sourceResumeId: string
  sourceResumeHash: string
  contentHash: string
  createdAt: string
  updatedAt: string
  source: 'pipeline'
  generatedAt?: string
  identityVersion: number | null
  identityFields?: string[]
  stalenessReview?: ArtifactStalenessReview
}

export interface CoverLetterSnapshot {
  id: string
  sourceLetterId: string
  pipelineEntryId: string
  sourceResumeId: string
  sourceResumeHash: string
  sourceResumeSnapshotId: string
  content: CoverLetterContent
  contentHash: string
  identityVersionAtGeneration: number | null
  identityVersionAtApply: number | null
  createdAt: string
}

export interface CoverLetterWorkspaceData {
  letters: CoverLetter[]
  snapshots: CoverLetterSnapshot[]
}
