import type { PipelineEntry } from '../../types/pipeline'
import type {
  SearchProfile,
  SearchRequest,
  SearchRequestMaxResults,
  SearchResultEntry,
  VectorSearchConfig,
} from '../../types/search'
import { DEFAULT_SEARCH_MAX_RESULTS } from '../../types/search'

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
    vectors: [],
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

export function upsertVectorConfig(
  existing: VectorSearchConfig[],
  vectorId: string,
  patch: Partial<VectorSearchConfig>,
): VectorSearchConfig[] {
  const current =
    existing.find((vector) => vector.vectorId === vectorId) ?? {
      vectorId,
      priority: existing.length + 1,
      description: '',
      targetRoleTitles: [],
      searchKeywords: [],
    }

  const next = { ...current, ...patch, vectorId }
  const others = existing.filter((vector) => vector.vectorId !== vectorId)
  return [...others, next].sort((left, right) => left.priority - right.priority)
}

export function buildRequestDraft(
  profile: Pick<SearchProfile, 'vectors' | 'constraints'> | null,
): Omit<SearchRequest, 'id' | 'createdAt' | 'excludeCompanies'> {
  const focusVectors = profile?.vectors
    .slice()
    .sort((left, right) => left.priority - right.priority)
    .map((vector) => vector.vectorId)
    .slice(0, 2) ?? []

  return {
    focusVectors,
    companySizeOverride: '',
    salaryAnchorOverride: profile?.constraints.compensation ?? '',
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

export function createPipelineEntryDraft(
  entry: SearchResultEntry,
  vectorId: string,
): Omit<PipelineEntry, 'id' | 'createdAt' | 'lastAction' | 'history'> | null {
  const pipelineTier = toPipelineTier(entry.tier)
  if (!pipelineTier) {
    return null
  }

  return {
    company: entry.company,
    role: entry.title,
    tier: pipelineTier,
    status: 'researching',
    comp: entry.estimatedComp ?? '',
    url: entry.url,
    contact: '',
    vectorId: vectorId || null,
    jobDescription: '',
    presetId: null,
    resumeVariant: '',
    positioning: entry.vectorAlignment,
    skillMatch: entry.matchReason,
    nextStep: 'Review opportunity and tailor resume',
    notes: entry.risks.join('\n'),
    appMethod: 'unknown',
    response: 'none',
    daysToResponse: null,
    rounds: null,
    format: [],
    rejectionStage: '',
    rejectionReason: '',
    offerAmount: '',
    dateApplied: '',
    dateClosed: '',
  }
}
