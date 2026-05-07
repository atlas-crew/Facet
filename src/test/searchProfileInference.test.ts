import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultResumeData } from '../store/defaultData'
import {
  buildInferencePrompt,
  inferSearchProfile,
  JsonExtractionError,
  normalizeInferredProfile,
} from '../utils/searchProfileInference'
import { RESEARCH_PROFILE_INFERENCE_TIMEOUT_MS } from '../utils/researchProfileInferenceConfig'

describe('searchProfileInference', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('builds a prompt from core resume sections', () => {
    const resumeData = structuredClone(defaultResumeData)
    resumeData.roles[0]!.vectors = { legacy_vector_marker: 'include' }
    resumeData.roles[0]!.bullets[0]!.vectors = { legacy_bullet_vector_marker: 'include' }
    const prompt = buildInferencePrompt(resumeData)

    expect(prompt).not.toContain('"vectors"')
    expect(prompt).not.toContain('legacy_vector_marker')
    expect(prompt).not.toContain('legacy_bullet_vector_marker')
    expect(prompt).toContain('"roles"')
    expect(prompt).toContain('Jane Smith')
  })

  it('normalizes inference results and filters invalid entries', () => {
    const normalized = normalizeInferredProfile(
      {
        skills: [
          {
            name: 'TypeScript',
            category: 'backend',
            depth: 'strong',
            context: 'Used heavily in product and platform surfaces.',
          },
          {
            name: 'Mystery Skill',
            category: 'other',
            depth: 'legendary',
          },
        ],
        vectors: [{ vectorId: 'legacy-backend' }],
        workSummary: [
          { title: 'Recent scope', summary: 'Led platform and backend initiatives.' },
          '',
        ],
        openQuestions: ['Remote preference?', '', 'Willing to travel?'],
      })

    expect(normalized.skills).toHaveLength(1)
    expect(normalized.skills[0]?.id).toMatch(/^skl-/)
    expect(normalized.skills[0]?.name).toBe('TypeScript')

    expect(normalized.workSummary).toHaveLength(1)
    expect(normalized.openQuestions).toEqual(['Remote preference?', 'Willing to travel?'])
  })

  it('handles invalid categories, non-array inputs, string work summaries, and missing priorities', () => {
    const normalized = normalizeInferredProfile(
      {
        skills: [
          {
            name: 'GraphQL',
            category: 'quantum-computing',
            depth: 'working',
          },
        ],
        vectors: 'legacy-not-an-array',
        workSummary: ['Led platform migrations'],
        openQuestions: null,
      })

    expect(normalized.skills[0]?.category).toBe('other')
    expect(normalized.workSummary).toEqual([
      { title: 'Career Summary', summary: 'Led platform migrations' },
    ])
    expect(normalized.openQuestions).toEqual([])
  })

  it('runs the async inference flow and normalizes the proxy response', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                skills: [{ name: 'TypeScript', category: 'backend', depth: 'strong' }],
                vectors: [{ vectorId: 'legacy-backend' }],
                workSummary: [{ title: 'Recent scope', summary: 'Built backend systems.' }],
                openQuestions: ['Open to hybrid?'],
              }),
            },
          },
        ],
      }),
    } as Response)

    const inferred = await inferSearchProfile(defaultResumeData, 'https://ai.example/proxy')
    expect(inferred.skills).toHaveLength(1)
    expect(Object.keys(inferred)).not.toContain('vectors')
    expect(inferred.openQuestions).toEqual(['Open to hybrid?'])

    const [, init] = vi.mocked(fetch).mock.calls[0] ?? []
    const requestBody = JSON.parse((init as RequestInit).body as string) as { system?: string }
    expect(requestBody.system).not.toContain('"vectors"')
    expect(requestBody.system).not.toContain('"vectorId"')
    expect(requestBody).toEqual(
      expect.objectContaining({
        feature: 'research.profile-inference',
      }),
    )
  })

  it('rethrows extraction errors and wraps malformed JSON errors', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'not json at all' } }],
      }),
    } as Response)

    await expect(
      inferSearchProfile(defaultResumeData, 'https://ai.example/proxy'),
    ).rejects.toBeInstanceOf(JsonExtractionError)

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"skills": [}' } }],
      }),
    } as Response)

    await expect(
      inferSearchProfile(defaultResumeData, 'https://ai.example/proxy'),
    ).rejects.toThrow('Failed to parse inferred search profile.')
  })

  it('uses the expanded timeout budget for profile inference requests', async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: '{"skills":[],"vectors":[{"vectorId":"legacy"}],"workSummary":[],"openQuestions":[]}',
            },
          },
        ],
      }),
    } as Response)

    await inferSearchProfile(defaultResumeData, 'https://ai.example/proxy')

    expect(setTimeoutSpy).toHaveBeenCalledWith(
      expect.any(Function),
      RESEARCH_PROFILE_INFERENCE_TIMEOUT_MS,
    )
    setTimeoutSpy.mockRestore()
  })
})
