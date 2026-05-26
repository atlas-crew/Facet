import type { ProfessionalIdentityV3, ProfessionalRoleBullet } from '../identity/schema'
import type {
  IdentityAssumptionTag,
  IdentityDraftBullet,
  IdentityExtractionDraft,
} from './identity'
import type { JDAnalysis } from './jdAnalysis'

export type DebriefSourceKind = 'match' | 'pipeline'
export type DebriefInterviewOutcome = 'advance' | 'hold' | 'reject' | 'unknown'
export type DebriefStoryOutcome = 'strong' | 'mixed' | 'weak'

export interface DebriefStoryCapture {
  id: string
  roleId: string
  bulletId: string
  notes: string
  interviewerSignal?: string
  outcome: DebriefStoryOutcome
}

export interface DebriefQuestionReview {
  question: string
  takeaway?: string
}

export interface DebriefPatternSignal {
  id: string
  label: string
  reason: string
  roleId?: string
  bulletId?: string
}

export interface DebriefPatternSummaryItem extends DebriefPatternSignal {
  count: number
}

export interface DebriefPatternSummary {
  anchorStories: DebriefPatternSummaryItem[]
  recurringGaps: DebriefPatternSummaryItem[]
  bestFitCompanyTypes: DebriefPatternSummaryItem[]
}

export interface DebriefIdentityBulletUpdate {
  roleId: string
  bulletId: string
  addTags: string[]
  impactAdditions: string[]
  portfolioDive?: string | null
}

export interface DebriefIdentityNewBullet {
  roleId: string
  bullet: ProfessionalRoleBullet
  rewrite?: string
  assumptions?: IdentityAssumptionTag[]
}

export type DebriefIdentityRewrite = IdentityDraftBullet

export interface DebriefIdentityPatch {
  summary: string
  correctionNotes: string[]
  followUpQuestions: string[]
  updatedInterviewStyle?: {
    strengths?: string[]
    weaknesses?: string[]
    prep_strategy?: string
  }
  bulletUpdates: DebriefIdentityBulletUpdate[]
  newBullets: DebriefIdentityNewBullet[]
  rewrites: DebriefIdentityRewrite[]
}

export interface DebriefGenerationRequest {
  company: string
  role: string
  sourceKind: DebriefSourceKind
  jobDescription?: string
  jdAnalysis?: JDAnalysis
  matchSummary?: string
  positioningNotes?: string
  roundName: string
  interviewDate: string
  outcome: DebriefInterviewOutcome
  rawNotes: string
  questionsAsked: string[]
  whatWorked: string[]
  whatDidnt: string[]
  storiesTold: DebriefStoryCapture[]
  currentIdentity: ProfessionalIdentityV3
}

export interface DebriefGenerationResult {
  summary: string
  overallTakeaway: string
  questionsAsked: DebriefQuestionReview[]
  whatWorked: string[]
  whatDidnt: string[]
  anchorStories: DebriefPatternSignal[]
  recurringGaps: DebriefPatternSignal[]
  bestFitCompanyTypes: DebriefPatternSignal[]
  identityPatch: DebriefIdentityPatch
  warnings: string[]
}

export interface DebriefSession {
  id: string
  generatedAt: string
  company: string
  role: string
  sourceKind: DebriefSourceKind
  pipelineEntryId: string | null
  roundName: string
  interviewDate: string
  outcome: DebriefInterviewOutcome
  jobDescription?: string
  rawNotes: string
  questionsAsked: DebriefQuestionReview[]
  whatWorked: string[]
  whatDidnt: string[]
  storiesTold: DebriefStoryCapture[]
  summary: string
  overallTakeaway: string
  anchorStories: DebriefPatternSignal[]
  recurringGaps: DebriefPatternSignal[]
  bestFitCompanyTypes: DebriefPatternSignal[]
  identityDraft: IdentityExtractionDraft
  correctionNotes: string[]
  followUpQuestions: string[]
  warnings: string[]
}
