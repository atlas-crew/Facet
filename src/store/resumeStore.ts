import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { ResumeData, VariantSelection, VectorId } from '../types'
import { defaultResumeData } from './defaultData'
import { resolveStorage } from './storage'

const MAX_HISTORY = 50

/**
 * ⚠️ Cache legacy UI store data for migration before hydration race condition.
 * We capture this at module load time to ensure we have the data before uiStore 
 * version bump wipes it.
 */
const legacyUiStoreSnapshot = typeof globalThis.localStorage !== 'undefined' 
  ? globalThis.localStorage.getItem('vector-resume-ui')
  : null

interface ResumeState {
  data: ResumeData
  past: ResumeData[]
  future: ResumeData[]
  setData: (data: ResumeData) => void
  updateData: (fn: (current: ResumeData) => ResumeData) => void
  resetToDefaults: () => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  
  // Positioning actions (Moved from uiStore for Global Undo/Redo)
  setOverride: (vectorId: VectorId | 'all', componentKey: string, included: boolean | null) => void
  setVariantOverride: (
    vectorId: VectorId | 'all',
    componentKey: string,
    variant: VariantSelection | null,
  ) => void
  resetOverridesForVector: (vectorId: VectorId | 'all') => void
  resetAllOverrides: () => void
  setRoleBulletOrder: (vectorId: VectorId | 'all', roleId: string, order: string[]) => void
  resetRoleBulletOrder: (vectorId: VectorId | 'all', roleId: string) => void
}

export function resumeMigration(persistedState: any, version: number, legacyUiData: string | null = legacyUiStoreSnapshot) {
  if (version < 2 && !persistedState.data._overridesMigrated) {
    // Attempt to recover positioning overrides from the old uiStore location
    try {
      if (legacyUiData) {
        const uiStored = JSON.parse(legacyUiData)
        const uiState = uiStored.state
        if (uiState && persistedState.data) {
          persistedState.data = {
            ...persistedState.data,
            manualOverrides: uiState.manualOverrides,
            variantOverrides: uiState.variantOverrides,
            bulletOrders: uiState.bulletOrders,
            _overridesMigrated: true,
          }
        }
      }
    } catch (e) {
      console.warn('Resume data migration: Failed to pull overrides from uiStore.', e)
    }
  }
  return persistedState
}

export const useResumeStore = create<ResumeState>()(
  persist(
    (set, get) => ({
      data: defaultResumeData,
      past: [],
      future: [],
      canUndo: false,
      canRedo: false,

      setData: (data) => {
        get().updateData(() => data)
      },

      updateData: (fn) => {
        const { data: current, past } = get()
        const next = fn(current)
        if (next === current) return
        set({
          data: next,
          past: [...past, current].slice(-MAX_HISTORY),
          future: [],
          canUndo: true,
          canRedo: false,
        })
      },

      resetToDefaults: () => {
        const { data: current, past } = get()
        set({
          data: defaultResumeData,
          past: [...past, current].slice(-MAX_HISTORY),
          future: [],
          canUndo: true,
          canRedo: false,
        })
      },

      undo: () => {
        const { past, data: current, future } = get()
        const previous = past.at(-1)
        if (!previous) return
        
        const nextPast = past.slice(0, -1)
        set({
          data: previous,
          past: nextPast,
          future: [current, ...future].slice(0, MAX_HISTORY),
          canUndo: nextPast.length > 0,
          canRedo: true,
        })
      },

      redo: () => {
        const { past, data: current, future } = get()
        const next = future.at(0)
        if (!next) return
        
        const nextFuture = future.slice(1)
        set({
          data: next,
          past: [...past, current],
          future: nextFuture,
          canUndo: true,
          canRedo: nextFuture.length > 0,
        })
      },

      setOverride: (vector, componentKey, included) => {
        get().updateData((current) => {
          const manualOverrides = current.manualOverrides ?? {}
          const currentForVector = manualOverrides[vector] ?? {}
          
          let nextForVector: Record<string, boolean>
          if (included === null) {
            nextForVector = { ...currentForVector }
            delete nextForVector[componentKey]
          } else {
            nextForVector = {
              ...currentForVector,
              [componentKey]: included,
            }
          }

          return {
            ...current,
            manualOverrides: {
              ...manualOverrides,
              [vector]: nextForVector,
            },
          }
        })
      },

      setVariantOverride: (vector, componentKey, variant) => {
        get().updateData((current) => {
          const variantOverrides = current.variantOverrides ?? {}
          const currentForVector = variantOverrides[vector] ?? {}

          let nextForVector: Record<string, VariantSelection>
          if (variant === null) {
            nextForVector = { ...currentForVector }
            delete nextForVector[componentKey]
          } else {
            nextForVector = {
              ...currentForVector,
              [componentKey]: variant,
            }
          }

          return {
            ...current,
            variantOverrides: {
              ...variantOverrides,
              [vector]: nextForVector,
            },
          }
        })
      },

      resetOverridesForVector: (vector) => {
        get().updateData((current) => {
          const manualOverrides = { ...(current.manualOverrides ?? {}) }
          delete manualOverrides[vector]
          const variantOverrides = { ...(current.variantOverrides ?? {}) }
          delete variantOverrides[vector]
          const bulletOrders = { ...(current.bulletOrders ?? {}) }
          delete bulletOrders[vector]
          
          return {
            ...current,
            manualOverrides,
            variantOverrides,
            bulletOrders,
          }
        })
      },

      resetAllOverrides: () => {
        get().updateData((current) => ({
          ...current,
          manualOverrides: {},
          variantOverrides: {},
          bulletOrders: {},
        }))
      },

      setRoleBulletOrder: (vector, roleId, order) => {
        get().updateData((current) => {
          const bulletOrders = current.bulletOrders ?? {}
          return {
            ...current,
            bulletOrders: {
              ...bulletOrders,
              [vector]: {
                ...(bulletOrders[vector] ?? {}),
                [roleId]: order,
              },
            },
          }
        })
      },

      resetRoleBulletOrder: (vector, roleId) => {
        get().updateData((current) => {
          const bulletOrders = current.bulletOrders ?? {}
          const currentForVector = bulletOrders[vector] ?? {}
          if (!(roleId in currentForVector)) return current

          const nextForVector = { ...currentForVector }
          delete nextForVector[roleId]
          
          return {
            ...current,
            bulletOrders: {
              ...bulletOrders,
              [vector]: nextForVector,
            },
          }
        })
      },
    }),
    {
      name: 'vector-resume-data',
      version: 2,
      storage: createJSONStorage(resolveStorage),
      partialize: (state) => ({ data: state.data }),
      migrate: resumeMigration,
    },
  ),
)


