import { useState } from 'react'
import type { ProfessionalIdentityV3 } from '../../../identity/schema'
import { useIdentityStore } from '../../../store/identityStore'
import { Actions, MetaRows, NotFound, SlotShell } from './slotPrimitives'

export function SkillGroupInspector({
  identity,
  groupId,
}: {
  identity: ProfessionalIdentityV3
  groupId: string
}) {
  const updateGroups = useIdentityStore((s) => s.updateCurrentSkillGroups)
  const group = identity.skills.groups.find((g) => g.id === groupId)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ label: '', positioning: '', calibration: '', isDifferentiator: false })

  if (!group) return <NotFound label="skill group" />

  const startEditing = () => {
    setDraft({
      label: group.label,
      positioning: group.positioning ?? '',
      calibration: group.calibration ?? '',
      isDifferentiator: Boolean(group.is_differentiator),
    })
    setEditing(true)
  }

  const handleSave = () => {
    const next = identity.skills.groups.map((g) =>
      g.id === groupId
        ? {
            ...g,
            label: draft.label.trim() || g.label,
            positioning: draft.positioning.trim() || undefined,
            calibration: draft.calibration.trim() || undefined,
            is_differentiator: draft.isDifferentiator || undefined,
          }
        : g,
    )
    updateGroups(next)
    setEditing(false)
  }

  if (editing) {
    return (
      <SlotShell eyebrow={`Skill Group · ${group.id}`} title="Refine the group">
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">Label</span>
          <input className="inspector-input" type="text" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
        </label>
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">Positioning</span>
          <textarea className="inspector-textarea" value={draft.positioning} onChange={(e) => setDraft({ ...draft, positioning: e.target.value })} rows={2} />
        </label>
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">Calibration</span>
          <textarea className="inspector-textarea" value={draft.calibration} onChange={(e) => setDraft({ ...draft, calibration: e.target.value })} rows={2} />
        </label>
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">
            <input type="checkbox" checked={draft.isDifferentiator} onChange={(e) => setDraft({ ...draft, isDifferentiator: e.target.checked })} style={{ marginRight: 8 }} />
            Mark as differentiator
          </span>
        </label>
        <Actions>
          <button type="button" className="inspector-btn primary" onClick={handleSave}>Save</button>
          <button type="button" className="inspector-btn" onClick={() => setEditing(false)}>Cancel</button>
        </Actions>
      </SlotShell>
    )
  }

  return (
    <SlotShell eyebrow="Skill Group" title={group.label}>
      <MetaRows
        rows={[
          ['Items', String(group.items.length)],
          ['Positioning', group.positioning ?? '—'],
          ['Calibration', group.calibration ?? '—'],
          ['Differentiator', group.is_differentiator ? 'Yes' : 'No'],
        ]}
      />
      <Actions>
        <button type="button" className="inspector-btn primary" onClick={startEditing}>Edit group</button>
      </Actions>
    </SlotShell>
  )
}
