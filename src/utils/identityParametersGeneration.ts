import type {
  ProfessionalAwarenessSeverity,
  ProfessionalIdentityV3,
  ProfessionalOpenQuestion,
  ProfessionalSearchVector,
  ProfessionalSearchVectorPriority,
} from '../identity/schema'
import { createId } from './idUtils'
import { parseJsonWithRepair } from './jsonParsing'
import { callLlmProxy, extractJsonBlock, JsonExtractionError, isString } from './llmProxy'
import { RESEARCH_PROFILE_INFERENCE_TIMEOUT_MS } from './researchProfileInferenceConfig'

const GENERATION_MODEL = 'haiku'
const VECTOR_PRIORITY_VALUES = new Set<ProfessionalSearchVectorPriority>(['high', 'medium', 'low'])
const AWARENESS_SEVERITY_VALUES = new Set<ProfessionalAwarenessSeverity>(['high', 'medium', 'low'])

const normalizeStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .filter(isString)
        .map((entry) => entry.trim())
        .filter(Boolean)
    : []

const buildGenerationPrompt = (identity: ProfessionalIdentityV3) =>
  JSON.stringify(
    {
      identity: identity.identity,
      self_model: identity.self_model,
      preferences: identity.preferences,
      skills: identity.skills,
      profiles: identity.profiles,
      roles: identity.roles,
      projects: identity.projects,
      education: identity.education,
      generator_rules: identity.generator_rules,
      search_vectors: identity.search_vectors,
      awareness: identity.awareness,
    },
    null,
    2,
  )

const parseGeneratedPayload = (rawResponse: string, context: string): unknown => {
  try {
    const parsed = parseJsonWithRepair<unknown>(extractJsonBlock(rawResponse), context).data
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`${context} must be a JSON object.`)
    }

    return parsed
  } catch (error) {
    if (error instanceof JsonExtractionError) {
      throw new JsonExtractionError(`${context}: ${error.message}`)
    }

    throw new Error(error instanceof Error ? error.message : `Unable to parse ${context}.`)
  }
}

const normalizeGeneratedVectors = (payload: unknown): ProfessionalSearchVector[] => {
  const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}
  const vectors = Array.isArray(record.search_vectors) ? record.search_vectors : []

  return vectors.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') {
      return []
    }

    const vector = entry as Record<string, unknown>
    const title = isString(vector.title) ? vector.title.trim() : ''
    const thesis = isString(vector.thesis) ? vector.thesis.trim() : ''
    if (!title || !thesis) {
      return []
    }

    const priority = VECTOR_PRIORITY_VALUES.has(vector.priority as ProfessionalSearchVectorPriority)
      ? (vector.priority as ProfessionalSearchVectorPriority)
      : 'medium'

    return [
      {
        id: isString(vector.id) && vector.id.trim() ? vector.id.trim() : createId('svec'),
        title,
        priority,
        ...(isString(vector.subtitle) && vector.subtitle.trim()
          ? { subtitle: vector.subtitle.trim() }
          : {}),
        thesis,
        target_roles: normalizeStringArray(vector.target_roles),
        keywords: {
          primary: normalizeStringArray((vector.keywords as Record<string, unknown> | undefined)?.primary),
          secondary: normalizeStringArray((vector.keywords as Record<string, unknown> | undefined)?.secondary),
        },
        supporting_skills: normalizeStringArray(vector.supporting_skills),
        supporting_bullets: normalizeStringArray(vector.supporting_bullets),
        evidence: normalizeStringArray(vector.evidence),
        needs_review: true,
      } satisfies ProfessionalSearchVector,
    ]
  })
}

const normalizeGeneratedAwareness = (payload: unknown): ProfessionalOpenQuestion[] => {
  const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}
  const questions = Array.isArray(record.open_questions) ? record.open_questions : []

  return questions.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') {
      return []
    }

    const question = entry as Record<string, unknown>
    const topic = isString(question.topic) ? question.topic.trim() : ''
    const description = isString(question.description) ? question.description.trim() : ''
    const action = isString(question.action) ? question.action.trim() : ''
    if (!topic || !description || !action) {
      return []
    }

    const severity = AWARENESS_SEVERITY_VALUES.has(question.severity as ProfessionalAwarenessSeverity)
      ? (question.severity as ProfessionalAwarenessSeverity)
      : undefined

    return [
      {
        id: isString(question.id) && question.id.trim() ? question.id.trim() : createId('oq'),
        topic,
        description,
        action,
        ...(severity ? { severity } : {}),
        evidence: normalizeStringArray(question.evidence),
        needs_review: true,
      } satisfies ProfessionalOpenQuestion,
    ]
  })
}

export async function generateSearchVectorsFromIdentity(
  identity: ProfessionalIdentityV3,
  endpoint: string,
): Promise<ProfessionalSearchVector[]> {
  const systemPrompt = `You are a search-vector strategist. Return JSON only.
Propose search vectors from the supplied identity model. Respect generator_rules.accuracy as hard truth constraints.
Each vector must include evidence strings explaining why it exists, plus any supporting skill ids and bullet ids that justify it.
Do not repeat existing vectors unless the supplied identity data materially supports a better framing.

Response schema:
{
  "search_vectors": [
    {
      "id": "optional string",
      "title": "string",
      "priority": "high|medium|low",
      "subtitle": "optional string",
      "thesis": "string",
      "target_roles": ["string"],
      "keywords": {
        "primary": ["string"],
        "secondary": ["string"]
      },
      "supporting_skills": ["string"],
      "supporting_bullets": ["string"],
      "evidence": ["string"]
    }
  ]
}`

  const rawResponse = await callLlmProxy(endpoint, systemPrompt, buildGenerationPrompt(identity), {
    feature: 'research.profile-inference',
    model: GENERATION_MODEL,
    timeoutMs: RESEARCH_PROFILE_INFERENCE_TIMEOUT_MS,
  })

  try {
    return normalizeGeneratedVectors(parseGeneratedPayload(rawResponse, 'Generated search vectors response'))
  } catch (error) {
    if (error instanceof JsonExtractionError) {
      throw error
    }
    throw error instanceof Error ? error : new Error('Failed to parse generated search vectors.')
  }
}

export async function generateAwarenessFromIdentity(
  identity: ProfessionalIdentityV3,
  endpoint: string,
): Promise<ProfessionalOpenQuestion[]> {
  const systemPrompt = `You are an awareness-builder agent. Return JSON only.
Propose open questions that would improve job-search positioning for this candidate. Respect generator_rules.accuracy as hard truth constraints.
Each question must include evidence strings explaining why the gap matters now.
Do not repeat awareness items already present unless the supplied identity supports a stronger or more actionable version.

Response schema:
{
  "open_questions": [
    {
      "id": "optional string",
      "topic": "string",
      "description": "string",
      "action": "string",
      "severity": "high|medium|low",
      "evidence": ["string"]
    }
  ]
}`

  const rawResponse = await callLlmProxy(endpoint, systemPrompt, buildGenerationPrompt(identity), {
    feature: 'research.profile-inference',
    model: GENERATION_MODEL,
    timeoutMs: RESEARCH_PROFILE_INFERENCE_TIMEOUT_MS,
  })

  try {
    return normalizeGeneratedAwareness(parseGeneratedPayload(rawResponse, 'Generated awareness response'))
  } catch (error) {
    if (error instanceof JsonExtractionError) {
      throw error
    }
    throw error instanceof Error ? error : new Error('Failed to parse generated awareness items.')
  }
}
