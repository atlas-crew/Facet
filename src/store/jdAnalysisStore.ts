import { create } from 'zustand'
import { hasAudiences, type TaggedNote, untaggedNote } from '../types/audience'
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

const normalizeNotes = (
  notes: unknown,
): { notes: TaggedNote[]; needsRulesReapply: boolean } => {
  if (!Array.isArray(notes)) return { notes: [], needsRulesReapply: true }

  let needsRulesReapply = false
  const normalized: TaggedNote[] = []

  for (const entry of notes) {
    if (typeof entry === 'string') {
      const text = entry.trim()
      if (text) normalized.push(untaggedNote(text))
      needsRulesReapply = true
      continue
    }

    if (
      entry &&
      typeof entry === 'object' &&
      'text' in entry &&
      typeof (entry as { text: unknown }).text === 'string'
    ) {
      const text = (entry as { text: string }).text.trim()
      if (!text) {
        needsRulesReapply = true
        continue
      }
      if (hasAudiences(entry)) {
        normalized.push({ ...(entry as TaggedNote), text })
      } else {
        normalized.push(untaggedNote(text))
        needsRulesReapply = true
      }
      continue
    }

    needsRulesReapply = true
  }

  return { notes: normalized, needsRulesReapply }
}

const sanitizeAnalysis = (analysis: JDAnalysis): JDAnalysis => {
  // Normalize persisted legacy note arrays before routing through the
  // audience rules engine. When the boundary had to repair strings or missing
  // audience metadata, clear the version stamp so default note audiences are
  // applied in one place.
  const warnings = normalizeNotes(analysis.warnings)
  const strengthsToLead = normalizeNotes(analysis.strengthsToLead)
  const gapFocus = normalizeNotes(analysis.gapFocus)
  const positioningRecommendations = normalizeNotes(analysis.positioningRecommendations)
  const needsRulesReapply =
    warnings.needsRulesReapply ||
    strengthsToLead.needsRulesReapply ||
    gapFocus.needsRulesReapply ||
    positioningRecommendations.needsRulesReapply

  const trimmed: JDAnalysisLike = {
    ...analysis,
    audienceRulesVersion: needsRulesReapply ? undefined : analysis.audienceRulesVersion,
    warnings: warnings.notes,
    strengthsToLead: strengthsToLead.notes,
    gapFocus: gapFocus.notes,
    positioningRecommendations: positioningRecommendations.notes,
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
