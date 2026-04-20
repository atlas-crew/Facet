export type ProfessionalSchemaRevision = '3.1'

export type ProfessionalSkillDepth =
  | 'expert'
  | 'strong'
  | 'hands-on-working'
  | 'architectural'
  | 'conceptual'
  | 'working'
  | 'basic'
  | 'avoid'

export type ProfessionalSkillEnrichedBy = 'user' | 'user-edited-llm' | 'llm-accepted'

export type ProfessionalSkillDepthSource = 'inferred' | 'corrected'

export type ProfessionalAwarenessSeverity = 'high' | 'medium' | 'low'

export type ProfessionalMatchingWeight = 'high' | 'medium' | 'low'

export type ProfessionalMatchingSeverity = 'hard' | 'soft' | 'conditional'

export type ProfessionalSearchVectorPriority = 'high' | 'medium' | 'low'

export interface ProfessionalIdentityLink {
  id: string
  url: string
}

export interface ProfessionalIdentityCore {
  name: string
  display_name?: string
  email: string
  phone: string
  location: string
  remote?: boolean
  title?: string
  links: ProfessionalIdentityLink[]
  thesis: string
  elaboration?: string
  origin?: string
}

export interface ProfessionalIdentityArcEntry {
  company: string
  chapter: string
}

export interface ProfessionalPhilosophyEntry {
  id: string
  text: string
  tags: string[]
}

export interface ProfessionalInterviewStyle {
  strengths: string[]
  weaknesses: string[]
  prep_strategy: string
}

export interface ProfessionalSelfModel {
  arc: ProfessionalIdentityArcEntry[]
  philosophy: ProfessionalPhilosophyEntry[]
  interview_style: ProfessionalInterviewStyle
}

export interface ProfessionalPreferencePriority {
  item: string
  weight: string
  notes?: string
}

export interface ProfessionalCompensationPreferences {
  base_floor?: number
  base_target?: number
  notes?: string
  priorities: ProfessionalPreferencePriority[]
}

export interface ProfessionalWorkModelPreferences {
  preference: string
  flexibility?: string
  hard_no?: string
}

export interface ProfessionalMatchingPriority {
  id: string
  label: string
  description: string
  weight: ProfessionalMatchingWeight
  condition?: string
}

export interface ProfessionalMatchingAvoid {
  id: string
  label: string
  description: string
  severity: ProfessionalMatchingSeverity
  condition?: string
}

export interface ProfessionalMatchingPreferences {
  prioritize: ProfessionalMatchingPriority[]
  avoid: ProfessionalMatchingAvoid[]
}

export interface ProfessionalClearanceConstraint {
  status: string
  willing_to_obtain?: boolean
  exclude_required?: boolean
}

export interface ProfessionalEducationConstraint {
  highest: string
  in_progress?: string
  show_on_resume?: boolean
  filter_risk?: string
}

export interface ProfessionalPreferenceConstraints {
  clearance?: ProfessionalClearanceConstraint
  education?: ProfessionalEducationConstraint
  title_flexibility?: string[]
}

export interface ProfessionalInterviewProcessPreferences {
  accepted_formats: string[]
  strong_fit_signals: string[]
  red_flags: string[]
  max_rounds?: number
  onsite_preferences?: string
}

export interface ProfessionalPreferences {
  compensation: ProfessionalCompensationPreferences
  work_model: ProfessionalWorkModelPreferences
  constraints?: ProfessionalPreferenceConstraints
  interview_process?: ProfessionalInterviewProcessPreferences
  matching: ProfessionalMatchingPreferences
}

export interface ProfessionalSkillItem {
  name: string
  depth?: ProfessionalSkillDepth
  /**
   * Provenance of `depth`. Writeback precedence: user correction > explicit schema value > AI inference.
   * When `'corrected'`, downstream regeneration flows (resume re-scan, identity re-extract) must not
   * overwrite `depth`. When `'inferred'` or absent, inference/heuristics may replace the value.
   */
  depthSource?: ProfessionalSkillDepthSource
  context?: string
  context_stale?: boolean
  positioning?: string
  positioning_stale?: boolean
  tags: string[]
  enriched_at?: string
  enriched_by?: ProfessionalSkillEnrichedBy
  skipped_at?: string
}

export interface ProfessionalSkillGroup {
  id: string
  label: string
  positioning?: string
  calibration?: string
  is_differentiator?: boolean
  items: ProfessionalSkillItem[]
}

export interface ProfessionalSkills {
  groups: ProfessionalSkillGroup[]
}

export interface ProfessionalProfile {
  id: string
  tags: string[]
  text: string
}

export interface ProfessionalRoleBullet {
  id: string
  problem: string
  action: string
  outcome: string
  impact: string[]
  metrics: Record<string, string | number | boolean>
  technologies: string[]
  source_text?: string
  portfolio_dive?: string | null
  tags: string[]
}

export interface ProfessionalRole {
  id: string
  company: string
  subtitle?: string | null
  title: string
  dates: string
  portfolio_anchor?: string | null
  bullets: ProfessionalRoleBullet[]
}

export interface ProfessionalProject {
  id: string
  name: string
  url?: string
  description: string
  portfolio_dive?: string | null
  tags: string[]
}

export interface ProfessionalEducationEntry {
  school: string
  location: string
  degree: string
  year?: string
}

export interface ProfessionalGeneratorRules {
  voice_skill: string
  resume_skill: string
  accuracy?: Record<string, string | string[]>
}

export interface ProfessionalSearchVectorKeywords {
  primary: string[]
  secondary: string[]
}

export interface ProfessionalSearchVector {
  id: string
  title: string
  priority: ProfessionalSearchVectorPriority
  subtitle?: string
  thesis: string
  target_roles: string[]
  keywords: ProfessionalSearchVectorKeywords
  supporting_skills?: string[]
  supporting_bullets?: string[]
  evidence?: string[]
  needs_review?: boolean
}

export interface ProfessionalOpenQuestion {
  id: string
  topic: string
  description: string
  action: string
  severity?: ProfessionalAwarenessSeverity
  evidence?: string[]
  needs_review?: boolean
}

export interface ProfessionalAwareness {
  open_questions: ProfessionalOpenQuestion[]
}

export interface ProfessionalIdentityV3 {
  $schema?: string
  version: 3
  schema_revision: ProfessionalSchemaRevision
  /**
   * Monotonic content-revision counter. Bumps on every mutation to the identity model.
   * Consumed by downstream artifacts (search theses, runs, prep decks, cover letters) to
   * detect staleness. Distinct from `version` (schema major version) and `schema_revision`.
   */
  model_revision: number
  identity: ProfessionalIdentityCore
  self_model: ProfessionalSelfModel
  preferences: ProfessionalPreferences
  skills: ProfessionalSkills
  profiles: ProfessionalProfile[]
  roles: ProfessionalRole[]
  projects: ProfessionalProject[]
  education: ProfessionalEducationEntry[]
  generator_rules: ProfessionalGeneratorRules
  search_vectors?: ProfessionalSearchVector[]
  awareness?: ProfessionalAwareness
}

export type ProfessionalIdentityDocument = ProfessionalIdentityV3

const FORBIDDEN_OBJECT_KEYS = new Set(['__proto__', 'prototype', 'constructor'])
const SKILL_DEPTH_VALUES = new Set<ProfessionalSkillDepth>([
  'expert',
  'strong',
  'hands-on-working',
  'architectural',
  'conceptual',
  'working',
  'basic',
  'avoid',
])
const ENRICHED_BY_VALUES = new Set<ProfessionalSkillEnrichedBy>([
  'user',
  'user-edited-llm',
  'llm-accepted',
])
const DEPTH_SOURCE_VALUES = new Set<ProfessionalSkillDepthSource>(['inferred', 'corrected'])
export const MATCHING_WEIGHT_VALUES = new Set<ProfessionalMatchingWeight>(['high', 'medium', 'low'])
export const MATCHING_SEVERITY_VALUES = new Set<ProfessionalMatchingSeverity>(['hard', 'soft', 'conditional'])
export const AWARENESS_SEVERITY_VALUES = new Set<ProfessionalAwarenessSeverity>(['high', 'medium', 'low'])
export const SEARCH_VECTOR_PRIORITY_VALUES = new Set<ProfessionalSearchVectorPriority>(['high', 'medium', 'low'])
const SCHEMA_REVISION_VALUES = new Set<ProfessionalSchemaRevision>(['3.1'])

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

export const normalizeRuntimeIdentitySchemaRevision = <T>(value: T): T => {
  if (!isRecord(value) || value.schema_revision !== 3.1) {
    return value
  }

  return {
    ...value,
    schema_revision: '3.1',
    // This runtime repair intentionally narrows stale numeric persisted data
    // into the canonical ProfessionalIdentity schema revision string.
  } as T
}

export const normalizeRuntimeProfessionalIdentity = (
  identity: ProfessionalIdentityV3,
): ProfessionalIdentityV3 => {
  const normalizedIdentity = normalizeRuntimeIdentitySchemaRevision(identity)
  // Migrate persisted state: older identities predate model_revision; start the counter at 0.
  const withRevision: ProfessionalIdentityV3 =
    typeof (normalizedIdentity as ProfessionalIdentityV3).model_revision === 'number'
      ? normalizedIdentity
      : { ...normalizedIdentity, model_revision: 0 }
  const groups = (withRevision.skills as { groups?: ProfessionalIdentityV3['skills']['groups'] } | undefined)
    ?.groups

  if (!Array.isArray(groups)) {
    return withRevision
  }

  return {
    ...withRevision,
    skills: {
      ...withRevision.skills,
      groups: groups.map((group) => ({
        ...group,
        items: group.items.map((item) => {
          const { search_signal: legacyPositioning, ...rest } = item as ProfessionalSkillItem & {
            search_signal?: string
          }

          return {
            ...rest,
            ...(rest.positioning !== undefined
              ? { positioning: rest.positioning }
              : legacyPositioning !== undefined
                ? { positioning: legacyPositioning }
                : {}),
            // Legacy depth values predate provenance tracking. Mark as inferred so future
            // regeneration may overwrite them; explicit corrections land as 'corrected'.
            ...(rest.depth !== undefined && rest.depthSource === undefined
              ? { depthSource: 'inferred' as ProfessionalSkillDepthSource }
              : {}),
          }
        }),
      })),
    },
  }
}

const assertArray = (value: unknown, context: string): unknown[] => {
  if (!Array.isArray(value)) {
    throw new Error(`${context} must be an array.`)
  }

  return value
}

const assertString = (value: unknown, context: string): string => {
  if (typeof value !== 'string') {
    throw new Error(`${context} must be a string.`)
  }

  return value
}

const assertOptionalString = (value: unknown, context: string): string | undefined => {
  if (value === undefined || value === null) {
    return undefined
  }

  return assertString(value, context)
}

const assertOptionalNullableString = (value: unknown, context: string): string | null | undefined => {
  if (value === undefined) {
    return undefined
  }

  if (value === null) {
    return null
  }

  return assertString(value, context)
}

const assertNumber = (value: unknown, context: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${context} must be a number.`)
  }

  return value
}

const assertBoolean = (value: unknown, context: string): boolean => {
  if (typeof value !== 'boolean') {
    throw new Error(`${context} must be a boolean.`)
  }

  return value
}

const assertOptionalBoolean = (value: unknown, context: string): boolean | undefined => {
  if (value === undefined || value === null) {
    return undefined
  }

  return assertBoolean(value, context)
}

const assertStringArray = (value: unknown, context: string): string[] =>
  assertArray(value, context).map((entry, index) => assertString(entry, `${context}[${index}]`))

const assertEnumString = <T extends string>(
  value: unknown,
  allowedValues: Set<T>,
  context: string,
): T => {
  const parsed = assertString(value, context) as T
  if (!allowedValues.has(parsed)) {
    throw new Error(`${context} must be one of ${Array.from(allowedValues).join(', ')}.`)
  }
  return parsed
}

const assertOptionalEnumString = <T extends string>(
  value: unknown,
  allowedValues: Set<T>,
  context: string,
): T | undefined => {
  if (value === undefined || value === null) {
    return undefined
  }

  return assertEnumString(value, allowedValues, context)
}

const normalizeTagArray = (value: unknown, context: string, warnings: string[]): string[] => {
  const tags = assertStringArray(value, context)
  const normalized: string[] = []
  const seen = new Set<string>()

  for (const rawTag of tags) {
    const tag = rawTag.trim().toLowerCase()
    if (!tag) {
      warnings.push(`${context} contained an empty tag that was removed.`)
      continue
    }

    if (seen.has(tag)) {
      warnings.push(`${context} contained duplicate tag "${tag}" that was deduplicated.`)
      continue
    }

    seen.add(tag)
    normalized.push(tag)
  }

  return normalized
}

const assertUniqueId = (seen: Set<string>, id: string, context: string): void => {
  if (seen.has(id)) {
    throw new Error(`${context} has duplicate id "${id}".`)
  }

  seen.add(id)
}

export const stubAwareness = (): ProfessionalAwareness => ({
  open_questions: [],
})

export const looksLikeProfessionalIdentity = (value: unknown): boolean => {
  if (!isRecord(value)) {
    return false
  }

  return (
    value.version === 3 &&
    'identity' in value &&
    'self_model' in value &&
    'preferences' in value &&
    'skills' in value &&
    'profiles' in value &&
    'roles' in value &&
    'projects' in value &&
    'education' in value &&
    'generator_rules' in value
  )
}

const parseMatchingPreferences = (
  value: unknown,
  context: string,
): ProfessionalMatchingPreferences => {
  const record = assertRecord(value, context)
  const prioritizeIds = new Set<string>()
  const avoidIds = new Set<string>()

  return {
    prioritize: assertArray(record.prioritize, `${context}.prioritize`).map((entry, index) => {
      const item = assertRecord(entry, `${context}.prioritize[${index}]`)
      const id = assertString(item.id, `${context}.prioritize[${index}].id`)
      assertUniqueId(prioritizeIds, id, `${context}.prioritize`)
      return {
        id,
        label: assertString(item.label, `${context}.prioritize[${index}].label`),
        description: assertString(item.description, `${context}.prioritize[${index}].description`),
        weight: assertEnumString(
          item.weight,
          MATCHING_WEIGHT_VALUES,
          `${context}.prioritize[${index}].weight`,
        ),
        ...(item.condition !== undefined
          ? { condition: assertOptionalString(item.condition, `${context}.prioritize[${index}].condition`) }
          : {}),
      }
    }),
    avoid: assertArray(record.avoid, `${context}.avoid`).map((entry, index) => {
      const item = assertRecord(entry, `${context}.avoid[${index}]`)
      const id = assertString(item.id, `${context}.avoid[${index}].id`)
      assertUniqueId(avoidIds, id, `${context}.avoid`)
      return {
        id,
        label: assertString(item.label, `${context}.avoid[${index}].label`),
        description: assertString(item.description, `${context}.avoid[${index}].description`),
        severity: assertEnumString(
          item.severity,
          MATCHING_SEVERITY_VALUES,
          `${context}.avoid[${index}].severity`,
        ),
        ...(item.condition !== undefined
          ? { condition: assertOptionalString(item.condition, `${context}.avoid[${index}].condition`) }
          : {}),
      }
    }),
  }
}

const parseConstraints = (
  value: unknown,
  context: string,
): ProfessionalPreferenceConstraints => {
  const record = assertRecord(value, context)

  return {
    ...(record.clearance !== undefined
      ? {
          clearance: (() => {
            const clearance = assertRecord(record.clearance, `${context}.clearance`)
            return {
              status: assertString(clearance.status, `${context}.clearance.status`),
              ...(clearance.willing_to_obtain !== undefined
                ? {
                    willing_to_obtain: assertBoolean(
                      clearance.willing_to_obtain,
                      `${context}.clearance.willing_to_obtain`,
                    ),
                  }
                : {}),
              ...(clearance.exclude_required !== undefined
                ? {
                    exclude_required: assertBoolean(
                      clearance.exclude_required,
                      `${context}.clearance.exclude_required`,
                    ),
                  }
                : {}),
            }
          })(),
        }
      : {}),
    ...(record.education !== undefined
      ? {
          education: (() => {
            const education = assertRecord(record.education, `${context}.education`)
            return {
              highest: assertString(education.highest, `${context}.education.highest`),
              ...(education.in_progress !== undefined
                ? {
                    in_progress: assertOptionalString(
                      education.in_progress,
                      `${context}.education.in_progress`,
                    ),
                  }
                : {}),
              ...(education.show_on_resume !== undefined
                ? {
                    show_on_resume: assertBoolean(
                      education.show_on_resume,
                      `${context}.education.show_on_resume`,
                    ),
                  }
                : {}),
              ...(education.filter_risk !== undefined
                ? {
                    filter_risk: assertOptionalString(
                      education.filter_risk,
                      `${context}.education.filter_risk`,
                    ),
                  }
                : {}),
            }
          })(),
        }
      : {}),
    ...(record.title_flexibility !== undefined
      ? { title_flexibility: assertStringArray(record.title_flexibility, `${context}.title_flexibility`) }
      : {}),
  }
}

const parseInterviewProcessPreferences = (
  value: unknown,
  context: string,
): ProfessionalInterviewProcessPreferences => {
  const record = assertRecord(value, context)

  return {
    accepted_formats: assertStringArray(record.accepted_formats, `${context}.accepted_formats`),
    strong_fit_signals: assertStringArray(record.strong_fit_signals, `${context}.strong_fit_signals`),
    red_flags: assertStringArray(record.red_flags, `${context}.red_flags`),
    ...(record.max_rounds !== undefined
      ? { max_rounds: assertNumber(record.max_rounds, `${context}.max_rounds`) }
      : {}),
    ...(record.onsite_preferences !== undefined
      ? { onsite_preferences: assertString(record.onsite_preferences, `${context}.onsite_preferences`) }
      : {}),
  }
}

const parseSkillItem = (
  value: unknown,
  context: string,
  warnings: string[],
): ProfessionalSkillItem => {
  const item = assertRecord(value, context)
  // Preserve the "explicit null clears the field" signal used by merge: item.depth === null
  // must produce `depth: undefined` in the output (not omit), so mergeProfessionalIdentity
  // can see the explicit clear intent. item.depth === undefined omits the field entirely.
  const depthValue =
    item.depth !== undefined
      ? assertOptionalEnumString(item.depth, SKILL_DEPTH_VALUES, `${context}.depth`)
      : undefined
  const depthSourceValue =
    item.depthSource !== undefined
      ? assertOptionalEnumString(item.depthSource, DEPTH_SOURCE_VALUES, `${context}.depthSource`)
      : depthValue !== undefined
        ? // Legacy identities carry `depth` without provenance. Default to 'inferred' so
          // future regeneration flows can re-derive; corrections must be marked explicitly.
          ('inferred' as ProfessionalSkillDepthSource)
        : undefined

  return {
    name: assertString(item.name, `${context}.name`),
    ...(item.depth !== undefined ? { depth: depthValue } : {}),
    ...(item.depthSource !== undefined || depthSourceValue !== undefined
      ? { depthSource: depthSourceValue }
      : {}),
    ...(item.context !== undefined ? { context: assertOptionalString(item.context, `${context}.context`) } : {}),
    ...(item.context_stale !== undefined
      ? { context_stale: assertOptionalBoolean(item.context_stale, `${context}.context_stale`) }
      : {}),
    ...((item.positioning !== undefined || item.search_signal !== undefined)
      ? {
          positioning: assertOptionalString(
            item.positioning !== undefined ? item.positioning : item.search_signal,
            item.positioning !== undefined ? `${context}.positioning` : `${context}.search_signal`,
          ),
        }
      : {}),
    ...(item.positioning_stale !== undefined
      ? {
          positioning_stale: assertOptionalBoolean(
            item.positioning_stale,
            `${context}.positioning_stale`,
          ),
        }
      : {}),
    tags: normalizeTagArray(item.tags, `${context}.tags`, warnings),
    ...(item.enriched_at !== undefined
      ? { enriched_at: assertOptionalString(item.enriched_at, `${context}.enriched_at`) }
      : {}),
    ...(item.enriched_by !== undefined
      ? {
          enriched_by: assertOptionalEnumString(
            item.enriched_by,
            ENRICHED_BY_VALUES,
            `${context}.enriched_by`,
          ),
        }
      : {}),
    ...(item.skipped_at !== undefined
      ? { skipped_at: assertOptionalString(item.skipped_at, `${context}.skipped_at`) }
      : {}),
  }
}

const parseSearchVector = (value: unknown, context: string): ProfessionalSearchVector => {
  const vector = assertRecord(value, context)
  const keywords = assertRecord(vector.keywords, `${context}.keywords`)

  return {
    id: assertString(vector.id, `${context}.id`),
    title: assertString(vector.title, `${context}.title`),
    priority: assertEnumString(vector.priority, SEARCH_VECTOR_PRIORITY_VALUES, `${context}.priority`),
    ...(vector.subtitle !== undefined
      ? { subtitle: assertOptionalString(vector.subtitle, `${context}.subtitle`) }
      : {}),
    thesis: assertString(vector.thesis, `${context}.thesis`),
    target_roles: assertStringArray(vector.target_roles, `${context}.target_roles`),
    keywords: {
      primary: assertStringArray(keywords.primary, `${context}.keywords.primary`),
      secondary: assertStringArray(keywords.secondary, `${context}.keywords.secondary`),
    },
    ...(vector.supporting_skills !== undefined
      ? { supporting_skills: assertStringArray(vector.supporting_skills, `${context}.supporting_skills`) }
      : {}),
    ...(vector.supporting_bullets !== undefined
      ? { supporting_bullets: assertStringArray(vector.supporting_bullets, `${context}.supporting_bullets`) }
      : {}),
    ...(vector.evidence !== undefined
      ? { evidence: assertStringArray(vector.evidence, `${context}.evidence`) }
      : {}),
    ...(vector.needs_review !== undefined
      ? { needs_review: assertBoolean(vector.needs_review, `${context}.needs_review`) }
      : {}),
  }
}

const parseAwareness = (value: unknown, context: string): ProfessionalAwareness => {
  const record = assertRecord(value, context)
  const openQuestionIds = new Set<string>()

  return {
    open_questions: assertArray(record.open_questions, `${context}.open_questions`).map((entry, index) => {
      const item = assertRecord(entry, `${context}.open_questions[${index}]`)
      const id = assertString(item.id, `${context}.open_questions[${index}].id`)
      assertUniqueId(openQuestionIds, id, `${context}.open_questions`)
      return {
        id,
        topic: assertString(item.topic, `${context}.open_questions[${index}].topic`),
        description: assertString(item.description, `${context}.open_questions[${index}].description`),
        action: assertString(item.action, `${context}.open_questions[${index}].action`),
        ...(item.severity !== undefined
          ? {
              severity: assertEnumString(
                item.severity,
                AWARENESS_SEVERITY_VALUES,
                `${context}.open_questions[${index}].severity`,
              ),
            }
          : {}),
        ...(item.evidence !== undefined
          ? {
              evidence: assertStringArray(
                item.evidence,
                `${context}.open_questions[${index}].evidence`,
              ),
            }
          : {}),
        ...(item.needs_review !== undefined
          ? {
              needs_review: assertBoolean(
                item.needs_review,
                `${context}.open_questions[${index}].needs_review`,
              ),
            }
          : {}),
      }
    }),
  }
}

export const importProfessionalIdentity = (
  value: unknown,
): { data: ProfessionalIdentityV3; warnings: string[] } => {
  const warnings: string[] = []
  const root = assertRecord(normalizeRuntimeIdentitySchemaRevision(value), 'identity')
  const version = assertNumber(root.version, 'version')
  if (version !== 3) {
    throw new Error('version must be 3.')
  }

  const schemaRevision = assertEnumString(root.schema_revision, SCHEMA_REVISION_VALUES, 'schema_revision')
  const parsedModelRevision =
    root.model_revision === undefined
      ? 0
      : Math.max(0, Math.floor(assertNumber(root.model_revision, 'model_revision')))
  const identity = assertRecord(root.identity, 'identity')
  const selfModel = assertRecord(root.self_model, 'self_model')
  const interviewStyle = assertRecord(selfModel.interview_style, 'self_model.interview_style')
  const preferences = assertRecord(root.preferences, 'preferences')
  const compensation = assertRecord(preferences.compensation, 'preferences.compensation')
  const workModel = assertRecord(preferences.work_model, 'preferences.work_model')
  const skills = assertRecord(root.skills, 'skills')
  const generatorRules = assertRecord(root.generator_rules, 'generator_rules')

  const skillGroupIds = new Set<string>()
  const linkIds = new Set<string>()
  const profileIds = new Set<string>()
  const philosophyIds = new Set<string>()
  const roleIds = new Set<string>()
  const bulletIds = new Set<string>()
  const projectIds = new Set<string>()
  const searchVectorIds = new Set<string>()
  const parsedMatching = parseMatchingPreferences(preferences.matching, 'preferences.matching')

  const parsed: ProfessionalIdentityV3 = {
    ...(root.$schema ? { $schema: assertString(root.$schema, '$schema') } : {}),
    version: 3,
    schema_revision: schemaRevision,
    model_revision: parsedModelRevision,
    identity: {
      name: assertString(identity.name, 'identity.name'),
      ...(identity.display_name !== undefined
        ? { display_name: assertString(identity.display_name, 'identity.display_name') }
        : {}),
      email: assertString(identity.email, 'identity.email'),
      phone: assertString(identity.phone, 'identity.phone'),
      location: assertString(identity.location, 'identity.location'),
      ...(identity.remote !== undefined ? { remote: assertBoolean(identity.remote, 'identity.remote') } : {}),
      ...(identity.title !== undefined ? { title: assertString(identity.title, 'identity.title') } : {}),
      links: assertArray(identity.links, 'identity.links').map((entry, index) => {
        const link = assertRecord(entry, `identity.links[${index}]`)
        const id = assertString(link.id, `identity.links[${index}].id`)
        assertUniqueId(linkIds, id, 'identity.links')
        return {
          id,
          url: assertString(link.url, `identity.links[${index}].url`),
        }
      }),
      thesis: assertString(identity.thesis, 'identity.thesis'),
      ...(identity.elaboration !== undefined
        ? { elaboration: assertString(identity.elaboration, 'identity.elaboration') }
        : {}),
      ...(identity.origin !== undefined ? { origin: assertString(identity.origin, 'identity.origin') } : {}),
    },
    self_model: {
      arc: assertArray(selfModel.arc, 'self_model.arc').map((entry, index) => {
        const arc = assertRecord(entry, `self_model.arc[${index}]`)
        return {
          company: assertString(arc.company, `self_model.arc[${index}].company`),
          chapter: assertString(arc.chapter, `self_model.arc[${index}].chapter`),
        }
      }),
      philosophy: assertArray(selfModel.philosophy, 'self_model.philosophy').map((entry, index) => {
        const philosophy = assertRecord(entry, `self_model.philosophy[${index}]`)
        const id = assertString(philosophy.id, `self_model.philosophy[${index}].id`)
        assertUniqueId(philosophyIds, id, 'self_model.philosophy')
        return {
          id,
          text: assertString(philosophy.text, `self_model.philosophy[${index}].text`),
          tags: normalizeTagArray(philosophy.tags, `self_model.philosophy[${index}].tags`, warnings),
        }
      }),
      interview_style: {
        strengths: assertStringArray(interviewStyle.strengths, 'self_model.interview_style.strengths'),
        weaknesses: assertStringArray(interviewStyle.weaknesses, 'self_model.interview_style.weaknesses'),
        prep_strategy: assertString(
          interviewStyle.prep_strategy,
          'self_model.interview_style.prep_strategy',
        ),
      },
    },
    preferences: {
      compensation: {
        ...(compensation.base_floor !== undefined
          ? { base_floor: assertNumber(compensation.base_floor, 'preferences.compensation.base_floor') }
          : {}),
        ...(compensation.base_target !== undefined
          ? { base_target: assertNumber(compensation.base_target, 'preferences.compensation.base_target') }
          : {}),
        ...(compensation.notes !== undefined
          ? { notes: assertString(compensation.notes, 'preferences.compensation.notes') }
          : {}),
        priorities: assertArray(compensation.priorities, 'preferences.compensation.priorities').map(
          (entry, index) => {
            const priority = assertRecord(entry, `preferences.compensation.priorities[${index}]`)
            return {
              item: assertString(priority.item, `preferences.compensation.priorities[${index}].item`),
              weight: assertString(priority.weight, `preferences.compensation.priorities[${index}].weight`),
              ...(priority.notes !== undefined
                ? {
                    notes: assertOptionalString(
                      priority.notes,
                      `preferences.compensation.priorities[${index}].notes`,
                    ),
                  }
                : {}),
            }
          },
        ),
      },
      work_model: {
        preference: assertString(workModel.preference, 'preferences.work_model.preference'),
        ...(workModel.flexibility !== undefined
          ? { flexibility: assertOptionalString(workModel.flexibility, 'preferences.work_model.flexibility') }
          : {}),
        ...(workModel.hard_no !== undefined
          ? { hard_no: assertOptionalString(workModel.hard_no, 'preferences.work_model.hard_no') }
          : {}),
      },
      matching: parsedMatching,
      ...(preferences.constraints !== undefined
        ? { constraints: parseConstraints(preferences.constraints, 'preferences.constraints') }
        : {}),
      ...(preferences.interview_process !== undefined
        ? {
            interview_process: parseInterviewProcessPreferences(
              preferences.interview_process,
              'preferences.interview_process',
            ),
          }
        : {}),
    },
    skills: {
      groups: assertArray(skills.groups, 'skills.groups').map((entry, index) => {
        const group = assertRecord(entry, `skills.groups[${index}]`)
        const id = assertString(group.id, `skills.groups[${index}].id`)
        assertUniqueId(skillGroupIds, id, 'skills.groups')

        return {
          id,
          label: assertString(group.label, `skills.groups[${index}].label`),
          ...(group.positioning !== undefined
            ? { positioning: assertOptionalString(group.positioning, `skills.groups[${index}].positioning`) }
            : {}),
          ...(group.calibration !== undefined
            ? { calibration: assertOptionalString(group.calibration, `skills.groups[${index}].calibration`) }
            : {}),
          ...(group.is_differentiator !== undefined
            ? {
                is_differentiator: assertOptionalBoolean(
                  group.is_differentiator,
                  `skills.groups[${index}].is_differentiator`,
                ),
              }
            : {}),
          items: assertArray(group.items, `skills.groups[${index}].items`).map((itemEntry, itemIndex) =>
            parseSkillItem(itemEntry, `skills.groups[${index}].items[${itemIndex}]`, warnings),
          ),
        }
      }),
    },
    profiles: assertArray(root.profiles, 'profiles').map((entry, index) => {
      const profile = assertRecord(entry, `profiles[${index}]`)
      const id = assertString(profile.id, `profiles[${index}].id`)
      assertUniqueId(profileIds, id, 'profiles')

      return {
        id,
        tags: normalizeTagArray(profile.tags, `profiles[${index}].tags`, warnings),
        text: assertString(profile.text, `profiles[${index}].text`),
      }
    }),
    roles: assertArray(root.roles, 'roles').map((entry, index) => {
      const role = assertRecord(entry, `roles[${index}]`)
      const id = assertString(role.id, `roles[${index}].id`)
      assertUniqueId(roleIds, id, 'roles')

      return {
        id,
        company: assertString(role.company, `roles[${index}].company`),
        ...(role.subtitle !== undefined
          ? { subtitle: assertOptionalNullableString(role.subtitle, `roles[${index}].subtitle`) }
          : {}),
        title: assertString(role.title, `roles[${index}].title`),
        dates: assertString(role.dates, `roles[${index}].dates`),
        ...(role.portfolio_anchor !== undefined
          ? {
              portfolio_anchor: assertOptionalNullableString(
                role.portfolio_anchor,
                `roles[${index}].portfolio_anchor`,
              ),
            }
          : {}),
        bullets: assertArray(role.bullets, `roles[${index}].bullets`).map((bulletEntry, bulletIndex) => {
          const bullet = assertRecord(bulletEntry, `roles[${index}].bullets[${bulletIndex}]`)
          const bulletId = assertString(bullet.id, `roles[${index}].bullets[${bulletIndex}].id`)
          if (bulletIds.has(bulletId)) {
            throw new Error(
              `roles.bullets has duplicate id "${bulletId}" - bullet IDs must be unique across all roles because they are resolved globally in the override system.`,
            )
          }
          bulletIds.add(bulletId)

          const metricsRecord = assertRecord(
            bullet.metrics,
            `roles[${index}].bullets[${bulletIndex}].metrics`,
          )
          const metrics = Object.fromEntries(
            Object.entries(metricsRecord).map(([key, metricValue]) => {
              if (
                typeof metricValue !== 'string' &&
                (typeof metricValue !== 'number' || !Number.isFinite(metricValue)) &&
                typeof metricValue !== 'boolean'
              ) {
                throw new Error(
                  `roles[${index}].bullets[${bulletIndex}].metrics.${key} must be a string, number, or boolean.`,
                )
              }

              return [key, metricValue]
            }),
          )

          return {
            id: bulletId,
            problem: assertString(bullet.problem, `roles[${index}].bullets[${bulletIndex}].problem`),
            action: assertString(bullet.action, `roles[${index}].bullets[${bulletIndex}].action`),
            outcome: assertString(bullet.outcome, `roles[${index}].bullets[${bulletIndex}].outcome`),
            impact: assertStringArray(bullet.impact, `roles[${index}].bullets[${bulletIndex}].impact`),
            metrics,
            technologies: assertStringArray(
              bullet.technologies,
              `roles[${index}].bullets[${bulletIndex}].technologies`,
            ),
            ...(bullet.source_text !== undefined
              ? {
                  source_text: assertOptionalString(
                    bullet.source_text,
                    `roles[${index}].bullets[${bulletIndex}].source_text`,
                  ),
                }
              : {}),
            ...(bullet.portfolio_dive !== undefined
              ? {
                  portfolio_dive: assertOptionalNullableString(
                    bullet.portfolio_dive,
                    `roles[${index}].bullets[${bulletIndex}].portfolio_dive`,
                  ),
                }
              : {}),
            tags: normalizeTagArray(
              bullet.tags,
              `roles[${index}].bullets[${bulletIndex}].tags`,
              warnings,
            ),
          }
        }),
      }
    }),
    projects: assertArray(root.projects, 'projects').map((entry, index) => {
      const project = assertRecord(entry, `projects[${index}]`)
      const id = assertString(project.id, `projects[${index}].id`)
      assertUniqueId(projectIds, id, 'projects')

      return {
        id,
        name: assertString(project.name, `projects[${index}].name`),
        ...(project.url !== undefined ? { url: assertOptionalString(project.url, `projects[${index}].url`) } : {}),
        description: assertString(project.description, `projects[${index}].description`),
        ...(project.portfolio_dive !== undefined
          ? {
              portfolio_dive: assertOptionalNullableString(
                project.portfolio_dive,
                `projects[${index}].portfolio_dive`,
              ),
            }
          : {}),
        tags: normalizeTagArray(project.tags, `projects[${index}].tags`, warnings),
      }
    }),
    education: assertArray(root.education, 'education').map((entry, index) => {
      const education = assertRecord(entry, `education[${index}]`)
      return {
        school: assertString(education.school, `education[${index}].school`),
        location: assertString(education.location, `education[${index}].location`),
        degree: assertString(education.degree, `education[${index}].degree`),
        ...(education.year !== undefined ? { year: assertOptionalString(education.year, `education[${index}].year`) } : {}),
      }
    }),
    generator_rules: {
      voice_skill: assertString(generatorRules.voice_skill, 'generator_rules.voice_skill'),
      resume_skill: assertString(generatorRules.resume_skill, 'generator_rules.resume_skill'),
      ...(generatorRules.accuracy !== undefined
        ? {
            accuracy: Object.fromEntries(
              Object.entries(assertRecord(generatorRules.accuracy, 'generator_rules.accuracy')).map(
                ([key, entry]) => {
                  if (typeof entry === 'string') {
                    return [key, entry]
                  }

                  return [key, assertStringArray(entry, `generator_rules.accuracy.${key}`)]
                },
              ),
            ),
          }
        : {}),
    },
    ...(root.search_vectors !== undefined
      ? {
          search_vectors: assertArray(root.search_vectors, 'search_vectors').map((entry, index) => {
            const parsedVector = parseSearchVector(entry, `search_vectors[${index}]`)
            assertUniqueId(searchVectorIds, parsedVector.id, 'search_vectors')
            return parsedVector
          }),
        }
      : {}),
    ...(root.awareness !== undefined ? { awareness: parseAwareness(root.awareness, 'awareness') } : {}),
  }

  return { data: parsed, warnings }
}
