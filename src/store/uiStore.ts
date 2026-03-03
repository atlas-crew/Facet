import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { VectorSelection } from '../types'
import { resolveStorage } from './storage'

type VectorKey = VectorSelection

export interface UiState {
  selectedVector: VectorSelection
  panelRatio: number
  appearance: 'light' | 'dark' | 'system'
  setSelectedVector: (vector: VectorSelection) => void
  setPanelRatio: (ratio: number) => void
  setAppearance: (appearance: 'light' | 'dark' | 'system') => void
}

export const toVectorKey = (selectedVector: VectorSelection): VectorKey => selectedVector

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      selectedVector: 'all',
      panelRatio: 0.45,
      appearance: 'system',
      setSelectedVector: (vector) => set({ selectedVector: vector }),
      setPanelRatio: (ratio) => set({ panelRatio: Math.min(0.7, Math.max(0.3, ratio)) }),
      setAppearance: (appearance) => set({ appearance }),
    }),
    {
      // ⚠️ Keep in sync with index.html inline theme script
      name: 'vector-resume-ui',
      version: 4,
      storage: createJSONStorage(resolveStorage),
      migrate: (persistedState: any, _version: number) => {
        // We're versioning purely to force cleanup of old override data
        // that moved to resumeStore, but we want to keep current UI preferences
        // if they are compatible.
        return persistedState
      },
    },
  ),
)
