import {
  PREP_CATEGORY_VALUES,
  PREP_CONTEXT_GAP_PRIORITY_VALUES,
  PREP_CONDITIONAL_TONE_VALUES,
  PREP_STORY_BLOCK_LABEL_VALUES,
} from '../types/prep'
import type {
  PrepCard,
  PrepCategory,
  PrepConditional,
  PrepContextGap,
  PrepContextGapPriority,
  PrepConditionalTone,
  PrepGenerationRequest,
  PrepIdentityMetricCandidate,
  PrepMetric,
  PrepNumbersToKnow,
  PrepPipelineResearchPersonContext,
  PrepPipelineEntryContext,
  PrepQuestionToAsk,
  PrepStackAlignmentConfidence,
  PrepStackAlignmentRow,
  PrepStoryBlock,
  PrepStoryBlockLabel,
} from '../types/prep'
import { createId, slugify } from './idUtils'
import { parseJsonWithRepair } from './jsonParsing'
import {
  callLlmProxy,
  extractJsonBlock,
  JsonExtractionError,
  isString,
} from './llmProxy'

/** Model used for interview prep — needs creative, detailed output. */
const PREP_MODEL = 'sonnet'
const PREP_TIMEOUT_MS = 240000
/**
 * Output budget for prep decks. 4096 (proxy default) truncates decks with
 * 8+ cards mid-array; 8192 gives comfortable headroom. Requires proxy-side
 * `MAX_REQUEST_TOKENS >= 8192` — otherwise the proxy silently clamps.
 */
const PREP_MAX_TOKENS = 8192

interface PrepGenerationPayload {
  deckTitle: string
  companyResearchSummary?: string
  donts?: string[]
  questionsToAsk?: PrepQuestionToAsk[]
  numbersToKnow?: PrepNumbersToKnow
  stackAlignment?: PrepStackAlignmentRow[]
  categoryGuidance?: Record<string, string>
  contextGaps?: PrepContextGap[]
  cards: Array<Omit<PrepCard, 'id'>>
}

const PREP_PIPELINE_PEOPLE_GAP_ID = 'prep-gap-pipeline-people-intel'
const PREP_PIPELINE_PEOPLE_GAP_SECTION = 'People intel'
const PREP_PIPELINE_PEOPLE_GAP_QUESTION =
  'List the people you have identified so far for this process: interviewers, the hiring manager, or anyone influencing the decision.'

const STACK_ALIGNMENT_CONFIDENCE_ALIASES: Record<
  PrepStackAlignmentConfidence,
  readonly string[]
> = {
  Strong: ['strong'],
  Solid: ['solid'],
  'Working knowledge': [
    'working knowledge',
    'working-knowledge',
    'working',
    'familiar',
  ],
  'Adjacent experience': [
    'adjacent experience',
    'adjacent-experience',
    'adjacent',
    'transferable',
  ],
  Gap: ['gap', 'missing', 'none'],
}

const GAP_FRAMING_CONFIDENCE_ORDER: Record<
  PrepStackAlignmentConfidence,
  number
> = {
  Gap: 0,
  'Adjacent experience': 1,
  'Working knowledge': 2,
  Solid: 3,
  Strong: 4,
}

const STORY_BLOCK_LABEL_ALIASES: Array<[PrepStoryBlockLabel, string[]]> = [
  [
    'problem',
    ['problem', 'problem statement', 'challenge', 'context', 'situation'],
  ],
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

function normalizeNumbersToKnow(value: unknown): PrepNumbersToKnow | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return undefined
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

function normalizeStackAlignment(
  value: unknown,
): PrepStackAlignmentRow[] | undefined {
  if (!Array.isArray(value)) return undefined
  const seenTech = new Set<string>()
  const rows = value
    .flatMap((entry) => {
      if (!entry || typeof entry !== 'object') return []
      const record = entry as Record<string, unknown>
      const theirTech = isString(record.theirTech)
        ? record.theirTech.trim()
        : ''
      const yourMatch = isString(record.yourMatch)
        ? record.yourMatch.trim()
        : ''
      const confidence = normalizeStackAlignmentConfidence(record.confidence)
      const normalizedTech = theirTech.toLowerCase()
      if (
        !theirTech ||
        !yourMatch ||
        !confidence ||
        seenTech.has(normalizedTech)
      ) {
        return []
      }
      seenTech.add(normalizedTech)
      return theirTech && yourMatch && confidence
        ? [{ theirTech, yourMatch, confidence }]
        : []
    })
    .slice(0, 20)
  return rows.length > 0 ? rows : undefined
}

function normalizeStoryBlockLabel(
  value: unknown,
): PrepStoryBlockLabel | undefined {
  if (!isString(value)) return undefined
  const normalized = value.trim().toLowerCase()
  if (!normalized) return undefined
  if (
    (PREP_STORY_BLOCK_LABEL_VALUES as readonly string[]).includes(normalized)
  ) {
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

function readPipelineResearchPeople(
  value: PrepPipelineEntryContext | undefined,
): PrepPipelineResearchPersonContext[] | undefined {
  return value?.research?.people
}

function buildPipelinePeopleGapId(request: PrepGenerationRequest): string {
  const pipelineContext = request.pipelineEntryContext
  if (!pipelineContext) return PREP_PIPELINE_PEOPLE_GAP_ID

  const slugSource = [
    pipelineContext.company,
    pipelineContext.role,
    pipelineContext.url,
  ]
    .filter(Boolean)
    .join('-')

  return slugSource
    ? `${PREP_PIPELINE_PEOPLE_GAP_ID}-${slugify(slugSource)}`
    : PREP_PIPELINE_PEOPLE_GAP_ID
}

function buildLegacyPipelinePeopleGapIds(request: PrepGenerationRequest): string[] {
  const pipelineContext = request.pipelineEntryContext
  if (!pipelineContext) return ['pipeline-people']

  const slugSource = [
    pipelineContext.company,
    pipelineContext.role,
    pipelineContext.url,
  ]
    .filter(Boolean)
    .join('-')

  return [
    'pipeline-people',
    slugSource ? `${PREP_PIPELINE_PEOPLE_GAP_ID}-${slugify(slugSource)}` : PREP_PIPELINE_PEOPLE_GAP_ID,
  ]
}

function isPipelinePeopleGap(gap: PrepContextGap): boolean {
  return (
    gap.feedbackTarget === 'pipeline.research.people' ||
    gap.id === PREP_PIPELINE_PEOPLE_GAP_ID ||
    (
      gap.section.trim().toLowerCase() === PREP_PIPELINE_PEOPLE_GAP_SECTION.toLowerCase() &&
      gap.question.trim().toLowerCase() === PREP_PIPELINE_PEOPLE_GAP_QUESTION.toLowerCase()
    )
  )
}

function normalizePipelinePeopleGap(gap: PrepContextGap, gapId: string): PrepContextGap {
  if (!isPipelinePeopleGap(gap)) return gap

  return {
    ...gap,
    id: gapId,
    section: PREP_PIPELINE_PEOPLE_GAP_SECTION,
    question: PREP_PIPELINE_PEOPLE_GAP_QUESTION,
    feedbackTarget: 'pipeline.research.people',
    priority: gap.priority,
  }
}

function ensurePipelineResearchContextGaps(
  contextGaps: PrepContextGap[] | undefined,
  request: PrepGenerationRequest,
): PrepContextGap[] | undefined {
  if (!request.pipelineEntryContext) {
    return contextGaps
  }

  const rawExistingGaps = contextGaps ?? []
  const pipelinePeopleGapId = buildPipelinePeopleGapId(request)
  const existingGaps = rawExistingGaps.map((gap) => normalizePipelinePeopleGap(gap, pipelinePeopleGapId))
  const hasPipelinePeopleGap = existingGaps.some((gap) => isPipelinePeopleGap(gap))
  const pipelinePeopleGapIds = new Set(
    existingGaps
      .filter((gap) => isPipelinePeopleGap(gap))
      .map((gap) => gap.id)
      .filter((gapId) => gapId.trim().length > 0),
  )
  pipelinePeopleGapIds.add(pipelinePeopleGapId)
  for (const legacyGapId of buildLegacyPipelinePeopleGapIds(request)) {
    pipelinePeopleGapIds.add(legacyGapId)
  }
  for (const rawGap of rawExistingGaps) {
    if (isPipelinePeopleGap(rawGap)) {
      pipelinePeopleGapIds.add(rawGap.id)
    }
  }
  const hasAnsweredPipelinePeopleGap = [...pipelinePeopleGapIds].some((gapId) => Boolean(request.contextGapAnswers?.[gapId]?.trim()))

  if (hasPipelinePeopleGap || hasAnsweredPipelinePeopleGap) {
    return existingGaps.length > 0 ? existingGaps : undefined
  }

  const pipelinePeople = readPipelineResearchPeople(request.pipelineEntryContext)
  if (pipelinePeople && pipelinePeople.length > 0) {
    return existingGaps.length > 0 ? existingGaps : undefined
  }

  return [
    ...existingGaps,
    {
      id: pipelinePeopleGapId,
      section: PREP_PIPELINE_PEOPLE_GAP_SECTION,
      question: PREP_PIPELINE_PEOPLE_GAP_QUESTION,
      why:
        'Named people let the prep tailor framing and questions to who is actually in the room.',
      feedbackTarget: 'pipeline.research.people',
      priority: 'required',
    },
  ]
}

// Identity context is produced in-process by buildPrepIdentityContext, so array shape is trusted here.
function readIdentityMetricCandidates(
  value: PrepGenerationRequest['identityContext'],
  key: 'candidate_metrics' | 'fallback_candidate_metrics',
): PrepIdentityMetricCandidate[] | undefined {
  const candidate = value?.[key]
  return Array.isArray(candidate)
    ? (candidate as PrepIdentityMetricCandidate[])
    : undefined
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

function normalizeQuestionsToAsk(
  value: unknown,
): PrepQuestionToAsk[] | undefined {
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
  return PREP_CONTEXT_GAP_PRIORITY_VALUES.includes(
    normalized as PrepContextGapPriority,
  )
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
    const feedbackTarget = isString(record.feedbackTarget)
      ? record.feedbackTarget.trim()
      : ''
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

function normalizeConditionalTone(
  value: unknown,
): PrepConditionalTone | undefined {
  if (!isString(value)) return undefined
  const normalized = value.trim().toLowerCase()
  return PREP_CONDITIONAL_TONE_VALUES.includes(
    normalized as PrepConditionalTone,
  )
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

function normalizeCategoryGuidance(
  value: unknown,
): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return undefined
  const entries = Object.entries(value as Record<string, unknown>).flatMap(
    ([key, guidance]) => {
      const normalizedKey = key.trim()
      const normalizedGuidance = isString(guidance) ? guidance.trim() : ''
      return normalizedKey &&
        normalizedGuidance &&
        (PREP_CATEGORY_VALUES as readonly string[]).includes(normalizedKey)
        ? [[normalizedKey, normalizedGuidance] as const]
        : []
    },
  )

  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

function normalizeCards(cards: unknown[]): PrepCard[] {
  return cards.flatMap((card) => {
    if (!card || typeof card !== 'object') return []
    const record = card as Record<string, unknown>
    if (!isString(record.title) || !isString(record.category)) return []
    if (
      !(PREP_CATEGORY_VALUES as readonly string[]).includes(record.category)
    ) {
      return []
    }
    const category = record.category as PrepCategory

    const tags = Array.isArray(record.tags)
      ? record.tags
          .filter(isString)
          .map((tag) => tag.trim())
          .filter(Boolean)
      : []

    return [
      {
        id: createId('prep-card'),
        category,
        title: record.title.trim(),
        tags,
        notes: isString(record.notes) ? record.notes.trim() : undefined,
        script: isString(record.script) ? record.script.trim() : undefined,
        scriptLabel: isString(record.scriptLabel)
          ? record.scriptLabel.trim() || undefined
          : undefined,
        warning: isString(record.warning) ? record.warning.trim() : undefined,
        storyBlocks: normalizeStoryBlocks(record.storyBlocks),
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
                headers: Array.isArray(
                  (record.tableData as { headers?: unknown[] }).headers,
                )
                  ? ((
                      record.tableData as { headers: unknown[] }
                    ).headers.filter(isString) as string[])
                  : [],
                rows: Array.isArray(
                  (record.tableData as { rows?: unknown[] }).rows,
                )
                  ? (record.tableData as { rows: unknown[] }).rows.flatMap(
                      (row) =>
                        Array.isArray(row) && row.every(isString) ? [row] : [],
                    )
                  : [],
              }
            : undefined,
        source: 'ai',
      },
    ]
  })
}

function isGapFramingCard(card: Pick<PrepCard, 'tags'>): boolean {
  return card.tags.some((tag) => tag.trim().toLowerCase() === 'gap-framing')
}

function buildGapFramingFallbackCards(
  stackAlignment: PrepStackAlignmentRow[] | undefined,
): PrepCard[] {
  if (!stackAlignment) return []

  const rows = stackAlignment
    .filter(
      (row) =>
        row.confidence === 'Gap' || row.confidence === 'Adjacent experience',
    )
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
    const techTag =
      slugify(row.theirTech) || slugify(row.yourMatch) || `gap-${index + 1}`
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
      title: `What you know, what you don't: ${row.theirTech}`,
      tags: Array.from(
        new Set(['gap-framing', 'transferable-experience', techTag]),
      ),
      notes: acknowledgement,
      scriptLabel: 'Bridge This Gap',
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
    isGapFramingCard(card)
      ? {
          ...card,
          category: 'technical' as const,
          tags: Array.from(
            new Set([
              ...card.tags.filter(
                (tag) => tag.trim().toLowerCase() !== 'gap-framing',
              ),
              'gap-framing',
            ]),
          ),
        }
      : card,
  )

  if (normalizedCards.some((card) => isGapFramingCard(card))) {
    return normalizedCards
  }

  return [...normalizedCards, ...buildGapFramingFallbackCards(stackAlignment)]
}

export async function generateInterviewPrep(
  endpoint: string,
  request: PrepGenerationRequest,
): Promise<{
  deckTitle: string
  companyResearchSummary: string
  donts?: string[]
  questionsToAsk?: PrepQuestionToAsk[]
  numbersToKnow?: PrepNumbersToKnow
  stackAlignment?: PrepStackAlignmentRow[]
  categoryGuidance?: Partial<Record<PrepCategory, string>>
  contextGaps?: PrepContextGap[]
  cards: PrepCard[]
}> {
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

4. Named People Intel: When companyResearch mentions specific people by name and title, generate a dedicated card with category "situational" and tag "intel" that structures their information. For each person, infer their likely role in the interview: "SVP Product Development — likely 2 levels above the role, probably not the interviewer but may have sign-off" or "Sr. Director Engineering — most likely the hiring manager for this role." If the hiring manager or interviewer is identified, add dynamic coaching: "This person likely cares about X based on their title. Frame your answers accordingly."

5. Competitive Positioning: When the candidate's skills include combinations that are market-rare or unusually valuable for this specific role, generate a notes or deepDives entry explaining WHY it's rare. Example: "GitLab admin experience is genuinely uncommon — most candidates have GitHub Actions or Jenkins. The fact that you administered the instance, not just consumed it, is a differentiator. Lean into it." Or: "The Python + C# combination is rare at production depth. Most engineers live in one ecosystem. This matters at companies with mixed stacks." Look for 2-3 such combinations per deck and call them out explicitly.

Response schema:
{
  "deckTitle": "string",
  "companyResearchSummary": "optional string",
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
      "title": "string",
      "tags": ["string"],
      "notes": "optional string",
      "script": "optional string",
      "scriptLabel": "optional string",
      "warning": "optional string",
      "storyBlocks": [{ "label": "problem|solution|result|closer|note", "text": "string" }],
      "keyPoints": ["string"],
      "followUps": [{ "question": "string", "answer": "string" }],
      "deepDives": [{ "title": "string", "content": "string" }],
      "conditionals": [{ "trigger": "string", "response": "string", "tone": "pivot|trap|escalation" }],
      "metrics": [{ "value": "string", "label": "string" }],
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
Company URL: ${request.companyUrl ?? 'Not provided'}
Skill Match Notes: ${request.skillMatch ?? 'Not provided'}
Positioning Notes: ${request.positioning ?? 'Not provided'}
Additional Notes: ${request.notes ?? 'Not provided'}
Structured Pipeline Entry Context:
${structuredPipelineEntryContext ? JSON.stringify(structuredPipelineEntryContext, null, 2) : 'Not provided'}

Company Research Notes: ${request.companyResearch ?? 'Not provided'}

Job Description:
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

Tailored Resume Context:
${JSON.stringify(request.resumeContext, null, 2)}

When structured identity context is provided, use it as the source of truth for candidate evidence and fall back to the tailored resume context only for missing details.
When structured pipeline entry context is provided, use it as the source of truth for company, process, and interviewer intel before falling back to freeform companyResearch notes.
If structured pipeline entry context includes researched people, use them for named-person intel cards, likely-interviewer framing, and sharper questions-to-ask.
Do not claim named-person intel unless it is grounded in the provided structured pipeline entry context or companyResearch notes.
Translate structured metadata into natural coaching language. Never surface raw field-style phrasing like "no inbound signal noted", "app method", or "response status" in the generated copy.
Use structured identity bullets to map problem -> problem, action -> solution, and outcome/impact -> result story blocks on behavioral and project cards whenever possible.
Request 3 to 5 keyPoints for every card so the live cheatsheet has glance bullets.
Generate dedicated opener cards for the predictable opening questions instead of a single generic opener bucket.
- Always include a "Tell me about yourself" opener card. If identity context is too thin for a trustworthy script, use [[fill-in: your through-line]] instead of inventing one.
- Always include a "Why this role/company?" opener card grounded in the job description and company research. If the motivation proof is thin, use [[needs-review]] or [[fill-in: why this company now]] instead of guessing.
- Include a "Why did you leave your last role?" opener card when departure context is available in structured identity context or contextGapAnswers.
- When departure context is missing but the answer matters, add a contextGap for identity.departureContext or use a [[fill-in: your departure reason]] placeholder in that opener instead of inventing a reason.
- Title opener cards clearly so they can render as standalone live sections, and keep each opener script to roughly 75 seconds with a 2 minute answer budget.
If a card has a script, also provide a short scriptLabel such as "Say This", "Lead With", or "The One-Liner".
For opener, behavioral, and situational cards, include conditionals when there is likely interviewer pushback, skepticism, or a risky follow-up. Use trigger for the push, response for the coached pivot or answer, and tone to mark pivot, trap, or escalation moments.
For gotcha questions or misleading framing, use tone "trap" and write the response as the reframe the candidate should deliver.
Return 5 to 8 personalized donts at the deck level, 3 to 5 questionsToAsk with coaching context, and categoryGuidance keyed by the prep category names.
When candidate metrics are provided, use them as the primary source for numbersToKnow.candidate. You may curate, sort, relabel, or lightly format their values for readability, but you must not invent new candidate numbers.
When additional candidate metrics outside the vector slice are provided, treat them as truthful supporting proof for openers, resume-level headline positioning, or gap-avoidance when they clearly strengthen the answer. Do not let them override the target vector framing for the rest of the deck.
Use numbersToKnow.company only for numbers grounded in the supplied job description or company research.
When structured identity context includes bullet metrics, use those exact metrics for numbers-oriented cards instead of inventing new figures.
When structured identity context includes skill enrichment or skill groups, compare the JD technologies against those identity skills and return a stackAlignment table with honest confidence levels, including "Gap" where the evidence is missing.
Use "yourMatch" to describe the closest truthful candidate evidence or positioning, not a restatement of the JD requirement.
If no identity skill context is available, omit stackAlignment instead of guessing.
When stackAlignment includes entries with confidence "Gap" or "Adjacent experience", generate 1 to 2 technical gap-framing cards titled like "What you know, what you don't: <tech>".
Mark those cards with the tag "gap-framing" and keep them in category "technical".
For each gap-framing card:
- put the honest acknowledgment in notes
- put the bridge language in script
- put the pitfall in warning
- put 3 to 4 transferable-experience bullets in keyPoints, grounded in the actual "yourMatch" evidence
Do not generate gap-framing cards when stackAlignment contains only Strong, Solid, or Working knowledge entries.
If a round type is provided, adapt the emphasis and category guidance to that interview round.
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
    if (
      !parsedResult ||
      typeof parsedResult !== 'object' ||
      Array.isArray(parsedResult)
    ) {
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

  const stackAlignment = normalizeStackAlignment(parsed.stackAlignment)
  const cards = ensureGapFramingCards(
    normalizeCards(Array.isArray(parsed.cards) ? parsed.cards : []),
    stackAlignment,
  )
  if (!isString(parsed.deckTitle) || cards.length === 0) {
    throw new Error('Interview prep response schema was invalid.')
  }

  return {
    deckTitle: parsed.deckTitle.trim(),
    companyResearchSummary: isString(parsed.companyResearchSummary)
      ? parsed.companyResearchSummary.trim()
      : '',
    donts: normalizeStringList(parsed.donts),
    questionsToAsk: normalizeQuestionsToAsk(parsed.questionsToAsk),
    numbersToKnow: normalizeNumbersToKnow(parsed.numbersToKnow),
    stackAlignment,
    contextGaps: ensurePipelineResearchContextGaps(
      normalizeContextGaps(parsed.contextGaps),
      request,
    ),
    categoryGuidance: normalizeCategoryGuidance(parsed.categoryGuidance) as
      | Partial<Record<PrepCategory, string>>
      | undefined,
    cards,
  }
}
