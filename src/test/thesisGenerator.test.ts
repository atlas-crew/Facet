import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SearchFeedbackEvent } from '../types/search'
import {
  buildSkillIdentityFields,
  buildThesisGenerationPrompt,
  collectThesisIdentityFieldDependencies,
  generateSearchThesisFromIdentity,
  normalizeGeneratedSearchThesis,
  validateSearchThesis,
} from '../utils/thesisGenerator'
import { cloneIdentityFixture } from './fixtures/identityFixture'

const { mockCallLlmProxy } = vi.hoisted(() => ({
  mockCallLlmProxy: vi.fn(),
}))

vi.mock('../utils/llmProxy', async () => {
  const actual = await vi.importActual<typeof import('../utils/llmProxy')>('../utils/llmProxy')
  return {
    ...actual,
    callLlmProxy: (...args: Parameters<typeof actual.callLlmProxy>) => mockCallLlmProxy(...args),
    callLlmProxyDetailed: async (...args: Parameters<typeof actual.callLlmProxyDetailed>) => {
      const result = await mockCallLlmProxy(...args)
      return typeof result === 'string' ? { text: result } : result
    },
  }
})

const narrative = [
  'Alex should search for platform roles where deployment architecture is not background plumbing but a product lever. The identity evidence points to someone who can translate infrastructure constraints into reliable customer delivery.',
  'The strongest moat is the mix of Kubernetes implementation depth and product-facing judgment. That is rarer than generic backend experience because it lets Alex evaluate whether a company needs platform architecture, developer productivity, or simple operations coverage.',
  'The search should prioritize modernization teams with explicit signals around installability, on-prem delivery, and internal platform leverage. It should avoid jobs where Kubernetes administration is the product instead of the enabling substrate.',
].join('\n\n')

describe('thesisGenerator', () => {
  beforeEach(() => {
    mockCallLlmProxy.mockReset()
  })

  it('collects thesis identity fields defensively when skill depth is absent', () => {
    expect(collectThesisIdentityFieldDependencies({})).toBeUndefined()
    expect(collectThesisIdentityFieldDependencies({ skillDepthMap: [] })).toBeUndefined()
    expect(
      collectThesisIdentityFieldDependencies({
        skillDepthMap: [
          { skill: 'Kubernetes', depth: 'strong', context: 'Test', searchSignal: 'Test' },
          { skill: ' TypeScript ', depth: 'strong', context: 'Test', searchSignal: 'Test' },
          { skill: 'Kubernetes', depth: 'strong', context: 'Test', searchSignal: 'Test' },
        ],
      }),
    ).toEqual([
      'skills.Kubernetes.depth',
      'skills.Kubernetes.context',
      'skills.Kubernetes.positioning',
      'skills.TypeScript.depth',
      'skills.TypeScript.context',
      'skills.TypeScript.positioning',
    ])
  })

  it('builds skill identity field paths for thesis dependencies', () => {
    expect(buildSkillIdentityFields('Kubernetes')).toEqual([
      'skills.Kubernetes.depth',
      'skills.Kubernetes.context',
      'skills.Kubernetes.positioning',
    ])
    expect(buildSkillIdentityFields('')).toEqual([])
    expect(buildSkillIdentityFields('   ')).toEqual([])
  })

  it('builds a full identity prompt with pending feedback events', () => {
    const identity = cloneIdentityFixture()
    const prompt = buildThesisGenerationPrompt(identity, [
      {
        id: 'fb-1',
        createdAt: '2026-04-20T10:00:00.000Z',
        runId: 'srun-1',
        resultId: 'sres-1',
        rating: 'down',
        reason: 'Too much Kubernetes admin framing',
        appliedToIdentity: false,
      },
    ])

    expect(prompt).toContain('Professional identity model:')
    expect(prompt).toContain('"self_model"')
    expect(prompt).toContain('"preferences"')
    expect(prompt).toContain('"skills"')
    expect(prompt).toContain('"roles"')
    expect(prompt).toContain('Too much Kubernetes admin framing')
  })

  it('appends user corrections and a custom directive to the prompt when supplied', () => {
    const identity = cloneIdentityFixture()
    const prompt = buildThesisGenerationPrompt(identity, [], {
      userCorrections: 'Steer away from Kubernetes admin framing - emphasize platform leverage.',
      customDirective: 'Research adjacent CTO roles at platform-modernization startups.',
    })

    expect(prompt).toContain('User corrections from the previous thesis')
    expect(prompt).toContain('Steer away from Kubernetes admin framing')
    expect(prompt).toContain('Custom search directive')
    expect(prompt).toContain('Research adjacent CTO roles')
  })

  it('generates a normalized thesis with Opus thinking budget options', async () => {
    const identity = cloneIdentityFixture()
    identity.model_revision = 7
    const feedback: SearchFeedbackEvent[] = [
      {
        id: 'fb-1',
        createdAt: '2026-04-20T10:00:00.000Z',
        runId: 'srun-1',
        resultId: 'sres-1',
        rating: 'down',
        reason: 'Prefer modernization over cluster admin roles',
        appliedToIdentity: false,
      },
    ]

    mockCallLlmProxy.mockResolvedValueOnce(
      '<result>' +
        JSON.stringify({
          id: 'sthesis-generated',
          narrative,
          competitiveMoat:
            'Kubernetes delivery depth combined with product-aware platform strategy and customer deployment evidence.',
          unfairAdvantages: [
            {
              combination: 'Kubernetes delivery plus product judgment',
              depth: 'strong',
              targetCompanyProfile: 'Platform modernization teams',
            },
          ],
          searchLanes: [
            {
              id: 'lane-modernization',
              title: 'Platform modernization',
              rationale:
                'This lane is strong because it seeks teams whose deployment model is strategically important. It fits the identity evidence without reducing the role to cluster administration.',
              targetSignals: ['on-prem delivery', 'installability'],
            },
          ],
          interviewStrategy:
            'Anchor on deployment architecture tradeoffs and product delivery outcomes.',
          lookFor: ['platform modernization', 'developer leverage'],
          avoid: [
            {
              label: 'Pure Kubernetes administration',
              condition:
                'Building around Kubernetes is fine; owning clusters as the whole job is not.',
            },
          ],
          keywordCombinations: [
            {
              query: '"platform modernization" Kubernetes',
              lane: 'lane-modernization',
              noiseLevel: 'low',
            },
          ],
          skillDepthMap: [
            {
              skill: 'Kubernetes',
              depth: 'strong',
              context:
                'Contoso evidence shows Kubernetes-based installs that unlocked customer deployment paths.',
              searchSignal: 'Use as a strong match signal for deployment architecture roles.',
            },
          ],
          feedbackIncorporated: ['fb-1', 'made-up-feedback-id'],
        }) +
        '</result>',
    )

    const result = await generateSearchThesisFromIdentity(
      identity,
      'https://ai.example/proxy',
      feedback,
    )

    expect(mockCallLlmProxy).toHaveBeenCalledWith(
      'https://ai.example/proxy',
      expect.stringContaining('SearchThesis'),
      expect.stringContaining('"model_revision":7'),
      expect.objectContaining({
        feature: 'research.thesis',
        model: 'opus',
        maxTokens: 16000,
        thinkingBudget: 10000,
        timeoutMs: 90000,
      }),
    )
    const systemPrompt = mockCallLlmProxy.mock.calls[0]?.[1]
    expect(systemPrompt).toContain('Voice and style contract:')
    expect(systemPrompt).toContain('Follow identity.generator_rules.voice_skill')
    expect(systemPrompt).toContain('Hard ban: do not output Unicode U+2013, U+2014, or U+2015')
    expect(systemPrompt).toContain('Avoid AI tells')
    expect(systemPrompt).toContain('industriesToAvoid: adtech')
    expect(systemPrompt).toContain('fundingStagesAcceptable: bootstrapped')
    expect(systemPrompt).toContain('remotePolicies: remote-only')
    expect(systemPrompt).toContain('employmentTypes: w2-fulltime')
    const responseSchemaBlock = String(systemPrompt).slice(
      String(systemPrompt).indexOf('Response schema:'),
      String(systemPrompt).indexOf('Contract:'),
    )
    expect(responseSchemaBlock).toContain(
      '"lookFor": [{ "label": "string", "condition": "optional qualifier", "severity": "hard|soft|conditional" }]',
    )
    expect(responseSchemaBlock).toContain(
      '"avoid": [{ "label": "string", "condition": "optional qualifier", "severity": "hard|soft|conditional" }]',
    )
    expect(responseSchemaBlock).not.toContain('"filters"')
    expect(responseSchemaBlock).not.toContain('prioritize')
    expect(responseSchemaBlock).not.toContain('searchOverrides.filters')
    expect(systemPrompt).toContain('do not emit duplicate searchOverrides.filters')
    expect(systemPrompt).toContain('MUST record the assumption in `assumptions[]`')
    expect(responseSchemaBlock).toContain(
      '"assumptions": [{ "id": "optional", "claim": "string", "source": "inferred|assumed-default|explicit-fallback"',
    )
    expect(result.thesis).toMatchObject({
      id: 'sthesis-generated',
      identityVersion: 7,
      source: 'generated',
      feedbackIncorporated: ['fb-1'],
    })
    expect(result.thesis.lookFor).toEqual([
      expect.objectContaining({ label: 'platform modernization', severity: 'soft' }),
      expect.objectContaining({ label: 'developer leverage', severity: 'soft' }),
    ])
    expect(result.thesis.avoid).toEqual([
      expect.objectContaining({
        label: 'Pure Kubernetes administration',
        condition: 'Building around Kubernetes is fine; owning clusters as the whole job is not.',
        severity: 'conditional',
      }),
    ])
    expect(result.thesis.searchOverrides).toBeUndefined()
    expect(result.contractViolations).toEqual([])
  })

  it('tags user-accepted Sonnet fallback theses and sends the proxy fallback marker', async () => {
    const identity = cloneIdentityFixture()
    mockCallLlmProxy.mockResolvedValueOnce(
      '<result>' +
        JSON.stringify({
          narrative,
          competitiveMoat:
            'Kubernetes delivery depth combined with product-aware platform strategy and customer deployment evidence.',
          unfairAdvantages: [
            {
              combination: 'Kubernetes delivery plus product judgment',
              targetCompanyProfile: 'Platform modernization teams',
            },
          ],
          searchLanes: [
            {
              id: 'lane-modernization',
              title: 'Platform modernization',
              rationale:
                'This lane is strong because deployment architecture has become strategically important. It fits the identity evidence without reducing the role to cluster administration.',
              targetSignals: ['on-prem delivery', 'installability'],
            },
          ],
          interviewStrategy:
            'Anchor on deployment architecture tradeoffs and product delivery outcomes.',
          lookFor: ['platform modernization'],
          avoid: [],
          keywordCombinations: [
            {
              query: '"platform modernization" Kubernetes',
              lane: 'lane-modernization',
              noiseLevel: 'low',
            },
          ],
          skillDepthMap: [{ skill: 'Kubernetes' }],
        }) +
        '</result>',
    )

    const result = await generateSearchThesisFromIdentity(
      identity,
      'https://ai.example/proxy',
      [],
      { modelFallback: 'sonnet' },
    )

    expect(mockCallLlmProxy).toHaveBeenCalledWith(
      'https://ai.example/proxy',
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        feature: 'research.thesis',
        model: 'sonnet',
        capabilityFallback: 'opus_unavailable',
      }),
    )
    expect(result.thesis.source).toBe('generated-fallback')
  })

  it('fails before calling the proxy when identity context is too large', async () => {
    const identity = cloneIdentityFixture()
    identity.roles[0]!.bullets[0]!.action = 'x'.repeat(130_000)

    await expect(
      generateSearchThesisFromIdentity(identity, 'https://ai.example/proxy'),
    ).rejects.toThrow(/too large for thesis generation/i)
    expect(mockCallLlmProxy).not.toHaveBeenCalled()
  })

  it('wraps malformed model responses in an actionable error', async () => {
    mockCallLlmProxy.mockResolvedValueOnce('no json here')

    await expect(
      generateSearchThesisFromIdentity(cloneIdentityFixture(), 'https://ai.example/proxy'),
    ).rejects.toThrow(/malformed/i)
  })

  it('surfaces model output truncation before parsing the thesis response', async () => {
    mockCallLlmProxy.mockResolvedValueOnce({
      text: '<result>{"narrative":"partial"',
      stopReason: 'max_tokens',
    })

    await expect(
      generateSearchThesisFromIdentity(cloneIdentityFixture(), 'https://ai.example/proxy'),
    ).rejects.toThrow(/truncated by the model output limit/i)
  })

  it('absorbs inferred per-search overrides and persists customDirective from generation context', async () => {
    const identity = cloneIdentityFixture()
    identity.model_revision = 9

    mockCallLlmProxy.mockResolvedValueOnce(
      '<result>' +
        JSON.stringify({
          narrative,
          competitiveMoat:
            'Kubernetes delivery depth combined with product-aware platform strategy.',
          unfairAdvantages: [
            {
              combination: 'Kubernetes delivery plus product judgment',
              depth: 'strong',
              targetCompanyProfile: 'Platform modernization teams',
            },
          ],
          searchLanes: [
            {
              id: 'lane-modernization',
              title: 'Platform modernization',
              rationale:
                'This lane targets strategic platform migration work. It matches the candidate evidence well.',
              targetSignals: ['platform modernization'],
            },
          ],
          interviewStrategy: 'Anchor on deployment architecture tradeoffs.',
          lookFor: ['platform modernization'],
          avoid: [],
          keywordCombinations: [],
          skillDepthMap: [
            {
              skill: 'Kubernetes',
              depth: 'strong',
              context: 'Customer deployment evidence from the identity model.',
              searchSignal: 'Strong match signal.',
            },
          ],
          searchOverrides: {
            constraints: {
              salary: { min: 240000, max: 340000, currency: 'USD' },
              locations: ['Tampa Bay'],
              clearance: 'None',
              companySize: 'growth',
              industriesToAvoid: ['adtech', 'invalid-industry'],
              fundingStagesAcceptable: ['series-a', 'invalid-stage'],
              remotePolicies: ['remote-only', 'invalid-policy'],
              remotePolicyNote: 'Remote-first outside Tampa Bay.',
              employmentTypes: ['w2-fulltime', 'invalid-type'],
            },
            filters: {
              prioritize: ['platform leverage'],
              avoid: ['pure cluster admin'],
            },
            interviewPrefs: {
              strongFit: ['take-home portfolio'],
              redFlags: ['leetcode-only loops'],
            },
            hiddenSkillIds: [],
          },
          feedbackIncorporated: [],
        }) +
        '</result>',
    )

    const result = await generateSearchThesisFromIdentity(
      identity,
      'https://ai.example/proxy',
      [],
      { customDirective: 'Adjacent CTO roles at platform-modernization startups.' },
    )

    expect(result.thesis.searchOverrides?.constraints.salary).toEqual({
      min: 240000,
      max: 340000,
      currency: 'USD',
    })
    expect(result.thesis.searchOverrides?.constraints.companySize).toBe('growth')
    expect(result.thesis.searchOverrides?.constraints.industriesToAvoid).toEqual(['adtech'])
    expect(result.thesis.searchOverrides?.constraints.fundingStagesAcceptable).toEqual(['series-a'])
    expect(result.thesis.searchOverrides?.constraints.remotePolicies).toEqual(['remote-only'])
    expect(result.thesis.searchOverrides?.constraints.remotePolicyNote).toBe(
      'Remote-first outside Tampa Bay.',
    )
    expect(result.thesis.searchOverrides?.constraints.employmentTypes).toEqual(['w2-fulltime'])
    expect(result.thesis.searchOverrides).not.toHaveProperty('filters')
    expect(result.thesis.lookFor.map((signal) => signal.label)).toContain('platform leverage')
    expect(result.thesis.avoid).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'pure cluster admin',
          severity: 'soft',
        }),
      ]),
    )
    expect(result.thesis.searchOverrides?.interviewPrefs.strongFit).toEqual(['take-home portfolio'])
    expect(result.thesis.customDirective).toBe(
      'Adjacent CTO roles at platform-modernization startups.',
    )
  })

  it('normalizes generated thesis signal severities', () => {
    const identity = cloneIdentityFixture()
    const thesis = normalizeGeneratedSearchThesis(
      {
        narrative,
        competitiveMoat: 'Kubernetes delivery depth combined with product-aware platform strategy.',
        unfairAdvantages: [
          {
            combination: 'Kubernetes delivery plus product judgment',
            targetCompanyProfile: 'Platform modernization teams',
          },
        ],
        searchLanes: [
          {
            id: 'lane-modernization',
            title: 'Platform modernization',
            rationale:
              'This lane targets strategic platform migration work. It matches the candidate evidence well.',
            targetSignals: ['platform modernization'],
          },
        ],
        interviewStrategy: 'Anchor on deployment architecture tradeoffs.',
        lookFor: [
          { id: 'ssig-existing-look', label: 'Stable look-for signal', severity: 'hard' },
          { label: 'Hard signal', severity: 'hard' },
          { label: 'Conditional signal', condition: 'when ownership is real' },
          'Soft signal',
          { label: 'Invalid severity', severity: 'critical' },
        ],
        avoid: [
          { id: 'ssig-existing-avoid', label: 'Stable avoid signal', severity: 'hard' },
          { label: 'Hard avoid', severity: 'hard', condition: 'even with platform scope' },
          { label: 'Conditional avoid', condition: 'unless adjacent to product work' },
          'Soft avoid',
          { label: 'Invalid avoid', severity: 'critical', condition: 'with a qualifier' },
        ],
        keywordCombinations: [],
        skillDepthMap: [{ skill: 'Kubernetes', calibration: 'Use as platform evidence.' }],
      },
      identity,
    )

    expect(thesis.lookFor.map(({ label, severity }) => ({ label, severity }))).toEqual([
      { label: 'Stable look-for signal', severity: 'hard' },
      { label: 'Hard signal', severity: 'hard' },
      { label: 'Conditional signal', severity: 'conditional' },
      { label: 'Soft signal', severity: 'soft' },
      { label: 'Invalid severity', severity: 'soft' },
    ])
    expect(thesis.avoid.map(({ label, severity }) => ({ label, severity }))).toEqual([
      { label: 'Stable avoid signal', severity: 'hard' },
      { label: 'Hard avoid', severity: 'hard' },
      { label: 'Conditional avoid', severity: 'conditional' },
      { label: 'Soft avoid', severity: 'soft' },
      { label: 'Invalid avoid', severity: 'conditional' },
    ])
    expect(thesis.lookFor[0]?.id).toBe('ssig-existing-look')
    expect(thesis.avoid[0]?.id).toBe('ssig-existing-avoid')
    expect(thesis.lookFor[1]?.id).toMatch(/^ssig-/)
    expect(thesis.avoid[1]?.id).toMatch(/^ssig-/)
  })

  it('removes long dash characters from LLM-authored thesis fields', () => {
    const identity = cloneIdentityFixture()
    const emDash = '\u2014'
    const enDash = '\u2013'
    const horizontalBar = '\u2015'
    identity.self_model.competitive_moat =
      `Kubernetes delivery${emDash}with product-aware platform judgment.`
    const thesis = normalizeGeneratedSearchThesis(
      {
        narrative,
        competitiveMoat: 'Kubernetes delivery depth combined with product-aware platform strategy.',
        unfairAdvantages: [
          {
            combination: `Kubernetes delivery${emDash}product judgment`,
            targetCompanyProfile: `Modernization teams${emDash}not ops-only teams`,
          },
          {
            combination: emDash,
            targetCompanyProfile: 'This entry should be dropped.',
          },
        ],
        searchLanes: [
          {
            id: 'lane-modernization',
            title: `Platform${emDash}modernization`,
            rationale:
              `This lane targets strategic platform migration work ${emDash} not commodity operations. ` +
              `It matches the candidate evidence${emDash}without reducing the role to admin work.`,
            competitiveContext: `Rare mix${enDash}platform and product judgment.`,
            targetSignals: [
              `installability${emDash}customer-hosted delivery`,
              `2020${enDash}2024 modernization`,
              `revenue 2020 ${enDash} 2024 growth`,
              `pre${enDash}launch delivery`,
              `customer-hosted${emDash}delivery`,
              emDash,
              '  ',
            ],
          },
          {
            title: emDash,
            rationale: 'This lane should be dropped.',
          },
        ],
        lookFor: [
          { label: `Platform leverage${emDash}with product stakes` },
          { label: `${emDash}leading boundary` },
          { label: `trailing boundary${emDash}` },
          { label: `${emDash} ${emDash}double leading` },
          { label: `double trailing${emDash} ${emDash}` },
          { label: `adjacent${emDash}${enDash}middle` },
          `string${emDash}signal`,
          { label: `preexisting - - separator${emDash}tail` },
          { label: '-keep ascii hyphen' },
          { label: `-flag ${emDash} enabled` },
          { label: emDash },
        ],
        avoid: [
          `string avoid${emDash}signal`,
          {
            label: `Cluster admin${horizontalBar}as the whole job`,
            condition: `Unless it includes platform strategy${emDash}not ticket work`,
          },
        ],
        timeline: {
          urgency: 'active',
          deadline: 'Q1-Q2 2026',
          strategyImpact: `Narrow toward platform leverage${emDash}not operations coverage.`,
        },
        keywordCombinations: [
          {
            query: `"platform modernization"${emDash}Kubernetes`,
            lane: 'lane-modernization',
            noiseLevel: 'low',
          },
          {
            query: emDash,
            lane: 'lane-modernization',
            noiseLevel: 'low',
          },
        ],
        skillDepthMap: [
          {
            skill: 'Kubernetes',
            calibration: `Use as platform evidence${emDash}not admin positioning.`,
          },
        ],
        assumptions: [
          {
            claim: `Remote-first roles${emDash}US-friendly are acceptable.`,
            source: 'inferred',
            rationale: `Location preference implies remote flexibility${emDash}but needs review.`,
            confidence: 'medium',
            overridable: true,
          },
        ],
        searchOverrides: {
          constraints: {
            locations: [`Tampa Bay${emDash}remote-friendly`],
            clearance: `No clearance${emDash}unless role is exceptional`,
            remotePolicyNote: `Prefer remote${emDash}hybrid only near Tampa.`,
          },
          filters: {
            prioritize: [`Platform orgs${emDash}with product stakes`],
            avoid: [`Ops-only teams${emDash}without product leverage`],
          },
          interviewPrefs: {
            strongFit: [`Platform strategy${emDash}customer deployment`],
            redFlags: [`Cluster babysitting${emDash}no product scope`],
          },
          hiddenSkillIds: [],
        },
      },
      identity,
    )

    expect(JSON.stringify(thesis)).not.toContain(emDash)
    expect(JSON.stringify(thesis)).not.toContain(enDash)
    expect(JSON.stringify(thesis)).not.toContain(horizontalBar)
    expect(thesis.unfairAdvantages).toHaveLength(1)
    expect(thesis.searchLanes).toHaveLength(1)
    expect(thesis.keywordCombinations).toHaveLength(1)
    expect(thesis.searchLanes[0]?.title).toBe('Platform - modernization')
    expect(thesis.searchLanes[0]?.rationale).toBe(
      'This lane targets strategic platform migration work - not commodity operations. It matches the candidate evidence - without reducing the role to admin work.',
    )
    expect(thesis.searchLanes[0]?.targetSignals).toEqual([
      'installability - customer-hosted delivery',
      '2020 to 2024 modernization',
      'revenue 2020 to 2024 growth',
      'pre-launch delivery',
      'customer-hosted-delivery',
    ])
    expect(thesis.searchLanes[0]?.competitiveContext).toBe(
      'Rare mix - platform and product judgment.',
    )
    expect(thesis.unfairAdvantages[0]?.combination).toBe(
      'Kubernetes delivery - product judgment',
    )
    expect(thesis.unfairAdvantages[0]?.targetCompanyProfile).toBe(
      'Modernization teams - not ops-only teams',
    )
    expect(thesis.competitiveMoat).toBe(
      'Kubernetes delivery - with product-aware platform judgment.',
    )
    expect(thesis.lookFor.map((signal) => signal.label)).toEqual([
      'Platform leverage - with product stakes',
      'leading boundary',
      'trailing boundary',
      'double leading',
      'double trailing',
      'adjacent - middle',
      'string - signal',
      'preexisting - - separator - tail',
      '-keep ascii hyphen',
      '-flag - enabled',
      'Platform orgs - with product stakes',
    ])
    expect(thesis.avoid.map((signal) => signal.label)).toEqual([
      'string avoid - signal',
      'Cluster admin - as the whole job',
      'Ops-only teams - without product leverage',
    ])
    expect(thesis.skillDepthMap[0]?.calibration).toBe(
      'Use as platform evidence - not admin positioning.',
    )
    expect(thesis.timeline?.strategyImpact).toBe(
      'Narrow toward platform leverage - not operations coverage.',
    )
    expect(thesis.timeline?.deadline).toBe('Q1-Q2 2026')
    expect(thesis.keywordCombinations[0]?.query).toBe('"platform modernization" - Kubernetes')
    expect(thesis.assumptions?.[0]?.rationale).toBe(
      'Location preference implies remote flexibility - but needs review.',
    )
    expect(thesis.searchOverrides?.constraints.locations).toEqual([
      'Tampa Bay - remote-friendly',
    ])
    expect(thesis.searchOverrides?.constraints.clearance).toBe(
      'No clearance - unless role is exceptional',
    )
    expect(thesis.searchOverrides?.constraints.remotePolicyNote).toBe(
      'Prefer remote - hybrid only near Tampa.',
    )
    expect(thesis.searchOverrides?.interviewPrefs.strongFit).toEqual([
      'Platform strategy - customer deployment',
    ])
    expect(thesis.searchOverrides?.interviewPrefs.redFlags).toEqual([
      'Cluster babysitting - no product scope',
    ])
  })

  it('normalizes generated thesis assumptions and drops malformed entries', () => {
    const identity = cloneIdentityFixture()
    const thesis = normalizeGeneratedSearchThesis(
      {
        narrative,
        competitiveMoat: 'Kubernetes delivery depth combined with product-aware platform strategy.',
        unfairAdvantages: [
          {
            combination: 'Kubernetes delivery plus product judgment',
            targetCompanyProfile: 'Platform modernization teams',
          },
        ],
        searchLanes: [
          {
            id: 'lane-modernization',
            title: 'Platform modernization',
            rationale:
              'This lane targets strategic platform migration work. It matches the candidate evidence well.',
            targetSignals: ['platform modernization'],
          },
        ],
        interviewStrategy: 'Anchor on deployment architecture tradeoffs.',
        lookFor: [],
        avoid: [],
        keywordCombinations: [],
        skillDepthMap: [{ skill: 'Kubernetes', calibration: 'Use as platform evidence.' }],
        assumptions: [
          {
            id: 'assumption-visa',
            claim: 'Candidate can work in the US without sponsorship.',
            source: 'explicit-fallback',
            rationale: 'Visa status was not specified.',
            confidence: 'low',
            overridable: true,
          },
          {
            claim: 'Remote US is acceptable outside Denver.',
            source: 'inferred',
            rationale: 'Hybrid preference only named Denver.',
            confidence: 'high',
            overridable: true,
          },
          {
            id: 'assumption-bad-source',
            claim: 'Bad source should be dropped.',
            source: 'guessed',
            confidence: 'medium',
            overridable: true,
          },
        ],
      },
      identity,
    )

    expect(thesis.assumptions).toEqual([
      {
        id: 'assumption-visa',
        claim: 'Candidate can work in the US without sponsorship.',
        source: 'explicit-fallback',
        rationale: 'Visa status was not specified.',
        confidence: 'low',
        overridable: true,
      },
      expect.objectContaining({
        claim: 'Remote US is acceptable outside Denver.',
        source: 'inferred',
        rationale: 'Hybrid preference only named Denver.',
        confidence: 'high',
        overridable: true,
      }),
    ])
    expect(thesis.assumptions?.[1]?.id).toMatch(/^sassump-/)
  })

  it('promotes legacy-only override filters into canonical thesis signals', () => {
    const identity = cloneIdentityFixture()
    const thesis = normalizeGeneratedSearchThesis(
      {
        narrative,
        competitiveMoat: 'Kubernetes delivery depth combined with product-aware platform strategy.',
        unfairAdvantages: [
          {
            combination: 'Kubernetes delivery plus product judgment',
            targetCompanyProfile: 'Platform modernization teams',
          },
        ],
        searchLanes: [
          {
            id: 'lane-modernization',
            title: 'Platform modernization',
            rationale:
              'This lane targets strategic platform migration work. It matches the candidate evidence well.',
            targetSignals: ['platform modernization'],
          },
        ],
        interviewStrategy: 'Anchor on deployment architecture tradeoffs.',
        keywordCombinations: [],
        skillDepthMap: [{ skill: 'Kubernetes', calibration: 'Use as platform evidence.' }],
        searchOverrides: {
          constraints: {},
          filters: {
            prioritize: ['', '   ', 'Platform Leverage', 'platform leverage'],
            avoid: ['pure cluster admin', 'PURE CLUSTER ADMIN', '  '],
          },
          interviewPrefs: {},
          hiddenSkillIds: [],
        },
      },
      identity,
    )

    expect(thesis.searchOverrides).not.toHaveProperty('filters')
    expect(thesis.lookFor.map(({ label, severity }) => ({ label, severity }))).toEqual([
      { label: 'Platform Leverage', severity: 'soft' },
    ])
    expect(thesis.avoid.map(({ label, severity }) => ({ label, severity }))).toEqual([
      { label: 'pure cluster admin', severity: 'soft' },
    ])
  })

  it('deduplicates legacy filters against generated thesis signals', () => {
    const identity = cloneIdentityFixture()
    const thesis = normalizeGeneratedSearchThesis(
      {
        narrative,
        competitiveMoat: 'Kubernetes delivery depth combined with product-aware platform strategy.',
        unfairAdvantages: [
          {
            combination: 'Kubernetes delivery plus product judgment',
            targetCompanyProfile: 'Platform modernization teams',
          },
        ],
        searchLanes: [
          {
            id: 'lane-modernization',
            title: 'Platform modernization',
            rationale:
              'This lane targets strategic platform migration work. It matches the candidate evidence well.',
            targetSignals: ['platform modernization'],
          },
        ],
        interviewStrategy: 'Anchor on deployment architecture tradeoffs.',
        lookFor: [{ label: 'Platform Leverage', severity: 'hard' }],
        avoid: [{ label: 'Pure Cluster Admin', severity: 'hard' }],
        keywordCombinations: [],
        skillDepthMap: [{ skill: 'Kubernetes', calibration: 'Use as platform evidence.' }],
        searchOverrides: {
          constraints: {},
          filters: {
            prioritize: ['platform leverage', 'PLATFORM LEVERAGE'],
            avoid: ['pure cluster admin', 'PURE CLUSTER ADMIN'],
          },
          interviewPrefs: {},
          hiddenSkillIds: [],
        },
      },
      identity,
    )

    expect(thesis.lookFor.map(({ label, severity }) => ({ label, severity }))).toEqual([
      { label: 'Platform Leverage', severity: 'hard' },
    ])
    expect(thesis.avoid.map(({ label, severity }) => ({ label, severity }))).toEqual([
      { label: 'Pure Cluster Admin', severity: 'hard' },
    ])
  })

  it('tolerates malformed legacy override filters and one-sided legacy filter payloads', () => {
    const basePayload = {
      narrative,
      competitiveMoat: 'Kubernetes delivery depth combined with product-aware platform strategy.',
      unfairAdvantages: [
        {
          combination: 'Kubernetes delivery plus product judgment',
          targetCompanyProfile: 'Platform modernization teams',
        },
      ],
      searchLanes: [
        {
          id: 'lane-modernization',
          title: 'Platform modernization',
          rationale:
            'This lane targets strategic platform migration work. It matches the candidate evidence well.',
          targetSignals: ['platform modernization'],
        },
      ],
      interviewStrategy: 'Anchor on deployment architecture tradeoffs.',
      lookFor: ['Platform modernization'],
      avoid: ['Pure cluster admin'],
      keywordCombinations: [],
      skillDepthMap: [{ skill: 'Kubernetes', calibration: 'Use as platform evidence.' }],
    }
    const identity = cloneIdentityFixture()

    const malformedOverrides = normalizeGeneratedSearchThesis(
      {
        ...basePayload,
        searchOverrides: 'not-a-record',
      },
      identity,
    )
    expect(malformedOverrides.lookFor.map((signal) => signal.label)).toEqual([
      'Platform modernization',
    ])
    expect(malformedOverrides.avoid.map((signal) => signal.label)).toEqual(['Pure cluster admin'])
    expect(malformedOverrides.searchOverrides).toBeUndefined()

    const malformedFilters = normalizeGeneratedSearchThesis(
      {
        ...basePayload,
        searchOverrides: {
          constraints: {
            industriesToAvoid: 'adtech',
            fundingStagesAcceptable: { stage: 'series-a' },
            remotePolicies: 'remote-only',
            employmentTypes: 123,
          },
          filters: 'not-a-record',
          interviewPrefs: {},
          hiddenSkillIds: [],
        },
      },
      identity,
    )
    expect(malformedFilters.searchOverrides?.constraints.industriesToAvoid).toEqual([])
    expect(malformedFilters.searchOverrides?.constraints.fundingStagesAcceptable).toEqual([])
    expect(malformedFilters.searchOverrides?.constraints.remotePolicies).toEqual([])
    expect(malformedFilters.searchOverrides?.constraints.employmentTypes).toEqual([])
    expect(malformedFilters.lookFor.map((signal) => signal.label)).toEqual([
      'Platform modernization',
    ])
    expect(malformedFilters.avoid.map((signal) => signal.label)).toEqual(['Pure cluster admin'])

    const prioritizeOnly = normalizeGeneratedSearchThesis(
      {
        ...basePayload,
        searchOverrides: {
          constraints: {},
          filters: { prioritize: ['Developer leverage'] },
          interviewPrefs: {},
          hiddenSkillIds: [],
        },
      },
      identity,
    )
    expect(prioritizeOnly.lookFor.map((signal) => signal.label)).toEqual([
      'Platform modernization',
      'Developer leverage',
    ])
    expect(prioritizeOnly.avoid.map((signal) => signal.label)).toEqual(['Pure cluster admin'])

    const avoidOnly = normalizeGeneratedSearchThesis(
      {
        ...basePayload,
        searchOverrides: {
          constraints: {},
          filters: { avoid: ['Crypto speculation'] },
          interviewPrefs: {},
          hiddenSkillIds: [],
        },
      },
      identity,
    )
    expect(avoidOnly.lookFor.map((signal) => signal.label)).toEqual(['Platform modernization'])
    expect(avoidOnly.avoid.map((signal) => signal.label)).toEqual([
      'Pure cluster admin',
      'Crypto speculation',
    ])
  })

  it('validates lane rationale and identity skill coverage', () => {
    const identity = cloneIdentityFixture()
    const violations = validateSearchThesis(
      {
        id: 'sthesis-short',
        createdAt: '2026-04-20T10:00:00.000Z',
        updatedAt: '2026-04-20T10:00:00.000Z',
        competitiveMoat: 'Thin.',
        unfairAdvantages: [],
        searchLanes: [
          {
            id: 'lane-1',
            title: 'Generic lane',
            rationale: 'One sentence only.',
            targetSignals: [],
          },
        ],
        lookFor: [],
        avoid: [],
        keywordCombinations: [],
        skillDepthMap: [],
        source: 'generated',
        identityVersion: 0,
        feedbackIncorporated: [],
      },
      identity,
    )

    expect(violations).toEqual(
      expect.arrayContaining([
        'competitiveMoat: too short; author at least 40 characters in the Identity page Self Model section',
        'searchLanes[0].rationale: expected prose rationale with at least 2 sentences',
        'skillDepthMap: expected at least one skill-depth entry',
        'skillDepthMap: missing identity skills: Kubernetes',
      ]),
    )
  })
})
