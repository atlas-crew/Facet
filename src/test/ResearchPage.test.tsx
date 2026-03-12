// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { defaultResumeData } from '../store/defaultData'
import { usePipelineStore } from '../store/pipelineStore'
import { useResumeStore } from '../store/resumeStore'
import { useSearchStore } from '../store/searchStore'
import { resolveStorage } from '../store/storage'

const { mockNavigate } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
}))

const { mockInferSearchProfile, mockExecuteSearch } = vi.hoisted(() => ({
  mockInferSearchProfile: vi.fn(),
  mockExecuteSearch: vi.fn(),
}))

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-router')>('@tanstack/react-router')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('../utils/searchProfileInference', async () => {
  const actual = await vi.importActual<typeof import('../utils/searchProfileInference')>('../utils/searchProfileInference')
  return {
    ...actual,
    inferSearchProfile: (...args: Parameters<typeof actual.inferSearchProfile>) =>
      mockInferSearchProfile(...args),
  }
})

vi.mock('../utils/searchExecutor', async () => {
  const actual = await vi.importActual<typeof import('../utils/searchExecutor')>('../utils/searchExecutor')
  return {
    ...actual,
    executeSearch: (...args: Parameters<typeof actual.executeSearch>) =>
      mockExecuteSearch(...args),
  }
})

describe('ResearchPage', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_ANTHROPIC_PROXY_URL', 'https://ai.example/proxy')
    mockNavigate.mockReset()
    mockInferSearchProfile.mockReset()
    mockExecuteSearch.mockReset()
    resolveStorage().removeItem('facet-search-data')
    resolveStorage().removeItem('facet-pipeline-data')
    resolveStorage().removeItem('vector-resume-data')

    useResumeStore.setState({
      data: JSON.parse(JSON.stringify(defaultResumeData)),
      past: [],
      future: [],
      canUndo: false,
      canRedo: false,
    })

    usePipelineStore.setState({
      entries: [],
      sortField: 'tier',
      sortDir: 'asc',
      filters: { tier: 'all', status: 'all', search: '' },
    })

    useSearchStore.setState({
      profile: {
        id: 'sprof-1',
        inferredAt: '2026-03-10T10:00:00.000Z',
        inferredFromResumeVersion: 1,
        skills: [],
        vectors: [
          {
            vectorId: 'backend',
            priority: 1,
            description: 'Platform-heavy backend roles',
            targetRoleTitles: ['Staff Engineer'],
            searchKeywords: ['distributed systems'],
          },
        ],
        workSummary: [],
        openQuestions: [],
        constraints: {
          compensation: '',
          locations: [],
          clearance: '',
          companySize: '',
        },
        filters: {
          prioritize: [],
          avoid: [],
        },
        interviewPrefs: {
          strongFit: [],
          redFlags: [],
        },
      },
      requests: [
        {
          id: 'sreq-1',
          createdAt: '2026-03-10T10:05:00.000Z',
          focusVectors: ['backend'],
          companySizeOverride: '',
          salaryAnchorOverride: '',
          geoExpand: true,
          customKeywords: '',
          excludeCompanies: [],
          maxResults: { tier1: 5, tier2: 10, tier3: 10 },
        },
      ],
      runs: [
        {
          id: 'srun-1',
          requestId: 'sreq-1',
          createdAt: '2026-03-10T10:06:00.000Z',
          status: 'completed',
          searchLog: ['staff platform engineer remote'],
          results: [
            {
              id: 'sres-1',
              tier: 1,
              company: 'Acme Corp',
              title: 'Staff Platform Engineer',
              url: 'https://example.com/jobs/1',
              matchScore: 96,
              matchReason: 'Excellent overlap with platform and backend scope.',
              vectorAlignment: 'Backend / platform',
              risks: ['Company is smaller than ideal'],
              estimatedComp: '$250k-$320k',
              source: 'greenhouse',
            },
          ],
        },
      ],
    })

    mockInferSearchProfile.mockResolvedValue({
      skills: [{ id: 'skl-1', name: 'TypeScript', category: 'backend', depth: 'strong' }],
      vectors: [
        {
          vectorId: 'backend',
          priority: 1,
          description: 'Core backend roles',
          targetRoleTitles: ['Staff Engineer'],
          searchKeywords: ['distributed systems'],
        },
      ],
      workSummary: [],
      openQuestions: [],
    })
    mockExecuteSearch.mockResolvedValue({
      results: [],
      searchLog: [],
      tokenUsage: undefined,
    })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllEnvs()
  })

  it('pushes a result into the pipeline', async () => {
    const { ResearchPage } = await import('../routes/research/ResearchPage')

    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Results Viewer' }))
    fireEvent.click(screen.getByRole('button', { name: /Add to Pipeline/i }))

    await waitFor(() => {
      expect(usePipelineStore.getState().entries).toHaveLength(1)
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/pipeline' })
    }, { timeout: 10000 })

    const entry = usePipelineStore.getState().entries[0]
    expect(entry).toBeDefined()
    expect(entry!.company).toBe('Acme Corp')
    expect(entry!.role).toBe('Staff Platform Engineer')
    expect(entry!.tier).toBe('1')
    expect(entry!.status).toBe('researching')
    expect(entry!.vectorId).toBe('backend')
  }, 10000)

  it('shows the stale profile warning when resume data is newer than the inferred profile', async () => {
    useResumeStore.setState((state) => ({
      ...state,
      data: {
        ...state.data,
        version: 2,
      },
    }))

    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    expect(screen.getByRole('status').textContent).toContain('current resume data is version 2')
  })

  it('wires tabs to their tabpanel content', async () => {
    const { ResearchPage } = await import('../routes/research/ResearchPage')

    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Search Launcher' }))

    const panel = screen.getByRole('tabpanel')
    expect(panel.getAttribute('aria-labelledby')).toBe('research-tab-search')
  })

  it('shows auto-excluded companies from closed pipeline entries', async () => {
    usePipelineStore.setState((state) => ({
      ...state,
      entries: [
        {
          id: 'pipe-closed',
          company: 'OldCo',
          role: 'Staff Engineer',
          tier: '2',
          status: 'rejected',
          comp: '',
          url: '',
          contact: '',
          vectorId: 'backend',
          jobDescription: '',
          presetId: null,
          resumeVariant: '',
          positioning: '',
          skillMatch: '',
          nextStep: '',
          notes: '',
          appMethod: 'unknown',
          response: 'none',
          daysToResponse: null,
          rounds: null,
          format: [],
          rejectionStage: '',
          rejectionReason: '',
          offerAmount: '',
          dateApplied: '',
          dateClosed: '',
          lastAction: '2026-03-10',
          createdAt: '2026-03-10',
          history: [],
        },
      ],
    }))

    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Search Launcher' }))
    expect(screen.getByText('OldCo')).toBeTruthy()
  })

  it('hides the stale warning when resume and profile versions match', async () => {
    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    expect(screen.queryByText(/current resume data is version/i)).toBeNull()
  })

  it('runs inference and switches to the search tab', async () => {
    useSearchStore.setState((state) => ({ ...state, profile: null, requests: [], runs: [] }))
    const { ResearchPage } = await import('../routes/research/ResearchPage')

    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('button', { name: /Build Profile from Resume/i }))

    await waitFor(() => {
      expect(useSearchStore.getState().profile?.skills).toHaveLength(1)
    })

    expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe('research-tab-search')
  })

  it('shows inference failures from the API', async () => {
    useSearchStore.setState((state) => ({ ...state, profile: null, requests: [], runs: [] }))
    mockInferSearchProfile.mockRejectedValueOnce(new Error('Inference blew up'))

    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('button', { name: /Build Profile from Resume/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Inference blew up')
    })
  })

  it('passes excluded companies into launched searches and stores successful results', async () => {
    usePipelineStore.setState((state) => ({
      ...state,
      entries: [
        {
          id: 'pipe-rejected',
          company: 'OldCo',
          role: 'Staff Engineer',
          tier: '2',
          status: 'rejected',
          comp: '',
          url: '',
          contact: '',
          vectorId: 'backend',
          jobDescription: '',
          presetId: null,
          resumeVariant: '',
          positioning: '',
          skillMatch: '',
          nextStep: '',
          notes: '',
          appMethod: 'unknown',
          response: 'none',
          daysToResponse: null,
          rounds: null,
          format: [],
          rejectionStage: '',
          rejectionReason: '',
          offerAmount: '',
          dateApplied: '',
          dateClosed: '',
          lastAction: '2026-03-10',
          createdAt: '2026-03-10',
          history: [],
        },
        {
          id: 'pipe-closed',
          company: 'LaterCo',
          role: 'Principal Engineer',
          tier: '1',
          status: 'closed',
          comp: '',
          url: '',
          contact: '',
          vectorId: 'backend',
          jobDescription: '',
          presetId: null,
          resumeVariant: '',
          positioning: '',
          skillMatch: '',
          nextStep: '',
          notes: '',
          appMethod: 'unknown',
          response: 'none',
          daysToResponse: null,
          rounds: null,
          format: [],
          rejectionStage: '',
          rejectionReason: '',
          offerAmount: '',
          dateApplied: '',
          dateClosed: '',
          lastAction: '2026-03-10',
          createdAt: '2026-03-10',
          history: [],
        },
      ],
    }))

    mockExecuteSearch.mockResolvedValueOnce({
      results: [
        {
          id: 'sres-new',
          tier: 1,
          company: 'NewCo',
          title: 'Principal Engineer',
          url: 'https://example.com/jobs/new',
          matchScore: 95,
          matchReason: 'Very strong match',
          vectorAlignment: 'backend',
          risks: [],
          source: 'greenhouse',
        },
      ],
      searchLog: ['principal backend engineer'],
      tokenUsage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    })

    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Search Launcher' }))
    fireEvent.click(screen.getByRole('button', { name: /Launch Search/i }))

    await waitFor(() => {
      expect(useSearchStore.getState().runs.at(-1)?.status).toBe('completed')
    })

    expect(mockExecuteSearch).toHaveBeenCalledTimes(1)
    expect(mockExecuteSearch.mock.calls[0]?.[1].excludeCompanies).toEqual(['LaterCo', 'OldCo'])
    expect(useSearchStore.getState().runs.at(-1)?.results[0]?.company).toBe('NewCo')
  })

  it('shows an error when AI endpoint configuration is missing', async () => {
    vi.stubEnv('VITE_ANTHROPIC_PROXY_URL', '')
    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('button', { name: /Build Profile from Resume/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('AI research is disabled')
    })
  })

  it('shows an error when search launch is missing the AI endpoint', async () => {
    vi.stubEnv('VITE_ANTHROPIC_PROXY_URL', '')
    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Search Launcher' }))
    fireEvent.click(screen.getByRole('button', { name: /Launch Search/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('AI research is disabled')
    })
  })

  it('shows an error and returns to the profile tab when search launches without a profile', async () => {
    useSearchStore.setState((state) => ({ ...state, profile: null, requests: [], runs: [] }))
    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Search Launcher' }))
    fireEvent.click(screen.getByRole('button', { name: /Launch Search/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Build or restore a search profile')
    })

    expect(screen.getByRole('tab', { name: 'Profile Editor' }).getAttribute('aria-selected')).toBe('true')
  })

  it('disables profile inference while the request is in flight', async () => {
    let resolveInference: ((value: Awaited<ReturnType<typeof mockInferSearchProfile>>) => void) | undefined
    mockInferSearchProfile.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveInference = resolve
        }),
    )

    useSearchStore.setState((state) => ({ ...state, profile: null, requests: [], runs: [] }))
    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    const button = screen.getByRole('button', { name: /Build Profile from Resume/i })
    fireEvent.click(button)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Inferring/i }).hasAttribute('disabled')).toBe(true)
    })

    expect(mockInferSearchProfile).toHaveBeenCalledWith(
      expect.objectContaining({ version: defaultResumeData.version }),
      'https://ai.example/proxy',
    )

    resolveInference?.({
      skills: [],
      vectors: [],
      workSummary: [],
      openQuestions: [],
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Build Profile from Resume/i }).hasAttribute('disabled')).toBe(false)
    })
  })

  it('shows the running search state while a search is in flight', async () => {
    let resolveSearch: ((value: Awaited<ReturnType<typeof mockExecuteSearch>>) => void) | undefined
    mockExecuteSearch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSearch = resolve
        }),
    )

    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Search Launcher' }))
    fireEvent.click(screen.getByRole('button', { name: /Launch Search/i }))

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Results Viewer' }).getAttribute('aria-selected')).toBe('true')
    })

    expect(screen.getByText('running')).toBeTruthy()

    resolveSearch?.({
      results: [],
      searchLog: [],
      tokenUsage: undefined,
    })

    await waitFor(() => {
      expect(useSearchStore.getState().runs.at(-1)?.status).toBe('completed')
    })
  })

  it('marks the run as failed when search execution errors', async () => {
    mockExecuteSearch.mockRejectedValueOnce(new Error('Search execution failed hard'))
    const { ResearchPage } = await import('../routes/research/ResearchPage')

    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Search Launcher' }))
    fireEvent.click(screen.getByRole('button', { name: /Launch Search/i }))

    await waitFor(() => {
    expect(useSearchStore.getState().runs.at(-1)?.status).toBe('failed')
    })

    expect(useSearchStore.getState().runs.at(-1)?.error).toBe('Search execution failed hard')
  })

  it('supports keyboard navigation across tabs', async () => {
    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    const profileTab = screen.getByRole('tab', { name: 'Profile Editor' })
    const searchTab = screen.getByRole('tab', { name: 'Search Launcher' })
    const resultsTab = screen.getByRole('tab', { name: 'Results Viewer' })

    fireEvent.keyDown(profileTab, { key: 'ArrowRight' })
    expect(searchTab.getAttribute('aria-selected')).toBe('true')

    fireEvent.keyDown(searchTab, { key: 'ArrowLeft' })
    expect(profileTab.getAttribute('aria-selected')).toBe('true')

    fireEvent.keyDown(profileTab, { key: 'End' })
    expect(resultsTab.getAttribute('aria-selected')).toBe('true')

    fireEvent.keyDown(resultsTab, { key: 'Home' })
    expect(profileTab.getAttribute('aria-selected')).toBe('true')

    fireEvent.keyDown(profileTab, { key: 'ArrowLeft' })
    expect(resultsTab.getAttribute('aria-selected')).toBe('true')

    fireEvent.keyDown(resultsTab, { key: 'ArrowRight' })
    expect(profileTab.getAttribute('aria-selected')).toBe('true')
  })

  it('shows the empty results state when no runs exist', async () => {
    useSearchStore.setState((state) => ({ ...state, runs: [] }))
    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Results Viewer' }))
    expect(screen.getByText('No runs yet')).toBeTruthy()
  })

  it('lets the user add, edit, remove, and clear skills', async () => {
    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('button', { name: /Add Skill/i }))
    fireEvent.change(screen.getByLabelText('Skill name'), { target: { value: 'React' } })
    fireEvent.change(screen.getByLabelText('Skill context'), { target: { value: 'UI systems' } })

    await waitFor(() => {
      expect(useSearchStore.getState().profile?.skills[0]?.name).toBe('React')
    })

    fireEvent.click(screen.getByRole('button', { name: 'Remove skill React' }))

    await waitFor(() => {
      expect(useSearchStore.getState().profile?.skills).toHaveLength(0)
    })

    fireEvent.click(screen.getByRole('button', { name: /Clear Profile/i }))
    expect(useSearchStore.getState().profile).toBeNull()
    expect(screen.getByText('No search profile yet')).toBeTruthy()
  })

  it('lets the user change focus vectors before launching search', async () => {
    const additionalVector = useResumeStore.getState().data.vectors.find((vector) => vector.id !== 'backend')
    expect(additionalVector).toBeTruthy()

    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Search Launcher' }))
    fireEvent.click(screen.getByRole('checkbox', { name: additionalVector?.label ?? '' }))
    fireEvent.click(screen.getByRole('button', { name: /Launch Search/i }))

    await waitFor(() => {
      expect(mockExecuteSearch).toHaveBeenCalledTimes(1)
    })

    expect(mockExecuteSearch.mock.calls[0]?.[1].focusVectors).toContain(additionalVector?.id)
  })

  it('switches active runs and shows failed-run details', async () => {
    useSearchStore.setState((state) => ({
      ...state,
      requests: [
        ...state.requests,
        {
          id: 'sreq-2',
          createdAt: '2026-03-10T11:05:00.000Z',
          focusVectors: ['backend'],
          companySizeOverride: '',
          salaryAnchorOverride: '',
          geoExpand: true,
          customKeywords: 'staff+platform',
          excludeCompanies: [],
          maxResults: { tier1: 5, tier2: 10, tier3: 10 },
        },
      ],
      runs: [
        state.runs[0],
        {
          id: 'srun-2',
          requestId: 'sreq-2',
          createdAt: '2026-03-10T11:06:00.000Z',
          status: 'failed',
          results: [],
          searchLog: ['staff platform remote'],
          error: 'Rate limit hit',
          tokenUsage: { inputTokens: 50, outputTokens: 0, totalTokens: 50 },
        },
      ],
    }))

    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Results Viewer' }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Select search run' }), {
      target: { value: 'srun-2' },
    })

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Rate limit hit')
    })

    expect(screen.getByText(/staff platform remote/i)).toBeTruthy()
    expect(screen.getByText(/Tokens: 50/i)).toBeTruthy()
  })

  it('lets the user choose a different vector before pushing a result to the pipeline', async () => {
    const alternateVector = useResumeStore.getState().data.vectors.find((vector) => vector.id !== 'backend')
    expect(alternateVector).toBeTruthy()

    const { ResearchPage } = await import('../routes/research/ResearchPage')
    render(<ResearchPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Results Viewer' }))

    const resultsPanel = screen.getByRole('tabpanel')
    const selects = within(resultsPanel).getAllByRole('combobox')
    fireEvent.change(selects.at(-1) ?? selects[0], {
      target: { value: alternateVector?.id },
    })
    fireEvent.click(screen.getByRole('button', { name: /Add to Pipeline/i }))

    await waitFor(() => {
      expect(usePipelineStore.getState().entries).toHaveLength(1)
    })

    expect(usePipelineStore.getState().entries[0]?.vectorId).toBe(alternateVector?.id)
  })
})
