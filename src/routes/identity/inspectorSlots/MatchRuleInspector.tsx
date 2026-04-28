import { useState } from 'react'
import type { ProfessionalIdentityV3 } from '../../../identity/schema'
import { useIdentityStore } from '../../../store/identityStore'
import { Actions, MetaRows, NotFound, SlotShell } from './slotPrimitives'

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
  const rules = kind === 'prioritize' ? identity.preferences.matching.prioritize : identity.preferences.matching.avoid
  const rule = rules.find((r) => r.id === ruleId)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ label: '', description: '', weightOrSeverity: 'high' as string })

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

  if (editing) {
    const options = kind === 'prioritize' ? ['high', 'medium', 'low'] : ['hard', 'soft', 'conditional']
    return (
      <SlotShell eyebrow={`Matching · ${kind}`} title="Refine the rule">
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
        </Actions>
      </SlotShell>
    )
  }

  return (
    <SlotShell eyebrow={`Matching · ${kind}`} title={rule.label}>
      <p className="inspector-body-text">{rule.description}</p>
      <MetaRows rows={[[kind === 'prioritize' ? 'Weight' : 'Severity', weightOrSeverity]]} />
      <Actions>
        <button type="button" className="inspector-btn primary" onClick={startEditing}>Edit rule</button>
      </Actions>
    </SlotShell>
  )
}
