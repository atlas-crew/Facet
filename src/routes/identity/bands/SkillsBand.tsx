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
import {
  applySkillGroupNameSuggestions,
  generateSkillGroupNameSuggestions,
  type SkillGroupNameSuggestion,
} from '../../../utils/skillGroupNaming'
import { IdentityBand } from '../IdentityBand'
import type { InferenceRequestStatus } from '../inferenceRequestStatus'

type BulkDeepenResult = boolean | 'blocked' | 'skipped'
const NAMING_BLOCKS_DEEPENING_MESSAGE =
  'Apply or discard group name suggestions before deepening skills.'
const AI_PROXY_CONFIG_MESSAGE =
  'AI suggestions are disabled. Configure VITE_ANTHROPIC_PROXY_URL.'

const toBulkRequestStatus = (result: BulkDeepenResult): InferenceRequestStatus => {
  if (result === 'blocked') return 'blocked'
  if (result === 'skipped') return 'skipped'
  return result ? 'succeeded' : 'failed'
}

export function SkillsBand({
  bulkRequestId = 0,
  onBulkRequestSettled,
}: {
  bulkRequestId?: number
  onBulkRequestSettled?: (requestId: number, status: InferenceRequestStatus) => void
}) {
  const identity = useIdentityStore((s) => s.currentIdentity)
  const selection = useIdentityStore((s) => s.mapSelection)
  const setMapSelection = useIdentityStore((s) => s.setMapSelection)
  const updateGroups = useIdentityStore((s) => s.updateCurrentSkillGroups)
  const recordAiGenerationUndo = useIdentityStore((s) => s.recordAiGenerationUndo)
  const [isDeepeningAll, setIsDeepeningAll] = useState(false)
  const [isNamingGroups, setIsNamingGroups] = useState(false)
  const [bulkMessage, setBulkMessage] = useState<string | null>(null)
  const [namingMessage, setNamingMessage] = useState<string | null>(null)
  const [nameSuggestions, setNameSuggestions] = useState<SkillGroupNameSuggestion[]>([])
  const bulkAbortRef = useRef<AbortController | null>(null)
  const namingAbortRef = useRef<AbortController | null>(null)
  const namingButtonRef = useRef<HTMLButtonElement | null>(null)
  const bulkRunningRef = useRef(false)
  const namingRunningRef = useRef(false)
  const honoredBulkRequestRef = useRef(0)
  const aiEndpoint = useMemo(() => sanitizeEndpointUrl(facetClientEnv.anthropicProxyUrl), [])
  const fill = skillsFillStrength(identity)
  const groups = useMemo(() => identity?.skills?.groups ?? [], [identity?.skills?.groups])
  const enrichmentProgress = useMemo(
    () => (identity ? getIdentityEnrichmentProgress(identity) : null),
    [identity],
  )
  const hasNameSuggestions = nameSuggestions.length > 0
  const namingBlocksDeepening = isNamingGroups || hasNameSuggestions
  const namingBlocksDeepeningMessage = namingBlocksDeepening
    ? NAMING_BLOCKS_DEEPENING_MESSAGE
    : null
  const aiConfigMessage = !aiEndpoint ? AI_PROXY_CONFIG_MESSAGE : null
  const visibleBulkMessage =
    bulkMessage ??
    namingBlocksDeepeningMessage ??
    (enrichmentProgress && enrichmentProgress.pending === 0
      ? 'No pending skills to deepen.'
      : null)
  const visibleNamingMessage = namingMessage ?? aiConfigMessage
  const canStartNaming =
    groups.length > 0 &&
    Boolean(aiEndpoint) &&
    !isNamingGroups &&
    !isDeepeningAll &&
    !hasNameSuggestions
  const canStartDeepening = Boolean(
    enrichmentProgress &&
      enrichmentProgress.pending > 0 &&
      !isDeepeningAll &&
      !namingBlocksDeepening,
  )
  const canApplyNameSuggestions = hasNameSuggestions && !isDeepeningAll
  const groupLabelSignature = useMemo(
    () => JSON.stringify(groups.map((group) => [group.id, group.label])),
    [groups],
  )

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

  const handleSuggestGroupNames = useCallback(async () => {
    const currentIdentity = useIdentityStore.getState().currentIdentity
    if (!currentIdentity || namingRunningRef.current) return
    if (isDeepeningAll) {
      setNamingMessage('Finish skill deepening before suggesting group names.')
      return
    }
    if (!aiEndpoint) {
      setNamingMessage(AI_PROXY_CONFIG_MESSAGE)
      return
    }
    if (currentIdentity.skills.groups.length === 0) {
      setNamingMessage('Add skill groups before suggesting names.')
      return
    }

    namingAbortRef.current?.abort()
    const controller = new AbortController()
    namingAbortRef.current = controller
    namingRunningRef.current = true
    setIsNamingGroups(true)
    setNameSuggestions([])
    setNamingMessage('Suggesting standardized skill group names...')

    try {
      const suggestions = await generateSkillGroupNameSuggestions({
        endpoint: aiEndpoint,
        identity: currentIdentity,
        signal: controller.signal,
      })
      if (controller.signal.aborted) return

      if (suggestions.length === 0) {
        setNamingMessage('The suggestion did not return usable skill group names.')
        return
      }

      setNameSuggestions(suggestions)
      setNamingMessage(
        `Review ${suggestions.length} suggested group name${suggestions.length === 1 ? '' : 's'}.`,
      )
    } catch (error) {
      if (
        (error instanceof DOMException && error.name === 'AbortError') ||
        (error instanceof Error && error.name === 'AbortError')
      ) {
        return
      }
      console.error(error)
      setNamingMessage('Unable to suggest skill group names.')
    } finally {
      if (namingAbortRef.current === controller) {
        namingAbortRef.current = null
        namingRunningRef.current = false
        setIsNamingGroups(false)
      }
    }
  }, [aiEndpoint, isDeepeningAll])

  const handleApplyNameSuggestions = useCallback(() => {
    const currentIdentity = useIdentityStore.getState().currentIdentity
    if (!currentIdentity || !hasNameSuggestions) return
    if (bulkRunningRef.current) {
      setNamingMessage('Finish skill deepening before applying group name suggestions.')
      return
    }
    const nextGroups = applySkillGroupNameSuggestions(
      currentIdentity.skills.groups,
      nameSuggestions,
    )
    const changed = nextGroups.some((group, index) => group !== currentIdentity.skills.groups[index])
    if (changed) {
      updateGroups(nextGroups)
      recordAiGenerationUndo('applied skill group names', currentIdentity)
    }
    setNameSuggestions([])
    setNamingMessage(
      changed
        ? 'Applied suggested skill group names. Edit any group name from the inspector.'
        : 'Suggested skill group names already match the current taxonomy.',
    )
    window.setTimeout(() => namingButtonRef.current?.focus(), 0)
  }, [hasNameSuggestions, nameSuggestions, recordAiGenerationUndo, updateGroups])

  const handleDiscardNameSuggestions = useCallback(() => {
    setNameSuggestions([])
    setNamingMessage('Discarded suggested skill group names.')
    window.setTimeout(() => namingButtonRef.current?.focus(), 0)
  }, [])

  useEffect(() => {
    if (!hasNameSuggestions) return
    setNameSuggestions([])
    setNamingMessage('Skill groups changed; discarded the previous naming suggestion.')
    // Only the live group labels should invalidate an open proposal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupLabelSignature])

  // Keep this memoized because the bulkRequestId effect dispatches through it.
  const handleDeepenAllSkills = useCallback(async (): Promise<BulkDeepenResult> => {
    if (!identity || bulkRunningRef.current) return false
    if (namingBlocksDeepening || namingRunningRef.current) {
      setBulkMessage(NAMING_BLOCKS_DEEPENING_MESSAGE)
      return 'blocked'
    }
    if (!aiEndpoint) {
      setBulkMessage(AI_PROXY_CONFIG_MESSAGE)
      return false
    }

    const pendingTargets = identity.skills.groups.flatMap((group) =>
      group.items
        .filter((item) => getSkillEnrichmentStatus(item) === 'pending')
        .map((item) => ({ groupId: group.id, skillName: item.name })),
    )
    if (pendingTargets.length === 0) {
      setBulkMessage('No pending skills to deepen.')
      return 'skipped'
    }

    bulkAbortRef.current?.abort()
    const controller = new AbortController()
    bulkAbortRef.current = controller
    bulkRunningRef.current = true
    const beforeIdentity = identity
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
        recordAiGenerationUndo('deepened skill taxonomy', beforeIdentity)
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
  }, [aiEndpoint, identity, namingBlocksDeepening, recordAiGenerationUndo, updateGroups])

  useEffect(
    () => () => {
      bulkAbortRef.current?.abort()
      bulkAbortRef.current = null
      bulkRunningRef.current = false
      namingAbortRef.current?.abort()
      namingAbortRef.current = null
      namingRunningRef.current = false
    },
    [],
  )

  useEffect(() => {
    if (bulkRequestId <= 0 || honoredBulkRequestRef.current === bulkRequestId) return
    honoredBulkRequestRef.current = bulkRequestId
    const requestId = bulkRequestId
    const timeout = window.setTimeout(() => {
      void handleDeepenAllSkills().then(
        (result) => onBulkRequestSettled?.(requestId, toBulkRequestStatus(result)),
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
                disabled={!canStartDeepening}
                aria-busy={isDeepeningAll ? true : undefined}
                aria-describedby={visibleBulkMessage ? 'skills-enrichment-status' : undefined}
              >
                {isDeepeningAll ? 'Deepening...' : 'Deepen all skills'}
              </button>
              {visibleBulkMessage ? (
                <p id="skills-enrichment-status" className="skills-enrichment-status" role="status">
                  {visibleBulkMessage}
                </p>
              ) : null}
            </section>
          ) : null}
          <section className="skills-naming-panel" aria-labelledby="skills-naming-title">
            <div>
              <h3 id="skills-naming-title" className="label-tracked skills-enrichment-eyebrow">
                Taxonomy names
              </h3>
              <p className="chapter-copy skills-enrichment-copy">
                Suggest standardized labels for every skill group. Apply once, then edit any group
                name from the inspector; per-group revert is deferred for now.
              </p>
            </div>
            <button
              type="button"
              className="inspector-btn skills-enrichment-action"
              ref={namingButtonRef}
              onClick={() => void handleSuggestGroupNames()}
              disabled={!canStartNaming}
              aria-busy={isNamingGroups ? true : undefined}
              aria-describedby={visibleNamingMessage ? 'skills-naming-status' : undefined}
            >
              {isNamingGroups ? 'Suggesting...' : 'Suggest group names'}
            </button>
            {visibleNamingMessage ? (
              <p id="skills-naming-status" className="skills-enrichment-status" role="status">
                {visibleNamingMessage}
              </p>
            ) : null}
            {nameSuggestions.length > 0 ? (
              <>
                <ul className="skills-naming-proposals" aria-label="Suggested skill group names">
                  {nameSuggestions.map((suggestion) => (
                  <li
                    key={suggestion.groupId}
                    className="skills-naming-proposal"
                  >
                    <span className="label-tracked">{suggestion.currentLabel}</span>
                    <span className="skills-naming-arrow" aria-hidden="true">
                      -&gt;
                    </span>
                    <span className="sr-only">renamed to</span>
                    <strong>{suggestion.suggestedLabel}</strong>
                      {suggestion.rationale ? (
                        <span className="chapter-copy">{suggestion.rationale}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
                <div className="skills-naming-actions">
                  <button
                    type="button"
                    className="inspector-btn primary"
                    onClick={handleApplyNameSuggestions}
                    disabled={!canApplyNameSuggestions}
                  >
                    Apply suggested names
                  </button>
                  <button
                    type="button"
                    className="inspector-btn"
                    onClick={handleDiscardNameSuggestions}
                  >
                    Discard
                  </button>
                </div>
              </>
            ) : null}
          </section>
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
