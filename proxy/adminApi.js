function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function cloneValue(value) {
  return structuredClone(value)
}

function normalizeProcessedAt(value) {
  if (value instanceof Date) {
    return value.toISOString()
  }

  if (typeof value === 'string' && value.trim()) {
    return value
  }

  return null
}

function normalizeWebhookReceipt(value) {
  if (!isRecord(value)) {
    return null
  }

  const eventId =
    typeof value.event_id === 'string'
      ? value.event_id.trim()
      : typeof value.eventId === 'string'
        ? value.eventId.trim()
        : ''
  const eventType =
    typeof value.event_type === 'string'
      ? value.event_type.trim()
      : typeof value.eventType === 'string'
        ? value.eventType.trim()
        : ''
  const processedAt = normalizeProcessedAt(value.processed_at ?? value.processedAt)

  if (!eventId || !eventType || !processedAt) {
    return null
  }

  return {
    event_id: eventId,
    event_type: eventType,
    tenant_id:
      typeof value.tenant_id === 'string'
        ? value.tenant_id
        : typeof value.tenantId === 'string'
          ? value.tenantId
          : null,
    account_id:
      typeof value.account_id === 'string'
        ? value.account_id
        : typeof value.accountId === 'string'
          ? value.accountId
          : null,
    processed_at: processedAt,
    payload: value.payload ?? null,
  }
}

function normalizeCreatedAt(value) {
  if (value instanceof Date) {
    return value.toISOString()
  }

  if (typeof value === 'string' && value.trim()) {
    return value
  }

  return null
}

function timestampMs(value) {
  const parsed = typeof value === 'string' ? Date.parse(value) : Number.NaN
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeWorkspaceCount(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value))
  }

  if (typeof value === 'bigint') {
    return Number(value)
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseInt(value, 10)
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0
  }

  return 0
}

function normalizeInteger(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value)
  }

  if (typeof value === 'bigint') {
    return Number(value)
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseInt(value, 10)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function normalizeActorRecord(value) {
  if (!isRecord(value)) {
    return null
  }

  const userId =
    typeof value.user_id === 'string'
      ? value.user_id.trim()
      : typeof value.userId === 'string'
        ? value.userId.trim()
        : ''
  const tenantId =
    typeof value.tenant_id === 'string'
      ? value.tenant_id.trim()
      : typeof value.tenantId === 'string'
        ? value.tenantId.trim()
        : null
  const accountId =
    typeof value.account_id === 'string'
      ? value.account_id.trim()
      : typeof value.accountId === 'string'
        ? value.accountId.trim()
        : null
  const email = typeof value.email === 'string' ? value.email.trim() : null
  const createdAt = normalizeCreatedAt(value.created_at ?? value.createdAt)

  if (!userId || !createdAt) {
    return null
  }

  return {
    user_id: userId,
    tenant_id: tenantId || null,
    account_id: accountId || null,
    email,
    created_at: createdAt,
    workspace_count: normalizeWorkspaceCount(value.workspace_count ?? value.workspaceCount),
  }
}

function normalizeWorkspaceRecord(value) {
  if (!isRecord(value)) {
    return null
  }

  const tenantId =
    typeof value.tenant_id === 'string'
      ? value.tenant_id.trim()
      : typeof value.tenantId === 'string'
        ? value.tenantId.trim()
        : ''
  const workspaceId =
    typeof value.workspace_id === 'string'
      ? value.workspace_id.trim()
      : typeof value.workspaceId === 'string'
        ? value.workspaceId.trim()
        : ''
  const name = typeof value.name === 'string' ? value.name.trim() : ''
  const revision = normalizeInteger(value.revision)
  const createdAt = normalizeCreatedAt(value.created_at ?? value.createdAt)
  const updatedAt = normalizeCreatedAt(value.updated_at ?? value.updatedAt)

  if (!tenantId || !workspaceId) {
    return null
  }

  return {
    tenant_id: tenantId,
    workspace_id: workspaceId,
    name: name || null,
    revision,
    created_at: createdAt,
    updated_at: updatedAt,
    snapshot_revision: normalizeInteger(value.snapshot_revision ?? value.snapshotRevision),
    snapshot_exported_at: normalizeCreatedAt(
      value.snapshot_exported_at ?? value.snapshotExportedAt,
    ),
    owner_user_id:
      typeof value.owner_user_id === 'string'
        ? value.owner_user_id.trim() || null
        : typeof value.ownerUserId === 'string'
          ? value.ownerUserId.trim() || null
          : null,
    owner_email:
      typeof value.owner_email === 'string'
        ? value.owner_email.trim() || null
        : typeof value.ownerEmail === 'string'
          ? value.ownerEmail.trim() || null
          : null,
  }
}

function normalizeWorkspaceMembership(value) {
  if (!isRecord(value)) {
    return null
  }

  const userId =
    typeof value.user_id === 'string'
      ? value.user_id.trim()
      : typeof value.userId === 'string'
        ? value.userId.trim()
        : ''
  const tenantId =
    typeof value.tenant_id === 'string'
      ? value.tenant_id.trim()
      : typeof value.tenantId === 'string'
        ? value.tenantId.trim()
        : ''
  const workspaceId =
    typeof value.workspace_id === 'string'
      ? value.workspace_id.trim()
      : typeof value.workspaceId === 'string'
        ? value.workspaceId.trim()
        : ''

  if (!userId || !tenantId || !workspaceId) {
    return null
  }

  return {
    user_id: userId,
    tenant_id: tenantId,
    workspace_id: workspaceId,
    is_default: Boolean(value.is_default ?? value.isDefault),
  }
}

function normalizeWorkspaceSnapshotRecord(value) {
  if (!isRecord(value)) {
    return null
  }

  const tenantId =
    typeof value.tenant_id === 'string'
      ? value.tenant_id.trim()
      : typeof value.tenantId === 'string'
        ? value.tenantId.trim()
        : ''
  const workspaceId =
    typeof value.workspace_id === 'string'
      ? value.workspace_id.trim()
      : typeof value.workspaceId === 'string'
        ? value.workspaceId.trim()
        : ''
  const revision = normalizeInteger(value.revision)

  if (!tenantId || !workspaceId || revision === null) {
    return null
  }

  return {
    tenant_id: tenantId,
    workspace_id: workspaceId,
    revision,
    exported_at: normalizeCreatedAt(value.exported_at ?? value.exportedAt),
  }
}

function normalizeBillingRecord(value) {
  if (!isRecord(value)) {
    return null
  }

  const tenantId =
    typeof value.tenant_id === 'string'
      ? value.tenant_id.trim()
      : typeof value.tenantId === 'string'
        ? value.tenantId.trim()
        : ''
  const accountId =
    typeof value.account_id === 'string'
      ? value.account_id.trim()
      : typeof value.accountId === 'string'
        ? value.accountId.trim()
        : ''
  const updatedAt = normalizeCreatedAt(value.updated_at ?? value.updatedAt)

  if (!tenantId || !accountId || !updatedAt) {
    return null
  }

  return {
    tenant_id: tenantId,
    account_id: accountId,
    owner_email:
      typeof value.owner_email === 'string'
        ? value.owner_email
        : typeof value.ownerEmail === 'string'
          ? value.ownerEmail
          : null,
    customer: value.customer ?? null,
    subscription: value.subscription ?? value.pass ?? null,
    entitlement: value.entitlement ?? null,
    updated_at: updatedAt,
  }
}

function parseLimitedQuery(searchParams) {
  const rawLimit = searchParams.get('limit')
  const parsedLimit = rawLimit ? Number.parseInt(rawLimit, 10) : 100
  return Number.isFinite(parsedLimit) ? Math.max(1, Math.min(500, parsedLimit)) : 100
}

function parseWebhookQuery(searchParams) {
  const limit = parseLimitedQuery(searchParams)

  const rawSince = searchParams.get('since')
  if (!rawSince) {
    return { limit, since: null, error: null }
  }

  const since = rawSince.trim()
  const isoTimestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/
  if (!since || !isoTimestampPattern.test(since) || Number.isNaN(Date.parse(since))) {
    return {
      limit,
      since: null,
      error: {
        status: 400,
        body: {
          error: 'Admin webhooks since must be a valid ISO timestamp.',
          code: 'invalid_since',
        },
      },
    }
  }

  return { limit, since, error: null }
}

function parseActorsQuery(searchParams) {
  const limit = parseLimitedQuery(searchParams)
  const tenantId = searchParams.get('tenant_id')?.trim() || null
  const query = searchParams.get('q')?.trim() || null
  if (query && query.length > 256) {
    return {
      limit,
      tenantId,
      query: null,
      error: {
        status: 400,
        body: {
          error: 'Admin actors search query must be 256 characters or fewer.',
          code: 'invalid_query',
        },
      },
    }
  }

  return { limit, tenantId, query, error: null }
}

function parseWorkspacesQuery(searchParams) {
  return {
    limit: parseLimitedQuery(searchParams),
    tenantId: searchParams.get('tenant_id')?.trim() || null,
    userId: searchParams.get('user_id')?.trim() || null,
  }
}

function parseBillingQuery(searchParams) {
  return {
    limit: parseLimitedQuery(searchParams),
    tenantId: searchParams.get('tenant_id')?.trim() || null,
    accountId: searchParams.get('account_id')?.trim() || null,
  }
}

export function requireAdmin(req, res, next, options = {}) {
  const claims = isRecord(req._facetHostedClaims) ? req._facetHostedClaims : null
  const verifiedActor = isRecord(req._facetHostedActor) ? req._facetHostedActor : null
  const appMetadata = isRecord(claims?.app_metadata) ? claims.app_metadata : null
  if (verifiedActor?.authMode === 'hosted' && appMetadata?.role === 'admin') {
    next()
    return
  }

  const userId =
    typeof claims?.sub === 'string' && claims.sub.trim()
      ? claims.sub.trim()
      : typeof req._facetHostedActor?.userId === 'string'
        ? req._facetHostedActor.userId
        : 'unknown'
  const logger = options.logger ?? console
  logger.warn?.('[proxy] admin_auth_denied', { user_id: userId })
  const sendJson = options.sendJson
  if (typeof sendJson !== 'function') {
    throw new Error('requireAdmin requires a sendJson option.')
  }
  sendJson(res, 403, {
    error: 'Admin access required.',
    code: 'admin_required',
  })
}

export function createInMemoryAdminStore(records = {}) {
  const webhooks = Array.isArray(records) ? records : records.webhooks
  const actors = Array.isArray(records) ? [] : records.actors
  const workspaces = Array.isArray(records) ? [] : records.workspaces
  const workspaceMemberships = Array.isArray(records)
    ? []
    : (records.workspaceMemberships ?? records.memberships)
  const workspaceSnapshots = Array.isArray(records)
    ? []
    : (records.workspaceSnapshots ?? records.snapshots)
  const billing = Array.isArray(records) ? [] : records.billing
  const receipts = Array.isArray(webhooks)
    ? webhooks.map(normalizeWebhookReceipt).filter(Boolean)
    : []
  const actorRecords = Array.isArray(actors) ? actors.map(normalizeActorRecord).filter(Boolean) : []
  const workspaceRecords = Array.isArray(workspaces)
    ? workspaces.map(normalizeWorkspaceRecord).filter(Boolean)
    : []
  const membershipRecords = Array.isArray(workspaceMemberships)
    ? workspaceMemberships.map(normalizeWorkspaceMembership).filter(Boolean)
    : []
  const workspaceSnapshotRecords = Array.isArray(workspaceSnapshots)
    ? workspaceSnapshots.map(normalizeWorkspaceSnapshotRecord).filter(Boolean)
    : []
  const billingRecords = Array.isArray(billing)
    ? billing.map(normalizeBillingRecord).filter(Boolean)
    : []

  return {
    async listWebhookReceipts({ limit = 100, since = null } = {}) {
      const sinceMs = since ? Date.parse(since) : null
      return cloneValue(
        receipts
          .filter((receipt) => sinceMs === null || Date.parse(receipt.processed_at) >= sinceMs)
          .sort((left, right) => Date.parse(right.processed_at) - Date.parse(left.processed_at))
          .slice(0, limit),
      )
    },

    async listActors({ limit = 100, tenantId = null, query = null } = {}) {
      const normalizedQuery = typeof query === 'string' ? query.toLowerCase() : null
      return cloneValue(
        actorRecords
          .filter((actor) => tenantId === null || actor.tenant_id === tenantId)
          .filter(
            (actor) =>
              normalizedQuery === null ||
              (actor.email ?? '').toLowerCase().includes(normalizedQuery),
          )
          .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))
          .slice(0, limit),
      )
    },

    async listWorkspaces({ limit = 100, tenantId = null, userId = null } = {}) {
      return cloneValue(
        workspaceRecords
          .filter((workspace) => tenantId === null || workspace.tenant_id === tenantId)
          .filter(
            (workspace) =>
              userId === null ||
              membershipRecords.some(
                (membership) =>
                  membership.user_id === userId &&
                  membership.tenant_id === workspace.tenant_id &&
                  membership.workspace_id === workspace.workspace_id,
              ),
          )
          .sort((left, right) => timestampMs(right.updated_at) - timestampMs(left.updated_at))
          .slice(0, limit)
          .map((workspace) => {
            const snapshot = workspaceSnapshotRecords
              .filter(
                (entry) =>
                  entry.tenant_id === workspace.tenant_id &&
                  entry.workspace_id === workspace.workspace_id,
              )
              .sort((left, right) => right.revision - left.revision)[0]
            const ownerMembership = membershipRecords.find(
              (membership) =>
                membership.tenant_id === workspace.tenant_id &&
                membership.workspace_id === workspace.workspace_id &&
                membership.is_default,
            )
            const ownerActor = actorRecords.find(
              (actor) =>
                ownerMembership?.user_id === actor.user_id &&
                actor.tenant_id === workspace.tenant_id,
            )

            return {
              ...workspace,
              snapshot_revision: workspace.snapshot_revision ?? snapshot?.revision ?? null,
              snapshot_exported_at: workspace.snapshot_exported_at ?? snapshot?.exported_at ?? null,
              owner_user_id: workspace.owner_user_id ?? ownerMembership?.user_id ?? null,
              owner_email: workspace.owner_email ?? ownerActor?.email ?? null,
            }
          }),
      )
    },

    async listBilling({ limit = 100, tenantId = null, accountId = null } = {}) {
      return cloneValue(
        billingRecords
          .filter((entry) => tenantId === null || entry.tenant_id === tenantId)
          .filter((entry) => accountId === null || entry.account_id === accountId)
          .sort((left, right) => timestampMs(right.updated_at) - timestampMs(left.updated_at))
          .slice(0, limit)
          .map((entry) => {
            const ownerActor = actorRecords.find(
              (actor) =>
                actor.tenant_id === entry.tenant_id && actor.account_id === entry.account_id,
            )

            return {
              ...entry,
              owner_email: entry.owner_email ?? ownerActor?.email ?? null,
            }
          }),
      )
    },
  }
}

export function createPostgresAdminStore(pool) {
  return {
    async listWebhookReceipts({ limit = 100, since = null } = {}) {
      const { rows } = await pool.query(
        `SELECT event_id, event_type, tenant_id, account_id, processed_at, payload
         FROM webhook_event_receipts
         WHERE ($1::timestamptz IS NULL OR processed_at >= $1::timestamptz)
         ORDER BY processed_at DESC
         LIMIT $2`,
        [since, limit],
      )

      return rows.map(normalizeWebhookReceipt).filter(Boolean)
    },

    async listActors({ limit = 100, tenantId = null, query = null } = {}) {
      const { rows } = await pool.query(
        `SELECT a.user_id,
                a.tenant_id,
                a.account_id,
                a.email,
                a.created_at,
                (
                  SELECT COUNT(*)::int
                  FROM workspace_memberships m
                  WHERE m.user_id = a.user_id AND m.tenant_id = a.tenant_id
                ) AS workspace_count
         FROM actors a
         WHERE ($1::text IS NULL OR a.tenant_id = $1::text)
           AND ($2::text IS NULL OR POSITION(lower($2::text) IN lower(COALESCE(a.email, ''))) > 0)
         ORDER BY a.created_at DESC
         LIMIT $3`,
        [tenantId, query, limit],
      )

      return rows.map(normalizeActorRecord).filter(Boolean)
    },

    async listWorkspaces({ limit = 100, tenantId = null, userId = null } = {}) {
      const { rows } = await pool.query(
        `SELECT w.tenant_id,
                w.workspace_id,
                w.name,
                w.revision,
                w.created_at,
                w.updated_at,
                s.revision AS snapshot_revision,
                s.exported_at AS snapshot_exported_at,
                owner_m.user_id AS owner_user_id,
                owner.email AS owner_email
         FROM workspaces w
         LEFT JOIN LATERAL (
           SELECT s.revision, s.exported_at
           FROM workspace_snapshots s
           WHERE s.tenant_id = w.tenant_id AND s.workspace_id = w.workspace_id
           ORDER BY s.revision DESC
           LIMIT 1
         ) s ON true
         LEFT JOIN LATERAL (
           SELECT m.user_id
           FROM workspace_memberships m
           WHERE m.tenant_id = w.tenant_id
             AND m.workspace_id = w.workspace_id
             AND m.is_default = true
           ORDER BY m.user_id ASC
           LIMIT 1
         ) owner_m ON true
         LEFT JOIN actors owner
           ON owner.user_id = owner_m.user_id AND owner.tenant_id = w.tenant_id
         WHERE ($1::text IS NULL OR w.tenant_id = $1::text)
           AND (
             $2::text IS NULL
             OR EXISTS (
               SELECT 1
               FROM workspace_memberships member_filter
               WHERE member_filter.user_id = $2::text
                 AND member_filter.tenant_id = w.tenant_id
                 AND member_filter.workspace_id = w.workspace_id
             )
           )
         ORDER BY w.updated_at DESC
         LIMIT $3`,
        [tenantId, userId, limit],
      )

      return rows.map(normalizeWorkspaceRecord).filter(Boolean)
    },

    async listBilling({ limit = 100, tenantId = null, accountId = null } = {}) {
      const { rows } = await pool.query(
        `SELECT b.tenant_id,
                b.account_id,
                owner.email AS owner_email,
                b.customer,
                b.pass AS subscription,
                b.entitlement,
                b.updated_at
         FROM billing_accounts b
         LEFT JOIN LATERAL (
           SELECT a.email
           FROM actors a
           WHERE a.tenant_id = b.tenant_id AND a.account_id = b.account_id
           ORDER BY a.created_at ASC
           LIMIT 1
         ) owner ON true
         WHERE ($1::text IS NULL OR b.tenant_id = $1::text)
           AND ($2::text IS NULL OR b.account_id = $2::text)
         ORDER BY b.updated_at DESC
         LIMIT $3`,
        [tenantId, accountId, limit],
      )

      return rows.map(normalizeBillingRecord).filter(Boolean)
    },
  }
}

export function createAdminApi({
  actorResolver,
  adminStore,
  enforceRateLimit,
  logger = console,
  onEvent,
}) {
  const webhooksRoute = '/admin/webhooks'
  const actorsRoute = '/admin/actors'
  const workspacesRoute = '/admin/workspaces'
  const billingRoute = '/admin/billing'
  const routeScopes = new Map([
    [webhooksRoute, 'admin.webhooks'],
    [actorsRoute, 'admin.actors'],
    [workspacesRoute, 'admin.workspaces'],
    [billingRoute, 'admin.billing'],
  ])

  return {
    canHandle(req) {
      const url = new URL(req.url ?? '/', 'http://localhost')
      return req.method === 'GET' && routeScopes.has(url.pathname)
    },

    async handle(req, res, sendJson) {
      const url = new URL(req.url ?? '/', 'http://localhost')
      const eventScope = routeScopes.get(url.pathname) ?? 'admin.unknown'
      let actor
      try {
        actor = await actorResolver(req)
      } catch (error) {
        const status = error?.status === 403 ? 403 : error?.status === 401 ? 401 : null
        if (!status) {
          throw error
        }

        onEvent?.(eventScope, 'denied', {
          code: 'auth_required',
          method: req.method,
          path: url.pathname,
        })
        sendJson(res, status, {
          error: status === 401 ? 'Authorization required.' : 'Admin access required.',
          code: status === 401 ? 'auth_required' : 'admin_required',
        })
        return
      }

      if (
        typeof enforceRateLimit === 'function' &&
        !enforceRateLimit(req, res, url.pathname, actor)
      ) {
        return
      }

      let allowed = false
      requireAdmin(
        req,
        res,
        () => {
          allowed = true
        },
        { sendJson, logger },
      )

      if (!allowed) {
        onEvent?.(eventScope, 'denied', {
          method: req.method,
          path: url.pathname,
          userId: actor?.userId,
        })
        return
      }

      if (url.pathname === actorsRoute) {
        if (!adminStore || typeof adminStore.listActors !== 'function') {
          sendJson(res, 500, {
            error: 'Admin actors store is unavailable.',
            code: 'admin_store_unavailable',
          })
          return
        }

        const query = parseActorsQuery(url.searchParams)
        if (query.error) {
          sendJson(res, query.error.status, query.error.body)
          return
        }

        let actors
        try {
          actors = await adminStore.listActors({
            limit: query.limit,
            tenantId: query.tenantId,
            query: query.query,
          })
        } catch (error) {
          onEvent?.('admin.actors', 'error', {
            code: 'actors_unavailable',
            method: req.method,
            path: url.pathname,
            userId: actor.userId,
          })
          throw error
        }
        onEvent?.('admin.actors', 'success', {
          actorCount: actors.length,
          method: req.method,
          path: url.pathname,
          userId: actor.userId,
        })
        res.setHeader('Cache-Control', 'no-store')
        res.setHeader('Pragma', 'no-cache')
        res.setHeader('Vary', 'Authorization')
        sendJson(res, 200, { actors })
        return
      }

      if (url.pathname === workspacesRoute) {
        if (!adminStore || typeof adminStore.listWorkspaces !== 'function') {
          sendJson(res, 500, {
            error: 'Admin workspaces store is unavailable.',
            code: 'admin_store_unavailable',
          })
          return
        }

        const query = parseWorkspacesQuery(url.searchParams)
        let workspaces
        try {
          workspaces = await adminStore.listWorkspaces({
            limit: query.limit,
            tenantId: query.tenantId,
            userId: query.userId,
          })
        } catch (error) {
          onEvent?.('admin.workspaces', 'error', {
            code: 'workspaces_unavailable',
            method: req.method,
            path: url.pathname,
            userId: actor.userId,
          })
          throw error
        }
        onEvent?.('admin.workspaces', 'success', {
          method: req.method,
          path: url.pathname,
          userId: actor.userId,
          workspaceCount: workspaces.length,
        })
        res.setHeader('Cache-Control', 'no-store')
        res.setHeader('Pragma', 'no-cache')
        res.setHeader('Vary', 'Authorization')
        sendJson(res, 200, { workspaces })
        return
      }

      if (url.pathname === billingRoute) {
        if (!adminStore || typeof adminStore.listBilling !== 'function') {
          sendJson(res, 500, {
            error: 'Admin billing store is unavailable.',
            code: 'admin_store_unavailable',
          })
          return
        }

        const query = parseBillingQuery(url.searchParams)
        let billing
        try {
          billing = await adminStore.listBilling({
            limit: query.limit,
            tenantId: query.tenantId,
            accountId: query.accountId,
          })
        } catch (error) {
          onEvent?.('admin.billing', 'error', {
            code: 'billing_unavailable',
            method: req.method,
            path: url.pathname,
            userId: actor.userId,
          })
          throw error
        }
        onEvent?.('admin.billing', 'success', {
          billingCount: billing.length,
          includesPayload: true,
          method: req.method,
          path: url.pathname,
          userId: actor.userId,
        })
        res.setHeader('Cache-Control', 'no-store')
        res.setHeader('Pragma', 'no-cache')
        res.setHeader('Vary', 'Authorization')
        sendJson(res, 200, { billing })
        return
      }

      if (!adminStore || typeof adminStore.listWebhookReceipts !== 'function') {
        sendJson(res, 500, {
          error: 'Admin webhook receipt store is unavailable.',
          code: 'admin_store_unavailable',
        })
        return
      }

      const query = parseWebhookQuery(url.searchParams)
      if (query.error) {
        sendJson(res, query.error.status, query.error.body)
        return
      }

      let webhooks
      try {
        webhooks = await adminStore.listWebhookReceipts({
          limit: query.limit,
          since: query.since,
        })
      } catch (error) {
        onEvent?.('admin.webhooks', 'error', {
          code: 'webhook_receipts_unavailable',
          method: req.method,
          path: url.pathname,
          userId: actor.userId,
        })
        throw error
      }
      onEvent?.('admin.webhooks', 'success', {
        includesPayload: true,
        method: req.method,
        path: url.pathname,
        receiptCount: webhooks.length,
        userId: actor.userId,
      })
      res.setHeader('Cache-Control', 'no-store')
      res.setHeader('Pragma', 'no-cache')
      res.setHeader('Vary', 'Authorization')
      sendJson(res, 200, { webhooks })
    },
  }
}
