export type LinkedInOutputType =
  | 'profile_summary'
  | 'recruiter_outreach'
  | 'hiring_manager_outreach'

export interface LinkedInProfileDraft {
  id: string
  outputType?: LinkedInOutputType
  name: string
  focus: string
  audience: string
  headline: string
  about: string
  topSkills: string[]
  featuredHighlights: string[]
  outreachMessage?: string
  outreachTalkingPoints?: string[]
  generatedAt: string
}

export interface LinkedInProfileGenerationRequest {
  focus?: string
  audience?: string
  outputType?: LinkedInOutputType
  jdAnalysis?: import('./jdAnalysis').JDAnalysis | null
}
