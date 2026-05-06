import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { type TaggedNote, untaggedNote } from '../types/audience'
import type { JDAnalysis } from '../types/jdAnalysis'
import type { MatchHistoryEntry, MatchReport, VectorAwareMatchResult } from '../types/match'
import { createMatchHistoryEntry } from '../utils/jobMatch'
import { resolveStorage } from './storage'

interface MatchState {
  jobDescription: string
  currentJDAnalysis: JDAnalysis | null
  currentAnalysis: VectorAwareMatchResult | null
  currentReport: MatchReport | null
  warnings: TaggedNote[]
  history: MatchHistoryEntry[]
  setJobDescription: (value: string) => void
  setResults: (analysis: VectorAwareMatchResult, report: MatchReport, jdAnalysis?: JDAnalysis | null) => void
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
  const currentJDAnalysis =
    version >= 3
      ? ((state.currentJDAnalysis as JDAnalysis | null | undefined) ?? null)
      : null
  const currentReport = (state.currentReport as MatchReport | null | undefined) ?? null
  const currentAnalysis =
    version >= 2
      ? ((state.currentAnalysis as VectorAwareMatchResult | null | undefined) ?? null)
      : null
  const warnings: TaggedNote[] = Array.isArray(state.warnings)
    ? state.warnings
        .map((entry): TaggedNote | null => {
          if (typeof entry === 'string') return untaggedNote(entry)
          if (entry && typeof entry === 'object' && typeof (entry as { text?: unknown }).text === 'string') {
            return entry as TaggedNote
          }
          return null
        })
        .filter((entry): entry is TaggedNote => entry !== null)
    : []
  const history = Array.isArray(state.history)
    ? state.history.filter((entry): entry is MatchHistoryEntry => typeof entry === 'object' && entry !== null)
    : []

  return {
    jobDescription,
    currentJDAnalysis,
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
      currentJDAnalysis: null,
      currentAnalysis: null,
      currentReport: null,
      warnings: [],
      history: [],
      setJobDescription: (value) => set({ jobDescription: value }),
      setResults: (analysis, report, jdAnalysis = null) =>
        set((state) => ({
          currentJDAnalysis: jdAnalysis,
          currentAnalysis: analysis,
          currentReport: report,
          warnings: report.warnings,
          history: appendHistory(state.history, createMatchHistoryEntry(report)),
        })),
      clearReport: () => set({ currentJDAnalysis: null, currentAnalysis: null, currentReport: null, warnings: [] }),
    }),
    {
      name: 'facet-match-workspace',
      version: 3,
      storage: createJSONStorage(resolveStorage),
      migrate: migrateMatchWorkspaceState,
      partialize: (state) => ({
        jobDescription: state.jobDescription,
        currentJDAnalysis: state.currentJDAnalysis,
        currentAnalysis: state.currentAnalysis,
        currentReport: state.currentReport,
        warnings: state.warnings,
        history: state.history,
      }),
    },
  ),
)
