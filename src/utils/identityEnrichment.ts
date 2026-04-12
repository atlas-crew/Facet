import type { ProfessionalIdentityV3, ProfessionalSkillGroup, ProfessionalSkillItem } from '../identity/schema'
import type {
  IdentityEnrichmentProgress,
  IdentityEnrichmentSkillRef,
  IdentityEnrichmentStatus,
} from '../types/identity'

export interface IdentityEnrichmentResolvedSkill extends IdentityEnrichmentSkillRef {
  group: ProfessionalSkillGroup
  skill: ProfessionalSkillItem
}

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
            items: group.items.map((skill) => (skill.name === skillName ? updater(skill) : skill)),
          }
        : group,
    ),
  },
})

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
