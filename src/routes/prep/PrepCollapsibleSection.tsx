import { useState, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'

export type PrepSectionTone =
  | 'success'
  | 'warning'
  | 'critical'
  | 'accent-primary'
  | 'accent-violet'
  | 'accent-cyan'
  | 'accent-orange'
  | 'neutral'

interface PrepCollapsibleSectionProps {
  title: string
  subtitle?: string
  countLabel?: string
  /**
   * Short preview of section content shown next to the title when collapsed.
   * Should be a single line; the component truncates with ellipsis.
   */
  preview?: string
  /**
   * Semantic tone color used for the 3px left border, micro-mono title,
   * count badge, and chevron. Maps to `--success`, `--warning`, etc. via
   * `.prep-section-tone-${tone}` selector.
   */
  tone?: PrepSectionTone
  children: ReactNode
  actions?: ReactNode
  defaultOpen?: boolean
  open?: boolean
  onToggle?: (nextOpen: boolean) => void
  /**
   * When true and content is empty, the tone color and preview render
   * dimmed so empty sections recede visually but remain discoverable.
   */
  isEmpty?: boolean
}

export function PrepCollapsibleSection({
  title,
  subtitle,
  countLabel,
  preview,
  tone = 'neutral',
  children,
  actions,
  defaultOpen = false,
  open,
  onToggle,
  isEmpty = false,
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

  const sectionClasses = [
    'prep-section',
    'prep-section-collapsible',
    `prep-section-tone-${tone}`,
    isOpen ? 'prep-section-collapsible-open' : '',
    isEmpty ? 'prep-section-empty-state' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <section className={sectionClasses}>
      <div className="prep-section-header prep-section-header-collapsible">
        <button
          className="prep-section-toggle"
          type="button"
          onClick={handleToggle}
          aria-expanded={isOpen}
          aria-label={title}
        >
          <ChevronRight
            size={14}
            className={`prep-section-toggle-icon${isOpen ? ' prep-section-toggle-icon-open' : ''}`}
            aria-hidden="true"
          />
          <span className="prep-section-heading">
            <span className="prep-section-title">{title}</span>
            {!isOpen && preview ? (
              <span className="prep-section-preview" title={preview}>{preview}</span>
            ) : null}
            {!isOpen && subtitle && !preview ? (
              <span className="prep-section-subtitle">{subtitle}</span>
            ) : null}
          </span>
        </button>

        {(countLabel || actions) ? (
          <div className="prep-section-actions">
            {countLabel ? <span className="prep-section-count">{countLabel}</span> : null}
            {actions}
          </div>
        ) : null}
      </div>

      {isOpen ? (
        <>
          {subtitle && preview ? (
            <p className="prep-section-subtitle prep-section-subtitle-open">{subtitle}</p>
          ) : null}
          {children}
        </>
      ) : null}
    </section>
  )
}
