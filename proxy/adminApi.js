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

  const eventId = typeof value.event_id === 'string'
    ? value.event_id.trim()
    : typeof value.eventId === 'string'
      ? value.eventId.trim()
      : ''
  const eventType = typeof value.event_type === 'string'
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

function parseWebhookQuery(searchParams) {
  const rawLimit = searchParams.get('limit')
  const parsedLimit = rawLimit ? Number.parseInt(rawLimit, 10) : 100
  const limit = Number.isFinite(parsedLimit)
    ? Math.max(1, Math.min(500, parsedLimit))
    : 100

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

export function createInMemoryAdminStore(records = []) {
  const receipts = records.map(normalizeWebhookReceipt).filter(Boolean)

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

  return {
    canHandle(req) {
      const url = new URL(req.url ?? '/', 'http://localhost')
      return req.method === 'GET' && url.pathname === webhooksRoute
    },

    async handle(req, res, sendJson) {
      const url = new URL(req.url ?? '/', 'http://localhost')
      let actor
      try {
        actor = await actorResolver(req)
      } catch (error) {
        const status = error?.status === 403 ? 403 : error?.status === 401 ? 401 : null
        if (!status) {
          throw error
        }

        onEvent?.('admin.webhooks', 'denied', {
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
      requireAdmin(req, res, () => {
        allowed = true
      }, { sendJson, logger })

      if (!allowed) {
        onEvent?.('admin.webhooks', 'denied', {
          method: req.method,
          path: url.pathname,
          userId: actor?.userId,
        })
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
