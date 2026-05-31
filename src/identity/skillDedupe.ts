import type {
  ProfessionalSkillGroup,
  ProfessionalSkillDepthSource,
  ProfessionalSkillEnrichedBy,
  ProfessionalSkillItem,
} from './schema'

export interface SkillNameDedupeEvent {
  canonicalName: string
  duplicateName: string
}

export interface SkillGroupDedupeEvent extends SkillNameDedupeEvent {
  canonicalGroupLabel: string
  duplicateGroupLabel: string
}

const skillNameDedupeKey = (skillName: string): string => skillName.trim().toLocaleLowerCase()

const mergeSkillTags = (canonical: string[], duplicate: string[]): string[] => {
  const seen = new Set(canonical.map((tag) => tag.trim().toLocaleLowerCase()))
  const merged = [...canonical]

  for (const tag of duplicate) {
    const key = tag.trim().toLocaleLowerCase()
    if (!key || seen.has(key)) {
      continue
    }
    seen.add(key)
    merged.push(tag)
  }

  return merged
}

const depthSourceRank = (source: ProfessionalSkillDepthSource | undefined): number => {
  if (source === 'corrected') return 2
  if (source === 'inferred') return 1
  return 0
}

const enrichedByRank = (source: ProfessionalSkillEnrichedBy | undefined): number => {
  if (source === 'user') return 3
  if (source === 'user-edited-llm') return 2
  if (source === 'llm-accepted') return 1
  return 0
}

const timestampValue = (value: string | undefined): number => {
  if (!value) return Number.NEGATIVE_INFINITY
  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp
}

const latestStatusTimestamp = (skill: ProfessionalSkillItem): number =>
  Math.max(timestampValue(skill.enriched_at), timestampValue(skill.skipped_at))

const shouldUseDuplicateDepth = (
  canonical: ProfessionalSkillItem,
  duplicate: ProfessionalSkillItem,
): boolean => {
  if (duplicate.depth === undefined) return false
  if (canonical.depth === undefined) return true

  const canonicalRank = depthSourceRank(canonical.depthSource)
  const duplicateRank = depthSourceRank(duplicate.depthSource)
  if (duplicateRank !== canonicalRank) {
    return duplicateRank > canonicalRank
  }

  return latestStatusTimestamp(duplicate) > latestStatusTimestamp(canonical)
}

const shouldUseDuplicateEnrichment = (
  canonical: ProfessionalSkillItem,
  duplicate: ProfessionalSkillItem,
): boolean => {
  const canonicalTimestamp = latestStatusTimestamp(canonical)
  const duplicateTimestamp = latestStatusTimestamp(duplicate)
  if (duplicateTimestamp !== canonicalTimestamp) {
    return duplicateTimestamp > canonicalTimestamp
  }

  return enrichedByRank(duplicate.enriched_by) > enrichedByRank(canonical.enriched_by)
}

const chooseMergedValue = <T>(
  useDuplicate: boolean,
  canonical: T | undefined,
  duplicate: T | undefined,
  options: { clearWhenDuplicateWins?: boolean } = {},
): T | undefined => {
  if (useDuplicate) {
    return duplicate !== undefined || options.clearWhenDuplicateWins ? duplicate : canonical
  }
  return canonical ?? duplicate
}

const mergeCaseVariantSkill = (
  canonical: ProfessionalSkillItem,
  duplicate: ProfessionalSkillItem,
): ProfessionalSkillItem => {
  const useDuplicateDepth = shouldUseDuplicateDepth(canonical, duplicate)
  const useDuplicateEnrichment = shouldUseDuplicateEnrichment(canonical, duplicate)
  const context = chooseMergedValue(useDuplicateEnrichment, canonical.context, duplicate.context)
  const contextStale = chooseMergedValue(
    useDuplicateEnrichment,
    canonical.context_stale,
    duplicate.context_stale,
  )
  const positioning = chooseMergedValue(
    useDuplicateEnrichment,
    canonical.positioning,
    duplicate.positioning,
  )
  const positioningStale = chooseMergedValue(
    useDuplicateEnrichment,
    canonical.positioning_stale,
    duplicate.positioning_stale,
  )
  const enrichedAt = chooseMergedValue(
    useDuplicateEnrichment,
    canonical.enriched_at,
    duplicate.enriched_at,
    { clearWhenDuplicateWins: true },
  )
  const enrichedBy = chooseMergedValue(
    useDuplicateEnrichment,
    canonical.enriched_by,
    duplicate.enriched_by,
    { clearWhenDuplicateWins: true },
  )
  const skippedAt = chooseMergedValue(
    useDuplicateEnrichment,
    canonical.skipped_at,
    duplicate.skipped_at,
    { clearWhenDuplicateWins: true },
  )
  const mergedStatus = useDuplicateEnrichment
    ? {
        enriched_at: enrichedAt,
        enriched_by: enrichedBy,
        skipped_at: skippedAt,
      }
    : {
        ...(enrichedAt !== undefined ? { enriched_at: enrichedAt } : {}),
        ...(enrichedBy !== undefined ? { enriched_by: enrichedBy } : {}),
        ...(skippedAt !== undefined ? { skipped_at: skippedAt } : {}),
      }

  return {
    ...canonical,
    tags: mergeSkillTags(canonical.tags, duplicate.tags),
    ...(useDuplicateDepth
      ? {
          depth: duplicate.depth,
          depthSource: duplicate.depthSource,
        }
      : {}),
    ...(context !== undefined ? { context } : {}),
    ...(contextStale !== undefined ? { context_stale: contextStale } : {}),
    ...(positioning !== undefined ? { positioning } : {}),
    ...(positioningStale !== undefined ? { positioning_stale: positioningStale } : {}),
    ...mergedStatus,
  }
}

export const dedupeSkillItemsByName = (
  items: ProfessionalSkillItem[],
  onDuplicate?: (event: SkillNameDedupeEvent) => void,
): ProfessionalSkillItem[] => {
  const next: ProfessionalSkillItem[] = []
  const indexByName = new Map<string, number>()
  let changed = false

  for (const item of items) {
    const key = skillNameDedupeKey(item.name)
    // Empty skill names are schema-valid today; preserve them and only repair
    // named case variants in this pass.
    if (!key) {
      next.push(item)
      continue
    }

    const existingIndex = indexByName.get(key)
    if (existingIndex === undefined) {
      indexByName.set(key, next.length)
      next.push(item)
      continue
    }

    const canonical = next[existingIndex]!
    next[existingIndex] = mergeCaseVariantSkill(canonical, item)
    changed = true
    onDuplicate?.({
      canonicalName: canonical.name,
      duplicateName: item.name,
    })
  }

  return changed ? next : items
}

export const dedupeSkillGroupsByItemName = (
  groups: ProfessionalSkillGroup[],
  onDuplicate?: (event: SkillGroupDedupeEvent) => void,
): ProfessionalSkillGroup[] => {
  let changed = false
  const nextGroups: ProfessionalSkillGroup[] = groups.map((group) => ({
    ...group,
    items: dedupeSkillItemsByName(group.items, (event) => {
      changed = true
      onDuplicate?.({
        ...event,
        canonicalGroupLabel: group.label,
        duplicateGroupLabel: group.label,
      })
    }),
  }))
  const indexByName = new Map<string, { groupIndex: number; itemIndex: number }>()

  for (const [groupIndex, group] of nextGroups.entries()) {
    const nextItems: ProfessionalSkillItem[] = []
    for (const item of group.items) {
      const key = skillNameDedupeKey(item.name)
      if (!key) {
        nextItems.push(item)
        continue
      }

      const existing = indexByName.get(key)
      if (!existing) {
        indexByName.set(key, { groupIndex, itemIndex: nextItems.length })
        nextItems.push(item)
        continue
      }

      const canonicalGroup = nextGroups[existing.groupIndex]!
      const canonical = canonicalGroup.items[existing.itemIndex]!
      canonicalGroup.items = canonicalGroup.items.map((entry, itemIndex) =>
        itemIndex === existing.itemIndex ? mergeCaseVariantSkill(canonical, item) : entry,
      )
      changed = true
      onDuplicate?.({
        canonicalName: canonical.name,
        duplicateName: item.name,
        canonicalGroupLabel: canonicalGroup.label,
        duplicateGroupLabel: group.label,
      })
    }
    group.items = nextItems
  }

  const filteredGroups = nextGroups.filter((group) => group.items.length > 0)

  if (!changed && filteredGroups.length === groups.length) {
    return groups
  }

  return filteredGroups
}
