import { type FormEvent, useEffect, useId, useRef, useState } from 'react'
import type {
  ProfessionalIdentityV3,
  ProfessionalSkillDepth,
  ProfessionalSkillItem,
} from '../../../identity/schema'
import { useIdentityStore } from '../../../store/identityStore'
import {
  applySkillDepthEdit,
  hasSkillEnrichmentData,
  skillNamesMatch,
  updateIdentityEnrichmentSkill,
} from '../../../utils/identityEnrichment'
import {
  Actions,
  MetaRows,
  NotFound,
  Prompt,
  SlotShell,
  inputToTags,
  tagsToInput,
} from './slotPrimitives'

type EditableSkillDepth = ProfessionalSkillDepth | ''

const DEPTH_OPTIONS: Array<{ value: ProfessionalSkillDepth; label: string }> = [
  { value: 'expert', label: 'Expert' },
  { value: 'strong', label: 'Strong' },
  { value: 'hands-on-working', label: 'Hands-on working' },
  { value: 'architectural', label: 'Architectural' },
  { value: 'conceptual', label: 'Conceptual' },
  { value: 'working', label: 'Working' },
  { value: 'basic', label: 'Basic' },
  { value: 'avoid', label: 'Avoid' },
]

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
  const removeSkill = useIdentityStore((s) => s.removeSkillFromCurrentIdentity)
  const setSelection = useIdentityStore((s) => s.setMapSelection)
  const group = identity.skills.groups.find((g) => g.id === groupId)
  const item: ProfessionalSkillItem | undefined = group?.items.find((i) =>
    skillNamesMatch(i.name, itemName),
  )
  const [editing, setEditing] = useState(false)
  const [removePending, setRemovePending] = useState(false)
  const [draftDepth, setDraftDepth] = useState<EditableSkillDepth>('')
  const [draftTags, setDraftTags] = useState('')
  const confirmCopyId = useId()
  const confirmRowId = useId()
  const removeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    // Navigating to a different skill should reset the destructive-confirm state.
    setRemovePending(false)
  }, [groupId, itemName])

  if (!group || !item) return <NotFound label="skill" />

  const startEditing = () => {
    setRemovePending(false)
    setDraftDepth(item.depth ?? '')
    setDraftTags(tagsToInput(item.tags))
    setEditing(true)
  }

  const handleSave = () => {
    const editedAt = new Date().toISOString()
    const nextIdentity = updateIdentityEnrichmentSkill(identity, groupId, itemName, (skill) => ({
      ...applySkillDepthEdit(skill, draftDepth, editedAt),
      tags: inputToTags(draftTags),
    }))
    updateGroups(nextIdentity.skills.groups)
    setEditing(false)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    handleSave()
  }

  const handleRemove = () => {
    removeSkill(groupId, item.name)
    setSelection({ type: 'skill-group', id: groupId })
  }

  const cancelRemove = () => {
    setRemovePending(false)
    removeButtonRef.current?.focus()
  }

  if (editing) {
    return (
      <SlotShell eyebrow={`Skill · ${group.label}`} title={item.name}>
        <form onSubmit={handleSubmit}>
          <label className="inspector-field">
            <span className="inspector-field-label label-tracked">Depth</span>
            <select
              className="inspector-input"
              value={draftDepth}
              onChange={(e) => setDraftDepth(e.target.value as EditableSkillDepth)}
              autoFocus
            >
              <option value="">Not set</option>
              {DEPTH_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="inspector-field">
            <span className="inspector-field-label label-tracked">Tags (comma-separated)</span>
            <input
              className="inspector-input"
              type="text"
              value={draftTags}
              onChange={(e) => setDraftTags(e.target.value)}
            />
          </label>
          <Actions>
            <button type="submit" className="inspector-btn primary">
              Save skill
            </button>
            <button type="button" className="inspector-btn" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </Actions>
        </form>
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
      {!item.depth ? (
        <Prompt
          label="Cleanup"
          text="Depth is missing. Context and positioning can still be refined in the wizard."
        />
      ) : null}
      <Actions>
        <button type="button" className="inspector-btn primary" onClick={startEditing}>
          Edit skill
        </button>
        <button type="button" className="inspector-btn" onClick={onGoToSkillWizard}>
          Open Skill Wizard
        </button>
        <button
          ref={removeButtonRef}
          type="button"
          className="inspector-btn danger"
          onClick={() => setRemovePending(true)}
          aria-expanded={removePending}
          aria-controls={removePending ? confirmRowId : undefined}
        >
          Remove skill
        </button>
      </Actions>
      {removePending ? (
        <div id={confirmRowId} className="inspector-confirm-row" role="alert">
          <span id={confirmCopyId} className="inspector-confirm-copy">
            Remove {item.name}
            {hasSkillEnrichmentData(item) ? ' and its enrichment data' : ''}?
          </span>
          <button
            type="button"
            className="inspector-btn danger"
            onClick={handleRemove}
            aria-describedby={confirmCopyId}
          >
            Confirm remove
          </button>
          <button type="button" className="inspector-btn" onClick={cancelRemove}>
            Cancel
          </button>
        </div>
      ) : null}
    </SlotShell>
  )
}
