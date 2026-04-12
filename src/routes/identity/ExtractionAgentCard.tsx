import { RefreshCcw, ScanSearch, Sparkles, Upload, X } from "lucide-react";
import type { ChangeEvent, DragEvent, RefObject } from "react";
import type { ProfessionalIdentityV3 } from "../../identity/schema";
import type {
  IdentityIntakeMode,
  IdentityExtractionDraft,
  ResumeScanResult,
} from "../../types/identity";
import { ScannedIdentityEditor } from "./ScannedIdentityEditor";

interface ExtractionAgentCardProps {
  statusLabel?: string;
  intakeMode: IdentityIntakeMode;
  sourceMaterial: string;
  correctionNotes: string;
  currentIdentity: ProfessionalIdentityV3 | null;
  draft: IdentityExtractionDraft | null;
  scanResult: ResumeScanResult | null;
  scanCompletion: {
    extractedBullets: number;
    decomposedBullets: number;
  } | null;
  bulkStatus: ResumeScanResult["progress"]["bulk"]["status"] | null;
  isGenerating: boolean;
  isScanning: boolean;
  uploadRef: RefObject<HTMLInputElement | null>;
  onRequestUpload: () => void;
  onSetIntakeMode: (mode: IdentityIntakeMode) => void;
  onSetSourceMaterial: (value: string) => void;
  onSetCorrectionNotes: (value: string) => void;
  onGenerate: (mode: "fresh" | "regenerate") => Promise<void>;
  onDeepenAll: () => Promise<void>;
  onCancelDeepenAll: () => void;
  onUploadChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  onDrop: (event: DragEvent<HTMLDivElement>) => Promise<void>;
  onClearScan: () => void;
  onUpdateIdentityCore: (
    field: keyof ProfessionalIdentityV3["identity"],
    value: string | boolean | ProfessionalIdentityV3["identity"]["links"],
  ) => void;
  onUpdateRole: (
    roleIndex: number,
    field: "company" | "title" | "dates" | "subtitle",
    value: string,
  ) => void;
  onUpdateBulletSourceText: (
    roleIndex: number,
    bulletIndex: number,
    value: string,
  ) => void;
  onUpdateBulletTextField: (
    roleId: string,
    bulletId: string,
    field: "problem" | "action" | "outcome",
    value: string,
  ) => void;
  onUpdateBulletListField: (
    roleId: string,
    bulletId: string,
    field: "impact" | "technologies" | "tags",
    value: string[],
  ) => void;
  onUpdateBulletMetrics: (
    roleId: string,
    bulletId: string,
    value: Record<string, string | number | boolean>,
  ) => void;
  onDeepenBullet: (roleId: string, bulletId: string) => Promise<void>;
  onUpdateSkillGroupLabel: (groupIndex: number, value: string) => void;
  onUpdateSkillItemName: (
    groupIndex: number,
    itemIndex: number,
    value: string,
  ) => void;
  onUpdateProjectEntry: (
    projectIndex: number,
    field: "name" | "description" | "url",
    value: string,
  ) => void;
  onUpdateEducationEntry: (
    educationIndex: number,
    field: keyof ProfessionalIdentityV3["education"][number],
    value: string,
  ) => void;
}

export function ExtractionAgentCard({
  statusLabel,
  intakeMode,
  sourceMaterial,
  correctionNotes,
  currentIdentity,
  draft,
  scanResult,
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
    ? Object.values(scanResult.progress.bullets).some(
        (progress) => progress.status === "running",
      )
    : false;

  return (
    <section className="identity-card">
      <div className="identity-card-header">
        <div>
          <h2>Source Intake</h2>
          <p>
            Bring in a resume first, then fall back to pasted source text when
            the scan needs clarification.
          </p>
          {statusLabel ? (
            <p className="identity-section-status">{statusLabel}</p>
          ) : null}
        </div>
        <div className="identity-card-actions">
          <button
            className={`identity-btn ${intakeMode === "upload" ? "identity-btn-primary" : ""}`}
            type="button"
            onClick={onRequestUpload}
          >
            <ScanSearch size={16} />
            Upload Resume
          </button>
          <button
            className={`identity-btn ${intakeMode === "paste" ? "identity-btn-primary" : ""}`}
            type="button"
            onClick={() => onSetIntakeMode("paste")}
          >
            <Upload size={16} />
            Paste Source Text
          </button>
          <button
            className="identity-btn identity-btn-primary"
            type="button"
            onClick={() => void onGenerate("fresh")}
            disabled={isGenerating || isScanning}
          >
            <Sparkles size={16} />
            {isGenerating ? "Generating…" : "Generate Draft"}
          </button>
          <button
            className="identity-btn"
            type="button"
            onClick={() => void onGenerate("regenerate")}
            disabled={
              isGenerating || isScanning || (!draft && !currentIdentity)
            }
          >
            <RefreshCcw size={16} />
            Regenerate
          </button>
        </div>
      </div>

      <input
        ref={uploadRef}
        hidden
        type="file"
        accept="application/pdf,.pdf"
        onChange={(event) => void onUploadChange(event)}
      />

      {intakeMode === "upload" ? (
        <>
          <div
            className="identity-upload-zone"
            role="button"
            tabIndex={0}
            onClick={onRequestUpload}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onRequestUpload();
              }
            }}
            onDragEnter={(event) => event.preventDefault()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => void onDrop(event)}
          >
            <Upload size={22} aria-hidden="true" />
            <strong>
              {isScanning
                ? "Scanning PDF…"
                : "Drag a resume PDF here or click to browse"}
            </strong>
          </div>
          <p className="identity-muted">
            Resume Scanner v1 is PDF-only and performs a local structural parse
            before any AI call. Use a text-based, single-column PDF. OCR and
            image-only resumes are out of scope for this pass.
          </p>
          {scanResult ? (
            <>
              <div className="identity-stack">
                <h3>Extraction Review</h3>
                <p className="identity-muted">
                  Inspect the scanned structure, deepen weak bullets, and
                  correct anything before applying the draft.
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
                    aria-label={"Roles: " + scanResult.counts.roles}
                  >
                    <span className="identity-stat-label">Roles</span>
                    <strong>{scanResult.counts.roles}</strong>
                  </div>
                  <div
                    className="identity-stat"
                    role="group"
                    aria-label={"Bullets: " + scanResult.counts.bullets}
                  >
                    <span className="identity-stat-label">Bullets</span>
                    <strong>{scanResult.counts.bullets}</strong>
                  </div>
                  <div
                    className="identity-stat"
                    role="group"
                    aria-label={
                      "Skill groups: " + scanResult.counts.skillGroups
                    }
                  >
                    <span className="identity-stat-label">Skill Groups</span>
                    <strong>{scanResult.counts.skillGroups}</strong>
                  </div>
                  <div
                    className="identity-stat"
                    role="group"
                    aria-label={"Projects: " + scanResult.counts.projects}
                  >
                    <span className="identity-stat-label">Projects</span>
                    <strong>{scanResult.counts.projects}</strong>
                  </div>
                  <div
                    className="identity-stat"
                    role="group"
                    aria-label={"Education: " + scanResult.counts.education}
                  >
                    <span className="identity-stat-label">Education</span>
                    <strong>{scanResult.counts.education}</strong>
                  </div>
                  <div
                    className="identity-stat"
                    role="group"
                    aria-label={
                      "Decomposed bullets: " +
                      (scanCompletion?.decomposedBullets ?? 0) +
                      " of " +
                      (scanCompletion?.extractedBullets ??
                        scanResult.counts.extractedBullets)
                    }
                  >
                    <span className="identity-stat-label">Deepened</span>
                    <strong>
                      {scanCompletion?.decomposedBullets ?? 0}/
                      {scanCompletion?.extractedBullets ??
                        scanResult.counts.extractedBullets}
                    </strong>
                  </div>
                  <div
                    className="identity-stat"
                    role="group"
                    aria-label={
                      "Edited bullets: " + scanResult.counts.editedBullets
                    }
                  >
                    <span className="identity-stat-label">Edited</span>
                    <strong>{scanResult.counts.editedBullets}</strong>
                  </div>
                  <div
                    className="identity-stat"
                    role="group"
                    aria-label={
                      "Failed bullets: " + scanResult.counts.failedBullets
                    }
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
                      bulkStatus === "running" ||
                      bulkStatus === "cancelling" ||
                      scanResult.counts.extractedBullets === 0
                    }
                  >
                    <Sparkles size={16} />
                    {bulkStatus === "running" || bulkStatus === "cancelling"
                      ? "Deepening…"
                      : "Deepen All"}
                  </button>
                  <button
                    className="identity-btn"
                    type="button"
                    onClick={onCancelDeepenAll}
                    disabled={
                      bulkStatus !== "running" && bulkStatus !== "cancelling"
                    }
                  >
                    <X size={16} />
                    {bulkStatus === "cancelling" ? "Cancelling…" : "Cancel"}
                  </button>
                  <button
                    className="identity-btn"
                    type="button"
                    onClick={() => uploadRef.current?.click()}
                  >
                    <RefreshCcw size={16} />
                    Rescan PDF
                  </button>
                  <button
                    className="identity-btn"
                    type="button"
                    onClick={onClearScan}
                  >
                    <X size={16} />
                    Clear Scan
                  </button>
                </div>
              </div>

              <ScannedIdentityEditor
                scanResult={scanResult}
                bulkStatus={bulkStatus ?? "idle"}
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
                Upload a text-based PDF to build a partial identity shell
                without a network call. If the parser cannot recover a reliable
                structure, switch to paste-text mode and continue there.
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
  );
}
