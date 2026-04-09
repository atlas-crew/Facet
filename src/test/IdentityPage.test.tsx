// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { IdentityPage } from '../routes/identity/IdentityPage'
import { useIdentityStore } from '../store/identityStore'
import { useResumeStore } from '../store/resumeStore'
import { useUiStore } from '../store/uiStore'
import { resolveStorage } from '../store/storage'
import { cloneIdentityFixture } from './fixtures/identityFixture'
import type { ResumeScanResult } from '../types/identity'

const navigateMock = vi.fn(async () => undefined)
const identityExtractionMocks = vi.hoisted(() => ({
  generateIdentityDraftMock: vi.fn(),
  deepenIdentityBulletMock: vi.fn(),
}))
const resumeScannerMocks = vi.hoisted(() => ({
  scanResumePdfMock: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}))

vi.mock('../utils/identityExtraction', async () => {
  const actual = await vi.importActual<typeof import('../utils/identityExtraction')>(
    '../utils/identityExtraction',
  )

  return {
    ...actual,
    generateIdentityDraft: identityExtractionMocks.generateIdentityDraftMock,
    deepenIdentityBullet: identityExtractionMocks.deepenIdentityBulletMock,
  }
})

vi.mock('../utils/resumeScanner', () => ({
  scanResumePdf: resumeScannerMocks.scanResumePdfMock,
}))

const scanFixture = (): ResumeScanResult => {
  const identity = cloneIdentityFixture()
  identity.identity.name = 'Nick Ferguson'
  identity.roles[0].bullets[0].problem = ''
  identity.roles[0].bullets[0].action = ''
  identity.roles[0].bullets[0].outcome = ''
  identity.roles[0].bullets[0].impact = []
  identity.roles[0].bullets[0].source_text =
    'Ported the platform to Kubernetes-based installs.'
  identity.projects = [
    {
      id: 'facet',
      name: 'Facet',
      description: 'Vector-based job search platform.',
      url: 'https://facet.test',
      tags: [],
    },
  ]
  identity.education = [
    {
      school: 'St. Petersburg College',
      degree: 'AAS, Computer Information Systems',
      location: 'Clearwater, FL',
    },
  ]

  return {
    fileName: 'resume.pdf',
    pageCount: 1,
    scannedAt: '2026-04-05T00:00:00.000Z',
    rawText: 'Nick Ferguson\nExperience\n• Ported the platform to Kubernetes-based installs.',
    identity,
    warnings: [
      {
        code: 'two-column-layout',
        severity: 'warning',
        message: 'This PDF looks like a two-column layout. Resume Scanner v1 only supports single-column resumes, so review the extracted structure carefully.',
      },
    ],
    counts: {
      roles: 1,
      bullets: 1,
      projects: 1,
      skillGroups: 1,
      education: 1,
      extractedBullets: 1,
      decomposedBullets: 0,
      scannedBullets: 1,
      deepenedBullets: 0,
      editedBullets: 0,
      failedBullets: 0,
    },
    layout: 'ambiguous-columns',
    progress: {
      bullets: {},
      bulk: {
        status: 'idle',
        total: 0,
        completed: 0,
        currentBulletKey: null,
        lastUpdatedAt: null,
      },
    },
  }
}

const scanFixtureWithTwoBullets = (): ResumeScanResult => {
  const result = scanFixture()
  result.identity.roles[0].bullets.push({
    id: 'second-migration',
    source_text: 'Migrated workloads to EKS with Helm charts.',
    problem: '',
    action: '',
    outcome: '',
    impact: [],
    metrics: {},
    technologies: [],
    tags: [],
  })
  result.counts.bullets = 2
  result.counts.extractedBullets = 2
  result.counts.scannedBullets = 2
  result.rawText += '\n• Migrated workloads to EKS with Helm charts.'
  return result
}

const createAbortError = (): DOMException => new DOMException('The operation was aborted.', 'AbortError')

const uploadPdf = (container: HTMLElement, fileName = 'resume.pdf') => {
  const uploadInput = container.querySelector('input[type="file"][accept="application/pdf,.pdf"]')
  if (!uploadInput) {
    throw new Error('PDF upload input not found. IdentityPage may not have rendered the upload intake.')
  }
  fireEvent.change(uploadInput as HTMLInputElement, {
    target: {
      // Content is irrelevant here because scanResumePdf is fully mocked in this test file.
      files: [new File(['%PDF-1.4'], fileName, { type: 'application/pdf' })],
    },
  })
}

const flushMicrotasks = async (count = 3) => {
  // rejection handler -> store write -> React/store follow-on microtask before assertions
  for (let index = 0; index < count; index += 1) {
    await Promise.resolve()
  }
}

const rejectWithAbort = async (reject: (reason?: unknown) => void) => {
  await act(async () => {
    reject(createAbortError())
    // Flush the rejection handler and the follow-on React/store microtasks before asserting.
    await flushMicrotasks()
  })
}

const expectBlob = (value: Blob | MediaSource | undefined): Blob => {
  expect(value).toBeInstanceOf(Blob)
  return value as Blob
}

const setupExportMocks = (url: string, expectedFilename: string) => ({
  createObjectUrlMock: vi.spyOn(URL, 'createObjectURL').mockReturnValue(url),
  revokeObjectUrlMock: vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined),
  anchorClickMock: vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    expect(this.href).toContain(url)
    expect(this.download).toBe(expectedFilename)
  }),
})

describe('IdentityPage', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_ANTHROPIC_PROXY_URL', 'https://ai.example/proxy')
    resolveStorage().removeItem('facet-identity-workspace')
    useResumeStore.setState((state) => ({ ...state }))
    useUiStore.setState({
      selectedVector: 'all',
      panelRatio: 0.45,
      appearance: 'system',
      viewMode: 'pdf',
      showHeatmap: false,
      showDesignHealth: false,
      suggestionModeActive: false,
      comparisonVector: null,
      backupRemindersEnabled: true,
      backupReminderIntervalDays: 14,
      backupReminderSnoozedUntil: null,
      lastBackupAt: null,
      tourCompleted: false,
    })
    useIdentityStore.setState({
      intakeMode: 'upload',
      sourceMaterial: '',
      correctionNotes: '',
      currentIdentity: null,
      draft: null,
      draftDocument: '',
      scanResult: null,
      warnings: [],
      changelog: [],
      lastError: null,
    })

    identityExtractionMocks.generateIdentityDraftMock.mockReset()
    identityExtractionMocks.generateIdentityDraftMock.mockResolvedValue({
      generatedAt: '2026-04-05T00:00:00.000Z',
      summary: 'Generated from scan.',
      followUpQuestions: [],
      identity: cloneIdentityFixture(),
      bullets: [],
      warnings: [],
    })
    identityExtractionMocks.deepenIdentityBulletMock.mockReset()
    identityExtractionMocks.deepenIdentityBulletMock.mockResolvedValue({
      summary: 'Deepened the migration bullet.',
      roleId: 'a10',
      bulletId: 'platform-migration',
      bullet: {
        id: 'platform-migration',
        problem: 'Cloud-only delivery blocked on-prem installs.',
        action: 'Ported the platform to Kubernetes-based installs for on-prem customers.',
        outcome: 'Made the product deployable in customer environments.',
        impact: ['Unlocked customer-hosted deployments'],
        metrics: { installs: 12 },
        technologies: ['Kubernetes'],
        source_text: 'ignored',
        tags: ['platform', 'kubernetes'],
      },
      rewrite: 'Ported the platform to Kubernetes-based installs for on-prem customers.',
      assumptions: [],
      warnings: [],
    })
    resumeScannerMocks.scanResumePdfMock.mockResolvedValue(scanFixture())
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllEnvs()
    vi.useRealTimers()
    vi.restoreAllMocks()
    navigateMock.mockReset()
  })

  it('uploads a PDF, populates the scan editor, and uses the scanned identity as the AI seed', async () => {
    const { container } = render(<IdentityPage />)
    uploadPdf(container)

    await waitFor(() => {
      expect(screen.getByDisplayValue('Nick Ferguson')).toBeTruthy()
    })

    expect(screen.getByDisplayValue('Facet')).toBeTruthy()
    expect(screen.getByDisplayValue('Vector-based job search platform.')).toBeTruthy()
    expect(screen.getByDisplayValue('Clearwater, FL')).toBeTruthy()
    expect(screen.getByLabelText('Projects: 1')).toBeTruthy()

    fireEvent.change(
      screen.getByDisplayValue('Ported the platform to Kubernetes-based installs.'),
      {
        target: { value: 'Ported the platform to Kubernetes-based installs for on-prem customers.' },
      },
    )

    expect(
      useIdentityStore.getState().scanResult?.identity.roles[0]?.bullets[0]?.source_text,
    ).toBe('Ported the platform to Kubernetes-based installs for on-prem customers.')
    fireEvent.change(screen.getByDisplayValue('Facet'), {
      target: { value: 'Facet OSS' },
    })
    expect(useIdentityStore.getState().scanResult?.identity.projects[0]?.name).toBe('Facet OSS')
    expect(screen.getByText(/two-column layout/i)).toBeTruthy()

    fireEvent.click(screen.getByText('Generate Draft'))

    await waitFor(() => {
      expect(identityExtractionMocks.generateIdentityDraftMock).toHaveBeenCalledTimes(1)
    })

    expect(identityExtractionMocks.generateIdentityDraftMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceMaterial: 'Nick Ferguson\nExperience\n• Ported the platform to Kubernetes-based installs.',
        seedIdentity: expect.objectContaining({
          roles: [
            expect.objectContaining({
              bullets: [
                expect.objectContaining({
                  source_text: 'Ported the platform to Kubernetes-based installs for on-prem customers.',
                }),
              ],
            }),
          ],
        }),
      }),
    )
  })

  it('opens the file chooser when Upload Resume is clicked from paste mode', async () => {
    const inputClickMock = vi
      .spyOn(HTMLInputElement.prototype, 'click')
      .mockImplementation(() => undefined)

    useIdentityStore.setState({
      intakeMode: 'paste',
    })

    render(<IdentityPage />)

    fireEvent.click(screen.getByText('Upload Resume'))

    await waitFor(() => {
      expect(useIdentityStore.getState().intakeMode).toBe('upload')
      expect(inputClickMock).toHaveBeenCalledTimes(1)
    })
  })

  it('scans a dropped PDF from the upload zone', async () => {
    render(<IdentityPage />)

    fireEvent.drop(screen.getByText('Drag a resume PDF here or click to browse'), {
      dataTransfer: {
        files: [new File(['%PDF-1.4'], 'resume.pdf', { type: 'application/pdf' })],
      },
    })

    await waitFor(() => {
      expect(screen.getByDisplayValue('Nick Ferguson')).toBeTruthy()
    })
  })

  it('falls back to paste-text mode when scan text exists but role parsing fails', async () => {
    const fallback = scanFixture()
    fallback.identity.roles = []
    fallback.counts.roles = 0
    fallback.counts.bullets = 0
    fallback.counts.projects = 1
    fallback.counts.extractedBullets = 0
    fallback.warnings = [
      {
        code: 'role-parse-fallback',
        severity: 'warning',
        message:
          'Resume text extraction succeeded, but role parsing did not. The app will fall back to paste-text mode with the raw extracted text.',
      },
    ]
    resumeScannerMocks.scanResumePdfMock.mockResolvedValue(fallback)

    const { container } = render(<IdentityPage />)
    uploadPdf(container)

    await waitFor(() => {
      expect(screen.getByLabelText('Source Material')).toBeTruthy()
    })

    expect(useIdentityStore.getState().intakeMode).toBe('paste')
    expect(useIdentityStore.getState().scanResult).toBeNull()
    expect(useIdentityStore.getState().sourceMaterial).toContain('Experience')
  })

  it('cancels in-flight scan work on unmount without leaving stale UI state', async () => {
    let rejectScan!: (reason?: unknown) => void
    resumeScannerMocks.scanResumePdfMock.mockImplementation(
      () =>
        new Promise<ResumeScanResult>((_resolve, reject) => {
          rejectScan = reject
        }),
    )

    const { container, unmount } = render(<IdentityPage />)
    uploadPdf(container)

    await waitFor(() => {
      expect(screen.getByText('Scanning PDF…')).toBeTruthy()
    })

    unmount()
    await rejectWithAbort(rejectScan)

    expect(useIdentityStore.getState().scanResult).toBeNull()
    expect(useIdentityStore.getState().sourceMaterial).toBe('')
  })

  it('cancels in-flight draft generation on unmount without persisting stale notices', async () => {
    let rejectGenerate!: (reason?: unknown) => void
    identityExtractionMocks.generateIdentityDraftMock.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectGenerate = reject
        }),
    )

    const { container, unmount } = render(<IdentityPage />)
    uploadPdf(container)

    await waitFor(() => {
      expect(screen.getByDisplayValue('Nick Ferguson')).toBeTruthy()
    })

    fireEvent.click(screen.getByText('Generate Draft'))

    await waitFor(() => {
      expect(screen.getByText('Generating…')).toBeTruthy()
    })

    unmount()
    await rejectWithAbort(rejectGenerate)

    expect(useIdentityStore.getState().draft).toBeNull()
  })

  it('exports the current draft document and revokes the object URL after download', async () => {
    const { createObjectUrlMock, revokeObjectUrlMock, anchorClickMock } =
      setupExportMocks('blob:draft-export', 'identity-draft.json')
    const draftDocument = JSON.stringify(cloneIdentityFixture(), null, 2)

    useIdentityStore.setState({
      draft: {
        generatedAt: '2026-04-05T00:00:00.000Z',
        summary: 'Draft ready.',
        followUpQuestions: [],
        identity: cloneIdentityFixture(),
        bullets: [],
        warnings: [],
      },
      draftDocument,
    })

    vi.useFakeTimers()
    render(<IdentityPage />)

    const exportDraftButton = screen.getByText('Export Draft')
    fireEvent.click(exportDraftButton)

    expect(createObjectUrlMock).toHaveBeenCalledTimes(1)
    const draftBlob = expectBlob(createObjectUrlMock.mock.calls[0]?.[0])
    expect(draftBlob.type).toBe('application/json')
    await expect(draftBlob.text()).resolves.toBe(draftDocument)
    expect(anchorClickMock).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Exported the current draft document.')).toBeTruthy()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })

    expect(revokeObjectUrlMock).toHaveBeenCalledWith('blob:draft-export')
  })

  it('deepens a scanned bullet inline and marks manual edits as corrected', async () => {
    const { container } = render(<IdentityPage />)
    uploadPdf(container)

    await waitFor(() => {
      expect(screen.getByDisplayValue('Nick Ferguson')).toBeTruthy()
    })

    fireEvent.click(screen.getByText('Deepen'))

    await waitFor(() => {
      expect(identityExtractionMocks.deepenIdentityBulletMock).toHaveBeenCalledTimes(1)
    })

    expect(identityExtractionMocks.deepenIdentityBulletMock).toHaveBeenCalledWith(
      expect.objectContaining({
        roleId: 'a10',
        bulletId: 'platform-migration',
      }),
    )

    await waitFor(() => {
      expect(screen.getByDisplayValue('Cloud-only delivery blocked on-prem installs.')).toBeTruthy()
    })

    fireEvent.change(screen.getByDisplayValue('Cloud-only delivery blocked on-prem installs.'), {
      target: { value: 'Cloud-only delivery blocked on-prem customer installs.' },
    })

    expect(useIdentityStore.getState().scanResult?.counts.editedBullets).toBe(1)
    expect(
      useIdentityStore.getState().scanResult?.identity.roles[0]?.bullets[0]?.problem,
    ).toBe('Cloud-only delivery blocked on-prem customer installs.')
    expect(screen.getAllByText('Edited').length).toBeGreaterThan(0)
  })

  it('shows structured-only deepen results inline even when prose fields stay empty', async () => {
    identityExtractionMocks.deepenIdentityBulletMock.mockResolvedValueOnce({
      summary: 'Extracted structured details from the migration bullet.',
      roleId: 'a10',
      bulletId: 'platform-migration',
      bullet: {
        id: 'platform-migration',
        problem: '',
        action: '',
        outcome: '',
        impact: ['Unlocked customer-hosted deployments'],
        metrics: { installs: 12 },
        technologies: ['Kubernetes'],
        source_text: 'ignored',
        tags: ['platform', 'kubernetes'],
      },
      rewrite: 'Ported the platform to Kubernetes-based installs for on-prem customers.',
      assumptions: [],
      warnings: [],
    })

    const { container } = render(<IdentityPage />)
    uploadPdf(container)

    await waitFor(() => {
      expect(screen.getByDisplayValue('Nick Ferguson')).toBeTruthy()
    })

    fireEvent.click(screen.getByText('Deepen'))

    await waitFor(() => {
      expect(screen.getByLabelText('Technologies')).toBeTruthy()
    })

    expect((screen.getByLabelText('Technologies') as HTMLTextAreaElement).value).toContain('Kubernetes')
  })

  it('shows guessed rewrite details and correction guidance after deepening a bullet', async () => {
    identityExtractionMocks.deepenIdentityBulletMock.mockResolvedValueOnce({
      summary: 'Guessed the customer-facing rollout context from the scanned bullet.',
      roleId: 'a10',
      bulletId: 'platform-migration',
      bullet: {
        id: 'platform-migration',
        problem: 'Cloud-only delivery blocked on-prem installs.',
        action: 'Ported the platform to Kubernetes-based installs for on-prem customers.',
        outcome: 'Made the product deployable in customer environments.',
        impact: ['Unlocked customer-hosted deployments'],
        metrics: { installs: 12 },
        technologies: ['Kubernetes'],
        source_text: 'ignored',
        tags: ['platform', 'kubernetes'],
      },
      rewrite: 'Ported the platform to Kubernetes-based installs for on-prem customers.',
      assumptions: [
        {
          label: 'Assumed the installs were customer-hosted',
          confidence: 'guessing',
        },
      ],
      warnings: ['Double-check whether the rollout was customer-hosted or internal-only.'],
    })

    const { container } = render(<IdentityPage />)
    uploadPdf(container)

    await waitFor(() => {
      expect(screen.getByDisplayValue('Nick Ferguson')).toBeTruthy()
    })

    fireEvent.click(screen.getByText('Deepen'))

    await waitFor(() => {
      expect(screen.getByText('Current AI rewrite')).toBeTruthy()
    })

    expect(
      screen.getAllByText('Guessed the customer-facing rollout context from the scanned bullet.').length,
    ).toBeGreaterThan(0)
    expect(screen.getByText('Assumed the installs were customer-hosted · Guessing')).toBeTruthy()
    expect(
      screen.getAllByText('Double-check whether the rollout was customer-hosted or internal-only.').length,
    ).toBeGreaterThan(0)
    expect(screen.getByText(/Edit the fields below to correct any guessed details/i)).toBeTruthy()
  })

  it('shows correction guidance for scanned bullets that already start in guessing mode', async () => {
    const guessedScan = scanFixture()
    guessedScan.identity.roles[0].bullets[0].problem = 'Legacy delivery path blocked on-prem installs.'
    guessedScan.identity.roles[0].bullets[0].action = 'Ported the platform to Kubernetes-based installs.'
    guessedScan.identity.roles[0].bullets[0].outcome = 'Made the product deployable in customer environments.'
    resumeScannerMocks.scanResumePdfMock.mockResolvedValueOnce(guessedScan)

    const { container } = render(<IdentityPage />)
    uploadPdf(container)

    await waitFor(() => {
      expect(screen.getByDisplayValue('Legacy delivery path blocked on-prem installs.')).toBeTruthy()
    })

    expect(screen.getAllByText('Guessing').length).toBeGreaterThan(0)
    expect(
      screen.getByText(
        'This decomposition was inferred from the scanned source text. Review and edit the fields below to confirm any guessed details. Your first edit will switch this bullet from Guessing to Corrected.',
      ),
    ).toBeTruthy()
  })

  it('disables bullet deepening when the scanned source text is blank', async () => {
    const { container } = render(<IdentityPage />)
    uploadPdf(container)

    await waitFor(() => {
      expect(screen.getByDisplayValue('Nick Ferguson')).toBeTruthy()
    })

    fireEvent.change(screen.getByDisplayValue('Ported the platform to Kubernetes-based installs.'), {
      target: { value: '' },
    })

    const deepenButton = screen.getByText('Deepen') as HTMLButtonElement
    expect(deepenButton.disabled).toBe(true)

    fireEvent.click(deepenButton)
    expect(identityExtractionMocks.deepenIdentityBulletMock).toHaveBeenCalledTimes(0)
  })

  it('disables Deepen All while a single bullet deepen is running', async () => {
    let resolveDeepen!: (value: Awaited<ReturnType<typeof identityExtractionMocks.deepenIdentityBulletMock>>) => void
    identityExtractionMocks.deepenIdentityBulletMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveDeepen = resolve
        }),
    )

    const { container } = render(<IdentityPage />)
    uploadPdf(container)

    await waitFor(() => {
      expect(screen.getByDisplayValue('Nick Ferguson')).toBeTruthy()
    })

    fireEvent.click(screen.getByText('Deepen'))

    await waitFor(() => {
      expect(identityExtractionMocks.deepenIdentityBulletMock).toHaveBeenCalledTimes(1)
    })

    const deepenAllButton = screen.getByText('Deepen All')
    expect((deepenAllButton as HTMLButtonElement).disabled).toBe(true)

    await act(async () => {
      resolveDeepen({
        summary: 'Deepened the migration bullet.',
        roleId: 'a10',
        bulletId: 'platform-migration',
        bullet: {
          id: 'platform-migration',
          problem: 'Cloud-only delivery blocked on-prem installs.',
          action: 'Ported the platform to Kubernetes-based installs for on-prem customers.',
          outcome: 'Made the product deployable in customer environments.',
          impact: ['Unlocked customer-hosted deployments'],
          metrics: { installs: 12 },
          technologies: ['Kubernetes'],
          source_text: 'ignored',
          tags: ['platform', 'kubernetes'],
        },
        rewrite: 'Ported the platform to Kubernetes-based installs for on-prem customers.',
        assumptions: [],
        warnings: [],
      })
      await flushMicrotasks()
    })

    await waitFor(() => {
      expect(screen.getByText('Deepen All')).toBeTruthy()
    })
  })

  it('ignores overlapping single-bullet deepen requests while one is already running', async () => {
    let resolveFirstDeepen!: (value: Awaited<ReturnType<typeof identityExtractionMocks.deepenIdentityBulletMock>>) => void
    resumeScannerMocks.scanResumePdfMock.mockResolvedValueOnce(scanFixtureWithTwoBullets())
    identityExtractionMocks.deepenIdentityBulletMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirstDeepen = resolve
        }),
    )

    const { container } = render(<IdentityPage />)
    uploadPdf(container)

    await waitFor(() => {
      expect(screen.getByDisplayValue('Nick Ferguson')).toBeTruthy()
    })

    const deepenButtons = screen.getAllByText('Deepen')
    fireEvent.click(deepenButtons[0] as HTMLButtonElement)
    fireEvent.click(deepenButtons[1] as HTMLButtonElement)

    await waitFor(() => {
      expect(identityExtractionMocks.deepenIdentityBulletMock).toHaveBeenCalledTimes(1)
    })

    await act(async () => {
      resolveFirstDeepen({
        summary: 'Deepened the migration bullet.',
        roleId: 'a10',
        bulletId: 'platform-migration',
        bullet: {
          id: 'platform-migration',
          problem: 'Cloud-only delivery blocked on-prem installs.',
          action: 'Ported the platform to Kubernetes-based installs for on-prem customers.',
          outcome: 'Made the product deployable in customer environments.',
          impact: ['Unlocked customer-hosted deployments'],
          metrics: { installs: 12 },
          technologies: ['Kubernetes'],
          source_text: 'ignored',
          tags: ['platform', 'kubernetes'],
        },
        rewrite: 'Ported the platform to Kubernetes-based installs for on-prem customers.',
        assumptions: [],
        warnings: [],
      })
      await flushMicrotasks()
    })

    await waitFor(() => {
      expect(useIdentityStore.getState().scanResult?.progress.bullets['a10::platform-migration']?.status).toBe(
        'completed',
      )
    })

    expect(useIdentityStore.getState().scanResult?.progress.bullets['a10::second-migration']?.status).toBe(
      'idle',
    )
    expect((screen.getByText('Deepen All') as HTMLButtonElement).disabled).toBe(false)
  })

  it('deepens all scanned bullets sequentially from the scanner card', async () => {
    const { container } = render(<IdentityPage />)
    uploadPdf(container)

    await waitFor(() => {
      expect(screen.getByDisplayValue('Nick Ferguson')).toBeTruthy()
    })

    fireEvent.click(screen.getByText('Deepen All'))

    await waitFor(() => {
      expect(identityExtractionMocks.deepenIdentityBulletMock).toHaveBeenCalledTimes(1)
    })

    expect(useIdentityStore.getState().scanResult?.counts.deepenedBullets).toBe(1)
    expect(screen.getByText('Deepened 1 scanned bullet(s).')).toBeTruthy()
  })

  it('preserves focused impact edits across progress updates and keeps comma-bearing statements intact', async () => {
    const { container } = render(<IdentityPage />)
    uploadPdf(container)

    await waitFor(() => {
      expect(screen.getByDisplayValue('Nick Ferguson')).toBeTruthy()
    })

    fireEvent.click(screen.getByText('Deepen'))

    await waitFor(() => {
      expect(screen.getByDisplayValue('Cloud-only delivery blocked on-prem installs.')).toBeTruthy()
    })

    const impactField = screen.getByLabelText('Impact')
    const impactValue = 'Reduced latency by 40%, improving p99 to 12ms'

    fireEvent.focus(impactField)
    fireEvent.change(impactField, {
      target: { value: impactValue },
    })

    act(() => {
      useIdentityStore.getState().startScanBulkDeepen()
    })

    expect((screen.getByLabelText('Impact') as HTMLTextAreaElement).value).toBe(impactValue)

    fireEvent.blur(impactField)

    expect(useIdentityStore.getState().scanResult?.identity.roles[0]?.bullets[0]?.impact).toEqual([impactValue])
  })

  it('cancels bulk deepening without failing the current bullet', async () => {
    let rejectDeepen!: (reason?: unknown) => void
    identityExtractionMocks.deepenIdentityBulletMock.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectDeepen = reject
        }),
    )

    const { container } = render(<IdentityPage />)
    uploadPdf(container)

    await waitFor(() => {
      expect(screen.getByDisplayValue('Nick Ferguson')).toBeTruthy()
    })

    fireEvent.click(screen.getByText('Deepen All'))

    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeTruthy()
    })

    fireEvent.click(screen.getByText('Cancel'))
    await rejectWithAbort(rejectDeepen)

    expect(useIdentityStore.getState().scanResult?.progress.bulk.status).toBe('idle')
    expect(useIdentityStore.getState().scanResult?.counts.failedBullets).toBe(0)
  })

  it('does not finalize a bulk deepening run after the scan is cleared', async () => {
    let rejectDeepen!: (reason?: unknown) => void
    identityExtractionMocks.deepenIdentityBulletMock.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectDeepen = reject
        }),
    )

    const { container } = render(<IdentityPage />)
    uploadPdf(container)

    await waitFor(() => {
      expect(screen.getByDisplayValue('Nick Ferguson')).toBeTruthy()
    })

    fireEvent.click(screen.getByText('Deepen All'))

    await waitFor(() => {
      expect(identityExtractionMocks.deepenIdentityBulletMock).toHaveBeenCalledTimes(1)
    })

    fireEvent.click(screen.getByText('Clear Scan'))
    await rejectWithAbort(rejectDeepen)

    expect(useIdentityStore.getState().scanResult).toBeNull()
    expect(screen.getByText('Cleared the scanned resume structure.')).toBeTruthy()
    expect(screen.queryByText('Deepened 1 scanned bullet(s).')).toBeNull()
    expect(screen.queryByText('Stopped bulk deepening after completing 0 bullet(s).')).toBeNull()
  })

  it('aborts an in-flight bullet deepen when the scan is cleared', async () => {
    let rejectDeepen!: (reason?: unknown) => void
    identityExtractionMocks.deepenIdentityBulletMock.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectDeepen = reject
        }),
    )

    const { container } = render(<IdentityPage />)
    uploadPdf(container)

    await waitFor(() => {
      expect(screen.getByDisplayValue('Nick Ferguson')).toBeTruthy()
    })

    fireEvent.click(screen.getByText('Deepen'))

    await waitFor(() => {
      expect(identityExtractionMocks.deepenIdentityBulletMock).toHaveBeenCalledTimes(1)
    })

    fireEvent.click(screen.getByText('Clear Scan'))
    await rejectWithAbort(rejectDeepen)

    expect(useIdentityStore.getState().scanResult).toBeNull()
    expect(screen.queryByText('Bullet deepening failed.')).toBeNull()
  })

  it('exports the current identity model and revokes the object URL after download', async () => {
    const { createObjectUrlMock, revokeObjectUrlMock, anchorClickMock } =
      setupExportMocks('blob:identity-export', 'identity.json')
    const currentIdentity = cloneIdentityFixture()
    const expectedIdentityDocument = JSON.stringify(currentIdentity, null, 2)

    useIdentityStore.setState({
      currentIdentity,
    })

    vi.useFakeTimers()
    render(<IdentityPage />)

    const exportIdentityButton = screen.getByText('Export Identity')
    fireEvent.click(exportIdentityButton)

    expect(createObjectUrlMock).toHaveBeenCalledTimes(1)
    const identityBlob = expectBlob(createObjectUrlMock.mock.calls[0]?.[0])
    expect(identityBlob.type).toBe('application/json')
    await expect(identityBlob.text()).resolves.toBe(expectedIdentityDocument)
    expect(anchorClickMock).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Exported the current identity model.')).toBeTruthy()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })

    expect(revokeObjectUrlMock).toHaveBeenCalledWith('blob:identity-export')
  })

  it('shows the enrichment banner counts and CTA when an identity model exists', () => {
    const currentIdentity = cloneIdentityFixture()
    currentIdentity.skills.groups[0]!.items = [
      {
        name: 'Kubernetes',
        tags: ['platform', 'kubernetes'],
        depth: 'strong',
        context: 'Used for customer-hosted deployments.',
        search_signal: 'Platform modernization and Kubernetes operations.',
      },
      {
        name: 'Terraform',
        tags: ['platform', 'iac'],
        skipped_at: '2026-04-08T00:00:00.000Z',
      },
      {
        name: 'TypeScript',
        tags: ['backend', 'typescript'],
      },
    ]
    useIdentityStore.setState({
      currentIdentity,
    })

    render(<IdentityPage />)

    expect(screen.getByText('Skill Enrichment')).toBeTruthy()
    expect(screen.getByText(/Pending 1/i)).toBeTruthy()
    expect(screen.getByText(/Complete 1/i)).toBeTruthy()
    expect(screen.getByText(/Skipped 1/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Continue Skill Enrichment' })).toBeTruthy()
  })
})
