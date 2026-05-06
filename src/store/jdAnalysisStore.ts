import { create } from 'zustand'
import type { TaggedNote } from '../types/audience'
import type { JDAnalysis } from '../types/jdAnalysis'
import { applyRulesBasedAudiences, type JDAnalysisLike } from '../utils/audienceRules'

interface JDAnalysisState {
  analyses: JDAnalysis[]
  setAnalyses: (analyses: JDAnalysis[]) => void
  upsertAnalysis: (analysis: JDAnalysis) => void
  removeAnalysis: (analysisId: string) => void
  removeAnalysisForPipelineEntry: (pipelineEntryId: string) => void
  findByPipelineEntry: (pipelineEntryId: string) => JDAnalysis | null
}

const trimWarningNotes = (warnings: unknown): TaggedNote[] | string[] => {
  if (!Array.isArray(warnings)) return []
  return warnings
    .map((entry) => {
      if (typeof entry === 'string') return entry.trim()
      if (entry && typeof entry === 'object' && 'text' in entry && typeof (entry as { text: unknown }).text === 'string') {
        return { ...(entry as TaggedNote), text: (entry as TaggedNote).text.trim() }
      }
      return ''
    })
    .filter((entry): entry is string | TaggedNote =>
      typeof entry === 'string' ? entry.length > 0 : entry.text.length > 0,
    ) as TaggedNote[] | string[]
}

const sanitizeAnalysis = (analysis: JDAnalysis): JDAnalysis => {
  // Trim warning text (strings or TaggedNote.text), then route through the
  // audience rules engine. The engine is idempotent on same-version input,
  // so this is cheap when nothing has changed and self-healing when the
  // rules version has bumped or the persisted record predates tagging.
  const trimmed: JDAnalysisLike = {
    ...analysis,
    warnings: trimWarningNotes(analysis.warnings),
  }
  return applyRulesBasedAudiences(trimmed)
}

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
