import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProfessionalIdentityV3 } from '../identity/schema'
import type { ResearchJob, SearchProfile, SearchRequest, SearchThesis } from '../types/search'
import { facetClientEnv } from '../utils/facetEnv'
import { getHostedAccessToken } from '../utils/hostedSession'
import {
  buildDeepResearchIdentityEvidence,
  buildDeepResearchThesisSnapshot,
  cancelDeepResearchJob,
  createDeepResearchJob,
  fetchDeepResearchJob,
  getResearchJobPollDelay,
  hydrateSearchRunFromResearchJob,
  researchJobHeaders,
  resolveResearchJobsUrl,
  streamDeepResearchJob,
} from '../utils/deepSearchClient'
import { cloneIdentityFixture } from './fixtures/identityFixture'

vi.mock('../utils/hostedSession', () => ({
  getHostedAccessToken: vi.fn(),
}))

const baseProfile: SearchProfile = {
  id: 'sprof-1',
  inferredAt: '2026-03-10T10:00:00.000Z',
  inferredFromResumeVersion: 1,
  source: { kind: 'identity', label: 'Test Candidate' },
  skills: [
    {
      id: 'skill-1',
      name: 'WAF',
      category: 'security',
      depth: 'strong',
      context: 'Built production WAF controls.',
      positioning: 'Use as a security-platform differentiator.',
    },
  ],
  vectors: [
    {
      vectorId: 'security-platform',
      priority: 1,
      description: 'Security platform builders',
      targetRoleTitles: ['Staff Security Platform Engineer'],
      searchKeywords: ['WAF', 'edge security'],
    },
  ],
  workSummary: [{ title: 'Platform', summary: 'Owned platform systems.' }],
  openQuestions: ['Which companies allow AI tools?'],
  constraints: { compensation: '$250k', locations: ['Remote'], clearance: '', companySize: '' },
  filters: { prioritize: ['builder-friendly interviews'], avoid: ['Leetcode-heavy loops'] },
  interviewPrefs: { strongFit: ['work sample'], redFlags: ['trivia screening'] },
}

const baseRequest: SearchRequest = {
  id: 'sreq-1',
  createdAt: '2026-03-10T10:05:00.000Z',
  focusVectors: ['security-platform'],
  companySizeOverride: '',
  salaryAnchorOverride: '',
  geoExpand: true,
  customKeywords: 'remote',
  excludeCompanies: ['OldCo'],
  maxResults: { tier1: 2, tier2: 3, tier3: 4 },
}

const buildJob = (overrides: Partial<ResearchJob> = {}, thesisSnapshot?: SearchThesis): ResearchJob => {
  const thesis = thesisSnapshot ?? buildDeepResearchThesisSnapshot({
    profile: baseProfile,
    request: baseRequest,
    identity: null,
    createdAt: '2026-03-10T10:06:00.000Z',
  })

  return {
    id: 'job-1',
    userId: 'user-1',
    thesisId: thesis.id,
    thesisSnapshot: thesis,
    identityVersion: thesis.identityVersion,
    params: baseRequest,
    paramsHash: 'hash',
    status: 'running',
    createdAt: '2026-03-10T10:06:00.000Z',
    ttlAt: '2026-04-10T10:06:00.000Z',
    progress: { phase: 'running', elapsedMs: 120000, searchQueries: ['waf remote'] },
    ...overrides,
  }
}

describe('deepSearchClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    vi.mocked(getHostedAccessToken).mockReset()
    vi.mocked(getHostedAccessToken).mockResolvedValue(null)
    facetClientEnv.anthropicProxyApiKey = ''
  })

  it('resolves research job URLs at the proxy origin', () => {
    expect(resolveResearchJobsUrl('https://ai.example/proxy')).toBe('https://ai.example/proxy/research/jobs')
    expect(resolveResearchJobsUrl('http://127.0.0.1:9001', '/job-1')).toBe(
      'http://127.0.0.1:9001/research/jobs/job-1',
    )
  })

  it('caps polling delay at 30 seconds', () => {
    expect([0, 1, 2, 3, 4, 99].map(getResearchJobPollDelay)).toEqual([
      2000,
      5000,
      15000,
      30000,
      30000,
      30000,
    ])
  })

  it('builds a thesis snapshot with identity version and skill evidence', () => {
    const identity = cloneIdentityFixture()
    identity.model_revision = 7
    const thesis = buildDeepResearchThesisSnapshot({
      profile: baseProfile,
      request: baseRequest,
      identity,
      createdAt: '2026-03-10T10:06:00.000Z',
    })

    expect(thesis.identityVersion).toBe(7)
    expect(thesis.competitiveMoat).toBe(identity.identity.thesis)
    expect(thesis.narrative).toContain('deep research runner')
    expect(thesis.skillDepthMap[0]).toMatchObject({
      skill: 'WAF',
      depth: 'strong',
      context: 'Built production WAF controls.',
    })
    expect(thesis.keywordCombinations[0]?.query).toContain('remote')
  })

  it('extracts raw identity evidence for the async runner prompt', () => {
    const identity = cloneIdentityFixture() as ProfessionalIdentityV3
    identity.skills.groups[0]!.calibration = 'Strong in WAF internals, not generic SOC work.'
    const evidence = buildDeepResearchIdentityEvidence(identity, baseProfile)

    expect(evidence.archetype).toBe(identity.identity.thesis)
    expect(evidence.paioHighlights.length).toBeGreaterThan(0)
    expect(evidence.profiles[0]?.text).toBe(identity.profiles[0]?.text)
    expect(evidence.calibrations.some((item) => item.includes('WAF internals'))).toBe(true)
  })

  it('extracts profile-only evidence when no identity is available', () => {
    const evidence = buildDeepResearchIdentityEvidence(null, baseProfile)

    expect(evidence.archetype).toBe('Test Candidate')
    expect(evidence.arc).toEqual(['Platform: Owned platform systems.'])
    expect(evidence.profiles).toEqual([
      {
        id: 'work-summary-1',
        tags: ['Platform'],
        text: 'Owned platform systems.',
      },
    ])
    expect(evidence.paioHighlights).toEqual([
      'WAF: Built production WAF controls.',
      'Open question: Which companies allow AI tools?',
    ])
    expect(evidence.calibrations).toEqual([
      'Prioritize: builder-friendly interviews',
      'Avoid: Leetcode-heavy loops',
      'Strong interview fit: work sample',
      'Interview red flag: trivia screening',
    ])
  })

  it('builds safe thesis fallbacks for sparse profiles', () => {
    const sparseProfile: SearchProfile = {
      ...baseProfile,
      skills: [],
      vectors: [],
      workSummary: [],
      filters: { prioritize: [], avoid: [] },
      interviewPrefs: { strongFit: [], redFlags: [] },
    }

    const thesis = buildDeepResearchThesisSnapshot({
      profile: sparseProfile,
      request: { ...baseRequest, focusVectors: [], customKeywords: '' },
      identity: null,
    })

    expect(thesis.searchLanes).toEqual([
      {
        id: 'general-fit',
        title: 'General fit',
        rationale: 'Search for roles that match the candidate profile and constraints.',
        targetSignals: [],
      },
    ])
    expect(thesis.skillDepthMap).toEqual([
      {
        skill: 'Candidate profile',
        depth: 'working',
        context: 'Search profile evidence is available but sparse.',
        searchSignal: 'Use the candidate profile as the primary fit signal.',
      },
    ])
    expect(thesis.competitiveMoat).toContain('Candidate combines validated experience')
  })

  it('falls back to available vectors when requested focus vectors are stale', () => {
    const thesis = buildDeepResearchThesisSnapshot({
      profile: baseProfile,
      request: { ...baseRequest, focusVectors: ['deleted-vector'] },
      identity: null,
    })

    expect(thesis.searchLanes).toEqual([
      expect.objectContaining({
        id: 'security-platform',
        title: 'Staff Security Platform Engineer',
      }),
    ])
    expect(thesis.competitiveMoat).toBe('Owned platform systems.')
  })

  it('resolves research job auth headers without sending the default key with bearer auth', async () => {
    vi.mocked(getHostedAccessToken).mockResolvedValueOnce('hosted-token')
    await expect(researchJobHeaders()).resolves.toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer hosted-token',
    })

    facetClientEnv.anthropicProxyApiKey = 'configured-key'
    vi.mocked(getHostedAccessToken).mockResolvedValueOnce('hosted-token')
    await expect(researchJobHeaders()).resolves.toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer hosted-token',
      'X-Proxy-API-Key': 'configured-key',
    })

    vi.mocked(getHostedAccessToken).mockResolvedValueOnce(null)
    await expect(researchJobHeaders()).resolves.toEqual({
      'Content-Type': 'application/json',
      'X-Proxy-API-Key': 'configured-key',
    })

    facetClientEnv.anthropicProxyApiKey = ''
    vi.mocked(getHostedAccessToken).mockResolvedValueOnce(null)
    await expect(researchJobHeaders()).resolves.toEqual({
      'Content-Type': 'application/json',
      'X-Proxy-API-Key': 'facet-local-proxy',
    })
  })

  it('posts thesis, identity evidence, and prompt contract to the async job endpoint', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ jobId: 'job-1', status: 'queued' }),
    } as Response)
    const identity = cloneIdentityFixture()
    const thesisSnapshot = buildDeepResearchThesisSnapshot({
      profile: baseProfile,
      request: baseRequest,
      identity,
    })
    const identityEvidence = buildDeepResearchIdentityEvidence(identity, baseProfile)

    await createDeepResearchJob({
      endpoint: 'https://ai.example/proxy',
      thesisSnapshot,
      params: baseRequest,
      identityEvidence,
    })

    expect(fetch).toHaveBeenCalledWith(
      'https://ai.example/proxy/research/jobs',
      expect.objectContaining({ method: 'POST' }),
    )
    const [, init] = vi.mocked(fetch).mock.calls[0] ?? []
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.thesisSnapshot).toMatchObject({ id: thesisSnapshot.id })
    expect(body.identityEvidence.archetype).toBe(identity.identity.thesis)
    expect(body.promptContract).toContain('candidateEdge as 2-4 sentences')
  })

  it('fetches and cancels deep research jobs with authenticated lifecycle requests', async () => {
    const runningJob = buildJob({ status: 'running' })
    const canceledJob = buildJob({ status: 'canceled' })
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ job: runningJob }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ job: canceledJob }), { status: 200 }))

    await expect(fetchDeepResearchJob('https://ai.example/proxy', 'job-1')).resolves.toMatchObject({
      id: 'job-1',
      status: 'running',
    })
    await expect(cancelDeepResearchJob('https://ai.example/proxy', 'job-1')).resolves.toMatchObject({
      id: 'job-1',
      status: 'canceled',
    })

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      'https://ai.example/proxy/research/jobs/job-1',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ 'X-Proxy-API-Key': 'facet-local-proxy' }),
      }),
    )
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'https://ai.example/proxy/research/jobs/job-1/cancel',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'X-Proxy-API-Key': 'facet-local-proxy' }),
      }),
    )
  })

  it('throws parsed proxy errors from job lifecycle clients', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'job create denied' }), { status: 403 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'job fetch denied' }), { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'job cancel denied' }), { status: 409 }))
    const thesisSnapshot = buildDeepResearchThesisSnapshot({
      profile: baseProfile,
      request: baseRequest,
      identity: null,
    })

    await expect(createDeepResearchJob({
      endpoint: 'https://ai.example/proxy',
      thesisSnapshot,
      params: baseRequest,
    })).rejects.toThrow('job create denied')
    await expect(fetchDeepResearchJob('https://ai.example/proxy', 'missing-job')).rejects.toThrow(
      'job fetch denied',
    )
    await expect(cancelDeepResearchJob('https://ai.example/proxy', 'missing-job')).rejects.toThrow(
      'job cancel denied',
    )
  })

  it('streams SSE events with authenticated fetch headers and reports clean close', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('event: thinking\ndata:  indented source\n\nevent: ping\ndata: ignore me\n\nevent: complete\ndata: job-1\n\n', {
        status: 200,
      }),
    )
    const events: string[] = []
    let closed = false

    streamDeepResearchJob('https://ai.example/proxy', 'job-1', {
      onEvent: (event) => events.push(event.type + ':' + event.data),
      onClose: () => {
        closed = true
      },
    })

    await new Promise((resolve) => setTimeout(resolve, 0))
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(events).toEqual(['thinking: indented source', 'complete:job-1'])
    expect(closed).toBe(true)
    const [, init] = vi.mocked(fetch).mock.calls[0] ?? []
    expect((init as RequestInit).headers).toEqual(
      expect.objectContaining({
        Accept: 'text/event-stream',
        'X-Proxy-API-Key': 'facet-local-proxy',
      }),
    )
  })

  it('reports parsed stream errors through the error callback', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'stream unavailable' }), { status: 503 }),
    )

    const error = await new Promise<unknown>((resolve) => {
      streamDeepResearchJob('https://ai.example/proxy', 'job-1', {
        onEvent: () => {},
        onError: resolve,
      })
    })

    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toContain('stream unavailable')
  })

  it('aborts active stream fetches without reporting close or error callbacks', async () => {
    const captured: { signal?: AbortSignal } = {}
    vi.mocked(fetch).mockImplementationOnce(((_url: string | URL | Request, init?: RequestInit) => {
      captured.signal = init?.signal as AbortSignal
      return new Promise<Response>((_resolve, reject) => {
        captured.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
      })
    }) as typeof fetch)
    const onError = vi.fn()
    const onClose = vi.fn()

    const stream = streamDeepResearchJob('https://ai.example/proxy', 'job-1', {
      onEvent: () => {},
      onError,
      onClose,
    })
    await new Promise((resolve) => setTimeout(resolve, 0))
    stream.close()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(captured.signal?.aborted).toBe(true)
    expect(onError).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('hydrates completed jobs into SearchRun patches and flags candidate-edge fragments', () => {
    const thesisSnapshot = buildDeepResearchThesisSnapshot({
      profile: baseProfile,
      request: baseRequest,
      identity: null,
    })
    const patch = hydrateSearchRunFromResearchJob({
      id: 'job-1',
      userId: 'user-1',
      thesisId: thesisSnapshot.id,
      thesisSnapshot,
      identityVersion: 0,
      params: baseRequest,
      paramsHash: 'hash',
      status: 'completed',
      createdAt: '2026-03-10T10:06:00.000Z',
      ttlAt: '2026-04-10T10:06:00.000Z',
      progress: { phase: 'completed', elapsedMs: 120000, searchQueries: ['waf remote'] },
      result: {
        narrative: {
          competitiveMoat: 'Deep platform and security moat with real production context.',
          selectionMethodology: 'Filtered roles by platform ownership and security adjacency.',
          marketContext: 'Security platform hiring rewards hands-on edge experience.',
          executiveSummary: 'A concise but complete summary that is long enough for the contract.',
        },
        contractViolations: ['upstream warning'],
        results: [
          {
            id: 'sres-1',
            tier: 1,
            company: 'Edge Co',
            title: 'Staff Engineer',
            url: 'https://example.com',
            matchScore: 90,
            matchReason: 'Strong fit',
            vectorAlignment: 'security-platform',
            risks: [],
            source: 'web',
            candidateEdge: 'Fragment only.',
          },
        ],
        tokenUsage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
      },
    })

    expect(patch.status).toBe('completed')
    expect(patch.searchLog).toEqual(['waf remote'])
    expect(patch.contractViolations).toEqual([
      'upstream warning',
      expect.stringContaining('candidateEdge'),
    ])
  })

  it('marks completed jobs without result payloads as failed instead of spinning forever', () => {
    const thesisSnapshot = buildDeepResearchThesisSnapshot({
      profile: baseProfile,
      request: baseRequest,
      identity: null,
    })
    const patch = hydrateSearchRunFromResearchJob({
      id: 'job-missing-result',
      userId: 'user-1',
      thesisId: thesisSnapshot.id,
      thesisSnapshot,
      identityVersion: 0,
      params: baseRequest,
      paramsHash: 'hash',
      status: 'completed',
      createdAt: '2026-03-10T10:06:00.000Z',
      ttlAt: '2026-04-10T10:06:00.000Z',
    })

    expect(patch).toEqual({
      status: 'failed',
      error: 'Deep research job completed but the result payload was missing.',
    })
  })

  it('hydrates failed, canceled, queued, and running jobs into SearchRun patches', () => {
    expect(hydrateSearchRunFromResearchJob(buildJob({
      status: 'failed',
      error: { code: 'upstream_529', message: 'Provider timed out', retriable: true },
    }))).toEqual({
      status: 'failed',
      error: 'Provider timed out',
    })

    expect(hydrateSearchRunFromResearchJob(buildJob({ status: 'canceled' }))).toEqual({
      status: 'failed',
      error: 'Deep research job was canceled. Thesis and request are preserved for retry.',
    })

    expect(hydrateSearchRunFromResearchJob(buildJob({ status: 'queued' }))).toEqual({
      status: 'running',
      searchLog: ['waf remote'],
      error: undefined,
    })

    expect(hydrateSearchRunFromResearchJob(buildJob({ status: 'running' }))).toEqual({
      status: 'running',
      searchLog: ['waf remote'],
      error: undefined,
    })
  })
})
