import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultResumeData } from '../store/defaultData'
import {
  buildInferencePrompt,
  inferSearchProfile,
  JsonExtractionError,
  normalizeInferredProfile,
} from '../utils/searchProfileInference'

describe('searchProfileInference', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('builds a prompt from core resume sections', () => {
    const prompt = buildInferencePrompt(defaultResumeData)

    expect(prompt).toContain('"vectors"')
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
        vectors: [
          {
            vectorId: 'backend',
            priority: 1,
            description: 'Core backend roles',
            targetRoleTitles: ['Staff Engineer'],
            searchKeywords: ['distributed systems'],
          },
          {
            vectorId: 'unknown-vector',
            priority: 2,
            description: 'Should be discarded',
            targetRoleTitles: ['Unknown'],
            searchKeywords: ['unknown'],
          },
        ],
        workSummary: [
          { title: 'Recent scope', summary: 'Led platform and backend initiatives.' },
          '',
        ],
        openQuestions: ['Remote preference?', '', 'Willing to travel?'],
      },
      defaultResumeData,
    )

    expect(normalized.skills).toHaveLength(1)
    expect(normalized.skills[0]?.id).toMatch(/^skl-/)
    expect(normalized.skills[0]?.name).toBe('TypeScript')

    expect(normalized.vectors).toHaveLength(1)
    expect(normalized.vectors[0]?.vectorId).toBe('backend')

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
        vectors: [
          {
            vectorId: 'backend',
            priority: 'not-a-number',
            description: 'Fallback priority',
            targetRoleTitles: 'not-an-array',
            searchKeywords: null,
          },
        ],
        workSummary: ['Led platform migrations'],
        openQuestions: null,
      },
      defaultResumeData,
    )

    expect(normalized.skills[0]?.category).toBe('other')
    expect(normalized.vectors[0]?.priority).toBe(1)
    expect(normalized.vectors[0]?.targetRoleTitles).toEqual([])
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
                vectors: [{ vectorId: 'backend', priority: 1, description: 'Core roles', targetRoleTitles: [], searchKeywords: [] }],
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
    expect(inferred.vectors[0]?.vectorId).toBe('backend')
    expect(inferred.openQuestions).toEqual(['Open to hybrid?'])

    const [, init] = vi.mocked(fetch).mock.calls[0] ?? []
    expect(JSON.parse((init as RequestInit).body as string)).toEqual(
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
})
