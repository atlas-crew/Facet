import {
  DEFAULT_TARGET_PAGES,
  type AssembledRoleBullet,
  type AssembledTextComponent,
  type AssemblyOptions,
  type AssemblyResult,
  type ComponentPriority,
  type ManualComponentOverrides,
  type PriorityByVector,
  type ResumeData,
  type TextVariantMap,
  type VectorSelection,
} from '../types'
import { applyPageBudget } from './pageBudget'
import { resolveVariables } from '../utils/variableResolver'

const hasOwn = (record: Record<string, unknown>, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(record, key)

const resolvePriorityForVector = (
  priorities: PriorityByVector,
  selectedVector: VectorSelection,
): ComponentPriority | null => {
  if (selectedVector === 'all') {
    return Object.values(priorities).some((priority) => priority === 'include') ? 'include' : null
  }

  return priorities[selectedVector] ?? null
}

export const getPriorityForVector = (
  priorities: PriorityByVector,
  selectedVector: VectorSelection,
): ComponentPriority => resolvePriorityForVector(priorities, selectedVector) ?? 'exclude'

const resolveTextVariant = (
  text: string,
  variants: TextVariantMap | undefined,
  selectedVector: VectorSelection,
  variables: Record<string, string> = {},
): string => {
  const resolvedText =
    selectedVector !== 'all' && variants?.[selectedVector]
      ? variants[selectedVector]
      : text

  return resolveVariables(resolvedText, variables)
}

export const buildComponentKeys = (type: string, id: string, roleId?: string): string[] => {
  const keys = [`${type}:${id}`, id]

  if (roleId) {
    keys.unshift(`role:${roleId}:${type}:${id}`, `role:${roleId}:${id}`)
  }

  return keys
}

const resolveManualOverride = (
  overrides: ManualComponentOverrides,
  keys: string[],
): boolean | undefined => {
  for (const key of keys) {
    if (hasOwn(overrides, key)) {
      return overrides[key]
    }
  }

  return undefined
}

const shouldIncludeComponent = (
  rawPriority: ComponentPriority | null,
  override: boolean | undefined,
): boolean => {
  return override === true || (override !== false && rawPriority === 'include')
}

const applyManualBulletOrder = (
  bullets: AssembledRoleBullet[],
  roleOrder: string[] | undefined,
): AssembledRoleBullet[] => {
  if (!roleOrder || roleOrder.length === 0) {
    return bullets
  }

  const orderIndex = new Map<string, number>()
  for (const [index, id] of roleOrder.entries()) {
    orderIndex.set(id, index)
  }

  const fallbackIndex = new Map<string, number>()
  for (const [index, bullet] of bullets.entries()) {
    fallbackIndex.set(bullet.id, index)
  }

  return [...bullets].sort((left, right) => {
    const leftOrder = orderIndex.get(left.id)
    const rightOrder = orderIndex.get(right.id)

    if (leftOrder !== undefined && rightOrder !== undefined) {
      return leftOrder - rightOrder
    }

    if (leftOrder !== undefined) {
      return -1
    }

    if (rightOrder !== undefined) {
      return 1
    }

    return (fallbackIndex.get(left.id) ?? 0) - (fallbackIndex.get(right.id) ?? 0)
  })
}

interface RankedTextComponent {
  component: AssembledTextComponent
  sourceIndex: number
}

const pickHighestPriorityText = (
  candidates: RankedTextComponent[],
): AssembledTextComponent | undefined => {
  if (candidates.length === 0) {
    return undefined
  }

  return [...candidates].sort((left, right) => left.sourceIndex - right.sourceIndex).at(0)?.component
}

const skillGroupSortOrder = (
  order: Record<string, number | undefined>,
  selectedVector: VectorSelection,
): number => {
  if (selectedVector !== 'all') {
    const byVector = order[selectedVector]
    if (typeof byVector === 'number') {
      return byVector
    }
  }

  const defaultOrder = order.default
  return typeof defaultOrder === 'number' ? defaultOrder : Number.MAX_SAFE_INTEGER
}

interface ResolvedSkillGroupConfig {
  include: boolean
  order: number
  content: string
}

const resolveSkillGroupConfig = (
  group: ResumeData['skill_groups'][number],
  selectedVector: VectorSelection,
): ResolvedSkillGroupConfig => {
  const vectorConfigs = group.vectors ?? {}

  if (selectedVector === 'all') {
    const includedConfigs = Object.values(vectorConfigs).filter((config) => config.priority !== 'exclude')
    if (includedConfigs.length > 0) {
      const minOrder = Math.min(...includedConfigs.map((config) => config.order))
      return {
        include: true,
        order: Number.isFinite(minOrder) ? minOrder : Number.MAX_SAFE_INTEGER,
        content: group.content,
      }
    }

    return {
      include: true,
      order: skillGroupSortOrder(group.order ?? {}, 'all'),
      content: group.content,
    }
  }

  const explicitConfig = vectorConfigs[selectedVector]
  if (explicitConfig) {
    return {
      include: explicitConfig.priority !== 'exclude',
      order: explicitConfig.order,
      content: explicitConfig.content ?? group.content,
    }
  }

  return {
    include: true,
    order: skillGroupSortOrder(group.order ?? {}, selectedVector),
    content: group.content,
  }
}

export const assembleResume = (
  data: ResumeData,
  options: AssemblyOptions = {},
): AssemblyResult => {
  const selectedVector = options.selectedVector ?? 'all'
  const manualOverrides = options.manualOverrides ?? {}
  const bulletOrderByRole = options.bulletOrderByRole ?? {}
  const targetPages = options.targetPages ?? DEFAULT_TARGET_PAGES
  const trimToPageBudget = options.trimToPageBudget ?? true
  const variables = options.variables ?? data.variables ?? {}

  const targetLineCandidates: RankedTextComponent[] = []
  const profileCandidates: RankedTextComponent[] = []

  for (const [index, targetLine] of data.target_lines.entries()) {
    const keys = buildComponentKeys('target_line', targetLine.id)
    const autoPriority = resolvePriorityForVector(targetLine.vectors, selectedVector)
    const override = resolveManualOverride(manualOverrides, keys)
    if (!shouldIncludeComponent(autoPriority, override)) {
      continue
    }

    targetLineCandidates.push({
      component: {
        id: targetLine.id,
        text: resolveTextVariant(targetLine.text, targetLine.variants, selectedVector, variables),
      },
      sourceIndex: index,
    })
  }

  for (const [index, profile] of data.profiles.entries()) {
    const keys = buildComponentKeys('profile', profile.id)
    const autoPriority = resolvePriorityForVector(profile.vectors, selectedVector)
    const override = resolveManualOverride(manualOverrides, keys)
    if (!shouldIncludeComponent(autoPriority, override)) {
      continue
    }

    profileCandidates.push({
      component: {
        id: profile.id,
        text: resolveTextVariant(profile.text, profile.variants, selectedVector, variables),
      },
      sourceIndex: index,
    })
  }

  const skillGroups = data.skill_groups
    .map((group, index) => ({
      id: group.id,
      label: group.label,
      config: resolveSkillGroupConfig(group, selectedVector),
      sourceIndex: index,
    }))
    .filter((group) => group.config.include)
    .sort((left, right) => {
      const orderDelta = left.config.order - right.config.order
      if (orderDelta !== 0) {
        return orderDelta
      }

      return left.sourceIndex - right.sourceIndex
    })
    .map(({ id, label, config }) => ({ 
      id, 
      label: resolveVariables(label, variables), 
      content: resolveVariables(config.content, variables) 
    }))

  const roles = data.roles
    .map((role) => {
      const roleOverride = resolveManualOverride(manualOverrides, buildComponentKeys('role', role.id))
      if (roleOverride === false) {
        return null
      }

      const includedBullets = role.bullets
        .map((bullet, bulletIndex) => {
          const keys = buildComponentKeys('bullet', bullet.id, role.id)
          const autoPriority = resolvePriorityForVector(bullet.vectors, selectedVector)
          const override = resolveManualOverride(manualOverrides, keys)

          if (!shouldIncludeComponent(autoPriority, override)) {
            return null
          }

          return {
            id: bullet.id,
            text: resolveTextVariant(bullet.text, bullet.variants, selectedVector, variables),
            sourceIndex: bulletIndex,
          }
        })
        .filter((bullet): bullet is Exclude<typeof bullet, null> => bullet !== null)
        .sort((left, right) => left.sourceIndex - right.sourceIndex)
        .map(({ id, text }) => ({ id, text }))

      const orderedBullets = applyManualBulletOrder(includedBullets, bulletOrderByRole[role.id])
      if (orderedBullets.length === 0) {
        return null
      }

      return {
        id: role.id,
        company: resolveVariables(role.company, variables),
        title: resolveVariables(role.title, variables),
        dates: resolveVariables(role.dates, variables),
        location: role.location ? resolveVariables(role.location, variables) : role.location,
        subtitle: role.subtitle ? resolveVariables(role.subtitle, variables) : role.subtitle,
        bullets: orderedBullets,
      }
    })
    .filter((role): role is Exclude<typeof role, null> => role !== null)

  const projects = data.projects
    .map((project) => {
      const keys = buildComponentKeys('project', project.id)
      const autoPriority = resolvePriorityForVector(project.vectors, selectedVector)
      const override = resolveManualOverride(manualOverrides, keys)
      if (!shouldIncludeComponent(autoPriority, override)) {
        return null
      }

      return {
        id: project.id,
        name: resolveVariables(project.name, variables),
        url: project.url,
        text: resolveTextVariant(project.text, project.variants, selectedVector, variables),
      }
    })
    .filter((project): project is Exclude<typeof project, null> => project !== null)

  const education = data.education
    .map((entry) => {
      const keys = buildComponentKeys('education', entry.id)
      const autoPriority = resolvePriorityForVector(entry.vectors ?? {}, selectedVector)
      const override = resolveManualOverride(manualOverrides, keys)
      if (!shouldIncludeComponent(autoPriority, override)) {
        return null
      }

      return {
        id: entry.id,
        school: resolveVariables(entry.school, variables),
        location: resolveVariables(entry.location, variables),
        degree: resolveVariables(entry.degree, variables),
        year: entry.year ? resolveVariables(entry.year, variables) : entry.year,
      }
    })
    .filter((entry): entry is Exclude<typeof entry, null> => entry !== null)

  const certifications = (data.certifications ?? [])
    .map((cert) => {
      const keys = buildComponentKeys('certification', cert.id)
      const autoPriority = resolvePriorityForVector(cert.vectors, selectedVector)
      const override = resolveManualOverride(manualOverrides, keys)
      if (!shouldIncludeComponent(autoPriority, override)) {
        return null
      }

      return {
        id: cert.id,
        name: resolveVariables(cert.name, variables),
        issuer: resolveVariables(cert.issuer, variables),
        date: cert.date ? resolveVariables(cert.date, variables) : cert.date,
        credential_id: cert.credential_id,
        url: cert.url,
      }
    })
    .filter((cert): cert is Exclude<typeof cert, null> => cert !== null)

  const assembled = {
    selectedVector,
    header: {
      ...data.meta,
      name: resolveVariables(data.meta.name, variables),
      location: resolveVariables(data.meta.location, variables),
    },
    targetLine: pickHighestPriorityText(targetLineCandidates),
    profile: pickHighestPriorityText(profileCandidates),
    skillGroups,
    roles,
    projects,
    education,
    certifications,
  }

  const budgeted = applyPageBudget(assembled, {
    targetPages,
    trim: trimToPageBudget,
  })

  return {
    resume: budgeted.resume,
    targetPages: budgeted.targetPages,
    estimatedPages: budgeted.estimatedPages,
    estimatedPageUsage: budgeted.estimatedPageUsage,
    trimmedBulletIds: budgeted.trimmedBulletIds,
    warnings: budgeted.warnings,
  }
}
