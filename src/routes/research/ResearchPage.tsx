import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  ArrowRight,
  BriefcaseBusiness,
  Copy,
  RefreshCcw,
  Search,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  X,
} from 'lucide-react'
import { AiActivityIndicator } from '../../components/AiActivityIndicator'
import { FacetAiProxyError } from '../../utils/aiProxyErrors'
import { useCoverLetterStore } from '../../store/coverLetterStore'
import { useIdentityStore } from '../../store/identityStore'
import { usePipelineStore } from '../../store/pipelineStore'
import { usePrepStore } from '../../store/prepStore'
import { useResumeStore } from '../../store/resumeStore'
import { useSearchStore } from '../../store/searchStore'
import {
  type ArtifactStalenessReviewDecision,
  type ArtifactStalenessReview,
  describeImpact,
  sanitizeArtifactStalenessReview,
  type DownstreamImpact,
  type IdentityMutation,
  type ImpactArtifactInput,
} from '../../types/artifactMeta'
import type { ProfessionalIdentityV3, ProfessionalSkillDepth } from '../../identity/schema'
import type {
  Citation,
  DeepResearchIdentityEvidence,
  ResearchJob,
  ResearchUsageSnapshot,
  SearchAssumption,
  SearchCompanySize,
  SearchProfile,
  SearchRequest,
  SearchResultEntry,
  SearchThesis,
  SearchThesisSignal,
} from '../../types/search'
import { getFacetClientEnv } from '../../utils/facetEnv'
import { createId, sanitizeEndpointUrl } from '../../utils/idUtils'
import {
  buildDeepResearchIdentityEvidence,
  cancelDeepResearchJob,
  createDeepResearchJob,
  fetchDeepResearchJob,
  fetchResearchUsage,
  getResearchJobPollDelay,
  hydrateSearchRunFromResearchJob,
  streamDeepResearchJob,
} from '../../utils/deepSearchClient'
import type { CitationRenderMode } from '../../utils/searchCitations'
import { getReferencedCitations, splitTextByCitationMarkers } from '../../utils/searchCitations'
import { generateSearchThesisFromIdentity, validateSearchThesis } from '../../utils/thesisGenerator'
import { fetchAiProxyCapabilities } from '../../utils/llmProxy'
import { reconcileThesisSignalsFromLabels } from '../../utils/thesisSignals'
import {
  inferSearchProfile,
  inferSearchProfileFromIdentity,
} from '../../utils/searchProfileInference'
import { adaptIdentityToSearchProfile } from '../../utils/identitySearchProfile'
import { skillNamesMatch } from '../../utils/identityEnrichment'
import {
  buildRequestDraft,
  createPipelineEntryDraft,
  emptyProfile,
  groupByTier,
  normalizeMaxResults,
  splitTags,
} from './researchUtils'
import {
  SearchAssumptionsDisclosure,
  SearchInstancePreferences,
  SearchSkillsTable,
  SearchThesisWorkspace,
} from './searchWorkspaceComponents'
import './research.css'

type ResearchTab = 'profile' | 'search' | 'results'
type ThesisSignalEditTarget = 'lookFor' | 'avoid'
type ThesisSignalsFocusRequest = { id: number; target: ThesisSignalEditTarget }
const RESEARCH_TABS: ResearchTab[] = ['profile', 'search', 'results']
const TERMINAL_RESEARCH_JOB_STATUSES = new Set(['completed', 'failed', 'canceled'])
type ResearchJobEventLogEntry = { id: number; text: string }
type ThesisNoiseLevel = SearchThesis['keywordCombinations'][number]['noiseLevel']
type ThesisUrgency = NonNullable<SearchThesis['timeline']>['urgency']
type ThesisSkillCorrectionTarget = {
  groupId: string
  skillName: string
  groupLabel: string
}
type PendingThesisSkillWriteback = {
  skillIndex: number
  skillName: string
  identityRevision: number
  target: ThesisSkillCorrectionTarget
  impactArtifacts: ImpactArtifactInput[]
}
type StalenessReviewDecision = 'accepted' | 'rejected'
type ThesisFallbackOffer = {
  userCorrections?: string
  customDirective?: string
  switchToSearchTab?: boolean
}

/**
 * State for the per-result feedback panel. Only one panel is open at a time so the user
 * isn't editing two reactions in parallel; submission either creates a feedback event or
 * additionally writes back to the identity model (avoid list) and marks the event applied.
 */
type ResultFeedbackPanelState = {
  resultId: string
  rating: 'up' | 'down'
  reason: string
  /** When true, append a MatchingAvoid entry to identity.preferences.matching.avoid on submit. */
  addToAvoid: boolean
  avoidLabel: string
  avoidCondition: string
  submitting: boolean
}

/** Lightweight summary of the latest feedback event per result, used for the badge on the card. */
type ResultFeedbackBadge = {
  rating: 'up' | 'down'
  applied: boolean
}

const thesisSignalLabels = (signals: readonly SearchThesisSignal[] | undefined): string[] =>
  (signals ?? []).map((signal) => signal.label)

// Legacy persisted string/object signal shapes are normalized in migrateSearchState
// before the route reads theses; route helpers operate only on canonical signals.
const thesisSignalText = (signals: readonly SearchThesisSignal[] | undefined): string =>
  thesisSignalLabels(signals).join(', ')

const COMPANY_SIZE_OPTIONS: Array<{ value: SearchCompanySize | ''; label: string }> = [
  { value: '', label: 'No preference' },
  { value: 'startup', label: 'Startup' },
  { value: 'growth', label: 'Growth' },
  { value: 'mid-market', label: 'Mid-market' },
  { value: 'enterprise', label: 'Enterprise' },
  { value: 'public', label: 'Public' },
  { value: 'any', label: 'Any size' },
]

const THESIS_NOISE_LEVEL_OPTIONS: Array<{ value: ThesisNoiseLevel; label: string }> = [
  { value: 'low', label: 'Low noise' },
  { value: 'medium', label: 'Medium noise' },
  { value: 'high', label: 'High noise' },
]

const THESIS_NOISE_LEVELS = new Set<ThesisNoiseLevel>(
  THESIS_NOISE_LEVEL_OPTIONS.map((option) => option.value),
)

const THESIS_URGENCY_OPTIONS: Array<{ value: ThesisUrgency; label: string }> = [
  { value: 'exploratory', label: 'Exploratory' },
  { value: 'active', label: 'Active' },
  { value: 'critical', label: 'Critical' },
]

const THESIS_SKILL_DEPTH_VALUES = new Set<ProfessionalSkillDepth>([
  'expert',
  'strong',
  'hands-on-working',
  'architectural',
  'conceptual',
  'working',
  'basic',
  'avoid',
])

const isThesisNoiseLevel = (value: string): value is ThesisNoiseLevel =>
  THESIS_NOISE_LEVELS.has(value as ThesisNoiseLevel)

const isProfessionalSkillDepth = (value: string): value is ProfessionalSkillDepth =>
  THESIS_SKILL_DEPTH_VALUES.has(value as ProfessionalSkillDepth)

const normalizeEditableTimeline = (
  timeline: SearchThesis['timeline'],
): SearchThesis['timeline'] => {
  if (!timeline?.urgency) return undefined
  const strategyImpact = timeline.strategyImpact.trim()
  if (!strategyImpact) return undefined
  const deadline = timeline.deadline?.trim()
  return {
    urgency: timeline.urgency,
    ...(deadline ? { deadline } : {}),
    strategyImpact,
  }
}

const formatCount = (count: number, singular: string, plural: string): string =>
  `${count} ${count === 1 ? singular : plural}`

const formatCostCents = (cents: number | null | undefined): string => {
  if (cents === null || cents === undefined) return 'Not configured'
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

const getBudgetBadgeCopy = (
  usage: ResearchUsageSnapshot | null,
): {
  label: string
  detail: string
} => {
  if (!usage) {
    return {
      label: 'Budget loading',
      detail: 'Fetching usage',
    }
  }

  if (!usage.budget.enforced) {
    return {
      label: 'Budget unlimited',
      detail: 'Est. run ' + formatCostCents(usage.estimate.runCostCents),
    }
  }

  return {
    label:
      usage.budget.status === 'over'
        ? 'Budget blocked'
        : usage.budget.status === 'warning'
          ? 'Budget near limit'
          : 'Budget ok',
    detail: formatCostCents(usage.budget.remainingCents) + ' left',
  }
}

const buildSkillIdentityFields = (skillName: string): string[] => {
  const normalized = skillName.trim()
  if (!normalized) return []
  return [
    'skills.' + normalized + '.depth',
    'skills.' + normalized + '.context',
    'skills.' + normalized + '.positioning',
  ]
}

const collectThesisIdentityFieldDependencies = (
  thesis: Pick<SearchThesis, 'skillDepthMap'>,
): string[] | undefined => {
  const fields = new Set<string>()
  thesis.skillDepthMap.forEach((entry) => {
    buildSkillIdentityFields(entry.skill).forEach((field) => fields.add(field))
  })
  return fields.size > 0 ? Array.from(fields) : undefined
}

const buildSkillDepthMutation = (skillName: string, fromRevision: number): IdentityMutation => ({
  label: skillName + ' depth correction',
  fields: buildSkillIdentityFields(skillName),
  fromRevision,
  toRevision: fromRevision + 1,
})

const formatOptionalCount = (
  count: number,
  singular: string,
  plural: string,
): string | undefined => (count > 0 ? formatCount(count, singular, plural) : undefined)

const CitationText = ({
  text,
  citations,
  mode = 'inline',
  footnoteIdPrefix = 'citation',
}: {
  text: string
  citations?: readonly Citation[]
  mode?: CitationRenderMode
  footnoteIdPrefix?: string
}) => {
  if (!citations || citations.length === 0 || !text.includes('[cite:')) {
    return <>{text}</>
  }

  const citationById = new Map(
    citations.map((citation, index) => [citation.id, { citation, index }]),
  )

  return (
    <>
      {splitTextByCitationMarkers(text).map((part, index) => {
        if (part.type === 'text') {
          return <span key={'text-' + String(index)}>{part.text}</span>
        }
        const match = citationById.get(part.id)
        if (!match) {
          return (
            <span
              key={'citation-unresolved-' + part.id + '-' + String(index)}
              className="research-citation-unresolved"
              title={'Unresolved citation: ' + part.id}
            >
              [?]
            </span>
          )
        }
        const title = match.citation.claim ?? match.citation.url ?? match.citation.source
        return mode === 'footnote' ? (
          <a
            key={'citation-' + part.id + '-' + String(index)}
            className="research-citation-footnote-ref"
            href={'#' + footnoteIdPrefix + '-' + match.citation.id}
            title={title}
          >
            <sup>{match.index + 1}</sup>
          </a>
        ) : (
          <span
            key={'citation-' + part.id + '-' + String(index)}
            className="research-citation-badge"
            title={title}
          >
            {match.citation.source}
          </span>
        )
      })}
    </>
  )
}

const CitationFootnotes = ({
  citations,
  idPrefix = 'citation',
  headingLevel = 'h5',
}: {
  citations: readonly Citation[]
  idPrefix?: string
  headingLevel?: 'h4' | 'h5' | 'h6'
}) => {
  if (citations.length === 0) return null
  const Heading = headingLevel
  return (
    <div className="research-citation-footnotes">
      <Heading>Sources</Heading>
      <ol>
        {citations.map((citation) => (
          <li key={citation.id} id={idPrefix + '-' + citation.id}>
            {citation.url ? (
              <a href={citation.url} target="_blank" rel="noreferrer">
                {citation.source}
              </a>
            ) : (
              <span>{citation.source}</span>
            )}
            {citation.claim ? <span>{' - ' + citation.claim}</span> : null}
          </li>
        ))}
      </ol>
    </div>
  )
}

const getStalenessDecisionLabel = (decision?: StalenessReviewDecision): string => {
  if (decision === 'accepted') return 'Accepted current artifact'
  if (decision === 'rejected') return 'Marked not stale'
  return 'Needs review'
}

const getStalenessArtifactKey = (
  artifact: Pick<DownstreamImpact['artifactsAffected'][number], 'artifactType' | 'artifactId'>,
  mutation?: IdentityMutation,
): string => {
  return JSON.stringify([
    mutation?.fromRevision ?? null,
    mutation?.toRevision ?? null,
    mutation?.label ?? null,
    [...(mutation?.fields ?? [])].sort(),
    artifact.artifactType || 'artifact',
    artifact.artifactId || 'unknown',
  ])
}

const getStalenessReviewKey = (
  artifact: Pick<DownstreamImpact['artifactsAffected'][number], 'artifactType' | 'artifactId'>,
  index: number,
  mutation?: IdentityMutation,
): string => {
  return JSON.stringify([getStalenessArtifactKey(artifact, mutation), index])
}

const cloneDownstreamImpact = (impact: DownstreamImpact): DownstreamImpact =>
  structuredClone(impact)

const toPersistedStalenessDecision = (
  decision: StalenessReviewDecision,
): ArtifactStalenessReviewDecision => {
  switch (decision) {
    case 'accepted':
      return 'accepted-current'
    case 'rejected':
      return 'not-stale'
    default: {
      const exhaustive: never = decision
      throw new Error(`Unsupported staleness review decision: ${String(exhaustive)}`)
    }
  }
}

const fromPersistedStalenessDecision = (
  decision: ArtifactStalenessReviewDecision,
): StalenessReviewDecision => {
  switch (decision) {
    case 'accepted-current':
      return 'accepted'
    case 'not-stale':
      return 'rejected'
    default: {
      const exhaustive: never = decision
      throw new Error(`Unsupported persisted staleness review decision: ${String(exhaustive)}`)
    }
  }
}

const haveSameIdentityMutationFields = (
  left: readonly string[],
  right: readonly string[],
): boolean => {
  if (left.length !== right.length) return false
  const sortedLeft = [...left].sort()
  const sortedRight = [...right].sort()
  return sortedLeft.every((field, index) => field === sortedRight[index])
}

const resolveThesisSkillCorrectionTarget = (
  identity: ProfessionalIdentityV3,
  skillName: string,
): ThesisSkillCorrectionTarget | null => {
  for (const group of identity.skills.groups) {
    const skill = group.items.find((entry) => skillNamesMatch(entry.name, skillName))
    if (skill) {
      return {
        groupId: group.id,
        skillName: skill.name,
        groupLabel: group.label,
      }
    }
  }

  return null
}

const formatElapsedTime = (elapsedMs: number): string => {
  const safeMs = Math.max(0, elapsedMs)
  const totalSeconds = Math.floor(safeMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes + 'm ' + seconds.toString().padStart(2, '0') + 's'
}

function ResearchJobElapsedTimer({
  startedAt,
  fallbackElapsedMs,
  active,
}: {
  startedAt?: string
  fallbackElapsedMs?: number
  active: boolean
}) {
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    if (!active || !startedAt) return
    const interval = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [active, startedAt])

  const elapsedMs = active && startedAt ? nowMs - Date.parse(startedAt) : (fallbackElapsedMs ?? 0)
  return <>{formatElapsedTime(elapsedMs)}</>
}

type SerializableIdentityProfile = Pick<
  SearchProfile,
  | 'inferredFromResumeVersion'
  | 'skills'
  | 'workSummary'
  | 'openQuestions'
  | 'constraints'
  | 'filters'
  | 'interviewPrefs'
  | 'source'
>

const serializeIdentityProfile = (profile: SerializableIdentityProfile) =>
  JSON.stringify({
    inferredFromResumeVersion: profile.inferredFromResumeVersion,
    skills: profile.skills,
    workSummary: profile.workSummary,
    openQuestions: profile.openQuestions,
    constraints: profile.constraints,
    filters: profile.filters,
    interviewPrefs: profile.interviewPrefs,
    source: profile.source,
  })

const getReadinessCopy = ({
  effectiveProfile,
  currentIdentity,
  isIdentitySource,
  profileIsStale,
  resumeVersion,
  isSearching,
}: {
  effectiveProfile: Pick<SearchProfile, 'source' | 'inferredFromResumeVersion'> | null
  currentIdentity: ReturnType<typeof useIdentityStore.getState>['currentIdentity']
  isIdentitySource: boolean
  profileIsStale: boolean
  resumeVersion: number
  isSearching: boolean
}) => {
  if (!effectiveProfile) {
    return {
      sourceLabel: 'No profile',
      freshnessLabel: 'Needs profile',
      headline: currentIdentity
        ? 'Build a research profile from your identity model before you search.'
        : 'Build a search profile from your resume before you launch a run.',
      detail: currentIdentity
        ? 'Facet can pull skills, constraints, and strategy signals straight from Identity so Research starts from the same strategy model.'
        : 'Facet will infer skills, work history, and open questions from your resume so you can review them before running search.',
      primaryActionLabel: currentIdentity
        ? 'Build Profile from Identity'
        : 'Build Profile from Resume',
    }
  }

  if (isIdentitySource) {
    return {
      sourceLabel: 'Identity model',
      freshnessLabel: 'Ready',
      headline: 'Your search profile is being driven by the identity model.',
      detail:
        'Update strategic fields in Identity when you want to change search lanes, awareness items, or filtering defaults.',
      primaryActionLabel: isSearching ? 'Running Search…' : 'Run Search',
    }
  }

  if (profileIsStale) {
    return {
      sourceLabel: 'Resume fallback',
      freshnessLabel: `Resume stale (v${effectiveProfile.inferredFromResumeVersion} vs v${resumeVersion})`,
      headline:
        'Your resume-backed profile is stale. You can still search, but rebuilding will use the latest resume data.',
      detail:
        'Resume fallback stays available in-session when Identity is not active, but it can drift if your resume changes.',
      primaryActionLabel: isSearching ? 'Running Search…' : 'Run Search',
    }
  }

  return {
    sourceLabel: 'Resume fallback',
    freshnessLabel: 'Ready',
    headline: 'Your resume-backed profile is ready for targeted searches.',
    detail:
      'Resume fallback stays available in-session when Identity is not active, but it can drift if your resume changes.',
    primaryActionLabel: isSearching ? 'Running Search…' : 'Run Search',
  }
}

const getLaunchSearchLabel = ({
  isSearching,
  hasActiveThesis,
  hasProfile,
  focusLaneCount,
}: {
  isSearching: boolean
  hasActiveThesis: boolean
  hasProfile: boolean
  focusLaneCount: number
}) => {
  if (isSearching) return 'Searching...'
  if (!hasActiveThesis) return 'Generate a thesis to launch search'
  if (!hasProfile) return 'Create a profile to launch search'
  if (focusLaneCount === 0) return 'Select a thesis lane to launch search'
  return 'Launch Search'
}

export function ResearchPage() {
  const navigate = useNavigate()
  const resumeData = useResumeStore((state) => state.data)
  const currentIdentity = useIdentityStore((state) => state.currentIdentity)
  const saveSkillEnrichment = useIdentityStore((state) => state.saveSkillEnrichment)
  const updateCurrentMatching = useIdentityStore((state) => state.updateCurrentMatching)
  const coverLetterTemplates = useCoverLetterStore((state) => state.templates)
  const updateCoverLetterTemplate = useCoverLetterStore((state) => state.updateTemplate)
  const prepDecks = usePrepStore((state) => state.decks)
  const updatePrepDeck = usePrepStore((state) => state.updateDeck)
  const pipelineEntries = usePipelineStore((state) => state.entries)
  const addPipelineEntry = usePipelineStore((state) => state.addEntry)
  const {
    profile,
    requests,
    runs,
    setProfile,
    clearProfile,
    addRequest,
    addRun,
    updateRun,
    theses,
    activeThesisId,
    addThesis,
    markThesisStalenessReview,
    saveThesisRevision,
    updateThesisOverrides,
    toggleThesisHiddenSkill,
    setActiveThesis,
    activeResearchJob,
    setActiveResearchJob,
    updateActiveResearchJob,
    clearActiveResearchJob,
    getUnreflectedFeedback,
    markFeedbackReflectedInThesis,
    feedbackEvents,
    addFeedbackEvent,
    markFeedbackApplied,
  } = useSearchStore()

  const [activeTab, setActiveTab] = useState<ResearchTab>('profile')
  const [requestDraft, setRequestDraft] = useState(() => {
    const initialThesis = theses.find((thesis) => thesis.id === activeThesisId) ?? null
    return buildRequestDraft(profile, initialThesis)
  })
  const [activeRunId, setActiveRunId] = useState<string | null>(runs.at(-1)?.id ?? null)
  const [resultVectorSelections, setResultVectorSelections] = useState<Record<string, string>>({})
  const [isInferring, setIsInferring] = useState(false)
  const [isGeneratingThesis, setIsGeneratingThesis] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [pageError, setPageError] = useState<string | null>(null)
  const [thesisNotice, setThesisNotice] = useState<string | null>(null)
  const [thesisDraft, setThesisDraft] = useState<SearchThesis | null>(null)
  const [thesisDraftIsDirty, setThesisDraftIsDirty] = useState(false)
  const [thesisLookForText, setThesisLookForText] = useState('')
  const [thesisLookForBaselineText, setThesisLookForBaselineText] = useState('')
  const [thesisSignalsFocusRequest, setThesisSignalsFocusRequest] =
    useState<ThesisSignalsFocusRequest | null>(null)
  const [correctionsDraft, setCorrectionsDraft] = useState('')
  const [directiveDraft, setDirectiveDraft] = useState('')
  const [pendingSkillWriteback, setPendingSkillWriteback] =
    useState<PendingThesisSkillWriteback | null>(null)
  const [latestIdentityImpact, setLatestIdentityImpact] = useState<DownstreamImpact | null>(null)
  const [stalenessReviewImpact, setStalenessReviewImpact] = useState<DownstreamImpact | null>(null)
  const [stalenessReviewIdentityRevision, setStalenessReviewIdentityRevision] = useState<
    number | null
  >(null)
  const [refreshingStalenessArtifactKey, setRefreshingStalenessArtifactKey] = useState<
    string | null
  >(null)
  const [refreshedStalenessArtifactKeys, setRefreshedStalenessArtifactKeys] = useState<
    Record<string, boolean>
  >({})
  const [thesisContractViolations, setThesisContractViolations] = useState<string[]>([])
  const [observedResearchJob, setObservedResearchJob] = useState<ResearchJob | null>(null)
  const [researchJobEvents, setResearchJobEvents] = useState<ResearchJobEventLogEntry[]>([])
  const [researchJobTransport, setResearchJobTransport] = useState<'polling' | 'sse'>('polling')
  const [researchUsage, setResearchUsage] = useState<ResearchUsageSnapshot | null>(null)
  const [researchBudgetNotice, setResearchBudgetNotice] = useState<string | null>(null)
  const [opusAvailable, setOpusAvailable] = useState<boolean | null>(null)
  const [thesisFallbackOffer, setThesisFallbackOffer] = useState<ThesisFallbackOffer | null>(null)
  const [feedbackPanel, setFeedbackPanel] = useState<ResultFeedbackPanelState | null>(null)
  const [feedbackError, setFeedbackError] = useState<string | null>(null)
  const identityProfileRef = useRef({
    id: createId('sprof'),
    inferredAt: new Date().toISOString(),
  })
  const preservedResumeProfileRef = useRef<SearchProfile | null>(null)
  const preservedTimelineRef = useRef<SearchThesis['timeline']>(null)
  const pollTimerRef = useRef<number | null>(null)
  const eventSourceRef = useRef<{ close: () => void } | null>(null)
  const hiddenDuringJobRef = useRef(false)
  const notifiedJobsRef = useRef(new Set<string>())
  const researchJobEventIdRef = useRef(0)
  const stalenessReviewIdentityRevisionRef = useRef<number | null>(null)
  const stalenessReviewImpactRef = useRef<DownstreamImpact | null>(null)
  const thesisDraftIsDirtyRef = useRef(false)
  const refreshingStalenessArtifactKeyRef = useRef<string | null>(null)
  const thesisSignalsInputRef = useRef<HTMLInputElement | null>(null)
  const thesisFirstAvoidInputRef = useRef<HTMLInputElement | null>(null)
  const thesisAddAvoidButtonRef = useRef<HTMLButtonElement | null>(null)
  const nextThesisSignalsFocusRequestIdRef = useRef(0)
  const focusedThesisSignalsRequestRef = useRef(0)
  const thesisDraftRef = useRef<SearchThesis | null>(null)
  const activeResearchJobId = activeResearchJob?.jobId
  const activeResearchRunId = activeResearchJob?.runId
  const currentIdentityRevision = currentIdentity ? (currentIdentity.model_revision ?? 0) : null
  const resetStalenessReview = useCallback(() => {
    setStalenessReviewImpact(null)
    setStalenessReviewIdentityRevision(null)
    setRefreshingStalenessArtifactKey(null)
    setRefreshedStalenessArtifactKeys({})
  }, [])
  const activeThesis = useMemo(
    () => theses.find((thesis) => thesis.id === activeThesisId) ?? null,
    [activeThesisId, theses],
  )
  const downstreamImpactArtifacts = useMemo<ImpactArtifactInput[]>(
    () => [
      ...theses
        .map((thesis) => ({
          artifactType: 'thesis' as const,
          artifactId: thesis.id,
          label: thesis.id === activeThesis?.id ? 'Active search thesis' : 'Saved search thesis',
          identityVersion: thesis.identityVersion,
          identityFields: thesis.identityFields,
          detail: formatOptionalCount(
            thesis.skillDepthMap.length,
            'skill depth signal',
            'skill depth signals',
          ),
        }))
        .filter((artifact) => artifact.artifactId !== activeThesis?.id),
      ...runs.map((run) => ({
        artifactType: 'run' as const,
        artifactId: run.id,
        label: 'Search run',
        identityVersion: run.identityVersion,
        identityFields: run.identityFields,
        detail: formatOptionalCount(run.results.length, 'search result', 'search results'),
      })),
      ...prepDecks.map((deck) => ({
        artifactType: 'prep-deck' as const,
        artifactId: deck.id,
        label: (deck.company || deck.title || 'Untitled') + ' prep deck',
        identityVersion: deck.identityVersion,
        identityFields: deck.identityFields,
        detail: formatOptionalCount(deck.cards.length, 'prep card', 'prep cards'),
      })),
      ...coverLetterTemplates.map((template) => ({
        artifactType: 'cover-letter' as const,
        artifactId: template.id,
        label: (template.name.trim() || 'Untitled') + ' cover letter',
        identityVersion: template.identityVersion,
        identityFields: template.identityFields,
        detail: formatOptionalCount(template.paragraphs.length, 'paragraph', 'paragraphs'),
      })),
    ],
    [activeThesis?.id, coverLetterTemplates, prepDecks, runs, theses],
  )
  const pendingIdentityImpact = useMemo<DownstreamImpact | null>(() => {
    if (!pendingSkillWriteback) return null
    return describeImpact(
      buildSkillDepthMutation(
        pendingSkillWriteback.target.skillName,
        pendingSkillWriteback.identityRevision,
      ),
      pendingSkillWriteback.impactArtifacts,
    )
  }, [pendingSkillWriteback])
  useEffect(() => {
    if (!pendingSkillWriteback) return
    if (currentIdentityRevision === null) {
      setPendingSkillWriteback(null)
      setLatestIdentityImpact(null)
      resetStalenessReview()
      setThesisNotice(
        'Identity changed after confirmation opened. Review the current skill model and start writeback again.',
      )
      return
    }
    if (currentIdentityRevision === pendingSkillWriteback.identityRevision) return
    setPendingSkillWriteback(null)
    setLatestIdentityImpact(null)
    resetStalenessReview()
    setThesisNotice(
      'Identity changed after confirmation opened. Review the current skill model and start writeback again.',
    )
  }, [currentIdentityRevision, pendingSkillWriteback, resetStalenessReview])
  useEffect(() => {
    refreshingStalenessArtifactKeyRef.current = refreshingStalenessArtifactKey
  }, [refreshingStalenessArtifactKey])
  useEffect(() => {
    thesisDraftIsDirtyRef.current = thesisDraftIsDirty
  }, [thesisDraftIsDirty])
  useEffect(() => {
    thesisDraftRef.current = thesisDraft
  }, [thesisDraft])
  useEffect(() => {
    stalenessReviewImpactRef.current = stalenessReviewImpact
  }, [stalenessReviewImpact])
  useEffect(() => {
    stalenessReviewIdentityRevisionRef.current = stalenessReviewIdentityRevision
  }, [stalenessReviewIdentityRevision])
  useEffect(() => {
    if (stalenessReviewIdentityRevision === null) return
    if (currentIdentityRevision === null) {
      resetStalenessReview()
      setThesisNotice(
        'Identity cleared after batch review opened. Saved artifact decisions remain recorded; reopen the review after loading Identity.',
      )
      return
    }
    if (currentIdentityRevision === stalenessReviewIdentityRevision) return
    resetStalenessReview()
    setThesisNotice(
      'Identity changed after batch review opened. Saved artifact decisions remain recorded; generate a new impact notice to review the latest artifact state.',
    )
  }, [currentIdentityRevision, resetStalenessReview, stalenessReviewIdentityRevision])
  const thesisLookForPreview = useMemo(
    () =>
      thesisLookForText === thesisLookForBaselineText
        ? thesisSignalLabels(thesisDraft?.lookFor)
        : splitTags(thesisLookForText),
    [thesisDraft?.lookFor, thesisLookForBaselineText, thesisLookForText],
  )
  const thesisLookForPreviewLabel =
    thesisLookForText === thesisLookForBaselineText
      ? 'Will keep stored signals unchanged: '
      : 'Will normalize to: '
  const thesisTimelineStrategyMissing = Boolean(
    thesisDraft?.timeline?.urgency && !thesisDraft.timeline.strategyImpact.trim(),
  )
  const thesisLaneIds = useMemo(
    () => new Set(thesisDraft?.searchLanes.map((lane) => lane.id) ?? []),
    [thesisDraft?.searchLanes],
  )
  const pendingSkillWritebackEntry = pendingSkillWriteback
    ? (thesisDraft?.skillDepthMap[pendingSkillWriteback.skillIndex] ?? null)
    : null
  const aiEndpoint = useMemo(() => sanitizeEndpointUrl(getFacetClientEnv().anthropicProxyUrl), [])

  const identityDerivedProfile = useMemo(
    () =>
      currentIdentity
        ? adaptIdentityToSearchProfile(currentIdentity, {
            resumeVersion: resumeData.version,
            workSummary: profile?.source?.kind === 'identity' ? profile.workSummary : undefined,
            openQuestions: profile?.source?.kind === 'identity' ? profile.openQuestions : undefined,
          })
        : null,
    [currentIdentity, profile, resumeData.version],
  )

  const effectiveProfile = currentIdentity ? identityDerivedProfile : (profile ?? null)
  const profileSourceKind = profile?.source?.kind ?? null
  const identityProfileKey = useMemo(() => {
    if (profileSourceKind !== 'identity' || !profile) {
      return profileSourceKind ?? 'none'
    }

    return serializeIdentityProfile(profile)
  }, [profile, profileSourceKind])
  const isIdentitySource = effectiveProfile?.source?.kind === 'identity'
  const executableProfile = useMemo(
    () =>
      effectiveProfile
        ? {
            ...effectiveProfile,
            id: profile?.id ?? identityProfileRef.current.id,
            inferredAt: profile?.inferredAt ?? identityProfileRef.current.inferredAt,
          }
        : null,
    [effectiveProfile, profile?.id, profile?.inferredAt],
  )
  const profileIsStale =
    !currentIdentity &&
    effectiveProfile != null &&
    effectiveProfile.inferredFromResumeVersion !== resumeData.version
  const thesisIsStale = Boolean(
    currentIdentity &&
    activeThesis &&
    currentIdentity.model_revision > activeThesis.identityVersion,
  )

  const sortedRuns = useMemo(
    () => [...runs].sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    [runs],
  )

  const activeRun = useMemo(
    () => sortedRuns.find((run) => run.id === activeRunId) ?? sortedRuns[0] ?? null,
    [activeRunId, sortedRuns],
  )

  const requestById = useMemo(
    () => new Map(requests.map((request) => [request.id, request])),
    [requests],
  )

  const activeRequest = activeRun ? (requestById.get(activeRun.requestId) ?? null) : null
  const latestRunResultCount = activeRun?.results.length ?? 0
  const readinessCopy = getReadinessCopy({
    effectiveProfile,
    currentIdentity,
    isIdentitySource,
    profileIsStale,
    resumeVersion: resumeData.version,
    isSearching,
  })
  const primaryActionBusy = !effectiveProfile ? isInferring : isSearching
  const budgetBadgeCopy = useMemo(() => getBudgetBadgeCopy(researchUsage), [researchUsage])

  const vectorOptions = useMemo(
    () =>
      resumeData.vectors.map((vector) => ({
        id: vector.id,
        label: vector.label,
      })),
    [resumeData.vectors],
  )
  const laneOptions = useMemo(
    () =>
      activeThesis?.searchLanes.map((lane) => ({
        id: lane.id,
        label: lane.title || lane.id,
      })) ?? [],
    [activeThesis?.searchLanes],
  )
  const launchSearchDisabled =
    isSearching || !effectiveProfile || !activeThesis || requestDraft.focusLanes.length === 0
  const launchSearchLabel = getLaunchSearchLabel({
    isSearching,
    hasActiveThesis: Boolean(activeThesis),
    hasProfile: Boolean(effectiveProfile),
    focusLaneCount: requestDraft.focusLanes.length,
  })

  const closedPipelineCompanies = useMemo(
    () =>
      [
        ...new Set(
          pipelineEntries
            .filter(
              (entry) =>
                entry.status === 'rejected' ||
                entry.status === 'withdrawn' ||
                entry.status === 'closed',
            )
            .map((entry) => entry.company.trim())
            .filter(Boolean),
        ),
      ].sort((left, right) => left.localeCompare(right)),
    [pipelineEntries],
  )

  useEffect(() => {
    if (runs.length === 0) {
      setActiveRunId(null)
      return
    }

    if (!activeRunId || !runs.some((run) => run.id === activeRunId)) {
      setActiveRunId(sortedRuns[0]?.id ?? null)
    }
  }, [activeRunId, runs, sortedRuns])

  useEffect(() => {
    // Refresh request defaults when either the source profile or the active thesis (and thus its
    // override layer) changes. Switching theses is a context switch — request knobs should track
    // the new search rather than carry over the previous one's edits.
    setRequestDraft(buildRequestDraft(effectiveProfile, activeThesis))
  }, [effectiveProfile, activeThesis])

  useEffect(() => {
    const lookForText = activeThesis ? thesisSignalText(activeThesis.lookFor) : ''
    setThesisDraft(activeThesis ? structuredClone(activeThesis) : null)
    setThesisLookForText(lookForText)
    setThesisLookForBaselineText(lookForText)
    setThesisDraftIsDirty(false)
    setPendingSkillWriteback(null)
    setDirectiveDraft(activeThesis?.customDirective ?? '')
    setCorrectionsDraft('')
    preservedTimelineRef.current = null
  }, [activeThesis])

  useEffect(() => {
    // Contract warnings intentionally track the saved thesis; draft validation runs on save.
    setThesisContractViolations(
      activeThesis ? validateSearchThesis(activeThesis, currentIdentity) : [],
    )
  }, [activeThesis, currentIdentity])

  useEffect(() => {
    if (currentIdentity && profileSourceKind !== 'identity' && profile) {
      preservedResumeProfileRef.current = profile
    }
  }, [currentIdentity, profile, profileSourceKind])

  useEffect(() => {
    if (!identityDerivedProfile) {
      if (profileSourceKind === 'identity') {
        const preservedResumeProfile = preservedResumeProfileRef.current
        preservedResumeProfileRef.current = null
        if (preservedResumeProfile) {
          setProfile(preservedResumeProfile)
        } else {
          clearProfile()
        }
      }
      return
    }

    const syncedIdentityProfile = {
      ...identityDerivedProfile,
      id: profile?.id ?? identityProfileRef.current.id,
      inferredAt: profile?.inferredAt ?? identityProfileRef.current.inferredAt,
    }

    if (profileSourceKind !== 'identity') {
      setProfile(syncedIdentityProfile)
      return
    }

    const nextSerialized = serializeIdentityProfile(syncedIdentityProfile)
    if (identityProfileKey !== nextSerialized) {
      setProfile(syncedIdentityProfile)
    }
  }, [
    clearProfile,
    identityDerivedProfile,
    identityProfileKey,
    profile?.id,
    profile?.inferredAt,
    profileSourceKind,
    setProfile,
  ])

  const ensureEndpoint = () => {
    if (!aiEndpoint) {
      throw new Error('AI research is disabled. Configure VITE_ANTHROPIC_PROXY_URL.')
    }
  }

  const refreshResearchUsage = useCallback(async () => {
    if (!aiEndpoint) return
    try {
      const usage = await fetchResearchUsage(aiEndpoint)
      setResearchUsage(usage)
      if (!usage.budget.wouldExceedNextRun) {
        setResearchBudgetNotice(null)
      }
    } catch (error) {
      console.warn('[research] failed to refresh usage budget', error)
    }
  }, [aiEndpoint])

  useEffect(() => {
    void refreshResearchUsage()
  }, [refreshResearchUsage])

  const refreshAiCapabilities = useCallback(async () => {
    if (!aiEndpoint) return
    try {
      const capabilities = await fetchAiProxyCapabilities(aiEndpoint)
      setOpusAvailable(capabilities.modelCapabilities.opus.available)
    } catch (error) {
      console.warn('[research] failed to refresh AI capabilities', error)
      setOpusAvailable(null)
    }
  }, [aiEndpoint])

  useEffect(() => {
    void refreshAiCapabilities()
  }, [refreshAiCapabilities])

  const clearPollTimer = useCallback(() => {
    if (pollTimerRef.current !== null) {
      window.clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }, [])

  const closeResearchEventSource = useCallback(() => {
    eventSourceRef.current?.close()
    eventSourceRef.current = null
    setResearchJobTransport('polling')
  }, [])

  const prepareResearchNotifications = () => {
    if ('Notification' in globalThis && Notification.permission === 'default') {
      void Notification.requestPermission()
    }
  }

  const notifyResearchComplete = useCallback((job: ResearchJob) => {
    if (
      notifiedJobsRef.current.has(job.id) ||
      !('Notification' in globalThis) ||
      (!hiddenDuringJobRef.current && document.visibilityState !== 'hidden')
    ) {
      return
    }

    notifiedJobsRef.current.add(job.id)
    if (Notification.permission === 'granted') {
      new Notification('Facet deep research is ready', {
        body: 'Your completed search report is available in Research.',
      })
    }
  }, [])

  const applyResearchJobUpdate = useCallback(
    (job: ResearchJob) => {
      setObservedResearchJob(job)
      updateActiveResearchJob({
        status: job.status,
        startedAt: job.startedAt,
        lastObservedAt: new Date().toISOString(),
      })

      if (activeResearchJob?.runId) {
        const runPatch = hydrateSearchRunFromResearchJob(job)
        updateRun(activeResearchJob.runId, runPatch)
        if (runPatch.contractViolations?.length) {
          console.warn('[research] deep research contract violations', runPatch.contractViolations)
        }
      }

      if (job.status === 'completed') {
        notifyResearchComplete(job)
      }

      if (TERMINAL_RESEARCH_JOB_STATUSES.has(job.status)) {
        clearPollTimer()
        closeResearchEventSource()
        clearActiveResearchJob(job.id)
        setIsSearching(false)
        void refreshResearchUsage()
      } else {
        setIsSearching(true)
      }
    },
    [
      activeResearchJob?.runId,
      clearActiveResearchJob,
      clearPollTimer,
      closeResearchEventSource,
      notifyResearchComplete,
      refreshResearchUsage,
      updateActiveResearchJob,
      updateRun,
    ],
  )

  const openResearchEventSource = useCallback(
    (jobId: string) => {
      if (document.visibilityState === 'hidden' || eventSourceRef.current) {
        return
      }

      const appendEvent = (text: string) => {
        researchJobEventIdRef.current += 1
        setResearchJobEvents((current) => [
          ...current.slice(-7),
          { id: researchJobEventIdRef.current, text },
        ])
      }

      eventSourceRef.current = streamDeepResearchJob(aiEndpoint, jobId, {
        onEvent: (event) => {
          if (event.type === 'thinking') {
            appendEvent('Thinking: ' + event.data)
          } else if (event.type === 'search_query') {
            appendEvent('Search: ' + event.data)
          } else if (event.type === 'finding') {
            appendEvent('Finding: ' + event.data)
          } else if (event.type === 'status') {
            appendEvent('Status: ' + event.data)
          } else if (event.type === 'complete') {
            void fetchDeepResearchJob(aiEndpoint, jobId)
              .then(applyResearchJobUpdate)
              .catch((error) => {
                setPageError(
                  error instanceof Error
                    ? error.message
                    : 'Failed to refresh completed research job.',
                )
              })
          }
        },
        onError: () => {
          closeResearchEventSource()
        },
        onClose: () => {
          closeResearchEventSource()
        },
      })
      setResearchJobTransport('sse')
    },
    [aiEndpoint, applyResearchJobUpdate, closeResearchEventSource],
  )

  const startDeepResearchRun = async ({
    request,
    thesisSnapshot,
    identityEvidence,
  }: {
    request: SearchRequest
    thesisSnapshot: SearchThesis
    identityEvidence: DeepResearchIdentityEvidence
  }) => {
    const runIdentityVersion = currentIdentity?.model_revision ?? thesisSnapshot.identityVersion
    const runIdentityFields =
      thesisSnapshot.identityFields ?? collectThesisIdentityFieldDependencies(thesisSnapshot)
    const run = addRun({
      requestId: request.id,
      status: 'running',
      results: [],
      searchLog: [],
      thesisId: thesisSnapshot.id,
      thesisSnapshot,
      identityVersion: runIdentityVersion,
      identityFields: runIdentityFields,
    })

    setActiveRunId(run.id)
    setActiveTab('results')
    setIsSearching(true)
    hiddenDuringJobRef.current = document.visibilityState === 'hidden'
    setResearchJobEvents([])

    let created: Awaited<ReturnType<typeof createDeepResearchJob>>
    try {
      created = await createDeepResearchJob({
        endpoint: aiEndpoint,
        thesisSnapshot,
        params: request,
        identityEvidence,
      })
    } catch (error) {
      updateRun(run.id, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Failed to create deep research job.',
      })
      throw error
    }
    if (created.usage) {
      setResearchUsage(created.usage)
    }
    setResearchBudgetNotice(created.warning?.message ?? null)
    updateRun(run.id, { jobId: created.jobId })
    setActiveResearchJob({
      jobId: created.jobId,
      runId: run.id,
      requestId: request.id,
      thesisId: thesisSnapshot.id,
      status: created.status,
      lastObservedAt: new Date().toISOString(),
    })
    setObservedResearchJob({
      id: created.jobId,
      userId: '',
      thesisId: thesisSnapshot.id,
      thesisSnapshot,
      identityEvidence,
      identityVersion: runIdentityVersion,
      params: request,
      paramsHash: '',
      status: created.status,
      createdAt: run.createdAt,
      ttlAt: run.createdAt,
    })
  }

  useEffect(() => {
    if (!activeResearchJobId || !activeResearchRunId || !aiEndpoint) {
      setIsSearching(false)
      return
    }

    let disposed = false
    const pollJob = (attempt: number) => {
      clearPollTimer()
      if (document.visibilityState === 'hidden') {
        hiddenDuringJobRef.current = true
      }

      void fetchDeepResearchJob(aiEndpoint, activeResearchJobId)
        .then((job) => {
          if (disposed) return
          applyResearchJobUpdate(job)
          if (!TERMINAL_RESEARCH_JOB_STATUSES.has(job.status)) {
            pollTimerRef.current = window.setTimeout(
              () => pollJob(attempt + 1),
              getResearchJobPollDelay(attempt),
            )
          }
        })
        .catch((error) => {
          if (disposed) return
          setPageError(error instanceof Error ? error.message : 'Failed to poll research job.')
          pollTimerRef.current = window.setTimeout(
            () => pollJob(attempt + 1),
            getResearchJobPollDelay(attempt),
          )
        })
    }

    const resumePolling = () => {
      if (document.visibilityState === 'hidden') {
        hiddenDuringJobRef.current = true
        closeResearchEventSource()
      } else {
        openResearchEventSource(activeResearchJobId)
      }
      pollJob(0)
    }

    setIsSearching(true)
    setActiveRunId(activeResearchRunId)
    setActiveTab('results')
    resumePolling()
    document.addEventListener('visibilitychange', resumePolling)
    window.addEventListener('focus', resumePolling)

    return () => {
      disposed = true
      clearPollTimer()
      closeResearchEventSource()
      document.removeEventListener('visibilitychange', resumePolling)
      window.removeEventListener('focus', resumePolling)
    }
  }, [
    activeResearchJobId,
    activeResearchRunId,
    aiEndpoint,
    applyResearchJobUpdate,
    clearPollTimer,
    closeResearchEventSource,
    openResearchEventSource,
  ])

  const setTabByOffset = (current: ResearchTab, offset: number) => {
    const currentIndex = RESEARCH_TABS.indexOf(current)
    const nextIndex = (currentIndex + offset + RESEARCH_TABS.length) % RESEARCH_TABS.length
    setActiveTab(RESEARCH_TABS[nextIndex] ?? current)
  }

  const handleTabKeyDown = (current: ResearchTab, event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      setTabByOffset(current, 1)
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      setTabByOffset(current, -1)
    } else if (event.key === 'Home') {
      event.preventDefault()
      setActiveTab('profile')
    } else if (event.key === 'End') {
      event.preventDefault()
      setActiveTab('results')
    }
  }

  const focusThesisSignalsEditor = useCallback(
    (target: ThesisSignalEditTarget) => {
      if (!activeThesis) return

      const currentDraft = thesisDraftRef.current
      if (currentDraft?.id !== activeThesis.id) {
        const nextDraft = structuredClone(activeThesis)
        const lookForText = thesisSignalText(nextDraft.lookFor)
        setThesisDraft(nextDraft)
        setThesisLookForText(lookForText)
        setThesisLookForBaselineText(lookForText)
        setThesisDraftIsDirty(false)
      }

      nextThesisSignalsFocusRequestIdRef.current += 1
      setActiveTab('search')
      setThesisSignalsFocusRequest({
        id: nextThesisSignalsFocusRequestIdRef.current,
        target,
      })
    },
    [activeThesis],
  )

  useEffect(() => {
    if (
      activeTab !== 'search' ||
      !thesisSignalsFocusRequest ||
      focusedThesisSignalsRequestRef.current === thesisSignalsFocusRequest.id ||
      !thesisDraft
    ) {
      return
    }

    let disposed = false
    let frame = 0

    const focusWhenReady = () => {
      if (disposed) return
      const target =
        thesisSignalsFocusRequest.target === 'avoid'
          ? (thesisFirstAvoidInputRef.current ?? thesisAddAvoidButtonRef.current)
          : thesisSignalsInputRef.current

      if (!target) {
        setThesisSignalsFocusRequest(null)
        return
      }

      target.scrollIntoView?.({ block: 'center' })
      target.focus({ preventScroll: true })
      focusedThesisSignalsRequestRef.current = thesisSignalsFocusRequest.id
      setThesisSignalsFocusRequest(null)
    }

    frame = window.requestAnimationFrame(focusWhenReady)

    return () => {
      disposed = true
      window.cancelAnimationFrame(frame)
    }
  }, [activeTab, thesisDraft, thesisSignalsFocusRequest])

  useEffect(() => {
    if (activeTab !== 'search' && thesisSignalsFocusRequest) {
      setThesisSignalsFocusRequest(null)
    }
  }, [activeTab, thesisSignalsFocusRequest])

  const handleInfer = async () => {
    try {
      setPageError(null)
      setIsInferring(true)
      if (currentIdentity) {
        const baseProfile = adaptIdentityToSearchProfile(currentIdentity, {
          resumeVersion: resumeData.version,
        })
        const enhancement = aiEndpoint
          ? await inferSearchProfileFromIdentity(currentIdentity, aiEndpoint)
          : {
              workSummary: baseProfile.workSummary,
              openQuestions: baseProfile.openQuestions,
            }

        setProfile({
          ...baseProfile,
          ...enhancement,
          inferredFromResumeVersion: resumeData.version,
        })
        setActiveTab('search')
        return
      }

      ensureEndpoint()
      const inferred = await inferSearchProfile(resumeData, aiEndpoint)
      const baseProfile = effectiveProfile ?? emptyProfile(resumeData.version)
      setProfile({
        ...baseProfile,
        ...inferred,
        inferredFromResumeVersion: resumeData.version,
      })
      setActiveTab('search')
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Profile inference failed.')
    } finally {
      setIsInferring(false)
    }
  }

  const handleGenerateThesis = async (
    options: {
      userCorrections?: string
      customDirective?: string
      modelFallback?: 'sonnet'
      switchToSearchTab?: boolean
    } = {},
  ) => {
    if (!currentIdentity) {
      setPageError('Generate a thesis from the Identity model before running thesis-driven search.')
      setActiveTab('profile')
      return
    }

    try {
      if (thesisDraftIsDirty) {
        setPageError('Save or discard thesis edits before regenerating.')
        return
      }
      ensureEndpoint()
      setPageError(null)
      setThesisFallbackOffer(null)
      setLatestIdentityImpact(null)
      resetStalenessReview()
      setIsGeneratingThesis(true)
      const feedbackEvents = getUnreflectedFeedback(activeThesis?.id)
      const corrections = options.userCorrections?.trim()
      const directive =
        options.customDirective?.trim() ?? activeThesis?.customDirective?.trim() ?? ''
      const generated = await generateSearchThesisFromIdentity(
        currentIdentity,
        aiEndpoint,
        feedbackEvents,
        {
          ...(corrections ? { userCorrections: corrections } : {}),
          ...(directive ? { customDirective: directive } : {}),
          ...(options.modelFallback ? { modelFallback: options.modelFallback } : {}),
        },
      )
      const saved = addThesis({
        ...generated.thesis,
        identityFields:
          generated.thesis.identityFields ??
          collectThesisIdentityFieldDependencies(generated.thesis),
      })
      // Stamp incorporated feedback events as reflected in the new thesis so subsequent
      // regenerations don't re-pull them via getUnreflectedFeedback. Previously this only
      // happened on save-edit / launch-search, leaving a window where a regenerate→discard
      // cycle would feed the same events back twice.
      if (saved.feedbackIncorporated.length > 0) {
        markFeedbackReflectedInThesis(saved.feedbackIncorporated, saved.id)
      }
      const lookForText = thesisSignalText(saved.lookFor)
      setActiveThesis(saved.id)
      setThesisDraft(structuredClone(saved))
      setThesisLookForText(lookForText)
      setThesisLookForBaselineText(lookForText)
      setThesisDraftIsDirty(false)
      setPendingSkillWriteback(null)
      setThesisContractViolations(generated.contractViolations)
      setCorrectionsDraft('')
      setDirectiveDraft(saved.customDirective ?? '')
      if (options.switchToSearchTab) {
        setActiveTab('search')
      }
    } catch (error) {
      if (!options.modelFallback && isOpusCapabilityError(error)) {
        setOpusAvailable(false)
        setThesisFallbackOffer({
          ...(options.userCorrections ? { userCorrections: options.userCorrections } : {}),
          ...(options.customDirective ? { customDirective: options.customDirective } : {}),
          ...(options.switchToSearchTab ? { switchToSearchTab: options.switchToSearchTab } : {}),
        })
        setPageError(null)
        void refreshAiCapabilities()
        return
      }
      setPageError(error instanceof Error ? error.message : 'Thesis generation failed.')
    } finally {
      setIsGeneratingThesis(false)
    }
  }

  const updateThesisDraft = (patch: Partial<SearchThesis>) => {
    setThesisDraft((current) => (current ? { ...current, ...patch } : current))
    setThesisDraftIsDirty(true)
  }

  const updateThesisLane = (index: number, patch: Partial<SearchThesis['searchLanes'][number]>) => {
    setThesisDraft((current) =>
      current
        ? {
            ...current,
            searchLanes: current.searchLanes.map((lane, laneIndex) =>
              laneIndex === index ? { ...lane, ...patch } : lane,
            ),
          }
        : current,
    )
    setThesisDraftIsDirty(true)
  }

  const moveThesisLane = (index: number, direction: -1 | 1) => {
    setThesisDraft((current) => {
      if (!current) return current
      const nextIndex = index + direction
      if (nextIndex < 0 || nextIndex >= current.searchLanes.length) return current
      const searchLanes = [...current.searchLanes]
      const [lane] = searchLanes.splice(index, 1)
      if (!lane) return current
      searchLanes.splice(nextIndex, 0, lane)
      return { ...current, searchLanes }
    })
    setThesisDraftIsDirty(true)
  }

  const addThesisLane = () => {
    setThesisDraft((current) => {
      if (!current) return current
      const lane = {
        id: createId('slane'),
        title: 'New search lane',
        rationale: 'Describe why this lane is strategically useful before launching search.',
        competitiveContext: '',
        targetSignals: [],
      }
      return {
        ...current,
        searchLanes: [...current.searchLanes, lane],
      }
    })
    setThesisDraftIsDirty(true)
  }

  const removeThesisLane = (index: number) => {
    setThesisDraft((current) => {
      if (!current) return current
      const removedLaneId = current.searchLanes[index]?.id
      if (!removedLaneId) return current
      const removedKeywordCount = current.keywordCombinations.filter(
        (entry) => entry.lane === removedLaneId,
      ).length
      const searchLanes = current.searchLanes.filter((_, laneIndex) => laneIndex !== index)
      const keywordCombinations = current.keywordCombinations.filter(
        (entry) => entry.lane !== removedLaneId,
      )
      setThesisNotice(
        removedKeywordCount > 0
          ? 'Removed the lane. Dropped ' +
              formatCount(
                removedKeywordCount,
                'linked keyword combination',
                'linked keyword combinations',
              ) +
              '.'
          : 'Removed the lane.',
      )
      return {
        ...current,
        searchLanes,
        keywordCombinations,
      }
    })
    setThesisDraftIsDirty(true)
  }

  const updateThesisAvoid = (index: number, patch: Partial<SearchThesis['avoid'][number]>) => {
    setThesisDraft((current) =>
      current
        ? {
            ...current,
            avoid: current.avoid.map((entry, entryIndex) => {
              if (entryIndex !== index) return entry
              return { ...entry, ...patch }
            }),
          }
        : current,
    )
    setThesisDraftIsDirty(true)
  }

  const updateThesisAdvantage = (
    index: number,
    patch: Partial<SearchThesis['unfairAdvantages'][number]>,
  ) => {
    setThesisDraft((current) =>
      current
        ? {
            ...current,
            unfairAdvantages: current.unfairAdvantages.map((advantage, advantageIndex) =>
              advantageIndex === index ? { ...advantage, ...patch } : advantage,
            ),
          }
        : current,
    )
    setThesisDraftIsDirty(true)
  }

  const addThesisAdvantage = () => {
    setThesisDraft((current) =>
      current
        ? {
            ...current,
            unfairAdvantages: [
              ...current.unfairAdvantages,
              {
                id: createId('sadv'),
                combination: 'New advantage combination',
                targetCompanyProfile: 'Describe the target company profile',
              },
            ],
          }
        : current,
    )
    setThesisDraftIsDirty(true)
  }

  const removeThesisAdvantage = (index: number) => {
    setThesisDraft((current) =>
      current
        ? {
            ...current,
            unfairAdvantages: current.unfairAdvantages.filter(
              (_, advantageIndex) => advantageIndex !== index,
            ),
          }
        : current,
    )
    setThesisDraftIsDirty(true)
  }

  const addThesisAvoid = () => {
    setThesisDraft((current) =>
      current
        ? {
            ...current,
            avoid: [
              ...current.avoid,
              {
                id: createId('ssig'),
                label: 'New avoid signal',
                condition: '',
                severity: 'soft',
              },
            ],
          }
        : current,
    )
    setThesisDraftIsDirty(true)
  }

  const removeThesisAvoid = (index: number) => {
    setThesisDraft((current) =>
      current
        ? {
            ...current,
            avoid: current.avoid.filter((_, entryIndex) => entryIndex !== index),
          }
        : current,
    )
    setThesisDraftIsDirty(true)
  }

  const updateThesisSkillDepth = (
    index: number,
    patch: Partial<SearchThesis['skillDepthMap'][number]>,
  ) => {
    setThesisDraft((current) =>
      current
        ? {
            ...current,
            skillDepthMap: current.skillDepthMap.map((entry, entryIndex) =>
              entryIndex === index ? { ...entry, ...patch } : entry,
            ),
          }
        : current,
    )
    setThesisDraftIsDirty(true)
  }

  const handleOpenStalenessReview = (impact: DownstreamImpact) => {
    if (currentIdentityRevision === null) {
      setThesisNotice('Load an Identity model before reviewing stale artifacts.')
      return
    }
    setActiveTab('search')
    // Snapshot the impact that triggered review so row decisions stay stable while stores mutate.
    setStalenessReviewImpact(cloneDownstreamImpact(impact))
    setStalenessReviewIdentityRevision(currentIdentityRevision)
    setRefreshedStalenessArtifactKeys({})
    setLatestIdentityImpact(null)
  }

  const isStalenessArtifactPresent = (
    artifact: DownstreamImpact['artifactsAffected'][number],
  ): boolean => {
    switch (artifact.artifactType) {
      case 'run':
        return runs.some((run) => run.id === artifact.artifactId)
      case 'thesis':
        return theses.some((thesis) => thesis.id === artifact.artifactId)
      case 'prep-deck':
        return prepDecks.some((deck) => deck.id === artifact.artifactId)
      case 'cover-letter':
        return coverLetterTemplates.some((template) => template.id === artifact.artifactId)
      default: {
        const exhaustive: never = artifact.artifactType
        throw new Error(`Unsupported staleness review artifact type: ${String(exhaustive)}`)
      }
    }
  }

  const getPersistedStalenessReview = (
    artifact: DownstreamImpact['artifactsAffected'][number],
  ): ArtifactStalenessReview | undefined => {
    switch (artifact.artifactType) {
      case 'run':
        return runs.find((run) => run.id === artifact.artifactId)?.stalenessReview
      case 'thesis':
        return theses.find((thesis) => thesis.id === artifact.artifactId)?.stalenessReview
      case 'prep-deck':
        return prepDecks.find((deck) => deck.id === artifact.artifactId)?.stalenessReview
      case 'cover-letter':
        return coverLetterTemplates.find((template) => template.id === artifact.artifactId)
          ?.stalenessReview
      default: {
        const exhaustive: never = artifact.artifactType
        throw new Error(`Unsupported staleness review artifact type: ${String(exhaustive)}`)
      }
    }
  }

  const getPersistedStalenessDecision = (
    artifact: DownstreamImpact['artifactsAffected'][number],
  ): StalenessReviewDecision | undefined => {
    const review = getPersistedStalenessReview(artifact)
    if (
      !review ||
      !stalenessReviewImpact ||
      review.reviewedIdentityVersion !== stalenessReviewIdentityRevision ||
      review.mutationFromRevision !== stalenessReviewImpact.mutation.fromRevision ||
      review.mutationToRevision !== stalenessReviewImpact.mutation.toRevision ||
      review.mutationLabel !== stalenessReviewImpact.mutation.label ||
      !haveSameIdentityMutationFields(review.mutationFields, stalenessReviewImpact.mutation.fields)
    ) {
      return undefined
    }
    return fromPersistedStalenessDecision(review.decision)
  }

  const handleStalenessReviewDecision = (
    artifact: DownstreamImpact['artifactsAffected'][number],
    decision: StalenessReviewDecision,
  ) => {
    if (
      !stalenessReviewImpact ||
      currentIdentityRevision === null ||
      stalenessReviewIdentityRevision !== currentIdentityRevision
    ) {
      setThesisNotice(
        'Identity changed before the decision could be saved. Generate a new impact notice to review the latest artifact state.',
      )
      return
    }
    const artifactKey = getStalenessArtifactKey(artifact, stalenessReviewImpact.mutation)
    if (refreshedStalenessArtifactKeys[artifactKey]) {
      setThesisNotice(
        `${artifact.label} was already refreshed with the latest Identity context; no stale-artifact decision was saved.`,
      )
      return
    }

    if (!isStalenessArtifactPresent(artifact)) {
      setThesisNotice(
        `${artifact.label} is no longer available, so the staleness review decision was not saved.`,
      )
      return
    }

    const review = sanitizeArtifactStalenessReview({
      decision: toPersistedStalenessDecision(decision),
      reviewedAt: new Date().toISOString(),
      reviewedIdentityVersion: currentIdentityRevision,
      artifactIdentityVersionAtReview: artifact.identityVersion ?? currentIdentityRevision,
      mutationLabel: stalenessReviewImpact.mutation.label,
      mutationFields: [...stalenessReviewImpact.mutation.fields],
      mutationFromRevision: stalenessReviewImpact.mutation.fromRevision,
      mutationToRevision: stalenessReviewImpact.mutation.toRevision,
      reason: artifact.reason || 'Reviewed from batch staleness panel.',
    } satisfies ArtifactStalenessReview)
    if (!review) {
      setThesisNotice(
        'Could not save the staleness review decision. Try reopening the batch review.',
      )
      return
    }

    let saved = true
    switch (artifact.artifactType) {
      case 'run':
        updateRun(artifact.artifactId, { stalenessReview: review })
        break
      case 'thesis':
        saved = markThesisStalenessReview(artifact.artifactId, review)
        break
      case 'prep-deck':
        updatePrepDeck(artifact.artifactId, { stalenessReview: review })
        break
      case 'cover-letter':
        updateCoverLetterTemplate(artifact.artifactId, { stalenessReview: review })
        break
      default: {
        const exhaustive: never = artifact.artifactType
        throw new Error(`Unsupported staleness review artifact type: ${String(exhaustive)}`)
      }
    }

    if (!saved) {
      setThesisNotice(
        `${artifact.label} could not be updated, so the staleness review decision was not saved.`,
      )
      return
    }
    setThesisNotice(`${artifact.label} staleness decision saved.`)
  }

  const handleRefreshStalenessArtifact = async (
    artifact: DownstreamImpact['artifactsAffected'][number],
    artifactKey: string,
  ) => {
    if (refreshingStalenessArtifactKeyRef.current !== null) {
      setThesisNotice(
        'A thesis refresh is already running. Wait for it to finish before starting another.',
      )
      return
    }

    if (artifact.artifactType !== 'thesis') {
      setThesisNotice(
        `${artifact.label} cannot be refreshed yet. Thesis refresh is available first; run, prep, and cover-letter refresh generators are still pending.`,
      )
      return
    }

    if (
      !currentIdentity ||
      !stalenessReviewImpact ||
      currentIdentityRevision === null ||
      stalenessReviewIdentityRevision !== currentIdentityRevision
    ) {
      setThesisNotice(
        'Identity changed before refresh could run. Generate a new impact notice to refresh the latest artifact state.',
      )
      return
    }

    const targetThesis = theses.find((thesis) => thesis.id === artifact.artifactId)
    if (!targetThesis) {
      setThesisNotice(`${artifact.label} is no longer available, so it was not refreshed.`)
      return
    }

    if (activeThesis?.id === targetThesis.id && thesisDraftIsDirty) {
      setThesisNotice(null)
      setPageError('Save or discard thesis edits before refreshing this stale thesis.')
      return
    }

    try {
      ensureEndpoint()
      setPageError(null)
      setThesisNotice(null)
      refreshingStalenessArtifactKeyRef.current = artifactKey
      setRefreshingStalenessArtifactKey(artifactKey)
      const refreshStartedIdentityRevision = currentIdentityRevision
      const refreshStartedImpact = stalenessReviewImpact
      const refreshStartedMutation = refreshStartedImpact.mutation
      const generated = await generateSearchThesisFromIdentity(
        currentIdentity,
        aiEndpoint,
        getUnreflectedFeedback(targetThesis.id),
      )
      const latestIdentityRevision =
        useIdentityStore.getState().currentIdentity?.model_revision ?? null
      const reviewSnapshotStillOpen = stalenessReviewImpactRef.current === refreshStartedImpact
      if (
        latestIdentityRevision !== refreshStartedIdentityRevision ||
        stalenessReviewIdentityRevisionRef.current !== refreshStartedIdentityRevision ||
        !reviewSnapshotStillOpen
      ) {
        // Nothing has been written yet; keep the user's current active thesis untouched.
        setThesisNotice(
          'Identity or review context changed during thesis refresh. The generated thesis was discarded; reopen the review after loading the latest impact notice.',
        )
        return
      }
      const activeThesisIdBeforeSave = useSearchStore.getState().activeThesisId
      if (activeThesisIdBeforeSave === targetThesis.id && thesisDraftIsDirtyRef.current) {
        setThesisNotice(
          'Thesis edits changed during refresh. The generated thesis was discarded; save or discard your edits before refreshing again.',
        )
        return
      }
      if (!isStalenessArtifactPresent(artifact)) {
        setThesisNotice(`${artifact.label} is no longer available, so it was not refreshed.`)
        return
      }

      const saved = saveThesisRevision(targetThesis.id, {
        ...generated.thesis,
        identityFields:
          generated.thesis.identityFields ??
          collectThesisIdentityFieldDependencies(generated.thesis),
        stalenessReview: undefined,
      })
      if (!saved) {
        setPageError(
          `${artifact.label} could not be refreshed. Reopen the batch review and try again.`,
        )
        return
      }

      if (saved.feedbackIncorporated.length > 0) {
        markFeedbackReflectedInThesis(saved.feedbackIncorporated, saved.id)
      }
      const refreshReview = sanitizeArtifactStalenessReview({
        decision: 'accepted-current',
        reviewedAt: new Date().toISOString(),
        reviewedIdentityVersion: refreshStartedIdentityRevision,
        artifactIdentityVersionAtReview: saved.identityVersion,
        mutationLabel: refreshStartedMutation.label,
        mutationFields: [...refreshStartedMutation.fields],
        mutationFromRevision: refreshStartedMutation.fromRevision,
        mutationToRevision: refreshStartedMutation.toRevision,
        reason: artifact.reason || 'Refreshed with latest Identity context.',
      } satisfies ArtifactStalenessReview)
      if (refreshReview) {
        markThesisStalenessReview(saved.id, refreshReview)
      }

      if (activeThesisIdBeforeSave === targetThesis.id) {
        const lookForText = thesisSignalText(saved.lookFor)
        setThesisDraft(structuredClone(saved))
        setThesisLookForText(lookForText)
        setThesisLookForBaselineText(lookForText)
        setThesisDraftIsDirty(false)
        setThesisContractViolations(generated.contractViolations)
      } else {
        setActiveThesis(activeThesisIdBeforeSave)
      }

      setRefreshedStalenessArtifactKeys((current) => ({
        ...current,
        [artifactKey]: true,
      }))
      setThesisNotice(`${artifact.label} refreshed with the latest Identity context.`)
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Thesis refresh failed.')
    } finally {
      refreshingStalenessArtifactKeyRef.current = null
      setRefreshingStalenessArtifactKey(null)
    }
  }

  const handleRequestSkillDepthWriteback = (index: number) => {
    if (!currentIdentity || !thesisDraft) {
      setPageError('Load an Identity model and thesis draft before applying skill corrections.')
      return
    }

    const entry = thesisDraft.skillDepthMap[index]
    if (!entry) return

    const target = resolveThesisSkillCorrectionTarget(currentIdentity, entry.skill)
    if (!target) {
      setPageError('Could not find "' + entry.skill + '" in the Identity skill model.')
      return
    }

    if (!isProfessionalSkillDepth(entry.depth)) {
      setPageError(
        'Choose a supported identity depth before writing "' + entry.skill + '" back to Identity.',
      )
      return
    }

    setPageError(null)
    setThesisNotice(null)
    setLatestIdentityImpact(null)
    resetStalenessReview()
    setPendingSkillWriteback({
      skillIndex: index,
      skillName: entry.skill,
      identityRevision: currentIdentityRevision ?? 0,
      target,
      impactArtifacts: downstreamImpactArtifacts,
    })
  }

  const handleCancelSkillDepthWriteback = () => {
    setPendingSkillWriteback(null)
    setThesisNotice('Identity writeback canceled.')
  }

  const handleConfirmSkillDepthWriteback = () => {
    if (!pendingSkillWriteback || !currentIdentity || !thesisDraft) return

    if (currentIdentity.model_revision !== pendingSkillWriteback.identityRevision) {
      setPendingSkillWriteback(null)
      setPageError(
        'Identity changed after confirmation opened. Review the current skill model and start writeback again.',
      )
      return
    }

    const entry = thesisDraft.skillDepthMap[pendingSkillWriteback.skillIndex]
    if (!entry) {
      setPendingSkillWriteback(null)
      setPageError('The selected thesis skill correction no longer exists.')
      return
    }

    if (!skillNamesMatch(entry.skill, pendingSkillWriteback.skillName)) {
      setPendingSkillWriteback(null)
      setPageError(
        'The selected thesis skill changed after confirmation opened. Review it and start Identity writeback again.',
      )
      return
    }

    if (!isProfessionalSkillDepth(entry.depth)) {
      setPageError(
        'Choose a supported identity depth before writing "' + entry.skill + '" back to Identity.',
      )
      return
    }

    const positioning = [entry.searchSignal, entry.calibration]
      .map((value) => value?.trim())
      .filter(Boolean)
      .join('\n\n')
    if (!positioning) {
      setPageError(
        'Add a search signal or calibration note before writing positioning back to Identity.',
      )
      return
    }
    const target = pendingSkillWriteback.target
    const impact = describeImpact(
      buildSkillDepthMutation(target.skillName, pendingSkillWriteback.identityRevision),
      pendingSkillWriteback.impactArtifacts,
    )

    saveSkillEnrichment(
      target.groupId,
      target.skillName,
      {
        depth: entry.depth,
        context: entry.context,
        positioning,
        contextStale: false,
        positioningStale: false,
      },
      'user',
    )

    setPendingSkillWriteback(null)
    setPageError(null)
    setLatestIdentityImpact(impact)
    const impactNotice =
      impact.totalCount > 0
        ? ' ' + impact.summary
        : ' No downstream artifacts referenced this skill.'
    setThesisNotice(
      'Updated Identity skill "' + target.skillName + '" from thesis calibration.' + impactNotice,
    )
  }

  const updateThesisKeywordCombination = (
    index: number,
    patch: Partial<SearchThesis['keywordCombinations'][number]>,
  ) => {
    setThesisDraft((current) =>
      current
        ? {
            ...current,
            keywordCombinations: current.keywordCombinations.map((entry, entryIndex) =>
              entryIndex === index ? { ...entry, ...patch } : entry,
            ),
          }
        : current,
    )
    setThesisDraftIsDirty(true)
  }

  const addThesisKeywordCombination = () => {
    const firstLaneId = thesisDraft?.searchLanes[0]?.id
    if (!firstLaneId) {
      setThesisNotice('Add a search lane before adding keyword combinations.')
      return
    }
    setThesisNotice(null)
    setThesisDraft((current) => {
      if (!current) return current
      return {
        ...current,
        keywordCombinations: [
          ...current.keywordCombinations,
          {
            id: createId('skwd'),
            query: '',
            lane: firstLaneId,
            noiseLevel: 'medium',
          },
        ],
      }
    })
    setThesisDraftIsDirty(true)
  }

  const removeThesisKeywordCombination = (index: number) => {
    setThesisDraft((current) =>
      current
        ? {
            ...current,
            keywordCombinations: current.keywordCombinations.filter(
              (_, entryIndex) => entryIndex !== index,
            ),
          }
        : current,
    )
    setThesisDraftIsDirty(true)
  }

  const updateThesisTimeline = (
    patch: Omit<Partial<NonNullable<SearchThesis['timeline']>>, 'urgency'> & {
      urgency?: ThesisUrgency | ''
    },
  ) => {
    setThesisDraft((current) => {
      if (!current) return current
      const priorTimeline = current.timeline ?? preservedTimelineRef.current
      const urgency = patch.urgency ?? current.timeline?.urgency ?? ''
      if (!urgency) {
        if (current.timeline) {
          preservedTimelineRef.current = current.timeline
        }
        return { ...current, timeline: undefined }
      }
      const finalUrgency: ThesisUrgency = urgency
      const deadline =
        patch.deadline !== undefined
          ? patch.deadline.trim()
            ? patch.deadline.trim()
            : undefined
          : priorTimeline?.deadline
      const strategyImpact =
        patch.strategyImpact !== undefined
          ? patch.strategyImpact
          : (priorTimeline?.strategyImpact ?? '')
      const timeline: NonNullable<SearchThesis['timeline']> = {
        urgency: finalUrgency,
        strategyImpact,
      }
      if (deadline !== undefined) timeline.deadline = deadline
      // Preserve timeline details only while the user is toggling urgency off and back on.
      preservedTimelineRef.current = null
      return { ...current, timeline }
    })
    setThesisDraftIsDirty(true)
  }

  const handleDiscardThesisDraft = () => {
    if (!activeThesis) return
    const lookForText = thesisSignalText(activeThesis.lookFor)
    setThesisDraft(structuredClone(activeThesis))
    setThesisLookForText(lookForText)
    setThesisLookForBaselineText(lookForText)
    setThesisDraftIsDirty(false)
    setThesisContractViolations(validateSearchThesis(activeThesis, currentIdentity))
    setPendingSkillWriteback(null)
    preservedTimelineRef.current = null
    setPageError(null)
    setThesisNotice(null)
  }

  const handleSaveThesisDraft = () => {
    if (!thesisDraft) return
    if (!activeThesis) {
      setPageError('Generate or select a thesis before saving edits.')
      return
    }

    const laneIds = new Set(thesisDraft.searchLanes.map((lane) => lane.id))
    const invalidKeywords = thesisDraft.keywordCombinations.filter(
      (entry) => !entry.lane || !laneIds.has(entry.lane),
    )
    if (invalidKeywords.length > 0) {
      setPageError(
        formatCount(invalidKeywords.length, 'keyword combination is', 'keyword combinations are') +
          ' linked to a removed lane. Choose a current search lane before saving.',
      )
      return
    }
    if (thesisDraft.timeline?.urgency && !thesisDraft.timeline.strategyImpact.trim()) {
      setPageError('Timeline strategy impact is required before saving thesis edits.')
      return
    }

    const nextDraft = {
      ...thesisDraft,
      lookFor:
        thesisLookForText === thesisLookForBaselineText
          ? thesisDraft.lookFor
          : reconcileThesisSignalsFromLabels(thesisDraft.lookFor, splitTags(thesisLookForText)),
      timeline: normalizeEditableTimeline(thesisDraft.timeline),
      identityFields: collectThesisIdentityFieldDependencies(thesisDraft),
    }
    const saved = saveThesisRevision(activeThesis.id, nextDraft)
    if (!saved) {
      setPageError('Could not save thesis revision.')
      return
    }

    setActiveThesis(saved.id)
    if (saved.feedbackIncorporated.length > 0) {
      markFeedbackReflectedInThesis(saved.feedbackIncorporated, saved.id)
    }
    setThesisDraft(structuredClone(saved))
    setThesisLookForText(thesisSignalText(saved.lookFor))
    setThesisLookForBaselineText(thesisSignalText(saved.lookFor))
    setThesisDraftIsDirty(false)
    setThesisContractViolations(validateSearchThesis(saved, currentIdentity))
    setPendingSkillWriteback(null)
    preservedTimelineRef.current = null
    setPageError(null)
    setThesisNotice(null)
    setLatestIdentityImpact(null)
    resetStalenessReview()
  }

  const handleResearchBudgetError = (error: unknown, message: string): boolean => {
    if (!(error instanceof FacetAiProxyError) || error.code !== 'research_budget_exceeded') {
      setResearchBudgetNotice(null)
      return false
    }

    setResearchBudgetNotice(message)
    void refreshResearchUsage()
    return true
  }

  const isOpusCapabilityError = (error: unknown): error is FacetAiProxyError =>
    error instanceof FacetAiProxyError &&
    error.code === 'ai_capability_unavailable' &&
    error.reason === 'opus_unavailable'

  const handleResearchCapabilityError = (error: unknown): boolean => {
    if (!isOpusCapabilityError(error)) return false
    setOpusAvailable(false)
    void refreshAiCapabilities()
    return true
  }

  const handleLaunchSearch = async () => {
    if (!activeThesis) {
      setPageError('Generate a thesis before launching deep research.')
      setActiveTab('search')
      return
    }
    if (!effectiveProfile || !executableProfile) {
      setPageError('Build or restore a search profile before launching search.')
      setActiveTab('profile')
      return
    }
    // Mirror the proxy's lanes-only contract before a deep-research job is submitted.
    if (requestDraft.focusLanes.length === 0) {
      if (laneOptions.length === 0) {
        setPageError(
          'Add at least one thesis lane before launching search. Edit the thesis to add lanes.',
        )
        focusThesisSignalsEditor('lookFor')
        return
      }
      setPageError('Select at least one thesis lane before launching search.')
      setActiveTab('search')
      return
    }

    try {
      ensureEndpoint()
      setPageError(null)
      setResearchBudgetNotice(null)
      prepareResearchNotifications()

      const request = addRequest({
        ...requestDraft,
        excludeCompanies: closedPipelineCompanies,
      })
      // Reviewed theses are the strategy artifact for Phase 2; request knobs stay
      // on the SearchRequest while the thesis remains stable across retries.
      const thesisSnapshot = activeThesis
      const thesisSnapshotWithDependencies = thesisSnapshot.identityFields
        ? thesisSnapshot
        : {
            ...thesisSnapshot,
            identityFields: collectThesisIdentityFieldDependencies(thesisSnapshot),
          }
      await startDeepResearchRun({
        request,
        thesisSnapshot: thesisSnapshotWithDependencies,
        identityEvidence: buildDeepResearchIdentityEvidence(currentIdentity, executableProfile),
      })
      if (activeThesis?.feedbackIncorporated.length) {
        markFeedbackReflectedInThesis(activeThesis.feedbackIncorporated, activeThesis.id)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Search execution failed.'
      if (!handleResearchBudgetError(error, message)) {
        handleResearchCapabilityError(error)
        setPageError(message)
      }
      setIsSearching(false)
    }
  }

  const handleRetryActiveRun = async () => {
    if (!activeRun?.thesisSnapshot || !activeRequest || !executableProfile) {
      setPageError('The preserved thesis or request was not available for retry.')
      return
    }

    try {
      ensureEndpoint()
      setPageError(null)
      setResearchBudgetNotice(null)
      prepareResearchNotifications()
      await startDeepResearchRun({
        request: activeRequest,
        thesisSnapshot: {
          ...activeRun.thesisSnapshot,
          updatedAt: new Date().toISOString(),
        },
        identityEvidence: buildDeepResearchIdentityEvidence(currentIdentity, executableProfile),
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Retry failed.'
      if (!handleResearchBudgetError(error, message)) {
        handleResearchCapabilityError(error)
        setPageError(message)
      }
      setIsSearching(false)
    }
  }

  const handleCancelActiveJob = async () => {
    if (!activeResearchJob) return

    try {
      ensureEndpoint()
      setPageError(null)
      const job = await cancelDeepResearchJob(aiEndpoint, activeResearchJob.jobId)
      applyResearchJobUpdate(job)
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Failed to cancel research job.')
    }
  }

  const openFeedbackPanel = (entry: SearchResultEntry, rating: 'up' | 'down') => {
    setFeedbackError(null)
    setFeedbackPanel({
      resultId: entry.id,
      rating,
      reason: '',
      addToAvoid: false,
      avoidLabel: rating === 'down' ? entry.company : '',
      avoidCondition: '',
      submitting: false,
    })
  }

  const closeFeedbackPanel = () => {
    setFeedbackPanel(null)
    setFeedbackError(null)
  }

  const updateFeedbackPanel = (patch: Partial<ResultFeedbackPanelState>) => {
    setFeedbackPanel((current) => (current ? { ...current, ...patch } : current))
  }

  const submitFeedback = () => {
    if (!feedbackPanel || !activeRun) return
    const trimmedReason = feedbackPanel.reason.trim()
    const wantsAvoidWriteback = feedbackPanel.rating === 'down' && feedbackPanel.addToAvoid

    if (wantsAvoidWriteback) {
      if (!currentIdentity) {
        setFeedbackError('Identity model is not loaded — open Identity to enable writeback.')
        return
      }
      if (!feedbackPanel.avoidLabel.trim()) {
        setFeedbackError(
          'Add an avoid label (company, signal, or attribute) before applying writeback.',
        )
        return
      }
    }

    const dimensions = wantsAvoidWriteback
      ? {
          preference: {
            category: 'avoid' as const,
            label: feedbackPanel.avoidLabel.trim(),
            ...(feedbackPanel.avoidCondition.trim()
              ? { condition: feedbackPanel.avoidCondition.trim() }
              : {}),
          },
        }
      : undefined

    const event = addFeedbackEvent({
      runId: activeRun.id,
      resultId: feedbackPanel.resultId,
      rating: feedbackPanel.rating,
      ...(trimmedReason ? { reason: trimmedReason } : {}),
      ...(dimensions ? { dimensions } : {}),
      appliedToIdentity: false,
    })

    if (wantsAvoidWriteback && currentIdentity) {
      const matching = currentIdentity.preferences.matching
      const nextAvoid = [
        ...matching.avoid,
        {
          id: createId('match-avoid'),
          label: feedbackPanel.avoidLabel.trim(),
          description: trimmedReason || 'Added from search result feedback.',
          severity: feedbackPanel.avoidCondition.trim()
            ? ('conditional' as const)
            : ('soft' as const),
          ...(feedbackPanel.avoidCondition.trim()
            ? { condition: feedbackPanel.avoidCondition.trim() }
            : {}),
        },
      ]
      updateCurrentMatching({ ...matching, avoid: nextAvoid })
      const updatedIdentity = useIdentityStore.getState().currentIdentity
      const newRevision = updatedIdentity?.model_revision ?? currentIdentity.model_revision ?? 0
      markFeedbackApplied(event.id, newRevision)
    }

    closeFeedbackPanel()
  }

  const handlePushToPipeline = (entry: SearchResultEntry, vectorId: string) => {
    const pipelineEntry = createPipelineEntryDraft(entry, vectorId, {
      searchQueries: activeRun?.searchLog,
    })
    if (!pipelineEntry) {
      setPageError('Search result tier was invalid and could not be pushed to the pipeline.')
      return
    }

    addPipelineEntry(pipelineEntry)

    void navigate({ to: '/pipeline' })
  }

  const handleCorrectSearchAssumption = useCallback(
    (_assumption: SearchAssumption) => {
      void navigate({
        to: '/identity',
        search: { focus: 'preferences', return: '/research' },
      })
    },
    [navigate],
  )

  const groupedResults = groupByTier(activeRun?.results ?? [])
  const feedbackByResultId = useMemo(() => {
    const map = new Map<string, ResultFeedbackBadge>()
    if (!activeRun) return map
    for (const event of feedbackEvents) {
      if (event.runId !== activeRun.id) continue
      // Latest event wins so the badge reflects the user's most recent reaction.
      map.set(event.resultId, {
        rating: event.rating,
        applied: event.appliedToIdentity,
      })
    }
    return map
  }, [activeRun, feedbackEvents])
  const visibleResearchJob =
    activeResearchJob && activeRun?.id === activeResearchJob.runId ? observedResearchJob : null
  const visibleJobProgress = visibleResearchJob?.progress
  const visibleJobStartedAt = visibleResearchJob?.startedAt ?? visibleResearchJob?.createdAt
  const visibleJobEndedAt = visibleResearchJob?.completedAt ?? visibleResearchJob?.heartbeatAt
  const visibleJobElapsedMs =
    visibleJobProgress?.elapsedMs ??
    (visibleJobStartedAt
      ? (visibleJobEndedAt ? Date.parse(visibleJobEndedAt) : Date.now()) -
        Date.parse(visibleJobStartedAt)
      : 0)
  const visibleJobIsActive =
    visibleResearchJob !== null &&
    visibleResearchJob !== undefined &&
    !TERMINAL_RESEARCH_JOB_STATUSES.has(visibleResearchJob.status)
  const activeRunContractViolations = activeRun?.contractViolations ?? []

  return (
    <div className="research-page">
      <header className="research-header">
        <div>
          <p className="research-eyebrow">Deep Job Research</p>
          <h1>Research</h1>
          <p className="research-copy">
            Build a search profile from your identity model or resume, launch targeted AI-assisted
            searches, and push the best matches into your pipeline.
          </p>
        </div>
        <div className="research-header-actions">
          <div
            className={`research-budget-badge research-budget-${researchUsage?.budget.status ?? 'loading'}`}
          >
            <span>{budgetBadgeCopy.label}</span>
            <strong>{budgetBadgeCopy.detail}</strong>
          </div>
          <button
            type="button"
            className="research-btn research-btn-primary"
            onClick={() => void (!effectiveProfile ? handleInfer() : handleLaunchSearch())}
            disabled={primaryActionBusy}
            aria-busy={primaryActionBusy}
          >
            {effectiveProfile ? <Search size={16} /> : <Sparkles size={16} />}
            {readinessCopy.primaryActionLabel}
          </button>
          <button type="button" className="research-btn" onClick={() => setActiveTab('profile')}>
            Review Profile
          </button>
          {effectiveProfile ? (
            <button
              type="button"
              className="research-btn"
              onClick={() => void handleInfer()}
              disabled={isInferring}
            >
              <RefreshCcw size={16} />
              {isInferring
                ? 'Refreshing…'
                : currentIdentity
                  ? 'Refresh from Identity'
                  : 'Refresh Resume Profile'}
            </button>
          ) : null}
          {effectiveProfile && !currentIdentity ? (
            <button type="button" className="research-btn" onClick={() => clearProfile()}>
              <RefreshCcw size={16} />
              Clear Profile
            </button>
          ) : null}
        </div>
      </header>

      <section className="research-card research-readiness" aria-label="Search readiness">
        <div className="research-card-header">
          <div>
            <h2>Search Readiness</h2>
            <p>{readinessCopy.headline}</p>
          </div>
          <AiActivityIndicator
            active={isInferring || isSearching}
            label={
              isSearching
                ? 'AI is searching the web and ranking results.'
                : 'AI is refreshing your research profile.'
            }
          />
        </div>
        <dl className="research-readiness-grid">
          <div className="research-readiness-stat">
            <dt className="research-readiness-label">Profile source</dt>
            <dd>{readinessCopy.sourceLabel}</dd>
          </div>
          <div className="research-readiness-stat">
            <dt className="research-readiness-label">Freshness</dt>
            <dd>{readinessCopy.freshnessLabel}</dd>
          </div>
          <div className="research-readiness-stat">
            <dt className="research-readiness-label">Search lanes</dt>
            <dd>{activeThesis?.searchLanes.length ?? 0}</dd>
          </div>
          <div className="research-readiness-stat">
            <dt className="research-readiness-label">Latest run</dt>
            <dd>{activeRun ? latestRunResultCount : 'None yet'}</dd>
          </div>
        </dl>
        <p className="research-readiness-detail">{readinessCopy.detail}</p>
      </section>

      {pageError ? (
        <div className="research-alert" role="alert">
          {pageError}
        </div>
      ) : null}

      <div className="research-tabs" role="tablist" aria-label="Research sections">
        {[
          { id: 'profile', label: 'Profile Editor' },
          { id: 'search', label: 'Search Launcher' },
          { id: 'results', label: 'Results Viewer' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            id={`research-tab-${tab.id}`}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`research-panel-${tab.id}`}
            tabIndex={activeTab === tab.id ? 0 : -1}
            className={`research-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id as ResearchTab)}
            onKeyDown={(event) => handleTabKeyDown(tab.id as ResearchTab, event)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <section
        className="research-panel"
        id="research-panel-profile"
        role="tabpanel"
        aria-labelledby="research-tab-profile"
        hidden={activeTab !== 'profile'}
      >
        {!effectiveProfile ? (
          <div className="research-empty">
            <h2>No search profile yet</h2>
            <p>
              {currentIdentity
                ? 'Apply or import an identity model to bootstrap research from identity-backed search data.'
                : 'Use your resume data to infer skills, vector search strategies, work summaries, and open questions you may want to refine before searching.'}
            </p>
          </div>
        ) : (
          <>
            <SearchThesisWorkspace
              activeThesis={activeThesis}
              isGeneratingThesis={isGeneratingThesis}
              isSearching={isSearching}
              hasIdentity={Boolean(currentIdentity)}
              correctionsDraft={correctionsDraft}
              onCorrectionsChange={setCorrectionsDraft}
              directiveDraft={directiveDraft}
              onDirectiveChange={setDirectiveDraft}
              onRegenerate={() =>
                void handleGenerateThesis({
                  userCorrections: correctionsDraft,
                  customDirective: directiveDraft,
                })
              }
              onCorrectAssumption={handleCorrectSearchAssumption}
            />

            <div className="research-grid research-grid-two">
              <SearchSkillsTable
                skills={effectiveProfile.skills}
                hiddenSkillIds={activeThesis?.searchOverrides?.hiddenSkillIds ?? []}
                hasActiveThesis={Boolean(activeThesis)}
                onToggleHidden={(skillId) => {
                  if (!activeThesis) return
                  toggleThesisHiddenSkill(activeThesis.id, skillId)
                }}
              />
              <SearchInstancePreferences
                identityBase={effectiveProfile}
                activeThesis={thesisDraft ?? activeThesis}
                onUpdateOverrides={(patch) => {
                  if (!activeThesis) return
                  updateThesisOverrides(activeThesis.id, patch)
                }}
                onEditThesisSignals={focusThesisSignalsEditor}
                onNavigateToIdentity={() =>
                  void navigate({
                    to: '/identity',
                    search: { focus: 'preferences', return: '/research' },
                  })
                }
              />
            </div>
          </>
        )}
      </section>

      <section
        className="research-panel"
        id="research-panel-search"
        role="tabpanel"
        aria-labelledby="research-tab-search"
        hidden={activeTab !== 'search'}
      >
        <div className="research-grid research-grid-two">
          <section className="research-card research-field-span research-thesis-card">
            <div className="research-card-header">
              <div>
                <p className="research-eyebrow">Phase 1</p>
                <h2>Search Thesis</h2>
                <p>
                  Generate a strategy thesis from Identity, review the structured lanes, then use
                  the saved thesis as the preserved input for deep research.
                </p>
              </div>
              <div className="research-header-actions">
                <button
                  type="button"
                  className="research-btn"
                  onClick={() => void handleGenerateThesis({ switchToSearchTab: true })}
                  disabled={
                    !currentIdentity || isGeneratingThesis || isSearching || thesisDraftIsDirty
                  }
                  aria-busy={isGeneratingThesis}
                >
                  <Sparkles size={16} />
                  {isGeneratingThesis
                    ? 'Generating thesis…'
                    : activeThesis
                      ? 'Regenerate Thesis'
                      : 'Generate Thesis'}
                </button>
                <button
                  type="button"
                  className="research-btn research-btn-primary"
                  onClick={handleSaveThesisDraft}
                  disabled={!thesisDraft || !activeThesis || isGeneratingThesis || isSearching}
                >
                  Save thesis edits
                </button>
                <button
                  type="button"
                  className="research-btn"
                  onClick={handleDiscardThesisDraft}
                  disabled={
                    !activeThesis || !thesisDraftIsDirty || isGeneratingThesis || isSearching
                  }
                >
                  Discard edits
                </button>
              </div>
            </div>

            {!currentIdentity ? (
              <p className="research-muted">
                Identity model required for AI thesis generation. Resume-backed search can still
                launch with a deterministic fallback thesis.
              </p>
            ) : null}

            {thesisIsStale ? (
              <div className="research-warning" role="status">
                <strong>Thesis may be stale</strong>
                <p>
                  This thesis was generated from identity v{activeThesis?.identityVersion}; the
                  current identity model is v{currentIdentity?.model_revision}.
                </p>
              </div>
            ) : null}

            {thesisDraftIsDirty ? (
              <p className="research-muted">
                Save thesis edits before regenerating so local changes are not lost.
              </p>
            ) : null}

            {thesisNotice ? (
              <div className="research-warning" role="status">
                {thesisNotice}
              </div>
            ) : null}

            {thesisFallbackOffer ? (
              <div className="research-warning" role="status">
                <strong>Opus is unavailable</strong>
                <p>
                  Phase 1 can continue with Sonnet, but the thesis may need Opus regeneration before
                  you trust it for an expensive deep-research run.
                </p>
                <div className="research-thesis-actions">
                  <button
                    type="button"
                    className="research-btn research-btn-primary"
                    onClick={() =>
                      void handleGenerateThesis({
                        ...thesisFallbackOffer,
                        modelFallback: 'sonnet',
                      })
                    }
                    disabled={isGeneratingThesis || isSearching}
                  >
                    Use Sonnet fallback
                  </button>
                  <button
                    type="button"
                    className="research-btn"
                    onClick={() => {
                      setThesisFallbackOffer(null)
                      setThesisNotice('Thesis generation paused until Opus is available.')
                    }}
                  >
                    Wait for Opus
                  </button>
                </div>
              </div>
            ) : null}

            {activeThesis?.source === 'generated-fallback' ? (
              <div className="research-warning" role="status">
                <strong>Generated with Sonnet fallback</strong>
                <p>
                  Treat this as a draft-quality thesis. Phase 2 still requires Opus for deep
                  research.
                </p>
                {opusAvailable ? (
                  <button
                    type="button"
                    className="research-btn"
                    onClick={() => void handleGenerateThesis({ switchToSearchTab: true })}
                    disabled={isGeneratingThesis || isSearching || thesisDraftIsDirty}
                  >
                    <RefreshCcw size={14} />
                    Regenerate with Opus
                  </button>
                ) : null}
              </div>
            ) : null}

            {latestIdentityImpact && latestIdentityImpact.totalCount > 0 ? (
              <div className="research-confirm" role="status">
                <strong>Downstream impact queued</strong>
                <p>{latestIdentityImpact.summary}</p>
                <ul className="research-list">
                  {latestIdentityImpact.artifactsAffected.slice(0, 4).map((artifact) => (
                    <li key={artifact.artifactType + '-' + artifact.artifactId}>
                      {artifact.label}: {artifact.reason}
                    </li>
                  ))}
                  {latestIdentityImpact.artifactsAffected.length > 4 ? (
                    <li>
                      +{' '}
                      {formatCount(
                        latestIdentityImpact.artifactsAffected.length - 4,
                        'more impacted artifact',
                        'more impacted artifacts',
                      )}
                    </li>
                  ) : null}
                </ul>
                <div className="research-thesis-actions">
                  <button
                    type="button"
                    className="research-btn"
                    onClick={() => handleOpenStalenessReview(latestIdentityImpact)}
                  >
                    Review impacted artifacts
                  </button>
                  <button
                    type="button"
                    className="research-btn"
                    onClick={() => setLatestIdentityImpact(null)}
                  >
                    Dismiss impact notice
                  </button>
                </div>
              </div>
            ) : null}

            {stalenessReviewImpact && stalenessReviewImpact.totalCount > 0 ? (
              <div
                className="research-confirm"
                role="region"
                aria-labelledby="staleness-review-title"
              >
                <strong id="staleness-review-title">Batch staleness review</strong>
                <p>
                  {stalenessReviewImpact.summary} Review each artifact now. Artifact-specific thesis
                  refresh is available; run, prep, and cover-letter refresh generators are still
                  pending.
                </p>
                <p>
                  Choices are saved on each reviewed artifact. Refreshing a thesis regenerates it
                  against the latest Identity context and records it as reviewed.
                </p>
                <ul className="research-list">
                  {stalenessReviewImpact.artifactsAffected.map((artifact, index) => {
                    const artifactKey = getStalenessArtifactKey(
                      artifact,
                      stalenessReviewImpact.mutation,
                    )
                    const key = getStalenessReviewKey(
                      artifact,
                      index,
                      stalenessReviewImpact.mutation,
                    )
                    const decision = getPersistedStalenessDecision(artifact)
                    const wasRefreshed = Boolean(refreshedStalenessArtifactKeys[artifactKey])
                    const isRefreshSupported = artifact.artifactType === 'thesis'
                    const isRefreshing = refreshingStalenessArtifactKey === artifactKey
                    const isRefreshDisabled =
                      !isRefreshSupported || refreshingStalenessArtifactKey !== null
                    const refreshButtonLabel = !isRefreshSupported
                      ? 'Refresh pending'
                      : isRefreshing
                        ? 'Refreshing thesis...'
                        : 'Refresh thesis'
                    return (
                      <li key={key}>
                        <strong>{artifact.label}</strong>: {artifact.reason}{' '}
                        <span className="research-muted" role="status" aria-live="polite">
                          Status:{' '}
                          {wasRefreshed
                            ? 'Refreshed with latest Identity'
                            : getStalenessDecisionLabel(decision)}
                          .
                        </span>
                        <div
                          className="research-thesis-actions"
                          role="group"
                          aria-label={'Staleness decision for ' + artifact.label}
                        >
                          <button
                            type="button"
                            className="research-btn"
                            aria-label={'Refresh ' + artifact.label + ' with latest Identity'}
                            disabled={isRefreshDisabled}
                            onClick={() =>
                              void handleRefreshStalenessArtifact(artifact, artifactKey)
                            }
                          >
                            {refreshButtonLabel}
                          </button>
                          <button
                            type="button"
                            className="research-btn"
                            aria-label={'Save accept current artifact for ' + artifact.label}
                            disabled={wasRefreshed}
                            onClick={() => handleStalenessReviewDecision(artifact, 'accepted')}
                          >
                            Save accept current
                          </button>
                          <button
                            type="button"
                            className="research-btn"
                            aria-label={'Save not stale decision for ' + artifact.label}
                            disabled={wasRefreshed}
                            onClick={() => handleStalenessReviewDecision(artifact, 'rejected')}
                          >
                            Save not stale
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
                <div className="research-thesis-actions">
                  <button
                    type="button"
                    className="research-btn"
                    onClick={() => {
                      const decisionCount = stalenessReviewImpact.artifactsAffected.filter(
                        (artifact) => getPersistedStalenessDecision(artifact),
                      ).length
                      resetStalenessReview()
                      if (decisionCount > 0) {
                        setThesisNotice(
                          'Closed batch review. Decisions were saved on reviewed artifacts.',
                        )
                      }
                    }}
                  >
                    Close batch review
                  </button>
                </div>
              </div>
            ) : null}

            {pendingSkillWriteback ? (
              <div
                className="research-confirm"
                role="region"
                aria-labelledby="identity-writeback-title"
              >
                <strong id="identity-writeback-title">Confirm Identity writeback</strong>
                <p>
                  This will update your identity model and move it from v
                  {pendingSkillWriteback.identityRevision} to v
                  {pendingSkillWriteback.identityRevision + 1}.{' '}
                  {pendingIdentityImpact?.summary ??
                    'No downstream artifacts are expected to need review.'}
                </p>
                <ul className="research-list">
                  <li>
                    Skill: {pendingSkillWriteback.target.skillName} (
                    {pendingSkillWriteback.target.groupLabel})
                  </li>
                  <li>Depth: {pendingSkillWritebackEntry?.depth ?? 'Unavailable'}</li>
                  <li>Context and positioning will be copied from this thesis calibration.</li>
                  {pendingIdentityImpact?.artifactsAffected.slice(0, 4).map((artifact) => (
                    <li key={artifact.artifactType + '-' + artifact.artifactId}>
                      {artifact.label}: {artifact.reason}
                    </li>
                  ))}
                  {pendingIdentityImpact && pendingIdentityImpact.artifactsAffected.length > 4 ? (
                    <li>
                      +{' '}
                      {formatCount(
                        pendingIdentityImpact.artifactsAffected.length - 4,
                        'more impacted artifact',
                        'more impacted artifacts',
                      )}
                    </li>
                  ) : null}
                </ul>
                <div className="research-thesis-actions">
                  <button
                    type="button"
                    className="research-btn research-btn-primary"
                    onClick={handleConfirmSkillDepthWriteback}
                  >
                    Apply to Identity
                  </button>
                  <button
                    type="button"
                    className="research-btn"
                    onClick={handleCancelSkillDepthWriteback}
                  >
                    Cancel Identity writeback
                  </button>
                </div>
              </div>
            ) : null}

            {thesisContractViolations.length > 0 ? (
              <div className="research-warning" role="status">
                <strong>Thesis quality warnings</strong>
                <ul className="research-list">
                  {thesisContractViolations.map((violation) => (
                    <li key={violation}>{violation}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {!thesisDraft ? (
              <div className="research-empty">
                <h2>No thesis reviewed yet</h2>
                <p>
                  Generate a thesis to expose the strategic narrative, search lanes, avoid list, and
                  skill-depth calibration before deep research starts.
                </p>
              </div>
            ) : (
              <div className="research-stack">
                <SearchAssumptionsDisclosure
                  assumptions={thesisDraft.assumptions}
                  onCorrectAssumption={handleCorrectSearchAssumption}
                />

                <div className="research-form-grid">
                  <label className="research-field research-field-span">
                    <span>Strategic narrative</span>
                    <textarea
                      className="research-textarea"
                      rows={7}
                      aria-label="Thesis narrative"
                      value={thesisDraft.narrative}
                      onChange={(event) => updateThesisDraft({ narrative: event.target.value })}
                    />
                  </label>

                  <label className="research-field research-field-span">
                    <span>Competitive moat</span>
                    <textarea
                      className="research-textarea"
                      rows={3}
                      aria-label="Competitive moat"
                      value={thesisDraft.competitiveMoat}
                      onChange={(event) =>
                        updateThesisDraft({ competitiveMoat: event.target.value })
                      }
                    />
                  </label>

                  <label className="research-field research-field-span">
                    <span>Interview strategy</span>
                    <textarea
                      className="research-textarea"
                      rows={3}
                      aria-label="Interview strategy"
                      value={thesisDraft.interviewStrategy}
                      onChange={(event) =>
                        updateThesisDraft({ interviewStrategy: event.target.value })
                      }
                    />
                  </label>

                  <label className="research-field research-field-span">
                    <span>Look-for signals</span>
                    <input
                      ref={thesisSignalsInputRef}
                      className="research-input"
                      aria-label="Look-for signals"
                      placeholder="e.g. Platform ownership, staff scope"
                      value={thesisLookForText}
                      onChange={(event) => {
                        const lookForText = event.target.value
                        setThesisLookForText(lookForText)
                        setThesisDraftIsDirty(true)
                      }}
                    />
                    <span className="research-muted">
                      {thesisLookForPreviewLabel}
                      {thesisLookForPreview.length > 0
                        ? thesisLookForPreview.join(', ')
                        : 'No look-for signals'}
                    </span>
                  </label>

                  <label className="research-field">
                    <span>Timeline urgency</span>
                    <select
                      className="research-select"
                      aria-label="Timeline urgency"
                      value={thesisDraft.timeline?.urgency ?? ''}
                      onChange={(event) =>
                        updateThesisTimeline({
                          urgency: event.target.value as ThesisUrgency | '',
                        })
                      }
                    >
                      <option value="">No timeline</option>
                      {THESIS_URGENCY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="research-field">
                    <span>Timeline deadline</span>
                    <input
                      className="research-input"
                      aria-label="Timeline deadline"
                      value={thesisDraft.timeline?.deadline ?? ''}
                      onChange={(event) => updateThesisTimeline({ deadline: event.target.value })}
                      disabled={!thesisDraft.timeline?.urgency}
                    />
                  </label>

                  <label className="research-field research-field-span">
                    <span>Timeline strategy impact</span>
                    <textarea
                      className={
                        thesisTimelineStrategyMissing
                          ? 'research-textarea research-input-invalid'
                          : 'research-textarea'
                      }
                      rows={2}
                      aria-label="Timeline strategy impact"
                      aria-invalid={thesisTimelineStrategyMissing ? 'true' : undefined}
                      aria-describedby={
                        thesisTimelineStrategyMissing
                          ? 'thesis-timeline-strategy-impact-error'
                          : undefined
                      }
                      value={thesisDraft.timeline?.strategyImpact ?? ''}
                      onChange={(event) =>
                        updateThesisTimeline({ strategyImpact: event.target.value })
                      }
                      disabled={!thesisDraft.timeline?.urgency}
                    />
                    {thesisTimelineStrategyMissing ? (
                      <span
                        id="thesis-timeline-strategy-impact-error"
                        className="research-field-hint research-field-hint-error"
                      >
                        Add strategy impact before saving this timeline.
                      </span>
                    ) : null}
                  </label>
                </div>

                <section className="research-stack" aria-label="Thesis unfair advantages">
                  <div className="research-vector-card-header">
                    <h3 className="research-subtitle">Unfair advantages</h3>
                    <button type="button" className="research-btn" onClick={addThesisAdvantage}>
                      Add advantage
                    </button>
                  </div>
                  {thesisDraft.unfairAdvantages.length === 0 ? (
                    <p className="research-muted">No advantage cards yet.</p>
                  ) : (
                    thesisDraft.unfairAdvantages.map((advantage, index) => (
                      <div key={advantage.id} className="research-thesis-editor-card">
                        <div className="research-form-grid">
                          <label className="research-field">
                            <span>Combination</span>
                            <input
                              className="research-input"
                              aria-label={`Advantage ${index + 1} combination`}
                              value={advantage.combination}
                              onChange={(event) =>
                                updateThesisAdvantage(index, { combination: event.target.value })
                              }
                            />
                          </label>
                          <label className="research-field research-field-span">
                            <span>Target company profile</span>
                            <textarea
                              className="research-textarea"
                              rows={2}
                              aria-label={`Advantage ${index + 1} target company profile`}
                              value={advantage.targetCompanyProfile}
                              onChange={(event) =>
                                updateThesisAdvantage(index, {
                                  targetCompanyProfile: event.target.value,
                                })
                              }
                            />
                          </label>
                        </div>
                        <button
                          type="button"
                          className="research-btn research-btn-danger"
                          onClick={() => removeThesisAdvantage(index)}
                        >
                          Remove advantage
                        </button>
                      </div>
                    ))
                  )}
                </section>

                <section className="research-stack" aria-label="Thesis search lanes">
                  <div className="research-vector-card-header">
                    <h3 className="research-subtitle">Search lanes</h3>
                    <button type="button" className="research-btn" onClick={addThesisLane}>
                      Add lane
                    </button>
                  </div>
                  {thesisDraft.searchLanes.length === 0 ? (
                    <p className="research-muted">No lanes yet.</p>
                  ) : (
                    thesisDraft.searchLanes.map((lane, index) => (
                      <div key={lane.id} className="research-thesis-editor-card">
                        <div className="research-form-grid">
                          <label className="research-field">
                            <span>Lane title</span>
                            <input
                              className="research-input"
                              aria-label={`Lane ${index + 1} title`}
                              value={lane.title}
                              onChange={(event) =>
                                updateThesisLane(index, { title: event.target.value })
                              }
                            />
                          </label>
                          <label className="research-field">
                            <span>Target signals</span>
                            <input
                              className="research-input"
                              aria-label={`Lane ${index + 1} target signals`}
                              value={lane.targetSignals.join(', ')}
                              onChange={(event) =>
                                updateThesisLane(index, {
                                  targetSignals: splitTags(event.target.value),
                                })
                              }
                            />
                          </label>
                          <label className="research-field research-field-span">
                            <span>Rationale</span>
                            <textarea
                              className="research-textarea"
                              rows={3}
                              aria-label={`Lane ${index + 1} rationale`}
                              value={lane.rationale}
                              onChange={(event) =>
                                updateThesisLane(index, { rationale: event.target.value })
                              }
                            />
                          </label>
                          <label className="research-field research-field-span">
                            <span>Competitive context</span>
                            <textarea
                              className="research-textarea"
                              rows={2}
                              aria-label={`Lane ${index + 1} competitive context`}
                              value={lane.competitiveContext ?? ''}
                              onChange={(event) =>
                                updateThesisLane(index, { competitiveContext: event.target.value })
                              }
                            />
                          </label>
                        </div>
                        <div className="research-thesis-actions">
                          <button
                            type="button"
                            className="research-btn"
                            onClick={() => moveThesisLane(index, -1)}
                            disabled={index === 0}
                          >
                            Move lane up
                          </button>
                          <button
                            type="button"
                            className="research-btn"
                            onClick={() => moveThesisLane(index, 1)}
                            disabled={index === thesisDraft.searchLanes.length - 1}
                          >
                            Move lane down
                          </button>
                          <button
                            type="button"
                            className="research-btn research-btn-danger"
                            onClick={() => removeThesisLane(index)}
                          >
                            Remove lane
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </section>

                <section className="research-stack" aria-label="Thesis keyword combinations">
                  <div className="research-vector-card-header">
                    <h3 className="research-subtitle">Keyword combinations</h3>
                    <button
                      type="button"
                      className="research-btn"
                      onClick={addThesisKeywordCombination}
                      disabled={thesisDraft.searchLanes.length === 0}
                    >
                      Add keyword
                    </button>
                  </div>
                  {thesisDraft.keywordCombinations.length === 0 ? (
                    <p className="research-muted">No keyword combinations yet.</p>
                  ) : (
                    thesisDraft.keywordCombinations.map((entry, index) => {
                      const laneIsInvalid = !entry.lane || !thesisLaneIds.has(entry.lane)
                      const laneErrorId = laneIsInvalid
                        ? 'thesis-keyword-lane-error-' + entry.id
                        : undefined
                      return (
                        <div
                          key={entry.id}
                          className="research-thesis-row research-thesis-keyword-row"
                        >
                          <label className="research-field">
                            <span>Query</span>
                            <input
                              className="research-input"
                              aria-label={`Keyword ${index + 1} query`}
                              value={entry.query}
                              onChange={(event) =>
                                updateThesisKeywordCombination(index, { query: event.target.value })
                              }
                            />
                          </label>
                          <label className="research-field">
                            <span>Lane</span>
                            <select
                              className={
                                laneIsInvalid
                                  ? 'research-select research-input-invalid'
                                  : 'research-select'
                              }
                              aria-label={`Keyword ${index + 1} lane`}
                              aria-invalid={laneIsInvalid ? 'true' : undefined}
                              aria-describedby={laneErrorId}
                              value={entry.lane}
                              onChange={(event) =>
                                updateThesisKeywordCombination(index, { lane: event.target.value })
                              }
                            >
                              {thesisDraft.searchLanes.every((lane) => lane.id !== entry.lane) ? (
                                <option value="" disabled>
                                  Select lane
                                </option>
                              ) : null}
                              {thesisDraft.searchLanes.map((lane) => (
                                <option key={lane.id} value={lane.id}>
                                  {lane.title}
                                </option>
                              ))}
                            </select>
                            {laneIsInvalid ? (
                              <span
                                id={laneErrorId}
                                className="research-field-hint research-field-hint-error"
                              >
                                Choose a current search lane before saving.
                              </span>
                            ) : null}
                          </label>
                          <label className="research-field">
                            <span>Noise</span>
                            <select
                              className="research-select"
                              aria-label={`Keyword ${index + 1} noise`}
                              value={entry.noiseLevel}
                              onChange={(event) =>
                                updateThesisKeywordCombination(index, {
                                  noiseLevel: isThesisNoiseLevel(event.target.value)
                                    ? event.target.value
                                    : 'medium',
                                })
                              }
                            >
                              {THESIS_NOISE_LEVEL_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <button
                            type="button"
                            className="research-btn research-btn-danger"
                            onClick={() => removeThesisKeywordCombination(index)}
                          >
                            Remove keyword
                          </button>
                        </div>
                      )
                    })
                  )}
                </section>

                <section className="research-stack" aria-label="Thesis avoid list">
                  <div className="research-vector-card-header">
                    <h3 className="research-subtitle">Avoid and qualifying conditions</h3>
                    <button
                      ref={thesisAddAvoidButtonRef}
                      type="button"
                      className="research-btn"
                      onClick={addThesisAvoid}
                    >
                      Add avoid signal
                    </button>
                  </div>
                  {thesisDraft.avoid.length === 0 ? (
                    <p className="research-muted">No avoid signals yet.</p>
                  ) : (
                    thesisDraft.avoid.map((entry, index) => (
                      <div key={entry.id} className="research-thesis-row">
                        <label className="research-field">
                          <span>Avoid</span>
                          <input
                            ref={index === 0 ? thesisFirstAvoidInputRef : undefined}
                            className="research-input"
                            aria-label={`Avoid ${index + 1} label`}
                            placeholder="e.g. Ad tech, crypto volatility"
                            value={entry.label}
                            onChange={(event) =>
                              updateThesisAvoid(index, { label: event.target.value })
                            }
                          />
                        </label>
                        <label className="research-field">
                          <span>Condition</span>
                          <input
                            className="research-input"
                            aria-label={`Avoid ${index + 1} condition`}
                            value={entry.condition ?? ''}
                            onChange={(event) =>
                              updateThesisAvoid(index, { condition: event.target.value })
                            }
                          />
                        </label>
                        <button
                          type="button"
                          className="research-btn research-btn-danger"
                          onClick={() => removeThesisAvoid(index)}
                        >
                          Remove
                        </button>
                      </div>
                    ))
                  )}
                </section>

                <section className="research-stack" aria-label="Thesis skill depth map">
                  <h3 className="research-subtitle">Skill-depth calibration</h3>
                  {thesisDraft.skillDepthMap.length === 0 ? (
                    <p className="research-muted">No skill-depth entries yet.</p>
                  ) : (
                    thesisDraft.skillDepthMap.map((entry, index) => (
                      <div key={`${entry.skill}-${index}`} className="research-thesis-editor-card">
                        <div className="research-form-grid">
                          <label className="research-field">
                            <span>Skill</span>
                            <input
                              className="research-input"
                              aria-label={`Skill depth ${index + 1} skill`}
                              value={entry.skill}
                              onChange={(event) =>
                                updateThesisSkillDepth(index, { skill: event.target.value })
                              }
                            />
                          </label>
                          <label className="research-field">
                            <span>Depth</span>
                            <input
                              className="research-input"
                              aria-label={`Skill depth ${index + 1} depth`}
                              value={entry.depth}
                              onChange={(event) =>
                                updateThesisSkillDepth(index, { depth: event.target.value })
                              }
                            />
                          </label>
                          <label className="research-field research-field-span">
                            <span>Context</span>
                            <textarea
                              className="research-textarea"
                              rows={2}
                              aria-label={`Skill depth ${index + 1} context`}
                              value={entry.context}
                              onChange={(event) =>
                                updateThesisSkillDepth(index, { context: event.target.value })
                              }
                            />
                          </label>
                          <label className="research-field research-field-span">
                            <span>Search signal</span>
                            <textarea
                              className="research-textarea"
                              rows={2}
                              aria-label={`Skill depth ${index + 1} search signal`}
                              value={entry.searchSignal}
                              onChange={(event) =>
                                updateThesisSkillDepth(index, { searchSignal: event.target.value })
                              }
                            />
                          </label>
                          <label className="research-field research-field-span">
                            <span>Calibration</span>
                            <textarea
                              className="research-textarea"
                              rows={2}
                              aria-label={`Skill depth ${index + 1} calibration`}
                              value={entry.calibration ?? ''}
                              onChange={(event) =>
                                updateThesisSkillDepth(index, { calibration: event.target.value })
                              }
                            />
                          </label>
                        </div>
                        <div className="research-thesis-actions">
                          <button
                            type="button"
                            className="research-btn"
                            onClick={() => handleRequestSkillDepthWriteback(index)}
                            disabled={!currentIdentity}
                            aria-label={`Write skill depth ${index + 1} back to Identity`}
                          >
                            Write back to Identity
                          </button>
                          <span className="research-muted">
                            Updates this Identity skill as depthSource='corrected' and bumps model
                            revision.
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </section>
              </div>
            )}
          </section>

          <section className="research-card">
            <div className="research-card-header">
              <div>
                <h2>Search Launcher</h2>
                <p>Generate a thesis, then choose lanes, overrides, and result quotas.</p>
              </div>
              <div className="research-launch-actions">
                <button
                  type="button"
                  className="research-btn ai-working-button"
                  onClick={() => void handleLaunchSearch()}
                  disabled={launchSearchDisabled}
                  aria-busy={isSearching}
                >
                  <Search size={16} />
                  {launchSearchLabel}
                </button>
                <p className="research-cost-preview">
                  Est. run: {formatCostCents(researchUsage?.estimate.runCostCents)}
                  {researchUsage?.budget.enforced
                    ? ' · ' + formatCostCents(researchUsage.budget.remainingCents) + ' left'
                    : ' · no ceiling set'}
                </p>
              </div>
              <AiActivityIndicator
                active={isSearching}
                label="AI is searching the web and ranking results."
              />
            </div>

            {researchBudgetNotice ? (
              <div className="research-warning" role="status">
                <strong>Deep research budget</strong>
                <p>{researchBudgetNotice}</p>
              </div>
            ) : null}

            {!effectiveProfile ? (
              <p className="research-muted">Create a profile before launching search.</p>
            ) : (
              <div className="research-form-grid">
                <fieldset className="research-fieldset research-field research-field-span">
                  <legend>Focus lanes</legend>
                  {!activeThesis ? (
                    <p className="research-muted">Generate Thesis before launching search.</p>
                  ) : laneOptions.length === 0 ? (
                    <p className="research-muted">
                      Add at least one thesis lane before launching search.
                    </p>
                  ) : (
                    <div className="research-checkbox-grid">
                      {laneOptions.map((lane) => (
                        <label key={lane.id} className="research-checkbox">
                          <input
                            type="checkbox"
                            checked={requestDraft.focusLanes.includes(lane.id)}
                            onChange={(event) =>
                              setRequestDraft((current) => ({
                                ...current,
                                focusLanes: event.target.checked
                                  ? [...current.focusLanes, lane.id]
                                  : current.focusLanes.filter((item) => item !== lane.id),
                              }))
                            }
                          />
                          <span>{lane.label}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </fieldset>

                <label className="research-field">
                  <span>Company size override</span>
                  <select
                    className="research-select"
                    value={requestDraft.companySizeOverride}
                    onChange={(event) =>
                      setRequestDraft((current) => ({
                        ...current,
                        companySizeOverride: event.target.value as SearchCompanySize | '',
                      }))
                    }
                  >
                    {COMPANY_SIZE_OPTIONS.map((option) => (
                      <option key={option.value || 'none'} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="research-field">
                  <span>Salary anchor override</span>
                  <input
                    className="research-input"
                    value={requestDraft.salaryAnchorOverride}
                    onChange={(event) =>
                      setRequestDraft((current) => ({
                        ...current,
                        salaryAnchorOverride: event.target.value,
                      }))
                    }
                    placeholder="$230k base / $330k total"
                  />
                </label>

                <label className="research-field research-field-span">
                  <span>Custom keywords</span>
                  <input
                    className="research-input"
                    value={requestDraft.customKeywords}
                    onChange={(event) =>
                      setRequestDraft((current) => ({
                        ...current,
                        customKeywords: event.target.value,
                      }))
                    }
                    placeholder="staff platform, developer productivity, internal tools"
                  />
                </label>

                <label className="research-checkbox research-checkbox-inline">
                  <input
                    type="checkbox"
                    checked={requestDraft.geoExpand}
                    onChange={(event) =>
                      setRequestDraft((current) => ({
                        ...current,
                        geoExpand: event.target.checked,
                      }))
                    }
                  />
                  <span>
                    Expand geography beyond preferred locations when fit is otherwise strong
                  </span>
                </label>

                <label className="research-field">
                  <span>Tier 1 max</span>
                  <input
                    className="research-input"
                    type="number"
                    min="1"
                    value={requestDraft.maxResults.tier1}
                    onChange={(event) =>
                      setRequestDraft((current) => ({
                        ...current,
                        maxResults: normalizeMaxResults(
                          current.maxResults,
                          'tier1',
                          event.target.value,
                        ),
                      }))
                    }
                  />
                </label>

                <label className="research-field">
                  <span>Tier 2 max</span>
                  <input
                    className="research-input"
                    type="number"
                    min="1"
                    value={requestDraft.maxResults.tier2}
                    onChange={(event) =>
                      setRequestDraft((current) => ({
                        ...current,
                        maxResults: normalizeMaxResults(
                          current.maxResults,
                          'tier2',
                          event.target.value,
                        ),
                      }))
                    }
                  />
                </label>

                <label className="research-field">
                  <span>Tier 3 max</span>
                  <input
                    className="research-input"
                    type="number"
                    min="1"
                    value={requestDraft.maxResults.tier3}
                    onChange={(event) =>
                      setRequestDraft((current) => ({
                        ...current,
                        maxResults: normalizeMaxResults(
                          current.maxResults,
                          'tier3',
                          event.target.value,
                        ),
                      }))
                    }
                  />
                </label>
              </div>
            )}
          </section>

          <section className="research-card">
            <div className="research-card-header">
              <div>
                <h2>Search Context</h2>
                <p>These exclusions come straight from your pipeline history.</p>
              </div>
            </div>

            <div className="research-stack">
              <div>
                <h3 className="research-subtitle">Auto-excluded companies</h3>
                {closedPipelineCompanies.length === 0 ? (
                  <p className="research-muted">No rejected, withdrawn, or closed companies yet.</p>
                ) : (
                  <div className="research-chip-list">
                    {closedPipelineCompanies.map((company) => (
                      <span key={company} className="research-chip">
                        {company}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="research-subtitle">Most recent requests</h3>
                {requests.length === 0 ? (
                  <p className="research-muted">No searches launched yet.</p>
                ) : (
                  <ul className="research-list">
                    {requests
                      .slice()
                      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
                      .slice(0, 5)
                      .map((request) => (
                        <li key={request.id}>
                          {new Date(request.createdAt).toLocaleString()} ·{' '}
                          {request.focusLanes.length > 0
                            ? request.focusLanes.join(', ')
                            : 'No thesis lanes'}{' '}
                          · {request.customKeywords || 'No extra keywords'}
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            </div>
          </section>
        </div>
      </section>

      <section
        className="research-panel"
        id="research-panel-results"
        role="tabpanel"
        aria-labelledby="research-tab-results"
        hidden={activeTab !== 'results'}
      >
        <div className="research-grid research-grid-results">
          <section className="research-card">
            <div className="research-card-header">
              <div>
                <h2>Results Viewer</h2>
                <p>
                  Review search runs, inspect the search log, and push strong matches into the
                  pipeline.
                </p>
              </div>
              {sortedRuns.length > 0 ? (
                <select
                  className="research-select"
                  aria-label="Select search run"
                  value={activeRun?.id ?? ''}
                  onChange={(event) => setActiveRunId(event.target.value)}
                >
                  {sortedRuns.map((run) => (
                    <option key={run.id} value={run.id}>
                      {new Date(run.createdAt).toLocaleString()} · {run.status}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>

            {!activeRun ? (
              <div className="research-empty">
                <h2>No runs yet</h2>
                <p>Launch a search to populate tiered results and search logs here.</p>
              </div>
            ) : (
              <div className="research-stack">
                <div className="research-run-summary">
                  <span className={`research-status research-status-${activeRun.status}`}>
                    {activeRun.status}
                  </span>
                  {activeRequest ? (
                    <span className="research-muted">
                      Focus:{' '}
                      {activeRequest.focusLanes.length > 0
                        ? activeRequest.focusLanes.join(', ')
                        : 'No thesis lanes'}
                    </span>
                  ) : null}
                  {activeRun.tokenUsage ? (
                    <span className="research-muted">
                      Tokens: {activeRun.tokenUsage.totalTokens}
                    </span>
                  ) : null}
                </div>

                {activeRun.error ? (
                  <div className="research-alert" role="alert">
                    <p>{activeRun.error}</p>
                    {activeRun.thesisSnapshot ? (
                      <button
                        type="button"
                        className="research-btn"
                        onClick={() => void handleRetryActiveRun()}
                        disabled={isSearching}
                      >
                        Retry preserved thesis
                      </button>
                    ) : null}
                  </div>
                ) : null}

                {visibleResearchJob ? (
                  <section className="research-job-progress" aria-label="Deep research progress">
                    <div className="research-job-progress-main">
                      <div>
                        <p className="research-eyebrow">Async Deep Research</p>
                        <h3>{visibleJobProgress?.phase ?? visibleResearchJob.status}</h3>
                        <p className="research-muted">
                          Typical 10-20 min. This job keeps running server-side if the tab closes.
                        </p>
                      </div>
                      <AiActivityIndicator
                        active={!TERMINAL_RESEARCH_JOB_STATUSES.has(visibleResearchJob.status)}
                        label="Deep research job is running server-side."
                      />
                    </div>
                    <dl className="research-job-stats">
                      <div>
                        <dt>Elapsed</dt>
                        <dd>
                          <ResearchJobElapsedTimer
                            startedAt={visibleJobStartedAt}
                            fallbackElapsedMs={visibleJobElapsedMs}
                            active={visibleJobIsActive}
                          />
                        </dd>
                      </div>
                      <div>
                        <dt>Transport</dt>
                        <dd>
                          {researchJobTransport === 'sse' ? 'Live stream + polling' : 'Polling'}
                        </dd>
                      </div>
                      <div>
                        <dt>Queries</dt>
                        <dd>
                          {visibleJobProgress?.searchQueries.length ?? activeRun.searchLog.length}
                        </dd>
                      </div>
                      <div>
                        <dt>Findings</dt>
                        <dd>{visibleJobProgress?.findingsCount ?? activeRun.results.length}</dd>
                      </div>
                    </dl>
                    {researchJobEvents.length > 0 ? (
                      <ul className="research-list">
                        {researchJobEvents.map((event) => (
                          <li key={event.id}>{event.text}</li>
                        ))}
                      </ul>
                    ) : null}
                    {!TERMINAL_RESEARCH_JOB_STATUSES.has(visibleResearchJob.status) ? (
                      <button
                        type="button"
                        className="research-btn research-btn-danger"
                        onClick={() => void handleCancelActiveJob()}
                      >
                        Cancel deep research
                      </button>
                    ) : null}
                  </section>
                ) : null}

                {activeRunContractViolations.length > 0 ? (
                  <div className="research-warning" role="status">
                    <strong>Output quality warnings</strong>
                    <p>
                      Some deep research fields came back shorter than the contract expects. You can
                      review the result or regenerate from the preserved thesis.
                    </p>
                    <ul className="research-list">
                      {activeRunContractViolations.map((violation) => (
                        <li key={violation}>{violation}</li>
                      ))}
                    </ul>
                    {activeRun.thesisSnapshot ? (
                      <button
                        type="button"
                        className="research-btn"
                        onClick={() => void handleRetryActiveRun()}
                        disabled={isSearching}
                      >
                        Regenerate from preserved thesis
                      </button>
                    ) : null}
                  </div>
                ) : null}

                {activeRun.narrative ? (
                  <section className="research-narrative" aria-label="Search narrative">
                    <h3>Run Narrative</h3>
                    <SearchAssumptionsDisclosure
                      assumptions={activeRun.narrative.assumptions}
                      onCorrectAssumption={handleCorrectSearchAssumption}
                    />
                    <p>
                      <CitationText
                        text={activeRun.narrative.executiveSummary}
                        citations={activeRun.narrative.citations}
                      />
                    </p>
                    <div className="research-narrative-grid">
                      <div>
                        <strong>Competitive moat</strong>
                        <p>
                          <CitationText
                            text={activeRun.narrative.competitiveMoat}
                            citations={activeRun.narrative.citations}
                          />
                        </p>
                      </div>
                      <div>
                        <strong>Selection methodology</strong>
                        <p>
                          <CitationText
                            text={activeRun.narrative.selectionMethodology}
                            citations={activeRun.narrative.citations}
                          />
                        </p>
                      </div>
                      <div>
                        <strong>Market context</strong>
                        <p>
                          <CitationText
                            text={activeRun.narrative.marketContext}
                            citations={activeRun.narrative.citations}
                          />
                        </p>
                      </div>
                    </div>
                    <CitationFootnotes
                      citations={getReferencedCitations(
                        [
                          activeRun.narrative.executiveSummary,
                          activeRun.narrative.competitiveMoat,
                          activeRun.narrative.selectionMethodology,
                          activeRun.narrative.marketContext,
                          activeRun.narrative.landscapeTrends,
                        ],
                        activeRun.narrative.citations ?? [],
                      )}
                      idPrefix="narrative-citation"
                      headingLevel="h4"
                    />
                  </section>
                ) : null}

                <details className="research-log">
                  <summary>Search log ({activeRun.searchLog.length})</summary>
                  {activeRun.searchLog.length === 0 ? (
                    <p className="research-muted">No query log was returned for this run.</p>
                  ) : (
                    <ul className="research-list">
                      {activeRun.searchLog.map((item, index) => (
                        <li key={`search-log-${index}`}>{item}</li>
                      ))}
                    </ul>
                  )}
                </details>

                {(
                  [
                    { key: 'tier1', label: 'Tier 1', items: groupedResults.tier1 },
                    { key: 'tier2', label: 'Tier 2', items: groupedResults.tier2 },
                    { key: 'tier3', label: 'Tier 3', items: groupedResults.tier3 },
                  ] as const
                ).map((group) => (
                  <div key={group.key} className="research-tier-section">
                    <div className="research-tier-header">
                      <h3>{group.label}</h3>
                      <span className={`research-tier-badge research-tier-badge-${group.key}`}>
                        {group.items.length}
                      </span>
                    </div>

                    {group.items.length === 0 ? (
                      <p className="research-muted">No matches in this tier.</p>
                    ) : (
                      <div className="research-result-list">
                        {group.items.map((result) => {
                          const selectedVector =
                            resultVectorSelections[result.id] ?? vectorOptions[0]?.id ?? ''
                          const feedbackBadge = feedbackByResultId.get(result.id) ?? null
                          const isFeedbackOpen = feedbackPanel?.resultId === result.id
                          const resultCitations = result.citations ?? []
                          const resultFootnoteCitations = getReferencedCitations(
                            [result.matchReason, result.vectorAlignment, result.candidateEdge],
                            resultCitations,
                          )
                          const recommendedVariantLabel = result.recommendedVariant
                            ? (activeRequest?.resumeVariants?.find(
                                (variant) => variant.id === result.recommendedVariant,
                              )?.label ?? result.recommendedVariant)
                            : ''
                          const bulletEdits = result.bulletEdits ?? []
                          const keywordsToInclude = result.keywordsToInclude ?? []
                          const hasDirectivePanel =
                            Boolean(recommendedVariantLabel) ||
                            bulletEdits.length > 0 ||
                            keywordsToInclude.length > 0

                          return (
                            <article key={result.id} className="research-result-card">
                              <div className="research-result-header">
                                <div>
                                  <h4>{result.company}</h4>
                                  <p>{result.title}</p>
                                </div>
                                <span
                                  className="research-score"
                                  aria-label={`Match score: ${result.matchScore}`}
                                >
                                  {result.matchScore}
                                </span>
                              </div>

                              <div className="research-result-meta">
                                {result.location ? <span>{result.location}</span> : null}
                                {result.estimatedComp ? <span>{result.estimatedComp}</span> : null}
                                <span>{result.source}</span>
                              </div>

                              <p className="research-result-copy">
                                <CitationText
                                  text={result.matchReason}
                                  citations={resultFootnoteCitations}
                                  mode="footnote"
                                  footnoteIdPrefix={'citation-' + result.id}
                                />
                              </p>

                              <div className="research-result-block">
                                <strong>Vector alignment</strong>
                                <p>
                                  <CitationText
                                    text={result.vectorAlignment || 'No vector note returned.'}
                                    citations={resultFootnoteCitations}
                                    mode="footnote"
                                    footnoteIdPrefix={'citation-' + result.id}
                                  />
                                </p>
                              </div>

                              {result.candidateEdge ? (
                                <div className="research-result-block">
                                  <strong>Candidate edge</strong>
                                  <p>
                                    <CitationText
                                      text={result.candidateEdge}
                                      citations={resultFootnoteCitations}
                                      mode="footnote"
                                      footnoteIdPrefix={'citation-' + result.id}
                                    />
                                  </p>
                                </div>
                              ) : null}

                              {result.signalGroup || result.advantageMatch ? (
                                <div className="research-result-meta">
                                  {result.signalGroup ? <span>{result.signalGroup}</span> : null}
                                  {result.advantageMatch ? (
                                    <span>{result.advantageMatch}</span>
                                  ) : null}
                                </div>
                              ) : null}

                              {result.companyIntel ? (
                                <div className="research-result-block">
                                  <strong>Company intelligence</strong>
                                  <p>
                                    {[
                                      result.companyIntel.stage,
                                      result.companyIntel.aiCulture,
                                      result.companyIntel.remotePolicy,
                                    ]
                                      .filter(Boolean)
                                      .join(' · ')}
                                  </p>
                                </div>
                              ) : null}

                              {result.interviewProcess ? (
                                <div className="research-result-block">
                                  <strong>Interview process</strong>
                                  <p>
                                    {result.interviewProcess.format}
                                    {result.interviewProcess.estimatedTimeline
                                      ? ' · ' + result.interviewProcess.estimatedTimeline
                                      : ''}
                                  </p>
                                </div>
                              ) : null}

                              {hasDirectivePanel ? (
                                <details className="research-result-directives">
                                  <summary>
                                    Resume directives
                                    {recommendedVariantLabel ? (
                                      <span className="research-pill research-directive-variant">
                                        {recommendedVariantLabel}
                                      </span>
                                    ) : null}
                                  </summary>
                                  <div className="research-result-directive-body">
                                    {bulletEdits.length > 0 ? (
                                      <div className="research-result-block">
                                        <strong>Top-of-resume edits</strong>
                                        <ul className="research-directive-list">
                                          {bulletEdits.map((edit, index) => (
                                            <li key={result.id + '-bullet-edit-' + index}>
                                              <div>
                                                <span className="research-directive-emphasis">
                                                  {edit.emphasis === 'lead' ? 'Lead' : 'Supporting'}
                                                </span>
                                                <p>{edit.text}</p>
                                                {edit.rationale ? <small>{edit.rationale}</small> : null}
                                              </div>
                                              <button
                                                type="button"
                                                className="research-btn research-directive-copy"
                                                aria-label={'Copy resume bullet for ' + result.company}
                                                onClick={() => {
                                                  void navigator.clipboard?.writeText(edit.text)
                                                }}
                                              >
                                                <Copy size={14} />
                                                <span>Copy</span>
                                              </button>
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    ) : null}

                                    {keywordsToInclude.length > 0 ? (
                                      <div className="research-result-block">
                                        <strong>Keywords to include</strong>
                                        <div className="research-chip-list">
                                          {keywordsToInclude.map((keyword) => (
                                            <span
                                              key={result.id + '-keyword-' + keyword}
                                              className="research-chip"
                                            >
                                              {keyword}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    ) : null}
                                  </div>
                                </details>
                              ) : null}

                              <CitationFootnotes
                                citations={resultFootnoteCitations}
                                idPrefix={'citation-' + result.id}
                                headingLevel="h5"
                              />

                              <div className="research-result-block">
                                <strong>Risks</strong>
                                {result.risks.length === 0 ? (
                                  <p>None surfaced.</p>
                                ) : (
                                  <ul className="research-list">
                                    {result.risks.map((risk, index) => (
                                      <li key={`${result.id}-risk-${index}`}>{risk}</li>
                                    ))}
                                  </ul>
                                )}
                              </div>

                              <div
                                className="research-result-feedback"
                                data-testid={`result-feedback-${result.id}`}
                              >
                                <div className="research-result-feedback-bar">
                                  <span className="research-result-feedback-label">
                                    How did this match feel?
                                  </span>
                                  <button
                                    type="button"
                                    className={`research-btn research-feedback-btn${
                                      feedbackBadge?.rating === 'up'
                                        ? ' research-feedback-btn-active-up'
                                        : ''
                                    }`}
                                    aria-label={`Mark ${result.company} match as good`}
                                    aria-pressed={feedbackBadge?.rating === 'up'}
                                    onClick={() => openFeedbackPanel(result, 'up')}
                                  >
                                    <ThumbsUp size={14} />
                                    <span>Good fit</span>
                                  </button>
                                  <button
                                    type="button"
                                    className={`research-btn research-feedback-btn${
                                      feedbackBadge?.rating === 'down'
                                        ? ' research-feedback-btn-active-down'
                                        : ''
                                    }`}
                                    aria-label={`Mark ${result.company} match as wrong`}
                                    aria-pressed={feedbackBadge?.rating === 'down'}
                                    onClick={() => openFeedbackPanel(result, 'down')}
                                  >
                                    <ThumbsDown size={14} />
                                    <span>Wrong fit</span>
                                  </button>
                                  {feedbackBadge?.applied ? (
                                    <span
                                      className="research-pill research-feedback-applied"
                                      title="This feedback has been written back to your Identity model."
                                    >
                                      Applied
                                    </span>
                                  ) : null}
                                </div>

                                {isFeedbackOpen && feedbackPanel ? (
                                  <div className="research-result-feedback-panel">
                                    <label className="research-result-feedback-field">
                                      <span>
                                        {feedbackPanel.rating === 'up'
                                          ? 'What worked? (optional)'
                                          : 'What was wrong? (optional)'}
                                      </span>
                                      <textarea
                                        rows={2}
                                        value={feedbackPanel.reason}
                                        onChange={(event) =>
                                          updateFeedbackPanel({ reason: event.target.value })
                                        }
                                        placeholder={
                                          feedbackPanel.rating === 'up'
                                            ? 'e.g., interview process matches my preference'
                                            : 'e.g., they require deep K8s admin experience'
                                        }
                                      />
                                    </label>
                                    {feedbackPanel.rating === 'down' ? (
                                      <div className="research-result-feedback-avoid">
                                        <label className="research-result-feedback-checkbox">
                                          <input
                                            type="checkbox"
                                            checked={feedbackPanel.addToAvoid}
                                            onChange={(event) =>
                                              updateFeedbackPanel({
                                                addToAvoid: event.target.checked,
                                              })
                                            }
                                          />
                                          <span>
                                            Add to Identity avoid list (writes back to your Identity
                                            model)
                                          </span>
                                        </label>
                                        {feedbackPanel.addToAvoid ? (
                                          <div className="research-result-feedback-avoid-fields">
                                            <label className="research-result-feedback-field">
                                              <span>Avoid label</span>
                                              <input
                                                type="text"
                                                value={feedbackPanel.avoidLabel}
                                                onChange={(event) =>
                                                  updateFeedbackPanel({
                                                    avoidLabel: event.target.value,
                                                  })
                                                }
                                                placeholder="e.g., K8s admin role"
                                              />
                                            </label>
                                            <label className="research-result-feedback-field">
                                              <span>Qualifying condition (optional)</span>
                                              <input
                                                type="text"
                                                value={feedbackPanel.avoidCondition}
                                                onChange={(event) =>
                                                  updateFeedbackPanel({
                                                    avoidCondition: event.target.value,
                                                  })
                                                }
                                                placeholder='e.g., "building around K8s is fine"'
                                              />
                                            </label>
                                          </div>
                                        ) : null}
                                      </div>
                                    ) : null}
                                    {feedbackError ? (
                                      <p className="research-error" role="alert">
                                        {feedbackError}
                                      </p>
                                    ) : null}
                                    <div className="research-result-feedback-actions">
                                      <button
                                        type="button"
                                        className="research-btn"
                                        onClick={closeFeedbackPanel}
                                      >
                                        <X size={14} />
                                        Cancel
                                      </button>
                                      <button
                                        type="button"
                                        className="research-btn research-btn-primary"
                                        onClick={submitFeedback}
                                      >
                                        Save feedback
                                      </button>
                                    </div>
                                  </div>
                                ) : null}
                              </div>

                              <div className="research-result-actions">
                                <a
                                  className="research-btn"
                                  href={result.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  aria-label="Open Listing (opens in new tab)"
                                >
                                  <BriefcaseBusiness size={16} />
                                  Open Listing
                                </a>
                                <select
                                  className="research-select"
                                  value={selectedVector}
                                  onChange={(event) =>
                                    setResultVectorSelections((current) => ({
                                      ...current,
                                      [result.id]: event.target.value,
                                    }))
                                  }
                                >
                                  {vectorOptions.map((vector) => (
                                    <option key={vector.id} value={vector.id}>
                                      {vector.label}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  className="research-btn research-btn-primary"
                                  onClick={() => handlePushToPipeline(result, selectedVector)}
                                >
                                  <ArrowRight size={16} />
                                  Add to Pipeline
                                </button>
                              </div>
                            </article>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </section>
    </div>
  )
}
