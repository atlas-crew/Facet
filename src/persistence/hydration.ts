import { defaultResumeData } from '../store/defaultData'
import { useCoverLetterStore } from '../store/coverLetterStore'
import { useIdentityStore } from '../store/identityStore'
import { normalizeCoverLetterWorkspacePayload } from '../utils/coverLetterEntities'
import { migrateDebriefState, useDebriefStore } from '../store/debriefStore'
import { migrateLinkedInState, useLinkedInStore } from '../store/linkedinStore'
import { migratePipelineState, usePipelineStore } from '../store/pipelineStore'
import { migrateJDAnalysisState, useJDAnalysisStore } from '../store/jdAnalysisStore'
import { migratePrepState, usePrepStore } from '../store/prepStore'
import { useRecruiterStore } from '../store/recruiterStore'
import { normalizeResumeWorkspaceData, resumeMigration, useResumeStore } from '../store/resumeStore'
import { normalizeResumeWorkspacePayload } from '../utils/resumeEntities'
import { normalizeRecruiterCards } from '../utils/recruiterCardNormalization'
import { migrateSearchState, useSearchStore } from '../store/searchStore'
import type { SearchProfile } from '../types/search'
import { resolveStorage } from '../store/storage'
import { useUiStore } from '../store/uiStore'
import type { DebriefSession } from '../types/debrief'
import type { LinkedInProfileDraft } from '../types/linkedin'
import { cloneValue } from './clone'
import {
  DEFAULT_LOCAL_WORKSPACE_ID,
  type FacetLocalPreferencesSnapshot,
  type FacetWorkspaceSnapshot,
} from './contracts'

interface PersistedEnvelope<TState> {
  state: TState
  version?: number
}

const LEGACY_RESUME_KEY = 'vector-resume-data'
const LEGACY_RESUME_UI_KEY = 'vector-resume-ui'
const LEGACY_PIPELINE_KEY = 'facet-pipeline-data'
const LEGACY_PREP_KEY = 'facet-prep-workspace'
const LEGACY_COVER_LETTER_KEY = 'facet-cover-letter-data'
const LEGACY_LINKEDIN_KEY = 'facet-linkedin-workspace'
const LEGACY_DEBRIEF_KEY = 'facet-debrief-workspace'
const LEGACY_SEARCH_KEY = 'facet-search-data'

const persistedResearchProfile = (profile: SearchProfile | null) =>
  profile?.source?.kind === 'identity' ? null : cloneValue(profile)
// Recruiter cards shipped after unified workspace persistence, so there is no
// standalone legacy local-storage key to migrate here.

const restoreWorkspaceHydrationStore = (
  label: string,
  restore: () => void,
  rollbackErrors: unknown[],
) => {
  try {
    restore()
  } catch (error) {
    rollbackErrors.push(error)
    console.error(`Failed to roll back ${label} during workspace hydration.`, error)
  }
}

const readPersistedEnvelope = <TState>(key: string): PersistedEnvelope<TState> | null => {
  const raw = resolveStorage().getItem(key)
  if (typeof raw !== 'string') {
    return null
  }

  try {
    return JSON.parse(raw) as PersistedEnvelope<TState>
  } catch {
    return null
  }
}

const readSyncStorageValue = (key: string): string | null => {
  const raw = resolveStorage().getItem(key)
  return typeof raw === 'string' ? raw : null
}

export const applyWorkspaceSnapshotToStores = (snapshot: FacetWorkspaceSnapshot) => {
  const resumeWorkspace = normalizeResumeWorkspacePayload(
    snapshot.artifacts.resume.payload,
    defaultResumeData,
  )
  const resumeData = cloneValue(resumeWorkspace.data)
  const resumeVariants = cloneValue(resumeWorkspace.resumes)
  const resumeSnapshots = cloneValue(resumeWorkspace.snapshots)
  const pipelineEntries = cloneValue(snapshot.artifacts.pipeline.payload.entries)
  const jdAnalyses = cloneValue(snapshot.artifacts.jdAnalysis.payload.analyses)
  const prepDecks = cloneValue(snapshot.artifacts.prep.payload.decks)
  const coverLetterWorkspace = normalizeCoverLetterWorkspacePayload(
    snapshot.artifacts.coverLetters.payload,
  )
  const linkedInDrafts = cloneValue(
    snapshot.artifacts.linkedin.payload.drafts,
  ) as LinkedInProfileDraft[]
  const recruiterCards = normalizeRecruiterCards(snapshot.artifacts.recruiter.payload.cards)
  const debriefSessions = cloneValue(
    snapshot.artifacts.debrief.payload.sessions,
  ) as DebriefSession[]
  // migrateSearchState is version-agnostic and idempotent; applying it here keeps
  // workspace/import payloads aligned with direct legacy Zustand hydration.
  const migratedResearch = migrateSearchState(snapshot.artifacts.research.payload)
  const researchTheses = cloneValue(migratedResearch.theses ?? [])
  const activeThesisId =
    migratedResearch.activeThesisId &&
    researchTheses.some((thesis) => thesis.id === migratedResearch.activeThesisId)
      ? migratedResearch.activeThesisId
      : null

  const searchState = {
    profile: persistedResearchProfile(cloneValue(migratedResearch.profile)),
    requests: cloneValue(migratedResearch.requests),
    runs: cloneValue(migratedResearch.runs),
    theses: researchTheses,
    activeThesisId,
    feedbackEvents: cloneValue(migratedResearch.feedbackEvents),
    activeResearchJob: cloneValue(migratedResearch.activeResearchJob),
  }
  // Clobber rule (TASK-40): only a populated snapshot identity is applied. A
  // null/absent identity (legacy v1 snapshot, a cleared workspace, or an import
  // with no identity) leaves the live identity model untouched, so a snapshot
  // can never wipe the product's most critical model.
  const identityModel = cloneValue(snapshot.artifacts.identity?.payload?.identity ?? null)

  const previousResume = useResumeStore.getState()
  const previousPipeline = usePipelineStore.getState()
  const previousJDAnalysis = useJDAnalysisStore.getState()
  const previousPrep = usePrepStore.getState()
  const previousCoverLetter = useCoverLetterStore.getState()
  const previousLinkedIn = useLinkedInStore.getState()
  const previousRecruiter = useRecruiterStore.getState()
  const previousDebrief = useDebriefStore.getState()
  const previousSearch = useSearchStore.getState()
  const previousIdentity = useIdentityStore.getState()

  // Hydration is a best-effort in-memory transaction: runtime callers suppress
  // persistence while this runs, and any failed apply reverts every store below.
  try {
    useResumeStore.setState({
      data: resumeData,
      resumes: resumeVariants,
      snapshots: resumeSnapshots,
      activeResumeId: resumeWorkspace.activeResumeId,
      past: [],
      future: [],
      canUndo: false,
      canRedo: false,
    })

    usePipelineStore.setState((state) => ({
      ...state,
      entries: pipelineEntries,
    }))

    useJDAnalysisStore.setState({
      analyses: jdAnalyses,
    })

    usePrepStore.setState((state) => ({
      ...state,
      decks: prepDecks,
      activeDeckId:
        prepDecks.find((deck) => deck.id === state.activeDeckId)?.id ?? prepDecks[0]?.id ?? null,
    }))

    useCoverLetterStore.getState().importWorkspaceData(coverLetterWorkspace)

    useLinkedInStore.setState((state) => ({
      ...state,
      drafts: linkedInDrafts,
      selectedDraftId:
        linkedInDrafts.find((draft) => draft.id === state.selectedDraftId)?.id ??
        linkedInDrafts[0]?.id ??
        null,
    }))

    useRecruiterStore.setState((state) => ({
      ...state,
      cards: recruiterCards,
      selectedCardId:
        recruiterCards.find((card) => card.id === state.selectedCardId)?.id ??
        recruiterCards[0]?.id ??
        null,
    }))

    useDebriefStore.setState((state) => ({
      ...state,
      sessions: debriefSessions,
      selectedSessionId:
        debriefSessions.find((session) => session.id === state.selectedSessionId)?.id ??
        debriefSessions[0]?.id ??
        null,
    }))

    useSearchStore.setState(searchState)

    if (identityModel) {
      useIdentityStore.getState().hydrateIdentityFromSnapshot(identityModel)
    }
  } catch (error) {
    const rollbackErrors: unknown[] = []
    restoreWorkspaceHydrationStore(
      'resume store',
      () => {
        useResumeStore.setState(previousResume, true)
      },
      rollbackErrors,
    )
    restoreWorkspaceHydrationStore(
      'pipeline store',
      () => {
        usePipelineStore.setState(previousPipeline, true)
      },
      rollbackErrors,
    )
    restoreWorkspaceHydrationStore(
      'JD analysis store',
      () => {
        useJDAnalysisStore.setState(previousJDAnalysis, true)
      },
      rollbackErrors,
    )
    restoreWorkspaceHydrationStore(
      'prep store',
      () => {
        usePrepStore.setState(previousPrep, true)
      },
      rollbackErrors,
    )
    restoreWorkspaceHydrationStore(
      'cover letter store',
      () => {
        useCoverLetterStore.setState(previousCoverLetter, true)
      },
      rollbackErrors,
    )
    restoreWorkspaceHydrationStore(
      'LinkedIn store',
      () => {
        useLinkedInStore.setState(previousLinkedIn, true)
      },
      rollbackErrors,
    )
    restoreWorkspaceHydrationStore(
      'recruiter store',
      () => {
        useRecruiterStore.setState(previousRecruiter, true)
      },
      rollbackErrors,
    )
    restoreWorkspaceHydrationStore(
      'debrief store',
      () => {
        useDebriefStore.setState(previousDebrief, true)
      },
      rollbackErrors,
    )
    restoreWorkspaceHydrationStore(
      'research store',
      () => {
        useSearchStore.setState(previousSearch, true)
      },
      rollbackErrors,
    )
    restoreWorkspaceHydrationStore(
      'identity store',
      () => {
        useIdentityStore.setState(previousIdentity, true)
      },
      rollbackErrors,
    )
    if (rollbackErrors.length > 0) {
      throw new AggregateError(
        [error, ...rollbackErrors],
        'Workspace hydration failed and rollback was incomplete.',
      )
    }
    throw error
  }
}

export const applyLocalPreferencesSnapshotToStores = (snapshot: FacetLocalPreferencesSnapshot) => {
  useUiStore.setState((state) => ({
    ...state,
    selectedVector: snapshot.ui.selectedVector,
    panelRatio: snapshot.ui.panelRatio,
    appearance: snapshot.ui.appearance,
    viewMode: snapshot.ui.viewMode,
    showHeatmap: snapshot.ui.showHeatmap,
    showDesignHealth: snapshot.ui.showDesignHealth,
    suggestionModeActive: snapshot.ui.suggestionModeActive,
    backupRemindersEnabled: snapshot.ui.backupRemindersEnabled,
    backupReminderIntervalDays: snapshot.ui.backupReminderIntervalDays,
    backupReminderSnoozedUntil: snapshot.ui.backupReminderSnoozedUntil,
    lastBackupAt: snapshot.ui.lastBackupAt,
    tourCompleted: snapshot.ui.tourCompleted,
  }))

  usePipelineStore.setState((state) => ({
    ...state,
    sortField: snapshot.pipeline.sortField,
    sortDir: snapshot.pipeline.sortDir,
  }))

  usePrepStore.setState((state) => ({
    ...state,
    activeDeckId: snapshot.prep.activeDeckId,
    activeMode: snapshot.prep.activeMode ?? 'edit',
  }))

  useLinkedInStore.setState((state) => ({
    ...state,
    selectedDraftId: snapshot.linkedin.selectedDraftId,
  }))
  useRecruiterStore.setState((state) => ({
    ...state,
    selectedCardId: snapshot.recruiter.selectedCardId,
  }))
  useDebriefStore.setState((state) => ({
    ...state,
    selectedSessionId: snapshot.debrief.selectedSessionId,
  }))
}

export const hydrateStoresFromLegacyStorage = (): boolean => {
  const resumeEnvelope = readPersistedEnvelope<unknown>(LEGACY_RESUME_KEY)
  const pipelineEnvelope = readPersistedEnvelope<unknown>(LEGACY_PIPELINE_KEY)
  const prepEnvelope = readPersistedEnvelope<unknown>(LEGACY_PREP_KEY)
  const coverLetterEnvelope = readPersistedEnvelope<unknown>(LEGACY_COVER_LETTER_KEY)
  const linkedInEnvelope = readPersistedEnvelope<unknown>(LEGACY_LINKEDIN_KEY)
  const debriefEnvelope = readPersistedEnvelope<unknown>(LEGACY_DEBRIEF_KEY)
  const searchEnvelope = readPersistedEnvelope<unknown>(LEGACY_SEARCH_KEY)
  const uiEnvelope = readPersistedEnvelope<unknown>(LEGACY_RESUME_UI_KEY)

  const hasLegacyData = Boolean(
    resumeEnvelope ||
    pipelineEnvelope ||
    prepEnvelope ||
    coverLetterEnvelope ||
    linkedInEnvelope ||
    debriefEnvelope ||
    searchEnvelope ||
    uiEnvelope,
  )

  if (!hasLegacyData) {
    return false
  }

  const migratedResume = resumeEnvelope
    ? resumeMigration(
        (resumeEnvelope.state ?? {}) as Record<string, unknown>,
        resumeEnvelope.version ?? 0,
        readSyncStorageValue(LEGACY_RESUME_UI_KEY),
      )
    : normalizeResumeWorkspaceData(undefined)

  const migratedPipeline = pipelineEnvelope
    ? migratePipelineState(pipelineEnvelope.state)
    : { entries: [], sortField: 'tier', sortDir: 'asc' as const }
  const migratedJDAnalysis = migrateJDAnalysisState(undefined)

  const migratedPrep = migratePrepState(prepEnvelope?.state)
  const migratedLinkedIn = migrateLinkedInState(linkedInEnvelope?.state)
  const migratedDebrief = migrateDebriefState(debriefEnvelope?.state)
  const migratedSearch = migrateSearchState(searchEnvelope?.state)

  useResumeStore.setState({
    data: cloneValue(migratedResume.data ?? defaultResumeData),
    resumes: cloneValue(migratedResume.resumes ?? []),
    snapshots: cloneValue(migratedResume.snapshots ?? []),
    activeResumeId: migratedResume.activeResumeId ?? null,
    past: [],
    future: [],
    canUndo: false,
    canRedo: false,
  })

  usePipelineStore.setState((state) => ({
    ...state,
    entries: cloneValue(migratedPipeline.entries ?? []),
    sortField: migratedPipeline.sortField ?? 'tier',
    sortDir: migratedPipeline.sortDir ?? 'asc',
  }))

  useJDAnalysisStore.setState({
    analyses: cloneValue(migratedJDAnalysis.analyses),
  })

  usePrepStore.setState((state) => ({
    ...state,
    decks: cloneValue(migratedPrep.decks ?? []),
    activeDeckId: migratedPrep.activeDeckId ?? migratedPrep.decks?.[0]?.id ?? null,
  }))

  useLinkedInStore.setState((state) => ({
    ...state,
    drafts: cloneValue(migratedLinkedIn.drafts ?? []),
    selectedDraftId: migratedLinkedIn.selectedDraftId ?? migratedLinkedIn.drafts?.[0]?.id ?? null,
  }))

  useDebriefStore.setState((state) => ({
    ...state,
    sessions: cloneValue(migratedDebrief.sessions ?? []),
    selectedSessionId:
      migratedDebrief.selectedSessionId ?? migratedDebrief.sessions?.[0]?.id ?? null,
  }))

  const researchTheses = cloneValue(migratedSearch.theses ?? [])
  const activeThesisId =
    migratedSearch.activeThesisId &&
    researchTheses.some((thesis) => thesis.id === migratedSearch.activeThesisId)
      ? migratedSearch.activeThesisId
      : null

  useSearchStore.setState({
    profile: persistedResearchProfile(cloneValue(migratedSearch.profile ?? null)),
    requests: cloneValue(migratedSearch.requests ?? []),
    runs: cloneValue(migratedSearch.runs ?? []),
    theses: researchTheses,
    activeThesisId,
    feedbackEvents: cloneValue(migratedSearch.feedbackEvents ?? []),
    activeResearchJob: cloneValue(migratedSearch.activeResearchJob ?? null),
  })

  return true
}

export const getActiveWorkspaceIdFromStores = (): string => {
  const prepState = usePrepStore.getState()
  const firstDeckWorkspaceId = prepState.decks[0]?.durableMeta?.workspaceId
  return firstDeckWorkspaceId ?? DEFAULT_LOCAL_WORKSPACE_ID
}
