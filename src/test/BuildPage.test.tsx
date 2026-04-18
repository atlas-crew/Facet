// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { BuildPage } from '../routes/build/BuildPage'
import { defaultResumeData } from '../store/defaultData'
import { useHandoffStore } from '../store/handoffStore'
import { usePipelineStore } from '../store/pipelineStore'
import { useResumeStore } from '../store/resumeStore'
import { useUiStore } from '../store/uiStore'

const { analyzeJobDescriptionMock, reframeBulletForVectorMock } = vi.hoisted(() => ({
  analyzeJobDescriptionMock: vi.fn(),
  reframeBulletForVectorMock: vi.fn(),
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
  usePresets: () => ({
    activePresetId: null,
    activePreset: null,
    presets: [],
    presetDirty: false,
    setActivePresetId: vi.fn(),
    onSavePreset: vi.fn(),
    onDeleteActivePreset: vi.fn(),
    applyPreset: vi.fn(),
  }),
}))

vi.mock('../utils/useFocusTrap', () => ({
  useFocusTrap: vi.fn(),
}))

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
    expect(screen.getByText(/Assemble and refine a tailored resume/)).toBeTruthy()
    expect(screen.getByText(/Backend Engineering active/)).toBeTruthy()

    const topBar = container.querySelector('.build-top-bar')
    expect(topBar).toBeTruthy()
    expect(topBar?.querySelectorAll('.btn-primary')).toHaveLength(1)
    expect(within(topBar as HTMLElement).getByRole('button', { name: /Download PDF/i })).toBeTruthy()

    expect(screen.getByLabelText('Current working context')).toBeTruthy()
    expect(screen.getByText('Vector')).toBeTruthy()
    expect(screen.getByText('Preset')).toBeTruthy()
    expect(screen.getByText('Pages')).toBeTruthy()
    expect(screen.getByText('Suggestions')).toBeTruthy()
    expect(screen.getByText('JD Analysis')).toBeTruthy()
    expect(screen.getAllByText('Backend Engineering').length).toBeGreaterThan(0)
    expect(screen.getByText('No saved preset')).toBeTruthy()
    expect(screen.getByText('2 pages')).toBeTruthy()
    expect(screen.getByTestId('vector-bar')).toBeTruthy()
    expect(screen.getByTestId('pdf-preview')).toBeTruthy()
    expect(screen.getByTestId('status-bar')).toBeTruthy()
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
