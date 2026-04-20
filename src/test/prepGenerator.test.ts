import { beforeEach, describe, expect, it, vi } from 'vitest'
import { generateInterviewPrep } from '../utils/prepGenerator'

const { callLlmProxyMock } = vi.hoisted(() => ({
  callLlmProxyMock: vi.fn(),
}))

vi.mock('../utils/llmProxy', async () => {
  const actual =
    await vi.importActual<typeof import('../utils/llmProxy')>(
      '../utils/llmProxy',
    )
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
        timeoutMs: 240000,
        maxTokens: 8192,
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
        fallback_candidate_metrics: [
          {
            metricKey: 'aws_savings_monthly',
            metricValue: '$60K/mo',
            suggestedLabel: 'AWS Savings Monthly',
            company: 'ThreatX',
            roleTitle: 'Platform Engineer',
            bulletId: 'bullet-2',
            roleId: 'role-2',
            evidence:
              'Cut the AWS bill in half by consolidating infrastructure.',
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
    expect(systemPrompt).toContain('stackAlignment')
    expect(systemPrompt).toContain('contextGaps')
    expect(systemPrompt).toContain('categoryGuidance')
    expect(systemPrompt).toContain('conditionals')

    expect(userPrompt).toContain('Structured Identity Context')
    expect(userPrompt).toContain('Candidate Metrics From Identity')
    expect(userPrompt).toContain(
      'Additional Candidate Metrics Outside The Vector Slice',
    )
    expect(userPrompt).toContain('Existing Context Gaps')
    expect(userPrompt).toContain('Context Gap Answers')
    expect(userPrompt).toContain('Latency was spiking during peak load.')
    expect(userPrompt).toContain('"metricKey": "incidents"')
    expect(userPrompt).toContain('"metricKey": "aws_savings_monthly"')
    expect(userPrompt.match(/"metricKey": "incidents"/g)).toHaveLength(1)
    expect(
      userPrompt.match(/"metricKey": "aws_savings_monthly"/g),
    ).toHaveLength(1)
    expect(userPrompt).toContain(
      'use it as the primary source of candidate evidence',
    )
    expect(userPrompt).toContain('Target Round Type: hm-screen')
    expect(userPrompt).toContain('outside the vector slice')
    expect(userPrompt).toContain('use those exact metrics')
    expect(userPrompt).toContain('return a stackAlignment table')
    expect(userPrompt).toContain('generate 1 to 2 technical gap-framing cards')
    expect(userPrompt).toContain('tag "gap-framing"')
    expect(userPrompt).toContain('include conditionals')
    expect(userPrompt).toContain(
      'Generate dedicated opener cards for the predictable opening questions',
    )
    expect(userPrompt).toContain(
      'Always include a "Tell me about yourself" opener card',
    )
    expect(userPrompt).toContain(
      'Always include a "Why this role/company?" opener card',
    )
    expect(userPrompt).toContain('identity.departureContext')
    expect(userPrompt).toContain(
      'Prefix the affected field with [[needs-review]]',
    )
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
          {
            question: 'What is the platform team optimizing for next?',
            context: 'Shows systems thinking.',
          },
          { question: ' ', context: 'Skip empty question.' },
        ],
        numbersToKnow: {
          candidate: [
            { value: ' 38% ', label: ' Incident reduction ' },
            { value: '', label: 'Skip blank' },
          ],
          company: [{ value: '3', label: ' Core platform bets ' }],
        },
        stackAlignment: [
          {
            theirTech: 'Kubernetes',
            yourMatch: 'Operated multi-cluster platform infrastructure.',
            confidence: ' strong ',
          },
          {
            theirTech: 'Terraform',
            yourMatch: 'Built shared IaC modules for platform teams.',
            confidence: 'Adjacent',
          },
          {
            theirTech: 'Go',
            yourMatch: 'No direct production ownership yet.',
            confidence: 'gap',
          },
          {
            theirTech: ' ',
            yourMatch: 'skip invalid row',
            confidence: 'Solid',
          },
        ],
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
              {
                label: 'Problem Statement',
                text: 'Latency spiked during peak load.',
              },
              { label: 'Action', text: 'Redesigned the request pipeline.' },
              { label: 'Outcome', text: 'Reduced incidents by 38%.' },
              { label: 'Unknown', text: 'Drop this malformed label.' },
            ],
            conditionals: [
              {
                trigger: ' If they push on ownership ',
                response: ' Clarify what you led directly. ',
                tone: ' pivot ',
              },
              {
                trigger: 'Were you just reacting late?',
                response:
                  'Name the signal, the decision, and the prevention step.',
                tone: 'trap',
              },
              {
                trigger: 'If they keep pushing on certainty',
                response:
                  'Say what you knew, what you escalated, and what you would verify next.',
                tone: 'escalation',
              },
              { trigger: ' ', response: 'skip blank', tone: 'pivot' },
            ],
            metrics: [{ value: '38%', label: 'Incident reduction' }],
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
      candidate: [{ value: '38%', label: 'Incident reduction' }],
      company: [{ value: '3', label: 'Core platform bets' }],
    })
    expect(result.stackAlignment).toEqual([
      {
        theirTech: 'Kubernetes',
        yourMatch: 'Operated multi-cluster platform infrastructure.',
        confidence: 'Strong',
      },
      {
        theirTech: 'Terraform',
        yourMatch: 'Built shared IaC modules for platform teams.',
        confidence: 'Adjacent experience',
      },
      {
        theirTech: 'Go',
        yourMatch: 'No direct production ownership yet.',
        confidence: 'Gap',
      },
    ])
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
    expect(result.cards[0].keyPoints).toEqual([
      'Own the incident',
      'Close with the metric',
    ])
    expect(result.cards[0].storyBlocks).toEqual([
      { label: 'problem', text: 'Latency spiked during peak load.' },
      { label: 'solution', text: 'Redesigned the request pipeline.' },
      { label: 'result', text: 'Reduced incidents by 38%.' },
    ])
    expect(result.cards[0].conditionals).toEqual([
      {
        trigger: 'If they push on ownership',
        response: 'Clarify what you led directly.',
        tone: 'pivot',
      },
      {
        trigger: 'Were you just reacting late?',
        response: 'Name the signal, the decision, and the prevention step.',
        tone: 'trap',
      },
      {
        trigger: 'If they keep pushing on certainty',
        response:
          'Say what you knew, what you escalated, and what you would verify next.',
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
    expect(result.stackAlignment).toBeUndefined()
  })

  it('repairs malformed JSON when the model drops a closing array bracket near the end', async () => {
    callLlmProxyMock.mockResolvedValueOnce(
      '<result>\n{"deckTitle":"Acme Staff Engineer Prep","companyResearchSummary":"Acme is scaling carefully.","cards":[{"category":"opener","title":"Tell me about yourself","tags":["intro"],"script":"I build reliable systems.","keyPoints":["Lead with platform depth","Close with outcomes"}]}\n</result>',
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

    expect(result.deckTitle).toBe('Acme Staff Engineer Prep')
    expect(result.companyResearchSummary).toBe('Acme is scaling carefully.')
    expect(result.cards).toHaveLength(1)
    expect(result.cards[0]).toMatchObject({
      category: 'opener',
      title: 'Tell me about yourself',
      script: 'I build reliable systems.',
      keyPoints: ['Lead with platform depth', 'Close with outcomes'],
    })
  })

  it('adds fallback technical gap-framing cards when alignment shows gaps and the model omits them', async () => {
    callLlmProxyMock.mockResolvedValueOnce(
      JSON.stringify({
        deckTitle: 'Acme Staff Engineer Prep',
        stackAlignment: [
          {
            theirTech: 'GovCloud',
            yourMatch:
              'Shipped regulated platform migrations and audit-heavy environments.',
            confidence: 'Gap',
          },
          {
            theirTech: 'Go',
            yourMatch:
              'Led adjacent distributed systems debugging and service design work.',
            confidence: 'Adjacent experience',
          },
        ],
        cards: [
          {
            category: 'technical',
            title: 'How do you debug a flaky distributed system?',
            tags: ['debugging'],
            script: 'Start with blast radius and the most recent changes.',
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

    const gapCards = result.cards.filter((card) =>
      card.tags.includes('gap-framing'),
    )
    expect(gapCards).toHaveLength(2)
    expect(gapCards[0]).toMatchObject({
      category: 'technical',
      title: "What you know, what you don't: GovCloud",
      notes: 'I have not shipped GovCloud directly yet.',
      scriptLabel: 'Bridge This Gap',
      warning:
        'Do not imply direct GovCloud ownership. Lean on the transferable proof instead.',
      source: 'ai',
    })
    expect(gapCards[0].script).toBe(
      'I want to be direct: I have not shipped GovCloud directly yet. What transfers well is Shipped regulated platform migrations and audit-heavy environments. That is a focused ramp-up area, not a fundamental mismatch.',
    )
    expect(gapCards[0].keyPoints).toEqual(
      expect.arrayContaining([
        'Closest transferable proof: Shipped regulated platform migrations and audit-heavy environments.',
        'Close by naming the ramp-up plan you would use to get productive in GovCloud.',
      ]),
    )
    expect(gapCards[0].tags).toEqual(
      expect.arrayContaining([
        'gap-framing',
        'transferable-experience',
        'govcloud',
      ]),
    )
    expect(gapCards[1]).toMatchObject({
      category: 'technical',
      title: "What you know, what you don't: Go",
    })
    expect(gapCards[1].script).toBe(
      'I want to be direct: My experience with Go is adjacent, not end-to-end production ownership yet. What transfers well is Led adjacent distributed systems debugging and service design work. That is a depth gap I can close quickly because the underlying patterns already show up in my work.',
    )
    expect(gapCards[1].tags).toEqual(
      expect.arrayContaining(['gap-framing', 'transferable-experience', 'go']),
    )
    expect(gapCards[1].warning).toBe(
      'Do not imply direct Go ownership if your closest evidence is adjacent.',
    )
    expect(gapCards[1].keyPoints).toEqual(
      expect.arrayContaining([
        'Name the adjacent system or pattern that transfers cleanly into Go.',
      ]),
    )
  })

  it('does not add fallback gap-framing cards when stack alignment has no gaps', async () => {
    callLlmProxyMock.mockResolvedValueOnce(
      JSON.stringify({
        deckTitle: 'Acme Staff Engineer Prep',
        stackAlignment: [
          {
            theirTech: 'Kubernetes',
            yourMatch: 'Built and operated shared platform clusters.',
            confidence: 'Strong',
          },
          {
            theirTech: 'Terraform',
            yourMatch: 'Built shared modules and review guardrails.',
            confidence: 'Solid',
          },
        ],
        cards: [
          {
            category: 'technical',
            title: 'How do you debug a flaky distributed system?',
            tags: ['debugging'],
            script: 'Start with blast radius and the most recent changes.',
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

    expect(result.cards.some((card) => card.tags.includes('gap-framing'))).toBe(
      false,
    )
  })

  it('keeps AI-authored gap-framing cards but forces them into the technical group', async () => {
    callLlmProxyMock.mockResolvedValueOnce(
      JSON.stringify({
        deckTitle: 'Acme Staff Engineer Prep',
        stackAlignment: [
          {
            theirTech: 'GovCloud',
            yourMatch:
              'Shipped regulated platform migrations and audit-heavy environments.',
            confidence: 'Gap',
          },
        ],
        cards: [
          {
            category: 'behavioral',
            title: "What you know, what you don't: GovCloud",
            tags: ['gap-framing'],
            notes: 'I have not shipped GovCloud directly yet.',
            script: 'Bridge from regulated platform work.',
            warning: 'Do not pretend the gap is already closed.',
            keyPoints: ['Transferable proof from regulated environments.'],
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

    expect(result.cards).toHaveLength(1)
    expect(result.cards[0].category).toBe('technical')
    expect(result.cards[0].tags).toEqual(['gap-framing'])
  })

  it('adds a fallback gap-framing card when the AI title drifts without the canonical tag', async () => {
    callLlmProxyMock.mockResolvedValueOnce(
      JSON.stringify({
        deckTitle: 'Acme Staff Engineer Prep',
        stackAlignment: [
          {
            theirTech: 'GovCloud',
            yourMatch:
              'Shipped regulated platform migrations and audit-heavy environments.',
            confidence: 'Gap',
          },
        ],
        cards: [
          {
            category: 'behavioral',
            title: 'What you know, what you don’t: GovCloud',
            tags: ['transferable-experience'],
            notes: 'I have not shipped GovCloud directly yet.',
            script: 'Bridge from regulated platform work.',
            warning: 'Do not pretend the gap is already closed.',
            keyPoints: ['Transferable proof from regulated environments.'],
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

    expect(result.cards).toHaveLength(2)
    expect(
      result.cards.filter((card) => card.tags.includes('gap-framing')),
    ).toHaveLength(1)
  })

  it('canonicalizes case-variant gap-framing tags on AI-authored cards', async () => {
    callLlmProxyMock.mockResolvedValueOnce(
      JSON.stringify({
        deckTitle: 'Acme Staff Engineer Prep',
        stackAlignment: [
          {
            theirTech: 'GovCloud',
            yourMatch:
              'Shipped regulated platform migrations and audit-heavy environments.',
            confidence: 'Gap',
          },
        ],
        cards: [
          {
            category: 'behavioral',
            title: 'Gap framing',
            tags: ['Gap-Framing', 'transferable-experience'],
            notes: 'I have not shipped GovCloud directly yet.',
            script: 'Bridge from regulated platform work.',
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

    expect(result.cards).toHaveLength(1)
    expect(result.cards[0].category).toBe('technical')
    expect(
      result.cards[0].tags.filter((tag) => tag === 'gap-framing'),
    ).toHaveLength(1)
    expect(result.cards[0].tags).toEqual([
      'transferable-experience',
      'gap-framing',
    ])
  })

  it('deduplicates stack alignment rows by tech before gap-framing fallback generation', async () => {
    callLlmProxyMock.mockResolvedValueOnce(
      JSON.stringify({
        deckTitle: 'Acme Staff Engineer Prep',
        stackAlignment: [
          {
            theirTech: 'Kubernetes',
            yourMatch: 'Ran platform clusters.',
            confidence: 'Gap',
          },
          {
            theirTech: 'kubernetes',
            yourMatch: 'Built cluster tooling.',
            confidence: 'Adjacent experience',
          },
        ],
        cards: [],
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

    expect(result.stackAlignment).toEqual([
      {
        theirTech: 'Kubernetes',
        yourMatch: 'Ran platform clusters.',
        confidence: 'Gap',
      },
    ])
    expect(
      result.cards.filter((card) => card.tags.includes('gap-framing')),
    ).toHaveLength(1)
  })
})
