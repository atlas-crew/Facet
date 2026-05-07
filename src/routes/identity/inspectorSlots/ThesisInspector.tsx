import { useState } from 'react'
import type { ProfessionalIdentityV3 } from '../../../identity/schema'
import { useIdentityStore } from '../../../store/identityStore'
import { Actions, MetaRows, NotFound, SlotShell, countBullets } from './slotPrimitives'

export function ThesisInspector({ identity }: { identity: ProfessionalIdentityV3 }) {
  const updateCore = useIdentityStore((s) => s.updateCurrentIdentityCore)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({
    thesis: identity.identity.thesis ?? '',
    origin: identity.identity.origin ?? '',
    elaboration: identity.identity.elaboration ?? '',
    title: identity.identity.title ?? '',
  })

  const startEditing = () => {
    setDraft({
      thesis: identity.identity.thesis ?? '',
      origin: identity.identity.origin ?? '',
      elaboration: identity.identity.elaboration ?? '',
      title: identity.identity.title ?? '',
    })
    setEditing(true)
  }

  const handleSave = () => {
    const trimmedOrigin = draft.origin.trim()
    const trimmedElaboration = draft.elaboration.trim()
    const trimmedTitle = draft.title.trim()
    updateCore({
      thesis: draft.thesis.trim(),
      origin: trimmedOrigin ? trimmedOrigin : undefined,
      elaboration: trimmedElaboration ? trimmedElaboration : undefined,
      title: trimmedTitle ? trimmedTitle : undefined,
    })
    setEditing(false)
  }

  if (!identity.identity) return <NotFound label="thesis" />

  if (editing) {
    return (
      <SlotShell eyebrow="Thesis · Editing" title="Refine the load-bearing claim">
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">Thesis</span>
          <textarea
            className="inspector-textarea"
            value={draft.thesis}
            onChange={(e) => setDraft({ ...draft, thesis: e.target.value })}
            rows={4}
            placeholder="The single sentence that anchors your identity."
          />
        </label>
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">Origin</span>
          <input className="inspector-input" type="text" value={draft.origin} onChange={(e) => setDraft({ ...draft, origin: e.target.value })} placeholder="How you came to believe this" />
        </label>
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">Elaboration</span>
          <input className="inspector-input" type="text" value={draft.elaboration} onChange={(e) => setDraft({ ...draft, elaboration: e.target.value })} placeholder="The longer-form version" />
        </label>
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">Title</span>
          <input className="inspector-input" type="text" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Optional naming for this thesis" />
        </label>
        <Actions>
          <button type="button" className="inspector-btn primary" onClick={handleSave}>Save</button>
          <button type="button" className="inspector-btn" onClick={() => setEditing(false)}>Cancel</button>
        </Actions>
      </SlotShell>
    )
  }

  return (
    <SlotShell eyebrow="Thesis · Identity" title={identity.identity.thesis || 'No thesis yet'}>
      {identity.identity.elaboration ? <p className="inspector-body-text chapter-copy">{identity.identity.elaboration}</p> : null}
      <MetaRows
        rows={[
          ['Origin', identity.identity.origin],
          ['Title', identity.identity.title],
          ['Cited by', `${identity.profiles.length} profiles · ${countBullets(identity)} bullets`],
        ]}
      />
      {/*
        TASK-194: thesis is prose-only. Origin/elaboration are private
        scaffolding (visible above as MetaRows when set) but don't drive
        strength — and the prior "Origin and elaboration help interview
        prep…" Prompt was a guilt-meter pattern surfacing emptiness as a
        problem. Removed: the strength meter and the editor remain the
        feedback loop.
      */}
      <Actions>
        <button type="button" className="inspector-btn primary" onClick={startEditing}>Edit thesis</button>
      </Actions>
    </SlotShell>
  )
}
