import type { SearchProfileFilterEntry, SearchProfileFilterSeverity } from '../types/search'

const FILTER_SEVERITIES = new Set<SearchProfileFilterSeverity>(['hard', 'soft', 'conditional'])

const normalizeLabel = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

const normalizeSeverity = (value: unknown, condition: string): SearchProfileFilterSeverity => {
  if (FILTER_SEVERITIES.has(value as SearchProfileFilterSeverity)) {
    return value as SearchProfileFilterSeverity
  }

  return condition ? 'conditional' : 'soft'
}

export const normalizeSearchProfileFilterEntry = (
  value: unknown,
): SearchProfileFilterEntry | null => {
  if (typeof value === 'string') {
    const label = normalizeLabel(value)
    return label ? { label, severity: 'soft' } : null
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const record = value as Partial<Record<keyof SearchProfileFilterEntry, unknown>>
  const label = normalizeLabel(record.label)
  if (!label) return null

  const condition = normalizeLabel(record.condition)
  return {
    label,
    ...(condition ? { condition } : {}),
    severity: normalizeSeverity(record.severity, condition),
  }
}

export const normalizeSearchProfileFilterEntries = (value: unknown): SearchProfileFilterEntry[] =>
  Array.isArray(value)
    ? value.flatMap((entry) => normalizeSearchProfileFilterEntry(entry) ?? [])
    : []

export const searchProfileFilterLabels = (entries: readonly SearchProfileFilterEntry[]): string[] =>
  entries.map((entry) => entry.label)

export const formatSearchProfileFilterEntry = (entry: SearchProfileFilterEntry): string =>
  entry.condition ? entry.label + ' (condition: ' + entry.condition + ')' : entry.label
