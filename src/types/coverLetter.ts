import type { PriorityByVector } from '../types'
import type { ArtifactStalenessReview } from './artifactMeta'
import type { DurableMetadata } from './durable'

export interface CoverLetterParagraph {
  id: string
  label?: string
  text: string
  refinement?: string
  vectors: PriorityByVector
}

export interface CoverLetterTemplate {
  id: string
  durableMeta?: DurableMetadata
  name: string
  header: string
  greeting: string
  paragraphs: CoverLetterParagraph[]
  signOff: string
  source?: 'manual' | 'match' | 'pipeline'
  pipelineEntryId?: string
  generatedAt?: string
  identityVersion?: number
  /** Field-level dependencies are preserved when supplied; letter generation can populate this for precision beyond version fallback. */
  identityFields?: string[]
  /** Last batch staleness review decision recorded for this artifact. */
  stalenessReview?: ArtifactStalenessReview
}
