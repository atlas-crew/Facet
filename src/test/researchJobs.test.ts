import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import type { Server } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

type AnthropicCreate = (
  params: unknown,
  options?: {
    headers?: Record<string, string>
    signal?: AbortSignal
  },
) => Promise<unknown>

type SseRecord = {
  event?: string
  data?: Record<string, unknown>
  comment?: string
}

async function loadProxyModules() {
  const [{ createFacetServer }, { createFileResearchJobStore, createInMemoryResearchJobStore }] =
    await Promise.all([
      // @ts-expect-error runtime-tested local proxy module
      import('../../proxy/facetServer.js'),
      // @ts-expect-error runtime-tested local proxy module
      import('../../proxy/researchJobs.js'),
    ])

  return {
    createFacetServer,
    createFileResearchJobStore,
    createInMemoryResearchJobStore,
  }
}

const servers = new Set<Server>()
const tempDirs = new Set<string>()

afterEach(async () => {
  await Promise.all(
    [...servers].map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => {
            if (error && (error as NodeJS.ErrnoException).code !== 'ERR_SERVER_NOT_RUNNING') {
              reject(error)
              return
            }
            resolve()
          })
        }),
    ),
  )
  servers.clear()
  await Promise.all([...tempDirs].map((dir) => rm(dir, { recursive: true, force: true })))
  tempDirs.clear()
})

function jsonHeaders(token = 'member-token') {
  return {
    Authorization: 'Bearer ' + token,
    'Content-Type': 'application/json',
    Origin: 'http://localhost:5173',
    'X-Proxy-API-Key': 'proxy-key',
  }
}

function localJsonHeaders() {
  return {
    'Content-Type': 'application/json',
    Origin: 'http://localhost:5173',
    'X-Proxy-API-Key': 'proxy-key',
  }
}

function thesisSnapshot() {
  return {
    id: 'thesis-1',
    createdAt: '2026-03-15T11:00:00.000Z',
    updatedAt: '2026-03-15T11:05:00.000Z',
    competitiveMoat: 'Deep WAF and platform ownership.',
    unfairAdvantages: [
      {
        combination: 'WAF internals plus developer platform delivery',
        depth: 'hands-on',
        targetCompanyProfile: 'security platform teams',
      },
    ],
    searchLanes: [
      {
        id: 'lane-1',
        title: 'Security platform builders',
        rationale: 'Find teams where WAF depth changes the hiring signal.',
        targetSignals: ['WAF', 'edge security'],
      },
    ],
    lookFor: ['security platform', 'edge protection'],
    avoid: [],
    keywordCombinations: [
      {
        query: 'security platform engineer WAF',
        lane: 'lane-1',
        noiseLevel: 'low',
      },
    ],
    skillDepthMap: [
      {
        skill: 'WAF',
        depth: 'expert',
        context: 'Built and operated WAF detection systems.',
        searchSignal: 'Prioritize roles that need WAF internals.',
      },
    ],
    source: 'generated',
    identityVersion: 7,
    feedbackIncorporated: [],
  }
}

function researchPayload() {
  return {
    thesisId: 'thesis-1',
    identityVersion: 7,
    thesisSnapshot: thesisSnapshot(),
    identityEvidence: {
      archetype: 'Security-platform builder',
      arc: ['Edge Co: built WAF detection systems'],
      profiles: [{ id: 'profile-1', tags: ['security'], text: 'Platform security profile.' }],
      paioHighlights: ['Cut false positives with production WAF tuning.'],
      calibrations: ['Strong WAF internals; avoid generic SOC work.'],
    },
    promptContract: 'candidateEdge must be 2-4 sentences and factual claims need citations.',
    params: {
      id: 'request-1',
      createdAt: '2026-03-15T11:10:00.000Z',
      focusLanes: ['security-platform'],
      companySizeOverride: '',
      salaryAnchorOverride: '',
      geoExpand: true,
      customKeywords: 'WAF security platform',
      excludeCompanies: [],
      maxResults: { tier1: 1, tier2: 1, tier3: 0 },
    },
  }
}

const retiredFocusVectorRequestKey = 'focus' + 'Vectors'

function researchResponse(
  candidateEdge = 'The candidate wins because they have production WAF depth. That makes them credible fast.',
) {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          narrative: {
            competitiveMoat: 'WAF systems plus platform execution.',
            selectionMethodology: 'Prioritized companies where edge security is central.',
            marketContext: 'Security platforms are consolidating edge controls.',
            executiveSummary: 'This search favors security platform teams.',
          },
          results: [
            {
              id: 'result-1',
              tier: 1,
              company: 'Edge Co',
              title: 'Security Platform Engineer',
              url: 'https://example.com/jobs/1',
              matchScore: 94,
              matchReason: 'Strong WAF alignment.',
              vectorAlignment: 'security-platform',
              risks: [],
              source: 'mock',
              candidateEdge,
            },
          ],
          tokenUsage: { inputTokens: 11, outputTokens: 22, totalTokens: 33 },
        }),
      },
    ],
    usage: { input_tokens: 11, output_tokens: 22 },
  }
}

function streamingResearchResponse() {
  const response = researchResponse()
  return {
    ...response,
    content: [
      {
        type: 'thinking',
        thinking: 'Looking at the Platform + Security combination...',
      },
      {
        type: 'server_tool_use',
        name: 'web_search',
        input: { query: '"platform engineer" security startup' },
      },
      {
        type: 'web_search_tool_result',
        summary: 'Found 3 promising companies in early-stage security platform space.',
      },
      ...response.content,
    ],
  }
}

function fencedResearchResponse() {
  const response = researchResponse()
  const fence = String.fromCharCode(96, 96, 96)
  const rawPayload = JSON.parse(response.content[0].text)
  delete rawPayload.narrative.marketContext
  return {
    ...response,
    content: [
      {
        type: 'text',
        text:
          'Here is the result.\n' +
          fence +
          'json\n' +
          JSON.stringify(rawPayload) +
          '\n' +
          fence +
          '\nDone.',
      },
    ],
  }
}

function prefixedRawJsonResearchResponse() {
  const response = researchResponse()
  return {
    ...response,
    content: [
      {
        type: 'text',
        text:
          'Sure, here is the research payload:\n' + response.content[0].text + '\nEnd of payload.',
      },
    ],
  }
}

async function startResearchServer(
  options: {
    anthropicCreate?: AnthropicCreate
    maxAttempts?: number
    progressIntervalMs?: number
    sseEnabled?: boolean
    sseKeepaliveMs?: number
    sseReauthIntervalMs?: number
    sseExposeThinking?: boolean
    heartbeatTimeoutMs?: number
    ttlMs?: number
    researchBudgetCents?: number
    researchUsageWindowMs?: number
    researchBudgetWarningRatio?: number
    researchEstimatedInputTokens?: number
    researchEstimatedOutputTokens?: number
    opusAvailable?: boolean
    persistenceActorResolver?: (
      req: unknown,
      options?: { refresh?: boolean },
    ) => Promise<{
      tenantId?: string
      accountId?: string
      userId: string
      workspaces?: string[]
    }>
  } = {},
) {
  const { createFacetServer } = await loadProxyModules()
  let nowMs = Date.parse('2026-03-15T12:00:00.000Z')
  const logger = {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  }
  const { server, operationsMonitor, researchJobStore } = createFacetServer({
    allowedOrigins: ['http://localhost:5173'],
    proxyApiKey: 'proxy-key',
    persistenceAuthTokens: [
      {
        token: 'member-token',
        tenantId: 'tenant-1',
        userId: 'user-1',
        workspaces: ['ws-1'],
      },
      {
        token: 'other-token',
        tenantId: 'tenant-1',
        userId: 'user-2',
        workspaces: ['ws-2'],
      },
    ],
    persistenceActorResolver: options.persistenceActorResolver,
    anthropicClient: {
      messages: {
        create: options.anthropicCreate ?? (async () => researchResponse()),
      },
    },
    researchJobNow: () => nowMs,
    researchJobProgressIntervalMs: options.progressIntervalMs ?? 5,
    researchJobSseEnabled: options.sseEnabled,
    researchJobSseKeepaliveMs: options.sseKeepaliveMs,
    researchJobSseReauthIntervalMs: options.sseReauthIntervalMs,
    researchJobSseExposeThinking: options.sseExposeThinking,
    researchJobHeartbeatTimeoutMs: options.heartbeatTimeoutMs,
    researchJobTtlMs: options.ttlMs,
    researchJobMaxAttempts: options.maxAttempts ?? 2,
    researchJobRetryBaseDelayMs: 0,
    researchBudgetCents: options.researchBudgetCents,
    researchUsageWindowMs: options.researchUsageWindowMs,
    researchBudgetWarningRatio: options.researchBudgetWarningRatio,
    researchEstimatedInputTokens: options.researchEstimatedInputTokens,
    researchEstimatedOutputTokens: options.researchEstimatedOutputTokens,
    opusAvailable: options.opusAvailable,
    logger,
  })

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve())
  })
  servers.add(server)

  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Failed to bind research job test server.')
  }

  return {
    advance(ms: number) {
      nowMs += ms
    },
    baseUrl: 'http://127.0.0.1:' + address.port,
    logger,
    operationsMonitor,
    researchJobStore,
    server,
  }
}

async function waitUntil<T>(load: () => Promise<T>, predicate: (value: T) => boolean) {
  let latest: T | null = null
  for (let attempt = 0; attempt < 80; attempt += 1) {
    latest = await load()
    if (predicate(latest)) {
      return latest
    }
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error('Timed out waiting for condition. Latest: ' + JSON.stringify(latest))
}

async function fetchJob(baseUrl: string, jobId: string, token = 'member-token') {
  const response = await fetch(baseUrl + '/research/jobs/' + jobId, {
    headers: jsonHeaders(token),
  })
  const body = await response.json()
  return { response, body }
}

async function createResearchJob(baseUrl: string, token = 'member-token') {
  return fetch(baseUrl + '/research/jobs', {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify(researchPayload()),
  })
}

function parseSseBlock(block: string): SseRecord | null {
  const lines = block.split(/\r?\n/)
  const comment = lines
    .find((line) => line.startsWith(':'))
    ?.slice(1)
    .trim()
  if (comment) return { comment }

  const eventLine = lines.find((line) => line.startsWith('event:'))
  const dataLines = lines
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice('data:'.length).trimStart())
  if (!eventLine) return null

  return {
    event: eventLine.slice('event:'.length).trim(),
    data: dataLines.length > 0 ? JSON.parse(dataLines.join('\n')) : {},
  }
}

async function readSseRecords(
  response: Response,
  predicate: (records: SseRecord[], ended: boolean) => boolean,
  timeoutMs = 1_000,
) {
  if (!response.body) throw new Error('Expected an SSE response body.')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const records: SseRecord[] = []
  let buffer = ''
  let ended = false
  const deadline = Date.now() + timeoutMs
  try {
    while (Date.now() < deadline) {
      if (predicate(records, ended)) return { records, ended }
      const read = await Promise.race([
        reader.read(),
        new Promise<ReadableStreamReadResult<Uint8Array>>((resolve) => {
          setTimeout(() => resolve({ done: false, value: new Uint8Array() }), 20)
        }),
      ])
      if (read.done) {
        ended = true
        if (buffer.trim()) {
          const parsed = parseSseBlock(buffer.trim())
          if (parsed) records.push(parsed)
          buffer = ''
        }
        if (predicate(records, ended)) return { records, ended }
        break
      }
      if (!read.value?.length) continue
      buffer += decoder.decode(read.value, { stream: true })
      const blocks = buffer.split(/\r?\n\r?\n/)
      buffer = blocks.pop() ?? ''
      for (const block of blocks) {
        const parsed = parseSseBlock(block)
        if (parsed) records.push(parsed)
      }
    }
  } finally {
    if (!ended) await reader.cancel().catch(() => {})
  }
  throw new Error('Timed out waiting for SSE records. Latest: ' + JSON.stringify(records))
}

async function openJobStream(baseUrl: string, jobId: string, token = 'member-token') {
  return fetch(baseUrl + '/research/jobs/' + jobId + '/stream', {
    headers: jsonHeaders(token),
  })
}

describe('research job API', () => {
  it('rejects invalid job creation payloads before enqueueing', async () => {
    const anthropicCreate = vi.fn<AnthropicCreate>(async () => researchResponse())
    const { baseUrl } = await startResearchServer({ anthropicCreate })
    const valid = researchPayload()
    const invalidPayloads = [
      {},
      { ...valid, thesisSnapshot: { ...valid.thesisSnapshot, skillDepthMap: [] } },
      { ...valid, params: undefined },
      { ...valid, params: { ...valid.params, focusLanes: undefined } },
      { ...valid, params: { ...valid.params, focusLanes: 'security-platform' } },
      { ...valid, params: { ...valid.params, focusLanes: [] } },
      { ...valid, params: { ...valid.params, focusLanes: ['   ', ''] } },
      { ...valid, params: { ...valid.params, companySizeOverride: 'moonbase' } },
      { ...valid, params: { ...valid.params, companySizeOverride: null } },
      { ...valid, params: { ...valid.params, companySizeOverride: 5 } },
      { ...valid, params: { ...valid.params, companySizeOverride: ['growth'] } },
      { ...valid, params: { ...valid.params, salaryAnchorOverride: 42 } },
      { ...valid, params: { ...valid.params, customKeywords: ['WAF'] } },
      { ...valid, params: { ...valid.params, excludeCompanies: 'OldCo' } },
      {
        ...valid,
        params: { ...valid.params, maxResults: { ...valid.params.maxResults, tier1: -1 } },
      },
      {
        ...valid,
        params: { ...valid.params, maxResults: { ...valid.params.maxResults, tier2: 'abc' } },
      },
      { ...valid, identityEvidence: [] },
      { ...valid, identityEvidence: {} },
      { ...valid, identityEvidence: { profiles: [{}] } },
      { ...valid, identityVersion: -1 },
    ]

    for (const payload of invalidPayloads) {
      const response = await fetch(baseUrl + '/research/jobs', {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify(payload),
      })
      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toMatchObject({
        code: 'invalid_research_job_request',
      })
    }
    expect(anthropicCreate).not.toHaveBeenCalled()
  })

  it('hard-fails Phase 2 job creation when Opus is unavailable', async () => {
    const anthropicCreate = vi.fn<AnthropicCreate>(async () => researchResponse())
    const { baseUrl, researchJobStore } = await startResearchServer({
      anthropicCreate,
      opusAvailable: false,
    })

    const response = await createResearchJob(baseUrl)

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining('Deep research requires Opus'),
      code: 'ai_capability_unavailable',
      reason: 'opus_unavailable',
      capability: 'opus',
      feature: 'research.deep-search',
      phase: 'phase_2',
    })
    expect(anthropicCreate).not.toHaveBeenCalled()
    await expect(
      researchJobStore.listJobsForActor({
        tenantId: 'tenant-1',
        userId: 'user-1',
      }),
    ).resolves.toEqual([])
  })

  it('reports rolling research usage, warns near the ceiling, and rejects over budget', async () => {
    const { baseUrl } = await startResearchServer({
      researchBudgetCents: 650,
      researchEstimatedInputTokens: 12_000,
      researchEstimatedOutputTokens: 80_000,
    })

    const initialUsage = await fetch(baseUrl + '/research/usage', {
      headers: jsonHeaders(),
    })
    expect(initialUsage.status).toBe(200)
    await expect(initialUsage.json()).resolves.toMatchObject({
      estimate: {
        model: 'claude-opus-4-8',
        inputTokens: 12000,
        outputTokens: 80000,
        runCostCents: 618,
      },
      budget: {
        enforced: true,
        limitCents: 650,
        remainingCents: 650,
        status: 'warning',
        wouldExceedNextRun: false,
      },
      warning: {
        code: 'research_budget_near_limit',
      },
    })

    const createResponse = await createResearchJob(baseUrl)
    expect(createResponse.status).toBe(202)
    await expect(createResponse.json()).resolves.toMatchObject({
      jobId: expect.any(String),
      status: 'queued',
      warning: { code: 'research_budget_near_limit' },
      usage: { budget: { status: 'warning' } },
    })

    const completedUsage = await waitUntil(
      async () => {
        const response = await fetch(baseUrl + '/research/usage', {
          headers: jsonHeaders(),
        })
        return response.json()
      },
      (usage) => usage.usage.completedJobCount === 1,
    )
    expect(completedUsage).toMatchObject({
      usage: {
        completedJobCount: 1,
        inFlightJobCount: 0,
        tokens: { inputTokens: 11, outputTokens: 22, totalTokens: 33 },
      },
    })

    const otherUsageResponse = await fetch(baseUrl + '/research/usage', {
      headers: jsonHeaders('other-token'),
    })
    await expect(otherUsageResponse.json()).resolves.toMatchObject({
      usage: {
        completedJobCount: 0,
        inFlightJobCount: 0,
        tokens: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        spendCents: 0,
      },
    })

    const { baseUrl: blockedBaseUrl } = await startResearchServer({
      researchBudgetCents: 600,
      researchEstimatedInputTokens: 12_000,
      researchEstimatedOutputTokens: 80_000,
    })
    const overBudget = await createResearchJob(blockedBaseUrl)
    expect(overBudget.status).toBe(402)
    await expect(overBudget.json()).resolves.toMatchObject({
      code: 'research_budget_exceeded',
      reason: 'budget_ceiling',
      usage: {
        budget: {
          status: 'over',
          wouldExceedNextRun: true,
        },
      },
    })

    const { baseUrl: zeroBudgetBaseUrl } = await startResearchServer({
      researchBudgetCents: 0,
      researchEstimatedInputTokens: 12_000,
      researchEstimatedOutputTokens: 80_000,
    })
    const zeroBudget = await createResearchJob(zeroBudgetBaseUrl)
    expect(zeroBudget.status).toBe(402)
    await expect(zeroBudget.json()).resolves.toMatchObject({
      code: 'research_budget_exceeded',
      usage: {
        budget: {
          enforced: true,
          limitCents: 0,
          remainingCents: 0,
        },
      },
    })
  })

  it('serializes per-actor budget checks across concurrent distinct submissions', async () => {
    const anthropicCreate = vi.fn<AnthropicCreate>(() => new Promise(() => {}))
    const { baseUrl } = await startResearchServer({
      anthropicCreate,
      researchBudgetCents: 650,
      researchEstimatedInputTokens: 12_000,
      researchEstimatedOutputTokens: 80_000,
    })
    const firstPayload = researchPayload()
    const secondPayload = {
      ...researchPayload(),
      params: {
        ...researchPayload().params,
        id: 'request-2',
        customKeywords: 'different search parameters',
      },
    }

    const responses = await Promise.all([
      fetch(baseUrl + '/research/jobs', {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify(firstPayload),
      }),
      fetch(baseUrl + '/research/jobs', {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify(secondPayload),
      }),
    ])

    expect(responses.map((response) => response.status).sort()).toEqual([202, 402])
    const bodies = await Promise.all(responses.map((response) => response.json()))
    expect(bodies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ jobId: expect.any(String), usage: expect.any(Object) }),
        expect.objectContaining({ code: 'research_budget_exceeded' }),
      ]),
    )
    await waitUntil(
      async () => anthropicCreate.mock.calls.length,
      (calls) => calls === 1,
    )
  })

  it('keeps older in-flight jobs reserved outside the rolling usage window', async () => {
    const anthropicCreate = vi.fn<AnthropicCreate>(() => new Promise(() => {}))
    const { advance, baseUrl } = await startResearchServer({
      anthropicCreate,
      researchBudgetCents: 650,
      researchUsageWindowMs: 1,
      researchEstimatedInputTokens: 12_000,
      researchEstimatedOutputTokens: 80_000,
    })

    const firstResponse = await createResearchJob(baseUrl)
    expect(firstResponse.status).toBe(202)
    const first = await firstResponse.json()
    await waitUntil(
      async () => anthropicCreate.mock.calls.length,
      (calls) => calls === 1,
    )

    advance(1000)

    const duplicatePayload = researchPayload()
    duplicatePayload.params = {
      ...duplicatePayload.params,
      [retiredFocusVectorRequestKey]: ['backend-platform'],
      unknownLegacyField: 'drop-me',
    } as typeof duplicatePayload.params & Record<string, unknown>
    const duplicateResponse = await fetch(baseUrl + '/research/jobs', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify(duplicatePayload),
    })
    expect(duplicateResponse.status).toBe(200)
    await expect(duplicateResponse.json()).resolves.toMatchObject({
      jobId: first.jobId,
      duplicate: true,
    })

    const distinctPayload = {
      ...researchPayload(),
      params: {
        ...researchPayload().params,
        id: 'request-outside-window',
        customKeywords: 'different parameters outside window',
      },
    }
    const blocked = await fetch(baseUrl + '/research/jobs', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify(distinctPayload),
    })
    expect(blocked.status).toBe(402)
    await expect(blocked.json()).resolves.toMatchObject({
      code: 'research_budget_exceeded',
      usage: {
        usage: {
          completedJobCount: 0,
          inFlightJobCount: 1,
          reservedCents: 618,
        },
      },
    })
  })

  it('normalizes oversized identity evidence and ignores blank prompt contracts', async () => {
    const { baseUrl } = await startResearchServer({
      anthropicCreate: vi.fn<AnthropicCreate>(() => new Promise(() => {})),
    })
    const longText = 'x'.repeat(5000)
    const payload = researchPayload()
    payload.promptContract = '   '
    payload.identityEvidence = {
      archetype: 'a'.repeat(1200),
      arc: Array.from({ length: 30 }, (_, index) => 'arc-' + index + '-' + longText),
      profiles: [
        {
          id: '   ',
          tags: Array.from({ length: 25 }, (_, index) => 'tag-' + index + '-' + longText),
          text: longText,
        },
        { id: 'blank-text', tags: ['drop-me'], text: '   ' },
        ...Array.from({ length: 29 }, (_, index) => ({
          id: 'profile-extra-' + index,
          tags: ['security'],
          text: 'profile text ' + index,
        })),
      ],
      paioHighlights: Array.from({ length: 55 }, (_, index) => 'paio-' + index + '-' + longText),
      calibrations: Array.from(
        { length: 55 },
        (_, index) => 'calibration-' + index + '-' + longText,
      ),
    }

    const createResponse = await fetch(baseUrl + '/research/jobs', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify(payload),
    })
    expect(createResponse.status).toBe(202)
    const created = await createResponse.json()
    const { body } = await fetchJob(baseUrl, created.jobId)

    expect(body.job).not.toHaveProperty('promptContract')
    expect(body.job.identityEvidence.archetype).toHaveLength(1000)
    expect(body.job.identityEvidence.arc).toHaveLength(24)
    expect(body.job.identityEvidence.arc[0]).toHaveLength(500)
    expect(body.job.identityEvidence.profiles).toHaveLength(24)
    expect(body.job.identityEvidence.profiles[0]).toMatchObject({
      id: 'profile-1',
      text: expect.stringMatching(/^x+$/),
    })
    expect(body.job.identityEvidence.profiles[0].text).toHaveLength(4000)
    expect(body.job.identityEvidence.profiles[0].tags).toHaveLength(20)
    expect(
      body.job.identityEvidence.profiles.some(
        (profile: { id: string }) => profile.id === 'blank-text',
      ),
    ).toBe(false)
    expect(body.job.identityEvidence.paioHighlights).toHaveLength(48)
    expect(body.job.identityEvidence.paioHighlights[0]).toHaveLength(1000)
    expect(body.job.identityEvidence.calibrations).toHaveLength(48)
    expect(body.job.identityEvidence.calibrations[0]).toHaveLength(1000)
  })

  it('normalizes research request params to lanes-only canonical fields', async () => {
    const { baseUrl } = await startResearchServer({
      anthropicCreate: vi.fn<AnthropicCreate>(() => new Promise(() => {})),
    })
    const payload = researchPayload()
    const paramsWithLegacyFields = {
      ...payload.params,
      [retiredFocusVectorRequestKey]: ['backend-platform'],
      unknownLegacyField: 'drop-me',
    } as typeof payload.params & Record<string, unknown>
    payload.params = paramsWithLegacyFields

    const createResponse = await fetch(baseUrl + '/research/jobs', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify(payload),
    })
    expect(createResponse.status).toBe(202)
    const created = await createResponse.json()
    const { body } = await fetchJob(baseUrl, created.jobId)

    expect(body.job.params).toMatchObject({
      id: 'request-1',
      createdAt: '2026-03-15T11:10:00.000Z',
      focusLanes: ['security-platform'],
      geoExpand: true,
      maxResults: { tier1: 1, tier2: 1, tier3: 0 },
    })
    expect(body.job.params).not.toHaveProperty(retiredFocusVectorRequestKey)
    expect(body.job.params).not.toHaveProperty('unknownLegacyField')
  })

  it('hydrates draft-shaped request params with server request metadata', async () => {
    const { baseUrl } = await startResearchServer({
      anthropicCreate: vi.fn<AnthropicCreate>(() => new Promise(() => {})),
    })
    const payload = researchPayload()
    const params = { ...payload.params } as Record<string, unknown>
    delete params.id
    delete params.createdAt
    delete params.excludeCompanies
    delete params.companySizeOverride
    delete params.geoExpand
    delete params.maxResults
    payload.params = params as unknown as typeof payload.params

    const createResponse = await fetch(baseUrl + '/research/jobs', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify(payload),
    })
    expect(createResponse.status).toBe(202)
    const created = await createResponse.json()
    const { body } = await fetchJob(baseUrl, created.jobId)

    expect(body.job.params.id).toMatch(/^sreq-/)
    expect(Date.parse(body.job.params.createdAt)).not.toBeNaN()
    expect(body.job.params.excludeCompanies).toEqual([])
    expect(body.job.params.companySizeOverride).toBe('')
    expect(body.job.params.geoExpand).toBe(true)
    expect(body.job.params.maxResults).toEqual({ tier1: 5, tier2: 10, tier3: 10 })
  })

  it('bounds research request params and defaults invalid tier counts', async () => {
    const { baseUrl } = await startResearchServer({
      anthropicCreate: vi.fn<AnthropicCreate>(() => new Promise(() => {})),
    })
    const longText = 'x'.repeat(200)
    const payload = researchPayload()
    payload.params = {
      ...payload.params,
      focusLanes: Array.from({ length: 30 }, (_, index) => 'lane-' + index + '-' + longText),
      companySizeOverride: '  growth  ',
      salaryAnchorOverride: 's'.repeat(200),
      customKeywords: 'k'.repeat(1_200),
      excludeCompanies: Array.from(
        { length: 150 },
        (_, index) => 'company-' + index + '-' + longText,
      ),
      maxResults: { tier1: 4, tier3: 2.7 },
    } as unknown as typeof payload.params & Record<string, unknown>

    const createResponse = await fetch(baseUrl + '/research/jobs', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify(payload),
    })
    expect(createResponse.status).toBe(202)
    const created = await createResponse.json()
    const { body } = await fetchJob(baseUrl, created.jobId)

    expect(body.job.params.focusLanes).toHaveLength(20)
    expect(body.job.params.focusLanes[0]).toHaveLength(120)
    expect(body.job.params.companySizeOverride).toBe('growth')
    expect(body.job.params.salaryAnchorOverride).toHaveLength(120)
    expect(body.job.params.customKeywords).toHaveLength(1_000)
    expect(body.job.params.excludeCompanies).toHaveLength(100)
    expect(body.job.params.excludeCompanies[0]).toHaveLength(160)
    expect(body.job.params.maxResults).toEqual({ tier1: 4, tier2: 10, tier3: 3 })
  })

  it('rate limits hosted job creation on the deep-research feature bucket', async () => {
    const { createFacetServer } = await loadProxyModules()
    const { server } = createFacetServer({
      authMode: 'hosted',
      allowedOrigins: ['http://localhost:5173'],
      proxyApiKey: 'proxy-key',
      persistenceActorResolver: async () => ({
        accountId: 'account-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
      }),
      hostedRateLimits: {
        aiFeatures: {
          'research.deep-search': { max: 1, windowMs: 60_000 },
        },
      },
      anthropicClient: {
        messages: {
          create: async () => researchResponse(),
        },
      },
      logger: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
      },
    })
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve())
    })
    servers.add(server)
    const address = server.address()
    if (!address || typeof address === 'string') {
      throw new Error('Failed to bind hosted research job test server.')
    }
    const baseUrl = 'http://127.0.0.1:' + address.port

    const firstResponse = await createResearchJob(baseUrl, 'hosted-token')
    expect(firstResponse.status).toBe(202)

    const secondPayload = researchPayload()
    secondPayload.params.id = 'request-2'
    const secondResponse = await fetch(baseUrl + '/research/jobs', {
      method: 'POST',
      headers: jsonHeaders('hosted-token'),
      body: JSON.stringify(secondPayload),
    })
    expect(secondResponse.status).toBe(429)
    await expect(secondResponse.json()).resolves.toMatchObject({
      code: 'rate_limited',
    })
  })

  it('creates, retries, completes, and exposes async research jobs', async () => {
    const anthropicCreate = vi
      .fn<AnthropicCreate>()
      .mockRejectedValueOnce(Object.assign(new Error('temporarily overloaded'), { status: 529 }))
      .mockResolvedValueOnce(researchResponse('Only one sentence.'))
    const { baseUrl, operationsMonitor } = await startResearchServer({ anthropicCreate })

    const createResponse = await createResearchJob(baseUrl)
    expect(createResponse.status).toBe(202)
    const created = await createResponse.json()
    expect(created).toMatchObject({
      jobId: expect.any(String),
      status: 'queued',
      usage: {
        budget: { status: 'unlimited' },
      },
    })

    const completed = await waitUntil(
      async () => (await fetchJob(baseUrl, created.jobId)).body.job,
      (job) => job.status === 'completed',
    )

    expect(anthropicCreate).toHaveBeenCalledTimes(2)
    const [anthropicParams, requestOptions] = anthropicCreate.mock.calls[1]
    expect(anthropicParams).toMatchObject({
      model: 'claude-opus-4-8',
      max_tokens: 128000,
      thinking: { type: 'adaptive' },
      output_config: {
        effort: 'high',
        task_budget: { type: 'tokens', total: 80000 },
      },
      tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 20 }],
    })
    const anthropicMessageContent = String(
      (anthropicParams as { messages: Array<{ content: unknown }> }).messages[0]?.content,
    )
    expect(anthropicMessageContent).toContain('Client output contract')
    expect(anthropicMessageContent).toContain('candidateEdge must be 2-4 sentences')
    expect(anthropicMessageContent).toContain('assumptions[]')
    expect(anthropicMessageContent).toContain('Carry forward thesisSnapshot.assumptions[]')
    expect(anthropicMessageContent).toContain('Identity evidence')
    expect(anthropicMessageContent).not.toContain('tokenUsage')
    expect(requestOptions).toMatchObject({
      headers: { 'anthropic-beta': 'task-budgets-2026-03-13' },
    })
    expect(completed).toMatchObject({
      id: created.jobId,
      userId: 'user-1',
      tenantId: 'tenant-1',
      thesisId: 'thesis-1',
      status: 'completed',
      paramsHash: expect.any(String),
      progress: {
        phase: 'completed',
        searchQueries: [],
        findingsCount: 1,
      },
      result: {
        tokenUsage: { inputTokens: 11, outputTokens: 22, totalTokens: 33 },
        contractViolations: ['results[0].candidateEdge: expected at least 2 sentences'],
      },
    })
    expect(operationsMonitor.snapshot().counters).toMatchObject({
      'research_job.queued': 1,
      'research_job.running': 1,
      'research_job.retry.upstream_529': 1,
      'research_job.completed': 1,
    })

    const completedFetch = await fetchJob(baseUrl, created.jobId)
    expect(completedFetch.response.headers.get('cache-control')).toBe('no-cache')
  })

  it('writes heartbeat progress while a job is running', async () => {
    let resolveResponse: ((value: unknown) => void) | null = null
    const anthropicCreate = vi.fn<AnthropicCreate>(
      () =>
        new Promise((resolve) => {
          resolveResponse = resolve
        }),
    )
    const { advance, baseUrl } = await startResearchServer({
      anthropicCreate,
      progressIntervalMs: 5,
    })

    const createResponse = await createResearchJob(baseUrl)
    const created = await createResponse.json()
    await waitUntil(
      async () => anthropicCreate.mock.calls.length,
      (calls) => calls > 0,
    )
    advance(25)

    const runningFetch = await waitUntil(
      async () => fetchJob(baseUrl, created.jobId),
      ({ body }) =>
        body.job.progress?.phase === 'running deep research' &&
        Date.parse(body.job.heartbeatAt) > Date.parse(body.job.startedAt),
    )
    expect(runningFetch.response.headers.get('cache-control')).toBe('no-store')
    expect(Date.parse(runningFetch.body.job.heartbeatAt)).toBeGreaterThan(
      Date.parse(runningFetch.body.job.startedAt),
    )

    expect(resolveResponse).toBeTruthy()
    const finishResearch = resolveResponse as unknown as (value: unknown) => void
    finishResearch(researchResponse())
    await waitUntil(
      async () => (await fetchJob(baseUrl, created.jobId)).body.job,
      (job) => job.status === 'completed',
    )
  })

  it('streams running job events to multiple subscribers in order', async () => {
    let resolveResponse: ((value: unknown) => void) | null = null
    const anthropicCreate = vi.fn<AnthropicCreate>(
      () =>
        new Promise((resolve) => {
          resolveResponse = resolve
        }),
    )
    const { baseUrl } = await startResearchServer({ anthropicCreate })

    const createResponse = await createResearchJob(baseUrl)
    const created = await createResponse.json()
    await waitUntil(
      async () => anthropicCreate.mock.calls.length,
      (calls) => calls > 0,
    )

    const firstStream = await openJobStream(baseUrl, created.jobId)
    const secondStream = await openJobStream(baseUrl, created.jobId)
    expect(firstStream.status).toBe(200)
    expect(secondStream.status).toBe(200)
    expect(firstStream.headers.get('content-type')).toContain('text/event-stream')
    expect(firstStream.headers.get('access-control-allow-origin')).toBe('http://localhost:5173')

    expect(resolveResponse).toBeTruthy()
    const finishResearch = resolveResponse as unknown as (value: unknown) => void
    finishResearch(streamingResearchResponse())

    const untilComplete = (records: SseRecord[], ended: boolean) =>
      ended && records.some((record) => record.event === 'complete')
    const first = await readSseRecords(firstStream, untilComplete)
    const second = await readSseRecords(secondStream, untilComplete)

    for (const result of [first, second]) {
      const events = result.records.filter((record) => record.event).map((record) => record.event)
      expect(events).toEqual(
        expect.arrayContaining([
          'status',
          'progress',
          'thinking',
          'search_query',
          'finding',
          'complete',
        ]),
      )
      expect(events.indexOf('thinking')).toBeGreaterThan(events.indexOf('progress'))
      expect(events.indexOf('search_query')).toBeGreaterThan(events.indexOf('thinking'))
      expect(events.indexOf('complete')).toBeGreaterThan(events.lastIndexOf('finding'))
      expect(result.records).toContainEqual({
        event: 'thinking',
        data: { text: 'Looking at the Platform + Security combination...' },
      })
      expect(result.records).toContainEqual({
        event: 'search_query',
        data: { query: '"platform engineer" security startup' },
      })
      expect(result.records).toContainEqual({
        event: 'complete',
        data: { status: 'completed', jobId: created.jobId },
      })
      expect(result.ended).toBe(true)
    }
  })

  it('auth-scopes research job streams and reports disabled SSE as not implemented', async () => {
    const { baseUrl } = await startResearchServer({
      anthropicCreate: vi.fn<AnthropicCreate>(() => new Promise(() => {})),
    })

    const createResponse = await createResearchJob(baseUrl)
    const created = await createResponse.json()

    const otherStream = await openJobStream(baseUrl, created.jobId, 'other-token')
    expect(otherStream.status).toBe(404)
    await expect(otherStream.json()).resolves.toMatchObject({
      code: 'research_job_not_found',
    })

    const disabled = await startResearchServer({ sseEnabled: false })
    const disabledCreate = await createResearchJob(disabled.baseUrl)
    const disabledJob = await disabledCreate.json()
    const disabledStream = await openJobStream(disabled.baseUrl, disabledJob.jobId)
    expect(disabledStream.status).toBe(501)
    await expect(disabledStream.json()).resolves.toMatchObject({
      code: 'research_job_stream_unavailable',
    })
  })

  it('sends keepalive comments and tolerates client disconnects', async () => {
    const anthropicCreate = vi.fn<AnthropicCreate>(() => new Promise(() => {}))
    const { baseUrl } = await startResearchServer({
      anthropicCreate,
      sseKeepaliveMs: 5,
    })

    const createResponse = await createResearchJob(baseUrl)
    const created = await createResponse.json()
    await waitUntil(
      async () => anthropicCreate.mock.calls.length,
      (calls) => calls > 0,
    )

    const stream = await openJobStream(baseUrl, created.jobId)
    expect(stream.status).toBe(200)
    const keepalive = await readSseRecords(stream, (records) =>
      records.some((record) => record.comment === 'keepalive'),
    )
    expect(keepalive.records).toContainEqual({ comment: 'keepalive' })
  })

  it('streams cancellation as a terminal status event', async () => {
    const anthropicCreate = vi.fn<AnthropicCreate>(() => new Promise(() => {}))
    const { baseUrl } = await startResearchServer({ anthropicCreate })

    const createResponse = await createResearchJob(baseUrl)
    const created = await createResponse.json()
    await waitUntil(
      async () => anthropicCreate.mock.calls.length,
      (calls) => calls > 0,
    )
    const stream = await openJobStream(baseUrl, created.jobId)
    expect(stream.status).toBe(200)

    const cancelResponse = await fetch(baseUrl + '/research/jobs/' + created.jobId + '/cancel', {
      method: 'POST',
      headers: jsonHeaders(),
    })
    expect(cancelResponse.status).toBe(200)

    const canceled = await readSseRecords(
      stream,
      (records, ended) => ended && records.some((record) => record.data?.status === 'canceled'),
    )
    expect(canceled.records).toContainEqual({
      event: 'status',
      data: { status: 'canceled', jobId: created.jobId, phase: 'canceled' },
    })
    expect(canceled.ended).toBe(true)
  })

  it('late subscribers receive complete and close immediately for completed jobs', async () => {
    const { baseUrl } = await startResearchServer()

    const createResponse = await createResearchJob(baseUrl)
    const created = await createResponse.json()
    await waitUntil(
      async () => (await fetchJob(baseUrl, created.jobId)).body.job,
      (job) => job.status === 'completed',
    )

    const stream = await openJobStream(baseUrl, created.jobId)
    expect(stream.status).toBe(200)
    const result = await readSseRecords(
      stream,
      (records, ended) => ended && records.some((record) => record.event === 'complete'),
    )
    expect(result.records).toContainEqual({
      event: 'complete',
      data: { status: 'completed', jobId: created.jobId },
    })
    expect(result.ended).toBe(true)
  })

  it('streams terminal errors and closes failed jobs', async () => {
    const anthropicCreate = vi.fn<AnthropicCreate>(
      () =>
        new Promise((_resolve, reject) => {
          setTimeout(() => reject(Object.assign(new Error('bad request'), { status: 400 })), 10)
        }),
    )
    const { baseUrl } = await startResearchServer({ anthropicCreate })

    const createResponse = await createResearchJob(baseUrl)
    const created = await createResponse.json()
    const stream = await openJobStream(baseUrl, created.jobId)
    expect(stream.status).toBe(200)

    const result = await readSseRecords(
      stream,
      (records, ended) => ended && records.some((record) => record.event === 'error'),
    )
    expect(result.records).toContainEqual({
      event: 'error',
      data: {
        status: 'failed',
        jobId: created.jobId,
        error: {
          code: 'upstream_400',
          message: 'bad request',
          retriable: false,
        },
      },
    })
    expect(result.ended).toBe(true)
  })

  it('aborts active research runners when the server closes', async () => {
    let aborted = false
    const anthropicCreate = vi.fn<AnthropicCreate>(
      (_params, options) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener('abort', () => {
            aborted = true
            const error = new Error('aborted')
            error.name = 'AbortError'
            reject(error)
          })
        }),
    )
    const { baseUrl, server } = await startResearchServer({ anthropicCreate })

    const createResponse = await createResearchJob(baseUrl)
    expect(createResponse.status).toBe(202)
    await waitUntil(
      async () => anthropicCreate.mock.calls.length,
      (calls) => calls > 0,
    )

    await new Promise<void>((resolve, reject) => {
      server.close((error?: Error) => {
        if (error) {
          reject(error)
          return
        }
        resolve()
      })
    })
    servers.delete(server)
    expect(aborted).toBe(true)
  })

  it('parses fenced LLM JSON and flags missing narrative contract fields', async () => {
    const anthropicCreate = vi.fn<AnthropicCreate>(async () => fencedResearchResponse())
    const { baseUrl } = await startResearchServer({ anthropicCreate })

    const createResponse = await createResearchJob(baseUrl)
    const created = await createResponse.json()
    const completed = await waitUntil(
      async () => (await fetchJob(baseUrl, created.jobId)).body.job,
      (job) => job.status === 'completed',
    )

    expect(completed.result.contractViolations).toContain(
      'narrative.marketContext: missing or empty',
    )
  })

  it('parses un-fenced LLM JSON with conversational prefix and suffix text', async () => {
    const anthropicCreate = vi.fn<AnthropicCreate>(async () => prefixedRawJsonResearchResponse())
    const { baseUrl } = await startResearchServer({ anthropicCreate })

    const createResponse = await createResearchJob(baseUrl)
    const created = await createResponse.json()
    const completed = await waitUntil(
      async () => (await fetchJob(baseUrl, created.jobId)).body.job,
      (job) => job.status === 'completed',
    )

    expect(completed.result.results[0]).toMatchObject({
      company: 'Edge Co',
      title: 'Security Platform Engineer',
    })
  })

  it('fails immediately on non-retriable upstream errors', async () => {
    const anthropicCreate = vi
      .fn<AnthropicCreate>()
      .mockRejectedValue(Object.assign(new Error('bad request'), { status: 400 }))
    const { baseUrl } = await startResearchServer({ anthropicCreate })

    const createResponse = await createResearchJob(baseUrl)
    const created = await createResponse.json()
    const failed = await waitUntil(
      async () => (await fetchJob(baseUrl, created.jobId)).body.job,
      (job) => job.status === 'failed',
    )

    expect(anthropicCreate).toHaveBeenCalledTimes(1)
    expect(failed.error).toMatchObject({
      code: 'upstream_400',
      message: 'bad request',
      retriable: false,
    })
  })

  it('fails jobs when the LLM omits the required narrative object', async () => {
    const anthropicCreate = vi.fn<AnthropicCreate>(async () => ({
      content: [{ type: 'text', text: JSON.stringify({ results: [] }) }],
      usage: { input_tokens: 1, output_tokens: 1 },
    }))
    const { baseUrl } = await startResearchServer({ anthropicCreate })

    const createResponse = await createResearchJob(baseUrl)
    const created = await createResponse.json()
    const failed = await waitUntil(
      async () => (await fetchJob(baseUrl, created.jobId)).body.job,
      (job) => job.status === 'failed',
    )

    expect(failed.error).toMatchObject({
      code: 'invalid_research_result',
      message: 'Research result did not include a narrative object.',
      retriable: false,
    })
  })

  it('returns duplicate in-flight jobs and isolates reads by actor', async () => {
    let abortCount = 0
    const anthropicCreate = vi.fn<AnthropicCreate>(
      (_params, options) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener('abort', () => {
            abortCount += 1
            const error = new Error('aborted')
            error.name = 'AbortError'
            reject(error)
          })
        }),
    )
    const { baseUrl } = await startResearchServer({ anthropicCreate })

    const firstResponse = await createResearchJob(baseUrl)
    expect(firstResponse.status).toBe(202)
    const first = await firstResponse.json()

    const duplicateResponse = await createResearchJob(baseUrl)
    expect(duplicateResponse.status).toBe(200)
    await expect(duplicateResponse.json()).resolves.toEqual({
      jobId: first.jobId,
      status: expect.stringMatching(/queued|running/),
      duplicate: true,
    })

    const otherRead = await fetchJob(baseUrl, first.jobId, 'other-token')
    expect(otherRead.response.status).toBe(404)

    await waitUntil(
      async () => anthropicCreate.mock.calls.length,
      (calls) => calls > 0,
    )
    const otherCancel = await fetch(baseUrl + '/research/jobs/' + first.jobId + '/cancel', {
      method: 'POST',
      headers: jsonHeaders('other-token'),
    })
    expect(otherCancel.status).toBe(404)
    expect(abortCount).toBe(0)

    const otherList = await fetch(baseUrl + '/research/jobs?limit=5&offset=0', {
      headers: jsonHeaders('other-token'),
    })
    await expect(otherList.json()).resolves.toEqual({
      jobs: [],
      pagination: { limit: 5, offset: 0, nextOffset: null },
    })

    const ownerList = await fetch(baseUrl + '/research/jobs?limit=1&offset=0', {
      headers: jsonHeaders(),
    })
    expect(ownerList.headers.get('cache-control')).toBe('no-store')
    const ownerBody = await ownerList.json()
    expect(ownerBody.jobs).toHaveLength(1)
    expect(ownerBody.jobs[0]).toMatchObject({ id: first.jobId, thesisId: 'thesis-1' })
    expect(ownerBody.pagination).toEqual({ limit: 1, offset: 0, nextOffset: 1 })

    const clampedList = await fetch(baseUrl + '/research/jobs?limit=5000&offset=-10', {
      headers: jsonHeaders(),
    })
    await expect(clampedList.json()).resolves.toMatchObject({
      pagination: { limit: 100, offset: 0 },
    })

    const defaultedList = await fetch(baseUrl + '/research/jobs?limit=abc', {
      headers: jsonHeaders(),
    })
    await expect(defaultedList.json()).resolves.toMatchObject({
      pagination: { limit: 20, offset: 0 },
    })
  })

  it('cancels a running job and aborts the upstream request', async () => {
    let aborted = false
    const anthropicCreate = vi.fn<AnthropicCreate>(
      (_params, options) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener('abort', () => {
            aborted = true
            const error = new Error('aborted')
            error.name = 'AbortError'
            reject(error)
          })
        }),
    )
    const { baseUrl } = await startResearchServer({ anthropicCreate })

    const createResponse = await createResearchJob(baseUrl)
    const created = await createResponse.json()
    await waitUntil(
      async () => anthropicCreate.mock.calls.length,
      (calls) => calls > 0,
    )

    const cancelResponse = await fetch(baseUrl + '/research/jobs/' + created.jobId + '/cancel', {
      method: 'POST',
      headers: jsonHeaders(),
    })
    expect(cancelResponse.status).toBe(200)
    const canceled = await cancelResponse.json()
    expect(canceled.job).toMatchObject({
      id: created.jobId,
      status: 'canceled',
      thesisSnapshot: expect.objectContaining({
        competitiveMoat: 'Deep WAF and platform ownership.',
      }),
      progress: { phase: 'canceled' },
    })
    expect(aborted).toBe(true)

    const fetched = await fetchJob(baseUrl, created.jobId)
    expect(fetched.body.job.status).toBe('canceled')
  })

  it('uses the local development actor when no bearer token is present', async () => {
    const { baseUrl } = await startResearchServer()

    const createResponse = await fetch(baseUrl + '/research/jobs', {
      method: 'POST',
      headers: localJsonHeaders(),
      body: JSON.stringify(researchPayload()),
    })
    expect(createResponse.status).toBe(202)
    const created = await createResponse.json()
    const completed = await waitUntil(
      async () => {
        const response = await fetch(baseUrl + '/research/jobs/' + created.jobId, {
          headers: localJsonHeaders(),
        })
        return (await response.json()).job
      },
      (job) => job.status === 'completed',
    )

    expect(completed).toMatchObject({
      userId: 'local-user',
      tenantId: 'local',
      accountId: 'local',
    })
  })
})

describe('research job stores', () => {
  function storedJob(overrides: Record<string, unknown>) {
    return {
      id: 'job-' + String(overrides.id ?? '1'),
      userId: 'user-1',
      tenantId: 'tenant-1',
      accountId: null,
      thesisId: 'thesis-1',
      thesisSnapshot: thesisSnapshot(),
      identityVersion: 7,
      params: researchPayload().params,
      paramsHash: 'hash-' + String(overrides.id ?? '1'),
      status: 'queued',
      createdAt: '2026-03-15T11:00:00.000Z',
      ttlAt: '2026-04-14T11:00:00.000Z',
      ...overrides,
    }
  }

  it('fails stale runners, cleans terminal jobs by TTL, and persists file-backed records', async () => {
    const { createFileResearchJobStore, createInMemoryResearchJobStore } = await loadProxyModules()
    const nowMs = Date.parse('2026-03-15T12:00:00.000Z')
    const staleIso = new Date(nowMs - 10_000).toISOString()
    const store = createInMemoryResearchJobStore([
      storedJob({
        id: 'expired',
        status: 'completed',
        completedAt: staleIso,
        ttlAt: new Date(nowMs - 1).toISOString(),
      }),
      storedJob({
        id: 'stale',
        status: 'running',
        startedAt: staleIso,
        heartbeatAt: staleIso,
      }),
      storedJob({
        id: 'stale-queued',
        status: 'queued',
        createdAt: staleIso,
      }),
    ])
    const isolatedStore = createInMemoryResearchJobStore([
      storedJob({ id: 'account-bound', accountId: 'account-1' }),
    ])
    await expect(
      isolatedStore.getJobForActor(
        'account-bound',
        { tenantId: 'tenant-1', userId: 'user-1' },
        nowMs,
      ),
    ).resolves.toBeNull()

    const failed = await store.failOrphanedJobs(nowMs, 1_000, 30_000)
    expect(failed.map((job: { id: string }) => job.id).sort()).toEqual(['stale', 'stale-queued'])
    expect(failed).toContainEqual(
      expect.objectContaining({
        id: 'stale',
        status: 'failed',
        error: expect.objectContaining({ code: 'runner_heartbeat_timeout', retriable: true }),
      }),
    )
    expect(failed).toContainEqual(
      expect.objectContaining({
        id: 'stale-queued',
        status: 'failed',
        error: expect.objectContaining({ code: 'runner_heartbeat_timeout', retriable: true }),
      }),
    )

    await store.cleanup(nowMs)
    const remainingJobs = await store.allJobs()
    expect(remainingJobs.map((job: { id: string }) => job.id).sort()).toEqual([
      'stale',
      'stale-queued',
    ])
    expect(remainingJobs).toContainEqual(expect.objectContaining({ id: 'stale', status: 'failed' }))
    expect(remainingJobs).toContainEqual(
      expect.objectContaining({ id: 'stale-queued', status: 'failed' }),
    )

    const tempDir = await mkdtemp(join(tmpdir(), 'facet-research-jobs-'))
    tempDirs.add(tempDir)
    const filePath = join(tempDir, 'nested', 'jobs.json')
    const fileStore = createFileResearchJobStore(filePath)
    const actor = { tenantId: 'tenant-1', userId: 'user-1' }
    const created = await fileStore.createJob({
      actor,
      thesisId: 'thesis-1',
      thesisSnapshot: thesisSnapshot(),
      identityVersion: 7,
      params: researchPayload().params,
      hash: 'file-hash',
      nowMs,
      ttlMs: 30_000,
    })

    expect(await readFile(filePath, 'utf8')).toContain(created.job.id)
    const reloadedStore = createFileResearchJobStore(filePath)
    await expect(reloadedStore.getJobForActor(created.job.id, actor, nowMs)).resolves.toMatchObject(
      {
        id: created.job.id,
        paramsHash: 'file-hash',
        status: 'queued',
      },
    )

    await reloadedStore.cancelJobForActor(created.job.id, actor, nowMs, 30_000)
    const canceledDiskState = JSON.parse(await readFile(filePath, 'utf8'))
    expect(canceledDiskState.jobs).toContainEqual(
      expect.objectContaining({
        id: created.job.id,
        status: 'canceled',
      }),
    )

    const mutationFilePath = join(tempDir, 'nested', 'mutation-jobs.json')
    await writeFile(
      mutationFilePath,
      JSON.stringify({
        jobs: [
          storedJob({
            id: 'file-stale',
            status: 'running',
            startedAt: staleIso,
            heartbeatAt: staleIso,
          }),
        ],
      }),
    )
    const mutationStore = createFileResearchJobStore(mutationFilePath)
    await mutationStore.failOrphanedJobs(nowMs, 1_000, 30_000)
    const failedDiskState = JSON.parse(await readFile(mutationFilePath, 'utf8'))
    expect(failedDiskState.jobs).toContainEqual(
      expect.objectContaining({
        id: 'file-stale',
        status: 'failed',
      }),
    )
    await mutationStore.cleanup(nowMs + 31_000)
    await expect(readFile(mutationFilePath, 'utf8').then(JSON.parse)).resolves.toEqual({ jobs: [] })

    const concurrentFilePath = join(tempDir, 'nested', 'concurrent-jobs.json')
    const concurrentStore = createFileResearchJobStore(concurrentFilePath)
    await Promise.all([
      concurrentStore.createJob({
        actor,
        thesisId: 'thesis-1',
        thesisSnapshot: thesisSnapshot(),
        identityVersion: 7,
        params: { ...researchPayload().params, id: 'concurrent-1' },
        hash: 'concurrent-hash-1',
        nowMs,
        ttlMs: 30_000,
      }),
      concurrentStore.createJob({
        actor: { tenantId: 'tenant-1', userId: 'user-2' },
        thesisId: 'thesis-2',
        thesisSnapshot: { ...thesisSnapshot(), id: 'thesis-2' },
        identityVersion: 7,
        params: { ...researchPayload().params, id: 'concurrent-2' },
        hash: 'concurrent-hash-2',
        nowMs,
        ttlMs: 30_000,
      }),
    ])
    await expect(concurrentStore.allJobs()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ paramsHash: 'concurrent-hash-1' }),
        expect.objectContaining({ paramsHash: 'concurrent-hash-2' }),
      ]),
    )

    const corruptPath = join(tempDir, 'nested', 'corrupt-jobs.json')
    await writeFile(corruptPath, '{')
    const corruptStore = createFileResearchJobStore(corruptPath)
    await expect(corruptStore.allJobs()).rejects.toThrow(SyntaxError)

    await writeFile(corruptPath, JSON.stringify({ jobs: [] }))
    await expect(
      corruptStore.createJob({
        actor,
        thesisId: 'thesis-1',
        thesisSnapshot: thesisSnapshot(),
        identityVersion: 7,
        params: researchPayload().params,
        hash: 'recovered-hash',
        nowMs,
        ttlMs: 30_000,
      }),
    ).resolves.toMatchObject({
      job: expect.objectContaining({ paramsHash: 'recovered-hash' }),
      duplicate: false,
    })
  })
})
