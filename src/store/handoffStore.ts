import { create } from 'zustand'
import type { ResumeGenerationHandoff } from '../types/resumeGeneration'
import { normalizeResumeGenerationHandoff } from '../utils/resumeGeneration'

interface ConsumedResumeGenerationHandoff extends ResumeGenerationHandoff {
  /** @deprecated Use jobDescription */
  jd: string
  /** @deprecated Use primaryVectorId */
  vectorId: string | null
  /** @deprecated Use pipelineEntryId */
  entryId: string | null
}

interface HandoffState {
  pendingGeneration: ResumeGenerationHandoff | null
  setPendingAnalysis: (jd: string, vectorId?: string | null, entryId?: string | null) => void
  setPendingGeneration: (generation: ResumeGenerationHandoff) => void
  consume: () => ConsumedResumeGenerationHandoff | null
}

export const useHandoffStore = create<HandoffState>()((set, get) => ({
  pendingGeneration: null,

  setPendingAnalysis: (jd, vectorId = null, entryId = null) => {
    set({
      pendingGeneration: normalizeResumeGenerationHandoff({
        mode: 'single',
        vectorMode: 'manual',
        source: entryId ? 'pipeline' : 'manual',
        jobDescription: jd,
        pipelineEntryId: entryId,
        presetId: null,
        primaryVectorId: vectorId,
        vectorIds: vectorId ? [vectorId] : [],
        suggestedVectorIds: [],
        resumeGeneration: null,
      }),
    })
  },

  setPendingGeneration: (generation) => {
    set({ pendingGeneration: normalizeResumeGenerationHandoff(generation) })
  },

  consume: () => {
    const { pendingGeneration } = get()
    if (!pendingGeneration) return null
    set({ pendingGeneration: null })
    return {
      ...pendingGeneration,
      jd: pendingGeneration.jobDescription,
      vectorId: pendingGeneration.primaryVectorId,
      entryId: pendingGeneration.pipelineEntryId,
    }
  },
}))
