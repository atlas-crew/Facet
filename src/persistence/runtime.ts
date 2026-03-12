import { create } from 'zustand'
import { useCoverLetterStore } from '../store/coverLetterStore'
import { usePipelineStore } from '../store/pipelineStore'
import { usePrepStore } from '../store/prepStore'
import { useResumeStore } from '../store/resumeStore'
import { useSearchStore } from '../store/searchStore'
import { useUiStore } from '../store/uiStore'
import { DEFAULT_LOCAL_WORKSPACE_ID, DEFAULT_LOCAL_WORKSPACE_NAME } from './contracts'
import {
  createPersistenceCoordinator,
  type PersistenceBackend,
  type PersistenceImportOptions,
  type PersistenceStatus,
} from './coordinator'
import {
  applyLocalPreferencesSnapshotToStores,
  applyWorkspaceSnapshotToStores,
  hydrateStoresFromLegacyStorage,
} from './hydration'
import {
  createDefaultWorkspacePersistenceBackend,
  createIndexedDbLocalPreferencesBackend,
} from './indexedDb'
import {
  createLocalStorageLocalPreferencesBackend,
  type LocalPreferencesBackend,
} from './localPreferences'
import {
  createLocalPreferencesSnapshotFromStores,
  createWorkspaceSnapshotFromStores,
} from './snapshot'
import type { FacetWorkspaceSnapshot } from './contracts'
import {
  mergeWorkspaceSnapshots,
  scopeWorkspaceSnapshotToWorkspace,
} from './workspaceImportMerge'

const DEFAULT_SAVE_DEBOUNCE_MS = 150

export interface PersistenceRuntimeState {
  hydrated: boolean
  usingLegacyMigration: boolean
  status: PersistenceStatus
}

const defaultStatus = (backend: PersistenceBackend['kind']): PersistenceStatus => ({
  phase: 'idle',
  backend,
  activeWorkspaceId: DEFAULT_LOCAL_WORKSPACE_ID,
  lastHydratedAt: null,
  lastSavedAt: null,
  lastError: null,
})

export const usePersistenceRuntimeStore = create<PersistenceRuntimeState>(() => ({
  hydrated: false,
  usingLegacyMigration: false,
  status: defaultStatus('memory'),
}))

export interface PersistenceRuntimeOptions {
  workspaceId?: string
  workspaceName?: string
  saveDebounceMs?: number
  backend?: PersistenceBackend
  localPreferencesBackend?: LocalPreferencesBackend
}

export interface PersistenceRuntime {
  start: () => Promise<void>
  flush: () => Promise<void>
  exportWorkspaceSnapshot: () => Promise<FacetWorkspaceSnapshot>
  importWorkspaceSnapshot: (
    snapshot: FacetWorkspaceSnapshot,
    options?: PersistenceImportOptions,
  ) => Promise<FacetWorkspaceSnapshot>
  dispose: () => void
}

const createDefaultLocalPreferencesBackend = (): LocalPreferencesBackend => {
  if (typeof globalThis.indexedDB !== 'undefined') {
    return createIndexedDbLocalPreferencesBackend()
  }

  return createLocalStorageLocalPreferencesBackend()
}

export const createPersistenceRuntime = (
  options: PersistenceRuntimeOptions = {},
): PersistenceRuntime => {
  const workspaceId = options.workspaceId ?? DEFAULT_LOCAL_WORKSPACE_ID
  const workspaceName = options.workspaceName ?? DEFAULT_LOCAL_WORKSPACE_NAME
  const backend = options.backend ?? createDefaultWorkspacePersistenceBackend()
  const localPreferencesBackend =
    options.localPreferencesBackend ?? createDefaultLocalPreferencesBackend()
  const coordinator = createPersistenceCoordinator({
    backend,
    readWorkspaceSnapshot: createWorkspaceSnapshotFromStores,
    mergeImportedSnapshot: mergeWorkspaceSnapshots,
  })

  let started = false
  let starting: Promise<void> | null = null
  let disposed = false
  let suppressSaves = false
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  let subscriptions: Array<() => void> = []
  let activePersistenceWrite: Promise<unknown> | null = null

  const syncRuntimeState = (patch: Partial<PersistenceRuntimeState>) => {
    usePersistenceRuntimeStore.setState((state) => ({
      ...state,
      ...patch,
    }))
  }

  const syncStatusFromCoordinator = () => {
    syncRuntimeState({
      status: coordinator.getStatus(),
    })
  }

  const clearSaveTimer = () => {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
  }

  const persistCurrentState = async () => {
    if (disposed) {
      return
    }

    clearSaveTimer()

    const writePromise = (async () => {
      const currentSnapshot = await coordinator.exportWorkspaceSnapshot({
        workspaceId,
        workspaceName,
      })
      if (disposed) {
        return
      }
      // Saving reuses the coordinator's validation and status flow but does not
      // rehydrate Zustand stores; store writes continue to flow one-way into the
      // persistence runtime.
      await coordinator.importWorkspaceSnapshot(currentSnapshot, { mode: 'replace' })
      if (disposed) {
        return
      }
      syncStatusFromCoordinator()

      if (disposed) {
        return
      }
      await localPreferencesBackend.saveLocalPreferencesSnapshot(
        createLocalPreferencesSnapshotFromStores(workspaceId),
      )
    })()

    activePersistenceWrite = writePromise

    try {
      await writePromise
    } finally {
      if (activePersistenceWrite === writePromise) {
        activePersistenceWrite = null
      }
    }
  }

  const schedulePersist = () => {
    if (!started || suppressSaves || disposed) {
      return
    }

    clearSaveTimer()
    saveTimer = setTimeout(() => {
      void persistCurrentState().catch((error) => {
        syncRuntimeState({
          status: {
            ...coordinator.getStatus(),
            phase: 'error',
            lastError:
              error instanceof Error ? error.message : 'Failed to persist workspace runtime',
          },
        })
      })
    }, options.saveDebounceMs ?? DEFAULT_SAVE_DEBOUNCE_MS)
  }

  const installSubscriptions = () => {
    subscriptions = [
      useResumeStore.subscribe(() => schedulePersist()),
      usePipelineStore.subscribe(() => schedulePersist()),
      usePrepStore.subscribe(() => schedulePersist()),
      useCoverLetterStore.subscribe(() => schedulePersist()),
      useSearchStore.subscribe(() => schedulePersist()),
      useUiStore.subscribe(() => schedulePersist()),
    ]
  }

  const runtime: PersistenceRuntime = {
    start: async () => {
      if (disposed) {
        return
      }

      if (started) {
        return
      }

      if (starting) {
        return starting
      }

      starting = (async () => {
        syncRuntimeState({
          hydrated: false,
          usingLegacyMigration: false,
          status: defaultStatus(backend.kind),
        })

        suppressSaves = true
        let usedLegacyMigration = false

        try {
          const { snapshot } = await coordinator.bootstrap(workspaceId)
          if (disposed) {
            return
          }

          syncStatusFromCoordinator()

          if (snapshot) {
            applyWorkspaceSnapshotToStores(snapshot)
            const localPreferences =
              await localPreferencesBackend.loadLocalPreferencesSnapshot(workspaceId)
            if (localPreferences) {
              applyLocalPreferencesSnapshotToStores(localPreferences)
            }
          } else {
            usedLegacyMigration = hydrateStoresFromLegacyStorage()
            if (usedLegacyMigration) {
              await persistCurrentState()
            }
          }

          if (disposed) {
            return
          }

          started = true
          installSubscriptions()
          syncRuntimeState({
            hydrated: true,
            usingLegacyMigration: usedLegacyMigration,
            status: coordinator.getStatus(),
          })
        } catch (error) {
          if (disposed) {
            return
          }

          syncRuntimeState({
            hydrated: true,
            status: {
              ...coordinator.getStatus(),
              phase: 'error',
              lastError:
                error instanceof Error ? error.message : 'Failed to bootstrap persistence runtime',
            },
          })
          throw error
        } finally {
          suppressSaves = false
          starting = null
        }
      })()

      return starting
    },

    flush: async () => {
      await (starting ?? (started ? Promise.resolve() : runtime.start()))
      await persistCurrentState()
    },

    exportWorkspaceSnapshot: async () =>
      coordinator.exportWorkspaceSnapshot({
        workspaceId,
        workspaceName,
      }),

    importWorkspaceSnapshot: async (snapshot, options = { mode: 'replace' }) => {
      clearSaveTimer()
      await (starting ?? (started ? Promise.resolve() : runtime.start()))

      suppressSaves = true
      try {
        if (activePersistenceWrite) {
          await activePersistenceWrite.catch(() => undefined)
        }

        const scopedSnapshot = scopeWorkspaceSnapshotToWorkspace(
          snapshot,
          workspaceId,
          workspaceName,
        )
        const savedSnapshot = await coordinator.importWorkspaceSnapshot(scopedSnapshot, options)
        applyWorkspaceSnapshotToStores(savedSnapshot)
        await localPreferencesBackend.saveLocalPreferencesSnapshot(
          createLocalPreferencesSnapshotFromStores(workspaceId),
        )
        syncRuntimeState({
          hydrated: true,
          usingLegacyMigration: false,
          status: coordinator.getStatus(),
        })
        return savedSnapshot
      } finally {
        suppressSaves = false
      }
    },

    dispose: () => {
      disposed = true
      clearSaveTimer()
      subscriptions.forEach((unsubscribe) => unsubscribe())
      subscriptions = []
      started = false
      starting = null
      syncRuntimeState({
        hydrated: false,
        usingLegacyMigration: false,
        status: defaultStatus(backend.kind),
      })
      if (runtimeSingleton === runtime) {
        runtimeSingleton = null
      }
    },
  }

  return runtime
}

let runtimeSingleton: PersistenceRuntime | null = null

export const getPersistenceRuntime = (): PersistenceRuntime => {
  if (!runtimeSingleton) {
    runtimeSingleton = createPersistenceRuntime()
  }

  return runtimeSingleton
}
