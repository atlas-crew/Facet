// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PipelinePage } from '../routes/pipeline/PipelinePage'
import { useHandoffStore } from '../store/handoffStore'
import { useIdentityStore } from '../store/identityStore'
import { useJDAnalysisStore } from '../store/jdAnalysisStore'
import { usePipelineStore } from '../store/pipelineStore'
import { useUiStore } from '../store/uiStore'
import { untagged, untaggedNote } from '../types/audience'
import { JD_ANALYSIS_MODEL_VERSION, type JDAnalysis } from '../types/jdAnalysis'
import { hashJobDescriptionText } from '../utils/jdAnalysis'

const mockNavigate = vi.fn()
const mockUseSearch = vi.fn()
const mockInvestigatePipelineEntry = vi.fn()
const mockAnalyzePipelineJobDescription = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
  useSearch: () => mockUseSearch(),
}))

vi.mock('../utils/pipelineInvestigation', () => ({
  investigatePipelineEntry: (...args: unknown[]) => mockInvestigatePipelineEntry(...args),
}))

vi.mock('../utils/jdAnalysis', async () => {
  const actual = await vi.importActual<typeof import('../utils/jdAnalysis')>('../utils/jdAnalysis')
  return {
    ...actual,
    analyzePipelineJobDescription: (...args: unknown[]) => mockAnalyzePipelineJobDescription(...args),
  }
})

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

const analyzedJobDescription = 'We need a platform-minded engineer.'

const jdAnalysisFixture: JDAnalysis = {
  id: 'analysis-1',
  pipelineEntryId: 'pipe-1',
  jdTextHash: hashJobDescriptionText(analyzedJobDescription),
  identityVersion: 1,
  modelVersion: JD_ANALYSIS_MODEL_VERSION,
  audienceRulesVersion: 'audience-rules.v1',
  generatedAt: '2026-04-14T12:00:00.000Z',
  updatedAt: '2026-04-14T12:00:00.000Z',
  warnings: [untaggedNote('Review the Kubernetes requirement before applying.')],
  company: 'Acme Corp',
  role: 'Staff Platform Engineer',
  summary: 'Platform reliability role.',
  analyzedJobDescription,
  jobDescriptionWordCount: 5,
  jobDescriptionTruncated: false,
  requirements: [],
  overallFit: 'strong',
  fitScore: 0.86,
  confidence: 'high',
  recommendation: 'apply',
  oneLineSummary: 'Lead with platform reliability.',
  rationale: 'Strong platform match.',
  matchedVectors: [
    untagged({
      vectorId: 'backend',
      title: 'Backend Platform',
      priority: 'high',
      matchStrength: 'strong',
      evidence: ['Platform reliability leadership'],
      thesisApplies: true,
      thesisFitExplanation: 'The role emphasizes platform reliability.',
    }),
  ],
  primaryVectorId: 'backend',
  skillMatches: [],
  evidenceMapping: {
    topBullets: [],
    topSkills: [],
    topProjects: [],
    topProfiles: [],
    topPhilosophy: [],
  },
  strengthsToLead: [untaggedNote('Reliability leadership')],
  advantages: [],
  advantageHypotheses: [],
  gaps: [
    untagged({
      requirementId: 'req-1',
      label: 'Kubernetes',
      severity: 'medium',
      reason: 'JD mentions Kubernetes ownership.',
      tags: ['platform'],
    }),
  ],
  gapFocus: [],
  watchOuts: [],
  triggeredPrioritize: [],
  triggeredAvoid: [],
  relevantAwareness: [],
  positioningRecommendations: [untaggedNote('Lead with platform reliability.')],
  requirementCoverageScore: 0.8,
  matchedRequirementIds: [],
  matchedKeywords: ['platform'],
}

describe('PipelinePage', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_ANTHROPIC_PROXY_URL', 'https://ai.example/proxy')
    mockNavigate.mockReset()
    mockUseSearch.mockReset()
    mockUseSearch.mockReturnValue({})
    mockInvestigatePipelineEntry.mockReset()
    mockAnalyzePipelineJobDescription.mockReset()
    mockAnalyzePipelineJobDescription.mockResolvedValue(jdAnalysisFixture)
    useHandoffStore.setState({ pendingGeneration: null })
    useJDAnalysisStore.setState({ analyses: [] })
    useUiStore.setState({ selectedVector: 'all' })
    useIdentityStore.setState({
      currentIdentity: { model_revision: 1 } as Parameters<typeof mockAnalyzePipelineJobDescription>[0],
    })
    usePipelineStore.setState({
      entries: [baseEntry],
      sortField: 'tier',
      sortDir: 'asc',
      filters: { tier: 'all', status: 'all', search: '' },
    })
  })

  it('expands a linked pipeline entry from the search param', () => {
    mockUseSearch.mockReturnValue({ entry: 'pipe-1' })

    render(<PipelinePage />)

    expect(screen.getByText('Positioning')).toBeTruthy()
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
    expect(screen.getByText('Not run')).toBeTruthy()
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
    expect(screen.getByText('Strong fit from the research phase.', { selector: '.pipeline-card-summary-text' })).toBeTruthy()
    const researchButton = screen.getByRole('button', { name: /^Research$/i })
    const researchPanel = document.getElementById(researchButton.getAttribute('aria-controls') ?? '')
    expect(researchButton.getAttribute('aria-expanded')).toBe('false')
    expect(researchPanel?.hasAttribute('hidden')).toBe(true)
    fireEvent.click(researchButton)
    expect(researchButton.getAttribute('aria-expanded')).toBe('true')
    expect(researchPanel?.hasAttribute('hidden')).toBe(false)
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
        people: [],
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
      expect(screen.getAllByText('Public signals point to a platform reliability leadership role.').length).toBeGreaterThan(0)
    })

    fireEvent.click(screen.getByRole('button', { name: /^Research$/i }))
    expect(screen.getByText('Public reports mention a recruiter screen and system design round.')).toBeTruthy()
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

    expect(screen.queryByRole('button', { name: /^Research$/i })).toBeNull()
    expect(usePipelineStore.getState().entries[0]?.research).toBeUndefined()
    expect(usePipelineStore.getState().entries[0]?.history).toEqual([])
  })

  it('groups detail actions by research, execution, and management intent', () => {
    render(<PipelinePage />)

    fireEvent.click(screen.getByText('Acme Corp'))

    expect(screen.getByText('Research')).toBeTruthy()
    expect(screen.getByText('Execution')).toBeTruthy()
    expect(screen.getByText('Management')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Research$/i })).toBeNull()
    expect(screen.getByRole('button', { name: /Investigate with AI/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Open in Builder/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Edit/i })).toBeTruthy()
  })

  it('analyzes a pipeline JD and stores the canonical analysis reference', async () => {
    usePipelineStore.setState({
      entries: [
        {
          ...baseEntry,
          jobDescription: analyzedJobDescription,
        },
      ],
      sortField: 'tier',
      sortDir: 'asc',
      filters: { tier: 'all', status: 'all', search: '' },
    })

    render(<PipelinePage />)

    fireEvent.click(screen.getByText('Acme Corp'))
    fireEvent.click(screen.getByRole('button', { name: /Analyze JD/i }))

    await waitFor(() => {
      expect(mockAnalyzePipelineJobDescription).toHaveBeenCalledWith({
        endpoint: 'https://ai.example/proxy',
        pipelineEntryId: 'pipe-1',
        jobDescription: analyzedJobDescription,
        identity: { model_revision: 1 },
      })
    })

    await waitFor(() => {
      expect(useJDAnalysisStore.getState().findByPipelineEntry('pipe-1')?.id).toBe('analysis-1')
      expect(usePipelineStore.getState().entries[0]?.jdAnalysisId).toBe('analysis-1')
    })
    expect(usePipelineStore.getState().entries[0]?.history.at(-1)?.note).toBe('Analyzed JD')
  })

  it('collapses and expands dense cards inside a pipeline entry', () => {
    usePipelineStore.setState({
      entries: [
        {
          ...baseEntry,
          history: [
            { date: '2026-04-10', note: 'Applied' },
            { date: '2026-04-14', note: 'Recruiter replied' },
          ],
          interviewRounds: [
            {
              id: 'round-1',
              label: 'Technical panel',
              format: 'system-design',
              durationMinutes: 60,
              interviewers: [
                {
                  id: 'interviewer-1',
                  name: 'Dana Lee',
                  title: 'Engineering Manager',
                },
              ],
              notes: 'Prepare reliability architecture story.',
              createdAt: '2026-04-14T12:00:00.000Z',
              updatedAt: '2026-04-14T12:00:00.000Z',
            },
          ],
        },
      ],
      sortField: 'tier',
      sortDir: 'asc',
      filters: { tier: 'all', status: 'all', search: '' },
    })

    render(<PipelinePage />)

    fireEvent.click(screen.getByText('Acme Corp'))
    expect(screen.getByRole('button', { name: /^Rounds \(1\)$/i }).getAttribute('aria-expanded')).toBe('false')
    const roundsButton = screen.getByRole('button', { name: /^Rounds \(1\)$/i })
    const roundsPanel = document.getElementById(roundsButton.getAttribute('aria-controls') ?? '')
    expect(roundsPanel?.hasAttribute('hidden')).toBe(true)
    expect(screen.getByText('1 round tracked')).toBeTruthy()
    expect(screen.getByText('Recruiter replied')).toBeTruthy()
    const historyButton = screen.getByRole('button', { name: /^History \(2\)$/i })
    const historyPanel = document.getElementById(historyButton.getAttribute('aria-controls') ?? '')
    expect(historyPanel?.hasAttribute('hidden')).toBe(true)

    fireEvent.click(roundsButton)
    expect(roundsButton.getAttribute('aria-expanded')).toBe('true')
    expect(roundsPanel?.hasAttribute('hidden')).toBe(false)
    expect(screen.getByText('Technical panel')).toBeTruthy()
    expect(screen.getByText('System Design · 1 interviewer')).toBeTruthy()
    const roundExpandButton = screen.getByRole('button', { name: /Expand Technical panel round/i })
    const roundPanel = document.getElementById(roundExpandButton.getAttribute('aria-controls') ?? '')
    expect(roundPanel?.hasAttribute('hidden')).toBe(true)

    fireEvent.click(roundExpandButton)
    expect(screen.getByDisplayValue('Technical panel')).toBeTruthy()
    const roundCollapseButton = screen.getByRole('button', { name: /Collapse Technical panel round/i })
    expect(roundPanel?.hasAttribute('hidden')).toBe(false)
    expect(screen.getByRole('option', { name: 'System Design' })).toBeTruthy()
    expect(screen.queryByRole('option', { name: 'system-design' })).toBeNull()
    expect(screen.getByLabelText('Interviewer name')).toHaveProperty('value', 'Dana Lee')
    expect(screen.getByDisplayValue('Prepare reliability architecture story.')).toBeTruthy()

    fireEvent.click(roundCollapseButton)
    expect(roundPanel?.hasAttribute('hidden')).toBe(true)
    expect(screen.getByText('System Design · 1 interviewer')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Expand Technical panel round/i }))
    expect(roundPanel?.hasAttribute('hidden')).toBe(false)

    fireEvent.click(historyButton)
    expect(historyButton.getAttribute('aria-expanded')).toBe('true')
    expect(historyPanel?.hasAttribute('hidden')).toBe(false)
    expect(screen.getByText('Applied', { selector: '.pipeline-history-note' })).toBeTruthy()

    fireEvent.click(historyButton)
    expect(historyButton.getAttribute('aria-expanded')).toBe('false')
    expect(historyPanel?.hasAttribute('hidden')).toBe(true)
  })

  it('opens the rounds card when adding a round from the collapsed state', () => {
    render(<PipelinePage />)

    fireEvent.click(screen.getByText('Acme Corp'))
    const roundsButton = screen.getByRole('button', { name: /^Rounds \(0\)$/i })
    const roundsPanel = document.getElementById(roundsButton.getAttribute('aria-controls') ?? '')
    expect(roundsButton.getAttribute('aria-expanded')).toBe('false')
    expect(roundsPanel?.hasAttribute('hidden')).toBe(true)
    expect(screen.getByText('No structured rounds')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /^Add Round$/i }))

    expect(screen.getByRole('button', { name: /^Rounds \(1\)$/i }).getAttribute('aria-expanded')).toBe('true')
    expect(roundsPanel?.hasAttribute('hidden')).toBe(false)
    expect(screen.queryByText('HR screen · 0 interviewers')).toBeNull()
    expect(screen.getByRole('button', { name: /Collapse New round round/i }).getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByDisplayValue('New round')).toBeTruthy()
  })

  it('summarizes plural round counts and unnamed collapsed rounds', () => {
    usePipelineStore.setState({
      entries: [
        {
          ...baseEntry,
          interviewRounds: [
            {
              id: 'round-1',
              label: '',
              format: 'exec',
              durationMinutes: 30,
              interviewers: [],
              createdAt: '2026-04-14T12:00:00.000Z',
              updatedAt: '2026-04-14T12:00:00.000Z',
            },
            {
              id: 'round-2',
              label: 'Peer panel',
              format: 'peer-panel',
              durationMinutes: 60,
              interviewers: [
                { id: 'interviewer-1', name: 'Dana Lee' },
                { id: 'interviewer-2', name: 'Sam Patel' },
              ],
              createdAt: '2026-04-15T12:00:00.000Z',
              updatedAt: '2026-04-15T12:00:00.000Z',
            },
          ],
        },
      ],
      sortField: 'tier',
      sortDir: 'asc',
      filters: { tier: 'all', status: 'all', search: '' },
    })

    render(<PipelinePage />)

    fireEvent.click(screen.getByText('Acme Corp'))
    expect(screen.getByRole('button', { name: /^Rounds \(2\)$/i }).getAttribute('aria-expanded')).toBe('false')
    expect(screen.getByText('2 rounds tracked')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /^Rounds \(2\)$/i }))
    expect(screen.getByRole('button', { name: /Expand untitled round/i })).toBeTruthy()
    expect(screen.getByText('Executive · 0 interviewers')).toBeTruthy()
    expect(screen.getByText('Peer Panel · 2 interviewers')).toBeTruthy()
  })

  it('resets collapsed card state when switching between pipeline entries', () => {
    const research = {
      status: 'seeded' as const,
      summary: 'Research preview.',
      jobDescriptionSummary: '',
      interviewSignals: [],
      people: [],
      sources: [],
      searchQueries: [],
      lastInvestigatedAt: '',
    }
    const history = [{ date: '2026-04-14', note: 'Recruiter replied' }]
    const interviewRounds = [
      {
        id: 'round-1',
        label: 'Technical panel',
        format: 'system-design' as const,
        durationMinutes: 60,
        interviewers: [],
        createdAt: '2026-04-14T12:00:00.000Z',
        updatedAt: '2026-04-14T12:00:00.000Z',
      },
    ]
    usePipelineStore.setState({
      entries: [
        { ...baseEntry, id: 'pipe-1', company: 'Acme Corp', research, history, interviewRounds },
        { ...baseEntry, id: 'pipe-2', company: 'Beta Systems', research, history, interviewRounds },
      ],
      sortField: 'tier',
      sortDir: 'asc',
      filters: { tier: 'all', status: 'all', search: '' },
    })

    render(<PipelinePage />)

    fireEvent.click(screen.getByText('Acme Corp'))
    fireEvent.click(screen.getByRole('button', { name: /^Research$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^Rounds \(1\)$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^History \(1\)$/i }))
    expect(screen.getByRole('button', { name: /^Research$/i }).getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('button', { name: /^Rounds \(1\)$/i }).getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('button', { name: /^History \(1\)$/i }).getAttribute('aria-expanded')).toBe('true')

    fireEvent.click(screen.getByText('Beta Systems'))
    expect(screen.getByRole('button', { name: /^Research$/i }).getAttribute('aria-expanded')).toBe('false')
    expect(screen.getByRole('button', { name: /^Rounds \(1\)$/i }).getAttribute('aria-expanded')).toBe('false')
    expect(screen.getByRole('button', { name: /^History \(1\)$/i }).getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(screen.getByText('Acme Corp'))
    expect(screen.getByRole('button', { name: /^Research$/i }).getAttribute('aria-expanded')).toBe('false')
    expect(screen.getByRole('button', { name: /^Rounds \(1\)$/i }).getAttribute('aria-expanded')).toBe('false')
    expect(screen.getByRole('button', { name: /^History \(1\)$/i }).getAttribute('aria-expanded')).toBe('false')
  })

  it('shows and opens a saved JD analysis from the pipeline tracker', () => {
    usePipelineStore.setState({
      entries: [
        {
          ...baseEntry,
          jobDescription: analyzedJobDescription,
          jdAnalysisId: 'analysis-1',
        },
      ],
      sortField: 'tier',
      sortDir: 'asc',
      filters: { tier: 'all', status: 'all', search: '' },
    })
    useJDAnalysisStore.setState({ analyses: [jdAnalysisFixture] })

    render(<PipelinePage />)

    expect(screen.getByText('JD saved')).toBeTruthy()
    fireEvent.click(screen.getByText('Acme Corp'))
    const showButton = screen.getByRole('button', { name: /Show JD Analysis/i })
    expect(showButton.getAttribute('aria-expanded')).toBe('false')
    const panelId = showButton.getAttribute('aria-controls')
    expect(panelId).toBeTruthy()
    fireEvent.click(showButton)

    expect(screen.getByRole('heading', { name: /Lead with platform reliability/i })).toBeTruthy()
    expect(document.getElementById(panelId ?? '')).toBeTruthy()
    const hideButton = screen.getByRole('button', { name: /Hide JD Analysis/i })
    expect(hideButton.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('86%')).toBeTruthy()
    expect(screen.getByText('Strong')).toBeTruthy()
    expect(screen.getByText('High')).toBeTruthy()
    expect(screen.getByText('Apply')).toBeTruthy()
    expect(screen.getByText('Platform reliability role.')).toBeTruthy()
    expect(screen.getByText('Strong platform match.')).toBeTruthy()
    expect(screen.getByText(/Acme Corp.*Staff Platform Engineer/)).toBeTruthy()
    expect(screen.getByText('Backend Platform (primary): Strong')).toBeTruthy()
    expect(screen.getByText('Reliability leadership')).toBeTruthy()
    expect(screen.getAllByText('Lead with platform reliability.').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('Kubernetes: JD mentions Kubernetes ownership.')).toBeTruthy()
    expect(screen.getByText('Review the Kubernetes requirement before applying.')).toBeTruthy()

    fireEvent.click(hideButton)
    expect(screen.queryByRole('heading', { name: /Lead with platform reliability/i })).toBeNull()
    expect(screen.getByRole('button', { name: /Show JD Analysis/i }).getAttribute('aria-expanded')).toBe('false')
  })

  it('opens missing saved JD analysis references as non-destructive unavailable state', () => {
    usePipelineStore.setState({
      entries: [
        {
          ...baseEntry,
          jobDescription: analyzedJobDescription,
          jdAnalysisId: 'analysis-missing',
        },
      ],
      sortField: 'tier',
      sortDir: 'asc',
      filters: { tier: 'all', status: 'all', search: '' },
    })

    render(<PipelinePage />)

    expect(screen.getByText('Analysis missing')).toBeTruthy()
    fireEvent.click(screen.getByText('Acme Corp'))
    expect(screen.getByText(/Saved JD analysis reference is missing/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Show JD Analysis/i }))

    expect(screen.getByRole('heading', { name: /Saved analysis unavailable/i })).toBeTruthy()
    expect(screen.getByText(/analysis artifact is no longer available/i)).toBeTruthy()
    expect(useJDAnalysisStore.getState().analyses).toEqual([])
  })

  it('marks saved JD analysis as stale when source inputs change', () => {
    usePipelineStore.setState({
      entries: [
        {
          ...baseEntry,
          jobDescription: 'This JD has changed since the saved analysis.',
          jdAnalysisId: 'analysis-1',
        },
      ],
      sortField: 'tier',
      sortDir: 'asc',
      filters: { tier: 'all', status: 'all', search: '' },
    })
    useJDAnalysisStore.setState({ analyses: [jdAnalysisFixture] })

    render(<PipelinePage />)

    expect(screen.getByText('JD stale')).toBeTruthy()
    fireEvent.click(screen.getByText('Acme Corp'))
    expect(screen.getByText(/Saved JD analysis may need review/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Show JD Analysis/i }))
    expect(screen.getByText(/^Saved analysis may need review because the job description changed\.$/i)).toBeTruthy()
  })

  it('shows saved analysis as pending, not stale, when identity is unloaded', () => {
    useIdentityStore.setState({ currentIdentity: null })
    usePipelineStore.setState({
      entries: [
        {
          ...baseEntry,
          jobDescription: analyzedJobDescription,
          jdAnalysisId: 'analysis-1',
        },
      ],
      sortField: 'tier',
      sortDir: 'asc',
      filters: { tier: 'all', status: 'all', search: '' },
    })
    useJDAnalysisStore.setState({ analyses: [jdAnalysisFixture] })

    render(<PipelinePage />)

    const tableBadge = screen.getByText('JD saved')
    expect(tableBadge.className).toContain('is-pending')
    fireEvent.click(screen.getByText('Acme Corp'))
    fireEvent.click(screen.getByRole('button', { name: /Show JD Analysis/i }))
    expect(screen.getByText('Saved')).toBeTruthy()
    expect(screen.queryByText(/Saved analysis may need review/i)).toBeNull()
  })

  it('still marks JD drift as stale when identity is unloaded', () => {
    useIdentityStore.setState({ currentIdentity: null })
    usePipelineStore.setState({
      entries: [
        {
          ...baseEntry,
          jobDescription: 'The job description changed after analysis.',
          jdAnalysisId: 'analysis-1',
        },
      ],
      sortField: 'tier',
      sortDir: 'asc',
      filters: { tier: 'all', status: 'all', search: '' },
    })
    useJDAnalysisStore.setState({ analyses: [jdAnalysisFixture] })

    render(<PipelinePage />)

    expect(screen.getByText('JD stale')).toBeTruthy()
    fireEvent.click(screen.getByText('Acme Corp'))
    fireEvent.click(screen.getByRole('button', { name: /Show JD Analysis/i }))
    expect(screen.getByText(/^Saved analysis may need review because the job description changed\.$/i)).toBeTruthy()
  })

  it('explains identity and model drift in the saved analysis panel', () => {
    useIdentityStore.setState({
      currentIdentity: { model_revision: 2 } as Parameters<typeof mockAnalyzePipelineJobDescription>[0],
    })
    usePipelineStore.setState({
      entries: [
        {
          ...baseEntry,
          jobDescription: analyzedJobDescription,
          jdAnalysisId: 'analysis-1',
        },
      ],
      sortField: 'tier',
      sortDir: 'asc',
      filters: { tier: 'all', status: 'all', search: '' },
    })
    useJDAnalysisStore.setState({
      analyses: [
        {
          ...jdAnalysisFixture,
          modelVersion: 'jd-analysis.v0.old',
        },
      ],
    })

    render(<PipelinePage />)

    expect(screen.getByText('JD stale')).toBeTruthy()
    fireEvent.click(screen.getByText('Acme Corp'))
    fireEvent.click(screen.getByRole('button', { name: /Show JD Analysis/i }))
    expect(screen.getByText(/the identity model changed/i)).toBeTruthy()
    expect(screen.getByText(/the analysis model changed/i)).toBeTruthy()
  })

  it('requires canonical JD analysis before generating a resume from raw JD text', async () => {
    usePipelineStore.setState({
      entries: [
        {
          ...baseEntry,
          jobDescription: analyzedJobDescription,
        },
      ],
      sortField: 'tier',
      sortDir: 'asc',
      filters: { tier: 'all', status: 'all', search: '' },
    })

    render(<PipelinePage />)

    fireEvent.click(screen.getByText('Acme Corp'))
    expect(screen.getByRole('button', { name: /Analyze JD/i })).toBeTruthy()
    const generateButton = screen.getByRole('button', { name: /Generate Resume/i })
    expect(generateButton.getAttribute('aria-disabled')).toBe('true')
    const hintId = generateButton.getAttribute('aria-describedby')
    expect(hintId).toBeTruthy()
    expect(document.getElementById(hintId ?? '')?.textContent).toContain('Analyze JD before generating')
    fireEvent.click(generateButton)
    expect(screen.getByRole('alert').textContent).toContain('Analyze this JD from Pipeline')
    expect(useHandoffStore.getState().pendingGeneration).toBeNull()
    expect(mockNavigate).not.toHaveBeenCalledWith({ to: '/build' })

    fireEvent.click(screen.getByRole('button', { name: /Analyze JD/i }))
    await waitFor(() => {
      expect(useJDAnalysisStore.getState().findByPipelineEntry('pipe-1')?.id).toBe('analysis-1')
    })
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('treats whitespace-only job descriptions as missing before opening Build', () => {
    usePipelineStore.setState({
      entries: [
        {
          ...baseEntry,
          jobDescription: '   ',
        },
      ],
      sortField: 'tier',
      sortDir: 'asc',
      filters: { tier: 'all', status: 'all', search: '' },
    })

    render(<PipelinePage />)

    fireEvent.click(screen.getByText('Acme Corp'))
    fireEvent.click(screen.getByRole('button', { name: /Open in Builder/i }))
    expect(screen.queryByRole('button', { name: /Generate Resume/i })).toBeNull()
    expect(useUiStore.getState().selectedVector).toBe('backend')
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/build' })
  })

  it('opens pipeline entries in Build using canonical JD analysis and the structured generation handoff', () => {
    usePipelineStore.setState({
      entries: [
        {
          ...baseEntry,
          jobDescription: analyzedJobDescription,
          jdAnalysisId: 'analysis-1',
        },
      ],
      sortField: 'tier',
      sortDir: 'asc',
      filters: { tier: 'all', status: 'all', search: '' },
    })
    useJDAnalysisStore.setState({ analyses: [jdAnalysisFixture] })

    render(<PipelinePage />)

    fireEvent.click(screen.getByText('Acme Corp'))
    expect(screen.getByRole('button', { name: /Generate Cover Letter/i })).toHaveProperty('disabled', true)
    fireEvent.click(screen.getByRole('button', { name: /Generate Resume/i }))

    expect(useHandoffStore.getState().pendingGeneration).toMatchObject({
      mode: 'dynamic',
      vectorMode: 'manual',
      source: 'pipeline',
      jobDescription: analyzedJobDescription,
      pipelineEntryId: baseEntry.id,
      primaryVectorId: 'backend',
      vectorIds: ['backend'],
    })
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/build' })
  })
})
