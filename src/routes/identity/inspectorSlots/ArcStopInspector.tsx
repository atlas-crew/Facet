import { useState } from 'react'
import type { ProfessionalIdentityV3 } from '../../../identity/schema'
import { useIdentityStore } from '../../../store/identityStore'
import { Actions, MetaRows, NotFound, SlotShell } from './slotPrimitives'

export function ArcStopInspector({
  identity,
  selectionId,
  onSelectRole,
}: {
  identity: ProfessionalIdentityV3
  selectionId: string
  onSelectRole: (company: string) => void
}) {
  const updateArc = useIdentityStore((s) => s.updateCurrentSelfModelArc)
  const arc = identity.self_model.arc
  const arcIndex = arc.findIndex((entry, i) => `${entry.company}:${i}` === selectionId)
  const arcEntry = arcIndex >= 0 ? arc[arcIndex] : null
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  if (!arcEntry) return <NotFound label="arc entry" />

  const role = identity.roles.find((r) => r.company === arcEntry.company)
  const arcCompany = arcEntry.company

  const startEditing = () => {
    setDraft(arcEntry.chapter)
    setEditing(true)
  }

  const handleSave = () => {
    const next = arc.map((entry, i) => (i === arcIndex ? { ...entry, chapter: draft.trim() } : entry))
    updateArc(next)
    setEditing(false)
  }

  if (editing) {
    return (
      <SlotShell eyebrow={`Career Arc · ${arcCompany}`} title="Refine the chapter">
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">Chapter</span>
          <textarea className="inspector-textarea" value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} placeholder="What this chapter of your career meant — the narrative interpretation, not the role title." />
        </label>
        <Actions>
          <button type="button" className="inspector-btn primary" onClick={handleSave}>Save</button>
          <button type="button" className="inspector-btn" onClick={() => setEditing(false)}>Cancel</button>
        </Actions>
      </SlotShell>
    )
  }

  return (
    <SlotShell eyebrow="Career Arc · Chapter" title={`${arcCompany} — ${arcEntry.chapter}`}>
      {role ? (
        <MetaRows
          rows={[
            ['Years', role.dates],
            ['Role', role.title],
            ['Bullets', String(role.bullets.length)],
            ['Headline metric', role.subtitle ?? '—'],
          ]}
        />
      ) : null}
      <Actions>
        <button
          type="button"
          className="inspector-btn primary"
          onClick={() => onSelectRole(arcCompany)}
          disabled={!role}
          title={role ? undefined : 'No matching role for this arc entry'}
        >
          View bullets
        </button>
        <button type="button" className="inspector-btn" onClick={startEditing}>
          Edit chapter
        </button>
      </Actions>
    </SlotShell>
  )
}
