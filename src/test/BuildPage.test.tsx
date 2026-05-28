// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { BuildPage } from '../routes/build/BuildPage'
import { defaultResumeData } from '../store/defaultData'
import { useHandoffStore } from '../store/handoffStore'
import { useJDAnalysisStore } from '../store/jdAnalysisStore'
import { usePipelineStore } from '../store/pipelineStore'
import { normalizeResumeWorkspaceData, useResumeStore } from '../store/resumeStore'
import { useUiStore } from '../store/uiStore'
import type { JDAnalysis } from '../types/jdAnalysis'
import { untagged, type AudienceTagged } from '../types/audience'
import type { PipelineEntry } from '../types/pipeline'

const {
  reframeBulletForVectorMock,
  usePresetsMock,
  facetClientEnvMock,
  pdfPreviewMock,
  renderResumeAsDocxMock,
  themeEditorPanelPropsMock,
  vectorBarPropsMock,
  componentLibraryPropsMock,
  comparisonDiffPropsMock,
  navigateMock,
} = vi.hoisted(() => ({
  reframeBulletForVectorMock: vi.fn(),
  pdfPreviewMock: vi.fn(),
  renderResumeAsDocxMock: vi.fn(),
  themeEditorPanelPropsMock: vi.fn(),
  vectorBarPropsMock: vi.fn(),
  componentLibraryPropsMock: vi.fn(),
  comparisonDiffPropsMock: vi.fn(),
  navigateMock: vi.fn(),
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

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}))

vi.mock('../utils/facetEnv', () => ({
  facetClientEnv: facetClientEnvMock,
}))

vi.mock('../utils/bulletReframing', () => ({
  reframeBulletForVector: reframeBulletForVectorMock,
}))

vi.mock('../utils/docxRenderer', () => ({
  renderResumeAsDocx: renderResumeAsDocxMock,
}))

vi.mock('../hooks/usePdfPreview', () => ({
  usePdfPreview: () => pdfPreviewMock(),
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
  VectorBar: (props: Record<string, unknown>) => {
    vectorBarPropsMock(props)
    return <div data-testid="vector-bar" />
  },
}))

const createPipelineEntry = (overrides: Partial<PipelineEntry> = {}): PipelineEntry => ({
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
  jdAnalysisId: 'analysis-77',
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
  ...overrides,
})

const internalTagged = <T,>(item: T): T & AudienceTagged => ({
  ...item,
  audiences: { inferred: ['unclassified'], asserted: ['internal'] },
})

const createJDAnalysis = (overrides: Partial<JDAnalysis> = {}): JDAnalysis => ({
  id: 'analysis-77',
  pipelineEntryId: 'pipe-77',
  jdTextHash: 'abc123',
  identityVersion: 1,
  modelVersion: 'jd-analysis.v1.test',
  audienceRulesVersion: 'audience-rules.v1',
  generatedAt: '2026-04-18T12:00:00.000Z',
  updatedAt: '2026-04-18T12:00:00.000Z',
  warnings: [],
  company: 'Acme Corp',
  role: 'Staff Platform Engineer',
  summary: 'Platform-minded role.',
  analyzedJobDescription: 'We need a platform-minded engineer.',
  jobDescriptionWordCount: 5,
  jobDescriptionTruncated: false,
  requirements: [],
  overallFit: 'strong',
  fitScore: 0.86,
  confidence: 'high',
  recommendation: 'apply',
  oneLineSummary: 'Lead with platform outcomes.',
  rationale: 'Start with Platform and keep Backend as a supporting lane.',
  matchedVectors: [
    internalTagged({
      vectorId: 'platform',
      title: 'Platform / DevEx',
      priority: 'high',
      matchStrength: 'strong',
      evidence: ['Platform-minded engineer.'],
      thesisApplies: true,
      thesisFitExplanation: 'Platform delivery is central.',
    }),
    internalTagged({
      vectorId: 'backend',
      title: 'Backend Engineering',
      priority: 'medium',
      matchStrength: 'moderate',
      evidence: ['Backend systems.'],
      thesisApplies: true,
      thesisFitExplanation: 'Backend depth supports the platform story.',
    }),
  ],
  primaryVectorId: 'platform',
  skillMatches: [],
  evidenceMapping: {
    topBullets: [],
    topSkills: [],
    topProjects: [],
    topProfiles: [],
    topPhilosophy: [],
  },
  strengthsToLead: [],
  advantages: [],
  advantageHypotheses: [],
  gaps: [],
  gapFocus: [],
  watchOuts: [],
  triggeredPrioritize: [],
  triggeredAvoid: [],
  relevantAwareness: [],
  positioningRecommendations: [internalTagged({ text: 'Lead with platform outcomes.' })],
  requirementCoverageScore: 0.8,
  matchedRequirementIds: [],
  matchedKeywords: ['TypeScript'],
  ...overrides,
})

const seedPipelineHandoff = (analysisOverrides: Partial<JDAnalysis> = {}) => {
  const entry = createPipelineEntry()
  usePipelineStore.setState({
    entries: [entry],
    sortField: 'tier',
    sortDir: 'asc',
    filters: { tier: 'all', status: 'all', search: '' },
  })
  useJDAnalysisStore.setState({ analyses: [createJDAnalysis(analysisOverrides)] })
  useHandoffStore.getState().setPendingGeneration({
    mode: 'dynamic',
    vectorMode: 'manual',
    source: 'pipeline',
    jobDescription: entry.jobDescription,
    pipelineEntryId: entry.id,
    presetId: null,
    primaryVectorId: null,
    vectorIds: [],
    suggestedVectorIds: [],
    resumeGeneration: null,
  })
}

vi.mock('../components/UndoRedoControls', () => ({
  UndoRedoControls: () => <div data-testid="undo-redo-controls" />,
}))

vi.mock('../components/ComponentLibrary', () => ({
  ComponentLibrary: (props: unknown) => {
    componentLibraryPropsMock(props)
    return <div data-testid="component-library" />
  },
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
  ThemeEditorPanel: (props: Record<string, unknown>) => {
    themeEditorPanelPropsMock(props)
    return <div data-testid="theme-editor-panel" />
  },
}))

vi.mock('../components/ComparisonDiff', () => ({
  ComparisonDiff: (props: unknown) => {
    comparisonDiffPropsMock(props)
    return <div data-testid="comparison-diff" />
  },
}))

describe('BuildPage', () => {
  beforeEach(() => {
    reframeBulletForVectorMock.mockReset()
    themeEditorPanelPropsMock.mockReset()
    vectorBarPropsMock.mockReset()
    componentLibraryPropsMock.mockReset()
    comparisonDiffPropsMock.mockReset()
    navigateMock.mockReset()
    pdfPreviewMock.mockReset()
    pdfPreviewMock.mockReturnValue({
      previewBlobUrl: 'blob:preview',
      cachedPdfBlob: new Blob(['pdf'], { type: 'application/pdf' }),
      pageCount: 2,
      pending: false,
      error: null,
    })
    renderResumeAsDocxMock.mockReset()
    renderResumeAsDocxMock.mockResolvedValue({
      blob: new Blob(['docx'], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }),
      generatedAt: '2026-05-04T00:00:00.000Z',
    })
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
      ...normalizeResumeWorkspaceData(JSON.parse(JSON.stringify(defaultResumeData))),
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
    useJDAnalysisStore.setState({ analyses: [] })
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

  it('shows a build-focused header, preview actions, and working context', () => {
    const { container } = render(<BuildPage />)

    expect(screen.getByRole('heading', { name: 'Build' })).toBeTruthy()
    expect(screen.queryByText('Core Workspace')).toBeNull()
    expect(screen.queryByText(/Generate and refine resumes from your identity model/)).toBeNull()
    expect(screen.queryByText(/Backend Engineering active/)).toBeNull()

    const topBar = container.querySelector('.build-top-bar')
    expect(topBar).toBeTruthy()
    expect(topBar?.querySelectorAll('.btn-primary')).toHaveLength(0)

    const previewToolbar = screen.getByRole('toolbar', { name: /Build actions/i })
    expect(previewToolbar.querySelectorAll('.btn-primary')).toHaveLength(1)
    expect(previewToolbar.firstElementChild).toBe(screen.getByTestId('undo-redo-controls'))
    const toolbarButtons = within(previewToolbar)
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label') ?? button.textContent)
    expect(toolbarButtons.slice(-2)).toEqual(['More tools', 'Download PDF'])
    expect(screen.queryByRole('button', { name: /Generate for Job/i })).toBeNull()

    expect(screen.queryByLabelText('Resume generation model')).toBeNull()

    const workingContext = screen.getByLabelText('Current working context')
    expect(workingContext).toBeTruthy()
    expect(within(topBar as HTMLElement).getByLabelText('Current working context')).toBe(
      workingContext,
    )
    expect(
      within(workingContext).queryByRole('button', { name: /Open Build context details/i }),
    ).toBeNull()
    expect(within(workingContext).queryByText('Vector')).toBeNull()
    expect(within(workingContext).queryByText('Pages')).toBeNull()
    expect(within(workingContext).getByText('Generation')).toBeTruthy()
    expect(within(workingContext).getByText('Source')).toBeTruthy()
    expect(within(workingContext).getByText('Preset')).toBeTruthy()
    expect(within(workingContext).getByText('No saved preset')).toBeTruthy()
    expect(within(workingContext).getByText('Suggestions')).toBeTruthy()
    expect(within(workingContext).getByText('Inactive')).toBeTruthy()
    expect(within(workingContext).getByText('JD Analysis')).toBeTruthy()
    expect(within(workingContext).getByText('Not applicable')).toBeTruthy()
    expect(within(workingContext).getByText('No pipeline entry linked')).toBeTruthy()
    expect(within(workingContext).queryByText('Backend Engineering')).toBeNull()
    expect(within(workingContext).queryByText(/bullets included/)).toBeNull()
    expect(within(workingContext).queryByText('2 pages')).toBeNull()
    expect(within(workingContext).queryByText('Within target page count')).toBeNull()
    expect(within(workingContext).getByText('Manual vector selection active')).toBeTruthy()
    expect(within(workingContext).getByText('Workspace-local edits')).toBeTruthy()

    expect(within(workingContext).getAllByRole('button', { name: /help/i })).toHaveLength(5)
    expect(within(workingContext).queryByRole('button', { name: 'Vector help' })).toBeNull()
    expect(within(workingContext).getByRole('button', { name: 'Generation help' })).toBeTruthy()
    expect(screen.queryByText(/Active vectors: Backend Engineering/)).toBeNull()
    expect(screen.queryByRole('dialog', { name: 'Build Context' })).toBeNull()

    expect(screen.getByTestId('vector-bar')).toBeTruthy()
    expect(vectorBarPropsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        onResetOverrides: expect.any(Function),
      }),
    )
    expect(screen.getByTestId('pdf-preview')).toBeTruthy()
    expect(screen.getByTestId('status-bar')).toBeTruthy()
  })

  it('does not expose direct job-specific generation from Build', () => {
    render(<BuildPage />)

    expect(screen.queryByRole('button', { name: /Generate for Job/i })).toBeNull()
    expect(screen.queryByRole('dialog', { name: 'Job Description Analysis' })).toBeNull()
  })

  it('passes stable empty order and override props to the component library', () => {
    const { rerender } = render(<BuildPage />)

    const firstProps = componentLibraryPropsMock.mock.calls.at(-1)?.[0] as {
      includedByKey: Record<string, boolean>
      bulletOrderByRole: Record<string, string[]>
      activeVectorBulletOrderByRole: Record<string, string[]>
      defaultBulletOrderByRole: Record<string, string[]>
    }

    rerender(<BuildPage />)

    const secondProps = componentLibraryPropsMock.mock.calls.at(-1)?.[0] as typeof firstProps

    expect(secondProps.includedByKey).toBe(firstProps.includedByKey)
    expect(secondProps.bulletOrderByRole).toBe(firstProps.bulletOrderByRole)
    expect(secondProps.activeVectorBulletOrderByRole).toBe(firstProps.activeVectorBulletOrderByRole)
    expect(secondProps.defaultBulletOrderByRole).toBe(firstProps.defaultBulletOrderByRole)
  })

  it('passes configured default bullet orders through the component library boundary', () => {
    const data = JSON.parse(JSON.stringify(defaultResumeData))
    data.bulletOrders = { all: { acme: ['acme-b2', 'acme-b1', 'acme-b3'] } }
    useResumeStore.getState().setData(data)

    render(<BuildPage />)

    const props = componentLibraryPropsMock.mock.calls.at(-1)?.[0] as {
      defaultBulletOrderByRole: Record<string, string[]>
    }

    expect(props.defaultBulletOrderByRole).toBe(data.bulletOrders.all)
  })

  it('keeps comparison assembly stable across unrelated rerenders', () => {
    useUiStore.setState({ comparisonVector: 'platform' })

    const { rerender } = render(<BuildPage />)

    const firstProps = comparisonDiffPropsMock.mock.calls.at(-1)?.[0] as {
      leftResult: unknown
      rightResult: unknown
    }

    rerender(<BuildPage />)

    const secondProps = comparisonDiffPropsMock.mock.calls.at(-1)?.[0] as typeof firstProps

    expect(secondProps.leftResult).toBe(firstProps.leftResult)
    expect(secondProps.rightResult).toBe(firstProps.rightResult)
  })

  it('passes current resume data to the theme editor for content-aware health checks', () => {
    const data = JSON.parse(JSON.stringify(defaultResumeData))
    data.meta.phone = ''
    useResumeStore.getState().setData(data)

    render(<BuildPage />)

    expect(themeEditorPanelPropsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        resumeData: expect.objectContaining({
          meta: expect.objectContaining({ phone: '' }),
        }),
      }),
    )
  })

  it('keeps numeric vector shortcuts aligned after moving View All Bullets', () => {
    render(<BuildPage />)

    fireEvent.keyDown(document, { key: '0' })
    expect(useUiStore.getState().selectedVector).toBe('all')

    fireEvent.keyDown(document, { key: '1' })
    expect(useUiStore.getState().selectedVector).toBe('backend')
  })

  it('keeps job-specific generation hidden from Build without a pipeline handoff', () => {
    facetClientEnvMock.anthropicProxyUrl = ''

    render(<BuildPage />)

    expect(screen.queryByRole('button', { name: /Generate for Job/i })).toBeNull()
  })

  it('does not duplicate preview render progress in the working context', () => {
    pdfPreviewMock.mockReturnValue({
      previewBlobUrl: null,
      cachedPdfBlob: null,
      pageCount: null,
      pending: true,
      error: null,
    })

    render(<BuildPage />)

    const workingContext = screen.getByLabelText('Current working context')
    expect(within(workingContext).queryByText('Rendering…')).toBeNull()
    expect(within(workingContext).queryByText('Preview render in progress')).toBeNull()
  })

  it('does not duplicate pending preview page counts in the working context', () => {
    pdfPreviewMock.mockReturnValue({
      previewBlobUrl: 'blob:preview',
      cachedPdfBlob: new Blob(['pdf'], { type: 'application/pdf' }),
      pageCount: null,
      pending: false,
      error: null,
    })

    render(<BuildPage />)

    const workingContext = screen.getByLabelText('Current working context')
    expect(within(workingContext).queryByText('—')).toBeNull()
    expect(within(workingContext).queryByText('Awaiting first preview render')).toBeNull()
  })

  it('does not duplicate footer bullet counts in the working context', () => {
    const data = JSON.parse(JSON.stringify(defaultResumeData))
    data.roles = [
      {
        ...data.roles[0],
        bullets: [data.roles[0].bullets[0]],
      },
    ]
    useResumeStore.getState().setData(data)

    render(<BuildPage />)

    const workingContext = screen.getByLabelText('Current working context')
    expect(within(workingContext).queryByText('1 bullet included')).toBeNull()
  })

  it('reports pipeline source and AI vector plan state in the working context', () => {
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
    useResumeStore.getState().updateGeneration({
      source: 'pipeline',
      mode: 'dynamic',
      vectorMode: 'auto',
      pipelineEntryId: 'pipe-77',
      primaryVectorId: 'backend',
      vectorIds: ['backend'],
      suggestedVectorIds: ['backend'],
    })

    render(<BuildPage />)

    const workingContext = screen.getByLabelText('Current working context')
    const pipelineEntryLink = within(workingContext).getByRole('button', {
      name: 'Open pipeline entry for Acme Corp · Staff Platform Engineer',
    })
    expect(pipelineEntryLink).toBeTruthy()
    fireEvent.click(pipelineEntryLink)
    expect(navigateMock).toHaveBeenCalledWith({ to: '/pipeline', search: { entry: 'pipe-77' } })
    expect(within(workingContext).getByText('AI vector plan active')).toBeTruthy()
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

  it('demotes file and preset controls into a compact preview menu', () => {
    render(<BuildPage />)

    expect(screen.queryByRole('button', { name: /^File$/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Actions$/i })).toBeNull()
    expect(screen.getByRole('button', { name: /^Compare$/i })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /^More tools$/i }))

    const moreMenu = screen.getByRole('menu')
    expect((moreMenu as HTMLElement).style.position).toBe('fixed')
    expect(document.activeElement).toBe(screen.getByText('Import').closest('button'))
    fireEvent.keyDown(moreMenu, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(screen.getByText('Export').closest('button'))
    expect(screen.getByText('Import')).toBeTruthy()
    expect(screen.getByText('Export')).toBeTruthy()
    expect(screen.getByText('Download DOCX')).toBeTruthy()
    expect(screen.getByText('Variables')).toBeTruthy()
    expect(within(screen.getByRole('menu')).queryByText('Generate for Job')).toBeNull()
    expect(within(screen.getByRole('menu')).queryByText('View All Bullets')).toBeNull()
    expect(screen.getByText('Save Preset')).toBeTruthy()
  })

  it('keeps all-bullets mode available beside vector actions', () => {
    render(<BuildPage />)

    expect(useUiStore.getState().selectedVector).toBe('backend')
    const vectorBarProps = vectorBarPropsMock.mock.calls.at(-1)?.[0] as {
      onSelect: (vector: 'all') => void
    }
    vectorBarProps.onSelect('all')

    expect(useUiStore.getState().selectedVector).toBe('all')
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

  it('downloads the active resume as DOCX from the compact preview menu', async () => {
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:docx-download')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    render(<BuildPage />)

    fireEvent.click(screen.getByRole('button', { name: /^More tools$/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: /Download DOCX/i }))

    await waitFor(() => expect(renderResumeAsDocxMock).toHaveBeenCalledTimes(1))
    expect(createObjectUrl).toHaveBeenCalledWith(expect.any(Blob))
    expect(anchorClick).toHaveBeenCalledTimes(1)
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
    seedPipelineHandoff({
      gaps: [
        untagged({
          requirementId: 'req-rust',
          label: 'Rust',
          severity: 'low',
          reason: 'Rust evidence is light.',
          tags: ['rust'],
        }),
      ],
    })

    render(<BuildPage />)

    await waitFor(() => {
      expect(screen.getByText('Resume Vector Plan')).toBeTruthy()
    })

    expect(useUiStore.getState().suggestionModeActive).toBe(false)

    fireEvent.click(screen.getByLabelText('Manual'))
    fireEvent.click(screen.getByLabelText('Platform / DevEx (AI suggested)'))
    fireEvent.click(screen.getByLabelText('Backend Engineering (AI suggested)'))
    fireEvent.click(screen.getByRole('button', { name: 'Continue to assembly suggestions' }))

    await waitFor(() => {
      expect(useUiStore.getState().suggestionModeActive).toBe(true)
    })

    expect(useUiStore.getState().selectedVector).toBe('backend')
    expect(useResumeStore.getState().data.generation).toMatchObject({
      mode: 'dynamic',
      vectorMode: 'manual',
      primaryVectorId: 'backend',
      vectorIds: ['backend'],
      suggestedVectorIds: ['platform', 'backend'],
    })
  })

  it('requires pipeline-owned JD analysis instead of analyzing raw JD text in Build', async () => {
    const entry = createPipelineEntry()
    usePipelineStore.setState({
      entries: [entry],
      sortField: 'tier',
      sortDir: 'asc',
      filters: { tier: 'all', status: 'all', search: '' },
    })
    useJDAnalysisStore.setState({ analyses: [] })
    useHandoffStore.getState().setPendingGeneration({
      mode: 'dynamic',
      vectorMode: 'manual',
      source: 'pipeline',
      jobDescription: entry.jobDescription,
      pipelineEntryId: entry.id,
      presetId: null,
      primaryVectorId: null,
      vectorIds: [],
      suggestedVectorIds: [],
      resumeGeneration: null,
    })

    render(<BuildPage />)

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Run JD analysis from Pipeline')
    })
    const workingContext = screen.getByLabelText('Current working context')
    expect(within(workingContext).getByText('Analysis required')).toBeTruthy()
    expect(
      within(workingContext).getByText('Run JD analysis from Pipeline before generating'),
    ).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: /Analyze Pipeline JD|Refresh Analysis/i }),
    ).toBeNull()
    expect(screen.getByRole('button', { name: /^Open Pipeline Entry$/i })).toBeTruthy()
  })

  it('refreshes pipeline JD analysis from the canonical store without local analysis', async () => {
    seedPipelineHandoff()

    render(<BuildPage />)

    await waitFor(() => {
      expect(screen.getByText('Resume Vector Plan')).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: /^Generate for Job$/i }))
    expect(screen.getByRole('dialog', { name: 'Job Description Analysis' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /^Refresh from Pipeline Analysis$/i }))

    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toContain('Pipeline JD analysis loaded')
    })

    useJDAnalysisStore.setState({ analyses: [] })
    fireEvent.click(screen.getByRole('button', { name: /^Refresh from Pipeline Analysis$/i }))

    await waitFor(() => {
      expect(
        screen.getAllByText('Run JD analysis from Pipeline before generating a resume.').length,
      ).toBeGreaterThan(0)
    })
    expect(screen.getByRole('button', { name: /^Open Pipeline Entry$/i })).toBeTruthy()
  })

  it('applies the default AI multi-vector plan when confirmed without manual edits', async () => {
    seedPipelineHandoff()

    const { rerender } = render(<BuildPage />)

    await waitFor(() => {
      expect(screen.getByText('Platform / DevEx (AI suggested)')).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Continue to assembly suggestions' }))

    await waitFor(() => {
      expect(useUiStore.getState().suggestionModeActive).toBe(true)
    })

    expect(useUiStore.getState().selectedVector).toBe('platform')
    expect(useResumeStore.getState().data.generation).toMatchObject({
      mode: 'dynamic',
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
    expect(within(unavailableContext).getByText('Insights ready')).toBeTruthy()
    expect(within(unavailableContext).getByText('Positioning and gaps ready')).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Generate for Job$/i })).toHaveProperty(
      'disabled',
      false,
    )

    expect(screen.queryByRole('button', { name: /Open Build context details/i })).toBeNull()
    expect(within(unavailableContext).getByText('Dynamic')).toBeTruthy()
    expect(within(unavailableContext).getByText('AI vector plan active')).toBeTruthy()
    expect(
      within(unavailableContext).queryByText('Turn on suggestion mode after JD analysis'),
    ).toBeNull()
    expect(within(unavailableContext).queryByText('Analyze a JD to tailor this draft')).toBeNull()
  })

  it('persists structured dynamic variant metadata back to the originating pipeline entry', async () => {
    seedPipelineHandoff({ matchedKeywords: [] })

    render(<BuildPage />)

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
    expect(usePipelineStore.getState().entries[0]?.resumeId).toBe(
      useResumeStore.getState().activeResumeId,
    )
    expect(useResumeStore.getState().resumes[0]).toMatchObject({
      origin: {
        type: 'dynamic',
        pipelineEntryId: 'pipe-77',
      },
      pipelineEntryId: 'pipe-77',
    })
    expect(useResumeStore.getState().data.generation).toMatchObject({
      mode: 'dynamic',
      source: 'pipeline',
      pipelineEntryId: 'pipe-77',
      variantLabel: 'Acme Corp · Staff Platform Engineer',
      primaryVectorId: 'platform',
      vectorIds: ['platform', 'backend'],
    })

    const workingContext = screen.getByLabelText('Current working context')
    expect(within(workingContext).getByText('Dynamic')).toBeTruthy()
    expect(within(workingContext).getByText('Pipeline handoff')).toBeTruthy()
    expect(
      within(workingContext).getByRole('button', {
        name: 'Open pipeline entry for Acme Corp · Staff Platform Engineer',
      }),
    ).toBeTruthy()
  })

  it('prevents deselecting every vector in manual multi-vector mode', async () => {
    seedPipelineHandoff()

    render(<BuildPage />)

    await waitFor(() => {
      expect(screen.getByText('Platform / DevEx (AI suggested)')).toBeTruthy()
    })

    fireEvent.click(screen.getByLabelText('Manual'))
    fireEvent.click(screen.getByLabelText('Platform / DevEx (AI suggested)'))
    fireEvent.click(screen.getByLabelText('Backend Engineering (AI suggested)'))

    expect(screen.getByLabelText('Backend Engineering (AI suggested)')).toHaveProperty(
      'checked',
      true,
    )
    expect(screen.getByRole('button', { name: 'Continue to assembly suggestions' })).toHaveProperty(
      'disabled',
      false,
    )
  })
})
