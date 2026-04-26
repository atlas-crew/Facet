import type { ProfessionalIdentityV3 } from '../identity/schema'
import type {
  SearchFeedbackEvent,
  SearchKeywordCombination,
  SearchLane,
  SearchSkillDepthEntry,
  SearchThesis,
  SearchThesisAvoid,
  SearchTimeline,
  SearchUnfairAdvantage,
} from '../types/search'
import { createId } from './idUtils'
import { parseJsonWithRepair } from './jsonParsing'
import { callLlmProxy, extractJsonBlock, JsonExtractionError, isString } from './llmProxy'

const THESIS_GENERATION_TIMEOUT_MS = 90_000
const THESIS_GENERATION_THINKING_BUDGET = 10_000
const THESIS_GENERATION_MAX_TOKENS = 32_000
const THESIS_GENERATION_MAX_PROMPT_CHARS = 120_000

const VALID_NOISE_LEVELS = new Set(['low', 'medium', 'high'])
const VALID_URGENCY = new Set(['critical', 'active', 'exploratory'])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const normalizeString = (value: unknown): string =>
  isString(value) ? value.trim() : ''

const normalizeStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .map(normalizeString)
        .filter(Boolean)
    : []

const sentenceCount = (value: string): number =>
  value.split(/[.!?]+/).map((part) => part.trim()).filter(Boolean).length

const paragraphCount = (value: string): number =>
  value.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean).length

const normalizeSkillKey = (value: string): string =>
  value.trim().toLowerCase().replace(/\s+/g, ' ')

const identitySkillEntries = (identity: ProfessionalIdentityV3): Array<{
  name: string
  aliases: string[]
}> =>
  identity.skills.groups.flatMap((group) =>
    group.items
      .filter((item) => item.depth !== 'avoid' && !item.skipped_at)
      .flatMap((item) => {
        const name = item.name.trim()
        if (!name) return []
        const rawAliases = (item as unknown as { aliases?: unknown }).aliases
        const aliases = Array.isArray(rawAliases)
          ? rawAliases
              .map((alias) => (isString(alias) ? alias.trim() : ''))
              .filter(Boolean)
          : []
        return [{ name, aliases }]
      }),
  )

export function buildThesisGenerationPrompt(
  identity: ProfessionalIdentityV3,
  feedbackEvents: SearchFeedbackEvent[] = [],
): string {
  return [
    'Professional identity model:',
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
        model_revision: identity.model_revision,
      },
    ),
    '',
    'Previously applied feedback not yet reflected in the current thesis:',
    JSON.stringify(feedbackEvents),
    '',
    'Return JSON only, wrapped in <result></result>.',
  ].join('\n')
}

const normalizeUnfairAdvantages = (value: unknown): SearchUnfairAdvantage[] =>
  Array.isArray(value)
    ? value.flatMap((entry) => {
        if (!isRecord(entry)) return []
        const combination = normalizeString(entry.combination)
        const depth = normalizeString(entry.depth)
        const targetCompanyProfile = normalizeString(entry.targetCompanyProfile)
        return combination && depth && targetCompanyProfile
          ? [{ id: normalizeString(entry.id) || createId('sadv'), combination, depth, targetCompanyProfile }]
          : []
      })
    : []

const normalizeSearchLanes = (value: unknown): SearchLane[] =>
  Array.isArray(value)
    ? value.flatMap((entry, index) => {
        if (!isRecord(entry)) return []
        const title = normalizeString(entry.title)
        const rationale = normalizeString(entry.rationale)
        if (!title || !rationale) return []
        const targetSignals = normalizeStringArray(entry.targetSignals)
        return [{
          id: normalizeString(entry.id) || createId('slane'),
          title,
          rationale,
          ...(normalizeString(entry.competitiveContext)
            ? { competitiveContext: normalizeString(entry.competitiveContext) }
            : {}),
          targetSignals: targetSignals.length > 0
            ? targetSignals
            : [title || 'Lane ' + String(index + 1)],
        }]
      })
    : []

const normalizeAvoid = (value: unknown): SearchThesisAvoid[] =>
  Array.isArray(value)
    ? value.flatMap((entry) => {
        if (isString(entry)) {
          const label = entry.trim()
          return label ? [{ label }] : []
        }
        if (!isRecord(entry)) return []
        const label = normalizeString(entry.label)
        return label
          ? [{
              label,
              ...(normalizeString(entry.condition) ? { condition: normalizeString(entry.condition) } : {}),
            }]
          : []
      })
    : []

const normalizeTimeline = (value: unknown): SearchTimeline | undefined => {
  if (!isRecord(value)) return undefined
  const urgency = VALID_URGENCY.has(value.urgency as string)
    ? (value.urgency as SearchTimeline['urgency'])
    : 'active'
  const strategyImpact = normalizeString(value.strategyImpact)
  if (!strategyImpact) return undefined
  return {
    urgency,
    ...(normalizeString(value.deadline) ? { deadline: normalizeString(value.deadline) } : {}),
    strategyImpact,
  }
}

const normalizeKeywordCombinations = (value: unknown, fallbackLaneId: string): SearchKeywordCombination[] =>
  Array.isArray(value)
    ? value.flatMap((entry) => {
        if (!isRecord(entry)) return []
        const query = normalizeString(entry.query)
        if (!query) return []
        const noiseLevel = VALID_NOISE_LEVELS.has(entry.noiseLevel as string)
          ? (entry.noiseLevel as SearchKeywordCombination['noiseLevel'])
          : 'medium'
        return [{
          id: normalizeString(entry.id) || createId('skwd'),
          query,
          lane: normalizeString(entry.lane) || fallbackLaneId,
          noiseLevel,
        }]
      })
    : []

const normalizeSkillDepthMap = (value: unknown): SearchSkillDepthEntry[] =>
  Array.isArray(value)
    ? value.flatMap((entry) => {
        if (!isRecord(entry)) return []
        const skill = normalizeString(entry.skill)
        const depth = normalizeString(entry.depth)
        const context = normalizeString(entry.context)
        const searchSignal = normalizeString(entry.searchSignal)
        if (!skill || !depth || !context || !searchSignal) return []
        return [{
          skill,
          depth,
          context,
          searchSignal,
          ...(normalizeString(entry.calibration) ? { calibration: normalizeString(entry.calibration) } : {}),
        }]
      })
    : []

export function normalizeGeneratedSearchThesis(
  payload: unknown,
  identity: ProfessionalIdentityV3,
  feedbackEvents: SearchFeedbackEvent[] = [],
  createdAt = new Date().toISOString(),
): SearchThesis {
  const record = isRecord(payload) ? payload : {}
  const lanes = normalizeSearchLanes(record.searchLanes)
  const fallbackLaneId = lanes[0]?.id ?? 'general-fit'
  const timeline = normalizeTimeline(record.timeline)
  const feedbackEventIds = new Set(feedbackEvents.map((event) => event.id))
  const feedbackIncorporated = normalizeStringArray(record.feedbackIncorporated)
    .filter((id) => feedbackEventIds.has(id))
  return {
    id: normalizeString(record.id) || createId('sthesis'),
    createdAt: normalizeString(record.createdAt) || createdAt,
    updatedAt: normalizeString(record.updatedAt) || createdAt,
    narrative: normalizeString(record.narrative),
    competitiveMoat: normalizeString(record.competitiveMoat),
    unfairAdvantages: normalizeUnfairAdvantages(record.unfairAdvantages),
    searchLanes: lanes,
    interviewStrategy: normalizeString(record.interviewStrategy),
    lookFor: normalizeStringArray(record.lookFor),
    avoid: normalizeAvoid(record.avoid),
    ...(timeline ? { timeline } : {}),
    keywordCombinations: normalizeKeywordCombinations(record.keywordCombinations, fallbackLaneId),
    skillDepthMap: normalizeSkillDepthMap(record.skillDepthMap),
    source: 'generated',
    identityVersion: Math.max(0, Math.floor(identity.model_revision ?? 0)),
    feedbackIncorporated:
      feedbackIncorporated.length > 0
        ? feedbackIncorporated
        : [],
  }
}

export function validateSearchThesis(
  thesis: SearchThesis,
  identity?: ProfessionalIdentityV3 | null,
): string[] {
  const violations: string[] = []
  if (thesis.narrative.length < 240 || paragraphCount(thesis.narrative) < 3) {
    violations.push('narrative: expected 3-5 paragraphs with at least 240 characters')
  }
  if (!thesis.competitiveMoat || thesis.competitiveMoat.length < 40) {
    violations.push('competitiveMoat: missing or too short')
  }
  if (thesis.searchLanes.length === 0) {
    violations.push('searchLanes: expected at least one strategic lane')
  }
  thesis.searchLanes.forEach((lane, index) => {
    if (sentenceCount(lane.rationale) < 2) {
      violations.push('searchLanes[' + String(index) + '].rationale: expected prose rationale with at least 2 sentences')
    }
  })
  if (thesis.skillDepthMap.length === 0) {
    violations.push('skillDepthMap: expected at least one skill-depth entry')
  }
  thesis.skillDepthMap.forEach((entry, index) => {
    if (sentenceCount(entry.context) < 1 || entry.context.length < 30) {
      violations.push('skillDepthMap[' + String(index) + '].context: expected specific PAIO evidence context')
    }
  })

  if (identity) {
    const covered = new Set(thesis.skillDepthMap.map((entry) => normalizeSkillKey(entry.skill)))
    const missing = identitySkillEntries(identity)
      .filter((entry) =>
        ![entry.name, ...entry.aliases].some((skill) => covered.has(normalizeSkillKey(skill))),
      )
      .map((entry) => entry.name)
    if (missing.length > 0) {
      violations.push('skillDepthMap: missing identity skills: ' + missing.slice(0, 8).join(', '))
    }
  }

  return violations
}

export async function generateSearchThesisFromIdentity(
  identity: ProfessionalIdentityV3,
  endpoint: string,
  feedbackEvents: SearchFeedbackEvent[] = [],
): Promise<{ thesis: SearchThesis; contractViolations: string[] }> {
  const systemPrompt = [
    "You are Facet's search thesis strategist. Return JSON only wrapped in <result></result>.",
    'Generate a SearchThesis from the supplied full identity model. Use archetype, arc, profiles, PAIO evidence, skills, calibration notes, matching preferences, conditions, search vectors, and open questions. Do not reduce the input to a flat skill list.',
    '',
    'Use Opus-level reasoning. The thesis is the user decision artifact before an expensive deep-research job.',
    '',
    'Response schema:',
    '{',
    '  "narrative": "3-5 paragraphs weaving moat -> unfair advantages -> search lanes -> signals",',
    '  "competitiveMoat": "specific strategic moat",',
    '  "unfairAdvantages": [{ "combination": "string", "depth": "string", "targetCompanyProfile": "string" }],',
    '  "searchLanes": [{ "id": "optional", "title": "string", "rationale": "2+ sentence prose", "competitiveContext": "optional prose", "targetSignals": ["string"] }],',
    '  "interviewStrategy": "string",',
    '  "lookFor": ["string"],',
    '  "avoid": [{ "label": "string", "condition": "optional qualifier" }],',
    '  "timeline": { "urgency": "critical|active|exploratory", "deadline": "optional ISO date", "strategyImpact": "string" },',
    '  "keywordCombinations": [{ "query": "string", "lane": "lane id", "noiseLevel": "low|medium|high" }],',
    '  "skillDepthMap": [{ "skill": "string", "depth": "semantic depth", "context": "specific PAIO evidence", "searchSignal": "string", "calibration": "optional honest framing" }],',
    '  "feedbackIncorporated": ["feedback event ids"]',
    '}',
    '',
    'Contract:',
    '- narrative must be 3-5 paragraphs, not bullets.',
    '- every lane rationale must be prose, not fragments.',
    '- skillDepthMap context must cite specific evidence from the identity model.',
    '- cover every user skill unless the identity explicitly marks it irrelevant or avoid.',
  ].join('\n')

  const userPrompt = buildThesisGenerationPrompt(identity, feedbackEvents)
  if (userPrompt.length > THESIS_GENERATION_MAX_PROMPT_CHARS) {
    throw new Error(
      'Identity model is too large for thesis generation (' +
        String(userPrompt.length) +
        ' chars; limit ' +
        String(THESIS_GENERATION_MAX_PROMPT_CHARS) +
        '). Refine or compact Identity before generating a search thesis.',
    )
  }

  const rawResponse = await callLlmProxy(
    endpoint,
    systemPrompt,
    userPrompt,
    {
      feature: 'research.thesis',
      model: 'opus',
      timeoutMs: THESIS_GENERATION_TIMEOUT_MS,
      maxTokens: THESIS_GENERATION_MAX_TOKENS,
      thinkingBudget: THESIS_GENERATION_THINKING_BUDGET,
    },
  )

  try {
    const json = extractJsonBlock(rawResponse)
    const parsed = parseJsonWithRepair<unknown>(
      json,
      'Generated search thesis response',
    ).data
    const thesis = normalizeGeneratedSearchThesis(parsed, identity, feedbackEvents)
    return {
      thesis,
      contractViolations: validateSearchThesis(thesis, identity),
    }
  } catch (error) {
    if (error instanceof JsonExtractionError) {
      throw new Error('Generated search thesis response was malformed. Try regenerating the thesis.', {
        cause: error,
      })
    }
    throw error instanceof Error ? error : new Error('Failed to parse generated search thesis.')
  }
}
