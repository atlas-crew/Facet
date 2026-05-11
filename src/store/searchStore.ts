import { create } from 'zustand'
import type {
  FeedbackApplicationState,
  SearchFeedbackDimensions,
  SearchFeedbackEvent,
  SearchFeedbackEventBase,
  SearchFeedbackRating,
  SearchInstanceOverrides,
  SearchProfile,
  SearchProfileConstraints,
  SearchRequest,
  SearchRun,
  SearchRunNarrative,
  SearchRunNarrativeState,
  ActiveResearchJobState,
  SalaryBand,
  SearchThesis,
  SearchThesisSignal,
} from '../types/search'
import { DEFAULT_SEARCH_MAX_RESULTS, EMPTY_SEARCH_INSTANCE_OVERRIDES } from '../types/search'
import { createId } from '../utils/idUtils'
import {
  type ArtifactStalenessReview,
  sanitizeArtifactStalenessReview,
  sanitizeIdentityVersion,
} from '../types/artifactMeta'
import {
  ensureDurableMetadata,
  stripDurableMetadataPatch,
  touchDurableMetadata,
} from './durableMetadata'
import { normalizeSearchProfileFilterEntries } from '../utils/searchProfileFilters'
import {
  EMPTY_SALARY_BAND,
  normalizeSalaryBand,
  parseLegacySalaryBand,
} from '../utils/searchSalary'

type SearchProfileInput = Omit<SearchProfile, 'id' | 'inferredAt'> &
  Partial<Pick<SearchProfile, 'id' | 'inferredAt'>>

type LegacySearchProfileConstraintsInput = Partial<Omit<SearchProfileConstraints, 'salary'>> & {
  salary?: unknown
  compensation?: unknown
}

/** Accepts pre-Phase-C persisted snapshots that still carry profile.vectors so hydration can strip it. */
type LegacySearchProfileInput = Omit<SearchProfileInput, 'constraints' | 'filters'> & {
  constraints: LegacySearchProfileConstraintsInput
  vectors?: unknown
  filters?: { prioritize?: unknown; avoid?: unknown }
}

type SearchRequestInput = Omit<SearchRequest, 'id' | 'createdAt' | 'focusLanes'> &
  Partial<Pick<SearchRequest, 'id' | 'createdAt' | 'focusLanes'>>

/** Accepts pre-Phase-D persisted requests that still carry retired fields. */
type LegacySearchRequestInput = SearchRequestInput & Record<string, unknown>

type SearchRunInput = Omit<SearchRun, 'id' | 'createdAt' | 'narrativeState'> &
  Partial<Pick<SearchRun, 'id' | 'createdAt' | 'narrativeState'>>

type LegacySearchRunInput = SearchRunInput & {
  narrative?: unknown
  contractViolations?: unknown
  narrativeState?: unknown
}

type LegacySearchThesisSignalInput = string | Partial<SearchThesisSignal>

type LegacySearchThesisAvoidInput = string | Partial<SearchThesisSignal>

/** Legacy persisted snapshots may still carry filters; new code must write canonical signals. */
type SearchInstanceOverridesInput = Omit<SearchInstanceOverrides, 'constraints'> & {
  constraints?: LegacySearchProfileConstraintsInput
  filters?: { prioritize?: unknown; avoid?: unknown }
}

type SearchThesisInput = Omit<
  SearchThesis,
  'id' | 'createdAt' | 'updatedAt' | 'lookFor' | 'avoid' | 'searchOverrides'
> &
  Partial<Pick<SearchThesis, 'id' | 'createdAt' | 'updatedAt'>> & {
    lookFor?: LegacySearchThesisSignalInput[]
    avoid?: LegacySearchThesisAvoidInput[]
    searchOverrides?: SearchInstanceOverridesInput
  }

/** Caller supplies every feedback-event field except store-generated identity/timestamps. */
export type SearchFeedbackEventInput = Omit<
  SearchFeedbackEventBase,
  'id' | 'createdAt' | 'updatedAt'
> &
  FeedbackApplicationState

type LegacySearchFeedbackEventInput = Partial<SearchFeedbackEventBase> & {
  appliedToIdentity?: unknown
  appliedAtVersion?: unknown
}

type SearchOrphanPrunableState = {
  requests: SearchRequest[]
  runs: SearchRun[]
  theses: SearchThesis[]
  activeThesisId: string | null
  feedbackEvents: SearchFeedbackEvent[]
  activeResearchJob: ActiveResearchJobState | null
}

interface SearchState {
  profile: SearchProfile | null
  requests: SearchRequest[]
  runs: SearchRun[]
  theses: SearchThesis[]
  activeThesisId: string | null
  feedbackEvents: SearchFeedbackEvent[]
  activeResearchJob: ActiveResearchJobState | null

  setProfile: (profile: SearchProfileInput) => SearchProfile
  clearProfile: () => void
  addRequest: (request: SearchRequestInput) => SearchRequest
  updateRequest: (id: string, patch: Partial<SearchRequest>) => void
  deleteRequest: (id: string) => void
  addRun: (run: SearchRunInput) => SearchRun
  updateRun: (id: string, patch: Partial<SearchRun>) => void
  deleteRun: (id: string) => void
  getRunsForRequest: (requestId: string) => SearchRun[]
  addThesis: (thesis: SearchThesisInput) => SearchThesis
  markThesisStalenessReview: (id: string, review: ArtifactStalenessReview) => boolean
  saveThesisRevision: (baseId: string, patch: Partial<SearchThesis>) => SearchThesis | null
  /** Update one slice of a thesis's per-search override layer. */
  updateThesisOverrides: (
    id: string,
    patch: Partial<SearchInstanceOverrides>,
  ) => SearchThesis | null
  /** Toggle a skill id in the hidden-from-this-search set. */
  toggleThesisHiddenSkill: (id: string, skillId: string) => SearchThesis | null
  setActiveThesis: (id: string | null) => void
  setActiveResearchJob: (job: ActiveResearchJobState) => void
  updateActiveResearchJob: (patch: Partial<ActiveResearchJobState>) => void
  clearActiveResearchJob: (jobId?: string) => void

  addFeedbackEvent: (event: SearchFeedbackEventInput) => SearchFeedbackEvent
  /** Flip `appliedToIdentity=true` and record the identity version that absorbed the event. */
  markFeedbackApplied: (id: string, identityVersion: number) => void
  /** Record which search thesis first incorporated a batch of applied events; first write wins. */
  markFeedbackReflectedInThesis: (ids: readonly string[], thesisId: string) => void
  /**
   * Events eligible for thesis regeneration input — applied to identity but not yet
   * reflected in the current thesis. When `currentThesisId` is undefined, returns every
   * applied event (the "build a new thesis from scratch" case).
   */
  getUnreflectedFeedback: (currentThesisId?: string) => SearchFeedbackEvent[]
  /** Every feedback event for a given artifact (run or result). */
  getFeedbackEventsForRun: (runId: string) => SearchFeedbackEvent[]
}

const now = () => new Date().toISOString()

const sameStringList = (left: readonly string[], right: readonly string[]) =>
  left.length === right.length && left.every((value, index) => value === right[index])

export const pruneOrphans = <TState extends SearchOrphanPrunableState>(state: TState): TState => {
  const validRequestIds = new Set(state.requests.map((request) => request.id))
  const runs = state.runs.filter((run) => validRequestIds.has(run.requestId))
  const validRunIds = new Set(runs.map((run) => run.id))
  const feedbackEventsForRuns = state.feedbackEvents.filter((event) => validRunIds.has(event.runId))
  const validFeedbackIds = new Set(feedbackEventsForRuns.map((event) => event.id))
  const theses = state.theses.map((thesis) => {
    const currentFeedbackIncorporated = thesis.feedbackIncorporated ?? []
    const feedbackIncorporated = currentFeedbackIncorporated.filter((id) =>
      validFeedbackIds.has(id),
    )
    return sameStringList(currentFeedbackIncorporated, feedbackIncorporated)
      ? thesis
      : { ...thesis, feedbackIncorporated }
  })
  const validThesisIds = new Set(theses.map((thesis) => thesis.id))
  const feedbackEvents = feedbackEventsForRuns.map((event) => {
    // Search feedback is only reflected by regenerated theses. The generic
    // field name stays aligned with the shared feedback contract, but this
    // store validates it against thesis ids.
    const {
      reflectedInThesisId: currentReflectedInThesisId,
      reflectedInArtifactId: currentReflectedInArtifactId,
      ...eventWithoutReflection
    } = event
    const reflectedInThesisId =
      currentReflectedInThesisId && validThesisIds.has(currentReflectedInThesisId)
        ? currentReflectedInThesisId
        : undefined
    const reflectedInArtifactId =
      currentReflectedInArtifactId && validThesisIds.has(currentReflectedInArtifactId)
        ? currentReflectedInArtifactId
        : undefined
    return reflectedInThesisId === currentReflectedInThesisId &&
      reflectedInArtifactId === currentReflectedInArtifactId
      ? event
      : {
          ...eventWithoutReflection,
          ...(reflectedInThesisId ? { reflectedInThesisId } : {}),
          ...(reflectedInArtifactId ? { reflectedInArtifactId } : {}),
        }
  })
  const activeThesisId =
    state.activeThesisId && validThesisIds.has(state.activeThesisId) ? state.activeThesisId : null
  const activeResearchJob =
    state.activeResearchJob &&
    validRequestIds.has(state.activeResearchJob.requestId) &&
    validRunIds.has(state.activeResearchJob.runId) &&
    validThesisIds.has(state.activeResearchJob.thesisId)
      ? state.activeResearchJob
      : null

  return {
    ...state,
    runs,
    theses,
    activeThesisId,
    feedbackEvents,
    activeResearchJob,
  }
}

let warnedLegacySalaryParseFailure = false

const warnLegacySalaryParseFailure = () => {
  if (warnedLegacySalaryParseFailure) return
  warnedLegacySalaryParseFailure = true
  console.warn(
    'Facet could not migrate a legacy search compensation string into a salary band. Resetting it to { min: 0, max: 0 }.',
  )
}

const hydrateSalary = (
  constraints: LegacySearchProfileConstraintsInput | undefined,
): SalaryBand => {
  if (constraints?.salary !== undefined) return normalizeSalaryBand(constraints.salary)
  if (constraints?.compensation === undefined) return { ...EMPTY_SALARY_BAND }
  if (typeof constraints.compensation === 'string') {
    const parsed = parseLegacySalaryBand(constraints.compensation)
    if (parsed) return parsed
    if (constraints.compensation.trim()) warnLegacySalaryParseFailure()
    return { ...EMPTY_SALARY_BAND }
  }
  warnLegacySalaryParseFailure()
  return { ...EMPTY_SALARY_BAND }
}

// Spread first preserves additive fields; explicit defaults coerce known undefined fields.
const hydrateConstraints = (
  constraints: LegacySearchProfileConstraintsInput | undefined,
): SearchProfileConstraints => {
  const { compensation: _legacyCompensation, salary: _legacySalary, ...rest } = constraints ?? {}
  void _legacyCompensation
  void _legacySalary
  return {
    ...rest,
    salary: hydrateSalary(constraints),
    locations: constraints?.locations ?? [],
    clearance: constraints?.clearance ?? '',
    companySize: constraints?.companySize ?? '',
    industriesToAvoid: constraints?.industriesToAvoid ?? [],
    fundingStagesAcceptable: constraints?.fundingStagesAcceptable ?? [],
    remotePolicies: constraints?.remotePolicies ?? [],
    remotePolicyNote: constraints?.remotePolicyNote ?? '',
    employmentTypes: constraints?.employmentTypes ?? [],
  }
}

const hydrateProfile = (profile: LegacySearchProfileInput): SearchProfile => {
  const { vectors: _legacyVectors, ...profileWithoutLegacyVectors } = profile
  return {
    ...profileWithoutLegacyVectors,
    constraints: hydrateConstraints(profileWithoutLegacyVectors.constraints),
    filters: {
      prioritize: normalizeSearchProfileFilterEntries(
        profileWithoutLegacyVectors.filters?.prioritize,
      ),
      avoid: normalizeSearchProfileFilterEntries(profileWithoutLegacyVectors.filters?.avoid),
    },
    source: profileWithoutLegacyVectors.source ?? { kind: 'resume', label: 'Resume fallback' },
    id: profileWithoutLegacyVectors.id ?? createId('sprof'),
    inferredAt: profileWithoutLegacyVectors.inferredAt ?? now(),
    durableMeta: ensureDurableMetadata(
      profileWithoutLegacyVectors.durableMeta,
      profileWithoutLegacyVectors.inferredAt ?? now(),
    ),
  }
}

const hydrateString = (value: unknown): string => (typeof value === 'string' ? value : '')

const searchCompanySizeOverrides = new Set<SearchRequest['companySizeOverride']>([
  '',
  'startup',
  'growth',
  'mid-market',
  'enterprise',
  'public',
  'any',
])

const hydrateCompanySizeOverride = (value: unknown): SearchRequest['companySizeOverride'] => {
  const normalized = hydrateString(value).trim()
  return searchCompanySizeOverrides.has(normalized as SearchRequest['companySizeOverride'])
    ? (normalized as SearchRequest['companySizeOverride'])
    : ''
}

const hydrateBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback

const hydrateStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []

const hydrateNonNegativeInteger = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.round(value) : fallback

const hydrateMaxResults = (value: unknown): SearchRequest['maxResults'] => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ...DEFAULT_SEARCH_MAX_RESULTS }
  }
  const maxResults = value as Partial<Record<keyof SearchRequest['maxResults'], unknown>>
  return {
    tier1: hydrateNonNegativeInteger(maxResults.tier1, DEFAULT_SEARCH_MAX_RESULTS.tier1),
    tier2: hydrateNonNegativeInteger(maxResults.tier2, DEFAULT_SEARCH_MAX_RESULTS.tier2),
    tier3: hydrateNonNegativeInteger(maxResults.tier3, DEFAULT_SEARCH_MAX_RESULTS.tier3),
  }
}

const hydrateResumeVariants = (value: unknown): SearchRequest['resumeVariants'] => {
  if (!Array.isArray(value)) return undefined
  const variants = value.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return []
    const record = item as Record<string, unknown>
    const id = hydrateString(record.id).trim()
    const label = hydrateString(record.label).trim()
    if (!id || !label) return []
    const description = hydrateString(record.description).trim()
    return [
      {
        id,
        label,
        ...(description ? { description } : {}),
      },
    ]
  })
  return variants.length > 0 ? variants : undefined
}

const hydrateRequest = (request: LegacySearchRequestInput): SearchRequest => {
  const resumeVariants = hydrateResumeVariants(request.resumeVariants)
  // Explicit enumeration drops unknown persisted request fields, including Phase-D retired keys.
  return {
    focusLanes: hydrateStringArray(request.focusLanes),
    companySizeOverride: hydrateCompanySizeOverride(request.companySizeOverride),
    salaryAnchorOverride: hydrateString(request.salaryAnchorOverride),
    geoExpand: hydrateBoolean(request.geoExpand, true),
    customKeywords: hydrateString(request.customKeywords),
    excludeCompanies: hydrateStringArray(request.excludeCompanies),
    maxResults: hydrateMaxResults(request.maxResults),
    ...(resumeVariants ? { resumeVariants } : {}),
    id: request.id ?? createId('sreq'),
    createdAt: request.createdAt ?? now(),
    durableMeta: ensureDurableMetadata(request.durableMeta, request.createdAt ?? now()),
  }
}

const hydrateRunNarrativeState = (run: LegacySearchRunInput): SearchRunNarrativeState => {
  const state = run.narrativeState
  if (state && typeof state === 'object' && !Array.isArray(state)) {
    const record = state as Record<string, unknown>
    if (record.status === 'pending' || record.status === 'generating') {
      return { status: record.status }
    }
    if (record.status === 'failed') {
      return {
        status: 'failed',
        error:
          typeof record.error === 'string' && record.error.trim()
            ? record.error
            : 'Run narrative payload failed validation.',
        contractViolations: hydrateStringArray(record.contractViolations),
      }
    }
    if (
      record.status === 'ready' &&
      record.narrative &&
      typeof record.narrative === 'object' &&
      !Array.isArray(record.narrative)
    ) {
      return {
        status: 'ready',
        narrative: record.narrative as SearchRunNarrative,
        contractViolations: hydrateStringArray(record.contractViolations),
      }
    }
  }

  if (run.narrative && typeof run.narrative === 'object' && !Array.isArray(run.narrative)) {
    return {
      status: 'ready',
      narrative: run.narrative as SearchRunNarrative,
      contractViolations: hydrateStringArray(run.contractViolations),
    }
  }

  const legacyViolations = hydrateStringArray(run.contractViolations)
  if (legacyViolations.length > 0) {
    return {
      status: 'failed',
      error: 'Migrated run narrative failed validation.',
      contractViolations: legacyViolations,
    }
  }

  return { status: 'pending' }
}

const hydrateRun = (run: LegacySearchRunInput): SearchRun => {
  const {
    narrative: _legacyNarrative,
    contractViolations: _legacyContractViolations,
    narrativeState: _legacyNarrativeState,
    ...runWithoutLegacyNarrative
  } = run
  void _legacyNarrative
  void _legacyContractViolations
  void _legacyNarrativeState
  return {
    ...runWithoutLegacyNarrative,
    narrativeState: hydrateRunNarrativeState(run),
    id: run.id ?? createId('srun'),
    createdAt: run.createdAt ?? now(),
    stalenessReview: sanitizeArtifactStalenessReview(run.stalenessReview),
    durableMeta: ensureDurableMetadata(run.durableMeta, run.createdAt ?? now()),
  }
}

const hydrateFeedbackApplicationState = (
  event: LegacySearchFeedbackEventInput,
): FeedbackApplicationState => {
  const appliedAtVersion = sanitizeIdentityVersion(event.appliedAtVersion)
  return event.appliedToIdentity === true && appliedAtVersion !== undefined
    ? { appliedToIdentity: true, appliedAtVersion }
    : { appliedToIdentity: false }
}

const isSearchFeedbackRating = (rating: unknown): rating is SearchFeedbackRating =>
  rating === 'up' || rating === 'down'

const hydrateFeedbackEvent = (
  event: LegacySearchFeedbackEventInput,
): SearchFeedbackEvent | null => {
  const runId = typeof event.runId === 'string' ? event.runId : ''
  const resultId = typeof event.resultId === 'string' ? event.resultId : ''
  if (!runId || !resultId || !isSearchFeedbackRating(event.rating)) {
    return null
  }

  const id = typeof event.id === 'string' && event.id.trim() ? event.id : createId('sfe')
  const createdAt =
    typeof event.createdAt === 'string' && event.createdAt.trim() ? event.createdAt : now()
  const updatedAt =
    typeof event.updatedAt === 'string' && event.updatedAt.trim() ? event.updatedAt : undefined
  const reason = typeof event.reason === 'string' && event.reason.trim() ? event.reason : undefined
  const dimensions =
    event.dimensions && typeof event.dimensions === 'object'
      ? (event.dimensions as SearchFeedbackDimensions)
      : undefined
  const payload =
    event.payload && typeof event.payload === 'object'
      ? (event.payload as SearchFeedbackDimensions)
      : dimensions
  const reflectedInThesisId =
    typeof event.reflectedInThesisId === 'string' && event.reflectedInThesisId.trim()
      ? event.reflectedInThesisId
      : undefined
  const reflectedInArtifactId =
    typeof event.reflectedInArtifactId === 'string' && event.reflectedInArtifactId.trim()
      ? event.reflectedInArtifactId
      : reflectedInThesisId
  return {
    id,
    runId,
    resultId,
    rating: event.rating,
    domain: 'search',
    artifactId:
      typeof event.artifactId === 'string' && event.artifactId.trim() ? event.artifactId : runId,
    targetId:
      typeof event.targetId === 'string' && event.targetId.trim() ? event.targetId : resultId,
    createdAt,
    ...(updatedAt ? { updatedAt } : {}),
    ...(reason ? { reason } : {}),
    ...(dimensions ? { dimensions } : {}),
    ...(payload ? { payload } : {}),
    ...(reflectedInThesisId ? { reflectedInThesisId } : {}),
    ...(reflectedInArtifactId ? { reflectedInArtifactId } : {}),
    ...hydrateFeedbackApplicationState(event),
  }
}

const normalizeSignalKey = (label: string) => label.trim().toLowerCase()

const trimSignalLabel = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

const isSignalSeverity = (value: unknown): value is SearchThesisSignal['severity'] =>
  value === 'hard' || value === 'soft' || value === 'conditional'

const normalizeLookForSignal = (
  entry: LegacySearchThesisSignalInput | null | undefined,
): SearchThesisSignal | null => {
  if (typeof entry === 'string') {
    const label = trimSignalLabel(entry)
    return label ? { id: createId('ssig'), label, severity: 'soft' } : null
  }
  if (!entry || typeof entry !== 'object') return null

  const label = trimSignalLabel(entry.label)
  if (!label) return null
  const condition = trimSignalLabel(entry.condition)
  return {
    id: entry.id ?? createId('ssig'),
    label,
    ...(condition ? { condition } : {}),
    severity: isSignalSeverity(entry.severity)
      ? entry.severity
      : condition
        ? 'conditional'
        : 'soft',
  }
}

const normalizeAvoidSignal = (
  entry: LegacySearchThesisAvoidInput | null | undefined,
): SearchThesisSignal | null => {
  if (typeof entry === 'string') {
    const label = trimSignalLabel(entry)
    return label ? { id: createId('ssig'), label, severity: 'soft' } : null
  }
  if (!entry || typeof entry !== 'object') return null

  const label = trimSignalLabel(entry.label)
  if (!label) return null
  const condition = trimSignalLabel(entry.condition)
  return {
    id: entry.id ?? createId('ssig'),
    label,
    ...(condition ? { condition } : {}),
    severity: isSignalSeverity(entry.severity)
      ? entry.severity
      : condition
        ? 'conditional'
        : 'soft',
  }
}

const appendUniqueSignals = (
  canonical: SearchThesisSignal[],
  legacyLabels: unknown,
): SearchThesisSignal[] => {
  if (!Array.isArray(legacyLabels) || legacyLabels.length === 0) return canonical
  const seen = new Set(canonical.map((entry) => normalizeSignalKey(entry.label)))
  const next = [...canonical]
  legacyLabels.forEach((legacyLabel) => {
    const label = trimSignalLabel(legacyLabel)
    const key = normalizeSignalKey(label)
    if (!label || seen.has(key)) return
    seen.add(key)
    next.push({
      id: createId('ssig'),
      label,
      severity: 'soft',
    })
  })
  return next
}

const normalizeLookForSignals = (
  lookFor: LegacySearchThesisSignalInput[] | undefined,
  legacyPrioritize: unknown,
): SearchThesisSignal[] =>
  appendUniqueSignals(
    (lookFor ?? []).flatMap((entry) => normalizeLookForSignal(entry) ?? []),
    legacyPrioritize,
  )

const normalizeAvoidSignals = (
  avoid: LegacySearchThesisAvoidInput[] | undefined,
  legacyAvoid: unknown,
): SearchThesisSignal[] =>
  appendUniqueSignals(
    (avoid ?? []).flatMap((entry) => normalizeAvoidSignal(entry) ?? []),
    legacyAvoid,
  )

const hydrateOverrides = (
  overrides: SearchInstanceOverridesInput | undefined,
): SearchInstanceOverrides | undefined => {
  if (!overrides) return undefined
  const {
    compensation: _legacyCompensation,
    salary: _legacySalary,
    ...constraintOverrides
  } = overrides.constraints ?? {}
  void _legacyCompensation
  void _legacySalary
  return {
    constraints: {
      ...constraintOverrides,
      salary: hydrateSalary(overrides.constraints),
      locations: overrides.constraints?.locations ?? [],
      clearance: overrides.constraints?.clearance ?? '',
      companySize: overrides.constraints?.companySize ?? '',
      industriesToAvoid: overrides.constraints?.industriesToAvoid ?? [],
      fundingStagesAcceptable: overrides.constraints?.fundingStagesAcceptable ?? [],
      remotePolicies: overrides.constraints?.remotePolicies ?? [],
      remotePolicyNote: overrides.constraints?.remotePolicyNote ?? '',
      employmentTypes: overrides.constraints?.employmentTypes ?? [],
    },
    interviewPrefs: {
      ...overrides.interviewPrefs,
      strongFit: overrides.interviewPrefs?.strongFit ?? [],
      redFlags: overrides.interviewPrefs?.redFlags ?? [],
    },
    hiddenSkillIds: overrides.hiddenSkillIds ?? [],
  }
}

const hydrateThesis = (thesis: SearchThesisInput): SearchThesis => {
  const createdAt = thesis.createdAt ?? now()
  // Pull deprecated searchOverrides.filters into canonical thesis signals once.
  // hydrateOverrides intentionally drops filters so repeated hydration is a no-op.
  const legacyFilters = thesis.searchOverrides?.filters
  const hydratedOverrides = hydrateOverrides(thesis.searchOverrides)
  const { searchOverrides: _legacySearchOverrides, ...thesisWithoutLegacyOverrides } = thesis
  void _legacySearchOverrides
  return {
    ...thesisWithoutLegacyOverrides,
    narrative: thesis.narrative ?? '',
    competitiveMoat: thesis.competitiveMoat ?? '',
    unfairAdvantages: (thesis.unfairAdvantages ?? []).map((advantage) => ({
      ...advantage,
      id: advantage.id ?? createId('sadv'),
    })),
    searchLanes: thesis.searchLanes ?? [],
    interviewStrategy: thesis.interviewStrategy ?? '',
    lookFor: normalizeLookForSignals(thesis.lookFor, legacyFilters?.prioritize),
    avoid: normalizeAvoidSignals(thesis.avoid, legacyFilters?.avoid),
    keywordCombinations: (thesis.keywordCombinations ?? []).map((keyword) => ({
      ...keyword,
      id: keyword.id ?? createId('skwd'),
    })),
    skillDepthMap: thesis.skillDepthMap ?? [],
    ...(hydratedOverrides ? { searchOverrides: hydratedOverrides } : {}),
    stalenessReview: sanitizeArtifactStalenessReview(thesis.stalenessReview),
    id: thesis.id ?? createId('sthesis'),
    durableMeta: ensureDurableMetadata(thesis.durableMeta, createdAt),
    createdAt,
    updatedAt: thesis.updatedAt ?? createdAt,
  }
}

export const migrateSearchState = (persistedState: unknown) => {
  const state =
    typeof persistedState === 'object' && persistedState !== null
      ? (persistedState as {
          profile?: LegacySearchProfileInput | null
          // hydrateRequest drops retired request fields while preserving the canonical shape.
          requests?: LegacySearchRequestInput[]
          runs?: LegacySearchRunInput[]
          theses?: SearchThesis[]
          activeThesisId?: string | null
          feedbackEvents?: LegacySearchFeedbackEventInput[]
          activeResearchJob?: ActiveResearchJobState | null
        })
      : undefined

  const activeResearchJob =
    state?.activeResearchJob &&
    typeof state.activeResearchJob === 'object' &&
    typeof state.activeResearchJob.jobId === 'string' &&
    typeof state.activeResearchJob.runId === 'string' &&
    typeof state.activeResearchJob.requestId === 'string' &&
    typeof state.activeResearchJob.thesisId === 'string'
      ? {
          ...state.activeResearchJob,
          lastObservedAt: state.activeResearchJob.lastObservedAt ?? now(),
        }
      : null

  return pruneOrphans({
    profile: state?.profile ? hydrateProfile(state.profile) : null,
    requests: Array.isArray(state?.requests)
      ? state.requests.map((request) => hydrateRequest(request))
      : [],
    runs: Array.isArray(state?.runs) ? state.runs.map((run) => hydrateRun(run)) : [],
    // Persisted theses pass through hydration so older records gain durable metadata,
    // sanitized staleness reviews, and any future thesis defaults in one migration path.
    theses: Array.isArray(state?.theses) ? state.theses.map((thesis) => hydrateThesis(thesis)) : [],
    activeThesisId:
      typeof state?.activeThesisId === 'string' &&
      Array.isArray(state?.theses) &&
      state.theses.some((thesis) => thesis.id === state.activeThesisId)
        ? state.activeThesisId
        : null,
    feedbackEvents: Array.isArray(state?.feedbackEvents)
      ? state.feedbackEvents
          .map((event) => hydrateFeedbackEvent(event))
          .filter((event): event is SearchFeedbackEvent => event !== null)
      : [],
    activeResearchJob,
  })
}

export const useSearchStore = create<SearchState>()((set, get) => ({
  profile: null,
  requests: [],
  runs: [],
  theses: [],
  activeThesisId: null,
  feedbackEvents: [],
  activeResearchJob: null,

  setProfile: (profile) => {
    const hydrated = hydrateProfile(profile)
    set({ profile: hydrated })
    return hydrated
  },

  clearProfile: () => {
    set({ profile: null })
  },

  addRequest: (request) => {
    const hydrated = hydrateRequest(request)
    set((state) => ({ requests: [...state.requests, hydrated] }))
    return hydrated
  },

  updateRequest: (id, patch) => {
    const restPatch = stripDurableMetadataPatch(patch)
    set((state) => ({
      requests: state.requests.map((request) =>
        request.id === id
          ? {
              ...request,
              ...restPatch,
              durableMeta: touchDurableMetadata(request.durableMeta, now()),
            }
          : request,
      ),
    }))
  },

  deleteRequest: (id) => {
    set((state) => {
      // Cascade-delete feedback events that reference any run belonging to
      // this request. Without this, orphaned events linger in the store and
      // can be surfaced by `getUnreflectedFeedback()` after the originating
      // run + request no longer exist.
      const orphanedRunIds = new Set(
        state.runs.filter((run) => run.requestId === id).map((run) => run.id),
      )
      return pruneOrphans({
        ...state,
        requests: state.requests.filter((request) => request.id !== id),
        runs: state.runs.filter((run) => run.requestId !== id),
        feedbackEvents: state.feedbackEvents.filter((event) => !orphanedRunIds.has(event.runId)),
      })
    })
  },

  addRun: (run) => {
    const hydrated = hydrateRun(run)
    set((state) => ({ runs: [...state.runs, hydrated] }))
    return hydrated
  },

  updateRun: (id, patch) => {
    const restPatch = stripDurableMetadataPatch(patch)
    const hasStalenessReviewPatch = 'stalenessReview' in restPatch
    const nextIdentityVersion = sanitizeIdentityVersion(restPatch.identityVersion)
    const runPatch: Partial<SearchRun> = {
      ...restPatch,
      ...(hasStalenessReviewPatch
        ? {
            stalenessReview: sanitizeArtifactStalenessReview(
              (restPatch as Partial<SearchRun>).stalenessReview,
            ),
          }
        : {}),
    }
    set((state) => ({
      runs: state.runs.map((run) => {
        if (run.id !== id) return run
        const clearsReviewForNewIdentity =
          !hasStalenessReviewPatch &&
          nextIdentityVersion !== undefined &&
          run.identityVersion !== nextIdentityVersion &&
          run.stalenessReview?.reviewedIdentityVersion !== nextIdentityVersion
        return {
          ...run,
          ...runPatch,
          ...(clearsReviewForNewIdentity ? { stalenessReview: undefined } : {}),
          durableMeta: touchDurableMetadata(run.durableMeta, now()),
        }
      }),
    }))
  },

  deleteRun: (id) => {
    // Cascade-delete feedback events tied to this run — same reasoning as
    // deleteRequest's cascade: stale events would otherwise be returned by
    // `getUnreflectedFeedback()` long after the run they reference is gone.
    set((state) =>
      pruneOrphans({
        ...state,
        runs: state.runs.filter((run) => run.id !== id),
        feedbackEvents: state.feedbackEvents.filter((event) => event.runId !== id),
      }),
    )
  },

  getRunsForRequest: (requestId) => get().runs.filter((run) => run.requestId === requestId),

  addThesis: (thesis) => {
    const existingIds = new Set(get().theses.map((item) => item.id))
    const hydrated = hydrateThesis(thesis)
    if (existingIds.has(hydrated.id)) {
      throw new Error('Cannot add duplicate search thesis id.')
    }
    set((state) => ({
      theses: [...state.theses, hydrated],
      activeThesisId: hydrated.id,
    }))
    return hydrated
  },

  markThesisStalenessReview: (id, review) => {
    const stalenessReview = sanitizeArtifactStalenessReview(review)
    if (!stalenessReview) return false
    let didUpdate = false
    set((state) => ({
      theses: state.theses.map((thesis) => {
        if (thesis.id !== id) return thesis
        if (stalenessReview.reviewedIdentityVersion < (thesis.identityVersion ?? 0)) {
          return thesis
        }
        didUpdate = true
        const timestamp = now()
        return {
          ...thesis,
          stalenessReview,
          updatedAt: timestamp,
          durableMeta: touchDurableMetadata(thesis.durableMeta, timestamp),
        }
      }),
    }))
    return didUpdate
  },

  saveThesisRevision: (baseId, patch) => {
    const base = get().theses.find((thesis) => thesis.id === baseId)
    if (!base) return null
    const timestamp = now()
    const hasStalenessReviewPatch = 'stalenessReview' in patch
    const nextIdentityVersion = sanitizeIdentityVersion(patch.identityVersion)
    const clearsReviewForNewIdentity =
      !hasStalenessReviewPatch &&
      nextIdentityVersion !== undefined &&
      base.identityVersion !== nextIdentityVersion &&
      base.stalenessReview?.reviewedIdentityVersion !== nextIdentityVersion
    const updated: SearchThesis = {
      ...base,
      ...patch,
      ...(hasStalenessReviewPatch
        ? { stalenessReview: sanitizeArtifactStalenessReview(patch.stalenessReview) }
        : {}),
      ...(clearsReviewForNewIdentity ? { stalenessReview: undefined } : {}),
      id: base.id,
      durableMeta: touchDurableMetadata(base.durableMeta, timestamp),
      createdAt: base.createdAt,
      updatedAt: timestamp,
      source: 'user-edited',
    }
    set((state) => ({
      theses: state.theses.map((thesis) => (thesis.id === baseId ? updated : thesis)),
      activeThesisId: updated.id,
    }))
    return updated
  },

  updateThesisOverrides: (id, patch) => {
    const base = get().theses.find((thesis) => thesis.id === id)
    if (!base) return null
    const current = base.searchOverrides ?? EMPTY_SEARCH_INSTANCE_OVERRIDES
    const nextOverrides: SearchInstanceOverrides = {
      constraints: { ...current.constraints, ...(patch.constraints ?? {}) },
      interviewPrefs: { ...current.interviewPrefs, ...(patch.interviewPrefs ?? {}) },
      hiddenSkillIds: patch.hiddenSkillIds ?? current.hiddenSkillIds,
    }
    return get().saveThesisRevision(id, { searchOverrides: nextOverrides })
  },

  toggleThesisHiddenSkill: (id, skillId) => {
    const base = get().theses.find((thesis) => thesis.id === id)
    if (!base) return null
    const current = base.searchOverrides ?? EMPTY_SEARCH_INSTANCE_OVERRIDES
    const hidden = new Set(current.hiddenSkillIds)
    if (hidden.has(skillId)) {
      hidden.delete(skillId)
    } else {
      hidden.add(skillId)
    }
    return get().saveThesisRevision(id, {
      searchOverrides: {
        ...current,
        hiddenSkillIds: Array.from(hidden),
      },
    })
  },

  setActiveThesis: (id) => {
    set((state) => ({
      activeThesisId: id && state.theses.some((thesis) => thesis.id === id) ? id : null,
    }))
  },

  setActiveResearchJob: (job) => {
    set({ activeResearchJob: job })
  },

  updateActiveResearchJob: (patch) => {
    set((state) =>
      state.activeResearchJob
        ? { activeResearchJob: { ...state.activeResearchJob, ...patch } }
        : state,
    )
  },

  clearActiveResearchJob: (jobId) => {
    set((state) =>
      !state.activeResearchJob || (jobId && state.activeResearchJob.jobId !== jobId)
        ? state
        : { activeResearchJob: null },
    )
  },

  addFeedbackEvent: (input) => {
    const timestamp = now()
    const { appliedToIdentity, appliedAtVersion, ...baseInput } = input
    const sanitizedAppliedAtVersion = sanitizeIdentityVersion(appliedAtVersion)
    const event: SearchFeedbackEvent = {
      ...baseInput,
      domain: 'search',
      artifactId: baseInput.artifactId ?? baseInput.runId,
      targetId: baseInput.targetId ?? baseInput.resultId,
      payload: baseInput.payload ?? baseInput.dimensions,
      reflectedInArtifactId: baseInput.reflectedInArtifactId ?? baseInput.reflectedInThesisId,
      ...(appliedToIdentity && sanitizedAppliedAtVersion !== undefined
        ? { appliedToIdentity: true, appliedAtVersion: sanitizedAppliedAtVersion }
        : { appliedToIdentity: false }),
      id: createId('sfe'),
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    set((state) => ({ feedbackEvents: [...state.feedbackEvents, event] }))
    return event
  },

  markFeedbackApplied: (id, identityVersion) => {
    const appliedAtVersion = sanitizeIdentityVersion(identityVersion)
    if (appliedAtVersion === undefined) return
    const timestamp = now()
    set((state) => ({
      feedbackEvents: state.feedbackEvents.map((event) =>
        event.id === id
          ? {
              ...event,
              appliedToIdentity: true,
              appliedAtVersion,
              updatedAt: timestamp,
            }
          : event,
      ),
    }))
  },

  markFeedbackReflectedInThesis: (ids, thesisId) => {
    const idSet = new Set(ids)
    const timestamp = now()
    set((state) => ({
      feedbackEvents: state.feedbackEvents.map((event) =>
        idSet.has(event.id) &&
        (event.domain === undefined || event.domain === 'search') &&
        event.reflectedInThesisId === undefined &&
        event.reflectedInArtifactId === undefined
          ? {
              ...event,
              reflectedInThesisId: thesisId,
              reflectedInArtifactId: thesisId,
              updatedAt: timestamp,
            }
          : event,
      ),
    }))
  },

  getUnreflectedFeedback: (currentThesisId) =>
    get().feedbackEvents.filter(
      (event) =>
        event.appliedToIdentity &&
        (currentThesisId === undefined ||
          (event.reflectedInThesisId ?? event.reflectedInArtifactId) !== currentThesisId),
    ),

  getFeedbackEventsForRun: (runId) => get().feedbackEvents.filter((event) => event.runId === runId),
}))
