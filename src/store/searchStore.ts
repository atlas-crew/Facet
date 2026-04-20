import { create } from 'zustand'
import type {
  SearchFeedbackEvent,
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

/** Caller supplies every feedback-event field except the store-generated id and timestamp. */
export type SearchFeedbackEventInput = Omit<SearchFeedbackEvent, 'id' | 'createdAt'>

interface SearchState {
  profile: SearchProfile | null
  requests: SearchRequest[]
  runs: SearchRun[]
  feedbackEvents: SearchFeedbackEvent[]

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

  addFeedbackEvent: (event: SearchFeedbackEventInput) => SearchFeedbackEvent
  /** Flip `appliedToIdentity=true` and record the identity version that absorbed the event. */
  markFeedbackApplied: (id: string, identityVersion: number) => void
  /** Record which thesis first incorporated a batch of applied events. */
  markFeedbackReflectedInThesis: (ids: readonly string[], thesisId: string) => void
  /**
   * Events eligible for thesis regeneration input — applied to identity but not yet
   * reflected in the current thesis. When `currentThesisId` is undefined, returns every
   * applied event (the "build a new thesis from scratch" case).
   */
  getUnreflectedFeedback: (currentThesisId?: string) => SearchFeedbackEvent[]
  /** Every feedback event for a given artifact (run or result). */
  getFeedbackEventsForRun: (runId: string) => SearchFeedbackEvent[]
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
          feedbackEvents?: SearchFeedbackEvent[]
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
    feedbackEvents: Array.isArray(state?.feedbackEvents) ? state.feedbackEvents : [],
  }
}

export const useSearchStore = create<SearchState>()((set, get) => ({
      profile: null,
      requests: [],
      runs: [],
      feedbackEvents: [],

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
        set((state) => {
          // Cascade-delete feedback events that reference any run belonging to
          // this request. Without this, orphaned events linger in the store and
          // can be surfaced by `getUnreflectedFeedback()` after the originating
          // run + request no longer exist.
          const orphanedRunIds = new Set(
            state.runs.filter((run) => run.requestId === id).map((run) => run.id),
          )
          return {
            requests: state.requests.filter((request) => request.id !== id),
            runs: state.runs.filter((run) => run.requestId !== id),
            feedbackEvents: state.feedbackEvents.filter(
              (event) => !orphanedRunIds.has(event.runId),
            ),
          }
        })
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
        // Cascade-delete feedback events tied to this run — same reasoning as
        // deleteRequest's cascade: stale events would otherwise be returned by
        // `getUnreflectedFeedback()` long after the run they reference is gone.
        set((state) => ({
          runs: state.runs.filter((run) => run.id !== id),
          feedbackEvents: state.feedbackEvents.filter((event) => event.runId !== id),
        }))
      },

      getRunsForRequest: (requestId) =>
        get().runs.filter((run) => run.requestId === requestId),

      addFeedbackEvent: (input) => {
        const event: SearchFeedbackEvent = {
          ...input,
          id: createId('sfe'),
          createdAt: now(),
        }
        set((state) => ({ feedbackEvents: [...state.feedbackEvents, event] }))
        return event
      },

      markFeedbackApplied: (id, identityVersion) => {
        set((state) => ({
          feedbackEvents: state.feedbackEvents.map((event) =>
            event.id === id
              ? { ...event, appliedToIdentity: true, appliedAtVersion: identityVersion }
              : event,
          ),
        }))
      },

      markFeedbackReflectedInThesis: (ids, thesisId) => {
        const idSet = new Set(ids)
        set((state) => ({
          feedbackEvents: state.feedbackEvents.map((event) =>
            idSet.has(event.id) ? { ...event, reflectedInThesisId: thesisId } : event,
          ),
        }))
      },

      getUnreflectedFeedback: (currentThesisId) =>
        get().feedbackEvents.filter(
          (event) =>
            event.appliedToIdentity &&
            (currentThesisId === undefined || event.reflectedInThesisId !== currentThesisId),
        ),

      getFeedbackEventsForRun: (runId) =>
        get().feedbackEvents.filter((event) => event.runId === runId),
    }))
