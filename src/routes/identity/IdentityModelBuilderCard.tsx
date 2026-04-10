import { useEffect, useId, useState } from 'react'
import { ArrowRight, Braces, ChevronUp, GitMerge, RefreshCcw, ShieldCheck } from 'lucide-react'
import type { IdentityApplyMode } from '../../types/identity'

interface IdentityModelBuilderCardProps {
  counts: {
    roles: number
    bullets: number
    profiles: number
    projects: number
    skillGroups: number
  } | null
  draftDocument: string
  hasCurrentIdentity: boolean
  onSetDraftDocument: (value: string) => void
  onValidateDraft: () => void
  onApply: (mode: IdentityApplyMode) => void
  onPushToBuild: () => void
}

export function IdentityModelBuilderCard({
  counts,
  draftDocument,
  hasCurrentIdentity,
  onSetDraftDocument,
  onValidateDraft,
  onApply,
  onPushToBuild,
}: IdentityModelBuilderCardProps) {
  const hasDraftDocument = draftDocument.trim().length > 0
  const hasCounts = counts !== null
  const [isEditorExpanded, setIsEditorExpanded] = useState(hasDraftDocument)
  const editorRegionId = useId()

  useEffect(() => {
    if (hasDraftDocument) {
      setIsEditorExpanded(true)
    }
  }, [hasDraftDocument])

  const showCompactEmptyState = !hasDraftDocument && !isEditorExpanded && !hasCounts && !hasCurrentIdentity
  const showCollapseControl = isEditorExpanded && !hasDraftDocument && !hasCounts && !hasCurrentIdentity

  return (
    <section className="identity-card identity-model-builder-card">
      <div className="identity-card-header">
        <div>
          <h2>Identity Model Builder</h2>
          <p>Validate the current draft JSON, then apply it as a replace or merge operation.</p>
        </div>
        <div className="identity-card-actions">
          {showCompactEmptyState ? (
            <button
              className="identity-btn"
              type="button"
              aria-expanded="false"
              aria-controls={editorRegionId}
              onClick={() => setIsEditorExpanded(true)}
            >
              <Braces size={16} />
              Open JSON Editor
            </button>
          ) : (
            <>
              {showCollapseControl ? (
                <button
                  className="identity-btn"
                  type="button"
                  aria-expanded="true"
                  aria-controls={editorRegionId}
                  onClick={() => setIsEditorExpanded(false)}
                >
                  <ChevronUp size={16} />
                  Collapse Editor
                </button>
              ) : null}
              <button className="identity-btn" type="button" onClick={onValidateDraft} disabled={!hasDraftDocument}>
                <ShieldCheck size={16} />
                Validate Draft
              </button>
              <button className="identity-btn" type="button" onClick={() => onApply('merge')} disabled={!hasDraftDocument}>
                <GitMerge size={16} />
                Merge Draft
              </button>
              <button
                className="identity-btn identity-btn-primary"
                type="button"
                onClick={() => onApply('replace')}
                disabled={!hasDraftDocument}
              >
                <RefreshCcw size={16} />
                Replace Identity
              </button>
            </>
          )}
        </div>
      </div>

      {showCompactEmptyState ? (
        <div className="identity-model-builder-empty-state">
          <p className="identity-model-builder-empty-copy">
            Generate a draft or import JSON to open the builder. Until then, this panel stays compact so the extraction workflow has room to breathe.
          </p>
        </div>
      ) : null}

      <div className="identity-model-builder-editor-region" id={editorRegionId} hidden={showCompactEmptyState}>
          {hasCounts ? (
            <div className="identity-stats identity-stats-compact">
              <div className="identity-stat" role="group" aria-label={'Roles: ' + (counts?.roles ?? 0)}>
                <span className="identity-stat-label">Roles</span>
                <strong>{counts?.roles ?? 0}</strong>
              </div>
              <div className="identity-stat" role="group" aria-label={'Bullets: ' + (counts?.bullets ?? 0)}>
                <span className="identity-stat-label">Bullets</span>
                <strong>{counts?.bullets ?? 0}</strong>
              </div>
              <div className="identity-stat" role="group" aria-label={'Profiles: ' + (counts?.profiles ?? 0)}>
                <span className="identity-stat-label">Profiles</span>
                <strong>{counts?.profiles ?? 0}</strong>
              </div>
              <div className="identity-stat" role="group" aria-label={'Projects: ' + (counts?.projects ?? 0)}>
                <span className="identity-stat-label">Projects</span>
                <strong>{counts?.projects ?? 0}</strong>
              </div>
              <div className="identity-stat" role="group" aria-label={'Skill Groups: ' + (counts?.skillGroups ?? 0)}>
                <span className="identity-stat-label">Skill Groups</span>
                <strong>{counts?.skillGroups ?? 0}</strong>
              </div>
            </div>
          ) : null}

          <label className="identity-field">
            <span className="identity-label">Draft JSON</span>
            <textarea
              className={`identity-textarea identity-textarea-code${hasDraftDocument ? '' : ' identity-textarea-code-empty'}`}
              value={draftDocument}
              onChange={(event) => onSetDraftDocument(event.target.value)}
              placeholder='{"version": 3, "...": "..."}'
            />
            {!hasDraftDocument ? (
              <span className="identity-muted">Generate or import a draft first, then validate the JSON and apply it from this panel.</span>
            ) : null}
          </label>

          <div className="identity-card-actions">
            <button
              className="identity-btn identity-btn-primary"
              type="button"
              onClick={onPushToBuild}
              disabled={!hasCurrentIdentity}
            >
              <ArrowRight size={16} />
              Push To Build
            </button>
          </div>
      </div>
    </section>
  )
}
