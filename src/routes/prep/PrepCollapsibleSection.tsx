import { useState, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'

interface PrepCollapsibleSectionProps {
  title: string
  subtitle?: string
  countLabel?: string
  children: ReactNode
  actions?: ReactNode
  defaultOpen?: boolean
  open?: boolean
  onToggle?: (nextOpen: boolean) => void
}

export function PrepCollapsibleSection({
  title,
  subtitle,
  countLabel,
  children,
  actions,
  defaultOpen = false,
  open,
  onToggle,
}: PrepCollapsibleSectionProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const isControlled = open !== undefined
  const isOpen = isControlled ? open : internalOpen

  const handleToggle = () => {
    const nextOpen = !isOpen
    if (!isControlled) {
      setInternalOpen(nextOpen)
    }
    onToggle?.(nextOpen)
  }

  return (
    <section className={`prep-section prep-section-collapsible${isOpen ? ' prep-section-collapsible-open' : ''}`}>
      <div className="prep-section-header prep-section-header-collapsible">
        <button className="prep-section-toggle" type="button" onClick={handleToggle} aria-expanded={isOpen} aria-label={title}>
          <ChevronRight
            size={16}
            className={`prep-section-toggle-icon${isOpen ? ' prep-section-toggle-icon-open' : ''}`}
            aria-hidden="true"
          />
          <span className="prep-section-heading">
            <span className="prep-section-title">{title}</span>
            {subtitle ? <span className="prep-section-subtitle">{subtitle}</span> : null}
          </span>
        </button>

        {(countLabel || actions) ? (
          <div className="prep-section-actions">
            {countLabel ? <span className="prep-section-count">{countLabel}</span> : null}
            {actions}
          </div>
        ) : null}
      </div>

      {isOpen ? children : null}
    </section>
  )
}
