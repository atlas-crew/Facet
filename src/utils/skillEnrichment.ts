import type {
  ProfessionalIdentityV3,
  ProfessionalSkillDepth,
  ProfessionalSkillGroup,
  ProfessionalSkillItem,
} from '../identity/schema'
import { callLlmProxy, extractJsonBlock, JsonExtractionError, isString } from './llmProxy'

const SKILL_ENRICHMENT_MODEL = 'haiku'
const AI_DEPTH_VALUES = new Set<ProfessionalSkillDepth>(['expert', 'strong', 'working', 'basic'])

export { JsonExtractionError }

export interface SkillEnrichmentSuggestion {
  depth?: ProfessionalSkillDepth
  context?: string
  positioning?: string
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
  draftDepth?: ProfessionalSkillDepth
  preserveDepth?: boolean
  signal?: AbortSignal
}

const normalizeSpace = (value: string): string => value.replace(/\s+/g, ' ').trim()

const escapeRegExp = (value: string): string => value.replace(/[.*+?^$()|[\]{}]/g, '\\$&')

const buildNeedles = (
  skill: ProfessionalSkillItem,
  options?: { includeTags?: boolean },
): SkillNeedle[] => {
  const rawTerms = options?.includeTags === false ? [skill.name] : [skill.name, ...(skill.tags ?? [])]
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

const collectBulletEvidence = (
  identity: ProfessionalIdentityV3,
  skill: ProfessionalSkillItem,
): SkillEvidenceSnippet[] => {
  const needles = buildNeedles(skill, { includeTags: false })
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

  return snippets
}

const collectContextEvidence = (
  identity: ProfessionalIdentityV3,
  group: ProfessionalSkillGroup,
  skill: ProfessionalSkillItem,
  bulletEvidence: SkillEvidenceSnippet[],
): SkillEvidenceSnippet[] => {
  const needles = buildNeedles(skill)
  const snippets = [...bulletEvidence]

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
          skill.positioning ? `Existing positioning: ${skill.positioning}` : '',
        ]
          .filter(Boolean)
          .join(' '),
      ) || 'No direct evidence matched the skill name or tags. Use the broader identity thesis and group context only.',
    })
  }

  return snippets.slice(0, 8)
}

export const hasSkillEnrichmentBulletEvidence = (
  identity: ProfessionalIdentityV3,
  _group: ProfessionalSkillGroup,
  skill: ProfessionalSkillItem,
): boolean => collectBulletEvidence(identity, skill).length > 0

const buildPrompt = (
  identity: ProfessionalIdentityV3,
  group: ProfessionalSkillGroup,
  skill: ProfessionalSkillItem,
  draftDepth?: ProfessionalSkillDepth,
  preserveDepth?: boolean,
): string => {
  const bulletEvidence = collectBulletEvidence(identity, skill)
  const contextEvidence = collectContextEvidence(identity, group, skill, bulletEvidence)

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
        chosenDepth: draftDepth ?? null,
        preserveDepth: Boolean(preserveDepth),
        existingContext: skill.context ?? null,
        existingPositioning: skill.positioning ?? null,
      },
      bulletEvidence,
      contextEvidence,
    },
    null,
    2,
  )
}

const normalizeSuggestion = (payload: unknown): SkillEnrichmentSuggestion => {
  const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}
  const rawDepth = isString(record.depth) ? record.depth.trim().toLowerCase() : ''
  const hasContext = Object.hasOwn(record, 'context')
  const hasPositioning =
    Object.hasOwn(record, 'positioning') ||
    Object.hasOwn(record, 'searchSignal') ||
    Object.hasOwn(record, 'search_signal')
  const context = hasContext && isString(record.context) ? normalizeSpace(record.context) : ''
  const rawPositioning = record.positioning ?? record.searchSignal ?? record.search_signal
  const positioning = hasPositioning && isString(rawPositioning) ? normalizeSpace(rawPositioning) : ''

  if (rawDepth && !AI_DEPTH_VALUES.has(rawDepth as ProfessionalSkillDepth)) {
    throw new Error(`Invalid AI-inferred skill depth in enrichment suggestion: "${rawDepth}".`)
  }

  return {
    ...(rawDepth ? { depth: rawDepth as ProfessionalSkillDepth } : {}),
    ...(hasContext ? { context } : {}),
    ...(hasPositioning ? { positioning } : {}),
  }
}

export async function generateSkillEnrichmentSuggestion({
  endpoint,
  identity,
  group,
  skill,
  draftDepth,
  preserveDepth,
  signal,
}: GenerateSkillEnrichmentInput): Promise<SkillEnrichmentSuggestion> {
  const systemPrompt = `You are enriching a professional identity skill record for job search and writing workflows.
Return JSON only.
Use only the provided source material.

Depth rules:
- Never infer "avoid". Only a human can set avoid.
- Only infer depth when bulletEvidence is non-empty.
- If bulletEvidence is empty, return null for depth.
- If skill.preserveDepth is true, return null for depth and use skill.chosenDepth when writing context and positioning.
- If you do infer depth, choose only from expert, strong, working, or basic.

Context rules:
- Describe in one or two sentences how this person uses the skill in practice.
- Focus on shape of engagement: domain, patterns, or what is unusual.
- Do not restate accomplishments from bullets.
- Do not use first-person narrative.
- If there is nothing distinctive to say beyond generic usage, return an empty string.

Examples of good context:
- Ansible: "writes libraries/plugins in Python, uses roles/skills architecture"
- Rust: "primarily for proxy/server infrastructure and CLI tools, not embedded"
- Python: "primary language for platform backends, automation, custom Ansible modules"
- C#: "full platform work - ASP.NET, SQL Server, build systems, tooling"

Positioning rules:
- Write a short positioning directive for downstream generators.
- One sentence, maximum 15 words.
- Consider the chosen depth, context, and whether the skill is differentiating, expected, or ramping.
- If the skill does not need special positioning, return an empty string.

Examples of good positioning:
- "Strong match signal. List first."
- "Strong match signal, especially with Python. Rare combo."
- "Standard. Don't oversell."
- "Expected for Linux roles."
- "Can mention. Avoid deep Rust required roles."
- "Don't lead with this."
- "Can apply if other signals are strong. Flag as ramping."

Response schema:
{
  "depth": "expert|strong|working|basic" | null,
  "context": "string",
  "positioning": "string"
}`

  const rawResponse = await callLlmProxy(
    endpoint,
    systemPrompt,
    buildPrompt(identity, group, skill, draftDepth, preserveDepth),
    {
    feature: 'identity.extract',
    model: SKILL_ENRICHMENT_MODEL,
    timeoutMs: 45000,
    signal,
    },
  )

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
