import { useIdentityStore } from '../../../store/identityStore'
import { preferencesFillStrength } from '../../../utils/identityFillStrength'
import type { PreferenceFieldKey } from '../../../types/identity'
import { createId } from '../../../utils/idUtils'
import { IdentityBand } from '../IdentityBand'

const weightTone = (weight: 'high' | 'medium' | 'low'): string => {
  switch (weight) {
    case 'high':
      return 'tone-strong'
    case 'medium':
      return 'tone-muted'
    case 'low':
      return 'tone-muted'
  }
}

const severityTone = (severity: 'hard' | 'soft' | 'conditional'): string => {
  switch (severity) {
    case 'hard':
      return 'tone-error'
    case 'soft':
      return 'tone-warn'
    case 'conditional':
      return 'tone-muted'
  }
}

export function PreferencesBand() {
  const identity = useIdentityStore((s) => s.currentIdentity)
  const selection = useIdentityStore((s) => s.mapSelection)
  const setSelection = useIdentityStore((s) => s.setMapSelection)
  const updateMatching = useIdentityStore((s) => s.updateCurrentMatching)
  const fill = preferencesFillStrength(identity)
  const prefs = identity?.preferences

  const handleAddPrioritize = () => {
    const matching = prefs?.matching ?? { prioritize: [], avoid: [] }
    const id = createId('match-priority')
    updateMatching({
      ...matching,
      prioritize: [
        ...matching.prioritize,
        { id, label: '', description: '', weight: 'medium' },
      ],
    })
    setSelection({ type: 'match-rule', kind: 'prioritize', id })
  }

  const handleAddAvoid = () => {
    const matching = prefs?.matching ?? { prioritize: [], avoid: [] }
    const id = createId('match-avoid')
    updateMatching({
      ...matching,
      avoid: [
        ...matching.avoid,
        { id, label: '', description: '', severity: 'soft' },
      ],
    })
    setSelection({ type: 'match-rule', kind: 'avoid', id })
  }

  const renderCell = (label: string, field: PreferenceFieldKey, value: string | undefined, emptyHint = 'Not set') => {
    const isSelected = selection?.type === 'pref-field' && selection.field === field
    const hasValue = Boolean(value && value.trim())
    return (
      <button
        type="button"
        className={`pref-cell${!hasValue ? ' empty' : ''}${isSelected ? ' selected' : ''}`}
        onClick={() => setSelection({ type: 'pref-field', field })}
        aria-pressed={isSelected}
      >
        <span className="pref-label label-tracked">{label}</span>
        {hasValue ? (
          <span className="pref-value">{value}</span>
        ) : (
          <span className="pref-empty-text chapter-copy">{emptyHint}</span>
        )}
      </button>
    )
  }

  return (
    <IdentityBand
      layer="prefs"
      name="Search Preferences"
      subtitle="matching criteria · constraints · compensation"
      fill={fill}
    >
      <div className="prefs-grid">
        {renderCell('Work Model', 'work_model.preference', prefs?.work_model?.preference, 'No preference set')}
        {renderCell(
          'Compensation',
          'compensation.notes',
          prefs?.compensation?.base_target
            ? `Target $${prefs.compensation.base_target.toLocaleString()}`
            : prefs?.compensation?.notes,
          'No priorities set',
        )}
        {renderCell(
          'Constraints',
          'constraints.title_flexibility',
          prefs?.constraints?.title_flexibility?.length
            ? prefs.constraints.title_flexibility.join(', ')
            : undefined,
          'Nothing recorded',
        )}
      </div>

      <div className="prefs-matching">
        <div className="pref-list-label label-tracked">Matching · Prioritize</div>
        {(prefs?.matching?.prioritize?.length ?? 0) === 0 ? (
          <p className="chapter-copy band-empty">No prioritized criteria yet.</p>
        ) : (
          <div className="pref-list">
            {prefs!.matching.prioritize.map((rule) => {
              const isSelected =
                selection?.type === 'match-rule' && selection.kind === 'prioritize' && selection.id === rule.id
              const ruleLabel = rule.label.trim() || 'Untitled rule'
              return (
                <button
                  key={rule.id}
                  type="button"
                  className={`pref-item prioritize${isSelected ? ' selected' : ''}`}
                  onClick={() => setSelection({ type: 'match-rule', kind: 'prioritize', id: rule.id })}
                  aria-pressed={isSelected}
                >
                  <span className="pref-item-label">{ruleLabel}</span>
                  <span className={`pref-item-weight ${weightTone(rule.weight)}`}>{rule.weight}</span>
                </button>
              )
            })}
          </div>
        )}
        <button
          type="button"
          className="inspector-btn pref-list-add"
          onClick={handleAddPrioritize}
          disabled={!identity}
        >
          + Add prioritize rule
        </button>
      </div>

      <div className="prefs-matching">
        <div className="pref-list-label label-tracked">Matching · Avoid</div>
        {(prefs?.matching?.avoid?.length ?? 0) === 0 ? (
          <p className="chapter-copy band-empty">No avoid criteria yet.</p>
        ) : (
          <div className="pref-list">
            {prefs!.matching.avoid.map((rule) => {
              const isSelected =
                selection?.type === 'match-rule' && selection.kind === 'avoid' && selection.id === rule.id
              const ruleLabel = rule.label.trim() || 'Untitled rule'
              return (
                <button
                  key={rule.id}
                  type="button"
                  className={`pref-item avoid${isSelected ? ' selected' : ''}`}
                  onClick={() => setSelection({ type: 'match-rule', kind: 'avoid', id: rule.id })}
                  aria-pressed={isSelected}
                >
                  <span className="pref-item-label">{ruleLabel}</span>
                  <span className={`pref-item-weight ${severityTone(rule.severity)}`}>{rule.severity}</span>
                </button>
              )
            })}
          </div>
        )}
        <button
          type="button"
          className="inspector-btn pref-list-add"
          onClick={handleAddAvoid}
          disabled={!identity}
        >
          + Add avoid rule
        </button>
      </div>
    </IdentityBand>
  )
}
