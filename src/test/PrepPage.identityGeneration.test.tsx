// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PrepPage } from '../routes/prep/PrepPage'
import type { ProfessionalIdentityV3 } from '../identity/schema'
import { defaultResumeData } from '../store/defaultData'
import { useIdentityStore } from '../store/identityStore'
import { useMatchStore } from '../store/matchStore'
import { usePipelineStore } from '../store/pipelineStore'
import { usePrepStore } from '../store/prepStore'
import { useResumeStore } from '../store/resumeStore'
import { resolveStorage } from '../store/storage'
import type { MatchReport } from '../types/match'

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  useSearch: () => ({ vector: 'backend', skills: '', q: '' }),
}))

const prepIdentityFixture: ProfessionalIdentityV3 = {
  version: 3,
  schema_revision: '3.1',
  identity: {
    name: 'Alex Example',
    email: 'alex@example.com',
    phone: '555-0100',
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
          { name: 'Kubernetes', depth: 'strong', positioning: 'Operates production clusters.', tags: ['platform'] },
          { name: 'COBOL', depth: 'basic', tags: ['legacy'] },
        ],
      },
    ],
  },
  profiles: [],
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

describe('PrepPage identity generation', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_ANTHROPIC_PROXY_URL', 'https://ai.example/proxy')
    resolveStorage().removeItem('facet-prep-workspace')
    resolveStorage().removeItem('vector-resume-data')
    usePrepStore.setState({ decks: [], activeDeckId: null, activeMode: 'edit' })
    useIdentityStore.setState({ currentIdentity: prepIdentityFixture })
    useMatchStore.setState({ jobDescription: '', currentReport: null, warnings: [], history: [] })
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
          jobDescription: 'Build distributed systems and platform tooling.',
          presetId: null,
          resumeVariant: '',
          positioning: 'Emphasize backend platform depth.',
          skillMatch: 'distributed systems, platform',
          nextStep: '',
          notes: 'Hiring manager cares about operational excellence.',
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
                companyResearchSummary: 'Acme is optimizing for platform reliability and developer velocity.',
                donts: ['Do not ramble.'],
                questionsToAsk: [
                  {
                    question: 'What is the platform team optimizing for next?',
                    context: 'Shows systems thinking.',
                  },
                ],
                categoryGuidance: {
                  behavioral: 'Lead with scope.',
                },
                cards: [
                  {
                    category: 'opener',
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
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('forwards filtered identity context through the pipeline generation path', async () => {
    const identityBefore = JSON.stringify(useIdentityStore.getState().currentIdentity)

    render(<PrepPage />)

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
    expect(prompt).toContain('Reduced incidents by 38%')
    expect(prompt).toContain('Kubernetes')
    expect(prompt).not.toContain('Maintained legacy data feeds.')
    expect(prompt).not.toContain('COBOL')
    expect(JSON.stringify(useIdentityStore.getState().currentIdentity)).toBe(identityBefore)

    const generatedDeck = usePrepStore.getState().decks[0]
    expect(generatedDeck.roundType).toBe('system-design')
    expect(generatedDeck.donts).toEqual(['Do not ramble.'])
    expect(generatedDeck.questionsToAsk).toEqual([
      {
        question: 'What is the platform team optimizing for next?',
        context: 'Shows systems thinking.',
      },
    ])
    expect(generatedDeck.categoryGuidance).toEqual({ behavioral: 'Lead with scope.' })
  })

  it('uses the selected resume vector label to scope identity context for match generation', async () => {
    const identityBefore = JSON.stringify(useIdentityStore.getState().currentIdentity)
    const matchReport: MatchReport = {
      generatedAt: '2026-04-02T00:00:00.000Z',
      identityVersion: 3,
      company: 'Atlas',
      role: 'Staff Platform Engineer',
      summary: 'Strong platform fit.',
      jobDescription: 'Own platform engineering and reliability.',
      matchScore: 0.84,
      requirements: [],
      topBullets: [
        {
          kind: 'bullet',
          id: 'acme-b1',
          label: 'Order pipeline',
          sourceLabel: 'Acme',
          text: 'Built a distributed order pipeline.',
          tags: ['platform'],
          matchedTags: ['platform'],
          matchedKeywords: ['platform'],
          matchedRequirementIds: ['req-1'],
          score: 0.9,
        },
      ],
      topSkills: [],
      topProjects: [],
      topProfiles: [
        {
          kind: 'profile',
          id: 'profile-backend',
          label: 'Backend profile',
          sourceLabel: 'Profiles',
          text: 'Backend systems profile.',
          tags: ['backend'],
          matchedTags: ['backend'],
          matchedKeywords: ['systems'],
          matchedRequirementIds: ['req-1'],
          score: 0.7,
        },
      ],
      topPhilosophy: [],
      gaps: [],
      advantages: [],
      positioningRecommendations: ['Lead with platform reliability.'],
      gapFocus: [],
      warnings: [],
    }

    usePipelineStore.setState((state) => ({ ...state, entries: [] }))
    useMatchStore.setState({
      jobDescription: matchReport.jobDescription,
      currentReport: matchReport,
      warnings: [],
      history: [],
    })

    render(<PrepPage />)

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
    expect(prompt).toContain('Reduced incidents by 38%')
    expect(prompt).not.toContain('Maintained legacy data feeds.')
    expect(prompt).not.toContain('COBOL')
    expect(JSON.stringify(useIdentityStore.getState().currentIdentity)).toBe(identityBefore)

    const generatedDeck = usePrepStore.getState().decks[0]
    expect(generatedDeck.donts).toEqual(['Do not ramble.'])
    expect(generatedDeck.questionsToAsk).toEqual([
      {
        question: 'What is the platform team optimizing for next?',
        context: 'Shows systems thinking.',
      },
    ])
    expect(generatedDeck.categoryGuidance).toEqual({ behavioral: 'Lead with scope.' })
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
})
