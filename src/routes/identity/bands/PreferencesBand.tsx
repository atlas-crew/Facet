import { useIdentityStore } from '../../../store/identityStore'
import { preferencesFillStrength } from '../../../utils/identityFillStrength'
import type { PreferenceFieldKey } from '../../../types/identity'
import { IdentityBand } from '../IdentityBand'

export function PreferencesBand() {
  const identity = useIdentityStore((s) => s.currentIdentity)
  const selection = useIdentityStore((s) => s.mapSelection)
  const setSelection = useIdentityStore((s) => s.setMapSelection)
  const fill = preferencesFillStrength(identity)
  const prefs = identity?.preferences

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
      name="Preferences"
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
              return (
                <button
                  key={rule.id}
                  type="button"
                  className={`pref-item${isSelected ? ' selected' : ''}`}
                  onClick={() => setSelection({ type: 'match-rule', kind: 'prioritize', id: rule.id })}
                  aria-pressed={isSelected}
                >
                  <span className="pref-item-label">{rule.label}</span>
                  <span className="pref-item-weight label-tracked">{rule.weight}</span>
                </button>
              )
            })}
          </div>
        )}
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
              return (
                <button
                  key={rule.id}
                  type="button"
                  className={`pref-item avoid${isSelected ? ' selected' : ''}`}
                  onClick={() => setSelection({ type: 'match-rule', kind: 'avoid', id: rule.id })}
                  aria-pressed={isSelected}
                >
                  <span className="pref-item-label">{rule.label}</span>
                  <span className="pref-item-weight label-tracked">{rule.severity}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </IdentityBand>
  )
}
