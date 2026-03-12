import { defaultResumeData } from '../store/defaultData'
import {
  migrateCoverLetterState,
  useCoverLetterStore,
} from '../store/coverLetterStore'
import {
  migratePipelineState,
  usePipelineStore,
} from '../store/pipelineStore'
import {
  migratePrepState,
  usePrepStore,
} from '../store/prepStore'
import {
  resumeMigration,
  useResumeStore,
} from '../store/resumeStore'
import {
  migrateSearchState,
  useSearchStore,
} from '../store/searchStore'
import { resolveStorage } from '../store/storage'
import { useUiStore } from '../store/uiStore'
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
const LEGACY_SEARCH_KEY = 'facet-search-data'

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
  useResumeStore.setState({
    data: cloneValue(snapshot.artifacts.resume.payload),
    past: [],
    future: [],
    canUndo: false,
    canRedo: false,
  })

  usePipelineStore.setState((state) => ({
    ...state,
    entries: cloneValue(snapshot.artifacts.pipeline.payload.entries),
  }))

  const prepDecks = cloneValue(snapshot.artifacts.prep.payload.decks)
  usePrepStore.setState((state) => ({
    ...state,
    decks: prepDecks,
    activeDeckId:
      prepDecks.find((deck) => deck.id === state.activeDeckId)?.id ??
      prepDecks[0]?.id ??
      null,
  }))

  useCoverLetterStore.setState({
    templates: cloneValue(snapshot.artifacts.coverLetters.payload.templates),
  })

  useSearchStore.setState({
    profile: cloneValue(snapshot.artifacts.research.payload.profile),
    requests: cloneValue(snapshot.artifacts.research.payload.requests),
    runs: cloneValue(snapshot.artifacts.research.payload.runs),
  })
}

export const applyLocalPreferencesSnapshotToStores = (
  snapshot: FacetLocalPreferencesSnapshot,
) => {
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
  }))
}

export const hydrateStoresFromLegacyStorage = (): boolean => {
  const resumeEnvelope = readPersistedEnvelope<unknown>(LEGACY_RESUME_KEY)
  const pipelineEnvelope = readPersistedEnvelope<unknown>(LEGACY_PIPELINE_KEY)
  const prepEnvelope = readPersistedEnvelope<unknown>(LEGACY_PREP_KEY)
  const coverLetterEnvelope = readPersistedEnvelope<unknown>(LEGACY_COVER_LETTER_KEY)
  const searchEnvelope = readPersistedEnvelope<unknown>(LEGACY_SEARCH_KEY)
  const uiEnvelope = readPersistedEnvelope<unknown>(LEGACY_RESUME_UI_KEY)

  const hasLegacyData = Boolean(
    resumeEnvelope ||
      pipelineEnvelope ||
      prepEnvelope ||
      coverLetterEnvelope ||
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
    : { data: defaultResumeData }

  const migratedPipeline = pipelineEnvelope
    ? migratePipelineState(pipelineEnvelope.state)
    : { entries: [], sortField: 'tier', sortDir: 'asc' as const }

  const migratedPrep = migratePrepState(prepEnvelope?.state)
  const migratedCoverLetters = migrateCoverLetterState(coverLetterEnvelope?.state)
  const migratedSearch = migrateSearchState(searchEnvelope?.state)

  useResumeStore.setState({
    data: cloneValue(migratedResume.data ?? defaultResumeData),
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

  usePrepStore.setState((state) => ({
    ...state,
    decks: cloneValue(migratedPrep.decks ?? []),
    activeDeckId:
      migratedPrep.activeDeckId ??
      migratedPrep.decks?.[0]?.id ??
      null,
  }))

  useCoverLetterStore.setState({
    templates: cloneValue(migratedCoverLetters.templates ?? []),
  })

  useSearchStore.setState({
    profile: cloneValue(migratedSearch.profile ?? null),
    requests: cloneValue(migratedSearch.requests ?? []),
    runs: cloneValue(migratedSearch.runs ?? []),
  })

  return true
}

export const getActiveWorkspaceIdFromStores = (): string => {
  const prepState = usePrepStore.getState()
  const firstDeckWorkspaceId = prepState.decks[0]?.durableMeta?.workspaceId
  return firstDeckWorkspaceId ?? DEFAULT_LOCAL_WORKSPACE_ID
}
