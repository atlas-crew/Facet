import { describe, expect, it, vi, beforeEach } from 'vitest'
import { reframeBulletForVector, prepareJobDescription, analyzeJobDescription } from '../utils/jdAnalyzer'
import type { ResumeData } from '../types'

describe('jdAnalyzer', () => {
  const mockEndpoint = 'https://api.example.com/ai'
  const mockResumeData: Partial<ResumeData> = {
    vectors: [{ id: 'v1', label: 'Vector 1', color: '#ff0000' }],
    roles: [
      {
        id: 'r1',
        company: 'Company',
        title: 'Title',
        dates: '2020',
        bullets: [{ id: 'b1', text: 'Original text', vectors: { v1: 'must' } }]
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
        json: async () => ({ content: [{ type: 'text', text: JSON.stringify(mockResponse) }] })
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
        .rejects.toThrow('Anthropic API error (500)')
    })
  })

  describe('analyzeJobDescription', () => {
    it('calls proxy and parses response', async () => {
      const mockResult = {
        primary_vector: 'v1',
        bullet_adjustments: [],
        suggested_target_line: 'Target',
        skill_gaps: [],
        positioning_note: 'Note'
      }

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockResult
      } as Response)

      const result = await analyzeJobDescription(
        prepareJobDescription('Job desc text'),
        mockResumeData as ResumeData,
        mockEndpoint
      )

      expect(result.primary_vector).toBe('v1')
      expect(result.suggested_target_line).toBe('Target')
    })
  })
})
