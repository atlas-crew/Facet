import {
  FACET_ARTIFACT_TYPES,
  FACET_WORKSPACE_SNAPSHOT_VERSION,
} from './workspaceSnapshotDefaults.js'

const DEFAULT_LOCAL_WORKSPACE_ID = 'facet-local-workspace'

export const DEFAULT_PERSISTENCE_AUTH_TOKENS = [
  {
    token: 'facet-local-user',
    tenantId: 'tenant-local',
    userId: 'user-local',
    workspaces: [DEFAULT_LOCAL_WORKSPACE_ID],
  },
]

export class PersistenceAuthError extends Error {
  constructor(status, message) {
    super(message)
    this.name = 'PersistenceAuthError'
    this.status = status
  }
}

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)

const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value)

const cloneValue = (value) => {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }

  return JSON.parse(JSON.stringify(value))
}

const storageKey = (tenantId, workspaceId) => `${tenantId}:${workspaceId}`

export function createInMemoryWorkspaceStore() {
  const snapshots = new Map()

  return {
    loadWorkspace(tenantId, workspaceId) {
      const snapshot = snapshots.get(storageKey(tenantId, workspaceId))
      return snapshot ? cloneValue(snapshot) : null
    },
    saveWorkspace(snapshot) {
      snapshots.set(storageKey(snapshot.tenantId, snapshot.workspace.id), cloneValue(snapshot))
      return cloneValue(snapshot)
    },
    listWorkspaces(tenantId, workspaceIds) {
      return workspaceIds
        .map((workspaceId) => snapshots.get(storageKey(tenantId, workspaceId)))
        .filter(Boolean)
        .map((snapshot) => cloneValue(snapshot))
    },
  }
}

export function parsePersistenceAuthTokens(raw) {
  if (!raw) {
    return cloneValue(DEFAULT_PERSISTENCE_AUTH_TOKENS)
  }

  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('Invalid PERSISTENCE_AUTH_TOKENS JSON.')
  }

  if (!Array.isArray(parsed)) {
    throw new Error('PERSISTENCE_AUTH_TOKENS must be a JSON array.')
  }

  return parsed.flatMap((entry) => {
    if (!isRecord(entry)) {
      return []
    }

    const token = typeof entry.token === 'string' ? entry.token.trim() : ''
    const tenantId = typeof entry.tenantId === 'string' ? entry.tenantId.trim() : ''
    const userId = typeof entry.userId === 'string' ? entry.userId.trim() : ''
    const workspaces = Array.isArray(entry.workspaces)
      ? entry.workspaces
          .filter((workspaceId) => typeof workspaceId === 'string')
          .map((workspaceId) => workspaceId.trim())
          .filter(Boolean)
      : []

    if (!token || !tenantId || !userId || workspaces.length === 0) {
      return []
    }

    return [{ token, tenantId, userId, workspaces }]
  })
}

export function getAuthorizationToken(req) {
  const header = req.headers.authorization
  if (typeof header !== 'string') {
    return null
  }

  const match = header.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() || null
}

export function createTokenActorResolver(authTokens) {
  return async (req) => {
    const token = getAuthorizationToken(req)
    if (!token) {
      throw new PersistenceAuthError(401, 'Missing or invalid persistence bearer token.')
    }

    const actor = authTokens.find((entry) => entry.token === token) ?? null
    if (!actor) {
      throw new PersistenceAuthError(401, 'Missing or invalid persistence bearer token.')
    }

    return actor
  }
}

function actorCanAccessWorkspace(actor, workspaceId) {
  if (Array.isArray(actor.workspaces) && actor.workspaces.includes('*')) {
    return true
  }

  const workspaceIds = actorWorkspaceIds(actor)
  return workspaceIds.includes(workspaceId)
}

function actorCanManageWorkspace(actor, workspaceId) {
  if (!Array.isArray(actor.workspaceMemberships)) {
    // Local-mode bearer tokens imply owner access to their configured workspaces.
    return actorCanAccessWorkspace(actor, workspaceId)
  }

  return actor.workspaceMemberships.some(
    (membership) => membership.workspaceId === workspaceId && membership.role === 'owner',
  )
}

function actorWorkspaceIds(actor) {
  if (Array.isArray(actor.workspaceMemberships)) {
    return actor.workspaceMemberships.map((membership) => membership.workspaceId)
  }

  return Array.isArray(actor.workspaces)
    ? actor.workspaces.filter((workspaceId) => workspaceId !== '*')
    : []
}

function assertValidArtifactPayload(artifactType, payload) {
  if (!isRecord(payload)) {
    throw new Error(`Workspace snapshot has invalid artifacts.${artifactType}.payload shape.`)
  }

  switch (artifactType) {
    case 'resume':
      // ResumeWorkspaceData = { data, resumes, snapshots, activeResumeId }
      if (!isRecord(payload.data) || !Array.isArray(payload.resumes)) {
        throw new Error('Workspace snapshot has invalid artifacts.resume.payload shape.')
      }
      break
    case 'pipeline':
      if (!Array.isArray(payload.entries)) {
        throw new Error('Workspace snapshot has invalid artifacts.pipeline.payload.entries.')
      }
      break
    case 'jdAnalysis':
      if (!Array.isArray(payload.analyses)) {
        throw new Error('Workspace snapshot has invalid artifacts.jdAnalysis.payload.analyses.')
      }
      break
    case 'prep':
      if (!Array.isArray(payload.decks)) {
        throw new Error('Workspace snapshot has invalid artifacts.prep.payload.decks.')
      }
      break
    case 'coverLetters':
      // CoverLetterWorkspaceData = { letters, snapshots }
      if (!Array.isArray(payload.letters)) {
        throw new Error('Workspace snapshot has invalid artifacts.coverLetters.payload.letters.')
      }
      break
    case 'research':
      if (
        (payload.profile !== null && payload.profile !== undefined && !isRecord(payload.profile)) ||
        !Array.isArray(payload.requests) ||
        !Array.isArray(payload.runs)
      ) {
        throw new Error('Workspace snapshot has invalid artifacts.research.payload shape.')
      }
      break
    case 'linkedin':
      if (!Array.isArray(payload.drafts)) {
        throw new Error('Workspace snapshot has invalid artifacts.linkedin.payload.drafts.')
      }
      break
    case 'recruiter':
      if (!Array.isArray(payload.cards)) {
        throw new Error('Workspace snapshot has invalid artifacts.recruiter.payload.cards.')
      }
      break
    case 'debrief':
      if (!Array.isArray(payload.sessions)) {
        throw new Error('Workspace snapshot has invalid artifacts.debrief.payload.sessions.')
      }
      break
    default: {
      const exhaustiveValue = artifactType
      throw new Error(`Unsupported artifact type: ${String(exhaustiveValue)}`)
    }
  }
}

function assertValidWorkspaceSnapshot(snapshot) {
  if (!isRecord(snapshot)) {
    throw new Error('Workspace snapshot must be an object.')
  }

  if (snapshot.snapshotVersion !== FACET_WORKSPACE_SNAPSHOT_VERSION) {
    throw new Error(
      `Unsupported workspace snapshot version: expected ${FACET_WORKSPACE_SNAPSHOT_VERSION}, got ${String(snapshot.snapshotVersion)}`,
    )
  }

  if (!isRecord(snapshot.workspace) || typeof snapshot.workspace.id !== 'string') {
    throw new Error('Workspace snapshot must include a workspace.id string.')
  }

  if (
    typeof snapshot.workspace.name !== 'string' ||
    !isFiniteNumber(snapshot.workspace.revision) ||
    typeof snapshot.workspace.updatedAt !== 'string'
  ) {
    throw new Error('Workspace snapshot must include valid workspace metadata.')
  }

  if (
    (snapshot.tenantId !== null &&
      snapshot.tenantId !== undefined &&
      typeof snapshot.tenantId !== 'string') ||
    (snapshot.userId !== null &&
      snapshot.userId !== undefined &&
      typeof snapshot.userId !== 'string') ||
    typeof snapshot.exportedAt !== 'string'
  ) {
    throw new Error('Workspace snapshot must include valid tenant, user, and export metadata.')
  }

  if (!isRecord(snapshot.artifacts)) {
    throw new Error('Workspace snapshot must include artifacts.')
  }

  for (const artifactType of FACET_ARTIFACT_TYPES) {
    const artifact = snapshot.artifacts[artifactType]

    if (!isRecord(artifact)) {
      throw new Error(`Workspace snapshot is missing artifacts.${artifactType}.`)
    }

    if (artifact.artifactType !== artifactType) {
      throw new Error(`Workspace snapshot has mismatched artifacts.${artifactType}.artifactType.`)
    }

    if (!('payload' in artifact) || artifact.payload == null) {
      throw new Error(`Workspace snapshot is missing artifacts.${artifactType}.payload.`)
    }

    if (
      typeof artifact.artifactId !== 'string' ||
      typeof artifact.workspaceId !== 'string' ||
      !isFiniteNumber(artifact.schemaVersion) ||
      !isFiniteNumber(artifact.revision) ||
      typeof artifact.updatedAt !== 'string'
    ) {
      throw new Error(`Workspace snapshot has invalid artifacts.${artifactType} metadata.`)
    }

    assertValidArtifactPayload(artifactType, artifact.payload)
  }
}

function normalizeWorkspaceSnapshot(snapshot, actor, workspaceId, savedAt, currentSnapshot) {
  const nextWorkspaceRevision = (currentSnapshot?.workspace.revision ?? 0) + 1

  return {
    snapshotVersion: FACET_WORKSPACE_SNAPSHOT_VERSION,
    tenantId: actor.tenantId,
    userId: actor.userId,
    workspace: {
      id: workspaceId,
      name:
        typeof snapshot.workspace?.name === 'string' && snapshot.workspace.name.trim()
          ? snapshot.workspace.name.trim()
          : (currentSnapshot?.workspace.name ?? workspaceId),
      revision: nextWorkspaceRevision,
      updatedAt: savedAt,
    },
    artifacts: Object.fromEntries(
      FACET_ARTIFACT_TYPES.map((artifactType) => {
        const currentArtifact = currentSnapshot?.artifacts?.[artifactType]
        const incomingArtifact = snapshot.artifacts?.[artifactType]

        return [
          artifactType,
          {
            artifactId: `${workspaceId}:${artifactType}`,
            artifactType,
            workspaceId,
            schemaVersion:
              typeof incomingArtifact?.schemaVersion === 'number' &&
              Number.isFinite(incomingArtifact.schemaVersion)
                ? incomingArtifact.schemaVersion
                : (currentArtifact?.schemaVersion ?? 1),
            revision: (currentArtifact?.revision ?? 0) + 1,
            updatedAt: savedAt,
            payload: cloneValue(incomingArtifact?.payload),
          },
        ]
      }),
    ),
    exportedAt: savedAt,
  }
}

function validateWorkspaceNameInput(value) {
  if (typeof value !== 'string') {
    throw new Error('Workspace name must be a string.')
  }

  const trimmed = value.trim()
  if (!trimmed) {
    throw new Error('Workspace name must not be empty.')
  }

  if (trimmed.length > 200) {
    throw new Error('Workspace name must be 200 characters or fewer.')
  }

  return trimmed
}

function validateWorkspaceIdInput(value) {
  if (typeof value !== 'string') {
    throw new Error('Workspace id must be a string.')
  }

  const trimmed = value.trim()
  if (!trimmed) {
    throw new Error('Workspace id must not be empty.')
  }

  if (!/^[a-z0-9-]{1,64}$/i.test(trimmed)) {
    throw new Error('Workspace id must use letters, numbers, and hyphens only.')
  }

  return trimmed
}

function workspaceMutationErrorStatus(error) {
  return error?.name === 'WorkspaceStoreValidationError' ? 400 : 500
}

function extractWorkspaceId(req, routePrefix) {
  const url = new URL(req.url ?? '/', 'http://localhost')
  if (!url.pathname.startsWith(routePrefix)) {
    return null
  }

  const workspaceId = decodeURIComponent(url.pathname.slice(routePrefix.length))
  return workspaceId || null
}

export function createPersistenceApi({
  actorResolver,
  store,
  now = () => new Date().toISOString(),
  onEvent,
}) {
  const collectionRoute = '/api/persistence/workspaces'
  const routePrefix = '/api/persistence/workspaces/'

  const actorPayload = (actor) => ({
    tenantId: actor.tenantId,
    userId: actor.userId,
    workspaceIds: actorWorkspaceIds(actor),
  })

  return {
    canHandle(req) {
      const url = new URL(req.url ?? '/', 'http://localhost')
      if (url.pathname === collectionRoute) {
        return req.method === 'GET' || req.method === 'POST'
      }

      if (url.pathname.startsWith(routePrefix)) {
        return (
          req.method === 'GET' ||
          req.method === 'PUT' ||
          req.method === 'PATCH' ||
          req.method === 'DELETE'
        )
      }

      return false
    },

    async handle(req, res, readBody, sendJson) {
      let actor
      try {
        actor = await actorResolver(req)
      } catch (error) {
        const url = new URL(req.url ?? '/', 'http://localhost')
        onEvent?.('persistence.auth', 'error', {
          code: error instanceof PersistenceAuthError ? 'auth_required' : 'auth_internal_error',
          method: req.method,
          path: url.pathname,
        })
        sendJson(res, error instanceof PersistenceAuthError ? error.status : 500, {
          error: error instanceof Error ? error.message : 'Persistence authentication failed.',
        })
        return
      }

      const url = new URL(req.url ?? '/', 'http://localhost')

      if (url.pathname === collectionRoute) {
        if (req.method === 'GET') {
          if (typeof store.listWorkspacesForActor !== 'function') {
            sendJson(res, 405, {
              error: 'Workspace directory listing is not supported by this backend.',
            })
            return
          }

          const workspaces = await store.listWorkspacesForActor(actor)
          onEvent?.('persistence.list', 'success', {
            method: req.method,
            path: url.pathname,
          })
          sendJson(res, 200, {
            workspaces,
            actor: actorPayload(actor),
          })
          return
        }

        if (req.method === 'POST') {
          if (typeof store.createWorkspace !== 'function') {
            sendJson(res, 405, { error: 'Workspace creation is not supported by this backend.' })
            return
          }

          let body
          try {
            body = await readBody(req)
          } catch (error) {
            sendJson(res, 400, {
              error: error instanceof Error ? error.message : 'Invalid JSON body.',
            })
            return
          }

          try {
            const created = await store.createWorkspace(
              actor,
              {
                name: body?.name === undefined ? undefined : validateWorkspaceNameInput(body.name),
                workspaceId:
                  body?.workspaceId === undefined
                    ? undefined
                    : validateWorkspaceIdInput(body.workspaceId),
              },
              now(),
            )
            const refreshedActor =
              typeof store.getActor === 'function'
                ? ((await store.getActor(actor.userId)) ?? actor)
                : actor

            sendJson(res, 201, {
              ...created,
              actor: actorPayload(refreshedActor),
            })
            onEvent?.('persistence.create', 'success', {
              workspaceId: created.workspace?.workspaceId,
              method: req.method,
              path: url.pathname,
            })
          } catch (error) {
            if (!(error?.name === 'WorkspaceStoreValidationError')) {
              console.error('[proxy] workspace_create_error', error)
            }
            onEvent?.('persistence.create', 'error', {
              code:
                error?.name === 'WorkspaceStoreValidationError'
                  ? 'validation_error'
                  : 'workspace_create_error',
              method: req.method,
              path: url.pathname,
            })
            sendJson(res, workspaceMutationErrorStatus(error), {
              error: error instanceof Error ? error.message : 'Failed to create workspace.',
            })
          }
          return
        }

        sendJson(res, 405, { error: 'Method not allowed for workspace directory route.' })
        return
      }

      const workspaceId = extractWorkspaceId(req, routePrefix)
      if (!workspaceId) {
        sendJson(res, 404, { error: 'Workspace route not found.' })
        return
      }

      if (!actorCanAccessWorkspace(actor, workspaceId)) {
        onEvent?.('persistence.access', 'denied', {
          code: 'workspace_access_denied',
          workspaceId,
          method: req.method,
          path: url.pathname,
        })
        sendJson(res, 403, { error: 'Workspace access denied for authenticated actor.' })
        return
      }

      if (req.method === 'GET') {
        const snapshot = await store.loadWorkspace(actor.tenantId, workspaceId)
        if (!snapshot) {
          onEvent?.('persistence.load', 'not_found', {
            code: 'workspace_not_found',
            workspaceId,
            method: req.method,
            path: url.pathname,
          })
          sendJson(res, 404, { error: 'Workspace snapshot not found.' })
          return
        }

        onEvent?.('persistence.load', 'success', {
          workspaceId,
          method: req.method,
          path: url.pathname,
        })
        sendJson(res, 200, {
          snapshot,
          actor: actorPayload(actor),
        })
        return
      }

      if (req.method === 'PATCH') {
        if (!actorCanManageWorkspace(actor, workspaceId)) {
          sendJson(res, 403, { error: 'Workspace rename requires owner access.' })
          return
        }
        if (typeof store.renameWorkspace !== 'function') {
          sendJson(res, 405, { error: 'Workspace rename is not supported by this backend.' })
          return
        }

        let body
        try {
          body = await readBody(req)
        } catch (error) {
          sendJson(res, 400, {
            error: error instanceof Error ? error.message : 'Invalid JSON body.',
          })
          return
        }

        try {
          const renamed = await store.renameWorkspace(
            actor,
            workspaceId,
            validateWorkspaceNameInput(body?.name),
            now(),
          )
          sendJson(res, 200, {
            ...renamed,
            actor: actorPayload(actor),
          })
          onEvent?.('persistence.rename', 'success', {
            workspaceId,
            method: req.method,
            path: url.pathname,
          })
        } catch (error) {
          if (!(error?.name === 'WorkspaceStoreValidationError')) {
            console.error('[proxy] workspace_rename_error', error)
          }
          onEvent?.('persistence.rename', 'error', {
            code:
              error?.name === 'WorkspaceStoreValidationError'
                ? 'validation_error'
                : 'workspace_rename_error',
            workspaceId,
            method: req.method,
            path: url.pathname,
          })
          sendJson(res, workspaceMutationErrorStatus(error), {
            error: error instanceof Error ? error.message : 'Failed to rename workspace.',
          })
        }
        return
      }

      if (req.method === 'DELETE') {
        if (!actorCanManageWorkspace(actor, workspaceId)) {
          sendJson(res, 403, { error: 'Workspace deletion requires owner access.' })
          return
        }
        if (typeof store.deleteWorkspace !== 'function') {
          sendJson(res, 405, { error: 'Workspace deletion is not supported by this backend.' })
          return
        }

        try {
          const deleted = await store.deleteWorkspace(actor, workspaceId)
          const refreshedActor =
            typeof store.getActor === 'function'
              ? ((await store.getActor(actor.userId)) ?? actor)
              : actor

          sendJson(res, 200, {
            ...deleted,
            actor: actorPayload(refreshedActor),
          })
          onEvent?.('persistence.delete', 'success', {
            workspaceId,
            method: req.method,
            path: url.pathname,
          })
        } catch (error) {
          if (!(error?.name === 'WorkspaceStoreValidationError')) {
            console.error('[proxy] workspace_delete_error', error)
          }
          onEvent?.('persistence.delete', 'error', {
            code:
              error?.name === 'WorkspaceStoreValidationError'
                ? 'validation_error'
                : 'workspace_delete_error',
            workspaceId,
            method: req.method,
            path: url.pathname,
          })
          sendJson(res, workspaceMutationErrorStatus(error), {
            error: error instanceof Error ? error.message : 'Failed to delete workspace.',
          })
        }
        return
      }

      let body
      try {
        body = await readBody(req)
      } catch (error) {
        sendJson(res, 400, { error: error instanceof Error ? error.message : 'Invalid JSON body.' })
        return
      }

      const snapshot = body?.snapshot
      if (!snapshot || typeof snapshot !== 'object') {
        sendJson(res, 400, { error: 'Missing or invalid "snapshot" object.' })
        return
      }

      const currentSnapshot = await store.loadWorkspace(actor.tenantId, workspaceId)
      const incomingWorkspaceName =
        typeof snapshot.workspace?.name === 'string' ? snapshot.workspace.name.trim() : null
      if (
        currentSnapshot &&
        incomingWorkspaceName &&
        incomingWorkspaceName !== currentSnapshot.workspace.name &&
        !actorCanManageWorkspace(actor, workspaceId)
      ) {
        sendJson(res, 403, { error: 'Workspace rename requires owner access.' })
        return
      }
      const savedAt = now()
      const normalized = normalizeWorkspaceSnapshot(
        snapshot,
        actor,
        workspaceId,
        savedAt,
        currentSnapshot,
      )

      try {
        assertValidWorkspaceSnapshot(normalized)
      } catch (error) {
        onEvent?.('persistence.save', 'error', {
          code: 'invalid_snapshot',
          workspaceId,
          method: req.method,
          path: url.pathname,
        })
        sendJson(res, 400, {
          error: error instanceof Error ? error.message : 'Invalid workspace snapshot.',
        })
        return
      }

      try {
        const savedSnapshot = await store.saveWorkspace(normalized)
        onEvent?.('persistence.save', 'success', {
          workspaceId,
          method: req.method,
          path: url.pathname,
        })
        sendJson(res, 200, {
          snapshot: savedSnapshot,
          actor: actorPayload(actor),
        })
      } catch (error) {
        onEvent?.('persistence.save', 'error', {
          code: 'workspace_save_error',
          workspaceId,
          method: req.method,
          path: url.pathname,
        })
        throw error
      }
    },
  }
}
