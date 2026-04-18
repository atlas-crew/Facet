import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  reframeBulletForVector,
  prepareJobDescription,
  analyzeJobDescription,
  parseJdAnalysisResponse,
} from '../utils/jdAnalyzer'
import type { ResumeData } from '../types'

describe('jdAnalyzer', () => {
  const mockEndpoint = 'https://api.example.com/ai'
  const mockResumeData: Partial<ResumeData> = {
    vectors: [{ id: 'v1', label: 'Vector 1', color: '#ff0000' }],
    roles: [
      {
        id: 'r1',
        company: 'C1',
        title: 'T1',
        dates: 'D1',
        vectors: {},
        bullets: [{ id: 'b1', text: 'Original text', vectors: { v1: 'include' } }]
      }
    ]
  }

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  describe('reframeBulletForVector', () => {
    it('returns reframed bullet on success', async () => {
      const mockResponse = {
        reframed: 'Rewritten text',
        reasoning: 'Strategic reason'
      }
      
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: JSON.stringify(mockResponse) } }] })
      } as Response)

      const result = await reframeBulletForVector('Original text', 'Vector 1', mockEndpoint)
      
      expect(result.reframed).toBe('Rewritten text')
      expect(result.reasoning).toBe('Strategic reason')
      expect(result.original).toBe('Original text')
    })

    it('handles proxy format with nested analysis', async () => {
      const mockResponse = {
        analysis: {
          reframed: 'Rewritten text',
          reasoning: 'Strategic reason'
        }
      }
      
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      } as Response)

      const result = await reframeBulletForVector('Original text', 'Vector 1', mockEndpoint)
      expect(result.reframed).toBe('Rewritten text')
    })

    it('throws on API error', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error'
      } as Response)

      await expect(reframeBulletForVector('Original text', 'Vector 1', mockEndpoint))
        .rejects.toThrow('AI proxy error (500)')
    })

    it('tags reframe requests with the paid AI feature id', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ reframed: 'Rewritten text', reasoning: 'Strategic reason' }) } }],
        }),
      } as Response)

      await reframeBulletForVector('Original text', 'Vector 1', mockEndpoint)

      const [, init] = vi.mocked(fetch).mock.calls[0] ?? []
      expect(JSON.parse((init as RequestInit).body as string)).toEqual(
        expect.objectContaining({
          feature: 'build.bullet-reframe',
        }),
      )
    })
  })

  describe('analyzeJobDescription', () => {
    it('calls proxy and parses response', async () => {
      const mockResult = {
        primary_vector: 'v1',
        suggested_vectors: ['v1'],
        bullet_adjustments: [],
        suggested_target_line: 'Target',
        skill_gaps: [],
        matched_keywords: ['react'],
        suggested_variables: { company: 'Acme' },
        positioning_note: 'Note',
        vector_strategy: 'Lead with vector 1.'
      }

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: JSON.stringify(mockResult) } }] })
      } as Response)

      const result = await analyzeJobDescription(
        prepareJobDescription('Job desc text'),
        mockResumeData as ResumeData,
        mockEndpoint
      )

      expect(result.primary_vector).toBe('v1')
      expect(result.suggested_vectors).toEqual(['v1'])
      expect(result.suggested_target_line).toBe('Target')
      expect(result.suggested_variables.company).toBe('Acme')
      expect(result.vector_strategy).toBe('Lead with vector 1.')
    })

    it('surfaces hosted upgrade-required failures', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 402,
        text: async () =>
          JSON.stringify({
            code: 'ai_access_denied',
            reason: 'upgrade_required',
            feature: 'build.jd-analysis',
            error: 'Upgrade to AI Pro to use this hosted AI feature.',
          }),
      } as Response)

      await expect(
        analyzeJobDescription(
          prepareJobDescription('Job desc text'),
          mockResumeData as ResumeData,
          mockEndpoint,
        ),
      ).rejects.toThrow('Upgrade to AI Pro to use this hosted AI feature.')
    })

    it('rejects malformed suggested_vectors payloads', () => {
      expect(() =>
        parseJdAnalysisResponse(
          JSON.stringify({
            primary_vector: 'v1',
            suggested_vectors: 'v1',
            bullet_adjustments: [],
            suggested_target_line: 'Target',
            skill_gaps: [],
            matched_keywords: [],
            suggested_variables: { company: 'Acme' },
          }),
        ),
      ).toThrow('Analysis response schema was invalid.')
    })
  })
})
