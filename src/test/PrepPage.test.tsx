// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PrepPage } from '../routes/prep/PrepPage'
import { useMatchStore } from '../store/matchStore'
import { usePipelineStore } from '../store/pipelineStore'
import { usePrepStore } from '../store/prepStore'
import { useResumeStore } from '../store/resumeStore'
import { resolveStorage } from '../store/storage'
import { defaultResumeData } from '../store/defaultData'
import type { MatchReport } from '../types/match'

vi.mock('@tanstack/react-router', () => ({
  useSearch: () => ({ vector: 'backend', skills: '', q: '' }),
}))

describe('PrepPage', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_ANTHROPIC_PROXY_URL', 'https://ai.example/proxy')
    resolveStorage().removeItem('facet-prep-workspace')
    resolveStorage().removeItem('vector-resume-data')
    usePrepStore.setState({ decks: [], activeDeckId: null, activeMode: 'edit' })
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
                cards: [
                  {
                    category: 'opener',
                    title: 'Tell me about yourself',
                    tags: ['backend', 'acme'],
                    script: 'I build resilient backend systems and lead platform improvements.',
                    followUps: [
                      {
                        question: 'Why Acme?',
                        answer: 'The role blends platform scale with product-facing reliability.',
                      },
                    ],
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

  it('generates a deck from the selected pipeline entry', async () => {
    render(<PrepPage />)

    fireEvent.click(screen.getByText('Generate with AI'))

    await waitFor(() => {
      expect(usePrepStore.getState().decks).toHaveLength(1)
    })

    expect(screen.getAllByDisplayValue('Acme Staff Engineer Prep').length).toBeGreaterThan(0)
    expect(screen.getByDisplayValue('Tell me about yourself')).toBeTruthy()
    expect(screen.getByDisplayValue('Acme Corp')).toBeTruthy()
  })

  it('lets the user create a blank deck and add cards manually', async () => {
    render(<PrepPage />)

    fireEvent.click(screen.getAllByText('Blank Set')[0])

    expect(usePrepStore.getState().decks).toHaveLength(1)
    fireEvent.click(screen.getByText('Add Card'))

    await waitFor(() => {
      expect(usePrepStore.getState().decks[0].cards).toHaveLength(1)
    })

    expect(screen.getByDisplayValue('New Prep Card')).toBeTruthy()
  })

  it('switches between edit, homework, and live cheatsheet modes from the same deck', async () => {
    render(<PrepPage />)

    fireEvent.click(screen.getAllByText('Blank Set')[0])
    fireEvent.click(screen.getByText('Add Card'))

    expect(screen.getByRole('tab', { name: 'Edit' })).toBeTruthy()

    fireEvent.click(screen.getByRole('tab', { name: 'Homework' }))
    expect(usePrepStore.getState().activeMode).toBe('homework')
    expect(screen.getByLabelText('Homework mode')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Back to Edit' }))
    expect(usePrepStore.getState().activeMode).toBe('edit')

    fireEvent.click(screen.getByRole('tab', { name: 'Live Cheatsheet' }))
    expect(usePrepStore.getState().activeMode).toBe('live')
    expect(screen.getByText('Live Cheatsheet Preview')).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Live Cheatsheet' }).getAttribute('aria-selected')).toBe('true')
  })

  it('supports arrow-key focus movement across workspace mode tabs', () => {
    render(<PrepPage />)

    fireEvent.click(screen.getAllByText('Blank Set')[0])
    fireEvent.click(screen.getByText('Add Card'))

    const editTab = screen.getByRole('tab', { name: 'Edit' })
    const homeworkTab = screen.getByRole('tab', { name: 'Homework' })

    editTab.focus()
    fireEvent.keyDown(screen.getByRole('tablist', { name: 'Prep workspace modes' }), { key: 'ArrowRight' })

    expect(document.activeElement).toBe(homeworkTab)
  })

  it('falls back to a single edit empty state when no active deck exists', () => {
    usePrepStore.setState({ decks: [], activeDeckId: null, activeMode: 'live' })

    render(<PrepPage />)

    expect(screen.getByText('No prep sets yet')).toBeTruthy()
    expect(screen.queryByText('No deck ready yet')).toBeNull()
  })

  it('shows hosted upgrade messaging without blocking manual prep creation', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 402,
      text: async () =>
        JSON.stringify({
          code: 'ai_access_denied',
          reason: 'upgrade_required',
          feature: 'prep.generate',
          error: 'Upgrade to AI Pro to use this hosted AI feature.',
        }),
    }) as typeof fetch

    render(<PrepPage />)

    fireEvent.click(screen.getByText('Generate with AI'))

    await waitFor(() => {
      expect(screen.getByText('Upgrade to AI Pro to use this hosted AI feature.')).toBeTruthy()
    })

    fireEvent.click(screen.getAllByText('Blank Set')[0])

    expect(usePrepStore.getState().decks).toHaveLength(1)
    expect(screen.getAllByDisplayValue('Acme Corp Staff Engineer Interview Prep').length).toBeGreaterThan(0)
  })

  it('generates a prep deck from the current match report without a pipeline entry', async () => {
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
      topSkills: [
        {
          kind: 'skill',
          id: 'skill-1',
          label: 'AWS',
          sourceLabel: 'Infrastructure',
          text: 'AWS',
          tags: ['aws'],
          matchedTags: ['aws'],
          matchedKeywords: ['AWS'],
          matchedRequirementIds: ['req-1'],
          score: 0.8,
        },
      ],
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
      expect(usePrepStore.getState().decks).toHaveLength(1)
    })

    expect(screen.getAllByDisplayValue('Acme Staff Engineer Prep').length).toBeGreaterThan(0)
    expect(screen.getByDisplayValue('Atlas')).toBeTruthy()
  })
})
