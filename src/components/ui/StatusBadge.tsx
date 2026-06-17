import type { HTMLAttributes, ReactNode } from 'react'
import './statusBadge.css'

export type StatusTone = 'success' | 'warning' | 'error' | 'info' | 'neutral'

export interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** Semantic state — drives text color, tinted background, and border. Required: a badge with no state is just text. */
  tone: StatusTone
  children: ReactNode
}

// Inline state indicator (READY, AI WORKING, STALE, …). Consolidates the
// status subset of the per-workspace badge classes. Category badges (vector,
// --layer-*) and the no-background priority badges are intentionally separate.
export function StatusBadge({ tone, className, children, ...rest }: StatusBadgeProps) {
  return (
    <span className={['facet-badge', `facet-badge--${tone}`, className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </span>
  )
}
