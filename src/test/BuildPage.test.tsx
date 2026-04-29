// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { BuildPage } from '../routes/build/BuildPage'
import { defaultResumeData } from '../store/defaultData'
import { useHandoffStore } from '../store/handoffStore'
import { usePipelineStore } from '../store/pipelineStore'
import { useResumeStore } from '../store/resumeStore'
import { useUiStore } from '../store/uiStore'

const { analyzeJobDescriptionMock, reframeBulletForVectorMock, usePresetsMock, facetClientEnvMock } = vi.hoisted(() => ({
  analyzeJobDescriptionMock: vi.fn(),
  reframeBulletForVectorMock: vi.fn(),
  usePresetsMock: vi.fn(),
  facetClientEnvMock: {
    deploymentMode: 'self-hosted',
    facetApiBaseUrl: '',
    anthropicProxyUrl: 'http://localhost:9001',
    anthropicProxyApiKey: '',
    supabaseUrl: '',
    supabasePublishableKey: '',
  },
}))

vi.mock('../utils/facetEnv', () => ({
  facetClientEnv: facetClientEnvMock,
}))

vi.mock('../utils/jdAnalyzer', async () => {
  const actual = await vi.importActual<typeof import('../utils/jdAnalyzer')>('../utils/jdAnalyzer')
  return {
    ...actual,
    analyzeJobDescription: analyzeJobDescriptionMock,
    reframeBulletForVector: reframeBulletForVectorMock,
  }
})

vi.mock('../hooks/usePdfPreview', () => ({
  usePdfPreview: () => ({
    previewBlobUrl: 'blob:preview',
    cachedPdfBlob: new Blob(['pdf'], { type: 'application/pdf' }),
    pageCount: 2,
    pending: false,
    error: null,
  }),
}))

vi.mock('../hooks/useSuggestionActions', () => ({
  useSuggestionActions: () => ({
    ignoredIds: new Set(),
    suggestionCount: 0,
    onAcceptBullet: vi.fn(),
    onIgnoreBullet: vi.fn(),
    onAcceptTargetLine: vi.fn(),
    onIgnoreTargetLine: vi.fn(),
    onAcceptAll: vi.fn(),
    onDismissRemaining: vi.fn(),
    setIgnoredIds: vi.fn(),
  }),
}))

vi.mock('../hooks/usePresets', () => ({
  usePresets: usePresetsMock,
}))

vi.mock('../utils/useFocusTrap', async () => {
  const React = await vi.importActual<typeof import('react')>('react')

  return {
    useFocusTrap: (active: boolean, _containerRef: unknown, onClose: () => void) => {
      React.useEffect(() => {
        if (!active) return undefined
        const handleKeyDown = (event: KeyboardEvent) => {
          if (event.key === 'Escape') onClose()
        }
        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
      }, [active, onClose])
    },
  }
})

vi.mock('../components/VectorBar', () => ({
  VectorBar: () => <div data-testid="vector-bar" />,
}))

vi.mock('../components/UndoRedoControls', () => ({
  UndoRedoControls: () => <div data-testid="undo-redo-controls" />,
}))

vi.mock('../components/ComponentLibrary', () => ({
  ComponentLibrary: () => <div data-testid="component-library" />,
}))

vi.mock('../components/PdfPreview', () => ({
  PdfPreview: () => <div data-testid="pdf-preview" />,
}))

vi.mock('../components/LivePreview', () => ({
  LivePreview: () => <div data-testid="live-preview" />,
}))

vi.mock('../components/StatusBar', () => ({
  StatusBar: () => <div data-testid="status-bar" />,
}))

vi.mock('../components/GapAnalysisPanel', () => ({
  GapAnalysisPanel: () => <div data-testid="gap-analysis-panel" />,
}))

vi.mock('../components/SuggestionToolbar', () => ({
  SuggestionToolbar: () => <div data-testid="suggestion-toolbar" />,
}))

vi.mock('../components/VariableEditor', () => ({
  VariableEditor: () => null,
}))

vi.mock('../components/ImportExport', () => ({
  ImportExport: () => null,
}))

vi.mock('../components/Tour', () => ({
  Tour: () => null,
}))

vi.mock('../components/ThemeEditorPanel', () => ({
  ThemeEditorPanel: () => <div data-testid="theme-editor-panel" />,
}))

vi.mock('../components/ComparisonDiff', () => ({
  ComparisonDiff: () => <div data-testid="comparison-diff" />,
}))

describe('BuildPage', () => {
  beforeEach(() => {
    analyzeJobDescriptionMock.mockReset()
    reframeBulletForVectorMock.mockReset()
    facetClientEnvMock.anthropicProxyUrl = 'http://localhost:9001'
    usePresetsMock.mockReset()
    usePresetsMock.mockReturnValue({
      activePresetId: null,
      activePreset: null,
      presets: [],
      presetDirty: false,
      setActivePresetId: vi.fn(),
      onSavePreset: vi.fn(),
      onDeleteActivePreset: vi.fn(),
      applyPreset: vi.fn(),
    })
    useResumeStore.setState({
      data: JSON.parse(JSON.stringify(defaultResumeData)),
      past: [],
      future: [],
      canUndo: false,
      canRedo: false,
    })

    useUiStore.setState({
      selectedVector: 'backend',
      viewMode: 'pdf',
      suggestionModeActive: false,
      comparisonVector: null,
      tourCompleted: true,
    })

    useHandoffStore.setState({ pendingGeneration: null })
    usePipelineStore.setState({
      entries: [],
      sortField: 'tier',
      sortDir: 'asc',
      filters: { tier: 'all', status: 'all', search: '' },
    })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('shows a build-focused header with one dominant download action and working context', () => {
    const { container } = render(<BuildPage />)

    expect(screen.getByText('Core Workspace')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Build' })).toBeTruthy()
    expect(screen.getByText(/Generate and refine resumes from your identity model/)).toBeTruthy()
    expect(screen.getByText(/Backend Engineering active/)).toBeTruthy()

    const topBar = container.querySelector('.build-top-bar')
    expect(topBar).toBeTruthy()
    expect(topBar?.querySelectorAll('.btn-primary')).toHaveLength(1)
    expect(within(topBar as HTMLElement).getByRole('button', { name: /Download PDF/i })).toBeTruthy()

    expect(screen.queryByLabelText('Resume generation model')).toBeNull()

    const workingContext = screen.getByLabelText('Current working context')
    expect(workingContext).toBeTruthy()
    expect(within(topBar as HTMLElement).getByLabelText('Current working context')).toBe(workingContext)
    const contextHelpButton = within(workingContext).getByRole('button', { name: /Open Build context details/i })
    expect(contextHelpButton).toBeTruthy()
    expect(contextHelpButton.getAttribute('aria-expanded')).toBe('false')
    expect(contextHelpButton.getAttribute('aria-controls')).toBe('build-context-modal')
    expect(within(workingContext).getByText('Vector')).toBeTruthy()
    expect(within(workingContext).getByText('Pages')).toBeTruthy()
    expect(within(workingContext).getByText('Generation')).toBeTruthy()
    expect(within(workingContext).getByText('Source')).toBeTruthy()
    expect(within(workingContext).queryByText('Preset')).toBeNull()
    expect(within(workingContext).queryByText('Suggestions')).toBeNull()
    expect(within(workingContext).queryByText('JD Analysis')).toBeNull()
    expect(within(workingContext).getByText('Backend Engineering')).toBeTruthy()
    expect(within(workingContext).getByText('2 pages')).toBeTruthy()

    fireEvent.click(contextHelpButton)
    expect(contextHelpButton.getAttribute('aria-expanded')).toBe('true')
    const generationModel = screen.getByRole('dialog', { name: 'Build Context' })
    expect(within(generationModel).getByText('Resume model')).toBeTruthy()
    expect(within(generationModel).getAllByText('Single vector').length).toBeGreaterThan(0)
    expect(within(generationModel).getByText('Workspace flow')).toBeTruthy()
    expect(within(generationModel).getByText('Identity-first workspace')).toBeTruthy()
    expect(within(generationModel).getByText('Generation source')).toBeTruthy()
    expect(within(generationModel).getAllByText('Workspace edits').length).toBeGreaterThan(0)
    expect(within(generationModel).getByText('Active vectors')).toBeTruthy()
    expect(within(generationModel).getByText('Current workspace baseline')).toBeTruthy()
    expect(within(generationModel).getByText('No saved preset')).toBeTruthy()
    expect(within(generationModel).getByText('Analyze a JD to tailor this draft')).toBeTruthy()
    fireEvent.click(within(generationModel).getByRole('button', { name: /Close Build context details/i }))
    expect(screen.queryByRole('dialog', { name: 'Build Context' })).toBeNull()
    expect(contextHelpButton.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(contextHelpButton)
    expect(contextHelpButton.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('dialog', { name: 'Build Context' })).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Build Context' })).toBeNull()
    expect(contextHelpButton.getAttribute('aria-expanded')).toBe('false')

    expect(screen.getByTestId('vector-bar')).toBeTruthy()
    expect(screen.getByTestId('pdf-preview')).toBeTruthy()
    expect(screen.getByTestId('status-bar')).toBeTruthy()
  })

  it('promotes active preset state into the compact working context', () => {
    usePresetsMock.mockReturnValue({
      activePresetId: 'preset-1',
      activePreset: { id: 'preset-1', name: 'Saved Lane' },
      presets: [],
      presetDirty: false,
      setActivePresetId: vi.fn(),
      onSavePreset: vi.fn(),
      onDeleteActivePreset: vi.fn(),
      applyPreset: vi.fn(),
    })

    const { rerender } = render(<BuildPage />)
    let workingContext = screen.getByLabelText('Current working context')
    expect(within(workingContext).getByText('Preset')).toBeTruthy()
    expect(within(workingContext).getByText('Saved Lane')).toBeTruthy()
    expect(within(workingContext).getByText('Preset synced')).toBeTruthy()

    usePresetsMock.mockReturnValue({
      activePresetId: null,
      activePreset: null,
      presets: [],
      presetDirty: true,
      setActivePresetId: vi.fn(),
      onSavePreset: vi.fn(),
      onDeleteActivePreset: vi.fn(),
      applyPreset: vi.fn(),
    })

    rerender(<BuildPage />)
    workingContext = screen.getByLabelText('Current working context')
    expect(within(workingContext).getByText('Unsaved preset')).toBeTruthy()
    expect(within(workingContext).getByText('Unsaved changes')).toBeTruthy()
  })

  it('demotes file and preset controls into a single workspace menu', () => {
    render(<BuildPage />)

    expect(screen.queryByRole('button', { name: /^File$/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Actions$/i })).toBeNull()
    expect(screen.getByRole('button', { name: /^Compare$/i })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /^Workspace$/i }))

    expect(screen.getByText('Import')).toBeTruthy()
    expect(screen.getByText('Export')).toBeTruthy()
    expect(screen.getByText('Variables')).toBeTruthy()
    expect(screen.getByText('Analyze JD')).toBeTruthy()
    expect(screen.getByText('Save Preset')).toBeTruthy()
  })

  it('keeps the primary download action wired to PDF export', () => {
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:download')
    const revokeObjectUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    render(<BuildPage />)

    fireEvent.click(screen.getByRole('button', { name: /Download PDF/i }))

    expect(createObjectUrl).toHaveBeenCalledTimes(1)
    expect(anchorClick).toHaveBeenCalledTimes(1)
    expect(revokeObjectUrl).not.toHaveBeenCalled()
  })

  it('preserves existing workspace variant metadata when a legacy handoff has no structured generation payload', () => {
    useResumeStore.getState().updateGeneration({
      source: 'pipeline',
      mode: 'dynamic',
      vectorMode: 'auto',
      variantId: 'variant-keep',
      variantLabel: 'Existing Variant',
      primaryVectorId: 'backend',
      vectorIds: ['backend'],
    })
    useHandoffStore.getState().setPendingAnalysis('Target JD', 'platform', 'pipe-55')

    render(<BuildPage />)

    expect(useResumeStore.getState().data.generation).toMatchObject({
      source: 'pipeline',
      mode: 'single',
      vectorMode: 'manual',
      pipelineEntryId: 'pipe-55',
      primaryVectorId: 'platform',
      vectorIds: ['platform'],
      variantId: 'variant-keep',
      variantLabel: 'Existing Variant',
    })
  })

  it('keeps JD analysis separate from assembly suggestions until the vector plan is confirmed', async () => {
    analyzeJobDescriptionMock.mockResolvedValue({
      primary_vector: 'platform',
      suggested_vectors: ['platform', 'backend'],
      bullet_adjustments: [],
      suggested_target_line: '',
      skill_gaps: ['Rust'],
      matched_keywords: ['TypeScript'],
      suggested_variables: { company: 'Acme' },
      positioning_note: 'Lead with platform outcomes.',
      vector_strategy: 'Start with Platform and keep Backend as a supporting lane.',
    })

    render(<BuildPage />)

    fireEvent.click(screen.getByRole('button', { name: /^Workspace$/i }))
    fireEvent.click(screen.getByText('Analyze JD'))
    fireEvent.change(screen.getByPlaceholderText('Paste JD text here...'), {
      target: { value: 'We need a platform-minded engineer.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^Analyze$/i }))

    await waitFor(() => {
      expect(screen.getByText('Resume Vector Plan')).toBeTruthy()
    })

    expect(analyzeJobDescriptionMock).toHaveBeenCalledWith(
      {
        content: 'We need a platform-minded engineer.',
        wordCount: 5,
        truncated: false,
      },
      expect.objectContaining({
        generation: expect.objectContaining({
          mode: 'single',
          vectorMode: 'manual',
        }),
      }),
      expect.any(String),
    )

    expect(useUiStore.getState().suggestionModeActive).toBe(false)

    fireEvent.click(screen.getByLabelText('Manual'))
    fireEvent.click(screen.getByLabelText('Single vector'))
    fireEvent.click(screen.getByLabelText('Backend Engineering (AI suggested)'))
    fireEvent.click(screen.getByRole('button', { name: 'Continue to assembly suggestions' }))

    await waitFor(() => {
      expect(useUiStore.getState().suggestionModeActive).toBe(true)
    })

    expect(useUiStore.getState().selectedVector).toBe('backend')
    expect(useResumeStore.getState().data.generation).toMatchObject({
      mode: 'single',
      vectorMode: 'manual',
      primaryVectorId: 'backend',
      vectorIds: ['backend'],
      suggestedVectorIds: ['platform', 'backend'],
    })
  })

  it('applies the default AI multi-vector plan when confirmed without manual edits', async () => {
    analyzeJobDescriptionMock.mockResolvedValue({
      primary_vector: 'platform',
      suggested_vectors: ['platform', 'backend'],
      bullet_adjustments: [],
      suggested_target_line: '',
      skill_gaps: [],
      matched_keywords: ['TypeScript'],
      suggested_variables: { company: 'Acme' },
      positioning_note: 'Lead with platform outcomes.',
      vector_strategy: 'Start with Platform and keep Backend as a supporting lane.',
    })

    const { rerender } = render(<BuildPage />)

    fireEvent.click(screen.getByRole('button', { name: /^Workspace$/i }))
    fireEvent.click(screen.getByText('Analyze JD'))
    fireEvent.change(screen.getByPlaceholderText('Paste JD text here...'), {
      target: { value: 'We need a platform-minded engineer.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^Analyze$/i }))

    await waitFor(() => {
      expect(screen.getByText('Platform / DevEx (AI suggested)')).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Continue to assembly suggestions' }))

    await waitFor(() => {
      expect(useUiStore.getState().suggestionModeActive).toBe(true)
    })

    expect(useUiStore.getState().selectedVector).toBe('platform')
    expect(useResumeStore.getState().data.generation).toMatchObject({
      mode: 'multi-vector',
      vectorMode: 'auto',
      primaryVectorId: 'platform',
      vectorIds: ['platform', 'backend'],
      suggestedVectorIds: ['platform', 'backend'],
    })

    const workingContext = screen.getByLabelText('Current working context')
    expect(within(workingContext).getByText('Suggestions')).toBeTruthy()
    expect(within(workingContext).getByText('JD Analysis')).toBeTruthy()

    facetClientEnvMock.anthropicProxyUrl = ''
    rerender(<BuildPage />)
    const unavailableContext = screen.getByLabelText('Current working context')
    expect(within(unavailableContext).getByText('AI unavailable')).toBeTruthy()
    expect(within(unavailableContext).getByText('Configure AI to analyze JDs')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Open Build context details/i }))
    const generationModel = screen.getByRole('dialog', { name: 'Build Context' })
    expect(within(generationModel).getAllByText('Multi-vector').length).toBeGreaterThan(0)
    expect(within(generationModel).getByText('AI-suggested multi-vector generation')).toBeTruthy()
    expect(within(generationModel).queryByText('Turn on suggestion mode after JD analysis')).toBeNull()
    expect(within(generationModel).queryByText('Analyze a JD to tailor this draft')).toBeNull()
  })

  it('persists structured dynamic variant metadata back to the originating pipeline entry', async () => {
    analyzeJobDescriptionMock.mockResolvedValue({
      primary_vector: 'platform',
      suggested_vectors: ['platform', 'backend'],
      bullet_adjustments: [],
      suggested_target_line: '',
      skill_gaps: [],
      matched_keywords: [],
      suggested_variables: {},
      positioning_note: 'Lead with platform outcomes.',
      vector_strategy: 'Start with Platform and keep Backend as a supporting lane.',
    })

    usePipelineStore.setState({
      entries: [
        {
          id: 'pipe-77',
          company: 'Acme Corp',
          role: 'Staff Platform Engineer',
          tier: '1',
          status: 'researching',
          comp: '',
          url: '',
          contact: '',
          vectorId: null,
          jobDescription: 'We need a platform-minded engineer.',
          presetId: null,
          resumeVariant: '',
          resumeGeneration: null,
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
          lastAction: '2026-04-18',
          createdAt: '2026-04-18',
          history: [],
        },
      ],
      sortField: 'tier',
      sortDir: 'asc',
      filters: { tier: 'all', status: 'all', search: '' },
    })

    useHandoffStore.getState().setPendingGeneration({
      mode: 'dynamic',
      vectorMode: 'manual',
      source: 'pipeline',
      jobDescription: 'We need a platform-minded engineer.',
      pipelineEntryId: 'pipe-77',
      presetId: null,
      primaryVectorId: null,
      vectorIds: [],
      suggestedVectorIds: [],
      resumeGeneration: null,
    })

    render(<BuildPage />)

    fireEvent.click(screen.getByRole('button', { name: /^Analyze$/i }))

    await waitFor(() => {
      expect(screen.getByText('Resume Vector Plan')).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: /Continue to assembly suggestions/i }))

    await waitFor(() => {
      expect(usePipelineStore.getState().entries[0]?.resumeGeneration).toMatchObject({
        mode: 'dynamic',
        vectorMode: 'auto',
        source: 'pipeline',
        primaryVectorId: 'platform',
        vectorIds: ['platform', 'backend'],
        suggestedVectorIds: ['platform', 'backend'],
      })
    })

    expect(usePipelineStore.getState().entries[0]?.resumeGeneration?.variantId).toBeTruthy()
    expect(usePipelineStore.getState().entries[0]?.resumeGeneration?.variantLabel).toBe(
      'Acme Corp · Staff Platform Engineer',
    )
    expect(usePipelineStore.getState().entries[0]?.resumeGeneration?.lastGeneratedAt).toBeTruthy()
    expect(useResumeStore.getState().data.generation).toMatchObject({
      mode: 'dynamic',
      source: 'pipeline',
      pipelineEntryId: 'pipe-77',
      variantLabel: 'Acme Corp · Staff Platform Engineer',
      primaryVectorId: 'platform',
      vectorIds: ['platform', 'backend'],
    })

    fireEvent.click(screen.getByRole('button', { name: /Open Build context details/i }))
    const generationModel = screen.getByRole('dialog', { name: 'Build Context' })
    expect(within(generationModel).getByText('Dynamic per-job')).toBeTruthy()
    expect(within(generationModel).getByText('Pipeline-driven dynamic job flow')).toBeTruthy()
    expect(within(generationModel).getByText('Acme Corp · Staff Platform Engineer')).toBeTruthy()
  })

  it('prevents deselecting every vector in manual multi-vector mode', async () => {
    analyzeJobDescriptionMock.mockResolvedValue({
      primary_vector: 'platform',
      suggested_vectors: ['platform', 'backend'],
      bullet_adjustments: [],
      suggested_target_line: '',
      skill_gaps: [],
      matched_keywords: ['TypeScript'],
      suggested_variables: { company: 'Acme' },
      positioning_note: 'Lead with platform outcomes.',
      vector_strategy: 'Start with Platform and keep Backend as a supporting lane.',
    })

    render(<BuildPage />)

    fireEvent.click(screen.getByRole('button', { name: /^Workspace$/i }))
    fireEvent.click(screen.getByText('Analyze JD'))
    fireEvent.change(screen.getByPlaceholderText('Paste JD text here...'), {
      target: { value: 'We need a platform-minded engineer.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^Analyze$/i }))

    await waitFor(() => {
      expect(screen.getByText('Platform / DevEx (AI suggested)')).toBeTruthy()
    })

    fireEvent.click(screen.getByLabelText('Manual'))
    fireEvent.click(screen.getByLabelText('Multi-vector'))
    fireEvent.click(screen.getByLabelText('Platform / DevEx (AI suggested)'))
    fireEvent.click(screen.getByLabelText('Backend Engineering (AI suggested)'))

    expect(screen.getByLabelText('Backend Engineering (AI suggested)')).toHaveProperty('checked', true)
    expect(screen.getByRole('button', { name: 'Continue to assembly suggestions' })).toHaveProperty('disabled', false)
  })
})
