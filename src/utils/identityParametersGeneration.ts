import type {
  ProfessionalAwarenessSeverity,
  ProfessionalInterviewStyle,
  ProfessionalIdentityCore,
  ProfessionalIdentityV3,
  ProfessionalPhilosophyEntry,
  ProfessionalProfile,
  ProfessionalOpenQuestion,
  ProfessionalSearchVector,
  ProfessionalSearchVectorPriority,
} from '../identity/schema'
import { createId, slugify } from './idUtils'
import { parseJsonWithRepair } from './jsonParsing'
import { callLlmProxy, extractJsonBlock, JsonExtractionError, isString } from './llmProxy'
import { RESEARCH_PROFILE_INFERENCE_TIMEOUT_MS } from './researchProfileInferenceConfig'

const GENERATION_MODEL = 'opus'
const VECTOR_PRIORITY_VALUES = new Set<ProfessionalSearchVectorPriority>(['high', 'medium', 'low'])
const AWARENESS_SEVERITY_VALUES = new Set<ProfessionalAwarenessSeverity>(['high', 'medium', 'low'])

export interface ProfessionalStrategicInference {
  competitive_moat?: string
  unfair_advantages: string[]
  search_vectors: ProfessionalSearchVector[]
  open_questions: ProfessionalOpenQuestion[]
}

export type ProfessionalIdentityThesisInference = Pick<
  ProfessionalIdentityCore,
  'thesis' | 'title' | 'origin' | 'elaboration'
>

export interface ProfessionalSelfKnowledgeInference {
  philosophy: ProfessionalPhilosophyEntry[]
  interview_style: ProfessionalInterviewStyle
}

export interface ProfessionalStrategicInferenceOptions {
  mode?: 'fill' | 'regenerate'
  signal?: AbortSignal
}

const normalizeStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .filter(isString)
        .map((entry) => entry.trim())
        .filter(Boolean)
    : []

const normalizeOptionalString = (value: unknown): string | undefined =>
  isString(value) && value.trim() ? value.trim() : undefined

const removeVoiceTells = (value: string): string => value.replace(/\s*—\s*/g, ', ').trim()

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
      throw new JsonExtractionError(`${context}: ${error.message}`, error.kind, error.diagnostic)
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

const normalizeGeneratedStrategy = (payload: unknown): ProfessionalStrategicInference => {
  const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}
  const awarenessRecord =
    record.awareness && typeof record.awareness === 'object'
      ? (record.awareness as Record<string, unknown>)
      : null
  const openQuestionsPayload = Array.isArray(record.open_questions)
    ? { open_questions: record.open_questions }
    : awarenessRecord && Array.isArray(awarenessRecord.open_questions)
      ? { open_questions: awarenessRecord.open_questions }
      : { open_questions: [] }
  const competitiveMoat = normalizeOptionalString(record.competitive_moat)

  return {
    ...(competitiveMoat ? { competitive_moat: competitiveMoat } : {}),
    unfair_advantages: normalizeStringArray(record.unfair_advantages),
    search_vectors: normalizeGeneratedVectors(record),
    open_questions: normalizeGeneratedAwareness(openQuestionsPayload),
  }
}

const normalizeGeneratedThesis = (payload: unknown): ProfessionalIdentityThesisInference => {
  const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}
  const thesis = normalizeOptionalString(record.thesis)
  if (!thesis) {
    throw new Error('Generated thesis response must include thesis.')
  }

  const title = normalizeOptionalString(record.title)
  const origin = normalizeOptionalString(record.origin)
  const elaboration = normalizeOptionalString(record.elaboration)

  return {
    thesis: removeVoiceTells(thesis),
    ...(title ? { title: removeVoiceTells(title) } : {}),
    ...(origin ? { origin: removeVoiceTells(origin) } : {}),
    ...(elaboration ? { elaboration: removeVoiceTells(elaboration) } : {}),
  }
}

const normalizeGeneratedSelfKnowledge = (payload: unknown): ProfessionalSelfKnowledgeInference => {
  const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}
  const philosophy = Array.isArray(record.philosophy) ? record.philosophy : []
  const interviewRecord =
    record.interview_style && typeof record.interview_style === 'object'
      ? (record.interview_style as Record<string, unknown>)
      : {}

  return {
    philosophy: philosophy.flatMap((entry) => {
      if (!entry || typeof entry !== 'object') return []

      const philosophyEntry = entry as Record<string, unknown>
      const text = normalizeOptionalString(philosophyEntry.text)
      if (!text) return []

      return [
        {
          id:
            isString(philosophyEntry.id) && philosophyEntry.id.trim()
              ? philosophyEntry.id.trim()
              : createId('phil'),
          text: removeVoiceTells(text),
          tags: normalizeStringArray(philosophyEntry.tags).map(removeVoiceTells),
        } satisfies ProfessionalPhilosophyEntry,
      ]
    }),
    interview_style: {
      strengths: normalizeStringArray(interviewRecord.strengths).map(removeVoiceTells),
      weaknesses: normalizeStringArray(interviewRecord.weaknesses).map(removeVoiceTells),
      prep_strategy: removeVoiceTells(normalizeOptionalString(interviewRecord.prep_strategy) ?? ''),
    },
  }
}

const normalizeGeneratedProfiles = (payload: unknown): ProfessionalProfile[] => {
  const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}
  const profiles = Array.isArray(record.profiles) ? record.profiles : []
  const seenIds = new Set<string>()

  return profiles.flatMap((entry, index) => {
    if (!entry || typeof entry !== 'object') return []

    const profile = entry as Record<string, unknown>
    const text = normalizeOptionalString(profile.text)
    if (!text) return []

    const idCandidate =
      (isString(profile.id) && profile.id.trim()) ||
      (isString(profile.title) && profile.title.trim()) ||
      normalizeStringArray(profile.tags)[0] ||
      ''
    const baseId = slugify(idCandidate) || `profile-${index + 1}`
    let id = baseId
    let suffix = 2
    while (seenIds.has(id)) {
      id = `${baseId}-${suffix}`
      suffix += 1
    }
    seenIds.add(id)
    const tags = normalizeStringArray(profile.tags)
      .map((tag) => slugify(removeVoiceTells(tag)))
      .filter(Boolean)

    return [
      {
        id,
        tags,
        text: removeVoiceTells(text),
      } satisfies ProfessionalProfile,
    ]
  })
}

export async function generateIdentityProfilesFromIdentity(
  identity: ProfessionalIdentityV3,
  endpoint: string,
  options: { signal?: AbortSignal } = {},
): Promise<ProfessionalProfile[]> {
  const systemPrompt = `You are a senior career strategist for staff-plus engineering candidates. Return JSON only.
Generate durable profile lenses from the supplied identity model.

Profiles are reusable identity framings. They are not JD audience tags and not one-off job tailoring. Each profile should capture a distinct, evidence-backed way to present the candidate's durable identity.

Respect generator_rules.accuracy as hard truth constraints. Do not invent candidate claims. Use roles, projects, skills, thesis, self_model, and existing profiles as evidence.

Reasoning requirements:
- Return 2 to 4 profiles.
- Make each profile distinct enough to justify its own lens.
- Prefer profile IDs and tags that map to real positioning lanes, such as platform, infrastructure, security, leadership, product-judgment, or developer-experience.
- The text should be one concise paragraph. It should be specific enough to guide resume assembly and profile writing.
- If existing profiles are weak, replace them with sharper profile lenses. If existing profiles are strong, preserve their meaning while improving clarity.

Voice requirements:
- Write like a precise senior engineer, not a marketing page.
- Avoid AI tells: no em dashes, no hype, no vague transformation language, no "uniquely positioned" phrasing.
- Use plain punctuation. Never use an em dash.

Response schema:
{
  "profiles": [
    {
      "id": "stable kebab-case string",
      "tags": ["kebab-case string"],
      "text": "string"
    }
  ]
}`

  const rawResponse = await callLlmProxy(endpoint, systemPrompt, buildGenerationPrompt(identity), {
    feature: 'research.profile-inference',
    model: GENERATION_MODEL,
    timeoutMs: RESEARCH_PROFILE_INFERENCE_TIMEOUT_MS,
    signal: options.signal,
  })

  try {
    return normalizeGeneratedProfiles(parseGeneratedPayload(rawResponse, 'Generated profiles response'))
  } catch (error) {
    if (error instanceof JsonExtractionError) {
      throw error
    }
    throw error instanceof Error ? error : new Error('Failed to parse generated profiles.')
  }
}

export async function generateIdentityThesisFromIdentity(
  identity: ProfessionalIdentityV3,
  endpoint: string,
  options: { signal?: AbortSignal } = {},
): Promise<ProfessionalIdentityThesisInference> {
  const systemPrompt = `You are a senior career strategist for staff-plus engineering candidates. Return JSON only.
Generate the candidate's durable identity thesis from the supplied identity model.

Respect generator_rules.accuracy as hard truth constraints. Do not invent candidate claims. Use roles, projects, skills, profiles, and existing self_model as evidence.

Voice requirements:
- Write like a precise senior engineer, not a marketing page.
- Avoid AI tells: no em dashes, no hype, no vague transformation language, no "uniquely positioned" phrasing.
- The thesis should be one strong sentence.
- The title should be short and role-like.
- The origin and elaboration may be private scaffolding, but must still be grounded in evidence.

Response schema:
{
  "thesis": "string",
  "title": "optional string",
  "origin": "optional string",
  "elaboration": "optional string"
}`

  const rawResponse = await callLlmProxy(endpoint, systemPrompt, buildGenerationPrompt(identity), {
    feature: 'research.profile-inference',
    model: GENERATION_MODEL,
    timeoutMs: RESEARCH_PROFILE_INFERENCE_TIMEOUT_MS,
    signal: options.signal,
  })

  try {
    return normalizeGeneratedThesis(parseGeneratedPayload(rawResponse, 'Generated identity thesis response'))
  } catch (error) {
    if (error instanceof JsonExtractionError) {
      throw error
    }
    throw error instanceof Error ? error : new Error('Failed to parse generated identity thesis.')
  }
}

export async function generateSelfKnowledgeFromIdentity(
  identity: ProfessionalIdentityV3,
  endpoint: string,
  options: { signal?: AbortSignal } = {},
): Promise<ProfessionalSelfKnowledgeInference> {
  const systemPrompt = `You are a senior career strategist for staff-plus engineering candidates. Return JSON only.
Generate durable self-knowledge from the supplied identity model: philosophy positions and interview self-knowledge.

Respect generator_rules.accuracy as hard truth constraints. Do not invent candidate claims. Use roles, projects, skills, profiles, thesis, and existing self_model as evidence.

Reasoning requirements:
- Philosophy entries should capture durable operating principles, engineering taste, leadership beliefs, and market-facing judgment.
- Interview strengths should be specific patterns the candidate can credibly prove.
- Interview weaknesses should be honest, non-damaging calibration points that can guide preparation.
- Prep strategy should tell the candidate how to use their evidence in interviews, not generic advice.
- Prefer 3 to 5 philosophy entries, 3 to 5 strengths, 2 to 4 weaknesses, and one concise prep strategy.

Voice requirements:
- Write like a precise senior engineer, not a marketing page.
- Avoid AI tells: no em dashes, no hype, no vague transformation language, no "uniquely positioned" phrasing.
- Use plain punctuation. Never use an em dash.

Response schema:
{
  "philosophy": [
    {
      "id": "optional stable kebab-case string",
      "text": "string",
      "tags": ["string"]
    }
  ],
  "interview_style": {
    "strengths": ["string"],
    "weaknesses": ["string"],
    "prep_strategy": "string"
  }
}`

  const rawResponse = await callLlmProxy(endpoint, systemPrompt, buildGenerationPrompt(identity), {
    feature: 'research.profile-inference',
    model: GENERATION_MODEL,
    timeoutMs: RESEARCH_PROFILE_INFERENCE_TIMEOUT_MS,
    signal: options.signal,
  })

  try {
    return normalizeGeneratedSelfKnowledge(
      parseGeneratedPayload(rawResponse, 'Generated self-knowledge response'),
    )
  } catch (error) {
    if (error instanceof JsonExtractionError) {
      throw error
    }
    throw error instanceof Error ? error : new Error('Failed to parse generated self-knowledge.')
  }
}

export async function generateStrategicPositioningFromIdentity(
  identity: ProfessionalIdentityV3,
  endpoint: string,
  options: ProfessionalStrategicInferenceOptions = {},
): Promise<ProfessionalStrategicInference> {
  const moatInstruction =
    options.mode === 'regenerate'
      ? 'If competitive_moat already exists, you may return a sharper replacement when evidence supports it. Do not preserve weak existing copy just because it exists.'
      : 'If competitive_moat already exists, do not return a replacement. Use the existing moat as strategy context and sharpen unfair_advantages, search_vectors, and open_questions around it.'

  const systemPrompt = `You are a senior career strategist for staff-plus engineering candidates. Return JSON only.
Reason across the full identity model before producing fields. The goal is one coherent market strategy, not independent field filling.

Respect generator_rules.accuracy as hard truth constraints. Do not invent candidate claims. Use the roles, projects, skills, profiles, and existing self_model as evidence.

Strategic reasoning requirements:
- Identify the candidate's strongest defensible market position.
- Separate real competitive edge from generic senior-engineer language.
- Prefer precise, searchable lanes that map to target roles and company signals.
- Include evidence strings for every proposed vector and open question.
- Do not repeat existing search vectors, unfair advantages, or awareness items unless the supplied identity supports a stronger, more actionable framing.
- ${moatInstruction}

Response schema:
{
  "competitive_moat": "optional string",
  "unfair_advantages": ["string"],
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
  ],
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
    signal: options.signal,
  })

  try {
    return normalizeGeneratedStrategy(parseGeneratedPayload(rawResponse, 'Generated strategy response'))
  } catch (error) {
    if (error instanceof JsonExtractionError) {
      throw error
    }
    throw error instanceof Error ? error : new Error('Failed to parse generated strategy.')
  }
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
