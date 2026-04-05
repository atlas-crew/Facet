/**
 * Postgres-backed hosted workspace store.
 *
 * Drop-in replacement for createFileHostedWorkspaceStore / createInMemoryHostedWorkspaceStore.
 * Implements the same interface: getActor, loadWorkspace, saveWorkspace,
 * listWorkspacesForActor, createWorkspace, renameWorkspace, deleteWorkspace.
 *
 * @param {import('pg').Pool} pool
 */

import { randomUUID } from 'node:crypto'

const FACET_WORKSPACE_SNAPSHOT_VERSION = 1
const FACET_ARTIFACT_TYPES = ['resume', 'pipeline', 'prep', 'coverLetters', 'research']

// ── Validation (mirrors hostedWorkspaceStore.js) ──────────────

function createValidationError(message) {
  const error = new Error(message)
  error.name = 'WorkspaceStoreValidationError'
  return error
}

function validateWorkspaceName(value, message = 'Hosted workspace name is required.') {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (!trimmed) {
    throw createValidationError(message)
  }
  if (trimmed.length > 200) {
    throw createValidationError('Hosted workspace name must be 200 characters or fewer.')
  }
  return trimmed
}

function validateTimestamp(value, message = 'Hosted workspace operations require a valid ISO timestamp.') {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (!trimmed || Number.isNaN(Date.parse(trimmed))) {
    throw createValidationError(message)
  }
  return trimmed
}

function validateWorkspaceId(value) {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (!trimmed) {
    throw createValidationError('Hosted workspace id is required.')
  }
  if (!/^[a-z0-9-]{1,64}$/i.test(trimmed)) {
    throw createValidationError('Hosted workspace id must use letters, numbers, and hyphens only.')
  }
  return trimmed
}

// ── Empty snapshot factory (mirrors hostedWorkspaceStore.js) ──

function createEmptySnapshot(actor, workspaceId, workspaceName, timestamp) {
  const artifacts = Object.fromEntries(
    FACET_ARTIFACT_TYPES.map((artifactType) => {
      let payload
      switch (artifactType) {
        case 'resume':
          payload = {
            version: 1,
            meta: { name: '', email: '', phone: '', location: '', links: [] },
            target_lines: [], profiles: [], skill_groups: [],
            roles: [], projects: [], education: [],
            certifications: [], vectors: [], presets: [],
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
      return [artifactType, {
        artifactId: `${workspaceId}:${artifactType}`,
        artifactType,
        workspaceId,
        schemaVersion: 1,
        revision: 0,
        updatedAt: timestamp,
        payload,
      }]
    }),
  )

  return {
    snapshotVersion: FACET_WORKSPACE_SNAPSHOT_VERSION,
    tenantId: actor.tenantId,
    userId: actor.userId,
    workspace: { id: workspaceId, name: workspaceName, revision: 0, updatedAt: timestamp },
    artifacts,
    exportedAt: timestamp,
  }
}

// ── Helpers ───────────────────────────────────────────────────

/** Run a callback inside a serializable transaction. */
async function withTransaction(pool, callback) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

/** Assemble an actor record from DB rows (actor + memberships). */
function assembleActor(actorRow, membershipRows) {
  return {
    tenantId: actorRow.tenant_id,
    accountId: actorRow.account_id,
    userId: actorRow.user_id,
    email: actorRow.email,
    workspaces: membershipRows
      .sort((a, b) => {
        if (a.is_default !== b.is_default) return a.is_default ? -1 : 1
        return a.workspace_id.localeCompare(b.workspace_id)
      })
      .map((m) => ({
        workspaceId: m.workspace_id,
        role: m.role,
        isDefault: m.is_default,
      })),
  }
}

/** Assemble a full snapshot from workspace + snapshot DB rows. */
function assembleSnapshot(workspaceRow, snapshotRow) {
  return {
    snapshotVersion: FACET_WORKSPACE_SNAPSHOT_VERSION,
    tenantId: workspaceRow.tenant_id,
    userId: snapshotRow.user_id,
    workspace: {
      id: workspaceRow.workspace_id,
      name: workspaceRow.name,
      revision: workspaceRow.revision,
      updatedAt: workspaceRow.updated_at instanceof Date
        ? workspaceRow.updated_at.toISOString()
        : workspaceRow.updated_at,
    },
    artifacts: snapshotRow.artifacts,
    exportedAt: snapshotRow.exported_at instanceof Date
      ? snapshotRow.exported_at.toISOString()
      : snapshotRow.exported_at,
  }
}

// ── Store factory ─────────────────────────────────────────────

export function createPostgresWorkspaceStore(pool) {
  return {
    async getActor(userId) {
      const { rows: actorRows } = await pool.query(
        'SELECT user_id, tenant_id, account_id, email FROM actors WHERE user_id = $1',
        [userId],
      )
      if (actorRows.length === 0) return null

      const { rows: membershipRows } = await pool.query(
        'SELECT workspace_id, tenant_id, role, is_default FROM workspace_memberships WHERE user_id = $1',
        [userId],
      )

      return assembleActor(actorRows[0], membershipRows)
    },

    async loadWorkspace(tenantId, workspaceId) {
      const { rows: wRows } = await pool.query(
        'SELECT * FROM workspaces WHERE tenant_id = $1 AND workspace_id = $2',
        [tenantId, workspaceId],
      )
      if (wRows.length === 0) return null

      const { rows: sRows } = await pool.query(
        'SELECT * FROM workspace_snapshots WHERE tenant_id = $1 AND workspace_id = $2',
        [tenantId, workspaceId],
      )
      if (sRows.length === 0) return null

      return assembleSnapshot(wRows[0], sRows[0])
    },

    async saveWorkspace(snapshot) {
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
      const incomingRevision = snapshot.workspace?.revision
      if (typeof incomingRevision !== 'number' || !Number.isFinite(incomingRevision)) {
        throw createValidationError('Hosted workspace save requires a numeric revision.')
      }

      return withTransaction(pool, async (client) => {
        // Verify actor membership
        const { rows: actorRows } = await client.query(
          'SELECT tenant_id FROM actors WHERE user_id = $1',
          [actorUserId],
        )
        if (actorRows.length === 0 || actorRows[0].tenant_id !== snapshot.tenantId) {
          throw createValidationError('Hosted workspace save requires a provisioned actor.')
        }

        const { rows: membershipRows } = await client.query(
          'SELECT 1 FROM workspace_memberships WHERE user_id = $1 AND tenant_id = $2 AND workspace_id = $3',
          [actorUserId, snapshot.tenantId, workspaceId],
        )
        if (membershipRows.length === 0) {
          throw createValidationError('Hosted workspace save requires workspace membership.')
        }

        // Optimistic concurrency check
        const { rows: currentRows } = await client.query(
          'SELECT revision FROM workspaces WHERE tenant_id = $1 AND workspace_id = $2',
          [snapshot.tenantId, workspaceId],
        )
        if (currentRows.length > 0) {
          const currentRevision = currentRows[0].revision
          if (incomingRevision < currentRevision) {
            throw createValidationError('Hosted workspace save rejected a stale workspace revision.')
          }
        }

        // Upsert workspace metadata
        await client.query(
          `INSERT INTO workspaces (tenant_id, account_id, workspace_id, name, revision, updated_at, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $6)
           ON CONFLICT (tenant_id, workspace_id) DO UPDATE SET
             name = EXCLUDED.name,
             revision = EXCLUDED.revision,
             updated_at = EXCLUDED.updated_at`,
          [snapshot.tenantId, actorRows[0].tenant_id, workspaceId, workspaceName, incomingRevision, updatedAt],
        )

        // Build normalized snapshot
        const normalizedSnapshot = {
          snapshotVersion: FACET_WORKSPACE_SNAPSHOT_VERSION,
          tenantId: snapshot.tenantId,
          userId: actorUserId,
          workspace: { id: workspaceId, name: workspaceName, revision: incomingRevision, updatedAt },
          artifacts: snapshot.artifacts ?? {},
          exportedAt,
        }

        // Upsert snapshot
        await client.query(
          `INSERT INTO workspace_snapshots (tenant_id, workspace_id, revision, user_id, artifacts, exported_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (tenant_id, workspace_id) DO UPDATE SET
             revision = EXCLUDED.revision,
             user_id = EXCLUDED.user_id,
             artifacts = EXCLUDED.artifacts,
             exported_at = EXCLUDED.exported_at`,
          [snapshot.tenantId, workspaceId, incomingRevision, actorUserId, JSON.stringify(normalizedSnapshot.artifacts), exportedAt],
        )

        return normalizedSnapshot
      })
    },

    async listWorkspacesForActor(actor) {
      const { rows } = await pool.query(
        `SELECT w.workspace_id, w.name, w.revision, w.updated_at, m.role, m.is_default
         FROM workspace_memberships m
         JOIN workspaces w ON w.tenant_id = m.tenant_id AND w.workspace_id = m.workspace_id
         WHERE m.user_id = $1
         ORDER BY m.is_default DESC, w.workspace_id ASC`,
        [actor.userId],
      )

      return rows.map((row) => ({
        workspaceId: row.workspace_id,
        name: row.name,
        revision: row.revision,
        updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
        role: row.role,
        isDefault: row.is_default,
      }))
    },

    async createWorkspace(actor, input = {}, timestamp) {
      const operationTimestamp = validateTimestamp(timestamp)
      const trimmedName = typeof input.name === 'string' ? input.name.trim() : ''
      const workspaceName = trimmedName ? validateWorkspaceName(trimmedName) : 'Facet Workspace'
      const requestedWorkspaceId =
        typeof input.workspaceId === 'string' ? validateWorkspaceId(input.workspaceId) : ''
      const workspaceId = requestedWorkspaceId || `workspace-${randomUUID()}`

      return withTransaction(pool, async (client) => {
        // Verify actor exists
        const { rows: actorRows } = await client.query(
          'SELECT tenant_id, account_id FROM actors WHERE user_id = $1',
          [actor.userId],
        )
        if (actorRows.length === 0 || actorRows[0].tenant_id !== actor.tenantId) {
          throw createValidationError('Hosted actor is not provisioned for workspace creation.')
        }

        // Check workspace doesn't already exist
        const { rows: existing } = await client.query(
          'SELECT 1 FROM workspaces WHERE tenant_id = $1 AND workspace_id = $2',
          [actor.tenantId, workspaceId],
        )
        if (existing.length > 0) {
          throw createValidationError(`Hosted workspace "${workspaceId}" already exists.`)
        }

        // Determine if this should be default (first workspace, or no current default)
        const { rows: currentMemberships } = await client.query(
          'SELECT workspace_id, is_default FROM workspace_memberships WHERE user_id = $1',
          [actor.userId],
        )
        const hasExistingDefault = currentMemberships.some((m) => m.is_default)
        const isDefault = currentMemberships.length === 0 || !hasExistingDefault

        // Insert workspace
        await client.query(
          `INSERT INTO workspaces (tenant_id, account_id, workspace_id, name, revision, created_at, updated_at)
           VALUES ($1, $2, $3, $4, 0, $5, $5)`,
          [actor.tenantId, actorRows[0].account_id, workspaceId, workspaceName, operationTimestamp],
        )

        // Insert membership
        await client.query(
          `INSERT INTO workspace_memberships (user_id, tenant_id, workspace_id, role, is_default)
           VALUES ($1, $2, $3, 'owner', $4)`,
          [actor.userId, actor.tenantId, workspaceId, isDefault],
        )

        // Insert empty snapshot
        const snapshot = createEmptySnapshot(
          { tenantId: actor.tenantId, userId: actor.userId },
          workspaceId,
          workspaceName,
          operationTimestamp,
        )
        await client.query(
          `INSERT INTO workspace_snapshots (tenant_id, workspace_id, revision, user_id, artifacts, exported_at)
           VALUES ($1, $2, 0, $3, $4, $5)`,
          [actor.tenantId, workspaceId, actor.userId, JSON.stringify(snapshot.artifacts), operationTimestamp],
        )

        const workspaceSummary = {
          workspaceId,
          name: workspaceName,
          revision: 0,
          updatedAt: operationTimestamp,
          role: 'owner',
          isDefault,
        }

        return { workspace: workspaceSummary, snapshot }
      })
    },

    async renameWorkspace(actor, workspaceId, name, timestamp) {
      const trimmedName = validateWorkspaceName(name)
      const operationTimestamp = validateTimestamp(timestamp)

      return withTransaction(pool, async (client) => {
        // Verify owner membership
        const { rows: membershipRows } = await client.query(
          `SELECT m.role, m.is_default FROM workspace_memberships m
           JOIN actors a ON a.user_id = m.user_id
           WHERE m.user_id = $1 AND m.tenant_id = $2 AND m.workspace_id = $3 AND a.tenant_id = $2`,
          [actor.userId, actor.tenantId, workspaceId],
        )
        if (membershipRows.length === 0 || membershipRows[0].role !== 'owner') {
          throw createValidationError('Hosted workspace rename requires owner access.')
        }

        // Update workspace: increment revision, set new name
        const { rows: updatedRows } = await client.query(
          `UPDATE workspaces SET name = $1, revision = revision + 1, updated_at = $2
           WHERE tenant_id = $3 AND workspace_id = $4
           RETURNING workspace_id, name, revision, updated_at`,
          [trimmedName, operationTimestamp, actor.tenantId, workspaceId],
        )
        if (updatedRows.length === 0) {
          throw createValidationError('Hosted workspace not found.')
        }

        const updatedWorkspace = updatedRows[0]
        const newRevision = updatedWorkspace.revision

        // Update snapshot metadata
        await client.query(
          `UPDATE workspace_snapshots SET
             revision = $1,
             artifacts = jsonb_set(artifacts, '{}', artifacts),
             exported_at = $2
           WHERE tenant_id = $3 AND workspace_id = $4`,
          [newRevision, operationTimestamp, actor.tenantId, workspaceId],
        )

        // Reload snapshot for return
        const { rows: sRows } = await client.query(
          'SELECT * FROM workspace_snapshots WHERE tenant_id = $1 AND workspace_id = $2',
          [actor.tenantId, workspaceId],
        )

        const workspaceSummary = {
          workspaceId,
          name: trimmedName,
          revision: newRevision,
          updatedAt: operationTimestamp,
          role: membershipRows[0].role,
          isDefault: membershipRows[0].is_default,
        }

        const snapshot = sRows.length > 0 ? {
          snapshotVersion: FACET_WORKSPACE_SNAPSHOT_VERSION,
          tenantId: actor.tenantId,
          userId: sRows[0].user_id,
          workspace: {
            id: workspaceId,
            name: trimmedName,
            revision: newRevision,
            updatedAt: operationTimestamp,
          },
          artifacts: sRows[0].artifacts,
          exportedAt: operationTimestamp,
        } : null

        return { workspace: workspaceSummary, snapshot }
      })
    },

    async deleteWorkspace(actor, workspaceId) {
      return withTransaction(pool, async (client) => {
        // Verify owner membership
        const { rows: membershipRows } = await client.query(
          `SELECT m.role FROM workspace_memberships m
           JOIN actors a ON a.user_id = m.user_id
           WHERE m.user_id = $1 AND m.tenant_id = $2 AND m.workspace_id = $3 AND a.tenant_id = $2`,
          [actor.userId, actor.tenantId, workspaceId],
        )
        if (membershipRows.length === 0 || membershipRows[0].role !== 'owner') {
          throw createValidationError('Hosted workspace deletion requires owner access.')
        }

        // Verify workspace exists
        const { rows: wRows } = await client.query(
          'SELECT 1 FROM workspaces WHERE tenant_id = $1 AND workspace_id = $2',
          [actor.tenantId, workspaceId],
        )
        if (wRows.length === 0) {
          throw createValidationError('Hosted workspace not found.')
        }

        // Delete workspace (cascades to memberships and snapshots)
        await client.query(
          'DELETE FROM workspaces WHERE tenant_id = $1 AND workspace_id = $2',
          [actor.tenantId, workspaceId],
        )

        // Reassign default if needed
        const { rows: remaining } = await client.query(
          `SELECT workspace_id, is_default FROM workspace_memberships
           WHERE user_id = $1 ORDER BY is_default DESC, workspace_id ASC`,
          [actor.userId],
        )

        let defaultWorkspaceId = null
        if (remaining.length > 0) {
          const hasDefault = remaining.some((m) => m.is_default)
          if (!hasDefault) {
            // Promote first remaining workspace to default
            await client.query(
              `UPDATE workspace_memberships SET is_default = true
               WHERE user_id = $1 AND tenant_id = $2 AND workspace_id = $3`,
              [actor.userId, actor.tenantId, remaining[0].workspace_id],
            )
            defaultWorkspaceId = remaining[0].workspace_id
          } else {
            defaultWorkspaceId = remaining.find((m) => m.is_default)?.workspace_id ?? remaining[0].workspace_id
          }
        }

        return { deletedWorkspaceId: workspaceId, defaultWorkspaceId }
      })
    },
  }
}
