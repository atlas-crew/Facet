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
      skillGroups: 1,
      education: 0,
      extractedBullets: 1,
      decomposedBullets: 0,
    },
    layout: 'ambiguous-columns',
  }
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

    identityExtractionMocks.generateIdentityDraftMock.mockResolvedValue({
      generatedAt: '2026-04-05T00:00:00.000Z',
      summary: 'Generated from scan.',
      followUpQuestions: [],
      identity: cloneIdentityFixture(),
      bullets: [],
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

    fireEvent.change(
      screen.getByDisplayValue('Ported the platform to Kubernetes-based installs.'),
      {
        target: { value: 'Ported the platform to Kubernetes-based installs for on-prem customers.' },
      },
    )

    expect(
      useIdentityStore.getState().scanResult?.identity.roles[0]?.bullets[0]?.source_text,
    ).toBe('Ported the platform to Kubernetes-based installs for on-prem customers.')
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

  it('falls back to paste-text mode when scan text exists but role parsing fails', async () => {
    const fallback = scanFixture()
    fallback.identity.roles = []
    fallback.counts.roles = 0
    fallback.counts.bullets = 0
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
})
