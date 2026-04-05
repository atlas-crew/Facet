import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  DEFAULT_BACKUP_REMINDER_INTERVAL_DAYS,
  normalizeBackupReminderIntervalDays,
} from '../persistence/backupReminder'
import type { VectorSelection } from '../types'
import { resolveStorage } from './storage'

type VectorKey = VectorSelection

export interface UiState {
  selectedVector: VectorSelection
  panelRatio: number
  appearance: 'light' | 'dark' | 'system'
  viewMode: 'pdf' | 'live'
  showHeatmap: boolean
  showDesignHealth: boolean
  suggestionModeActive: boolean
  comparisonVector: VectorSelection | null
  backupRemindersEnabled: boolean
  backupReminderIntervalDays: number
  backupReminderSnoozedUntil: string | null
  lastBackupAt: string | null
  setSelectedVector: (vector: VectorSelection) => void
  setPanelRatio: (ratio: number) => void
  setAppearance: (appearance: 'light' | 'dark' | 'system') => void
  setViewMode: (mode: 'pdf' | 'live') => void
  setShowHeatmap: (show: boolean) => void
  setShowDesignHealth: (show: boolean) => void
  setSuggestionModeActive: (active: boolean) => void
  setComparisonVector: (v: VectorSelection | null) => void
  setBackupRemindersEnabled: (enabled: boolean) => void
  setBackupReminderIntervalDays: (days: number) => void
  setBackupReminderSnoozedUntil: (value: string | null) => void
  markBackupCreated: (at?: string) => void
  tourCompleted: boolean
  setTourCompleted: (completed: boolean) => void
}

export const toVectorKey = (selectedVector: VectorSelection): VectorKey => selectedVector

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      selectedVector: 'all',
      panelRatio: 0.45,
      appearance: 'system',
      viewMode: 'pdf',
      showHeatmap: false,
      showDesignHealth: false,
      suggestionModeActive: false,
      comparisonVector: null,
      backupRemindersEnabled: true,
      backupReminderIntervalDays: DEFAULT_BACKUP_REMINDER_INTERVAL_DAYS,
      backupReminderSnoozedUntil: null,
      lastBackupAt: null,
      setSelectedVector: (vector) => set({ selectedVector: vector }),
      setPanelRatio: (ratio) => set({ panelRatio: Math.min(0.7, Math.max(0.3, ratio)) }),
      setAppearance: (appearance) => set({ appearance }),
      setViewMode: (mode) => set({ viewMode: mode }),
      setShowHeatmap: (show) => set({ showHeatmap: show }),
      setShowDesignHealth: (show) => set({ showDesignHealth: show }),
      setSuggestionModeActive: (active) => set({ suggestionModeActive: active }),
      setComparisonVector: (v) => set({ comparisonVector: v }),
      setBackupRemindersEnabled: (enabled) =>
        set({
          backupRemindersEnabled: enabled,
          backupReminderSnoozedUntil: null,
        }),
      setBackupReminderIntervalDays: (days) =>
        set({
          backupReminderIntervalDays: normalizeBackupReminderIntervalDays(days),
        }),
      setBackupReminderSnoozedUntil: (value) => set({ backupReminderSnoozedUntil: value }),
      markBackupCreated: (at) =>
        set({
          lastBackupAt: at ?? new Date().toISOString(),
          backupReminderSnoozedUntil: null,
        }),
      tourCompleted: false,
      setTourCompleted: (completed) => set({ tourCompleted: completed }),
    }),
    {
      // ⚠️ Keep in sync with index.html inline theme script
      name: 'vector-resume-ui',
      version: 5,
      storage: createJSONStorage(resolveStorage),
      // comparisonVector is transient — don't persist across sessions
      partialize: ({ comparisonVector: _transient, ...rest }) => rest as UiState,
      migrate: (persistedState: unknown) => {
        // We're versioning purely to force cleanup of old override data
        // that moved to resumeStore, but we want to keep current UI preferences
        // if they are compatible.
        return persistedState
      },
    },
  ),
)
