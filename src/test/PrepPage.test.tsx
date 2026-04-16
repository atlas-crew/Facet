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

const navigateMock = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
  useSearch: () => ({ vector: 'backend', skills: '', q: '' }),
}))

describe('PrepPage', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_ANTHROPIC_PROXY_URL', 'https://ai.example/proxy')
    resolveStorage().removeItem('facet-prep-workspace')
    resolveStorage().removeItem('vector-resume-data')
    navigateMock.mockClear()
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

    const liveLaunch = screen.getByRole('button', { name: 'Live Cheatsheet' })
    fireEvent.click(liveLaunch)
    expect(navigateMock).toHaveBeenCalledWith({ to: '/prep/live' })
    expect(usePrepStore.getState().activeMode).toBe('edit')
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

    expect(screen.getByRole('tabpanel', { name: 'Edit' })).toBeTruthy()
    expect(screen.getByText('No prep sets yet')).toBeTruthy()
    expect(screen.queryByText('No deck ready yet')).toBeNull()
  })

  it('groups the edit workspace into deck, source, and card editing sections', () => {
    render(<PrepPage />)

    fireEvent.click(screen.getAllByText('Blank Set')[0])

    expect(screen.getByText('Prep Library')).toBeTruthy()
    expect(screen.getByText('Deck Basics')).toBeTruthy()
    expect(screen.getByText('Source Material')).toBeTruthy()
    expect(screen.getByText('Card Library')).toBeTruthy()
    expect(screen.getByText('Editable Cards')).toBeTruthy()
  })

  it('shows round labels, next up, muted older decks, and overflow expansion in the prep library', () => {
    usePrepStore.setState({
      decks: [
        {
          id: 'deck-1',
          title: 'Acme Legacy Prep',
          company: 'Acme',
          role: 'Platform Engineer',
          roundType: 'hm-screen',
          vectorId: 'backend',
          pipelineEntryId: null,
          updatedAt: '2026-04-11T00:00:00.000Z',
          cards: [],
        },
        {
          id: 'deck-2',
          title: 'Acme Mid Prep',
          company: 'Acme',
          role: 'Security Engineer',
          roundType: 'tech-discussion',
          vectorId: 'security',
          pipelineEntryId: null,
          updatedAt: '2026-04-12T00:00:00.000Z',
          cards: [],
        },
        {
          id: 'deck-3',
          title: 'Acme Technical Prep',
          company: 'Acme',
          role: 'Systems Engineer',
          roundType: 'system-design',
          vectorId: 'systems',
          pipelineEntryId: null,
          updatedAt: '2026-04-13T00:00:00.000Z',
          cards: [],
        },
        {
          id: 'deck-4',
          title: 'Acme Behavioral Prep',
          company: 'Acme',
          role: 'Staff Engineer',
          roundType: 'behavioral',
          vectorId: 'behavioral',
          pipelineEntryId: null,
          updatedAt: '2026-04-14T00:00:00.000Z',
          cards: [],
        },
        {
          id: 'deck-5',
          title: 'Acme Systems Prep',
          company: 'Acme',
          role: 'Senior Engineer',
          roundType: 'take-home',
          vectorId: 'takehome',
          pipelineEntryId: null,
          updatedAt: '2026-04-15T00:00:00.000Z',
          cards: [],
        },
        {
          id: 'deck-6',
          title: 'Acme Most Recent Prep',
          company: 'Acme',
          role: 'Principal Engineer',
          roundType: 'hm-screen',
          vectorId: 'principal',
          pipelineEntryId: null,
          updatedAt: '2026-04-16T00:00:00.000Z',
          cards: [],
        },
      ],
      activeDeckId: 'deck-1',
      activeMode: 'edit',
    })

    render(<PrepPage />)

    expect(screen.getByText('HM Screen')).toBeTruthy()
    expect(screen.getByText('System Design')).toBeTruthy()
    expect(screen.getByText('Next Up')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Acme Most Recent Prep/i }).getAttribute('aria-current')).toBeNull()
    expect(screen.getByRole('button', { name: /Acme Systems Prep/i }).getAttribute('data-muted')).toBe('true')
    expect(screen.getAllByRole('button', { name: /Acme .* Prep/i })).toHaveLength(5)

    fireEvent.click(screen.getByRole('button', { name: /Acme Most Recent Prep/i }))

    expect(usePrepStore.getState().activeDeckId).toBe('deck-6')
    expect(screen.getByRole('button', { name: /Acme Most Recent Prep/i }).getAttribute('aria-current')).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: /1 more/i }))

    expect(screen.getAllByRole('button', { name: /Acme .* Prep/i })).toHaveLength(6)
    expect(screen.getByRole('button', { name: /Show less/i })).toBeTruthy()
  })

  it('shows fallback labels for missing and unknown round types in the prep library', () => {
    usePrepStore.setState({
      decks: [
        {
          id: 'deck-general',
          title: 'General Prep',
          company: 'Beta',
          role: 'Engineer',
          roundType: undefined,
          vectorId: 'backend',
          pipelineEntryId: null,
          updatedAt: 'invalid-date',
          cards: [],
        } as any,
        {
          id: 'deck-unknown',
          title: 'Unknown Round Prep',
          company: 'Beta',
          role: 'Engineer',
          roundType: 'product-strategy',
          vectorId: 'backend',
          pipelineEntryId: null,
          updatedAt: '2026-04-16T00:00:00.000Z',
          cards: [],
        } as any,
      ],
      activeDeckId: 'deck-general',
      activeMode: 'edit',
    })

    render(<PrepPage />)

    expect(screen.getByText('General')).toBeTruthy()
    expect(screen.getByText('Product Strategy')).toBeTruthy()
    expect(screen.getByText('Updated recently')).toBeTruthy()
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
