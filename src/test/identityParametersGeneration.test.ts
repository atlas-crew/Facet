import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cloneIdentityFixture } from './fixtures/identityFixture'
import {
  generateAwarenessFromIdentity,
  generateSearchVectorsFromIdentity,
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

    await generateSearchVectorsFromIdentity(cloneIdentityFixture(), 'https://ai.example/proxy')
    await generateAwarenessFromIdentity(cloneIdentityFixture(), 'https://ai.example/proxy')

    const vectorRequest = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body))
    const awarenessRequest = JSON.parse(String(vi.mocked(fetch).mock.calls[1]?.[1]?.body))

    expect(vectorRequest).toMatchObject({
      feature: 'research.profile-inference',
      model: 'opus',
    })
    expect(awarenessRequest).toMatchObject({
      feature: 'research.profile-inference',
      model: 'opus',
    })
  })
})
