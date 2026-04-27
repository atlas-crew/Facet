import { useIdentityStore } from '../../../store/identityStore'
import { skillsFillStrength } from '../../../utils/identityFillStrength'
import { skillNamesMatch } from '../../../utils/identityEnrichment'
import { IdentityBand } from '../IdentityBand'

const isGenericSkillGroupLabel = (label: string): boolean =>
  /^skills?\s*\d+$/i.test(label.trim()) || label.trim().toLowerCase() === 'also'

export function SkillsBand() {
  const identity = useIdentityStore((s) => s.currentIdentity)
  const selection = useIdentityStore((s) => s.mapSelection)
  const setSelection = useIdentityStore((s) => s.setMapSelection)
  const fill = skillsFillStrength(identity)
  const groups = identity?.skills?.groups ?? []

  const allItems = groups.flatMap((g) => g.items.map((item) => ({ groupId: g.id, item })))
  const isDuplicate = (name: string): boolean =>
    allItems.filter((entry) => skillNamesMatch(entry.item.name, name)).length > 1

  return (
    <IdentityBand layer="skills" name="Skills" subtitle="taxonomy" fill={fill}>
      {groups.length === 0 ? (
        <p className="chapter-copy band-empty">No skill groups yet.</p>
      ) : (
        <div className="skills-shell">
          {groups.map((group) => {
            const isProblematic = isGenericSkillGroupLabel(group.label)
            const isGroupSelected = selection?.type === 'skill-group' && selection.id === group.id
            return (
              <div key={group.id} className={`skill-group${isProblematic ? ' problematic' : ''}`}>
                <div className="skill-group-head">
                  <button
                    type="button"
                    className={`skill-group-label label-tracked${isGroupSelected ? ' selected' : ''}`}
                    onClick={() => setSelection({ type: 'skill-group', id: group.id })}
                    aria-pressed={isGroupSelected}
                  >
                    {group.label}
                  </button>
                  <span className="skill-group-count label-tracked">{group.items.length} items</span>
                </div>
                <div className="skill-chips">
                  {group.items.map((item) => {
                    const untagged = !item.tags || item.tags.length === 0
                    const duplicate = isDuplicate(item.name)
                    const isItemSelected =
                      selection?.type === 'skill-item' &&
                      selection.groupId === group.id &&
                      skillNamesMatch(selection.itemId, item.name)
                    const className = [
                      'skill-chip',
                      'label-tracked',
                      untagged ? 'untagged' : '',
                      duplicate ? 'duplicate' : '',
                      isItemSelected ? 'selected' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')
                    return (
                      <button
                        key={item.name}
                        type="button"
                        className={className}
                        onClick={() => setSelection({ type: 'skill-item', groupId: group.id, itemId: item.name })}
                        aria-pressed={isItemSelected}
                      >
                        {item.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </IdentityBand>
  )
}
