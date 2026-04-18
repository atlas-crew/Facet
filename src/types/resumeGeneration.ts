export type ResumeGenerationMode = 'single' | 'multi-vector' | 'dynamic'

export type ResumeGenerationVectorMode = 'manual' | 'auto'

export type ResumeGenerationSourceKind = 'manual' | 'identity' | 'pipeline' | 'match' | 'import'

export interface ResumeGenerationVectorState {
  primaryVectorId: string | null
  vectorIds: string[]
  suggestedVectorIds: string[]
}

export interface ResumeWorkspaceGenerationState extends ResumeGenerationVectorState {
  mode: ResumeGenerationMode
  vectorMode: ResumeGenerationVectorMode
  source: ResumeGenerationSourceKind
  pipelineEntryId: string | null
  presetId: string | null
  variantId: string | null
  variantLabel: string
}

export interface PipelineResumeGenerationState extends ResumeGenerationVectorState {
  mode: ResumeGenerationMode
  vectorMode: ResumeGenerationVectorMode
  source: ResumeGenerationSourceKind
  presetId: string | null
  variantId: string | null
  variantLabel: string
  lastGeneratedAt: string | null
}

export interface ResumeGenerationHandoff extends ResumeGenerationVectorState {
  mode: ResumeGenerationMode
  vectorMode: ResumeGenerationVectorMode
  source: ResumeGenerationSourceKind
  jobDescription: string
  pipelineEntryId: string | null
  presetId: string | null
  resumeGeneration: PipelineResumeGenerationState | null
}
