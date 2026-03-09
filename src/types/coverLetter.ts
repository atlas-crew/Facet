import type { PriorityByVector } from '../types'

export interface CoverLetterParagraph {
  id: string
  label?: string
  text: string
  vectors: PriorityByVector
}

export interface CoverLetterTemplate {
  id: string
  name: string
  header: string
  greeting: string
  paragraphs: CoverLetterParagraph[]
  signOff: string
}
