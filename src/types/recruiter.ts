import type { DurableMetadata } from './durable'

export interface RecruiterCard {
  id: string
  durableMeta?: DurableMetadata
  generatedAt: string
  company: string
  role: string
  candidateName: string
  candidateTitle: string
  matchScore: number
  matchScoreMethodology: string
  summary: string
  recruiterHook: string
  suggestedIntro: string
  topReasons: string[]
  proofPoints: string[]
  skillHighlights: string[]
  likelyConcerns: string[]
  actionCta: string
}
