import { type FormEvent, useId, useState } from 'react'
import type { ProfessionalIdentityV3 } from '../../../identity/schema'
import {
  SOFTWARE_ENGINEERING_SKILL_CAREER_CLASS,
  SOFTWARE_ENGINEERING_SKILL_CATEGORIES,
} from '../../../identity/schema'
import { useIdentityStore } from '../../../store/identityStore'
import {
  type EditableSkillProvenance,
  getSkillCategoryLabel,
  resolveCorrectedSkillProvenance,
} from '../../../utils/skillTaxonomy'
import { Actions, MetaRows, NotFound, SlotShell } from './slotPrimitives'

export function SkillGroupInspector({
  identity,
  groupId,
}: {
  identity: ProfessionalIdentityV3
  groupId: string
}) {
  const updateGroups = useIdentityStore((s) => s.updateCurrentSkillGroups)
  const recordCorrection = useIdentityStore((s) => s.recordIdentityCorrection)
  const group = identity.skills.groups.find((g) => g.id === groupId)
  const careerClassOptionsId = useId()
  const categoryOptionsId = useId()
  const statusHintId = useId()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({
    label: '',
    positioning: '',
    calibration: '',
    isDifferentiator: false,
    sourceLabel: '',
    careerClass: '',
    category: '',
    provenance: '' as EditableSkillProvenance,
    needsReview: false,
  })

  if (!group) return <NotFound label="skill group" />

  const startEditing = () => {
    setDraft({
      label: group.label,
      positioning: group.positioning ?? '',
      calibration: group.calibration ?? '',
      isDifferentiator: Boolean(group.is_differentiator),
      sourceLabel: group.source_label ?? '',
      careerClass: group.career_class ?? '',
      category: group.category ?? '',
      provenance: group.provenance ?? '',
      needsReview: Boolean(group.needs_review),
    })
    setEditing(true)
  }

  const handleSave = () => {
    const nextLabel = draft.label.trim()
    if (!nextLabel) {
      return
    }

    const next = identity.skills.groups.map((g) => {
      if (g.id !== groupId) return g

      const nextSourceLabel = draft.sourceLabel.trim()
      const nextCareerClass = draft.careerClass.trim()
      const nextCategory = draft.category.trim()
      const taxonomyDetailChanged =
        nextSourceLabel !== (g.source_label ?? '') ||
        nextCareerClass !== (g.career_class ?? '') ||
        nextCategory !== (g.category ?? '')
      const nextProvenance = resolveCorrectedSkillProvenance({
        draftProvenance: draft.provenance,
        currentProvenance: g.provenance,
        taxonomyDetailChanged,
      })

      return {
        ...g,
        label: nextLabel,
        source_label: nextSourceLabel || undefined,
        career_class: nextCareerClass || undefined,
        category: nextCategory || undefined,
        provenance: nextProvenance,
        needs_review: draft.needsReview || undefined,
        positioning: draft.positioning.trim() || undefined,
        calibration: draft.calibration.trim() || undefined,
        is_differentiator: draft.isDifferentiator || undefined,
      }
    })
    updateGroups(next)
    recordCorrection('skills')
    setEditing(false)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    handleSave()
  }

  if (editing) {
    return (
      <SlotShell eyebrow="Skill Group" title="Edit group details">
        <form
          onSubmit={handleSubmit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation()
              setEditing(false)
            }
          }}
        >
          <label className="inspector-field">
            <span className="inspector-field-label label-tracked">Group name</span>
            <input
              className="inspector-input"
              type="text"
              value={draft.label}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              autoFocus
            />
          </label>
          <label className="inspector-field">
            <span className="inspector-field-label label-tracked">Positioning</span>
            <textarea
              className="inspector-textarea"
              value={draft.positioning}
              onChange={(e) => setDraft({ ...draft, positioning: e.target.value })}
              rows={2}
            />
          </label>
          <label className="inspector-field">
            <span className="inspector-field-label label-tracked">Calibration</span>
            <textarea
              className="inspector-textarea"
              value={draft.calibration}
              onChange={(e) => setDraft({ ...draft, calibration: e.target.value })}
              rows={2}
            />
          </label>
          <label className="inspector-field">
            <span className="inspector-field-label label-tracked">Original group label</span>
            <input
              className="inspector-input"
              type="text"
              value={draft.sourceLabel}
              onChange={(e) => setDraft({ ...draft, sourceLabel: e.target.value })}
            />
          </label>
          <label className="inspector-field">
            <span className="inspector-field-label label-tracked">Career class</span>
            <input
              className="inspector-input"
              type="text"
              list={careerClassOptionsId}
              value={draft.careerClass}
              onChange={(e) => setDraft({ ...draft, careerClass: e.target.value })}
            />
          </label>
          <datalist id={careerClassOptionsId}>
            <option value={SOFTWARE_ENGINEERING_SKILL_CAREER_CLASS} />
          </datalist>
          <label className="inspector-field">
            <span className="inspector-field-label label-tracked">Category</span>
            <input
              className="inspector-input"
              type="text"
              list={categoryOptionsId}
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
            />
          </label>
          <datalist id={categoryOptionsId}>
            {SOFTWARE_ENGINEERING_SKILL_CATEGORIES.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </datalist>
          <label className="inspector-field">
            <span className="inspector-field-label label-tracked">Group status</span>
            <select
              className="inspector-input"
              value={draft.provenance}
              aria-describedby={statusHintId}
              onChange={(e) =>
                setDraft({ ...draft, provenance: e.target.value as EditableSkillProvenance })
              }
            >
              <option value="">Not set</option>
              <option value="claimed">Claimed</option>
              <option value="inferred">Inferred</option>
              <option value="corrected">Corrected</option>
            </select>
            <p id={statusHintId} className="inspector-field-hint info">
              Editing the original label, career class, or category without changing this status
              saves it as Corrected.
            </p>
          </label>
          <label className="inspector-field">
            <span className="inspector-field-label label-tracked">
              <input
                type="checkbox"
                checked={draft.isDifferentiator}
                onChange={(e) => setDraft({ ...draft, isDifferentiator: e.target.checked })}
                style={{ marginRight: 8 }}
              />
              Mark as differentiator
            </span>
          </label>
          <label className="inspector-field">
            <span className="inspector-field-label label-tracked">
              <input
                type="checkbox"
                checked={draft.needsReview}
                onChange={(e) => setDraft({ ...draft, needsReview: e.target.checked })}
                style={{ marginRight: 8 }}
              />
              Needs review
            </span>
          </label>
          <Actions>
            <button type="submit" className="inspector-btn primary" disabled={!draft.label.trim()}>
              Save group
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
    <SlotShell eyebrow="Skill Group" title={group.label}>
      <MetaRows
        rows={[
          ['Items', String(group.items.length)],
          ['Positioning', group.positioning ?? '—'],
          ['Calibration', group.calibration ?? '—'],
          ['Differentiator', group.is_differentiator ? 'Yes' : 'No'],
          ['Original group label', group.source_label ?? '—'],
          ['Career class', group.career_class ?? '—'],
          ['Category', getSkillCategoryLabel(group.category) ?? '—'],
          ['Group status', group.provenance ?? '—'],
          ['Review', group.needs_review ? 'Needs review' : '—'],
        ]}
      />
      <Actions>
        <button type="button" className="inspector-btn primary" onClick={startEditing}>
          Edit group details
        </button>
      </Actions>
    </SlotShell>
  )
}
