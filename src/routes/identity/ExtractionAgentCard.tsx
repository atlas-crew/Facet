import { AlertCircle, RefreshCcw, ScanSearch, Sparkles, Upload, X } from 'lucide-react'
import type { ChangeEvent, DragEvent, RefObject } from 'react'
import type { ProfessionalIdentityV3 } from '../../identity/schema'
import { INTAKE_SOURCE_CAP } from '../../types/identity'
import type {
  IdentityIntakeMode,
  IdentityExtractionDraft,
  IntakeSource,
  ResumeScanResult,
} from '../../types/identity'
import { AiWorkingStatus } from '../../components/AiWorkingStatus'
import { ScanReviewPane } from './ScanReviewPane'
import { SOURCE_MATERIAL_SAMPLES } from './sampleSourceMaterial'

interface FailedFileEntry {
  id: string
  name: string
  error: string
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
  onGenerate: (mode: 'fresh' | 'regenerate') => Promise<void>
  onDeepenAll: () => Promise<void>
  onCancelDeepenAll: () => void
  onUploadChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void>
  onDrop: (event: DragEvent<HTMLDivElement>) => Promise<void>
  onRescan: () => void
  onRemoveSource: (id: string) => void
  onSetSourceLabel: (id: string, label: string) => void
  onDismissFailedFile: (id: string) => void
  onClearScan: () => void
  onUpdateIdentityCore: (
    field: keyof ProfessionalIdentityV3['identity'],
    value: string | boolean | ProfessionalIdentityV3['identity']['links'],
  ) => void
  onUpdateRole: (
    roleIndex: number,
    field: 'company' | 'title' | 'dates' | 'subtitle',
    value: string,
  ) => void
  onUpdateBulletSourceText: (roleIndex: number, bulletIndex: number, value: string) => void
  onUpdateBulletTextField: (
    roleId: string,
    bulletId: string,
    field: 'problem' | 'action' | 'outcome',
    value: string,
  ) => void
  onUpdateBulletListField: (
    roleId: string,
    bulletId: string,
    field: 'impact' | 'technologies' | 'tags',
    value: string[],
  ) => void
  onUpdateBulletMetrics: (
    roleId: string,
    bulletId: string,
    value: Record<string, string | number | boolean>,
  ) => void
  onDeepenBullet: (roleId: string, bulletId: string) => Promise<void>
  onUpdateSkillGroupLabel: (groupIndex: number, value: string) => void
  onUpdateSkillItemName: (groupIndex: number, itemIndex: number, value: string) => void
  onUpdateProjectEntry: (
    projectIndex: number,
    field: 'name' | 'description' | 'url',
    value: string,
  ) => void
  onUpdateEducationEntry: (
    educationIndex: number,
    field: keyof ProfessionalIdentityV3['education'][number],
    value: string,
  ) => void
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
  onRescan,
  onRemoveSource,
  onSetSourceLabel,
  onDismissFailedFile,
  onClearScan,
  onUpdateIdentityCore,
  onUpdateRole,
  onUpdateBulletSourceText,
  onUpdateBulletTextField,
  onUpdateBulletListField,
  onUpdateBulletMetrics,
  onDeepenBullet,
  onUpdateSkillGroupLabel,
  onUpdateSkillItemName,
  onUpdateProjectEntry,
  onUpdateEducationEntry,
}: ExtractionAgentCardProps) {
  const hasRunningBullet = scanResult
    ? Object.values(scanResult.progress.bullets).some((progress) => progress.status === 'running')
    : false

  return (
    <section className="identity-card">
      <div className="identity-card-header">
        <div>
          <h2>Source Intake</h2>
          <p>
            Bring in a resume first, then fall back to pasted source text when the scan needs
            clarification.
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
            {isGenerating ? 'Generating…' : 'Generate Draft'}
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
        onChange={(event) => void onUploadChange(event)}
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
              {isScanning ? 'Scanning PDF…' : 'Drag resume PDFs here or click to browse'}
            </strong>
          </div>
          <p className="identity-muted">
            Resume Scanner v1 is PDF-only and performs a local structural parse before any AI call.
            Use text-based, single-column PDFs. OCR and image-only resumes are out of scope for this
            pass. Drop multiple resumes to feed variant context into the draft.
          </p>
          {intakeSources.length > 0 || failedFiles.length > 0 ? (
            <>
              {intakeSources.length > INTAKE_SOURCE_CAP ? (
                <p className="identity-source-cap-warning" role="alert">
                  {intakeSources.length - INTAKE_SOURCE_CAP} source
                  {intakeSources.length - INTAKE_SOURCE_CAP === 1 ? '' : 's'} above the{' '}
                  {INTAKE_SOURCE_CAP}-source cap won&apos;t contribute to synthesis. Remove some to
                  bring the count to {INTAKE_SOURCE_CAP} or fewer.
                </p>
              ) : null}
              <ul className="identity-source-list" aria-label="Intake sources">
                {intakeSources.map((source, index) => {
                  if (source.kind !== 'resume') {
                    return null
                  }
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
                          placeholder="e.g. platform, security, backend"
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
                  Inspect the scanned structure, deepen weak bullets, and correct anything before
                  applying the draft.
                </p>
              </div>
              <div className="identity-scan-status">
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
                      : 'Deepen All'}
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
              </div>

              <ScanReviewPane
                scanResult={scanResult}
                bulkStatus={bulkStatus ?? 'idle'}
                onUpdateIdentityCore={onUpdateIdentityCore}
                onUpdateRole={onUpdateRole}
                onUpdateBulletSourceText={onUpdateBulletSourceText}
                onUpdateBulletTextField={onUpdateBulletTextField}
                onUpdateBulletListField={onUpdateBulletListField}
                onUpdateBulletMetrics={onUpdateBulletMetrics}
                onDeepenBullet={onDeepenBullet}
                onUpdateSkillGroupLabel={onUpdateSkillGroupLabel}
                onUpdateSkillItemName={onUpdateSkillItemName}
                onUpdateProjectEntry={onUpdateProjectEntry}
                onUpdateEducationEntry={onUpdateEducationEntry}
              />
            </>
          ) : (
            <div className="identity-empty">
              <h3>No scanned resume yet</h3>
              <p>
                Upload a text-based PDF to build a partial identity shell without a network call. If
                the parser cannot recover a reliable structure, switch to paste-text mode and
                continue there.
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
