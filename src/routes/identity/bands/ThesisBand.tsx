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
        <div className="thesis-meta">
          <ThesisMetaItem label="Origin" value={origin} />
          <ThesisMetaItem label="Elaboration" value={elaboration} />
          <ThesisMetaItem label="Title" value={title} />
        </div>
      </button>
    </IdentityBand>
  )
}

function ThesisMetaItem({ label, value }: { label: string; value: string }) {
  return (
    <span className="thesis-meta-item label-tracked">
      {label} {value ? <span className="thesis-meta-set">— {value}</span> : <span className="thesis-meta-empty">— not set</span>}
    </span>
  )
}
