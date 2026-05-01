import type {
  CoverLettersArtifactSnapshot,
  DebriefArtifactSnapshot,
  JDAnalysisArtifactSnapshot,
  PipelineArtifactSnapshot,
  PrepArtifactSnapshot,
  RecruiterArtifactSnapshot,
  ResearchArtifactSnapshot,
  ResumeArtifactSnapshot,
  LinkedInArtifactSnapshot,
  FacetWorkspaceArtifacts,
  FacetWorkspaceSnapshot,
} from './contracts'
import { cloneValue } from './clone'
import { normalizeWorkspaceSnapshot } from './normalization'
import { assertValidWorkspaceSnapshot } from './validation'
import { isFacetApiError } from '../utils/facetApiErrors'

export type PersistenceBackendKind =
  | 'localStorage'
  | 'indexeddb'
  | 'remote'
  | 'filesystem'
  | 'memory'
  | 'custom'

export type PersistenceStatusPhase =
  | 'idle'
  | 'bootstrapping'
  | 'ready'
  | 'saving'
  | 'saved'
  | 'offline'
  | 'conflict'
  | 'error'

export interface PersistenceStatus {
  phase: PersistenceStatusPhase
  backend: PersistenceBackendKind
  activeWorkspaceId: string | null
  lastHydratedAt: string | null
  lastSavedAt: string | null
  lastError: string | null
}

export interface PersistenceBootstrapResult {
  snapshot: FacetWorkspaceSnapshot | null
  status: PersistenceStatus
}

export interface PersistenceSnapshotRequest {
  workspaceId?: string
  workspaceName?: string
  tenantId?: string | null
  userId?: string | null
  exportedAt?: string
}

export interface PersistenceImportOptions {
  mode: 'replace' | 'merge'
}

export interface PersistenceWorkspacePatch {
  tenantId?: string | null
  userId?: string | null
  workspace?: Partial<Pick<FacetWorkspaceSnapshot['workspace'], 'name'>>
  artifacts?: {
    resume?: Partial<Pick<ResumeArtifactSnapshot, 'payload' | 'revision'>>
    pipeline?: Partial<Pick<PipelineArtifactSnapshot, 'payload' | 'revision'>>
    jdAnalysis?: Partial<Pick<JDAnalysisArtifactSnapshot, 'payload' | 'revision'>>
    prep?: Partial<Pick<PrepArtifactSnapshot, 'payload' | 'revision'>>
    coverLetters?: Partial<Pick<CoverLettersArtifactSnapshot, 'payload' | 'revision'>>
    linkedin?: Partial<Pick<LinkedInArtifactSnapshot, 'payload' | 'revision'>>
    recruiter?: Partial<Pick<RecruiterArtifactSnapshot, 'payload' | 'revision'>>
    debrief?: Partial<Pick<DebriefArtifactSnapshot, 'payload' | 'revision'>>
    research?: Partial<Pick<ResearchArtifactSnapshot, 'payload' | 'revision'>>
  }
}

export interface PersistenceBackend {
  kind: PersistenceBackendKind
  loadWorkspaceSnapshot: (workspaceId: string) => Promise<FacetWorkspaceSnapshot | null> | FacetWorkspaceSnapshot | null
  // Backends must either fully persist and return the authoritative saved
  // snapshot or throw. Partial saves should surface as errors instead.
  saveWorkspaceSnapshot: (
    snapshot: FacetWorkspaceSnapshot,
  ) => Promise<FacetWorkspaceSnapshot> | FacetWorkspaceSnapshot
  deleteWorkspaceSnapshot?: (workspaceId: string) => Promise<void> | void
  listWorkspaceSnapshots?: () => Promise<FacetWorkspaceSnapshot[]> | FacetWorkspaceSnapshot[]
}

export interface PersistenceCoordinator {
  // Bootstraps coordinator status from the persisted backend snapshot, if present.
  bootstrap: (workspaceId: string) => Promise<PersistenceBootstrapResult>
  loadWorkspace: (workspaceId: string) => Promise<FacetWorkspaceSnapshot | null>
  // saveWorkspacePatch is a read-then-write flow. Callers that need concurrency
  // protection must layer optimistic locking or backend serialization above it.
  saveWorkspacePatch: (workspaceId: string, patch: PersistenceWorkspacePatch) => Promise<FacetWorkspaceSnapshot>
  // exportWorkspaceSnapshot always reflects live in-memory store state, not a backend round-trip.
  exportWorkspaceSnapshot: (request?: PersistenceSnapshotRequest) => Promise<FacetWorkspaceSnapshot>
  importWorkspaceSnapshot: (
    snapshot: FacetWorkspaceSnapshot,
    options?: PersistenceImportOptions,
  ) => Promise<FacetWorkspaceSnapshot>
  getStatus: () => PersistenceStatus
}

export interface PersistenceCoordinatorOptions {
  backend: PersistenceBackend
  // When no backend snapshot exists yet, the first patch save snapshots the
  // current in-memory workspace state through this reader and applies the patch
  // on top of that baseline.
  readWorkspaceSnapshot: (request?: PersistenceSnapshotRequest) => FacetWorkspaceSnapshot
  mergeImportedSnapshot?: (
    current: FacetWorkspaceSnapshot | null,
    imported: FacetWorkspaceSnapshot,
  ) => FacetWorkspaceSnapshot
}

const now = () => new Date().toISOString()

const resolvePersistenceFailurePhase = (error: unknown): PersistenceStatusPhase =>
  isFacetApiError(error) && error.code === 'offline' ? 'offline' : 'error'

const resolvePersistenceFailureMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback

const applyArtifactPatch = <TArtifact extends {
  artifactId: string
  artifactType: string
  workspaceId: string
  schemaVersion: number
  revision: number
  updatedAt: string
  payload: unknown
}>(
  current: TArtifact,
  patch: Partial<TArtifact> | null | undefined,
  patchedAt = now(),
): TArtifact => {
  if (!patch) {
    return current
  }

  if (typeof patch !== 'object' || Array.isArray(patch)) {
    throw new Error('Artifact patch must be an object.')
  }

  const candidate = patch as Partial<TArtifact>
  const nextRevision =
    typeof candidate.revision === 'number' && Number.isFinite(candidate.revision)
      ? candidate.revision
      : current.revision
  const hasPayload = Object.prototype.hasOwnProperty.call(candidate, 'payload')
  const nextPayload = hasPayload ? (candidate.payload as TArtifact['payload']) : current.payload
  const changed = nextRevision !== current.revision || nextPayload !== current.payload

  return {
    // Identity fields intentionally stay anchored to the current artifact so
    // runtime patches cannot forge artifact ids, types, or workspace scope.
    // Revisions remain patchable because higher layers may supply optimistic or
    // server-authored revision values while still preserving artifact identity.
    ...current,
    revision: nextRevision,
    updatedAt: changed ? patchedAt : current.updatedAt,
    payload: nextPayload,
  }
}

export const applyWorkspacePatch = (
  snapshot: FacetWorkspaceSnapshot,
  patch: PersistenceWorkspacePatch,
): FacetWorkspaceSnapshot => {
  const next = cloneValue(snapshot)

  if (patch.tenantId !== undefined) {
    next.tenantId = patch.tenantId
  }

  if (patch.userId !== undefined) {
    next.userId = patch.userId
  }

  if (patch.workspace) {
    next.workspace = {
      ...next.workspace,
      ...(typeof patch.workspace.name === 'string'
        ? { name: patch.workspace.name }
        : {}),
    }
  }

  if (patch.artifacts) {
    for (const [artifactType, artifactPatch] of Object.entries(patch.artifacts)) {
      if (!artifactPatch) continue

      switch (artifactType as keyof FacetWorkspaceArtifacts) {
        case 'resume':
          next.artifacts.resume = applyArtifactPatch(
            next.artifacts.resume,
            artifactPatch as Partial<ResumeArtifactSnapshot>,
          )
          break
        case 'pipeline':
          next.artifacts.pipeline = applyArtifactPatch(
            next.artifacts.pipeline,
            artifactPatch as Partial<PipelineArtifactSnapshot>,
          )
          break
        case 'jdAnalysis':
          next.artifacts.jdAnalysis = applyArtifactPatch(
            next.artifacts.jdAnalysis,
            artifactPatch as Partial<JDAnalysisArtifactSnapshot>,
          )
          break
        case 'prep':
          next.artifacts.prep = applyArtifactPatch(
            next.artifacts.prep,
            artifactPatch as Partial<PrepArtifactSnapshot>,
          )
          break
        case 'coverLetters':
          next.artifacts.coverLetters = applyArtifactPatch(
            next.artifacts.coverLetters,
            artifactPatch as Partial<CoverLettersArtifactSnapshot>,
          )
          break
        case 'linkedin':
          next.artifacts.linkedin = applyArtifactPatch(
            next.artifacts.linkedin,
            artifactPatch as Partial<LinkedInArtifactSnapshot>,
          )
          break
        case 'recruiter':
          next.artifacts.recruiter = applyArtifactPatch(
            next.artifacts.recruiter,
            artifactPatch as Partial<RecruiterArtifactSnapshot>,
          )
          break
        case 'debrief':
          next.artifacts.debrief = applyArtifactPatch(
            next.artifacts.debrief,
            artifactPatch as Partial<DebriefArtifactSnapshot>,
          )
          break
        case 'research':
          next.artifacts.research = applyArtifactPatch(
            next.artifacts.research,
            artifactPatch as Partial<ResearchArtifactSnapshot>,
          )
          break
        default:
          throw new Error(`Unknown artifact type in patch: ${String(artifactType)}`)
      }
    }
  }

  return next
}

export const createInMemoryPersistenceBackend = (): PersistenceBackend => {
  const snapshots = new Map<string, FacetWorkspaceSnapshot>()

  return {
    kind: 'memory',
    loadWorkspaceSnapshot: (workspaceId) => {
      const existing = snapshots.get(workspaceId)
      return existing ? cloneValue(existing) : null
    },
    saveWorkspaceSnapshot: (snapshot) => {
      snapshots.set(snapshot.workspace.id, cloneValue(snapshot))
      return cloneValue(snapshot)
    },
    deleteWorkspaceSnapshot: (workspaceId) => {
      snapshots.delete(workspaceId)
    },
    listWorkspaceSnapshots: () =>
      Array.from(snapshots.values()).map((snapshot) => cloneValue(snapshot)),
  }
}

export const createPersistenceCoordinator = (
  options: PersistenceCoordinatorOptions,
): PersistenceCoordinator => {
  // Phase 1 intentionally returns snapshots to the caller. Hydrating Zustand
  // stores from these snapshots belongs to the next migration slice.
  let status: PersistenceStatus = {
    phase: 'idle',
    backend: options.backend.kind,
    activeWorkspaceId: null,
    lastHydratedAt: null,
    lastSavedAt: null,
    lastError: null,
  }

  const setStatus = (patch: Partial<PersistenceStatus>) => {
    status = {
      ...status,
      ...patch,
    }
  }

  return {
    bootstrap: async (workspaceId) => {
      setStatus({
        phase: 'bootstrapping',
        activeWorkspaceId: workspaceId,
        lastError: null,
      })

      try {
        const rawSnapshot = await options.backend.loadWorkspaceSnapshot(workspaceId)
        const snapshot = rawSnapshot ? normalizeWorkspaceSnapshot(rawSnapshot) : null
        if (snapshot) {
          assertValidWorkspaceSnapshot(snapshot)
        }
        const hydratedAt = snapshot ? now() : status.lastHydratedAt

        setStatus({
          phase: 'ready',
          lastHydratedAt: hydratedAt,
        })

        return {
          snapshot,
          status: cloneValue(status),
        }
      } catch (error) {
        setStatus({
          phase: resolvePersistenceFailurePhase(error),
          lastError: resolvePersistenceFailureMessage(error, 'Failed to bootstrap persistence'),
        })
        throw error
      }
    },

    loadWorkspace: async (workspaceId) => {
      try {
        const rawResult = await options.backend.loadWorkspaceSnapshot(workspaceId)
        const result = rawResult ? normalizeWorkspaceSnapshot(rawResult) : null
        if (result) {
          assertValidWorkspaceSnapshot(result)
        }
        setStatus({
          activeWorkspaceId: workspaceId,
          lastHydratedAt: result ? now() : status.lastHydratedAt,
          phase: 'ready',
          lastError: null,
        })
        return result
      } catch (error) {
        setStatus({
          activeWorkspaceId: workspaceId,
          phase: resolvePersistenceFailurePhase(error),
          lastError: resolvePersistenceFailureMessage(error, 'Failed to load workspace'),
        })
        throw error
      }
    },

    saveWorkspacePatch: async (workspaceId, patch) => {
      setStatus({
        activeWorkspaceId: workspaceId,
        phase: 'saving',
        lastError: null,
      })

      try {
        const current =
          normalizeWorkspaceSnapshot(
            ((await options.backend.loadWorkspaceSnapshot(workspaceId)) ??
              options.readWorkspaceSnapshot({ workspaceId })) as FacetWorkspaceSnapshot,
          )
        const next = applyWorkspacePatch(current, patch)
        next.workspace.revision = current.workspace.revision + 1
        next.workspace.updatedAt = now()
        const saved = await options.backend.saveWorkspaceSnapshot(next)

        setStatus({
          phase: 'saved',
          lastSavedAt: now(),
        })

        return saved
      } catch (error) {
        setStatus({
          phase: resolvePersistenceFailurePhase(error),
          lastError: resolvePersistenceFailureMessage(error, 'Failed to save workspace patch'),
        })
        throw error
      }
    },

    exportWorkspaceSnapshot: async (request) => {
      return options.readWorkspaceSnapshot(request)
    },

    importWorkspaceSnapshot: async (snapshot, importOptions = { mode: 'replace' }) => {
      const normalizedSnapshot = normalizeWorkspaceSnapshot(snapshot)
      assertValidWorkspaceSnapshot(normalizedSnapshot)

      if (importOptions.mode === 'merge' && !options.mergeImportedSnapshot) {
        throw new Error('Merge import requires mergeImportedSnapshot to be configured.')
      }

      setStatus({
        activeWorkspaceId: normalizedSnapshot.workspace.id,
        phase: 'saving',
        lastError: null,
      })

      try {
        const current =
          importOptions.mode === 'merge'
            ? await options.backend.loadWorkspaceSnapshot(normalizedSnapshot.workspace.id)
            : null
        const resolved =
          importOptions.mode === 'merge' && options.mergeImportedSnapshot
            ? options.mergeImportedSnapshot(
                current ? normalizeWorkspaceSnapshot(current) : null,
                normalizedSnapshot,
              )
            : normalizedSnapshot

        const saved = await options.backend.saveWorkspaceSnapshot(resolved)

        setStatus({
          phase: 'saved',
          lastSavedAt: now(),
        })

        return saved
      } catch (error) {
        setStatus({
          phase: resolvePersistenceFailurePhase(error),
          lastError: resolvePersistenceFailureMessage(error, 'Failed to import workspace snapshot'),
        })
        throw error
      }
    },

    getStatus: () => cloneValue(status),
  }
}
