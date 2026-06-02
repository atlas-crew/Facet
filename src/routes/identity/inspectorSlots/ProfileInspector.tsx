import { useState } from 'react'
import type { ProfessionalIdentityV3 } from '../../../identity/schema'
import { useIdentityStore } from '../../../store/identityStore'
import {
  Actions,
  MetaRows,
  NotFound,
  SlotShell,
  inputToTags,
  tagsToInput,
} from './slotPrimitives'

export function ProfileInspector({
  identity,
  profileId,
}: {
  identity: ProfessionalIdentityV3
  profileId: string
}) {
  const updateProfiles = useIdentityStore((s) => s.updateCurrentProfiles)
  const profile = identity.profiles.find((p) => p.id === profileId)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ text: '', tags: '' })
  const canSave = draft.text.trim().length > 0

  if (!profile) return <NotFound label="profile" />

  const startEditing = () => {
    setDraft({ text: profile.text, tags: tagsToInput(profile.tags) })
    setEditing(true)
  }

  const handleSave = () => {
    const next = identity.profiles.map((p) =>
      p.id === profile.id
        ? { ...p, text: draft.text.trim(), tags: inputToTags(draft.tags) }
        : p,
    )
    updateProfiles(next)
    setEditing(false)
  }

  if (editing) {
    return (
      <SlotShell eyebrow={`Profile · ${profile.id}`} title="Edit positioning lens">
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">Profile Text</span>
          <textarea
            className="inspector-textarea"
            value={draft.text}
            onChange={(event) => setDraft({ ...draft, text: event.target.value })}
            rows={5}
            placeholder="The identity framing this profile should preserve, in your own words."
          />
        </label>
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">Tags (comma-separated)</span>
          <input
            className="inspector-input"
            type="text"
            value={draft.tags}
            onChange={(event) => setDraft({ ...draft, tags: event.target.value })}
            placeholder="platform, infrastructure, automation"
          />
        </label>
        <Actions>
          <button
            type="button"
            className="inspector-btn primary"
            onClick={handleSave}
            disabled={!canSave}
          >
            Save
          </button>
          <button type="button" className="inspector-btn" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </Actions>
      </SlotShell>
    )
  }

  return (
    <SlotShell eyebrow="Profile · Positioning Lens" title={profile.id}>
      <p className="inspector-body-text">{profile.text}</p>
      <MetaRows rows={[['Tags', profile.tags.join(' · ') || '—']]} />
      <Actions>
        <button type="button" className="inspector-btn primary" onClick={startEditing}>
          Edit profile
        </button>
      </Actions>
    </SlotShell>
  )
}
