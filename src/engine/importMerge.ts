import type {
  EducationEntry,
  ProfileComponent,
  ProjectComponent,
  ResumeData,
  ResumeVector,
  RoleBulletComponent,
  RoleComponent,
  Preset,
  SkillGroupComponent,
  TargetLineComponent,
} from '../types'

const mergeById = <T extends { id: string }>(existing: T[], incoming: T[]): T[] => {
  const knownIds = new Set(existing.map((item) => item.id))
  const additions = incoming.filter((item) => !knownIds.has(item.id))
  return [...existing, ...additions]
}

const mergeRoleBullets = (
  existing: RoleBulletComponent[],
  incoming: RoleBulletComponent[],
): RoleBulletComponent[] => mergeById(existing, incoming)

const mergeRoles = (existing: RoleComponent[], incoming: RoleComponent[]): RoleComponent[] => {
  const existingById = new Map(existing.map((role) => [role.id, role]))
  const next: RoleComponent[] = [...existing]

  for (const role of incoming) {
    const current = existingById.get(role.id)
    if (!current) {
      next.push(role)
      continue
    }

    const merged: RoleComponent = {
      ...current,
      bullets: mergeRoleBullets(current.bullets, role.bullets),
    }
    const targetIndex = next.findIndex((item) => item.id === role.id)
    if (targetIndex >= 0) {
      next[targetIndex] = merged
    }
  }

  return next
}

const mergeEducation = (existing: EducationEntry[], incoming: EducationEntry[]): EducationEntry[] => {
  const keys = new Set(existing.map((entry) => `${entry.school}|${entry.degree}|${entry.year ?? ''}`))
  const additions = incoming.filter((entry) => !keys.has(`${entry.school}|${entry.degree}|${entry.year ?? ''}`))
  return [...existing, ...additions]
}

export const mergeResumeData = (current: ResumeData, imported: ResumeData): ResumeData => ({
  ...current,
  vectors: mergeById<ResumeVector>(current.vectors, imported.vectors),
  target_lines: mergeById<TargetLineComponent>(current.target_lines, imported.target_lines),
  profiles: mergeById<ProfileComponent>(current.profiles, imported.profiles),
  skill_groups: mergeById<SkillGroupComponent>(current.skill_groups, imported.skill_groups),
  roles: mergeRoles(current.roles, imported.roles),
  projects: mergeById<ProjectComponent>(current.projects, imported.projects),
  education: mergeEducation(current.education, imported.education),
  presets: mergeById<Preset>(current.presets ?? [], imported.presets ?? []),
})
