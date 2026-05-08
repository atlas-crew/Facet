import type {
  ApplicationPlan,
  ApplicationPlanPhase,
  ApplicationPlanTask,
  Citation,
  SearchNarrativeLaneSummary,
  SearchNarrativeReference,
  SearchObjectiveRecommendation,
  SearchProfile,
  SearchRejectedCandidate,
  SearchRequest,
  SearchResultBulletEdit,
  SearchResultCompanyIntel,
  SearchResultEntry,
  SearchResultInterviewProcess,
  SearchRunNarrative,
  SearchTimeline,
  SearchTokenUsage,
  SearchVisualization,
  SearchVisualizationType,
} from '../types/search'
import { readAiProxyError } from './aiProxyErrors'
import { facetClientEnv } from './facetEnv'
import { getHostedAccessToken } from './hostedSession'
import { createId } from './idUtils'
import { normalizeJobDescriptionSourceUrl, normalizeJobDescriptionText } from './jobDescriptionText'
import {
  normalizeCitations,
  stripCitationMarkers,
  stripUnresolvedCitationMarkers,
  stripUnresolvedCitationMarkersWithDiagnostics,
} from './searchCitations'
import { normalizeSearchAssumptions } from './searchAssumptions'
import type { FacetAiFeatureKey } from '../types/hosted'

const REQUEST_TIMEOUT_MS = 120000
const DEFAULT_PROXY_API_KEY = 'facet-local-proxy'
const DEFAULT_WEB_SEARCH_TOOL_TYPE = 'web_search_20250305'
// True when a string contains any Unicode letter or digit; used to detect whether
// stripping unresolved citation markers consumed all real prose.
const HAS_LETTER_OR_DIGIT = /[\p{L}\p{N}]/u

interface CleanedCitedText {
  text: string
  unresolvedCitationStrippedAllProse: boolean
}

interface SearchExecutionPayload {
  text: string
  searchLog: string[]
  tokenUsage?: SearchTokenUsage
}

export interface SearchProxyOptions {
  feature?: FacetAiFeatureKey
  maxTokens?: number
  outputConfig?: Record<string, unknown>
  betas?: string[]
  thinkingBudget?: number
  webSearchToolType?: string
  webSearchMaxUses?: number
}

// Consolidate with the canonical extractor in llmProxy (TASK-167). Both paths now
// share one hardened implementation; the re-export keeps the searchExecutor module
// surface unchanged for existing callers/tests.
import { extractJsonBlock, JsonExtractionError } from './llmProxy'
export { extractJsonBlock, JsonExtractionError } from './llmProxy'

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

export function collectQueryStrings(value: unknown): string[] {
  if (isString(value)) {
    const trimmed = value.trim()
    return trimmed ? [trimmed] : []
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectQueryStrings(item))
  }

  if (!value || typeof value !== 'object') {
    return []
  }

  const record = value as Record<string, unknown>
  return [
    ...collectQueryStrings(record.query),
    ...collectQueryStrings(record.queries),
    ...collectQueryStrings(record.search_query),
  ]
}

export async function callSearchProxy(
  endpoint: string,
  systemPrompt: string,
  userPrompt: string,
  options: SearchProxyOptions = {},
): Promise<SearchExecutionPayload> {
  const controller = new AbortController()
  const timeoutId = globalThis.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const bearerToken = await getHostedAccessToken()
    const configuredProxyApiKey = facetClientEnv.anthropicProxyApiKey || undefined
    const resolvedProxyApiKey =
      configuredProxyApiKey ?? (bearerToken ? undefined : DEFAULT_PROXY_API_KEY)
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
        ...(resolvedProxyApiKey ? { 'X-Proxy-API-Key': resolvedProxyApiKey } : {}),
      },
      body: JSON.stringify({
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        temperature: 1,
        thinking_budget: options.thinkingBudget ?? 8000,
        model: 'sonnet',
        feature: options.feature ?? 'research.search',
        tools: [
          {
            type: options.webSearchToolType ?? DEFAULT_WEB_SEARCH_TOOL_TYPE,
            name: 'web_search',
            max_uses: options.webSearchMaxUses ?? 15,
          },
        ],
        ...(typeof options.maxTokens === 'number' ? { max_tokens: options.maxTokens } : {}),
        ...(options.outputConfig ? { output_config: options.outputConfig } : {}),
        ...(options.betas ? { betas: options.betas } : {}),
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      throw await readAiProxyError(response)
    }

    const payload = (await response.json()) as Record<string, unknown>
    const tokenUsage =
      payload.usage && typeof payload.usage === 'object'
        ? {
            inputTokens:
              typeof (payload.usage as { input_tokens?: unknown }).input_tokens === 'number'
                ? ((payload.usage as { input_tokens: number }).input_tokens ?? 0)
                : 0,
            outputTokens:
              typeof (payload.usage as { output_tokens?: unknown }).output_tokens === 'number'
                ? ((payload.usage as { output_tokens: number }).output_tokens ?? 0)
                : 0,
            totalTokens:
              typeof (payload.usage as { input_tokens?: unknown }).input_tokens === 'number' &&
              typeof (payload.usage as { output_tokens?: unknown }).output_tokens === 'number'
                ? ((payload.usage as { input_tokens: number }).input_tokens ?? 0) +
                  ((payload.usage as { output_tokens: number }).output_tokens ?? 0)
                : 0,
          }
        : undefined

    if (Array.isArray(payload.choices)) {
      const choice = payload.choices[0] as Record<string, unknown>
      const message = choice.message as Record<string, unknown>
      if (typeof message?.content === 'string') {
        return { text: message.content, searchLog: [], tokenUsage }
      }
    }

    if (Array.isArray(payload.content)) {
      const textParts: string[] = []
      const searchLog = new Set<string>()

      for (const part of payload.content) {
        if (!part || typeof part !== 'object') {
          continue
        }

        const record = part as Record<string, unknown>
        if (record.type === 'text' && isString(record.text)) {
          textParts.push(record.text)
        }

        for (const query of collectQueryStrings(record.input)) {
          searchLog.add(query)
        }

        for (const query of collectQueryStrings(record.query)) {
          searchLog.add(query)
        }
      }

      return {
        text: textParts.join('\n').trim() || JSON.stringify(payload),
        searchLog: [...searchLog],
        tokenUsage,
      }
    }

    return { text: JSON.stringify(payload), searchLog: [], tokenUsage }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`AI request timed out after ${REQUEST_TIMEOUT_MS}ms.`)
    }
    throw error
  } finally {
    globalThis.clearTimeout(timeoutId)
  }
}

export function clampMatchScore(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0
  }

  return Math.max(0, Math.min(100, Math.round(value)))
}

export function normalizeTier(value: unknown): 1 | 2 | 3 | null {
  if (value === 1 || value === '1') return 1
  if (value === 2 || value === '2') return 2
  if (value === 3 || value === '3') return 3
  return null
}

function normalizeInterviewProcess(value: unknown): SearchResultInterviewProcess | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const record = value as Record<string, unknown>
  const format = isString(record.format) ? record.format.trim() : ''
  if (!format) return undefined
  return {
    format,
    builderFriendly: typeof record.builderFriendly === 'boolean' ? record.builderFriendly : false,
    aiToolsAllowed: typeof record.aiToolsAllowed === 'boolean' ? record.aiToolsAllowed : false,
    estimatedTimeline: isString(record.estimatedTimeline)
      ? record.estimatedTimeline.trim() || undefined
      : undefined,
  }
}

function normalizeCompanyIntel(value: unknown): SearchResultCompanyIntel | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const record = value as Record<string, unknown>
  const stage = isString(record.stage) ? record.stage.trim() : ''
  const aiCulture = isString(record.aiCulture) ? record.aiCulture.trim() : ''
  const remotePolicy = isString(record.remotePolicy) ? record.remotePolicy.trim() : ''
  if (!stage && !aiCulture && !remotePolicy) return undefined
  return {
    stage,
    aiCulture,
    remotePolicy,
    openRoleCount:
      typeof record.openRoleCount === 'number' && Number.isFinite(record.openRoleCount)
        ? Math.max(0, Math.round(record.openRoleCount))
        : undefined,
  }
}

function normalizeRecommendedVariant(
  value: unknown,
  request: SearchRequest,
): string | undefined {
  if (!isString(value)) return undefined
  const variant = value.trim()
  if (!variant) return undefined
  const allowedVariantIds = new Set((request.resumeVariants ?? []).map((item) => item.id.trim()))
  return allowedVariantIds.has(variant) ? variant : undefined
}

function normalizeBulletEdits(value: unknown): SearchResultBulletEdit[] | undefined {
  if (!Array.isArray(value)) return undefined
  const edits = value.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return []
    const record = item as Record<string, unknown>
    const emphasis: SearchResultBulletEdit['emphasis'] | null =
      record.emphasis === 'lead' || record.emphasis === 'supporting'
        ? record.emphasis
        : null
    const text = isString(record.text) ? record.text.trim() : ''
    if (!emphasis || !text) return []
    const rationale = isString(record.rationale) ? record.rationale.trim() : ''
    return [
      {
        emphasis,
        text,
        ...(rationale ? { rationale } : {}),
      },
    ]
  })
  return edits.length > 0 ? edits : undefined
}

function normalizeKeywordsToInclude(value: unknown): string[] | undefined {
  const keywords = collectStringArray(value)
  return keywords.length > 0 ? keywords : undefined
}

const cleanResultCitedText = (value: unknown, citations: readonly Citation[]): CleanedCitedText => {
  if (!isString(value)) {
    return { text: '', unresolvedCitationStrippedAllProse: false }
  }
  const raw = value.trim()
  if (!raw) {
    // Empty/missing fields are handled by the broader result contract; this diagnostic
    // only reports prose that citation cleanup reduced to effectively empty.
    return { text: '', unresolvedCitationStrippedAllProse: false }
  }
  const { text: cleaned, strippedUnresolved } = stripUnresolvedCitationMarkersWithDiagnostics(
    raw,
    citations,
  )
  const proseWithoutCitationMarkers = stripCitationMarkers(cleaned)
  const unresolvedCitationStrippedAllProse =
    strippedUnresolved && !HAS_LETTER_OR_DIGIT.test(proseWithoutCitationMarkers)
  return {
    text: unresolvedCitationStrippedAllProse ? '' : cleaned,
    unresolvedCitationStrippedAllProse,
  }
}

const buildCitationStrippingViolation = (
  rawResultIndex: number,
  field: 'matchReason' | 'vectorAlignment' | 'candidateEdge',
  cleaned: CleanedCitedText,
): string | null =>
  cleaned.unresolvedCitationStrippedAllProse
    ? `rawResults[${rawResultIndex}].${field}: empty after stripping unresolved citation markers`
    : null

const annotateResultViolation = (
  violation: string,
  entry: SearchResultEntry,
  status: 'surfaced' | 'dropped',
): string => {
  const statusLabel = status === 'surfaced' ? 'surfaced' : `dropped: tier ${entry.tier} cap`
  return `${violation} (${statusLabel}; tier: ${entry.tier}; company: ${entry.company}; title: ${entry.title})`
}

// ── Run-Level Narrative Normalization ────────────────────────────────────────
//
// Contract thresholds. Picked as weak-signal checks: long enough to catch fragment
// responses ("We found 5 companies.") without rejecting legitimate-if-terse narratives.
// The prompt demands multi-paragraph prose — we flag violations loudly rather than
// silently accept degraded output.

const MIN_PROSE_LENGTH = 40
const MIN_EXECUTIVE_SUMMARY_LENGTH = 80
const MIN_CANDIDATE_EDGE_SENTENCES = 2

export interface SearchRunNarrativeNormalization {
  /** Narrative when all required layers parsed; `undefined` when input is unusable. */
  narrative?: SearchRunNarrative
  /** Contract violations — empty array means the narrative met the contract. */
  violations: string[]
}

const VISUALIZATION_TYPES: readonly SearchVisualizationType[] = [
  'mermaid-gantt',
  'mermaid-xychart',
  'mermaid-other',
]

function isNonEmptyString(value: unknown): value is string {
  return isString(value) && value.trim().length > 0
}

function collectStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter(isString)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
}

function normalizeLaneSummaries(value: unknown): SearchNarrativeLaneSummary[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const record = entry as Record<string, unknown>
    const lane = isString(record.lane) ? record.lane.trim() : ''
    const narrative = isString(record.narrative) ? record.narrative.trim() : ''
    if (!lane || !narrative) return []
    return [{ lane, narrative, topCompanies: collectStringArray(record.topCompanies) }]
  })
}

function normalizeObjectiveRecommendations(value: unknown): SearchObjectiveRecommendation[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const record = entry as Record<string, unknown>
    const objective = isString(record.objective) ? record.objective.trim() : ''
    const rationale = isString(record.rationale) ? record.rationale.trim() : ''
    const recommendedCompanies = collectStringArray(record.recommendedCompanies)
    if (!objective || !rationale) return []
    return [{ objective, recommendedCompanies, rationale }]
  })
}

function normalizeRejectedCandidates(value: unknown): SearchRejectedCandidate[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const record = entry as Record<string, unknown>
    const company = isString(record.company) ? record.company.trim() : ''
    const reason = isString(record.reason) ? record.reason.trim() : ''
    if (!company || !reason) return []
    return [{ company, reason }]
  })
}

function normalizeReferences(value: unknown): SearchNarrativeReference[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const record = entry as Record<string, unknown>
    const rawId = record.id
    const url = isString(record.url) ? record.url.trim() : ''
    if (!url) return []
    let id: string | number
    if (typeof rawId === 'number' && Number.isFinite(rawId)) {
      id = rawId
    } else if (isString(rawId) && rawId.trim()) {
      id = rawId.trim()
    } else {
      return []
    }
    const title = isString(record.title) ? record.title.trim() || undefined : undefined
    return [title ? { id, url, title } : { id, url }]
  })
}

function normalizeVisualizations(value: unknown): SearchVisualization[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const record = entry as Record<string, unknown>
    const rawType = record.type
    const type =
      isString(rawType) && (VISUALIZATION_TYPES as readonly string[]).includes(rawType)
        ? (rawType as SearchVisualizationType)
        : 'mermaid-other'
    // Preserve Mermaid source verbatim — do not trim or re-serialize the body.
    // Leading/trailing blank lines in Mermaid diagrams are legal and sometimes load-bearing.
    const source = isString(record.source) ? record.source : ''
    if (!source) return []
    const caption = isString(record.caption) ? record.caption.trim() || undefined : undefined
    return [caption ? { type, source, caption } : { type, source }]
  })
}

function normalizeApplicationPlanTask(value: unknown): ApplicationPlanTask | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const label = isString(record.label) ? record.label.trim() : ''
  const startDate = isString(record.startDate) ? record.startDate.trim() : ''
  const durationDays =
    typeof record.durationDays === 'number' && Number.isFinite(record.durationDays)
      ? Math.max(0, Math.round(record.durationDays))
      : null
  if (!label || !startDate || durationDays === null) return null
  const dependencies = Array.isArray(record.dependencies)
    ? collectStringArray(record.dependencies)
    : undefined
  return dependencies && dependencies.length > 0
    ? { label, startDate, durationDays, dependencies }
    : { label, startDate, durationDays }
}

function normalizeApplicationPlanPhase(value: unknown): ApplicationPlanPhase | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const name = isString(record.name) ? record.name.trim() : ''
  if (!name) return null
  const tasks = Array.isArray(record.tasks)
    ? record.tasks.flatMap((t) => {
        const task = normalizeApplicationPlanTask(t)
        return task ? [task] : []
      })
    : []
  return { name, tasks }
}

function normalizeApplicationPlan(value: unknown): ApplicationPlan | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const startDate = isString(record.startDate) ? record.startDate.trim() : ''
  if (!startDate) return null
  const phases = Array.isArray(record.phases)
    ? record.phases.flatMap((p) => {
        const phase = normalizeApplicationPlanPhase(p)
        return phase ? [phase] : []
      })
    : []
  const targetOfferDate = isString(record.targetOfferDate)
    ? record.targetOfferDate.trim() || undefined
    : undefined
  // Mermaid diagram preserved verbatim — see comment in normalizeVisualizations.
  const mermaidDiagram = isString(record.mermaidDiagram) ? record.mermaidDiagram : undefined
  return {
    startDate,
    ...(targetOfferDate ? { targetOfferDate } : {}),
    phases,
    ...(mermaidDiagram ? { mermaidDiagram } : {}),
  }
}

/**
 * Parse and validate a run-level narrative from AI output.
 *
 * Returns `{ narrative: undefined, violations: [...] }` when any of the four required
 * layers (competitiveMoat, selectionMethodology, marketContext, executiveSummary) is
 * missing or empty — the narrative is unusable without them.
 *
 * Returns `{ narrative, violations: [...] }` when required layers are present; optional
 * fields are parsed best-effort and violations flag length or structural issues that
 * consumers should surface as quality warnings (but the narrative is still usable).
 */
export function normalizeRunNarrative(value: unknown): SearchRunNarrativeNormalization {
  const violations: string[] = []
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    violations.push('narrative: payload is not an object')
    return { violations }
  }

  const record = value as Record<string, unknown>
  const citations = normalizeCitations(record.citations)
  const readRequired = (
    key: 'competitiveMoat' | 'selectionMethodology' | 'marketContext' | 'executiveSummary',
  ): string | null => {
    const raw = record[key]
    if (!isNonEmptyString(raw)) {
      violations.push(`narrative.${key}: missing or empty`)
      return null
    }
    const cleaned = stripUnresolvedCitationMarkers(raw.trim(), citations)
    if (!cleaned) {
      violations.push(`narrative.${key}: empty after stripping unresolved citation markers`)
      return null
    }
    return cleaned
  }

  const competitiveMoat = readRequired('competitiveMoat')
  const selectionMethodology = readRequired('selectionMethodology')
  const marketContext = readRequired('marketContext')
  const executiveSummary = readRequired('executiveSummary')

  if (!competitiveMoat || !selectionMethodology || !marketContext || !executiveSummary) {
    return { violations }
  }

  const flagShort = (field: string, text: string, min: number) => {
    if (text.length < min) {
      violations.push(`narrative.${field}: too short (${text.length} chars, expected >= ${min})`)
    }
  }
  flagShort('competitiveMoat', competitiveMoat, MIN_PROSE_LENGTH)
  flagShort('selectionMethodology', selectionMethodology, MIN_PROSE_LENGTH)
  flagShort('marketContext', marketContext, MIN_PROSE_LENGTH)
  flagShort('executiveSummary', executiveSummary, MIN_EXECUTIVE_SUMMARY_LENGTH)

  const applicationPlan =
    record.applicationPlan !== undefined ? normalizeApplicationPlan(record.applicationPlan) : null
  if (record.applicationPlan !== undefined && !applicationPlan) {
    violations.push('narrative.applicationPlan: malformed (missing startDate or not an object)')
  }

  const landscapeTrends = isNonEmptyString(record.landscapeTrends)
    ? stripUnresolvedCitationMarkers(record.landscapeTrends.trim(), citations)
    : undefined

  const scoringRubric =
    Array.isArray(record.scoringRubric) && record.scoringRubric.length > 0
      ? collectStringArray(record.scoringRubric)
      : undefined

  const laneSummaries =
    Array.isArray(record.laneSummaries) && record.laneSummaries.length > 0
      ? normalizeLaneSummaries(record.laneSummaries)
      : undefined

  const objectiveRecommendations =
    Array.isArray(record.objectiveRecommendations) && record.objectiveRecommendations.length > 0
      ? normalizeObjectiveRecommendations(record.objectiveRecommendations)
      : undefined

  const visualizations =
    Array.isArray(record.visualizations) && record.visualizations.length > 0
      ? normalizeVisualizations(record.visualizations)
      : undefined

  const surprises =
    Array.isArray(record.surprises) && record.surprises.length > 0
      ? collectStringArray(record.surprises)
      : undefined

  const rejectedCandidates =
    Array.isArray(record.rejectedCandidates) && record.rejectedCandidates.length > 0
      ? normalizeRejectedCandidates(record.rejectedCandidates)
      : undefined

  const nextSteps =
    Array.isArray(record.nextSteps) && record.nextSteps.length > 0
      ? collectStringArray(record.nextSteps)
      : undefined

  const references =
    Array.isArray(record.references) && record.references.length > 0
      ? normalizeReferences(record.references)
      : undefined

  const assumptions = normalizeSearchAssumptions(record.assumptions)

  const narrative: SearchRunNarrative = {
    competitiveMoat,
    selectionMethodology,
    marketContext,
    executiveSummary,
    ...(scoringRubric && scoringRubric.length > 0 ? { scoringRubric } : {}),
    ...(laneSummaries && laneSummaries.length > 0 ? { laneSummaries } : {}),
    ...(landscapeTrends ? { landscapeTrends } : {}),
    ...(objectiveRecommendations && objectiveRecommendations.length > 0
      ? { objectiveRecommendations }
      : {}),
    ...(applicationPlan ? { applicationPlan } : {}),
    ...(visualizations && visualizations.length > 0 ? { visualizations } : {}),
    ...(surprises && surprises.length > 0 ? { surprises } : {}),
    ...(rejectedCandidates && rejectedCandidates.length > 0 ? { rejectedCandidates } : {}),
    ...(nextSteps && nextSteps.length > 0 ? { nextSteps } : {}),
    ...(references && references.length > 0 ? { references } : {}),
    ...(citations.length > 0 ? { citations } : {}),
    ...(assumptions.length > 0 ? { assumptions } : {}),
  }

  return { narrative, violations }
}

/**
 * Heuristic sentence count — matches `.`, `!`, `?` (and runs like `...`) followed by
 * whitespace or end-of-string. Over-counts on abbreviations ("Inc.", "e.g.") but that's
 * intentionally conservative: we'd rather accept prose with extra punctuation than flag
 * legitimate multi-sentence narrative.
 */
export function countSentences(text: string): number {
  const matches = text.match(/[.!?]+(?=\s|$)/g)
  return matches ? matches.length : 0
}

/**
 * Check each result's `candidateEdge` against the prompt's "2-4 sentences of prose" contract.
 * Returns violation strings for absent or fragment-length candidateEdges.
 */
export function validateNarrativeCandidateEdges(results: readonly SearchResultEntry[]): string[] {
  const violations: string[] = []
  for (const result of results) {
    const label = result.company || result.id
    const edge = result.candidateEdge
    if (!edge || !edge.trim()) {
      violations.push(`result[${label}].candidateEdge: missing or empty`)
      continue
    }
    const sentences = countSentences(edge)
    if (sentences < MIN_CANDIDATE_EDGE_SENTENCES) {
      violations.push(
        `result[${label}].candidateEdge: fewer than ${MIN_CANDIDATE_EDGE_SENTENCES} sentences (got ${sentences})`,
      )
    }
  }
  return violations
}

/**
 * Validate that an ApplicationPlan's task schedule fits within the thesis's timeline
 * deadline. Called when both a plan and a timeline with a deadline are present.
 */
export function validateApplicationPlanAgainstTimeline(
  plan: ApplicationPlan,
  timeline?: SearchTimeline,
): string[] {
  const violations: string[] = []
  if (!timeline?.deadline) return violations

  const deadlineTs = Date.parse(timeline.deadline)
  if (!Number.isFinite(deadlineTs)) {
    violations.push(
      `applicationPlan: SearchTimeline.deadline "${timeline.deadline}" is not a parseable date`,
    )
    return violations
  }

  for (const phase of plan.phases) {
    for (const task of phase.tasks) {
      const taskStart = Date.parse(task.startDate)
      if (!Number.isFinite(taskStart)) {
        violations.push(
          `applicationPlan.${phase.name}.${task.label}: startDate "${task.startDate}" is not a parseable date`,
        )
        continue
      }
      const taskEnd = taskStart + task.durationDays * 86_400_000
      if (taskEnd > deadlineTs) {
        violations.push(
          `applicationPlan.${phase.name}.${task.label}: ends after deadline ${timeline.deadline}`,
        )
      }
    }
  }

  return violations
}

export interface SearchResultNormalization {
  results: SearchResultEntry[]
  contractViolations: string[]
}

export function normalizeResultsWithContractViolations(
  payload: unknown,
  request: SearchRequest,
): SearchResultNormalization {
  const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}
  const rawResults = Array.isArray(record.results) ? record.results : []
  const perTierCounts = { 1: 0, 2: 0, 3: 0 }
  const tierLimits = {
    1: request.maxResults.tier1,
    2: request.maxResults.tier2,
    3: request.maxResults.tier3,
  }

  const normalized = rawResults
    .flatMap((result, rawResultIndex) => {
      if (!result || typeof result !== 'object') {
        return []
      }

      const item = result as Record<string, unknown>
      const company = isString(item.company) ? item.company.trim() : ''
      const title = isString(item.title) ? item.title.trim() : ''
      const url = isString(item.url) ? item.url.trim() : ''
      const tier = normalizeTier(item.tier)
      if (!company || !title || !url || tier === null) {
        return []
      }
      // Research output is model-provided, so raw JD text only survives with same-origin provenance.
      const jobDescriptionSourceUrl = normalizeJobDescriptionSourceUrl(
        item.jobDescriptionSourceUrl,
        url,
      )
      const jobDescription = jobDescriptionSourceUrl
        ? normalizeJobDescriptionText(item.jobDescription) || undefined
        : undefined
      const citations = normalizeCitations(item.citations)
      const matchReason = cleanResultCitedText(item.matchReason, citations)
      const vectorAlignment = cleanResultCitedText(item.vectorAlignment, citations)
      const candidateEdge = cleanResultCitedText(item.candidateEdge, citations)
      const resultViolations = [
        buildCitationStrippingViolation(rawResultIndex, 'matchReason', matchReason),
        buildCitationStrippingViolation(rawResultIndex, 'vectorAlignment', vectorAlignment),
        buildCitationStrippingViolation(rawResultIndex, 'candidateEdge', candidateEdge),
      ].filter((violation): violation is string => violation !== null)

      // Observability-only: keep the normalized result visible while the raw-result
      // violation points QA back to the model payload field that lost prose.
      return [
        {
          entry: {
            id: createId('sres'),
            tier,
            company,
            title,
            url,
            location: isString(item.location) ? item.location.trim() : undefined,
            matchScore: clampMatchScore(item.matchScore),
            matchReason: matchReason.text,
            vectorAlignment: vectorAlignment.text,
            risks: Array.isArray(item.risks)
              ? item.risks
                  .filter(isString)
                  .map((risk) => risk.trim())
                  .filter(Boolean)
              : [],
            estimatedComp: isString(item.estimatedComp) ? item.estimatedComp.trim() : undefined,
            source: isString(item.source) ? item.source.trim() : 'web_search',
            ...(citations.length > 0 ? { citations } : {}),
            ...(candidateEdge.text ? { candidateEdge: candidateEdge.text } : {}),
            interviewProcess: normalizeInterviewProcess(item.interviewProcess),
            companyIntel: normalizeCompanyIntel(item.companyIntel),
            signalGroup: isString(item.signalGroup)
              ? item.signalGroup.trim() || undefined
              : undefined,
            advantageMatch: isString(item.advantageMatch)
              ? item.advantageMatch.trim() || undefined
              : undefined,
            jobDescription,
            jobDescriptionSourceUrl: jobDescription ? jobDescriptionSourceUrl : undefined,
            recommendedVariant: normalizeRecommendedVariant(item.recommendedVariant, request),
            bulletEdits: normalizeBulletEdits(item.bulletEdits),
            keywordsToInclude: normalizeKeywordsToInclude(item.keywordsToInclude),
          },
          violations: resultViolations,
        },
      ]
    })
    .sort((left, right) => {
      if (left.entry.tier !== right.entry.tier) {
        return left.entry.tier - right.entry.tier
      }
      return right.entry.matchScore - left.entry.matchScore
    })

  const results: SearchResultEntry[] = []
  const contractViolations: string[] = []
  for (const normalizedResult of normalized) {
    perTierCounts[normalizedResult.entry.tier] += 1
    const droppedByTierCap =
      perTierCounts[normalizedResult.entry.tier] > tierLimits[normalizedResult.entry.tier]
    // QA needs model-output violations, including raw entries later dropped by tier caps.
    // Annotate the status because rawResults indexes point at the model payload, not the UI list.
    contractViolations.push(
      ...normalizedResult.violations.map((violation) =>
        annotateResultViolation(
          violation,
          normalizedResult.entry,
          droppedByTierCap ? 'dropped' : 'surfaced',
        ),
      ),
    )
    if (droppedByTierCap) {
      continue
    }
    results.push(normalizedResult.entry)
  }

  return { results, contractViolations }
}

export function normalizeResults(payload: unknown, request: SearchRequest): SearchResultEntry[] {
  // Pure compatibility wrapper that drops contract-violation diagnostics. Call
  // normalizeResultsWithContractViolations for telemetry, UI, or QA surfaces.
  return normalizeResultsWithContractViolations(payload, request).results
}

export function buildSearchPrompt(profile: SearchProfile, request: SearchRequest): string {
  const prioritizedSkills = profile.skills
    .filter((skill) => skill.depth !== 'avoid')
    .slice(0, 15)
    .map((skill) => ({
      name: skill.name,
      depth: skill.depth,
      category: skill.category,
      positioning: skill.positioning,
    }))

  return `Find high-fit job opportunities for this candidate. Use web search to inspect active roles on major boards and company career pages.

Candidate profile:
${JSON.stringify(
  {
    skills: prioritizedSkills,
    workSummary: profile.workSummary,
    openQuestions: profile.openQuestions,
    constraints: profile.constraints,
    filters: profile.filters,
    interviewPrefs: profile.interviewPrefs,
  },
  null,
  2,
)}

Search request:
${JSON.stringify(request, null, 2)}

Search targets:
- Prefer live roles on LinkedIn, Greenhouse, Lever, Ashby, Wellfound, and direct company career sites.
- Respect excluded companies.
- Tier 1 should be near-perfect matches.
- Tier 2 should be strong but slightly less aligned.
- Tier 3 should be interesting stretch or adjacent roles.
- Attribute every factual claim about interview process, compensation, company size, team structure, hiring status, policies, or funding with [cite:<id>] markers.
- Each [cite:<id>] marker must resolve to an entry in the result's citations array. Do not make factual claims you cannot cite.
- If Search request.resumeVariants is non-empty, assign each top result a recommendedVariant matching one provided variant id.
- If Search request.resumeVariants is non-empty, include exactly 3 bulletEdits per top result: #1 with emphasis "lead", #2 and #3 with emphasis "supporting".
- Each bulletEdits[].text must be a complete paste-ready resume bullet, written in first-person past-tense, with metrics, and under 30 words.
- keywordsToInclude must contain 8-12 posting-specific phrases, mirroring the posting's language rather than generic skills.

Wrap your final JSON output with <result> and </result> tags on their own lines.
Any reasoning, narrative, or prose may appear outside these tags — parsers look
only inside the tags for the structured result. Example:

<result>
{ "results": [ ... ] }
</result>

Return JSON only (inside the tags) with this schema:
{
  "results": [
    {
      "tier": 1,
      "company": "string",
      "title": "string",
      "url": "string",
      "location": "optional string",
      "matchScore": 0,
      "matchReason": "string",
      "vectorAlignment": "string",
      "risks": ["string"],
      "estimatedComp": "optional string",
      "candidateEdge": "optional 2-4 sentence narrative using candidate fact + company fact + interpretation with [cite:<id>] markers for factual company claims",
      "jobDescription": "optional raw job posting text; include only when directly available from a source, never inferred",
      "jobDescriptionSourceUrl": "optional same-origin source URL required when jobDescription is present",
      "recommendedVariant": "optional id from Search request.resumeVariants when variants are provided",
      "bulletEdits": [{ "emphasis": "lead|supporting", "text": "complete first-person past-tense bullet with metrics, under 30 words", "rationale": "optional posting-language rationale" }],
      "keywordsToInclude": ["8-12 posting-specific phrases to mirror in the resume"],
      "citations": [{ "id": "source slug matching [cite:<id>]", "source": "string", "url": "optional string", "type": "careers|public|review|index|github|news|other", "claim": "optional supported claim" }],
      "source": "string"
    }
  ]
}`
}

export async function executeSearch(
  profile: SearchProfile,
  request: SearchRequest,
  endpoint: string,
): Promise<{
  results: SearchResultEntry[]
  searchLog: string[]
  tokenUsage?: SearchTokenUsage
  contractViolations: string[]
}> {
  const systemPrompt = `You are a strategic executive recruiter and job-search operator. Use web search actively, evaluate fit rigorously, and return JSON only.
Prioritize roles that match the candidate's active thesis lanes, seniority, skills, and search constraints. Be realistic about fit, call out risks, and avoid duplicate listings.`

  const execution = await callSearchProxy(
    endpoint,
    systemPrompt,
    buildSearchPrompt(profile, request),
  )

  try {
    const normalized = normalizeResultsWithContractViolations(
      JSON.parse(extractJsonBlock(execution.text)),
      request,
    )
    if (normalized.contractViolations.length > 0) {
      console.warn(
        '[research] search result contract violations (executeSearch)',
        normalized.contractViolations,
      )
    }
    return {
      results: normalized.results,
      searchLog: execution.searchLog,
      tokenUsage: execution.tokenUsage,
      contractViolations: normalized.contractViolations,
    }
  } catch (error) {
    if (error instanceof JsonExtractionError) {
      throw error
    }
    throw new Error('Failed to parse search results response.')
  }
}
