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

function parseWebhookQuery(searchParams) {
  const rawLimit = searchParams.get('limit')
  const parsedLimit = rawLimit ? Number.parseInt(rawLimit, 10) : 100
  const limit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(500, parsedLimit)) : 100

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
  const rawLimit = searchParams.get('limit')
  const parsedLimit = rawLimit ? Number.parseInt(rawLimit, 10) : 100
  const limit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(500, parsedLimit)) : 100
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
  const receipts = Array.isArray(webhooks)
    ? webhooks.map(normalizeWebhookReceipt).filter(Boolean)
    : []
  const actorRecords = Array.isArray(actors) ? actors.map(normalizeActorRecord).filter(Boolean) : []

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

  return {
    canHandle(req) {
      const url = new URL(req.url ?? '/', 'http://localhost')
      return (
        req.method === 'GET' && (url.pathname === webhooksRoute || url.pathname === actorsRoute)
      )
    },

    async handle(req, res, sendJson) {
      const url = new URL(req.url ?? '/', 'http://localhost')
      const eventScope = url.pathname === actorsRoute ? 'admin.actors' : 'admin.webhooks'
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
