import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SearchFeedbackEvent } from '../types/search'
import {
  buildThesisGenerationPrompt,
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
      userCorrections: 'Steer away from Kubernetes admin framing — emphasize platform leverage.',
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
        maxTokens: 32000,
        thinkingBudget: 10000,
        timeoutMs: 90000,
      }),
    )
    const systemPrompt = mockCallLlmProxy.mock.calls[0]?.[1]
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

  it('validates narrative, lane rationale, and identity skill coverage', () => {
    const identity = cloneIdentityFixture()
    const violations = validateSearchThesis(
      {
        id: 'sthesis-short',
        createdAt: '2026-04-20T10:00:00.000Z',
        updatedAt: '2026-04-20T10:00:00.000Z',
        narrative: 'Too short.',
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
        interviewStrategy: '',
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
        'narrative: expected 3-5 paragraphs with at least 240 characters',
        'competitiveMoat: missing or too short',
        'searchLanes[0].rationale: expected prose rationale with at least 2 sentences',
        'skillDepthMap: expected at least one skill-depth entry',
        'skillDepthMap: missing identity skills: Kubernetes',
      ]),
    )
  })
})
