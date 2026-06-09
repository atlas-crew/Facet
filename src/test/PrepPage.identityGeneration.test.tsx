// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PrepPage } from '../routes/prep/PrepPage'
import type { ProfessionalIdentityV3 } from '../identity/schema'
import { defaultResumeData } from '../store/defaultData'
import { useIdentityStore } from '../store/identityStore'
import { useJDAnalysisStore } from '../store/jdAnalysisStore'
import { useMatchStore } from '../store/matchStore'
import { usePipelineStore } from '../store/pipelineStore'
import { usePrepStore } from '../store/prepStore'
import { useResumeStore } from '../store/resumeStore'
import { resolveStorage } from '../store/storage'
import { hashJobDescriptionText } from '../utils/jdAnalysis'
import type { JDAnalysis } from '../types/jdAnalysis'
import { untaggedNote } from '../types/audience'

const navigateMock = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
  useSearch: () => ({ vector: 'backend', skills: '', q: '' }),
}))

const prepIdentityFixture: ProfessionalIdentityV3 = {
  version: 3,
  schema_revision: '3.1',
  model_revision: 3,
  identity: {
    name: 'Alex Example',
    email: 'alex@example.com',
    phone: '555-555-0100',
    location: 'New York, NY',
    links: [],
    thesis: 'Builds reliable backend platforms.',
  },
  self_model: {
    arc: [],
    philosophy: [],
    interview_style: {
      strengths: ['incident response'],
      weaknesses: ['rambling'],
      prep_strategy: 'Use short STAR answers.',
    },
  },
  preferences: {
    compensation: { priorities: [] },
    work_model: { preference: 'remote' },
    matching: { prioritize: [], avoid: [] },
  },
  skills: {
    groups: [
      {
        id: 'skills-platform',
        label: 'Platform',
        items: [
          {
            name: 'Kubernetes',
            depth: 'strong',
            positioning: 'Operates production clusters.',
            tags: ['platform'],
          },
          { name: 'COBOL', depth: 'basic', tags: ['legacy'] },
        ],
      },
    ],
  },
  profiles: [],
  expertise: [],
  roles: [
    {
      id: 'role-acme',
      company: 'Acme',
      title: 'Principal Engineer',
      dates: '2021-2024',
      bullets: [
        {
          id: 'bullet-keep',
          problem: 'Latency spiked during peak traffic.',
          action: 'Redesigned the service mesh rollout.',
          outcome: 'Reduced incidents by 38%.',
          impact: ['Restored SLO compliance'],
          metrics: { incidents: '38%' },
          technologies: ['Kubernetes'],
          tags: ['platform'],
        },
        {
          id: 'bullet-drop',
          problem: 'Maintained legacy data feeds.',
          action: 'Patched batch jobs.',
          outcome: 'Kept the nightly job alive.',
          impact: ['Minimal'],
          metrics: { feeds: 1 },
          technologies: ['COBOL'],
          tags: ['legacy'],
        },
      ],
    },
  ],
  projects: [],
  education: [],
  generator_rules: {
    voice_skill: 'clear',
    resume_skill: 'targeted',
  },
  search_vectors: [
    {
      id: 'backend',
      title: 'Backend Platform',
      priority: 'high',
      thesis: 'Lead with distributed systems and platform reliability.',
      target_roles: ['Staff Engineer'],
      keywords: {
        primary: ['distributed systems'],
        secondary: ['platform reliability'],
      },
      evidence: ['Reduced incidents by 38%'],
      supporting_skills: ['Kubernetes'],
      supporting_bullets: ['bullet-keep'],
    },
  ],
}

function createTestJdAnalysis(overrides: Partial<JDAnalysis> = {}): JDAnalysis {
  const jobDescription =
    overrides.analyzedJobDescription ?? 'Build distributed systems and platform tooling.'
  return {
    id: 'jd-analysis-1',
    pipelineEntryId: 'pipe-1',
    jdTextHash: hashJobDescriptionText(jobDescription),
    identityVersion: 3,
    modelVersion: 'jd-analysis.v1.match-multipass-sonnet',
    audienceRulesVersion: 'audience-rules.v1',
    generatedAt: '2026-04-20T12:00:00.000Z',
    updatedAt: '2026-04-20T12:00:00.000Z',
    warnings: [],
    company: 'Acme Corp',
    role: 'Staff Engineer',
    summary: 'Distributed systems and platform tooling.',
    analyzedJobDescription: jobDescription,
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
    ...overrides,
  }
}

describe('PrepPage identity generation', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_ANTHROPIC_PROXY_URL', 'https://ai.example/proxy')
    resolveStorage().removeItem('facet-prep-workspace')
    resolveStorage().removeItem('vector-resume-data')
    navigateMock.mockClear()
    usePrepStore.setState({ decks: [], activeDeckId: null, activeMode: 'edit' })
    useJDAnalysisStore.setState({ analyses: [createTestJdAnalysis()] })
    useIdentityStore.setState({
      currentIdentity: prepIdentityFixture,
      draft: null,
      draftDocument: '',
      warnings: [],
      lastError: null,
    })
    useMatchStore.setState({
      jobDescription: '',
      currentJDAnalysis: null,
      currentReport: null,
      warnings: [],
      history: [],
    })
    useResumeStore.setState({
      data: JSON.parse(JSON.stringify(defaultResumeData)),
      past: [],
      future: [],
      canUndo: false,
      canRedo: false,
    })
    usePipelineStore.setState({
      entries: [
        {
          id: 'pipe-1',
          company: 'Acme Corp',
          role: 'Staff Engineer',
          tier: '1',
          status: 'interviewing',
          comp: '',
          url: 'https://acme.example/jobs/1',
          contact: '',
          vectorId: 'backend',
          jdAnalysisId: 'jd-analysis-1',
          jobDescription: 'Build distributed systems and platform tooling.',
          presetId: null,
          resumeVariant: '',
          resumeGeneration: null,
          positioning: 'Emphasize backend platform depth.',
          skillMatch: 'distributed systems, platform',
          nextStep: '',
          notes: 'Hiring manager cares about operational excellence.',
          research: {
            status: 'investigated',
            summary: 'Public evidence points to a platform-heavy reliability role.',
            jobDescriptionSummary: 'Reliability and developer experience.',
            interviewSignals: [
              'Public reports mention a recruiter screen and system design round.',
            ],
            people: [],
            sources: [
              {
                label: 'Acme careers',
                url: 'https://acme.example/jobs/1',
                kind: 'job-posting',
              },
            ],
            searchQueries: ['Acme staff engineer interview'],
            lastInvestigatedAt: '2026-03-08T12:00:00.000Z',
          },
          appMethod: 'direct-apply',
          response: 'interview-scheduled',
          daysToResponse: null,
          rounds: 3,
          format: ['system-design'],
          rejectionStage: '',
          rejectionReason: '',
          offerAmount: '',
          dateApplied: '2026-03-01',
          dateClosed: '',
          lastAction: '2026-03-09',
          createdAt: '2026-03-01',
          history: [],
        },
      ],
      sortField: 'tier',
      sortDir: 'asc',
      filters: { tier: 'all', status: 'all', search: '' },
    })

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                deckTitle: 'Acme Staff Engineer Prep',
                companyResearchSummary:
                  'Acme is optimizing for platform reliability and developer velocity.',
                rules: ['Lead with specifics.', 'Listen more than you talk.'],
                donts: ['Do not ramble.'],
                questionsToAsk: [
                  {
                    question: 'What is the platform team optimizing for next?',
                    context: 'Shows systems thinking.',
                  },
                ],
                numbersToKnow: {
                  candidate: [{ value: '38%', label: 'Incident reduction' }],
                  company: [{ value: '3', label: 'Core platform bets' }],
                },
                categoryGuidance: {
                  behavioral: 'Lead with scope.',
                },
                cards: [
                  {
                    category: 'opener',
                    kind: 'opener',
                    title: 'Tell me about yourself',
                    tags: ['backend', 'acme'],
                    script: 'I build resilient backend systems and lead platform improvements.',
                  },
                ],
              }),
            },
          },
        ],
      }),
    }) as typeof fetch
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('forwards filtered identity context through the pipeline generation path', async () => {
    const identityBefore = JSON.stringify(useIdentityStore.getState().currentIdentity)

    render(<PrepPage />)

    fireEvent.click(screen.getByRole('button', { name: /^Generate$/ }))
    fireEvent.click(screen.getByText('Generate with AI'))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })

    const [, init] = vi.mocked(global.fetch).mock.calls[0]
    const body = JSON.parse(String(init?.body ?? '{}')) as {
      messages?: Array<{ content?: string }>
    }
    const prompt = body.messages?.[0]?.content ?? ''

    expect(prompt).toContain('Structured Identity Context')
    expect(prompt).toContain('Structured Pipeline Entry Context')
    expect(prompt).toContain('Canonical JD Analysis')
    expect(prompt).toContain('"id": "jd-analysis-1"')
    expect(prompt).toContain('Candidate Metrics From Identity')
    expect(prompt).toContain('Reduced incidents by 38%')
    expect(prompt).toContain('"metricKey": "incidents"')
    // Interviewer names intentionally absent — doc-30 §Interviewer Capture
    // gates panel data on round.interviewers, not legacy research.people.
    expect(prompt).not.toContain('Jordan Lee')
    expect(prompt).toContain('Public reports mention a recruiter screen and system design round.')
    expect(prompt).toContain('Additional Candidate Metrics Outside The Vector Slice')
    expect(prompt).toContain('Maintained legacy data feeds.')
    expect(prompt).toContain('Kubernetes')
    expect(prompt).not.toContain('COBOL')
    expect(JSON.stringify(useIdentityStore.getState().currentIdentity)).toBe(identityBefore)

    const generatedDeck = usePrepStore.getState().decks[0]
    expect(generatedDeck.jdAnalysisId).toBe('jd-analysis-1')
    expect(generatedDeck.jdAnalysisGeneratedAt).toBe('2026-04-20T12:00:00.000Z')
    expect(generatedDeck.jdAnalysisModelVersion).toBe('jd-analysis.v1.match-multipass-sonnet')
    expect(generatedDeck.jdTextHash).toBe(
      hashJobDescriptionText('Build distributed systems and platform tooling.'),
    )
    expect(generatedDeck.roundType).toBe('system-design')
    expect(generatedDeck.rules).toEqual(['Lead with specifics.', 'Listen more than you talk.'])
    expect(generatedDeck.donts).toEqual(['Do not ramble.'])
    expect(generatedDeck.questionsToAsk).toEqual([
      {
        question: 'What is the platform team optimizing for next?',
        context: 'Shows systems thinking.',
      },
    ])
    expect(generatedDeck.numbersToKnow).toEqual({
      candidate: [expect.objectContaining({ value: '38%', label: 'Incident reduction' })],
      company: [expect.objectContaining({ value: '3', label: 'Core platform bets' })],
    })
    expect(generatedDeck.categoryGuidance).toEqual({ behavioral: 'Lead with scope.' })
    expect(generatedDeck.identityVersion).toBe(3)
  })

  it('records the generation-start identity version when identity changes mid-generation', async () => {
    let resolveFetch: ((response: Response) => void) | undefined
    global.fetch = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve
        }),
    ) as typeof fetch

    render(<PrepPage />)

    fireEvent.click(screen.getByRole('button', { name: /^Generate$/ }))
    fireEvent.click(screen.getByText('Generate with AI'))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })

    const updatedIdentity = JSON.parse(
      JSON.stringify(prepIdentityFixture),
    ) as ProfessionalIdentityV3
    updatedIdentity.model_revision = 9
    act(() => {
      useIdentityStore.setState({ currentIdentity: updatedIdentity })
    })

    const respond = resolveFetch
    if (!respond) throw new Error('Expected prep generation request to be in flight.')
    await act(async () => {
      respond({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  deckTitle: 'Acme Staff Engineer Prep',
                  cards: [
                    {
                      category: 'opener',
                      kind: 'opener',
                      title: 'Tell me about yourself',
                      tags: ['backend', 'acme'],
                      script: 'I build resilient backend systems.',
                    },
                  ],
                }),
              },
            },
          ],
        }),
      } as Response)
    })

    await waitFor(() => {
      expect(usePrepStore.getState().decks[0]?.identityVersion).toBe(3)
    })
    expect(useIdentityStore.getState().currentIdentity?.model_revision).toBe(9)
  })

  it('confirms before replacing an existing identity draft', async () => {
    usePrepStore.getState().createDeck({
      title: 'Acme Staff Engineer Prep',
      company: 'Acme Corp',
      role: 'Staff Engineer',
      vectorId: 'backend',
      jobDescription: 'Build distributed systems and platform tooling.',
      contextGaps: [
        {
          id: 'gap-identity',
          section: 'Opening story',
          question: 'What incident metric best supports your story?',
          why: 'Needed for the opener.',
          priority: 'required',
          feedbackTarget: 'identity.awareness.open_questions',
        },
      ],
      contextGapAnswers: {
        'gap-identity': 'Use the 38% incident reduction metric from Acme.',
      },
      cards: [],
    })
    useIdentityStore.setState({
      draft: {
        generatedAt: '2026-04-16T12:00:00.000Z',
        summary: 'Existing draft',
        followUpQuestions: [],
        identity: prepIdentityFixture,
        bullets: [],
        warnings: [],
      },
    })
    render(<PrepPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Queue for Identity Review' }))

    expect(
      screen.getByRole('heading', { name: 'Replace the current identity draft?' }),
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(navigateMock).not.toHaveBeenCalled()
    expect(useIdentityStore.getState().draft?.summary).toBe('Existing draft')
  })

  it('does not guess a round type when the pipeline entry has multiple formats', async () => {
    usePipelineStore.setState({
      entries: [
        {
          ...usePipelineStore.getState().entries[0],
          format: ['system-design', 'behavioral'],
        },
      ],
      sortField: 'tier',
      sortDir: 'asc',
      filters: { tier: 'all', status: 'all', search: '' },
    })

    render(<PrepPage />)

    fireEvent.click(screen.getByRole('button', { name: /^Generate$/ }))
    fireEvent.click(screen.getByText('Generate with AI'))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })

    const [, init] = vi.mocked(global.fetch).mock.calls[0]
    const body = JSON.parse(String(init?.body ?? '{}')) as {
      messages?: Array<{ content?: string }>
    }
    const prompt = body.messages?.[0]?.content ?? ''

    expect(prompt).toContain('Target Round Type: Not provided')
    expect(usePrepStore.getState().decks[0].roundType).toBeUndefined()
  })

  it('blocks pipeline prep generation until the linked JD analysis is fresh', async () => {
    useJDAnalysisStore.setState({ analyses: [] })

    render(<PrepPage />)

    fireEvent.click(screen.getByRole('button', { name: /^Generate$/ }))
    fireEvent.click(screen.getByText('Generate with AI'))

    await waitFor(() => {
      expect(screen.getByText('Analyze this pipeline JD before generating prep.')).toBeTruthy()
    })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('blocks pipeline prep generation when the linked JD analysis is stale', async () => {
    useJDAnalysisStore.setState({
      analyses: [
        createTestJdAnalysis({
          modelVersion: 'jd-analysis.v0.legacy',
        }),
      ],
    })

    render(<PrepPage />)

    fireEvent.click(screen.getByRole('button', { name: /^Generate$/ }))
    fireEvent.click(screen.getByText('Generate with AI'))

    await waitFor(() => {
      expect(
        screen.getByText('Refresh JD analysis before generating prep (analysis model changed).'),
      ).toBeTruthy()
    })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('blocks prep regeneration when the linked JD analysis is stale', async () => {
    usePipelineStore.setState((state) => ({
      ...state,
      entries: state.entries.map((entry) =>
        entry.id === 'pipe-1' ? { ...entry, jobDescription: 'Changed JD text.' } : entry,
      ),
    }))
    usePrepStore.getState().createDeck({
      title: 'Acme Staff Engineer Prep',
      company: 'Acme Corp',
      role: 'Staff Engineer',
      vectorId: 'backend',
      pipelineEntryId: 'pipe-1',
      jdAnalysisId: 'jd-analysis-1',
      jdAnalysisGeneratedAt: '2026-04-20T12:00:00.000Z',
      jdAnalysisModelVersion: 'jd-analysis.v1.match-multipass-sonnet',
      jdTextHash: hashJobDescriptionText('Build distributed systems and platform tooling.'),
      jobDescription: 'Build distributed systems and platform tooling.',
      contextGaps: [
        {
          id: 'gap-scale',
          section: 'Technical Topics',
          question: 'What scale did the rollout support?',
          why: 'The technical story needs a concrete denominator.',
          priority: 'recommended',
        },
      ],
      contextGapAnswers: {
        'gap-scale': 'The rollout served roughly 120 engineers across six product teams.',
      },
      cards: [
        {
          id: 'card-1',
          category: 'technical',
          kind: 'story',
          title: 'Original technical card',
          tags: ['technical'],
          script: '[[needs-review]] add the rollout denominator',
        },
      ],
    })

    render(<PrepPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Re-generate with answers' }))

    await waitFor(() => {
      expect(
        screen.getByText('Refresh JD analysis before generating prep (job description changed).'),
      ).toBeTruthy()
    })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('captures context gap answers and queues an identity draft for review', async () => {
    usePrepStore.getState().createDeck({
      title: 'Acme Staff Engineer Prep',
      company: 'Acme Corp',
      role: 'Staff Engineer',
      vectorId: 'backend',
      contextGaps: [
        {
          id: 'gap-departure',
          section: 'Openers',
          question: 'Why did you leave your last role?',
          why: 'The opener needs candidate-authored departure context.',
          feedbackTarget: 'identity.departureContext',
          priority: 'required',
        },
      ],
      cards: [
        {
          id: 'card-gap',
          category: 'opener',
          kind: 'opener',
          title: 'Why this role',
          tags: ['opener'],
          script: '[[needs-review]] add the departure context bridge.',
        },
      ],
    })

    render(<PrepPage />)

    expect(screen.getByText(/This prep set is missing context/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Fill in the gaps' }))
    fireEvent.change(
      screen.getByPlaceholderText(
        'Add the missing detail that would make this section accurate and specific.',
      ),
      { target: { value: 'I wanted broader platform ownership and more direct product impact.' } },
    )
    fireEvent.click(screen.getByRole('button', { name: 'Save answers' }))

    await waitFor(() => {
      expect(usePrepStore.getState().decks[0].contextGapAnswers).toEqual({
        'gap-departure': 'I wanted broader platform ownership and more direct product impact.',
      })
    })

    fireEvent.click(screen.getByRole('button', { name: 'Queue for Identity Review' }))

    await waitFor(() => {
      expect(useIdentityStore.getState().draft?.summary).toContain('Queued 1 prep context answer')
    })

    expect(useIdentityStore.getState().draft?.identity.awareness?.open_questions).toEqual([
      expect.objectContaining({
        id: expect.stringContaining('prep-gap-'),
        topic: 'Openers: Why did you leave your last role?',
        description: 'I wanted broader platform ownership and more direct product impact.',
        action: 'Review this prep context and decide how it should inform departureContext.',
        severity: 'high',
        evidence: ['The opener needs candidate-authored departure context.'],
        needs_review: true,
      }),
    ])
    expect(navigateMock).toHaveBeenCalledWith({ to: '/identity/import' })
  })

  it('re-generates the active prep set with saved context gap answers', async () => {
    const deckId = usePrepStore.getState().createDeck({
      title: 'Acme Staff Engineer Prep',
      company: 'Acme Corp',
      role: 'Staff Engineer',
      vectorId: 'backend',
      pipelineEntryId: 'pipe-1',
      jdAnalysisId: 'jd-analysis-1',
      jdAnalysisGeneratedAt: '2026-04-20T12:00:00.000Z',
      jdAnalysisModelVersion: 'jd-analysis.v1.match-multipass-sonnet',
      jdTextHash: hashJobDescriptionText('Build distributed systems and platform tooling.'),
      jobDescription: 'Original saved prep JD text.',
      companyResearch: 'Acme is optimizing for platform reliability.',
      contextGaps: [
        {
          id: 'gap-scale',
          section: 'Technical Topics',
          question: 'What scale did the rollout support?',
          why: 'The technical story needs a concrete denominator.',
          priority: 'recommended',
        },
      ],
      contextGapAnswers: {
        'gap-scale': 'The rollout served roughly 120 engineers across six product teams.',
      },
      cards: [
        {
          id: 'card-1',
          category: 'technical',
          kind: 'story',
          title: 'Original technical card',
          tags: ['technical'],
          script: '[[needs-review]] add the rollout denominator',
        },
      ],
    })

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                deckTitle: 'Acme Staff Engineer Prep',
                companyResearchSummary: 'Refreshed research summary.',
                contextGaps: [],
                cards: [
                  {
                    category: 'technical',
                    kind: 'story',
                    title: 'Refreshed technical card',
                    tags: ['technical'],
                    script: 'The rollout served roughly 120 engineers across six product teams.',
                  },
                ],
              }),
            },
          },
        ],
      }),
    }) as typeof fetch

    render(<PrepPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Re-generate with answers' }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })

    const [, init] = vi.mocked(global.fetch).mock.calls[0]
    const body = JSON.parse(String(init?.body ?? '{}')) as {
      messages?: Array<{ content?: string }>
    }
    const prompt = body.messages?.[0]?.content ?? ''

    expect(prompt).toContain('Existing Context Gaps')
    expect(prompt).toContain('Context Gap Answers')
    expect(prompt).toContain(
      'Original Job Description Source Text:\nBuild distributed systems and platform tooling.',
    )
    expect(prompt).not.toContain('Original saved prep JD text.')
    expect(prompt).toContain('roughly 120 engineers across six product teams')

    await waitFor(() => {
      const deck = usePrepStore.getState().decks.find((entry) => entry.id === deckId)
      expect(deck?.cards.some((card) => card.title === 'Refreshed technical card')).toBe(true)
      expect(deck?.cards.some((card) => card.title === 'Original technical card')).toBe(true)
      expect(deck?.jobDescription).toBe('Build distributed systems and platform tooling.')
      expect(deck?.contextGaps).toBeUndefined()
      expect(deck?.contextGapAnswers).toBeUndefined()
      expect(usePrepStore.getState().decks).toHaveLength(1)
    })
  })
})
