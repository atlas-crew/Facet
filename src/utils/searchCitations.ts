import { CITATION_TYPE_VALUES } from '../types/search'
import type { Citation, CitationType } from '../types/search'

export type CitationRenderMode = 'inline' | 'footnote'

export const CITATION_MARKER_PATTERN = /\[cite:([A-Za-z0-9._-]+)\]/g

const CITATION_TYPES = new Set<CitationType>(CITATION_TYPE_VALUES)

const isString = (value: unknown): value is string => typeof value === 'string'

const isCitationType = (value: unknown): value is CitationType =>
  isString(value) && CITATION_TYPES.has(value as CitationType)

const truncate = (value: string, maxLength: number): string =>
  value.length > maxLength ? value.slice(0, maxLength - 3).trimEnd() + '...' : value

const normalizeCitationUrl = (value: unknown): string | undefined => {
  if (!isString(value)) return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  try {
    const url = new URL(trimmed)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : undefined
  } catch {
    return undefined
  }
}

export function normalizeCitations(value: unknown): Citation[] {
  if (!Array.isArray(value)) return []

  const seen = new Set<string>()
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return []
    const record = entry as Record<string, unknown>
    const id = isString(record.id) ? record.id.trim() : ''
    const source = isString(record.source) ? truncate(record.source.trim(), 80) : ''
    if (!id || !/^[A-Za-z0-9._-]+$/.test(id) || !source || seen.has(id)) return []
    seen.add(id)

    const url = normalizeCitationUrl(record.url)
    const type = isCitationType(record.type) ? record.type : undefined
    const claim = isString(record.claim) ? truncate(record.claim.trim(), 160) || undefined : undefined

    return [
      {
        id,
        source,
        ...(url ? { url } : {}),
        ...(type ? { type } : {}),
        ...(claim ? { claim } : {}),
      },
    ]
  })
}

export function collectCitationMarkerIds(text: string): string[] {
  const ids: string[] = []
  for (const match of text.matchAll(CITATION_MARKER_PATTERN)) {
    const id = match[1]?.trim()
    if (id) ids.push(id)
  }
  return ids
}

export interface CitationMarkerStripResult {
  text: string
  strippedUnresolved: boolean
}

export function stripUnresolvedCitationMarkersWithDiagnostics(
  text: string,
  citations: readonly Citation[],
): CitationMarkerStripResult {
  if (!text.includes('[cite:')) return { text: text.trim(), strippedUnresolved: false }
  const citationIds = new Set(citations.map((citation) => citation.id))
  let strippedUnresolved = false
  const cleaned = text
    .replace(CITATION_MARKER_PATTERN, (marker, id: string) => {
      if (citationIds.has(id.trim())) return marker
      strippedUnresolved = true
      return ''
    })
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+([,.!?;:])/g, '$1')
    .trim()
  return { text: cleaned, strippedUnresolved }
}

export function stripUnresolvedCitationMarkers(
  text: string,
  citations: readonly Citation[],
): string {
  return stripUnresolvedCitationMarkersWithDiagnostics(text, citations).text
}

export function stripCitationMarkers(text: string): string {
  return text.replace(CITATION_MARKER_PATTERN, '').trim()
}

export function splitTextByCitationMarkers(
  text: string,
): Array<{ type: 'text'; text: string } | { type: 'citation'; id: string }> {
  const parts: Array<{ type: 'text'; text: string } | { type: 'citation'; id: string }> = []
  let lastIndex = 0

  for (const match of text.matchAll(CITATION_MARKER_PATTERN)) {
    const index = match.index ?? 0
    if (index > lastIndex) {
      parts.push({ type: 'text', text: text.slice(lastIndex, index) })
    }
    const id = match[1]?.trim()
    if (id) {
      parts.push({ type: 'citation', id })
    }
    lastIndex = index + match[0].length
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', text: text.slice(lastIndex) })
  }

  return parts.length > 0 ? parts : [{ type: 'text', text }]
}

export function getReferencedCitations(
  texts: readonly (string | undefined)[],
  citations: readonly Citation[],
): Citation[] {
  if (citations.length === 0) return []
  const byId = new Map(citations.map((citation) => [citation.id, citation]))
  const seen = new Set<string>()
  const referenced: Citation[] = []

  for (const text of texts) {
    if (!text) continue
    for (const id of collectCitationMarkerIds(text)) {
      if (seen.has(id)) continue
      const citation = byId.get(id)
      if (!citation) continue
      seen.add(id)
      referenced.push(citation)
    }
  }

  return referenced
}
