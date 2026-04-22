import { useId, useState } from 'react'
import { ChevronDown, ChevronRight, ListChecks } from 'lucide-react'

interface PrepRulesPanelProps {
  rules?: string[]
  variant?: 'live' | 'practice' | 'edit'
  title?: string
  subtitle?: string
  collapsible?: boolean
  defaultOpen?: boolean
  className?: string
}

function normalizeRules(rules?: string[]): string[] {
  if (!Array.isArray(rules)) return []
  return rules
    .filter((rule): rule is string => typeof rule === 'string')
    .map((rule) => rule.trim())
    .filter(Boolean)
}

export function PrepRulesPanel({
  rules,
  variant = 'edit',
  title = 'The Rules',
  subtitle,
  collapsible = false,
  defaultOpen = true,
  className,
}: PrepRulesPanelProps) {
  const normalizedRules = normalizeRules(rules)
  const listId = useId()
  const [isOpen, setIsOpen] = useState(defaultOpen)

  if (normalizedRules.length === 0) return null

  const rootClassName = [
    'prep-rules-panel',
    `prep-rules-panel-${variant}`,
    collapsible ? 'prep-rules-panel-collapsible' : '',
    collapsible && isOpen ? 'prep-rules-panel-open' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  const headerCopy = (
    <span className="prep-rules-panel-copy">
      <span className="prep-rules-panel-title-row">
        <span className="prep-rules-panel-icon" aria-hidden="true">
          <ListChecks size={16} />
        </span>
        <span className="prep-rules-panel-title">{title}</span>
        <span className="prep-rules-panel-count">{normalizedRules.length}</span>
      </span>
      {subtitle ? <span className="prep-rules-panel-subtitle">{subtitle}</span> : null}
    </span>
  )

  return (
    <section className={rootClassName} aria-label={title}>
      {collapsible ? (
        <button
          type="button"
          className="prep-rules-panel-toggle"
          onClick={() => setIsOpen((current) => !current)}
          aria-expanded={isOpen}
          aria-controls={listId}
        >
          <span className="prep-rules-panel-chevron" aria-hidden="true">
            {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </span>
          {headerCopy}
        </button>
      ) : (
        <div className="prep-rules-panel-header">{headerCopy}</div>
      )}

      <ul className="prep-rules-list" id={listId} hidden={collapsible && !isOpen}>
        {normalizedRules.map((rule, index) => (
          <li key={`${index}-${rule}`} className="prep-rules-item">
            {rule}
          </li>
        ))}
      </ul>
    </section>
  )
}
