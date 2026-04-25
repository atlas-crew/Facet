import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

const TERMINAL = new Set(['completed', 'canceled', 'failed'])
const IN_FLIGHT = new Set(['queued', 'running'])
const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1_000
const DEFAULT_HEARTBEAT_TIMEOUT_MS = 5 * 60 * 1_000
const DEFAULT_PROGRESS_INTERVAL_MS = 15_000
const DEFAULT_MAX_ATTEMPTS = 3
const DEFAULT_RETRY_BASE_DELAY_MS = 1_000

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function clone(value) {
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value))
}

function stableStringify(value) {
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']'
  if (!isRecord(value)) return JSON.stringify(value)
  return '{' + Object.keys(value).sort().map((key) => (
    JSON.stringify(key) + ':' + stableStringify(value[key])
  )).join(',') + '}'
}

function paramsHash(thesisId, params, userId) {
  return createHash('sha256')
    .update(stableStringify({ thesisId, params, userId }))
    .digest('hex')
}

function actorMatches(job, actor) {
  if (!job || !actor || job.userId !== actor.userId) return false
  if ((job.tenantId ?? null) !== (actor.tenantId ?? null)) return false
  if ((job.accountId ?? null) !== (actor.accountId ?? null)) return false
  return true
}

function ttlAt(nowMs, ttlMs) {
  return new Date(nowMs + ttlMs).toISOString()
}

function elapsedMs(job, nowMs) {
  const startedAt = Date.parse(job.startedAt ?? job.createdAt)
  return Number.isFinite(startedAt) ? Math.max(0, nowMs - startedAt) : 0
}

function normalizeJob(value) {
  if (!isRecord(value)) return null
  if (!value.id || !value.userId || !value.thesisId || !value.createdAt || !value.ttlAt) return null
  if (!['queued', 'running', 'completed', 'canceled', 'failed'].includes(value.status)) return null
  if (!isRecord(value.thesisSnapshot) || !isRecord(value.params)) return null
  return clone(value)
}

function makeJob({ actor, thesisId, thesisSnapshot, identityVersion, params, hash, nowMs, ttlMs }) {
  const nowIso = new Date(nowMs).toISOString()
  return {
    id: randomUUID(),
    userId: actor.userId,
    tenantId: actor.tenantId ?? null,
    accountId: actor.accountId ?? null,
    thesisId,
    thesisSnapshot: clone(thesisSnapshot),
    identityVersion,
    params: clone(params),
    paramsHash: hash,
    status: 'queued',
    createdAt: nowIso,
    ttlAt: ttlAt(nowMs, ttlMs),
  }
}

export function createInMemoryResearchJobStore(records = []) {
  const jobs = new Map(records.map(normalizeJob).filter(Boolean).map((job) => [job.id, job]))

  const cleanup = async (nowMs) => {
    let deletedCount = 0
    for (const [id, job] of jobs) {
      if (TERMINAL.has(job.status) && Date.parse(job.ttlAt) <= nowMs) {
        jobs.delete(id)
        deletedCount += 1
      }
    }
    return deletedCount
  }

  return {
    async createJob(request) {
      await cleanup(request.nowMs)
      const duplicate = [...jobs.values()].find((job) => (
        actorMatches(job, request.actor) &&
        job.thesisId === request.thesisId &&
        job.paramsHash === request.hash &&
        IN_FLIGHT.has(job.status)
      ))
      if (duplicate) return { job: clone(duplicate), duplicate: true }

      const job = makeJob(request)
      jobs.set(job.id, job)
      return { job: clone(job), duplicate: false }
    },
    async getJobForActor(id, actor, nowMs = Date.now()) {
      await cleanup(nowMs)
      const job = jobs.get(id)
      return actorMatches(job, actor) ? clone(job) : null
    },
    async listJobsForActor(actor, { limit = 20, offset = 0, nowMs = Date.now() } = {}) {
      await cleanup(nowMs)
      return [...jobs.values()]
        .filter((job) => actorMatches(job, actor))
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .slice(offset, offset + limit)
        .map(clone)
    },
    async updateJob(id, updater, nowMs = Date.now()) {
      await cleanup(nowMs)
      const current = jobs.get(id)
      if (!current) return null
      const next = updater(clone(current))
      if (!next) return null
      jobs.set(id, clone(next))
      return clone(next)
    },
    async cancelJobForActor(id, actor, nowMs = Date.now(), ttlMs = DEFAULT_TTL_MS) {
      return this.updateJob(id, (job) => {
        if (!actorMatches(job, actor)) return null
        if (TERMINAL.has(job.status)) return job
        return {
          ...job,
          status: 'canceled',
          completedAt: new Date(nowMs).toISOString(),
          ttlAt: ttlAt(nowMs, ttlMs),
          progress: {
            phase: 'canceled',
            elapsedMs: elapsedMs(job, nowMs),
            searchQueries: job.progress?.searchQueries ?? [],
          },
        }
      }, nowMs)
    },
    async failOrphanedJobs(nowMs, heartbeatTimeoutMs, ttlMs = DEFAULT_TTL_MS) {
      const failed = []
      for (const [id, job] of jobs) {
        if (job.status !== 'queued' && job.status !== 'running') continue
        const heartbeatAt = Date.parse(job.heartbeatAt ?? job.startedAt ?? job.createdAt)
        if (Number.isFinite(heartbeatAt) && nowMs - heartbeatAt > heartbeatTimeoutMs) {
          const next = {
            ...job,
            status: 'failed',
            completedAt: new Date(nowMs).toISOString(),
            ttlAt: ttlAt(nowMs, ttlMs),
            error: {
              code: 'runner_heartbeat_timeout',
              message: 'Research job runner heartbeat timed out.',
              retriable: true,
            },
          }
          jobs.set(id, next)
          failed.push(clone(next))
        }
      }
      return failed
    },
    async cleanup(nowMs = Date.now()) {
      return cleanup(nowMs)
    },
    async allJobs() {
      return [...jobs.values()].map(clone)
    },
  }
}

export function createFileResearchJobStore(filePath) {
  if (!filePath) throw new Error('Research jobs require a file path.')
  let operationQueue = Promise.resolve()

  const readJobs = async () => {
    try {
      const raw = await readFile(filePath, 'utf8')
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed.jobs) ? parsed.jobs.map(normalizeJob).filter(Boolean) : []
    } catch (error) {
      if (error?.code === 'ENOENT') return []
      throw error
    }
  }
  const withStore = (operation, persist = false) => {
    const run = operationQueue.then(async () => {
      const store = createInMemoryResearchJobStore(await readJobs())
      const result = await operation(store)
      const shouldPersist = typeof persist === 'function' ? persist(result) : persist
      if (shouldPersist) {
        await mkdir(dirname(filePath), { recursive: true })
        const tempPath = filePath + '.' + randomUUID() + '.tmp'
        await writeFile(tempPath, JSON.stringify({ jobs: await store.allJobs() }, null, 2))
        await rename(tempPath, filePath)
      }
      return result
    })
    operationQueue = run.catch(() => {})
    return run
  }

  return {
    createJob: (request) => withStore((store) => store.createJob(request), true),
    getJobForActor: (id, actor, nowMs) => withStore((store) => store.getJobForActor(id, actor, nowMs)),
    listJobsForActor: (actor, options) => withStore((store) => store.listJobsForActor(actor, options)),
    updateJob: (id, updater, nowMs) => withStore((store) => store.updateJob(id, updater, nowMs), true),
    cancelJobForActor: (id, actor, nowMs, ttlMs) =>
      withStore((store) => store.cancelJobForActor(id, actor, nowMs, ttlMs), true),
    failOrphanedJobs: (nowMs, heartbeatTimeoutMs, ttlMs) =>
      withStore(
        (store) => store.failOrphanedJobs(nowMs, heartbeatTimeoutMs, ttlMs),
        (failed) => failed.length > 0,
      ),
    cleanup: (nowMs) => withStore((store) => store.cleanup(nowMs), (deletedCount) => deletedCount > 0),
    allJobs: () => withStore((store) => store.allJobs()),
  }
}

function getResponseText(response) {
  if (!Array.isArray(response?.content)) return ''
  return response.content
    .filter((part) => part && typeof part === 'object' && part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join('\n')
}

function parseJsonPayload(text) {
  const fencedJson = text.match(/\`\`\`(?:json)?\s*([\s\S]*?)\s*\`\`\`/i)
  if (fencedJson?.[1]) {
    try {
      return JSON.parse(fencedJson[1])
    } catch {}
  }
  const firstBrace = text.indexOf('{')
  const lastBrace = text.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) return JSON.parse(text.slice(firstBrace, lastBrace + 1))
  return JSON.parse(text)
}

function countSentences(text) {
  const matches = typeof text === 'string' ? text.match(/[.!?]+(?=\s|$)/g) : null
  return matches ? matches.length : 0
}

function validateNarrative(narrative) {
  const violations = []
  for (const key of ['competitiveMoat', 'selectionMethodology', 'marketContext', 'executiveSummary']) {
    if (typeof narrative?.[key] !== 'string' || !narrative[key].trim()) {
      violations.push('narrative.' + key + ': missing or empty')
    }
  }
  return violations
}

function parseResearchResult(response) {
  const parsed = isRecord(response?.result) ? response.result : parseJsonPayload(getResponseText(response))
  const payload = isRecord(parsed.result) ? parsed.result : parsed
  const narrative = isRecord(payload.narrative) ? payload.narrative : null
  const results = Array.isArray(payload.results) ? payload.results : []
  if (!narrative) {
    throw Object.assign(new Error('Research result did not include a narrative object.'), {
      status: 422,
      code: 'invalid_research_result',
    })
  }

  const inputTokens = Number(payload.tokenUsage?.inputTokens ?? response?.usage?.input_tokens ?? 0)
  const outputTokens = Number(payload.tokenUsage?.outputTokens ?? response?.usage?.output_tokens ?? 0)
  const contractViolations = [
    ...validateNarrative(narrative),
    ...results.flatMap((entry, index) => {
      const edge = typeof entry?.candidateEdge === 'string' ? entry.candidateEdge : ''
      return edge && countSentences(edge) < 2
        ? ['results[' + index + '].candidateEdge: expected at least 2 sentences']
        : []
    }),
  ]

  return {
    narrative,
    results,
    tokenUsage: {
      inputTokens,
      outputTokens,
      totalTokens: Number(payload.tokenUsage?.totalTokens ?? inputTokens + outputTokens),
    },
    ...(contractViolations.length > 0 ? { contractViolations } : {}),
  }
}

function classifyError(error) {
  const status = Number(error?.status ?? 0)
  const retriable =
    error?.name !== 'AbortError' &&
    (status === 408 || status === 409 || status === 425 || status === 429 || status >= 500)
  return {
    code:
      typeof error?.code === 'string'
        ? error.code
        : status
          ? 'upstream_' + status
          : error?.name === 'AbortError'
            ? 'aborted'
            : 'research_job_failed',
    message:
      typeof error?.message === 'string' && error.message.trim()
        ? error.message.trim()
        : 'Research job failed.',
    retriable,
  }
}

function delay(ms, signal) {
  if (ms <= 0) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      const error = new Error('aborted')
      error.name = 'AbortError'
      reject(error)
    }, { once: true })
  })
}

function validateCreatePayload(body) {
  if (!isRecord(body)) return { error: 'Research job request body must be a JSON object.' }
  const thesisSnapshot = body.thesisSnapshot
  if (!isRecord(thesisSnapshot)) return { error: 'Research job requires thesisSnapshot.' }
  const thesisId =
    typeof body.thesisId === 'string' && body.thesisId.trim()
      ? body.thesisId.trim()
      : typeof thesisSnapshot.id === 'string'
        ? thesisSnapshot.id.trim()
        : ''
  if (!thesisId) return { error: 'Research job requires thesisId.' }
  if (typeof thesisSnapshot.narrative !== 'string' || !thesisSnapshot.narrative.trim()) {
    return { error: 'Research job thesisSnapshot must include narrative.' }
  }
  if (!Array.isArray(thesisSnapshot.skillDepthMap) || thesisSnapshot.skillDepthMap.length === 0) {
    return { error: 'Research job thesisSnapshot must include identity evidence.' }
  }
  if (!isRecord(body.params)) return { error: 'Research job requires params.' }
  const identityVersion = Number(body.identityVersion ?? thesisSnapshot.identityVersion)
  if (!Number.isFinite(identityVersion) || identityVersion < 0) {
    return { error: 'Research job requires identityVersion.' }
  }
  return {
    thesisId,
    thesisSnapshot,
    params: body.params,
    identityVersion: Math.floor(identityVersion),
  }
}

function buildPrompt(job) {
  return [
    'Execute deep job research from this approved search thesis.',
    'Return strict JSON with keys: narrative, results.',
    'Narrative must include competitiveMoat, selectionMethodology, marketContext, executiveSummary.',
    'Each result should include candidateEdge with at least two sentences when possible.',
    '',
    'Thesis snapshot:\n' + JSON.stringify(job.thesisSnapshot, null, 2),
    '',
    'Search params:\n' + JSON.stringify(job.params, null, 2),
  ].join('\n')
}

function buildAnthropicParams(job, config) {
  return {
    model: config.model,
    max_tokens: config.maxTokens,
    system: 'You are Facet deep research. Produce only the requested JSON result.',
    messages: [{ role: 'user', content: buildPrompt(job) }],
    thinking: { type: 'enabled', budget_tokens: config.thinkingBudgetTokens },
    output_config: {
      effort: config.effort,
      task_budget: { type: 'tokens', total: config.taskBudgetTokens },
    },
    tools: [{ type: config.webSearchToolType, name: 'web_search', max_uses: config.webSearchMaxUses }],
  }
}

function parseLimit(url) {
  const parsed = Number.parseInt(url.searchParams.get('limit') ?? '', 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return 20
  return Math.min(100, parsed)
}

function parseOffset(url) {
  const parsed = Number.parseInt(url.searchParams.get('offset') ?? url.searchParams.get('cursor') ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

export function createResearchJobService(options) {
  const store = options.store ?? createInMemoryResearchJobStore()
  const now = options.now ?? (() => Date.now())
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS
  const heartbeatTimeoutMs = options.heartbeatTimeoutMs ?? DEFAULT_HEARTBEAT_TIMEOUT_MS
  const progressIntervalMs = options.progressIntervalMs ?? DEFAULT_PROGRESS_INTERVAL_MS
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
  const retryBaseDelayMs = options.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS
  const onEvent = options.onEvent ?? (() => {})
  const logger = options.logger ?? console
  const activeRunners = new Map()
  const config = {
    model: options.model ?? 'claude-opus-4-7',
    maxTokens: options.maxTokens ?? 128_000,
    thinkingBudgetTokens: options.thinkingBudgetTokens ?? 15_000,
    taskBudgetTokens: options.taskBudgetTokens ?? 80_000,
    effort: options.effort ?? 'high',
    webSearchToolType: options.webSearchToolType ?? 'web_search_20260209',
    webSearchMaxUses: options.webSearchMaxUses ?? 20,
    beta: options.beta ?? 'task-budgets-2026-03-13',
  }

  const record = (result, details) => onEvent('research_job', result, details)
  const resolveActor = async (req) => {
    const actor = await options.actorResolver(req)
    if (!actor?.userId) {
      const error = new Error('Research jobs require an authenticated actor.')
      error.status = 401
      throw error
    }
    return actor
  }
  const runMaintenance = async () => {
    const nowMs = now()
    const failed = await store.failOrphanedJobs(nowMs, heartbeatTimeoutMs, ttlMs)
    for (const job of failed) record('failed', { jobId: job.id, userId: job.userId, code: job.error?.code })
    await store.cleanup(nowMs)
  }
  const updateProgress = async (jobId, phase, extra = {}) => {
    const nowMs = now()
    return store.updateJob(jobId, (job) => {
      if (!job || TERMINAL.has(job.status)) return job
      return {
        ...job,
        heartbeatAt: new Date(nowMs).toISOString(),
        progress: {
          phase,
          elapsedMs: elapsedMs(job, nowMs),
          searchQueries: job.progress?.searchQueries ?? [],
          ...(typeof job.progress?.findingsCount === 'number' ? { findingsCount: job.progress.findingsCount } : {}),
          ...extra,
        },
      }
    }, nowMs)
  }
  const startRunner = (jobId) => {
    if (activeRunners.has(jobId)) return
    const abortController = new AbortController()
    activeRunners.set(jobId, abortController)
    void runJob(jobId, abortController)
      .catch((error) => {
        logger.error?.('[research-jobs] runner crashed', error)
        record('failed', { jobId, code: 'runner_unhandled_error' })
      })
      .finally(() => activeRunners.delete(jobId))
  }
  const runJob = async (jobId, abortController) => {
    let interval = null
    try {
      let job = await store.updateJob(jobId, (current) => {
        if (!current || current.status !== 'queued') return current
        const nowMs = now()
        return {
          ...current,
          status: 'running',
          startedAt: new Date(nowMs).toISOString(),
          heartbeatAt: new Date(nowMs).toISOString(),
          progress: { phase: 'starting deep research', elapsedMs: 0, searchQueries: [], findingsCount: 0 },
        }
      }, now())
      if (!job || job.status !== 'running') return
      record('running', { jobId: job.id, userId: job.userId, status: job.status })
      interval = setInterval(() => {
        void updateProgress(jobId, 'running deep research')
          .catch((error) => {
            logger.error?.('[research-jobs] progress update failed', error)
          })
      }, progressIntervalMs)

      let response
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          await updateProgress(
            jobId,
            attempt === 1 ? 'calling Anthropic Task Budgets' : 'retrying Anthropic Task Budgets',
          )
          response = await options.anthropicClient.messages.create(
            buildAnthropicParams(job, config),
            { headers: { 'anthropic-beta': config.beta }, signal: abortController.signal },
          )
          break
        } catch (error) {
          const classified = classifyError(error)
          if (abortController.signal.aborted) return
          if (!classified.retriable || attempt >= maxAttempts) {
            throw Object.assign(error, { researchJobError: classified })
          }
          record('retry', { jobId, userId: job.userId, attempt, code: classified.code })
          await delay(retryBaseDelayMs * attempt, abortController.signal)
        }
      }

      job = await store.getJobForActor(jobId, job, now())
      if (!job || job.status === 'canceled') return
      const result = parseResearchResult(response)
      const nowMs = now()
      const completed = await store.updateJob(jobId, (current) => {
        if (!current || TERMINAL.has(current.status)) return current
        return {
          ...current,
          status: 'completed',
          completedAt: new Date(nowMs).toISOString(),
          ttlAt: ttlAt(nowMs, ttlMs),
          progress: {
            phase: 'completed',
            elapsedMs: elapsedMs(current, nowMs),
            searchQueries: current.progress?.searchQueries ?? [],
            findingsCount: result.results.length,
          },
          result,
        }
      }, nowMs)
      if (!completed || completed.status !== 'completed') return
      record('completed', {
        jobId,
        userId: completed?.userId,
        tokenUsage: result.tokenUsage,
        contractViolations: result.contractViolations?.length ?? 0,
      })
    } catch (error) {
      if (abortController.signal.aborted || error?.name === 'AbortError') return
      const classified = error?.researchJobError ?? classifyError(error)
      const nowMs = now()
      const failed = await store.updateJob(jobId, (job) => {
        if (!job || TERMINAL.has(job.status)) return job
        return {
          ...job,
          status: 'failed',
          completedAt: new Date(nowMs).toISOString(),
          ttlAt: ttlAt(nowMs, ttlMs),
          error: classified,
          progress: {
            phase: 'failed',
            elapsedMs: elapsedMs(job, nowMs),
            searchQueries: job.progress?.searchQueries ?? [],
          },
        }
      }, nowMs)
      logger.error?.('[research-jobs] runner failed', error, classified)
      record('failed', { jobId, userId: failed?.userId, code: classified.code, retriable: classified.retriable })
    } finally {
      if (interval) clearInterval(interval)
    }
  }
  const createJob = async (req, res) => {
    const actor = await resolveActor(req)
    const body = await options.readBody(req)
    const validation = validateCreatePayload(body)
    if (validation.error) {
      options.sendJson(res, 400, { error: validation.error, code: 'invalid_research_job_request' })
      return
    }
    await runMaintenance()
    const nowMs = now()
    const hash = paramsHash(validation.thesisId, validation.params, actor.userId)
    const { job, duplicate } = await store.createJob({
      actor,
      thesisId: validation.thesisId,
      thesisSnapshot: validation.thesisSnapshot,
      identityVersion: validation.identityVersion,
      params: validation.params,
      hash,
      nowMs,
      ttlMs,
    })
    if (!duplicate) {
      record('queued', { jobId: job.id, userId: job.userId, status: job.status })
      setTimeout(() => startRunner(job.id), 0)
    }
    options.sendJson(res, duplicate ? 200 : 202, {
      jobId: job.id,
      status: job.status,
      ...(duplicate ? { duplicate: true } : {}),
    })
  }
  const getJob = async (req, res, id) => {
    const actor = await resolveActor(req)
    await runMaintenance()
    const job = await store.getJobForActor(id, actor, now())
    if (!job) {
      options.sendJson(res, 404, { error: 'Research job not found.', code: 'research_job_not_found' })
      return
    }
    res.setHeader('Cache-Control', TERMINAL.has(job.status) ? 'no-cache' : 'no-store')
    options.sendJson(res, 200, { job })
  }
  const listJobs = async (req, res, url) => {
    const actor = await resolveActor(req)
    await runMaintenance()
    const limit = parseLimit(url)
    const offset = parseOffset(url)
    const jobs = await store.listJobsForActor(actor, { limit, offset, nowMs: now() })
    res.setHeader('Cache-Control', 'no-store')
    options.sendJson(res, 200, {
      jobs,
      pagination: { limit, offset, nextOffset: jobs.length === limit ? offset + limit : null },
    })
  }
  const cancelJob = async (req, res, id) => {
    const actor = await resolveActor(req)
    await runMaintenance()
    const job = await store.cancelJobForActor(id, actor, now(), ttlMs)
    if (!job) {
      options.sendJson(res, 404, { error: 'Research job not found.', code: 'research_job_not_found' })
      return
    }
    activeRunners.get(id)?.abort()
    record('canceled', { jobId: job.id, userId: job.userId, status: job.status })
    options.sendJson(res, 200, { job })
  }

  return {
    store,
    canHandle(pathname) {
      return pathname === '/research/jobs' || /^\/research\/jobs\/[^/]+(?:\/cancel)?$/.test(pathname)
    },
    async handle(req, res, url) {
      const match = url.pathname.match(/^\/research\/jobs\/([^/]+)(?:\/(cancel))?$/)
      if (url.pathname === '/research/jobs' && req.method === 'POST') return createJob(req, res)
      if (url.pathname === '/research/jobs' && req.method === 'GET') return listJobs(req, res, url)
      if (match?.[1] && match[2] === 'cancel' && req.method === 'POST') return cancelJob(req, res, match[1])
      if (match?.[1] && !match[2] && req.method === 'GET') return getJob(req, res, match[1])
      options.sendJson(res, 405, { error: 'Method not allowed' })
    },
    async sweepOrphanedJobs() {
      await runMaintenance()
    },
    dispose() {
      for (const controller of activeRunners.values()) controller.abort()
      activeRunners.clear()
    },
  }
}
