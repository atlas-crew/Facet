import { useMemo, useState } from 'react'
import { normalizeThemeState } from '../themes/theme'
import type {
  ResumeData,
  ResumeThemeState,
  SavedVariant,
  VariantSelection,
  VectorSelection,
} from '../types'
import { useResumeStore } from '../store/resumeStore'
import { toVectorKey, useUiStore, type UiState } from '../store/uiStore'
import {
  areVariantOverridesEqual,
  createSavedVariant,
  createVariantOverridesSnapshot,
} from '../utils/savedVariants'

const createId = (prefix: string) => {
  const uuid = globalThis.crypto?.randomUUID?.()
  if (uuid) {
    return `${prefix}-${uuid}`
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

type NoticeTone = 'success' | 'error'

export class VariantSaveCanceledError extends Error {}

interface UseSavedVariantsArgs {
  data: ResumeData
  selectedVector: VectorSelection
  overridesForVector: Record<string, boolean>
  variantsForVector: Record<string, VariantSelection>
  activeBulletOrders: UiState['bulletOrders'][string]
  themeState: ResumeThemeState
  updateData: (fn: (current: ResumeData) => ResumeData) => void
  showNotice: (tone: NoticeTone, message: string) => void
}

interface UseSavedVariantsResult {
  savedVariants: SavedVariant[]
  activeVariantId: string | null
  setActiveVariantId: (id: string | null) => void
  activeVariant: SavedVariant | null
  variantDirty: boolean
  getSnapshotForVector: (vector: SavedVariant['baseVector']) => SavedVariant['overrides']
  applySavedVariant: (variant: SavedVariant) => void
  persistVariant: (
    name: string,
    description: string,
    baseVector: SavedVariant['baseVector'],
    overrides?: SavedVariant['overrides'],
  ) => SavedVariant
  onSaveCurrentVariant: () => void
  onDeleteActiveVariant: () => void
}

export function useSavedVariants({
  data,
  selectedVector,
  overridesForVector,
  variantsForVector,
  activeBulletOrders,
  themeState,
  updateData,
  showNotice,
}: UseSavedVariantsArgs): UseSavedVariantsResult {
  const [activeVariantId, setActiveVariantId] = useState<string | null>(null)

  const savedVariants = useMemo(() => data.saved_variants ?? [], [data.saved_variants])
  const activeVariant = useMemo(
    () => savedVariants.find((variant) => variant.id === activeVariantId) ?? null,
    [savedVariants, activeVariantId],
  )

  const currentVariantSnapshot = useMemo(() => {
    if (!activeVariantId) {
      return null
    }
    return createVariantOverridesSnapshot(
      overridesForVector,
      variantsForVector,
      activeBulletOrders ?? {},
      themeState,
    )
  }, [activeVariantId, overridesForVector, variantsForVector, activeBulletOrders, themeState])

  const variantDirty = useMemo(() => {
    if (!activeVariant || !currentVariantSnapshot) {
      return false
    }
    return !areVariantOverridesEqual(activeVariant.overrides, currentVariantSnapshot)
  }, [activeVariant, currentVariantSnapshot])

  const getSnapshotForVector = (vector: SavedVariant['baseVector']) => {
    const state = useUiStore.getState()
    const resumeState = useResumeStore.getState()
    const key = toVectorKey(vector)

    return createVariantOverridesSnapshot(
      state.manualOverrides[key] ?? {},
      state.variantOverrides[key] ?? {},
      state.bulletOrders[key] ?? {},
      normalizeThemeState(resumeState.data.theme),
    )
  }

  const applySavedVariant = (variant: SavedVariant) => {
    const key = toVectorKey(variant.baseVector)

    useUiStore.setState((state) => ({
      ...state,
      selectedVector: variant.baseVector,
      manualOverrides: {
        ...state.manualOverrides,
        [key]: { ...variant.overrides.manualOverrides },
      },
      variantOverrides: {
        ...state.variantOverrides,
        [key]: { ...variant.overrides.variantOverrides },
      },
      bulletOrders: {
        ...state.bulletOrders,
        [key]: Object.fromEntries(
          Object.entries(variant.overrides.bulletOrders).map(([roleId, order]) => [roleId, [...order]]),
        ),
      },
    }))

    if (variant.overrides.priorityOverrides?.length || variant.overrides.theme) {
      updateData((current) => ({
        ...current,
        roles:
          variant.overrides.priorityOverrides && variant.overrides.priorityOverrides.length > 0
            ? current.roles.map((role) => ({
                ...role,
                bullets: role.bullets.map((bullet) => {
                  const priorityOverride = variant.overrides.priorityOverrides?.find(
                    (override) => override.bulletId === bullet.id,
                  )
                  if (!priorityOverride) {
                    return bullet
                  }
                  return {
                    ...bullet,
                    vectors: {
                      ...bullet.vectors,
                      [priorityOverride.vectorId]: priorityOverride.priority,
                    },
                  }
                }),
              }))
            : current.roles,
        ...(variant.overrides.theme
          ? {
              theme: normalizeThemeState(variant.overrides.theme),
            }
          : {}),
      }))
    }

    setActiveVariantId(variant.id)
    showNotice('success', `Loaded variant ${variant.name}`)
  }

  const persistVariant = (
    name: string,
    description: string,
    baseVector: SavedVariant['baseVector'],
    overrides = getSnapshotForVector(baseVector),
  ): SavedVariant => {
    const existingByName = savedVariants.find((variant) => variant.name.toLowerCase() === name.toLowerCase())

    if (existingByName && existingByName.id !== activeVariantId) {
      const shouldOverwrite = window.confirm(`A variant named "${name}" exists. Overwrite it?`)
      if (!shouldOverwrite) {
        throw new VariantSaveCanceledError('Variant save canceled by user.')
      }
    }

    const shouldReuseActiveVariantId =
      activeVariant != null &&
      existingByName == null &&
      name.toLowerCase() === activeVariant.name.toLowerCase()

    const id =
      existingByName?.id ??
      (shouldReuseActiveVariantId ? activeVariant?.id : undefined) ??
      createId('variant')

    const createdAt =
      existingByName?.createdAt ??
      (shouldReuseActiveVariantId ? activeVariant?.createdAt : undefined) ??
      new Date().toISOString()

    const nextVariant = {
      ...createSavedVariant(id, name, description, baseVector, overrides, createdAt),
      updatedAt: new Date().toISOString(),
    }

    updateData((current) => {
      const variants = current.saved_variants ?? []
      const nextVariants = variants.filter((variant) => variant.id !== id)
      return {
        ...current,
        saved_variants: [...nextVariants, nextVariant].sort((left, right) =>
          left.name.localeCompare(right.name),
        ),
      }
    })

    setActiveVariantId(id)
    return nextVariant
  }

  const onSaveCurrentVariant = () => {
    const currentName = activeVariant?.name ?? ''
    const name = window.prompt('Variant name', currentName)?.trim()
    if (!name) {
      return
    }

    const description = window.prompt('Variant description (optional)', activeVariant?.description ?? '') ?? ''

    try {
      persistVariant(name, description, selectedVector, getSnapshotForVector(selectedVector))
      showNotice('success', `Saved variant ${name}`)
    } catch (error) {
      if (!(error instanceof VariantSaveCanceledError)) {
        showNotice('error', 'Unable to save variant.')
      }
    }
  }

  const onDeleteActiveVariant = () => {
    if (!activeVariant) {
      return
    }

    const confirmed = window.confirm(`Delete variant "${activeVariant.name}"?`)
    if (!confirmed) {
      return
    }

    updateData((current) => ({
      ...current,
      saved_variants: (current.saved_variants ?? []).filter((variant) => variant.id !== activeVariant.id),
    }))

    setActiveVariantId(null)
    showNotice('success', `Deleted variant ${activeVariant.name}`)
  }

  return {
    savedVariants,
    activeVariantId,
    setActiveVariantId,
    activeVariant,
    variantDirty,
    getSnapshotForVector,
    applySavedVariant,
    persistVariant,
    onSaveCurrentVariant,
    onDeleteActiveVariant,
  }
}
