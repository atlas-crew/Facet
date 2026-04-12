import { create } from 'zustand'
import type {
  SearchInterviewPrefs,
  SearchProfile,
  SearchProfileConstraints,
  SearchProfileFilters,
  SearchRequest,
  SearchRun,
  SkillCatalogEntry,
  VectorSearchConfig,
} from '../types/search'
import { createId } from '../utils/idUtils'
import {
  ensureDurableMetadata,
  stripDurableMetadataPatch,
  touchDurableMetadata,
} from './durableMetadata'

type SearchProfileInput = Omit<SearchProfile, 'id' | 'inferredAt'> &
  Partial<Pick<SearchProfile, 'id' | 'inferredAt'>>

type SearchRequestInput = Omit<SearchRequest, 'id' | 'createdAt'> &
  Partial<Pick<SearchRequest, 'id' | 'createdAt'>>

type SearchRunInput = Omit<SearchRun, 'id' | 'createdAt'> &
  Partial<Pick<SearchRun, 'id' | 'createdAt'>>

interface SearchState {
  profile: SearchProfile | null
  requests: SearchRequest[]
  runs: SearchRun[]

  setProfile: (profile: SearchProfileInput) => SearchProfile
  updateProfileSkills: (skills: SkillCatalogEntry[]) => void
  updateProfileVectors: (vectors: VectorSearchConfig[]) => void
  updateProfileConstraints: (constraints: SearchProfileConstraints) => void
  updateProfileFilters: (filters: SearchProfileFilters) => void
  updateProfileInterviewPrefs: (prefs: SearchInterviewPrefs) => void
  clearProfile: () => void
  addRequest: (request: SearchRequestInput) => SearchRequest
  updateRequest: (id: string, patch: Partial<SearchRequest>) => void
  deleteRequest: (id: string) => void
  addRun: (run: SearchRunInput) => SearchRun
  updateRun: (id: string, patch: Partial<SearchRun>) => void
  deleteRun: (id: string) => void
  getRunsForRequest: (requestId: string) => SearchRun[]
}

const now = () => new Date().toISOString()

const hydrateProfile = (profile: SearchProfileInput): SearchProfile => ({
  ...profile,
  source: profile.source ?? { kind: 'resume', label: 'Resume fallback' },
  id: profile.id ?? createId('sprof'),
  inferredAt: profile.inferredAt ?? now(),
  durableMeta: ensureDurableMetadata(profile.durableMeta, profile.inferredAt ?? now()),
})

const hydrateRequest = (request: SearchRequestInput): SearchRequest => ({
  ...request,
  id: request.id ?? createId('sreq'),
  createdAt: request.createdAt ?? now(),
  durableMeta: ensureDurableMetadata(request.durableMeta, request.createdAt ?? now()),
})

const hydrateRun = (run: SearchRunInput): SearchRun => ({
  ...run,
  id: run.id ?? createId('srun'),
  createdAt: run.createdAt ?? now(),
  durableMeta: ensureDurableMetadata(run.durableMeta, run.createdAt ?? now()),
})

export const migrateSearchState = (persistedState: unknown) => {
  const state =
    typeof persistedState === 'object' && persistedState !== null
      ? (persistedState as {
          profile?: SearchProfile | null
          requests?: SearchRequest[]
          runs?: SearchRun[]
        })
      : undefined

  return {
    ...state,
    profile: state?.profile ? hydrateProfile(state.profile) : null,
    requests: Array.isArray(state?.requests)
      ? state.requests.map((request) => hydrateRequest(request))
      : [],
    runs: Array.isArray(state?.runs)
      ? state.runs.map((run) => hydrateRun(run))
      : [],
  }
}

export const useSearchStore = create<SearchState>()((set, get) => ({
      profile: null,
      requests: [],
      runs: [],

      setProfile: (profile) => {
        const hydrated = hydrateProfile(profile)
        set({ profile: hydrated })
        return hydrated
      },

      updateProfileSkills: (skills) => {
        set((state) =>
          state.profile
            ? {
                profile: {
                  ...state.profile,
                  skills,
                  durableMeta: touchDurableMetadata(state.profile.durableMeta, now()),
                },
              }
            : state,
        )
      },

      updateProfileVectors: (vectors) => {
        set((state) =>
          state.profile
            ? {
                profile: {
                  ...state.profile,
                  vectors,
                  durableMeta: touchDurableMetadata(state.profile.durableMeta, now()),
                },
              }
            : state,
        )
      },

      updateProfileConstraints: (constraints) => {
        set((state) =>
          state.profile
            ? {
                profile: {
                  ...state.profile,
                  constraints,
                  durableMeta: touchDurableMetadata(state.profile.durableMeta, now()),
                },
              }
            : state,
        )
      },

      updateProfileFilters: (filters) => {
        set((state) =>
          state.profile
            ? {
                profile: {
                  ...state.profile,
                  filters,
                  durableMeta: touchDurableMetadata(state.profile.durableMeta, now()),
                },
              }
            : state,
        )
      },

      updateProfileInterviewPrefs: (interviewPrefs) => {
        set((state) =>
          state.profile
            ? {
                profile: {
                  ...state.profile,
                  interviewPrefs,
                  durableMeta: touchDurableMetadata(state.profile.durableMeta, now()),
                },
              }
            : state,
        )
      },

      clearProfile: () => {
        set({ profile: null })
      },

      addRequest: (request) => {
        const hydrated = hydrateRequest(request)
        set((state) => ({ requests: [...state.requests, hydrated] }))
        return hydrated
      },

      updateRequest: (id, patch) => {
        const restPatch = stripDurableMetadataPatch(patch)
        set((state) => ({
          requests: state.requests.map((request) =>
            request.id === id
              ? {
                  ...request,
                  ...restPatch,
                  durableMeta: touchDurableMetadata(request.durableMeta, now()),
                }
              : request,
          ),
        }))
      },

      deleteRequest: (id) => {
        set((state) => ({
          requests: state.requests.filter((request) => request.id !== id),
          runs: state.runs.filter((run) => run.requestId !== id),
        }))
      },

      addRun: (run) => {
        const hydrated = hydrateRun(run)
        set((state) => ({ runs: [...state.runs, hydrated] }))
        return hydrated
      },

      updateRun: (id, patch) => {
        const restPatch = stripDurableMetadataPatch(patch)
        set((state) => ({
          runs: state.runs.map((run) =>
            run.id === id
              ? {
                  ...run,
                  ...restPatch,
                  durableMeta: touchDurableMetadata(run.durableMeta, now()),
                }
              : run,
          ),
        }))
      },

      deleteRun: (id) => {
        set((state) => ({ runs: state.runs.filter((run) => run.id !== id) }))
      },

      getRunsForRequest: (requestId) =>
        get().runs.filter((run) => run.requestId === requestId),
    }))
