const DEFAULT_LOCAL_WORKSPACE_ID = 'facet-local-workspace'
const FACET_WORKSPACE_SNAPSHOT_VERSION = 1
const FACET_ARTIFACT_TYPES = [
  'resume',
  'pipeline',
  'prep',
  'coverLetters',
  'research',
]

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

const isRecord = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isFiniteNumber = (value) =>
  typeof value === 'number' && Number.isFinite(value)

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
      ? entry.workspaces.filter((workspaceId) => typeof workspaceId === 'string').map((workspaceId) => workspaceId.trim()).filter(Boolean)
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
  return actor.workspaces.includes('*') || actor.workspaces.includes(workspaceId)
}

function assertValidArtifactPayload(artifactType, payload) {
  if (!isRecord(payload)) {
    throw new Error(`Workspace snapshot has invalid artifacts.${artifactType}.payload shape.`)
  }

  switch (artifactType) {
    case 'resume':
      if (!isRecord(payload.meta) || !Array.isArray(payload.vectors)) {
        throw new Error('Workspace snapshot has invalid artifacts.resume.payload shape.')
      }
      break
    case 'pipeline':
      if (!Array.isArray(payload.entries)) {
        throw new Error('Workspace snapshot has invalid artifacts.pipeline.payload.entries.')
      }
      break
    case 'prep':
      if (!Array.isArray(payload.decks)) {
        throw new Error('Workspace snapshot has invalid artifacts.prep.payload.decks.')
      }
      break
    case 'coverLetters':
      if (!Array.isArray(payload.templates)) {
        throw new Error('Workspace snapshot has invalid artifacts.coverLetters.payload.templates.')
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
    (
      snapshot.tenantId !== null &&
      snapshot.tenantId !== undefined &&
      typeof snapshot.tenantId !== 'string'
    ) ||
    (
      snapshot.userId !== null &&
      snapshot.userId !== undefined &&
      typeof snapshot.userId !== 'string'
    ) ||
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
          : currentSnapshot?.workspace.name ?? workspaceId,
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
                : currentArtifact?.schemaVersion ?? 1,
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

function extractWorkspaceId(req, routePrefix) {
  const url = new URL(req.url ?? '/', 'http://localhost')
  if (!url.pathname.startsWith(routePrefix)) {
    return null
  }

  const workspaceId = decodeURIComponent(url.pathname.slice(routePrefix.length))
  return workspaceId || null
}

export function createPersistenceApi({ actorResolver, store, now = () => new Date().toISOString() }) {
  const routePrefix = '/api/persistence/workspaces/'

  return {
    canHandle(req) {
      const url = new URL(req.url ?? '/', 'http://localhost')
      return (
        (req.method === 'GET' || req.method === 'PUT') &&
        url.pathname.startsWith(routePrefix)
      )
    },

    async handle(req, res, readBody, sendJson) {
      let actor
      try {
        actor = await actorResolver(req)
      } catch (error) {
        sendJson(
          res,
          error instanceof PersistenceAuthError ? error.status : 500,
          {
            error:
              error instanceof Error
                ? error.message
                : 'Persistence authentication failed.',
          },
        )
        return
      }

      const workspaceId = extractWorkspaceId(req, routePrefix)
      if (!workspaceId) {
        sendJson(res, 404, { error: 'Workspace route not found.' })
        return
      }

      if (!actorCanAccessWorkspace(actor, workspaceId)) {
        sendJson(res, 403, { error: 'Workspace access denied for authenticated actor.' })
        return
      }

      if (req.method === 'GET') {
        const snapshot = store.loadWorkspace(actor.tenantId, workspaceId)
        if (!snapshot) {
          sendJson(res, 404, { error: 'Workspace snapshot not found.' })
          return
        }

        sendJson(res, 200, {
          snapshot,
          actor: {
            tenantId: actor.tenantId,
            userId: actor.userId,
            workspaceIds: actor.workspaces,
          },
        })
        return
      }

      const body = await readBody(req)
      const snapshot = body?.snapshot
      if (!snapshot || typeof snapshot !== 'object') {
        sendJson(res, 400, { error: 'Missing or invalid "snapshot" object.' })
        return
      }

      const currentSnapshot = store.loadWorkspace(actor.tenantId, workspaceId)
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
        sendJson(res, 400, { error: error instanceof Error ? error.message : 'Invalid workspace snapshot.' })
        return
      }

      const savedSnapshot = store.saveWorkspace(normalized)
      sendJson(res, 200, {
        snapshot: savedSnapshot,
        actor: {
          tenantId: actor.tenantId,
          userId: actor.userId,
          workspaceIds: actor.workspaces,
        },
      })
    },
  }
}
