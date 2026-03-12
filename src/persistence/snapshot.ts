import { useCoverLetterStore } from '../store/coverLetterStore'
import { usePipelineStore } from '../store/pipelineStore'
import { usePrepStore } from '../store/prepStore'
import { useResumeStore } from '../store/resumeStore'
import { useSearchStore } from '../store/searchStore'
import { useUiStore } from '../store/uiStore'
import { cloneValue } from './clone'
import type {
  FacetArtifactSnapshot,
  FacetArtifactType,
  FacetLocalPreferencesSnapshot,
  FacetWorkspaceSnapshot,
} from './contracts'
import {
  DEFAULT_LOCAL_WORKSPACE_ID,
  DEFAULT_LOCAL_WORKSPACE_NAME,
  FACET_LOCAL_PREFERENCES_VERSION,
  FACET_WORKSPACE_SNAPSHOT_VERSION,
} from './contracts'
import type { PersistenceSnapshotRequest } from './coordinator'

export interface PersistenceBoundaryDefinition {
  source: string
  target: string
  durability: 'durable' | 'local-only'
  notes: string
}

export interface LegacyPersistenceSource {
  storageKey: string
  source: string
  target: string
  durability: 'durable' | 'local-only'
  notes: string
}

// These arrays are declarative documentation kept in code so tests can catch
// drift between the persistence contract and the migration plan.
export const DURABLE_PERSISTENCE_BOUNDARIES: PersistenceBoundaryDefinition[] = [
  {
    source: 'resumeStore.data',
    target: 'workspace.artifacts.resume.payload',
    durability: 'durable',
    notes: 'Resume content and presets travel with the workspace snapshot.',
  },
  {
    source: 'pipelineStore.entries',
    target: 'workspace.artifacts.pipeline.payload.entries',
    durability: 'durable',
    notes: 'Job-search records should be portable across devices and future backends.',
  },
  {
    source: 'prepStore.decks',
    target: 'workspace.artifacts.prep.payload.decks',
    durability: 'durable',
    notes: 'Prep decks and cards are workspace content, not device-local view state.',
  },
  {
    source: 'coverLetterStore.templates',
    target: 'workspace.artifacts.coverLetters.payload.templates',
    durability: 'durable',
    notes: 'Cover letter templates should round-trip through export, import, and future sync.',
  },
  {
    source: 'searchStore.profile,requests,runs',
    target: 'workspace.artifacts.research.payload',
    durability: 'durable',
    notes: 'Research profiles and runs are part of durable workspace history.',
  },
]

export const LOCAL_ONLY_PERSISTENCE_BOUNDARIES: PersistenceBoundaryDefinition[] = [
  {
    source:
      'uiStore.selectedVector,panelRatio,appearance,viewMode,showHeatmap,showDesignHealth,suggestionModeActive,backupRemindersEnabled,backupReminderIntervalDays,backupReminderSnoozedUntil,lastBackupAt,tourCompleted',
    target: 'localPreferences.ui',
    durability: 'local-only',
    notes: 'Device-local UI preferences should not become multi-tenant synced artifacts.',
  },
  {
    source: 'uiStore.comparisonVector',
    target: 'excluded',
    durability: 'local-only',
    notes: 'The current UI store already treats comparisonVector as transient and non-persisted.',
  },
  {
    source: 'pipelineStore.sortField,sortDir',
    target: 'localPreferences.pipeline',
    durability: 'local-only',
    notes: 'List sorting is a local presentation choice rather than shared workspace data.',
  },
  {
    source: 'prepStore.activeDeckId',
    target: 'localPreferences.prep',
    durability: 'local-only',
    notes: 'The currently open prep deck is a session preference, not durable content.',
  },
]

export const LEGACY_PERSISTENCE_MIGRATION_PLAN: LegacyPersistenceSource[] = [
  {
    storageKey: 'vector-resume-data',
    source: 'resumeStore persist payload',
    target: 'workspace.artifacts.resume.payload',
    durability: 'durable',
    notes: 'Existing resume migrations continue to run before data is normalized into the unified snapshot.',
  },
  {
    storageKey: 'facet-pipeline-data',
    source: 'pipelineStore persist payload',
    target: 'workspace.artifacts.pipeline.payload.entries plus localPreferences.pipeline',
    durability: 'durable',
    notes: 'Entries remain durable while sort preferences move to local-only preferences.',
  },
  {
    storageKey: 'facet-prep-workspace',
    source: 'prepStore persist payload',
    target: 'workspace.artifacts.prep.payload.decks plus localPreferences.prep',
    durability: 'durable',
    notes: 'Deck content is durable; activeDeckId becomes a local preference during migration.',
  },
  {
    storageKey: 'facet-prep-data',
    source: 'legacy prep import payload',
    target: 'workspace.artifacts.prep.payload.decks',
    durability: 'durable',
    notes: 'Legacy prep imports should still hydrate into the durable prep artifact.',
  },
  {
    storageKey: 'facet-cover-letter-data',
    source: 'coverLetterStore persist payload',
    target: 'workspace.artifacts.coverLetters.payload.templates',
    durability: 'durable',
    notes: 'Cover letter templates map directly into the workspace snapshot.',
  },
  {
    storageKey: 'facet-search-data',
    source: 'searchStore persist payload',
    target: 'workspace.artifacts.research.payload',
    durability: 'durable',
    notes: 'Research profile, requests, and runs stay together as one durable artifact.',
  },
  {
    storageKey: 'vector-resume-ui',
    source: 'uiStore persist payload',
    target: 'localPreferences.ui',
    durability: 'local-only',
    notes: 'UI preferences should migrate separately from the multi-tenant workspace snapshot.',
  },
]

const buildArtifactSnapshot = <TType extends FacetArtifactType, TPayload>(
  artifactType: TType,
  workspaceId: string,
  payload: TPayload,
  exportedAt: string,
): FacetArtifactSnapshot<TType, TPayload> => ({
  artifactId: `${workspaceId}:${artifactType}`,
  artifactType,
  workspaceId,
  schemaVersion: 1,
  revision: 0,
  updatedAt: exportedAt,
  payload,
})

export const createWorkspaceSnapshotFromStores = (
  request: PersistenceSnapshotRequest = {},
): FacetWorkspaceSnapshot => {
  const exportedAt = request.exportedAt ?? new Date().toISOString()
  const workspaceId = request.workspaceId ?? DEFAULT_LOCAL_WORKSPACE_ID
  const workspaceName = request.workspaceName ?? DEFAULT_LOCAL_WORKSPACE_NAME

  const pipelineState = usePipelineStore.getState()
  const prepState = usePrepStore.getState()
  const searchState = useSearchStore.getState()

  return {
    snapshotVersion: FACET_WORKSPACE_SNAPSHOT_VERSION,
    tenantId: request.tenantId ?? null,
    userId: request.userId ?? null,
    workspace: {
      id: workspaceId,
      name: workspaceName,
      revision: 0,
      updatedAt: exportedAt,
    },
    artifacts: {
      resume: buildArtifactSnapshot(
        'resume',
        workspaceId,
        cloneValue(useResumeStore.getState().data),
        exportedAt,
      ),
      pipeline: buildArtifactSnapshot(
        'pipeline',
        workspaceId,
        {
          entries: cloneValue(pipelineState.entries),
        },
        exportedAt,
      ),
      prep: buildArtifactSnapshot(
        'prep',
        workspaceId,
        {
          decks: cloneValue(prepState.decks),
        },
        exportedAt,
      ),
      coverLetters: buildArtifactSnapshot(
        'coverLetters',
        workspaceId,
        {
          templates: cloneValue(useCoverLetterStore.getState().templates),
        },
        exportedAt,
      ),
      research: buildArtifactSnapshot(
        'research',
        workspaceId,
        {
          profile: cloneValue(searchState.profile),
          requests: cloneValue(searchState.requests),
          runs: cloneValue(searchState.runs),
        },
        exportedAt,
      ),
    },
    exportedAt,
  }
}

export const createLocalPreferencesSnapshotFromStores = (
  workspaceId = DEFAULT_LOCAL_WORKSPACE_ID,
  exportedAt = new Date().toISOString(),
): FacetLocalPreferencesSnapshot => {
  const uiState = useUiStore.getState()
  const pipelineState = usePipelineStore.getState()
  const prepState = usePrepStore.getState()

  return {
    snapshotVersion: FACET_LOCAL_PREFERENCES_VERSION,
    workspaceId,
    ui: {
      selectedVector: uiState.selectedVector,
      panelRatio: uiState.panelRatio,
      appearance: uiState.appearance,
      viewMode: uiState.viewMode,
      showHeatmap: uiState.showHeatmap,
      showDesignHealth: uiState.showDesignHealth,
      suggestionModeActive: uiState.suggestionModeActive,
      backupRemindersEnabled: uiState.backupRemindersEnabled,
      backupReminderIntervalDays: uiState.backupReminderIntervalDays,
      backupReminderSnoozedUntil: uiState.backupReminderSnoozedUntil,
      lastBackupAt: uiState.lastBackupAt,
      tourCompleted: uiState.tourCompleted,
    },
    pipeline: {
      sortField: pipelineState.sortField,
      sortDir: pipelineState.sortDir,
    },
    prep: {
      activeDeckId: prepState.activeDeckId,
    },
    exportedAt,
  }
}
