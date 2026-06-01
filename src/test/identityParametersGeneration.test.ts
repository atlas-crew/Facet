import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cloneIdentityFixture } from './fixtures/identityFixture'
import {
  generateAwarenessFromIdentity,
  generateIdentityThesisFromIdentity,
  generateSearchVectorsFromIdentity,
  generateStrategicPositioningFromIdentity,
} from '../utils/identityParametersGeneration'
import { JsonExtractionError } from '../utils/llmProxy'
import { RESEARCH_PROFILE_INFERENCE_TIMEOUT_MS } from '../utils/researchProfileInferenceConfig'

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

  it('normalizes a combined strategic positioning response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                competitive_moat: ' Platform plus product strategy ',
                unfair_advantages: [' Product judgment ', '', 'Deployment architecture'],
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
    expect(strategy.unfair_advantages).toEqual(['Product judgment', 'Deployment architecture'])
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
                elaboration: '',
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

    await generateSearchVectorsFromIdentity(cloneIdentityFixture(), 'https://ai.example/proxy')
    await generateAwarenessFromIdentity(cloneIdentityFixture(), 'https://ai.example/proxy')
    await generateStrategicPositioningFromIdentity(cloneIdentityFixture(), 'https://ai.example/proxy')
    await generateIdentityThesisFromIdentity(cloneIdentityFixture(), 'https://ai.example/proxy')

    const vectorRequest = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body))
    const awarenessRequest = JSON.parse(String(vi.mocked(fetch).mock.calls[1]?.[1]?.body))
    const strategyRequest = JSON.parse(String(vi.mocked(fetch).mock.calls[2]?.[1]?.body))
    const thesisRequest = JSON.parse(String(vi.mocked(fetch).mock.calls[3]?.[1]?.body))

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
  })
})
