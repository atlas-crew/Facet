import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ArrowRight, BriefcaseBusiness, RefreshCcw, Search, Sparkles } from 'lucide-react'
import { AiActivityIndicator } from '../../components/AiActivityIndicator'
import { FacetAiProxyError } from '../../utils/aiProxyErrors'
import { useCoverLetterStore } from '../../store/coverLetterStore'
import { useIdentityStore } from '../../store/identityStore'
import { usePipelineStore } from '../../store/pipelineStore'
import { usePrepStore } from '../../store/prepStore'
import { useResumeStore } from '../../store/resumeStore'
import { useSearchStore } from '../../store/searchStore'
import {
  describeImpact,
  type DownstreamImpact,
  type IdentityMutation,
  type ImpactArtifactInput,
} from '../../types/artifactMeta'
import type { ProfessionalIdentityV3, ProfessionalSkillDepth } from '../../identity/schema'
import type {
  DeepResearchIdentityEvidence,
  ResearchJob,
  ResearchUsageSnapshot,
  SearchCompanySize,
  SearchProfile,
  SearchRequest,
  SearchResultEntry,
  SearchThesis,
  SkillCatalogEntry,
} from '../../types/search'
import { getFacetClientEnv } from '../../utils/facetEnv'
import { createId, sanitizeEndpointUrl } from '../../utils/idUtils'
import {
  buildDeepResearchIdentityEvidence,
  buildDeepResearchThesisSnapshot,
  cancelDeepResearchJob,
  createDeepResearchJob,
  fetchDeepResearchJob,
  fetchResearchUsage,
  getResearchJobPollDelay,
  hydrateSearchRunFromResearchJob,
  streamDeepResearchJob,
} from '../../utils/deepSearchClient'
import {
  generateSearchThesisFromIdentity,
  validateSearchThesis,
} from '../../utils/thesisGenerator'
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
  joinTags,
  normalizeMaxResults,
  splitTags,
  upsertVectorConfig,
} from './researchUtils'
import './research.css'

type ResearchTab = 'profile' | 'search' | 'results'
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

const getBudgetBadgeCopy = (usage: ResearchUsageSnapshot | null): {
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

const buildSkillDepthMutation = (
  skillName: string,
  fromRevision: number,
): IdentityMutation => ({
  label: skillName + ' depth correction',
  fields: buildSkillIdentityFields(skillName),
  fromRevision,
  toRevision: fromRevision + 1,
})

const formatOptionalCount = (count: number, singular: string, plural: string): string | undefined =>
  count > 0 ? formatCount(count, singular, plural) : undefined

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

  const elapsedMs =
    active && startedAt
      ? nowMs - Date.parse(startedAt)
      : fallbackElapsedMs ?? 0
  return <>{formatElapsedTime(elapsedMs)}</>
}

const serializeIdentityProfile = (profile: {
  inferredFromResumeVersion: number
  skills: SearchProfile['skills']
  vectors: SearchProfile['vectors']
  workSummary: SearchProfile['workSummary']
  openQuestions: SearchProfile['openQuestions']
  constraints: SearchProfile['constraints']
  filters: SearchProfile['filters']
  interviewPrefs: SearchProfile['interviewPrefs']
  source?: SearchProfile['source']
}) =>
  JSON.stringify({
    inferredFromResumeVersion: profile.inferredFromResumeVersion,
    skills: profile.skills,
    vectors: profile.vectors,
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
  effectiveProfile: Pick<SearchProfile, 'source' | 'vectors' | 'inferredFromResumeVersion'> | null
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
        ? 'Facet can pull skills, vectors, and constraints straight from Identity so Research starts from the same strategy model.'
        : 'Facet will infer skills, vectors, and open questions from your resume so you can review them before running search.',
      primaryActionLabel: currentIdentity ? 'Build Profile from Identity' : 'Build Profile from Resume',
    }
  }

  if (isIdentitySource) {
    return {
      sourceLabel: 'Identity model',
      freshnessLabel: 'Ready',
      headline: 'Your search profile is being driven by the identity model.',
      detail:
        'Update strategic fields in Identity when you want to change vectors, awareness items, or filtering defaults.',
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

export function ResearchPage() {
  const navigate = useNavigate()
  const resumeData = useResumeStore((state) => state.data)
  const currentIdentity = useIdentityStore((state) => state.currentIdentity)
  const saveSkillEnrichment = useIdentityStore((state) => state.saveSkillEnrichment)
  const coverLetterTemplates = useCoverLetterStore((state) => state.templates)
  const prepDecks = usePrepStore((state) => state.decks)
  const pipelineEntries = usePipelineStore((state) => state.entries)
  const addPipelineEntry = usePipelineStore((state) => state.addEntry)
  const {
    profile,
    requests,
    runs,
    setProfile,
    updateProfileSkills,
    updateProfileVectors,
    updateProfileConstraints,
    updateProfileFilters,
    updateProfileInterviewPrefs,
    clearProfile,
    addRequest,
    addRun,
    updateRun,
    theses,
    activeThesisId,
    addThesis,
    saveThesisRevision,
    setActiveThesis,
    activeResearchJob,
    setActiveResearchJob,
    updateActiveResearchJob,
    clearActiveResearchJob,
    getUnreflectedFeedback,
    markFeedbackReflectedInThesis,
  } = useSearchStore()

  const [activeTab, setActiveTab] = useState<ResearchTab>('profile')
  const [requestDraft, setRequestDraft] = useState(() => buildRequestDraft(profile))
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
  const [pendingSkillWriteback, setPendingSkillWriteback] =
    useState<PendingThesisSkillWriteback | null>(null)
  const [latestIdentityImpact, setLatestIdentityImpact] =
    useState<DownstreamImpact | null>(null)
  const [thesisContractViolations, setThesisContractViolations] = useState<string[]>([])
  const [observedResearchJob, setObservedResearchJob] = useState<ResearchJob | null>(null)
  const [researchJobEvents, setResearchJobEvents] = useState<ResearchJobEventLogEntry[]>([])
  const [researchJobTransport, setResearchJobTransport] = useState<'polling' | 'sse'>('polling')
  const [researchUsage, setResearchUsage] = useState<ResearchUsageSnapshot | null>(null)
  const [researchBudgetNotice, setResearchBudgetNotice] = useState<string | null>(null)
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
  const activeResearchJobId = activeResearchJob?.jobId
  const activeResearchRunId = activeResearchJob?.runId
  const currentIdentityRevision = currentIdentity
    ? currentIdentity.model_revision ?? 0
    : null
  const activeThesis = useMemo(
    () => theses.find((thesis) => thesis.id === activeThesisId) ?? null,
    [activeThesisId, theses],
  )
  const downstreamImpactArtifacts = useMemo<ImpactArtifactInput[]>(() => [
    ...theses.map((thesis) => ({
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
    })).filter((artifact) => artifact.artifactId !== activeThesis?.id),
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
  ], [activeThesis?.id, coverLetterTemplates, prepDecks, runs, theses])
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
      setThesisNotice(
        'Identity changed after confirmation opened. Review the current skill model and start writeback again.',
      )
      return
    }
    if (currentIdentityRevision === pendingSkillWriteback.identityRevision) return
    setPendingSkillWriteback(null)
    setLatestIdentityImpact(null)
    setThesisNotice(
      'Identity changed after confirmation opened. Review the current skill model and start writeback again.',
    )
  }, [currentIdentityRevision, pendingSkillWriteback])
  const thesisLookForPreview = useMemo(
    () =>
      thesisLookForText === thesisLookForBaselineText
        ? thesisDraft?.lookFor ?? []
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
    ? thesisDraft?.skillDepthMap[pendingSkillWriteback.skillIndex] ?? null
    : null
  const aiEndpoint = useMemo(
    () => sanitizeEndpointUrl(getFacetClientEnv().anthropicProxyUrl),
    [],
  )

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

  const effectiveProfile = currentIdentity ? identityDerivedProfile : profile ?? null
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
  const thesisIsStale =
    Boolean(
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

  const activeRequest = activeRun ? requestById.get(activeRun.requestId) ?? null : null
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

  const vectorOptions = useMemo(() => {
    if (isIdentitySource) {
      return (effectiveProfile?.vectors ?? []).map((vector) => ({
        id: vector.vectorId,
        label: vector.description || vector.targetRoleTitles[0] || vector.vectorId,
      }))
    }

    return resumeData.vectors.map((vector) => ({
      id: vector.id,
      label: vector.label,
    }))
  }, [effectiveProfile?.vectors, isIdentitySource, resumeData.vectors])

  const displayVectorConfigs = useMemo(() => {
    const current = effectiveProfile?.vectors ?? []
    return vectorOptions.map((vector, index) => {
      const match = current.find((config) => config.vectorId === vector.id)
      return (
        match ?? {
          vectorId: vector.id,
          priority: index + 1,
          description: '',
          targetRoleTitles: [],
          searchKeywords: [],
        }
      )
    })
  }, [effectiveProfile?.vectors, vectorOptions])
  const vectorLabelById = useMemo(
    () => new Map(vectorOptions.map((vector) => [vector.id, vector.label])),
    [vectorOptions],
  )

  const closedPipelineCompanies = useMemo(
    () =>
      [...new Set(
        pipelineEntries
          .filter((entry) =>
            entry.status === 'rejected' ||
            entry.status === 'withdrawn' ||
            entry.status === 'closed',
          )
          .map((entry) => entry.company.trim())
          .filter(Boolean),
      )].sort((left, right) => left.localeCompare(right)),
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
    setRequestDraft(buildRequestDraft(effectiveProfile))
  }, [effectiveProfile])

  useEffect(() => {
    const lookForText = activeThesis ? activeThesis.lookFor.join(', ') : ''
    setThesisDraft(activeThesis ? structuredClone(activeThesis) : null)
    setThesisLookForText(lookForText)
    setThesisLookForBaselineText(lookForText)
    setThesisDraftIsDirty(false)
    setPendingSkillWriteback(null)
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

  const applyResearchJobUpdate = useCallback((job: ResearchJob) => {
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
  }, [
    activeResearchJob?.runId,
    clearActiveResearchJob,
    clearPollTimer,
    closeResearchEventSource,
    notifyResearchComplete,
    refreshResearchUsage,
    updateActiveResearchJob,
    updateRun,
  ])

  const openResearchEventSource = useCallback((jobId: string) => {
    if (
      document.visibilityState === 'hidden' ||
      eventSourceRef.current
    ) {
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
              setPageError(error instanceof Error ? error.message : 'Failed to refresh completed research job.')
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
  }, [aiEndpoint, applyResearchJobUpdate, closeResearchEventSource])

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

  const handleTabKeyDown = (
    current: ResearchTab,
    event: KeyboardEvent<HTMLButtonElement>,
  ) => {
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

  const handleGenerateThesis = async () => {
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
      setLatestIdentityImpact(null)
      setIsGeneratingThesis(true)
      const feedbackEvents = getUnreflectedFeedback(activeThesis?.id)
      const generated = await generateSearchThesisFromIdentity(
        currentIdentity,
        aiEndpoint,
        feedbackEvents,
      )
      const saved = addThesis({
        ...generated.thesis,
        identityFields:
          generated.thesis.identityFields ??
          collectThesisIdentityFieldDependencies(generated.thesis),
      })
      const lookForText = saved.lookFor.join(', ')
      setActiveThesis(saved.id)
      setThesisDraft(structuredClone(saved))
      setThesisLookForText(lookForText)
      setThesisLookForBaselineText(lookForText)
      setThesisDraftIsDirty(false)
      setPendingSkillWriteback(null)
      setThesisContractViolations(generated.contractViolations)
      setActiveTab('search')
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Thesis generation failed.')
    } finally {
      setIsGeneratingThesis(false)
    }
  }

  const updateThesisDraft = (patch: Partial<SearchThesis>) => {
    setThesisDraft((current) => (current ? { ...current, ...patch } : current))
    setThesisDraftIsDirty(true)
  }

  const updateThesisLane = (
    index: number,
    patch: Partial<SearchThesis['searchLanes'][number]>,
  ) => {
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

  const updateThesisAvoid = (
    index: number,
    patch: Partial<SearchThesis['avoid'][number]>,
  ) => {
    setThesisDraft((current) =>
      current
        ? {
            ...current,
            avoid: current.avoid.map((entry, entryIndex) =>
              entryIndex === index ? { ...entry, ...patch } : entry,
            ),
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
                depth: 'Describe the depth signal',
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
            avoid: [...current.avoid, { label: 'New avoid signal', condition: '' }],
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
      'Updated Identity skill "' +
        target.skillName +
        '" from thesis calibration.' +
        impactNotice,
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
          : priorTimeline?.strategyImpact ?? ''
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
    const lookForText = activeThesis.lookFor.join(', ')
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
        formatCount(
          invalidKeywords.length,
          'keyword combination is',
          'keyword combinations are',
        ) + ' linked to a removed lane. Choose a current search lane before saving.',
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
          : splitTags(thesisLookForText),
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
    setThesisLookForText(saved.lookFor.join(', '))
    setThesisLookForBaselineText(saved.lookFor.join(', '))
    setThesisDraftIsDirty(false)
    setThesisContractViolations(validateSearchThesis(saved, currentIdentity))
    setPendingSkillWriteback(null)
    preservedTimelineRef.current = null
    setPageError(null)
    setThesisNotice(null)
    setLatestIdentityImpact(null)
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

  const handleLaunchSearch = async () => {
    if (!effectiveProfile || !executableProfile) {
      setPageError('Build or restore a search profile before launching search.')
      setActiveTab('profile')
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
      const thesisSnapshot =
        activeThesis ??
        buildDeepResearchThesisSnapshot({
          profile: executableProfile,
          request,
          identity: currentIdentity,
        })
      const thesisSnapshotWithDependencies =
        thesisSnapshot.identityFields
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

  const updateSkill = (skillId: string, patch: Partial<SkillCatalogEntry>) => {
    if (!effectiveProfile) return
    updateProfileSkills(
      effectiveProfile.skills.map((skill) =>
        skill.id === skillId ? { ...skill, ...patch } : skill,
      ),
    )
  }

  const removeSkill = (skillId: string) => {
    if (!effectiveProfile) return
    updateProfileSkills(effectiveProfile.skills.filter((skill) => skill.id !== skillId))
  }

  const addSkill = () => {
    const nextSkills = [
      ...(effectiveProfile?.skills ?? []),
      {
        id: createId('skl'),
        name: '',
        category: 'other',
        depth: 'working',
      } satisfies SkillCatalogEntry,
    ]
    updateProfileSkills(nextSkills)
  }

  const groupedResults = groupByTier(activeRun?.results ?? [])
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
            Build a search profile from your identity model or resume, launch targeted
            AI-assisted searches, and push the best matches into your pipeline.
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
          <button
            type="button"
            className="research-btn"
            onClick={() => setActiveTab('profile')}
          >
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
            <button
              type="button"
              className="research-btn"
              onClick={() => clearProfile()}
            >
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
            label={isSearching
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
            <dt className="research-readiness-label">Search angles</dt>
            <dd>{effectiveProfile?.vectors.length ?? 0}</dd>
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
              <div className="research-grid research-grid-two">
                <section className="research-card">
                  <div className="research-card-header">
                    <div>
                      <h2>Skills</h2>
                      <p>
                        {isIdentitySource
                          ? 'Identity-derived skills flow into Research automatically.'
                          : 'Review and refine the search-facing skills catalog.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="research-btn"
                      onClick={addSkill}
                      disabled={isIdentitySource}
                    >
                      Add Skill
                    </button>
                  </div>
                  <fieldset className="research-fieldset" disabled={isIdentitySource}>
                    <div className="research-skill-table">
                    {effectiveProfile.skills.length === 0 ? (
                      <p className="research-muted">No inferred skills yet.</p>
                    ) : (
                      effectiveProfile.skills.map((skill) => (
                        <div key={skill.id} className="research-skill-row">
                          <input
                            className="research-input"
                            aria-label="Skill name"
                            value={skill.name}
                            onChange={(event) => updateSkill(skill.id, { name: event.target.value })}
                            placeholder="Skill name"
                          />
                          <select
                            className="research-select"
                            aria-label="Skill depth"
                            value={skill.depth}
                            onChange={(event) =>
                              updateSkill(skill.id, {
                                depth: event.target.value as SkillCatalogEntry['depth'],
                              })
                            }
                          >
                            <option value="expert">Expert</option>
                            <option value="strong">Strong</option>
                            <option value="working">Working</option>
                            <option value="basic">Basic</option>
                            <option value="avoid">Avoid</option>
                          </select>
                          <input
                            className="research-input"
                            aria-label="Skill context"
                            value={skill.context ?? ''}
                            onChange={(event) => updateSkill(skill.id, { context: event.target.value })}
                            placeholder="Context"
                          />
                          <button
                            type="button"
                            className="research-btn research-btn-danger"
                            aria-label={`Remove skill ${skill.name || 'unnamed'}`}
                            onClick={() => removeSkill(skill.id)}
                          >
                            Remove
                          </button>
                        </div>
                      ))
                    )}
                    </div>
                  </fieldset>
                </section>

                <section className="research-card">
                  <div className="research-card-header">
                    <div>
                      <h2>Constraints & Preferences</h2>
                      <p>
                        {isIdentitySource
                          ? 'Identity owns these strategic fields. Review them here and update them from Identity.'
                          : 'Use these to steer search quality before launching runs.'}
                      </p>
                    </div>
                  </div>

                  <fieldset className="research-fieldset" disabled={isIdentitySource}>
                    <div className="research-form-grid">
                    <label className="research-field">
                      <span>Compensation anchor</span>
                      <input
                        className="research-input"
                        value={effectiveProfile.constraints.compensation}
                        onChange={(event) =>
                          updateProfileConstraints({
                            ...effectiveProfile.constraints,
                            compensation: event.target.value,
                          })
                        }
                        placeholder="$220k base / $300k total"
                      />
                    </label>

                    <label className="research-field">
                      <span>Preferred locations</span>
                      <input
                        className="research-input"
                        value={joinTags(effectiveProfile.constraints.locations)}
                        onChange={(event) =>
                          updateProfileConstraints({
                            ...effectiveProfile.constraints,
                            locations: splitTags(event.target.value),
                          })
                        }
                        placeholder="Remote, New York, Bay Area"
                      />
                    </label>

                    <label className="research-field">
                      <span>Clearance or background constraints</span>
                      <input
                        className="research-input"
                        value={effectiveProfile.constraints.clearance}
                        onChange={(event) =>
                          updateProfileConstraints({
                            ...effectiveProfile.constraints,
                            clearance: event.target.value,
                          })
                        }
                        placeholder="None, Public Trust, TS/SCI"
                      />
                    </label>

                    <label className="research-field">
                      <span>Preferred company size</span>
                      <select
                        className="research-select"
                        value={effectiveProfile.constraints.companySize}
                        onChange={(event) =>
                          updateProfileConstraints({
                            ...effectiveProfile.constraints,
                            companySize: event.target.value as SearchCompanySize | '',
                          })
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
                      <span>Prioritize</span>
                      <input
                        className="research-input"
                        value={joinTags(effectiveProfile.filters.prioritize)}
                        onChange={(event) =>
                          updateProfileFilters({
                            ...effectiveProfile.filters,
                            prioritize: splitTags(event.target.value),
                          })
                        }
                        placeholder="Platform ownership, staff scope"
                      />
                    </label>

                    <label className="research-field">
                      <span>Avoid</span>
                      <input
                        className="research-input"
                        value={joinTags(effectiveProfile.filters.avoid)}
                        onChange={(event) =>
                          updateProfileFilters({
                            ...effectiveProfile.filters,
                            avoid: splitTags(event.target.value),
                          })
                        }
                        placeholder="Ad tech, crypto volatility"
                      />
                    </label>

                    <label className="research-field">
                      <span>Strong fit signals</span>
                      <input
                        className="research-input"
                        value={joinTags(effectiveProfile.interviewPrefs.strongFit)}
                        onChange={(event) =>
                          updateProfileInterviewPrefs({
                            ...effectiveProfile.interviewPrefs,
                            strongFit: splitTags(event.target.value),
                          })
                        }
                        placeholder="Distributed systems, internal platforms"
                      />
                    </label>

                    <label className="research-field">
                      <span>Red flags</span>
                      <input
                        className="research-input"
                        value={joinTags(effectiveProfile.interviewPrefs.redFlags)}
                        onChange={(event) =>
                          updateProfileInterviewPrefs({
                            ...effectiveProfile.interviewPrefs,
                            redFlags: splitTags(event.target.value),
                          })
                        }
                        placeholder="Noisy on-call, unclear scope"
                      />
                    </label>
                    </div>
                  </fieldset>
                </section>
              </div>

              <div className="research-grid research-grid-two">
                <section className="research-card">
                  <div className="research-card-header">
                    <div>
                      <h2>Vector Search Config</h2>
                      <p>
                        {isIdentitySource
                          ? 'Identity-managed search vectors flow into Research automatically.'
                          : 'Guide role-title targeting and search keyword emphasis per vector.'}
                      </p>
                    </div>
                  </div>

                  <fieldset className="research-fieldset" disabled={isIdentitySource}>
                    <div className="research-stack">
                    {displayVectorConfigs.map((config) => {
                      return (
                        <div key={config.vectorId} className="research-vector-card">
                          <div className="research-vector-card-header">
                            <h3>{vectorLabelById.get(config.vectorId) ?? config.vectorId}</h3>
                            <span className="research-pill">Priority {config.priority}</span>
                          </div>

                          <div className="research-form-grid">
                            <label className="research-field">
                              <span>Priority</span>
                              <input
                                className="research-input"
                                type="number"
                                min="1"
                                value={config.priority}
                                onChange={(event) =>
                                  updateProfileVectors(
                                    upsertVectorConfig(
                                      effectiveProfile.vectors,
                                      config.vectorId,
                                      {
                                        priority: Math.max(1, Number.parseInt(event.target.value, 10) || 1),
                                      },
                                    ),
                                  )
                                }
                              />
                            </label>

                            <label className="research-field research-field-span">
                              <span>Description</span>
                              <textarea
                                className="research-textarea"
                                rows={3}
                                value={config.description}
                                onChange={(event) =>
                                  updateProfileVectors(
                                    upsertVectorConfig(effectiveProfile.vectors, config.vectorId, {
                                      description: event.target.value,
                                    }),
                                  )
                                }
                              />
                            </label>

                            <label className="research-field">
                              <span>Target role titles</span>
                              <input
                                className="research-input"
                                value={joinTags(config.targetRoleTitles)}
                                onChange={(event) =>
                                  updateProfileVectors(
                                    upsertVectorConfig(effectiveProfile.vectors, config.vectorId, {
                                      targetRoleTitles: splitTags(event.target.value),
                                    }),
                                  )
                                }
                                placeholder="Staff Engineer, Principal Engineer"
                              />
                            </label>

                            <label className="research-field">
                              <span>Search keywords</span>
                              <input
                                className="research-input"
                                value={joinTags(config.searchKeywords)}
                                onChange={(event) =>
                                  updateProfileVectors(
                                    upsertVectorConfig(effectiveProfile.vectors, config.vectorId, {
                                      searchKeywords: splitTags(event.target.value),
                                    }),
                                  )
                                }
                                placeholder="platform engineering, reliability"
                              />
                            </label>
                          </div>
                        </div>
                      )
                    })}
                    </div>
                  </fieldset>
                </section>

                <section className="research-card">
                  <div className="research-card-header">
                    <div>
                      <h2>Inference Notes</h2>
                      <p>
                        {isIdentitySource
                          ? 'Narrative summaries can be refreshed from the identity model without creating a second source of truth.'
                          : 'Summaries and open questions generated from resume data.'}
                      </p>
                    </div>
                  </div>

                  <div className="research-stack">
                    <div>
                      <h3 className="research-subtitle">Work Summary</h3>
                      {effectiveProfile.workSummary.length === 0 ? (
                        <p className="research-muted">No summary entries yet.</p>
                      ) : (
                        <ul className="research-list">
                          {effectiveProfile.workSummary.map((item, index) => (
                            <li key={`work-summary-${index}`}>
                              <strong>{item.title}:</strong> {item.summary}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div>
                      <h3 className="research-subtitle">Open Questions</h3>
                      {effectiveProfile.openQuestions.length === 0 ? (
                        <p className="research-muted">No open questions surfaced.</p>
                      ) : (
                        <ul className="research-list">
                          {effectiveProfile.openQuestions.map((question, index) => (
                            <li key={`question-${index}`}>{question}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </section>
              </div>

              {isIdentitySource ? (
                <p className="research-muted">
                  Need to change vectors, filters, or awareness items? Use the Identity page.
                </p>
              ) : null}
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
                    Generate a strategy thesis from Identity, review the structured lanes, then
                    use the saved thesis as the preserved input for deep research.
                  </p>
                </div>
                <div className="research-header-actions">
                  <button
                    type="button"
                    className="research-btn"
                    onClick={() => void handleGenerateThesis()}
                    disabled={!currentIdentity || isGeneratingThesis || isSearching || thesisDraftIsDirty}
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
                    disabled={!activeThesis || !thesisDraftIsDirty || isGeneratingThesis || isSearching}
                  >
                    Discard edits
                  </button>
                </div>
              </div>

              {!currentIdentity ? (
                <p className="research-muted">
                  Identity model required for AI thesis generation. Resume-backed search can
                  still launch with a deterministic fallback thesis.
                </p>
              ) : null}

              {thesisIsStale ? (
                <div className="research-warning" role="status">
                  <strong>Thesis may be stale</strong>
                  <p>
                    This thesis was generated from identity v{activeThesis?.identityVersion};
                    the current identity model is v{currentIdentity?.model_revision}.
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
                      onClick={() => void navigate({ to: '/identity' })}
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
                    Generate a thesis to expose the strategic narrative, search lanes,
                    avoid list, and skill-depth calibration before deep research starts.
                  </p>
                </div>
              ) : (
                <div className="research-stack">
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
                        className="research-input"
                        aria-label="Look-for signals"
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
                            <label className="research-field">
                              <span>Depth</span>
                              <input
                                className="research-input"
                                aria-label={`Advantage ${index + 1} depth`}
                                value={advantage.depth}
                                onChange={(event) =>
                                  updateThesisAdvantage(index, { depth: event.target.value })
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
                      <button type="button" className="research-btn" onClick={addThesisAvoid}>
                        Add avoid signal
                      </button>
                    </div>
                    {thesisDraft.avoid.length === 0 ? (
                      <p className="research-muted">No avoid signals yet.</p>
                    ) : (
                      thesisDraft.avoid.map((entry, index) => (
                        <div key={`${entry.label}-${index}`} className="research-thesis-row">
                          <label className="research-field">
                            <span>Avoid</span>
                            <input
                              className="research-input"
                              aria-label={`Avoid ${index + 1} label`}
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
                              Updates this Identity skill as depthSource='corrected' and bumps model revision.
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
                  <p>Choose vectors, overrides, and result quotas for the next run.</p>
                </div>
                <div className="research-launch-actions">
                  <button
                    type="button"
                    className="research-btn ai-working-button"
                    onClick={() => void handleLaunchSearch()}
                    disabled={isSearching}
                    aria-busy={isSearching}
                  >
                    <Search size={16} />
                    {isSearching ? 'Searching…' : 'Launch Search'}
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
                    <legend>Focus vectors</legend>
                    <div className="research-checkbox-grid">
                      {vectorOptions.map((vector) => (
                        <label key={vector.id} className="research-checkbox">
                          <input
                            type="checkbox"
                            checked={requestDraft.focusVectors.includes(vector.id)}
                            onChange={(event) =>
                              setRequestDraft((current) => ({
                                ...current,
                                focusVectors: event.target.checked
                                  ? [...current.focusVectors, vector.id]
                                  : current.focusVectors.filter((item) => item !== vector.id),
                              }))
                            }
                          />
                          <span>{vector.label}</span>
                        </label>
                      ))}
                    </div>
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
                    <span>Expand geography beyond preferred locations when fit is otherwise strong</span>
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
                          maxResults: normalizeMaxResults(current.maxResults, 'tier1', event.target.value),
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
                          maxResults: normalizeMaxResults(current.maxResults, 'tier2', event.target.value),
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
                          maxResults: normalizeMaxResults(current.maxResults, 'tier3', event.target.value),
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
                            {request.focusVectors.length > 0
                              ? request.focusVectors.join(', ')
                              : 'All vectors'} · {request.customKeywords || 'No extra keywords'}
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
                  <p>Review search runs, inspect the search log, and push strong matches into the pipeline.</p>
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
                        Focus: {activeRequest.focusVectors.length > 0 ? activeRequest.focusVectors.join(', ') : 'All vectors'}
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
                          <dd>{researchJobTransport === 'sse' ? 'Live stream + polling' : 'Polling'}</dd>
                        </div>
                        <div>
                          <dt>Queries</dt>
                          <dd>{visibleJobProgress?.searchQueries.length ?? activeRun.searchLog.length}</dd>
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
                        Some deep research fields came back shorter than the contract expects.
                        You can review the result or regenerate from the preserved thesis.
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
                      <p>{activeRun.narrative.executiveSummary}</p>
                      <div className="research-narrative-grid">
                        <div>
                          <strong>Competitive moat</strong>
                          <p>{activeRun.narrative.competitiveMoat}</p>
                        </div>
                        <div>
                          <strong>Selection methodology</strong>
                          <p>{activeRun.narrative.selectionMethodology}</p>
                        </div>
                        <div>
                          <strong>Market context</strong>
                          <p>{activeRun.narrative.marketContext}</p>
                        </div>
                      </div>
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

                  {([
                    { key: 'tier1', label: 'Tier 1', items: groupedResults.tier1 },
                    { key: 'tier2', label: 'Tier 2', items: groupedResults.tier2 },
                    { key: 'tier3', label: 'Tier 3', items: groupedResults.tier3 },
                  ] as const).map((group) => (
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
                              resultVectorSelections[result.id] ??
                              activeRequest?.focusVectors[0] ??
                              vectorOptions[0]?.id ??
                              ''

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

                                <p className="research-result-copy">{result.matchReason}</p>

                                <div className="research-result-block">
                                  <strong>Vector alignment</strong>
                                  <p>{result.vectorAlignment || 'No vector note returned.'}</p>
                                </div>

                                {result.candidateEdge ? (
                                  <div className="research-result-block">
                                    <strong>Candidate edge</strong>
                                    <p>{result.candidateEdge}</p>
                                  </div>
                                ) : null}

                                {result.signalGroup || result.advantageMatch ? (
                                  <div className="research-result-meta">
                                    {result.signalGroup ? <span>{result.signalGroup}</span> : null}
                                    {result.advantageMatch ? <span>{result.advantageMatch}</span> : null}
                                  </div>
                                ) : null}

                                {result.companyIntel ? (
                                  <div className="research-result-block">
                                    <strong>Company intelligence</strong>
                                    <p>
                                      {[result.companyIntel.stage, result.companyIntel.aiCulture, result.companyIntel.remotePolicy]
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
