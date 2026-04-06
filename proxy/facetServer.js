import { createServer } from 'node:http'
import { createReadStream } from 'node:fs'
import { realpath, stat } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import Anthropic from '@anthropic-ai/sdk'
import {
  createInMemoryWorkspaceStore,
  createTokenActorResolver,
  createPersistenceApi,
  DEFAULT_PERSISTENCE_AUTH_TOKENS,
  parsePersistenceAuthTokens,
} from './persistenceApi.js'
import {
  createBillingApi,
  createBillingWebhookHandler,
  createStripeBillingClient,
} from './billingApi.js'
import {
  createHostedAiErrorPayload,
  isFacetAiFeatureKey,
  resolveHostedAiAccess,
} from './aiAccess.js'
import {
  createFileHostedBillingStore,
  createInMemoryHostedBillingStore,
} from './billingState.js'
import {
  createHostedSessionActorResolver,
} from './hostedAuth.js'
import {
  createFileHostedWorkspaceStore,
  createInMemoryHostedWorkspaceStore,
} from './hostedWorkspaceStore.js'
import { createPostgresWorkspaceStore } from './postgresWorkspaceStore.js'
import { createPostgresBillingStore } from './postgresBillingStore.js'
import pg from 'pg'

const DEFAULT_MODEL = 'claude-sonnet-4-20250514'
const DEFAULT_PROXY_API_KEY = 'facet-local-proxy'
const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173']
const TEXT_UTF8_EXTENSIONS = new Set(['.css', '.html', '.js', '.json', '.map', '.svg', '.txt', '.xml'])
const STATIC_CONTENT_TYPES = {
  '.css': 'text/css',
  '.gif': 'image/gif',
  '.html': 'text/html',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.map': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain',
  '.wasm': 'application/wasm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml',
}

const MODEL_ALIASES = {
  haiku: 'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-4-20250514',
  opus: 'claude-opus-4-20250514',
}

const DEFAULT_HOSTED_RATE_LIMITS = {
  ai: { max: 30, windowMs: 60_000 },
  billingMutations: { max: 12, windowMs: 60_000 },
  persistenceMutations: { max: 120, windowMs: 60_000 },
}

export const formatModelAliases = () =>
  Object.entries(MODEL_ALIASES)
    .map(([alias, model]) => `${alias} -> ${model}`)
    .join(', ')

function createUnauthenticatedAnthropicCompatClient({ baseURL }) {
  const normalizedBaseUrl = baseURL.replace(/\/+$/, '')

  return {
    messages: {
      async create(params) {
        const response = await fetch(`${normalizedBaseUrl}/v1/messages`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify(params),
        })

        const contentType = response.headers.get('content-type') ?? ''
        const payload = contentType.includes('application/json')
          ? await response.json()
          : await response.text()

        if (!response.ok) {
          const message =
            typeof payload === 'string'
              ? payload
              : payload?.error?.message ?? payload?.message ?? 'Anthropic-compatible upstream error'
          const error = new Error(message)
          error.status = response.status
          error.payload = payload
          throw error
        }

        return payload
      },
    },
  }
}

function parsePositiveInteger(value, fallback) {
  const parsed = parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function createHostedOperationsMonitor({
  now = () => Date.now(),
  logger = console,
  rateLimits = DEFAULT_HOSTED_RATE_LIMITS,
} = {}) {
  const counters = new Map()
  const recentEvents = new Array(50)
  let recentEventCount = 0
  let nextRecentEventIndex = 0

  return {
    record(scope, result, details = {}) {
      const counterKey = [scope, result, details.code, details.reason]
        .filter(Boolean)
        .join('.')
      counters.set(counterKey, (counters.get(counterKey) ?? 0) + 1)

      const event = {
        at: new Date(now()).toISOString(),
        scope,
        result,
        ...details,
      }
      recentEvents[nextRecentEventIndex] = event
      nextRecentEventIndex = (nextRecentEventIndex + 1) % recentEvents.length
      recentEventCount = Math.min(recentEventCount + 1, recentEvents.length)

      const message = `[hosted-ops] ${JSON.stringify(event)}`
      if (result === 'error') {
        logger.error(message)
      } else if (result === 'denied' || result === 'rate_limited') {
        logger.warn(message)
      } else {
        logger.info(message)
      }
    },

    snapshot() {
      return {
        counters: Object.fromEntries(
          [...counters.entries()].sort(([left], [right]) => left.localeCompare(right)),
        ),
        recentEvents: Array.from({ length: recentEventCount }, (_, index) => {
          const offset = (nextRecentEventIndex - recentEventCount + index + recentEvents.length) % recentEvents.length
          return recentEvents[offset]
        }).filter(Boolean),
        rateLimits,
      }
    },
  }
}

function createFixedWindowRateLimiter({
  now = () => Date.now(),
  limits = DEFAULT_HOSTED_RATE_LIMITS,
} = {}) {
  const windows = new Map()
  const cleanupIntervalMs = Math.max(
    1_000,
    Math.min(...Object.values(limits).map((config) => config.windowMs)),
  )
  const cleanupExpired = () => {
    const currentTime = now()
    for (const [existingKey, entry] of windows.entries()) {
      if (entry.expiresAt <= currentTime) {
        windows.delete(existingKey)
      }
    }
  }
  const cleanupTimer = setInterval(cleanupExpired, cleanupIntervalMs)
  cleanupTimer.unref?.()

  return {
    consume(bucket, key) {
      const config = limits[bucket]
      if (!config?.max || !config?.windowMs) {
        return { allowed: true, retryAfterSeconds: 0 }
      }

      const bucketKey = `${bucket}:${key}`
      const currentTime = now()
      const currentWindow = windows.get(bucketKey)
      if (!currentWindow || currentWindow.expiresAt <= currentTime) {
        windows.set(bucketKey, {
          count: 1,
          expiresAt: currentTime + config.windowMs,
        })
        return { allowed: true, retryAfterSeconds: 0 }
      }

      if (currentWindow.count >= config.max) {
        return {
          allowed: false,
          retryAfterSeconds: Math.max(
            1,
            Math.ceil((currentWindow.expiresAt - currentTime) / 1000),
          ),
        }
      }

      currentWindow.count += 1
      return { allowed: true, retryAfterSeconds: 0 }
    },

    dispose() {
      clearInterval(cleanupTimer)
      windows.clear()
    },
  }
}

function resolveHostedRateLimitBucket(req, pathname) {
  if (pathname === '/' && req.method === 'POST') {
    return 'ai'
  }

  if (
    pathname === '/api/billing/customer' ||
    pathname === '/api/billing/checkout-session'
  ) {
    return 'billingMutations'
  }

  if (pathname === '/api/persistence/workspaces' && req.method === 'POST') {
    return 'persistenceMutations'
  }

  if (
    pathname.startsWith('/api/persistence/workspaces/') &&
    (req.method === 'PUT' || req.method === 'PATCH' || req.method === 'DELETE')
  ) {
    return 'persistenceMutations'
  }

  return null
}

function extractBearerToken(authorizationHeader) {
  if (typeof authorizationHeader !== 'string') {
    return null
  }

  const match = authorizationHeader.match(/^Bearer\s+(\S+)$/i)
  return match?.[1] ?? null
}

const ALLOWED_TOOL_TYPES = new Set(['web_search_20250305'])

function resolveModel(requested, defaultModel) {
  if (!requested) return defaultModel
  return MODEL_ALIASES[requested] ?? requested
}

function hasValidMessages(messages) {
  return Array.isArray(messages) && messages.every((message) => (
    message &&
    typeof message === 'object' &&
    typeof message.role === 'string' &&
    (typeof message.content === 'string' || Array.isArray(message.content))
  ))
}

function normalizeTools(tools) {
  if (!Array.isArray(tools)) {
    return []
  }

  return tools.flatMap((tool) => {
    if (!tool || typeof tool !== 'object') {
      return []
    }

    const normalized = {
      type: tool.type,
      name: tool.name,
      max_uses:
        typeof tool.max_uses === 'number'
          ? Math.max(1, Math.min(15, Math.floor(tool.max_uses)))
          : undefined,
    }

    if (
      !ALLOWED_TOOL_TYPES.has(normalized.type) ||
      normalized.name !== 'web_search'
    ) {
      return []
    }

    return [normalized.max_uses ? normalized : { type: normalized.type, name: normalized.name }]
  })
}

function readBody(req, maxBodyBytes) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let bytesRead = 0
    let isClosed = false
    let drainTimeout = null
    const clearDrainTimeout = () => {
      if (drainTimeout) {
        clearTimeout(drainTimeout)
        drainTimeout = null
      }
    }
    req.on('data', (chunk) => {
      if (isClosed) {
        return
      }
      bytesRead += chunk.length
      if (bytesRead > maxBodyBytes) {
        isClosed = true
        const error = new Error('Request body too large')
        error.status = 413
        reject(error)
        drainTimeout = setTimeout(() => {
          if (!req.destroyed) {
            req.destroy()
          }
        }, 1_000)
        drainTimeout.unref?.()
        req.resume()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (isClosed) {
        clearDrainTimeout()
        if (!req.destroyed) {
          req.destroy()
        }
        return
      }
      try {
        clearDrainTimeout()
        resolve(JSON.parse(Buffer.concat(chunks).toString()))
      } catch {
        const error = new Error('Invalid JSON body')
        error.status = 400
        reject(error)
      }
    })
    req.on('error', (error) => {
      clearDrainTimeout()
      if (isClosed) {
        return
      }
      reject(error)
    })
    req.on('close', clearDrainTimeout)
  })
}

function readRawBody(req, maxBodyBytes) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let bytesRead = 0
    req.on('data', (chunk) => {
      bytesRead += chunk.length
      if (bytesRead > maxBodyBytes) {
        const error = new Error('Request body too large')
        error.status = 413
        reject(error)
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString()))
    req.on('error', reject)
  })
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

function getStaticContentType(filePath) {
  const extension = extname(filePath).toLowerCase()
  const baseType = STATIC_CONTENT_TYPES[extension] ?? 'application/octet-stream'
  if (TEXT_UTF8_EXTENSIONS.has(extension)) {
    return `${baseType}; charset=utf-8`
  }
  return baseType
}

async function resolveCanonicalStaticFile(staticRoot, filePath) {
  const staticRootPrefix = staticRoot.endsWith(sep) ? staticRoot : `${staticRoot}${sep}`
  const canonicalPath = await realpath(filePath)
  if (canonicalPath !== staticRoot && !canonicalPath.startsWith(staticRootPrefix)) {
    return null
  }

  const fileStats = await stat(canonicalPath)
  return fileStats.isFile() ? canonicalPath : null
}

async function resolveStaticFilePath(staticRoot, pathname) {
  let requestedPath
  try {
    requestedPath = pathname === '/' ? '/index.html' : decodeURIComponent(pathname)
  } catch {
    return null
  }
  if (requestedPath.includes('\0')) {
    return null
  }
  const candidatePath = resolve(staticRoot, `.${requestedPath}`)
  const staticRootPrefix = staticRoot.endsWith(sep) ? staticRoot : `${staticRoot}${sep}`

  if (candidatePath !== staticRoot && !candidatePath.startsWith(staticRootPrefix)) {
    return null
  }

  try {
    const canonicalCandidatePath = await resolveCanonicalStaticFile(staticRoot, candidatePath)
    if (canonicalCandidatePath) {
      return canonicalCandidatePath
    }
  } catch {}

  if (extname(candidatePath)) {
    return null
  }

  try {
    return await resolveCanonicalStaticFile(staticRoot, resolve(staticRoot, 'index.html'))
  } catch {
    return null
  }
}

async function tryServeStatic(staticRoot, req, res, url) {
  if (!staticRoot || (req.method !== 'GET' && req.method !== 'HEAD')) {
    return false
  }

  if (url.pathname.startsWith('/api/')) {
    return false
  }

  const filePath = await resolveStaticFilePath(staticRoot, url.pathname)
  if (!filePath) {
    return false
  }

  const headers = {
    'Content-Type': getStaticContentType(filePath),
  }

  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/fonts/')) {
    headers['Cache-Control'] = 'public, immutable, max-age=31536000'
  } else {
    headers['Cache-Control'] = 'no-cache'
  }

  res.writeHead(200, headers)
  if (req.method === 'HEAD') {
    res.end()
    return true
  }

  await new Promise((resolveRequest, rejectRequest) => {
    const stream = createReadStream(filePath)
    stream.on('error', rejectRequest)
    stream.on('end', resolveRequest)
    stream.pipe(res)
  })

  return true
}

export function createFacetServer(options = {}) {
  const allowedOrigins = options.allowedOrigins ?? DEFAULT_ALLOWED_ORIGINS
  const defaultModel = options.defaultModel ?? DEFAULT_MODEL
  const defaultMaxTokens = options.defaultMaxTokens ?? 4096
  const maxRequestTokens = options.maxRequestTokens ?? defaultMaxTokens
  const maxBodyBytes = options.maxBodyBytes ?? 1048576
  const staticDir = options.staticDir ? resolve(options.staticDir) : null
  const staticRootPromise = staticDir
    ? realpath(staticDir).catch(() => resolve(staticDir))
    : null
  const defaultTemperature = options.defaultTemperature
  const defaultThinkingBudget = options.defaultThinkingBudget ?? 0
  const proxyApiKey = options.proxyApiKey ?? DEFAULT_PROXY_API_KEY
  const anthropicClient =
    options.anthropicClient ??
    (
      options.anthropicBaseUrl && !options.anthropicApiKey
        ? createUnauthenticatedAnthropicCompatClient({
            baseURL: options.anthropicBaseUrl,
          })
        : new Anthropic({
            ...(options.anthropicApiKey ? { apiKey: options.anthropicApiKey } : {}),
            ...(options.anthropicBaseUrl ? { baseURL: options.anthropicBaseUrl } : {}),
          })
    )
  const allowedModelValues = new Set([
    defaultModel,
    ...Object.keys(MODEL_ALIASES),
    ...Object.values(MODEL_ALIASES),
  ])
  const authMode = options.authMode === 'hosted' ? 'hosted' : 'local'
  const hostedRateLimits =
    authMode === 'hosted'
      ? {
          ai: options.hostedRateLimits?.ai ?? DEFAULT_HOSTED_RATE_LIMITS.ai,
          billingMutations:
            options.hostedRateLimits?.billingMutations ??
            DEFAULT_HOSTED_RATE_LIMITS.billingMutations,
          persistenceMutations:
            options.hostedRateLimits?.persistenceMutations ??
            DEFAULT_HOSTED_RATE_LIMITS.persistenceMutations,
        }
      : DEFAULT_HOSTED_RATE_LIMITS
  const operationsMonitor = createHostedOperationsMonitor({
    now: options.monitorNow ?? (() => Date.now()),
    logger: options.logger ?? console,
    rateLimits: hostedRateLimits,
  })
  const hostedRateLimiter = createFixedWindowRateLimiter({
    now: options.rateLimitNow ?? (() => Date.now()),
    limits: hostedRateLimits,
  })
  const hostedWorkspaceStore =
    authMode === 'hosted'
      ? (options.hostedWorkspaceStore ?? createInMemoryHostedWorkspaceStore())
      : null
  const persistenceAuthTokens = options.persistenceAuthTokens ?? DEFAULT_PERSISTENCE_AUTH_TOKENS
  const persistenceStore =
    options.persistenceStore ??
    (authMode === 'hosted' ? hostedWorkspaceStore : createInMemoryWorkspaceStore())
  const persistenceActorResolver =
    options.persistenceActorResolver ??
    (
      authMode === 'hosted'
        ? createHostedSessionActorResolver({
            ...(options.hostedAuth ?? {}),
            membershipStore:
              options.hostedAuth?.membershipStore ?? hostedWorkspaceStore,
          })
        : createTokenActorResolver(persistenceAuthTokens)
    )
  const requestActorSymbol = Symbol('facet.requestActor')
  const resolveRequestActor = async (req) => {
    if (req[requestActorSymbol]) {
      return req[requestActorSymbol]
    }

    const actor = await persistenceActorResolver(req)
    req[requestActorSymbol] = actor
    return actor
  }
  const persistenceApi = createPersistenceApi({
    actorResolver: resolveRequestActor,
    store: persistenceStore,
    now: options.now,
    onEvent:
      authMode === 'hosted'
        ? (scope, result, details) => operationsMonitor.record(scope, result, details)
        : undefined,
  })
  const billingStore =
    authMode === 'hosted'
      ? (options.billingStore ?? createInMemoryHostedBillingStore())
      : null
  const stripeClient =
    options.stripeClient ??
    (
      options.stripeSecretKey
        ? createStripeBillingClient({
            secretKey: options.stripeSecretKey,
          })
        : null
    )

  if (authMode === 'hosted' && !stripeClient) {
    console.warn('[proxy] hosted mode: Stripe client not configured; billing checkout will be unavailable')
  }
  if (authMode === 'hosted' && !options.stripePriceId) {
    console.warn('[proxy] hosted mode: Stripe price id not configured; billing checkout will be unavailable')
  }

  const billingApi =
    authMode === 'hosted'
      ? createBillingApi({
          actorResolver: resolveRequestActor,
          billingStore,
          stripeClient,
          stripePriceId: options.stripePriceId,
          successUrl: options.billingSuccessUrl ?? `${allowedOrigins[0] ?? 'http://localhost:5173'}/settings/billing/success`,
          cancelUrl: options.billingCancelUrl ?? `${allowedOrigins[0] ?? 'http://localhost:5173'}/settings/billing/cancel`,
          onEvent: (scope, result, details) => operationsMonitor.record(scope, result, details),
        })
      : null

  const billingWebhookHandler =
    authMode === 'hosted' && stripeClient && options.stripeWebhookSecret
      ? createBillingWebhookHandler({
          stripeClient,
          webhookSecret: options.stripeWebhookSecret,
          billingStore,
          onEvent: (scope, result, details) => operationsMonitor.record(scope, result, details),
        })
      : null

  const isAllowedOrigin = (origin) => allowedOrigins.includes(origin)
  const createHostedRateLimitKey = (actor, req) => {
    if (actor?.tenantId && actor?.accountId) {
      return `account:${actor.tenantId}:${actor.accountId}`
    }

    if (actor?.tenantId && actor?.userId) {
      return `user:${actor.tenantId}:${actor.userId}`
    }

    return `ip:${req.socket.remoteAddress ?? 'anonymous'}`
  }
  const enforceHostedRateLimit = (req, res, pathname, bucket, actor) => {
    const subjectKey = createHostedRateLimitKey(actor, req)
    const rateLimit = hostedRateLimiter.consume(bucket, subjectKey)
    if (rateLimit.allowed) {
      return true
    }

    operationsMonitor.record(bucket, 'rate_limited', {
      method: req.method,
      path: pathname,
    })
    res.setHeader('Retry-After', String(rateLimit.retryAfterSeconds))
    sendJson(res, 429, {
      error: `Rate limit exceeded for hosted ${bucket}.`,
      code: 'rate_limited',
      retryAfterSeconds: rateLimit.retryAfterSeconds,
    })
    return false
  }
  const enforceHostedRouteRateLimit = async (req, res, pathname) => {
    if (authMode !== 'hosted') {
      return true
    }

    const rateLimitBucket = resolveHostedRateLimitBucket(req, pathname)
    if (!rateLimitBucket) {
      return true
    }

    try {
      const actor = await resolveRequestActor(req)
      return enforceHostedRateLimit(req, res, pathname, rateLimitBucket, actor)
    } catch {
      return enforceHostedRateLimit(req, res, pathname, rateLimitBucket, null)
    }
  }

  function setCors(req, res) {
    const origin = req.headers.origin
    if (origin && isAllowedOrigin(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader('Vary', 'Origin')
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Authorization, Content-Type, X-API-Key, X-Proxy-API-Key',
    )
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost')

    try {
      setCors(req, res)

      // Static assets intentionally remain publicly readable so browser navigations
      // and asset fetches can load the SPA shell. Origin and auth enforcement
      // below applies only to API routes.
      if (await tryServeStatic(staticRootPromise ? await staticRootPromise : null, req, res, url)) {
        return
      }
    } catch (error) {
      console.error('[proxy] static_serve_error', error)
      if (res.headersSent) {
        if (!res.writableEnded) {
          res.end()
        }
      } else {
        sendJson(res, 500, { error: 'Static asset request failed.' })
      }
      return
    }

    // Stripe webhooks bypass origin and auth checks
    if (billingWebhookHandler?.canHandle(req)) {
      try {
        const rawBody = await readRawBody(req, maxBodyBytes)
        await billingWebhookHandler.handle(req, res, rawBody, sendJson)
      } catch (error) {
        sendJson(res, 500, { error: 'Webhook processing failed.' })
      }
      return
    }

    if (!req.headers.origin || !isAllowedOrigin(req.headers.origin)) {
      sendJson(res, 403, { error: 'Origin not allowed' })
      return
    }

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    const hasValidProxyApiKey = req.headers['x-proxy-api-key'] === proxyApiKey
    const hasHostedBearerToken =
      authMode === 'hosted' &&
      Boolean(extractBearerToken(req.headers.authorization))

    if (!hasValidProxyApiKey && !hasHostedBearerToken) {
      sendJson(res, 401, {
        error: authMode === 'hosted' ? 'Authorization required' : 'Invalid proxy API key',
      })
      return
    }

    try {
      // Keep the explicit billing routes ahead of the generic AI handler.
      if (billingApi?.canHandle(req)) {
        if (!await enforceHostedRouteRateLimit(req, res, url.pathname)) {
          return
        }
        await billingApi.handle(
          req,
          res,
          (request) => readBody(request, maxBodyBytes),
          sendJson,
        )
        return
      }

      if (persistenceApi.canHandle(req)) {
        if (!await enforceHostedRouteRateLimit(req, res, url.pathname)) {
          return
        }
        await persistenceApi.handle(
          req,
          res,
          (request) => readBody(request, maxBodyBytes),
          sendJson,
        )
        return
      }

      if (url.pathname !== '/') {
        sendJson(res, 404, { error: 'Route not found' })
        return
      }

      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'Method not allowed' })
        return
      }

      const body = await readBody(req, maxBodyBytes)
      const { system, messages, temperature, max_tokens, model, thinking_budget, tools, feature } = body

      if (!hasValidMessages(messages)) {
        sendJson(res, 400, { error: 'Missing or invalid "messages" array' })
        return
      }

      if (feature !== undefined && feature !== null && !isFacetAiFeatureKey(feature)) {
        if (authMode === 'hosted') {
          operationsMonitor.record('ai', 'error', {
            code: 'invalid_ai_feature',
            method: req.method,
            path: url.pathname,
          })
        }
        sendJson(res, 400, {
          error: 'AI requests must declare a valid feature when provided.',
          code: 'invalid_ai_feature',
        })
        return
      }

      if (authMode === 'hosted') {
        if (feature === undefined || feature === null) {
          operationsMonitor.record('ai', 'error', {
            code: 'invalid_ai_feature',
            method: req.method,
            path: url.pathname,
          })
          sendJson(res, 400, {
            error: 'Hosted AI requests must declare a valid feature.',
            code: 'invalid_ai_feature',
          })
          return
        }

        let actor
        try {
          actor = await resolveRequestActor(req)
        } catch (error) {
          if (error?.status === 401 || error?.status === 403) {
            operationsMonitor.record('ai', 'denied', {
              code: 'auth_required',
              method: req.method,
              path: url.pathname,
            })
            sendJson(res, error.status, {
              error: 'Sign in to use AI features in hosted Facet.',
              code: 'auth_required',
            })
            return
          }

          console.error('[proxy] actor_resolve_error', error)
          operationsMonitor.record('ai', 'error', {
            code: 'auth_internal_error',
            method: req.method,
            path: url.pathname,
          })
          sendJson(res, 500, {
            error: 'Unable to verify identity for AI access.',
            code: 'auth_internal_error',
          })
          return
        }

        if (!actor?.tenantId || !actor?.accountId) {
          operationsMonitor.record('ai', 'denied', {
            code: 'incomplete_actor',
            method: req.method,
            path: url.pathname,
          })
          sendJson(res, 403, {
            error: 'Hosted AI access requires a tenant-scoped account context.',
            code: 'incomplete_actor',
          })
          return
        }

        if (!enforceHostedRateLimit(req, res, url.pathname, 'ai', actor)) {
          return
        }

        if (!billingStore) {
          operationsMonitor.record('ai', 'error', {
            code: 'billing_state_error',
            method: req.method,
            path: url.pathname,
          })
          sendJson(res, 500, {
            error: 'Hosted billing state is unavailable for this AI request.',
            code: 'billing_state_error',
          })
          return
        }

        try {
          const billingState = await billingStore.getAccountState(actor.tenantId, actor.accountId)
          const access = resolveHostedAiAccess(billingState, feature)
          if (!access.allowed) {
            operationsMonitor.record('ai', 'denied', {
              reason: access.reason,
              feature,
              method: req.method,
              path: url.pathname,
            })
            sendJson(res, 402, createHostedAiErrorPayload(access.reason, feature))
            return
          }
        } catch (error) {
          console.error('[proxy] billing_state_error', error)
          operationsMonitor.record('ai', 'error', {
            code: 'billing_state_error',
            method: req.method,
            path: url.pathname,
          })
          sendJson(res, 500, {
            error: 'Hosted billing state could not be loaded for this AI request.',
            code: 'billing_state_error',
          })
          return
        }
      }

      const resolvedModel = resolveModel(model, defaultModel)
      if (!allowedModelValues.has(resolvedModel)) {
        sendJson(res, 400, { error: 'Requested model is not allowed' })
        return
      }

      const thinkingBudget = thinking_budget ?? defaultThinkingBudget
      const useThinking = thinkingBudget > 0
      const resolvedTemp = !Number.isNaN(defaultTemperature)
        ? defaultTemperature
        : (temperature ?? 0.3)
      const resolvedMaxTokens = Math.max(
        1,
        Math.min(
          maxRequestTokens,
          typeof max_tokens === 'number' ? Math.floor(max_tokens) : defaultMaxTokens,
        ),
      )
      const normalizedTools = normalizeTools(tools)
      if (Array.isArray(tools) && normalizedTools.length !== tools.length) {
        sendJson(res, 400, { error: 'One or more requested tools are not allowed' })
        return
      }

      const params = {
        model: resolvedModel,
        max_tokens: resolvedMaxTokens,
        system: system || undefined,
        messages,
        ...(normalizedTools.length > 0 ? { tools: normalizedTools } : {}),
      }

      if (useThinking) {
        params.thinking = { type: 'enabled', budget_tokens: thinkingBudget }
      } else {
        params.temperature = resolvedTemp
      }

      const start = Date.now()
      const result = await anthropicClient.messages.create(params)
      const elapsed = Date.now() - start

      console.log(
        `[proxy] ${resolvedModel} ${result.usage?.input_tokens ?? '?'}in/${result.usage?.output_tokens ?? '?'}out ${elapsed}ms`,
      )
      if (authMode === 'hosted') {
        operationsMonitor.record('ai', 'success', {
          feature,
          method: req.method,
          model: resolvedModel,
          path: url.pathname,
        })
      }

      sendJson(res, 200, result)
    } catch (error) {
      const status = error?.status ?? 500
      const message =
        status >= 500 ? 'Internal proxy error' : (error?.message ?? 'Internal proxy error')
      console.error(`[proxy] ${status}: ${message}`)
      sendJson(res, status, { error: message })
    }
  })

  server.on('close', () => {
    hostedRateLimiter.dispose?.()
  })

  return {
    server,
    persistenceStore,
    operationsMonitor,
  }
}

export function createEnvFacetServer(env = process.env) {
  const authMode = env.FACET_AUTH_MODE === 'hosted' ? 'hosted' : 'local'
  const rawEnvironment = env.FACET_ENVIRONMENT?.trim()
  if (
    authMode === 'hosted' &&
    rawEnvironment !== 'local' &&
    rawEnvironment !== 'staging' &&
    rawEnvironment !== 'production'
  ) {
    throw new Error(
      'Hosted mode requires FACET_ENVIRONMENT=local|staging|production.',
    )
  }
  const environment =
    rawEnvironment === 'production' || rawEnvironment === 'staging'
      ? rawEnvironment
      : 'local'
  const allowedOrigins = (env.ALLOWED_ORIGINS ?? DEFAULT_ALLOWED_ORIGINS.join(','))
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
  const hostedPool =
    authMode === 'hosted' && env.DATABASE_URL
      ? new pg.Pool({ connectionString: env.DATABASE_URL })
      : null
  const hostedWorkspaceStore =
    authMode === 'hosted'
      ? hostedPool
        ? createPostgresWorkspaceStore(hostedPool)
        : createFileHostedWorkspaceStore(env.HOSTED_WORKSPACE_FILE)
      : undefined
  const hostedAuth = authMode === 'hosted'
    ? {
        issuer:
          env.SUPABASE_JWT_ISSUER ??
          (
            env.SUPABASE_URL
              ? `${env.SUPABASE_URL.replace(/\/+$/, '')}/auth/v1`
              : undefined
          ),
        audience: env.SUPABASE_JWT_AUDIENCE ?? 'authenticated',
        jwksUrl: env.SUPABASE_JWKS_URL,
        membershipStore: hostedWorkspaceStore,
      }
    : undefined
  const billingBaseUrl =
    env.BILLING_APP_URL ??
    env.PUBLIC_APP_URL ??
    allowedOrigins[0] ??
    'http://localhost:5173'
  const billingStore =
    authMode === 'hosted'
      ? hostedPool
        ? createPostgresBillingStore(hostedPool)
        : createFileHostedBillingStore(env.HOSTED_BILLING_FILE)
      : undefined

  if (authMode === 'hosted' && environment !== 'local') {
    if ((env.PROXY_API_KEY ?? DEFAULT_PROXY_API_KEY) === DEFAULT_PROXY_API_KEY) {
      throw new Error(
        'Hosted staging/production must not rely on the default PROXY_API_KEY.',
      )
    }

    if (env.PERSISTENCE_AUTH_TOKENS) {
      throw new Error(
        'Hosted staging/production must not use PERSISTENCE_AUTH_TOKENS.',
      )
    }

    const usingTransitionalFileStores = Boolean(
      env.HOSTED_WORKSPACE_FILE || env.HOSTED_BILLING_FILE,
    )
    if (usingTransitionalFileStores && env.ALLOW_TRANSITIONAL_HOSTED_FILE_STORE !== 'true') {
      throw new Error(
        'Hosted staging/production requires a non-file-backed workspace and billing store unless ALLOW_TRANSITIONAL_HOSTED_FILE_STORE=true is set for a controlled smoke environment.',
      )
    }
  }

  return createFacetServer({
    authMode,
    allowedOrigins,
    anthropicApiKey: env.ANTHROPIC_API_KEY?.trim() || undefined,
    anthropicBaseUrl: env.ANTHROPIC_BASE_URL?.trim() || undefined,
    defaultModel: env.MODEL ?? DEFAULT_MODEL,
    defaultMaxTokens: parseInt(env.MAX_TOKENS ?? '4096', 10),
    maxRequestTokens: parseInt(env.MAX_REQUEST_TOKENS ?? env.MAX_TOKENS ?? '4096', 10),
    maxBodyBytes: parseInt(env.MAX_BODY_BYTES ?? '1048576', 10),
    defaultTemperature: parseFloat(env.DEFAULT_TEMPERATURE ?? ''),
    defaultThinkingBudget: parseInt(env.THINKING_BUDGET ?? '0', 10),
    proxyApiKey: env.PROXY_API_KEY ?? DEFAULT_PROXY_API_KEY,
    hostedRateLimits: {
      ai: {
        max: parsePositiveInteger(
          env.HOSTED_AI_RATE_LIMIT_MAX,
          DEFAULT_HOSTED_RATE_LIMITS.ai.max,
        ),
        windowMs: parsePositiveInteger(
          env.HOSTED_AI_RATE_LIMIT_WINDOW_MS,
          DEFAULT_HOSTED_RATE_LIMITS.ai.windowMs,
        ),
      },
      billingMutations: {
        max: parsePositiveInteger(
          env.HOSTED_BILLING_RATE_LIMIT_MAX,
          DEFAULT_HOSTED_RATE_LIMITS.billingMutations.max,
        ),
        windowMs: parsePositiveInteger(
          env.HOSTED_BILLING_RATE_LIMIT_WINDOW_MS,
          DEFAULT_HOSTED_RATE_LIMITS.billingMutations.windowMs,
        ),
      },
      persistenceMutations: {
        max: parsePositiveInteger(
          env.HOSTED_PERSISTENCE_RATE_LIMIT_MAX,
          DEFAULT_HOSTED_RATE_LIMITS.persistenceMutations.max,
        ),
        windowMs: parsePositiveInteger(
          env.HOSTED_PERSISTENCE_RATE_LIMIT_WINDOW_MS,
          DEFAULT_HOSTED_RATE_LIMITS.persistenceMutations.windowMs,
        ),
      },
    },
    persistenceAuthTokens:
      authMode === 'hosted'
        ? undefined
        : parsePersistenceAuthTokens(env.PERSISTENCE_AUTH_TOKENS),
    hostedWorkspaceStore,
    hostedAuth,
    billingStore,
    stripeSecretKey: env.STRIPE_SECRET_KEY,
    stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET,
    stripePriceId: env.STRIPE_PRICE_AI_PRO,
    staticDir: env.FACET_STATIC_DIR,
    billingSuccessUrl:
      env.STRIPE_CHECKOUT_SUCCESS_URL ??
      `${billingBaseUrl.replace(/\/+$/, '')}/settings/billing/success`,
    billingCancelUrl:
      env.STRIPE_CHECKOUT_CANCEL_URL ??
      `${billingBaseUrl.replace(/\/+$/, '')}/settings/billing/cancel`,
  })
}
