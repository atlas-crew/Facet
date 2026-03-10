import { JSON_SCHEMA, dump, load } from 'js-yaml'
import type {
  BulletChar,
  ComponentPriority,
  ResumeData,
  ResumeThemePresetId,
  SectionHeaderStyle,
} from '../types'
import { ensureSkillGroupVectors } from '../utils/skillGroupVectors'
import {
  THEME_DATES_ALIGNMENT_OPTIONS,
  THEME_BULLET_OPTIONS,
  THEME_LEGACY_OVERRIDE_ALIASES,
  THEME_LEGACY_PRESET_ALIASES,
  THEME_PRESET_IDS,
  THEME_SECTION_HEADER_OPTIONS,
  THEME_TEXT_ALIGNMENT_OPTIONS,
  normalizeThemeState,
} from '../themes/theme'

export type ResumeConfigFormat = 'yaml' | 'json'

export interface ParsedResumeConfig {
  data: ResumeData
  format: ResumeConfigFormat
  warnings: string[]
}

const LEGACY_INCLUDED_PRIORITIES = new Set(['must', 'strong', 'optional'])
const THEME_PRESETS = new Set<ResumeThemePresetId>(THEME_PRESET_IDS)
const SECTION_HEADER_STYLES = new Set<SectionHeaderStyle>(THEME_SECTION_HEADER_OPTIONS)
const BULLET_CHARS = new Set<BulletChar>(THEME_BULLET_OPTIONS)
const TEXT_ALIGNMENTS = new Set(THEME_TEXT_ALIGNMENT_OPTIONS)
const DATES_ALIGNMENTS = new Set(THEME_DATES_ALIGNMENT_OPTIONS)
const FORBIDDEN_OBJECT_KEYS = new Set(['__proto__', 'prototype', 'constructor'])
const MAX_CONFIG_INPUT_CHARS = 500_000
const VECTOR_FALLBACK_COLORS = ['#2563EB', '#0D9488', '#7C3AED', '#EA580C', '#4F46E5', '#0891B2']
const THEME_NUMBER_BOUNDS: Record<string, { min: number; max: number }> = {
  sizeBody: { min: 7, max: 14 },
  sizeName: { min: 10, max: 28 },
  sizeSectionHeader: { min: 8, max: 16 },
  sizeRoleTitle: { min: 8, max: 16 },
  sizeCompanyName: { min: 8, max: 16 },
  sizeSmall: { min: 6, max: 12 },
  sizeContact: { min: 6, max: 12 },
  lineHeight: { min: 0.9, max: 1.8 },
  bulletGap: { min: 0, max: 12 },
  sectionGapBefore: { min: 0, max: 24 },
  sectionGapAfter: { min: 0, max: 12 },
  roleGap: { min: 0, max: 18 },
  roleLineGapAfter: { min: 0, max: 12 },
  paragraphGap: { min: 0, max: 12 },
  contactGapAfter: { min: 0, max: 12 },
  competencyGap: { min: 0, max: 8 },
  projectGap: { min: 0, max: 12 },
  marginTop: { min: 0.25, max: 2 },
  marginBottom: { min: 0.25, max: 2 },
  marginLeft: { min: 0.25, max: 2 },
  marginRight: { min: 0.25, max: 2 },
  sectionHeaderLetterSpacing: { min: 0, max: 8 },
  sectionRuleWeight: { min: 0, max: 3 },
  nameLetterSpacing: { min: 0, max: 8 },
  bulletIndent: { min: 0, max: 36 },
  bulletHanging: { min: 0, max: 24 },
  projectUrlSize: { min: 6, max: 12 },
}
const THEME_STRING_KEYS = new Set(['fontBody', 'fontHeading'])
const THEME_COLOR_KEYS = new Set([
  'colorBody',
  'colorHeading',
  'colorSection',
  'colorDim',
  'colorRule',
  'roleTitleColor',
  'datesColor',
  'subtitleColor',
  'competencyLabelColor',
  'projectUrlColor',
])
const THEME_BOOLEAN_KEYS = new Set([
  'nameBold',
  'roleTitleItalic',
  'subtitleItalic',
  'companyBold',
  'competencyLabelBold',
  'projectNameBold',
  'educationSchoolBold',
])
const THEME_ENUM_KEYS = new Set(['sectionHeaderStyle', 'bulletChar', 'nameAlignment', 'contactAlignment', 'datesAlignment'])
const THEME_VALID_OVERRIDE_KEYS = new Set([
  ...Object.keys(THEME_NUMBER_BOUNDS),
  ...THEME_STRING_KEYS,
  ...THEME_COLOR_KEYS,
  ...THEME_BOOLEAN_KEYS,
  ...THEME_ENUM_KEYS,
  ...Object.keys(THEME_LEGACY_OVERRIDE_ALIASES),
])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)

const assertRecord = (value: unknown, context: string): Record<string, unknown> => {
  if (!isRecord(value)) {
    throw new Error(`${context} must be an object.`)
  }

  for (const key of Object.keys(value)) {
    if (FORBIDDEN_OBJECT_KEYS.has(key)) {
      throw new Error(`${context} contains unsupported key "${key}".`)
    }
  }

  return value
}

const assertString = (value: unknown, context: string): string => {
  if (typeof value !== 'string') {
    throw new Error(`${context} must be a string.`)
  }

  return value
}

const assertNumber = (value: unknown, context: string): number => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`${context} must be a number.`)
  }

  return value
}

const assertArray = (value: unknown, context: string): unknown[] => {
  if (!Array.isArray(value)) {
    throw new Error(`${context} must be an array.`)
  }

  return value
}

const assertOptionalString = (value: unknown, context: string): string | undefined => {
  if (value === undefined || value === null) {
    return undefined
  }

  return assertString(value, context)
}

const assertBoolean = (value: unknown, context: string): boolean => {
  if (typeof value !== 'boolean') {
    throw new Error(`${context} must be a boolean.`)
  }
  return value
}

const normalizePriorityValue = (value: unknown): ComponentPriority | null => {
  if (value === 'exclude') {
    return 'exclude'
  }
  if (value === 'include' || LEGACY_INCLUDED_PRIORITIES.has(String(value))) {
    return 'include'
  }
  return null
}

const assertPriorityMap = (value: unknown, context: string): void => {
  const record = assertRecord(value, context)
  for (const [key, rawPriority] of Object.entries(record)) {
    if (!normalizePriorityValue(rawPriority)) {
      throw new Error(`${context}.${key} must be one of: include, exclude.`)
    }
  }
}

const assertUniqueId = (seen: Set<string>, id: string, context: string): void => {
  if (seen.has(id)) {
    throw new Error(`${context} has duplicate id "${id}".`)
  }
  seen.add(id)
}

const assertOptionalTextVariants = (value: unknown, context: string): void => {
  if (value === undefined || value === null) {
    return
  }

  const record = assertRecord(value, context)
  for (const [key, variant] of Object.entries(record)) {
    assertString(variant, `${context}.${key}`)
  }
}

const assertSkillOrderMap = (value: unknown, context: string): void => {
  const record = assertRecord(value, context)
  for (const [key, order] of Object.entries(record)) {
    if (order === undefined) {
      continue
    }

    assertNumber(order, `${context}.${key}`)
  }
}

const assertSkillVectorConfigMap = (value: unknown, context: string): void => {
  const record = assertRecord(value, context)
  for (const [key, rawConfig] of Object.entries(record)) {
    const config = assertRecord(rawConfig, `${context}.${key}`)
    if (!normalizePriorityValue(config.priority)) {
      throw new Error(`${context}.${key}.priority must be one of: include, exclude.`)
    }
    assertNumber(config.order, `${context}.${key}.order`)
    assertOptionalString(config.content, `${context}.${key}.content`)
  }
}

const assertRoleBulletOrderMap = (value: unknown, context: string): void => {
  const byRole = assertRecord(value, context)
  for (const [roleId, rawOrder] of Object.entries(byRole)) {
    const order = assertArray(rawOrder, `${context}.${roleId}`)
    for (const [index, bulletId] of order.entries()) {
      assertString(bulletId, `${context}.${roleId}[${index}]`)
    }
  }
}

const assertThemeOverrides = (value: unknown, context: string): void => {
  const overrides = assertRecord(value, context)

  for (const [key, rawValue] of Object.entries(overrides)) {
    if (!THEME_VALID_OVERRIDE_KEYS.has(key)) {
      throw new Error(`${context}.${key} is not a supported theme override.`)
    }

    if (THEME_STRING_KEYS.has(key)) {
      assertString(rawValue, `${context}.${key}`)
      continue
    }

    if (THEME_COLOR_KEYS.has(key)) {
      const color = assertString(rawValue, `${context}.${key}`)
      const normalizedColor = color.trim().replace(/^#/, '')
      if (!/^[0-9a-f]{6}$/i.test(normalizedColor)) {
        throw new Error(`${context}.${key} must be a 6-digit hex color.`)
      }
      continue
    }

    if (THEME_BOOLEAN_KEYS.has(key)) {
      assertBoolean(rawValue, `${context}.${key}`)
      continue
    }

    if (key === 'sectionHeaderStyle') {
      const style = assertString(rawValue, `${context}.${key}`)
      if (!SECTION_HEADER_STYLES.has(style as SectionHeaderStyle)) {
        throw new Error(`${context}.${key} must be one of: caps-rule, bold-rule, bold-only, underline.`)
      }
      continue
    }

    if (key === 'bulletChar') {
      const bulletChar = assertString(rawValue, `${context}.${key}`)
      if (!BULLET_CHARS.has(bulletChar as BulletChar)) {
        throw new Error(`${context}.${key} must be one of: •, –, ▸, none.`)
      }
      continue
    }

    if (key === 'nameAlignment' || key === 'contactAlignment') {
      const alignment = assertString(rawValue, `${context}.${key}`)
      if (!TEXT_ALIGNMENTS.has(alignment as (typeof THEME_TEXT_ALIGNMENT_OPTIONS)[number])) {
        throw new Error(`${context}.${key} must be one of: left, center, right.`)
      }
      continue
    }

    if (key === 'datesAlignment') {
      const alignment = assertString(rawValue, `${context}.${key}`)
      if (!DATES_ALIGNMENTS.has(alignment as (typeof THEME_DATES_ALIGNMENT_OPTIONS)[number])) {
        throw new Error(`${context}.${key} must be one of: right-tab, inline.`)
      }
      continue
    }

    const normalizedKey = key in THEME_LEGACY_OVERRIDE_ALIASES ? THEME_LEGACY_OVERRIDE_ALIASES[key] : key
    const bounds = THEME_NUMBER_BOUNDS[normalizedKey]
    if (!bounds) {
      throw new Error(`${context}.${key} is not a supported theme override.`)
    }
    const numericValue = assertNumber(rawValue, `${context}.${key}`)
    if (numericValue < bounds.min || numericValue > bounds.max) {
      throw new Error(`${context}.${key} must be between ${bounds.min} and ${bounds.max}.`)
    }
  }
}

const assertThemeShape = (value: unknown, context: string): void => {
  const theme = assertRecord(value, context)
  const preset = assertString(theme.preset, `${context}.preset`)
  const normalizedPreset = preset in THEME_LEGACY_PRESET_ALIASES ? THEME_LEGACY_PRESET_ALIASES[preset] : preset
  if (!THEME_PRESETS.has(normalizedPreset as ResumeThemePresetId)) {
    throw new Error(`${context}.preset must be one of: ${THEME_PRESET_IDS.join(', ')}.`)
  }

  if (theme.overrides !== undefined) {
    assertThemeOverrides(theme.overrides, `${context}.overrides`)
  }
}

function assertResumeDataShape(value: unknown): asserts value is ResumeData {
  const root = assertRecord(value, 'Resume data')
  assertNumber(root.version, 'version')

  const meta = assertRecord(root.meta, 'meta')
  assertString(meta.name, 'meta.name')
  assertString(meta.email, 'meta.email')
  assertString(meta.phone, 'meta.phone')
  assertString(meta.location, 'meta.location')
  if (root.theme !== undefined) {
    assertThemeShape(root.theme, 'theme')
  }

  const links = assertArray(meta.links, 'meta.links')
  for (const [index, link] of links.entries()) {
    const linkRecord = assertRecord(link, `meta.links[${index}]`)
    if (linkRecord.label !== undefined) {
      assertString(linkRecord.label, `meta.links[${index}].label`)
    }
    assertString(linkRecord.url, `meta.links[${index}].url`)
  }

  const vectors = assertArray(root.vectors, 'vectors')
  const vectorIds = new Set<string>()
  for (const [index, vector] of vectors.entries()) {
    const vectorRecord = assertRecord(vector, `vectors[${index}]`)
    const id = assertString(vectorRecord.id, `vectors[${index}].id`)
    assertUniqueId(vectorIds, id, `vectors[${index}]`)
    assertString(vectorRecord.label, `vectors[${index}].label`)
    assertString(vectorRecord.color, `vectors[${index}].color`)
  }

  const targetLines = assertArray(root.target_lines, 'target_lines')
  const targetLineIds = new Set<string>()
  for (const [index, targetLine] of targetLines.entries()) {
    const record = assertRecord(targetLine, `target_lines[${index}]`)
    const id = assertString(record.id, `target_lines[${index}].id`)
    assertUniqueId(targetLineIds, id, `target_lines[${index}]`)
    assertString(record.text, `target_lines[${index}].text`)
    assertPriorityMap(record.vectors, `target_lines[${index}].vectors`)
    assertOptionalTextVariants(record.variants, `target_lines[${index}].variants`)
  }

  const profiles = assertArray(root.profiles, 'profiles')
  const profileIds = new Set<string>()
  for (const [index, profile] of profiles.entries()) {
    const record = assertRecord(profile, `profiles[${index}]`)
    const id = assertString(record.id, `profiles[${index}].id`)
    assertUniqueId(profileIds, id, `profiles[${index}]`)
    assertString(record.text, `profiles[${index}].text`)
    assertPriorityMap(record.vectors, `profiles[${index}].vectors`)
    assertOptionalTextVariants(record.variants, `profiles[${index}].variants`)
  }

  const skillGroups = assertArray(root.skill_groups, 'skill_groups')
  const skillGroupIds = new Set<string>()
  for (const [index, skillGroup] of skillGroups.entries()) {
    const record = assertRecord(skillGroup, `skill_groups[${index}]`)
    const id = assertString(record.id, `skill_groups[${index}].id`)
    assertUniqueId(skillGroupIds, id, `skill_groups[${index}]`)
    assertString(record.label, `skill_groups[${index}].label`)
    assertString(record.content, `skill_groups[${index}].content`)
    if (record.order !== undefined) {
      assertSkillOrderMap(record.order, `skill_groups[${index}].order`)
    }
    if (record.vectors !== undefined) {
      assertSkillVectorConfigMap(record.vectors, `skill_groups[${index}].vectors`)
    }
  }

  const roles = assertArray(root.roles, 'roles')
  const roleIds = new Set<string>()
  const bulletIds = new Set<string>()
  for (const [roleIndex, role] of roles.entries()) {
    const record = assertRecord(role, `roles[${roleIndex}]`)
    const roleId = assertString(record.id, `roles[${roleIndex}].id`)
    assertUniqueId(roleIds, roleId, `roles[${roleIndex}]`)
    assertString(record.company, `roles[${roleIndex}].company`)
    assertString(record.title, `roles[${roleIndex}].title`)
    assertString(record.dates, `roles[${roleIndex}].dates`)
    assertOptionalString(record.location, `roles[${roleIndex}].location`)
    assertOptionalString(record.subtitle, `roles[${roleIndex}].subtitle`)

    const bullets = assertArray(record.bullets, `roles[${roleIndex}].bullets`)
    for (const [bulletIndex, bullet] of bullets.entries()) {
      const bulletRecord = assertRecord(bullet, `roles[${roleIndex}].bullets[${bulletIndex}]`)
      const bulletId = assertString(bulletRecord.id, `roles[${roleIndex}].bullets[${bulletIndex}].id`)
      assertUniqueId(bulletIds, bulletId, `roles[${roleIndex}].bullets[${bulletIndex}]`)
      assertOptionalString(bulletRecord.label, `roles[${roleIndex}].bullets[${bulletIndex}].label`)
      assertString(bulletRecord.text, `roles[${roleIndex}].bullets[${bulletIndex}].text`)
      assertPriorityMap(
        bulletRecord.vectors,
        `roles[${roleIndex}].bullets[${bulletIndex}].vectors`,
      )
      assertOptionalTextVariants(
        bulletRecord.variants,
        `roles[${roleIndex}].bullets[${bulletIndex}].variants`,
      )
    }
  }

  const projects = assertArray(root.projects, 'projects')
  const projectIds = new Set<string>()
  for (const [index, project] of projects.entries()) {
    const record = assertRecord(project, `projects[${index}]`)
    const id = assertString(record.id, `projects[${index}].id`)
    assertUniqueId(projectIds, id, `projects[${index}]`)
    assertString(record.name, `projects[${index}].name`)
    assertOptionalString(record.url, `projects[${index}].url`)
    assertString(record.text, `projects[${index}].text`)
    assertPriorityMap(record.vectors, `projects[${index}].vectors`)
    assertOptionalTextVariants(record.variants, `projects[${index}].variants`)
  }

  const education = assertArray(root.education, 'education')
  const educationIds = new Set<string>()
  for (const [index, entry] of education.entries()) {
    const record = assertRecord(entry, `education[${index}]`)
    if (record.id !== undefined) {
      const id = assertString(record.id, `education[${index}].id`)
      assertUniqueId(educationIds, id, `education[${index}]`)
    }
    assertString(record.school, `education[${index}].school`)
    assertString(record.location, `education[${index}].location`)
    assertString(record.degree, `education[${index}].degree`)
    if (record.year !== undefined) assertString(record.year, `education[${index}].year`)
    if (record.vectors !== undefined) {
      assertPriorityMap(record.vectors, `education[${index}].vectors`)
    }
  }

  const certifications = assertArray(root.certifications ?? [], 'certifications')
  const certificationIds = new Set<string>()
  for (const [index, cert] of certifications.entries()) {
    const record = assertRecord(cert, `certifications[${index}]`)
    const id = assertString(record.id, `certifications[${index}].id`)
    assertUniqueId(certificationIds, id, `certifications[${index}]`)
    assertString(record.name, `certifications[${index}].name`)
    assertString(record.issuer, `certifications[${index}].issuer`)
    assertOptionalString(record.date, `certifications[${index}].date`)
    assertOptionalString(record.credential_id, `certifications[${index}].credential_id`)
    assertOptionalString(record.url, `certifications[${index}].url`)
    assertPriorityMap(record.vectors, `certifications[${index}].vectors`)
  }

  if (root.manualOverrides !== undefined) {
    const manualOverrides = assertRecord(root.manualOverrides, 'manualOverrides')
    for (const [vectorKey, vectorMap] of Object.entries(manualOverrides)) {
      const record = assertRecord(vectorMap, `manualOverrides.${vectorKey}`)
      for (const [key, value] of Object.entries(record)) {
        assertBoolean(value, `manualOverrides.${vectorKey}.${key}`)
      }
    }
  }

  if (root.bulletOrders !== undefined) {
    const bulletOrders = assertRecord(root.bulletOrders, 'bulletOrders')
    for (const [vectorKey, vectorMap] of Object.entries(bulletOrders)) {
      assertRoleBulletOrderMap(vectorMap, `bulletOrders.${vectorKey}`)
    }
  }

  // Accept both "presets" and legacy "saved_variants" field name
  const rawPresets = root.presets ?? root.saved_variants
  if (rawPresets !== undefined) {
    const presetList = assertArray(rawPresets, 'presets')
    const presetIds = new Set<string>()
    for (const [index, preset] of presetList.entries()) {
      const record = assertRecord(preset, `presets[${index}]`)
      const id = assertString(record.id, `presets[${index}].id`)
      assertUniqueId(presetIds, id, `presets[${index}]`)
      assertString(record.name, `presets[${index}].name`)
      assertOptionalString(record.description, `presets[${index}].description`)
      assertString(record.createdAt, `presets[${index}].createdAt`)
      assertString(record.updatedAt, `presets[${index}].updatedAt`)
      assertString(record.baseVector, `presets[${index}].baseVector`)

      const overrides = assertRecord(record.overrides, `presets[${index}].overrides`)
      const manualOverrides = assertRecord(
        overrides.manualOverrides,
        `presets[${index}].overrides.manualOverrides`,
      )
      for (const [key, rawValue] of Object.entries(manualOverrides)) {
        assertBoolean(rawValue, `presets[${index}].overrides.manualOverrides.${key}`)
      }

      assertRoleBulletOrderMap(
        overrides.bulletOrders,
        `presets[${index}].overrides.bulletOrders`,
      )

      if (overrides.priorityOverrides !== undefined) {
        const priorityOverrides = assertArray(
          overrides.priorityOverrides,
          `presets[${index}].overrides.priorityOverrides`,
        )
        for (const [overrideIndex, override] of priorityOverrides.entries()) {
          const priorityOverride = assertRecord(
            override,
            `presets[${index}].overrides.priorityOverrides[${overrideIndex}]`,
          )
          assertString(
            priorityOverride.bulletId,
            `presets[${index}].overrides.priorityOverrides[${overrideIndex}].bulletId`,
          )
          assertString(
            priorityOverride.vectorId,
            `presets[${index}].overrides.priorityOverrides[${overrideIndex}].vectorId`,
          )
          const priority = assertString(
            priorityOverride.priority,
            `presets[${index}].overrides.priorityOverrides[${overrideIndex}].priority`,
          )
          if (!normalizePriorityValue(priority)) {
            throw new Error(
              `presets[${index}].overrides.priorityOverrides[${overrideIndex}].priority must be one of: include, exclude.`,
            )
          }
        }
      }
      if (overrides.theme !== undefined) {
        assertThemeShape(overrides.theme, `presets[${index}].overrides.theme`)
      }
      assertOptionalString(overrides.targetLineId, `presets[${index}].overrides.targetLineId`)
      assertOptionalString(overrides.profileId, `presets[${index}].overrides.profileId`)

      if (overrides.skillGroupOrder !== undefined) {
        const skillOrder = assertArray(
          overrides.skillGroupOrder,
          `presets[${index}].overrides.skillGroupOrder`,
        )
        for (const [skillIndex, skillId] of skillOrder.entries()) {
          assertString(skillId, `presets[${index}].overrides.skillGroupOrder[${skillIndex}]`)
        }
      }
    }
  }

  if (root.meta && isRecord(root.meta) && String(root.meta.name ?? '').trim().length === 0) {
    throw new Error('meta.name is required.')
  }

  const hasRoleWithBullet = roles.some((role) => {
    const record = assertRecord(role, 'roles[]')
    const bullets = assertArray(record.bullets, 'roles[].bullets')
    return bullets.length > 0
  })
  if (!hasRoleWithBullet) {
    throw new Error('At least one role must include at least one bullet.')
  }
}

const detectFormat = (raw: string): ResumeConfigFormat =>
  raw.startsWith('{') || raw.startsWith('[') ? 'json' : 'yaml'

const toLabel = (id: string): string =>
  id
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase()) || id

const collectWarningsAndNormalizeVectors = (data: ResumeData): { data: ResumeData; warnings: string[] } => {
  const warnings: string[] = []
  const vectors = [...data.vectors]
  const knownVectorIds = new Set(vectors.map((vector) => vector.id))
  const referencedVectorIds = new Set<string>()

  const collectPriorityMapKeys = (map: Record<string, unknown>, context: string) => {
    const keys = Object.keys(map)
    if (keys.length === 0) {
      warnings.push(`${context} has no vector priorities configured.`)
    }
    for (const key of keys) {
      referencedVectorIds.add(key)
    }
  }

  for (const targetLine of data.target_lines) {
    collectPriorityMapKeys(targetLine.vectors, `target_lines.${targetLine.id}`)
    if (targetLine.text.trim().length === 0) {
      warnings.push(`target_lines.${targetLine.id} has empty text.`)
    }
  }
  for (const profile of data.profiles) {
    collectPriorityMapKeys(profile.vectors, `profiles.${profile.id}`)
    if (profile.text.trim().length === 0) {
      warnings.push(`profiles.${profile.id} has empty text.`)
    }
  }
  for (const role of data.roles) {
    for (const bullet of role.bullets) {
      collectPriorityMapKeys(bullet.vectors, `roles.${role.id}.bullets.${bullet.id}`)
      if (bullet.text.trim().length === 0) {
        warnings.push(`roles.${role.id}.bullets.${bullet.id} has empty text.`)
      }
    }
  }
  for (const project of data.projects) {
    collectPriorityMapKeys(project.vectors, `projects.${project.id}`)
    if (project.text.trim().length === 0) {
      warnings.push(`projects.${project.id} has empty text.`)
    }
  }
  for (const entry of data.education) {
    if (entry.vectors && Object.keys(entry.vectors).length > 0) {
      collectPriorityMapKeys(entry.vectors, `education.${entry.id}`)
    }
  }
  for (const cert of data.certifications ?? []) {
    collectPriorityMapKeys(cert.vectors, `certifications.${cert.id}`)
  }
  for (const skillGroup of data.skill_groups) {
    if (skillGroup.content.trim().length === 0) {
      warnings.push(`skill_groups.${skillGroup.id} has empty content.`)
    }

    if (skillGroup.vectors) {
      const keys = Object.keys(skillGroup.vectors)
      if (keys.length === 0) {
        warnings.push(`skill_groups.${skillGroup.id} has no vector settings.`)
      }
      for (const key of keys) {
        referencedVectorIds.add(key)
      }
    } else if (skillGroup.order) {
      const keys = Object.keys(skillGroup.order).filter((key) => key !== 'default')
      if (keys.length === 0) {
        warnings.push(`skill_groups.${skillGroup.id} has no vector settings.`)
      }
      for (const key of keys) {
        referencedVectorIds.add(key)
      }
    } else {
      warnings.push(`skill_groups.${skillGroup.id} has no vector settings.`)
    }
  }

  let colorIndex = vectors.length
  for (const vectorId of referencedVectorIds) {
    if (knownVectorIds.has(vectorId)) {
      continue
    }

    vectors.push({
      id: vectorId,
      label: toLabel(vectorId),
      color: VECTOR_FALLBACK_COLORS[colorIndex % VECTOR_FALLBACK_COLORS.length] ?? '#2563EB',
    })
    knownVectorIds.add(vectorId)
    colorIndex += 1
    warnings.push(`Auto-created missing vector "${vectorId}" from component references.`)
  }

  return {
    data: {
      ...data,
      theme: normalizeThemeState(data.theme),
      vectors,
      certifications: data.certifications ?? [],
      skill_groups: data.skill_groups.map((skillGroup) => ({
        ...skillGroup,
        vectors: ensureSkillGroupVectors(skillGroup, vectors),
      })),
      presets: (data.presets ?? []).map((preset) => ({
        ...preset,
        overrides: {
          ...preset.overrides,
          ...(preset.overrides.theme ? { theme: normalizeThemeState(preset.overrides.theme) } : {}),
        },
      })),
    },
    warnings,
  }
}

const normalizePriorityMap = (map: Record<string, unknown> | undefined): Record<string, ComponentPriority> => {
  if (!map) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(map)
      .map(([key, value]) => {
        const normalized = normalizePriorityValue(value)
        return normalized ? [key, normalized] : null
      })
      .filter((entry): entry is [string, ComponentPriority] => entry !== null),
  )
}

const normalizeResumePriorities = (data: ResumeData): ResumeData => ({
  ...data,
  target_lines: data.target_lines.map((line) => ({
    ...line,
    vectors: normalizePriorityMap(line.vectors),
  })),
  profiles: data.profiles.map((profile) => ({
    ...profile,
    vectors: normalizePriorityMap(profile.vectors),
  })),
  skill_groups: data.skill_groups.map((group) => ({
    ...group,
    vectors: group.vectors
      ? Object.fromEntries(
          Object.entries(group.vectors).map(([vectorId, config]) => [
            vectorId,
            {
              ...config,
              priority: normalizePriorityValue(config.priority) ?? 'exclude',
            },
          ]),
        )
      : group.vectors,
  })),
  roles: data.roles.map((role) => ({
    ...role,
    bullets: role.bullets.map((bullet) => ({
      ...bullet,
      vectors: normalizePriorityMap(bullet.vectors),
    })),
  })),
  projects: data.projects.map((project) => ({
    ...project,
    vectors: normalizePriorityMap(project.vectors),
  })),
  education: data.education.map((entry) => ({
    ...entry,
    vectors: normalizePriorityMap(entry.vectors),
  })),
  certifications: (data.certifications ?? []).map((cert) => ({
    ...cert,
    vectors: normalizePriorityMap(cert.vectors),
  })),
  presets: (data.presets ?? []).map((preset) => ({
    ...preset,
    overrides: {
      ...preset.overrides,
      priorityOverrides: preset.overrides.priorityOverrides?.map((override) => ({
        ...override,
        priority: normalizePriorityValue(override.priority) ?? 'exclude',
      })),
    },
  })),
})

const extractContextPath = (message: string): string | null => {
  const match = message.match(/^([a-z0-9_[\].]+)\s/i)
  return match?.[1] ?? null
}

const contextToSearchToken = (context: string): string => {
  const parts = context.split('.')
  const tail = parts[parts.length - 1] ?? context
  return tail.replace(/\[\d+\]/g, '')
}

const approximateLineNumber = (raw: string, token: string): number | null => {
  if (!token) {
    return null
  }

  const quotedToken = `"${token.replace(/"/g, '\\"')}"`
  const tokenIndex = raw.indexOf(quotedToken)
  if (tokenIndex === -1) {
    return null
  }

  return raw.slice(0, tokenIndex).split('\n').length
}

export const importResumeConfig = (
  input: string,
  expectedFormat?: ResumeConfigFormat,
): ParsedResumeConfig => {
  const raw = input.trim()
  if (raw.length === 0) {
    throw new Error('Resume config input is empty.')
  }
  if (raw.length > MAX_CONFIG_INPUT_CHARS) {
    throw new Error(`Resume config input is too large (max ${MAX_CONFIG_INPUT_CHARS} characters).`)
  }

  const format = expectedFormat ?? detectFormat(raw)

  let parsed: unknown
  try {
    parsed = format === 'json' ? JSON.parse(raw) : load(raw, { schema: JSON_SCHEMA })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to parse ${format.toUpperCase()}: ${detail}`)
  }

  // Normalize legacy "saved_variants" field name to "presets"
  if (parsed && typeof parsed === 'object' && 'saved_variants' in (parsed as Record<string, unknown>)) {
    const record = parsed as Record<string, unknown>
    if (record.presets === undefined) {
      record.presets = record.saved_variants
    }
    delete record.saved_variants
  }

  try {
    assertResumeDataShape(parsed)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    const context = extractContextPath(detail)
    const token = context ? contextToSearchToken(context) : ''
    const line = approximateLineNumber(raw, token)
    const suffix = line ? ` (approx line ${line})` : ''
    throw new Error(`${detail}${suffix}`)
  }

  const normalized = collectWarningsAndNormalizeVectors(normalizeResumePriorities(parsed as ResumeData))
  return {
    data: normalized.data,
    format,
    warnings: normalized.warnings,
  }
}

export const exportResumeConfig = (
  data: ResumeData,
  format: ResumeConfigFormat = 'yaml',
): string => {
  if (format === 'json') {
    return JSON.stringify(data, null, 2)
  }

  return dump(data, {
    lineWidth: 110,
    noRefs: true,
    sortKeys: false,
  })
}
