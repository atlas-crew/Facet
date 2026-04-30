import type { ReactNode } from 'react'
import { FillBar, type FillBarProps } from '../../components/FillBar'

export type BandLayer = 'thesis' | 'self' | 'profiles' | 'roles' | 'skills' | 'prefs' | 'search'

export interface IdentityBandProps {
  layer: BandLayer
  name: string
  subtitle?: string
  fill?: FillBarProps
  children: ReactNode
}

/**
 * Shared wrapper for Identity Map bands. Provides:
 * - the colored rail on the left edge (via --band-color CSS custom property)
 * - the head row: name (mono uppercase, color-tinted) + subtitle (serif italic) + fill bar
 * - a content slot that bands fill in with their layout
 */
export function IdentityBand({ layer, name, subtitle, fill, children }: IdentityBandProps) {
  return (
    <section className="identity-band" data-layer={layer}>
      <div className="identity-band-rail" aria-hidden="true" />
      <header className="identity-band-head">
        <div className="identity-band-label">
          <h2 className="label-tracked identity-band-name">{name}</h2>
          {subtitle ? <span className="chapter-copy identity-band-sub">{subtitle}</span> : null}
        </div>
        {fill ? <FillBar {...fill} /> : null}
      </header>
      <div className="identity-band-content">{children}</div>
    </section>
  )
}
