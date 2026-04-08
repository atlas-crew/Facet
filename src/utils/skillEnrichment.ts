import type {
  ProfessionalIdentityV3,
  ProfessionalSkillDepth,
  ProfessionalSkillGroup,
  ProfessionalSkillItem,
} from '../identity/schema'
import { callLlmProxy, extractJsonBlock, JsonExtractionError, isString } from './llmProxy'

const SKILL_ENRICHMENT_MODEL = 'haiku'
const VALID_DEPTHS = new Set<ProfessionalSkillDepth>(['expert', 'strong', 'working', 'basic', 'avoid'])

export { JsonExtractionError }

export interface SkillEnrichmentSuggestion {
  depth: ProfessionalSkillDepth
  context: string
  searchSignal: string
}

interface SkillEvidenceSnippet {
  source: string
  text: string
}

interface SkillNeedle {
  term: string
  matcher: RegExp
}

export interface GenerateSkillEnrichmentInput {
  endpoint: string
  identity: ProfessionalIdentityV3
  group: ProfessionalSkillGroup
  skill: ProfessionalSkillItem
  signal?: AbortSignal
}

const normalizeSpace = (value: string): string => value.replace(/\s+/g, ' ').trim()

const escapeRegExp = (value: string): string => value.replace(/[.*+?^$()|[\]{}]/g, '\\$&')

const buildNeedles = (skill: ProfessionalSkillItem): SkillNeedle[] => {
  const rawTerms = [skill.name, ...(skill.tags ?? [])]
  const needles: SkillNeedle[] = []
  const seen = new Set<string>()

  for (const term of rawTerms) {
    const normalized = normalizeSpace(term).toLowerCase()
    if (!normalized || seen.has(normalized)) {
      continue
    }
    seen.add(normalized)
    const escaped = escapeRegExp(normalized)
    needles.push({
      term: normalized,
      matcher: new RegExp(`(^|\\W)${escaped}(\\W|$)`, 'i'),
    })
  }

  return needles
}

const matchesSkill = (text: string, needles: SkillNeedle[]): boolean => {
  const normalized = normalizeSpace(text).toLowerCase()
  return needles.some(({ matcher }) => matcher.test(normalized))
}

const collectEvidence = (
  identity: ProfessionalIdentityV3,
  group: ProfessionalSkillGroup,
  skill: ProfessionalSkillItem,
): SkillEvidenceSnippet[] => {
  const needles = buildNeedles(skill)
  const snippets: SkillEvidenceSnippet[] = []

  for (const role of identity.roles) {
    for (const bullet of role.bullets) {
      const fragments = [
        bullet.source_text,
        bullet.problem,
        bullet.action,
        bullet.outcome,
        ...(bullet.impact ?? []),
        ...(bullet.technologies ?? []),
        ...(bullet.tags ?? []),
      ].filter(isString)
      if (!matchesSkill(fragments.join(' '), needles)) {
        continue
      }

      snippets.push({
        source: `Role: ${role.company} - ${role.title}`,
        text: normalizeSpace(
          [
            bullet.source_text,
            bullet.problem,
            bullet.action,
            bullet.outcome,
            (bullet.impact?.length ?? 0) > 0 ? `Impact: ${(bullet.impact ?? []).join('; ')}` : '',
            (bullet.technologies?.length ?? 0) > 0
              ? `Technologies: ${(bullet.technologies ?? []).join(', ')}`
              : '',
          ]
            .filter(Boolean)
            .join(' '),
        ),
      })
    }
  }

  for (const project of identity.projects) {
    const fragments = [project.name, project.description, ...(project.tags ?? [])]
    if (!matchesSkill(fragments.join(' '), needles)) {
      continue
    }

    snippets.push({
      source: `Project: ${project.name}`,
      text: normalizeSpace(
        [
          project.description,
          project.url ? `URL: ${project.url}` : '',
          project.tags.length > 0 ? `Tags: ${project.tags.join(', ')}` : '',
        ]
          .filter(Boolean)
          .join(' '),
      ),
    })
  }

  if (snippets.length === 0) {
    snippets.push({
      source: `Skill Group: ${group.label}`,
      text: normalizeSpace(
        [
          group.positioning ? `Positioning: ${group.positioning}` : '',
          skill.context ? `Existing context: ${skill.context}` : '',
          skill.search_signal ? `Existing search signal: ${skill.search_signal}` : '',
        ]
          .filter(Boolean)
          .join(' '),
      ) || 'No direct evidence matched the skill name or tags. Use the broader identity thesis and group context only.',
    })
  }

  return snippets.slice(0, 8)
}

const buildPrompt = (
  identity: ProfessionalIdentityV3,
  group: ProfessionalSkillGroup,
  skill: ProfessionalSkillItem,
): string => {
  const evidence = collectEvidence(identity, group, skill)

  return JSON.stringify(
    {
      identity: {
        name: identity.identity.name,
        title: identity.identity.title ?? null,
        thesis: identity.identity.thesis,
        elaboration: identity.identity.elaboration ?? null,
      },
      skillGroup: {
        id: group.id,
        label: group.label,
        positioning: group.positioning ?? null,
        isDifferentiator: group.is_differentiator ?? null,
      },
      skill: {
        name: skill.name,
        tags: skill.tags,
        existingDepth: skill.depth ?? null,
        existingContext: skill.context ?? null,
        existingSearchSignal: skill.search_signal ?? null,
      },
      evidence,
    },
    null,
    2,
  )
}

const normalizeSuggestion = (payload: unknown): SkillEnrichmentSuggestion => {
  const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}
  const depth = isString(record.depth) ? record.depth.trim().toLowerCase() : ''
  const context = isString(record.context) ? normalizeSpace(record.context) : ''
  const rawSearchSignal = record.searchSignal ?? record.search_signal
  const searchSignal = isString(rawSearchSignal) ? normalizeSpace(rawSearchSignal) : ''

  if (!VALID_DEPTHS.has(depth as ProfessionalSkillDepth)) {
    throw new Error(`Invalid skill depth in enrichment suggestion: "${depth || 'missing'}".`)
  }

  if (!context) {
    throw new Error('Missing required field in enrichment suggestion: context.')
  }

  if (!searchSignal) {
    throw new Error('Missing required field in enrichment suggestion: searchSignal.')
  }

  return {
    depth: depth as ProfessionalSkillDepth,
    context,
    searchSignal,
  }
}

export async function generateSkillEnrichmentSuggestion({
  endpoint,
  identity,
  group,
  skill,
  signal,
}: GenerateSkillEnrichmentInput): Promise<SkillEnrichmentSuggestion> {
  const systemPrompt = `You are enriching a professional identity skill record for job search and writing workflows.
Return JSON only.
Use only the provided source material.
Pick the lowest defensible depth if the evidence is ambiguous.
Write concise, specific prose that would help downstream search and matching.

Response schema:
{
  "depth": "expert|strong|working|basic|avoid",
  "context": "string",
  "searchSignal": "string"
}`

  const rawResponse = await callLlmProxy(endpoint, systemPrompt, buildPrompt(identity, group, skill), {
    feature: 'identity.extract',
    model: SKILL_ENRICHMENT_MODEL,
    timeoutMs: 45000,
    signal,
  })

  try {
    return normalizeSuggestion(JSON.parse(extractJsonBlock(rawResponse)))
  } catch (error) {
    if (error instanceof JsonExtractionError) {
      throw error
    }
    if (error instanceof Error) {
      throw error
    }
    throw new Error('Failed to parse skill enrichment suggestion.')
  }
}
