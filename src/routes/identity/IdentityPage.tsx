import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Download, FileJson, Upload } from 'lucide-react'
import { professionalIdentityToResumeData } from '../../identity/resumeAdapter'
import type { ProfessionalIdentityV3 } from '../../identity/schema'
import {
  getActiveResumeScan,
  hasAiDeepenExplanation,
  useIdentityStore,
} from '../../store/identityStore'
import { useJDAnalysisStore } from '../../store/jdAnalysisStore'
import { useResumeStore } from '../../store/resumeStore'
import { useUiStore } from '../../store/uiStore'
import { PRODUCTION_AUDIENCES, type AudienceTag } from '../../types/audience'
import {
  getSupplementalContextLengthError,
  SUPPLEMENTAL_CONTEXT_MAX_BYTES,
  SUPPLEMENTAL_CONTEXT_TOTAL_MAX_CHARS,
  type IdentityApplyMode,
  type IntakeSource,
  type SupplementalContextSource,
} from '../../types/identity'
import { facetClientEnv } from '../../utils/facetEnv'
import { createId, sanitizeEndpointUrl } from '../../utils/idUtils'
import {
  deepenIdentityBullet,
  generateIdentityDraft,
  parseIdentityExtractionResponse,
} from '../../utils/identityExtraction'
import { intakeSynthesis, scanResumePdf } from '../../utils/resumeScanner'
import {
  resolveComparisonVectorAfterReplaceImport,
  resolveSelectedVectorAfterReplaceImport,
} from '../../utils/importSelection'
import { parseJsonWithRepair } from '../../utils/jsonParsing'
import { getSupplementalContextTokenLimitError } from '../../utils/supplementalContextSecurity'
import { useFocusTrap } from '../../utils/useFocusTrap'
import {
  buildAudienceReviewSummary,
  buildUnclassifiedAudienceSummary,
  formatAudienceLabel,
  setAudienceOverrideForInsightAudiences,
} from '../../utils/audienceFilter'
import type { AudienceReviewInsight } from '../../utils/audienceFilter'
import type { JDAnalysis } from '../../types/jdAnalysis'
import { BulletConfidenceCard } from './BulletConfidenceCard'
import { DraftSummaryCard } from './DraftSummaryCard'
import { ExtractionAgentCard } from './ExtractionAgentCard'
import { IdentityModelBuilderCard } from './IdentityModelBuilderCard'
import { ProposedVectorsCard } from './ProposedVectorsCard'
import './identity.css'

const downloadJson = (filename: string, content: string) => {
  const blob = new Blob([content], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  globalThis.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

type IdentityPrimaryAction =
  | 'upload'
  | 'generate'
  | 'reviewDraft'
  | 'pushToBuild'

const assertNever = (value: never): never => {
  throw new Error(`Unexpected identity action: ${String(value)}`)
}

const insightLabelDetail = (label: string): string => label.replace(/^[^:]+:\s*/, '')

const hasPopulatedIdentity = (identity: ProfessionalIdentityV3 | null) =>
  Boolean(
    identity &&
    ([
      identity.identity.name,
      identity.identity.display_name,
      identity.identity.email,
      identity.identity.phone,
      identity.identity.location,
      identity.identity.title,
      identity.identity.thesis,
      identity.identity.elaboration,
      identity.identity.origin,
    ].some((value) => value?.trim()) ||
      (identity.identity.links ?? []).some((link) => link.url.trim()) ||
      (identity.roles ?? []).length > 0 ||
      (identity.projects ?? []).length > 0 ||
      (identity.education ?? []).length > 0 ||
      (identity.profiles ?? []).length > 0 ||
      (identity.skills.groups ?? []).length > 0 ||
      (identity.search_vectors?.length ?? 0) > 0),
  )

export function IdentityPage() {
  const navigate = useNavigate()
  const importRef = useRef<HTMLInputElement>(null)
  const uploadRef = useRef<HTMLInputElement>(null)
  const primaryActionButtonRef = useRef<HTMLButtonElement>(null)
  const draftPanelRef = useRef<HTMLDivElement>(null)
  const replaceConfirmModalRef = useRef<HTMLDivElement>(null)
  const replaceConfirmCancelRef = useRef<HTMLButtonElement>(null)
  const replaceConfirmReturnFocusRef = useRef<HTMLElement | null>(null)
  const generateAbortRef = useRef<AbortController | null>(null)
  const scanAbortRef = useRef<AbortController | null>(null)
  // Single-bullet and bulk deepening are intentionally mutually exclusive in the UI.
  const deepenAbortRef = useRef<AbortController | null>(null)
  // Set to true when "Rescan" triggers the file picker, so the next upload-change
  // event treats the first file as a primary-source replacement rather than an append.
  const rescanModeRef = useRef(false)
  const [pendingModelScrollTarget, setPendingModelScrollTarget] = useState<'draft' | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [pageError, setPageError] = useState<string | null>(null)
  const [pageNotice, setPageNotice] = useState<string | null>(null)
  const [pendingReplaceGenerateMode, setPendingReplaceGenerateMode] = useState<
    'fresh' | 'regenerate' | null
  >(null)
  // Transient list of files that failed to scan within a batch. Surfaces inline
  // per AC #6; never persisted, dismissed manually by the user.
  const [failedFiles, setFailedFiles] = useState<{ id: string; name: string; error: string }[]>([])
  const intakeMode = useIdentityStore((state) => state.intakeMode)
  const sourceMaterial = useIdentityStore((state) => state.sourceMaterial)
  const correctionNotes = useIdentityStore((state) => state.correctionNotes)
  const currentIdentity = useIdentityStore((state) => state.currentIdentity)
  const draft = useIdentityStore((state) => state.draft)
  const draftDocument = useIdentityStore((state) => state.draftDocument)
  const scanResult = useIdentityStore(getActiveResumeScan)
  const warnings = useIdentityStore((state) => state.warnings)
  const changelog = useIdentityStore((state) => state.changelog)
  const setIntakeMode = useIdentityStore((state) => state.setIntakeMode)
  const setSourceMaterial = useIdentityStore((state) => state.setSourceMaterial)
  const setCorrectionNotes = useIdentityStore((state) => state.setCorrectionNotes)
  const setDraft = useIdentityStore((state) => state.setDraft)
  const setDraftDocument = useIdentityStore((state) => state.setDraftDocument)
  const setScanResult = useIdentityStore((state) => state.setScanResult)
  const intakeSources = useIdentityStore((state) => state.intakeSources)
  const appendIntakeSource = useIdentityStore((state) => state.appendIntakeSource)
  const removeIntakeSource = useIdentityStore((state) => state.removeIntakeSource)
  const setIntakeSourceLabel = useIdentityStore((state) => state.setIntakeSourceLabel)
  const startScannedBulletDeepen = useIdentityStore((state) => state.startScannedBulletDeepen)
  const completeScannedBulletDeepen = useIdentityStore((state) => state.completeScannedBulletDeepen)
  const failScannedBulletDeepen = useIdentityStore((state) => state.failScannedBulletDeepen)
  const startScanBulkDeepen = useIdentityStore((state) => state.startScanBulkDeepen)
  const updateScanBulkProgress = useIdentityStore((state) => state.updateScanBulkProgress)
  const requestCancelScanBulkDeepen = useIdentityStore((state) => state.requestCancelScanBulkDeepen)
  const finishScanBulkDeepen = useIdentityStore((state) => state.finishScanBulkDeepen)
  const importIdentity = useIdentityStore((state) => state.importIdentity)
  const applyDraft = useIdentityStore((state) => state.applyDraft)
  const recordAiGenerationUndo = useIdentityStore((state) => state.recordAiGenerationUndo)
  const acceptProposedVector = useIdentityStore((state) => state.acceptProposedVector)
  const rejectProposedVector = useIdentityStore((state) => state.rejectProposedVector)
  const editProposedVector = useIdentityStore((state) => state.editProposedVector)
  const selectedVector = useUiStore((state) => state.selectedVector)
  const comparisonVector = useUiStore((state) => state.comparisonVector)
  const setSelectedVector = useUiStore((state) => state.setSelectedVector)
  const setComparisonVector = useUiStore((state) => state.setComparisonVector)
  const setData = useResumeStore((state) => state.setData)
  const jdAnalyses = useJDAnalysisStore((state) => state.analyses)
  const upsertAnalysis = useJDAnalysisStore((state) => state.upsertAnalysis)

  const aiEndpoint = useMemo(() => sanitizeEndpointUrl(facetClientEnv.anthropicProxyUrl), [])

  const audienceReviewItems = useMemo(
    () =>
      jdAnalyses.flatMap((analysis) =>
        buildAudienceReviewSummary(analysis).insights.map((insight) => ({
          analysis,
          insight,
        })),
      ),
    [jdAnalyses],
  )

  const unclassifiedAudienceCount = useMemo(
    () =>
      jdAnalyses.reduce(
        (total, analysis) => total + buildUnclassifiedAudienceSummary(analysis).unclassifiedCount,
        0,
      ),
    [jdAnalyses],
  )

  const handleSetInsightAudiences = useCallback(
    (analysis: JDAnalysis, insight: AudienceReviewInsight, audiences: AudienceTag[]) => {
      const currentAnalysis =
        useJDAnalysisStore.getState().analyses.find((entry) => entry.id === analysis.id) ?? analysis
      const currentInsight = buildAudienceReviewSummary(currentAnalysis).insights.find(
        (entry) => entry.key === insight.key,
      )
      if (!currentInsight) {
        setPageNotice(null)
        setPageError('That JD insight is no longer available for review.')
        return
      }

      upsertAnalysis(
        setAudienceOverrideForInsightAudiences(currentAnalysis, currentInsight, audiences),
      )
      setPageError(null)
      setPageNotice(
        `Saved audiences for "${currentInsight.label}": ${audiences
          .map(formatAudienceLabel)
          .join(', ')}.`,
      )
    },
    [upsertAnalysis],
  )

  useEffect(
    () => () => {
      generateAbortRef.current?.abort()
      scanAbortRef.current?.abort()
      deepenAbortRef.current?.abort()
    },
    [],
  )

  useEffect(() => {
    if (pendingModelScrollTarget !== 'draft') {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      draftPanelRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
      setPendingModelScrollTarget(null)
    })

    return () => window.cancelAnimationFrame(frame)
  }, [pendingModelScrollTarget])

  const counts = useMemo(() => {
    const identity = draft?.identity ?? currentIdentity ?? null
    if (!identity) {
      return null
    }

    const bulletCount = identity.roles.reduce((total, role) => total + role.bullets.length, 0)
    return {
      roles: identity.roles.length,
      bullets: bulletCount,
      profiles: identity.profiles.length,
      projects: identity.projects.length,
      skillGroups: identity.skills.groups.length,
    }
  }, [currentIdentity, draft])

  const scanCompletion = useMemo(() => {
    if (!scanResult) {
      return null
    }
    return {
      extractedBullets: scanResult.counts.extractedBullets,
      decomposedBullets: scanResult.counts.deepenedBullets + scanResult.counts.editedBullets,
    }
  }, [scanResult])

  const bulkStatus = scanResult?.progress.bulk.status ?? null
  const resumeIntakeSources = useMemo(
    () =>
      intakeSources.filter(
        (source): source is Extract<IntakeSource, { kind: 'resume' }> => source.kind === 'resume',
      ),
    [intakeSources],
  )
  const supplementalContextSources = useMemo(
    () =>
      intakeSources.filter(
        (source): source is SupplementalContextSource =>
          source.kind === 'agent-dump' || source.kind === 'brag-doc',
      ),
    [intakeSources],
  )
  const hasSourceMaterial = useMemo(
    () => sourceMaterial.trim().length > 0 || Boolean(scanResult),
    [scanResult, sourceMaterial],
  )
  const showImportGuide = !currentIdentity || Boolean(draft) || hasSourceMaterial
  const ensureEndpoint = () => {
    if (!aiEndpoint) {
      throw new Error('Identity extraction is disabled. Configure VITE_ANTHROPIC_PROXY_URL.')
    }
  }

  const runGenerate = async (mode: 'fresh' | 'regenerate') => {
    const shouldUseScan = intakeMode === 'upload' && Boolean(scanResult)
    const effectiveSourceMaterial = shouldUseScan ? (scanResult?.rawText ?? '') : sourceMaterial
    let controller: AbortController | null = null

    if (!effectiveSourceMaterial.trim()) {
      setPageNotice(null)
      setPageError('Source material is required before generating a draft.')
      return
    }

    try {
      generateAbortRef.current?.abort()
      controller = new AbortController()
      generateAbortRef.current = controller
      ensureEndpoint()
      setPageError(null)
      setPageNotice(null)
      setIsGenerating(true)
      const synthesisSeed =
        shouldUseScan && resumeIntakeSources.length > 0
          ? intakeSynthesis(resumeIntakeSources)
          : null
      const nextDraft = await generateIdentityDraft({
        endpoint: aiEndpoint,
        sourceMaterial: effectiveSourceMaterial,
        correctionNotes,
        synthesisSeed,
        supplementalContextSources,
        existingDraft: mode === 'regenerate' ? (draft?.identity ?? currentIdentity) : null,
        signal: controller.signal,
      })
      if (controller.signal.aborted) {
        return
      }
      setDraft(nextDraft)
      setPageNotice(
        mode === 'regenerate'
          ? 'Regenerated the draft with the latest correction notes.'
          : 'Generated a new Professional Identity draft.',
      )
    } catch (error) {
      if (controller?.signal.aborted && error instanceof DOMException) {
        return
      }
      setPageNotice(null)
      setPageError(error instanceof Error ? error.message : 'Identity draft generation failed.')
    } finally {
      if (controller && generateAbortRef.current === controller && !controller.signal.aborted) {
        setIsGenerating(false)
      }
      if (controller && generateAbortRef.current === controller) {
        generateAbortRef.current = null
      }
    }
  }

  // Fresh upload-intake generation replaces the identity draft source with synthesized sources.
  const shouldConfirmIntakeReplacement = (mode: 'fresh' | 'regenerate') =>
    mode === 'fresh' &&
    intakeMode === 'upload' &&
    Boolean(scanResult) &&
    intakeSources.length > 0 &&
    hasPopulatedIdentity(currentIdentity)

  const requestGenerate = (mode: 'fresh' | 'regenerate') => {
    if (shouldConfirmIntakeReplacement(mode)) {
      replaceConfirmReturnFocusRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null
      setPendingReplaceGenerateMode(mode)
      return
    }

    void runGenerate(mode)
  }

  const closeReplaceGenerate = useCallback(() => {
    const returnFocusTarget = replaceConfirmReturnFocusRef.current
    replaceConfirmReturnFocusRef.current = null
    setPendingReplaceGenerateMode(null)

    window.requestAnimationFrame(() => {
      if (returnFocusTarget?.isConnected) {
        returnFocusTarget.focus()
      }
    })
  }, [])

  const cancelReplaceGenerate = useCallback(() => {
    closeReplaceGenerate()
  }, [closeReplaceGenerate])

  const confirmReplaceGenerate = () => {
    const mode = pendingReplaceGenerateMode
    if (!mode) {
      return
    }

    closeReplaceGenerate()
    void runGenerate(mode)
  }

  useFocusTrap(Boolean(pendingReplaceGenerateMode), replaceConfirmModalRef)

  useEffect(() => {
    if (!pendingReplaceGenerateMode) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        cancelReplaceGenerate()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [cancelReplaceGenerate, pendingReplaceGenerateMode])

  const recordFailedFile = (name: string, error: string) => {
    setFailedFiles((prev) => [...prev, { id: createId('intake-failed'), name, error }])
  }

  const handleScannedFile = async (file: File, options: { replace: boolean }) => {
    if (!/\.pdf$/i.test(file.name)) {
      if (options.replace) {
        setPageNotice(null)
        setPageError('Resume Scanner v1 only supports PDF uploads.')
      } else {
        recordFailedFile(file.name, 'Only PDF uploads are supported.')
      }
      return
    }

    let controller: AbortController | null = null
    try {
      if (options.replace) {
        deepenAbortRef.current?.abort()
        scanAbortRef.current?.abort()
      }
      controller = new AbortController()
      scanAbortRef.current = controller
      setIsScanning(true)
      if (options.replace) {
        setPageError(null)
        setPageNotice(null)
      }
      const result = await scanResumePdf(file, { signal: controller.signal })
      if (controller.signal.aborted) {
        return
      }

      if (options.replace) {
        setSourceMaterial(result.rawText)

        if (result.identity.roles.length === 0) {
          setScanResult(null)
          setIntakeMode('paste')
          setPageNotice(
            result.warnings.find((warning) => warning.code === 'role-parse-fallback')?.message ??
              'Resume text extraction succeeded, but structural role parsing failed. The raw text is now loaded into paste-text mode.',
          )
          return
        }

        setScanResult(result)
        setIntakeMode('upload')
        setPageNotice(`Scanned ${file.name} into a structured identity shell.`)
        return
      }

      // Append mode: each successful scan becomes a new IntakeSource. 0-role
      // scans are treated as a per-file failure and surfaced inline rather than
      // triggering the N=1 paste-mode fallback (which would clobber the batch).
      if (result.identity.roles.length === 0) {
        recordFailedFile(
          file.name,
          result.warnings.find((warning) => warning.code === 'role-parse-fallback')?.message ??
            'Structural role parsing failed for this PDF.',
        )
        return
      }

      appendIntakeSource({ kind: 'resume', id: createId('intake'), scan: result })
      setIntakeMode('upload')
    } catch (error) {
      if (controller?.signal.aborted && error instanceof DOMException) {
        return
      }
      const message = error instanceof Error ? error.message : 'Resume scan failed.'
      if (options.replace) {
        setPageNotice(null)
        setPageError(message)
      } else {
        recordFailedFile(file.name, message)
      }
    } finally {
      if (controller && scanAbortRef.current === controller && !controller.signal.aborted) {
        setIsScanning(false)
      }
      if (controller && scanAbortRef.current === controller) {
        scanAbortRef.current = null
      }
    }
  }

  const scanFileBatch = async (files: File[]) => {
    if (files.length === 0) return
    setIntakeMode('upload')

    const isRescan = rescanModeRef.current
    rescanModeRef.current = false
    const startingEmpty = useIdentityStore.getState().intakeSources.length === 0
    // Preserve N=1 single-file semantics: an explicit Rescan, or the very first
    // upload of a single file when no sources exist, replaces the primary slot
    // (matching the legacy pre-multi-source flow). Everything else appends.
    const replaceFirstFile = isRescan || (startingEmpty && files.length === 1)

    if (replaceFirstFile) {
      setPageError(null)
      setPageNotice(null)
    }

    for (let i = 0; i < files.length; i++) {
      const replace = replaceFirstFile && i === 0
      await handleScannedFile(files[i], { replace })
    }
  }

  const handleUploadChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    await scanFileBatch(files)
  }

  const handleRequestUpload = () => {
    setIntakeMode('upload')
    // Keep the chooser inside the original user gesture. The input is always
    // mounted, so deferring this click can cause browsers to reject it.
    uploadRef.current?.click()
  }

  const handleRescan = () => {
    rescanModeRef.current = true
    uploadRef.current?.click()
  }

  const handleRemoveIntakeSource = (id: string) => {
    removeIntakeSource(id)
  }

  const handleSetIntakeSourceLabel = (id: string, label: string) => {
    setIntakeSourceLabel(id, label)
  }

  const handleDismissFailedFile = (id: string) => {
    setFailedFiles((prev) => prev.filter((entry) => entry.id !== id))
  }

  const canAppendSupplementalContext = (nextText: string): boolean => {
    const existingLength = supplementalContextSources.reduce(
      (total, source) => total + source.text.trim().length,
      0,
    )
    if (existingLength + nextText.trim().length <= SUPPLEMENTAL_CONTEXT_TOTAL_MAX_CHARS) {
      return true
    }

    setPageNotice(null)
    setPageError('Supplemental context sources must be 200,000 characters or fewer in total.')
    return false
  }

  const handleAddAgentExport = (text: string): boolean => {
    const trimmed = text.trim()
    if (!trimmed) {
      setPageNotice(null)
      setPageError('Paste an AI conversation export before adding it as context.')
      return false
    }
    const lengthError = getSupplementalContextLengthError('agent-dump', trimmed)
    if (lengthError) {
      setPageNotice(null)
      setPageError(lengthError)
      return false
    }
    const tokenLimitError = getSupplementalContextTokenLimitError(trimmed, 'AI conversation export')
    if (tokenLimitError) {
      setPageNotice(null)
      setPageError(tokenLimitError)
      return false
    }
    if (!canAppendSupplementalContext(trimmed)) {
      return false
    }

    appendIntakeSource({
      kind: 'agent-dump',
      id: createId('intake'),
      userLabel: 'AI conversation export',
      agentName: 'AI conversation export',
      text: trimmed,
    })
    setPageError(null)
    setPageNotice('Added AI conversation export as supplemental extraction context.')
    return true
  }

  const handleAddBragDocText = (text: string): boolean => {
    const trimmed = text.trim()
    if (!trimmed) {
      setPageNotice(null)
      setPageError('Paste brag doc text before adding it as context.')
      return false
    }
    const lengthError = getSupplementalContextLengthError('brag-doc', trimmed)
    if (lengthError) {
      setPageNotice(null)
      setPageError(lengthError)
      return false
    }
    const tokenLimitError = getSupplementalContextTokenLimitError(trimmed, 'Brag doc text')
    if (tokenLimitError) {
      setPageNotice(null)
      setPageError(tokenLimitError)
      return false
    }
    if (!canAppendSupplementalContext(trimmed)) {
      return false
    }

    appendIntakeSource({
      kind: 'brag-doc',
      id: createId('intake'),
      userLabel: 'Brag doc',
      text: trimmed,
    })
    setPageError(null)
    setPageNotice('Added brag doc text as supplemental extraction context.')
    return true
  }

  const handleUploadBragDoc = async (file: File) => {
    try {
      if (!/\.(txt|md|markdown)$/i.test(file.name) && !file.type.startsWith('text/')) {
        throw new Error('Brag doc upload supports plain text or Markdown files.')
      }
      if (file.size > SUPPLEMENTAL_CONTEXT_MAX_BYTES) {
        throw new Error('Brag doc upload must be smaller than 2 MB.')
      }

      const text = (await file.text()).trim()
      if (!text) {
        throw new Error('Brag doc file is empty.')
      }
      const lengthError = getSupplementalContextLengthError('brag-doc', text)
      if (lengthError) {
        throw new Error(lengthError)
      }
      const tokenLimitError = getSupplementalContextTokenLimitError(text, file.name)
      if (tokenLimitError) {
        throw new Error(tokenLimitError)
      }
      if (!canAppendSupplementalContext(text)) {
        return
      }

      appendIntakeSource({
        kind: 'brag-doc',
        id: createId('intake'),
        userLabel: file.name,
        fileName: file.name,
        text,
      })
      setPageError(null)
      setPageNotice(`Added ${file.name} as supplemental extraction context.`)
    } catch (error) {
      setPageNotice(null)
      setPageError(error instanceof Error ? error.message : 'Unable to read brag doc file.')
    }
  }

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const files = Array.from(event.dataTransfer.files ?? [])
    await scanFileBatch(files)
  }

  const handleDeepenAll = async () => {
    const liveScan = getActiveResumeScan(useIdentityStore.getState())
    if (!liveScan) {
      return
    }
    const scanSessionId = liveScan.scannedAt
    const isSameScanSession = () =>
      getActiveResumeScan(useIdentityStore.getState())?.scannedAt === scanSessionId

    if (
      Object.values(liveScan.progress.bullets).some((progress) => progress.status === 'running')
    ) {
      setPageNotice(null)
      setPageError(
        'Wait for the current bullet deepening run to finish before starting Deepen all bullets.',
      )
      return
    }

    try {
      ensureEndpoint()
      setPageError(null)
      setPageNotice(null)
    } catch (error) {
      setPageNotice(null)
      setPageError(error instanceof Error ? error.message : 'Identity extraction is disabled.')
      return
    }

    startScanBulkDeepen()

    let completed = 0
    let failed = 0
    const pendingBullets = liveScan.identity.roles.flatMap((role) =>
      role.bullets
        .filter((bullet) => Boolean(bullet.source_text?.trim()))
        .map((bullet) => ({
          roleId: role.id,
          bulletId: bullet.id,
        })),
    )

    for (const target of pendingBullets) {
      if (!isSameScanSession()) {
        return
      }

      const currentScan = getActiveResumeScan(useIdentityStore.getState())
      if (!currentScan) {
        break
      }

      const progress = currentScan.progress.bullets[`${target.roleId}::${target.bulletId}`]
      if (
        hasAiDeepenExplanation(progress) ||
        progress?.status === 'edited' ||
        progress?.status === 'running'
      ) {
        continue
      }

      if (currentScan.progress.bulk.status === 'cancelling') {
        break
      }

      let controller: AbortController | null = null
      try {
        updateScanBulkProgress(`${target.roleId}::${target.bulletId}`)
        startScannedBulletDeepen(target.roleId, target.bulletId)
        controller = new AbortController()
        deepenAbortRef.current = controller
        const result = await deepenIdentityBullet({
          endpoint: aiEndpoint,
          identity:
            getActiveResumeScan(useIdentityStore.getState())?.identity ?? currentScan.identity,
          roleId: target.roleId,
          bulletId: target.bulletId,
          correctionNotes,
          signal: controller.signal,
        })
        if (controller.signal.aborted) {
          break
        }
        if (!isSameScanSession()) {
          return
        }

        completeScannedBulletDeepen(result)
        completed += 1
      } catch (error) {
        if (
          controller?.signal.aborted &&
          getActiveResumeScan(useIdentityStore.getState())?.progress.bulk.status === 'cancelling'
        ) {
          break
        }

        if (controller?.signal.aborted && error instanceof DOMException) {
          break
        }

        const message = error instanceof Error ? error.message : 'Bullet deepening failed.'
        if (!isSameScanSession()) {
          return
        }
        failScannedBulletDeepen(target.roleId, target.bulletId, message)
        failed += 1
      } finally {
        if (controller && deepenAbortRef.current === controller) {
          deepenAbortRef.current = null
        }
      }
    }

    if (!isSameScanSession()) {
      return
    }

    if (!getActiveResumeScan(useIdentityStore.getState())) {
      return
    }

    const finalStatus = getActiveResumeScan(useIdentityStore.getState())?.progress.bulk.status
    finishScanBulkDeepen()
    setPageNotice(
      finalStatus === 'cancelling'
        ? `Stopped bulk deepening after completing ${completed} bullet(s).`
        : failed > 0
          ? `Deepened ${completed} scanned bullet(s); ${failed} failed.`
          : `Deepened ${completed} scanned bullet(s).`,
    )
  }

  const handleCancelDeepenAll = () => {
    requestCancelScanBulkDeepen()
    deepenAbortRef.current?.abort()
  }

  const handleValidateDraft = () => {
    try {
      const parsedDraft = parseJsonWithRepair(draftDocument, 'Draft identity document')
      const parsed = parseIdentityExtractionResponse(
        JSON.stringify({
          summary: draft?.summary ?? 'Manual draft validation',
          follow_up_questions: draft?.followUpQuestions ?? [],
          identity: parsedDraft.data,
          bullets:
            draft?.bullets.map((bullet) => ({
              role_id: bullet.roleId,
              bullet_id: bullet.bulletId,
              rewrite: bullet.rewrite,
              tags: bullet.tags,
              assumptions: bullet.assumptions,
            })) ?? [],
        }),
      )
      setDraft(parsed)
      setPageError(null)
      setPageNotice(
        parsedDraft.repaired
          ? 'Validated the current draft JSON against the identity schema and repaired minor syntax issues.'
          : 'Validated the current draft JSON against the identity schema.',
      )
    } catch (error) {
      setPageNotice(null)
      setPageError(error instanceof Error ? error.message : 'Draft validation failed.')
    }
  }

  const handleApply = (mode: IdentityApplyMode) => {
    if (mode === 'replace' && currentIdentity) {
      const confirmed = window.confirm(
        'Replace the current identity model with the draft? This overwrites the existing model.',
      )
      if (!confirmed) {
        return
      }
    }

    try {
      const beforeIdentity = useIdentityStore.getState().currentIdentity
      const result = applyDraft(mode)
      if (beforeIdentity) {
        recordAiGenerationUndo('applied identity draft', beforeIdentity)
      }
      setPageError(null)
      setPageNotice(result.summary)
      void navigate({ to: '/identity' })
    } catch (error) {
      setPageNotice(null)
      setPageError(error instanceof Error ? error.message : 'Unable to apply the current draft.')
    }
  }

  const handleImportJson = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    try {
      const parsed = parseJsonWithRepair<unknown>(await file.text(), 'Imported identity JSON')
      const result = importIdentity(parsed.data, 'Imported identity model from JSON')
      setPageError(null)
      setPageNotice(
        parsed.repaired
          ? `${result.summary}. Repaired minor JSON syntax issues during import.`
          : result.summary,
      )
    } catch (error) {
      setPageNotice(null)
      setPageError(error instanceof Error ? error.message : 'Unable to import identity JSON.')
    } finally {
      event.target.value = ''
    }
  }

  const handleExportCurrent = () => {
    if (!currentIdentity) {
      setPageNotice(null)
      setPageError('Apply or import an identity model before exporting it.')
      return
    }

    downloadJson('identity.json', JSON.stringify(currentIdentity, null, 2))
    setPageError(null)
    setPageNotice('Exported the current identity model.')
  }

  const handleExportDraft = () => {
    if (!draftDocument.trim()) {
      setPageNotice(null)
      setPageError('Generate or import a draft before exporting it.')
      return
    }

    downloadJson('identity-draft.json', draftDocument)
    setPageError(null)
    setPageNotice('Exported the current draft document.')
  }

  const handleAcceptProposedVector = (id: string) => {
    const vector = draft?.proposedVectors?.find((entry) => entry.id === id)
    acceptProposedVector(id)
    setPageError(null)
    setPageNotice(
      vector ? `Accepted "${vector.title}" into search vectors.` : 'Accepted proposed vector.',
    )
  }

  const handleRejectProposedVector = (id: string) => {
    const vector = draft?.proposedVectors?.find((entry) => entry.id === id)
    rejectProposedVector(id)
    setPageError(null)
    setPageNotice(
      vector ? `Rejected proposed vector "${vector.title}".` : 'Rejected proposed vector.',
    )
  }

  const handleEditProposedVector: typeof editProposedVector = (id, patch) => {
    editProposedVector(id, patch)
    setPageError(null)
    setPageNotice('Updated proposed vector. Accept it when you are ready to keep it.')
  }

  const handlePushToBuild = () => {
    if (!currentIdentity) {
      setPageNotice(null)
      setPageError('Apply the draft to the identity model before pushing it into Build.')
      return
    }

    const confirmed = window.confirm(
      'Replace the Build workspace with data derived from this identity model? Existing overrides, presets, and bullet orders will be lost.',
    )
    if (!confirmed) {
      return
    }

    const adapted = professionalIdentityToResumeData(currentIdentity)
    setData(adapted.data)
    setSelectedVector(resolveSelectedVectorAfterReplaceImport(selectedVector, adapted.data.vectors))
    setComparisonVector(
      resolveComparisonVectorAfterReplaceImport(comparisonVector, adapted.data.vectors),
    )
    setPageError(null)
    setPageNotice(
      adapted.warnings.length > 0
        ? `Sent the current identity model to Build. ${adapted.warnings.join(' ')}`
        : 'Sent the current identity model to Build.',
    )
    void navigate({ to: '/build' })
  }

  const scrollToDraftSection = () => {
    setPendingModelScrollTarget('draft')
  }

  const primaryActionState = useMemo<{
    action: IdentityPrimaryAction
    label: string
    status: string
  }>(() => {
    if (isScanning) {
      return {
        action: 'upload',
        label: 'Scanning…',
        status: 'Scanning the uploaded resume to prepare source material.',
      }
    }

    if (isGenerating) {
      return {
        action: 'generate',
        label: 'Generating…',
        status: 'Generating a draft from your source material.',
      }
    }

    if (draft) {
      return {
        action: 'reviewDraft',
        label: 'Review Draft',
        status: 'A draft is ready to review and apply to the current identity model.',
      }
    }

    if (currentIdentity) {
      return {
        action: 'pushToBuild',
        label: 'Send to Build',
        status:
          'Current identity is applied. Continue editing on the Identity Map, or send it to Build.',
      }
    }

    if (hasSourceMaterial) {
      return {
        action: 'generate',
        label: 'Generate Draft',
        status: 'Source material is loaded. Generate a draft when you are ready.',
      }
    }

    return {
      action: 'upload',
      label: 'Upload Resume',
      status: 'Upload a resume or paste source material to start building the identity model.',
    }
  }, [
    currentIdentity,
    draft,
    hasSourceMaterial,
    isGenerating,
    isScanning,
  ])

  const {
    action: primaryAction,
    label: primaryActionLabel,
    status: headerStatus,
  } = primaryActionState
  const isPrimaryActionDisabled = isGenerating || isScanning
  // The primary workbench cards share parent-owned status copy so the shell can
  // recommend the next action consistently, while the inspection cards derive
  // their own local status from the content they summarize.
  const sourceIntakeStatus = useMemo(() => {
    if (isScanning) {
      return 'Scanning source material'
    }

    if (scanResult) {
      return `${scanResult.fileName} is ready for review`
    }

    if (sourceMaterial.trim().length > 0) {
      return intakeMode === 'paste'
        ? 'Pasted source text is ready to draft'
        : 'Source material is ready to draft'
    }

    return 'No source loaded yet'
  }, [intakeMode, isScanning, scanResult, sourceMaterial])
  const draftReviewStatus = useMemo(() => {
    if (isGenerating) {
      return 'Generating draft'
    }

    if (draft) {
      return 'Draft is ready for review and apply'
    }

    if (currentIdentity) {
      return 'Current identity is available for editing'
    }

    return 'No draft generated yet'
  }, [currentIdentity, draft, isGenerating])
  const handlePrimaryAction = () => {
    switch (primaryAction) {
      case 'generate':
        void requestGenerate('fresh')
        break
      case 'pushToBuild':
        handlePushToBuild()
        break
      case 'reviewDraft':
        scrollToDraftSection()
        break
      case 'upload':
        handleRequestUpload()
        break
      default:
        assertNever(primaryAction)
    }
  }

  return (
    <div className="identity-page">
      {pendingReplaceGenerateMode ? (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="identity-replace-confirm-title"
          aria-describedby="identity-replace-confirm-description identity-replace-confirm-cancel-note"
        >
          <div
            className="modal-card identity-confirm-card"
            ref={replaceConfirmModalRef}
            tabIndex={-1}
          >
            <header className="modal-header">
              <h2 id="identity-replace-confirm-title">Replace current identity?</h2>
            </header>
            <p id="identity-replace-confirm-description" className="identity-confirm-copy">
              Generating from these sources will replace your current identity. Continue?
            </p>
            <p id="identity-replace-confirm-cancel-note" className="identity-muted">
              Cancel returns to the intake bay without calling the AI generator or changing the
              current draft.
            </p>
            <footer className="identity-confirm-actions">
              <button
                ref={replaceConfirmCancelRef}
                className="identity-btn"
                type="button"
                onClick={cancelReplaceGenerate}
              >
                Cancel
              </button>
              <button
                className="identity-btn identity-btn-primary"
                type="button"
                onClick={confirmReplaceGenerate}
              >
                Continue
              </button>
            </footer>
          </div>
        </div>
      ) : null}
      <header className="identity-header">
        <div className="identity-header-main">
          <p className="identity-eyebrow">Identity Workspace</p>
          <h1>Identity Import</h1>
          <p className="identity-copy">
            Start here by turning your resume and source notes into a rich identity model. Facet
            uses that model as the source of truth for resumes, search, match analysis, and
            interview prep.
          </p>
          <p className="identity-header-status" aria-live="polite">
            {headerStatus}
          </p>
        </div>

        <div className="identity-header-controls">
          <div className="identity-header-actions identity-header-actions-shell">
            <button
              ref={primaryActionButtonRef}
              className="identity-btn identity-btn-primary"
              type="button"
              onClick={handlePrimaryAction}
              disabled={isPrimaryActionDisabled}
              aria-busy={isPrimaryActionDisabled}
            >
              {primaryActionLabel}
            </button>
            <div className="identity-header-secondary-actions">
              <button
                className="identity-btn"
                type="button"
                onClick={() => importRef.current?.click()}
              >
                <Upload size={16} />
                Import JSON
              </button>
              <button className="identity-btn" type="button" onClick={handleExportDraft}>
                <Download size={16} />
                Export Draft
              </button>
              <button className="identity-btn" type="button" onClick={handleExportCurrent}>
                <FileJson size={16} />
                Export Identity
              </button>
            </div>
          </div>
          <input
            ref={importRef}
            hidden
            type="file"
            accept="application/json,.json"
            onChange={handleImportJson}
          />
        </div>
      </header>

      {showImportGuide ? (
        <section
          className="identity-onboarding-guide"
          aria-labelledby="identity-import-guide-title"
        >
          <div className="identity-onboarding-guide-copy">
            <p className="identity-eyebrow">First pass</p>
            <h2 id="identity-import-guide-title">Turn source material into a draft.</h2>
            <p>
              Upload resumes and supporting notes, let Facet extract the useful structure, then
              generate a draft identity. After you apply it, the Identity Map becomes the place to
              deepen skills, edit evidence, and shape positioning.
            </p>
          </div>
          <ol className="identity-onboarding-steps">
            <li>
              <strong>Add source material</strong>
              <span>Start with a resume, then add notes or AI exports if they fill gaps.</span>
            </li>
            <li>
              <strong>Generate the draft</strong>
              <span>Use the extraction run to turn source material into a reviewable model.</span>
            </li>
            <li>
              <strong>Apply, then refine on the Map</strong>
              <span>Keep durable editing out of intake so the source model stays easy to inspect.</span>
            </li>
          </ol>
        </section>
      ) : null}

      <div
        className={`identity-alert${pageError ? '' : ' identity-message-empty'}`}
        role="alert"
        aria-live="assertive"
      >
        {pageError ?? ''}
      </div>
      <div
        className={`identity-notice${pageNotice ? '' : ' identity-message-empty'}`}
        role="status"
        aria-live="polite"
      >
        {pageNotice ?? ''}
      </div>
      {warnings.length > 0 ? (
        <div className="identity-warning" role="alert">
          <strong>Warnings:</strong> {warnings.join(' ')}
        </div>
      ) : null}
      <div className="identity-workspace-panel">
        <div className="identity-section-stack">
          <ProposedVectorsCard
            draft={draft}
            onAccept={handleAcceptProposedVector}
            onReject={handleRejectProposedVector}
            onEdit={handleEditProposedVector}
          />

          {audienceReviewItems.length > 0 ? (
            <section className="identity-card identity-audience-review">
              <div className="identity-card-header">
                <div>
                  <p className="identity-eyebrow">Audience Review</p>
                  <h2>Review JD insight audiences</h2>
                  <p className="identity-muted">
                    {unclassifiedAudienceCount}{' '}
                    {unclassifiedAudienceCount === 1 ? 'insight needs' : 'insights need'} an
                    audience. {audienceReviewItems.length}{' '}
                    {audienceReviewItems.length === 1 ? 'tagged insight is' : 'tagged insights are'} editable.
                  </p>
                </div>
              </div>

              <ul className="identity-audience-review-list">
                {audienceReviewItems.map(({ analysis, insight }) => {
                  const showInsightText = insight.text !== insightLabelDetail(insight.label)
                  const selectedAudiences =
                    insight.assertedAudiences && insight.assertedAudiences.length > 0
                      ? insight.assertedAudiences.filter((audience) =>
                          PRODUCTION_AUDIENCES.includes(audience),
                        )
                      : insight.effectiveAudiences.filter((audience) =>
                          PRODUCTION_AUDIENCES.includes(audience),
                        )
                  return (
                    <li className="identity-audience-review-item" key={insight.key}>
                      <div>
                        <p className="identity-audience-review-meta">{insight.analysisLabel}</p>
                        <h3>{insight.label}</h3>
                        {showInsightText ? <p>{insight.text}</p> : null}
                        <p className="identity-audience-review-tags">
                          Inferred: {insight.inferredAudiences.map(formatAudienceLabel).join(', ')}
                          {insight.assertedAudiences && insight.assertedAudiences.length > 0
                            ? ` | Asserted: ${insight.assertedAudiences.map(formatAudienceLabel).join(', ')}`
                            : ' | Asserted: None'}
                        </p>
                      </div>

                      <fieldset className="identity-audience-review-field">
                        <legend className="identity-label">Audience</legend>
                        {PRODUCTION_AUDIENCES.map((audience) => (
                          <label className="identity-audience-review-option" key={audience}>
                            <input
                              type="checkbox"
                              checked={selectedAudiences.includes(audience)}
                              disabled={
                                selectedAudiences.includes(audience) &&
                                selectedAudiences.length === 1
                              }
                              aria-label={`${formatAudienceLabel(audience)} audience for ${insight.label}`}
                              onChange={(event) => {
                                const nextAudiences = event.target.checked
                                  ? [...selectedAudiences, audience]
                                  : selectedAudiences.filter((tag) => tag !== audience)
                                if (nextAudiences.length > 0) {
                                  handleSetInsightAudiences(analysis, insight, nextAudiences)
                                }
                              }}
                            />
                            <span>{formatAudienceLabel(audience)}</span>
                          </label>
                        ))}
                      </fieldset>
                    </li>
                  )
                })}
              </ul>
            </section>
          ) : null}

          <div className="identity-grid identity-grid-workbench">
            <ExtractionAgentCard
              statusLabel={sourceIntakeStatus}
              intakeMode={intakeMode}
              sourceMaterial={sourceMaterial}
              correctionNotes={correctionNotes}
              currentIdentity={currentIdentity}
              draft={draft}
              scanResult={scanResult}
              intakeSources={intakeSources}
              failedFiles={failedFiles}
              scanCompletion={scanCompletion}
              bulkStatus={bulkStatus}
              isGenerating={isGenerating}
              isScanning={isScanning}
              uploadRef={uploadRef}
              onRequestUpload={handleRequestUpload}
              onSetIntakeMode={setIntakeMode}
              onSetSourceMaterial={setSourceMaterial}
              onSetCorrectionNotes={setCorrectionNotes}
              onGenerate={requestGenerate}
              onDeepenAll={handleDeepenAll}
              onCancelDeepenAll={handleCancelDeepenAll}
              onUploadChange={handleUploadChange}
              onDrop={handleDrop}
              onAddAgentExport={handleAddAgentExport}
              onAddBragDocText={handleAddBragDocText}
              onUploadBragDoc={handleUploadBragDoc}
              onRescan={handleRescan}
              onRemoveSource={handleRemoveIntakeSource}
              onSetSourceLabel={handleSetIntakeSourceLabel}
              onDismissFailedFile={handleDismissFailedFile}
              onClearScan={() => {
                deepenAbortRef.current?.abort()
                setScanResult(null)
                setFailedFiles([])
                setPageNotice('Cleared the scanned resume structure.')
              }}
            />

            <div ref={draftPanelRef}>
              <IdentityModelBuilderCard
                counts={counts}
                draftDocument={draftDocument}
                hasCurrentIdentity={Boolean(currentIdentity)}
                statusLabel={draftReviewStatus}
                draftResetKey={draft?.generatedAt ?? 'identity-model-builder'}
                onSetDraftDocument={setDraftDocument}
                onValidateDraft={handleValidateDraft}
                onApply={handleApply}
              />
            </div>
          </div>

          <section
            className="identity-inspection-region"
            aria-labelledby="identity-inspection-heading"
          >
            <div className="identity-inspection-header">
              <div>
                <h2 id="identity-inspection-heading">Inspection Panels</h2>
                <p>
                  Use these secondary surfaces when you want to audit generated bullets or track
                  recent builder changes without interrupting the main model flow.
                </p>
              </div>
            </div>

            <div className="identity-grid identity-inspection-grid">
              <BulletConfidenceCard draft={draft} />
              <DraftSummaryCard draft={draft} changelog={changelog} />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
