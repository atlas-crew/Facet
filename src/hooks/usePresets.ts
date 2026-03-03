import { useMemo, useState } from 'react'
import { normalizeThemeState } from '../themes/theme'
import type {
  ResumeData,
  ResumeThemeState,
  Preset,
  VariantSelection,
  VectorSelection,
} from '../types'
import { useResumeStore } from '../store/resumeStore'
import { toVectorKey, useUiStore } from '../store/uiStore'
import {
  arePresetOverridesEqual,
  createPreset,
  createPresetSnapshot,
} from '../utils/presets'

const createId = (prefix: string) => {
  const uuid = globalThis.crypto?.randomUUID?.()
  if (uuid) {
    return `${prefix}-${uuid}`
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

type NoticeTone = 'success' | 'error'

export class PresetSaveCanceledError extends Error {}

interface UsePresetsArgs {
  data: ResumeData
  selectedVector: VectorSelection
  overridesForVector: Record<string, boolean>
  variantsForVector: Record<string, VariantSelection>
  activeBulletOrders: Record<string, string[]>
  themeState: ResumeThemeState
  updateData: (fn: (current: ResumeData) => ResumeData) => void
  showNotice: (tone: NoticeTone, message: string) => void
}

interface UsePresetsResult {
  presets: Preset[]
  activePresetId: string | null
  setActivePresetId: (id: string | null) => void
  activePreset: Preset | null
  presetDirty: boolean
  getSnapshotForVector: (vector: Preset['baseVector']) => Preset['overrides']
  applyPreset: (preset: Preset) => void
  persistPreset: (
    name: string,
    description: string,
    baseVector: Preset['baseVector'],
    overrides?: Preset['overrides'],
  ) => Preset
  onSavePreset: () => void
  onDeleteActivePreset: () => void
}

export function usePresets({
  data,
  selectedVector,
  overridesForVector,
  variantsForVector,
  activeBulletOrders,
  themeState,
  updateData,
  showNotice,
}: UsePresetsArgs): UsePresetsResult {
  const [activePresetId, setActivePresetId] = useState<string | null>(null)

  const presets = useMemo(() => data.presets ?? [], [data.presets])
  const activePreset = useMemo(
    () => presets.find((preset) => preset.id === activePresetId) ?? null,
    [presets, activePresetId],
  )

  const currentPresetSnapshot = useMemo(() => {
    if (!activePresetId) {
      return null
    }
    return createPresetSnapshot(
      overridesForVector,
      variantsForVector,
      activeBulletOrders ?? {},
      themeState,
    )
  }, [activePresetId, overridesForVector, variantsForVector, activeBulletOrders, themeState])

  const presetDirty = useMemo(() => {
    if (!activePreset || !currentPresetSnapshot) {
      return false
    }
    return !arePresetOverridesEqual(activePreset.overrides, currentPresetSnapshot)
  }, [activePreset, currentPresetSnapshot])

  const getSnapshotForVector = (vector: Preset['baseVector']) => {
    const resumeState = useResumeStore.getState()
    const key = toVectorKey(vector)

    return createPresetSnapshot(
      resumeState.data.manualOverrides?.[key] ?? {},
      resumeState.data.variantOverrides?.[key] ?? {},
      resumeState.data.bulletOrders?.[key] ?? {},
      normalizeThemeState(resumeState.data.theme),
    )
  }

  const applyPreset = (preset: Preset) => {
    const key = toVectorKey(preset.baseVector)
    const { setSelectedVector } = useUiStore.getState()

    setSelectedVector(preset.baseVector)

    updateData((current) => {
      const manualOverrides = { ...(current.manualOverrides ?? {}) }
      manualOverrides[key] = { ...preset.overrides.manualOverrides }

      const variantOverrides = { ...(current.variantOverrides ?? {}) }
      variantOverrides[key] = { ...preset.overrides.variantOverrides }

      const bulletOrders = { ...(current.bulletOrders ?? {}) }
      bulletOrders[key] = Object.fromEntries(
        Object.entries(preset.overrides.bulletOrders).map(([roleId, order]) => [roleId, [...order]]),
      )

      return {
        ...current,
        manualOverrides,
        variantOverrides,
        bulletOrders,
        roles:
          preset.overrides.priorityOverrides && preset.overrides.priorityOverrides.length > 0
            ? current.roles.map((role) => ({
                ...role,
                bullets: role.bullets.map((bullet) => {
                  const priorityOverride = preset.overrides.priorityOverrides?.find(
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
        ...(preset.overrides.theme
          ? {
              theme: normalizeThemeState(preset.overrides.theme),
            }
          : {}),
      }
    })

    setActivePresetId(preset.id)
    showNotice('success', `Loaded preset ${preset.name}`)
  }

  const persistPreset = (
    name: string,
    description: string,
    baseVector: Preset['baseVector'],
    overrides = getSnapshotForVector(baseVector),
  ): Preset => {
    const existingByName = presets.find((preset) => preset.name.toLowerCase() === name.toLowerCase())

    if (existingByName && existingByName.id !== activePresetId) {
      const shouldOverwrite = window.confirm(`A preset named "${name}" already exists. Overwrite it?`)
      if (!shouldOverwrite) {
        throw new PresetSaveCanceledError('Preset save canceled by user.')
      }
    }

    const shouldReuseActivePresetId =
      activePreset != null &&
      existingByName == null &&
      name.toLowerCase() === activePreset.name.toLowerCase()

    const id =
      existingByName?.id ??
      (shouldReuseActivePresetId ? activePreset?.id : undefined) ??
      createId('preset')

    const createdAt =
      existingByName?.createdAt ??
      (shouldReuseActivePresetId ? activePreset?.createdAt : undefined) ??
      new Date().toISOString()

    const nextPreset = {
      ...createPreset(id, name, description, baseVector, overrides, createdAt),
      updatedAt: new Date().toISOString(),
    }

    updateData((current) => {
      const existing = current.presets ?? []
      const filtered = existing.filter((preset) => preset.id !== id)
      return {
        ...current,
        presets: [...filtered, nextPreset].sort((left, right) =>
          left.name.localeCompare(right.name),
        ),
      }
    })

    setActivePresetId(id)
    return nextPreset
  }

  const onSavePreset = () => {
    const currentName = activePreset?.name ?? ''
    const name = window.prompt('Preset name', currentName)?.trim()
    if (!name) {
      return
    }

    const description = window.prompt('Preset description (optional)', activePreset?.description ?? '') ?? ''

    try {
      persistPreset(name, description, selectedVector, getSnapshotForVector(selectedVector))
      showNotice('success', `Saved preset ${name}`)
    } catch (error) {
      if (!(error instanceof PresetSaveCanceledError)) {
        showNotice('error', 'Unable to save preset.')
      }
    }
  }

  const onDeleteActivePreset = () => {
    if (!activePreset) {
      return
    }

    const confirmed = window.confirm(`Delete preset "${activePreset.name}"?`)
    if (!confirmed) {
      return
    }

    updateData((current) => ({
      ...current,
      presets: (current.presets ?? []).filter((preset) => preset.id !== activePreset.id),
    }))

    setActivePresetId(null)
    showNotice('success', `Deleted preset ${activePreset.name}`)
  }

  return {
    presets,
    activePresetId,
    setActivePresetId,
    activePreset,
    presetDirty,
    getSnapshotForVector,
    applyPreset,
    persistPreset,
    onSavePreset,
    onDeleteActivePreset,
  }
}
