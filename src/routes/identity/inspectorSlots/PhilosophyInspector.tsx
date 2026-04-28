import { useState } from 'react'
import type { ProfessionalIdentityV3 } from '../../../identity/schema'
import { useIdentityStore } from '../../../store/identityStore'
import {
  Actions,
  MetaRows,
  NotFound,
  SlotShell,
  citedInProfiles,
  inputToTags,
  tagsToInput,
} from './slotPrimitives'

export function PhilosophyInspector({
  identity,
  positionId,
}: {
  identity: ProfessionalIdentityV3
  positionId: string
}) {
  const updatePhilosophy = useIdentityStore((s) => s.updateCurrentPhilosophy)
  const position = identity.self_model.philosophy.find((p) => p.id === positionId)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ text: '', tags: '' })

  if (!position) return <NotFound label="philosophy" />

  const startEditing = () => {
    setDraft({ text: position.text, tags: tagsToInput(position.tags) })
    setEditing(true)
  }

  const handleSave = () => {
    const next = identity.self_model.philosophy.map((p) =>
      p.id === position.id
        ? { ...p, text: draft.text.trim(), tags: inputToTags(draft.tags) }
        : p,
    )
    updatePhilosophy(next)
    setEditing(false)
  }

  if (editing) {
    return (
      <SlotShell eyebrow={`Philosophy · ${position.id}`} title="Refine the position">
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">Text</span>
          <textarea className="inspector-textarea" value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} rows={4} placeholder="The position you hold, in your own voice." />
        </label>
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">Tags (comma-separated)</span>
          <input className="inspector-input" type="text" value={draft.tags} onChange={(e) => setDraft({ ...draft, tags: e.target.value })} placeholder="platform, sustainability, knowledge-transfer" />
        </label>
        <Actions>
          <button type="button" className="inspector-btn primary" onClick={handleSave}>Save</button>
          <button type="button" className="inspector-btn" onClick={() => setEditing(false)}>Cancel</button>
        </Actions>
      </SlotShell>
    )
  }

  return (
    <SlotShell eyebrow="Philosophy · Position" title={position.id}>
      <p className="inspector-body-text chapter-copy">{position.text}</p>
      <MetaRows
        rows={[
          ['Tags', position.tags.join(' · ') || '—'],
          ['Cited in profiles', citedInProfiles(identity, position.tags)],
        ]}
      />
      <Actions>
        <button type="button" className="inspector-btn primary" onClick={startEditing}>Edit position</button>
      </Actions>
    </SlotShell>
  )
}
