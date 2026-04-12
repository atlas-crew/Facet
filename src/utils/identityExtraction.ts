import {
  AWARENESS_SEVERITY_VALUES,
  MATCHING_SEVERITY_VALUES,
  MATCHING_WEIGHT_VALUES,
  SEARCH_VECTOR_PRIORITY_VALUES,
  importProfessionalIdentity,
  normalizeRuntimeProfessionalIdentity,
  type ProfessionalIdentityV3,
} from '../identity/schema'
import type {
  IdentityDeepenedBullet,
  IdentityAssumptionTag,
  IdentityConfidence,
  IdentityDraftBullet,
  IdentityExtractionDraft,
} from '../types/identity'
import { parseJsonWithRepair } from './jsonParsing'
import { callLlmProxy, extractJsonBlock, JsonExtractionError } from './llmProxy'

const CONFIDENCE_VALUES: IdentityConfidence[] = ['stated', 'confirmed', 'guessing', 'corrected']
const IDENTITY_EXTRACTION_TIMEOUT_MS = 120000

export const EXTRACTION_SYSTEM_PROMPT = `You are Facet's extraction agent.
Build a Professional Identity Schema v3.1 draft from messy source material.
When a scanned structure is provided, treat it as the canonical role/skills/education skeleton and deepen it rather than reparsing the resume from scratch.
Return JSON only with this exact top-level shape:
{
  "summary": string,
  "follow_up_questions": string[],
  "identity": <Professional Identity Schema v3.1 object>,
  "bullets": [
    {
      "role_id": string,
      "bullet_id": string,
      "rewrite": string,
      "tags": string[],
      "assumptions": [
        {
          "label": string,
          "confidence": "stated" | "confirmed" | "guessing" | "corrected"
        }
      ]
    }
  ]
}
Use this minimal valid shape for the identity object:
{
  "version": 3,
  "schema_revision": "3.1",
  "identity": {
    "name": string,
    "email": string,
    "phone": string,
    "location": string,
    "links": [{ "id": string, "url": string }],
    "thesis": string
  },
  "self_model": {
    "arc": [{ "company": string, "chapter": string }],
    "philosophy": [{ "id": string, "text": string, "tags": string[] }],
    "interview_style": {
      "strengths": string[],
      "weaknesses": string[],
      "prep_strategy": string
    }
  },
  "preferences": {
    "compensation": { "priorities": [{ "item": string, "weight": string }] },
    "work_model": { "preference": string },
    "matching": {
      "prioritize": [{ "id": string, "label": string, "description": string, "weight": "high" | "medium" | "low" }],
      "avoid": [{ "id": string, "label": string, "description": string, "severity": "hard" | "soft" }]
    },
    "constraints": {}
  },
  "skills": {
    "groups": [{ "id": string, "label": string, "items": [{ "name": string, "tags": string[] }] }]
  },
  "profiles": [{ "id": string, "tags": string[], "text": string }],
  "roles": [{
    "id": string,
    "company": string,
    "title": string,
    "dates": string,
    "bullets": [{
      "id": string,
      "problem": string,
      "action": string,
      "outcome": string,
      "impact": string[],
      "metrics": {},
      "technologies": string[],
      "source_text": string,
      "tags": string[]
    }]
  }],
  "projects": [{ "id": string, "name": string, "description": string, "tags": string[] }],
  "education": [{ "school": string, "location": string, "degree": string, "year": string }],
  "generator_rules": { "voice_skill": string, "resume_skill": string },
  "search_vectors": [],
  "awareness": { "open_questions": [] }
}
Rules:
- The identity object must be valid schema v3.1 with version 3 and schema_revision "3.1".
- The identity object must use this exact section layout:
  - identity: { name, email, phone, location, links, thesis, ...optional display_name/remote/title/elaboration/origin }
  - self_model: { arc, philosophy, interview_style }
  - preferences: { compensation, work_model, matching, constraints }
  - skills: { groups }
  - profiles: []
  - roles: []
  - projects: []
  - education: []
  - generator_rules: { voice_skill, resume_skill, ...optional accuracy }
  - search_vectors: []
  - awareness: { open_questions: [] }
- Use identity, not personal.
- In identity.self_model use philosophy entries shaped as {id, text, tags}, not a string array.
- In self_model, put strengths/weaknesses/prep_strategy inside interview_style. Do not invent self_model.strengths, self_model.interests, or self_model.goals.
- In identity.roles[].bullets[] use decomposed fields: problem, action, outcome, impact, metrics, technologies, tags.
- If source_text is present on a bullet, preserve the role and bullet ids, keep source_text intact, and use it as the basis for the decomposed fields.
- Use roles[].dates as a single string. Do not emit start_date or end_date.
- impact must be a string array, not a single string.
- metrics must be an object whose values are strings, numbers, or booleans. Do not emit metrics as an array.
- generator_rules must be an object. Do not emit generator_rules as a string, array, or markdown note.
- projects must be an array. Do not emit a single project object at the top level.
- education must be an array. Do not emit a single education object at the top level.
- matching must always be present as { prioritize: [], avoid: [] } when the source is silent.
- matching.prioritize entries must use { id, label, description, weight } with weight in "high" | "medium" | "low".
- matching.avoid entries must use { id, label, description, severity } with severity in "hard" | "soft".
- search_vectors must always be present as an array, using [] when the source is silent.
- awareness must always be present as { open_questions: [] } when the source is silent.
- For first-pass extraction, keep skill items limited to { name, tags }. Do not emit depth, proficiency, context, or search_signal.
- Use empty arrays/objects/strings when the source is silent instead of inventing alternate keys.
- Prefer a strong first draft over sparse placeholders.
- Use "guessing" only when the source implies something but does not state it directly.
- Use "stated" when the source says it directly.
- Use "confirmed" when the source states it and the surrounding evidence reinforces it.
- Use "corrected" when the correction notes explicitly revise the prior draft.
- Every bullet in identity.roles should have a matching bullets entry.
- rewrite should read like the final bullet text and surface assumptions inline when useful.
- follow_up_questions should be short and concrete, prioritizing missing matching, vector, or awareness inputs when helpful.
- Do not wrap the JSON in markdown fences.`

export const BULLET_DEEPENING_SYSTEM_PROMPT = `You are Facet's bullet deepening agent.
Decompose exactly one scanned resume bullet from Professional Identity Schema v3.1 source_text into structured fields.
Return JSON only with this exact top-level shape:
{
  "summary": string,
  "bullet": {
    "role_id": string,
    "bullet_id": string,
    "problem": string,
    "action": string,
    "outcome": string,
    "impact": string[],
    "metrics": {},
    "technologies": string[],
    "tags": string[],
    "rewrite": string,
    "assumptions": [
      {
        "label": string,
        "confidence": "stated" | "confirmed" | "guessing" | "corrected"
      }
    ]
  }
}
Rules:
- Deepen only the supplied bullet. Do not invent new bullets. Do not move claims across bullets.
- Preserve factual claims already present in source_text.
- Preserve technologies, metrics, and proper nouns exactly as written.
- Extract all named technologies, metrics, and proper nouns from source_text into technologies, metrics, and other relevant structured fields even when the text does not label them explicitly.
- Preserve those facts both in the prose decomposition and in the structured fields.
- Do not abstract named tools, platforms, languages, vendors, or services into generic categories.
- If something is unclear, carry the original term through and mark uncertainty in assumptions instead of paraphrasing it away.
- Keep role_id and bullet_id exactly as provided.
- Keep source_text implicit; do not rewrite or omit facts from it.
- problem, action, and outcome should read like concise resume decomposition, not a chat response.
- impact must be a string array.
- metrics must be an object whose values are strings, numbers, or booleans.
- technologies must be a string array.
- tags should be short, lowercase, and deduplicated.
- Use "guessing" only when the source implies something but does not state it directly.
- Use "stated" when the source says it directly.
- Use "confirmed" when the source states it and the surrounding evidence reinforces it.
- Use "corrected" only when explicit correction notes revise the bullet.
- Do not wrap the JSON in markdown fences.`

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const assertRecord = (value: unknown, context: string): Record<string, unknown> => {
  if (!isRecord(value)) {
    throw new Error(`${context} must be an object.`)
  }
  return value
}

const assertString = (value: unknown, context: string): string => {
  if (typeof value !== 'string') {
    throw new Error(`${context} must be a string.`)
  }
  return value
}

const assertStringArray = (value: unknown, context: string): string[] => {
  if (!Array.isArray(value)) {
    throw new Error(`${context} must be an array.`)
  }

  return value.map((entry, index) => assertString(entry, `${context}[${index}]`))
}

const normalizeConfidence = (value: unknown, context: string): IdentityConfidence => {
  const confidence = assertString(value, context)
  if (!CONFIDENCE_VALUES.includes(confidence as IdentityConfidence)) {
    throw new Error(`${context} must be one of ${CONFIDENCE_VALUES.join(', ')}.`)
  }
  return confidence as IdentityConfidence
}

const normalizeAssumptions = (value: unknown, context: string): IdentityAssumptionTag[] => {
  if (!Array.isArray(value)) {
    throw new Error(`${context} must be an array.`)
  }

  return value.map((entry, index) => {
    const record = assertRecord(entry, `${context}[${index}]`)
    return {
      label: assertString(record.label, `${context}[${index}].label`).trim(),
      confidence: normalizeConfidence(record.confidence, `${context}[${index}].confidence`),
    }
  })
}

const assertMetricObject = (value: unknown, context: string): Record<string, string | number | boolean> => {
  const record = assertRecord(value, context)
  const normalized: Record<string, string | number | boolean> = {}
  for (const [key, entry] of Object.entries(record)) {
    if (typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean') {
      normalized[key] = entry
      continue
    }
    throw new Error(`${context}.${key} must be a string, number, or boolean.`)
  }
  return normalized
}

const composeRewrite = (problem: string, action: string, outcome: string): string =>
  [problem, action, outcome].map((value) => value.trim()).filter(Boolean).join(' ')

const composeBulletRewrite = (
  bullet: ProfessionalIdentityV3['roles'][number]['bullets'][number],
): string => {
  const composed = composeRewrite(bullet.problem, bullet.action, bullet.outcome)
  if (composed) {
    return composed
  }

  return bullet.source_text?.trim() ?? ''
}

const defaultRewrite = (identity: ProfessionalIdentityV3, roleId: string, bulletId: string): string => {
  const role = identity.roles.find((entry) => entry.id === roleId)
  const bullet = role?.bullets.find((entry) => entry.id === bulletId)
  if (!role || !bullet) {
    throw new Error(`Draft bullet ${roleId}/${bulletId} does not exist in identity.roles.`)
  }

  return composeBulletRewrite(bullet)
}

const buildBulletMap = (identity: ProfessionalIdentityV3) => {
  const byKey = new Map<string, IdentityDraftBullet>()

  for (const role of identity.roles) {
    const roleLabel = `${role.company} - ${role.title}`
    for (const bullet of role.bullets) {
      byKey.set(`${role.id}::${bullet.id}`, {
        roleId: role.id,
        roleLabel,
        bulletId: bullet.id,
        rewrite: composeBulletRewrite(bullet),
        tags: bullet.tags,
        assumptions: [],
      })
    }
  }

  return byKey
}

const normalizeGeneratorRules = (
  value: unknown,
): { value: unknown; warnings: string[] } => {
  if (isRecord(value)) {
    return { value, warnings: [] }
  }

  if (typeof value === 'string') {
    const text = value.trim()
    return {
      value: {
        voice_skill: text,
        resume_skill: text,
      },
      warnings: ['Normalized generator_rules from a string into { voice_skill, resume_skill } for AI extraction output.'],
    }
  }

  return {
    value: {
      voice_skill: '',
      resume_skill: '',
    },
    warnings:
      value === undefined
        ? ['Added missing generator_rules object with empty defaults for AI extraction output.']
        : ['Normalized invalid generator_rules into an object with empty defaults for AI extraction output.'],
  }
}

const normalizeBulletTechnologies = (
  value: unknown,
  context: string,
): { value: string[]; warnings: string[] } => {
  if (Array.isArray(value)) {
    const warnings: string[] = []
    const items = value.flatMap((entry, index) => {
      if (typeof entry === 'string') {
        return [entry]
      }

      if (typeof entry === 'number' || typeof entry === 'boolean') {
        warnings.push(
          `Normalized ${context}.technologies[${index}] into a string for AI extraction output.`,
        )
        return [String(entry)]
      }

      warnings.push(`Dropped invalid ${context}.technologies[${index}] entry for AI extraction output.`)
      return []
    })

    return {
      value: Array.from(new Set(items.map((entry) => entry.trim()).filter(Boolean))),
      warnings,
    }
  }

  if (typeof value === 'string') {
    return {
      value: Array.from(
        new Set(
          value
            .split(',')
            .map((entry) => entry.trim())
            .filter(Boolean),
        ),
      ),
      warnings: [
        `Normalized ${context}.technologies from a string into a string array for AI extraction output.`,
      ],
    }
  }

  return {
    value: [],
    warnings:
      value === undefined
        ? [`Added missing ${context}.technologies array for AI extraction output.`]
        : [`Normalized invalid ${context}.technologies into an empty array for AI extraction output.`],
  }
}

const normalizeTagArray = (
  value: unknown,
  context: string,
): { value: string[]; warnings: string[] } => {
  if (Array.isArray(value)) {
    const warnings: string[] = []
    const items = value.flatMap((entry, index) => {
      if (typeof entry === 'string') {
        return [entry]
      }

      if (typeof entry === 'number' || typeof entry === 'boolean') {
        warnings.push(`Normalized ${context}[${index}] into a string for AI extraction output.`)
        return [String(entry)]
      }

      warnings.push(`Dropped invalid ${context}[${index}] entry for AI extraction output.`)
      return []
    })

    return {
      value: Array.from(new Set(items.map((entry) => entry.trim().toLowerCase()).filter(Boolean))),
      warnings,
    }
  }

  if (typeof value === 'string') {
    return {
      value: Array.from(
        new Set(
          value
            .split(',')
            .map((entry) => entry.trim().toLowerCase())
            .filter(Boolean),
        ),
      ),
      warnings: [`Normalized ${context} from a string into a string array for AI extraction output.`],
    }
  }

  return {
    value: [],
    warnings:
      value === undefined
        ? [`Added missing ${context} array for AI extraction output.`]
        : [`Normalized invalid ${context} into an empty array for AI extraction output.`],
  }
}

const findRoleBullet = (identity: ProfessionalIdentityV3, roleId: string, bulletId: string) => {
  const roleIndex = identity.roles.findIndex((entry) => entry.id === roleId)
  if (roleIndex < 0) {
    throw new Error(`Role "${roleId}" does not exist in identity.roles.`)
  }

  const role = identity.roles[roleIndex]!
  const bulletIndex = role.bullets.findIndex((entry) => entry.id === bulletId)
  if (bulletIndex < 0) {
    throw new Error(`Bullet "${bulletId}" does not exist in role "${roleId}".`)
  }

  return {
    roleIndex,
    bulletIndex,
    role,
    bullet: role.bullets[bulletIndex]!,
  }
}

const normalizeObjectArrayField = (
  value: unknown,
  context: string,
): { value: unknown; warnings: string[] } => {
  if (Array.isArray(value)) {
    return { value, warnings: [] }
  }

  if (isRecord(value)) {
    return {
      value: [value],
      warnings: [`Normalized ${context} from an object into a single-item array for AI extraction output.`],
    }
  }

  return {
    value: [],
    warnings:
      value === undefined
        ? [`Added missing ${context} array for AI extraction output.`]
        : [`Normalized invalid ${context} into an empty array for AI extraction output.`],
  }
}

const normalizeSchemaRevision = (
  value: unknown,
): { value: '3.1'; warnings: string[] } => {
  if (value === '3.1') {
    return { value: '3.1', warnings: [] }
  }

  return {
    value: '3.1',
    warnings:
      value === undefined
        ? ['Added missing schema_revision "3.1" for AI extraction output.']
        : ['Normalized schema_revision to "3.1" for AI extraction output.'],
  }
}

const slugifyFragment = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const createDerivedId = (prefix: string, value: string, index: number): string =>
  [prefix, slugifyFragment(value) || String(index + 1)].join('-')

const createUniqueId = (seen: Map<string, number>, baseId: string): string => {
  const nextCount = (seen.get(baseId) ?? 0) + 1
  seen.set(baseId, nextCount)
  return nextCount === 1 ? baseId : `${baseId}--${nextCount}`
}

const normalizeStringArrayField = (
  value: unknown,
  context: string,
): { value: string[]; warnings: string[]; isValidArray: boolean } => {
  if (!Array.isArray(value)) {
    return {
      value: [],
      isValidArray: false,
      warnings:
        value === undefined
          ? [`Added missing ${context} array for AI extraction output.`]
          : [`Normalized invalid ${context} into an empty array for AI extraction output.`],
    }
  }

  const warnings: string[] = []
  const normalized = value.flatMap((entry, index) => {
    if (typeof entry === 'string') {
      return [entry]
    }

    if (typeof entry === 'number' || typeof entry === 'boolean') {
      warnings.push(`Normalized ${context}[${index}] into a string for AI extraction output.`)
      return [String(entry)]
    }

    warnings.push(`Dropped invalid ${context}[${index}] entry for AI extraction output.`)
    return []
  })

  return {
    value: normalized,
    warnings,
    isValidArray: value.length === 0 || normalized.length > 0,
  }
}

const normalizeDerivedEntryId = (
  value: unknown,
  prefix: string,
  fallbackSource: string,
  index: number,
  context: string,
  seen: Map<string, number>,
): { value: string; warnings: string[] } => {
  const warnings: string[] = []
  const baseId =
    typeof value === 'string' && value.trim().length > 0
      ? value.trim()
      : (() => {
          warnings.push(`Derived missing ${context}.id for AI extraction output.`)
          return createDerivedId(prefix, fallbackSource, index)
        })()

  const id = createUniqueId(seen, baseId)
  if (id !== baseId) {
    warnings.push(`Normalized duplicate ${context}.id "${baseId}" to "${id}" for AI extraction output.`)
  }

  return { value: id, warnings }
}

const isMatchingPriorityEntry = (value: unknown): boolean =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  value.id.trim().length > 0 &&
  typeof value.label === 'string' &&
  value.label.trim().length > 0 &&
  typeof value.description === 'string' &&
  value.description.trim().length > 0 &&
  typeof value.weight === 'string' &&
  MATCHING_WEIGHT_VALUES.has(value.weight as never)

const isMatchingAvoidEntry = (value: unknown): boolean =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  value.id.trim().length > 0 &&
  typeof value.label === 'string' &&
  value.label.trim().length > 0 &&
  typeof value.description === 'string' &&
  value.description.trim().length > 0 &&
  typeof value.severity === 'string' &&
  MATCHING_SEVERITY_VALUES.has(value.severity as never)

const normalizeMatchingPreferences = (
  value: unknown,
): {
  value: { prioritize: unknown[]; avoid: unknown[] }
  warnings: string[]
} => {
  if (!isRecord(value)) {
    return {
      value: { prioritize: [], avoid: [] },
      warnings:
        value === undefined
          ? ['Added missing preferences.matching object with empty defaults for AI extraction output.']
          : ['Normalized invalid preferences.matching into empty defaults for AI extraction output.'],
    }
  }

  const warnings: string[] = []
  const prioritizeSeen = new Map<string, number>()
  const avoidSeen = new Map<string, number>()
  const prioritize =
    Array.isArray(value.prioritize)
      ? value.prioritize.flatMap((entry, index) => {
          if (isMatchingPriorityEntry(entry)) {
            const baseId = entry.id.trim()
            const id = createUniqueId(prioritizeSeen, baseId)
            if (id !== baseId) {
              warnings.push(
                `Normalized duplicate preferences.matching.prioritize[${index}].id "${baseId}" to "${id}" for AI extraction output.`,
              )
            }
            return [
              {
                id,
                label: entry.label.trim(),
                description: entry.description.trim(),
                weight: entry.weight,
              },
            ]
          }

          if (!isRecord(entry) || typeof entry.label !== 'string' || entry.label.trim().length === 0) {
            warnings.push(
              `Dropped invalid preferences.matching.prioritize[${index}] entry for AI extraction output.`,
            )
            return []
          }

          const id = normalizeDerivedEntryId(
            entry.id,
            'prioritize',
            entry.label,
            index,
            `preferences.matching.prioritize[${index}]`,
            prioritizeSeen,
          )
          warnings.push(...id.warnings)
          if (!(typeof entry.weight === 'string' && MATCHING_WEIGHT_VALUES.has(entry.weight as never))) {
            warnings.push(
              `Normalized invalid preferences.matching.prioritize[${index}].weight to "medium" for AI extraction output.`,
            )
          }

          return [
            {
              id: id.value,
              label: entry.label.trim(),
              description:
                typeof entry.description === 'string' && entry.description.trim().length > 0
                  ? entry.description.trim()
                  : entry.label.trim(),
              weight:
                typeof entry.weight === 'string' && MATCHING_WEIGHT_VALUES.has(entry.weight as never)
                  ? entry.weight
                  : 'medium',
            },
          ]
        })
      : []
  const avoid =
    Array.isArray(value.avoid)
      ? value.avoid.flatMap((entry, index) => {
          if (isMatchingAvoidEntry(entry)) {
            const baseId = entry.id.trim()
            const id = createUniqueId(avoidSeen, baseId)
            if (id !== baseId) {
              warnings.push(
                `Normalized duplicate preferences.matching.avoid[${index}].id "${baseId}" to "${id}" for AI extraction output.`,
              )
            }
            return [
              {
                id,
                label: entry.label.trim(),
                description: entry.description.trim(),
                severity: entry.severity,
              },
            ]
          }

          if (!isRecord(entry) || typeof entry.label !== 'string' || entry.label.trim().length === 0) {
            warnings.push(`Dropped invalid preferences.matching.avoid[${index}] entry for AI extraction output.`)
            return []
          }

          const id = normalizeDerivedEntryId(
            entry.id,
            'avoid',
            entry.label,
            index,
            `preferences.matching.avoid[${index}]`,
            avoidSeen,
          )
          warnings.push(...id.warnings)
          if (!(typeof entry.severity === 'string' && MATCHING_SEVERITY_VALUES.has(entry.severity as never))) {
            warnings.push(
              `Normalized invalid preferences.matching.avoid[${index}].severity to "soft" for AI extraction output.`,
            )
          }

          return [
            {
              id: id.value,
              label: entry.label.trim(),
              description:
                typeof entry.description === 'string' && entry.description.trim().length > 0
                  ? entry.description.trim()
                  : entry.label.trim(),
              severity:
                typeof entry.severity === 'string' && MATCHING_SEVERITY_VALUES.has(entry.severity as never)
                  ? entry.severity
                  : 'soft',
            },
          ]
        })
      : []

  if (!Array.isArray(value.prioritize)) {
    warnings.push(
      value.prioritize === undefined
        ? 'Added missing preferences.matching.prioritize array for AI extraction output.'
        : 'Normalized invalid preferences.matching.prioritize into an empty array for AI extraction output.',
    )
  }

  if (!Array.isArray(value.avoid)) {
    warnings.push(
      value.avoid === undefined
        ? 'Added missing preferences.matching.avoid array for AI extraction output.'
        : 'Normalized invalid preferences.matching.avoid into an empty array for AI extraction output.',
    )
  }

  return {
    value: {
      prioritize,
      avoid,
    },
    warnings,
  }
}

const normalizePreferenceConstraints = (
  value: unknown,
): { value: Record<string, unknown>; warnings: string[] } => {
  if (isRecord(value)) {
    return { value, warnings: [] }
  }

  return {
    value: {},
    warnings:
      value === undefined
        ? ['Added missing preferences.constraints object for AI extraction output.']
        : ['Normalized invalid preferences.constraints into an empty object for AI extraction output.'],
  }
}

const normalizeCompensationPreferences = (
  value: unknown,
): { value: Record<string, unknown>; warnings: string[] } => {
  if (!isRecord(value)) {
    return {
      value: { priorities: [] },
      warnings:
        value === undefined
          ? ['Added missing preferences.compensation object with empty priorities for AI extraction output.']
          : ['Normalized invalid preferences.compensation into an object with empty priorities for AI extraction output.'],
    }
  }

  if (Array.isArray(value.priorities)) {
    return { value, warnings: [] }
  }

  return {
    value: {
      ...value,
      priorities: [],
    },
    warnings: [
      value.priorities === undefined
        ? 'Added missing preferences.compensation.priorities array for AI extraction output.'
        : 'Normalized invalid preferences.compensation.priorities into an empty array for AI extraction output.',
    ],
  }
}

const normalizeWorkModelPreferences = (
  value: unknown,
): { value: Record<string, unknown>; warnings: string[] } => {
  if (!isRecord(value)) {
    return {
      value: { preference: '' },
      warnings:
        value === undefined
          ? ['Added missing preferences.work_model object with an empty preference for AI extraction output.']
          : ['Normalized invalid preferences.work_model into an object with an empty preference for AI extraction output.'],
    }
  }

  if (typeof value.preference === 'string') {
    return { value, warnings: [] }
  }

  return {
    value: {
      ...value,
      preference: '',
    },
    warnings: [
      value.preference === undefined
        ? 'Added missing preferences.work_model.preference string for AI extraction output.'
        : 'Normalized invalid preferences.work_model.preference into an empty string for AI extraction output.',
    ],
  }
}

const normalizePreferences = (
  value: unknown,
): { value: Record<string, unknown>; warnings: string[] } => {
  const source = isRecord(value) ? value : {}
  const { role_fit: legacyRoleFit, ...preferencesWithoutRoleFit } = source
  const warnings =
    isRecord(value)
      ? []
      : [
          value === undefined
            ? 'Added missing preferences object with empty v3.1 defaults for AI extraction output.'
            : 'Normalized invalid preferences into an object with empty v3.1 defaults for AI extraction output.',
        ]

  const compensation = normalizeCompensationPreferences(source.compensation)
  const workModel = normalizeWorkModelPreferences(source.work_model)
  const matching = normalizeMatchingPreferences(source.matching)
  const constraints = normalizePreferenceConstraints(source.constraints)

  warnings.push(
    ...compensation.warnings,
    ...workModel.warnings,
    ...matching.warnings,
    ...constraints.warnings,
  )

  if (legacyRoleFit !== undefined) {
    warnings.push('Dropped legacy preferences.role_fit from AI extraction output before schema import.')
  }

  return {
    value: {
      ...preferencesWithoutRoleFit,
      compensation: compensation.value,
      work_model: workModel.value,
      matching: matching.value,
      constraints: constraints.value,
    },
    warnings,
  }
}

const normalizeSearchVectors = (
  value: unknown,
): { value: unknown[]; warnings: string[] } => {
  if (!Array.isArray(value)) {
    return {
      value: [],
      warnings:
        value === undefined
          ? ['Added missing search_vectors array for AI extraction output.']
          : ['Normalized invalid search_vectors into an empty array for AI extraction output.'],
    }
  }

  const seenIds = new Map<string, number>()
  const warnings: string[] = []
  const normalized = value.flatMap((entry, index) => {
    if (!isRecord(entry) || typeof entry.title !== 'string' || typeof entry.thesis !== 'string') {
      warnings.push(`Dropped invalid search_vectors[${index}] entry for AI extraction output.`)
      return []
    }

    const id = normalizeDerivedEntryId(
      entry.id,
      'search-vector',
      entry.title,
      index,
      `search_vectors[${index}]`,
      seenIds,
    )
    const targetRoles = normalizeStringArrayField(entry.target_roles, `search_vectors[${index}].target_roles`)
    const primaryKeywords = normalizeStringArrayField(
      isRecord(entry.keywords) ? entry.keywords.primary : undefined,
      `search_vectors[${index}].keywords.primary`,
    )
    const secondaryKeywords = normalizeStringArrayField(
      isRecord(entry.keywords) ? entry.keywords.secondary : undefined,
      `search_vectors[${index}].keywords.secondary`,
    )
    const supportingSkills =
      entry.supporting_skills === undefined
        ? { value: [], warnings: [], isValidArray: true }
        : normalizeStringArrayField(entry.supporting_skills, `search_vectors[${index}].supporting_skills`)
    const supportingBullets =
      entry.supporting_bullets === undefined
        ? { value: [], warnings: [], isValidArray: true }
        : normalizeStringArrayField(entry.supporting_bullets, `search_vectors[${index}].supporting_bullets`)

    warnings.push(...id.warnings, ...targetRoles.warnings, ...primaryKeywords.warnings, ...secondaryKeywords.warnings)
    warnings.push(...supportingSkills.warnings, ...supportingBullets.warnings)
    if (!isRecord(entry.keywords)) {
      warnings.push(`Normalized invalid search_vectors[${index}].keywords into empty keyword arrays for AI extraction output.`)
    }
    if (!(typeof entry.priority === 'string' && SEARCH_VECTOR_PRIORITY_VALUES.has(entry.priority as never))) {
      warnings.push(`Normalized invalid search_vectors[${index}].priority to "medium" for AI extraction output.`)
    }

    return [
      {
        id: id.value,
        title: entry.title.trim(),
        priority:
          typeof entry.priority === 'string' && SEARCH_VECTOR_PRIORITY_VALUES.has(entry.priority as never)
            ? entry.priority
            : 'medium',
        ...(typeof entry.subtitle === 'string' ? { subtitle: entry.subtitle.trim() } : {}),
        thesis: entry.thesis.trim(),
        target_roles: targetRoles.value,
        keywords: {
          primary: primaryKeywords.value,
          secondary: secondaryKeywords.value,
        },
        ...(entry.supporting_skills !== undefined ? { supporting_skills: supportingSkills.value } : {}),
        ...(entry.supporting_bullets !== undefined ? { supporting_bullets: supportingBullets.value } : {}),
      },
    ]
  })

  return { value: normalized, warnings }
}

const normalizeAwareness = (
  value: unknown,
): { value: { open_questions: unknown[] }; warnings: string[] } => {
  if (!isRecord(value)) {
    return {
      value: { open_questions: [] },
      warnings:
        value === undefined
          ? ['Added missing awareness object with empty open_questions for AI extraction output.']
          : ['Normalized invalid awareness into an object with empty open_questions for AI extraction output.'],
    }
  }

  if (Array.isArray(value.open_questions)) {
    const seenIds = new Map<string, number>()
    const warnings: string[] = []
    const normalized = value.open_questions.flatMap((entry, index) => {
      if (
        !isRecord(entry) ||
        typeof entry.topic !== 'string' ||
        typeof entry.description !== 'string' ||
        typeof entry.action !== 'string'
      ) {
        warnings.push(`Dropped invalid awareness.open_questions[${index}] entry for AI extraction output.`)
        return []
      }

      const id = normalizeDerivedEntryId(
        entry.id,
        'open-question',
        entry.topic,
        index,
        `awareness.open_questions[${index}]`,
        seenIds,
      )
      warnings.push(...id.warnings)
      if (
        entry.severity !== undefined &&
        !(typeof entry.severity === 'string' && AWARENESS_SEVERITY_VALUES.has(entry.severity as never))
      ) {
        warnings.push(
          `Dropped invalid awareness.open_questions[${index}].severity value for AI extraction output.`,
        )
      }

      return [
        {
          id: id.value,
          topic: entry.topic.trim(),
          description: entry.description.trim(),
          action: entry.action.trim(),
          ...(typeof entry.severity === 'string' && AWARENESS_SEVERITY_VALUES.has(entry.severity as never)
            ? { severity: entry.severity }
            : {}),
        },
      ]
    })

    return {
      value: {
        open_questions: normalized,
      },
      warnings,
    }
  }

  return {
    value: { open_questions: [] },
    warnings: [
      value.open_questions === undefined
        ? 'Added missing awareness.open_questions array for AI extraction output.'
        : 'Normalized invalid awareness.open_questions into an empty array for AI extraction output.',
    ],
  }
}

const normalizeExtractedIdentityCandidate = (
  value: unknown,
): { value: unknown; warnings: string[] } => {
  if (!isRecord(value)) {
    return { value, warnings: [] }
  }

  const normalized = { ...value }
  const schemaRevision = normalizeSchemaRevision(value.schema_revision)
  normalized.schema_revision = schemaRevision.value
  const generatorRules = normalizeGeneratorRules(value.generator_rules)
  normalized.generator_rules = generatorRules.value
  const warnings = [...schemaRevision.warnings, ...generatorRules.warnings]
  const projects = normalizeObjectArrayField(value.projects, 'projects')
  normalized.projects = projects.value
  warnings.push(...projects.warnings)
  const education = normalizeObjectArrayField(value.education, 'education')
  normalized.education = education.value
  warnings.push(...education.warnings)
  const searchVectors = normalizeSearchVectors(value.search_vectors)
  normalized.search_vectors = searchVectors.value
  warnings.push(...searchVectors.warnings)
  const awareness = normalizeAwareness(value.awareness)
  normalized.awareness = awareness.value
  warnings.push(...awareness.warnings)
  const preferences = normalizePreferences(value.preferences)
  normalized.preferences = preferences.value
  warnings.push(...preferences.warnings)

  if (Array.isArray(value.roles)) {
    normalized.roles = value.roles.map((role, roleIndex) => {
      if (!isRecord(role)) {
        return role
      }

      const normalizedRole = { ...role }
      if (Array.isArray(role.bullets)) {
        normalizedRole.bullets = role.bullets.map((bullet, bulletIndex) => {
          if (!isRecord(bullet)) {
            return bullet
          }

          const normalizedBullet = { ...bullet }
          const technologies = normalizeBulletTechnologies(
            bullet.technologies,
            `roles[${roleIndex}].bullets[${bulletIndex}]`,
          )
          normalizedBullet.technologies = technologies.value
          warnings.push(...technologies.warnings)
          const tags = normalizeTagArray(
            bullet.tags,
            `roles[${roleIndex}].bullets[${bulletIndex}].tags`,
          )
          normalizedBullet.tags = tags.value
          warnings.push(...tags.warnings)
          return normalizedBullet
        })
      }

      return normalizedRole
    })
  }

  return {
    value: normalized,
    warnings,
  }
}

const parseLlmJsonResponse = (
  rawResponse: string,
  context: string,
): { parsed: unknown; repaired: boolean } => {
  try {
    const parsedResult = parseJsonWithRepair<unknown>(extractJsonBlock(rawResponse), context)
    return {
      parsed: parsedResult.data,
      repaired: parsedResult.repaired,
    }
  } catch (error) {
    if (error instanceof JsonExtractionError) {
      throw new JsonExtractionError(`${context}: ${error.message}`)
    }

    throw new Error(error instanceof Error ? error.message : `Unable to parse ${context}.`)
  }
}

const parseDeepenedBulletPayload = (
  value: unknown,
  context: string,
): Omit<IdentityDeepenedBullet, 'warnings' | 'bullet'> & {
  summary: string
  warnings: string[]
  bullet: Omit<ProfessionalIdentityV3['roles'][number]['bullets'][number], 'source_text'>
} => {
  const root = assertRecord(value, context)
  const summary = assertString(root.summary, 'summary').trim()
  const bulletRecord = assertRecord(root.bullet, 'bullet')
  const roleId = assertString(bulletRecord.role_id, 'bullet.role_id').trim()
  const bulletId = assertString(bulletRecord.bullet_id, 'bullet.bullet_id').trim()
  const technologies = normalizeBulletTechnologies(bulletRecord.technologies, 'bullet')
  const tags = normalizeTagArray(bulletRecord.tags, 'bullet.tags')
  const bullet = {
    id: bulletId,
    problem: assertString(bulletRecord.problem, 'bullet.problem').trim(),
    action: assertString(bulletRecord.action, 'bullet.action').trim(),
    outcome: assertString(bulletRecord.outcome, 'bullet.outcome').trim(),
    impact: assertStringArray(bulletRecord.impact, 'bullet.impact').map((entry) => entry.trim()).filter(Boolean),
    metrics: assertMetricObject(bulletRecord.metrics, 'bullet.metrics'),
    technologies: technologies.value,
    tags: tags.value,
  }
  return {
    summary,
    roleId,
    bulletId,
    bullet: {
      ...bullet,
      tags: Array.from(new Set(bullet.tags)),
    },
    rewrite: assertString(bulletRecord.rewrite, 'bullet.rewrite').trim(),
    assumptions:
      bulletRecord.assumptions === undefined
        ? []
        : normalizeAssumptions(bulletRecord.assumptions, 'bullet.assumptions'),
    warnings: [...technologies.warnings, ...tags.warnings],
  }
}

export const parseIdentityExtractionResponse = (rawResponse: string): IdentityExtractionDraft => {
  const { parsed, repaired } = parseLlmJsonResponse(rawResponse, 'Identity extraction response')

  const root = assertRecord(parsed, 'identity extraction response')
  const normalizedIdentity = normalizeExtractedIdentityCandidate(root.identity)
  const imported = importProfessionalIdentity(normalizedIdentity.value)
  if (!imported.data) {
    throw new Error('Identity extraction response produced an invalid identity after schema validation.')
  }
  const warningSet = repaired
    ? [
        'Repaired minor JSON syntax issues in the AI response before validation.',
        ...normalizedIdentity.warnings,
        ...imported.warnings,
      ]
    : [...normalizedIdentity.warnings, ...imported.warnings]
  const bulletMap = buildBulletMap(imported.data)

  if (root.bullets !== undefined) {
    if (!Array.isArray(root.bullets)) {
      throw new Error('bullets must be an array.')
    }

    for (const [index, entry] of root.bullets.entries()) {
      const record = assertRecord(entry, `bullets[${index}]`)
      const roleId = assertString(record.role_id, `bullets[${index}].role_id`)
      const bulletId = assertString(record.bullet_id, `bullets[${index}].bullet_id`)
      const key = `${roleId}::${bulletId}`
      const existing = bulletMap.get(key)
      if (!existing) {
        warningSet.push(`Ignored draft bullet annotation for unknown bullet "${key}".`)
        continue
      }

      const rewriteValue =
        record.rewrite === undefined
          ? defaultRewrite(imported.data, roleId, bulletId)
          : assertString(record.rewrite, `bullets[${index}].rewrite`)
      const tagsValue =
        record.tags === undefined
          ? existing.tags
          : normalizeTagArray(record.tags, `bullets[${index}].tags`).value
      bulletMap.set(key, {
        ...existing,
        rewrite: rewriteValue.trim(),
        tags: Array.from(new Set(tagsValue)),
        assumptions:
          record.assumptions === undefined
            ? existing.assumptions
            : normalizeAssumptions(record.assumptions, `bullets[${index}].assumptions`),
      })
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    summary: assertString(root.summary, 'summary'),
    followUpQuestions:
      root.follow_up_questions === undefined
        ? []
        : assertStringArray(root.follow_up_questions, 'follow_up_questions'),
    identity: imported.data,
    bullets: Array.from(bulletMap.values()),
    warnings: warningSet,
  }
}

export const parseDeepenIdentityBulletResponse = (
  rawResponse: string,
  identity: ProfessionalIdentityV3,
): IdentityDeepenedBullet => {
  const { parsed, repaired } = parseLlmJsonResponse(rawResponse, 'Identity bullet deepening response')

  const normalized = parseDeepenedBulletPayload(parsed, 'identity bullet deepening response')
  const existing = findRoleBullet(identity, normalized.roleId, normalized.bulletId)
  const candidateIdentity = structuredClone(identity)
  candidateIdentity.roles[existing.roleIndex].bullets[existing.bulletIndex] = {
    ...candidateIdentity.roles[existing.roleIndex].bullets[existing.bulletIndex],
    ...normalized.bullet,
    source_text: existing.bullet.source_text,
  }
  const imported = importProfessionalIdentity(candidateIdentity)
  if (!imported.data) {
    throw new Error('Deepened bullet produced an invalid identity after schema validation.')
  }
  const validatedBullet = findRoleBullet(imported.data, normalized.roleId, normalized.bulletId)

  return {
    summary: normalized.summary,
    roleId: normalized.roleId,
    bulletId: normalized.bulletId,
    bullet: validatedBullet.bullet,
    rewrite: normalized.rewrite,
    assumptions: normalized.assumptions,
    warnings: repaired
      ? [
          'Repaired minor JSON syntax issues in the AI response before validation.',
          ...normalized.warnings,
          ...imported.warnings,
        ]
      : [...normalized.warnings, ...imported.warnings],
  }
}

const buildExtractionPrompt = ({
  sourceMaterial,
  correctionNotes,
  existingDraft,
  seedIdentity,
}: {
  sourceMaterial: string
  correctionNotes?: string
  existingDraft?: ProfessionalIdentityV3 | null
  seedIdentity?: ProfessionalIdentityV3 | null
}): string => {
  const parts = [
    'Source material:',
    sourceMaterial.trim(),
  ]

  if (seedIdentity) {
    parts.push(
      '',
      'Scanned resume structure to deepen (preserve ids and role boundaries; decompose bullets from source_text):',
      JSON.stringify(seedIdentity, null, 2),
    )
  }

  if (existingDraft) {
    parts.push(
      '',
      'Existing draft identity:',
      JSON.stringify(existingDraft, null, 2),
    )
  }

  if (correctionNotes?.trim()) {
    parts.push('', 'Correction notes:', correctionNotes.trim())
  }

  parts.push(
    '',
    'Return a full draft even if some fields remain best-effort guesses. Keep follow-up questions short.',
  )

  return parts.join('\n')
}

export const buildDeepenBulletPrompt = ({
  identity,
  roleId,
  bulletId,
  correctionNotes,
}: {
  identity: ProfessionalIdentityV3
  roleId: string
  bulletId: string
  correctionNotes?: string
}): string => {
  const target = findRoleBullet(identity, roleId, bulletId)
  const parts = [
    'Scanned identity shell:',
    JSON.stringify(identity, null, 2),
    '',
    'Target role context:',
    JSON.stringify(
      {
        role_id: target.role.id,
        company: target.role.company,
        title: target.role.title,
        dates: target.role.dates,
        subtitle: target.role.subtitle ?? '',
      },
      null,
      2,
    ),
    '',
    'Target bullet to deepen:',
    JSON.stringify(
      {
        role_id: target.role.id,
        bullet_id: target.bullet.id,
        source_text: target.bullet.source_text ?? '',
      },
      null,
      2,
    ),
  ]

  if (correctionNotes?.trim()) {
    parts.push('', 'Correction notes:', correctionNotes.trim())
  }

  parts.push('', 'Return only the deepened bullet payload. Do not emit a full identity object.')
  return parts.join('\n')
}

export const generateIdentityDraft = async ({
  endpoint,
  sourceMaterial,
  correctionNotes,
  existingDraft,
  seedIdentity,
  signal,
}: {
  endpoint: string
  sourceMaterial: string
  correctionNotes?: string
  existingDraft?: ProfessionalIdentityV3 | null
  seedIdentity?: ProfessionalIdentityV3 | null
  signal?: AbortSignal
}): Promise<IdentityExtractionDraft> => {
  const rawResponse = await callLlmProxy(
    endpoint,
    EXTRACTION_SYSTEM_PROMPT,
    buildExtractionPrompt({ sourceMaterial, correctionNotes, existingDraft, seedIdentity }),
    {
      feature: 'identity.extract',
      model: 'sonnet',
      temperature: 0.2,
      timeoutMs: IDENTITY_EXTRACTION_TIMEOUT_MS,
      signal,
    },
  )

  return parseIdentityExtractionResponse(rawResponse)
}

export const deepenIdentityBullet = async ({
  endpoint,
  identity,
  roleId,
  bulletId,
  correctionNotes,
  signal,
}: {
  endpoint: string
  identity: ProfessionalIdentityV3
  roleId: string
  bulletId: string
  correctionNotes?: string
  signal?: AbortSignal
}): Promise<IdentityDeepenedBullet> => {
  const normalizedIdentity = normalizeRuntimeProfessionalIdentity(identity)
  const rawResponse = await callLlmProxy(
    endpoint,
    BULLET_DEEPENING_SYSTEM_PROMPT,
    buildDeepenBulletPrompt({
      identity: normalizedIdentity,
      roleId,
      bulletId,
      correctionNotes,
    }),
    {
      feature: 'identity.deepen',
      model: 'sonnet',
      temperature: 0.1,
      timeoutMs: IDENTITY_EXTRACTION_TIMEOUT_MS,
      signal,
    },
  )

  const result = parseDeepenIdentityBulletResponse(rawResponse, normalizedIdentity)
  if (result.roleId !== roleId || result.bulletId !== bulletId) {
    throw new Error(
      `Deepening response targeted ${result.roleId}/${result.bulletId}, expected ${roleId}/${bulletId}.`,
    )
  }

  return result
}
