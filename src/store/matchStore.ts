import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { MatchHistoryEntry, MatchReport, VectorAwareMatchResult } from '../types/match'
import { createMatchHistoryEntry } from '../utils/jobMatch'
import { resolveStorage } from './storage'

interface MatchState {
  jobDescription: string
  currentAnalysis: VectorAwareMatchResult | null
  currentReport: MatchReport | null
  warnings: string[]
  history: MatchHistoryEntry[]
  setJobDescription: (value: string) => void
  setResults: (analysis: VectorAwareMatchResult, report: MatchReport) => void
  clearReport: () => void
}

const appendHistory = (
  history: MatchHistoryEntry[],
  entry: MatchHistoryEntry,
): MatchHistoryEntry[] => [entry, ...history].slice(0, 10)

export const migrateMatchWorkspaceState = (
  persistedState: unknown,
  version: number,
): Partial<MatchState> => {
  const state = typeof persistedState === 'object' && persistedState !== null
    ? (persistedState as Record<string, unknown>)
    : {}

  const jobDescription = typeof state.jobDescription === 'string' ? state.jobDescription : ''
  const currentReport = (state.currentReport as MatchReport | null | undefined) ?? null
  const currentAnalysis =
    version >= 2
      ? ((state.currentAnalysis as VectorAwareMatchResult | null | undefined) ?? null)
      : null
  const warnings = Array.isArray(state.warnings)
    ? state.warnings.filter((entry): entry is string => typeof entry === 'string')
    : []
  const history = Array.isArray(state.history)
    ? state.history.filter((entry): entry is MatchHistoryEntry => typeof entry === 'object' && entry !== null)
    : []

  return {
    jobDescription,
    currentAnalysis,
    currentReport,
    warnings,
    history,
  }
}

export const useMatchStore = create<MatchState>()(
  persist(
    (set) => ({
      jobDescription: '',
      currentAnalysis: null,
      currentReport: null,
      warnings: [],
      history: [],
      setJobDescription: (value) => set({ jobDescription: value }),
      setResults: (analysis, report) =>
        set((state) => ({
          currentAnalysis: analysis,
          currentReport: report,
          warnings: report.warnings,
          history: appendHistory(state.history, createMatchHistoryEntry(report)),
        })),
      clearReport: () => set({ currentAnalysis: null, currentReport: null, warnings: [] }),
    }),
    {
      name: 'facet-match-workspace',
      version: 2,
      storage: createJSONStorage(resolveStorage),
      migrate: migrateMatchWorkspaceState,
      partialize: (state) => ({
        jobDescription: state.jobDescription,
        currentAnalysis: state.currentAnalysis,
        currentReport: state.currentReport,
        warnings: state.warnings,
        history: state.history,
      }),
    },
  ),
)
