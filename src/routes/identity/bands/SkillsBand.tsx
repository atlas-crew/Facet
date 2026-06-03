import { useMemo } from 'react'
import { useIdentityStore } from '../../../store/identityStore'
import { skillsFillStrength } from '../../../utils/identityFillStrength'
import {
  displaySkillGroupLabel,
  getIdentityEnrichmentProgress,
  isGenericSkillGroupLabel,
  resolveIdentityMapSkillDraftSelection,
  skillNamesMatch,
} from '../../../utils/identityEnrichment'
import { IdentityBand } from '../IdentityBand'

export function SkillsBand() {
  const identity = useIdentityStore((s) => s.currentIdentity)
  const selection = useIdentityStore((s) => s.mapSelection)
  const setSelection = useIdentityStore((s) => s.setMapSelection)
  const fill = skillsFillStrength(identity)
  const groups = identity?.skills?.groups ?? []
  const enrichmentProgress = useMemo(
    () => (identity ? getIdentityEnrichmentProgress(identity) : null),
    [identity],
  )

  const allItems = groups.flatMap((g) => g.items.map((item) => ({ groupId: g.id, item })))
  const isDuplicate = (name: string): boolean =>
    allItems.filter((entry) => skillNamesMatch(entry.item.name, name)).length > 1
  const handleOpenSkillEnrichment = () => {
    if (!identity) return
    const target = resolveIdentityMapSkillDraftSelection(identity)
    if (!target) return
    setSelection(target)
  }

  return (
    <IdentityBand layer="skills" name="Skills" subtitle="taxonomy" fill={fill}>
      {groups.length === 0 ? (
        <p className="chapter-copy band-empty">No skill groups yet.</p>
      ) : (
        <div className="skills-shell">
          {enrichmentProgress && enrichmentProgress.total > 0 ? (
            <section
              className="skills-enrichment-panel"
              aria-labelledby="skills-enrichment-title"
            >
              <div>
                <h3
                  id="skills-enrichment-title"
                  className="label-tracked skills-enrichment-eyebrow"
                >
                  Skill depth
                </h3>
                <p className="chapter-copy skills-enrichment-copy">
                  Deepen skills here so downstream work knows what to lean on, shave down, or avoid.
                </p>
              </div>
              <div className="skills-enrichment-meta">
                <span className="label-tracked">
                  <strong>{enrichmentProgress.pending}</strong> pending
                </span>
                <span className="label-tracked">
                  <strong>{enrichmentProgress.complete}</strong> complete
                </span>
                <span className="label-tracked">
                  <strong>{enrichmentProgress.skipped}</strong> skipped
                </span>
              </div>
              <button
                type="button"
                className="inspector-btn primary skills-enrichment-action"
                onClick={handleOpenSkillEnrichment}
              >
                {enrichmentProgress.pending > 0 ? 'Deepen skills' : 'Review skill depth'}
              </button>
            </section>
          ) : null}
          {groups.map((group) => {
            const isProblematic = isGenericSkillGroupLabel(group.label)
            const displayLabel = displaySkillGroupLabel(group.label)
            const isGroupSelected = selection?.type === 'skill-group' && selection.id === group.id
            return (
              <div key={group.id} className={`skill-group${isProblematic ? ' problematic' : ''}`}>
                <div className="skill-group-head">
                  <button
                    type="button"
                    className={`skill-group-label label-tracked${isGroupSelected ? ' selected' : ''}`}
                    onClick={() => setSelection({ type: 'skill-group', id: group.id })}
                    aria-pressed={isGroupSelected}
                    title={isProblematic ? `Source label: "${group.label}" — auto-generated, needs renaming` : undefined}
                  >
                    {displayLabel}
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
