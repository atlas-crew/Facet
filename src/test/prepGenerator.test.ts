import { beforeEach, describe, expect, it, vi } from 'vitest'
import { generateInterviewPrep } from '../utils/prepGenerator'

const { callLlmProxyMock } = vi.hoisted(() => ({
  callLlmProxyMock: vi.fn(),
}))

vi.mock('../utils/llmProxy', async () => {
  const actual = await vi.importActual<typeof import('../utils/llmProxy')>('../utils/llmProxy')
  return {
    ...actual,
    callLlmProxy: callLlmProxyMock,
  }
})

describe('generateInterviewPrep', () => {
  beforeEach(() => {
    callLlmProxyMock.mockReset()
  })

  it('uses an extended timeout for larger interview prep payloads', async () => {
    callLlmProxyMock.mockResolvedValueOnce(
      JSON.stringify({
        deckTitle: 'Acme Staff Engineer Prep',
        companyResearchSummary: 'Acme is scaling carefully.',
        cards: [
          {
            category: 'opener',
            title: 'Tell me about yourself',
            tags: ['backend'],
            script: 'I build resilient backend systems.',
          },
        ],
      }),
    )

    await generateInterviewPrep('https://ai.example/proxy', {
      company: 'Acme',
      role: 'Staff Engineer',
      vectorId: 'backend',
      vectorLabel: 'Backend',
      companyUrl: 'https://acme.example/jobs/1',
      skillMatch: 'distributed systems',
      positioning: 'Lead with backend systems depth.',
      notes: 'Hiring manager cares about platform judgment.',
      companyResearch: 'Platform reliability is a priority.',
      jobDescription: 'Build distributed systems and platform tooling.',
      resumeContext: {
        resume: {
          basics: { name: 'Alex Example' },
        },
      },
    })

    expect(callLlmProxyMock).toHaveBeenCalledWith(
      'https://ai.example/proxy',
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        feature: 'prep.generate',
        model: 'sonnet',
        timeoutMs: 90000,
      }),
    )
  })
})
