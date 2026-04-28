import { useIdentityStore } from '../../../store/identityStore'
import { thesisFillStrength } from '../../../utils/identityFillStrength'
import { IdentityBand } from '../IdentityBand'

export function ThesisBand() {
  const identity = useIdentityStore((s) => s.currentIdentity)
  const selection = useIdentityStore((s) => s.mapSelection)
  const setSelection = useIdentityStore((s) => s.setMapSelection)
  const fill = thesisFillStrength(identity)
  const core = identity?.identity

  const isSelected = selection?.type === 'thesis'
  const text = core?.thesis?.trim() ?? ''
  const origin = core?.origin?.trim() ?? ''
  const elaboration = core?.elaboration?.trim() ?? ''
  const title = core?.title?.trim() ?? ''

  // Only show meta rows for fields that have values. Empty optionals don't
  // render "— not set" — the strength meter already carries that signal at
  // band level, and the inspector slot's prompt carries it at action level.
  // Surfacing it a third time on the card itself is the guilt-meter anti-pattern.
  const filledMeta: Array<{ label: string; value: string }> = []
  if (origin) filledMeta.push({ label: 'Origin', value: origin })
  if (elaboration) filledMeta.push({ label: 'Elaboration', value: elaboration })
  if (title) filledMeta.push({ label: 'Title', value: title })

  return (
    <IdentityBand layer="thesis" name="Thesis" subtitle="what you claim about yourself" fill={fill}>
      <button
        type="button"
        className={`thesis-card${isSelected ? ' selected' : ''}`}
        onClick={() => setSelection({ type: 'thesis' })}
        aria-pressed={isSelected}
      >
        {text ? (
          <p className="thesis-text chapter-copy">{text}</p>
        ) : (
          <p className="thesis-text chapter-copy thesis-empty">No thesis yet — open the import flow to draft one.</p>
        )}
        {filledMeta.length > 0 ? (
          <div className="thesis-meta">
            {filledMeta.map((item) => (
              <span key={item.label} className="thesis-meta-item label-tracked">
                {item.label} <span className="thesis-meta-set">— {item.value}</span>
              </span>
            ))}
          </div>
        ) : null}
      </button>
    </IdentityBand>
  )
}
