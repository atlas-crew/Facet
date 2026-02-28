import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { VariantSelection, VectorSelection } from '../types'
import { resolveStorage } from './storage'

type VectorKey = VectorSelection

type OverrideMap = Record<string, boolean>
type VectorOverrides = Record<VectorKey, OverrideMap>
type VariantMap = Record<string, VariantSelection>
type VectorVariantOverrides = Record<VectorKey, VariantMap>

type RoleOrder = Record<string, string[]>
type VectorBulletOrders = Record<VectorKey, RoleOrder>

interface UiState {
  selectedVector: VectorSelection
  panelRatio: number
  manualOverrides: VectorOverrides
  variantOverrides: VectorVariantOverrides
  bulletOrders: VectorBulletOrders
  setSelectedVector: (vector: VectorSelection) => void
  setPanelRatio: (ratio: number) => void
  setOverride: (vector: VectorKey, componentKey: string, included: boolean | null) => void
  setVariantOverride: (
    vector: VectorKey,
    componentKey: string,
    variant: VariantSelection | null,
  ) => void
  resetOverridesForVector: (vector: VectorKey) => void
  setRoleBulletOrder: (vector: VectorKey, roleId: string, order: string[]) => void
}

export const toVectorKey = (selectedVector: VectorSelection): VectorKey => selectedVector

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      selectedVector: 'all',
      panelRatio: 0.45,
      manualOverrides: {},
      variantOverrides: {},
      bulletOrders: {},
      setSelectedVector: (vector) => set({ selectedVector: vector }),
      setPanelRatio: (ratio) => set({ panelRatio: Math.min(0.7, Math.max(0.3, ratio)) }),
      setOverride: (vector, componentKey, included) =>
        set((state) => {
          const current = state.manualOverrides[vector] ?? {}
          if (included === null) {
            const next = { ...current }
            delete next[componentKey]
            return {
              manualOverrides: {
                ...state.manualOverrides,
                [vector]: next,
              },
            }
          }

          return {
            manualOverrides: {
              ...state.manualOverrides,
              [vector]: {
                ...current,
                [componentKey]: included,
              },
            },
          }
        }),
      setVariantOverride: (vector, componentKey, variant) =>
        set((state) => {
          const current = state.variantOverrides[vector] ?? {}
          if (variant === null) {
            const next = { ...current }
            delete next[componentKey]
            return {
              variantOverrides: {
                ...state.variantOverrides,
                [vector]: next,
              },
            }
          }

          return {
            variantOverrides: {
              ...state.variantOverrides,
              [vector]: {
                ...current,
                [componentKey]: variant,
              },
            },
          }
        }),
      resetOverridesForVector: (vector) =>
        set((state) => {
          const nextManual = { ...state.manualOverrides }
          delete nextManual[vector]
          const nextVariant = { ...state.variantOverrides }
          delete nextVariant[vector]
          const nextBulletOrders = { ...state.bulletOrders }
          delete nextBulletOrders[vector]
          return {
            manualOverrides: nextManual,
            variantOverrides: nextVariant,
            bulletOrders: nextBulletOrders,
          }
        }),
      setRoleBulletOrder: (vector, roleId, order) =>
        set((state) => ({
          bulletOrders: {
            ...state.bulletOrders,
            [vector]: {
              ...(state.bulletOrders[vector] ?? {}),
              [roleId]: order,
            },
          },
        })),
    }),
    {
      name: 'vector-resume-ui',
      version: 3,
      storage: createJSONStorage(resolveStorage),
    },
  ),
)
