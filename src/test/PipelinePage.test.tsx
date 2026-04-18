// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PipelinePage } from '../routes/pipeline/PipelinePage'
import { usePipelineStore } from '../store/pipelineStore'

const mockNavigate = vi.fn()
const mockInvestigatePipelineEntry = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
}))

vi.mock('../utils/pipelineInvestigation', () => ({
  investigatePipelineEntry: (...args: unknown[]) => mockInvestigatePipelineEntry(...args),
}))

const baseEntry = {
  id: 'pipe-1',
  company: 'Acme Corp',
  role: 'Staff Platform Engineer',
  tier: '1' as const,
  status: 'researching' as const,
  comp: '$250k-$320k',
  url: 'https://example.com/jobs/acme',
  contact: '',
  vectorId: 'backend',
  jobDescription: '',
  presetId: null,
  resumeVariant: '',
  resumeGeneration: null,
  positioning: 'Lead with platform depth',
  skillMatch: 'Distributed systems and reliability',
  nextStep: 'Review opportunity and tailor resume',
  notes: 'Smaller team',
  appMethod: 'unknown' as const,
  response: 'none' as const,
  daysToResponse: null,
  rounds: null,
  format: [],
  rejectionStage: '' as const,
  rejectionReason: '',
  offerAmount: '',
  dateApplied: '',
  dateClosed: '',
  lastAction: '2026-04-14',
  createdAt: '2026-04-14',
  history: [],
}

describe('PipelinePage', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_ANTHROPIC_PROXY_URL', 'https://ai.example/proxy')
    mockNavigate.mockReset()
    mockInvestigatePipelineEntry.mockReset()
    usePipelineStore.setState({
      entries: [baseEntry],
      sortField: 'tier',
      sortDir: 'asc',
      filters: { tier: 'all', status: 'all', search: '' },
    })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllEnvs()
  })

  it('shows a guided empty state with one primary start action', () => {
    usePipelineStore.setState({
      entries: [],
      sortField: 'tier',
      sortDir: 'asc',
      filters: { tier: 'all', status: 'all', search: '' },
    })

    const { container } = render(<PipelinePage />)

    expect(screen.getByText('Start your opportunity pipeline')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Add Entry/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Paste JD/i })).toBeTruthy()
    expect(container.querySelectorAll('.pipeline-empty-actions .pipeline-btn-primary')).toHaveLength(1)
    expect(screen.getByText(/Add a role, paste a JD for faster capture/)).toBeTruthy()
  })

  it('keeps one primary add action in the populated header', () => {
    const { container } = render(<PipelinePage />)

    expect(screen.getByText('Execution Workspace')).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Add Entry$/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Paste JD$/i })).toBeTruthy()
    expect(container.querySelectorAll('.pipeline-header .pipeline-btn-primary')).toHaveLength(1)
  })

  it('disables pipeline investigation when the AI proxy is not configured', () => {
    vi.stubEnv('VITE_ANTHROPIC_PROXY_URL', '')

    render(<PipelinePage />)

    fireEvent.click(screen.getByText('Acme Corp'))

    const button = screen.getByRole('button', { name: /Investigate with AI/i }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(screen.getByText('AI research unavailable until the proxy is configured.')).toBeTruthy()
    fireEvent.click(button)
    expect(mockInvestigatePipelineEntry).not.toHaveBeenCalled()
  })

  it('renders seeded research details inside the pipeline detail view', async () => {
    usePipelineStore.setState({
      entries: [
        {
          ...baseEntry,
          research: {
            status: 'seeded',
            summary: 'Strong fit from the research phase.',
            jobDescriptionSummary: '',
            interviewSignals: [],
            people: [],
            sources: [
              {
                label: 'Acme Corp job posting',
                url: 'https://example.com/jobs/acme',
                kind: 'job-posting',
              },
            ],
            searchQueries: ['Acme staff platform engineer'],
            lastInvestigatedAt: '',
          },
        },
      ],
      sortField: 'tier',
      sortDir: 'asc',
      filters: { tier: 'all', status: 'all', search: '' },
    })

    render(<PipelinePage />)

    fireEvent.click(screen.getByText('Acme Corp'))

    expect(screen.getByText('Seeded from Research')).toBeTruthy()
    expect(screen.getByText('Strong fit from the research phase.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Acme Corp job posting' })).toBeTruthy()
  })

  it('investigates a pipeline job and renders the returned research', async () => {
    mockInvestigatePipelineEntry.mockResolvedValue({
      jobDescription: 'Lead platform reliability initiatives across product and infrastructure.',
      format: ['hr-screen', 'system-design'],
      nextStep: 'Prepare a reliability-focused system design story.',
      research: {
        status: 'investigated',
        summary: 'Public signals point to a platform reliability leadership role.',
        jobDescriptionSummary: 'Reliability, developer experience, and platform leadership.',
        interviewSignals: ['Public reports mention a recruiter screen and system design round.'],
        people: [
          {
            name: 'Jordan Lee',
            title: 'Director of Platform',
            company: 'Acme Corp',
            profileUrl: 'https://www.linkedin.com/in/jordan-lee',
            relevance: 'Likely org lead for the team.',
          },
        ],
        sources: [
          {
            label: 'Acme careers',
            url: 'https://example.com/jobs/acme',
            kind: 'job-posting',
          },
        ],
        searchQueries: ['Acme platform interview process'],
        lastInvestigatedAt: '2026-04-14T10:00:00.000Z',
      },
    })

    render(<PipelinePage />)

    fireEvent.click(screen.getByText('Acme Corp'))
    fireEvent.click(screen.getByRole('button', { name: /Investigate with AI/i }))

    await waitFor(() => {
      expect(mockInvestigatePipelineEntry).toHaveBeenCalledTimes(1)
      expect(mockInvestigatePipelineEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'pipe-1',
          company: 'Acme Corp',
          role: 'Staff Platform Engineer',
        }),
        'https://ai.example/proxy',
      )
    })

    await waitFor(() => {
      expect(screen.getAllByText('Investigated with AI').length).toBeGreaterThan(0)
      expect(screen.getByText('Public signals point to a platform reliability leadership role.')).toBeTruthy()
    })

    expect(screen.getByText('Public reports mention a recruiter screen and system design round.')).toBeTruthy()
    expect(screen.getByText('Jordan Lee')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Acme careers' })).toBeTruthy()
    expect(usePipelineStore.getState().entries[0]?.format).toEqual(['hr-screen', 'system-design'])
    expect(usePipelineStore.getState().entries[0]?.jobDescription).toContain('Lead platform reliability initiatives')
    expect(usePipelineStore.getState().entries[0]?.history.at(-1)?.note).toBe('Investigated with AI')
  }, 10000)

  it('shows an error and keeps store state unchanged when investigation fails', async () => {
    mockInvestigatePipelineEntry.mockRejectedValue(new Error('Proxy search failed'))

    render(<PipelinePage />)

    fireEvent.click(screen.getByText('Acme Corp'))
    fireEvent.click(screen.getByRole('button', { name: /Investigate with AI/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Proxy search failed')
    })

    expect(usePipelineStore.getState().entries[0]?.research).toBeUndefined()
    expect(usePipelineStore.getState().entries[0]?.history).toEqual([])
  })

  it('groups detail actions by research, execution, and management intent', () => {
    render(<PipelinePage />)

    fireEvent.click(screen.getByText('Acme Corp'))

    expect(screen.getByText('Research')).toBeTruthy()
    expect(screen.getByText('Execution')).toBeTruthy()
    expect(screen.getByText('Management')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Investigate with AI/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Open in Builder/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Edit/i })).toBeTruthy()
  })
})
