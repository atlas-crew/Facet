import {
  PREP_COMPANY_AI_POSTURE_STRENGTH_VALUES,
  PREP_CARD_KIND_VALUES,
  PREP_CATEGORY_VALUES,
  PREP_CONTEXT_GAP_PRIORITY_VALUES,
  PREP_CONDITIONAL_TONE_VALUES,
  PREP_INTERVIEWER_LIKELY_ROLE_VALUES,
  PREP_SCRIPT_KIND_VALUES,
  PREP_STORY_BLOCK_LABEL_VALUES,
  parsePrepScriptKind,
  resolvePrepCardKind,
} from '../types/prep'
import type {
  PrepCard,
  PrepCategory,
  PrepCompanyIntel,
  PrepConditional,
  PrepContractViolation,
  PrepContextGap,
  PrepContextGapPriority,
  PrepConditionalTone,
  PrepGenerationRequest,
  PrepGenerationResult,
  PrepIdentityMetricCandidate,
  PrepDeck,
  PrepInterviewer,
  PrepInterviewerIntel,
  PrepInterviewerLikelyRole,
  PrepMetric,
  PrepNumbersToKnow,
  PrepPipelineEntryContext,
  PrepPipelineRoundInterviewerContext,
  PrepQuestionToAsk,
  PrepScriptKind,
  PrepStackAlignmentConfidence,
  PrepStackAlignmentRow,
  PrepStoryBlock,
  PrepStoryBlockLabel,
  PrepStoryVariant,
} from '../types/prep'
import { createId, slugify } from './idUtils'
import { parseJsonWithRepair } from './jsonParsing'
import { callLlmProxy, extractJsonBlock, JsonExtractionError, isString } from './llmProxy'
import { hasOwnAnswerTemplate, normalizePrepAnswerTemplate } from './prepAnswerTemplate'
import { projectForAudience } from './audienceFilter'
import type { AudienceProjection } from './audienceFilter'
import {
  formatPrepSkillDepthConfidenceGuidance,
  mapSkillDepthToStackConfidence,
} from './prepSkillDepthMapping'

/** Model used for interview prep — needs creative, detailed output. */
const PREP_MODEL = 'sonnet'
const PREP_TIMEOUT_MS = 240000
/**
 * Output budget for prep decks. 4096 (proxy default) truncates decks with
 * 8+ cards mid-array; 8192 gives comfortable headroom. Requires proxy-side
 * `MAX_REQUEST_TOKENS >= 8192` — otherwise the proxy silently clamps.
 */
const PREP_MAX_TOKENS = 8192
const RAW_KIND_LOG_TRUNCATE = 64

function truncateForLog(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value
}

interface PrepGenerationPayload {
  deckTitle: string
  companyResearchSummary?: string
  answerTemplate?: string
  companyIntel?: PrepCompanyIntel
  rules?: string[]
  donts?: string[]
  questionsToAsk?: PrepQuestionToAsk[]
  numbersToKnow?: PrepNumbersToKnow
  stackAlignment?: PrepStackAlignmentRow[]
  interviewers?: PrepInterviewer[]
  categoryGuidance?: Record<string, string>
  contextGaps?: PrepContextGap[]
  cards: Array<Omit<PrepCard, 'id'>>
}

interface PrepInterviewPrepResult {
  deckTitle: string
  companyResearchSummary: string
  answerTemplate?: string | null
  rules?: string[]
  donts?: string[]
  questionsToAsk?: PrepQuestionToAsk[]
  numbersToKnow?: PrepNumbersToKnow
  stackAlignment?: PrepStackAlignmentRow[]
  categoryGuidance?: Partial<Record<PrepCategory, string>>
  contextGaps?: PrepContextGap[]
  cards: PrepCard[]
  deck: PrepDeck
  contractViolations: PrepContractViolation[]
}

const STACK_ALIGNMENT_CONFIDENCE_ALIASES: Record<PrepStackAlignmentConfidence, readonly string[]> =
  {
    Strong: ['strong'],
    Solid: ['solid'],
    'Working knowledge': ['working knowledge', 'working-knowledge', 'working', 'familiar'],
    'Adjacent experience': [
      'adjacent experience',
      'adjacent-experience',
      'adjacent',
      'transferable',
    ],
    Gap: ['gap', 'missing', 'none'],
  }

const GAP_FRAMING_CONFIDENCE_ORDER: Record<PrepStackAlignmentConfidence, number> = {
  Gap: 0,
  'Adjacent experience': 1,
  'Working knowledge': 2,
  Solid: 3,
  Strong: 4,
}

const STORY_BLOCK_LABEL_ALIASES: Array<[PrepStoryBlockLabel, string[]]> = [
  ['problem', ['problem', 'problem statement', 'challenge', 'context', 'situation']],
  ['solution', ['solution', 'action', 'approach', 'what i did']],
  ['result', ['result', 'outcome', 'impact', 'what happened']],
  ['closer', ['closer', 'close', 'wrap-up', 'wrap up', 'takeaway']],
  ['note', ['note', 'callout']],
]

const normalizeStringList = (values: unknown): string[] | undefined => {
  if (!Array.isArray(values)) return undefined
  const normalized = values
    .filter(isString)
    .map((value) => value.trim())
    .filter(Boolean)
  return normalized.length > 0 ? normalized : undefined
}

function normalizeMetricList(value: unknown): PrepMetric[] | undefined {
  if (!Array.isArray(value)) return undefined
  const metrics = value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const record = entry as Record<string, unknown>
    const rawValue = record.value
    const valueText = isString(rawValue)
      ? rawValue.trim()
      : typeof rawValue === 'number' && Number.isFinite(rawValue)
        ? String(rawValue)
        : ''
    const label = isString(record.label) ? record.label.trim() : ''
    return valueText && label ? [{ value: valueText, label }] : []
  })
  return metrics.length > 0 ? metrics : undefined
}

function normalizeTimeBudgetMinutes(value: unknown): number | undefined {
  const numericValue =
    typeof value === 'number' ? value : isString(value) ? Number(value.trim()) : Number.NaN

  if (!Number.isFinite(numericValue) || numericValue <= 0) return undefined

  return Math.round(numericValue * 10) / 10
}

function normalizeNumbersToKnow(value: unknown): PrepNumbersToKnow | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const record = value as Record<string, unknown>
  const candidate = normalizeMetricList(record.candidate)
  const company = normalizeMetricList(record.company)
  return candidate || company
    ? {
        ...(candidate ? { candidate } : {}),
        ...(company ? { company } : {}),
      }
    : undefined
}

function normalizeStringRecord(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const normalized = Object.fromEntries(
    Object.entries(value as Record<string, unknown>).flatMap(([key, rawValue]) => {
      const normalizedKey = key.trim()
      const normalizedValue = isString(rawValue) ? rawValue.trim() : ''
      return normalizedKey && normalizedValue ? [[normalizedKey, normalizedValue]] : []
    }),
  )
  return Object.keys(normalized).length > 0 ? normalized : undefined
}

function normalizeCompanyIntel(value: unknown): PrepCompanyIntel | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const record = value as Record<string, unknown>
  const pickString = (key: keyof Omit<PrepCompanyIntel, 'aiPosture' | 'other'>) => {
    const raw = record[key]
    return isString(raw) ? raw.trim() || undefined : undefined
  }
  const aiPostureRaw =
    record.aiPosture && typeof record.aiPosture === 'object' && !Array.isArray(record.aiPosture)
      ? (record.aiPosture as Record<string, unknown>)
      : undefined
  const aiPostureNarrative = isString(aiPostureRaw?.narrative) ? aiPostureRaw.narrative.trim() : ''
  const aiPostureStrength = isString(aiPostureRaw?.strength)
    ? aiPostureRaw.strength.trim().toLowerCase()
    : ''
  const aiPosture =
    aiPostureRaw && aiPostureNarrative.length >= 4
      ? {
          strength: PREP_COMPANY_AI_POSTURE_STRENGTH_VALUES.includes(
            aiPostureStrength as (typeof PREP_COMPANY_AI_POSTURE_STRENGTH_VALUES)[number],
          )
            ? (aiPostureStrength as (typeof PREP_COMPANY_AI_POSTURE_STRENGTH_VALUES)[number])
            : 'unknown',
          narrative: aiPostureNarrative,
          signals: normalizeStringList(aiPostureRaw.signals),
        }
      : undefined
  const companyIntel: PrepCompanyIntel = {
    whatTheyDo: pickString('whatTheyDo'),
    scale: pickString('scale'),
    theRole: pickString('theRole'),
    stack: pickString('stack'),
    team: pickString('team'),
    aiPosture,
    other: normalizeStringRecord(record.other),
  }

  return Object.values(companyIntel).some(Boolean) ? companyIntel : undefined
}

function normalizeStackAlignmentConfidence(
  value: unknown,
): PrepStackAlignmentConfidence | undefined {
  if (!isString(value)) return undefined
  const normalized = value.trim().toLowerCase()

  for (const confidence of Object.keys(
    STACK_ALIGNMENT_CONFIDENCE_ALIASES,
  ) as PrepStackAlignmentConfidence[]) {
    const values = STACK_ALIGNMENT_CONFIDENCE_ALIASES[confidence]
    if (values.includes(normalized)) return confidence
  }
  return undefined
}

function normalizeStackAlignment(value: unknown): PrepStackAlignmentRow[] | undefined {
  if (!Array.isArray(value)) return undefined
  const seenTech = new Set<string>()
  const rows = value
    .flatMap((entry) => {
      if (!entry || typeof entry !== 'object') return []
      const record = entry as Record<string, unknown>
      const theirTech = isString(record.theirTech) ? record.theirTech.trim() : ''
      const yourMatch = isString(record.yourMatch) ? record.yourMatch.trim() : ''
      const confidence = normalizeStackAlignmentConfidence(record.confidence)
      const normalizedTech = theirTech.toLowerCase()
      if (!theirTech || !yourMatch || !confidence || seenTech.has(normalizedTech)) {
        return []
      }
      seenTech.add(normalizedTech)
      return theirTech && yourMatch && confidence ? [{ theirTech, yourMatch, confidence }] : []
    })
    .slice(0, 20)
  return rows.length > 0 ? rows : undefined
}

function normalizeStoryBlockLabel(value: unknown): PrepStoryBlockLabel | undefined {
  if (!isString(value)) return undefined
  const normalized = value.trim().toLowerCase()
  if (!normalized) return undefined
  if ((PREP_STORY_BLOCK_LABEL_VALUES as readonly string[]).includes(normalized)) {
    return normalized as PrepStoryBlockLabel
  }

  for (const [label, aliases] of STORY_BLOCK_LABEL_ALIASES) {
    if (aliases.some((alias) => normalized.includes(alias))) {
      return label
    }
  }

  return undefined
}

function stripCandidateMetricsFromIdentityContext(
  value: PrepGenerationRequest['identityContext'],
): Record<string, unknown> | undefined {
  if (!value) return undefined
  const {
    candidate_metrics: _candidateMetrics,
    fallback_candidate_metrics: _fallbackCandidateMetrics,
    ...rest
  } = value
  return rest
}

function normalizeStackAlignmentTechKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9+#]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function expandStackAlignmentTechKeys(value: string): string[] {
  const normalizedKey = normalizeStackAlignmentTechKey(value)
  if (!normalizedKey) return []

  const keys = new Set([normalizedKey])
  if (normalizedKey.endsWith(' js')) keys.add(normalizedKey.replace(/\s+js$/, ''))
  if (normalizedKey === 'postgres') keys.add('postgresql')
  if (normalizedKey === 'postgresql') keys.add('postgres')
  if (normalizedKey === 'k8s') keys.add('kubernetes')
  if (normalizedKey === 'kubernetes') keys.add('k8s')
  return [...keys]
}

function pickLowerStackConfidence(
  left: PrepStackAlignmentConfidence,
  right: PrepStackAlignmentConfidence,
): PrepStackAlignmentConfidence {
  return GAP_FRAMING_CONFIDENCE_ORDER[left] <= GAP_FRAMING_CONFIDENCE_ORDER[right] ? left : right
}

function isLowerStackConfidence(
  left: PrepStackAlignmentConfidence,
  right: PrepStackAlignmentConfidence,
): boolean {
  return GAP_FRAMING_CONFIDENCE_ORDER[left] < GAP_FRAMING_CONFIDENCE_ORDER[right]
}

function warnStackAlignmentConfidenceCollision(params: {
  key: string
  existing: PrepStackAlignmentConfidence
  incoming: PrepStackAlignmentConfidence
}): void {
  console.warn('[prepGenerator] duplicate stack alignment confidence ceiling', params)
}

function buildStackAlignmentConfidenceCeilings(
  analysis: PrepGenerationRequest['jdAnalysis'],
): Map<string, PrepStackAlignmentConfidence> {
  const ceilings = new Map<string, PrepStackAlignmentConfidence>()

  const setCeiling = (key: string, confidence: PrepStackAlignmentConfidence) => {
    for (const normalizedKey of expandStackAlignmentTechKeys(key)) {
      const existing = ceilings.get(normalizedKey)
      if (existing && existing !== confidence) {
        warnStackAlignmentConfidenceCollision({
          key: normalizedKey,
          existing,
          incoming: confidence,
        })
      }
      ceilings.set(
        normalizedKey,
        existing ? pickLowerStackConfidence(existing, confidence) : confidence,
      )
    }
  }

  for (const skillMatch of analysis.skillMatches) {
    const confidence = mapSkillDepthToStackConfidence(
      skillMatch.userDepth,
      skillMatch.presentationGuidance,
    )
    setCeiling(skillMatch.skillName, confidence)
  }

  return ceilings
}

function findStackAlignmentConfidenceCeiling(
  theirTech: string,
  ceilings: Map<string, PrepStackAlignmentConfidence>,
): PrepStackAlignmentConfidence | undefined {
  const normalizedTech = normalizeStackAlignmentTechKey(theirTech)
  if (!normalizedTech) return undefined

  for (const key of expandStackAlignmentTechKeys(theirTech)) {
    const confidence = ceilings.get(key)
    if (confidence) return confidence
  }

  return undefined
}

function applyStackAlignmentConfidenceCeilings(
  stackAlignment: PrepStackAlignmentRow[] | undefined,
  analysis: PrepGenerationRequest['jdAnalysis'],
): PrepStackAlignmentRow[] | undefined {
  if (!stackAlignment) return undefined
  const ceilings = buildStackAlignmentConfidenceCeilings(analysis)
  if (ceilings.size === 0) return stackAlignment

  return stackAlignment.map((row) => {
    const ceiling = findStackAlignmentConfidenceCeiling(row.theirTech, ceilings)
    if (!ceiling) return row
    return isLowerStackConfidence(ceiling, row.confidence) ? { ...row, confidence: ceiling } : row
  })
}

function formatJdAnalysisForPrompt(analysis: AudienceProjection): string {
  const skillMatches = analysis.skillMatches.map((skillMatch) => ({
    ...skillMatch,
    prepStackConfidence: mapSkillDepthToStackConfidence(
      skillMatch.userDepth,
      skillMatch.presentationGuidance,
    ),
  }))

  return JSON.stringify(
    {
      id: analysis.id,
      audience: analysis.audience,
      pipelineEntryId: analysis.pipelineEntryId,
      generatedAt: analysis.generatedAt,
      modelVersion: analysis.modelVersion,
      jdTextHash: analysis.jdTextHash,
      summary: analysis.summary,
      oneLineSummary: analysis.oneLineSummary,
      recommendation: analysis.recommendation,
      confidence: analysis.confidence,
      fitScore: analysis.fitScore,
      rationale: analysis.rationale,
      requirements: analysis.requirements,
      skillMatches,
      matchedVectors: analysis.matchedVectors,
      primaryVectorId: analysis.primaryVectorId,
      strengthsToLead: analysis.strengthsToLead,
      advantages: analysis.advantages,
      gaps: analysis.gaps,
      gapFocus: analysis.gapFocus,
      watchOuts: analysis.watchOuts,
      triggeredPrioritize: analysis.triggeredPrioritize,
      triggeredAvoid: analysis.triggeredAvoid,
      relevantAwareness: analysis.relevantAwareness,
      positioningRecommendations: analysis.positioningRecommendations,
      evidenceMapping: analysis.evidenceMapping,
      requirementCoverageScore: analysis.requirementCoverageScore,
      matchedRequirementIds: analysis.matchedRequirementIds,
      matchedKeywords: analysis.matchedKeywords,
    },
    null,
    2,
  )
}

/**
 * Returns the user-sourced interviewers for the targeted round, or an empty
 * array when no round was specified. This is the sole path by which
 * interviewer names enter the prep generator — the prompt emission is gated
 * on this being non-empty, and no other code path reads interviewer identity
 * (see doc-30 §Interviewer Capture and the ai-inference-vs-user-input rule).
 */
function readRoundInterviewers(
  value: PrepPipelineEntryContext | undefined,
): PrepPipelineRoundInterviewerContext[] {
  return value?.round?.interviewers ?? []
}

// Identity context is produced in-process by buildPrepIdentityContext, so array shape is trusted here.
function readIdentityMetricCandidates(
  value: PrepGenerationRequest['identityContext'],
  key: 'candidate_metrics' | 'fallback_candidate_metrics',
): PrepIdentityMetricCandidate[] | undefined {
  const candidate = value?.[key]
  return Array.isArray(candidate) ? (candidate as PrepIdentityMetricCandidate[]) : undefined
}

function normalizeStoryBlocks(value: unknown): PrepStoryBlock[] | undefined {
  if (!Array.isArray(value)) return undefined
  const storyBlocks = value.flatMap((block) => {
    if (!block || typeof block !== 'object') return []
    const record = block as Record<string, unknown>
    const label = normalizeStoryBlockLabel(record.label)
    const text = isString(record.text) ? record.text.trim() : ''
    return label && text ? [{ label, text }] : []
  })
  return storyBlocks.length > 0 ? storyBlocks : undefined
}

function normalizeStoryVariants(value: unknown): PrepStoryVariant[] | undefined {
  if (!Array.isArray(value)) return undefined
  const seenIds = new Set<string>()
  const variants = value.flatMap((variant) => {
    if (!variant || typeof variant !== 'object') return []
    const record = variant as Record<string, unknown>
    const label = isString(record.label) ? record.label.trim() : ''
    const storyBlocks = normalizeStoryBlocks(record.storyBlocks)
    if (!label || !storyBlocks) return []
    const stableId = slugify(
      [label, isString(record.roleContext) ? record.roleContext.trim() : '']
        .filter(Boolean)
        .join(' '),
    )
    const baseId =
      isString(record.id) && record.id.trim()
        ? record.id.trim()
        : stableId
          ? `prep-story-variant-${stableId}`
          : createId('prep-story-variant')
    const id = getUniqueStoryVariantId(baseId, seenIds)
    return [
      {
        id,
        label,
        storyBlocks,
        keyPoints: normalizeStringList(record.keyPoints),
        roleContext: isString(record.roleContext)
          ? record.roleContext.trim() || undefined
          : undefined,
        when: isString(record.when) ? record.when.trim() || undefined : undefined,
      },
    ]
  })
  return variants.length > 0 ? variants : undefined
}

function getUniqueStoryVariantId(baseId: string, seenIds: Set<string>): string {
  let id = baseId
  let suffix = 2
  while (seenIds.has(id)) {
    id = `${baseId}-${suffix}`
    suffix += 1
  }
  seenIds.add(id)
  return id
}

function normalizeQuestionsToAsk(value: unknown): PrepQuestionToAsk[] | undefined {
  if (!Array.isArray(value)) return undefined
  const questions = value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const record = entry as Record<string, unknown>
    const question = isString(record.question) ? record.question.trim() : ''
    const context = isString(record.context) ? record.context.trim() : ''
    return question && context ? [{ question, context }] : []
  })
  return questions.length > 0 ? questions : undefined
}

function normalizeContextGapPriority(value: unknown): PrepContextGapPriority {
  if (!isString(value)) return 'recommended'
  const normalized = value.trim().toLowerCase()
  return PREP_CONTEXT_GAP_PRIORITY_VALUES.includes(normalized as PrepContextGapPriority)
    ? (normalized as PrepContextGapPriority)
    : 'recommended'
}

function normalizeContextGaps(value: unknown): PrepContextGap[] | undefined {
  if (!Array.isArray(value)) return undefined
  const gaps = value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const record = entry as Record<string, unknown>
    const id = isString(record.id) ? record.id.trim() : createId('prep-gap')
    const section = isString(record.section) ? record.section.trim() : ''
    const question = isString(record.question) ? record.question.trim() : ''
    const why = isString(record.why) ? record.why.trim() : ''
    const feedbackTarget = isString(record.feedbackTarget) ? record.feedbackTarget.trim() : ''
    if (!section || !question || !why) return []
    return [
      {
        id,
        section,
        question,
        why,
        feedbackTarget: feedbackTarget || undefined,
        priority: normalizeContextGapPriority(record.priority),
      },
    ]
  })
  return gaps.length > 0 ? gaps : undefined
}

function normalizeConditionalTone(value: unknown): PrepConditionalTone | undefined {
  if (!isString(value)) return undefined
  const normalized = value.trim().toLowerCase()
  return PREP_CONDITIONAL_TONE_VALUES.includes(normalized as PrepConditionalTone)
    ? (normalized as PrepConditionalTone)
    : undefined
}

function normalizeConditionals(value: unknown): PrepConditional[] | undefined {
  if (!Array.isArray(value)) return undefined
  const conditionals = value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const record = entry as Record<string, unknown>
    const trigger = isString(record.trigger) ? record.trigger.trim() : ''
    const response = isString(record.response) ? record.response.trim() : ''
    const tone = normalizeConditionalTone(record.tone)
    return trigger && response ? [{ trigger, response, tone }] : []
  })
  return conditionals.length > 0 ? conditionals : undefined
}

function inferPrepScriptKind(params: {
  category: PrepCategory
  kind: PrepCard['kind']
  tags: string[]
  title: string
  script?: string
  scriptLabel?: string
}): PrepScriptKind | undefined {
  // Prompted scriptKind wins; this legacy fallback favors safety-critical gap
  // framing before display-copy one-liners, openers, closers, then pivots.
  const searchable = [params.title, params.scriptLabel ?? '', params.script ?? '', ...params.tags]
    .join(' ')
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")

  if (
    params.tags.some((tag) => tag.trim().toLowerCase() === 'gap-framing') ||
    /(?:bridge this gap|honest bridge|what you know, what you don't|transferable)/.test(searchable)
  ) {
    return 'honest-bridge'
  }

  if (/(?:line that lands|one-liner|one liner)/.test(searchable)) {
    return 'line-that-lands'
  }

  if (params.kind === 'opener' || params.category === 'opener') return 'opener'
  if (params.kind === 'closer' || /(?:closer|closing|takeaway|wrap[- ]?up)/.test(searchable)) {
    return 'closer'
  }
  if (/(?:pivot|reframe|transition)/.test(searchable)) return 'pivot'

  return undefined
}

function normalizeCategoryGuidance(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const entries = Object.entries(value as Record<string, unknown>).flatMap(([key, guidance]) => {
    const normalizedKey = key.trim()
    const normalizedGuidance = isString(guidance) ? guidance.trim() : ''
    return normalizedKey &&
      normalizedGuidance &&
      (PREP_CATEGORY_VALUES as readonly string[]).includes(normalizedKey)
      ? [[normalizedKey, normalizedGuidance] as const]
      : []
  })

  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

function normalizeCards(cards: unknown[]): PrepCard[] {
  return cards.flatMap((card) => {
    if (!card || typeof card !== 'object') return []
    const record = card as Record<string, unknown>
    if (!isString(record.title) || !isString(record.category)) return []
    if (!(PREP_CATEGORY_VALUES as readonly string[]).includes(record.category)) {
      return []
    }
    const category = record.category as PrepCategory
    const kind = resolvePrepCardKind(record.kind, record) ?? 'story'

    const tags = Array.isArray(record.tags)
      ? record.tags
          .filter(isString)
          .map((tag) => tag.trim())
          .filter(Boolean)
      : []
    const title = record.title.trim()
    const script = isString(record.script) ? record.script.trim() || undefined : undefined
    const scriptLabel = isString(record.scriptLabel)
      ? record.scriptLabel.trim() || undefined
      : undefined
    // Missing or null scriptKind means "infer from legacy/generated copy"; use an
    // explicit enum value when the model needs to prevent copy-based ambiguity.
    const scriptKind =
      parsePrepScriptKind(record.scriptKind) ??
      (script
        ? inferPrepScriptKind({
            category,
            kind,
            tags,
            title,
            script,
            scriptLabel,
          })
        : undefined)

    return [
      {
        id: createId('prep-card'),
        kind,
        category,
        title,
        tags,
        timeBudgetMinutes: normalizeTimeBudgetMinutes(record.timeBudgetMinutes),
        notes: isString(record.notes) ? record.notes.trim() : undefined,
        script,
        scriptKind,
        scriptLabel,
        pushbackScript: isString(record.pushbackScript)
          ? record.pushbackScript.trim() || undefined
          : undefined,
        pushbackLabel: isString(record.pushbackLabel)
          ? record.pushbackLabel.trim() || undefined
          : undefined,
        alternativeTitle: isString(record.alternativeTitle)
          ? record.alternativeTitle.trim() || undefined
          : undefined,
        alternativeScript: isString(record.alternativeScript)
          ? record.alternativeScript.trim() || undefined
          : undefined,
        warning: isString(record.warning) ? record.warning.trim() : undefined,
        storyBlocks: normalizeStoryBlocks(record.storyBlocks),
        storyVariants: normalizeStoryVariants(record.storyVariants),
        keyPoints: normalizeStringList(record.keyPoints),
        followUps: Array.isArray(record.followUps)
          ? record.followUps.flatMap((followUp) => {
              if (!followUp || typeof followUp !== 'object') return []
              const item = followUp as Record<string, unknown>
              return isString(item.question) && isString(item.answer)
                ? [
                    {
                      question: item.question.trim(),
                      answer: item.answer.trim(),
                    },
                  ]
                : []
            })
          : undefined,
        deepDives: Array.isArray(record.deepDives)
          ? record.deepDives.flatMap((deepDive) => {
              if (!deepDive || typeof deepDive !== 'object') return []
              const item = deepDive as Record<string, unknown>
              return isString(item.title) && isString(item.content)
                ? [{ title: item.title.trim(), content: item.content.trim() }]
                : []
            })
          : undefined,
        conditionals: normalizeConditionals(record.conditionals),
        metrics: Array.isArray(record.metrics)
          ? record.metrics.flatMap((metric) => {
              if (!metric || typeof metric !== 'object') return []
              const item = metric as Record<string, unknown>
              return isString(item.value) && isString(item.label)
                ? [{ value: item.value.trim(), label: item.label.trim() }]
                : []
            })
          : undefined,
        tableData:
          record.tableData && typeof record.tableData === 'object'
            ? {
                headers: Array.isArray((record.tableData as { headers?: unknown[] }).headers)
                  ? ((record.tableData as { headers: unknown[] }).headers.filter(
                      isString,
                    ) as string[])
                  : [],
                rows: Array.isArray((record.tableData as { rows?: unknown[] }).rows)
                  ? (record.tableData as { rows: unknown[] }).rows.flatMap((row) =>
                      Array.isArray(row) && row.every(isString) ? [row] : [],
                    )
                  : [],
              }
            : undefined,
        interviewerIds: normalizeStringList(record.interviewerIds),
        source: 'ai',
      },
    ]
  })
}

function normalizeInterviewers(value: unknown): PrepInterviewer[] | undefined {
  if (!Array.isArray(value)) return undefined
  const interviewers = value.flatMap((entry): PrepInterviewer[] => {
    if (!entry || typeof entry !== 'object') return []
    const record = entry as Record<string, unknown>
    const name = isString(record.name) ? record.name.trim() : ''

    const intelRaw =
      record.intel && typeof record.intel === 'object'
        ? (record.intel as Record<string, unknown>)
        : {}
    const pickIntelString = (key: keyof PrepInterviewerIntel): string | undefined => {
      const raw = intelRaw[key]
      if (!isString(raw)) return undefined
      const trimmed = raw.trim()
      return trimmed || undefined
    }
    const intel: PrepInterviewerIntel = {
      role: pickIntelString('role'),
      background: pickIntelString('background'),
      stack: pickIntelString('stack'),
      caresAbout: pickIntelString('caresAbout'),
      yourAngle: pickIntelString('yourAngle'),
      keyTell: pickIntelString('keyTell'),
      linkedInPositioning: pickIntelString('linkedInPositioning'),
      education: pickIntelString('education'),
    }

    const providedId = isString(record.id) ? record.id.trim() : ''
    const id = providedId || createId('prep-interviewer')
    const title = isString(record.title) ? record.title.trim() || undefined : undefined
    const linkedInUrl = isString(record.linkedInUrl)
      ? record.linkedInUrl.trim() || undefined
      : undefined
    const lineThatLands = isString(record.lineThatLands)
      ? record.lineThatLands.trim() || undefined
      : undefined
    const providedLikelyRole = normalizeInterviewerLikelyRole(record.likelyRole)
    const inferredLikelyRole = inferInterviewerLikelyRole(
      [title, intel.role].filter(Boolean).join(' '),
    )
    const coachingNote = isString(record.coachingNote)
      ? record.coachingNote.trim() || undefined
      : undefined
    const notes = isString(record.notes) ? record.notes.trim() || undefined : undefined
    const metInRounds = normalizeRoundNumberList(record.metInRounds)
    const likelyRole =
      !name && coachingNote ? 'unknown' : (providedLikelyRole ?? inferredLikelyRole)

    if (!name && (!coachingNote || likelyRole !== 'unknown')) return []

    return [
      {
        id,
        name,
        title,
        linkedInUrl,
        intel,
        likelyRole,
        coachingNote,
        lineThatLands,
        metInRounds,
        notes,
      },
    ]
  })
  return interviewers.length > 0 ? interviewers : undefined
}

function normalizeInterviewerLikelyRole(value: unknown): PrepInterviewerLikelyRole | undefined {
  if (!isString(value)) return undefined
  const normalized = value.trim().toLowerCase()
  if ((PREP_INTERVIEWER_LIKELY_ROLE_VALUES as readonly string[]).includes(normalized)) {
    return normalized as PrepInterviewerLikelyRole
  }
  const aliases: Record<string, PrepInterviewerLikelyRole> = {
    hm: 'hiring-manager',
    'hiring manager': 'hiring-manager',
    manager: 'hiring-manager',
    director: 'above-hm',
    executive: 'above-hm',
    peer: 'peer',
    teammate: 'peer',
    'skip level': 'skip-level',
    'skip-level': 'skip-level',
    partner: 'cross-functional',
    crossfunctional: 'cross-functional',
    'cross functional': 'cross-functional',
    recruiter: 'recruiter',
    talent: 'recruiter',
    unknown: 'unknown',
  }
  return aliases[normalized]
}

function inferInterviewerLikelyRole(text: string): PrepInterviewerLikelyRole | undefined {
  const normalized = text.toLowerCase()
  if (!normalized) return undefined
  if (/recruit|talent|people partner/.test(normalized)) return 'recruiter'
  if (/\bceo\b|founder|vp|svp|chief|executive/.test(normalized)) return 'above-hm'
  if (/director|head of|skip[-\s]?level/.test(normalized)) return 'skip-level'
  if (
    /manager.*(engineering|eng|software|platform)|(engineering|eng|software|platform).*manager|engineering lead|tech lead|staff engineer|principal engineer/.test(
      normalized,
    )
  ) {
    return 'hiring-manager'
  }
  if (/\b(product|design|security|sales|customer|ops)\b|cross[-\s]?functional/.test(normalized))
    return 'cross-functional'
  if (/\b(senior engineer|engineer)\b/.test(normalized)) return 'peer'
  return 'unknown'
}

function normalizeRoundNumberList(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) return undefined
  const rounds = Array.from(
    new Set(
      value.flatMap((entry) => {
        const numericValue =
          typeof entry === 'number' ? entry : isString(entry) ? Number(entry.trim()) : Number.NaN
        if (!Number.isFinite(numericValue)) return []
        const normalized = Math.trunc(numericValue)
        return normalized > 0 ? [normalized] : []
      }),
    ),
  )
  return rounds.length > 0 ? rounds.sort((left, right) => left - right) : undefined
}

const OPENING_TIME_GUIDANCE_PATTERN =
  /(?:under\s+\d+(?:\.\d+)?\s*(?:seconds?|minutes?)|\d+(?:\.\d+)?\s*(?:seconds?|minutes?)\s*(?:max|or less|or under)|\d+(?:\.\d+)?\s*minute(?:s)?\s*(?:budget|max)|90\s*seconds?|2\s*minutes?\s*max|2\s*minute\s*answer\s*budget)/i

const HONEST_FRAMING_PATTERN =
  /(?:don't fake|do not fake|if asked|honest|bounded|don't pretend|do not pretend|don't overstate|acknowledge honestly|bridge to)/i

const RARITY_FRAMING_PATTERN =
  /(?:rare|uncommon|differentiator|differentiating|unusual|most candidates|market[-\s]?rare|stands out)/i

const ROLE_INFERENCE_PATTERN =
  /(?:likely|probably|most likely|may be|seems|likely interviewer|hiring manager|sign-off|not the interviewer)/i

const INBOUND_APP_METHODS = new Set(['referral', 'recruiter-inbound', 'recruiter-outbound'])

const COLD_APP_METHODS = new Set(['direct-apply', 'cold-email', 'linkedin'])

function countSentences(text: string): number {
  const normalized = text.trim()
  if (!normalized) return 0
  const sentences = normalized
    .split(/(?<=[.!?])\s+/u)
    .map((entry) => entry.trim())
    .filter(Boolean)
  return sentences.length
}

function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .map((entry) => entry.trim())
    .filter(Boolean).length
}

function getCardValidationText(card: PrepCard): string {
  return [
    card.title,
    card.notes,
    card.warning,
    card.script,
    card.pushbackScript,
    ...(card.keyPoints ?? []),
    ...(card.storyBlocks ?? []).map((block) => block.text),
    ...(card.storyVariants ?? []).flatMap((variant) => [
      variant.label,
      variant.roleContext,
      variant.when,
      ...(variant.keyPoints ?? []),
      ...variant.storyBlocks.map((block) => block.text),
    ]),
    ...(card.deepDives ?? []).map((deepDive) =>
      [deepDive.title, deepDive.content].filter(Boolean).join(' '),
    ),
    ...(card.conditionals ?? []).map((conditional) =>
      [conditional.trigger, conditional.response].filter(Boolean).join(' '),
    ),
  ]
    .filter(Boolean)
    .join(' ')
}

function isPrepOpenerCard(card: PrepCard): boolean {
  return (
    !isPrepLandmineCard(card) &&
    (card.category === 'opener' ||
      (card.tags?.some((tag) => tag.trim().toLowerCase() === 'opener') ?? false))
  )
}

function isPrepGapFramingCard(card: PrepCard): boolean {
  return card.tags?.some((tag) => tag.trim().toLowerCase() === 'gap-framing') ?? false
}

function isPrepLandmineCard(card: PrepCard): boolean {
  return card.tags?.some((tag) => tag.trim().toLowerCase() === 'landmine') ?? false
}

function isPrepIntelCard(card: PrepCard): boolean {
  return card.tags?.some((tag) => tag.trim().toLowerCase() === 'intel') ?? false
}

function addViolation(violations: PrepContractViolation[], violation: PrepContractViolation): void {
  violations.push(violation)
}

function logPrepContractViolations(
  request: PrepGenerationRequest,
  violations: PrepContractViolation[],
): void {
  if (violations.length === 0) return

  const severities: Record<PrepContractViolation['severity'], number> = {
    error: 0,
    warning: 0,
  }
  const kinds: Record<string, number> = {}

  for (const violation of violations) {
    severities[violation.severity] += 1
    kinds[violation.kind] = (kinds[violation.kind] ?? 0) + 1
  }

  // Dev diagnostic only: keep this payload aggregate so it is safe to forward
  // later without leaking company, role, or interviewer identifiers.
  console.warn('[prepGenerator] contract violations', {
    feature: 'prep.generate',
    hasPipelineContext: Boolean(request.pipelineEntryContext),
    pipelineRoundId: request.pipelineEntryContext?.round?.id,
    violationCount: violations.length,
    severities,
    kinds,
    fields: Array.from(new Set(violations.map((violation) => violation.field))),
  })
}

function validatePrepGenerationContract(params: {
  deck: Pick<
    PrepDeck,
    'title' | 'rules' | 'cards' | 'stackAlignment' | 'categoryGuidance' | 'contextGaps'
  >
  generatedCards: PrepCard[]
  hasParsedCards: boolean
  rawCards: unknown
  request: PrepGenerationRequest
}): PrepContractViolation[] {
  const violations: PrepContractViolation[] = []
  const { deck, generatedCards, hasParsedCards, rawCards, request } = params

  if (!hasParsedCards) {
    addViolation(violations, {
      kind: 'missing-field',
      field: 'cards',
      message: 'Expected the generated prep payload to include a cards array.',
      severity: 'error',
    })
  }

  if (Array.isArray(rawCards)) {
    rawCards.forEach((rawCard, index) => {
      const rawRecord =
        rawCard && typeof rawCard === 'object' ? (rawCard as Record<string, unknown>) : undefined
      const cardId = isString(rawRecord?.id) ? rawRecord.id.trim() || undefined : undefined
      const rawKind = rawRecord?.kind
      if (!isString(rawKind) || rawKind.trim() === '') {
        addViolation(violations, {
          kind: 'missing-field',
          cardId,
          field: `cards[${index}].kind`,
          message: 'Expected every generated prep card to include a required kind discriminator.',
          severity: 'error',
        })
        return
      }
      const normalizedRawKind = rawKind.trim()
      const displayedRawKind = truncateForLog(normalizedRawKind, RAW_KIND_LOG_TRUNCATE)
      if (!(PREP_CARD_KIND_VALUES as readonly string[]).includes(normalizedRawKind)) {
        addViolation(violations, {
          kind: 'invalid-field',
          cardId,
          field: `cards[${index}].kind`,
          message: `Expected generated prep card kind to match PREP_CARD_KIND_VALUES, received "${displayedRawKind}".`,
          severity: 'error',
        })
      }

      const rawScriptKind = rawRecord?.scriptKind
      if (rawScriptKind !== undefined && rawScriptKind !== null) {
        const normalizedScriptKind = isString(rawScriptKind) ? rawScriptKind.trim() : ''
        if (!(PREP_SCRIPT_KIND_VALUES as readonly string[]).includes(normalizedScriptKind)) {
          const displayedScriptKind = isString(rawScriptKind)
            ? truncateForLog(normalizedScriptKind, RAW_KIND_LOG_TRUNCATE)
            : String(rawScriptKind)
          addViolation(violations, {
            kind: 'invalid-field',
            cardId,
            field: `cards[${index}].scriptKind`,
            message: `Expected generated prep card scriptKind to match PREP_SCRIPT_KIND_VALUES, received "${displayedScriptKind}".`,
            severity: 'error',
          })
        }
      }
    })
  }

  if ((deck.rules?.length ?? 0) < 3) {
    addViolation(violations, {
      kind: 'missing-field',
      field: 'rules',
      message: 'Expected at least 3 deck rules, but the generated deck had fewer.',
      severity: 'error',
    })
  }

  const appMethod = request.pipelineEntryContext?.appMethod
  const guidanceText = Object.values(deck.categoryGuidance ?? {})
    .join(' ')
    .trim()
  if (appMethod && appMethod !== 'unknown') {
    if (
      INBOUND_APP_METHODS.has(appMethod) &&
      !/(?:reached out|conversational|be conversational|not performative)/i.test(guidanceText)
    ) {
      addViolation(violations, {
        kind: 'missing-coaching',
        field: 'categoryGuidance',
        message:
          'Expected category guidance to reflect an inbound conversation and sound conversational.',
        severity: 'error',
      })
    }

    if (
      COLD_APP_METHODS.has(appMethod) &&
      !/(?:convince|earn attention|convince me|earn attention quickly)/i.test(guidanceText)
    ) {
      addViolation(violations, {
        kind: 'missing-coaching',
        field: 'categoryGuidance',
        message:
          'Expected category guidance to reflect a cold application and help the candidate earn attention.',
        severity: 'error',
      })
    }
  }

  const openerCards = generatedCards.filter(isPrepOpenerCard)
  for (const card of openerCards) {
    const notes = card.notes?.trim() ?? ''
    if (countSentences(notes) < 2) {
      addViolation(violations, {
        kind: 'short-prose',
        cardId: card.id,
        field: 'notes',
        message:
          'Opener cards need at least 2 sentences in notes to explain why the opener is framed this way.',
        severity: 'error',
      })
    }

    const warning = card.warning?.trim() ?? ''
    if (!OPENING_TIME_GUIDANCE_PATTERN.test(warning)) {
      addViolation(violations, {
        kind: 'missing-coaching',
        cardId: card.id,
        field: 'warning',
        message:
          'Opener warnings need explicit time guidance such as "under 90 seconds" or "2 minutes max".',
        severity: 'error',
      })
    }

    const script = card.script?.trim() ?? ''
    if (countWords(script) < 12) {
      addViolation(violations, {
        kind: 'missing-field',
        cardId: card.id,
        field: 'script',
        message:
          'Opener scripts need to be non-trivial and grounded enough to deliver as a real answer.',
        severity: 'error',
      })
    }
  }

  for (const card of generatedCards.filter(isPrepGapFramingCard)) {
    const warning = card.warning?.trim() ?? ''
    if (!HONEST_FRAMING_PATTERN.test(warning)) {
      addViolation(violations, {
        kind: 'missing-coaching',
        cardId: card.id,
        field: 'warning',
        message:
          'Gap-framing cards need honest-framing language such as "don\'t fake", "if asked", or "bounded".',
        severity: 'error',
      })
    }

    const hasRampStructure =
      (card.storyBlocks?.length ?? 0) > 0 || (card.keyPoints?.length ?? 0) >= 3

    if (!hasRampStructure) {
      addViolation(violations, {
        kind: 'missing-field',
        cardId: card.id,
        field: 'storyBlocks',
        message:
          'Gap-framing cards need either a structured story or at least 3 key points that show the ramp strategy.',
        severity: 'error',
      })
    }
  }

  const knownInterviewers = readRoundInterviewers(request.pipelineEntryContext)
  if (knownInterviewers.length > 0) {
    const knownInterviewerNames = knownInterviewers
      .map((person) => person.name.trim())
      .filter(Boolean)
    const intelCards = generatedCards.filter(isPrepIntelCard)
    const intelCardWithInference = intelCards.find((card) => {
      const text = getCardValidationText(card)
      const normalizedText = text.toLowerCase()
      return (
        knownInterviewerNames.some((name) => normalizedText.includes(name.toLowerCase())) &&
        ROLE_INFERENCE_PATTERN.test(text)
      )
    })

    if (!intelCardWithInference) {
      addViolation(violations, {
        kind: 'missing-intel',
        field: 'cards',
        message:
          'Round interviewers were supplied, but the generated deck did not include a named-person intel card with role inference.',
        severity: 'error',
      })
    }
  }

  const rarityCards = generatedCards.filter((card) =>
    RARITY_FRAMING_PATTERN.test(
      [card.notes, ...(card.deepDives ?? []).map((deepDive) => deepDive.content)]
        .filter(Boolean)
        .join(' '),
    ),
  )
  if (rarityCards.length < 2) {
    addViolation(violations, {
      kind: 'missing-coaching',
      field: 'notes',
      message: 'Expected at least 2 cards with market-rarity framing in notes or deep dives.',
      severity: 'warning',
    })
  }

  const hasDepthGaps = (deck.stackAlignment ?? []).some(
    (row) => row.confidence === 'Gap' || row.confidence === 'Adjacent experience',
  )
  if (hasDepthGaps) {
    const depthCoverageCount = generatedCards.filter(
      (card) => isPrepLandmineCard(card) || isPrepGapFramingCard(card),
    ).length
    if (depthCoverageCount < 2) {
      addViolation(violations, {
        kind: 'missing-landmine',
        field: 'cards',
        message:
          'Decks with depth gaps need at least 2 landmine or gap-framing cards to keep the candidate honest about risk.',
        severity: 'error',
      })
    }
  }

  return violations
}

function buildGapFramingFallbackCards(
  stackAlignment: PrepStackAlignmentRow[] | undefined,
): PrepCard[] {
  if (!stackAlignment) return []

  const rows = stackAlignment
    .filter((row) => row.confidence === 'Gap' || row.confidence === 'Adjacent experience')
    .sort((left, right) => {
      return (
        GAP_FRAMING_CONFIDENCE_ORDER[left.confidence] -
          GAP_FRAMING_CONFIDENCE_ORDER[right.confidence] ||
        left.theirTech.localeCompare(right.theirTech, undefined, {
          sensitivity: 'base',
        })
      )
    })
    .slice(0, 2)

  return rows.map((row, index) => {
    const acknowledgement =
      row.confidence === 'Gap'
        ? `I have not shipped ${row.theirTech} directly yet.`
        : `My experience with ${row.theirTech} is adjacent, not end-to-end production ownership yet.`
    const boundedRamp =
      row.confidence === 'Gap'
        ? `That is a focused ramp-up area, not a fundamental mismatch.`
        : `That is a depth gap I can close quickly because the underlying patterns already show up in my work.`
    const transferableProof = row.yourMatch.replace(/[.!?]+$/u, '')
    const techTag = slugify(row.theirTech) || slugify(row.yourMatch) || `gap-${index + 1}`
    const warning =
      row.confidence === 'Gap'
        ? `Do not imply direct ${row.theirTech} ownership. Lean on the transferable proof instead.`
        : `Do not imply direct ${row.theirTech} ownership if your closest evidence is adjacent.`
    const confidenceCue =
      row.confidence === 'Gap'
        ? `Close by naming the ramp-up plan you would use to get productive in ${row.theirTech}.`
        : `Name the adjacent system or pattern that transfers cleanly into ${row.theirTech}.`

    return {
      id: createId('prep-card'),
      category: 'technical',
      kind: 'story',
      title: `What you know, what you don't: ${row.theirTech}`,
      tags: Array.from(new Set(['gap-framing', 'transferable-experience', techTag])),
      notes: acknowledgement,
      scriptLabel: 'Bridge This Gap',
      scriptKind: 'honest-bridge',
      script: `I want to be direct: ${acknowledgement} What transfers well is ${transferableProof}. ${boundedRamp}`,
      warning,
      keyPoints: [
        `Closest transferable proof: ${row.yourMatch}`,
        confidenceCue,
        `Be explicit about what is adjacent versus direct in ${row.theirTech}.`,
      ],
      source: 'ai',
    }
  })
}

function ensureGapFramingCards(
  cards: PrepCard[],
  stackAlignment: PrepStackAlignmentRow[] | undefined,
): PrepCard[] {
  const normalizedCards = cards.map((card) =>
    isPrepGapFramingCard(card)
      ? {
          ...card,
          category: 'technical' as const,
          tags: Array.from(
            new Set([
              ...card.tags.filter((tag) => tag.trim().toLowerCase() !== 'gap-framing'),
              'gap-framing',
            ]),
          ),
          scriptKind: card.script ? (card.scriptKind ?? 'honest-bridge') : undefined,
        }
      : card,
  )

  if (normalizedCards.some((card) => isPrepGapFramingCard(card))) {
    return normalizedCards
  }

  return [...normalizedCards, ...buildGapFramingFallbackCards(stackAlignment)]
}

const LANDMINE_TAG = 'landmine'
const PRACTICE_THIS_TAG = 'practice-this'

function isTaggedCard(card: Pick<PrepCard, 'tags'>, tag: string): boolean {
  const normalizedTag = tag.trim().toLowerCase()
  return card.tags.some((cardTag) => cardTag.trim().toLowerCase() === normalizedTag)
}

function canonicalizeTaggedCard(card: PrepCard, tag: string): PrepCard {
  if (!isTaggedCard(card, tag)) return card
  const normalizedTag = tag.trim().toLowerCase()
  return {
    ...card,
    tags: Array.from(
      new Set([
        ...card.tags.filter((cardTag) => cardTag.trim().toLowerCase() !== normalizedTag),
        normalizedTag,
      ]),
    ),
  }
}

function buildLandmineCard(params: {
  kind?: PrepCard['kind']
  category: PrepCategory
  title: string
  notes: string
  warning: string
  script: string
  keyPoints: string[]
}): PrepCard {
  return {
    id: createId('prep-card'),
    kind: params.kind ?? 'story',
    category: params.category,
    title: params.title,
    tags: [LANDMINE_TAG],
    notes: params.notes,
    scriptLabel: 'Predicted trap',
    scriptKind: params.kind === 'opener' || params.category === 'opener' ? 'opener' : undefined,
    script: params.script,
    warning: params.warning,
    keyPoints: params.keyPoints,
    source: 'ai',
    timeBudgetMinutes: 1,
  }
}

function buildLandmineFallbackCards(
  request: PrepGenerationRequest,
  candidateMetrics: PrepIdentityMetricCandidate[] | undefined,
  fallbackCandidateMetrics: PrepIdentityMetricCandidate[] | undefined,
  stackAlignment: PrepStackAlignmentRow[] | undefined,
  existingCards: PrepCard[],
): PrepCard[] {
  const existingLandmineTitles = new Set(
    existingCards
      .filter((card) => isTaggedCard(card, LANDMINE_TAG))
      .map((card) => card.title.trim().toLowerCase()),
  )
  const fallbackCards: PrepCard[] = []

  const addCard = (card: PrepCard) => {
    const normalizedTitle = card.title.trim().toLowerCase()
    if (existingLandmineTitles.has(normalizedTitle)) return
    if (fallbackCards.some((entry) => entry.title.trim().toLowerCase() === normalizedTitle)) return
    fallbackCards.push(card)
  }

  const riskyStackRows = (stackAlignment ?? [])
    .filter((row) => row.confidence === 'Gap' || row.confidence === 'Adjacent experience')
    .sort((left, right) => {
      return (
        GAP_FRAMING_CONFIDENCE_ORDER[left.confidence] -
          GAP_FRAMING_CONFIDENCE_ORDER[right.confidence] ||
        left.theirTech.localeCompare(right.theirTech, undefined, {
          sensitivity: 'base',
        })
      )
    })

  const riskyRow = riskyStackRows[0]
  if (riskyRow) {
    const techName = riskyRow.theirTech.trim()
    const confidenceLabel =
      riskyRow.confidence === 'Gap'
        ? 'You do not have direct ownership of this stack yet.'
        : 'Your experience is adjacent, not exact, so avoid overselling it.'

    addCard(
      buildLandmineCard({
        category: 'technical',
        kind: 'story',
        title: 'Landmine: overstate ' + techName,
        notes: confidenceLabel,
        warning:
          'Do not imply direct ' + techName + ' ownership if your closest evidence is adjacent.',
        script:
          'If they dig into ' +
          techName +
          ', name exactly what you ran, exactly what you observed, and exactly where the boundary is. Then bridge to the closest transferable proof.',
        keyPoints: [
          'State the boundary clearly.',
          'Name the transferable proof.',
          'Do not let confidence outrun evidence.',
        ],
      }),
    )
  }

  const allMetricCandidates = [...(candidateMetrics ?? []), ...(fallbackCandidateMetrics ?? [])]
  if (allMetricCandidates.length > 0) {
    const strongestMetric = allMetricCandidates[0]
    addCard(
      buildLandmineCard({
        category: 'metrics',
        kind: 'story',
        title: 'Landmine: cite a number you cannot defend',
        notes: strongestMetric
          ? 'Keep the source, denominator, and time window ready for ' +
            strongestMetric.suggestedLabel +
            '.'
          : 'A number only helps if you can explain where it came from and what moved.',
        warning: 'Do not volunteer a metric unless you can back it up on the next follow-up.',
        script:
          'If you use a number, be ready to explain the source, the denominator, and the specific change that made it move.',
        keyPoints: ['Know the source.', 'Know the denominator.', 'Know what changed.'],
      }),
    )
  }

  if (request.positioning || request.companyResearch || request.jobDescription) {
    addCard(
      buildLandmineCard({
        category: 'opener',
        kind: 'opener',
        title: 'Landmine: give a generic why this role answer',
        notes:
          'The interviewer is testing whether you can make this role feel specific, not interchangeable.',
        warning: 'Do not make the motivation answer sound like it could fit any company.',
        script:
          'Lead with the exact fit between your background and this role, then name one company-specific reason that makes the move compelling.',
        keyPoints: [
          'Lead with specificity.',
          'Name one company detail.',
          'Keep the answer concrete.',
        ],
      }),
    )
  }

  const hasDepartureSignal =
    Boolean(request.contextGapAnswers?.['identity.departureContext']) ||
    (request.contextGaps ?? []).some((gap) =>
      (gap.id + ' ' + gap.section + ' ' + gap.question + ' ' + gap.why)
        .toLowerCase()
        .includes('departure'),
    )
  if (hasDepartureSignal) {
    addCard(
      buildLandmineCard({
        category: 'behavioral',
        kind: 'story',
        title: 'Landmine: turn your transition into a complaint',
        notes:
          'A departure answer should be calm, brief, and future-facing instead of emotional or defensive.',
        warning: 'Do not vent about the last company, manager, or team.',
        script:
          'Keep the transition short and neutral, explain what you want next, and pivot back to the work you want to do here.',
        keyPoints: ['Keep it brief.', 'Stay neutral.', 'End on what you want next.'],
      }),
    )
  }

  if (existingCards.some((card) => card.category === 'behavioral' || card.category === 'project')) {
    addCard(
      buildLandmineCard({
        category: 'behavioral',
        kind: 'story',
        title: 'Landmine: hide your role inside a team win',
        notes: 'Shared work is fine, but your decisions still need to be audible.',
        warning: 'Do not let we-language erase your own contribution.',
        script:
          'Name the decision you made, the constraint you handled, and the outcome you influenced.',
        keyPoints: ['Name your decision.', 'State the constraint.', 'Make the outcome audible.'],
      }),
    )
  }

  if (readRoundInterviewers(request.pipelineEntryContext).length > 0) {
    addCard(
      buildLandmineCard({
        category: 'situational',
        kind: 'story',
        title: 'Landmine: pretend the org chart is settled',
        notes:
          'Useful interviewer intel should be grounded in the research you actually have, not guessed from titles.',
        warning:
          'Do not state a manager, interviewer, or sign-off path as fact unless the research supports it.',
        script:
          'If you mention the team, speak in probabilities and cite the evidence you actually have.',
        keyPoints: [
          'State your confidence level.',
          'Cite the evidence.',
          'Avoid org-chart theater.',
        ],
      }),
    )
  }

  const genericTemplates = [
    buildLandmineCard({
      category: 'situational',
      kind: 'story',
      title: 'Landmine: answer the question you wished they asked',
      notes:
        'The safer answer is usually the one that directly addresses the question in front of you.',
      warning: 'Do not drift into a different question just because it is easier to answer.',
      script:
        'Pause, answer the exact question, then add one short bridge back to the evidence you want to emphasize.',
      keyPoints: [
        'Answer the exact question.',
        'Add one short bridge.',
        'Do not overtalk the detour.',
      ],
    }),
    buildLandmineCard({
      category: 'situational',
      kind: 'story',
      title: 'Landmine: over-explain the setup',
      notes: 'A long setup can make a sharp answer feel evasive.',
      warning: 'Do not spend the first minute on backstory before the point lands.',
      script:
        'Lead with the point first, then give just enough context to make the answer believable.',
      keyPoints: ['Lead with the point.', 'Keep the context short.', 'Land the answer fast.'],
    }),
    buildLandmineCard({
      category: 'situational',
      kind: 'story',
      title: 'Landmine: sound vague when they want a concrete example',
      notes: 'Vagueness usually reads like missing ownership or missing memory.',
      warning:
        'Do not answer with abstract principles when the interviewer is asking for a real example.',
      script:
        'Name one real example, one decision, and one result before you zoom out to the pattern.',
      keyPoints: ['Use one real example.', 'Name one decision.', 'End with one result.'],
    }),
  ]

  for (const template of genericTemplates) {
    if (fallbackCards.length >= 3) break
    addCard(template)
  }

  return fallbackCards
}

function ensureLandmineCards(
  cards: PrepCard[],
  request: PrepGenerationRequest,
  stackAlignment: PrepStackAlignmentRow[] | undefined,
  candidateMetrics: PrepIdentityMetricCandidate[] | undefined,
  fallbackCandidateMetrics: PrepIdentityMetricCandidate[] | undefined,
): PrepCard[] {
  const normalizedCards = cards.map((card) => canonicalizeTaggedCard(card, LANDMINE_TAG))
  const fallbackCards = buildLandmineFallbackCards(
    request,
    candidateMetrics,
    fallbackCandidateMetrics,
    stackAlignment,
    normalizedCards,
  )
  const mergedCards = [...normalizedCards, ...fallbackCards]
  const landmineIds = new Set(
    mergedCards
      .filter((card) => isTaggedCard(card, LANDMINE_TAG))
      .slice(0, 5)
      .map((card) => card.id),
  )

  return mergedCards.filter((card) => !isTaggedCard(card, LANDMINE_TAG) || landmineIds.has(card.id))
}

function readLatestRoundState(card: PrepCard, roundNumber: number | undefined) {
  const states = [...(card.perRoundState ?? [])]
    .filter((state) => !roundNumber || state.round < roundNumber)
    .sort((left, right) => right.round - left.round)
  return states[0]
}

function buildPriorRoundCardPromptContext(cards: PrepCard[] | undefined) {
  if (!cards?.length) return undefined
  return cards.map((card) => ({
    title: card.title,
    category: card.category,
    tags: card.tags,
    notes: card.notes,
    script: card.script,
    keyPoints: card.keyPoints,
    perRoundState: card.perRoundState,
  }))
}

function detectRoundContradictions(
  debriefs: PrepGenerationRequest['priorRoundDebriefs'],
): string[] | undefined {
  if (!debriefs?.length) return undefined

  const contradictions = debriefs.flatMap((debrief) => {
    const intel = debrief.intel ?? {}
    const questionsAsked = Array.isArray(debrief.questionsAsked) ? debrief.questionsAsked : []
    const surprises = Array.isArray(debrief.surprises) ? debrief.surprises : []
    const newIntel = Array.isArray(debrief.newIntel) ? debrief.newIntel : []
    const openerSignals = [
      debrief.notes ?? '',
      intel.topChallenge ?? '',
      intel.teamCulture ?? '',
      ...Object.values(intel.other ?? {}),
    ]
      .join(' ')
      .toLowerCase()
    const interruptionSignals = [...questionsAsked, ...surprises, ...newIntel]
      .join(' ')
      .toLowerCase()

    if (
      /(opener worked|opener went well|opener successful|opener landed)/.test(openerSignals) &&
      /(cut (me )?off|cut you off|interrupted|stopped me short)/.test(interruptionSignals)
    ) {
      return [
        `Round ${debrief.round}: debrief says the opener worked, but the follow-up notes mention the interviewer cutting the answer off.`,
      ]
    }

    return []
  })

  return contradictions.length > 0 ? contradictions : undefined
}

function ensureRoundAwareRemediationCards(
  cards: PrepCard[],
  request: PrepGenerationRequest,
): PrepCard[] {
  if (!request.roundNumber || request.roundNumber <= 1) return cards
  if (!request.priorRoundCards?.length) return cards

  const priorStatesByTitle = new Map(
    request.priorRoundCards.flatMap((card) => {
      const latestState = readLatestRoundState(card, request.roundNumber)
      if (
        !latestState ||
        (latestState.status !== 'fumbled' && latestState.status !== PRACTICE_THIS_TAG)
      ) {
        return []
      }
      const normalizedTitle = card.title?.trim().toLowerCase() ?? ''
      if (!normalizedTitle) return []
      return [[normalizedTitle, { card, latestState }] as const]
    }),
  )

  const normalizedCards = cards.map((card) => {
    const normalizedCardTitle = card.title?.trim().toLowerCase() ?? ''
    const match = priorStatesByTitle.get(normalizedCardTitle)
    if (!match) return card
    const remediationLead =
      match.latestState.status === 'fumbled'
        ? `Round ${match.latestState.round} miss to correct.`
        : `Keep this sharp for round ${request.roundNumber}.`
    return {
      ...card,
      tags: Array.from(new Set([...(card.tags ?? []), PRACTICE_THIS_TAG])),
      notes: [remediationLead, match.latestState.notes, card.notes].filter(Boolean).join(' '),
    }
  })

  const existingTitles = new Set(
    normalizedCards.map((card) => card.title?.trim().toLowerCase() ?? '').filter(Boolean),
  )
  const fallbackCards: PrepCard[] = []

  for (const [title, match] of priorStatesByTitle.entries()) {
    const remediationTitle = `Practice this again: ${match.card.title}`
    if (existingTitles.has(title)) continue
    if (
      fallbackCards.some(
        (card) => card.title.trim().toLowerCase() === remediationTitle.toLowerCase(),
      )
    ) {
      continue
    }

    const keyPoints = [
      match.latestState.notes,
      ...(match.card.keyPoints ?? []),
      'Make the corrective framing obvious early in the answer.',
    ].filter(Boolean)

    fallbackCards.push({
      id: createId('prep-card'),
      kind: 'story',
      category: match.card.category,
      title: remediationTitle,
      tags: Array.from(new Set([...(match.card.tags ?? []), PRACTICE_THIS_TAG])),
      timeBudgetMinutes: match.card.timeBudgetMinutes,
      notes:
        match.latestState.status === 'fumbled'
          ? `This answer fumbled in round ${match.latestState.round}. Rebuild it with the corrected framing before the next interview.`
          : 'Carry this answer forward and keep it sharp for the next round.',
      scriptLabel: 'Remediation',
      script: match.card.script
        ? `Rebuild this answer with the corrected framing: ${match.card.script}`
        : 'Rebuild this answer so the point lands earlier and the evidence stays concrete.',
      warning:
        match.latestState.status === 'fumbled'
          ? 'Do not repeat the previous miss. Lead with the correction before you add extra context.'
          : 'Do not assume this answer is ready just because it worked once. Keep it crisp.',
      keyPoints: keyPoints.slice(0, 4) as string[],
      source: 'ai',
    })
  }

  return [...normalizedCards, ...fallbackCards.slice(0, 3)]
}

export async function generateInterviewPrep(
  endpoint: string,
  request: PrepGenerationRequest,
): Promise<PrepInterviewPrepResult> {
  // Keep prompt context and post-parse stack confidence ceilings on the same candidate-visible projection.
  const candidateJdAnalysis = projectForAudience(request.jdAnalysis, 'candidate')
  const candidateMetrics = readIdentityMetricCandidates(
    request.identityContext,
    'candidate_metrics',
  )
  const fallbackCandidateMetrics = readIdentityMetricCandidates(
    request.identityContext,
    'fallback_candidate_metrics',
  )
  const structuredIdentityContext = stripCandidateMetricsFromIdentityContext(
    request.identityContext,
  )
  const structuredPipelineEntryContext = request.pipelineEntryContext
  const priorRoundCardContext = buildPriorRoundCardPromptContext(request.priorRoundCards)
  const roundContradictions = detectRoundContradictions(request.priorRoundDebriefs)

  const systemPrompt = `You are an expert interview coach and career strategist. Return JSON only.
Generate a strong interview prep pack from a candidate's resume context, a job description, structured pipeline entry research, company research notes, and (when provided) a target vector to orient the framing.
Focus on truthful storytelling, quantified evidence, likely interview themes, and specific follow-up questions the candidate should prepare for.
Include 8 to 12 cards spanning opener, behavioral, technical, project, metrics, and situational categories when supported by the input.
Use the resume context to ground answers; do not invent facts or metrics not present in the candidate material. If company research is uncertain, say so in notes instead of presenting it as fact.

META-STRATEGY AND DELIVERY COACHING:
You are not just generating scripts — you are coaching the candidate on WHY each answer is framed the way it is and HOW to deliver it. For every card you generate, consider these additional layers:

1. Why This Works (notes field): For opener and gap-framing cards, always include a "notes" field explaining the positioning logic behind the answer. Example: "This opener leads with 'release engineer' not 'platform engineer' because the JD prioritizes CI/CD ownership. Most candidates will lead with a generic title — this specificity signals you read the role." For gap-framing cards: "Honesty paired with a bounded ramp story is more reassuring than fake confidence. Name what you don't know, then name the transferable pattern."

2. Delivery Coaching (warning field): Include time and tone guidance in warnings. For openers: "Keep this under 90 seconds. It's a trailer, not the movie. End on the hook ('that's what drew me to this conversation') and let them drive the next question." For gap-framing cards: "Don't fake this. If they ask a follow-up and you can't answer, the gap becomes a lie. Acknowledge honestly, bridge to your strength, and move on." For technical deep dives: "Watch the clock — if you've been talking for 3 minutes on one topic, pause and check in: 'Should I go deeper or move on?'"

3. Strategic Framing (categoryGuidance): When writing categoryGuidance, include interview-dynamic coaching based on context clues. If positioning notes suggest the company reached out first (recruiter inbound, "they contacted me", etc.), include: "They reached out to you — they already believe there's fit. This conversation is 'do I want to work with this person and can they do the job?' not 'convince me you belong here.' Be conversational, not performative." If the candidate applied cold, include: "You applied to them — you need to earn attention in the first 2 minutes. Lead with specificity: why THIS company, why THIS role, what makes you different from the 200 other applicants."

4. Named People Intel: Emit "interviewers" entries ONLY when structured pipeline entry context includes a non-empty "round.interviewers" list. Those names are user-sourced (entered from the recruiter's calendar invite) and are the exclusive authoritative source of interviewer identity. NEVER invent or guess interviewer names from company research, role patterns, LinkedIn surface, or org-chart inference — if "round.interviewers" is absent or empty, OMIT the "interviewers" field and any intel cards that would reference interviewer ids.
   When "round.interviewers" is provided, for each listed person emit BOTH of the following:
   (a) A structured "interviewers" entry at the deck level reusing the supplied id, name, title, and linkedInUrl. Populate likelyRole, coachingNote, notes, and the intel grid (role, background, stack, caresAbout, yourAngle, keyTell, linkedInPositioning, education) only from what the supplied "intel" seed or supporting research actually supports — leave a field undefined rather than invent one. Always provide a "lineThatLands" one-liner tuned to the specific concern this person will evaluate, grounded in intel.caresAbout. Shape: take one concrete thing the interviewer cares about (from intel.caresAbout) and mirror it back through a specific thing the candidate has actually done about it — reference the concern explicitly, cite the candidate's evidence, keep it to one sentence. No generic platitudes, no filler empathy language, no phrases that could be swapped between two unrelated roles and still read fine.
   (b) A dedicated card with category "situational", tag "intel", and an "interviewerIds" array containing that interviewer's id, linking the card to the structured record. Keep the card compact: the "interviewers" entry supplies the grid; the card is the deck-level anchor and can carry a "warning" (what not to do with this person) plus delivery coaching in "notes".
   For each person also infer their likely role in the interview ("SVP Product Development — likely 2 levels above the role, probably not the interviewer but may have sign-off") from supplied research only. If the supplied round has interviewers but it is unclear who will lead the conversation, add one meta-entry with "name": "", "likelyRole": "unknown", and a coachingNote beginning "If unsure who you're talking to".

4a. Structured Company Intel: Populate "companyIntel" as a concise grid derived from structured pipeline entry context, companyResearch notes, Canonical JD Analysis, and the raw job description only. Use undefined for unknown cells instead of filler. The six primary cells are whatTheyDo, scale, theRole, stack, team, and aiPosture. The aiPosture strength must be one of strong, moderate, weak, unknown and its narrative must explain the signal quality.

5. Competitive Positioning: When the candidate's skills include combinations that are market-rare or unusually valuable for this specific role, generate a notes or deepDives entry explaining WHY it's rare. Example: "GitLab admin experience is genuinely uncommon — most candidates have GitHub Actions or Jenkins. The fact that you administered the instance, not just consumed it, is a differentiator. Lean into it." Or: "The Python + C# combination is rare at production depth. Most engineers live in one ecosystem. This matters at companies with mixed stacks." Look for 2-3 such combinations per deck and call them out explicitly.
When the deck has depth gaps, make sure at least 2 cards are landmine or gap-framing cards to keep the candidate honest about risk.

Response schema:
{
  "deckTitle": "string",
  "companyResearchSummary": "optional string",
  "answerTemplate": "optional string",
  "companyIntel": {
    "whatTheyDo": "optional string",
    "scale": "optional string",
    "theRole": "optional string",
    "stack": "optional string",
    "team": "optional string",
    "aiPosture": {
      "strength": "strong|moderate|weak|unknown",
      "narrative": "string",
      "signals": ["optional string"]
    },
    "other": { "optional label": "optional string" }
  },
  "rules": ["string"],
  "donts": ["string"],
  "questionsToAsk": [{ "question": "string", "context": "string" }],
  "numbersToKnow": {
    "candidate": [{ "value": "string", "label": "string" }],
    "company": [{ "value": "string", "label": "string" }]
  },
  "stackAlignment": [
    {
      "theirTech": "string",
      "yourMatch": "string",
      "confidence": "Strong|Solid|Working knowledge|Adjacent experience|Gap"
    }
  ],
  "interviewers": [
    {
      "id": "string (stable slug; referenced by card.interviewerIds)",
      "name": "string",
      "title": "optional string",
      "linkedInUrl": "optional string",
      "likelyRole": "optional hiring-manager|above-hm|peer|skip-level|cross-functional|recruiter|unknown",
      "coachingNote": "optional string",
      "intel": {
        "role": "optional string",
        "background": "optional string",
        "stack": "optional string",
        "caresAbout": "optional string",
        "yourAngle": "optional string",
        "keyTell": "optional string",
        "linkedInPositioning": "optional string",
        "education": "optional string"
      },
      "lineThatLands": "optional string — tuned one-liner grounded in intel.caresAbout",
      "metInRounds": "optional number[]",
      "notes": "optional string"
    }
  ],
  "contextGaps": [
    {
      "id": "string",
      "section": "string",
      "question": "string",
      "why": "string",
      "feedbackTarget": "optional string",
      "priority": "required|recommended|optional"
    }
  ],
  "categoryGuidance": {
    "opener": "string",
    "behavioral": "string",
    "technical": "string",
    "project": "string",
    "metrics": "string",
    "situational": "string"
  },
  "cards": [
    {
      "category": "opener|behavioral|technical|project|metrics|situational",
      "kind": "opener|intel|story|anchor|scenario|deep-dive|closer|reference|followup-qa",
      "title": "string",
      "tags": ["string"],
      "timeBudgetMinutes": "optional number",
      "notes": "optional string",
      "script": "optional string",
      "scriptKind": "optional opener|honest-bridge|closer|line-that-lands|pivot",
      "scriptLabel": "optional string",
      "pushbackScript": "optional string",
      "pushbackLabel": "optional string",
      "alternativeTitle": "optional string",
      "alternativeScript": "optional string",
      "warning": "optional string",
      "storyBlocks": [{ "label": "problem|solution|result|closer|note", "text": "string" }],
      "storyVariants": [{ "id": "string", "label": "string", "roleContext": "optional string", "when": "optional string", "keyPoints": ["string"], "storyBlocks": [{ "label": "problem|solution|result|closer|note", "text": "string" }] }],
      "keyPoints": ["string"],
      "followUps": [{ "question": "string", "answer": "string" }],
      "deepDives": [{ "title": "string", "content": "string" }],
      "conditionals": [{ "trigger": "string", "response": "string", "tone": "pivot|trap|escalation" }],
      "metrics": [{ "value": "string", "label": "string" }],
      "interviewerIds": "optional string[] — ids from deck.interviewers this card is tuned for (intel cards should have exactly one)",
      "tableData": {
        "headers": ["string"],
        "rows": [["string"]]
      }
    }
  ]
}`

  const vectorLine =
    request.vectorLabel || request.vectorId
      ? `Target Vector: ${request.vectorLabel ?? request.vectorId} (${request.vectorId ?? ''})\n`
      : ''
  const userPrompt = `Target Company: ${request.company}
Target Role: ${request.role}
${vectorLine}Target Round Type: ${request.roundType ?? 'Not provided'}
Target Round Number: ${request.roundNumber ?? 'Not provided'}
Company URL: ${request.companyUrl ?? 'Not provided'}
Skill Match Notes: ${request.skillMatch ?? 'Not provided'}
Positioning Notes: ${request.positioning ?? 'Not provided'}
Additional Notes: ${request.notes ?? 'Not provided'}
Structured Pipeline Entry Context:
${structuredPipelineEntryContext ? JSON.stringify(structuredPipelineEntryContext, null, 2) : 'Not provided'}

Company Research Notes: ${request.companyResearch ?? 'Not provided'}

Prep Stack Alignment Confidence Mapping:
${formatPrepSkillDepthConfidenceGuidance()}

Canonical JD Analysis:
${formatJdAnalysisForPrompt(candidateJdAnalysis)}

Original Job Description Source Text:
${request.jobDescription}

Structured Identity Context:
${structuredIdentityContext ? JSON.stringify(structuredIdentityContext, null, 2) : 'Not provided'}

Candidate Metrics From Identity:
${candidateMetrics ? JSON.stringify(candidateMetrics, null, 2) : 'Not provided'}

Additional Candidate Metrics Outside The Vector Slice:
${fallbackCandidateMetrics ? JSON.stringify(fallbackCandidateMetrics, null, 2) : 'Not provided'}

Existing Context Gaps:
${request.contextGaps ? JSON.stringify(request.contextGaps, null, 2) : 'Not provided'}

Context Gap Answers:
${request.contextGapAnswers ? JSON.stringify(request.contextGapAnswers, null, 2) : 'Not provided'}

Prior Round Debriefs:
${request.priorRoundDebriefs ? JSON.stringify(request.priorRoundDebriefs, null, 2) : 'Not provided'}

Prior Round Card State:
${priorRoundCardContext ? JSON.stringify(priorRoundCardContext, null, 2) : 'Not provided'}

Detected Round Contradictions:
${roundContradictions ? JSON.stringify(roundContradictions, null, 2) : 'Not provided'}

Tailored Resume Context:
${JSON.stringify(request.resumeContext, null, 2)}

When structured identity context is provided, use it as the source of truth for candidate evidence and fall back to the tailored resume context only for missing details.
When structured pipeline entry context is provided, use it as the source of truth for company, process, and interviewer intel before falling back to freeform companyResearch notes.
Use Canonical JD Analysis as the source of truth for role requirements, skill matches, strengths, gaps, watch-outs, priorities, avoid triggers, and positioning. The Canonical JD Analysis block is already projected to audience "candidate"; do not recover or infer recruiter-only or internal-only material from omitted fields. Do not re-infer the job analysis from Original Job Description Source Text; use that raw text only for source wording, quote-level context, and company numbers when the canonical analysis omits a detail.
If structured pipeline entry context includes a round.interviewers list, those are the exact user-supplied panel members; use them for named-person intel cards, likely-interviewer framing, and sharper questions-to-ask. If the list is absent, emit no interviewer names at all.
Do not claim named-person intel unless it is grounded in a user-supplied round.interviewers entry and corroborated by the provided structured pipeline entry context or companyResearch notes.
Translate structured metadata into natural coaching language. Never surface raw field-style phrasing like "no inbound signal noted", "app method", or "response status" in the generated copy.
Use structured identity bullets to map problem -> problem, action -> solution, and outcome/impact -> result story blocks on behavioral and project cards whenever possible.
Request 3 to 5 keyPoints for every card so the live cheatsheet has glance bullets.
When the round includes scenario questions or technical/system-design content, generate an answerTemplate at the deck level: a reusable 5-step drill framework for "How would you..." questions. Otherwise, omit answerTemplate. For technical, system-design, or architecture-heavy rounds, aim for 5 to 8 situational drill cards that follow the template; for behavioral, hiring-manager, recruiter, or general rounds, aim for 2 to 3. Each drill should use category "situational", a scenario-question title, a full script that follows the template, keyPoints as the concrete steps, and details/storyBlocks only when they add useful depth.
For opener cards, make keyPoints a beat sheet: ordered fallback cues that follow the candidate's through-line and the target role connection. Keep each cue around 8 words and do not prefix items with ordinals, bullets, or labels. Example: "Anchor identity in platform reliability"
For all non-opener cards, including landmine and intel-tag people cards, make keyPoints glance points: compact noun-phrase bullets for recall, not alternate scripts or full sentences. Keep each glance point around 10 words. Example: "38% incident reduction"
Build both beat sheets and glance points from Canonical JD Analysis requirements and evidenceMapping plus structured identity evidence. Do not infer keyPoints directly from Original Job Description Source Text except for source wording when canonical analysis omits a detail.
For cards that need a backup narrative, add alternativeTitle and alternativeScript only when Canonical JD Analysis evidenceMapping.topBullets or evidenceMapping.topProjects plus advantages show a second credible identity story for the same matched requirement. The alternative must use different canonical evidence than the primary script, be framed as a backup narrative, and stay grounded in structured identity evidence. Do not create alternatives by re-ranking roles or projects from Original Job Description Source Text.
Generate dedicated opener cards for the predictable opening questions instead of a single generic opener bucket.
- Always include a "Tell me about yourself" opener card. If identity context is too thin for a trustworthy script, use [[fill-in: your through-line]] instead of inventing one.
- When the union of distinct sourceLabel values across Canonical JD Analysis evidenceMapping.topProjects and evidenceMapping.topBullets has 3 or more role contexts matched to requirements, make the "Tell me about yourself" opener a 3-act career arc. Use storyBlocks with one "note" thesis, three "solution" act blocks with role context and the strongest canonical evidence from each role, and one "closer" tying the arc back to the target role. Seed the through-line from Canonical JD Analysis strengthsToLead. Use keyPoints as one beat per act plus the closer, around 8 words each. Keep the opener closer around 20 words and grounded in canonical evidence. Do not re-rank roles from Original Job Description Source Text. Otherwise, keep the standard single-role opener.
- Always include a "Why this role/company?" opener card grounded in the job description and company research. If the motivation proof is thin, use [[needs-review]] or [[fill-in: why this company now]] instead of guessing.
  - Include a "Why did you leave your last role?" opener card when departure context is available in structured identity context or contextGapAnswers.
  - When departure context is missing but the answer matters, add a contextGap for identity.departureContext or use a [[fill-in: your departure reason]] placeholder in that opener instead of inventing a reason.
  - Title opener cards clearly so they can render as standalone live sections, keep each opener script to roughly 75 seconds with a 2 minute answer budget, and set scriptKind to "opener" when an opener card has a script.
  - Generate 3 to 5 landmine cards tagged "landmine" that capture predicted traps, risky follow-ups, and places the candidate may overclaim or go generic. Keep them concise, specific, and grounded in the supplied evidence.
  - Preserve the existing intel-tag people cards; do not reclassify named-person intel as landmines.
  - Add timeBudgetMinutes to every card so live mode can track section budgets. Use realistic interview timing: openers 1.5 to 2 minutes, behavioral/project answers 2 to 3 minutes, technical answers 3 to 5 minutes, situational answers 2 to 3 minutes, and metrics/reference answers 1 to 2 minutes.
If a card has a script, also provide a short scriptLabel such as "Say This", "Lead With", or "The One-Liner". Also provide scriptKind as the structural role: "opener" for opening scripts, "honest-bridge" for gap-framing scripts, "closer" for closing/takeaway scripts, "line-that-lands" for interviewer-tuned one-liners, and "pivot" for transition/reframe scripts. scriptLabel is prose for the user; scriptKind is the enum for rendering.
For behavioral and project cards with storyBlocks:
- Add exactly one storyBlocks entry with label "closer" after problem/solution/result; this closer is the quotable one-sentence takeaway.
- Keep the closer at 20 words or fewer and reference a specific system, metric, decision, or candidate evidence.
- Anchor the closer in Canonical JD Analysis strengthsToLead and positioningRecommendations plus structured candidate evidence from identity bullets, candidate metrics, and skillMatches; do not derive it by raw-job re-inference.
- Only use scriptLabel "The One-Liner" when the card script itself is the standalone takeaway instead of a full answer.
- Set scriptKind to "line-that-lands" when the script is a one-liner takeaway, and to "closer" when the script is an end-of-section closing answer.
- Keep every one-liner concrete, role-specific, and evidence-backed, never generic motivational copy.
For behavioral cards where Canonical JD Analysis evidenceMapping shows multiple credible stories for the same question, add storyVariants with 2 to 3 options instead of forcing every story into the top-level storyBlocks. The first storyVariants entry is the primary/default. Give each variant a concise label, optional roleContext, optional when guidance, its own storyBlocks, and optional keyPoints. If only one credible story exists, omit storyVariants and use storyBlocks.
For opener, behavioral, and situational cards, include conditionals when there is likely interviewer pushback, skepticism, or a risky follow-up. Use trigger for the push, response for the coached pivot or answer, and tone to mark pivot, trap, or escalation moments.
For cards where the first script intentionally stays concise or omits deeper context, add pushbackScript as the full expanded same-question answer the candidate should give only if the interviewer presses for more detail. Use this for why-leaving, failure, nuanced motivation, and technical gap-framing cards. pushbackScript must be honest, more specific than the primary script, and not evasive; pushbackLabel defaults to "If they push" unless a more precise label helps. Do not use pushbackScript for short Q&A follow-ups; those belong in conditionals.
For gotcha questions or misleading framing, use tone "trap" and write the response as the reframe the candidate should deliver.
Return 3 to 5 deck-level rules as imperative one-liners in the rules array. These should sound like live commands or hard reminders, not passive coaching prose. Tailor them to the round type, application method, round stage, and any inbound versus cold-apply signals in the provided context.
Return 5 to 8 personalized donts at the deck level, 3 to 5 questionsToAsk with coaching context, and categoryGuidance keyed by the prep category names.
When candidate metrics are provided, use them as the primary source for numbersToKnow.candidate. You may curate, sort, relabel, or lightly format their values for readability, but you must not invent new candidate numbers.
When additional candidate metrics outside the vector slice are provided, treat them as truthful supporting proof for openers, resume-level headline positioning, or gap-avoidance when they clearly strengthen the answer. Do not let them override the target vector framing for the rest of the deck.
Use numbersToKnow.company only for numbers grounded in the supplied job description or company research.
When structured identity context includes bullet metrics, use those exact metrics for numbers-oriented cards instead of inventing new figures.
When structured identity context includes skill enrichment or Canonical JD Analysis skillMatches include prepStackConfidence, compare the JD technologies against those identity-backed skills and return a stackAlignment table with honest confidence levels, including "Gap" where the evidence is missing.
Use the Prep Stack Alignment Confidence Mapping as the source of truth for stackAlignment.confidence. When a Canonical JD Analysis skillMatch includes prepStackConfidence, treat that value as a hard ceiling for the matching technology: identity context may justify the same or lower confidence, but never a higher confidence.
Use exact Canonical JD Analysis skillName labels for stackAlignment.theirTech when a row corresponds to a listed skillMatch.
Use "yourMatch" to describe the closest truthful candidate evidence or positioning, not a restatement of the JD requirement.
If no identity skill context is available, omit stackAlignment instead of guessing.
When stackAlignment includes entries with confidence "Gap" or "Adjacent experience", generate 1 to 2 technical gap-framing cards titled like "What you know, what you don't: <tech>".
Mark those cards with the tag "gap-framing" and keep them in category "technical".
For each gap-framing card:
- put the honest acknowledgment in notes
- put the bridge language in script
- set scriptKind to "honest-bridge"
- put the pitfall in warning
- put 3 to 4 transferable-experience bullets in keyPoints, grounded in the actual "yourMatch" evidence
Do not generate gap-framing cards when stackAlignment contains only Strong, Solid, or Working knowledge entries.
If a round type is provided, adapt the emphasis and category guidance to that interview round.
If round-aware prep context is provided:
- Treat priorRoundDebriefs as source-of-truth interviewer intel for the next round. Refresh rules, questionsToAsk, and categoryGuidance to reflect what the team actually cared about.
- Treat priorRoundCards plus perRoundState as evidence about which stories worked, fumbled, or still need practice. Cards with latest status "fumbled" should come back with obvious remediation framing in notes, warning, or script.
- Cards with latest status "practice-this" should remain in the next-round deck and keep the tag "practice-this" so the live deck can spotlight them.
- If prior debrief intel names a top challenge, team culture cue, AI usage note, or security posture detail, let that reshape the deck-level rules rather than leaving the rules generic.
- If contradiction flags are provided, surface the contradiction explicitly in notes or context gaps instead of silently pretending the evidence agrees.
If the source material is missing context for a useful answer, do not hide the gap.
- Prefix the affected field with [[needs-review]] when you can make a cautious inference that should be verified.
- Prefix the affected field with [[fill-in: short prompt]] when the answer needs a user-supplied detail before it is trustworthy.
- Add a contextGaps entry whenever more upstream context would materially improve the prep content.
- If contextGapAnswers are provided, treat them as authoritative supplemental context and refresh the affected sections before carrying any gap forward.
- If an existing context gap remains relevant after regeneration, preserve its id so user answers stay attached to that prompt.

Wrap your final JSON output with <result> and </result> tags on their own lines.
Any reasoning or narrative may appear outside these tags — parsers look only inside
the tags for the structured result. Example:

<result>
{ "deckTitle": "...", "cards": [ ... ] }
</result>

Return JSON only (inside the tags).`

  const rawResponse = await callLlmProxy(endpoint, systemPrompt, userPrompt, {
    feature: 'prep.generate',
    model: PREP_MODEL,
    timeoutMs: PREP_TIMEOUT_MS,
    maxTokens: PREP_MAX_TOKENS,
  })

  let parsed: PrepGenerationPayload
  try {
    const extraction = extractJsonBlock(rawResponse)
    const parsedResult = parseJsonWithRepair<PrepGenerationPayload>(
      extraction,
      'Interview prep response',
    ).data
    if (!parsedResult || typeof parsedResult !== 'object' || Array.isArray(parsedResult)) {
      throw new Error('Interview prep response must be a JSON object.')
    }
    parsed = parsedResult
  } catch (error) {
    if (error instanceof JsonExtractionError) throw error
    const parseMessage = error instanceof Error ? error.message : String(error)
    const responseLength = rawResponse.length
    const head = rawResponse.slice(0, 500)
    const tail = responseLength > 500 ? rawResponse.slice(-500) : ''
    console.warn('[prepGenerator] JSON.parse failed after extraction', {
      parseMessage,
      responseLength,
      head,
      tail,
    })
    throw new Error(`Failed to parse interview prep response: ${parseMessage}`)
  }

  const stackAlignment = applyStackAlignmentConfidenceCeilings(
    normalizeStackAlignment(parsed.stackAlignment),
    candidateJdAnalysis,
  )
  const companyIntel = normalizeCompanyIntel(parsed.companyIntel)
  const generatedCards = normalizeCards(Array.isArray(parsed.cards) ? parsed.cards : [])
  const contextGaps = normalizeContextGaps(parsed.contextGaps)
  const categoryGuidance = normalizeCategoryGuidance(parsed.categoryGuidance)
  const contractViolations = validatePrepGenerationContract({
    deck: {
      title: isString(parsed.deckTitle) ? parsed.deckTitle.trim() : '',
      rules: normalizeStringList(parsed.rules),
      cards: generatedCards,
      stackAlignment,
      categoryGuidance,
      contextGaps,
    },
    generatedCards,
    hasParsedCards: Array.isArray(parsed.cards),
    rawCards: parsed.cards,
    request,
  })
  logPrepContractViolations(request, contractViolations)
  const cards = ensureRoundAwareRemediationCards(
    ensureLandmineCards(
      ensureGapFramingCards(generatedCards, stackAlignment),
      request,
      stackAlignment,
      candidateMetrics,
      fallbackCandidateMetrics,
    ),
    request,
  )
  if (!isString(parsed.deckTitle) || cards.length === 0) {
    throw new Error('Interview prep response schema was invalid.')
  }

  const now = new Date().toISOString()
  // Gate: interviewers only flow onto the deck when the request targeted a
  // specific round with at least one user-supplied name. If the round has no
  // interviewers (or no round was targeted), the AI may still have emitted
  // speculative records — drop them at this boundary rather than trust them.
  const roundHasInterviewers = readRoundInterviewers(request.pipelineEntryContext).length > 0
  const deck: PrepDeck = {
    id: createId('prep-deck'),
    title: parsed.deckTitle.trim(),
    company: request.company,
    role: request.role,
    vectorId: request.vectorId,
    pipelineEntryId: null,
    pipelineRoundId: request.pipelineRoundId ?? null,
    companyUrl: request.companyUrl,
    skillMatch: request.skillMatch,
    positioning: request.positioning,
    roundType: request.roundType,
    notes: request.notes,
    answerTemplate: normalizePrepAnswerTemplate(parsed.answerTemplate),
    companyResearch: request.companyResearch,
    companyIntel,
    interviewers: roundHasInterviewers ? normalizeInterviewers(parsed.interviewers) : undefined,
    jobDescription: request.jobDescription,
    jdAnalysisId: request.jdAnalysis.id,
    jdAnalysisGeneratedAt: request.jdAnalysis.generatedAt,
    jdAnalysisModelVersion: request.jdAnalysis.modelVersion,
    jdTextHash: request.jdAnalysis.jdTextHash,
    rules: normalizeStringList(parsed.rules),
    donts: normalizeStringList(parsed.donts),
    questionsToAsk: normalizeQuestionsToAsk(parsed.questionsToAsk),
    numbersToKnow: normalizeNumbersToKnow(parsed.numbersToKnow),
    stackAlignment,
    categoryGuidance,
    contextGaps,
    contextGapAnswers: request.contextGapAnswers,
    roundNumber: request.roundNumber,
    roundDebriefs: request.priorRoundDebriefs,
    generatedAt: now,
    updatedAt: now,
    cards,
  }

  const generatedPrepResult: PrepInterviewPrepResult = {
    deckTitle: deck.title,
    companyResearchSummary: isString(parsed.companyResearchSummary)
      ? parsed.companyResearchSummary.trim()
      : '',
    answerTemplate:
      hasOwnAnswerTemplate(parsed) && !deck.answerTemplate ? null : deck.answerTemplate,
    rules: deck.rules,
    donts: deck.donts,
    questionsToAsk: deck.questionsToAsk,
    numbersToKnow: deck.numbersToKnow,
    stackAlignment: deck.stackAlignment,
    contextGaps: deck.contextGaps,
    categoryGuidance: deck.categoryGuidance as Partial<Record<PrepCategory, string>> | undefined,
    cards: deck.cards,
    deck,
    contractViolations,
  }

  return generatedPrepResult
}

export async function generatePrepDeck(
  endpoint: string,
  request: PrepGenerationRequest,
): Promise<PrepGenerationResult> {
  const result = await generateInterviewPrep(endpoint, request)

  return {
    deck: result.deck,
    companyResearchSummary: result.companyResearchSummary,
    contractViolations: result.contractViolations,
  }
}
