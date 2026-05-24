/* eslint-disable react-refresh/only-export-components */
import type { ReactNode } from 'react'
import type {
  ProfessionalIdentityV3,
  ProfessionalRole,
  ProfessionalRoleBullet,
} from '../../../identity/schema'

/** Tag list serialized as comma-separated for inline edit forms. */
export const tagsToInput = (tags: string[]): string => tags.join(', ')
export const inputToTags = (value: string): string[] =>
  value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)

export function SlotShell({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string
  title: string
  children: ReactNode
}) {
  return (
    <div className="inspector-section">
      <p className="inspector-eyebrow label-tracked">{eyebrow}</p>
      <h3 className="inspector-title chapter-copy">{title}</h3>
      <div className="inspector-body">{children}</div>
    </div>
  )
}

export function MetaRows({ rows }: { rows: Array<[string, string | undefined]> }) {
  return (
    <dl className="inspector-meta">
      {rows.map(([label, value]) => (
        <div key={label} className="inspector-meta-row">
          <dt className="inspector-meta-key label-tracked">{label}</dt>
          <dd className="inspector-meta-val">{value && value.trim() ? value : '—'}</dd>
        </div>
      ))}
    </dl>
  )
}

export function Prompt({ label, text }: { label: string; text: string }) {
  return (
    <div className="inspector-prompt">
      <p className="inspector-prompt-label label-tracked">{label}</p>
      <p className="inspector-prompt-text">{text}</p>
    </div>
  )
}

export function Actions({ children }: { children: ReactNode }) {
  return <div className="inspector-action">{children}</div>
}

export function NotFound({ label }: { label: string }) {
  return (
    <div className="inspector-section">
      <p className="inspector-eyebrow label-tracked">Selection stale</p>
      <p className="inspector-body chapter-copy">
        The {label} you selected is no longer in the model.
      </p>
    </div>
  )
}

export type BulletPairTone = 'problem' | 'action' | 'outcome' | 'impact'

export function BulletPair({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: BulletPairTone
}) {
  const className = tone ? `inspector-bullet-pair tone-${tone}` : 'inspector-bullet-pair'
  return (
    <div className={className}>
      <p className="inspector-bullet-pair-label label-tracked">{label}</p>
      <p className="inspector-bullet-pair-value">{value || '—'}</p>
    </div>
  )
}

export const countBullets = (identity: ProfessionalIdentityV3): number =>
  identity.roles.reduce((acc, role) => acc + role.bullets.length, 0)

export const allBulletsHaveSource = (role: ProfessionalRole): boolean =>
  role.bullets.every((b: ProfessionalRoleBullet) => Boolean(b.source_text?.trim()))

export function citedInProfiles(identity: ProfessionalIdentityV3, tags: string[]): string {
  if (tags.length === 0) return '—'
  const matches = identity.profiles
    .filter((p) => p.tags.some((t) => tags.includes(t)))
    .map((p) => p.id)
  return matches.length > 0 ? matches.join(' · ') : '—'
}
