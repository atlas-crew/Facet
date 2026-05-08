import { useId, useState } from 'react'
import type { ProfessionalIdentityV3 } from '../../../identity/schema'
import { useIdentityStore } from '../../../store/identityStore'
import { Actions, MetaRows, NotFound, SlotShell } from './slotPrimitives'
import { hasRequiredText } from './slotValidation'

// The dispatcher remounts this slot on rule selection change via `key`, so the
// useState initializer reads the correct starting state for the active rule.
// `justAdded` is set on the selection by the parent band when it created this
// rule via "+ Add"; it lets Cancel act as Discard for fresh stubs and is cleared
// from the selection on first Save so subsequent Cancels behave normally.
export function MatchRuleInspector({
  identity,
  kind,
  ruleId,
  justAdded,
}: {
  identity: ProfessionalIdentityV3
  kind: 'prioritize' | 'avoid'
  ruleId: string
  justAdded?: boolean
}) {
  const updateMatching = useIdentityStore((s) => s.updateCurrentMatching)
  const setSelection = useIdentityStore((s) => s.setMapSelection)
  const rules =
    kind === 'prioritize'
      ? identity.preferences.matching.prioritize
      : identity.preferences.matching.avoid
  const rule = rules.find((r) => r.id === ruleId)
  const labelHintId = useId()
  const [editing, setEditing] = useState<boolean>(() => justAdded ?? false)
  const [draft, setDraft] = useState(() =>
    rule
      ? {
          label: rule.label,
          description: rule.description,
          weightOrSeverity: 'weight' in rule ? rule.weight : rule.severity,
        }
      : { label: '', description: '', weightOrSeverity: 'high' as string },
  )

  if (!rule) return <NotFound label="matching rule" />

  const weightOrSeverity = 'weight' in rule ? rule.weight : rule.severity
  const currentDraft = {
    label: rule.label,
    description: rule.description,
    weightOrSeverity,
  }
  // Cancel mirrors the other slots: discard local edits and show the latest persisted value.
  const labelValid = hasRequiredText(draft.label)
  const canSave = labelValid

  const startEditing = () => {
    setDraft(currentDraft)
    setEditing(true)
  }

  const handleSave = () => {
    const matching = identity.preferences.matching
    if (kind === 'prioritize') {
      const next = matching.prioritize.map((r) =>
        r.id === ruleId
          ? {
              ...r,
              label: draft.label.trim(),
              description: draft.description.trim(),
              weight: draft.weightOrSeverity as 'high' | 'medium' | 'low',
            }
          : r,
      )
      updateMatching({ ...matching, prioritize: next })
    } else {
      const next = matching.avoid.map((r) =>
        r.id === ruleId
          ? {
              ...r,
              label: draft.label.trim(),
              description: draft.description.trim(),
              severity: draft.weightOrSeverity as 'hard' | 'soft' | 'conditional',
            }
          : r,
      )
      updateMatching({ ...matching, avoid: next })
    }
    if (justAdded) {
      setSelection({ type: 'match-rule', kind, id: ruleId })
    }
    setEditing(false)
  }

  const handleRemove = () => {
    const matching = identity.preferences.matching
    if (kind === 'prioritize') {
      updateMatching({
        ...matching,
        prioritize: matching.prioritize.filter((r) => r.id !== ruleId),
      })
    } else {
      updateMatching({
        ...matching,
        avoid: matching.avoid.filter((r) => r.id !== ruleId),
      })
    }
    setSelection(null)
  }

  const handleCancel = () => {
    if (justAdded) {
      handleRemove()
    } else {
      setDraft(currentDraft)
      setEditing(false)
    }
  }

  if (editing) {
    const options =
      kind === 'prioritize' ? ['high', 'medium', 'low'] : ['hard', 'soft', 'conditional']
    return (
      <SlotShell eyebrow={`Matching · ${kind}`} title={rule.label.trim() || 'New rule'}>
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">Label</span>
          <input
            className="inspector-input"
            type="text"
            value={draft.label}
            onChange={(e) => setDraft({ ...draft, label: e.target.value })}
            aria-invalid={!labelValid}
            aria-describedby={!labelValid ? labelHintId : undefined}
          />
        </label>
        {!labelValid ? (
          <span id={labelHintId} className="inspector-field-hint">
            Label is required.
          </span>
        ) : null}
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">Description</span>
          <textarea
            className="inspector-textarea"
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            rows={3}
          />
        </label>
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">
            {kind === 'prioritize' ? 'Weight' : 'Severity'}
          </span>
          <select
            className="inspector-input"
            value={draft.weightOrSeverity}
            onChange={(e) => setDraft({ ...draft, weightOrSeverity: e.target.value })}
          >
            {options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
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
          <button type="button" className="inspector-btn" onClick={handleCancel}>
            {justAdded ? 'Discard' : 'Cancel'}
          </button>
          {!justAdded && (
            <button type="button" className="inspector-btn" onClick={handleRemove}>
              Remove rule
            </button>
          )}
        </Actions>
      </SlotShell>
    )
  }

  return (
    <SlotShell eyebrow={`Matching · ${kind}`} title={rule.label.trim() || 'Untitled rule'}>
      <p className="inspector-body-text">
        {rule.description.trim() || <em>No description yet.</em>}
      </p>
      <MetaRows rows={[[kind === 'prioritize' ? 'Weight' : 'Severity', weightOrSeverity]]} />
      <Actions>
        <button type="button" className="inspector-btn primary" onClick={startEditing}>
          Edit rule
        </button>
        <button type="button" className="inspector-btn" onClick={handleRemove}>
          Remove rule
        </button>
      </Actions>
    </SlotShell>
  )
}
