import type { ReactNode } from 'react'
import { FillBar } from '../../components/FillBar'
import {
  describeIdentityFillStrength,
  type FillStrength,
} from '../../utils/identityFillStrength'

export type BandLayer = 'thesis' | 'self' | 'profiles' | 'roles' | 'skills' | 'prefs' | 'search'

export interface IdentityBandProps {
  layer: BandLayer
  name: string
  subtitle?: string
  fill?: FillStrength
  children: ReactNode
}

/**
 * Shared wrapper for Identity Map bands. Provides:
 * - the colored rail on the left edge (via --band-color CSS custom property)
 * - the head row: name (mono uppercase, color-tinted) + subtitle (serif italic) + fill bar
 * - a content slot that bands fill in with their layout
 */
export function IdentityBand({ layer, name, subtitle, fill, children }: IdentityBandProps) {
  const fillHelp = fill
    ? {
        ...fill,
        helpText: describeIdentityFillStrength(layer, fill),
        helpLabel: `${name} fill strength help`,
      }
    : null

  return (
    <section className="identity-band" data-layer={layer}>
      <div className="identity-band-rail" aria-hidden="true" />
      <header className="identity-band-head">
        <div className="identity-band-label">
          <h2 className="label-tracked identity-band-name">{name}</h2>
          {subtitle ? <span className="chapter-copy identity-band-sub">{subtitle}</span> : null}
        </div>
        {fillHelp ? <FillBar {...fillHelp} /> : null}
      </header>
      <div className="identity-band-content">{children}</div>
    </section>
  )
}
