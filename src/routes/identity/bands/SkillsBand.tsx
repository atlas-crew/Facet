import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useIdentityStore } from '../../../store/identityStore'
import { facetClientEnv } from '../../../utils/facetEnv'
import { skillsFillStrength } from '../../../utils/identityFillStrength'
import { sanitizeEndpointUrl } from '../../../utils/idUtils'
import {
  applySkillEnrichmentSuggestion,
  displaySkillGroupLabel,
  getIdentityEnrichmentProgress,
  getSkillEnrichmentStatus,
  isGenericSkillGroupLabel,
  skillNamesMatch,
  updateIdentityEnrichmentSkill,
} from '../../../utils/identityEnrichment'
import {
  generateSkillEnrichmentSuggestion,
  hasSkillEnrichmentBulletEvidence,
} from '../../../utils/skillEnrichment'
import { IdentityBand } from '../IdentityBand'

export function SkillsBand({
  bulkRequestId = 0,
  onBulkRequestSettled,
}: {
  bulkRequestId?: number
  onBulkRequestSettled?: (requestId: number, status: 'succeeded' | 'failed') => void
}) {
  const identity = useIdentityStore((s) => s.currentIdentity)
  const selection = useIdentityStore((s) => s.mapSelection)
  const setMapSelection = useIdentityStore((s) => s.setMapSelection)
  const updateGroups = useIdentityStore((s) => s.updateCurrentSkillGroups)
  const [isDeepeningAll, setIsDeepeningAll] = useState(false)
  const [bulkMessage, setBulkMessage] = useState<string | null>(null)
  const bulkAbortRef = useRef<AbortController | null>(null)
  const bulkRunningRef = useRef(false)
  const honoredBulkRequestRef = useRef(0)
  const aiEndpoint = useMemo(() => sanitizeEndpointUrl(facetClientEnv.anthropicProxyUrl), [])
  const fill = skillsFillStrength(identity)
  const groups = useMemo(() => identity?.skills?.groups ?? [], [identity?.skills?.groups])
  const enrichmentProgress = useMemo(
    () => (identity ? getIdentityEnrichmentProgress(identity) : null),
    [identity],
  )
  const visibleBulkMessage =
    bulkMessage ??
    (enrichmentProgress && enrichmentProgress.pending === 0
      ? 'No pending skills to deepen.'
      : null)

  const duplicateSkillNames = useMemo(() => {
    const counts = new Map<string, number>()
    for (const group of groups) {
      for (const item of group.items) {
        const key = item.name.trim().toLocaleLowerCase()
        counts.set(key, (counts.get(key) ?? 0) + 1)
      }
    }
    return new Set(
      [...counts.entries()]
        .filter(([, count]) => count > 1)
        .map(([name]) => name),
    )
  }, [groups])
  const isDuplicate = (name: string): boolean =>
    duplicateSkillNames.has(name.trim().toLocaleLowerCase())
  const handleDeepenAllSkills = useCallback(async () => {
    if (!identity || bulkRunningRef.current) return false
    if (!aiEndpoint) {
      setBulkMessage('AI suggestions are disabled. Configure VITE_ANTHROPIC_PROXY_URL.')
      return false
    }

    const pendingTargets = identity.skills.groups.flatMap((group) =>
      group.items
        .filter((item) => getSkillEnrichmentStatus(item) === 'pending')
        .map((item) => ({ groupId: group.id, skillName: item.name })),
    )
    if (pendingTargets.length === 0) {
      setBulkMessage('No pending skills to deepen.')
      return false
    }

    bulkAbortRef.current?.abort()
    const controller = new AbortController()
    bulkAbortRef.current = controller
    bulkRunningRef.current = true
    setIsDeepeningAll(true)
    setBulkMessage(`Deepening ${pendingTargets.length} skill(s)...`)

    let applied = 0
    let skipped = 0
    let failed = 0
    let processed = 0
    const updateProgressMessage = () => {
      setBulkMessage(`Processed ${processed} of ${pendingTargets.length} skill(s)...`)
    }

    try {
      for (const target of pendingTargets) {
        if (controller.signal.aborted) break
        const currentIdentity = useIdentityStore.getState().currentIdentity
        if (!currentIdentity) break
        const group = currentIdentity.skills.groups.find((entry) => entry.id === target.groupId)
        const skill = group?.items.find((entry) => skillNamesMatch(entry.name, target.skillName))
        if (!group || !skill) {
          failed += 1
          processed += 1
          updateProgressMessage()
          continue
        }
        if (getSkillEnrichmentStatus(skill) !== 'pending') {
          processed += 1
          updateProgressMessage()
          continue
        }
        if (!hasSkillEnrichmentBulletEvidence(currentIdentity, group, skill)) {
          const skippedIdentity = updateIdentityEnrichmentSkill(
            currentIdentity,
            target.groupId,
            target.skillName,
            (entry) => ({
              ...entry,
              skipped_at: new Date().toISOString(),
            }),
          )
          updateGroups(skippedIdentity.skills.groups)
          skipped += 1
          processed += 1
          updateProgressMessage()
          continue
        }

        try {
          const suggestion = await generateSkillEnrichmentSuggestion({
            endpoint: aiEndpoint,
            identity: currentIdentity,
            group,
            skill,
            signal: controller.signal,
          })
          if (controller.signal.aborted) break
          if (!suggestion.depth) {
            const latestIdentity = useIdentityStore.getState().currentIdentity
            if (!latestIdentity) break
            const skippedIdentity = updateIdentityEnrichmentSkill(
              latestIdentity,
              target.groupId,
              target.skillName,
              (entry) => ({
                ...entry,
                skipped_at: new Date().toISOString(),
              }),
            )
            updateGroups(skippedIdentity.skills.groups)
            skipped += 1
            processed += 1
            updateProgressMessage()
            continue
          }
          const suggestionDepth = suggestion.depth
          const editedAt = new Date().toISOString()
          const latestIdentity = useIdentityStore.getState().currentIdentity
          if (!latestIdentity) break
          const latestSkill = latestIdentity.skills.groups
            .find((entry) => entry.id === target.groupId)
            ?.items.find((entry) => skillNamesMatch(entry.name, target.skillName))
          if (!latestSkill || getSkillEnrichmentStatus(latestSkill) !== 'pending') {
            processed += 1
            updateProgressMessage()
            continue
          }
          const nextIdentity = updateIdentityEnrichmentSkill(
            latestIdentity,
            target.groupId,
            target.skillName,
            (entry) =>
              applySkillEnrichmentSuggestion(
                entry,
                { ...suggestion, depth: suggestionDepth },
                editedAt,
              ),
          )
          updateGroups(nextIdentity.skills.groups)
          applied += 1
          processed += 1
          updateProgressMessage()
        } catch {
          if (controller.signal.aborted) break
          failed += 1
          processed += 1
          updateProgressMessage()
        }
      }

      if (!controller.signal.aborted) {
        setBulkMessage(
          [
            applied > 0 ? `Deepened ${applied} skill(s)` : 'No skills deepened',
            skipped > 0 ? `${skipped} skipped for missing or insufficient evidence` : '',
            failed > 0 ? `${failed} failed` : '',
          ]
            .filter(Boolean)
            .join('; ') + '.',
        )
      }
      return applied > 0 || skipped > 0
    } catch {
      if (!controller.signal.aborted) {
        setBulkMessage('Skill deepening stopped before finishing.')
      }
      return false
    } finally {
      if (bulkAbortRef.current === controller) {
        bulkAbortRef.current = null
        bulkRunningRef.current = false
        setIsDeepeningAll(false)
      }
    }
  }, [aiEndpoint, identity, updateGroups])

  useEffect(
    () => () => {
      bulkAbortRef.current?.abort()
      bulkAbortRef.current = null
      bulkRunningRef.current = false
    },
    [],
  )

  useEffect(() => {
    if (bulkRequestId <= 0 || honoredBulkRequestRef.current === bulkRequestId) return
    honoredBulkRequestRef.current = bulkRequestId
    const requestId = bulkRequestId
    const timeout = window.setTimeout(() => {
      void handleDeepenAllSkills().then(
        (result) => onBulkRequestSettled?.(requestId, result === false ? 'failed' : 'succeeded'),
        () => onBulkRequestSettled?.(requestId, 'failed'),
      )
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [bulkRequestId, handleDeepenAllSkills, onBulkRequestSettled])

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
                onClick={() => void handleDeepenAllSkills()}
                disabled={isDeepeningAll || enrichmentProgress.pending === 0}
                aria-busy={isDeepeningAll ? true : undefined}
              >
                {isDeepeningAll ? 'Deepening...' : 'Deepen all skills'}
              </button>
              {visibleBulkMessage ? (
                <p className="skills-enrichment-status" role="status">
                  {visibleBulkMessage}
                </p>
              ) : null}
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
                    onClick={() => setMapSelection({ type: 'skill-group', id: group.id })}
                    aria-pressed={isGroupSelected}
                    title={isProblematic ? `Source label: "${group.label}" — auto-generated, needs renaming` : undefined}
                  >
                    {displayLabel}
                  </button>
                  <span className="skill-group-count label-tracked">{group.items.length} items</span>
                </div>
                <div className="skill-chips">
                  {group.items.map((item) => {
                    const status = getSkillEnrichmentStatus(item)
                    const untagged = (!item.tags || item.tags.length === 0) && status === 'pending'
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
                      status === 'pending' ? 'pending' : '',
                      status === 'complete' ? 'complete' : '',
                      isItemSelected ? 'selected' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')
                    return (
                      <button
                        key={item.name}
                        type="button"
                        className={className}
                        onClick={() =>
                          setMapSelection({
                            type: 'skill-item',
                            groupId: group.id,
                            itemId: item.name,
                          })
                        }
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
