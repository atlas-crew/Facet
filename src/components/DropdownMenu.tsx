import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronDown, type LucideIcon } from 'lucide-react'

/* ── Types ─────────────────────────────────────────────── */

interface DropdownMenuProps {
  label: string
  icon: LucideIcon
  children: ReactNode
}

interface ItemProps {
  icon?: LucideIcon
  label: string
  shortcut?: string
  onClick?: () => void
  disabled?: boolean
}

/* ── Sub-components ────────────────────────────────────── */

function Item({ icon: Icon, label, shortcut, onClick, disabled }: ItemProps) {
  return (
    <button
      type="button"
      className="dropdown-item"
      onClick={onClick}
      disabled={disabled}
      role="menuitem"
    >
      {Icon && <Icon size={14} className="dropdown-item-icon" />}
      <span className="dropdown-item-label">{label}</span>
      {shortcut && <span className="dropdown-item-shortcut">{shortcut}</span>}
    </button>
  )
}

function Divider() {
  return <div className="dropdown-divider" role="separator" />
}

/* ── Root component ────────────────────────────────────── */

function DropdownMenuRoot({ label, icon: Icon, children }: DropdownMenuProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const close = useCallback(() => setOpen(false), [])

  // Close on click-outside
  useEffect(() => {
    if (!open) return
    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close()
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open, close])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, close])

  return (
    <div className="dropdown-menu" ref={containerRef}>
      <button
        type="button"
        className="btn-ghost dropdown-trigger"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Icon size={16} />
        <span className="btn-label">{label}</span>
        <ChevronDown size={12} className={`dropdown-chevron ${open ? 'open' : ''}`} />
      </button>
      {open && (
        <div className="dropdown-panel" role="menu" onClick={(e) => {
          // Don't auto-close if user interacted with a non-button element (e.g. select)
          const target = e.target as HTMLElement
          if (target.closest('.dropdown-item') || target.closest('.dropdown-divider')) {
            close()
          }
        }}>
          {children}
        </div>
      )}
    </div>
  )
}

/* ── Attach sub-components ─────────────────────────────── */

export const DropdownMenu = Object.assign(DropdownMenuRoot, {
  Item,
  Divider,
})
