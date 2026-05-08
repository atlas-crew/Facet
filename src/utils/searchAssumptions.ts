import type {
  SearchAssumption,
  SearchAssumptionConfidence,
  SearchAssumptionSource,
} from '../types/search'
import { createId } from './idUtils'

const VALID_ASSUMPTION_SOURCES = new Set<SearchAssumptionSource>([
  'inferred',
  'assumed-default',
  'explicit-fallback',
])

const VALID_ASSUMPTION_CONFIDENCES = new Set<SearchAssumptionConfidence>(['high', 'medium', 'low'])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const normalizeString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

const normalizeBoolean = (value: unknown): boolean | null =>
  typeof value === 'boolean' ? value : null

export function normalizeSearchAssumptions(value: unknown): SearchAssumption[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((entry) => {
    if (!isRecord(entry)) return []

    const claim = normalizeString(entry.claim)
    const source = normalizeString(entry.source)
    const confidence = normalizeString(entry.confidence)
    const overridable = normalizeBoolean(entry.overridable)

    if (
      !claim ||
      !VALID_ASSUMPTION_SOURCES.has(source as SearchAssumptionSource) ||
      !VALID_ASSUMPTION_CONFIDENCES.has(confidence as SearchAssumptionConfidence) ||
      overridable === null
    ) {
      return []
    }

    const rationale = normalizeString(entry.rationale)
    return [
      {
        id: normalizeString(entry.id) || createId('sassump'),
        claim,
        source: source as SearchAssumptionSource,
        ...(rationale ? { rationale } : {}),
        confidence: confidence as SearchAssumptionConfidence,
        overridable,
      },
    ]
  })
}
