import { cloneValue } from './clone'
import type { FacetLocalPreferencesSnapshot, FacetWorkspaceSnapshot } from './contracts'
import type { PersistenceBackend } from './coordinator'
import type { LocalPreferencesBackend } from './localPreferences'
import { resolveStorage } from '../store/storage'

const FACET_PERSISTENCE_DB = 'facet-persistence'
const FACET_PERSISTENCE_DB_VERSION = 1
const WORKSPACE_STORE = 'workspaceSnapshots'
const LOCAL_PREFERENCES_STORE = 'localPreferences'
const LOCAL_WORKSPACE_KEY_PREFIX = 'facet-workspace-snapshot:'
let databasePromise: Promise<IDBDatabase> | null = null

const indexedDbAvailable = () => typeof globalThis.indexedDB !== 'undefined'

const openDatabase = (): Promise<IDBDatabase> => {
  if (databasePromise) {
    return databasePromise
  }

  if (!indexedDbAvailable()) {
    return Promise.reject(new Error('IndexedDB is not available in this environment.'))
  }

  databasePromise = new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(
      FACET_PERSISTENCE_DB,
      FACET_PERSISTENCE_DB_VERSION,
    )

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(WORKSPACE_STORE)) {
        db.createObjectStore(WORKSPACE_STORE)
      }
      if (!db.objectStoreNames.contains(LOCAL_PREFERENCES_STORE)) {
        db.createObjectStore(LOCAL_PREFERENCES_STORE)
      }
    }

    request.onsuccess = () => {
      request.result.onversionchange = () => {
        request.result.close()
        databasePromise = null
      }
      resolve(request.result)
    }
    request.onerror = () => {
      databasePromise = null
      reject(request.error ?? new Error('Failed to open IndexedDB.'))
    }
  })

  return databasePromise
}

const withStore = async <T>(
  storeName: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> => {
  const db = await openDatabase()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode)
    const store = transaction.objectStore(storeName)
    const request = run(store)

    let result: T | undefined

    if (request) {
      request.onsuccess = () => {
        result = request.result
      }
      request.onerror = () => {
        reject(request.error ?? new Error(`IndexedDB request failed for ${storeName}.`))
      }
    }

    transaction.oncomplete = () => {
      resolve(result)
    }
    transaction.onerror = () => {
      reject(transaction.error ?? new Error(`IndexedDB transaction failed for ${storeName}.`))
    }
    transaction.onabort = () => {
      reject(transaction.error ?? new Error(`IndexedDB transaction aborted for ${storeName}.`))
    }
  })
}

const createAuthoritativeWorkspaceSnapshot = (
  snapshot: FacetWorkspaceSnapshot,
  current: FacetWorkspaceSnapshot | null,
  savedAt = new Date().toISOString(),
): FacetWorkspaceSnapshot => ({
  ...cloneValue(snapshot),
  workspace: {
    ...cloneValue(snapshot.workspace),
    revision: (current?.workspace.revision ?? 0) + 1,
    updatedAt: savedAt,
  },
  artifacts: {
    resume: {
      ...cloneValue(snapshot.artifacts.resume),
      revision: (current?.artifacts.resume.revision ?? 0) + 1,
      updatedAt: savedAt,
    },
    pipeline: {
      ...cloneValue(snapshot.artifacts.pipeline),
      revision: (current?.artifacts.pipeline.revision ?? 0) + 1,
      updatedAt: savedAt,
    },
    jdAnalysis: {
      ...cloneValue(snapshot.artifacts.jdAnalysis),
      revision: (current?.artifacts.jdAnalysis?.revision ?? 0) + 1,
      updatedAt: savedAt,
    },
    prep: {
      ...cloneValue(snapshot.artifacts.prep),
      revision: (current?.artifacts.prep.revision ?? 0) + 1,
      updatedAt: savedAt,
    },
    coverLetters: {
      ...cloneValue(snapshot.artifacts.coverLetters),
      revision: (current?.artifacts.coverLetters.revision ?? 0) + 1,
      updatedAt: savedAt,
    },
    linkedin: {
      ...cloneValue(snapshot.artifacts.linkedin),
      revision: (current?.artifacts.linkedin?.revision ?? 0) + 1,
      updatedAt: savedAt,
    },
    recruiter: {
      ...cloneValue(snapshot.artifacts.recruiter),
      revision: (current?.artifacts.recruiter?.revision ?? 0) + 1,
      updatedAt: savedAt,
    },
    debrief: {
      ...cloneValue(snapshot.artifacts.debrief),
      revision: (current?.artifacts.debrief?.revision ?? 0) + 1,
      updatedAt: savedAt,
    },
    research: {
      ...cloneValue(snapshot.artifacts.research),
      revision: (current?.artifacts.research.revision ?? 0) + 1,
      updatedAt: savedAt,
    },
  },
  exportedAt: savedAt,
})

export const createIndexedDbPersistenceBackend = (): PersistenceBackend => ({
  kind: 'indexeddb',
  loadWorkspaceSnapshot: async (workspaceId) => {
    const result = await withStore<FacetWorkspaceSnapshot | undefined>(
      WORKSPACE_STORE,
      'readonly',
      (store) => store.get(workspaceId),
    )
    return result ? cloneValue(result) : null
  },
  saveWorkspaceSnapshot: async (snapshot) => {
    const current = (await withStore<FacetWorkspaceSnapshot | undefined>(
      WORKSPACE_STORE,
      'readonly',
      (store) => store.get(snapshot.workspace.id),
    )) ?? null
    const saved = createAuthoritativeWorkspaceSnapshot(snapshot, current)
    await withStore(
      WORKSPACE_STORE,
      'readwrite',
      (store) => store.put(saved, snapshot.workspace.id),
    )
    return cloneValue(saved)
  },
  deleteWorkspaceSnapshot: async (workspaceId) => {
    await withStore(WORKSPACE_STORE, 'readwrite', (store) => store.delete(workspaceId))
  },
})

export const createIndexedDbLocalPreferencesBackend = (): LocalPreferencesBackend => ({
  kind: 'indexeddb',
  loadLocalPreferencesSnapshot: async (workspaceId) => {
    const result = await withStore<FacetLocalPreferencesSnapshot | undefined>(
      LOCAL_PREFERENCES_STORE,
      'readonly',
      (store) => store.get(workspaceId),
    )
    return result ? cloneValue(result) : null
  },
  saveLocalPreferencesSnapshot: async (snapshot) => {
    await withStore(
      LOCAL_PREFERENCES_STORE,
      'readwrite',
      (store) => store.put(snapshot, snapshot.workspaceId),
    )
    return cloneValue(snapshot)
  },
  deleteLocalPreferencesSnapshot: async (workspaceId) => {
    await withStore(
      LOCAL_PREFERENCES_STORE,
      'readwrite',
      (store) => store.delete(workspaceId),
    )
  },
})

export const createLocalStorageWorkspacePersistenceBackend = (): PersistenceBackend => ({
  kind: 'localStorage',
  loadWorkspaceSnapshot: (workspaceId) => {
    const raw = resolveStorage().getItem(`${LOCAL_WORKSPACE_KEY_PREFIX}${workspaceId}`)
    if (typeof raw !== 'string') {
      return null
    }

    try {
      return JSON.parse(raw) as FacetWorkspaceSnapshot
    } catch {
      return null
    }
  },
  saveWorkspaceSnapshot: (snapshot) => {
    const currentRaw = resolveStorage().getItem(
      `${LOCAL_WORKSPACE_KEY_PREFIX}${snapshot.workspace.id}`,
    )
    const current =
      typeof currentRaw === 'string'
        ? (() => {
            try {
              return JSON.parse(currentRaw) as FacetWorkspaceSnapshot
            } catch {
              return null
            }
          })()
        : null
    const saved = createAuthoritativeWorkspaceSnapshot(snapshot, current)
    resolveStorage().setItem(
      `${LOCAL_WORKSPACE_KEY_PREFIX}${snapshot.workspace.id}`,
      JSON.stringify(saved),
    )
    return cloneValue(saved)
  },
  deleteWorkspaceSnapshot: (workspaceId) => {
    resolveStorage().removeItem(`${LOCAL_WORKSPACE_KEY_PREFIX}${workspaceId}`)
  },
})

export const createDefaultWorkspacePersistenceBackend = (): PersistenceBackend => {
  if (indexedDbAvailable()) {
    return createIndexedDbPersistenceBackend()
  }

  return createLocalStorageWorkspacePersistenceBackend()
}
