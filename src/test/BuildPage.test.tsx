// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { BuildPage } from '../routes/build/BuildPage'
import { defaultResumeData } from '../store/defaultData'
import { useHandoffStore } from '../store/handoffStore'
import { useResumeStore } from '../store/resumeStore'
import { useUiStore } from '../store/uiStore'

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
})
