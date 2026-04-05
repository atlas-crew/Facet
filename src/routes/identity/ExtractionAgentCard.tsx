import { RefreshCcw, ScanSearch, Sparkles, Upload, X } from 'lucide-react'
import type { ChangeEvent, DragEvent, RefObject } from 'react'
import type { ProfessionalIdentityV3 } from '../../identity/schema'
import type {
  IdentityIntakeMode,
  IdentityExtractionDraft,
  ResumeScanResult,
} from '../../types/identity'
import { ScannedIdentityEditor } from './ScannedIdentityEditor'

interface ExtractionAgentCardProps {
  intakeMode: IdentityIntakeMode
  sourceMaterial: string
  correctionNotes: string
  currentIdentity: ProfessionalIdentityV3 | null
  draft: IdentityExtractionDraft | null
  scanResult: ResumeScanResult | null
  scanCompletion: { extractedBullets: number; decomposedBullets: number } | null
  isGenerating: boolean
  isScanning: boolean
  uploadRef: RefObject<HTMLInputElement | null>
  onSetIntakeMode: (mode: IdentityIntakeMode) => void
  onSetSourceMaterial: (value: string) => void
  onSetCorrectionNotes: (value: string) => void
  onGenerate: (mode: 'fresh' | 'regenerate') => Promise<void>
  onUploadChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void>
  onDrop: (event: DragEvent<HTMLButtonElement>) => Promise<void>
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
  onUpdateSkillGroupLabel: (groupIndex: number, value: string) => void
  onUpdateSkillItemName: (groupIndex: number, itemIndex: number, value: string) => void
  onUpdateEducationEntry: (
    educationIndex: number,
    field: keyof ProfessionalIdentityV3['education'][number],
    value: string,
  ) => void
}

export function ExtractionAgentCard({
  intakeMode,
  sourceMaterial,
  correctionNotes,
  currentIdentity,
  draft,
  scanResult,
  scanCompletion,
  isGenerating,
  isScanning,
  uploadRef,
  onSetIntakeMode,
  onSetSourceMaterial,
  onSetCorrectionNotes,
  onGenerate,
  onUploadChange,
  onDrop,
  onClearScan,
  onUpdateIdentityCore,
  onUpdateRole,
  onUpdateBulletSourceText,
  onUpdateSkillGroupLabel,
  onUpdateSkillItemName,
  onUpdateEducationEntry,
}: ExtractionAgentCardProps) {
  return (
    <section className="identity-card">
      <div className="identity-card-header">
        <div>
          <h2>Extraction Agent</h2>
          <p>Upload a resume PDF first. Fall back to pasted text when the scan is ambiguous or unsupported.</p>
        </div>
        <div className="identity-card-actions">
          <button
            className={`identity-btn ${intakeMode === 'upload' ? 'identity-btn-primary' : ''}`}
            type="button"
            onClick={() => onSetIntakeMode('upload')}
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
            Paste Text Instead
          </button>
          <button
            className="identity-btn identity-btn-primary"
            type="button"
            onClick={() => void onGenerate('fresh')}
            disabled={isGenerating || isScanning}
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

      {intakeMode === 'upload' ? (
        <>
          <button
            className="identity-upload-zone"
            type="button"
            onClick={() => uploadRef.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => void onDrop(event)}
          >
            <Upload size={22} aria-hidden="true" />
            <strong>{isScanning ? 'Scanning PDF…' : 'Drop a PDF here or click to upload'}</strong>
          </button>
          <p className="identity-muted">
            Resume Scanner v1 is PDF-only and performs a local structural parse before any AI call.
            Use a text-based, single-column PDF. OCR and image-only resumes are out of scope for this pass.
          </p>
          <input
            ref={uploadRef}
            hidden
            type="file"
            accept="application/pdf,.pdf"
            onChange={(event) => void onUploadChange(event)}
          />

          {scanResult ? (
            <>
              <div className="identity-scan-status">
                <div className="identity-scan-status-row">
                  <strong>{scanResult.fileName}</strong>
                  <span>{scanResult.pageCount} page(s)</span>
                </div>
                <div className="identity-stats identity-stats-compact">
                  <div className="identity-stat" role="group" aria-label={'Roles: ' + scanResult.counts.roles}>
                    <span className="identity-stat-label">Roles</span>
                    <strong>{scanResult.counts.roles}</strong>
                  </div>
                  <div className="identity-stat" role="group" aria-label={'Bullets: ' + scanResult.counts.bullets}>
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
                </div>
                <div className="identity-card-actions">
                  <button className="identity-btn" type="button" onClick={() => uploadRef.current?.click()}>
                    <RefreshCcw size={16} />
                    Rescan PDF
                  </button>
                  <button className="identity-btn" type="button" onClick={onClearScan}>
                    <X size={16} />
                    Clear Scan
                  </button>
                </div>
              </div>

              <ScannedIdentityEditor
                scanResult={scanResult}
                onUpdateIdentityCore={onUpdateIdentityCore}
                onUpdateRole={onUpdateRole}
                onUpdateBulletSourceText={onUpdateBulletSourceText}
                onUpdateSkillGroupLabel={onUpdateSkillGroupLabel}
                onUpdateSkillItemName={onUpdateSkillItemName}
                onUpdateEducationEntry={onUpdateEducationEntry}
              />
            </>
          ) : (
            <div className="identity-empty">
              <h3>No scanned resume yet</h3>
              <p>
                Upload a text-based PDF to build a partial identity shell without a network call.
                If the parser cannot recover a reliable structure, switch to paste-text mode and continue there.
              </p>
            </div>
          )}
        </>
      ) : (
        <label className="identity-field">
          <span className="identity-label">Source Material</span>
          <textarea
            className="identity-textarea identity-textarea-lg"
            value={sourceMaterial}
            onChange={(event) => onSetSourceMaterial(event.target.value)}
            placeholder="Paste resume bullets, LinkedIn text, portfolio notes, or a rough narrative here."
          />
        </label>
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
