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
import { createFileHostedBillingStore, createInMemoryHostedBillingStore } from './billingState.js'
import { createHostedSessionActorResolver } from './hostedAuth.js'
import {
  createFileHostedWorkspaceStore,
  createInMemoryHostedWorkspaceStore,
} from './hostedWorkspaceStore.js'
import { createPostgresWorkspaceStore } from './postgresWorkspaceStore.js'
import { createPostgresBillingStore } from './postgresBillingStore.js'
import { createPostgresUsageStore } from './postgresUsageStore.js'
import {
  createFileResearchJobStore,
  createInMemoryResearchJobStore,
  createResearchJobService,
} from './researchJobs.js'
import { estimateCostCents } from './pricing.js'
import pg from 'pg'

const CURRENT_SONNET_MODEL = 'claude-sonnet-4-6'
const CURRENT_OPUS_MODEL = 'claude-opus-4-7'
const CURRENT_HAIKU_MODEL = 'claude-haiku-4-5-20251001'
// Anthropic currently returns `temperature is deprecated for this model` for these
// upstream model ids in non-thinking requests, so the proxy must omit temperature.
// Re-check this set whenever a new Sonnet/Opus model id is added to proxy routing.
const MODELS_OMIT_TEMPERATURE = new Set([CURRENT_SONNET_MODEL, CURRENT_OPUS_MODEL])
// Models that require adaptive thinking (`thinking: {type: 'adaptive'}`); manual
// extended thinking with `budget_tokens` 400s on Opus 4.7 and is deprecated on
// Sonnet 4.6. The proxy translates `thinking_budget` → adaptive for these models.
const ADAPTIVE_THINKING_MODELS = new Set([CURRENT_SONNET_MODEL, CURRENT_OPUS_MODEL])
// Models that accept the `output_config.effort` parameter. Sonnet 4.5 and Haiku 4.5
// 400 if effort is sent. Re-check this set when a new model is added to routing.
const MODELS_ACCEPT_EFFORT = new Set([CURRENT_SONNET_MODEL, CURRENT_OPUS_MODEL])
const DEFAULT_MODEL = CURRENT_SONNET_MODEL
const DEFAULT_PROXY_API_KEY = 'facet-local-proxy'
const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173']
const TASK_BUDGET_FEATURE_MAX_TOKENS = 128_000
const TASK_BUDGET_FEATURES = new Set([
  'research.deep-search',
  'research.thesis',
  'letters.generate',
])
const TEXT_UTF8_EXTENSIONS = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.map',
  '.svg',
  '.txt',
  '.xml',
])
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
  haiku: CURRENT_HAIKU_MODEL,
  sonnet: CURRENT_SONNET_MODEL,
  opus: CURRENT_OPUS_MODEL,
}

const OPUS_UNAVAILABLE_ERROR = {
  error:
    'Opus is currently unavailable. Phase 1 can use a lower-quality Sonnet fallback; Phase 2 deep research requires Opus and cannot start until Opus returns.',
  code: 'ai_capability_unavailable',
  reason: 'opus_unavailable',
  capability: 'opus',
}

// Per-feature model tiering (see backlog doc-24 for product context):
//   Opus 4.7   — quality-critical user-facing output ("represents the product to the user")
//   Sonnet 4.6 — structured transformation with a clear input/output shape
//   Haiku 4.5  — mechanical field extraction
const FEATURE_MODEL_DEFAULTS = {
  // Opus 4.7 — quality-critical
  'identity.deepen': CURRENT_OPUS_MODEL,
  'pipeline.t3.interviewer': CURRENT_OPUS_MODEL, // unwired today; revisit when feature lands
  'research.deep-search': CURRENT_OPUS_MODEL,
  'research.profile-inference': CURRENT_OPUS_MODEL,
  'research.thesis': CURRENT_OPUS_MODEL,
  'prep.generate': CURRENT_OPUS_MODEL,
  'linkedin.generate': CURRENT_OPUS_MODEL,
  // Sonnet 4.6 — structured transformation
  'identity.extract': CURRENT_SONNET_MODEL,
  'debrief.generate': CURRENT_SONNET_MODEL,
  'build.bullet-reframe': CURRENT_SONNET_MODEL,
  'letters.generate': CURRENT_SONNET_MODEL,
  'research.search': CURRENT_SONNET_MODEL,
  // Haiku 4.5 — mechanical field extraction
  'match.jd-analysis': CURRENT_HAIKU_MODEL,
}

const DEFAULT_AI_FEATURE_RATE_LIMITS = {
  'build.bullet-reframe': { max: 12, windowMs: 60_000 },
  'identity.extract': { max: 8, windowMs: 60_000 },
  'identity.deepen': { max: 12, windowMs: 60_000 },
  'match.jd-analysis': { max: 18, windowMs: 60_000 },
  'pipeline.t3.interviewer': { max: 3, windowMs: 60_000 },
  'research.deep-search': { max: 6, windowMs: 60_000 },
  'research.profile-inference': { max: 10, windowMs: 60_000 },
  'research.search': { max: 45, windowMs: 60_000 },
  'research.thesis': { max: 12, windowMs: 60_000 },
  'prep.generate': { max: 5, windowMs: 60_000 },
  'letters.generate': { max: 8, windowMs: 60_000 },
  'linkedin.generate': { max: 8, windowMs: 60_000 },
  'debrief.generate': { max: 8, windowMs: 60_000 },
}

const DEFAULT_HOSTED_RATE_LIMITS = {
  ai: { max: 30, windowMs: 60_000 },
  aiFeatures: DEFAULT_AI_FEATURE_RATE_LIMITS,
  billingMutations: { max: 12, windowMs: 60_000 },
  persistenceMutations: { max: 120, windowMs: 60_000 },
}

const DEFAULT_HOSTED_AI_USAGE_POLICY = {
  dailyFeatureCaps: {},
  globalSpendCircuitBreaker: {
    maxCents: 0,
    windowMs: 24 * 60 * 60 * 1_000,
  },
}
const GLOBAL_SPEND_CACHE_TTL_MS = 30_000

export const formatModelAliases = () =>
  Object.entries(MODEL_ALIASES)
    .map(([alias, model]) => `${alias} -> ${model}`)
    .join(', ')

function createUnauthenticatedAnthropicCompatClient({ baseURL }) {
  const normalizedBaseUrl = baseURL.replace(/\/+$/, '')

  return {
    messages: {
      async create(params, options = {}) {
        const response = await fetch(`${normalizedBaseUrl}/v1/messages`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'anthropic-version': '2023-06-01',
            ...(options?.headers ?? {}),
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
              : (payload?.error?.message ??
                payload?.message ??
                'Anthropic-compatible upstream error')
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

function shouldOmitTemperature(model) {
  return MODELS_OMIT_TEMPERATURE.has(model)
}

// Map a thinking_budget magnitude to an `effort` level for adaptive-thinking models.
// Adaptive thinking ignores numeric budgets — `effort` is the new control. Honor
// the caller's intent by translating budget magnitude to the corresponding effort.
export function deriveEffortFromBudget(budget) {
  if (budget < 4000) return 'low'
  if (budget < 12000) return 'medium'
  return 'high'
}

function parsePositiveInteger(value, fallback) {
  const parsed = parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function parseNonNegativeInteger(value, fallback) {
  const parsed = parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

function parseRatio(value, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : fallback
}

function normalizeRateLimitConfig(config, fallback) {
  return {
    max: parsePositiveInteger(config?.max, fallback.max),
    windowMs: parsePositiveInteger(config?.windowMs, fallback.windowMs),
  }
}

function normalizeHostedRateLimits(overrides = {}) {
  const ai = normalizeRateLimitConfig(overrides.ai, DEFAULT_HOSTED_RATE_LIMITS.ai)
  const aiFeatures = Object.fromEntries(
    Object.entries(DEFAULT_AI_FEATURE_RATE_LIMITS).map(([feature, config]) => [
      feature,
      normalizeRateLimitConfig(overrides.aiFeatures?.[feature], config),
    ]),
  )

  for (const [feature, config] of Object.entries(overrides.aiFeatures ?? {})) {
    if (!aiFeatures[feature]) {
      aiFeatures[feature] = normalizeRateLimitConfig(config, ai)
    }
  }

  return {
    ai,
    aiFeatures,
    billingMutations: normalizeRateLimitConfig(
      overrides.billingMutations,
      DEFAULT_HOSTED_RATE_LIMITS.billingMutations,
    ),
    persistenceMutations: normalizeRateLimitConfig(
      overrides.persistenceMutations,
      DEFAULT_HOSTED_RATE_LIMITS.persistenceMutations,
    ),
  }
}

function normalizeDailyFeatureCaps(caps = {}) {
  return Object.fromEntries(
    Object.entries(caps).flatMap(([feature, cap]) => {
      const parsed = parsePositiveInteger(cap, 0)
      return parsed > 0 ? [[feature, parsed]] : []
    }),
  )
}

function normalizeHostedAiUsagePolicy(policy = {}) {
  const breaker = policy.globalSpendCircuitBreaker ?? {}
  return {
    dailyFeatureCaps: normalizeDailyFeatureCaps(policy.dailyFeatureCaps),
    globalSpendCircuitBreaker: {
      maxCents: parsePositiveInteger(
        breaker.maxCents,
        DEFAULT_HOSTED_AI_USAGE_POLICY.globalSpendCircuitBreaker.maxCents,
      ),
      windowMs: parsePositiveInteger(
        breaker.windowMs,
        DEFAULT_HOSTED_AI_USAGE_POLICY.globalSpendCircuitBreaker.windowMs,
      ),
    },
  }
}

function parseJsonObjectEnv(value, label) {
  if (!value?.trim()) {
    return {}
  }

  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch (error) {
    throw new Error(`${label} must be valid JSON object syntax.`)
  }
}

function envFeatureSuffix(feature) {
  return feature.toUpperCase().replace(/[^A-Z0-9]+/g, '_')
}

function parseHostedAiFeatureRateLimits(env, baseLimits) {
  const jsonOverrides = parseJsonObjectEnv(
    env.HOSTED_AI_FEATURE_RATE_LIMITS_JSON,
    'HOSTED_AI_FEATURE_RATE_LIMITS_JSON',
  )
  for (const feature of Object.keys(jsonOverrides)) {
    if (!baseLimits[feature]) {
      throw new Error(
        `HOSTED_AI_FEATURE_RATE_LIMITS_JSON contains unknown AI feature "${feature}".`,
      )
    }
  }
  const envOverrides = {}

  for (const feature of Object.keys(baseLimits)) {
    const suffix = envFeatureSuffix(feature)
    const max = env[`HOSTED_AI_RATE_LIMIT_${suffix}_MAX`]
    const windowMs = env[`HOSTED_AI_RATE_LIMIT_${suffix}_WINDOW_MS`]
    if (max !== undefined || windowMs !== undefined) {
      envOverrides[feature] = {
        ...(jsonOverrides[feature] && typeof jsonOverrides[feature] === 'object'
          ? jsonOverrides[feature]
          : {}),
        ...(max !== undefined ? { max } : {}),
        ...(windowMs !== undefined ? { windowMs } : {}),
      }
    }
  }

  return {
    ...jsonOverrides,
    ...envOverrides,
  }
}

function parseHostedAiUsagePolicy(env) {
  const jsonCaps = parseJsonObjectEnv(
    env.HOSTED_AI_DAILY_FEATURE_CAPS_JSON,
    'HOSTED_AI_DAILY_FEATURE_CAPS_JSON',
  )
  const dailyFeatureCaps = { ...jsonCaps }

  for (const feature of Object.keys(DEFAULT_AI_FEATURE_RATE_LIMITS)) {
    const value = env[`HOSTED_AI_DAILY_CAP_${envFeatureSuffix(feature)}`]
    if (value !== undefined) {
      dailyFeatureCaps[feature] = value
    }
  }

  return normalizeHostedAiUsagePolicy({
    dailyFeatureCaps,
    globalSpendCircuitBreaker: {
      maxCents: env.HOSTED_AI_GLOBAL_SPEND_LIMIT_CENTS,
      windowMs: env.HOSTED_AI_GLOBAL_SPEND_WINDOW_MS,
    },
  })
}

function resolveRateLimitConfig(limits, bucket) {
  if (bucket.startsWith('ai:')) {
    const feature = bucket.slice('ai:'.length)
    return limits.aiFeatures?.[feature] ?? limits.ai
  }

  return limits[bucket]
}

function listRateLimitConfigs(limits) {
  return [
    limits.ai,
    ...Object.values(limits.aiFeatures ?? {}),
    limits.billingMutations,
    limits.persistenceMutations,
  ].filter(Boolean)
}

function aiFeatureBucket(feature) {
  return `ai:${feature}`
}

function monitorScopeForBucket(bucket) {
  return bucket.startsWith('ai:') ? 'ai' : bucket
}

function secondsUntilNextUtcDay(nowMs) {
  const current = new Date(nowMs)
  const next = Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate() + 1)
  return Math.max(1, Math.ceil((next - nowMs) / 1000))
}

function usageDateForTimestamp(nowMs) {
  return new Date(nowMs).toISOString().slice(0, 10)
}

function normalizeTimestampMs(value, fallback = Date.now()) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return fallback
}

function isHostedAiUsagePolicyEnabled(policy) {
  return (
    Object.keys(policy.dailyFeatureCaps).length > 0 || policy.globalSpendCircuitBreaker.maxCents > 0
  )
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
      const counterKey = [scope, result, details.code, details.reason].filter(Boolean).join('.')
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
          const offset =
            (nextRecentEventIndex - recentEventCount + index + recentEvents.length) %
            recentEvents.length
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
  const configs = listRateLimitConfigs(limits)
  const cleanupIntervalMs = Math.max(1_000, Math.min(...configs.map((config) => config.windowMs)))
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
      const config = resolveRateLimitConfig(limits, bucket)
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
          retryAfterSeconds: Math.max(1, Math.ceil((currentWindow.expiresAt - currentTime) / 1000)),
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

  if (pathname === '/api/billing/customer' || pathname === '/api/billing/checkout-session') {
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

  if (pathname === '/research/jobs' && req.method === 'POST') {
    return 'ai:research.deep-search'
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

const ALLOWED_TOOL_TYPES = new Set(['web_search_20250305', 'web_search_20260209'])

function resolveModel(requested, defaultModel) {
  if (!requested) return defaultModel
  return MODEL_ALIASES[requested] ?? requested
}

function resolveFeatureModel(requested, feature, defaultModel) {
  const resolvedRequestedModel = resolveModel(requested, defaultModel)
  const featureDefaultModel =
    typeof feature === 'string' && Object.hasOwn(FEATURE_MODEL_DEFAULTS, feature)
      ? FEATURE_MODEL_DEFAULTS[feature]
      : undefined

  if (!featureDefaultModel) {
    return resolvedRequestedModel
  }

  if (!requested) {
    return featureDefaultModel
  }

  // Generic aliases are treated as feature-agnostic defaults and may be routed by feature.
  // Raw model ids remain an explicit escape hatch for testing and targeted overrides.
  return MODEL_ALIASES[requested] ? featureDefaultModel : resolvedRequestedModel
}

function normalizeBooleanCapability(value, fallback = true) {
  if (typeof value === 'boolean') return value
  if (typeof value !== 'string') return fallback
  const normalized = value.trim().toLowerCase()
  if (['false', '0', 'no', 'off', 'unavailable'].includes(normalized)) return false
  if (['true', '1', 'yes', 'on', 'available'].includes(normalized)) return true
  return fallback
}

function createModelCapabilities(options = {}) {
  const opusAvailable = normalizeBooleanCapability(
    options.opusAvailable ?? options.modelCapabilities?.opus?.available,
    true,
  )
  return {
    opus: {
      available: opusAvailable,
      model: CURRENT_OPUS_MODEL,
      phase1FallbackModel: CURRENT_SONNET_MODEL,
      phase2Required: true,
    },
    sonnet: {
      available: true,
      model: CURRENT_SONNET_MODEL,
    },
    haiku: {
      available: true,
      model: CURRENT_HAIKU_MODEL,
    },
  }
}

function modelRequiresOpus(model) {
  return model === CURRENT_OPUS_MODEL
}

function isApprovedOpusFallback({ feature, requestedModel, capabilityFallback }) {
  return (
    feature === 'research.thesis' &&
    requestedModel === 'sonnet' &&
    capabilityFallback === 'opus_unavailable'
  )
}

function maxRequestTokensForFeature(feature, defaultCap) {
  return TASK_BUDGET_FEATURES.has(feature)
    ? Math.max(defaultCap, TASK_BUDGET_FEATURE_MAX_TOKENS)
    : defaultCap
}

function normalizeOutputConfig(outputConfig) {
  if (outputConfig === undefined || outputConfig === null) {
    return null
  }

  if (typeof outputConfig !== 'object' || Array.isArray(outputConfig)) {
    return null
  }

  return outputConfig
}

function normalizeBetas(betas) {
  if (betas === undefined || betas === null) {
    return []
  }

  if (!Array.isArray(betas)) {
    return null
  }

  const normalized = betas
    .filter((beta) => typeof beta === 'string')
    .map((beta) => beta.trim())
    .filter((beta) => beta.length > 0)

  return normalized.length === betas.length ? normalized : null
}

function hasValidMessages(messages) {
  return (
    Array.isArray(messages) &&
    messages.every(
      (message) =>
        message &&
        typeof message === 'object' &&
        typeof message.role === 'string' &&
        (typeof message.content === 'string' || Array.isArray(message.content)),
    )
  )
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

    if (!ALLOWED_TOOL_TYPES.has(normalized.type) || normalized.name !== 'web_search') {
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
  const modelCapabilities = createModelCapabilities(options)
  const defaultMaxTokens = options.defaultMaxTokens ?? 4096
  const maxRequestTokens = options.maxRequestTokens ?? defaultMaxTokens
  const maxBodyBytes = options.maxBodyBytes ?? 1048576
  const staticDir = options.staticDir ? resolve(options.staticDir) : null
  const staticRootPromise = staticDir ? realpath(staticDir).catch(() => resolve(staticDir)) : null
  const defaultTemperature = options.defaultTemperature
  const defaultThinkingBudget = options.defaultThinkingBudget ?? 0
  const proxyApiKey = options.proxyApiKey ?? DEFAULT_PROXY_API_KEY
  const anthropicClient =
    options.anthropicClient ??
    (options.anthropicBaseUrl && !options.anthropicApiKey
      ? createUnauthenticatedAnthropicCompatClient({
          baseURL: options.anthropicBaseUrl,
        })
      : new Anthropic({
          ...(options.anthropicApiKey ? { apiKey: options.anthropicApiKey } : {}),
          ...(options.anthropicBaseUrl ? { baseURL: options.anthropicBaseUrl } : {}),
        }))
  const allowedModelValues = new Set([
    defaultModel,
    ...Object.keys(MODEL_ALIASES),
    ...Object.values(MODEL_ALIASES),
    ...Object.values(FEATURE_MODEL_DEFAULTS),
  ])
  const authMode = options.authMode === 'hosted' ? 'hosted' : 'local'
  const hostedRateLimits =
    authMode === 'hosted'
      ? normalizeHostedRateLimits(options.hostedRateLimits)
      : normalizeHostedRateLimits()
  const hostedAiUsagePolicy =
    authMode === 'hosted'
      ? normalizeHostedAiUsagePolicy(options.hostedAiUsagePolicy)
      : normalizeHostedAiUsagePolicy()
  const hostedAiUsagePolicyNow = options.usagePolicyNow ?? (() => Date.now())
  let globalSpendCache = {
    expiresAt: 0,
    since: '',
    spendCents: 0,
  }
  let globalSpendRefreshPromise = null
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
    (authMode === 'hosted'
      ? createHostedSessionActorResolver({
          ...(options.hostedAuth ?? {}),
          membershipStore: options.hostedAuth?.membershipStore ?? hostedWorkspaceStore,
        })
      : createTokenActorResolver(persistenceAuthTokens))
  const requestActorSymbol = Symbol('facet.requestActor')
  const resolveRequestActor = async (req, { refresh = false } = {}) => {
    if (!refresh && req[requestActorSymbol]) {
      return req[requestActorSymbol]
    }

    const actor = await persistenceActorResolver(req)
    req[requestActorSymbol] = actor
    return actor
  }
  const localResearchActor = {
    tenantId: 'local',
    accountId: 'local',
    userId: 'local-user',
  }
  const resolveResearchJobActor = async (req, options) => {
    if (authMode === 'hosted' || extractBearerToken(req.headers.authorization)) {
      return resolveRequestActor(req, options)
    }

    return localResearchActor
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
    authMode === 'hosted' ? (options.billingStore ?? createInMemoryHostedBillingStore()) : null
  // Fire-and-forget per-call usage logger. Absent in local mode (no actor
  // identity) and absent in hosted mode when no store is configured — the
  // instrumentation point tolerates a null store.
  const usageStore = authMode === 'hosted' ? (options.usageStore ?? null) : null
  const sendUsagePolicyUnavailable = (res, feature, error) => {
    if (error) {
      console.error('[proxy] ai_usage_policy_error', error)
    }
    operationsMonitor.record('ai', 'error', {
      code: 'ai_usage_policy_unavailable',
      feature,
    })
    sendJson(res, 503, {
      error: 'Hosted AI usage limits are enabled but usage storage is unavailable.',
      code: 'ai_usage_policy_unavailable',
    })
  }
  const enforceHostedAiUsagePolicy = async (res, actor, feature, onDailyReservation = () => {}) => {
    if (!isHostedAiUsagePolicyEnabled(hostedAiUsagePolicy)) {
      return true
    }

    if (!usageStore) {
      sendUsagePolicyUnavailable(res, feature)
      return false
    }

    const nowMs = hostedAiUsagePolicyNow()
    const breaker = hostedAiUsagePolicy.globalSpendCircuitBreaker
    if (breaker.maxCents > 0) {
      if (typeof usageStore.getSpendCentsSince !== 'function') {
        sendUsagePolicyUnavailable(res, feature)
        return false
      }

      const since = new Date(nowMs - breaker.windowMs).toISOString()
      let spendCents = globalSpendCache.spendCents
      if (globalSpendCache.expiresAt <= nowMs) {
        globalSpendRefreshPromise ??= usageStore
          .getSpendCentsSince({ since })
          .then((freshSpendCents) => {
            globalSpendCache = {
              expiresAt: nowMs + Math.min(GLOBAL_SPEND_CACHE_TTL_MS, breaker.windowMs),
              since,
              spendCents: freshSpendCents,
            }
            return freshSpendCents
          })
          .finally(() => {
            globalSpendRefreshPromise = null
          })

        try {
          spendCents = await globalSpendRefreshPromise
        } catch (error) {
          sendUsagePolicyUnavailable(res, feature, error)
          return false
        }
      }
      if (spendCents >= breaker.maxCents) {
        operationsMonitor.record('ai', 'denied', {
          code: 'ai_spend_circuit_open',
          feature,
        })
        sendJson(res, 503, {
          error:
            'Hosted AI is temporarily paused because the global spend circuit breaker is open.',
          code: 'ai_spend_circuit_open',
        })
        return false
      }
    }

    const dailyCap = hostedAiUsagePolicy.dailyFeatureCaps[feature] ?? 0
    if (dailyCap > 0) {
      if (typeof usageStore.reserveDailyFeatureCall !== 'function') {
        sendUsagePolicyUnavailable(res, feature)
        return false
      }

      let reservation
      try {
        reservation = await usageStore.reserveDailyFeatureCall({
          userId: actor.userId,
          tenantId: actor.tenantId,
          accountId: actor.accountId,
          feature,
          usageDate: usageDateForTimestamp(nowMs),
          cap: dailyCap,
        })
      } catch (error) {
        sendUsagePolicyUnavailable(res, feature, error)
        return false
      }
      if (!reservation.allowed) {
        const retryAfterSeconds = secondsUntilNextUtcDay(nowMs)
        operationsMonitor.record('ai', 'denied', {
          code: 'daily_feature_cap_exceeded',
          feature,
        })
        res.setHeader('Retry-After', String(retryAfterSeconds))
        sendJson(res, 429, {
          error: `Daily hosted AI limit exceeded for ${feature}.`,
          code: 'daily_feature_cap_exceeded',
          feature,
          limit: dailyCap,
          retryAfterSeconds,
        })
        return false
      }
      onDailyReservation({
        userId: actor.userId,
        tenantId: actor.tenantId,
        accountId: actor.accountId,
        feature,
        usageDate: usageDateForTimestamp(nowMs),
      })
    }

    return true
  }
  const stripeClient =
    options.stripeClient ??
    (options.stripeSecretKey
      ? createStripeBillingClient({
          secretKey: options.stripeSecretKey,
        })
      : null)

  if (authMode === 'hosted' && !stripeClient) {
    console.warn(
      '[proxy] hosted mode: Stripe client not configured; billing checkout will be unavailable',
    )
  }
  if (authMode === 'hosted' && !options.stripePriceId) {
    console.warn(
      '[proxy] hosted mode: Stripe price id not configured; billing checkout will be unavailable',
    )
  }

  const billingApi =
    authMode === 'hosted'
      ? createBillingApi({
          actorResolver: resolveRequestActor,
          billingStore,
          stripeClient,
          stripePriceId: options.stripePriceId,
          successUrl:
            options.billingSuccessUrl ??
            `${allowedOrigins[0] ?? 'http://localhost:5173'}/settings/billing/success`,
          cancelUrl:
            options.billingCancelUrl ??
            `${allowedOrigins[0] ?? 'http://localhost:5173'}/settings/billing/cancel`,
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
  const researchJobStore =
    options.researchJobStore ??
    (options.researchJobStoreFile
      ? createFileResearchJobStore(options.researchJobStoreFile)
      : createInMemoryResearchJobStore())
  const researchJobNow =
    options.researchJobNow ?? (() => normalizeTimestampMs(options.now?.(), Date.now()))
  const researchJobApi = createResearchJobService({
    actorResolver: resolveResearchJobActor,
    anthropicClient,
    store: researchJobStore,
    readBody: (request) => readBody(request, maxBodyBytes),
    sendJson,
    now: researchJobNow,
    ttlMs: options.researchJobTtlMs,
    heartbeatTimeoutMs: options.researchJobHeartbeatTimeoutMs,
    progressIntervalMs: options.researchJobProgressIntervalMs,
    sseEnabled: options.researchJobSseEnabled,
    sseKeepaliveMs: options.researchJobSseKeepaliveMs,
    sseReauthIntervalMs: options.researchJobSseReauthIntervalMs,
    sseExposeThinking: options.researchJobSseExposeThinking,
    maxAttempts: options.researchJobMaxAttempts,
    retryBaseDelayMs: options.researchJobRetryBaseDelayMs,
    usageWindowMs: options.researchUsageWindowMs,
    budgetCents: options.researchBudgetCents,
    warningRatio: options.researchBudgetWarningRatio,
    estimatedInputTokens: options.researchEstimatedInputTokens,
    estimatedOutputTokens: options.researchEstimatedOutputTokens,
    opusAvailable: modelCapabilities.opus.available,
    model: CURRENT_OPUS_MODEL,
    logger: options.logger ?? console,
    onEvent: (scope, result, details) => operationsMonitor.record(scope, result, details),
  })

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

    operationsMonitor.record(monitorScopeForBucket(bucket), 'rate_limited', {
      bucket,
      feature: bucket.startsWith('ai:') ? bucket.slice('ai:'.length) : undefined,
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
      authMode === 'hosted' && Boolean(extractBearerToken(req.headers.authorization))

    if (!hasValidProxyApiKey && !hasHostedBearerToken) {
      sendJson(res, 401, {
        error: authMode === 'hosted' ? 'Authorization required' : 'Invalid proxy API key',
      })
      return
    }

    let dailyUsageReservation = null
    try {
      // Keep the explicit billing routes ahead of the generic AI handler.
      if (billingApi?.canHandle(req)) {
        if (!(await enforceHostedRouteRateLimit(req, res, url.pathname))) {
          return
        }
        await billingApi.handle(req, res, (request) => readBody(request, maxBodyBytes), sendJson)
        return
      }

      if (persistenceApi.canHandle(req)) {
        if (!(await enforceHostedRouteRateLimit(req, res, url.pathname))) {
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

      if (url.pathname === '/capabilities') {
        if (req.method !== 'GET') {
          sendJson(res, 405, { error: 'Method not allowed' })
          return
        }
        res.setHeader('Cache-Control', 'no-store')
        sendJson(res, 200, { modelCapabilities })
        return
      }

      if (researchJobApi.canHandle(url.pathname)) {
        if (!(await enforceHostedRouteRateLimit(req, res, url.pathname))) {
          return
        }
        await researchJobApi.handle(req, res, url)
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
      const {
        system,
        messages,
        temperature,
        max_tokens,
        model,
        thinking_budget,
        tools,
        feature,
        output_config,
        betas,
        capability_fallback,
      } = body

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

      // Declared at the outer handler scope so the usage-log instrumentation
      // after the Anthropic call can read actor fields. Only populated in
      // hosted mode; in local mode this stays undefined and the instrumentation
      // block no-ops on the `authMode === 'hosted'` guard.
      let actor
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

        if (!enforceHostedRateLimit(req, res, url.pathname, aiFeatureBucket(feature), actor)) {
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

        if (
          !(await enforceHostedAiUsagePolicy(res, actor, feature, (reservation) => {
            dailyUsageReservation = reservation
          }))
        ) {
          return
        }
      }

      const requestedModel = typeof model === 'string' ? model : undefined
      const isOpusFallback = isApprovedOpusFallback({
        feature,
        requestedModel,
        capabilityFallback: capability_fallback,
      })
      const resolvedModel = isOpusFallback
        ? CURRENT_SONNET_MODEL
        : resolveFeatureModel(model, feature, defaultModel)
      if (!allowedModelValues.has(resolvedModel)) {
        sendJson(res, 400, { error: 'Requested model is not allowed' })
        return
      }
      if (modelRequiresOpus(resolvedModel) && !modelCapabilities.opus.available) {
        sendJson(res, 503, {
          ...OPUS_UNAVAILABLE_ERROR,
          feature: feature ?? null,
          phase: feature === 'research.deep-search' ? 'phase_2' : 'phase_1',
        })
        return
      }

      const resolvedTemp = Number.isFinite(defaultTemperature)
        ? defaultTemperature
        : (temperature ?? 0.3)
      const featureMaxRequestTokens = maxRequestTokensForFeature(feature, maxRequestTokens)
      const resolvedMaxTokens = Math.max(
        1,
        Math.min(
          featureMaxRequestTokens,
          typeof max_tokens === 'number' ? Math.floor(max_tokens) : defaultMaxTokens,
        ),
      )
      const requestedThinkingBudget = thinking_budget ?? defaultThinkingBudget
      const normalizedThinkingBudget = Number.isFinite(requestedThinkingBudget)
        ? Math.max(0, Math.floor(requestedThinkingBudget))
        : 0
      const resolvedThinkingBudget = Math.min(
        normalizedThinkingBudget,
        Math.max(0, resolvedMaxTokens - 1),
      )
      const useThinking = resolvedThinkingBudget > 0
      const normalizedTools = normalizeTools(tools)
      if (Array.isArray(tools) && normalizedTools.length !== tools.length) {
        sendJson(res, 400, { error: 'One or more requested tools are not allowed' })
        return
      }
      const normalizedOutputConfig = normalizeOutputConfig(output_config)
      if (output_config !== undefined && output_config !== null && !normalizedOutputConfig) {
        sendJson(res, 400, { error: 'Requested output_config must be an object' })
        return
      }
      const normalizedBetas = normalizeBetas(betas)
      if (normalizedBetas === null) {
        sendJson(res, 400, { error: 'Requested betas must be an array of strings' })
        return
      }

      const params = {
        model: resolvedModel,
        max_tokens: resolvedMaxTokens,
        system: system || undefined,
        messages,
        ...(normalizedTools.length > 0 ? { tools: normalizedTools } : {}),
        ...(normalizedOutputConfig ? { output_config: normalizedOutputConfig } : {}),
      }

      if (useThinking) {
        // Translate manual extended thinking → adaptive on 4.6/4.7. Manual 400s on
        // Opus 4.7 and is deprecated on Sonnet 4.6. Older models retain manual.
        params.thinking = ADAPTIVE_THINKING_MODELS.has(resolvedModel)
          ? { type: 'adaptive' }
          : { type: 'enabled', budget_tokens: resolvedThinkingBudget }
      } else if (!shouldOmitTemperature(resolvedModel)) {
        params.temperature = resolvedTemp
      } else if (temperature !== undefined) {
        // Only warn on caller-supplied temperature. Omitting a server default is expected.
        console.warn(
          '[proxy] omitting temperature because it is not accepted by model',
          resolvedModel,
        )
      }

      // Map thinking_budget magnitude → effort on adaptive-thinking models when the
      // caller didn't explicitly set effort. Adaptive thinking ignores numeric budgets,
      // so derive an effort level so the caller's "depth intent" still influences output.
      if (
        useThinking &&
        ADAPTIVE_THINKING_MODELS.has(resolvedModel) &&
        resolvedThinkingBudget > 0
      ) {
        if (!params.output_config) params.output_config = {}
        if (params.output_config.effort === undefined) {
          params.output_config.effort = deriveEffortFromBudget(resolvedThinkingBudget)
        }
      }

      // Strip output_config.effort if the resolved model rejects it (Haiku 4.5 / Sonnet 4.5).
      // Without this guard, callers' effort flags silently 400 the request upstream.
      if (params.output_config?.effort !== undefined && !MODELS_ACCEPT_EFFORT.has(resolvedModel)) {
        console.warn('[proxy] stripping output_config.effort; not accepted by model', resolvedModel)
        const { effort: _stripped, ...rest } = params.output_config
        if (Object.keys(rest).length > 0) {
          params.output_config = rest
        } else {
          delete params.output_config
        }
      }

      const start = Date.now()
      const requestOptions =
        normalizedBetas.length > 0
          ? { headers: { 'anthropic-beta': normalizedBetas.join(',') } }
          : undefined
      const result = requestOptions
        ? await anthropicClient.messages.create(params, requestOptions)
        : await anthropicClient.messages.create(params)
      const elapsed = Date.now() - start

      const thinkingSuffix = params.thinking?.type ? ` thinking=${params.thinking.type}` : ''
      const effortSuffix = params.output_config?.effort
        ? ` effort=${params.output_config.effort}`
        : ''
      console.log(
        `[proxy] ${resolvedModel} ${result.usage?.input_tokens ?? '?'}in/${result.usage?.output_tokens ?? '?'}out ${elapsed}ms${thinkingSuffix}${effortSuffix}`,
      )
      if (authMode === 'hosted') {
        operationsMonitor.record('ai', 'success', {
          feature,
          method: req.method,
          model: resolvedModel,
          path: url.pathname,
        })

        // Fire-and-forget per-call usage log for cost observability. Actor
        // is guaranteed non-null here because the hosted path above already
        // short-circuits on missing actor/tenant. The store's recordCall
        // handles its own errors — never await it on the response path.
        if (usageStore && actor && typeof usageStore.recordCall === 'function') {
          const inputTokens = Number(result.usage?.input_tokens ?? 0)
          const outputTokens = Number(result.usage?.output_tokens ?? 0)
          const estCostCents = estimateCostCents(resolvedModel, inputTokens, outputTokens)
          const cacheNow = hostedAiUsagePolicyNow()
          if (globalSpendCache.expiresAt > cacheNow) {
            globalSpendCache = {
              ...globalSpendCache,
              spendCents: globalSpendCache.spendCents + estCostCents,
            }
          }
          void usageStore.recordCall({
            userId: actor.userId,
            tenantId: actor.tenantId,
            accountId: actor.accountId,
            feature,
            model: resolvedModel,
            inputTokens,
            outputTokens,
            estCostCents,
            status: 'ok',
          })
        }
      }

      res.setHeader('X-Facet-Resolved-Model', resolvedModel)
      sendJson(res, 200, result)
    } catch (error) {
      if (
        dailyUsageReservation &&
        usageStore &&
        typeof usageStore.refundDailyFeatureCall === 'function'
      ) {
        try {
          await usageStore.refundDailyFeatureCall(dailyUsageReservation)
        } catch (refundError) {
          console.error('[proxy] failed to refund AI daily usage reservation', refundError)
        }
      }
      const status = error?.status ?? 500
      const fallbackMessage = 'Internal proxy error'
      const upstreamMessage =
        typeof error?.message === 'string' && error.message.trim()
          ? error.message.trim()
          : fallbackMessage
      let message = upstreamMessage
      if (status >= 500 && status !== 529) {
        message = fallbackMessage
      }
      console.error(`[proxy] ${status}: ${message}`)
      sendJson(res, status, { error: message })
    }
  })

  server.on('close', () => {
    hostedRateLimiter.dispose?.()
    researchJobApi.dispose?.()
  })

  return {
    server,
    persistenceStore,
    researchJobStore,
    researchJobApi,
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
    throw new Error('Hosted mode requires FACET_ENVIRONMENT=local|staging|production.')
  }
  const environment =
    rawEnvironment === 'production' || rawEnvironment === 'staging' ? rawEnvironment : 'local'
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
  const hostedAuth =
    authMode === 'hosted'
      ? {
          issuer:
            env.SUPABASE_JWT_ISSUER ??
            (env.SUPABASE_URL ? `${env.SUPABASE_URL.replace(/\/+$/, '')}/auth/v1` : undefined),
          audience: env.SUPABASE_JWT_AUDIENCE ?? 'authenticated',
          jwksUrl: env.SUPABASE_JWKS_URL,
          membershipStore: hostedWorkspaceStore,
        }
      : undefined
  const billingBaseUrl =
    env.BILLING_APP_URL ?? env.PUBLIC_APP_URL ?? allowedOrigins[0] ?? 'http://localhost:5173'
  const billingStore =
    authMode === 'hosted'
      ? hostedPool
        ? createPostgresBillingStore(hostedPool)
        : createFileHostedBillingStore(env.HOSTED_BILLING_FILE)
      : undefined
  // Usage logging requires Postgres. If hostedPool is absent (file-backed
  // transitional hosted mode), usage observability is off for that
  // deployment — the instrumentation point no-ops on null.
  const usageStore =
    authMode === 'hosted' && hostedPool ? createPostgresUsageStore(hostedPool) : undefined

  if (authMode === 'hosted' && environment !== 'local') {
    if ((env.PROXY_API_KEY ?? DEFAULT_PROXY_API_KEY) === DEFAULT_PROXY_API_KEY) {
      throw new Error('Hosted staging/production must not rely on the default PROXY_API_KEY.')
    }

    if (env.PERSISTENCE_AUTH_TOKENS) {
      throw new Error('Hosted staging/production must not use PERSISTENCE_AUTH_TOKENS.')
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
    opusAvailable: env.FACET_OPUS_AVAILABLE,
    proxyApiKey: env.PROXY_API_KEY ?? DEFAULT_PROXY_API_KEY,
    hostedRateLimits: {
      ai: {
        max: parsePositiveInteger(env.HOSTED_AI_RATE_LIMIT_MAX, DEFAULT_HOSTED_RATE_LIMITS.ai.max),
        windowMs: parsePositiveInteger(
          env.HOSTED_AI_RATE_LIMIT_WINDOW_MS,
          DEFAULT_HOSTED_RATE_LIMITS.ai.windowMs,
        ),
      },
      aiFeatures: parseHostedAiFeatureRateLimits(env, DEFAULT_AI_FEATURE_RATE_LIMITS),
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
      authMode === 'hosted' ? undefined : parsePersistenceAuthTokens(env.PERSISTENCE_AUTH_TOKENS),
    hostedWorkspaceStore,
    hostedAuth,
    billingStore,
    usageStore,
    researchJobStore: env.RESEARCH_JOBS_FILE
      ? createFileResearchJobStore(env.RESEARCH_JOBS_FILE)
      : undefined,
    researchUsageWindowMs: parsePositiveInteger(env.RESEARCH_USAGE_WINDOW_MS, undefined),
    researchBudgetCents: parseNonNegativeInteger(env.RESEARCH_BUDGET_CENTS, undefined),
    researchBudgetWarningRatio: parseRatio(env.RESEARCH_BUDGET_WARNING_RATIO, undefined),
    researchEstimatedInputTokens: parsePositiveInteger(
      env.RESEARCH_ESTIMATED_INPUT_TOKENS,
      undefined,
    ),
    researchEstimatedOutputTokens: parsePositiveInteger(
      env.RESEARCH_ESTIMATED_OUTPUT_TOKENS,
      undefined,
    ),
    hostedAiUsagePolicy: parseHostedAiUsagePolicy(env),
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
