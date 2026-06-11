import { useState } from 'react'
import type { ProfessionalIdentityV3 } from '../../../identity/schema'
import { useIdentityStore } from '../../../store/identityStore'
import { Actions, MetaRows, NotFound, SlotShell, allBulletsHaveSource } from './slotPrimitives'

export function RoleInspector({
  identity,
  roleId,
}: {
  identity: ProfessionalIdentityV3
  roleId: string
}) {
  const updateRoles = useIdentityStore((s) => s.updateCurrentRoles)
  const recordCorrection = useIdentityStore((s) => s.recordIdentityCorrection)
  const role = identity.roles.find((r) => r.id === roleId)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ company: '', title: '', dates: '', subtitle: '' })

  if (!role) return <NotFound label="role" />

  const startEditing = () => {
    setDraft({
      company: role.company,
      title: role.title,
      dates: role.dates,
      subtitle: role.subtitle ?? '',
    })
    setEditing(true)
  }

  const handleSave = () => {
    const trimmedSub = draft.subtitle.trim()
    const next = identity.roles.map((r) =>
      r.id === roleId
        ? {
            ...r,
            company: draft.company.trim(),
            title: draft.title.trim(),
            dates: draft.dates.trim(),
            subtitle: trimmedSub ? trimmedSub : null,
          }
        : r,
    )
    updateRoles(next)
    recordCorrection('bullets')
    setEditing(false)
  }

  if (editing) {
    return (
      <SlotShell eyebrow={`Role · ${role.id}`} title="Refine the role">
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">Company</span>
          <input className="inspector-input" type="text" value={draft.company} onChange={(e) => setDraft({ ...draft, company: e.target.value })} />
        </label>
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">Title</span>
          <input className="inspector-input" type="text" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
        </label>
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">Dates</span>
          <input className="inspector-input" type="text" value={draft.dates} onChange={(e) => setDraft({ ...draft, dates: e.target.value })} placeholder="2022 — 2025" />
        </label>
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">Subtitle / Headline metric</span>
          <input className="inspector-input" type="text" value={draft.subtitle} onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })} placeholder="$60K/mo saved" />
        </label>
        <Actions>
          <button type="button" className="inspector-btn primary" onClick={handleSave}>Save</button>
          <button type="button" className="inspector-btn" onClick={() => setEditing(false)}>Cancel</button>
        </Actions>
      </SlotShell>
    )
  }

  return (
    <SlotShell eyebrow={`Role · ${role.dates}`} title={`${role.company} — ${role.title}`}>
      <MetaRows
        rows={[
          ['Bullets', String(role.bullets.length)],
          ['Subtitle', role.subtitle ?? '—'],
          ['Source-text intact', allBulletsHaveSource(role) ? 'Yes' : 'Partial'],
        ]}
      />
      <Actions>
        <button type="button" className="inspector-btn primary" onClick={startEditing}>Edit role</button>
      </Actions>
    </SlotShell>
  )
}
