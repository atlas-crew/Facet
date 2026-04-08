import {
  importProfessionalIdentity,
  type ProfessionalEducationEntry,
  type ProfessionalIdentityV3,
  type ProfessionalProfile,
  type ProfessionalProject,
  type ProfessionalRole,
  type ProfessionalSkillGroup,
} from '../identity/schema'
import type { IdentityApplyResult } from '../types/identity'

interface MergeByIdResult<T extends { id: string }> {
  items: T[]
  addedIds: string[]
  updatedIds: string[]
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

const describeScalarReplacement = <T>(
  label: string,
  current: T,
  incoming: T,
): string[] => (hasMeaningfulChange(current, incoming) ? [`Replaced ${label} from draft.`] : [])

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
): IdentityApplyResult => {
  // Merge semantics are intentionally asymmetric:
  // array sections merge by id or education fingerprint, while scalar sections
  // are replaced wholesale from the incoming draft.
  const skillGroups = mergeById<ProfessionalSkillGroup>(current.skills.groups, incoming.skills.groups)
  const profiles = mergeById<ProfessionalProfile>(current.profiles, incoming.profiles)
  const roles = mergeById<ProfessionalRole>(current.roles, incoming.roles)
  const projects = mergeById<ProfessionalProject>(current.projects, incoming.projects)
  const education = mergeEducation(current.education, incoming.education)

  const merged: ProfessionalIdentityV3 = {
    ...current,
    schema_revision: incoming.schema_revision,
    identity: incoming.identity,
    self_model: incoming.self_model,
    preferences: incoming.preferences,
    generator_rules: incoming.generator_rules,
    search_vectors: incoming.search_vectors,
    awareness: incoming.awareness,
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
    ...describeScalarReplacement('preferences', current.preferences, incoming.preferences),
    ...describeScalarReplacement('generator rules', current.generator_rules, incoming.generator_rules),
    ...describeScalarReplacement('search vectors', current.search_vectors, incoming.search_vectors),
    ...describeScalarReplacement('awareness', current.awareness, incoming.awareness),
    ...describeIdChanges('skill groups', skillGroups.addedIds, skillGroups.updatedIds),
    ...describeIdChanges('profiles', profiles.addedIds, profiles.updatedIds),
    ...describeIdChanges('roles', roles.addedIds, roles.updatedIds),
    ...describeIdChanges('projects', projects.addedIds, projects.updatedIds),
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
