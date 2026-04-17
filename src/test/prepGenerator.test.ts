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

  it('passes structured identity context to the prompt when available', async () => {
    callLlmProxyMock.mockResolvedValueOnce(
      JSON.stringify({
        deckTitle: 'Acme Staff Engineer Prep',
        companyResearchSummary: 'Acme is scaling carefully.',
        cards: [
          {
            category: 'behavioral',
            title: 'Leadership story',
            tags: ['leadership'],
            script: 'Lead with the incident response story.',
          },
        ],
      }),
    )

    await generateInterviewPrep('https://ai.example/proxy', {
      company: 'Acme',
      role: 'Staff Engineer',
      vectorId: 'backend',
      vectorLabel: 'Backend',
      roundType: 'hm-screen',
      jobDescription: 'Build distributed systems and platform tooling.',
      identityContext: {
        candidate_metrics: [
          {
            metricKey: 'incidents',
            metricValue: '38%',
            suggestedLabel: 'Incidents',
            company: 'Acme',
            roleTitle: 'Principal Engineer',
            bulletId: 'bullet-1',
            roleId: 'role-1',
            evidence: 'Reduced incidents by 38%.',
          },
        ],
        self_model: {
          interview_style: {
            strengths: ['incident response'],
          },
        },
        roles: [
          {
            title: 'Principal Engineer',
            bullets: [
              {
                problem: 'Latency was spiking during peak load.',
                action: 'Redesigned the request pipeline.',
                outcome: 'Stabilized the service.',
              },
            ],
          },
        ],
      },
      resumeContext: {
        resume: {
          basics: { name: 'Alex Example' },
        },
      },
    })

    const [, systemPrompt, userPrompt] = callLlmProxyMock.mock.calls[0]

    expect(systemPrompt).toContain('storyBlocks')
    expect(systemPrompt).toContain('keyPoints')
    expect(systemPrompt).toContain('questionsToAsk')
    expect(systemPrompt).toContain('numbersToKnow')
    expect(systemPrompt).toContain('contextGaps')
    expect(systemPrompt).toContain('categoryGuidance')
    expect(systemPrompt).toContain('conditionals')

    expect(userPrompt).toContain('Structured Identity Context')
    expect(userPrompt).toContain('Candidate Metrics From Identity')
    expect(userPrompt).toContain('Existing Context Gaps')
    expect(userPrompt).toContain('Context Gap Answers')
    expect(userPrompt).toContain('Latency was spiking during peak load.')
    expect(userPrompt).toContain('"metricKey": "incidents"')
    expect(userPrompt.match(/"metricKey": "incidents"/g)).toHaveLength(1)
    expect(userPrompt).toContain('use it as the primary source of candidate evidence')
    expect(userPrompt).toContain('Target Round Type: hm-screen')
    expect(userPrompt).toContain('use those exact metrics')
    expect(userPrompt).toContain('include conditionals')
    expect(userPrompt).toContain('Prefix the affected field with [[needs-review]]')
  })

  it('marks structured identity context as not provided when absent', async () => {
    callLlmProxyMock.mockResolvedValueOnce(
      JSON.stringify({
        deckTitle: 'Acme Staff Engineer Prep',
        companyResearchSummary: 'Acme is scaling carefully.',
        cards: [
          {
            category: 'opener',
            title: 'Tell me about yourself',
            tags: ['intro'],
            script: 'I build reliable systems.',
          },
        ],
      }),
    )

    await generateInterviewPrep('https://ai.example/proxy', {
      company: 'Acme',
      role: 'Staff Engineer',
      vectorId: 'backend',
      vectorLabel: 'Backend',
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
      expect.stringContaining('Structured Identity Context:\nNot provided'),
      expect.any(Object),
    )
  })

  it('normalizes rich card fields and deck-level guidance from the AI response', async () => {
    callLlmProxyMock.mockResolvedValueOnce(
      JSON.stringify({
        deckTitle: 'Acme Staff Engineer Prep',
        companyResearchSummary: 'Acme is scaling carefully.',
        donts: [' Be generic ', '', 7],
        questionsToAsk: [
          { question: 'What is the platform team optimizing for next?', context: 'Shows systems thinking.' },
          { question: ' ', context: 'Skip empty question.' },
        ],
        numbersToKnow: {
          candidate: [
            { value: ' 38% ', label: ' Incident reduction ' },
            { value: '', label: 'Skip blank' },
          ],
          company: [
            { value: '3', label: ' Core platform bets ' },
          ],
        },
        categoryGuidance: {
          behavioral: 'Lead with scope and tradeoffs.',
          metrics: 'Name the number early.',
          extra: 'Ignore unsupported categories.',
        },
        contextGaps: [
          {
            id: 'gap-departure',
            section: 'Openers',
            question: 'Why did you leave your last role?',
            why: 'This answer needs candidate-authored context.',
            feedbackTarget: 'identity.departureContext',
            priority: 'required',
          },
          {
            section: 'Technical Topics',
            question: 'What scale did the rollout support?',
            why: 'The current notes do not say.',
            priority: 'optional',
          },
          {
            id: 'gap-invalid',
            section: ' ',
            question: 'skip invalid',
            why: 'missing section',
            priority: 'required',
          },
        ],
        cards: [
          {
            category: 'behavioral',
            title: 'Leadership story',
            tags: [' leadership ', 'backend'],
            script: 'Lead with the incident response story.',
            scriptLabel: ' Lead With ',
            keyPoints: ['Own the incident', ' ', null, 'Close with the metric'],
            storyBlocks: [
              { label: 'Problem Statement', text: 'Latency spiked during peak load.' },
              { label: 'Action', text: 'Redesigned the request pipeline.' },
              { label: 'Outcome', text: 'Reduced incidents by 38%.' },
              { label: 'Unknown', text: 'Drop this malformed label.' },
            ],
            conditionals: [
              { trigger: ' If they push on ownership ', response: ' Clarify what you led directly. ', tone: ' pivot ' },
              { trigger: 'Were you just reacting late?', response: 'Name the signal, the decision, and the prevention step.', tone: 'trap' },
              { trigger: 'If they keep pushing on certainty', response: 'Say what you knew, what you escalated, and what you would verify next.', tone: 'escalation' },
              { trigger: ' ', response: 'skip blank', tone: 'pivot' },
            ],
            metrics: [
              { value: '38%', label: 'Incident reduction' },
            ],
          },
        ],
      }),
    )

    const result = await generateInterviewPrep('https://ai.example/proxy', {
      company: 'Acme',
      role: 'Staff Engineer',
      vectorId: 'backend',
      vectorLabel: 'Backend',
      jobDescription: 'Build distributed systems and platform tooling.',
      resumeContext: {
        resume: {
          basics: { name: 'Alex Example' },
        },
      },
    })

    expect(result.donts).toEqual(['Be generic'])
    expect(result.questionsToAsk).toEqual([
      {
        question: 'What is the platform team optimizing for next?',
        context: 'Shows systems thinking.',
      },
    ])
    expect(result.numbersToKnow).toEqual({
      candidate: [
        { value: '38%', label: 'Incident reduction' },
      ],
      company: [
        { value: '3', label: 'Core platform bets' },
      ],
    })
    expect(result.categoryGuidance).toEqual({
      behavioral: 'Lead with scope and tradeoffs.',
      metrics: 'Name the number early.',
    })
    expect(result.contextGaps).toEqual([
      {
        id: 'gap-departure',
        section: 'Openers',
        question: 'Why did you leave your last role?',
        why: 'This answer needs candidate-authored context.',
        feedbackTarget: 'identity.departureContext',
        priority: 'required',
      },
      expect.objectContaining({
        id: expect.stringMatching(/^prep-gap-/),
        section: 'Technical Topics',
        question: 'What scale did the rollout support?',
        why: 'The current notes do not say.',
        priority: 'optional',
      }),
    ])
    expect(result.cards[0].scriptLabel).toBe('Lead With')
    expect(result.cards[0].keyPoints).toEqual(['Own the incident', 'Close with the metric'])
    expect(result.cards[0].storyBlocks).toEqual([
      { label: 'problem', text: 'Latency spiked during peak load.' },
      { label: 'solution', text: 'Redesigned the request pipeline.' },
      { label: 'result', text: 'Reduced incidents by 38%.' },
    ])
    expect(result.cards[0].conditionals).toEqual([
      { trigger: 'If they push on ownership', response: 'Clarify what you led directly.', tone: 'pivot' },
      { trigger: 'Were you just reacting late?', response: 'Name the signal, the decision, and the prevention step.', tone: 'trap' },
      {
        trigger: 'If they keep pushing on certainty',
        response: 'Say what you knew, what you escalated, and what you would verify next.',
        tone: 'escalation',
      },
    ])
  })

  it('allows company research summary to be omitted', async () => {
    callLlmProxyMock.mockResolvedValueOnce(
      JSON.stringify({
        deckTitle: 'Acme Staff Engineer Prep',
        cards: [
          {
            category: 'opener',
            title: 'Tell me about yourself',
            tags: ['intro'],
            script: 'I build reliable systems.',
          },
        ],
      }),
    )

    const result = await generateInterviewPrep('https://ai.example/proxy', {
      company: 'Acme',
      role: 'Staff Engineer',
      vectorId: 'backend',
      vectorLabel: 'Backend',
      jobDescription: 'Build distributed systems and platform tooling.',
      resumeContext: {
        resume: {
          basics: { name: 'Alex Example' },
        },
      },
    })

    expect(result.companyResearchSummary).toBe('')
    expect(result.numbersToKnow).toBeUndefined()
  })
})
