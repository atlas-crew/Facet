import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  ApplicationPlan,
  SearchProfile,
  SearchRequest,
  SearchResultEntry,
  SearchTimeline,
} from '../types/search'
import {
  buildSearchPrompt,
  clampMatchScore,
  callSearchProxy,
  collectQueryStrings,
  countSentences,
  executeSearch,
  extractJsonBlock,
  normalizeResults,
  normalizeRunNarrative,
  normalizeTier,
  validateApplicationPlanAgainstTimeline,
  validateNarrativeCandidateEdges,
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

describe('normalizeRunNarrative', () => {
  const validNarrativePayload = () => ({
    competitiveMoat:
      'The candidate combines platform engineering and security expertise at a depth rare among applicants, with demonstrable shipping velocity through AI-augmented workflows.',
    selectionMethodology:
      'Filtered live postings by three intersecting criteria: builder-friendly interview format, fully-remote platform/security roles, and stack alignment with Rust, Kubernetes, and AWS.',
    marketContext:
      'At least 30% of technical interview loops at growth-stage companies now permit AI tool use during assessments, a shift since 2024 that opens new targets aligned with this candidate profile.',
    executiveSummary:
      'The top five matches cluster around builder-friendly interview cultures with AI-augmented development norms. Each offers an almost-exact stack overlap and avoids algorithm gatekeeping. PostHog stands out for its paid work-sample process.',
  })

  it('returns a narrative with all required layers when the payload is valid', () => {
    const { narrative, violations } = normalizeRunNarrative(validNarrativePayload())

    expect(violations).toEqual([])
    expect(narrative?.competitiveMoat).toContain('platform engineering')
    expect(narrative?.selectionMethodology).toContain('three intersecting criteria')
    expect(narrative?.marketContext).toContain('2024')
    expect(narrative?.executiveSummary).toContain('PostHog')
  })

  it('returns undefined narrative with a violation when payload is not an object', () => {
    expect(normalizeRunNarrative(null)).toEqual({ violations: ['narrative: payload is not an object'] })
    expect(normalizeRunNarrative('string')).toEqual({
      violations: ['narrative: payload is not an object'],
    })
    expect(normalizeRunNarrative([])).toEqual({
      violations: ['narrative: payload is not an object'],
    })
  })

  it('returns undefined narrative when executiveSummary is missing', () => {
    const payload = validNarrativePayload() as Record<string, unknown>
    delete payload.executiveSummary
    const result = normalizeRunNarrative(payload)
    expect(result.narrative).toBeUndefined()
    expect(result.violations).toContain('narrative.executiveSummary: missing or empty')
  })

  it('returns undefined narrative when competitiveMoat is empty', () => {
    const payload = { ...validNarrativePayload(), competitiveMoat: '   ' }
    const result = normalizeRunNarrative(payload)
    expect(result.narrative).toBeUndefined()
    expect(result.violations).toContain('narrative.competitiveMoat: missing or empty')
  })

  it('flags short required fields but still returns the narrative', () => {
    const payload = {
      ...validNarrativePayload(),
      competitiveMoat: 'Short.',
      executiveSummary: 'Too brief.',
    }
    const result = normalizeRunNarrative(payload)
    expect(result.narrative).toBeDefined()
    expect(result.violations.some((v) => v.includes('competitiveMoat: too short'))).toBe(true)
    expect(result.violations.some((v) => v.includes('executiveSummary: too short'))).toBe(true)
  })

  it('parses optional closing layers when present', () => {
    const payload = {
      ...validNarrativePayload(),
      landscapeTrends:
        'Companies like Sourcegraph and Canva now explicitly welcome AI tool use during interviews.',
      scoringRubric: ['Role type alignment', 'Remote viability', 'Compensation fit'],
      laneSummaries: [
        {
          lane: 'security-platform',
          narrative: 'Security-platform engineering roles cluster at product-security firms.',
          topCompanies: ['Wiz', 'Life360'],
        },
      ],
      objectiveRecommendations: [
        {
          objective: 'compensation',
          recommendedCompanies: ['Temporal', 'Cortex'],
          rationale: 'Published ranges reach $350K for Staff+ engineers.',
        },
      ],
      surprises: ['Finding: 900+ no-whiteboard companies catalogued on GitHub.'],
      rejectedCandidates: [
        { company: 'GitLab', reason: 'Current openings limited — worth monitoring.' },
      ],
      nextSteps: ['Prepare a single portfolio deck covering shipped platforms.'],
      references: [
        { id: 1, url: 'https://example.com/1' },
        { id: '2', url: 'https://example.com/2', title: 'Job Posting' },
      ],
    }
    const { narrative, violations } = normalizeRunNarrative(payload)

    expect(violations).toEqual([])
    expect(narrative?.landscapeTrends).toContain('Sourcegraph')
    expect(narrative?.scoringRubric).toHaveLength(3)
    expect(narrative?.laneSummaries?.[0]).toMatchObject({ lane: 'security-platform' })
    expect(narrative?.objectiveRecommendations?.[0]?.objective).toBe('compensation')
    expect(narrative?.surprises).toHaveLength(1)
    expect(narrative?.rejectedCandidates?.[0]?.company).toBe('GitLab')
    expect(narrative?.nextSteps).toHaveLength(1)
    expect(narrative?.references).toEqual([
      { id: 1, url: 'https://example.com/1' },
      { id: '2', url: 'https://example.com/2', title: 'Job Posting' },
    ])
  })

  it('omits optional fields when absent', () => {
    const { narrative } = normalizeRunNarrative(validNarrativePayload())
    expect(narrative?.landscapeTrends).toBeUndefined()
    expect(narrative?.scoringRubric).toBeUndefined()
    expect(narrative?.laneSummaries).toBeUndefined()
    expect(narrative?.objectiveRecommendations).toBeUndefined()
    expect(narrative?.applicationPlan).toBeUndefined()
    expect(narrative?.visualizations).toBeUndefined()
    expect(narrative?.surprises).toBeUndefined()
    expect(narrative?.rejectedCandidates).toBeUndefined()
    expect(narrative?.nextSteps).toBeUndefined()
    expect(narrative?.references).toBeUndefined()
  })

  it('preserves Mermaid source verbatim (no trim, no re-serialization)', () => {
    const mermaid = '\n  gantt\n    dateFormat YYYY-MM-DD\n    title Plan\n'
    const payload = {
      ...validNarrativePayload(),
      visualizations: [
        {
          type: 'mermaid-gantt',
          source: mermaid,
          caption: 'Application timeline',
        },
      ],
    }
    const { narrative } = normalizeRunNarrative(payload)
    expect(narrative?.visualizations?.[0]?.source).toBe(mermaid)
    expect(narrative?.visualizations?.[0]?.type).toBe('mermaid-gantt')
  })

  it('falls back to mermaid-other for unknown visualization types', () => {
    const payload = {
      ...validNarrativePayload(),
      visualizations: [{ type: 'bogus-type', source: 'graph TD\n  A --> B\n' }],
    }
    const { narrative } = normalizeRunNarrative(payload)
    expect(narrative?.visualizations?.[0]?.type).toBe('mermaid-other')
  })

  it('parses an applicationPlan with phases and tasks, preserving dependencies', () => {
    const payload = {
      ...validNarrativePayload(),
      applicationPlan: {
        startDate: '2026-02-27',
        targetOfferDate: '2026-03-31',
        phases: [
          {
            name: 'materials',
            tasks: [
              { label: 'Finalize Platform variant', startDate: '2026-02-27', durationDays: 2 },
              {
                label: 'Create portfolio deck',
                startDate: '2026-02-28',
                durationDays: 3,
                dependencies: ['Finalize Platform variant'],
              },
            ],
          },
          {
            name: 'outreach',
            tasks: [
              { label: 'Apply to top 5', startDate: '2026-03-01', durationDays: 2 },
            ],
          },
        ],
        mermaidDiagram: 'gantt\n  dateFormat YYYY-MM-DD\n',
      },
    }
    const { narrative, violations } = normalizeRunNarrative(payload)
    expect(violations).toEqual([])
    expect(narrative?.applicationPlan?.phases).toHaveLength(2)
    expect(narrative?.applicationPlan?.phases[0]?.tasks[1]?.dependencies).toEqual([
      'Finalize Platform variant',
    ])
    expect(narrative?.applicationPlan?.targetOfferDate).toBe('2026-03-31')
    expect(narrative?.applicationPlan?.mermaidDiagram).toContain('dateFormat')
  })

  it('flags malformed applicationPlan (missing startDate)', () => {
    const payload = {
      ...validNarrativePayload(),
      applicationPlan: { phases: [] },
    }
    const { narrative, violations } = normalizeRunNarrative(payload)
    expect(narrative?.applicationPlan).toBeUndefined()
    expect(violations).toContain('narrative.applicationPlan: malformed (missing startDate or not an object)')
  })

  it('drops invalid entries inside optional arrays without crashing', () => {
    const payload = {
      ...validNarrativePayload(),
      laneSummaries: [
        { lane: '', narrative: 'empty lane label' },
        { lane: 'valid', narrative: 'Has content.', topCompanies: ['Co'] },
      ],
      rejectedCandidates: [
        { company: 'OK', reason: '' }, // missing reason → drop
        { company: 'OK2', reason: 'Missed deadline' }, // valid
      ],
      references: [
        { id: null, url: 'https://example.com/bad' }, // missing id → drop
        { id: 1, url: 'https://example.com/ok' },
      ],
    }
    const { narrative } = normalizeRunNarrative(payload)
    expect(narrative?.laneSummaries).toHaveLength(1)
    expect(narrative?.rejectedCandidates).toHaveLength(1)
    expect(narrative?.references).toHaveLength(1)
  })
})

describe('validateNarrativeCandidateEdges', () => {
  const makeResult = (
    company: string,
    candidateEdge: string | undefined,
  ): SearchResultEntry => ({
    id: `sres-${company}`,
    tier: 1,
    company,
    title: 'Senior Engineer',
    url: `https://${company}.example/jobs/1`,
    matchScore: 80,
    matchReason: 'Strong fit',
    vectorAlignment: 'Platform',
    risks: [],
    source: 'web_search',
    ...(candidateEdge !== undefined ? { candidateEdge } : {}),
  })

  it('returns no violations when every candidateEdge has 2+ sentences', () => {
    const results = [
      makeResult('PostHog', 'Open-source culture matches the candidate. Stack overlap is near-exact.'),
      makeResult('Railway', 'Build-with-API interview rewards shipping speed. Team is distributed.'),
    ]
    expect(validateNarrativeCandidateEdges(results)).toEqual([])
  })

  it('flags missing candidateEdge', () => {
    const results = [makeResult('SilentCo', undefined)]
    const violations = validateNarrativeCandidateEdges(results)
    expect(violations).toHaveLength(1)
    expect(violations[0]).toContain('SilentCo')
    expect(violations[0]).toContain('missing or empty')
  })

  it('flags empty candidateEdge', () => {
    const results = [makeResult('BlankCo', '   ')]
    const violations = validateNarrativeCandidateEdges(results)
    expect(violations[0]).toContain('missing or empty')
  })

  it('flags candidateEdge with fewer than 2 sentences', () => {
    const results = [makeResult('FragmentCo', 'Strong fit for this role.')]
    const violations = validateNarrativeCandidateEdges(results)
    expect(violations).toHaveLength(1)
    expect(violations[0]).toContain('FragmentCo')
    expect(violations[0]).toContain('fewer than 2 sentences')
    expect(violations[0]).toContain('got 1')
  })

  it('accepts candidateEdges with 3+ sentences', () => {
    const results = [
      makeResult(
        'DeepCo',
        'Candidate has direct experience. Company stack aligns. The interview format rewards shipping quickly.',
      ),
    ]
    expect(validateNarrativeCandidateEdges(results)).toEqual([])
  })
})

describe('countSentences', () => {
  it('counts single sentence', () => {
    expect(countSentences('Hello world.')).toBe(1)
  })

  it('counts multiple sentences separated by whitespace', () => {
    expect(countSentences('One. Two. Three.')).toBe(3)
  })

  it('counts exclamation and question marks', () => {
    expect(countSentences('Really? Yes! Indeed.')).toBe(3)
  })

  it('treats ellipses as one sentence ending', () => {
    expect(countSentences('Unclear... but probable.')).toBe(2)
  })

  it('returns zero for text without terminal punctuation', () => {
    expect(countSentences('no ending here')).toBe(0)
  })
})

describe('validateApplicationPlanAgainstTimeline', () => {
  const makePlan = (): ApplicationPlan => ({
    startDate: '2026-02-27',
    phases: [
      {
        name: 'materials',
        tasks: [{ label: 'Finalize variant', startDate: '2026-02-27', durationDays: 2 }],
      },
      {
        name: 'outreach',
        tasks: [{ label: 'Apply to Top 5', startDate: '2026-03-01', durationDays: 2 }],
      },
    ],
  })

  it('returns no violations when no timeline is provided', () => {
    expect(validateApplicationPlanAgainstTimeline(makePlan())).toEqual([])
  })

  it('returns no violations when timeline has no deadline', () => {
    const timeline: SearchTimeline = { urgency: 'exploratory', strategyImpact: 'no rush' }
    expect(validateApplicationPlanAgainstTimeline(makePlan(), timeline)).toEqual([])
  })

  it('flags tasks ending after the deadline', () => {
    const timeline: SearchTimeline = {
      urgency: 'active',
      deadline: '2026-03-01', // plan task at 2026-03-01 + 2 days = 2026-03-03, past deadline
      strategyImpact: 'Tight window',
    }
    const violations = validateApplicationPlanAgainstTimeline(makePlan(), timeline)
    expect(violations.length).toBeGreaterThan(0)
    expect(violations.some((v) => v.includes('outreach.Apply to Top 5'))).toBe(true)
  })

  it('flags unparseable deadline', () => {
    const timeline: SearchTimeline = {
      urgency: 'active',
      deadline: 'sometime next month',
      strategyImpact: 'Tight window',
    }
    const violations = validateApplicationPlanAgainstTimeline(makePlan(), timeline)
    expect(violations).toEqual([
      'applicationPlan: SearchTimeline.deadline "sometime next month" is not a parseable date',
    ])
  })

  it('flags unparseable task startDate', () => {
    const plan: ApplicationPlan = {
      startDate: '2026-02-27',
      phases: [
        {
          name: 'materials',
          tasks: [{ label: 'Bad task', startDate: 'not-a-date', durationDays: 2 }],
        },
      ],
    }
    const timeline: SearchTimeline = {
      urgency: 'active',
      deadline: '2026-03-31',
      strategyImpact: 'Tight window',
    }
    const violations = validateApplicationPlanAgainstTimeline(plan, timeline)
    expect(violations).toHaveLength(1)
    expect(violations[0]).toContain('Bad task')
    expect(violations[0]).toContain('not a parseable date')
  })

  it('accepts a plan entirely before the deadline', () => {
    const timeline: SearchTimeline = {
      urgency: 'active',
      deadline: '2026-04-30',
      strategyImpact: 'Comfortable window',
    }
    expect(validateApplicationPlanAgainstTimeline(makePlan(), timeline)).toEqual([])
  })
})
