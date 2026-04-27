import { useIdentityStore } from '../../store/identityStore'

/**
 * Sticky 380px right-aside on the Identity Map. Reads `mapSelection` from the
 * identity store and renders a slot for the selected entity. Shows a centered
 * serif-italic empty prompt when nothing is selected.
 *
 * Slot bodies (per discriminant) are added incrementally with the bands —
 * see IdentityMapPage TODO list for which slots are still pending.
 */
export function IdentityInspector() {
  const selection = useIdentityStore((state) => state.mapSelection)

  if (!selection) {
    return (
      <aside className="identity-inspector" aria-label="Identity inspector">
        <p className="identity-inspector-empty chapter-copy">
          Click any element on the map to inspect it. Gaps and assumptions surface here, with prompts to refine the model.
        </p>
      </aside>
    )
  }

  return (
    <aside className="identity-inspector" aria-label="Identity inspector">
      <div className="identity-inspector-pending">
        <p className="label-tracked identity-inspector-eyebrow">{selection.type}</p>
        <p className="chapter-copy identity-inspector-empty">
          Inspector slot for "{selection.type}" is being built. Bands ship slot-by-slot in upcoming commits.
        </p>
      </div>
    </aside>
  )
}
