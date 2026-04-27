import { useMemo } from 'react'
import type { ProfessionalIdentityArcEntry, ProfessionalRole } from '../../../identity/schema'
import { useIdentityStore } from '../../../store/identityStore'
import { selfModelFillStrength } from '../../../utils/identityFillStrength'
import { IdentityBand } from '../IdentityBand'

interface ArcStop extends ProfessionalIdentityArcEntry {
  id: string
}

/**
 * Derive arc entries from `roles` when persisted `arc[]` is empty. Synthetic ids
 * use the `derived:` prefix so isMapSelectionValid recognizes them; persisted
 * arc entries (when added via inspector edit) override per company.
 */
function deriveCareerArc(
  arc: ProfessionalIdentityArcEntry[],
  roles: ProfessionalRole[],
): ArcStop[] {
  if (arc.length > 0) {
    return arc.map((entry, index) => ({ ...entry, id: `${entry.company}:${index}` }))
  }
  const byCompany = new Map<string, ProfessionalRole>()
  for (const role of roles) {
    if (!byCompany.has(role.company)) byCompany.set(role.company, role)
  }
  return Array.from(byCompany.entries()).map(([company, role], index) => ({
    id: `derived:${company}:${index}`,
    company,
    chapter: role.subtitle?.trim() || role.title,
  }))
}

export function SelfModelBand() {
  const identity = useIdentityStore((s) => s.currentIdentity)
  const selection = useIdentityStore((s) => s.mapSelection)
  const setSelection = useIdentityStore((s) => s.setMapSelection)
  const fill = selfModelFillStrength(identity)

  const self = identity?.self_model
  const arc = useMemo(
    () => deriveCareerArc(self?.arc ?? [], identity?.roles ?? []),
    [self?.arc, identity?.roles],
  )
  const philosophy = self?.philosophy ?? []
  const interview = self?.interview_style

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
            <p className="chapter-copy self-empty">Arc derives from roles once they're loaded.</p>
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
