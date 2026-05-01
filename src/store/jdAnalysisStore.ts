import { create } from 'zustand'
import type { JDAnalysis } from '../types/jdAnalysis'

interface JDAnalysisState {
  analyses: JDAnalysis[]
  setAnalyses: (analyses: JDAnalysis[]) => void
  upsertAnalysis: (analysis: JDAnalysis) => void
  removeAnalysis: (analysisId: string) => void
  removeAnalysisForPipelineEntry: (pipelineEntryId: string) => void
  findByPipelineEntry: (pipelineEntryId: string) => JDAnalysis | null
}

const sanitizeAnalysis = (analysis: JDAnalysis): JDAnalysis => ({
  ...analysis,
  warnings: Array.isArray(analysis.warnings)
    ? analysis.warnings
        .filter((warning): warning is string => typeof warning === 'string')
        .map((warning) => warning.trim())
        .filter(Boolean)
    : [],
})

export const migrateJDAnalysisState = (persistedState: unknown): Pick<JDAnalysisState, 'analyses'> => {
  const state =
    typeof persistedState === 'object' && persistedState !== null
      ? (persistedState as { analyses?: JDAnalysis[] })
      : undefined

  return {
    analyses: Array.isArray(state?.analyses)
      ? state.analyses.map((analysis) => sanitizeAnalysis(analysis))
      : [],
  }
}

export const useJDAnalysisStore = create<JDAnalysisState>()((set, get) => ({
  analyses: [],

  setAnalyses: (analyses) => set({ analyses: analyses.map((analysis) => sanitizeAnalysis(analysis)) }),

  upsertAnalysis: (analysis) => {
    const sanitized = sanitizeAnalysis(analysis)
    set((state) => ({
      analyses: [
        sanitized,
        ...state.analyses.filter(
          (entry) => entry.id !== sanitized.id && entry.pipelineEntryId !== sanitized.pipelineEntryId,
        ),
      ],
    }))
  },

  removeAnalysis: (analysisId) => {
    set((state) => ({
      analyses: state.analyses.filter((analysis) => analysis.id !== analysisId),
    }))
  },

  removeAnalysisForPipelineEntry: (pipelineEntryId) => {
    set((state) => ({
      analyses: state.analyses.filter((analysis) => analysis.pipelineEntryId !== pipelineEntryId),
    }))
  },

  findByPipelineEntry: (pipelineEntryId) =>
    get().analyses.find((analysis) => analysis.pipelineEntryId === pipelineEntryId) ?? null,
}))
