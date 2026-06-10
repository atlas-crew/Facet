import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  Clipboard,
  FileText,
  RefreshCcw,
  ScanSearch,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type RefObject,
} from 'react'
import type { ProfessionalIdentityV3 } from '../../identity/schema'
import { parseScanBulletKey } from '../../store/identityStore'
import {
  getSupplementalContextLengthError,
  getSupplementalContextSourceLabel,
  INTAKE_SOURCE_CAP,
} from '../../types/identity'
import type {
  IdentityIntakeMode,
  IdentityExtractionDraft,
  IntakeSource,
  ResumeScanResult,
  SupplementalContextSource,
} from '../../types/identity'
import { AiWorkingStatus } from '../../components/AiWorkingStatus'
import {
  SUPPLEMENTAL_CONTEXT_MAX_TOKENS,
  getSupplementalContextTokenLimitError,
  scanSupplementalContextSecurity,
} from '../../utils/supplementalContextSecurity'
import { ScanReviewPane } from './ScanReviewPane'
import { SOURCE_MATERIAL_SAMPLES } from './sampleSourceMaterial'

export const AI_CONVERSATION_EXPORT_PROMPT = `I'm moving to a new career tool and I'd like to export what you know about me.
Please produce a structured summary of everything you know about my professional
background, including:

1. Roles, companies, dates, and what I actually did (not just titles)
2. Technical skills and how deeply I use each one
3. Projects I've described to you and what was interesting about them
4. Career goals, preferences, or constraints I've mentioned
5. Interview prep we've done - questions practiced, stories refined
6. Cover letters or resume content we've worked on
7. Any career advice or strategy we discussed
8. My communication style or voice patterns you've noticed
9. Things I've said I'm NOT good at or don't want to do
10. Anything else that would help a new career tool understand me

Format this as a detailed narrative, not a resume. Include specifics, numbers,
and context - the kind of detail that would be lost in a resume format.`

interface FailedFileEntry {
  id: string
  name: string
  error: string
}

const BULK_BULLET_PREVIEW_LENGTH = 84
const BULK_BULLET_PREVIEW_ELLIPSIS = '...'

const getBulletPreview = (
  bullet: ProfessionalIdentityV3['roles'][number]['bullets'][number],
): string => {
  const preview =
    bullet.source_text?.trim() ||
    bullet.action.trim() ||
    bullet.problem.trim() ||
    bullet.outcome.trim()
  if (!preview) {
    return 'selected bullet'
  }
  return preview.length > BULK_BULLET_PREVIEW_LENGTH
    ? `${preview.slice(
        0,
        BULK_BULLET_PREVIEW_LENGTH - BULK_BULLET_PREVIEW_ELLIPSIS.length,
      )}${BULK_BULLET_PREVIEW_ELLIPSIS}`
    : preview
}

const resolveBulkBulletLabel = (
  scanResult: ResumeScanResult,
  currentBulletKey: string | null,
): string | null => {
  if (!currentBulletKey) {
    return null
  }
  const parsedKey = parseScanBulletKey(currentBulletKey)
  if (!parsedKey) {
    return null
  }
  const { roleId, bulletId } = parsedKey
  const role = scanResult.identity.roles.find((entry) => entry.id === roleId)
  const bullet = role?.bullets.find((entry) => entry.id === bulletId)
  if (!role || !bullet) {
    return null
  }
  const roleLabel = [role.title, role.company].filter(Boolean).join(' at ')
  return `${roleLabel || 'Role'}: ${getBulletPreview(bullet)}`
}

interface ExtractionAgentCardProps {
  statusLabel?: string
  intakeMode: IdentityIntakeMode
  sourceMaterial: string
  correctionNotes: string
  currentIdentity: ProfessionalIdentityV3 | null
  draft: IdentityExtractionDraft | null
  scanResult: ResumeScanResult | null
  intakeSources: IntakeSource[]
  failedFiles: FailedFileEntry[]
  scanCompletion: {
    extractedBullets: number
    decomposedBullets: number
  } | null
  bulkStatus: ResumeScanResult['progress']['bulk']['status'] | null
  isGenerating: boolean
  isScanning: boolean
  uploadRef: RefObject<HTMLInputElement | null>
  onRequestUpload: () => void
  onSetIntakeMode: (mode: IdentityIntakeMode) => void
  onSetSourceMaterial: (value: string) => void
  onSetCorrectionNotes: (value: string) => void
  onGenerate: (mode: 'fresh' | 'regenerate') => void
  onDeepenAll: () => Promise<void>
  onCancelDeepenAll: () => void
  onUploadChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void>
  onDrop: (event: DragEvent<HTMLDivElement>) => Promise<void>
  onAddAgentExport: (text: string) => boolean
  onAddBragDocText: (text: string) => boolean
  onUploadBragDoc: (file: File) => Promise<void>
  onRescan: () => void
  onRemoveSource: (id: string) => void
  onSetSourceLabel: (id: string, label: string) => void
  onDismissFailedFile: (id: string) => void
  onClearScan: () => void
}

export function ExtractionAgentCard({
  statusLabel,
  intakeMode,
  sourceMaterial,
  correctionNotes,
  currentIdentity,
  draft,
  scanResult,
  intakeSources,
  failedFiles,
  scanCompletion,
  bulkStatus,
  isGenerating,
  isScanning,
  uploadRef,
  onRequestUpload,
  onSetIntakeMode,
  onSetSourceMaterial,
  onSetCorrectionNotes,
  onGenerate,
  onDeepenAll,
  onCancelDeepenAll,
  onUploadChange,
  onDrop,
  onAddAgentExport,
  onAddBragDocText,
  onUploadBragDoc,
  onRescan,
  onRemoveSource,
  onSetSourceLabel,
  onDismissFailedFile,
  onClearScan,
}: ExtractionAgentCardProps) {
  const bragDocUploadRef = useRef<HTMLInputElement>(null)
  const copyResetTimeoutRef = useRef<number | null>(null)
  const optionalContextId = useId()
  const optionalContextHeadingId = `${optionalContextId}-heading`
  const optionalContextToggleId = `${optionalContextId}-toggle`
  const optionalContextTitleId = `${optionalContextId}-title`
  const optionalContextCountId = `${optionalContextId}-count`
  const optionalContextDescriptionId = `${optionalContextId}-description`
  const optionalContextBodyId = `${optionalContextId}-body`
  const [agentExportText, setAgentExportText] = useState('')
  const [agentExportReviewed, setAgentExportReviewed] = useState(false)
  const [bragDocText, setBragDocText] = useState('')
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle')
  const [agentExportInputError, setAgentExportInputError] = useState<string | null>(null)
  const [bragDocInputError, setBragDocInputError] = useState<string | null>(null)
  const [isOptionalContextOpen, setIsOptionalContextOpen] = useState(false)
  const hasRunningBullet = scanResult
    ? Object.values(scanResult.progress.bullets).some((progress) => progress.status === 'running')
    : false
  const bulkProgress =
    scanResult && (bulkStatus === 'running' || bulkStatus === 'cancelling')
      ? scanResult.progress.bulk
      : null
  const bulkProgressTotal = bulkProgress?.total ?? 0
  const bulkProgressCompleted = Math.min(bulkProgress?.completed ?? 0, bulkProgressTotal)
  const bulkProgressFailed = Math.min(bulkProgress?.failed ?? 0, bulkProgressTotal)
  const bulkProgressProcessed = Math.min(
    bulkProgressTotal,
    bulkProgressCompleted + bulkProgressFailed,
  )
  const bulkProgressRemaining = Math.max(0, bulkProgressTotal - bulkProgressProcessed)
  const bulkProgressValueText =
    bulkProgressTotal > 0
      ? `${bulkProgressProcessed} of ${bulkProgressTotal} bullets processed`
      : 'Preparing bullet progress'
  const currentBulkBulletLabel =
    scanResult && bulkProgress
      ? resolveBulkBulletLabel(scanResult, bulkProgress.currentBulletKey)
      : null
  const resumeSources = intakeSources.filter((source) => source.kind === 'resume')
  const contextSources = intakeSources.filter(
    (source): source is SupplementalContextSource =>
      source.kind === 'agent-dump' || source.kind === 'brag-doc',
  )
  const contributingSourceCount = Math.min(resumeSources.length, INTAKE_SOURCE_CAP)
  const generateButtonLabel =
    intakeMode === 'upload' && contributingSourceCount > 0
      ? `Synthesize identity from ${contributingSourceCount} source${
          contributingSourceCount === 1 ? '' : 's'
        }`
      : 'Generate Draft'
  const agentExportSecurityScan = useMemo(
    () => scanSupplementalContextSecurity(agentExportText),
    [agentExportText],
  )
  const agentExportTokenLimitError = agentExportText.trim()
    ? getSupplementalContextTokenLimitError(agentExportText, 'AI conversation export')
    : null

  useEffect(
    () => () => {
      if (copyResetTimeoutRef.current !== null) {
        window.clearTimeout(copyResetTimeoutRef.current)
      }
    },
    [],
  )

  const copyExportPrompt = async () => {
    if (copyResetTimeoutRef.current !== null) {
      window.clearTimeout(copyResetTimeoutRef.current)
      copyResetTimeoutRef.current = null
    }
    setCopyStatus('idle')
    try {
      await navigator.clipboard.writeText(AI_CONVERSATION_EXPORT_PROMPT)
      setCopyStatus('copied')
      copyResetTimeoutRef.current = window.setTimeout(() => {
        setCopyStatus('idle')
        copyResetTimeoutRef.current = null
      }, 2000)
    } catch {
      setCopyStatus('error')
      copyResetTimeoutRef.current = window.setTimeout(() => {
        setCopyStatus('idle')
        copyResetTimeoutRef.current = null
      }, 4000)
    }
  }
  const addAgentExport = () => {
    if (!agentExportReviewed) {
      setAgentExportInputError('Review and confirm the AI export preview before adding it.')
      return
    }
    if (agentExportTokenLimitError) {
      setAgentExportInputError(agentExportTokenLimitError)
      return
    }
    if (onAddAgentExport(agentExportText)) {
      setAgentExportText('')
      setAgentExportReviewed(false)
      setAgentExportInputError(null)
    }
  }
  const addBragDocText = () => {
    if (onAddBragDocText(bragDocText)) {
      setBragDocText('')
      setBragDocInputError(null)
    }
  }
  const updateAgentExportText = (value: string) => {
    const lengthError = getSupplementalContextLengthError('agent-dump', value)
    if (lengthError) {
      setAgentExportInputError(lengthError)
      return
    }
    setAgentExportReviewed(false)
    setAgentExportInputError(null)
    setAgentExportText(value)
  }
  const updateBragDocText = (value: string) => {
    const lengthError = getSupplementalContextLengthError('brag-doc', value)
    if (lengthError) {
      setBragDocInputError(lengthError)
      return
    }
    setBragDocInputError(null)
    setBragDocText(value)
  }
  const handleBragDocUploadChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) {
      return
    }
    await onUploadBragDoc(file)
  }

  return (
    <section className="identity-card identity-extraction-card">
      <div className="identity-card-header">
        <div>
          <h2>Intake Sources</h2>
          <p>
            Bring in recent source variants first, then fall back to pasted source text when the
            scan needs clarification.
          </p>
          {statusLabel ? <span className="identity-section-status">{statusLabel}</span> : null}
        </div>
        <div className="identity-card-actions">
          <button
            className={`identity-btn ${intakeMode === 'upload' ? 'identity-btn-primary' : ''}`}
            type="button"
            onClick={onRequestUpload}
          >
            <ScanSearch size={16} />
            Upload Resume
          </button>
          <button
            className={`identity-btn ${intakeMode === 'paste' ? 'identity-btn-primary' : ''}`}
            type="button"
            onClick={() => onSetIntakeMode('paste')}
          >
            <Upload size={16} />
            Paste Source Text
          </button>
          <button
            className="identity-btn identity-btn-primary"
            type="button"
            onClick={() => void onGenerate('fresh')}
            disabled={isGenerating || isScanning}
            aria-busy={isGenerating || isScanning}
          >
            <Sparkles size={16} />
            {isGenerating ? 'Synthesizing…' : generateButtonLabel}
          </button>
          <button
            className="identity-btn"
            type="button"
            onClick={() => void onGenerate('regenerate')}
            disabled={isGenerating || isScanning || (!draft && !currentIdentity)}
          >
            <RefreshCcw size={16} />
            Regenerate
          </button>
        </div>
      </div>

      <input
        ref={uploadRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => void onUploadChange(event)}
      />
      <input
        ref={bragDocUploadRef}
        type="file"
        accept="text/plain,text/markdown,.txt,.md"
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => void handleBragDocUploadChange(event)}
      />

      <AiWorkingStatus
        active={isGenerating}
        label="Generating identity draft"
        caption="AI is extracting roles, bullets, skills, projects, and follow-up questions from the source material."
        expectedDurationMs={90000}
      />

      {intakeMode === 'upload' ? (
        <>
          <div
            className="identity-upload-zone"
            role="button"
            tabIndex={0}
            onClick={onRequestUpload}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onRequestUpload()
              }
            }}
            onDragEnter={(event) => event.preventDefault()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => void onDrop(event)}
          >
            <Upload size={22} aria-hidden="true" />
            <strong>
              {isScanning ? 'Scanning PDF…' : 'Drag intake source PDFs here or click to browse'}
            </strong>
          </div>
          <p className="identity-muted">
            Use 3-10 text-based, single-column PDFs from the last 2 years when you have them. More
            variants give Facet denser canonical bullet fields, which improves JD-tailored
            regeneration later. OCR and image-only sources are out of scope for this pass.
          </p>
          <div
            className="identity-context-panel"
            role="group"
            aria-labelledby={optionalContextHeadingId}
          >
            <h3 id={optionalContextHeadingId} className="identity-context-heading">
              <button
                id={optionalContextToggleId}
                className="identity-context-toggle"
                type="button"
                aria-expanded={isOptionalContextOpen}
                aria-controls={optionalContextBodyId}
                aria-labelledby={`${optionalContextTitleId} ${optionalContextCountId}`}
                aria-describedby={optionalContextDescriptionId}
                onClick={() => setIsOptionalContextOpen((current) => !current)}
              >
                {isOptionalContextOpen ? (
                  <ChevronDown size={16} aria-hidden="true" />
                ) : (
                  <ChevronRight size={16} aria-hidden="true" />
                )}
                <span className="identity-context-toggle-copy">
                  <strong id={optionalContextTitleId}>Optional Context Sources</strong>
                  <span id={optionalContextDescriptionId}>
                    AI exports and brag docs can add goals, voice, constraints, wins, and details
                    that resumes compress.
                  </span>
                </span>
                <span id={optionalContextCountId} className="identity-source-card-badge">
                  {contextSources.length} added
                </span>
              </button>
            </h3>

            <div
              id={optionalContextBodyId}
              className="identity-context-body"
              role="region"
              aria-labelledby={optionalContextToggleId}
              hidden={!isOptionalContextOpen}
            >
              {isOptionalContextOpen ? (
                <>
                  <div className="identity-context-grid">
                    <div className="identity-context-card">
                      <div className="identity-source-card-row">
                        <Clipboard size={16} aria-hidden="true" />
                        <strong>AI conversation export</strong>
                        <button
                          className="identity-btn"
                          type="button"
                          onClick={() => void copyExportPrompt()}
                        >
                          {copyStatus === 'copied' ? <Check size={16} /> : <Clipboard size={16} />}
                          {copyStatus === 'copied' ? 'Copied' : 'Copy Prompt'}
                        </button>
                        <span className="sr-only" aria-live="polite">
                          {copyStatus === 'copied' ? 'AI export prompt copied to clipboard.' : ''}
                        </span>
                      </div>
                      <p className="identity-muted">
                        Carries goals, voice, prep history, strategy, constraints, and the context
                        that never survives a resume.
                      </p>
                      {copyStatus === 'error' ? (
                        <p className="identity-source-card-error-message" role="alert">
                          Clipboard access is unavailable. Select and copy the prompt text manually.
                        </p>
                      ) : null}
                      {agentExportInputError ? (
                        <p className="identity-source-card-error-message" role="alert">
                          {agentExportInputError}
                        </p>
                      ) : null}
                      <textarea
                        className="identity-textarea identity-context-prompt"
                        readOnly
                        value={AI_CONVERSATION_EXPORT_PROMPT}
                        aria-label="AI conversation export prompt"
                      />
                      <label className="identity-field">
                        <span className="identity-label">Pasted AI export narrative</span>
                        <textarea
                          className="identity-textarea"
                          value={agentExportText}
                          onChange={(event) => updateAgentExportText(event.target.value)}
                          placeholder="Paste the narrative export here after the AI assistant generates it."
                        />
                      </label>
                      {agentExportText.trim() ? (
                        <div
                          className="identity-context-preview"
                          role="group"
                          aria-label="AI export preview"
                        >
                          <div className="identity-source-card-stats">
                            <span>{agentExportSecurityScan.wordCount.toLocaleString()} words</span>
                            <span>
                              {agentExportSecurityScan.estimatedTokens.toLocaleString()} estimated
                              tokens
                            </span>
                            <span>
                              Limit {SUPPLEMENTAL_CONTEXT_MAX_TOKENS.toLocaleString()} tokens
                            </span>
                          </div>
                          {agentExportSecurityScan.detectedSections.length > 0 ? (
                            <div className="identity-context-preview-row">
                              {agentExportSecurityScan.detectedSections.map((section) => (
                                <span key={section} className="identity-source-card-badge">
                                  {section}
                                </span>
                              ))}
                            </div>
                          ) : null}
                          {agentExportSecurityScan.flaggedContent.length > 0 ? (
                            <div className="identity-context-flags" role="alert">
                              {agentExportSecurityScan.flaggedContent.map((flag, index) => (
                                <div key={`${flag.label}:${flag.snippet}:${index}`}>
                                  <strong>{flag.label}</strong>
                                  <span>{flag.snippet}</span>
                                </div>
                              ))}
                            </div>
                          ) : null}
                          {agentExportTokenLimitError ? (
                            <p className="identity-source-card-error-message" role="alert">
                              {agentExportTokenLimitError}
                            </p>
                          ) : null}
                          <label className="identity-checkbox-row">
                            <input
                              type="checkbox"
                              checked={agentExportReviewed}
                              onChange={(event) => setAgentExportReviewed(event.target.checked)}
                            />
                            <span>I reviewed this AI export preview.</span>
                          </label>
                        </div>
                      ) : null}
                      <div className="identity-card-actions">
                        <button
                          className="identity-btn"
                          type="button"
                          onClick={addAgentExport}
                          disabled={
                            agentExportText.trim().length === 0 ||
                            !agentExportReviewed ||
                            Boolean(agentExportTokenLimitError)
                          }
                        >
                          <Sparkles size={16} />
                          Add AI Context
                        </button>
                      </div>
                    </div>

                    <div className="identity-context-card">
                      <div className="identity-source-card-row">
                        <FileText size={16} aria-hidden="true" />
                        <strong>Brag doc</strong>
                        <button
                          className="identity-btn"
                          type="button"
                          onClick={() => bragDocUploadRef.current?.click()}
                        >
                          <Upload size={16} />
                          Upload Text
                        </button>
                      </div>
                      <p className="identity-muted">
                        Adds wins, scope, metrics, feedback, and project details that can become
                        PAIO bullet evidence.
                      </p>
                      {bragDocInputError ? (
                        <p className="identity-source-card-error-message" role="alert">
                          {bragDocInputError}
                        </p>
                      ) : null}
                      <label className="identity-field">
                        <span className="identity-label">Pasted brag doc text</span>
                        <textarea
                          className="identity-textarea"
                          value={bragDocText}
                          onChange={(event) => updateBragDocText(event.target.value)}
                          placeholder="Paste accomplishments, weekly wins, promotion packets, or project notes."
                        />
                      </label>
                      <div className="identity-card-actions">
                        <button
                          className="identity-btn"
                          type="button"
                          onClick={addBragDocText}
                          disabled={bragDocText.trim().length === 0}
                        >
                          <FileText size={16} />
                          Add Brag Doc
                        </button>
                      </div>
                    </div>
                  </div>

                  {contextSources.length > 0 ? (
                    <ul className="identity-source-list" aria-label="Supplemental context sources">
                      {contextSources.map((source) => (
                        <li key={source.id} className="identity-source-card">
                          <div className="identity-source-card-row">
                            {source.kind === 'agent-dump' ? (
                              <Clipboard size={14} aria-hidden="true" />
                            ) : (
                              <FileText size={14} aria-hidden="true" />
                            )}
                            <strong>{getSupplementalContextSourceLabel(source)}</strong>
                            <span className="identity-muted">
                              {source.text.trim().length} chars
                            </span>
                            <button
                              className="identity-btn identity-btn-icon"
                              type="button"
                              onClick={() => onRemoveSource(source.id)}
                              aria-label={`Remove ${getSupplementalContextSourceLabel(source)}`}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
          {resumeSources.length > 0 || failedFiles.length > 0 ? (
            <>
              {resumeSources.length > INTAKE_SOURCE_CAP ? (
                <p className="identity-source-cap-warning" role="alert">
                  Facet will synthesize from the first {INTAKE_SOURCE_CAP} sources only. Remove{' '}
                  {resumeSources.length - INTAKE_SOURCE_CAP} extra source
                  {resumeSources.length - INTAKE_SOURCE_CAP === 1 ? '' : 's'} before generating if
                  you want every file included.
                </p>
              ) : null}
              <ul className="identity-source-list" aria-label="Intake sources">
                {resumeSources.map((source, index) => {
                  const isActive = index === 0
                  const isOverCap = index >= INTAKE_SOURCE_CAP
                  const cardClassName = [
                    'identity-source-card',
                    isActive ? 'identity-source-card-active' : '',
                    isOverCap ? 'identity-source-card-overcap' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')
                  return (
                    <li key={source.id} className={cardClassName}>
                      <div className="identity-source-card-row">
                        <strong>{source.scan.fileName}</strong>
                        <span className="identity-muted">{source.scan.pageCount} page(s)</span>
                        {isActive ? (
                          <span className="identity-source-card-badge">Primary</span>
                        ) : null}
                        {isOverCap ? (
                          <span className="identity-source-card-badge identity-source-card-badge-warn">
                            Over cap
                          </span>
                        ) : null}
                        <button
                          className="identity-btn identity-btn-icon"
                          type="button"
                          onClick={() => onRemoveSource(source.id)}
                          aria-label={`Remove ${source.scan.fileName}`}
                        >
                          <X size={14} />
                        </button>
                      </div>
                      <div className="identity-source-card-stats">
                        <span>Roles {source.scan.counts.roles}</span>
                        <span>Bullets {source.scan.counts.bullets}</span>
                        <span>Skill groups {source.scan.counts.skillGroups}</span>
                        <span>Projects {source.scan.counts.projects}</span>
                      </div>
                      <label className="identity-source-card-label">
                        <span className="identity-label">Positioning hint</span>
                        <input
                          className="identity-input"
                          type="text"
                          value={source.userLabel ?? ''}
                          onChange={(event) => onSetSourceLabel(source.id, event.target.value)}
                          placeholder="optional positioning hint, e.g. platform, security, engineering manager"
                        />
                      </label>
                    </li>
                  )
                })}
                {failedFiles.map((entry) => (
                  <li
                    key={entry.id}
                    className="identity-source-card identity-source-card-error"
                    role="alert"
                  >
                    <div className="identity-source-card-row">
                      <AlertCircle size={14} aria-hidden="true" />
                      <strong>{entry.name}</strong>
                      <button
                        className="identity-btn identity-btn-icon"
                        type="button"
                        onClick={() => onDismissFailedFile(entry.id)}
                        aria-label={`Dismiss ${entry.name}`}
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <p className="identity-source-card-error-message">{entry.error}</p>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {scanResult ? (
            <>
              <div className="identity-stack">
                <h3>Extraction Review</h3>
                <p className="identity-muted">
                  Inspect the scanned structure, deepen every bullet, and correct anything before
                  applying the draft.
                </p>
              </div>
              <div className="identity-scan-status">
                <div className="identity-deepen-callout">
                  <div>
                    <p className="identity-deepen-callout-title">Recommended next step</p>
                    <p>
                      Run <strong>Deepen all bullets</strong> before generating the draft. It turns
                      terse resume bullets into richer raw material so Facet can later cut them down
                      to the best version for each role.
                    </p>
                  </div>
                </div>
                <div className="identity-scan-status-row">
                  <strong>{scanResult.fileName}</strong>
                  <span>{scanResult.pageCount} page(s)</span>
                </div>
                <div className="identity-stats identity-stats-compact">
                  <div
                    className="identity-stat"
                    role="group"
                    aria-label={'Roles: ' + scanResult.counts.roles}
                  >
                    <span className="identity-stat-label">Roles</span>
                    <strong>{scanResult.counts.roles}</strong>
                  </div>
                  <div
                    className="identity-stat"
                    role="group"
                    aria-label={'Bullets: ' + scanResult.counts.bullets}
                  >
                    <span className="identity-stat-label">Bullets</span>
                    <strong>{scanResult.counts.bullets}</strong>
                  </div>
                  <div
                    className="identity-stat"
                    role="group"
                    aria-label={'Skill groups: ' + scanResult.counts.skillGroups}
                  >
                    <span className="identity-stat-label">Skill Groups</span>
                    <strong>{scanResult.counts.skillGroups}</strong>
                  </div>
                  <div
                    className="identity-stat"
                    role="group"
                    aria-label={'Projects: ' + scanResult.counts.projects}
                  >
                    <span className="identity-stat-label">Projects</span>
                    <strong>{scanResult.counts.projects}</strong>
                  </div>
                  <div
                    className="identity-stat"
                    role="group"
                    aria-label={'Education: ' + scanResult.counts.education}
                  >
                    <span className="identity-stat-label">Education</span>
                    <strong>{scanResult.counts.education}</strong>
                  </div>
                  <div
                    className="identity-stat"
                    role="group"
                    aria-label={
                      'Decomposed bullets: ' +
                      (scanCompletion?.decomposedBullets ?? 0) +
                      ' of ' +
                      (scanCompletion?.extractedBullets ?? scanResult.counts.extractedBullets)
                    }
                  >
                    <span className="identity-stat-label">Deepened</span>
                    <strong>
                      {scanCompletion?.decomposedBullets ?? 0}/
                      {scanCompletion?.extractedBullets ?? scanResult.counts.extractedBullets}
                    </strong>
                  </div>
                  <div
                    className="identity-stat"
                    role="group"
                    aria-label={'Edited bullets: ' + scanResult.counts.editedBullets}
                  >
                    <span className="identity-stat-label">Edited</span>
                    <strong>{scanResult.counts.editedBullets}</strong>
                  </div>
                  <div
                    className="identity-stat"
                    role="group"
                    aria-label={'Failed bullets: ' + scanResult.counts.failedBullets}
                  >
                    <span className="identity-stat-label">Failed</span>
                    <strong>{scanResult.counts.failedBullets}</strong>
                  </div>
                </div>
                <div className="identity-card-actions">
                  <button
                    className="identity-btn identity-btn-primary"
                    type="button"
                    onClick={() => void onDeepenAll()}
                    disabled={
                      hasRunningBullet ||
                      bulkStatus === 'running' ||
                      bulkStatus === 'cancelling' ||
                      scanResult.counts.extractedBullets === 0
                    }
                    aria-busy={bulkStatus === 'running' || bulkStatus === 'cancelling'}
                  >
                    <Sparkles size={16} />
                    {bulkStatus === 'running' || bulkStatus === 'cancelling'
                      ? 'Deepening…'
                      : 'Deepen all bullets'}
                  </button>
                  <button
                    className="identity-btn"
                    type="button"
                    onClick={onCancelDeepenAll}
                    disabled={bulkStatus !== 'running' && bulkStatus !== 'cancelling'}
                  >
                    <X size={16} />
                    {bulkStatus === 'cancelling' ? 'Cancelling…' : 'Cancel'}
                  </button>
                  {intakeSources.length <= 1 ? (
                    <button className="identity-btn" type="button" onClick={onRescan}>
                      <RefreshCcw size={16} />
                      Rescan PDF
                    </button>
                  ) : null}
                  <button className="identity-btn" type="button" onClick={onClearScan}>
                    <X size={16} />
                    Clear Scan
                  </button>
                </div>
                {bulkProgress ? (
                  <section className="identity-bulk-progress" aria-label="Bulk bullet status">
                    <p className="sr-only" aria-live="polite" aria-atomic="true">
                      {bulkStatus === 'cancelling'
                        ? 'Cancelling bulk deepening.'
                        : 'Deepening scanned bullets.'}{' '}
                      {currentBulkBulletLabel
                        ? `Current: ${currentBulkBulletLabel}.`
                        : 'Preparing next bullet.'}{' '}
                      {bulkProgressValueText}. Completed {bulkProgressCompleted}. Failed{' '}
                      {bulkProgressFailed}. Remaining {bulkProgressRemaining}.
                    </p>
                    <div className="identity-bulk-progress-header" aria-hidden="true">
                      <div>
                        <strong>
                          {bulkStatus === 'cancelling'
                            ? 'Cancelling bulk deepening'
                            : 'Deepening scanned bullets'}
                        </strong>
                        <span>
                          {currentBulkBulletLabel
                            ? `Current: ${currentBulkBulletLabel}`
                            : 'Preparing next bullet...'}
                        </span>
                      </div>
                      <span className="identity-bulk-progress-count">
                        {bulkProgressProcessed}/{bulkProgressTotal}
                      </span>
                    </div>
                    <div
                      className="identity-bulk-progress-bar"
                      role="progressbar"
                      aria-label="Deepen all bullets progress"
                      aria-valuemin={0}
                      aria-valuemax={bulkProgressTotal > 0 ? bulkProgressTotal : undefined}
                      aria-valuenow={bulkProgressTotal > 0 ? bulkProgressProcessed : undefined}
                      aria-valuetext={bulkProgressValueText}
                    >
                      <span
                        style={{
                          width:
                            bulkProgressTotal > 0
                              ? `${Math.round((bulkProgressProcessed / bulkProgressTotal) * 100)}%`
                              : '0%',
                        }}
                      />
                    </div>
                    <dl className="identity-bulk-progress-stats">
                      <div>
                        <dt>Completed</dt>
                        <dd>{bulkProgressCompleted}</dd>
                      </div>
                      <div>
                        <dt>Failed</dt>
                        <dd>{bulkProgressFailed}</dd>
                      </div>
                      <div>
                        <dt>Remaining</dt>
                        <dd>{bulkProgressRemaining}</dd>
                      </div>
                    </dl>
                  </section>
                ) : null}
              </div>

              <ScanReviewPane scanResult={scanResult} bulkStatus={bulkStatus ?? 'idle'} />
            </>
          ) : (
            <div className="identity-empty">
              <h3>No intake sources yet</h3>
              <p>
                Upload a recent single-column PDF to build a partial identity shell without a
                network call. A few source variants help Facet preserve stronger bullet evidence for
                later job-specific regeneration.
              </p>
            </div>
          )}
        </>
      ) : (
        <>
          {import.meta.env.DEV ? (
            <label className="identity-field">
              <span className="identity-label">Load dev sample</span>
              <select
                className="identity-input"
                defaultValue=""
                onChange={(event) => {
                  const sample = SOURCE_MATERIAL_SAMPLES.find(
                    (entry) => entry.id === event.target.value,
                  )
                  if (sample) {
                    onSetSourceMaterial(sample.text)
                  }
                  event.target.value = ''
                }}
              >
                <option value="" disabled>
                  Pick a sample input…
                </option>
                {SOURCE_MATERIAL_SAMPLES.map((sample) => (
                  <option key={sample.id} value={sample.id} title={sample.description}>
                    {sample.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="identity-field">
            <span className="identity-label">Source Material</span>
            <textarea
              className="identity-textarea identity-textarea-lg"
              value={sourceMaterial}
              onChange={(event) => onSetSourceMaterial(event.target.value)}
              placeholder="Paste resume bullets, LinkedIn text, portfolio notes, or a rough narrative here."
            />
          </label>
        </>
      )}

      <label className="identity-field">
        <span className="identity-label">Correction Notes</span>
        <textarea
          className="identity-textarea"
          value={correctionNotes}
          onChange={(event) => onSetCorrectionNotes(event.target.value)}
          placeholder="Use this after the first draft to mark what is wrong, missing, or overstated."
        />
      </label>
    </section>
  )
}
