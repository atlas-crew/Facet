// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { waitFor } from '@testing-library/react'
import { useCoverLetterStore } from '../store/coverLetterStore'
import { defaultResumeData } from '../store/defaultData'
import { usePipelineStore } from '../store/pipelineStore'
import { usePrepStore } from '../store/prepStore'
import { useResumeStore } from '../store/resumeStore'
import { useSearchStore } from '../store/searchStore'
import { resolveStorage } from '../store/storage'
import { useUiStore } from '../store/uiStore'
import {
  type PersistenceBackend,
  createInMemoryPersistenceBackend,
} from '../persistence/coordinator'
import {
  type FacetWorkspaceSnapshot,
  type FacetLocalPreferencesSnapshot,
} from '../persistence/contracts'
import {
  createInMemoryLocalPreferencesBackend,
} from '../persistence/localPreferences'
import {
  createPersistenceRuntime,
  getPersistenceRuntime,
  usePersistenceRuntimeStore,
} from '../persistence/runtime'
import { buildWorkspaceSnapshot } from './fixtures/workspaceSnapshot'

const LEGACY_KEYS = [
  'vector-resume-data',
  'vector-resume-ui',
  'facet-pipeline-data',
  'facet-prep-workspace',
  'facet-prep-data',
  'facet-cover-letter-data',
  'facet-search-data',
]

const clearLegacyStorage = () => {
  const storage = resolveStorage()
  for (const key of LEGACY_KEYS) {
    storage.removeItem(key)
  }
}

const localPreferencesSnapshot: FacetLocalPreferencesSnapshot = {
  snapshotVersion: 1,
  workspaceId: 'ws-1',
  ui: {
    selectedVector: 'backend',
    panelRatio: 0.62,
    appearance: 'dark',
    viewMode: 'live',
    showHeatmap: true,
    showDesignHealth: true,
    suggestionModeActive: true,
    backupRemindersEnabled: true,
    backupReminderIntervalDays: 7,
    backupReminderSnoozedUntil: '2026-03-18T12:00:00.000Z',
    lastBackupAt: '2026-03-10T12:00:00.000Z',
    tourCompleted: true,
  },
  pipeline: {
    sortField: 'company',
    sortDir: 'desc',
  },
  prep: {
    activeDeckId: 'deck-1',
  },
  exportedAt: '2026-03-11T12:00:00.000Z',
}

describe('persistence runtime', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    getPersistenceRuntime().dispose()
  })

  beforeEach(() => {
    clearLegacyStorage()

    useResumeStore.setState({
      data: defaultResumeData,
      past: [],
      future: [],
      canUndo: false,
      canRedo: false,
    })
    usePipelineStore.setState({
      entries: [],
      sortField: 'tier',
      sortDir: 'asc',
      filters: { tier: 'all', status: 'all', search: '' },
    })
    usePrepStore.setState({
      decks: [],
      activeDeckId: null,
    })
    useCoverLetterStore.setState({
      templates: [],
    })
    useSearchStore.setState({
      profile: null,
      requests: [],
      runs: [],
    })
    useUiStore.setState({
      selectedVector: 'all',
      panelRatio: 0.45,
      appearance: 'system',
      viewMode: 'pdf',
      showHeatmap: false,
      showDesignHealth: false,
      suggestionModeActive: false,
      comparisonVector: null,
      backupRemindersEnabled: true,
      backupReminderIntervalDays: 7,
      backupReminderSnoozedUntil: null,
      lastBackupAt: null,
      tourCompleted: false,
    })
    usePersistenceRuntimeStore.setState({
      hydrated: false,
      usingLegacyMigration: false,
      status: {
        phase: 'idle',
        backend: 'memory',
        activeWorkspaceId: 'facet-local-workspace',
        lastHydratedAt: null,
        lastSavedAt: null,
        lastError: null,
      },
    })
    clearLegacyStorage()
  })

  const createWorkspaceBackendSpy = () => {
    const backing = createInMemoryPersistenceBackend()
    let saveCalls = 0

    const backend: PersistenceBackend = {
      ...backing,
      saveWorkspaceSnapshot: async (snapshot) => {
        saveCalls += 1
        return backing.saveWorkspaceSnapshot(snapshot)
      },
    }

    return {
      backend,
      backing,
      getSaveCalls: () => saveCalls,
    }
  }

  it('hydrates durable and local preferences from unified persistence backends', async () => {
    const workspaceBackend = createInMemoryPersistenceBackend()
    const preferencesBackend = createInMemoryLocalPreferencesBackend()
    const snapshot = buildWorkspaceSnapshot({
      workspace: {
        id: 'ws-1',
        name: 'Workspace One',
        revision: 2,
        updatedAt: '2026-03-11T12:00:00.000Z',
      },
      artifacts: {
        ...buildWorkspaceSnapshot().artifacts,
        pipeline: {
          ...buildWorkspaceSnapshot().artifacts.pipeline,
          payload: {
            entries: [
              {
                id: 'pipe-1',
                company: 'Acme',
                role: 'Staff Engineer',
                tier: '1',
                status: 'screening',
                comp: '',
                url: '',
                contact: '',
                vectorId: 'backend',
                jobDescription: '',
                presetId: null,
                resumeVariant: 'default',
                positioning: '',
                skillMatch: '',
                nextStep: '',
                notes: '',
                appMethod: 'direct-apply',
                response: 'none',
                daysToResponse: null,
                rounds: null,
                format: [],
                rejectionStage: '',
                rejectionReason: '',
                offerAmount: '',
                dateApplied: '2026-03-11',
                dateClosed: '',
                lastAction: '2026-03-11',
                createdAt: '2026-03-11',
                history: [{ date: '2026-03-11', note: 'Created' }],
              },
            ],
          },
        },
        prep: {
          ...buildWorkspaceSnapshot().artifacts.prep,
          payload: {
            decks: [
              {
                id: 'deck-1',
                title: 'Interview Prep',
                company: 'Acme',
                role: 'Staff Engineer',
                vectorId: 'backend',
                pipelineEntryId: 'pipe-1',
                updatedAt: '2026-03-11T12:00:00.000Z',
                cards: [],
              },
            ],
          },
        },
      },
    })

    await workspaceBackend.saveWorkspaceSnapshot(snapshot)
    await preferencesBackend.saveLocalPreferencesSnapshot(localPreferencesSnapshot)

    const runtime = createPersistenceRuntime({
      workspaceId: 'ws-1',
      workspaceName: 'Workspace One',
      backend: workspaceBackend,
      localPreferencesBackend: preferencesBackend,
    })

    await runtime.start()

    expect(usePipelineStore.getState().entries).toHaveLength(1)
    expect(usePrepStore.getState().activeDeckId).toBe('deck-1')
    expect(useUiStore.getState().appearance).toBe('dark')
    expect(usePipelineStore.getState().sortField).toBe('company')
    expect(usePersistenceRuntimeStore.getState().hydrated).toBe(true)
    expect(usePersistenceRuntimeStore.getState().status.phase).toBe('ready')

    runtime.dispose()
  })

  it('hydrates an existing workspace without local preferences and avoids a bootstrap writeback', async () => {
    const baseSnapshot = buildWorkspaceSnapshot()
    const backing = createInMemoryPersistenceBackend()
    let saveCalls = 0
    const workspaceBackend: PersistenceBackend = {
      ...backing,
      saveWorkspaceSnapshot: async (snapshot) => {
        saveCalls += 1
        return backing.saveWorkspaceSnapshot(snapshot)
      },
    }

    await backing.saveWorkspaceSnapshot(
      buildWorkspaceSnapshot({
        workspace: {
          id: 'facet-local-workspace',
          name: 'Facet Local Workspace',
          revision: 2,
          updatedAt: '2026-03-11T12:00:00.000Z',
        },
        artifacts: {
          ...baseSnapshot.artifacts,
          resume: {
            ...baseSnapshot.artifacts.resume,
            workspaceId: 'facet-local-workspace',
            artifactId: 'facet-local-workspace:resume',
            payload: {
              ...baseSnapshot.artifacts.resume.payload,
              meta: {
                ...baseSnapshot.artifacts.resume.payload.meta,
                name: 'Hydrated Without Preferences',
              },
            },
          },
          pipeline: {
            ...baseSnapshot.artifacts.pipeline,
            workspaceId: 'facet-local-workspace',
            artifactId: 'facet-local-workspace:pipeline',
          },
          prep: {
            ...baseSnapshot.artifacts.prep,
            workspaceId: 'facet-local-workspace',
            artifactId: 'facet-local-workspace:prep',
            payload: {
              decks: [
                {
                  id: 'deck-1',
                  title: 'Prep Deck',
                  company: 'Acme',
                  role: 'Staff Engineer',
                  vectorId: 'backend',
                  pipelineEntryId: null,
                  updatedAt: '2026-03-11T12:00:00.000Z',
                  cards: [],
                },
              ],
            },
          },
          coverLetters: {
            ...baseSnapshot.artifacts.coverLetters,
            workspaceId: 'facet-local-workspace',
            artifactId: 'facet-local-workspace:coverLetters',
          },
          research: {
            ...baseSnapshot.artifacts.research,
            workspaceId: 'facet-local-workspace',
            artifactId: 'facet-local-workspace:research',
          },
        },
      }),
    )

    const runtime = createPersistenceRuntime({
      backend: workspaceBackend,
      localPreferencesBackend: createInMemoryLocalPreferencesBackend(),
    })

    await runtime.start()

    expect(useResumeStore.getState().data.meta.name).toBe('Hydrated Without Preferences')
    expect(usePrepStore.getState().activeDeckId).toBe('deck-1')
    expect(useUiStore.getState().appearance).toBe('system')
    expect(saveCalls).toBe(0)

    runtime.dispose()
  })

  it('starts cleanly against empty persistence backends without forcing legacy migration', async () => {
    const runtime = createPersistenceRuntime({
      backend: createInMemoryPersistenceBackend(),
      localPreferencesBackend: createInMemoryLocalPreferencesBackend(),
    })

    await runtime.start()

    expect(useResumeStore.getState().data).toEqual(defaultResumeData)
    expect(useUiStore.getState().appearance).toBe('system')
    expect(usePersistenceRuntimeStore.getState()).toMatchObject({
      hydrated: true,
      usingLegacyMigration: false,
    })

    runtime.dispose()
  })

  it('hydrates from legacy localStorage and persists forward into unified backends', async () => {
    const storage = resolveStorage()
    storage.setItem(
      'vector-resume-data',
      JSON.stringify({
        state: {
          data: {
            ...defaultResumeData,
            meta: { ...defaultResumeData.meta, name: 'Legacy Person' },
          },
        },
        version: 7,
      }),
    )
    storage.setItem(
      'facet-pipeline-data',
      JSON.stringify({
        state: {
          entries: [],
          sortField: 'company',
          sortDir: 'desc',
        },
        version: 2,
      }),
    )

    const workspaceBackend = createInMemoryPersistenceBackend()
    const preferencesBackend = createInMemoryLocalPreferencesBackend()
    const runtime = createPersistenceRuntime({
      backend: workspaceBackend,
      localPreferencesBackend: preferencesBackend,
    })

    await runtime.start()

    expect(useResumeStore.getState().data.meta.name).toBe('Legacy Person')
    expect(usePipelineStore.getState().sortField).toBe('company')
    expect(usePersistenceRuntimeStore.getState().usingLegacyMigration).toBe(true)

    const savedSnapshot = await workspaceBackend.loadWorkspaceSnapshot('facet-local-workspace')
    const savedPreferences =
      await preferencesBackend.loadLocalPreferencesSnapshot('facet-local-workspace')

    expect(savedSnapshot?.artifacts.resume.payload.meta.name).toBe('Legacy Person')
    expect(savedPreferences?.pipeline.sortField).toBe('company')

    runtime.dispose()
  })

  it('flushes through bootstrap when called before an explicit start', async () => {
    const workspaceBackend = createInMemoryPersistenceBackend()
    const baseSnapshot = buildWorkspaceSnapshot()
    const snapshot = buildWorkspaceSnapshot({
      workspace: {
        id: 'ws-1',
        name: 'Workspace One',
        revision: 1,
        updatedAt: '2026-03-11T12:00:00.000Z',
      },
      artifacts: {
        ...baseSnapshot.artifacts,
        resume: {
          ...baseSnapshot.artifacts.resume,
          payload: {
            ...baseSnapshot.artifacts.resume.payload,
            meta: {
              ...baseSnapshot.artifacts.resume.payload.meta,
              name: 'Hydrated Before Flush',
            },
          },
        },
      },
    })
    await workspaceBackend.saveWorkspaceSnapshot(snapshot)

    const runtime = createPersistenceRuntime({
      workspaceId: 'ws-1',
      workspaceName: 'Workspace One',
      backend: workspaceBackend,
      localPreferencesBackend: createInMemoryLocalPreferencesBackend(),
    })

    await runtime.flush()

    const savedSnapshot = await workspaceBackend.loadWorkspaceSnapshot('ws-1')

    expect(useResumeStore.getState().data.meta.name).toBe('Hydrated Before Flush')
    expect(savedSnapshot?.artifacts.resume.payload.meta.name).toBe('Hydrated Before Flush')
    expect(usePersistenceRuntimeStore.getState().hydrated).toBe(true)

    runtime.dispose()
  })

  it('falls back to the localStorage local-preferences backend when indexedDB is unavailable', async () => {
    vi.stubGlobal('indexedDB', undefined)

    const runtime = createPersistenceRuntime({
      backend: createInMemoryPersistenceBackend(),
    })

    await runtime.start()
    useUiStore.getState().setAppearance('dark')
    await runtime.flush()

    const savedPreferences = resolveStorage().getItem('facet-local-preferences:facet-local-workspace')
    expect(savedPreferences).toContain('"appearance":"dark"')

    runtime.dispose()
  })

  it('exports the live workspace snapshot directly without requiring runtime start', async () => {
    const runtime = createPersistenceRuntime({
      workspaceId: 'ws-7',
      workspaceName: 'Workspace Seven',
      backend: createInMemoryPersistenceBackend(),
      localPreferencesBackend: createInMemoryLocalPreferencesBackend(),
    })

    useResumeStore.getState().updateMetaField('name', 'Exported Directly')

    const snapshot = await runtime.exportWorkspaceSnapshot()

    expect(snapshot.workspace.id).toBe('ws-7')
    expect(snapshot.workspace.name).toBe('Workspace Seven')
    expect(snapshot.artifacts.resume.payload.meta.name).toBe('Exported Directly')
    expect(usePersistenceRuntimeStore.getState().hydrated).toBe(false)

    runtime.dispose()
  })

  it('flushes store changes through the shared runtime and updates status', async () => {
    const workspaceBackend = createInMemoryPersistenceBackend()
    const preferencesBackend = createInMemoryLocalPreferencesBackend()
    const runtime = createPersistenceRuntime({
      backend: workspaceBackend,
      localPreferencesBackend: preferencesBackend,
    })

    await runtime.start()

    useResumeStore.getState().updateMetaField('name', 'Runtime Save')
    useUiStore.getState().setAppearance('dark')
    await runtime.flush()

    const savedSnapshot = await workspaceBackend.loadWorkspaceSnapshot('facet-local-workspace')
    const savedPreferences =
      await preferencesBackend.loadLocalPreferencesSnapshot('facet-local-workspace')

    expect(savedSnapshot?.artifacts.resume.payload.meta.name).toBe('Runtime Save')
    expect(savedPreferences?.ui.appearance).toBe('dark')
    expect(usePersistenceRuntimeStore.getState().status.phase).toBe('saved')

    runtime.dispose()
  })

  it('starts idempotently and stops autosave subscriptions after dispose', async () => {
    const backing = createInMemoryPersistenceBackend()
    let loadCalls = 0
    const backend: PersistenceBackend = {
      ...backing,
      loadWorkspaceSnapshot: async (workspaceId) => {
        loadCalls += 1
        return backing.loadWorkspaceSnapshot(workspaceId)
      },
    }
    const preferencesBackend = createInMemoryLocalPreferencesBackend()
    const runtime = createPersistenceRuntime({
      backend,
      localPreferencesBackend: preferencesBackend,
      saveDebounceMs: 10,
    })

    await Promise.all([runtime.start(), runtime.start()])
    expect(loadCalls).toBe(1)

    const snapshotBeforeDispose = await backing.loadWorkspaceSnapshot('facet-local-workspace')
    runtime.dispose()
    useResumeStore.getState().updateMetaField('name', 'After Dispose')
    await new Promise((resolve) => setTimeout(resolve, 25))

    const savedSnapshot = await backing.loadWorkspaceSnapshot('facet-local-workspace')
    expect(savedSnapshot).toEqual(snapshotBeforeDispose)
  })

  it('waits for an in-flight bootstrap before flushing durable state', async () => {
    let resolveLoad!: (snapshot: FacetWorkspaceSnapshot | null) => void
    const persistedSnapshots: FacetWorkspaceSnapshot[] = []
    const baseSnapshot = buildWorkspaceSnapshot()
    const snapshot = buildWorkspaceSnapshot({
      artifacts: {
        ...baseSnapshot.artifacts,
        resume: {
          ...baseSnapshot.artifacts.resume,
          payload: {
            ...baseSnapshot.artifacts.resume.payload,
            meta: {
              ...baseSnapshot.artifacts.resume.payload.meta,
              name: 'Hydrated Snapshot',
            },
          },
        },
      },
    })

    const backend: PersistenceBackend = {
      kind: 'memory',
      loadWorkspaceSnapshot: async () =>
        new Promise<FacetWorkspaceSnapshot | null>((resolve) => {
          resolveLoad = resolve
        }),
      saveWorkspaceSnapshot: async (nextSnapshot) => {
        persistedSnapshots.push(nextSnapshot)
        return nextSnapshot
      },
    }

    const runtime = createPersistenceRuntime({
      backend,
      localPreferencesBackend: createInMemoryLocalPreferencesBackend(),
    })

    const startPromise = runtime.start()
    const flushPromise = runtime.flush()
    resolveLoad(snapshot)
    await Promise.all([startPromise, flushPromise])

    expect(useResumeStore.getState().data.meta.name).toBe('Hydrated Snapshot')
    expect(persistedSnapshots).toHaveLength(1)
    expect(persistedSnapshots[0]?.artifacts.resume.payload.meta.name).toBe('Hydrated Snapshot')

    runtime.dispose()
  })

  it('coalesces rapid autosave changes into one debounced persistence pass', async () => {
    vi.useFakeTimers()
    const { backend, backing, getSaveCalls } = createWorkspaceBackendSpy()
    const runtime = createPersistenceRuntime({
      backend,
      localPreferencesBackend: createInMemoryLocalPreferencesBackend(),
      saveDebounceMs: 150,
    })

    await runtime.start()

    useResumeStore.getState().updateMetaField('name', 'Draft One')
    useResumeStore.getState().updateMetaField('name', 'Draft Two')
    useUiStore.getState().setAppearance('dark')

    await vi.advanceTimersByTimeAsync(149)
    expect(getSaveCalls()).toBe(0)

    await vi.advanceTimersByTimeAsync(1)

    const savedSnapshot = await backing.loadWorkspaceSnapshot('facet-local-workspace')

    expect(getSaveCalls()).toBe(1)
    expect(savedSnapshot?.artifacts.resume.payload.meta.name).toBe('Draft Two')
    expect(usePersistenceRuntimeStore.getState().status.phase).toBe('saved')

    runtime.dispose()
  })

  it('surfaces autosave failures through runtime error status', async () => {
    vi.useFakeTimers()
    const backend: PersistenceBackend = {
      kind: 'memory',
      loadWorkspaceSnapshot: async () => null,
      saveWorkspaceSnapshot: async () => {
        throw new Error('save failed')
      },
    }
    const runtime = createPersistenceRuntime({
      backend,
      localPreferencesBackend: createInMemoryLocalPreferencesBackend(),
      saveDebounceMs: 10,
    })

    await runtime.start()
    useResumeStore.getState().updateMetaField('name', 'Broken Save')
    await vi.advanceTimersByTimeAsync(10)

    expect(usePersistenceRuntimeStore.getState().status.phase).toBe('error')
    expect(usePersistenceRuntimeStore.getState().status.lastError).toBe('save failed')

    runtime.dispose()
  })

  it('surfaces generic autosave failure status when the backend throws non-Error values', async () => {
    vi.useFakeTimers()
    const backend: PersistenceBackend = {
      kind: 'memory',
      loadWorkspaceSnapshot: async () => null,
      saveWorkspaceSnapshot: async () => {
        throw 'save failed'
      },
    }
    const runtime = createPersistenceRuntime({
      backend,
      localPreferencesBackend: createInMemoryLocalPreferencesBackend(),
      saveDebounceMs: 10,
    })

    await runtime.start()
    useResumeStore.getState().updateMetaField('name', 'Broken Save')
    await vi.advanceTimersByTimeAsync(10)

    expect(usePersistenceRuntimeStore.getState().status.phase).toBe('error')
    expect(usePersistenceRuntimeStore.getState().status.lastError).toBe(
      'Failed to persist workspace runtime',
    )

    runtime.dispose()
  })

  it('cancels a pending autosave timer when disposed mid-debounce', async () => {
    vi.useFakeTimers()
    const { backend, getSaveCalls } = createWorkspaceBackendSpy()
    const runtime = createPersistenceRuntime({
      backend,
      localPreferencesBackend: createInMemoryLocalPreferencesBackend(),
      saveDebounceMs: 10,
    })

    await runtime.start()
    useResumeStore.getState().updateMetaField('name', 'Pending Save')
    runtime.dispose()

    await vi.advanceTimersByTimeAsync(10)

    expect(getSaveCalls()).toBe(0)
  })

  it('recreates the singleton runtime after disposal', () => {
    const first = getPersistenceRuntime()
    const second = getPersistenceRuntime()

    expect(second).toBe(first)

    first.dispose()

    const third = getPersistenceRuntime()
    expect(third).not.toBe(first)

    third.dispose()
  })

  it('imports a scoped workspace snapshot through the runtime and hydrates stores', async () => {
    const workspaceBackend = createInMemoryPersistenceBackend()
    const runtime = createPersistenceRuntime({
      backend: workspaceBackend,
      localPreferencesBackend: createInMemoryLocalPreferencesBackend(),
    })

    await runtime.start()

    const baseSnapshot = buildWorkspaceSnapshot()
    const importedSnapshot = buildWorkspaceSnapshot({
      workspace: {
        id: 'remote-workspace',
        name: 'Imported Workspace',
        revision: 3,
        updatedAt: '2026-03-11T12:00:00.000Z',
      },
      artifacts: {
        ...baseSnapshot.artifacts,
        resume: {
          ...baseSnapshot.artifacts.resume,
          payload: {
            ...baseSnapshot.artifacts.resume.payload,
            meta: {
              ...baseSnapshot.artifacts.resume.payload.meta,
              name: 'Imported Person',
            },
          },
        },
      },
    })

    const savedSnapshot = await runtime.importWorkspaceSnapshot(importedSnapshot, {
      mode: 'replace',
    })

    expect(useResumeStore.getState().data.meta.name).toBe('Imported Person')
    expect(savedSnapshot.workspace.id).toBe('facet-local-workspace')
    expect(savedSnapshot.artifacts.resume.artifactId).toBe('facet-local-workspace:resume')

    runtime.dispose()
  })

  it('merges imported workspace snapshots additively through the runtime', async () => {
    const workspaceBackend = createInMemoryPersistenceBackend()
    const runtime = createPersistenceRuntime({
      backend: workspaceBackend,
      localPreferencesBackend: createInMemoryLocalPreferencesBackend(),
    })

    await runtime.start()

    usePipelineStore.setState({
      entries: [
        {
          id: 'pipe-1',
          company: 'Acme',
          role: 'Current Role',
          tier: '1',
          status: 'applied',
          comp: '',
          url: '',
          contact: '',
          vectorId: 'backend',
          jobDescription: '',
          presetId: null,
          resumeVariant: 'default',
          positioning: '',
          skillMatch: '',
          nextStep: '',
          notes: '',
          appMethod: 'direct-apply',
          response: 'none',
          daysToResponse: null,
          rounds: null,
          format: [],
          rejectionStage: '',
          rejectionReason: '',
          offerAmount: '',
          dateApplied: '2026-03-11',
          dateClosed: '',
          lastAction: '2026-03-11',
          createdAt: '2026-03-11',
          history: [],
        },
      ],
      sortField: 'tier',
      sortDir: 'asc',
      filters: { tier: 'all', status: 'all', search: '' },
    })
    await runtime.flush()

    const baseSnapshot = buildWorkspaceSnapshot()
    const importedSnapshot = buildWorkspaceSnapshot({
      artifacts: {
        ...baseSnapshot.artifacts,
        pipeline: {
          ...baseSnapshot.artifacts.pipeline,
          payload: {
            entries: [
              {
                id: 'pipe-2',
                company: 'Globex',
                role: 'Imported Role',
                tier: '2',
                status: 'screening',
                comp: '',
                url: '',
                contact: '',
                vectorId: 'backend',
                jobDescription: '',
                presetId: null,
                resumeVariant: 'default',
                positioning: '',
                skillMatch: '',
                nextStep: '',
                notes: '',
                appMethod: 'direct-apply',
                response: 'none',
                daysToResponse: null,
                rounds: null,
                format: [],
                rejectionStage: '',
                rejectionReason: '',
                offerAmount: '',
                dateApplied: '2026-03-11',
                dateClosed: '',
                lastAction: '2026-03-11',
                createdAt: '2026-03-11',
                history: [],
              },
            ],
          },
        },
      },
    })

    await runtime.importWorkspaceSnapshot(importedSnapshot, { mode: 'merge' })

    expect(usePipelineStore.getState().entries.map((entry) => entry.id)).toEqual([
      'pipe-1',
      'pipe-2',
    ])

    runtime.dispose()
  })

  it('waits for an in-flight autosave before applying an imported backup snapshot', async () => {
    vi.useFakeTimers()
    const backing = createInMemoryPersistenceBackend()
    let delayFirstSave = true
    let resolveSave: (() => void) | null = null

    const backend: PersistenceBackend = {
      ...backing,
      saveWorkspaceSnapshot: async (snapshot) => {
        if (delayFirstSave) {
          delayFirstSave = false
          await new Promise<void>((resolve) => {
            resolveSave = resolve
          })
        }

        return backing.saveWorkspaceSnapshot(snapshot)
      },
    }

    const runtime = createPersistenceRuntime({
      backend,
      localPreferencesBackend: createInMemoryLocalPreferencesBackend(),
      saveDebounceMs: 10,
    })

    await runtime.start()
    useResumeStore.getState().updateMetaField('name', 'Autosave Draft')
    await vi.advanceTimersByTimeAsync(10)

    const baseSnapshot = buildWorkspaceSnapshot()
    const importedSnapshot = buildWorkspaceSnapshot({
      artifacts: {
        ...baseSnapshot.artifacts,
        resume: {
          ...baseSnapshot.artifacts.resume,
          payload: {
            ...baseSnapshot.artifacts.resume.payload,
            meta: {
              ...baseSnapshot.artifacts.resume.payload.meta,
              name: 'Imported Winner',
            },
          },
        },
      },
    })

    const importPromise = runtime.importWorkspaceSnapshot(importedSnapshot, {
      mode: 'replace',
    })

    expect(resolveSave).not.toBeNull()
    resolveSave!()
    await importPromise

    expect(useResumeStore.getState().data.meta.name).toBe('Imported Winner')
    const savedSnapshot = await backing.loadWorkspaceSnapshot('facet-local-workspace')
    expect(savedSnapshot?.artifacts.resume.payload.meta.name).toBe('Imported Winner')

    runtime.dispose()
  })

  it('recovers from local-preferences save failures during import and supports a later flush', async () => {
    const workspaceBackend = createInMemoryPersistenceBackend()
    let failSave = true
    const preferencesBackend = {
      ...createInMemoryLocalPreferencesBackend(),
      saveLocalPreferencesSnapshot: vi.fn(async (snapshot: FacetLocalPreferencesSnapshot) => {
        if (failSave) {
          failSave = false
          throw new Error('preferences save failed')
        }

        return snapshot
      }),
    }

    const runtime = createPersistenceRuntime({
      backend: workspaceBackend,
      localPreferencesBackend: preferencesBackend,
    })

    await runtime.start()

    const importedSnapshot = buildWorkspaceSnapshot({
      artifacts: {
        ...buildWorkspaceSnapshot().artifacts,
        resume: {
          ...buildWorkspaceSnapshot().artifacts.resume,
          payload: {
            ...buildWorkspaceSnapshot().artifacts.resume.payload,
            meta: {
              ...buildWorkspaceSnapshot().artifacts.resume.payload.meta,
              name: 'Imported After Failure',
            },
          },
        },
      },
    })

    await expect(
      runtime.importWorkspaceSnapshot(importedSnapshot, { mode: 'replace' }),
    ).rejects.toThrow('preferences save failed')

    expect(useResumeStore.getState().data.meta.name).toBe('Imported After Failure')

    useResumeStore.getState().updateMetaField('name', 'Recovered Save')
    await runtime.flush()

    const savedSnapshot = await workspaceBackend.loadWorkspaceSnapshot('facet-local-workspace')
    expect(savedSnapshot?.artifacts.resume.payload.meta.name).toBe('Recovered Save')

    runtime.dispose()
  })

  it('does not hydrate imported data after the runtime is disposed mid-import', async () => {
    const backing = createInMemoryPersistenceBackend()
    let resolveSave: (() => void) | null = null
    const workspaceBackend: PersistenceBackend = {
      ...backing,
      saveWorkspaceSnapshot: async (snapshot) => {
        await new Promise<void>((resolve) => {
          resolveSave = resolve
        })

        return backing.saveWorkspaceSnapshot(snapshot)
      },
    }

    const runtime = createPersistenceRuntime({
      backend: workspaceBackend,
      localPreferencesBackend: createInMemoryLocalPreferencesBackend(),
    })

    await runtime.start()
    useResumeStore.getState().updateMetaField('name', 'Before Dispose')

    const importedSnapshot = buildWorkspaceSnapshot({
      artifacts: {
        ...buildWorkspaceSnapshot().artifacts,
        resume: {
          ...buildWorkspaceSnapshot().artifacts.resume,
          payload: {
            ...buildWorkspaceSnapshot().artifacts.resume.payload,
            meta: {
              ...buildWorkspaceSnapshot().artifacts.resume.payload.meta,
              name: 'Should Not Hydrate',
            },
          },
        },
      },
    })

    const importPromise = runtime.importWorkspaceSnapshot(importedSnapshot, {
      mode: 'replace',
    })

    await waitFor(() => {
      expect(resolveSave).not.toBeNull()
    })
    runtime.dispose()
    resolveSave!()

    const returnedSnapshot = await importPromise
    expect(returnedSnapshot.artifacts.resume.payload.meta.name).toBe('Should Not Hydrate')
    expect(useResumeStore.getState().data.meta.name).toBe('Before Dispose')
  })

  it('surfaces local-preferences backend load failures during bootstrap', async () => {
    const workspaceBackend = createInMemoryPersistenceBackend()
    await workspaceBackend.saveWorkspaceSnapshot(
      buildWorkspaceSnapshot({
        workspace: {
          ...buildWorkspaceSnapshot().workspace,
          id: 'facet-local-workspace',
        },
        artifacts: {
          ...buildWorkspaceSnapshot().artifacts,
          resume: {
            ...buildWorkspaceSnapshot().artifacts.resume,
            workspaceId: 'facet-local-workspace',
            artifactId: 'facet-local-workspace:resume',
          },
          pipeline: {
            ...buildWorkspaceSnapshot().artifacts.pipeline,
            workspaceId: 'facet-local-workspace',
            artifactId: 'facet-local-workspace:pipeline',
          },
          prep: {
            ...buildWorkspaceSnapshot().artifacts.prep,
            workspaceId: 'facet-local-workspace',
            artifactId: 'facet-local-workspace:prep',
          },
          coverLetters: {
            ...buildWorkspaceSnapshot().artifacts.coverLetters,
            workspaceId: 'facet-local-workspace',
            artifactId: 'facet-local-workspace:coverLetters',
          },
          research: {
            ...buildWorkspaceSnapshot().artifacts.research,
            workspaceId: 'facet-local-workspace',
            artifactId: 'facet-local-workspace:research',
          },
        },
      }),
    )

    const preferencesBackend = {
      ...createInMemoryLocalPreferencesBackend(),
      loadLocalPreferencesSnapshot: vi.fn(async () => {
        throw new Error('preferences load failed')
      }),
    }

    const runtime = createPersistenceRuntime({
      backend: workspaceBackend,
      localPreferencesBackend: preferencesBackend,
    })

    await expect(runtime.start()).rejects.toThrow('preferences load failed')
    expect(usePersistenceRuntimeStore.getState().status.phase).toBe('error')
    expect(usePersistenceRuntimeStore.getState().status.lastError).toBe('preferences load failed')
  })

  it('does not finish bootstrapping after being disposed mid-start', async () => {
    let resolveLoad: ((snapshot: FacetWorkspaceSnapshot | null) => void) | null = null
    const backend: PersistenceBackend = {
      kind: 'memory',
      loadWorkspaceSnapshot: async () =>
        new Promise<FacetWorkspaceSnapshot | null>((resolve) => {
          resolveLoad = resolve
        }),
      saveWorkspaceSnapshot: async (snapshot) => snapshot,
    }

    const runtime = createPersistenceRuntime({
      backend,
      localPreferencesBackend: createInMemoryLocalPreferencesBackend(),
    })

    const startPromise = runtime.start()
    runtime.dispose()
    expect(resolveLoad).not.toBeNull()
    resolveLoad!(null)
    await startPromise

    expect(usePersistenceRuntimeStore.getState().hydrated).toBe(false)
    useResumeStore.getState().updateMetaField('name', 'After Disposed Start')
    await new Promise((resolve) => setTimeout(resolve, 25))
    expect(usePersistenceRuntimeStore.getState().status.phase).toBe('idle')
  })

  it('surfaces runtime bootstrap failures through error status', async () => {
    const backend: PersistenceBackend = {
      kind: 'memory',
      loadWorkspaceSnapshot: async () => {
        throw new Error('bootstrap failed')
      },
      saveWorkspaceSnapshot: async (snapshot) => snapshot,
    }

    const runtime = createPersistenceRuntime({
      backend,
      localPreferencesBackend: createInMemoryLocalPreferencesBackend(),
    })

    await expect(runtime.start()).rejects.toThrow('bootstrap failed')
    expect(usePersistenceRuntimeStore.getState().status.phase).toBe('error')
    expect(usePersistenceRuntimeStore.getState().status.lastError).toBe('bootstrap failed')
  })

  it('surfaces generic runtime bootstrap failures when the backend throws non-Error values', async () => {
    const backend: PersistenceBackend = {
      kind: 'memory',
      loadWorkspaceSnapshot: async () => {
        throw 'bootstrap failed'
      },
      saveWorkspaceSnapshot: async (snapshot) => snapshot,
    }

    const runtime = createPersistenceRuntime({
      backend,
      localPreferencesBackend: createInMemoryLocalPreferencesBackend(),
    })

    await expect(runtime.start()).rejects.toBe('bootstrap failed')
    expect(usePersistenceRuntimeStore.getState().status.phase).toBe('error')
    expect(usePersistenceRuntimeStore.getState().status.lastError).toBe(
      'Failed to bootstrap persistence runtime',
    )
  })
})
