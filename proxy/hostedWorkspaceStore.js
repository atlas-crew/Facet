import { randomUUID } from 'node:crypto'
import { readFile, rename, writeFile } from 'node:fs/promises'

const FACET_WORKSPACE_SNAPSHOT_VERSION = 1
const FACET_ARTIFACT_TYPES = ['resume', 'pipeline', 'prep', 'coverLetters', 'research']
const fileWriteQueues = new Map()

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function cloneValue(value) {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }

  return JSON.parse(JSON.stringify(value))
}

function createWorkspaceValidationError(message) {
  const error = new Error(message)
  error.name = 'WorkspaceStoreValidationError'
  return error
}

function validateWorkspaceName(value, message = 'Hosted workspace name is required.') {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (!trimmed) {
    throw createWorkspaceValidationError(message)
  }

  if (trimmed.length > 200) {
    throw createWorkspaceValidationError('Hosted workspace name must be 200 characters or fewer.')
  }

  return trimmed
}

function validateTimestamp(value, message = 'Hosted workspace operations require a valid ISO timestamp.') {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (!trimmed || Number.isNaN(Date.parse(trimmed))) {
    throw createWorkspaceValidationError(message)
  }

  return trimmed
}

function validateWorkspaceId(value) {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (!trimmed) {
    throw createWorkspaceValidationError('Hosted workspace id is required.')
  }

  if (!/^[a-z0-9-]{1,64}$/i.test(trimmed)) {
    throw createWorkspaceValidationError(
      'Hosted workspace id must use letters, numbers, and hyphens only.',
    )
  }

  return trimmed
}

function membershipKey(tenantId, workspaceId) {
  return `${tenantId}:${workspaceId}`
}

function normalizeWorkspaceMembership(value) {
  if (!isRecord(value)) {
    return null
  }

  const workspaceId = typeof value.workspaceId === 'string' ? value.workspaceId.trim() : ''
  const role = value.role === 'owner' ? 'owner' : null
  if (!workspaceId || !role) {
    return null
  }

  return {
    workspaceId,
    role,
    isDefault: value.isDefault === true,
  }
}

function normalizeHostedActorRecord(value) {
  if (!isRecord(value)) {
    return null
  }

  const tenantId = typeof value.tenantId === 'string' ? value.tenantId.trim() : ''
  const accountId = typeof value.accountId === 'string' ? value.accountId.trim() : ''
  const userId = typeof value.userId === 'string' ? value.userId.trim() : ''
  const email = typeof value.email === 'string' ? value.email.trim().toLowerCase() : ''
  const workspaces = Array.isArray(value.workspaces)
    ? value.workspaces.map(normalizeWorkspaceMembership).filter(Boolean)
    : []

  if (!tenantId || !accountId || !userId || !email) {
    return null
  }

  return {
    tenantId,
    accountId,
    userId,
    email,
    workspaces,
  }
}

function normalizeWorkspaceRecord(value) {
  if (!isRecord(value)) {
    return null
  }

  const tenantId = typeof value.tenantId === 'string' ? value.tenantId.trim() : ''
  const accountId = typeof value.accountId === 'string' ? value.accountId.trim() : ''
  const workspaceId = typeof value.workspaceId === 'string' ? value.workspaceId.trim() : ''
  const name = typeof value.name === 'string' ? value.name.trim() : ''
  const revision =
    typeof value.revision === 'number' && Number.isFinite(value.revision)
      ? value.revision
      : null
  const updatedAt = typeof value.updatedAt === 'string' ? value.updatedAt : ''
  const createdAt = typeof value.createdAt === 'string' ? value.createdAt : updatedAt

  if (!tenantId || !accountId || !workspaceId || !name || revision == null || !updatedAt || !createdAt) {
    return null
  }

  return {
    tenantId,
    accountId,
    workspaceId,
    name,
    revision,
    updatedAt,
    createdAt,
  }
}

function normalizeHostedWorkspaceDirectory(value) {
  if (!isRecord(value)) {
    throw new Error('Hosted workspace file must be a JSON object.')
  }

  return {
    actors: Array.isArray(value.actors)
      ? value.actors.map(normalizeHostedActorRecord).filter(Boolean)
      : [],
    workspaces: Array.isArray(value.workspaces)
      ? value.workspaces.map(normalizeWorkspaceRecord).filter(Boolean)
      : [],
    snapshots: Array.isArray(value.snapshots)
      ? value.snapshots.filter((snapshot) => isRecord(snapshot))
      : [],
  }
}

function createEmptySnapshot(actor, workspaceId, workspaceName, timestamp) {
  const artifacts = Object.fromEntries(
    FACET_ARTIFACT_TYPES.map((artifactType) => {
      let payload

      switch (artifactType) {
        case 'resume':
          payload = {
            version: 1,
            meta: { name: '', email: '', phone: '', location: '', links: [] },
            target_lines: [],
            profiles: [],
            skill_groups: [],
            roles: [],
            projects: [],
            education: [],
            certifications: [],
            vectors: [],
            presets: [],
          }
          break
        case 'pipeline':
          payload = { entries: [] }
          break
        case 'prep':
          payload = { decks: [] }
          break
        case 'coverLetters':
          payload = { templates: [] }
          break
        case 'research':
          payload = { profile: null, requests: [], runs: [] }
          break
        default:
          payload = {}
      }

      return [
        artifactType,
        {
          artifactId: `${workspaceId}:${artifactType}`,
          artifactType,
          workspaceId,
          schemaVersion: 1,
          revision: 0,
          updatedAt: timestamp,
          payload,
        },
      ]
    }),
  )

  return {
    snapshotVersion: FACET_WORKSPACE_SNAPSHOT_VERSION,
    tenantId: actor.tenantId,
    userId: actor.userId,
    workspace: {
      id: workspaceId,
      name: workspaceName,
      revision: 0,
      updatedAt: timestamp,
    },
    artifacts,
    exportedAt: timestamp,
  }
}

function createWorkspaceSummary(record, membership) {
  return {
    workspaceId: record.workspaceId,
    name: record.name,
    revision: record.revision,
    updatedAt: record.updatedAt,
    role: membership.role,
    isDefault: membership.isDefault,
  }
}

function compareWorkspaceMemberships(left, right) {
  if (left.isDefault !== right.isDefault) {
    return left.isDefault ? -1 : 1
  }

  return left.workspaceId.localeCompare(right.workspaceId)
}

function ensureSingleDefault(memberships) {
  let defaultFound = false

  for (const membership of memberships) {
    if (!defaultFound && membership.isDefault) {
      defaultFound = true
      continue
    }

    if (defaultFound && membership.isDefault) {
      membership.isDefault = false
    }
  }

  if (!defaultFound && memberships.length > 0) {
    memberships[0].isDefault = true
  }
}

function buildStoreState(directory) {
  const actors = new Map(
    directory.actors.map((actor) => {
      const memberships = actor.workspaces
        .map((membership) => cloneValue(membership))
        .sort(compareWorkspaceMemberships)
      ensureSingleDefault(memberships)

      return [
        actor.userId,
        {
          tenantId: actor.tenantId,
          accountId: actor.accountId,
          userId: actor.userId,
          email: actor.email,
          workspaces: memberships,
        },
      ]
    }),
  )
  const workspaces = new Map(
    directory.workspaces.map((workspace) => [
      membershipKey(workspace.tenantId, workspace.workspaceId),
      cloneValue(workspace),
    ]),
  )
  const snapshots = new Map(
    directory.snapshots.flatMap((snapshot) => {
      const tenantId = typeof snapshot.tenantId === 'string' ? snapshot.tenantId : ''
      const workspaceId = typeof snapshot.workspace?.id === 'string' ? snapshot.workspace.id : ''
      return tenantId && workspaceId
        ? [[membershipKey(tenantId, workspaceId), cloneValue(snapshot)]]
        : []
    }),
  )

  return {
    actors,
    workspaces,
    snapshots,
  }
}

function serializeState(state) {
  return {
    actors: Array.from(state.actors.values()).map((actor) => ({
      tenantId: actor.tenantId,
      accountId: actor.accountId,
      userId: actor.userId,
      email: actor.email,
      workspaces: actor.workspaces.map((membership) => ({
        workspaceId: membership.workspaceId,
        role: membership.role,
        isDefault: membership.isDefault,
      })),
    })),
    workspaces: Array.from(state.workspaces.values()),
    snapshots: Array.from(state.snapshots.values()),
  }
}

async function withFileWriteQueue(filePath, callback) {
  const previous = fileWriteQueues.get(filePath) ?? Promise.resolve()
  let releaseQueue = () => {}
  const current = new Promise((resolve) => {
    releaseQueue = resolve
  })
  fileWriteQueues.set(filePath, current)

  await previous.catch(() => {})

  try {
    return await callback()
  } finally {
    releaseQueue()
    if (fileWriteQueues.get(filePath) === current) {
      fileWriteQueues.delete(filePath)
    }
  }
}

function createWorkspaceStoreApi({ readState, writeState }) {
  const getActorRecord = async (userId) => {
    const state = await readState()
    const actor = state.actors.get(userId)
    return actor ? cloneValue(actor) : null
  }

  const getWorkspaceRecord = async (tenantId, workspaceId) => {
    const state = await readState()
    return cloneValue(state.workspaces.get(membershipKey(tenantId, workspaceId)) ?? null)
  }

  const loadWorkspaceRecord = async (tenantId, workspaceId) => {
    const state = await readState()
    return cloneValue(state.snapshots.get(membershipKey(tenantId, workspaceId)) ?? null)
  }

  return {
    async getActor(userId) {
      const actor = await getActorRecord(userId)
      if (!actor) {
        return null
      }

      return {
        tenantId: actor.tenantId,
        accountId: actor.accountId,
        userId: actor.userId,
        email: actor.email,
        workspaces: actor.workspaces.map((membership) => cloneValue(membership)),
      }
    },

    async loadWorkspace(tenantId, workspaceId) {
      return loadWorkspaceRecord(tenantId, workspaceId)
    },

    async saveWorkspace(snapshot) {
      // The proxy is expected to rewrite tenantId/userId from authenticated server
      // context before calling the store. This direct store boundary validates the
      // resulting actor membership, but it does not perform identity derivation.
      const actorUserId = typeof snapshot.userId === 'string' ? snapshot.userId : ''
      const workspaceName = validateWorkspaceName(
        snapshot.workspace?.name,
        'Hosted workspace save requires a non-empty workspace name.',
      )
      const updatedAt = validateTimestamp(
        snapshot.workspace?.updatedAt,
        'Hosted workspace save requires a valid workspace updatedAt timestamp.',
      )
      const exportedAt = validateTimestamp(
        snapshot.exportedAt,
        'Hosted workspace save requires a valid exportedAt timestamp.',
      )
      const workspaceId = validateWorkspaceId(snapshot.workspace?.id)
      const key = membershipKey(snapshot.tenantId, workspaceId)
      let savedSnapshot = null

      await writeState((state) => {
        const actor = actorUserId ? state.actors.get(actorUserId) : null
        if (!actor || actor.tenantId !== snapshot.tenantId) {
          throw createWorkspaceValidationError('Hosted workspace save requires a provisioned actor.')
        }

        const membership = actor.workspaces.find((entry) => entry.workspaceId === workspaceId) ?? null
        if (!membership) {
          throw createWorkspaceValidationError('Hosted workspace save requires workspace membership.')
        }

        const currentRecord = state.workspaces.get(key) ?? null
        const currentSnapshot = state.snapshots.get(key) ?? null
        if (currentRecord) {
          const incomingRevision = snapshot.workspace?.revision
          if (typeof incomingRevision !== 'number' || !Number.isFinite(incomingRevision)) {
            throw createWorkspaceValidationError('Hosted workspace save requires a numeric revision.')
          }
          if (incomingRevision < currentRecord.revision) {
            throw createWorkspaceValidationError('Hosted workspace save rejected a stale workspace revision.')
          }
          if (
            incomingRevision === currentRecord.revision &&
            currentSnapshot &&
            JSON.stringify(currentSnapshot) !== JSON.stringify(snapshot)
          ) {
            throw createWorkspaceValidationError(
              'Hosted workspace save rejected a conflicting workspace revision.',
            )
          }
        }

        const nextRecord = {
          tenantId: actor.tenantId,
          accountId: actor.accountId,
          workspaceId,
          name: workspaceName,
          revision: snapshot.workspace.revision,
          updatedAt,
          createdAt: currentRecord?.createdAt ?? updatedAt,
        }
        const normalizedSnapshot = cloneValue(snapshot)
        normalizedSnapshot.workspace = {
          ...normalizedSnapshot.workspace,
          name: workspaceName,
          updatedAt,
        }
        normalizedSnapshot.exportedAt = exportedAt

        state.workspaces.set(key, cloneValue(nextRecord))
        state.snapshots.set(key, cloneValue(normalizedSnapshot))
        savedSnapshot = cloneValue(normalizedSnapshot)
      })

      return cloneValue(savedSnapshot)
    },

    async listWorkspacesForActor(actor) {
      const state = await readState()
      const actorRecord = state.actors.get(actor.userId)
      if (!actorRecord) {
        return []
      }

      return actorRecord.workspaces
        .map((membership) => {
          const workspace = state.workspaces.get(
            membershipKey(actorRecord.tenantId, membership.workspaceId),
          )
          return workspace ? createWorkspaceSummary(workspace, membership) : null
        })
        .filter(Boolean)
        .map((workspace) => cloneValue(workspace))
    },

    async createWorkspace(actor, input = {}, timestamp) {
      const actorRecord = await getActorRecord(actor.userId)
      if (!actorRecord) {
        throw createWorkspaceValidationError('Hosted actor is not provisioned for workspace creation.')
      }

      const operationTimestamp = validateTimestamp(timestamp)
      const trimmedName = typeof input.name === 'string' ? input.name.trim() : ''
      const workspaceName = trimmedName ? validateWorkspaceName(trimmedName) : 'Facet Workspace'
      const requestedWorkspaceId =
        typeof input.workspaceId === 'string' ? validateWorkspaceId(input.workspaceId) : ''
      const workspaceId = requestedWorkspaceId || `workspace-${randomUUID()}`
      const key = membershipKey(actorRecord.tenantId, workspaceId)
      const wasEmpty = actorRecord.workspaces.length === 0

      const workspace = {
        tenantId: actorRecord.tenantId,
        accountId: actorRecord.accountId,
        workspaceId,
        name: workspaceName,
        revision: 0,
        updatedAt: operationTimestamp,
        createdAt: operationTimestamp,
      }
      const membership = {
        workspaceId,
        role: 'owner',
        isDefault: wasEmpty || !actorRecord.workspaces.some((entry) => entry.isDefault),
      }
      const snapshot = createEmptySnapshot(actorRecord, workspaceId, workspaceName, operationTimestamp)
      let createdMembership = cloneValue(membership)

      await writeState((state) => {
        if (state.workspaces.has(key)) {
          throw createWorkspaceValidationError(`Hosted workspace "${workspaceId}" already exists.`)
        }

        const writableActor = state.actors.get(actor.userId)
        if (!writableActor || writableActor.tenantId !== actor.tenantId) {
          throw createWorkspaceValidationError('Hosted actor is not provisioned for workspace creation.')
        }

        writableActor.workspaces.push(cloneValue(membership))
        writableActor.workspaces.sort(compareWorkspaceMemberships)
        ensureSingleDefault(writableActor.workspaces)
        createdMembership =
          cloneValue(
            writableActor.workspaces.find((entry) => entry.workspaceId === workspaceId) ?? membership,
          )

        state.workspaces.set(key, cloneValue(workspace))
        state.snapshots.set(key, cloneValue(snapshot))
      })

      return {
        workspace: createWorkspaceSummary(workspace, createdMembership),
        snapshot,
      }
    },

    async renameWorkspace(actor, workspaceId, name, timestamp) {
      const trimmedName = validateWorkspaceName(name)
      const operationTimestamp = validateTimestamp(timestamp)

      let renamedSummary = null
      let renamedSnapshot = null

      await writeState((state) => {
        const actorRecord = state.actors.get(actor.userId)
        if (!actorRecord || actorRecord.tenantId !== actor.tenantId) {
          throw createWorkspaceValidationError('Hosted workspace rename requires owner access.')
        }
        const membership = actorRecord?.workspaces.find((entry) => entry.workspaceId === workspaceId) ?? null
        if (!membership || membership.role !== 'owner') {
          throw createWorkspaceValidationError('Hosted workspace rename requires owner access.')
        }

        const key = membershipKey(actorRecord.tenantId, workspaceId)
        const workspace = state.workspaces.get(key)
        if (!workspace) {
          throw createWorkspaceValidationError('Hosted workspace not found.')
        }

        const nextRevision = workspace.revision + 1
        workspace.name = trimmedName
        workspace.revision = nextRevision
        workspace.updatedAt = operationTimestamp
        renamedSummary = createWorkspaceSummary(workspace, membership)

        const snapshot = state.snapshots.get(key)
        if (snapshot && isRecord(snapshot.workspace)) {
          snapshot.workspace = {
            ...snapshot.workspace,
            name: trimmedName,
            revision: nextRevision,
            updatedAt: operationTimestamp,
          }
          snapshot.exportedAt = operationTimestamp
          renamedSnapshot = cloneValue(snapshot)
        }
      })

      return {
        workspace: cloneValue(renamedSummary),
        snapshot: cloneValue(renamedSnapshot),
      }
    },

    async deleteWorkspace(actor, workspaceId) {
      let nextDefaultWorkspaceId = null

      await writeState((state) => {
        const actorRecord = state.actors.get(actor.userId)
        if (!actorRecord || actorRecord.tenantId !== actor.tenantId) {
          throw createWorkspaceValidationError('Hosted workspace deletion requires owner access.')
        }
        const membership = actorRecord?.workspaces.find((entry) => entry.workspaceId === workspaceId) ?? null
        if (!membership || membership.role !== 'owner') {
          throw createWorkspaceValidationError('Hosted workspace deletion requires owner access.')
        }

        const key = membershipKey(actorRecord.tenantId, workspaceId)
        if (!state.workspaces.has(key)) {
          throw createWorkspaceValidationError('Hosted workspace not found.')
        }

        const writableActor = state.actors.get(actor.userId)
        if (!writableActor) {
          throw createWorkspaceValidationError('Hosted actor is not provisioned for workspace deletion.')
        }

        writableActor.workspaces = writableActor.workspaces.filter((entry) => entry.workspaceId !== workspaceId)
        writableActor.workspaces.sort(compareWorkspaceMemberships)
        ensureSingleDefault(writableActor.workspaces)
        nextDefaultWorkspaceId =
          writableActor.workspaces.find((entry) => entry.isDefault)?.workspaceId ??
          writableActor.workspaces[0]?.workspaceId ??
          null

        state.workspaces.delete(key)
        state.snapshots.delete(key)
      })

      return {
        deletedWorkspaceId: workspaceId,
        defaultWorkspaceId: nextDefaultWorkspaceId,
      }
    },
  }
}

export function createInMemoryHostedWorkspaceStore(directory = {}) {
  let state = buildStoreState(normalizeHostedWorkspaceDirectory(directory))

  return createWorkspaceStoreApi({
    readState: async () => state,
    writeState: async (mutate) => {
      const next = buildStoreState(serializeState(state))
      mutate(next)
      state = next
    },
  })
}

export function createFileHostedWorkspaceStore(filePath) {
  if (!filePath) {
    throw new Error('Hosted persistence requires HOSTED_WORKSPACE_FILE.')
  }

  const readState = async () => {
    const raw = await readFile(filePath, 'utf8')
    return buildStoreState(normalizeHostedWorkspaceDirectory(JSON.parse(raw)))
  }

  const persist = async (state) => {
    const nextFilePath = `${filePath}.${randomUUID()}.tmp`
    await writeFile(nextFilePath, JSON.stringify(serializeState(state), null, 2))
    await rename(nextFilePath, filePath)
  }

  return createWorkspaceStoreApi({
    readState,
    writeState: async (mutate) => {
      await withFileWriteQueue(filePath, async () => {
        const current = await readState()
        const next = buildStoreState(serializeState(current))
        mutate(next)
        await persist(next)
      })
    },
  })
}
