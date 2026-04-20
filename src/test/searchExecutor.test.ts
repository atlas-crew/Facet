import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SearchProfile, SearchRequest } from '../types/search'
import {
  buildSearchPrompt,
  clampMatchScore,
  callSearchProxy,
  collectQueryStrings,
  executeSearch,
  extractJsonBlock,
  normalizeResults,
  normalizeTier,
} from '../utils/searchExecutor'

const baseProfile: SearchProfile = {
  id: 'sprof-1',
  inferredAt: '2026-03-10T10:00:00.000Z',
  inferredFromResumeVersion: 1,
  skills: [
    { id: 'skl-1', name: 'TypeScript', category: 'backend', depth: 'strong' },
    { id: 'skl-2', name: 'On-call', category: 'other', depth: 'avoid' },
  ],
  vectors: [
    {
      vectorId: 'backend',
      priority: 1,
      description: 'Backend and platform roles',
      targetRoleTitles: ['Staff Engineer'],
      searchKeywords: ['distributed systems'],
    },
  ],
  workSummary: [{ title: 'Recent scope', summary: 'Built backend and platform systems.' }],
  openQuestions: [],
  constraints: {
    compensation: '$250k',
    locations: ['Remote'],
    clearance: '',
    companySize: '',
  },
  filters: {
    prioritize: ['platform'],
    avoid: ['ad tech'],
  },
  interviewPrefs: {
    strongFit: ['staff scope'],
    redFlags: ['unclear ownership'],
  },
}

const baseRequest: SearchRequest = {
  id: 'sreq-1',
  createdAt: '2026-03-10T10:05:00.000Z',
  focusVectors: ['backend'],
  companySizeOverride: '',
  salaryAnchorOverride: '$250k',
  geoExpand: true,
  customKeywords: 'platform engineering',
  excludeCompanies: ['OldCo'],
  maxResults: {
    tier1: 2,
    tier2: 1,
    tier3: 1,
  },
}

describe('searchExecutor', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('normalizes results, filters invalid entries, sorts, and enforces tier limits', () => {
    const results = normalizeResults(
      {
        results: [
          {
            tier: 1,
            company: 'Beta',
            title: 'Staff Engineer',
            url: 'https://example.com/beta',
            matchScore: 80,
            matchReason: 'Strong fit',
            vectorAlignment: 'backend',
            risks: ['none'],
            source: 'web',
          },
          {
            tier: '1',
            company: 'Alpha',
            title: 'Principal Engineer',
            url: 'https://example.com/alpha',
            matchScore: 150,
            matchReason: 'Excellent fit',
            vectorAlignment: 'backend',
            risks: [],
            source: 'web',
          },
          {
            tier: 1,
            company: 'Gamma',
            title: 'Platform Lead',
            url: 'https://example.com/gamma',
            matchScore: 75,
            matchReason: 'Should be trimmed by limit',
            vectorAlignment: 'platform',
            risks: [],
            source: 'web',
          },
          {
            tier: 2,
            company: 'Delta',
            title: 'Staff Platform Engineer',
            url: 'https://example.com/delta',
            matchScore: -20,
            matchReason: 'Stretch',
            vectorAlignment: 'platform',
            risks: [],
            source: 'web',
          },
          {
            tier: 2,
            company: 'Missing URL',
            title: 'Invalid',
            matchScore: 90,
            matchReason: 'Invalid',
            vectorAlignment: 'backend',
            risks: [],
            source: 'web',
          },
        ],
      },
      baseRequest,
    )

    expect(results).toHaveLength(3)
    expect(results.map((result) => result.company)).toEqual(['Alpha', 'Beta', 'Delta'])
    expect(results[0]?.matchScore).toBe(100)
    expect(results[2]?.matchScore).toBe(0)
  })

  it('exports pure normalization helpers for edge-case coverage', () => {
    expect(extractJsonBlock('```json\n{"ok":true}\n```')).toBe('{"ok":true}')
    expect(extractJsonBlock('{"results": []}')).toBe('{"results": []}')
    expect(() => extractJsonBlock('not json at all')).toThrow('Could not find JSON block')

    expect(clampMatchScore(-5)).toBe(0)
    expect(clampMatchScore(55.6)).toBe(56)
    expect(clampMatchScore(150)).toBe(100)
    expect(clampMatchScore(Number.NaN)).toBe(0)

    expect(normalizeTier(1)).toBe(1)
    expect(normalizeTier('2')).toBe(2)
    expect(normalizeTier('4')).toBeNull()

    expect(
      collectQueryStrings({
        query: 'staff platform engineer',
        queries: ['remote backend'],
        search_query: ['principal engineer'],
      }),
    ).toEqual(['staff platform engineer', 'remote backend', 'principal engineer'])
  })

  it('handles empty and invalid result payloads safely', () => {
    expect(normalizeResults(null, baseRequest)).toEqual([])
    expect(normalizeResults(undefined, baseRequest)).toEqual([])
    expect(normalizeResults('not-an-object', baseRequest)).toEqual([])
    expect(normalizeResults({ results: [] }, baseRequest)).toEqual([])
  })

  it('normalizes enriched result fields when present', () => {
    const results = normalizeResults(
      {
        results: [
          {
            tier: 1,
            company: 'PostHog',
            title: 'Platform Engineer',
            url: 'https://posthog.com/careers',
            matchScore: 95,
            matchReason: 'Strong platform fit',
            vectorAlignment: 'platform',
            risks: [],
            source: 'web',
            candidateEdge: 'Built 4 platforms solo in 11 months — PostHog needs that velocity.',
            interviewProcess: {
              format: 'Paid SuperDay — build a real project',
              builderFriendly: true,
              aiToolsAllowed: true,
              estimatedTimeline: '14 days',
            },
            companyIntel: {
              stage: 'Series B, 170 employees',
              aiCulture: 'AI-first — building AI product features',
              remotePolicy: 'Fully remote, global',
              openRoleCount: 27,
            },
            signalGroup: 'every signal aligns',
            advantageMatch: 'Platform + Security + Fleet Management',
          },
        ],
      },
      { ...baseRequest, maxResults: { tier1: 5, tier2: 5, tier3: 5 } },
    )

    expect(results).toHaveLength(1)
    expect(results[0]?.candidateEdge).toBe('Built 4 platforms solo in 11 months — PostHog needs that velocity.')
    expect(results[0]?.interviewProcess?.format).toBe('Paid SuperDay — build a real project')
    expect(results[0]?.interviewProcess?.builderFriendly).toBe(true)
    expect(results[0]?.interviewProcess?.aiToolsAllowed).toBe(true)
    expect(results[0]?.interviewProcess?.estimatedTimeline).toBe('14 days')
    expect(results[0]?.companyIntel?.stage).toBe('Series B, 170 employees')
    expect(results[0]?.companyIntel?.aiCulture).toBe('AI-first — building AI product features')
    expect(results[0]?.companyIntel?.remotePolicy).toBe('Fully remote, global')
    expect(results[0]?.companyIntel?.openRoleCount).toBe(27)
    expect(results[0]?.signalGroup).toBe('every signal aligns')
    expect(results[0]?.advantageMatch).toBe('Platform + Security + Fleet Management')
  })

  it('omits enriched fields when absent from AI response', () => {
    const results = normalizeResults(
      {
        results: [
          {
            tier: 1,
            company: 'Minimal',
            title: 'Engineer',
            url: 'https://example.com',
            matchScore: 70,
            matchReason: 'Basic match',
            vectorAlignment: 'backend',
            risks: [],
            source: 'web',
          },
        ],
      },
      { ...baseRequest, maxResults: { tier1: 5, tier2: 5, tier3: 5 } },
    )

    expect(results).toHaveLength(1)
    expect(results[0]?.candidateEdge).toBeUndefined()
    expect(results[0]?.interviewProcess).toBeUndefined()
    expect(results[0]?.companyIntel).toBeUndefined()
    expect(results[0]?.signalGroup).toBeUndefined()
    expect(results[0]?.advantageMatch).toBeUndefined()
  })

  it('normalizes interviewProcess with missing optional fields', () => {
    const results = normalizeResults(
      {
        results: [
          {
            tier: 1,
            company: 'Partial',
            title: 'Engineer',
            url: 'https://example.com',
            matchScore: 80,
            matchReason: 'Match',
            vectorAlignment: 'backend',
            risks: [],
            source: 'web',
            interviewProcess: { format: 'Take-home' },
          },
        ],
      },
      { ...baseRequest, maxResults: { tier1: 5, tier2: 5, tier3: 5 } },
    )

    expect(results[0]?.interviewProcess?.format).toBe('Take-home')
    expect(results[0]?.interviewProcess?.builderFriendly).toBe(false)
    expect(results[0]?.interviewProcess?.aiToolsAllowed).toBe(false)
    expect(results[0]?.interviewProcess?.estimatedTimeline).toBeUndefined()
  })

  it('drops companyIntel when all fields are empty strings', () => {
    const results = normalizeResults(
      {
        results: [
          {
            tier: 1,
            company: 'Empty',
            title: 'Engineer',
            url: 'https://example.com',
            matchScore: 80,
            matchReason: 'Match',
            vectorAlignment: 'backend',
            risks: [],
            source: 'web',
            companyIntel: { stage: '', aiCulture: '', remotePolicy: '' },
          },
        ],
      },
      { ...baseRequest, maxResults: { tier1: 5, tier2: 5, tier3: 5 } },
    )

    expect(results[0]?.companyIntel).toBeUndefined()
  })

  it('builds prompts with focused vectors and without avoid-depth skills', () => {
    const prompt = buildSearchPrompt(baseProfile, baseRequest)

    expect(prompt).toContain('"vectorId": "backend"')
    expect(prompt).toContain('"name": "TypeScript"')
    expect(prompt).not.toContain('"name": "On-call"')

    const promptWithAllVectors = buildSearchPrompt(baseProfile, {
      ...baseRequest,
      focusVectors: [],
    })
    expect(promptWithAllVectors).toContain('"vectorId": "backend"')
  })

  it('executes search, extracts search logs, and returns token usage', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        usage: {
          input_tokens: 120,
          output_tokens: 80,
        },
        content: [
          {
            type: 'tool_use',
            input: {
              query: 'staff platform engineer remote',
            },
          },
          {
            type: 'text',
            text: JSON.stringify({
              results: [
                {
                  tier: 1,
                  company: 'Acme',
                  title: 'Staff Engineer',
                  url: 'https://example.com/acme',
                  matchScore: 92,
                  matchReason: 'Strong platform fit',
                  vectorAlignment: 'backend',
                  risks: ['Company size slightly smaller than requested'],
                  source: 'greenhouse',
                },
              ],
            }),
          },
        ],
      }),
    } as Response)

    const result = await executeSearch(baseProfile, baseRequest, 'https://ai.example/proxy')

    expect(result.results).toHaveLength(1)
    expect(result.searchLog).toEqual(['staff platform engineer remote'])
    expect(result.tokenUsage).toEqual({
      inputTokens: 120,
      outputTokens: 80,
      totalTokens: 200,
    })
  })

  it('supports direct proxy parsing for choices responses and fallback payloads', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: '{"results":[]}',
            },
          },
        ],
      }),
    } as Response)

    const choicesResult = await callSearchProxy(
      'https://ai.example/proxy',
      'system',
      'user',
    )
    expect(choicesResult.text).toBe('{"results":[]}')
    expect(choicesResult.tokenUsage).toBeUndefined()

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        unexpected: 'shape',
      }),
    } as Response)

    const fallbackResult = await callSearchProxy(
      'https://ai.example/proxy',
      'system',
      'user',
    )
    expect(fallbackResult.text).toBe(JSON.stringify({ unexpected: 'shape' }))
  })

  it('surfaces HTTP and timeout errors from the proxy layer', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => 'Too many requests',
    } as Response)

    await expect(
      executeSearch(baseProfile, baseRequest, 'https://ai.example/proxy'),
    ).rejects.toThrow('AI proxy error (429)')

    const timeoutError = new Error('timed out')
    timeoutError.name = 'AbortError'
    vi.mocked(fetch).mockRejectedValueOnce(timeoutError)

    await expect(
      executeSearch(baseProfile, baseRequest, 'https://ai.example/proxy'),
    ).rejects.toThrow('AI request timed out after 120000ms.')
  })

  it('throws a parse error when the response body is not valid result JSON', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: '{"results": [}' }],
      }),
    } as Response)

    await expect(
      executeSearch(baseProfile, baseRequest, 'https://ai.example/proxy'),
    ).rejects.toThrow('Failed to parse search results response.')
  })

  it('sends the hosted feature id and surfaces upgrade-required proxy failures', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 402,
      text: async () =>
        JSON.stringify({
          code: 'ai_access_denied',
          reason: 'upgrade_required',
          feature: 'research.search',
          error: 'Upgrade to AI Pro to use this hosted AI feature.',
        }),
    } as Response)

    await expect(
      callSearchProxy('https://ai.example/proxy', 'System', 'User prompt'),
    ).rejects.toThrow('Upgrade to AI Pro to use this hosted AI feature.')

    expect(fetch).toHaveBeenCalledTimes(1)
    const [, init] = vi.mocked(fetch).mock.calls[0] ?? []
    expect(JSON.parse((init as RequestInit).body as string)).toEqual(
      expect.objectContaining({
        feature: 'research.search',
      }),
    )
  })
})
