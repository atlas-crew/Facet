import { beforeEach, describe, expect, it, vi } from 'vitest'
import { generatePrepDeck } from '../utils/prepGenerator'

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

describe('prep contract validation', () => {
  beforeEach(() => {
    callLlmProxyMock.mockReset()
  })

  it('reports contract violations when the generated output misses required coaching and coverage', async () => {
    callLlmProxyMock.mockResolvedValueOnce(
      JSON.stringify({
        deckTitle: 'Acme Staff Engineer Prep',
        companyResearchSummary: 'Acme is scaling carefully.',
        rules: ['Lead with specifics', 'Stay concrete'],
        categoryGuidance: {
          opener: 'Lead with specifics.',
          technical: 'Stay crisp and concrete.',
        },
        stackAlignment: [
          {
            theirTech: 'Go',
            yourMatch: 'Adjacent distributed systems work.',
            confidence: 'Gap',
          },
        ],
        cards: [
          {
            category: 'opener',
            title: 'Tell me about yourself',
            tags: ['opener'],
            notes: 'Lead with the broad arc.',
            warning: 'Keep it short.',
            script: 'I build backend systems.',
          },
          {
            category: 'technical',
            title: 'What is your Go experience?',
            tags: ['gap-framing'],
            notes: 'Bridge from adjacent systems work.',
            warning: 'This is fine.',
            keyPoints: ['I can learn quickly.'],
          },
          {
            category: 'behavioral',
            title: 'Leadership story',
            tags: ['leadership'],
            notes: 'Handled hard things well.',
            warning: 'Be specific.',
            script: 'Talk about the team.',
          },
        ],
      }),
    )

    const result = await generatePrepDeck('https://ai.example/proxy', {
      company: 'Acme',
      role: 'Staff Engineer',
      vectorId: 'backend',
      vectorLabel: 'Backend',
      jobDescription: 'Build distributed systems and platform tooling.',
      companyResearch:
        'Jordan Lee, Director of Platform, and Priya Shah, Sr. Director of Engineering, are in the interview loop.',
      pipelineEntryContext: {
        company: 'Acme',
        role: 'Staff Engineer',
        tier: '1',
        status: 'interviewing',
        appMethod: 'direct-apply',
        response: 'interview-scheduled',
        formats: ['hm-screen'],
        research: {
          status: 'investigated',
          summary: 'Still mapping the team.',
          interviewSignals: [],
          people: [
            {
              name: 'Jordan Lee',
              title: 'Director of Platform',
              company: 'Acme',
              relevance: 'Likely hiring manager.',
            },
            {
              name: 'Priya Shah',
              title: 'Sr. Director of Engineering',
              company: 'Acme',
              relevance: 'Likely senior interviewer.',
            },
          ],
          sources: [],
          searchQueries: [],
        },
      },
      resumeContext: {
        resume: {
          basics: { name: 'Alex Example' },
        },
      },
    })

    expect(result.deck.cards.some((card) => card.tags.includes('landmine'))).toBe(
      true,
    )
    expect(result.contractViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'missing-field', field: 'rules' }),
        expect.objectContaining({
          kind: 'missing-coaching',
          field: 'categoryGuidance',
        }),
        expect.objectContaining({ kind: 'short-prose', field: 'notes' }),
        expect.objectContaining({ kind: 'missing-coaching', field: 'warning' }),
        expect.objectContaining({ kind: 'missing-field', field: 'script' }),
        expect.objectContaining({ kind: 'missing-field', field: 'storyBlocks' }),
        expect.objectContaining({ kind: 'missing-intel', field: 'cards' }),
        expect.objectContaining({ kind: 'missing-landmine', field: 'cards' }),
        expect.objectContaining({ kind: 'missing-coaching', field: 'notes' }),
      ]),
    )
  })

  it('accepts a deck that satisfies the validation contract', async () => {
    callLlmProxyMock.mockResolvedValueOnce(
      JSON.stringify({
        deckTitle: 'Acme Staff Engineer Prep',
        companyResearchSummary: 'Acme is scaling carefully.',
        rules: [
          'Lead with the exact answer.',
          'Stay conversational, not performative.',
          'Keep the proof concrete.',
        ],
        categoryGuidance: {
          opener:
            'They reached out to you, so keep this conversational and specific.',
          behavioral:
            'Be conversational and give them proof without sounding performative.',
          technical:
            'Convince them with concrete examples and earn attention quickly.',
          project:
            'Use a specific company detail to make the answer feel earned.',
          metrics:
            'Keep the numbers concrete and defensible.',
          situational:
            'Earn attention by answering directly and then bridging to the evidence.',
        },
        stackAlignment: [
          {
            theirTech: 'Go',
            yourMatch: 'Adjacent distributed systems debugging and service work.',
            confidence: 'Gap',
          },
        ],
        cards: [
          {
            category: 'opener',
            title: 'Tell me about yourself',
            tags: ['opener'],
            notes:
              'This opener is specific to the role. It keeps the through-line tight. It makes the first impression feel deliberate.',
            warning:
              'Keep this under 90 seconds or 2 minutes max. It is a trailer, not the movie.',
            script:
              'I build backend systems that reduce operational load and make product delivery more reliable for the teams that use them.',
          },
          {
            category: 'opener',
            title: 'Why this role/company?',
            tags: ['opener'],
            notes:
              'This answer is rare because it ties the company move to a concrete working style. Most candidates stay generic here, which makes the fit feel weaker.',
            warning:
              'Keep this under 2 minutes max and stay focused on why this move is specific.',
            script:
              'This role fits because the team needs the kind of systems judgment I have already used to reduce operational toil.',
          },
          {
            category: 'situational',
            title: 'Jordan Lee, Director of Platform',
            tags: ['intel'],
            notes:
              'Jordan Lee is likely the hiring manager and a rare signal because the title sits directly on the work I would own.',
            warning: 'Frame answers around the priorities implied by the title.',
            deepDives: [
              {
                title: 'Interview role',
                content:
                  'Jordan Lee is likely the hiring manager, so the conversation should feel practical and specific.',
              },
            ],
          },
          {
            category: 'technical',
            title: "What you know, what you don't: Go",
            tags: ['gap-framing'],
            notes:
              'I have adjacent experience with distributed systems work and can ramp quickly.',
            warning:
              "Don't fake direct ownership; if asked, name the boundary and the bounded ramp plan.",
            storyBlocks: [
              { label: 'problem', text: 'I have not led Go production directly.' },
              { label: 'solution', text: 'I have adjacent service-debugging experience that transfers.' },
              { label: 'result', text: 'I can close the gap quickly without overselling it.' },
            ],
            keyPoints: [
              'Name the boundary clearly.',
              'Bridge to adjacent systems work.',
              'State the ramp plan.',
            ],
          },
          {
            category: 'behavioral',
            title: 'Leadership story',
            tags: ['leadership'],
            notes:
              'This story is uncommon because it combines platform judgment with cross-team coordination. Most candidates would split that into two weaker examples.',
            warning: 'Keep the answer concrete and brief.',
            script:
              'Talk about the team decision, the constraint you handled, and the result you moved.',
          },
          {
            category: 'opener',
            title: 'Why this team now?',
            tags: ['landmine'],
            notes: 'Lead with the fit between the team and the work.',
            warning: 'Keep this honest and grounded.',
            script:
              'I want the kind of work where systems judgment and product delivery meet in the same conversation.',
          },
          {
            category: 'situational',
            title: 'What could go wrong here?',
            tags: ['landmine'],
            notes: 'The risk is overclaiming before the evidence is there.',
            warning: 'Name the boundary before you bridge to adjacent proof.',
            script:
              'If the stack gets deeper than my direct ownership, I will be explicit about the boundary and the ramp plan.',
          },
        ],
      }),
    )

    const result = await generatePrepDeck('https://ai.example/proxy', {
      company: 'Acme',
      role: 'Staff Engineer',
      vectorId: 'backend',
      vectorLabel: 'Backend',
      jobDescription: 'Build distributed systems and platform tooling.',
      companyResearch:
        'Jordan Lee, Director of Platform, and Priya Shah, Sr. Director of Engineering, are in the interview loop.',
      pipelineEntryContext: {
        company: 'Acme',
        role: 'Staff Engineer',
        tier: '1',
        status: 'interviewing',
        appMethod: 'direct-apply',
        response: 'interview-scheduled',
        formats: ['hm-screen'],
        research: {
          status: 'investigated',
          summary: 'Still mapping the team.',
          interviewSignals: [],
          people: [
            {
              name: 'Jordan Lee',
              title: 'Director of Platform',
              company: 'Acme',
              relevance: 'Likely hiring manager.',
            },
            {
              name: 'Priya Shah',
              title: 'Sr. Director of Engineering',
              company: 'Acme',
              relevance: 'Likely senior interviewer.',
            },
          ],
          sources: [],
          searchQueries: [],
        },
      },
      resumeContext: {
        resume: {
          basics: { name: 'Alex Example' },
        },
      },
    })

    expect(result.contractViolations).toEqual([])
    expect(result.deck.cards.some((card) => card.tags.includes('landmine'))).toBe(
      true,
    )
  })

  it('fails gracefully when the LLM proxy returns invalid JSON', async () => {
    callLlmProxyMock.mockResolvedValueOnce('{ invalid json ')

    await expect(
      generatePrepDeck('https://ai.example/proxy', {
        company: 'Acme',
        role: 'Staff Engineer',
        vectorId: 'backend',
        vectorLabel: 'Backend',
        jobDescription: 'Build distributed systems and platform tooling.',
        pipelineEntryContext: {
          company: 'Acme',
          role: 'Staff Engineer',
          tier: '1',
          status: 'interviewing',
          appMethod: 'direct-apply',
          response: 'interview-scheduled',
          formats: ['hm-screen'],
          research: {
            status: 'investigated',
            summary: 'Still mapping the team.',
            interviewSignals: [],
            people: [],
            sources: [],
            searchQueries: [],
          },
        },
        resumeContext: {
          resume: {
            basics: { name: 'Alex Example' },
          },
        },
      }),
    ).rejects.toThrow('Could not find JSON block in AI response')
  })

  it('fails when the LLM proxy rejects the request', async () => {
    callLlmProxyMock.mockRejectedValueOnce(new Error('network down'))

    await expect(
      generatePrepDeck('https://ai.example/proxy', {
        company: 'Acme',
        role: 'Staff Engineer',
        vectorId: 'backend',
        vectorLabel: 'Backend',
        jobDescription: 'Build distributed systems and platform tooling.',
        pipelineEntryContext: {
          company: 'Acme',
          role: 'Staff Engineer',
          tier: '1',
          status: 'interviewing',
          appMethod: 'direct-apply',
          response: 'interview-scheduled',
          formats: ['hm-screen'],
          research: {
            status: 'investigated',
            summary: 'Still mapping the team.',
            interviewSignals: [],
            people: [],
            sources: [],
            searchQueries: [],
          },
        },
        resumeContext: {
          resume: {
            basics: { name: 'Alex Example' },
          },
        },
      }),
    ).rejects.toThrow('network down')
  })

  it('surfaces a missing cards contract violation for an incomplete object root', async () => {
    callLlmProxyMock.mockResolvedValueOnce(
      JSON.stringify({
        deckTitle: 'Acme Staff Engineer Prep',
        cards: {},
      }),
    )

    const result = await generatePrepDeck('https://ai.example/proxy', {
      company: 'Acme',
      role: 'Staff Engineer',
      vectorId: 'backend',
      vectorLabel: 'Backend',
      jobDescription: 'Build distributed systems and platform tooling.',
      pipelineEntryContext: {
        company: 'Acme',
        role: 'Staff Engineer',
        tier: '1',
        status: 'interviewing',
        appMethod: 'direct-apply',
        response: 'interview-scheduled',
        formats: ['hm-screen'],
        research: {
          status: 'investigated',
          summary: 'Still mapping the team.',
          interviewSignals: [],
          people: [],
          sources: [],
          searchQueries: [],
        },
      },
      resumeContext: {
        resume: {
          basics: { name: 'Alex Example' },
        },
      },
    })

    expect(result.contractViolations).toContainEqual(
      expect.objectContaining({
        field: 'cards',
        kind: 'missing-field',
        severity: 'error',
      }),
    )
  })

  it('auto-injects landmine cards when the LLM omits them', async () => {
    callLlmProxyMock.mockResolvedValueOnce(
      JSON.stringify({
        deckTitle: 'Acme Staff Engineer Prep',
        companyResearchSummary: 'Acme is scaling carefully.',
        rules: [
          'Lead with the exact answer.',
          'Stay conversational, not performative.',
          'Keep the proof concrete.',
        ],
        categoryGuidance: {
          opener:
            'They reached out to you, so keep this conversational and specific.',
          behavioral:
            'Be conversational and give them proof without sounding performative.',
          technical:
            'Convince them with concrete examples and earn attention quickly.',
          project:
            'Use a specific company detail to make the answer feel earned.',
          metrics:
            'Keep the numbers concrete and defensible.',
          situational:
            'Earn attention by answering directly and then bridging to the evidence.',
        },
        stackAlignment: [
          {
            theirTech: 'Go',
            yourMatch: 'Adjacent distributed systems debugging and service work.',
            confidence: 'Gap',
          },
        ],
        cards: [
          {
            category: 'opener',
            title: 'Tell me about yourself',
            tags: ['opener'],
            notes:
              'This opener is specific to the role. It keeps the through-line tight. It makes the first impression feel deliberate.',
            warning:
              'Keep this under 90 seconds or 2 minutes max. It is a trailer, not the movie.',
            script:
              'I build backend systems that reduce operational load and make product delivery more reliable for the teams that use them.',
          },
          {
            category: 'opener',
            title: 'Why this role/company?',
            tags: ['opener'],
            notes:
              'This answer is rare because it ties the company move to a concrete working style. Most candidates stay generic here, which makes the fit feel weaker.',
            warning:
              'Keep this under 2 minutes max and stay focused on why this move is specific.',
            script:
              'This role fits because the team needs the kind of systems judgment I have already used to reduce operational toil.',
          },
          {
            category: 'situational',
            title: 'Jordan Lee, Director of Platform',
            tags: ['intel'],
            notes:
              'Jordan Lee is likely the hiring manager and a rare signal because the title sits directly on the work I would own.',
            warning: 'Frame answers around the priorities implied by the title.',
            deepDives: [
              {
                title: 'Interview role',
                content:
                  'Jordan Lee is likely the hiring manager, so the conversation should feel practical and specific.',
              },
            ],
          },
          {
            category: 'technical',
            title: "What you know, what you don't: Go",
            tags: ['gap-framing'],
            notes:
              'I have adjacent experience with distributed systems work and can ramp quickly.',
            warning:
              "Don't fake direct ownership; if asked, name the boundary and the bounded ramp plan.",
            storyBlocks: [
              { label: 'problem', text: 'I have not led Go production directly.' },
              { label: 'solution', text: 'I have adjacent service-debugging experience that transfers.' },
              { label: 'result', text: 'I can close the gap quickly without overselling it.' },
            ],
            keyPoints: [
              'Name the boundary clearly.',
              'Bridge to adjacent systems work.',
              'State the ramp plan.',
            ],
          },
          {
            category: 'technical',
            title: 'What you know, what you do not: Kubernetes',
            tags: ['gap-framing'],
            notes:
              'This is an uncommon fit because the platform and delivery work have already shown up together in my background.',
            warning:
              "Don't fake direct ownership; if asked, name the boundary and the bounded ramp plan.",
            storyBlocks: [
              { label: 'problem', text: 'I have not led Kubernetes directly in this role.' },
              { label: 'solution', text: 'I have adjacent platform debugging and delivery experience.' },
              { label: 'result', text: 'I can ramp quickly without overstating the match.' },
            ],
            keyPoints: [
              'Name the boundary clearly.',
              'Bridge to adjacent platform work.',
              'State the ramp plan.',
            ],
          },
          {
            category: 'behavioral',
            title: 'Leadership story',
            tags: ['leadership'],
            notes:
              'This story is uncommon because it combines platform judgment with cross-team coordination. Most candidates would split that into two weaker examples.',
            warning: 'Keep the answer concrete and brief.',
            script:
              'Talk about the team decision, the constraint you handled, and the result you moved.',
          },
        ],
      }),
    )

    const result = await generatePrepDeck('https://ai.example/proxy', {
      company: 'Acme',
      role: 'Staff Engineer',
      vectorId: 'backend',
      vectorLabel: 'Backend',
      jobDescription: 'Build distributed systems and platform tooling.',
      pipelineEntryContext: {
        company: 'Acme',
        role: 'Staff Engineer',
        tier: '1',
        status: 'interviewing',
        appMethod: 'direct-apply',
        response: 'interview-scheduled',
        formats: ['hm-screen'],
        research: {
          status: 'investigated',
          summary: 'Still mapping the team.',
          interviewSignals: [],
          people: [
            {
              name: 'Jordan Lee',
              title: 'Director of Platform',
              company: 'Acme',
              relevance: 'Likely hiring manager.',
            },
          ],
          sources: [],
          searchQueries: [],
        },
      },
      resumeContext: {
        resume: {
          basics: { name: 'Alex Example' },
        },
      },
    })

    expect(result.contractViolations).toEqual([])
    expect(result.deck.cards.some((card) => card.tags.includes('landmine'))).toBe(
      true,
    )
  })

  it('reports a contract violation when the model omits the cards array entirely', async () => {
    callLlmProxyMock.mockResolvedValueOnce(
      JSON.stringify({
        deckTitle: 'Acme Staff Engineer Prep',
      }),
    )

    const result = await generatePrepDeck('https://ai.example/proxy', {
        company: 'Acme',
        role: 'Staff Engineer',
        vectorId: 'backend',
        vectorLabel: 'Backend',
        jobDescription: 'Build distributed systems and platform tooling.',
        pipelineEntryContext: {
          company: 'Acme',
          role: 'Staff Engineer',
          tier: '1',
          status: 'interviewing',
          appMethod: 'direct-apply',
          response: 'interview-scheduled',
          formats: ['hm-screen'],
          research: {
            status: 'investigated',
            summary: 'Still mapping the team.',
            interviewSignals: [],
            people: [],
            sources: [],
            searchQueries: [],
          },
        },
        resumeContext: {
          resume: {
            basics: { name: 'Alex Example' },
          },
        },
    })

    expect(result.contractViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'missing-field', field: 'cards' }),
      ]),
    )
    expect(result.deck.cards.some((card) => card.tags.includes('landmine'))).toBe(
      true,
    )
  })
})
