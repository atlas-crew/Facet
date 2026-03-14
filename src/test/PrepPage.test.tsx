// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PrepPage } from '../routes/prep/PrepPage'
import { usePipelineStore } from '../store/pipelineStore'
import { usePrepStore } from '../store/prepStore'
import { useResumeStore } from '../store/resumeStore'
import { resolveStorage } from '../store/storage'
import { defaultResumeData } from '../store/defaultData'

vi.mock('@tanstack/react-router', () => ({
  useSearch: () => ({ vector: 'backend', skills: '', q: '' }),
}))

describe('PrepPage', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_ANTHROPIC_PROXY_URL', 'https://ai.example/proxy')
    resolveStorage().removeItem('facet-prep-workspace')
    resolveStorage().removeItem('vector-resume-data')
    usePrepStore.setState({ decks: [], activeDeckId: null })
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
})
