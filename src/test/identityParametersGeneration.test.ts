import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cloneIdentityFixture } from './fixtures/identityFixture'
import {
  generateAwarenessFromIdentity,
  generateIdentityProfilesFromIdentity,
  generateIdentityThesisFromIdentity,
  generateSearchVectorsFromIdentity,
  generateSelfKnowledgeFromIdentity,
  generateStrategicPositioningFromIdentity,
  normalizeAnswerPatch,
  proposeAnswerPatch,
} from '../utils/identityParametersGeneration'
import { JsonExtractionError } from '../utils/llmProxy'
import { RESEARCH_PROFILE_INFERENCE_TIMEOUT_MS } from '../utils/researchProfileInferenceConfig'
import { importProfessionalIdentity } from '../identity/schema'

describe('identityParametersGeneration', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('repairs minor JSON issues when generating search vectors', async () => {
    const malformedVectorJson = [
      '```json',
      '{',
      '  "search_vectors": [',
      '    {',
      '      "title": "Platform leadership",',
      '      "priority": "high",',
      '      "thesis": "Target staff-plus platform roles",',
      '      "target_roles": ["Staff Platform Engineer" "Principal Platform Engineer"],',
      '      "keywords": {',
      '        "primary": ["platform strategy"],',
      '        "secondary": ["developer experience"]',
      '      },',
      '      "evidence": ["Repeated platform modernization work"]',
      '    }',
      '  ]',
      '}',
      '```',
    ].join('\n')

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: malformedVectorJson,
            },
          },
        ],
      }),
    } as Response)

    const vectors = await generateSearchVectorsFromIdentity(
      cloneIdentityFixture(),
      'https://ai.example/proxy',
    )

    expect(vectors).toHaveLength(1)
    expect(vectors[0]?.title).toBe('Platform leadership')
    expect(vectors[0]?.target_roles).toEqual([
      'Staff Platform Engineer',
      'Principal Platform Engineer',
    ])
    expect(vectors[0]?.needs_review).toBe(true)
  })

  it('surfaces a clear error for unrecoverable vector responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'search vectors coming soon' } }],
      }),
    } as Response)

    await expect(
      generateSearchVectorsFromIdentity(cloneIdentityFixture(), 'https://ai.example/proxy'),
    ).rejects.toThrow('Generated search vectors response: Could not find JSON block in AI response')
  })

  it('preserves extraction errors for missing awareness JSON blocks', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'nothing structured here' } }],
      }),
    } as Response)

    await expect(
      generateAwarenessFromIdentity(cloneIdentityFixture(), 'https://ai.example/proxy'),
    ).rejects.toBeInstanceOf(JsonExtractionError)
  })

  it('uses the expanded profile inference timeout budget for search-angle generation', async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"search_vectors":[]}' } }],
      }),
    } as Response)

    await generateSearchVectorsFromIdentity(cloneIdentityFixture(), 'https://ai.example/proxy')

    expect(setTimeoutSpy).toHaveBeenCalledWith(
      expect.any(Function),
      RESEARCH_PROFILE_INFERENCE_TIMEOUT_MS,
    )
    setTimeoutSpy.mockRestore()
  })

  it('uses the expanded profile inference timeout budget for profile generation', async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"profiles":[]}' } }],
      }),
    } as Response)

    await generateIdentityProfilesFromIdentity(cloneIdentityFixture(), 'https://ai.example/proxy')

    expect(setTimeoutSpy).toHaveBeenCalledWith(
      expect.any(Function),
      RESEARCH_PROFILE_INFERENCE_TIMEOUT_MS,
    )
    setTimeoutSpy.mockRestore()
  })

  it('normalizes generated profile lenses and strips voice tells', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                profiles: [
                  {
                    id: 'Platform Strategy',
                    tags: ['Platform Strategy', 'Product Judgment'],
                    text: 'Turns platform constraints — into market access.',
                  },
                  {
                    id: 'Platform Strategy',
                    tags: ['Developer Experience'],
                    text: 'Makes internal platforms easier to adopt.',
                  },
                ],
              }),
            },
          },
        ],
      }),
    } as Response)

    const profiles = await generateIdentityProfilesFromIdentity(
      cloneIdentityFixture(),
      'https://ai.example/proxy',
    )

    expect(profiles).toEqual([
      {
        id: 'platform-strategy',
        tags: ['platform-strategy', 'product-judgment'],
        text: 'Turns platform constraints, into market access.',
      },
      {
        id: 'platform-strategy-2',
        tags: ['developer-experience'],
        text: 'Makes internal platforms easier to adopt.',
      },
    ])
  })

  it('creates fallback profile ids and drops invalid generated profile entries', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                profiles: [
                  {
                    text: 'Frames deployment architecture as product access.',
                  },
                  null,
                  'invalid profile',
                  {
                    id: 'missing-text',
                    tags: ['ignored'],
                  },
                  {
                    title: 'Security Platform',
                    tags: ['Security Platform'],
                    text: 'Connects security constraints to platform adoption.',
                  },
                ],
              }),
            },
          },
        ],
      }),
    } as Response)

    const profiles = await generateIdentityProfilesFromIdentity(
      cloneIdentityFixture(),
      'https://ai.example/proxy',
    )

    expect(profiles).toEqual([
      {
        id: 'profile-1',
        tags: [],
        text: 'Frames deployment architecture as product access.',
      },
      {
        id: 'security-platform',
        tags: ['security-platform'],
        text: 'Connects security constraints to platform adoption.',
      },
    ])
  })

  it('preserves extraction errors for missing profile JSON blocks', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Here are profile lenses in prose.' } }],
      }),
    } as Response)

    await expect(
      generateIdentityProfilesFromIdentity(cloneIdentityFixture(), 'https://ai.example/proxy'),
    ).rejects.toBeInstanceOf(JsonExtractionError)
  })

  it('wraps non-extraction profile parsing errors', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '```json\n[]\n```' } }],
      }),
    } as Response)

    await expect(
      generateIdentityProfilesFromIdentity(cloneIdentityFixture(), 'https://ai.example/proxy'),
    ).rejects.toThrow('Generated profiles response must be a JSON object.')
  })

  it('normalizes a combined strategic positioning response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                competitive_moat: ' Platform plus product strategy ',
                unfair_advantages: [
                  ' Product judgment ',
                  '',
                  'Platform infrastructure depth plus product judgment',
                  'Product-aware platform infrastructure depth',
                  'Deployment architecture',
                ],
                search_vectors: [
                  {
                    title: 'Platform Strategy',
                    priority: 'high',
                    thesis: 'Lead platform strategy roles.',
                    target_roles: ['Staff Platform Engineer'],
                    keywords: {
                      primary: ['platform strategy'],
                      secondary: ['kubernetes'],
                    },
                  },
                ],
                open_questions: [
                  {
                    topic: 'Customer scope',
                    description: 'Clarify customer deployment constraints.',
                    action: 'Add one sourced example.',
                    severity: 'low',
                  },
                ],
              }),
            },
          },
        ],
      }),
    } as Response)

    const strategy = await generateStrategicPositioningFromIdentity(
      cloneIdentityFixture(),
      'https://ai.example/proxy',
    )

    expect(strategy.competitive_moat).toBe('Platform plus product strategy')
    expect(strategy.unfair_advantages).toEqual([
      'Product judgment',
      'Platform infrastructure depth plus product judgment',
      'Deployment architecture',
    ])
    expect(strategy.search_vectors).toHaveLength(1)
    expect(strategy.search_vectors[0]).toMatchObject({
      title: 'Platform Strategy',
      priority: 'high',
      needs_review: true,
    })
    expect(strategy.open_questions).toHaveLength(1)
    expect(strategy.open_questions[0]).toMatchObject({
      topic: 'Customer scope',
      severity: 'low',
      needs_review: true,
    })
  })

  it('normalizes nested awareness questions in a combined strategy response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                search_vectors: [],
                awareness: {
                  open_questions: [
                    {
                      topic: 'Nested customer proof',
                      description: 'Clarify the strongest customer proof.',
                      action: 'Add one adoption example.',
                    },
                  ],
                },
              }),
            },
          },
        ],
      }),
    } as Response)

    const strategy = await generateStrategicPositioningFromIdentity(
      cloneIdentityFixture(),
      'https://ai.example/proxy',
    )

    expect(strategy.open_questions).toHaveLength(1)
    expect(strategy.open_questions[0]).toMatchObject({
      topic: 'Nested customer proof',
      needs_review: true,
    })
  })

  it('preserves extraction errors for missing strategy JSON blocks', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Here is the strategy you requested.' } }],
      }),
    } as Response)

    await expect(
      generateStrategicPositioningFromIdentity(cloneIdentityFixture(), 'https://ai.example/proxy'),
    ).rejects.toBeInstanceOf(JsonExtractionError)
  })

  it('normalizes generated identity thesis text and strips voice tells', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                thesis: 'Turns platform ambiguity — and delivery risk — into shipped systems.',
                title: ' Platform Systems Lead ',
                origin: 'Repeated migration work — across deployment surfaces.',
                elaboration: 'Built proof — across deployment surfaces.',
              }),
            },
          },
        ],
      }),
    } as Response)

    const thesis = await generateIdentityThesisFromIdentity(
      cloneIdentityFixture(),
      'https://ai.example/proxy',
    )

    expect(thesis).toEqual({
      thesis: 'Turns platform ambiguity, and delivery risk, into shipped systems.',
      title: 'Platform Systems Lead',
      origin: 'Repeated migration work, across deployment surfaces.',
      elaboration: 'Built proof, across deployment surfaces.',
    })
  })

  it('rejects generated identity thesis responses without a thesis', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"title":"Platform Systems Lead"}' } }],
      }),
    } as Response)

    await expect(
      generateIdentityThesisFromIdentity(cloneIdentityFixture(), 'https://ai.example/proxy'),
    ).rejects.toThrow('Generated thesis response must include thesis.')
  })

  it('preserves extraction errors for missing identity thesis JSON blocks', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Here is your thesis in plain English.' } }],
      }),
    } as Response)

    await expect(
      generateIdentityThesisFromIdentity(cloneIdentityFixture(), 'https://ai.example/proxy'),
    ).rejects.toBeInstanceOf(JsonExtractionError)
  })

  it('normalizes generated self-knowledge and strips voice tells', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                philosophy: [
                  {
                    id: ' platform-judgment ',
                    text: 'Favor platform moves \u2014 only when they unlock product access.',
                    tags: [' platform \u2014 product ', ''],
                  },
                  {
                    id: 'platform-product',
                    text: 'Favor platform moves only when they unlock product access.',
                    tags: ['product'],
                  },
                  { text: '' },
                ],
                interview_style: {
                  strengths: [' Turns ambiguity — into execution '],
                  weaknesses: [' Can over-index — on systems depth '],
                  prep_strategy: 'Anchor answers in proof — then explain tradeoffs.',
                },
              }),
            },
          },
        ],
      }),
    } as Response)

    const selfKnowledge = await generateSelfKnowledgeFromIdentity(
      cloneIdentityFixture(),
      'https://ai.example/proxy',
    )

    expect(selfKnowledge.philosophy).toEqual([
      {
        id: 'platform-judgment',
        text: 'Favor platform moves, only when they unlock product access.',
        tags: ['platform, product', 'product'],
      },
    ])
    expect(selfKnowledge.interview_style).toEqual({
      strengths: ['Turns ambiguity, into execution'],
      weaknesses: ['Can over-index, on systems depth'],
      prep_strategy: 'Anchor answers in proof, then explain tradeoffs.',
    })
  })

  it('dedupes generated philosophy entries that repeat the same position', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                philosophy: [
                  {
                    id: 'platform-judgment',
                    text: 'Favor platform moves when they unlock product access.',
                    tags: ['platform'],
                  },
                  {
                    id: 'platform-product',
                    text: 'Favor platform moves only when they unlock access for product teams.',
                    tags: ['product'],
                  },
                  {
                    id: 'market-access',
                    text: 'Treat deployment architecture as market access.',
                    tags: ['deployment'],
                  },
                ],
                interview_style: {
                  strengths: [],
                  weaknesses: [],
                  prep_strategy: '',
                },
              }),
            },
          },
        ],
      }),
    } as Response)

    const selfKnowledge = await generateSelfKnowledgeFromIdentity(
      cloneIdentityFixture(),
      'https://ai.example/proxy',
    )

    expect(selfKnowledge.philosophy).toEqual([
      {
        id: 'platform-product',
        text: 'Favor platform moves only when they unlock access for product teams.',
        tags: ['platform', 'product'],
      },
      {
        id: 'market-access',
        text: 'Treat deployment architecture as market access.',
        tags: ['deployment'],
      },
    ])
  })

  it('keeps the strongest generated philosophy entry across duplicate clusters', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                philosophy: [
                  {
                    id: 'platform-product',
                    text: 'Favor platform moves only when they unlock access for product teams.',
                    tags: ['product'],
                  },
                  {
                    id: 'platform-judgment',
                    text: 'Favor platform moves when they unlock product access.',
                    tags: ['platform'],
                  },
                  {
                    id: 'platform-access',
                    text: 'Favor platform moves when product teams get access.',
                    tags: ['access'],
                  },
                ],
                interview_style: {
                  strengths: [],
                  weaknesses: [],
                  prep_strategy: '',
                },
              }),
            },
          },
        ],
      }),
    } as Response)

    const selfKnowledge = await generateSelfKnowledgeFromIdentity(
      cloneIdentityFixture(),
      'https://ai.example/proxy',
    )

    expect(selfKnowledge.philosophy).toEqual([
      {
        id: 'platform-product',
        text: 'Favor platform moves only when they unlock access for product teams.',
        tags: ['product', 'platform', 'access'],
      },
    ])
  })

  it('returns an empty generated philosophy list when all entries are invalid', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                philosophy: [{ text: '' }, null],
                interview_style: {
                  strengths: ['Uses evidence carefully.'],
                  weaknesses: [],
                  prep_strategy: 'Anchor claims in proof.',
                },
              }),
            },
          },
        ],
      }),
    } as Response)

    const selfKnowledge = await generateSelfKnowledgeFromIdentity(
      cloneIdentityFixture(),
      'https://ai.example/proxy',
    )

    expect(selfKnowledge.philosophy).toEqual([])
    expect(selfKnowledge.interview_style).toEqual({
      strengths: ['Uses evidence carefully.'],
      weaknesses: [],
      prep_strategy: 'Anchor claims in proof.',
    })
  })

  it('creates fallback ids for generated philosophy entries without stable ids', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                philosophy: [
                  {
                    text: 'Make platform work legible to product and customer constraints.',
                    tags: ['platform'],
                  },
                  {
                    id: '   ',
                    text: 'Treat deployment architecture as market access.',
                    tags: ['deployment'],
                  },
                ],
                interview_style: {
                  strengths: [],
                  weaknesses: [],
                  prep_strategy: '',
                },
              }),
            },
          },
        ],
      }),
    } as Response)

    const selfKnowledge = await generateSelfKnowledgeFromIdentity(
      cloneIdentityFixture(),
      'https://ai.example/proxy',
    )

    expect(selfKnowledge.philosophy).toHaveLength(2)
    expect(selfKnowledge.philosophy[0]?.id).toMatch(/^phil-/)
    expect(selfKnowledge.philosophy[1]?.id).toMatch(/^phil-/)
  })

  it('preserves extraction errors for missing self-knowledge JSON blocks', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Here is your self knowledge in prose.' } }],
      }),
    } as Response)

    await expect(
      generateSelfKnowledgeFromIdentity(cloneIdentityFixture(), 'https://ai.example/proxy'),
    ).rejects.toBeInstanceOf(JsonExtractionError)
  })

  it('requests Opus for identity strategy inference', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"search_vectors":[]}' } }],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"open_questions":[]}' } }],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"search_vectors":[],"open_questions":[]}' } }],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"thesis":"Leads durable platform delivery."}' } }],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            { message: { content: '{"philosophy":[],"interview_style":{"prep_strategy":""}}' } },
          ],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"profiles":[]}' } }],
        }),
      } as Response)

    await generateSearchVectorsFromIdentity(cloneIdentityFixture(), 'https://ai.example/proxy')
    await generateAwarenessFromIdentity(cloneIdentityFixture(), 'https://ai.example/proxy')
    await generateStrategicPositioningFromIdentity(cloneIdentityFixture(), 'https://ai.example/proxy')
    await generateIdentityThesisFromIdentity(cloneIdentityFixture(), 'https://ai.example/proxy')
    await generateSelfKnowledgeFromIdentity(cloneIdentityFixture(), 'https://ai.example/proxy')
    await generateIdentityProfilesFromIdentity(cloneIdentityFixture(), 'https://ai.example/proxy')

    const vectorRequest = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body))
    const awarenessRequest = JSON.parse(String(vi.mocked(fetch).mock.calls[1]?.[1]?.body))
    const strategyRequest = JSON.parse(String(vi.mocked(fetch).mock.calls[2]?.[1]?.body))
    const thesisRequest = JSON.parse(String(vi.mocked(fetch).mock.calls[3]?.[1]?.body))
    const selfKnowledgeRequest = JSON.parse(String(vi.mocked(fetch).mock.calls[4]?.[1]?.body))
    const profileRequest = JSON.parse(String(vi.mocked(fetch).mock.calls[5]?.[1]?.body))

    expect(vectorRequest).toMatchObject({
      feature: 'research.profile-inference',
      model: 'opus',
    })
    expect(awarenessRequest).toMatchObject({
      feature: 'research.profile-inference',
      model: 'opus',
    })
    expect(strategyRequest).toMatchObject({
      feature: 'research.profile-inference',
      model: 'opus',
    })
    expect(thesisRequest).toMatchObject({
      feature: 'research.profile-inference',
      model: 'opus',
    })
    expect(selfKnowledgeRequest).toMatchObject({
      feature: 'research.profile-inference',
      model: 'opus',
    })
    expect(profileRequest).toMatchObject({
      feature: 'research.profile-inference',
      model: 'opus',
    })
  })

  describe('normalizeAnswerPatch', () => {
    it('normalizes a well-formed role-bullet patch', () => {
      const identity = cloneIdentityFixture()
      const payload = {
        kind: 'role-bullet',
        roleId: 'contoso',
        bullet: {
          problem: 'Deploys were flaky.',
          action: 'Automated the pipeline.',
          outcome: 'Deploys became reliable.',
          impact: ['Reduced incidents by half'],
          technologies: ['GitHub Actions'],
          tags: ['reliability'],
        },
      }
      const patch = normalizeAnswerPatch(payload, identity)
      expect(patch.kind).toBe('role-bullet')
      if (patch.kind !== 'role-bullet') return
      expect(patch.roleId).toBe('contoso')
      expect(patch.bullet.problem).toBe('Deploys were flaky.')
      expect(patch.bullet.action).toBe('Automated the pipeline.')
      expect(patch.bullet.outcome).toBe('Deploys became reliable.')
      expect(patch.bullet.impact).toEqual(['Reduced incidents by half'])
      expect(patch.bullet.technologies).toEqual(['GitHub Actions'])
      expect(patch.bullet.tags).toEqual(['reliability'])
    })

    it('normalizes a well-formed skill patch', () => {
      const identity = cloneIdentityFixture()
      const patch = normalizeAnswerPatch(
        { kind: 'skill', groupId: 'platform', skillName: 'Helm' },
        identity,
      )
      expect(patch).toEqual({ kind: 'skill', groupId: 'platform', skillName: 'Helm' })
    })

    it('normalizes a well-formed self-model-arc patch', () => {
      const identity = cloneIdentityFixture()
      const patch = normalizeAnswerPatch(
        { kind: 'self-model-arc', entry: { company: 'Contoso', chapter: 'Platform buildout era' } },
        identity,
      )
      expect(patch).toEqual({
        kind: 'self-model-arc',
        entry: { company: 'Contoso', chapter: 'Platform buildout era' },
      })
    })

    it('normalizes a well-formed competitive-moat patch', () => {
      const identity = cloneIdentityFixture()
      const patch = normalizeAnswerPatch(
        { kind: 'competitive-moat', text: 'Security + platform overlap is rare.' },
        identity,
      )
      expect(patch).toEqual({
        kind: 'competitive-moat',
        text: 'Security + platform overlap is rare.',
      })
    })

    it('normalizes a well-formed unfair-advantage patch', () => {
      const identity = cloneIdentityFixture()
      const patch = normalizeAnswerPatch(
        { kind: 'unfair-advantage', items: ['Zero-trust implementation at startup scale'] },
        identity,
      )
      expect(patch).toEqual({
        kind: 'unfair-advantage',
        items: ['Zero-trust implementation at startup scale'],
      })
    })

    it('rejects an unknown kind', () => {
      const identity = cloneIdentityFixture()
      expect(() =>
        normalizeAnswerPatch({ kind: 'mystery-kind', foo: 'bar' }, identity),
      ).toThrow('unknown kind')
    })

    it('rejects a role-bullet with an unknown roleId', () => {
      const identity = cloneIdentityFixture()
      expect(() =>
        normalizeAnswerPatch(
          {
            kind: 'role-bullet',
            roleId: 'nonexistent-role',
            bullet: { problem: 'p', action: 'a', outcome: 'o' },
          },
          identity,
        ),
      ).toThrow('unknown roleId')
    })

    it('rejects a skill with an unknown groupId', () => {
      const identity = cloneIdentityFixture()
      expect(() =>
        normalizeAnswerPatch(
          { kind: 'skill', groupId: 'nonexistent-group', skillName: 'Rust' },
          identity,
        ),
      ).toThrow('unknown groupId')
    })

    it('does not fabricate metrics when the answer payload omits them', () => {
      const identity = cloneIdentityFixture()
      const patch = normalizeAnswerPatch(
        {
          kind: 'role-bullet',
          roleId: 'contoso',
          bullet: {
            problem: 'Cache was cold on every deploy.',
            action: 'Warmed the cache via a pre-deploy script.',
            outcome: 'Cold-start latency dropped.',
          },
        },
        identity,
      )
      expect(patch.kind).toBe('role-bullet')
      if (patch.kind !== 'role-bullet') return
      expect(patch.bullet.metrics).toBeUndefined()
    })

    it('strips non-primitive metric values and keeps only valid entries', () => {
      const identity = cloneIdentityFixture()
      const patch = normalizeAnswerPatch(
        {
          kind: 'role-bullet',
          roleId: 'contoso',
          bullet: {
            problem: 'p',
            action: 'a',
            outcome: 'o',
            metrics: { count: 5, label: 'fast', flag: true, bad: null, nested: {} },
          },
        },
        identity,
      )
      expect(patch.kind).toBe('role-bullet')
      if (patch.kind !== 'role-bullet') return
      expect(patch.bullet.metrics).toEqual({ count: 5, label: 'fast', flag: true })
    })

    it('removes em-dash voice tells from role-bullet text fields', () => {
      const identity = cloneIdentityFixture()
      const patch = normalizeAnswerPatch(
        {
          kind: 'role-bullet',
          roleId: 'contoso',
          bullet: {
            problem: 'System — fragile.',
            action: 'Rebuilt — from scratch.',
            outcome: 'Stable — now.',
          },
        },
        identity,
      )
      expect(patch.kind).toBe('role-bullet')
      if (patch.kind !== 'role-bullet') return
      expect(patch.bullet.problem).toBe('System, fragile.')
      expect(patch.bullet.action).toBe('Rebuilt, from scratch.')
      expect(patch.bullet.outcome).toBe('Stable, now.')
    })
  })

  describe('proposeAnswerPatch', () => {
    const baseQuestion = {
      id: 'oq-1',
      topic: 'Platform leadership',
      description: 'No evidence of cross-team platform ownership.',
      action: 'Describe a platform project where you led across teams.',
    }

    it('propagates JsonExtractionError from malformed JSON response', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'not json at all' } }],
        }),
      } as Response)

      await expect(
        proposeAnswerPatch(cloneIdentityFixture(), baseQuestion, 'I led a big project.', 'https://ai.example/proxy'),
      ).rejects.toBeInstanceOf(JsonExtractionError)
    })

    it('returns a normalized patch from a valid LLM response', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  kind: 'role-bullet',
                  roleId: 'contoso',
                  bullet: {
                    problem: 'No shared deploy tooling.',
                    action: 'Built a unified deploy pipeline.',
                    outcome: 'Cut deploy time for three teams.',
                    impact: ['Three teams adopted it'],
                  },
                }),
              },
            },
          ],
        }),
      } as Response)

      const patch = await proposeAnswerPatch(
        cloneIdentityFixture(),
        baseQuestion,
        'I built a deploy pipeline shared by three teams.',
        'https://ai.example/proxy',
      )

      expect(patch.kind).toBe('role-bullet')
      if (patch.kind !== 'role-bullet') return
      expect(patch.roleId).toBe('contoso')
      expect(patch.bullet.impact).toEqual(['Three teams adopted it'])
    })

    it('throws for an LLM response with an unknown roleId', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  kind: 'role-bullet',
                  roleId: 'made-up-company',
                  bullet: { problem: 'p', action: 'a', outcome: 'o' },
                }),
              },
            },
          ],
        }),
      } as Response)

      await expect(
        proposeAnswerPatch(cloneIdentityFixture(), baseQuestion, 'Some answer.', 'https://ai.example/proxy'),
      ).rejects.toThrow('unknown roleId')
    })

    it('uses the profile-inference feature flag and opus model', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  kind: 'competitive-moat',
                  text: 'Security meets platform.',
                }),
              },
            },
          ],
        }),
      } as Response)

      await proposeAnswerPatch(cloneIdentityFixture(), baseQuestion, 'I bridge security and platform.', 'https://ai.example/proxy')

      const requestBody = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body))
      expect(requestBody).toMatchObject({ feature: 'research.profile-inference', model: 'opus' })
    })
  })

  describe('parseAwareness answer/resolved round-trip', () => {
    it('parses a question with answer and resolved fields without error', () => {
      const raw = {
        version: 3,
        schema_revision: '3.1',
        model_revision: 0,
        identity: {
          name: 'Alex',
          email: 'a@example.com',
          phone: '555-0100',
          location: 'Denver, CO',
          links: [],
          thesis: 'I build platforms.',
        },
        self_model: {
          arc: [],
          philosophy: [],
          interview_style: { strengths: [], weaknesses: [], prep_strategy: '' },
        },
        preferences: {
          compensation: { priorities: [] },
          work_model: { preference: 'remote' },
          matching: { prioritize: [], avoid: [] },
        },
        skills: { groups: [] },
        profiles: [],
        roles: [],
        projects: [],
        education: [],
        generator_rules: { voice_skill: 'v', resume_skill: 'r' },
        awareness: {
          open_questions: [
            {
              id: 'oq-1',
              topic: 'Platform leadership',
              description: 'Gap.',
              action: 'Describe it.',
              answer: 'I led the migration.',
              resolved: true,
            },
          ],
        },
      }

      const { data } = importProfessionalIdentity(raw)
      const question = data.awareness?.open_questions[0]
      expect(question?.answer).toBe('I led the migration.')
      expect(question?.resolved).toBe(true)
    })

    it('omits answer and resolved when not present in the snapshot', () => {
      const raw = {
        version: 3,
        schema_revision: '3.1',
        model_revision: 0,
        identity: {
          name: 'Alex',
          email: 'a@example.com',
          phone: '555-0100',
          location: 'Denver, CO',
          links: [],
          thesis: 'I build platforms.',
        },
        self_model: {
          arc: [],
          philosophy: [],
          interview_style: { strengths: [], weaknesses: [], prep_strategy: '' },
        },
        preferences: {
          compensation: { priorities: [] },
          work_model: { preference: 'remote' },
          matching: { prioritize: [], avoid: [] },
        },
        skills: { groups: [] },
        profiles: [],
        roles: [],
        projects: [],
        education: [],
        generator_rules: { voice_skill: 'v', resume_skill: 'r' },
        awareness: {
          open_questions: [
            { id: 'oq-1', topic: 'Scope', description: 'Gap.', action: 'Fix it.' },
          ],
        },
      }

      const { data } = importProfessionalIdentity(raw)
      const question = data.awareness?.open_questions[0]
      expect(question?.answer).toBeUndefined()
      expect(question?.resolved).toBeUndefined()
    })
  })
})
