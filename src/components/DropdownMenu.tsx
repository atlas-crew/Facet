import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'
import { ChevronDown, type LucideIcon } from 'lucide-react'

/* ── Types ─────────────────────────────────────────────── */

interface DropdownMenuProps {
  label: string
  icon: LucideIcon
  iconOnly?: boolean
  children: ReactNode
}

interface ItemProps {
  icon?: LucideIcon
  label: string
  shortcut?: string
  onClick?: () => void
  disabled?: boolean
  checkable?: boolean
  selected?: boolean
}

/* ── Sub-components ────────────────────────────────────── */

function Item({ icon: Icon, label, shortcut, onClick, disabled, checkable = false, selected = false }: ItemProps) {
  return (
    <button
      type="button"
      className={`dropdown-item${checkable && selected ? ' selected' : ''}`}
      onClick={onClick}
      disabled={disabled}
      role={checkable ? 'menuitemcheckbox' : 'menuitem'}
      aria-checked={checkable ? selected : undefined}
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

function DropdownMenuRoot({ label, icon: Icon, iconOnly = false, children }: DropdownMenuProps) {
  const [open, setOpen] = useState(false)
  const [panelStyle, setPanelStyle] = useState<CSSProperties | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerButtonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const triggerId = useId()
  const panelId = useId()

  const close = useCallback(() => setOpen(false), [])
  const getPanelPosition = useCallback((): CSSProperties | null => {
    const trigger = containerRef.current
    if (!trigger) return null
    const rect = trigger.getBoundingClientRect()
    return {
      position: 'fixed',
      top: rect.bottom + 4,
      right: Math.max(8, window.innerWidth - rect.right),
      maxHeight: Math.max(160, window.innerHeight - rect.bottom - 12),
    }
  }, [])

  const toggle = useCallback(() => {
    if (open) {
      close()
      return
    }
    setPanelStyle(getPanelPosition())
    setOpen(true)
  }, [close, getPanelPosition, open])

  const focusMenuItem = useCallback((offset: number | 'first' | 'last') => {
    // Includes menuitemcheckbox/menuitemradio; custom children need a menuitem* role to join roving focus.
    const items = Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not(:disabled)') ?? [],
    )
    if (items.length === 0) return

    if (offset === 'first') {
      items[0]?.focus()
      return
    }

    if (offset === 'last') {
      items[items.length - 1]?.focus()
      return
    }

    const currentIndex = items.findIndex((item) => item === document.activeElement)
    const nextIndex = currentIndex < 0 ? 0 : (currentIndex + offset + items.length) % items.length
    items[nextIndex]?.focus()
  }, [])

  const onPanelKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      focusMenuItem(1)
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      focusMenuItem(-1)
      return
    }
    if (event.key === 'Home') {
      event.preventDefault()
      focusMenuItem('first')
      return
    }
    if (event.key === 'End') {
      event.preventDefault()
      focusMenuItem('last')
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      close()
      triggerButtonRef.current?.focus()
    }
  }, [close, focusMenuItem])

  // Close on click-outside
  useEffect(() => {
    if (!open) return
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (containerRef.current && !containerRef.current.contains(target)) {
        close()
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open, close])

  useEffect(() => {
    if (!open) return
    const onViewportMove = () => close()
    window.addEventListener('resize', onViewportMove)
    window.addEventListener('scroll', onViewportMove)
    return () => {
      window.removeEventListener('resize', onViewportMove)
      window.removeEventListener('scroll', onViewportMove)
    }
  }, [open, close])

  useEffect(() => {
    if (!open) return
    focusMenuItem('first')
  }, [open, focusMenuItem])

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
        id={triggerId}
        ref={triggerButtonRef}
        type="button"
        className={`btn-ghost dropdown-trigger${iconOnly ? ' icon-only' : ''}`}
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={open ? panelId : undefined}
        aria-label={iconOnly ? label : undefined}
        title={iconOnly ? label : undefined}
      >
        <Icon size={16} />
        <span className={iconOnly ? 'sr-only' : 'btn-label'}>{label}</span>
        {!iconOnly && <ChevronDown size={12} className={`dropdown-chevron ${open ? 'open' : ''}`} />}
      </button>
      {open && panelStyle && (
        <div
          id={panelId}
          ref={panelRef}
          className="dropdown-panel"
          role="menu"
          aria-labelledby={triggerId}
          style={panelStyle}
          onKeyDown={onPanelKeyDown}
          onClick={(e) => {
          // Don't auto-close if user interacted with a non-button element (e.g. select)
          const target = e.target as HTMLElement
          if (target.closest('.dropdown-item') || target.closest('.dropdown-divider')) {
            close()
          }
          }}
        >
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
