import type { HTMLAttributes, ReactNode } from 'react'
import './sectionLabel.css'

export type SectionLabelTone = 'muted' | 'strong' | 'bright'

export interface SectionLabelProps extends HTMLAttributes<HTMLElement> {
  /**
   * Element to render. Element set derived from the real call sites (span/p/div
   * dominate; a few use a heading or a form label). Defaults to span.
   */
  as?: 'span' | 'div' | 'p' | 'label' | 'h2' | 'h3'
  /** Color weight: muted = --text-tertiary (default), strong = --text-secondary, bright = --text-primary. */
  tone?: SectionLabelTone
  /** Only meaningful with as="label" — associates the eyebrow label with a form control. */
  htmlFor?: string
  children: ReactNode
}

// The mono small-caps tracked wayfinding label (FOUNDATION, AI WORKING, …).
// Consolidates `.label-tracked` and the per-workspace `*-eyebrow` forks. The
// canonical `.label-tracked` in index.css omits color, so callers leaned on
// context or forked; this bakes the dominant tertiary tone in with a small axis.
//
// Contextual color (e.g. the identity-Map bands' --band-color) is not a tone —
// pass it through as `style={{ color: 'var(--band-color)' }}`, which overrides
// the tone class via inline-style specificity.
export function SectionLabel({
  as: Tag = 'span',
  tone = 'muted',
  className,
  children,
  ...rest
}: SectionLabelProps) {
  return (
    <Tag className={['facet-eyebrow', `facet-eyebrow--${tone}`, className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </Tag>
  )
}
