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
  PrepQuestionToAsk,
  PrepStoryBlock,
  PrepStoryBlockLabel,
} from '../types/prep'
import { createId } from './idUtils'
import { callLlmProxy, extractJsonBlock, JsonExtractionError, isString } from './llmProxy'

/** Model used for interview prep — needs creative, detailed output. */
const PREP_MODEL = 'sonnet'
const PREP_TIMEOUT_MS = 90000

interface PrepGenerationPayload {
  deckTitle: string
  companyResearchSummary?: string
  donts?: string[]
  questionsToAsk?: PrepQuestionToAsk[]
  numbersToKnow?: PrepNumbersToKnow
  categoryGuidance?: Record<string, string>
  contextGaps?: PrepContextGap[]
  cards: Array<Omit<PrepCard, 'id'>>
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
  const normalized = values.filter(isString).map((value) => value.trim()).filter(Boolean)
  return normalized.length > 0 ? normalized : undefined
}

function normalizeMetricList(value: unknown): PrepMetric[] | undefined {
  if (!Array.isArray(value)) return undefined
  const metrics = value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const record = entry as Record<string, unknown>
    const rawValue = record.value
    const valueText =
      isString(rawValue)
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
  const { candidate_metrics: _candidateMetrics, ...rest } = value
  return rest
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
    ? normalized as PrepContextGapPriority
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
    return [{
      id,
      section,
      question,
      why,
      feedbackTarget: feedbackTarget || undefined,
      priority: normalizeContextGapPriority(record.priority),
    }]
  })
  return gaps.length > 0 ? gaps : undefined
}

function normalizeConditionalTone(value: unknown): PrepConditionalTone | undefined {
  if (!isString(value)) return undefined
  const normalized = value.trim().toLowerCase()
  return PREP_CONDITIONAL_TONE_VALUES.includes(normalized as PrepConditionalTone)
    ? normalized as PrepConditionalTone
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

function normalizeCategoryGuidance(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const entries = Object.entries(value as Record<string, unknown>).flatMap(([key, guidance]) => {
    const normalizedKey = key.trim()
    const normalizedGuidance = isString(guidance) ? guidance.trim() : ''
    return normalizedKey && normalizedGuidance && (PREP_CATEGORY_VALUES as readonly string[]).includes(normalizedKey)
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

    const tags = Array.isArray(record.tags)
      ? record.tags.filter(isString).map((tag) => tag.trim()).filter(Boolean)
      : []

    return [
      {
        id: createId('prep-card'),
        category,
        title: record.title.trim(),
        tags,
        notes: isString(record.notes) ? record.notes.trim() : undefined,
        script: isString(record.script) ? record.script.trim() : undefined,
        scriptLabel: isString(record.scriptLabel) ? record.scriptLabel.trim() || undefined : undefined,
        warning: isString(record.warning) ? record.warning.trim() : undefined,
        storyBlocks: normalizeStoryBlocks(record.storyBlocks),
        keyPoints: normalizeStringList(record.keyPoints),
        followUps: Array.isArray(record.followUps)
          ? record.followUps.flatMap((followUp) => {
              if (!followUp || typeof followUp !== 'object') return []
              const item = followUp as Record<string, unknown>
              return isString(item.question) && isString(item.answer)
                ? [{ question: item.question.trim(), answer: item.answer.trim() }]
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
                  ? ((record.tableData as { headers: unknown[] }).headers.filter(isString) as string[])
                  : [],
                rows: Array.isArray((record.tableData as { rows?: unknown[] }).rows)
                  ? (record.tableData as { rows: unknown[] }).rows.flatMap((row) =>
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

export async function generateInterviewPrep(
  endpoint: string,
  request: PrepGenerationRequest,
): Promise<{
  deckTitle: string
  companyResearchSummary: string
  donts?: string[]
  questionsToAsk?: PrepQuestionToAsk[]
  numbersToKnow?: PrepNumbersToKnow
  categoryGuidance?: Partial<Record<PrepCategory, string>>
  contextGaps?: PrepContextGap[]
  cards: PrepCard[]
}> {
  const candidateMetrics: PrepIdentityMetricCandidate[] | undefined = request.identityContext?.candidate_metrics
  const structuredIdentityContext = stripCandidateMetricsFromIdentityContext(request.identityContext)

  const systemPrompt = `You are an expert interview coach. Return JSON only.
Generate a strong interview prep pack from a candidate's resume context, a target vector, a job description, and company research notes.
Focus on truthful storytelling, quantified evidence, likely interview themes, and specific follow-up questions the candidate should prepare for.
Include 8 to 12 cards spanning opener, behavioral, technical, project, metrics, and situational categories when supported by the input.
Use the resume context to ground answers; do not invent facts or metrics not present in the candidate material. If company research is uncertain, say so in notes instead of presenting it as fact.

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

  const userPrompt = `Target Company: ${request.company}
Target Role: ${request.role}
Target Vector: ${request.vectorLabel} (${request.vectorId})
Target Round Type: ${request.roundType ?? 'Not provided'}
Company URL: ${request.companyUrl ?? 'Not provided'}
Skill Match Notes: ${request.skillMatch ?? 'Not provided'}
Positioning Notes: ${request.positioning ?? 'Not provided'}
Additional Notes: ${request.notes ?? 'Not provided'}
Company Research Notes: ${request.companyResearch ?? 'Not provided'}

Job Description:
${request.jobDescription}

Structured Identity Context:
${structuredIdentityContext ? JSON.stringify(structuredIdentityContext, null, 2) : 'Not provided'}

Candidate Metrics From Identity:
${candidateMetrics ? JSON.stringify(candidateMetrics, null, 2) : 'Not provided'}

Existing Context Gaps:
${request.contextGaps ? JSON.stringify(request.contextGaps, null, 2) : 'Not provided'}

Context Gap Answers:
${request.contextGapAnswers ? JSON.stringify(request.contextGapAnswers, null, 2) : 'Not provided'}

Tailored Resume Context:
${JSON.stringify(request.resumeContext, null, 2)}

When structured identity context is provided, use it as the primary source of candidate evidence and fall back to the tailored resume context only for missing details.
Use structured identity bullets to map problem -> problem, action -> solution, and outcome/impact -> result story blocks on behavioral and project cards whenever possible.
Request 3 to 5 keyPoints for every card so the live cheatsheet has glance bullets.
If a card has a script, also provide a short scriptLabel such as "Say This", "Lead With", or "The One-Liner".
For opener, behavioral, and situational cards, include conditionals when there is likely interviewer pushback, skepticism, or a risky follow-up. Use trigger for the push, response for the coached pivot or answer, and tone to mark pivot, trap, or escalation moments.
For gotcha questions or misleading framing, use tone "trap" and write the response as the reframe the candidate should deliver.
Return 5 to 8 personalized donts at the deck level, 3 to 5 questionsToAsk with coaching context, and categoryGuidance keyed by the prep category names.
When candidate metrics are provided, use them as the only source for numbersToKnow.candidate. You may curate, sort, relabel, or lightly format their values for readability, but you must not invent new candidate numbers.
Use numbersToKnow.company only for numbers grounded in the supplied job description or company research.
When structured identity context includes bullet metrics, use those exact metrics for numbers-oriented cards instead of inventing new figures.
If a round type is provided, adapt the emphasis and category guidance to that interview round.
If the source material is missing context for a useful answer, do not hide the gap.
- Prefix the affected field with [[needs-review]] when you can make a cautious inference that should be verified.
- Prefix the affected field with [[fill-in: short prompt]] when the answer needs a user-supplied detail before it is trustworthy.
- Add a contextGaps entry whenever more upstream context would materially improve the prep content.
- If contextGapAnswers are provided, treat them as authoritative supplemental context and refresh the affected sections before carrying any gap forward.
- If an existing context gap remains relevant after regeneration, preserve its id so user answers stay attached to that prompt.

Return JSON only.`

  const rawResponse = await callLlmProxy(endpoint, systemPrompt, userPrompt, {
    feature: 'prep.generate',
    model: PREP_MODEL,
    timeoutMs: PREP_TIMEOUT_MS,
  })

  let parsed: PrepGenerationPayload
  try {
    parsed = JSON.parse(extractJsonBlock(rawResponse)) as PrepGenerationPayload
  } catch (error) {
    if (error instanceof JsonExtractionError) throw error
    throw new Error('Failed to parse interview prep response.')
  }

  const cards = normalizeCards(Array.isArray(parsed.cards) ? parsed.cards : [])
  if (!isString(parsed.deckTitle) || cards.length === 0) {
    throw new Error('Interview prep response schema was invalid.')
  }

  return {
    deckTitle: parsed.deckTitle.trim(),
    companyResearchSummary: isString(parsed.companyResearchSummary) ? parsed.companyResearchSummary.trim() : '',
    donts: normalizeStringList(parsed.donts),
    questionsToAsk: normalizeQuestionsToAsk(parsed.questionsToAsk),
    numbersToKnow: normalizeNumbersToKnow(parsed.numbersToKnow),
    contextGaps: normalizeContextGaps(parsed.contextGaps),
    categoryGuidance: normalizeCategoryGuidance(parsed.categoryGuidance) as Partial<Record<PrepCategory, string>> | undefined,
    cards,
  }
}
