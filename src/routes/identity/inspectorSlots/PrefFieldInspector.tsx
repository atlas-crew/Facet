import { useEffect, useRef, useState } from 'react'
import type { ProfessionalIdentityV3, ProfessionalPreferences } from '../../../identity/schema'
import { useIdentityStore } from '../../../store/identityStore'
import type { PreferenceFieldKey } from '../../../types/identity'
import {
  generateCompensationSuggestionFromIdentity,
  MAX_REASONABLE_BASE_SALARY,
  MIN_REASONABLE_BASE_SALARY,
  type ProfessionalCompensationSuggestion,
} from '../../../utils/identityParametersGeneration'
import {
  ensureIdentityInferenceEndpoint,
  IdentityInferenceConfigError,
} from '../identityInferenceRuntime'
import {
  Actions,
  NotFound,
  SlotShell,
  inputToTags,
  tagsToInput,
} from './slotPrimitives'

type PrefFieldShape = 'text' | 'textarea' | 'number' | 'csv'
type CompensationDraft = {
  baseFloor: string
  baseTarget: string
  notes: string
}
type CompensationSuggestionPhase = 'idle' | 'generating'
type ParsedDraftNumber =
  | { status: 'ok'; value: number | undefined }
  | { status: 'error'; message: string }
const COMPENSATION_FIELDS = [
  'compensation.base_floor',
  'compensation.base_target',
  'compensation.notes',
] as const
type CompensationPreferenceFieldKey = (typeof COMPENSATION_FIELDS)[number]
type NonCompensationPreferenceFieldKey = Exclude<
  PreferenceFieldKey,
  CompensationPreferenceFieldKey
>

const COMPENSATION_SUGGESTION_NOTE_PREFIX = 'Suggested range rationale: '

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

const isCompensationField = (field: PreferenceFieldKey): field is CompensationPreferenceFieldKey =>
  COMPENSATION_FIELDS.includes(field as CompensationPreferenceFieldKey)

const buildCompensationDraft = (
  prefs: ProfessionalPreferences,
  suggestion?: ProfessionalCompensationSuggestion,
): CompensationDraft => ({
  baseFloor: (suggestion?.base_floor ?? prefs.compensation.base_floor)?.toString() ?? '',
  baseTarget: (suggestion?.base_target ?? prefs.compensation.base_target)?.toString() ?? '',
  notes: suggestion
    ? buildCompensationSuggestionNotes(prefs.compensation.notes, suggestion.justification)
    : prefs.compensation.notes ?? '',
})

const buildCompensationSuggestionNotes = (
  currentNotes: string | undefined,
  justification: string,
): string => {
  const userNotes = (currentNotes ?? '')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph && !paragraph.startsWith(COMPENSATION_SUGGESTION_NOTE_PREFIX))
    .join('\n\n')
  return [userNotes, `${COMPENSATION_SUGGESTION_NOTE_PREFIX}${justification}`]
    .filter(Boolean)
    .join('\n\n')
}

// Compensation is currently modeled as US base salary.
const formatMoney = (value: number): string => `$${value.toLocaleString('en-US')}`

const parseDraftNumber = (value: string, label: string): ParsedDraftNumber => {
  const trimmed = value.trim()
  if (!trimmed) return { status: 'ok', value: undefined }
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed)) {
    return { status: 'error', message: `${label} must be a number.` }
  }
  if (parsed <= 0) {
    return { status: 'error', message: `${label} must be greater than 0.` }
  }
  if (parsed < MIN_REASONABLE_BASE_SALARY || parsed > MAX_REASONABLE_BASE_SALARY) {
    return {
      status: 'error',
      message: `${label} must be between ${formatMoney(MIN_REASONABLE_BASE_SALARY)} and ${formatMoney(MAX_REASONABLE_BASE_SALARY)}.`,
    }
  }
  return { status: 'ok', value: parsed }
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
  // Preferences are an input to the 'search' section (lanes/filters), produced by
  // no inference, so a preference edit marks 'search' stale rather than clearing it.
  const markStale = useIdentityStore((s) => s.markInferenceSectionsStale)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [compensationDraft, setCompensationDraft] = useState<CompensationDraft | null>(null)
  const [compensationSuggestion, setCompensationSuggestion] =
    useState<ProfessionalCompensationSuggestion | null>(null)
  const [compensationPhase, setCompensationPhase] =
    useState<CompensationSuggestionPhase>('idle')
  const [compensationError, setCompensationError] = useState<string | null>(null)
  const compensationAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    setCompensationDraft(null)
    setCompensationSuggestion(null)
    setCompensationError(null)
    setCompensationPhase('idle')
    setEditing(false)
    setDraft('')

    return () => {
      compensationAbortRef.current?.abort()
    }
  }, [field])

  const prefs = identity.preferences
  if (!prefs) return <NotFound label="preferences" />
  const shape = PREF_FIELD_SHAPE[field]
  const currentValue = readPrefField(prefs, field)
  const label = formatPrefFieldLabel(field)
  const compensationSelected = isCompensationField(field)

  const startEditing = () => {
    setCompensationError(null)
    setDraft(currentValue)
    setCompensationDraft(
      compensationSelected
        ? buildCompensationDraft(prefs, compensationSuggestion ?? undefined)
        : null,
    )
    setEditing(true)
  }

  const resetCompensationSuggestionState = () => {
    compensationAbortRef.current?.abort()
    compensationAbortRef.current = null
    setCompensationDraft(null)
    setCompensationSuggestion(null)
    setCompensationPhase('idle')
  }

  const cancelEditing = () => {
    setDraft('')
    setCompensationError(null)
    resetCompensationSuggestionState()
    setEditing(false)
  }

  const handleSave = () => {
    if (compensationSelected && compensationDraft) {
      const baseFloor = parseDraftNumber(compensationDraft.baseFloor, 'Base floor')
      if (baseFloor.status === 'error') {
        setCompensationError(baseFloor.message)
        return
      }
      const baseTarget = parseDraftNumber(compensationDraft.baseTarget, 'Base target')
      if (baseTarget.status === 'error') {
        setCompensationError(baseTarget.message)
        return
      }
      if (
        baseFloor.value !== undefined &&
        baseTarget.value !== undefined &&
        baseTarget.value < baseFloor.value
      ) {
        setCompensationError('Base target must be greater than or equal to base floor.')
        return
      }

      updateComp({
        ...prefs.compensation,
        base_floor: baseFloor.value,
        base_target: baseTarget.value,
        notes: compensationDraft.notes.trim() || undefined,
      })
      setCompensationError(null)
      resetCompensationSuggestionState()
      markStale(['search'])
      setEditing(false)
      return
    }

    if (compensationSelected) return

    const trimmed = draft.trim()
    const nonCompensationField = field as NonCompensationPreferenceFieldKey
    switch (nonCompensationField) {
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
        nonCompensationField satisfies never
    }
    markStale(['search'])
    setEditing(false)
  }

  const handleSuggestCompensation = async () => {
    if (compensationPhase === 'generating') return
    compensationAbortRef.current?.abort()
    const abortController = new AbortController()
    compensationAbortRef.current = abortController
    setCompensationPhase('generating')
    setCompensationError(null)
    setCompensationSuggestion(null)
    try {
      const endpoint = ensureIdentityInferenceEndpoint(
        'Connect the AI proxy before suggesting compensation.',
      )
      const suggestion = await generateCompensationSuggestionFromIdentity(identity, endpoint, {
        signal: abortController.signal,
      })
      if (abortController.signal.aborted || compensationAbortRef.current !== abortController) {
        return
      }
      setCompensationSuggestion(suggestion)
      setCompensationPhase('idle')
    } catch (error) {
      const isAbortError =
        (error instanceof DOMException && error.name === 'AbortError') ||
        (error instanceof Error && error.name === 'AbortError')
      if (isAbortError) {
        if (compensationAbortRef.current === abortController) {
          setCompensationPhase('idle')
        }
        return
      }

      const isConfigError = error instanceof IdentityInferenceConfigError
      if (!isConfigError) {
        console.error(error)
      }
      setCompensationError(
        isConfigError && error instanceof Error
          ? error.message
          : "Couldn't suggest compensation right now.",
      )
      setCompensationPhase('idle')
    } finally {
      if (compensationAbortRef.current === abortController) {
        compensationAbortRef.current = null
      }
    }
  }

  const handleUseCompensationSuggestion = () => {
    if (!compensationSuggestion) return
    setCompensationDraft(buildCompensationDraft(prefs, compensationSuggestion))
    setCompensationError(null)
    setDraft('')
    setEditing(true)
    setCompensationSuggestion(null)
    setCompensationPhase('idle')
  }

  if (editing) {
    return (
      <SlotShell eyebrow="Preferences · Field" title={label}>
        {compensationSelected && compensationDraft && compensationError ? (
          <p className="inspector-error-message" role="alert">
            {compensationError}
          </p>
        ) : null}
        {compensationSelected && compensationDraft ? (
          <>
            <label className="inspector-field">
              <span className="inspector-field-label label-tracked">Base floor</span>
              <input
                className="inspector-input"
                type="number"
                min={1}
                step={1000}
                value={compensationDraft.baseFloor}
                onChange={(e) =>
                  setCompensationDraft({ ...compensationDraft, baseFloor: e.target.value })
                }
              />
            </label>
            <label className="inspector-field">
              <span className="inspector-field-label label-tracked">Base target</span>
              <input
                className="inspector-input"
                type="number"
                min={1}
                step={1000}
                value={compensationDraft.baseTarget}
                onChange={(e) =>
                  setCompensationDraft({ ...compensationDraft, baseTarget: e.target.value })
                }
              />
            </label>
            <label className="inspector-field">
              <span className="inspector-field-label label-tracked">Notes</span>
              <textarea
                className="inspector-textarea"
                value={compensationDraft.notes}
                onChange={(e) =>
                  setCompensationDraft({ ...compensationDraft, notes: e.target.value })
                }
                rows={4}
              />
            </label>
          </>
        ) : (
          <label className="inspector-field">
            <span className="inspector-field-label label-tracked">Value</span>
            {shape === 'textarea' ? (
              <textarea
                className="inspector-textarea"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={3}
              />
            ) : shape === 'number' ? (
              <input
                className="inspector-input"
                type="number"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
            ) : (
              <input
                className="inspector-input"
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={shape === 'csv' ? 'comma-separated values' : undefined}
              />
            )}
          </label>
        )}
        <Actions>
          <button type="button" className="inspector-btn primary" onClick={handleSave}>
            Save
          </button>
          <button type="button" className="inspector-btn" onClick={cancelEditing}>
            Cancel
          </button>
        </Actions>
      </SlotShell>
    )
  }

  return (
    <SlotShell eyebrow="Preferences · Field" title={label}>
      <p className="inspector-body-text">{currentValue.trim() || <em>Not set</em>}</p>
      {compensationError ? (
        <p className="inspector-error-message" role="alert">
          {compensationError}
        </p>
      ) : null}
      {compensationSuggestion ? (
        <div className="inspector-evidence" role="status" aria-live="polite">
          <p className="inspector-field-label label-tracked">Suggested compensation</p>
          <ul>
            <li>Floor: {formatMoney(compensationSuggestion.base_floor)}</li>
            <li>Target: {formatMoney(compensationSuggestion.base_target)}</li>
            <li>{compensationSuggestion.justification}</li>
          </ul>
        </div>
      ) : null}
      <Actions>
        <button type="button" className="inspector-btn primary" onClick={startEditing}>
          {compensationSelected ? 'Edit compensation' : 'Edit field'}
        </button>
        {compensationSuggestion ? (
          <button type="button" className="inspector-btn" onClick={handleUseCompensationSuggestion}>
            Use suggestion
          </button>
        ) : null}
        {compensationSelected ? (
          <button
            type="button"
            className="inspector-btn"
            onClick={() => void handleSuggestCompensation()}
            disabled={compensationPhase === 'generating'}
            aria-busy={compensationPhase === 'generating'}
          >
            {compensationPhase === 'generating' ? 'Suggesting...' : 'Suggest range'}
          </button>
        ) : null}
      </Actions>
    </SlotShell>
  )
}
