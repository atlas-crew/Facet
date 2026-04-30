import { useEffect, useRef, type ReactNode } from 'react'

/**
 * InspectorSheet — slide-in editor for high-content fields on the Identity
 * Map. Companion to `slotPrimitives.tsx`'s inline aside fields:
 *
 *   - Aside fields = compact data (label, weight, comma-tag lists).
 *   - Sheet      = content the user wants to read alongside the entity it
 *                   belongs to (long-form prose, raw paragraphs, ≥80 chars).
 *
 * Reach for the sheet when a field is multi-line, ≥~80 chars typical, or
 * benefits from being editable without losing sight of the entity in the
 * inspector aside. Keep compact fields inline.
 *
 * Behavior contract:
 *   - Stateless on draft. The calling slot owns the draft and the open
 *     boolean; the sheet is a transport.
 *   - Esc fires `onDiscard` if provided, else `onCancel`. (Discard mirrors
 *     the existing inspector edit-mode pattern for `justAdded` entities.)
 *   - Initial focus lands on the first focusable control inside `children`.
 *   - No focus trap: the inspector aside must stay readable so the user
 *     keeps the entity in view while editing.
 *   - Layout: rendered as `position: fixed` between canvas and aside. The
 *     `:has(.inspector-sheet)` rule on `.identity-map` reflows the canvas
 *     inward — no page-level state plumbing required.
 */
export interface InspectorSheetProps {
  open: boolean
  title: string
  eyebrow?: string
  onSave: () => void
  onCancel: () => void
  /**
   * When provided, the secondary button renders as "Discard" and uses this
   * callback. Use for `justAdded` entities that should be removed on cancel.
   */
  onDiscard?: () => void
  children: ReactNode
}

export function InspectorSheet({
  open,
  title,
  eyebrow,
  onSave,
  onCancel,
  onDiscard,
  children,
}: InspectorSheetProps) {
  const ref = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    const node = ref.current
    if (!node) return
    const focusable = node.querySelector<HTMLElement>(
      'input, textarea, select, button, [tabindex]:not([tabindex="-1"])',
    )
    focusable?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      if (onDiscard) onDiscard()
      else onCancel()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onCancel, onDiscard])

  if (!open) return null

  const secondaryLabel = onDiscard ? 'Discard' : 'Cancel'
  const handleSecondary = onDiscard ?? onCancel

  return (
    <section
      ref={ref}
      className="inspector-sheet"
      role="region"
      aria-label={title}
    >
      <header className="inspector-sheet-header">
        {eyebrow ? (
          <p className="inspector-eyebrow label-tracked">{eyebrow}</p>
        ) : null}
        <h3 className="inspector-title chapter-copy">{title}</h3>
      </header>
      <div className="inspector-sheet-body">{children}</div>
      <footer className="inspector-sheet-actions inspector-action">
        <button type="button" className="inspector-btn primary" onClick={onSave}>
          Save
        </button>
        <button type="button" className="inspector-btn" onClick={handleSecondary}>
          {secondaryLabel}
        </button>
      </footer>
    </section>
  )
}
