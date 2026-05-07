import type { InterviewFormat, PipelineEntry } from '../../types/pipeline'
import { INTERVIEW_FORMAT_VALUES } from '../../types/pipeline'
import {
  normalizeJobDescriptionSourceUrl,
  normalizeJobDescriptionText,
} from '../../utils/jobDescriptionText'
import type {
  SearchProfile,
  SearchRequest,
  SearchRequestMaxResults,
  SearchResultEntry,
  SearchResultInterviewProcess,
  SearchThesis,
} from '../../types/search'
import { DEFAULT_SEARCH_MAX_RESULTS } from '../../types/search'
import { createSeededPipelineResearchSnapshot } from '../../utils/pipelineResearch'

export function splitTags(value: string): string[] {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
}

export function joinTags(values: string[]): string {
  return values.join(', ')
}

export function emptyProfile(resumeVersion: number): Omit<SearchProfile, 'id' | 'inferredAt'> {
  return {
    source: {
      kind: 'resume',
      label: 'Resume fallback',
    },
    skills: [],
    workSummary: [],
    openQuestions: [],
    constraints: {
      compensation: '',
      locations: [],
      clearance: '',
      companySize: '',
    },
    filters: {
      prioritize: [],
      avoid: [],
    },
    interviewPrefs: {
      strongFit: [],
      redFlags: [],
    },
    inferredFromResumeVersion: resumeVersion,
  }
}

export function buildRequestDraft(
  profile: Pick<SearchProfile, 'constraints'> | null,
  thesis?: Pick<SearchThesis, 'searchLanes' | 'searchOverrides'> | null,
): Omit<SearchRequest, 'id' | 'createdAt' | 'excludeCompanies'> {
  const focusLanes = thesis?.searchLanes.map((lane) => lane.id).filter(Boolean) ?? []

  // Per-search overrides take precedence over identity-derived profile defaults: the user
  // edited these on the active thesis to apply specifically to this search. Profile is the
  // fallback when no thesis (or no override value) exists.
  const overrideConstraints = thesis?.searchOverrides?.constraints
  const compensation =
    overrideConstraints?.compensation?.trim() || profile?.constraints.compensation || ''
  const companySize = overrideConstraints?.companySize ?? ''

  return {
    focusLanes,
    focusVectors: [],
    companySizeOverride: companySize,
    salaryAnchorOverride: compensation,
    geoExpand: true,
    customKeywords: '',
    maxResults: { ...DEFAULT_SEARCH_MAX_RESULTS },
  }
}

export function groupByTier(results: SearchResultEntry[]) {
  return {
    tier1: results.filter((result) => result.tier === 1),
    tier2: results.filter((result) => result.tier === 2),
    tier3: results.filter((result) => result.tier === 3),
  }
}

export function normalizeMaxResults(
  current: SearchRequestMaxResults,
  key: keyof SearchRequestMaxResults,
  value: string,
): SearchRequestMaxResults {
  const parsed = Number.parseInt(value, 10)
  return {
    ...current,
    [key]: Number.isFinite(parsed) ? Math.max(1, parsed) : current[key],
  }
}

export function toPipelineTier(tier: SearchResultEntry['tier'] | number): '1' | '2' | '3' | null {
  if (tier === 1) return '1'
  if (tier === 2) return '2'
  if (tier === 3) return '3'
  return null
}

const FORMAT_PHRASE_TO_ENUM: ReadonlyArray<readonly [RegExp, InterviewFormat]> = [
  [/\bhr[\s-]?screen\b/i, 'hr-screen'],
  [/\b(hiring[\s-]?manager|hm)[\s-]?(screen|chat)?\b/i, 'hm-screen'],
  [/\bsystem[\s-]?design\b/i, 'system-design'],
  [/\btake[\s-]?home\b/i, 'take-home'],
  [/\b(live|onsite)[\s-]?coding\b/i, 'live-coding'],
  [/\bleet[\s-]?code\b/i, 'leetcode'],
  [/\bpair[\s-]?(programm?ing)?\b/i, 'pair-programming'],
  [/\bbehavior[a-z]*\b/i, 'behavioral'],
  [/\b(peer|panel)\b/i, 'peer-panel'],
  [/\bcross[\s-]?team\b/i, 'cross-team'],
  [/\b(exec(utive)?|founder)\b/i, 'exec'],
  [/\bpresentation\b/i, 'presentation'],
  [
    /\b(tech(nical)?[\s-]?(discussion|deep[\s-]?dive|chat)|architecture[\s-]?review)\b/i,
    'tech-discussion',
  ],
]

/**
 * Parse a free-form interviewProcess.format string ("take-home + system design + behavioral panel")
 * into the strict InterviewFormat[] used by PipelineEntry.format. Phrases the parser doesn't
 * recognise are silently dropped — they survive elsewhere in the pipeline entry (notes/research)
 * so nothing is lost; we just don't smuggle invalid enum values into a strict union.
 */
export function parseInterviewFormatPhrases(value: string): InterviewFormat[] {
  if (!value) return []
  const seen = new Set<InterviewFormat>()
  for (const [pattern, format] of FORMAT_PHRASE_TO_ENUM) {
    if (pattern.test(value)) {
      seen.add(format)
    }
  }
  return INTERVIEW_FORMAT_VALUES.filter((format) => seen.has(format))
}

export function buildInterviewProcessSignals(
  process: SearchResultInterviewProcess | undefined,
): string[] {
  if (!process) return []
  const signals: string[] = []
  const formatPhrase = process.format.trim()
  if (formatPhrase) {
    signals.push('Format: ' + formatPhrase)
  }
  if (process.estimatedTimeline?.trim()) {
    signals.push('Timeline: ' + process.estimatedTimeline.trim())
  }
  if (process.builderFriendly) {
    signals.push('Builder-friendly process')
  }
  if (process.aiToolsAllowed) {
    signals.push('AI tools allowed during interviews')
  }
  return signals
}

export function createPipelineEntryDraft(
  entry: SearchResultEntry,
  vectorId: string,
  options: { searchQueries?: string[] } = {},
): Omit<PipelineEntry, 'id' | 'createdAt' | 'lastAction' | 'history'> | null {
  const pipelineTier = toPipelineTier(entry.tier)
  if (!pipelineTier) {
    return null
  }

  const positioning = entry.candidateEdge?.trim() || entry.vectorAlignment
  const skillMatch = [entry.matchReason, entry.advantageMatch?.trim()]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .join('\n\n')
  const format = entry.interviewProcess
    ? parseInterviewFormatPhrases(entry.interviewProcess.format)
    : []
  const notesParts: string[] = []
  if (entry.signalGroup?.trim()) {
    notesParts.push('Signal group: ' + entry.signalGroup.trim())
  }
  if (entry.companyIntel) {
    const intelLines = [
      entry.companyIntel.stage && 'Stage: ' + entry.companyIntel.stage,
      entry.companyIntel.aiCulture && 'AI culture: ' + entry.companyIntel.aiCulture,
      entry.companyIntel.remotePolicy && 'Remote policy: ' + entry.companyIntel.remotePolicy,
      typeof entry.companyIntel.openRoleCount === 'number' &&
        entry.companyIntel.openRoleCount > 0 &&
        'Open roles: ' + String(entry.companyIntel.openRoleCount),
    ].filter((value): value is string => Boolean(value))
    if (intelLines.length > 0) {
      notesParts.push(intelLines.join('\n'))
    }
  }
  if (entry.risks.length > 0) {
    notesParts.push('Risks:\n' + entry.risks.map((risk) => '- ' + risk).join('\n'))
  }
  const researchJobDescription = normalizeJobDescriptionText(entry.jobDescription)
  const researchJobDescriptionSourceUrl = researchJobDescription
    ? normalizeJobDescriptionSourceUrl(entry.jobDescriptionSourceUrl, entry.url)
    : undefined
  const jobDescription = researchJobDescriptionSourceUrl ? researchJobDescription : ''
  const jobDescriptionSourceUrl = researchJobDescriptionSourceUrl ?? null

  return {
    company: entry.company,
    role: entry.title,
    tier: pipelineTier,
    status: 'researching',
    comp: entry.estimatedComp ?? '',
    url: entry.url,
    contact: '',
    vectorId: vectorId || null,
    jobDescription,
    jobDescriptionSourceUrl,
    jdAnalysisId: null,
    presetId: null,
    resumeVariant: '',
    resumeGeneration: null,
    positioning,
    skillMatch,
    nextStep: 'Review opportunity and tailor resume',
    notes: notesParts.join('\n\n'),
    appMethod: 'unknown',
    response: 'none',
    daysToResponse: null,
    rounds: null,
    format,
    rejectionStage: '',
    rejectionReason: '',
    offerAmount: '',
    dateApplied: '',
    dateClosed: '',
    research: createSeededPipelineResearchSnapshot(entry, {
      searchQueries: options.searchQueries,
    }),
  }
}
