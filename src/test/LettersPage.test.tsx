// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { LettersPage } from '../routes/letters/LettersPage'
import { useCoverLetterStore } from '../store/coverLetterStore'
import { usePipelineStore } from '../store/pipelineStore'
import { useResumeStore } from '../store/resumeStore'
import { resolveStorage } from '../store/storage'
import { defaultResumeData } from '../store/defaultData'

describe('LettersPage', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_ANTHROPIC_PROXY_URL', 'https://ai.example/proxy')
    resolveStorage().removeItem('facet-cover-letter-data')
    resolveStorage().removeItem('vector-resume-data')
    useCoverLetterStore.setState({ templates: [] })
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
          contact: 'Jordan Lee',
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
                name: 'Acme Staff Engineer Cover Letter',
                greeting: 'Dear Jordan Lee,',
                signOff: 'Sincerely,\nJane Smith',
                paragraphs: [
                  {
                    label: 'Opening',
                    text: 'I am excited to apply for the Staff Engineer role at Acme Corp.',
                  },
                  {
                    text: 'My background building resilient backend systems aligns with the role focus.',
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

  it('generates a template from the selected pipeline entry', async () => {
    render(<LettersPage />)

    fireEvent.click(screen.getByText('Generate with AI'))

    await waitFor(() => {
      expect(useCoverLetterStore.getState().templates).toHaveLength(1)
    })

    expect(screen.getByDisplayValue('Acme Staff Engineer Cover Letter')).toBeTruthy()
    expect(screen.getByDisplayValue('Dear Jordan Lee,')).toBeTruthy()
    expect(screen.getByDisplayValue('I am excited to apply for the Staff Engineer role at Acme Corp.')).toBeTruthy()
  })

  it('shows hosted upgrade messaging when AI generation is paywalled', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 402,
      text: async () =>
        JSON.stringify({
          code: 'ai_access_denied',
          reason: 'upgrade_required',
          feature: 'letters.generate',
          error: 'Upgrade to AI Pro to use this hosted AI feature.',
        }),
    }) as typeof fetch

    render(<LettersPage />)

    fireEvent.click(screen.getByText('Generate with AI'))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Upgrade to AI Pro')
    })

    expect(useCoverLetterStore.getState().templates).toHaveLength(0)
  })
})
