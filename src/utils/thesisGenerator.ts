import type { ProfessionalIdentityV3 } from '../identity/schema'
import {
  EMPLOYMENT_TYPE_BANK,
  FUNDING_STAGE_BANK,
  INDUSTRY_BANK,
  REMOTE_POLICY_BANK,
} from '../types/search'
import type {
  SearchCompanySize,
  SearchEmploymentType,
  SearchFeedbackEvent,
  SearchFundingStage,
  SearchIndustry,
  SearchInstanceOverrides,
  SearchKeywordCombination,
  SearchLane,
  SearchRemotePolicy,
  SearchSkillDepthEntry,
  SearchThesis,
  SearchThesisSignal,
  SearchTimeline,
  SearchUnfairAdvantage,
} from '../types/search'
import { createId } from './idUtils'
import { parseJsonWithRepair } from './jsonParsing'
import { callLlmProxy, extractJsonBlock, JsonExtractionError, isString } from './llmProxy'
import { normalizeSearchAssumptions } from './searchAssumptions'

const VALID_COMPANY_SIZES = new Set<SearchCompanySize>([
  'startup',
  'growth',
  'mid-market',
  'enterprise',
  'public',
  'any',
])

const THESIS_GENERATION_TIMEOUT_MS = 90_000
const THESIS_GENERATION_THINKING_BUDGET = 10_000
const THESIS_GENERATION_MAX_TOKENS = 32_000
const THESIS_GENERATION_MAX_PROMPT_CHARS = 120_000

const VALID_NOISE_LEVELS = new Set(['low', 'medium', 'high'])
const VALID_URGENCY = new Set(['critical', 'active', 'exploratory'])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const normalizeString = (value: unknown): string => (isString(value) ? value.trim() : '')

const normalizeStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(normalizeString).filter(Boolean) : []

const normalizeEnumArray = <TValue extends string>(
  value: unknown,
  allowedValues: readonly TValue[],
): TValue[] => {
  const allowed = new Set<string>(allowedValues)
  return normalizeStringArray(value).filter((entry): entry is TValue => allowed.has(entry))
}

const formatAllowedValues = (values: readonly string[]): string => values.join(' | ')

const normalizeSignalKey = (value: string): string => value.trim().toLowerCase()

const isSignalSeverity = (value: unknown): value is SearchThesisSignal['severity'] =>
  value === 'hard' || value === 'soft' || value === 'conditional'

const sentenceCount = (value: string): number =>
  value
    .split(/[.!?]+/)
    .map((part) => part.trim())
    .filter(Boolean).length

const paragraphCount = (value: string): number =>
  value
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean).length

const normalizeSkillKey = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, ' ')

const identitySkillEntries = (
  identity: ProfessionalIdentityV3,
): Array<{
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
          ? rawAliases.map((alias) => (isString(alias) ? alias.trim() : '')).filter(Boolean)
          : []
        return [{ name, aliases }]
      }),
  )

/**
 * Look up an identity skill item by name (or alias) and return the canonical
 * `{ name, depth, context, positioning }` so the thesis can mirror identity-
 * canonical fields rather than re-derive them per thesis.
 *
 * See `docs/architecture/identity-canonical-data.md` for the diagnostic rule
 * and `docs/development/reports/2026-04-llm-identity-anti-pattern-audit.md`
 * (entries A1, D1) for the audit decisions this implements.
 */
const findIdentitySkillItem = (
  identity: ProfessionalIdentityV3,
  query: string,
): { name: string; depth?: string; context?: string; positioning?: string } | null => {
  const target = normalizeSkillKey(query)
  if (!target) return null
  for (const group of identity.skills.groups) {
    for (const item of group.items) {
      if (item.depth === 'avoid' || item.skipped_at) continue
      const name = item.name.trim()
      if (!name) continue
      if (normalizeSkillKey(name) === target) {
        return { name, depth: item.depth, context: item.context, positioning: item.positioning }
      }
      const rawAliases = (item as unknown as { aliases?: unknown }).aliases
      if (Array.isArray(rawAliases)) {
        for (const alias of rawAliases) {
          if (isString(alias) && normalizeSkillKey(alias) === target) {
            return { name, depth: item.depth, context: item.context, positioning: item.positioning }
          }
        }
      }
    }
  }
  return null
}

export interface ThesisGenerationContext {
  /** Free-text user correction notes from the previous thesis (cleared after regenerate). */
  userCorrections?: string
  /** Persistent custom-search directive that steers angle selection. */
  customDirective?: string
  /** User-accepted lower-quality fallback when Opus is unavailable. */
  modelFallback?: 'sonnet'
}

export function buildThesisGenerationPrompt(
  identity: ProfessionalIdentityV3,
  feedbackEvents: SearchFeedbackEvent[] = [],
  context: ThesisGenerationContext = {},
): string {
  const sections: string[] = [
    'Professional identity model:',
    JSON.stringify({
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
    }),
    '',
    'Previously applied feedback not yet reflected in the current thesis:',
    JSON.stringify(feedbackEvents),
  ]

  const correctionsTrimmed = context.userCorrections?.trim()
  if (correctionsTrimmed) {
    sections.push(
      '',
      'User corrections from the previous thesis (apply before regenerating; do not return verbatim):',
      correctionsTrimmed,
    )
  }

  const directiveTrimmed = context.customDirective?.trim()
  if (directiveTrimmed) {
    sections.push(
      '',
      'Custom search directive (steer the search angle even when identity context would not suggest it):',
      directiveTrimmed,
    )
  }

  sections.push('', 'Return JSON only, wrapped in <result></result>.')
  return sections.join('\n')
}

// `depth` was dropped from `SearchUnfairAdvantage` because it duplicated
// identity-canonical skill depth (audit entry A2). Express depth through the
// `combination` phrase itself ("Production Kubernetes + product-aware platform
// judgment"). Any LLM-emitted `depth` is ignored here.
const normalizeUnfairAdvantages = (value: unknown): SearchUnfairAdvantage[] =>
  Array.isArray(value)
    ? value.flatMap((entry) => {
        if (!isRecord(entry)) return []
        const combination = normalizeString(entry.combination)
        const targetCompanyProfile = normalizeString(entry.targetCompanyProfile)
        return combination && targetCompanyProfile
          ? [
              {
                id: normalizeString(entry.id) || createId('sadv'),
                combination,
                targetCompanyProfile,
              },
            ]
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
        return [
          {
            id: normalizeString(entry.id) || createId('slane'),
            title,
            rationale,
            ...(normalizeString(entry.competitiveContext)
              ? { competitiveContext: normalizeString(entry.competitiveContext) }
              : {}),
            targetSignals:
              targetSignals.length > 0 ? targetSignals : [title || 'Lane ' + String(index + 1)],
          },
        ]
      })
    : []

const appendUniqueSignals = (
  signals: SearchThesisSignal[],
  legacyLabels: readonly string[],
): SearchThesisSignal[] => {
  if (legacyLabels.length === 0) return signals
  const seen = new Set(signals.map((signal) => normalizeSignalKey(signal.label)))
  const next = [...signals]
  legacyLabels.forEach((legacyLabel) => {
    const label = legacyLabel.trim()
    const key = normalizeSignalKey(label)
    if (!label || seen.has(key)) return
    seen.add(key)
    next.push({ id: createId('ssig'), label, severity: 'soft' })
  })
  return next
}

const normalizeLookFor = (
  value: unknown,
  legacyPrioritize: readonly string[] = [],
): SearchThesisSignal[] =>
  appendUniqueSignals(
    Array.isArray(value)
      ? value.flatMap((entry) => {
          if (isString(entry)) {
            const label = entry.trim()
            return label ? [{ id: createId('ssig'), label, severity: 'soft' as const }] : []
          }
          if (!isRecord(entry)) return []
          const label = normalizeString(entry.label)
          const condition = normalizeString(entry.condition)
          if (!label) return []
          return [
            {
              id: normalizeString(entry.id) || createId('ssig'),
              label,
              ...(condition ? { condition } : {}),
              severity: isSignalSeverity(entry.severity)
                ? entry.severity
                : condition
                  ? 'conditional'
                  : 'soft',
            },
          ]
        })
      : [],
    legacyPrioritize,
  )

const normalizeAvoid = (
  value: unknown,
  legacyAvoid: readonly string[] = [],
): SearchThesisSignal[] =>
  appendUniqueSignals(
    Array.isArray(value)
      ? value.flatMap((entry) => {
          if (isString(entry)) {
            const label = entry.trim()
            return label ? [{ id: createId('ssig'), label, severity: 'soft' as const }] : []
          }
          if (!isRecord(entry)) return []
          const label = normalizeString(entry.label)
          const condition = normalizeString(entry.condition)
          return label
            ? [
                {
                  id: normalizeString(entry.id) || createId('ssig'),
                  label,
                  ...(condition ? { condition } : {}),
                  severity: isSignalSeverity(entry.severity)
                    ? entry.severity
                    : condition
                      ? 'conditional'
                      : 'soft',
                },
              ]
            : []
        })
      : [],
    legacyAvoid,
  )

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

const normalizeKeywordCombinations = (
  value: unknown,
  fallbackLaneId: string,
): SearchKeywordCombination[] =>
  Array.isArray(value)
    ? value.flatMap((entry) => {
        if (!isRecord(entry)) return []
        const query = normalizeString(entry.query)
        if (!query) return []
        const noiseLevel = VALID_NOISE_LEVELS.has(entry.noiseLevel as string)
          ? (entry.noiseLevel as SearchKeywordCombination['noiseLevel'])
          : 'medium'
        return [
          {
            id: normalizeString(entry.id) || createId('skwd'),
            query,
            lane: normalizeString(entry.lane) || fallbackLaneId,
            noiseLevel,
          },
        ]
      })
    : []

const normalizeOverrides = (value: unknown): SearchInstanceOverrides | undefined => {
  if (!isRecord(value)) return undefined
  const constraintsRecord = isRecord(value.constraints) ? value.constraints : {}
  const interviewRecord = isRecord(value.interviewPrefs) ? value.interviewPrefs : {}
  const companySizeRaw = normalizeString(constraintsRecord.companySize)
  const companySize = VALID_COMPANY_SIZES.has(companySizeRaw as SearchCompanySize)
    ? (companySizeRaw as SearchCompanySize)
    : ''
  return {
    constraints: {
      compensation: normalizeString(constraintsRecord.compensation),
      locations: normalizeStringArray(constraintsRecord.locations),
      clearance: normalizeString(constraintsRecord.clearance),
      companySize,
      industriesToAvoid: normalizeEnumArray<SearchIndustry>(
        constraintsRecord.industriesToAvoid,
        INDUSTRY_BANK,
      ),
      fundingStagesAcceptable: normalizeEnumArray<SearchFundingStage>(
        constraintsRecord.fundingStagesAcceptable,
        FUNDING_STAGE_BANK,
      ),
      remotePolicies: normalizeEnumArray<SearchRemotePolicy>(
        constraintsRecord.remotePolicies,
        REMOTE_POLICY_BANK,
      ),
      remotePolicyNote: normalizeString(constraintsRecord.remotePolicyNote),
      employmentTypes: normalizeEnumArray<SearchEmploymentType>(
        constraintsRecord.employmentTypes,
        EMPLOYMENT_TYPE_BANK,
      ),
    },
    interviewPrefs: {
      strongFit: normalizeStringArray(interviewRecord.strongFit),
      redFlags: normalizeStringArray(interviewRecord.redFlags),
    },
    hiddenSkillIds: normalizeStringArray(value.hiddenSkillIds),
  }
}

const normalizeLegacyOverrideFilters = (
  value: unknown,
): { prioritize: string[]; avoid: string[] } => {
  if (!isRecord(value) || !isRecord(value.filters)) return { prioritize: [], avoid: [] }
  return {
    prioritize: normalizeStringArray(value.filters.prioritize),
    avoid: normalizeStringArray(value.filters.avoid),
  }
}

/**
 * Build the per-thesis `skillDepthMap` from LLM output. The LLM emits only
 * `skill` (must match an identity skill name) and an optional `calibration`
 * (per-thesis honest framing). Depth, context, and search signal are sourced
 * from `identity.skills.*.{depth, context, positioning}` — they are identity-
 * canonical fields that artifacts mirror by reference (audit entries A1, D1).
 *
 * Entries whose `skill` doesn't match an identity skill are dropped — they're
 * either hallucinations or stale references. Entries whose matched identity
 * skill lacks depth/context/positioning are also dropped because the validator
 * and downstream deep-research consumers require all three.
 */
const normalizeSkillDepthMap = (
  value: unknown,
  identity: ProfessionalIdentityV3,
): SearchSkillDepthEntry[] => {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (!isRecord(entry)) return []
    const skill = normalizeString(entry.skill)
    if (!skill) return []
    const identitySkill = findIdentitySkillItem(identity, skill)
    if (!identitySkill) return []
    const depth = identitySkill.depth ?? ''
    const context = identitySkill.context ?? ''
    const searchSignal = identitySkill.positioning ?? ''
    if (!depth || !context || !searchSignal) return []
    const calibration = normalizeString(entry.calibration)
    return [
      {
        skill: identitySkill.name,
        depth,
        context,
        searchSignal,
        ...(calibration ? { calibration } : {}),
      },
    ]
  })
}

export function normalizeGeneratedSearchThesis(
  payload: unknown,
  identity: ProfessionalIdentityV3,
  feedbackEvents: SearchFeedbackEvent[] = [],
  createdAt = new Date().toISOString(),
  context: ThesisGenerationContext = {},
): SearchThesis {
  const record = isRecord(payload) ? payload : {}
  const lanes = normalizeSearchLanes(record.searchLanes)
  const fallbackLaneId = lanes[0]?.id ?? 'general-fit'
  const timeline = normalizeTimeline(record.timeline)
  const legacyFilters = normalizeLegacyOverrideFilters(record.searchOverrides)
  const overrides = normalizeOverrides(record.searchOverrides)
  const assumptions = normalizeSearchAssumptions(record.assumptions)
  const feedbackEventIds = new Set(feedbackEvents.map((event) => event.id))
  const feedbackIncorporated = normalizeStringArray(record.feedbackIncorporated).filter((id) =>
    feedbackEventIds.has(id),
  )
  const directiveTrimmed = context.customDirective?.trim()
  return {
    id: normalizeString(record.id) || createId('sthesis'),
    createdAt: normalizeString(record.createdAt) || createdAt,
    updatedAt: normalizeString(record.updatedAt) || createdAt,
    narrative: normalizeString(record.narrative),
    competitiveMoat: normalizeString(record.competitiveMoat),
    unfairAdvantages: normalizeUnfairAdvantages(record.unfairAdvantages),
    searchLanes: lanes,
    interviewStrategy: normalizeString(record.interviewStrategy),
    lookFor: normalizeLookFor(record.lookFor, legacyFilters.prioritize),
    avoid: normalizeAvoid(record.avoid, legacyFilters.avoid),
    ...(timeline ? { timeline } : {}),
    keywordCombinations: normalizeKeywordCombinations(record.keywordCombinations, fallbackLaneId),
    skillDepthMap: normalizeSkillDepthMap(record.skillDepthMap, identity),
    ...(assumptions.length > 0 ? { assumptions } : {}),
    ...(overrides ? { searchOverrides: overrides } : {}),
    ...(directiveTrimmed ? { customDirective: directiveTrimmed } : {}),
    source: 'generated',
    identityVersion: Math.max(0, Math.floor(identity.model_revision ?? 0)),
    feedbackIncorporated: feedbackIncorporated.length > 0 ? feedbackIncorporated : [],
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
      violations.push(
        'searchLanes[' +
          String(index) +
          '].rationale: expected prose rationale with at least 2 sentences',
      )
    }
  })
  if (thesis.skillDepthMap.length === 0) {
    violations.push('skillDepthMap: expected at least one skill-depth entry')
  }
  thesis.skillDepthMap.forEach((entry, index) => {
    if (sentenceCount(entry.context) < 1 || entry.context.length < 30) {
      violations.push(
        'skillDepthMap[' + String(index) + '].context: expected specific PAIO evidence context',
      )
    }
  })

  if (identity) {
    const covered = new Set(thesis.skillDepthMap.map((entry) => normalizeSkillKey(entry.skill)))
    const missing = identitySkillEntries(identity)
      .filter(
        (entry) =>
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
  context: ThesisGenerationContext = {},
): Promise<{ thesis: SearchThesis; contractViolations: string[] }> {
  const systemPrompt = [
    "You are Facet's search thesis strategist. Return JSON only wrapped in <result></result>.",
    'Generate a SearchThesis from the supplied full identity model. Use archetype, arc, profiles, PAIO evidence, skills, calibration notes, matching preferences, conditions, search vectors, and open questions. Do not reduce the input to a flat skill list.',
    '',
    'Use Opus-level reasoning. The thesis is the user decision artifact before an expensive deep-research job.',
    'Do not introduce uncited external factual claims. If you include factual claims from supplied reference material, mark them with [cite:<id>] and ensure downstream deep-research prompts can resolve that id to a Citation with id, source, optional url/type/claim.',
    '',
    'Per-search overrides (`searchOverrides`): infer plausible per-search values from identity context and the chosen lanes. These are starting points the user will correct, NOT static placeholders. Better to make a confident guess that teaches the user what the field means than to leave fields blank. Concrete > abstract: prefer "$240k base / $340k total" over "competitive comp"; prefer "Tampa Bay (Remote-friendly)" over "Remote".',
    '',
    'Identity-canonical fields (do NOT generate; these are sourced from identity at normalization):',
    '- `skillDepthMap[].depth`, `skillDepthMap[].context`, `skillDepthMap[].searchSignal` come from `identity.skills.*.depth`, `.context`, and `.positioning`. Emit only the `skill` name (must match an identity skill — by name or alias) and an optional per-thesis `calibration` framing.',
    '- `unfairAdvantages[].depth` is duplicate. Express depth through the `combination` phrase itself ("Production Kubernetes + product-aware platform judgment") rather than a separate depth field.',
    '',
    'Editorial fields with guardrails (LLM generates per-thesis but stays grounded):',
    "- `interviewStrategy`: search-tailored emphasis for THIS specific role/lane — what to lead with in this search's interview process. Do NOT restate the candidate's general prep approach (which lives on `identity.self_model.interview_style.prep_strategy`).",
    '- `skillDepthMap[].calibration`: per-thesis honest framing ("not a K8s admin; building around it is fine"). Cite identity calibration_notes; do not invent new claims about the candidate.',
    '',
    'If a custom search directive is provided in the user prompt, prioritize it over identity-implied direction — it represents intent the identity model does not encode.',
    'If user corrections are provided, weave them into the new thesis without quoting them verbatim, and update overrides to reflect them.',
    'If any material input is unspecified or ambiguous (visa status, location precision, compensation flexibility, travel willingness, remote/hybrid scope, sponsorship, timeline, etc.) you MUST record the assumption in `assumptions[]`. Do not silently assume. Every filled gap must include claim, source, rationale, confidence, and overridable.',
    'Use only these bank values in searchOverrides constraint arrays:',
    '- industriesToAvoid: ' + formatAllowedValues(INDUSTRY_BANK),
    '- fundingStagesAcceptable: ' + formatAllowedValues(FUNDING_STAGE_BANK),
    '- remotePolicies: ' + formatAllowedValues(REMOTE_POLICY_BANK),
    '- employmentTypes: ' + formatAllowedValues(EMPLOYMENT_TYPE_BANK),
    '',
    'Response schema:',
    '{',
    '  "narrative": "3-5 paragraphs weaving moat -> unfair advantages -> search lanes -> signals",',
    '  "competitiveMoat": "specific strategic moat",',
    '  "unfairAdvantages": [{ "combination": "string", "targetCompanyProfile": "string" }],',
    '  "searchLanes": [{ "id": "optional", "title": "string", "rationale": "2+ sentence prose", "competitiveContext": "optional prose", "targetSignals": ["string"] }],',
    '  "interviewStrategy": "string",',
    '  "lookFor": [{ "label": "string", "condition": "optional qualifier", "severity": "hard|soft|conditional" }],',
    '  "avoid": [{ "label": "string", "condition": "optional qualifier", "severity": "hard|soft|conditional" }],',
    '  "timeline": { "urgency": "critical|active|exploratory", "deadline": "optional ISO date", "strategyImpact": "string" },',
    '  "keywordCombinations": [{ "query": "string", "lane": "lane id", "noiseLevel": "low|medium|high" }],',
    '  "skillDepthMap": [{ "skill": "string (must match an identity skill name)", "calibration": "optional honest framing per this search" }],',
    '  "assumptions": [{ "id": "optional", "claim": "string", "source": "inferred|assumed-default|explicit-fallback", "rationale": "string", "confidence": "high|medium|low", "overridable": true }],',
    '  "searchOverrides": {',
    '    "constraints": { "compensation": "string", "locations": ["string"], "clearance": "string", "companySize": "startup|growth|mid-market|enterprise|public|any|", "industriesToAvoid": ["string"], "fundingStagesAcceptable": ["string"], "remotePolicies": ["string"], "remotePolicyNote": "string", "employmentTypes": ["string"] },',
    '    "interviewPrefs": { "strongFit": ["string"], "redFlags": ["string"] },',
    '    "hiddenSkillIds": []',
    '  },',
    '  "feedbackIncorporated": ["feedback event ids"]',
    '}',
    '',
    'Contract:',
    '- narrative must be 3-5 paragraphs, not bullets.',
    '- every lane rationale must be prose, not fragments.',
    '- use lookFor/avoid for search-stage signals; do not emit duplicate searchOverrides.filters.',
    '- signal severity is hard for non-negotiable constraints, conditional when a qualifier matters, and soft for preferences.',
    '- cover every user skill unless the identity explicitly marks it irrelevant or avoid (emit each as a `skillDepthMap` entry; depth/context/searchSignal will be sourced from identity).',
    '- searchOverrides values must be concrete and tailored to the chosen lanes; leave hiddenSkillIds empty unless the lane choice clearly excludes a skill.',
    '- assumptions[] must list every material gap you filled and may be omitted only when no gaps were filled.',
  ].join('\n')

  const userPrompt = buildThesisGenerationPrompt(identity, feedbackEvents, context)
  if (userPrompt.length > THESIS_GENERATION_MAX_PROMPT_CHARS) {
    throw new Error(
      'Identity model is too large for thesis generation (' +
        String(userPrompt.length) +
        ' chars; limit ' +
        String(THESIS_GENERATION_MAX_PROMPT_CHARS) +
        '). Refine or compact Identity before generating a search thesis.',
    )
  }

  const usingSonnetFallback = context.modelFallback === 'sonnet'
  const rawResponse = await callLlmProxy(endpoint, systemPrompt, userPrompt, {
    feature: 'research.thesis',
    model: usingSonnetFallback ? 'sonnet' : 'opus',
    timeoutMs: THESIS_GENERATION_TIMEOUT_MS,
    maxTokens: THESIS_GENERATION_MAX_TOKENS,
    thinkingBudget: THESIS_GENERATION_THINKING_BUDGET,
    ...(usingSonnetFallback ? { capabilityFallback: 'opus_unavailable' } : {}),
  })

  try {
    const json = extractJsonBlock(rawResponse)
    const parsed = parseJsonWithRepair<unknown>(json, 'Generated search thesis response').data
    const thesis = normalizeGeneratedSearchThesis(
      parsed,
      identity,
      feedbackEvents,
      undefined,
      context,
    )
    if (usingSonnetFallback) {
      thesis.source = 'generated-fallback'
    }
    return {
      thesis,
      contractViolations: validateSearchThesis(thesis, identity),
    }
  } catch (error) {
    if (error instanceof JsonExtractionError) {
      throw new Error(
        'Generated search thesis response was malformed. Try regenerating the thesis.',
        {
          cause: error,
        },
      )
    }
    throw error instanceof Error ? error : new Error('Failed to parse generated search thesis.')
  }
}
