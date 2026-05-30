import type {
  ProfessionalIdentityV3,
  ProfessionalSkillDepth,
  ProfessionalSkillGroup,
  ProfessionalSkillItem,
} from '../identity/schema'
import type {
  IdentityEnrichmentProgress,
  IdentityEnrichmentSkillRef,
  IdentityEnrichmentStatus,
} from '../types/identity'
import { dedupeSkillItemsByName } from '../identity/skillDedupe'

export interface IdentityEnrichmentResolvedSkill extends IdentityEnrichmentSkillRef {
  group: ProfessionalSkillGroup
  skill: ProfessionalSkillItem
}

export const skillNamesMatch = (left: string, right: string): boolean =>
  left.trim().localeCompare(right.trim(), undefined, { sensitivity: 'accent' }) === 0

/**
 * Detect skill-group labels that look like AI-generated placeholders rather
 * than something the user authored. Two patterns surface today:
 *   - `Skills 5`, `Skills5`, `skill 12` — index-suffixed auto-names. These also
 *     visually collide with the band header literally named "Skills".
 *   - `Also` — fallback bucket the extractor uses for ungrouped items.
 */
export const isGenericSkillGroupLabel = (label: string): boolean => {
  const trimmed = label.trim()
  return /^skills?\s*\d+$/i.test(trimmed) || trimmed.toLowerCase() === 'also'
}

/**
 * Map a possibly-generic group label to a display string. We swap the literal
 * "Skills N" label out of the rendered chip-group header so it stops colliding
 * with the band-level "Skills" eyebrow. Returns the original label unchanged
 * for user-authored names. The source data is never mutated — re-extraction
 * still finds the original label.
 *
 * The numeric suffix is intentionally dropped from the display ("Skills 5" →
 * "Unnamed group", not "Unnamed group · #5") because the index is an internal
 * extractor artifact that reads as developer-leakage when surfaced.
 */
export const displaySkillGroupLabel = (label: string): string => {
  const trimmed = label.trim()
  if (/^skills?\s*\d+$/i.test(trimmed)) return 'Unnamed group'
  if (trimmed.toLowerCase() === 'also') return 'Uncategorized'
  return trimmed || '(no label)'
}

export const skillGroupHasSkillName = (
  group: Pick<ProfessionalSkillGroup, 'items'>,
  skillName: string,
): boolean => group.items.some((skill) => skillNamesMatch(skill.name, skillName))

export const updateIdentityEnrichmentSkill = (
  identity: ProfessionalIdentityV3,
  groupId: string,
  skillName: string,
  updater: (skill: ProfessionalSkillItem) => ProfessionalSkillItem,
): ProfessionalIdentityV3 => ({
  ...identity,
  skills: {
    ...identity.skills,
    groups: identity.skills.groups.map((group) =>
      group.id === groupId
        ? {
            ...group,
            // Defensive repair for stale imported state: enrichment updates must
            // target the canonical skill once, even if old data had case variants.
            items: dedupeSkillItemsByName(group.items).map((skill) =>
              skillNamesMatch(skill.name, skillName) ? updater(skill) : skill,
            ),
          }
        : group,
    ),
  },
})

export const applySkillDepthEdit = (
  skill: ProfessionalSkillItem,
  depth: ProfessionalSkillDepth | '',
  editedAt = new Date().toISOString(),
): ProfessionalSkillItem => {
  const depthChanged = depth !== (skill.depth ?? '')
  if (!depthChanged) {
    return skill
  }

  return {
    ...skill,
    ...(depth ? { depth } : { depth: undefined }),
    ...(depth
      ? {
          depthSource: 'corrected' as const,
          enriched_at: editedAt,
          enriched_by: 'user' as const,
          skipped_at: undefined,
        }
      : {
          depthSource: undefined,
          skipped_at: undefined,
          ...(!skill.context?.trim() && !skill.positioning?.trim()
            ? {
                enriched_at: undefined,
                enriched_by: undefined,
              }
            : {}),
        }),
    ...(skill.context?.trim() ? { context_stale: true } : {}),
    ...(skill.positioning?.trim() ? { positioning_stale: true } : {}),
  }
}

const hasContent = (value: string | undefined): boolean => Boolean(value?.trim())

export const isSkillEnrichmentStale = (
  skill: Pick<
    ProfessionalSkillItem,
    'context' | 'context_stale' | 'positioning' | 'positioning_stale'
  >,
): boolean =>
  (Boolean(skill.context_stale) && hasContent(skill.context)) ||
  (Boolean(skill.positioning_stale) && hasContent(skill.positioning))

export const getSkillEnrichmentStatus = (
  skill: Pick<ProfessionalSkillItem, 'depth' | 'context' | 'positioning' | 'skipped_at'>,
): IdentityEnrichmentStatus => {
  if (hasContent(skill.skipped_at)) {
    return 'skipped'
  }

  if (skill.depth) {
    return 'complete'
  }

  return 'pending'
}

export const listIdentityEnrichmentSkills = (
  identity: ProfessionalIdentityV3,
): IdentityEnrichmentSkillRef[] =>
  identity.skills.groups.flatMap((group) =>
    group.items.map((skill) => ({
      groupId: group.id,
      skillName: skill.name,
      groupLabel: group.label,
      tags: [...(skill.tags ?? [])],
      status: getSkillEnrichmentStatus(skill),
      stale: isSkillEnrichmentStale(skill),
    })),
  )

export const getIdentityEnrichmentProgress = (
  identity: ProfessionalIdentityV3,
): IdentityEnrichmentProgress => {
  const skills = listIdentityEnrichmentSkills(identity)
  const progress: IdentityEnrichmentProgress = {
    total: skills.length,
    pending: 0,
    complete: 0,
    skipped: 0,
  }

  for (const skill of skills) {
    progress[skill.status] += 1
  }

  return progress
}

export const resolveIdentityEnrichmentSkill = (
  identity: ProfessionalIdentityV3,
  groupId: string,
  skillName: string,
): IdentityEnrichmentResolvedSkill | null => {
  const group = identity.skills.groups.find((entry) => entry.id === groupId)
  if (!group) {
    return null
  }

  const skill = group.items.find((entry) => entry.name === skillName)
  if (!skill) {
    return null
  }

  return {
    groupId,
    skillName,
    groupLabel: group.label,
    tags: [...(skill.tags ?? [])],
    status: getSkillEnrichmentStatus(skill),
    stale: isSkillEnrichmentStale(skill),
    group,
    skill,
  }
}

export const findNextPendingIdentitySkill = (
  identity: ProfessionalIdentityV3,
  current?: Pick<IdentityEnrichmentSkillRef, 'groupId' | 'skillName'>,
): IdentityEnrichmentSkillRef | null => {
  const skills = listIdentityEnrichmentSkills(identity)
  const pending = skills.filter((skill) => skill.status === 'pending')
  if (pending.length === 0) {
    return null
  }

  if (!current) {
    return pending[0] ?? null
  }

  const currentIndex = skills.findIndex(
    (skill) => skill.groupId === current.groupId && skill.skillName === current.skillName,
  )
  if (currentIndex === -1) {
    return pending[0] ?? null
  }

  for (let index = currentIndex + 1; index < skills.length; index += 1) {
    if (skills[index]?.status === 'pending') {
      return skills[index] ?? null
    }
  }

  return pending[0] ?? null
}

export const findAdjacentIdentityEnrichmentSkills = (
  identity: ProfessionalIdentityV3,
  current: Pick<IdentityEnrichmentSkillRef, 'groupId' | 'skillName'>,
): {
  previous: IdentityEnrichmentSkillRef | null
  next: IdentityEnrichmentSkillRef | null
} => {
  const skills = listIdentityEnrichmentSkills(identity)
  const currentIndex = skills.findIndex(
    (skill) => skill.groupId === current.groupId && skill.skillName === current.skillName,
  )

  if (currentIndex === -1) {
    return {
      previous: null,
      next: null,
    }
  }

  return {
    previous: skills[currentIndex - 1] ?? null,
    next: skills[currentIndex + 1] ?? null,
  }
}
