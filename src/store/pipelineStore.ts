import { create } from 'zustand'
import type {
  InterviewFormat,
  PipelineEntry,
  PipelineInterviewer,
  PipelineRound,
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
import { createId } from '../utils/idUtils'
import { normalizePipelineResearchSnapshot } from '../utils/pipelineResearch'
import {
  buildPipelineResumeVariantLabel,
  getPipelineResumePresetId,
  getPipelineResumePrimaryVectorId,
  normalizePipelineResumeGeneration,
} from '../utils/resumeGeneration'

interface PipelineFilters {
  tier: PipelineTier | 'all'
  status: PipelineStatus | 'all'
  search: string
}

export type RoundInput = {
  label: string
  format: InterviewFormat
  scheduledFor?: string
  durationMinutes?: number
  notes?: string
}

export type InterviewerInput = {
  name: string
  title?: string
  linkedInUrl?: string
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

  addRound: (entryId: string, input: RoundInput) => void
  updateRound: (entryId: string, roundId: string, patch: Partial<PipelineRound>) => void
  deleteRound: (entryId: string, roundId: string) => void
  addInterviewer: (entryId: string, roundId: string, input: InterviewerInput) => void
  updateInterviewer: (
    entryId: string,
    roundId: string,
    interviewerId: string,
    patch: Partial<PipelineInterviewer>,
  ) => void
  deleteInterviewer: (entryId: string, roundId: string, interviewerId: string) => void
}

const now = () => new Date().toISOString().split('T')[0]
const timestamp = () => new Date().toISOString()

// Stored-XSS defense: strip URL schemes that execute JS / data / blob content
// when rendered as <a href>. Intentionally narrower than sanitizeUrl() — we
// keep partial / bare-domain URLs so the user can type "linkedin.com/..."
// without the value vanishing on keystroke.
//
// The HTML URL parser strips ASCII tab, LF, and CR before resolving schemes,
// so `java\tscript:alert(1)` is equivalent to `javascript:alert(1)` at
// render time. The check strips those same bytes from a copy of the input
// before testing the denylist, while the stored value keeps the original
// trimmed form (the browser will still see the same normalized string).
const DANGEROUS_URL_SCHEME = /^\s*(?:javascript|data|vbscript|file|blob):/i
const BROWSER_STRIPPED_CHARS = /[\t\n\r]/g

const safeLinkedInUrl = (value: string | undefined): string | undefined => {
  if (!value) return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const normalized = trimmed.replace(BROWSER_STRIPPED_CHARS, '')
  return DANGEROUS_URL_SCHEME.test(normalized) ? undefined : trimmed
}

const normalizeEntry = (
  entry: PipelineEntry,
  options: { touch?: boolean } = {},
): PipelineEntry => {
  const fallbackTimestamp = normalizeDurableTimestamp(entry.createdAt, timestamp())
  const resumeGeneration = normalizePipelineResumeGeneration(entry.resumeGeneration, {
    resumeVariant: entry.resumeVariant,
    vectorId: entry.vectorId,
    presetId: entry.presetId,
  })
  const derivedResumeVariantLabel = buildPipelineResumeVariantLabel({
    entryId: entry.id,
    company: entry.company,
    role: entry.role,
    resumeGeneration,
    resumeVariant: entry.resumeVariant,
  })
  const normalizedResumeGeneration =
    resumeGeneration && !resumeGeneration.variantLabel
      ? {
          ...resumeGeneration,
          variantLabel: derivedResumeVariantLabel,
        }
      : resumeGeneration

  return {
    ...entry,
    research: normalizePipelineResearchSnapshot(entry.research),
    vectorId: getPipelineResumePrimaryVectorId({
      resumeGeneration: normalizedResumeGeneration,
      vectorId: entry.vectorId,
    }),
    presetId: getPipelineResumePresetId({
      resumeGeneration: normalizedResumeGeneration,
      presetId: entry.presetId,
    }),
    resumeVariant: entry.resumeVariant,
    resumeGeneration: normalizedResumeGeneration,
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
    // Re-run each persisted row through normalizeEntry so legacy resumeVariant/vectorId/presetId
    // fields hydrate into the structured resumeGeneration shape on load.
    entries: Array.isArray(state?.entries)
      ? state.entries.map((entry) => normalizeEntry(entry))
      : [],
    sortField: state?.sortField ?? 'tier',
    sortDir: state?.sortDir ?? 'asc',
  }
}

export const usePipelineStore = create<PipelineState>()((set, get) => ({
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

      addRound: (entryId, input) => {
        const iso = timestamp()
        const date = now()
        const round: PipelineRound = {
          id: createId('round'),
          label: input.label,
          format: input.format,
          scheduledFor: input.scheduledFor,
          durationMinutes: input.durationMinutes,
          notes: input.notes,
          interviewers: [],
          createdAt: iso,
          updatedAt: iso,
        }
        set((s) => ({
          entries: s.entries.map((e) =>
            e.id === entryId
              ? normalizeEntry(
                  {
                    ...e,
                    interviewRounds: [...(e.interviewRounds ?? []), round],
                    lastAction: date,
                    history: [...e.history, { date, note: `Added round: ${round.label}` }],
                  },
                  { touch: true },
                )
              : e
          ),
        }))
      },

      updateRound: (entryId, roundId, patch) => {
        const iso = timestamp()
        set((s) => ({
          entries: s.entries.map((e) => {
            if (e.id !== entryId) return e
            const rounds = e.interviewRounds ?? []
            const next = rounds.map((r) =>
              r.id === roundId
                ? { ...r, ...patch, id: r.id, createdAt: r.createdAt, updatedAt: iso }
                : r
            )
            return normalizeEntry({ ...e, interviewRounds: next }, { touch: true })
          }),
        }))
      },

      deleteRound: (entryId, roundId) => {
        set((s) => ({
          entries: s.entries.map((e) => {
            if (e.id !== entryId) return e
            const rounds = (e.interviewRounds ?? []).filter((r) => r.id !== roundId)
            return normalizeEntry({ ...e, interviewRounds: rounds }, { touch: true })
          }),
        }))
      },

      addInterviewer: (entryId, roundId, input) => {
        const iso = timestamp()
        const interviewer: PipelineInterviewer = {
          id: createId('iv'),
          name: input.name,
          title: input.title,
          linkedInUrl: safeLinkedInUrl(input.linkedInUrl),
        }
        set((s) => ({
          entries: s.entries.map((e) => {
            if (e.id !== entryId) return e
            const rounds = (e.interviewRounds ?? []).map((r) =>
              r.id === roundId
                ? { ...r, interviewers: [...r.interviewers, interviewer], updatedAt: iso }
                : r
            )
            return normalizeEntry({ ...e, interviewRounds: rounds }, { touch: true })
          }),
        }))
      },

      updateInterviewer: (entryId, roundId, interviewerId, patch) => {
        const iso = timestamp()
        const safePatch =
          'linkedInUrl' in patch
            ? { ...patch, linkedInUrl: safeLinkedInUrl(patch.linkedInUrl) }
            : patch
        set((s) => ({
          entries: s.entries.map((e) => {
            if (e.id !== entryId) return e
            const rounds = (e.interviewRounds ?? []).map((r) => {
              if (r.id !== roundId) return r
              const interviewers = r.interviewers.map((i) =>
                i.id === interviewerId ? { ...i, ...safePatch, id: i.id } : i
              )
              return { ...r, interviewers, updatedAt: iso }
            })
            return normalizeEntry({ ...e, interviewRounds: rounds }, { touch: true })
          }),
        }))
      },

      deleteInterviewer: (entryId, roundId, interviewerId) => {
        const iso = timestamp()
        set((s) => ({
          entries: s.entries.map((e) => {
            if (e.id !== entryId) return e
            const rounds = (e.interviewRounds ?? []).map((r) =>
              r.id === roundId
                ? {
                    ...r,
                    interviewers: r.interviewers.filter((i) => i.id !== interviewerId),
                    updatedAt: iso,
                  }
                : r
            )
            return normalizeEntry({ ...e, interviewRounds: rounds }, { touch: true })
          }),
        }))
      },
    }))
