import {
  importProfessionalIdentity,
  type ProfessionalEducationEntry,
  type ProfessionalIdentityV3,
  type ProfessionalProfile,
  type ProfessionalProject,
  type ProfessionalRole,
  type ProfessionalSkillGroup,
  type ProfessionalSkillItem,
} from '../identity/schema'
import type { IdentityApplyResult } from '../types/identity'

interface MergeByIdResult<T extends { id: string }> {
  items: T[]
  addedIds: string[]
  updatedIds: string[]
}

interface DiffByIdResult {
  addedIds: string[]
  updatedIds: string[]
  removedIds: string[]
}

export interface IdentityMergeFieldPresence {
  awareness?: boolean
  search_vectors?: boolean
  preferences?: {
    constraints?: boolean
    matching?: boolean
  }
}

const stableSerialize = (value: unknown): string => {
  if (value === undefined) {
    return '"__undefined__"'
  }

  if (Array.isArray(value)) {
    return '[' + value.map((entry) => stableSerialize(entry)).join(',') + ']'
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return '{' + Object.keys(record)
      .sort()
      .map((key) => JSON.stringify(key) + ':' + stableSerialize(record[key]))
      .join(',') + '}'
  }

  return JSON.stringify(value)
}

const hasMeaningfulChange = <T>(left: T, right: T): boolean =>
  stableSerialize(left) !== stableSerialize(right)

const mergeById = <T extends { id: string }>(current: T[], incoming: T[]): MergeByIdResult<T> => {
  const merged = [...current]
  const indexById = new Map(merged.map((item, index) => [item.id, index]))
  const addedIds: string[] = []
  const updatedIds: string[] = []

  for (const item of incoming) {
    const existingIndex = indexById.get(item.id)
    if (existingIndex === undefined) {
      indexById.set(item.id, merged.length)
      merged.push(item)
      addedIds.push(item.id)
      continue
    }

    if (hasMeaningfulChange(merged[existingIndex], item)) {
      merged[existingIndex] = item
      updatedIds.push(item.id)
    }
  }

  return {
    items: merged,
    addedIds,
    updatedIds,
  }
}

const diffById = <T extends { id: string }>(current: T[], next: T[]): DiffByIdResult => {
  const currentById = new Map(current.map((item) => [item.id, item]))
  const nextById = new Map(next.map((item) => [item.id, item]))
  const addedIds: string[] = []
  const updatedIds: string[] = []
  const removedIds: string[] = []

  for (const item of next) {
    const existing = currentById.get(item.id)
    if (!existing) {
      addedIds.push(item.id)
      continue
    }

    if (hasMeaningfulChange(existing, item)) {
      updatedIds.push(item.id)
    }
  }

  for (const item of current) {
    if (!nextById.has(item.id)) {
      removedIds.push(item.id)
    }
  }

  return {
    addedIds,
    updatedIds,
    removedIds,
  }
}

const educationFingerprint = (entry: ProfessionalEducationEntry): string =>
  [entry.school, entry.location, entry.degree, entry.year ?? '']
    .map((value) => value.trim().toLowerCase())
    .join('::')

const mergeEducation = (
  current: ProfessionalEducationEntry[],
  incoming: ProfessionalEducationEntry[],
): {
  items: ProfessionalEducationEntry[]
  added: number
  updated: number
} => {
  const merged = [...current]
  const indexByFingerprint = new Map(
    merged.map((entry, index) => [educationFingerprint(entry), index]),
  )
  let added = 0
  let updated = 0

  for (const entry of incoming) {
    const fingerprint = educationFingerprint(entry)
    const existingIndex = indexByFingerprint.get(fingerprint)
    if (existingIndex === undefined) {
      indexByFingerprint.set(fingerprint, merged.length)
      merged.push(entry)
      added += 1
      continue
    }

    if (hasMeaningfulChange(merged[existingIndex], entry)) {
      merged[existingIndex] = entry
      updated += 1
    }
  }

  return { items: merged, added, updated }
}

const describeIdChanges = (label: string, addedIds: string[], updatedIds: string[]): string[] => {
  const details: string[] = []
  if (addedIds.length > 0) {
    details.push(`Added ${label}: ${addedIds.join(', ')}.`)
  }
  if (updatedIds.length > 0) {
    details.push(`Updated ${label}: ${updatedIds.join(', ')}.`)
  }
  return details
}

const describeRemovedIds = (label: string, removedIds: string[]): string[] =>
  removedIds.length > 0 ? [`Removed ${label}: ${removedIds.join(', ')}.`] : []

const describeScalarReplacement = <T>(
  label: string,
  current: T,
  incoming: T,
): string[] => (hasMeaningfulChange(current, incoming) ? [`Replaced ${label} from draft.`] : [])

const skillItemKey = (item: ProfessionalSkillItem): string => item.name.trim().toLowerCase()

const mergeSkillItems = (
  current: ProfessionalSkillItem[],
  incoming: ProfessionalSkillItem[],
): ProfessionalSkillItem[] => {
  const currentByKey = new Map(current.map((item) => [skillItemKey(item), item]))

  // Within a provided group, incoming items define membership; omitted fields stay intact and explicit null clears.
  return incoming.map((item) => {
    const existing = currentByKey.get(skillItemKey(item))
    return existing ? { ...existing, ...item } : item
  })
}

const mergeSkillGroups = (
  current: ProfessionalSkillGroup[],
  incoming: ProfessionalSkillGroup[],
): MergeByIdResult<ProfessionalSkillGroup> => {
  const merged = [...current]
  const indexById = new Map(merged.map((item, index) => [item.id, index]))
  const addedIds: string[] = []
  const updatedIds: string[] = []

  for (const group of incoming) {
    const existingIndex = indexById.get(group.id)
    if (existingIndex === undefined) {
      indexById.set(group.id, merged.length)
      merged.push(group)
      addedIds.push(group.id)
      continue
    }

    const existing = merged[existingIndex]
    const nextGroup: ProfessionalSkillGroup = {
      ...existing,
      ...group,
      items: mergeSkillItems(existing.items, group.items),
    }

    if (hasMeaningfulChange(existing, nextGroup)) {
      merged[existingIndex] = nextGroup
      updatedIds.push(group.id)
    }
  }

  return {
    items: merged,
    addedIds,
    updatedIds,
  }
}

const buildSummary = (
  data: ProfessionalIdentityV3,
  action: string,
): string =>
  `${action}: ${data.roles.length} roles, ${data.profiles.length} profiles, ${data.projects.length} projects.`

export const replaceProfessionalIdentity = (
  incoming: ProfessionalIdentityV3,
): IdentityApplyResult => {
  const normalized = importProfessionalIdentity(incoming)
  return {
    data: normalized.data,
    warnings: normalized.warnings,
    summary: buildSummary(normalized.data, 'Replaced identity model'),
    details: ['Replaced the entire identity model with the current draft.'],
  }
}

export const mergeProfessionalIdentity = (
  current: ProfessionalIdentityV3,
  incoming: ProfessionalIdentityV3,
  fieldPresence: IdentityMergeFieldPresence = {},
): IdentityApplyResult => {
  // Merge semantics are intentionally asymmetric:
  // array sections merge by id or education fingerprint, while scalar sections
  // are replaced wholesale from the incoming draft.
  const skillGroups = mergeSkillGroups(current.skills.groups, incoming.skills.groups)
  const profiles = mergeById<ProfessionalProfile>(current.profiles, incoming.profiles)
  const roles = mergeById<ProfessionalRole>(current.roles, incoming.roles)
  const projects = mergeById<ProfessionalProject>(current.projects, incoming.projects)
  const education = mergeEducation(current.education, incoming.education)
  const currentSearchVectors = current.search_vectors ?? []
  const incomingSearchVectors = incoming.search_vectors ?? []
  const currentOpenQuestions = current.awareness?.open_questions ?? []
  const incomingOpenQuestions = incoming.awareness?.open_questions ?? []
  const preserveCurrentMatching =
    fieldPresence.preferences?.matching === false &&
    !hasMeaningfulChange(current.preferences.role_fit, incoming.preferences.role_fit)
  const mergedPreferences: ProfessionalIdentityV3['preferences'] = {
    ...current.preferences,
    ...incoming.preferences,
    ...(fieldPresence.preferences?.constraints === false
      ? { constraints: current.preferences.constraints }
      : (incoming.preferences.constraints !== undefined
          ? { constraints: incoming.preferences.constraints }
          : (current.preferences.constraints !== undefined
              ? { constraints: current.preferences.constraints }
              : {}))),
    ...(preserveCurrentMatching
      ? { matching: current.preferences.matching }
      : (incoming.preferences.matching !== undefined
          ? { matching: incoming.preferences.matching }
          : {})
      ),
  }
  const mergedAwareness =
    fieldPresence.awareness === false
      ? current.awareness
      : ((fieldPresence.awareness ?? incoming.awareness !== undefined)
          ? {
              open_questions: incomingOpenQuestions,
            }
          : current.awareness)
  const mergedSearchVectors =
    fieldPresence.search_vectors === false
      ? current.search_vectors
      : ((fieldPresence.search_vectors ?? incoming.search_vectors !== undefined)
          ? incomingSearchVectors
          : current.search_vectors)
  const mergedSearchVectorChanges = diffById(currentSearchVectors, mergedSearchVectors ?? [])
  const mergedAwarenessChanges = diffById(
    currentOpenQuestions,
    mergedAwareness?.open_questions ?? [],
  )

  const merged: ProfessionalIdentityV3 = {
    ...current,
    schema_revision: incoming.schema_revision ?? current.schema_revision,
    identity: incoming.identity,
    self_model: incoming.self_model,
    preferences: mergedPreferences,
    generator_rules: incoming.generator_rules,
    ...(mergedSearchVectors !== undefined
      ? { search_vectors: mergedSearchVectors }
      : {}),
    ...(mergedAwareness !== undefined
      ? { awareness: mergedAwareness }
      : {}),
    skills: {
      groups: skillGroups.items,
    },
    profiles: profiles.items,
    roles: roles.items,
    projects: projects.items,
    education: education.items,
  }

  const normalized = importProfessionalIdentity(merged)
  const details = [
    ...describeScalarReplacement('schema revision', current.schema_revision, incoming.schema_revision),
    ...describeScalarReplacement('identity core', current.identity, incoming.identity),
    ...describeScalarReplacement('self model', current.self_model, incoming.self_model),
    ...describeScalarReplacement('preferences', current.preferences, mergedPreferences),
    ...describeScalarReplacement('generator rules', current.generator_rules, incoming.generator_rules),
    ...describeIdChanges('skill groups', skillGroups.addedIds, skillGroups.updatedIds),
    ...describeIdChanges('profiles', profiles.addedIds, profiles.updatedIds),
    ...describeIdChanges('roles', roles.addedIds, roles.updatedIds),
    ...describeIdChanges('projects', projects.addedIds, projects.updatedIds),
    ...describeIdChanges('search vectors', mergedSearchVectorChanges.addedIds, mergedSearchVectorChanges.updatedIds),
    ...describeRemovedIds('search vectors', mergedSearchVectorChanges.removedIds),
    ...describeIdChanges('awareness items', mergedAwarenessChanges.addedIds, mergedAwarenessChanges.updatedIds),
    ...describeRemovedIds('awareness items', mergedAwarenessChanges.removedIds),
    ...(education.added > 0 ? [`Added ${education.added} education entr${education.added === 1 ? 'y' : 'ies'}.`] : []),
    ...(education.updated > 0 ? [`Updated ${education.updated} education entr${education.updated === 1 ? 'y' : 'ies'}.`] : []),
  ]

  return {
    data: normalized.data,
    warnings: normalized.warnings,
    summary: buildSummary(normalized.data, 'Merged identity draft'),
    details: details.length > 0 ? details : ['Merged draft without material changes.'],
  }
}
