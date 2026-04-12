import { useId, useState } from "react";
import { Braces, GitMerge, RefreshCcw, ShieldCheck } from "lucide-react";
import type { IdentityApplyMode } from "../../types/identity";

interface IdentityModelBuilderCardProps {
  counts: {
    roles: number;
    bullets: number;
    profiles: number;
    projects: number;
    skillGroups: number;
  } | null;
  draftDocument: string;
  hasCurrentIdentity: boolean;
  onSetDraftDocument: (value: string) => void;
  onValidateDraft: () => void;
  onApply: (mode: IdentityApplyMode) => void;
}

export function IdentityModelBuilderCard({
  counts,
  draftDocument,
  hasCurrentIdentity,
  onSetDraftDocument,
  onValidateDraft,
  onApply,
}: IdentityModelBuilderCardProps) {
  const hasDraftDocument = draftDocument.trim().length > 0;
  const hasCounts = counts !== null;
  const [isEditorExpanded, setIsEditorExpanded] = useState<boolean | null>(
    hasDraftDocument ? true : null,
  );
  const editorRegionId = useId();
  const editorExpanded = isEditorExpanded ?? hasDraftDocument;

  const showCompactEmptyState =
    !hasDraftDocument && !editorExpanded && !hasCounts && !hasCurrentIdentity;

  return (
    <section className="identity-card identity-model-builder-card">
      <div className="identity-card-header">
        <div>
          <h2>Apply / Review Draft</h2>
          <p>
            Check the current draft, validate it, and apply it as a fresh
            identity or a merge.
          </p>
        </div>
        <div className="identity-card-actions">
          <button
            className="identity-btn"
            type="button"
            aria-expanded={editorExpanded}
            aria-controls={editorRegionId}
            onClick={() =>
              setIsEditorExpanded((current) => !(current ?? hasDraftDocument))
            }
          >
            <Braces size={16} />
            {editorExpanded ? "Hide Advanced JSON" : "Open Advanced JSON"}
          </button>
          {!showCompactEmptyState ? (
            <>
              <button
                className="identity-btn"
                type="button"
                onClick={onValidateDraft}
                disabled={!hasDraftDocument}
              >
                <ShieldCheck size={16} />
                Validate Draft
              </button>
              <button
                className="identity-btn"
                type="button"
                onClick={() => onApply("merge")}
                disabled={!hasDraftDocument}
              >
                <GitMerge size={16} />
                Merge Instead
              </button>
              <button
                className="identity-btn identity-btn-primary"
                type="button"
                onClick={() => onApply("replace")}
                disabled={!hasDraftDocument}
              >
                <RefreshCcw size={16} />
                Apply Identity
              </button>
            </>
          ) : null}
        </div>
      </div>

      {hasCounts ? (
        <div className="identity-stats identity-stats-compact">
          <div
            className="identity-stat"
            role="group"
            aria-label={"Roles: " + counts.roles}
          >
            <span className="identity-stat-label">Roles</span>
            <strong>{counts.roles}</strong>
          </div>
          <div
            className="identity-stat"
            role="group"
            aria-label={"Bullets: " + counts.bullets}
          >
            <span className="identity-stat-label">Bullets</span>
            <strong>{counts.bullets}</strong>
          </div>
          <div
            className="identity-stat"
            role="group"
            aria-label={"Profiles: " + counts.profiles}
          >
            <span className="identity-stat-label">Profiles</span>
            <strong>{counts.profiles}</strong>
          </div>
          <div
            className="identity-stat"
            role="group"
            aria-label={"Projects: " + counts.projects}
          >
            <span className="identity-stat-label">Projects</span>
            <strong>{counts.projects}</strong>
          </div>
          <div
            className="identity-stat"
            role="group"
            aria-label={"Skill Groups: " + counts.skillGroups}
          >
            <span className="identity-stat-label">Skill Groups</span>
            <strong>{counts.skillGroups}</strong>
          </div>
        </div>
      ) : null}

      {showCompactEmptyState ? (
        <div className="identity-model-builder-empty-state">
          <p className="identity-model-builder-empty-copy">
            Generate a draft or import JSON to review it here. Advanced JSON
            stays tucked away until you need it.
          </p>
        </div>
      ) : null}

      <div
        className="identity-model-builder-editor-region"
        id={editorRegionId}
        hidden={!editorExpanded}
      >
        <label className="identity-field">
          <span className="identity-label">Advanced JSON</span>
          <textarea
            className={`identity-textarea identity-textarea-code${hasDraftDocument ? "" : " identity-textarea-code-empty"}`}
            value={draftDocument}
            onChange={(event) => onSetDraftDocument(event.target.value)}
            placeholder='{"version": 3, "...": "..."}'
          />
          {!hasDraftDocument ? (
            <span className="identity-muted">
              Generate or import a draft first, then validate and apply it from
              this advanced editor.
            </span>
          ) : null}
        </label>
      </div>
    </section>
  );
}
