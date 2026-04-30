import { useState } from 'react'
import type { ProfessionalIdentityV3 } from '../../../identity/schema'
import { useIdentityStore } from '../../../store/identityStore'
import { Actions, MetaRows, NotFound, SlotShell } from './slotPrimitives'

const isBlankRule = (rule: { label: string; description: string }): boolean =>
  !rule.label.trim() && !rule.description.trim()

// The dispatcher remounts this slot on rule selection change via `key`, so the
// useState initializer reads the correct starting state for the active rule.
export function MatchRuleInspector({
  identity,
  kind,
  ruleId,
}: {
  identity: ProfessionalIdentityV3
  kind: 'prioritize' | 'avoid'
  ruleId: string
}) {
  const updateMatching = useIdentityStore((s) => s.updateCurrentMatching)
  const setSelection = useIdentityStore((s) => s.setMapSelection)
  const rules = kind === 'prioritize' ? identity.preferences.matching.prioritize : identity.preferences.matching.avoid
  const rule = rules.find((r) => r.id === ruleId)
  const [editing, setEditing] = useState<boolean>(() => Boolean(rule && isBlankRule(rule)))
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

  const startEditing = () => {
    setDraft({ label: rule.label, description: rule.description, weightOrSeverity })
    setEditing(true)
  }

  const handleSave = () => {
    const matching = identity.preferences.matching
    if (kind === 'prioritize') {
      const next = matching.prioritize.map((r) =>
        r.id === ruleId
          ? { ...r, label: draft.label.trim(), description: draft.description.trim(), weight: draft.weightOrSeverity as 'high' | 'medium' | 'low' }
          : r,
      )
      updateMatching({ ...matching, prioritize: next })
    } else {
      const next = matching.avoid.map((r) =>
        r.id === ruleId
          ? { ...r, label: draft.label.trim(), description: draft.description.trim(), severity: draft.weightOrSeverity as 'hard' | 'soft' | 'conditional' }
          : r,
      )
      updateMatching({ ...matching, avoid: next })
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

  if (editing) {
    const options = kind === 'prioritize' ? ['high', 'medium', 'low'] : ['hard', 'soft', 'conditional']
    return (
      <SlotShell eyebrow={`Matching · ${kind}`} title={rule.label.trim() || 'New rule'}>
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">Label</span>
          <input className="inspector-input" type="text" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
        </label>
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">Description</span>
          <textarea className="inspector-textarea" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={3} />
        </label>
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">{kind === 'prioritize' ? 'Weight' : 'Severity'}</span>
          <select className="inspector-input" value={draft.weightOrSeverity} onChange={(e) => setDraft({ ...draft, weightOrSeverity: e.target.value })}>
            {options.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </label>
        <Actions>
          <button type="button" className="inspector-btn primary" onClick={handleSave}>Save</button>
          <button type="button" className="inspector-btn" onClick={() => setEditing(false)}>Cancel</button>
          <button type="button" className="inspector-btn" onClick={handleRemove}>Remove rule</button>
        </Actions>
      </SlotShell>
    )
  }

  return (
    <SlotShell eyebrow={`Matching · ${kind}`} title={rule.label.trim() || 'Untitled rule'}>
      <p className="inspector-body-text">{rule.description.trim() || <em>No description yet.</em>}</p>
      <MetaRows rows={[[kind === 'prioritize' ? 'Weight' : 'Severity', weightOrSeverity]]} />
      <Actions>
        <button type="button" className="inspector-btn primary" onClick={startEditing}>Edit rule</button>
        <button type="button" className="inspector-btn" onClick={handleRemove}>Remove rule</button>
      </Actions>
    </SlotShell>
  )
}
