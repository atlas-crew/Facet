import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { generatePrepDeck } from '../utils/prepGenerator'
import type { JDAnalysis } from '../types/jdAnalysis'
import { untaggedNote } from '../types/audience'

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

const testJdAnalysis: JDAnalysis = {
  id: 'jd-analysis-test',
  pipelineEntryId: 'pipe-test',
  jdTextHash: 'jdhash-test',
  identityVersion: 0,
  modelVersion: 'jd-analysis.v1.match-multipass-sonnet',
  audienceRulesVersion: 'audience-rules.v1',
  generatedAt: '2026-04-20T12:00:00.000Z',
  updatedAt: '2026-04-20T12:00:00.000Z',
  warnings: [],
  company: 'Acme',
  role: 'Staff Engineer',
  summary: 'Distributed systems and platform tooling.',
  analyzedJobDescription: 'Build distributed systems and platform tooling.',
  jobDescriptionWordCount: 6,
  jobDescriptionTruncated: false,
  requirements: [],
  overallFit: 'strong',
  fitScore: 0.82,
  confidence: 'high',
  recommendation: 'apply',
  oneLineSummary: 'Strong platform fit.',
  rationale: 'The role maps to backend platform evidence.',
  matchedVectors: [],
  primaryVectorId: 'backend',
  skillMatches: [],
  evidenceMapping: {
    topBullets: [],
    topSkills: [],
    topProjects: [],
    topProfiles: [],
    topPhilosophy: [],
  },
  strengthsToLead: [untaggedNote('Distributed systems')],
  advantages: [],
  advantageHypotheses: [],
  gaps: [],
  gapFocus: [],
  watchOuts: [],
  triggeredPrioritize: [],
  triggeredAvoid: [],
  relevantAwareness: [],
  positioningRecommendations: [untaggedNote('Lead with platform reliability.')],
  requirementCoverageScore: 0.8,
  matchedRequirementIds: [],
  matchedKeywords: ['distributed systems', 'platform tooling'],
}

describe('prep contract validation', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    callLlmProxyMock.mockReset()
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  afterEach(() => {
    consoleWarnSpy.mockRestore()
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
            kind: 'opener',
            title: 'Tell me about yourself',
            tags: ['opener'],
            notes: 'Lead with the broad arc.',
            warning: 'Keep it short.',
            script: 'I build backend systems.',
          },
          {
            category: 'technical',
            kind: 'story',
            title: 'What is your Go experience?',
            tags: ['gap-framing'],
            notes: 'Bridge from adjacent systems work.',
            warning: 'This is fine.',
            keyPoints: ['I can learn quickly.'],
          },
          {
            category: 'behavioral',
            kind: 'story',
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
      jdAnalysis: testJdAnalysis,
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
          sources: [],
          searchQueries: [],
        },
        round: {
          id: 'round-1',
          label: 'HM panel',
          format: 'hm-screen',
          interviewers: [
            { id: 'iv-jordan', name: 'Jordan Lee', title: 'Director of Platform' },
            { id: 'iv-priya', name: 'Priya Shah', title: 'Sr. Director of Engineering' },
          ],
        },
      },
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

    expect(result.deck.cards.some((card) => card.tags.includes('landmine'))).toBe(true)
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
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[prepGenerator] contract violations',
      expect.objectContaining({
        feature: 'prep.generate',
        hasPipelineContext: true,
        pipelineRoundId: 'round-1',
        violationCount: result.contractViolations.length,
        severities: expect.objectContaining({
          error: expect.any(Number),
          warning: expect.any(Number),
        }),
        kinds: expect.objectContaining({
          'missing-field': expect.any(Number),
          'missing-coaching': expect.any(Number),
        }),
        fields: expect.arrayContaining(['rules', 'categoryGuidance', 'cards']),
      }),
    )
    const loggedPayload = (consoleWarnSpy.mock.calls as unknown[][]).find(
      (call: unknown[]) => call[0] === '[prepGenerator] contract violations',
    )?.[1] as { fields?: string[] } | undefined
    expect(loggedPayload?.fields).toHaveLength(new Set(loggedPayload?.fields).size)
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
          opener: 'They reached out to you, so keep this conversational and specific.',
          behavioral: 'Be conversational and give them proof without sounding performative.',
          technical: 'Convince them with concrete examples and earn attention quickly.',
          project: 'Use a specific company detail to make the answer feel earned.',
          metrics: 'Keep the numbers concrete and defensible.',
          situational: 'Earn attention by answering directly and then bridging to the evidence.',
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
            kind: 'opener',
            title: 'Tell me about yourself',
            tags: ['opener'],
            notes:
              'This opener is specific to the role. It keeps the through-line tight. It makes the first impression feel deliberate.',
            warning: 'Keep this under 90 seconds or 2 minutes max. It is a trailer, not the movie.',
            script:
              'I build backend systems that reduce operational load and make product delivery more reliable for the teams that use them.',
          },
          {
            category: 'opener',
            kind: 'opener',
            title: 'Why this role/company?',
            tags: ['opener'],
            notes:
              'This answer is rare because it ties the company move to a concrete working style. Most candidates stay generic here, which makes the fit feel weaker.',
            warning: 'Keep this under 2 minutes max and stay focused on why this move is specific.',
            script:
              'This role fits because the team needs the kind of systems judgment I have already used to reduce operational toil.',
          },
          {
            category: 'situational',
            kind: 'story',
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
            kind: 'story',
            title: "What you know, what you don't: Go",
            tags: ['gap-framing'],
            notes: 'I have adjacent experience with distributed systems work and can ramp quickly.',
            warning:
              "Don't fake direct ownership; if asked, name the boundary and the bounded ramp plan.",
            storyBlocks: [
              { label: 'problem', text: 'I have not led Go production directly.' },
              {
                label: 'solution',
                text: 'I have adjacent service-debugging experience that transfers.',
              },
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
            kind: 'story',
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
            kind: 'opener',
            title: 'Why this team now?',
            tags: ['landmine'],
            notes: 'Lead with the fit between the team and the work.',
            warning: 'Keep this honest and grounded.',
            script:
              'I want the kind of work where systems judgment and product delivery meet in the same conversation.',
          },
          {
            category: 'situational',
            kind: 'story',
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
      jdAnalysis: testJdAnalysis,
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
          sources: [],
          searchQueries: [],
        },
        round: {
          id: 'round-1',
          label: 'HM panel',
          format: 'hm-screen',
          interviewers: [
            { id: 'iv-jordan', name: 'Jordan Lee', title: 'Director of Platform' },
            { id: 'iv-priya', name: 'Priya Shah', title: 'Sr. Director of Engineering' },
          ],
        },
      },
      resumeContext: {
        resume: {
          basics: { name: 'Alex Example' },
        },
      },
    })

    expect(result.contractViolations).toEqual([])
    expect(result.deck.cards.some((card) => card.tags.includes('landmine'))).toBe(true)
    expect(consoleWarnSpy).not.toHaveBeenCalledWith(
      '[prepGenerator] contract violations',
      expect.anything(),
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
        jdAnalysis: testJdAnalysis,
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
        jdAnalysis: testJdAnalysis,
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
        cards: 'not-an-array',
      }),
    )

    const result = await generatePrepDeck('https://ai.example/proxy', {
      company: 'Acme',
      role: 'Staff Engineer',
      vectorId: 'backend',
      vectorLabel: 'Backend',
      jobDescription: 'Build distributed systems and platform tooling.',
      jdAnalysis: testJdAnalysis,
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

  it('reports missing and invalid PrepCard kind discriminators from generated cards', async () => {
    callLlmProxyMock.mockResolvedValueOnce(
      JSON.stringify({
        deckTitle: 'Acme Staff Engineer Prep',
        companyResearchSummary: 'Acme is scaling carefully.',
        rules: [
          'Lead with specific evidence.',
          'Keep answers conversational.',
          'Name tradeoffs plainly.',
        ],
        categoryGuidance: {
          behavioral: 'Use concrete stories and keep the answer conversational.',
        },
        cards: [
          {
            category: 'behavioral',
            title: 'Leadership story',
            tags: ['leadership'],
            script: 'I handled the release by sequencing the riskiest migration first.',
          },
          {
            category: 'technical',
            kind: 'freeform',
            title: 'Architecture tradeoff',
            tags: ['architecture'],
            script:
              'I would name the constraint, pick the boring design, and explain the tradeoff.',
          },
          {
            category: 'behavioral',
            kind: 'story',
            scriptKind: 'monologue',
            title: 'Valid story',
            tags: ['leadership'],
            script: 'I led the release by sequencing the riskiest migration first.',
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
      jdAnalysis: testJdAnalysis,
      pipelineEntryContext: {
        company: 'Acme',
        role: 'Staff Engineer',
        tier: '1',
        status: 'interviewing',
        appMethod: 'direct-apply',
        response: 'interview-scheduled',
        formats: ['hm-screen'],
      },
      resumeContext: {
        resume: {
          basics: { name: 'Alex Example' },
        },
      },
    })

    expect(result.deck.cards.slice(0, 3).map((card) => [card.title, card.kind])).toEqual([
      ['Leadership story', 'story'],
      ['Architecture tradeoff', 'story'],
      ['Valid story', 'story'],
    ])
    expect(result.contractViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'cards[0].kind',
          kind: 'missing-field',
          severity: 'error',
        }),
        expect.objectContaining({
          field: 'cards[1].kind',
          kind: 'invalid-field',
          severity: 'error',
        }),
        expect.objectContaining({
          field: 'cards[2].scriptKind',
          kind: 'invalid-field',
          severity: 'error',
        }),
      ]),
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
          opener: 'They reached out to you, so keep this conversational and specific.',
          behavioral: 'Be conversational and give them proof without sounding performative.',
          technical: 'Convince them with concrete examples and earn attention quickly.',
          project: 'Use a specific company detail to make the answer feel earned.',
          metrics: 'Keep the numbers concrete and defensible.',
          situational: 'Earn attention by answering directly and then bridging to the evidence.',
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
            kind: 'opener',
            title: 'Tell me about yourself',
            tags: ['opener'],
            notes:
              'This opener is specific to the role. It keeps the through-line tight. It makes the first impression feel deliberate.',
            warning: 'Keep this under 90 seconds or 2 minutes max. It is a trailer, not the movie.',
            script:
              'I build backend systems that reduce operational load and make product delivery more reliable for the teams that use them.',
          },
          {
            category: 'opener',
            kind: 'opener',
            title: 'Why this role/company?',
            tags: ['opener'],
            notes:
              'This answer is rare because it ties the company move to a concrete working style. Most candidates stay generic here, which makes the fit feel weaker.',
            warning: 'Keep this under 2 minutes max and stay focused on why this move is specific.',
            script:
              'This role fits because the team needs the kind of systems judgment I have already used to reduce operational toil.',
          },
          {
            category: 'situational',
            kind: 'story',
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
            kind: 'story',
            title: "What you know, what you don't: Go",
            tags: ['gap-framing'],
            notes: 'I have adjacent experience with distributed systems work and can ramp quickly.',
            warning:
              "Don't fake direct ownership; if asked, name the boundary and the bounded ramp plan.",
            storyBlocks: [
              { label: 'problem', text: 'I have not led Go production directly.' },
              {
                label: 'solution',
                text: 'I have adjacent service-debugging experience that transfers.',
              },
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
            kind: 'story',
            title: 'What you know, what you do not: Kubernetes',
            tags: ['gap-framing'],
            notes:
              'This is an uncommon fit because the platform and delivery work have already shown up together in my background.',
            warning:
              "Don't fake direct ownership; if asked, name the boundary and the bounded ramp plan.",
            storyBlocks: [
              { label: 'problem', text: 'I have not led Kubernetes directly in this role.' },
              {
                label: 'solution',
                text: 'I have adjacent platform debugging and delivery experience.',
              },
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
            kind: 'story',
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
      jdAnalysis: testJdAnalysis,
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
          sources: [],
          searchQueries: [],
        },
        round: {
          id: 'round-1',
          label: 'HM panel',
          format: 'hm-screen',
          interviewers: [{ id: 'iv-jordan', name: 'Jordan Lee', title: 'Director of Platform' }],
        },
      },
      resumeContext: {
        resume: {
          basics: { name: 'Alex Example' },
        },
      },
    })

    expect(result.contractViolations).toEqual([])
    expect(result.deck.cards.some((card) => card.tags.includes('landmine'))).toBe(true)
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
      jdAnalysis: testJdAnalysis,
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
      expect.arrayContaining([expect.objectContaining({ kind: 'missing-field', field: 'cards' })]),
    )
    expect(result.deck.cards.some((card) => card.tags.includes('landmine'))).toBe(true)
  })
})
