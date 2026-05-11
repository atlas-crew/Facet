import { useEffect, useMemo, useState } from 'react'
import type { ProfessionalIdentityArcEntry } from '../../../identity/schema'
import { useIdentityStore } from '../../../store/identityStore'
import { selfModelFillStrength } from '../../../utils/identityFillStrength'
import { IdentityBand } from '../IdentityBand'

interface ArcStop extends ProfessionalIdentityArcEntry {
  id: string
}

/**
 * Build arc stops from persisted `self_model.arc[]` only. We deliberately do
 * NOT auto-derive chapters from `roles[]` — that would produce a degenerate
 * copy of the Roles band (same company + same role title in both places).
 * Roles is the evidence layer; arc is the narrative layer. They only show
 * different content when the arc has actually been authored.
 */
function buildArcStops(arc: ProfessionalIdentityArcEntry[]): ArcStop[] {
  return arc.map((entry, index) => ({ ...entry, id: `${entry.company}:${index}` }))
}

export function SelfModelBand() {
  const identity = useIdentityStore((s) => s.currentIdentity)
  const selection = useIdentityStore((s) => s.mapSelection)
  const setSelection = useIdentityStore((s) => s.setMapSelection)
  const updateCompetitiveMoat = useIdentityStore((s) => s.updateCurrentCompetitiveMoat)
  const updateUnfairAdvantages = useIdentityStore((s) => s.updateCurrentUnfairAdvantages)
  const fill = selfModelFillStrength(identity)

  const self = identity?.self_model
  const arc = useMemo(() => buildArcStops(self?.arc ?? []), [self?.arc])
  const philosophy = self?.philosophy ?? []
  const interview = self?.interview_style
  const moat = self?.competitive_moat ?? ''
  const advantages = useMemo(() => self?.unfair_advantages ?? [], [self?.unfair_advantages])

  // Local draft state for moat + advantages-add input. Re-syncs when the
  // canonical identity values change (e.g., after import or reset).
  const [moatDraft, setMoatDraft] = useState(moat)
  const [newAdvantage, setNewAdvantage] = useState('')
  useEffect(() => {
    setMoatDraft(moat)
  }, [moat])

  const commitMoat = () => {
    if (moatDraft !== moat) updateCompetitiveMoat(moatDraft)
  }
  const handleAddAdvantage = () => {
    const trimmed = newAdvantage.trim()
    if (!trimmed) return
    updateUnfairAdvantages([...advantages, trimmed])
    setNewAdvantage('')
  }
  const handleRemoveAdvantage = (index: number) => {
    updateUnfairAdvantages(advantages.filter((_, i) => i !== index))
  }

  return (
    <IdentityBand
      layer="self"
      name="Self Model"
      subtitle="arc · philosophy · interview self-knowledge"
      fill={fill}
    >
      <div className="self-grid">
        <div className="self-arc">
          <div className="arc-label label-tracked">Career Arc</div>
          {arc.length === 0 ? (
            <div className="self-arc-empty">
              <p className="chapter-copy">
                No narrative chapters yet. Roles tell what you did; arc tells what each chapter meant — the interpretive layer that powers interview prep.
              </p>
              <button
                type="button"
                className="inspector-btn primary self-arc-cta"
                onClick={() => {
                  // Phase D wires this to identityParametersGeneration utilities.
                }}
              >
                Generate chapters from roles
              </button>
            </div>
          ) : (
            <div className="arc-flow">
              {arc.map((stop) => {
                const isSelected = selection?.type === 'arc-stop' && selection.id === stop.id
                return (
                  <button
                    key={stop.id}
                    type="button"
                    className={`arc-stop${isSelected ? ' selected' : ''}`}
                    onClick={() => setSelection({ type: 'arc-stop', id: stop.id })}
                    aria-pressed={isSelected}
                  >
                    <span className="arc-stop-company">{stop.company}</span>
                    <span className="arc-stop-chapter chapter-copy">{stop.chapter}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="self-philosophy">
          <div className="arc-label label-tracked">
            Philosophy <span className="self-count">{philosophy.length} positions</span>
          </div>
          {philosophy.length === 0 ? (
            <p className="chapter-copy self-empty">No philosophy positions captured yet.</p>
          ) : (
            <ul className="self-philosophy-list">
              {philosophy.map((p) => {
                const isSelected = selection?.type === 'philosophy' && selection.id === p.id
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      className={`philosophy-item${isSelected ? ' selected' : ''}`}
                      onClick={() => setSelection({ type: 'philosophy', id: p.id })}
                      aria-pressed={isSelected}
                    >
                      <span className="philosophy-id label-tracked">{p.id}</span>
                      <span className="philosophy-text">{p.text}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="self-interview">
          <div className="arc-label label-tracked">Interview Self-Knowledge</div>
          <InterviewBlock label="Strengths" items={interview?.strengths ?? []} />
          <InterviewBlock label="Weaknesses" items={interview?.weaknesses ?? []} weak />
          <InterviewBlock
            label="Prep Strategy"
            items={interview?.prep_strategy?.trim() ? [interview.prep_strategy.trim()] : []}
          />
        </div>

        <div className="self-positioning">
          <div className="arc-label label-tracked">Strategic Positioning</div>
          <div className="self-positioning-block">
            <div className="self-positioning-label label-tracked">Competitive Moat</div>
            <textarea
              className="self-moat-textarea"
              rows={3}
              value={moatDraft}
              onChange={(event) => setMoatDraft(event.target.value)}
              onBlur={commitMoat}
              placeholder="What makes you structurally different? e.g. 'Production Kubernetes plus product-aware platform judgment.'"
              aria-label="Competitive moat"
              disabled={!identity}
            />
          </div>

          <div className="self-positioning-block">
            <div className="self-positioning-label label-tracked">
              Unfair Advantages <span className="self-count">{advantages.length}</span>
            </div>
            {advantages.length === 0 ? (
              <p className="chapter-copy self-empty">
                No unfair advantages captured yet. The thesis generator expands each
                advantage into a target-company-profile lens at search time.
              </p>
            ) : (
              <ul className="self-advantage-list">
                {advantages.map((advantage, index) => (
                  <li key={`${index}-${advantage}`} className="self-advantage-item">
                    <span className="self-advantage-text">{advantage}</span>
                    <button
                      type="button"
                      className="inspector-btn self-advantage-remove"
                      onClick={() => handleRemoveAdvantage(index)}
                      aria-label={`Remove "${advantage}"`}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="self-advantage-add">
              <input
                className="self-advantage-input"
                value={newAdvantage}
                onChange={(event) => setNewAdvantage(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    handleAddAdvantage()
                  }
                }}
                placeholder='e.g. "Platform engineering plus security depth"'
                aria-label="New unfair advantage"
                disabled={!identity}
              />
              <button
                type="button"
                className="inspector-btn"
                onClick={handleAddAdvantage}
                disabled={!identity || !newAdvantage.trim()}
              >
                + Add
              </button>
            </div>
          </div>
        </div>
      </div>
    </IdentityBand>
  )
}

function InterviewBlock({ label, items, weak = false }: { label: string; items: string[]; weak?: boolean }) {
  return (
    <div className={`interview-block${weak ? ' interview-weak' : ''}`}>
      <div className="interview-block-label label-tracked">{label}</div>
      {items.length === 0 ? (
        <p className="chapter-copy self-empty">— not captured</p>
      ) : (
        <ul>
          {items.map((item, index) => (
            <li key={`${label}-${index}`}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
