import type {
  ResumeThemeState,
  Preset,
  PresetOverrides,
  VectorSelection,
} from '../types'

const sortObject = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => sortObject(item))
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map((key) => [key, sortObject(record[key])]),
    )
  }
  return value
}

const stableStringify = (value: unknown): string => JSON.stringify(sortObject(value))

export const createPresetSnapshot = (
  manualOverrides: Record<string, boolean>,
  variantOverrides: Record<string, Preset['overrides']['variantOverrides'][string]>,
  bulletOrders: Record<string, string[]>,
  theme: ResumeThemeState | undefined,
): PresetOverrides => ({
  manualOverrides: { ...manualOverrides },
  variantOverrides: { ...variantOverrides },
  bulletOrders: Object.fromEntries(
    Object.entries(bulletOrders).map(([roleId, order]) => [roleId, [...order]]),
  ),
  theme: theme
    ? {
        preset: theme.preset,
        ...(theme.overrides ? { overrides: { ...theme.overrides } } : {}),
      }
    : undefined,
})

export const arePresetOverridesEqual = (
  left: PresetOverrides,
  right: PresetOverrides,
): boolean => stableStringify(left) === stableStringify(right)

export const createPreset = (
  id: string,
  name: string,
  description: string,
  baseVector: VectorSelection,
  overrides: PresetOverrides,
  createdAt = new Date().toISOString(),
): Preset => ({
  id,
  name,
  description: description.trim().length > 0 ? description.trim() : undefined,
  createdAt,
  updatedAt: new Date().toISOString(),
  baseVector,
  overrides,
})
