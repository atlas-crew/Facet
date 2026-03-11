import type { PriorityByVector } from '../types'
import type { DurableMetadata } from './durable'

export interface CoverLetterParagraph {
  id: string
  label?: string
  text: string
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
}
