import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type {
  PipelineEntry,
  PipelineStatus,
  PipelineTier,
} from '../types/pipeline'
import {
  createDurableMetadata,
  ensureDurableMetadata,
  normalizeDurableTimestamp,
  stripDurableMetadataPatch,
  touchDurableMetadata,
} from './durableMetadata'
import { resolveStorage } from './storage'
import { createId } from '../utils/idUtils'

interface PipelineFilters {
  tier: PipelineTier | 'all'
  status: PipelineStatus | 'all'
  search: string
}

interface PipelineState {
  entries: PipelineEntry[]
  sortField: string
  sortDir: 'asc' | 'desc'
  filters: PipelineFilters

  addEntry: (entry: Omit<PipelineEntry, 'id' | 'createdAt' | 'lastAction' | 'history'>) => void
  updateEntry: (id: string, patch: Partial<PipelineEntry>) => void
  deleteEntry: (id: string) => void
  addHistoryNote: (id: string, note: string) => void
  setStatus: (id: string, status: PipelineStatus) => void
  setSort: (field: string, dir?: 'asc' | 'desc') => void
  setFilter: (key: keyof PipelineFilters, value: string) => void
  importEntries: (entries: PipelineEntry[]) => void
  exportEntries: () => PipelineEntry[]
}

const now = () => new Date().toISOString().split('T')[0]
const timestamp = () => new Date().toISOString()

const normalizeEntry = (
  entry: PipelineEntry,
  options: { touch?: boolean } = {},
): PipelineEntry => {
  const fallbackTimestamp = normalizeDurableTimestamp(entry.createdAt, timestamp())

  return {
    ...entry,
    durableMeta: options.touch
      ? touchDurableMetadata(entry.durableMeta, timestamp())
      : ensureDurableMetadata(entry.durableMeta, fallbackTimestamp),
  }
}

export const migratePipelineState = (persistedState: unknown) => {
  const state =
    typeof persistedState === 'object' && persistedState !== null
      ? (persistedState as {
          entries?: PipelineEntry[]
          sortField?: string
          sortDir?: 'asc' | 'desc'
        })
      : undefined

  return {
    ...state,
    entries: Array.isArray(state?.entries)
      ? state.entries.map((entry) => normalizeEntry(entry))
      : [],
    sortField: state?.sortField ?? 'tier',
    sortDir: state?.sortDir ?? 'asc',
  }
}

export const usePipelineStore = create<PipelineState>()(
  persist(
    (set, get) => ({
      entries: [],
      sortField: 'tier',
      sortDir: 'asc',
      filters: { tier: 'all', status: 'all', search: '' },

      addEntry: (entry) => {
        const date = now()
        const newEntry: PipelineEntry = {
          ...entry,
          id: createId('pipe'),
          createdAt: date,
          lastAction: date,
          history: [{ date, note: 'Created' }],
          durableMeta: createDurableMetadata(timestamp()),
        }
        set((s) => ({ entries: [...s.entries, newEntry] }))
      },

      updateEntry: (id, patch) => {
        const restPatch = stripDurableMetadataPatch(patch)
        set((s) => ({
          entries: s.entries.map((e) =>
            e.id === id
              ? normalizeEntry(
                  { ...e, ...restPatch, lastAction: now() },
                  { touch: true },
                )
              : e
          ),
        }))
      },

      deleteEntry: (id) => {
        set((s) => ({ entries: s.entries.filter((e) => e.id !== id) }))
      },

      addHistoryNote: (id, note) => {
        const date = now()
        set((s) => ({
          entries: s.entries.map((e) =>
            e.id === id
              ? normalizeEntry(
                  { ...e, lastAction: date, history: [...e.history, { date, note }] },
                  { touch: true },
                )
              : e
          ),
        }))
      },

      setStatus: (id, status) => {
        const date = now()
        set((s) => ({
          entries: s.entries.map((e) =>
            e.id === id
              ? normalizeEntry(
                  {
                    ...e,
                    status,
                    lastAction: date,
                    history: [...e.history, { date, note: `Status → ${status}` }],
                  },
                  { touch: true },
                )
              : e
          ),
        }))
      },

      setSort: (field, dir) => {
        set((s) => ({
          sortField: field,
          sortDir: dir ?? (s.sortField === field && s.sortDir === 'asc' ? 'desc' : 'asc'),
        }))
      },

      setFilter: (key, value) => {
        set((s) => ({ filters: { ...s.filters, [key]: value } }))
      },

      importEntries: (entries) => {
        set({ entries: entries.map((entry) => normalizeEntry(entry)) })
      },

      exportEntries: () => get().entries,
    }),
    {
      name: 'facet-pipeline-data',
      version: 2,
      storage: createJSONStorage(resolveStorage),
      partialize: (state) => ({
        entries: state.entries,
        sortField: state.sortField,
        sortDir: state.sortDir,
      }),
      migrate: migratePipelineState,
    }
  )
)
