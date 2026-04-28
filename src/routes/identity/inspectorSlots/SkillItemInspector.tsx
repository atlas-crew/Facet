import { useState } from 'react'
import type { ProfessionalIdentityV3, ProfessionalSkillItem } from '../../../identity/schema'
import { useIdentityStore } from '../../../store/identityStore'
import { skillNamesMatch } from '../../../utils/identityEnrichment'
import {
  Actions,
  MetaRows,
  NotFound,
  Prompt,
  SlotShell,
  inputToTags,
  tagsToInput,
} from './slotPrimitives'

export function SkillItemInspector({
  identity,
  groupId,
  itemName,
  onGoToSkillWizard,
}: {
  identity: ProfessionalIdentityV3
  groupId: string
  itemName: string
  onGoToSkillWizard: () => void
}) {
  const updateGroups = useIdentityStore((s) => s.updateCurrentSkillGroups)
  const group = identity.skills.groups.find((g) => g.id === groupId)
  const item: ProfessionalSkillItem | undefined = group?.items.find((i) => skillNamesMatch(i.name, itemName))
  const [editing, setEditing] = useState(false)
  const [draftTags, setDraftTags] = useState('')

  if (!group || !item) return <NotFound label="skill" />

  const startEditing = () => {
    setDraftTags(tagsToInput(item.tags))
    setEditing(true)
  }

  const handleSave = () => {
    const next = identity.skills.groups.map((g) =>
      g.id !== groupId
        ? g
        : {
            ...g,
            items: g.items.map((i) =>
              skillNamesMatch(i.name, itemName) ? { ...i, tags: inputToTags(draftTags) } : i,
            ),
          },
    )
    updateGroups(next)
    setEditing(false)
  }

  if (editing) {
    return (
      <SlotShell eyebrow={`Skill · ${group.label}`} title={item.name}>
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">Tags (comma-separated)</span>
          <input className="inspector-input" type="text" value={draftTags} onChange={(e) => setDraftTags(e.target.value)} />
        </label>
        <p className="inspector-body-text" style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          Depth, context, and positioning live in the Skill Wizard — open it for the full editor.
        </p>
        <Actions>
          <button type="button" className="inspector-btn primary" onClick={handleSave}>Save tags</button>
          <button type="button" className="inspector-btn" onClick={() => setEditing(false)}>Cancel</button>
        </Actions>
      </SlotShell>
    )
  }

  return (
    <SlotShell eyebrow={`Skill · ${group.label}`} title={item.name}>
      <MetaRows
        rows={[
          ['Depth', item.depth ?? '—'],
          ['Context', item.context?.trim() || '—'],
          ['Positioning', item.positioning?.trim() || '—'],
          ['Tags', item.tags?.join(' · ') || '—'],
        ]}
      />
      {!item.depth ? <Prompt label="Cleanup" text="Open the skill wizard to capture depth, context, and positioning." /> : null}
      <Actions>
        <button type="button" className="inspector-btn primary" onClick={onGoToSkillWizard}>
          Open Skill Wizard
        </button>
        <button type="button" className="inspector-btn" onClick={startEditing}>
          Edit tags
        </button>
      </Actions>
    </SlotShell>
  )
}
