import { useState } from 'react'
import type { ProfessionalIdentityV3, ProfessionalPreferences } from '../../../identity/schema'
import { useIdentityStore } from '../../../store/identityStore'
import type { PreferenceFieldKey } from '../../../types/identity'
import {
  Actions,
  NotFound,
  SlotShell,
  inputToTags,
  tagsToInput,
} from './slotPrimitives'

type PrefFieldShape = 'text' | 'textarea' | 'number' | 'csv'

const PREF_FIELD_SHAPE: Record<PreferenceFieldKey, PrefFieldShape> = {
  'compensation.base_floor': 'number',
  'compensation.base_target': 'number',
  'compensation.notes': 'textarea',
  'work_model.preference': 'text',
  'work_model.flexibility': 'text',
  'work_model.hard_no': 'text',
  'constraints.clearance': 'text',
  'constraints.education': 'text',
  'constraints.title_flexibility': 'csv',
  'interview_process.accepted_formats': 'csv',
  'interview_process.strong_fit_signals': 'csv',
  'interview_process.red_flags': 'csv',
  'interview_process.max_rounds': 'number',
  'interview_process.onsite_preferences': 'textarea',
}

const formatPrefFieldLabel = (field: PreferenceFieldKey): string => {
  const [section, subField] = field.split('.')
  const cap = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  return `${cap(section)} · ${cap(subField)}`
}

function readPrefField(prefs: ProfessionalPreferences, field: PreferenceFieldKey): string {
  switch (field) {
    case 'compensation.base_floor':
      return prefs.compensation.base_floor?.toString() ?? ''
    case 'compensation.base_target':
      return prefs.compensation.base_target?.toString() ?? ''
    case 'compensation.notes':
      return prefs.compensation.notes ?? ''
    case 'work_model.preference':
      return prefs.work_model.preference ?? ''
    case 'work_model.flexibility':
      return prefs.work_model.flexibility ?? ''
    case 'work_model.hard_no':
      return prefs.work_model.hard_no ?? ''
    case 'constraints.clearance':
      return prefs.constraints?.clearance?.status ?? ''
    case 'constraints.education':
      return prefs.constraints?.education?.highest ?? ''
    case 'constraints.title_flexibility':
      return tagsToInput(prefs.constraints?.title_flexibility ?? [])
    case 'interview_process.accepted_formats':
      return tagsToInput(prefs.interview_process?.accepted_formats ?? [])
    case 'interview_process.strong_fit_signals':
      return tagsToInput(prefs.interview_process?.strong_fit_signals ?? [])
    case 'interview_process.red_flags':
      return tagsToInput(prefs.interview_process?.red_flags ?? [])
    case 'interview_process.max_rounds':
      return prefs.interview_process?.max_rounds?.toString() ?? ''
    case 'interview_process.onsite_preferences':
      return prefs.interview_process?.onsite_preferences ?? ''
    default: {
      field satisfies never
      return ''
    }
  }
}

export function PrefFieldInspector({
  identity,
  field,
}: {
  identity: ProfessionalIdentityV3
  field: PreferenceFieldKey
}) {
  const updateComp = useIdentityStore((s) => s.updateCurrentCompensation)
  const updateWork = useIdentityStore((s) => s.updateCurrentWorkModel)
  const updateConstraints = useIdentityStore((s) => s.updateCurrentConstraints)
  const updateInterview = useIdentityStore((s) => s.updateCurrentInterviewProcess)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const prefs = identity.preferences
  if (!prefs) return <NotFound label="preferences" />
  const shape = PREF_FIELD_SHAPE[field]
  const currentValue = readPrefField(prefs, field)
  const label = formatPrefFieldLabel(field)

  const startEditing = () => {
    setDraft(currentValue)
    setEditing(true)
  }

  const handleSave = () => {
    const trimmed = draft.trim()
    switch (field) {
      case 'compensation.base_floor':
        updateComp({ ...prefs.compensation, base_floor: trimmed ? Number(trimmed) : undefined })
        break
      case 'compensation.base_target':
        updateComp({ ...prefs.compensation, base_target: trimmed ? Number(trimmed) : undefined })
        break
      case 'compensation.notes':
        updateComp({ ...prefs.compensation, notes: trimmed || undefined })
        break
      case 'work_model.preference':
        updateWork({ ...prefs.work_model, preference: trimmed })
        break
      case 'work_model.flexibility':
        updateWork({ ...prefs.work_model, flexibility: trimmed || undefined })
        break
      case 'work_model.hard_no':
        updateWork({ ...prefs.work_model, hard_no: trimmed || undefined })
        break
      case 'constraints.clearance': {
        const next = trimmed
          ? { ...(prefs.constraints ?? {}), clearance: { ...(prefs.constraints?.clearance ?? {}), status: trimmed } }
          : { ...(prefs.constraints ?? {}), clearance: undefined }
        updateConstraints(next)
        break
      }
      case 'constraints.education': {
        const next = trimmed
          ? { ...(prefs.constraints ?? {}), education: { ...(prefs.constraints?.education ?? {}), highest: trimmed } }
          : { ...(prefs.constraints ?? {}), education: undefined }
        updateConstraints(next)
        break
      }
      case 'constraints.title_flexibility': {
        const list = inputToTags(draft)
        updateConstraints({ ...(prefs.constraints ?? {}), title_flexibility: list.length ? list : undefined })
        break
      }
      case 'interview_process.accepted_formats':
        updateInterview({
          ...(prefs.interview_process ?? { accepted_formats: [], strong_fit_signals: [], red_flags: [] }),
          accepted_formats: inputToTags(draft),
        })
        break
      case 'interview_process.strong_fit_signals':
        updateInterview({
          ...(prefs.interview_process ?? { accepted_formats: [], strong_fit_signals: [], red_flags: [] }),
          strong_fit_signals: inputToTags(draft),
        })
        break
      case 'interview_process.red_flags':
        updateInterview({
          ...(prefs.interview_process ?? { accepted_formats: [], strong_fit_signals: [], red_flags: [] }),
          red_flags: inputToTags(draft),
        })
        break
      case 'interview_process.max_rounds':
        updateInterview({
          ...(prefs.interview_process ?? { accepted_formats: [], strong_fit_signals: [], red_flags: [] }),
          max_rounds: trimmed ? Number(trimmed) : undefined,
        })
        break
      case 'interview_process.onsite_preferences':
        updateInterview({
          ...(prefs.interview_process ?? { accepted_formats: [], strong_fit_signals: [], red_flags: [] }),
          onsite_preferences: trimmed || undefined,
        })
        break
      default:
        field satisfies never
    }
    setEditing(false)
  }

  if (editing) {
    return (
      <SlotShell eyebrow="Preferences · Field" title={label}>
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">Value</span>
          {shape === 'textarea' ? (
            <textarea className="inspector-textarea" value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} />
          ) : shape === 'number' ? (
            <input className="inspector-input" type="number" value={draft} onChange={(e) => setDraft(e.target.value)} />
          ) : (
            <input className="inspector-input" type="text" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={shape === 'csv' ? 'comma-separated values' : undefined} />
          )}
        </label>
        <Actions>
          <button type="button" className="inspector-btn primary" onClick={handleSave}>Save</button>
          <button type="button" className="inspector-btn" onClick={() => setEditing(false)}>Cancel</button>
        </Actions>
      </SlotShell>
    )
  }

  return (
    <SlotShell eyebrow="Preferences · Field" title={label}>
      <p className="inspector-body-text">{currentValue.trim() || <em>Not set</em>}</p>
      <Actions>
        <button type="button" className="inspector-btn primary" onClick={startEditing}>Edit field</button>
      </Actions>
    </SlotShell>
  )
}
