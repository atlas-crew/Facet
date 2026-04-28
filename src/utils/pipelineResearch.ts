import type {
  PipelineResearchPerson,
  PipelineResearchSnapshot,
  PipelineResearchSource,
  PipelineResearchSourceKind,
} from '../types/pipeline'
import type { SearchResultEntry } from '../types/search'
import { sanitizeUrl } from './sanitizeUrl'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const trimString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : ''

const normalizeStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .map((item) => trimString(item))
        .filter(Boolean)
    : []

const normalizeSourceKind = (value: unknown): PipelineResearchSourceKind => {
  switch (value) {
    case 'job-posting':
    case 'search-result':
    case 'company':
    case 'people':
    case 'review':
      return value
    default:
      return 'other'
  }
}

const normalizeSource = (value: unknown): PipelineResearchSource | null => {
  if (!isRecord(value)) {
    return null
  }

  const url = sanitizeUrl(trimString(value.url)) ?? ''
  const label = trimString(value.label) || url

  if (!label) {
    return null
  }

  return {
    label,
    ...(url ? { url } : {}),
    kind: normalizeSourceKind(value.kind),
  }
}

const normalizePerson = (value: unknown): PipelineResearchPerson | null => {
  if (!isRecord(value)) {
    return null
  }

  const name = trimString(value.name)
  if (!name) {
    return null
  }

  const profileUrl = sanitizeUrl(trimString(value.profileUrl)) ?? ''

  return {
    name,
    title: trimString(value.title),
    company: trimString(value.company),
    ...(profileUrl ? { profileUrl } : {}),
    relevance: trimString(value.relevance),
  }
}

export function normalizePipelineResearchSnapshot(
  value: unknown,
): PipelineResearchSnapshot | undefined {
  if (!isRecord(value)) {
    return undefined
  }

  const status = value.status === 'investigated' ? 'investigated' : 'seeded'
  const summary = trimString(value.summary)
  const jobDescriptionSummary = trimString(value.jobDescriptionSummary)
  const interviewSignals = normalizeStringArray(value.interviewSignals)
  const people = Array.isArray(value.people)
    ? value.people.flatMap((person) => {
        const normalized = normalizePerson(person)
        return normalized ? [normalized] : []
      })
    : []
  const sources = Array.isArray(value.sources)
    ? value.sources.flatMap((source) => {
        const normalized = normalizeSource(source)
        return normalized ? [normalized] : []
      })
    : []
  const searchQueries = [...new Set(normalizeStringArray(value.searchQueries))]
  const lastInvestigatedAt = trimString(value.lastInvestigatedAt)

  const hasContent =
    summary ||
    jobDescriptionSummary ||
    interviewSignals.length > 0 ||
    people.length > 0 ||
    sources.length > 0 ||
    searchQueries.length > 0

  if (!hasContent) {
    return undefined
  }

  return {
    status,
    summary,
    jobDescriptionSummary,
    interviewSignals,
    people,
    sources,
    searchQueries,
    lastInvestigatedAt,
  }
}

export function createSeededPipelineResearchSnapshot(
  entry: SearchResultEntry,
  options: { searchQueries?: string[] } = {},
): PipelineResearchSnapshot {
  const sourceUrl = sanitizeUrl(entry.url) ?? ''
  const summaryParts: string[] = []
  const matchReason = entry.matchReason.trim()
  if (matchReason) {
    summaryParts.push(matchReason)
  }
  if (entry.companyIntel) {
    const intel = [
      entry.companyIntel.stage && `Stage: ${entry.companyIntel.stage}`,
      entry.companyIntel.aiCulture && `AI culture: ${entry.companyIntel.aiCulture}`,
      entry.companyIntel.remotePolicy && `Remote policy: ${entry.companyIntel.remotePolicy}`,
    ].filter((value): value is string => Boolean(value))
    if (intel.length > 0) {
      summaryParts.push(intel.join(' · '))
    }
  }
  if (entry.risks.length > 0) {
    summaryParts.push(`Risks: ${entry.risks.join('; ')}`)
  }

  const interviewSignals: string[] = []
  if (entry.interviewProcess?.format.trim()) {
    interviewSignals.push(`Format: ${entry.interviewProcess.format.trim()}`)
  }
  if (entry.interviewProcess?.estimatedTimeline?.trim()) {
    interviewSignals.push(`Timeline: ${entry.interviewProcess.estimatedTimeline.trim()}`)
  }
  if (entry.interviewProcess?.builderFriendly) {
    interviewSignals.push('Builder-friendly process')
  }
  if (entry.interviewProcess?.aiToolsAllowed) {
    interviewSignals.push('AI tools allowed during interviews')
  }
  if (entry.signalGroup?.trim()) {
    interviewSignals.push(`Signal group: ${entry.signalGroup.trim()}`)
  }

  return {
    status: 'seeded',
    summary: summaryParts.join(' · '),
    jobDescriptionSummary: '',
    interviewSignals,
    people: [],
    sources: [
      {
        label: sourceUrl ? `${entry.company} job posting` : `${entry.company} research result`,
        ...(sourceUrl ? { url: sourceUrl } : {}),
        kind: sourceUrl ? 'job-posting' : 'search-result',
      },
      {
        label: `Search result via ${entry.source}`,
        kind: 'search-result',
      },
    ],
    searchQueries: normalizeStringArray(options.searchQueries),
    lastInvestigatedAt: '',
  }
}
