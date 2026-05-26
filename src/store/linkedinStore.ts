import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { LinkedInProfileDraft } from '../types/linkedin'
import { resolveStorage } from './storage'

interface LinkedInState {
  drafts: LinkedInProfileDraft[]
  selectedDraftId: string | null
  addDraft: (draft: LinkedInProfileDraft) => void
  updateDraft: (id: string, patch: Partial<LinkedInProfileDraft>) => void
  deleteDraft: (id: string) => void
  setSelectedDraftId: (id: string | null) => void
}

export const migrateLinkedInState = (persistedState: unknown) => {
  const state =
    typeof persistedState === 'object' && persistedState !== null
      ? (persistedState as {
          drafts?: LinkedInProfileDraft[]
          selectedDraftId?: string | null
        })
      : undefined

  const drafts = Array.isArray(state?.drafts)
    ? state.drafts.map((draft) => ({
        outputType: 'profile_summary' as const,
        ...draft,
      }))
    : []

  return {
    ...state,
    drafts,
    selectedDraftId: state?.selectedDraftId ?? drafts[0]?.id ?? null,
  }
}

export const useLinkedInStore = create<LinkedInState>()(
  persist(
    (set) => ({
      drafts: [],
      selectedDraftId: null,
      addDraft: (draft) =>
        set((state) => ({
          drafts: [draft, ...state.drafts],
          selectedDraftId: draft.id,
        })),
      updateDraft: (id, patch) =>
        set((state) => ({
          drafts: state.drafts.map((draft) => (draft.id === id ? { ...draft, ...patch } : draft)),
        })),
      deleteDraft: (id) =>
        set((state) => {
          const drafts = state.drafts.filter((draft) => draft.id !== id)
          return {
            drafts,
            selectedDraftId:
              state.selectedDraftId === id
                ? drafts[0]?.id ?? null
                : state.selectedDraftId,
          }
        }),
      setSelectedDraftId: (id) => set({ selectedDraftId: id }),
    }),
    {
      name: 'facet-linkedin-workspace',
      version: 1,
      storage: createJSONStorage(resolveStorage),
      partialize: (state) => ({
        drafts: state.drafts,
        selectedDraftId: state.selectedDraftId,
      }),
    },
  ),
)
