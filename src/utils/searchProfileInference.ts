import type { ProfessionalIdentityV3 } from '../identity/schema'
import type { ResumeData } from '../types'
import type {
  SearchProfile,
  SearchSkillCategory,
  SearchSkillDepth,
  SearchWorkSummaryEntry,
  SkillCatalogEntry,
  VectorSearchConfig,
} from '../types/search'
import { createId } from './idUtils'
import { callLlmProxy, extractJsonBlock, JsonExtractionError, isString } from './llmProxy'

/** Model used for profile inference — structured extraction from resume data. */
const PROFILE_INFERENCE_MODEL = 'haiku'
export { JsonExtractionError }

type InferredSearchProfile = Pick<
  SearchProfile,
  'skills' | 'vectors' | 'workSummary' | 'openQuestions'
>

type IdentitySearchEnhancement = Pick<SearchProfile, 'workSummary' | 'openQuestions'>

const VALID_SKILL_CATEGORIES = new Set<SearchSkillCategory>([
  'backend',
  'frontend',
  'platform',
  'devops',
  'cloud',
  'data',
  'ai-ml',
  'security',
  'architecture',
  'leadership',
  'product',
  'domain',
  'other',
])

const VALID_SKILL_DEPTHS = new Set<SearchSkillDepth>([
  'expert',
  'strong',
  'working',
  'basic',
  'avoid',
])

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter(isString)
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizeSkills(value: unknown): SkillCatalogEntry[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((skill) => {
    if (!skill || typeof skill !== 'object') {
      return []
    }

    const record = skill as Record<string, unknown>
    const name = isString(record.name) ? record.name.trim() : ''
    const depth = record.depth
    if (!name || !VALID_SKILL_DEPTHS.has(depth as SearchSkillDepth)) {
      return []
    }

    const category = VALID_SKILL_CATEGORIES.has(record.category as SearchSkillCategory)
      ? (record.category as SearchSkillCategory)
      : 'other'

    return [
      {
        id: createId('skl'),
        name,
        category,
        depth: depth as SearchSkillDepth,
        context: isString(record.context) ? record.context.trim() : undefined,
        searchSignal: isString(record.searchSignal) ? record.searchSignal.trim() : undefined,
      },
    ]
  })
}

function normalizeVectors(value: unknown, resumeData: ResumeData): VectorSearchConfig[] {
  if (!Array.isArray(value)) {
    return []
  }

  const validVectorIds = new Set(resumeData.vectors.map((vector) => vector.id))

  return value.flatMap((vector, index) => {
    if (!vector || typeof vector !== 'object') {
      return []
    }

    const record = vector as Record<string, unknown>
    const vectorId = isString(record.vectorId) ? record.vectorId.trim() : ''
    if (!vectorId || !validVectorIds.has(vectorId)) {
      return []
    }

    const priority =
      typeof record.priority === 'number' && Number.isFinite(record.priority)
        ? Math.max(1, Math.round(record.priority))
        : index + 1

    return [
      {
        vectorId,
        priority,
        description: isString(record.description) ? record.description.trim() : '',
        targetRoleTitles: normalizeStringArray(record.targetRoleTitles),
        searchKeywords: normalizeStringArray(record.searchKeywords),
      },
    ]
  })
}

function normalizeWorkSummary(value: unknown): SearchWorkSummaryEntry[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((entry) => {
    if (isString(entry)) {
      const summary = entry.trim()
      return summary ? [{ title: 'Career Summary', summary }] : []
    }

    if (!entry || typeof entry !== 'object') {
      return []
    }

    const record = entry as Record<string, unknown>
    const title = isString(record.title) ? record.title.trim() : ''
    const summary = isString(record.summary) ? record.summary.trim() : ''
    if (!summary) {
      return []
    }

    return [{ title: title || 'Career Summary', summary }]
  })
}

export function buildInferencePrompt(resumeData: ResumeData): string {
  return `Resume data:
${JSON.stringify(
    {
      meta: resumeData.meta,
      vectors: resumeData.vectors,
      target_lines: resumeData.target_lines,
      profiles: resumeData.profiles,
      skill_groups: resumeData.skill_groups,
      roles: resumeData.roles,
      projects: resumeData.projects,
      education: resumeData.education,
      certifications: resumeData.certifications,
    },
    null,
    2,
  )}

Return JSON only.`
}

export function normalizeInferredProfile(
  payload: unknown,
  resumeData: ResumeData,
): InferredSearchProfile {
  const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}

  return {
    skills: normalizeSkills(record.skills),
    vectors: normalizeVectors(record.vectors, resumeData),
    workSummary: normalizeWorkSummary(record.workSummary),
    openQuestions: normalizeStringArray(record.openQuestions),
  }
}

export function buildIdentityInferencePrompt(identity: ProfessionalIdentityV3): string {
  return `Professional identity:
${JSON.stringify(
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
  )}

Return JSON only.`
}

export function normalizeIdentitySearchEnhancement(
  payload: unknown,
): IdentitySearchEnhancement {
  const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}

  return {
    workSummary: normalizeWorkSummary(record.workSummary),
    openQuestions: normalizeStringArray(record.openQuestions),
  }
}

export async function inferSearchProfile(
  resumeData: ResumeData,
  endpoint: string,
): Promise<InferredSearchProfile> {
  const systemPrompt = `You are a career positioning strategist helping a candidate search for strong-fit jobs. Return JSON only.
Infer a durable search profile from the candidate's resume data. Extract the skills that matter for job search, estimate proficiency depth, define vector-specific search strategies, summarize relevant work history, and surface open questions that would improve search precision.
Be concrete, concise, and truthful to the provided source material. Do not invent employers, credentials, or clearance.

Response schema:
{
  "skills": [
    {
      "name": "string",
      "category": "backend|frontend|platform|devops|cloud|data|ai-ml|security|architecture|leadership|product|domain|other",
      "depth": "expert|strong|working|basic|avoid",
      "context": "optional string",
      "searchSignal": "optional string"
    }
  ],
  "vectors": [
    {
      "vectorId": "string",
      "priority": 1,
      "description": "string",
      "targetRoleTitles": ["string"],
      "searchKeywords": ["string"]
    }
  ],
  "workSummary": [
    {
      "title": "string",
      "summary": "string"
    }
  ],
  "openQuestions": ["string"]
}`

  const rawResponse = await callLlmProxy(endpoint, systemPrompt, buildInferencePrompt(resumeData), {
    feature: 'research.profile-inference',
    model: PROFILE_INFERENCE_MODEL,
    timeoutMs: 45000,
  })

  try {
    return normalizeInferredProfile(JSON.parse(extractJsonBlock(rawResponse)), resumeData)
  } catch (error) {
    if (error instanceof JsonExtractionError) {
      throw error
    }
    throw new Error('Failed to parse inferred search profile.')
  }
}

export async function inferSearchProfileFromIdentity(
  identity: ProfessionalIdentityV3,
  endpoint: string,
): Promise<IdentitySearchEnhancement> {
  const systemPrompt = `You are a career positioning strategist helping a candidate search for strong-fit jobs. Return JSON only.
The identity document already stores durable strategic data such as matching filters, constraints, vectors, and awareness items. Do not rewrite or duplicate those stored fields.
Use the identity document only to infer lightweight search-facing narrative:
- concise workSummary entries that help search explain the candidate's recent scope
- openQuestions only when the identity still has meaningful unresolved gaps
Any factual correction constraints in generator_rules.accuracy are authoritative and must be respected.

Response schema:
{
  "workSummary": [
    {
      "title": "string",
      "summary": "string"
    }
  ],
  "openQuestions": ["string"]
}`

  const rawResponse = await callLlmProxy(
    endpoint,
    systemPrompt,
    buildIdentityInferencePrompt(identity),
    {
      feature: 'research.profile-inference',
      model: PROFILE_INFERENCE_MODEL,
      timeoutMs: 45000,
    },
  )

  try {
    return normalizeIdentitySearchEnhancement(JSON.parse(extractJsonBlock(rawResponse)))
  } catch (error) {
    if (error instanceof JsonExtractionError) {
      throw error
    }
    throw new Error('Failed to parse identity-native search enhancement.')
  }
}
