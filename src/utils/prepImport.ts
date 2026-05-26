import type {
  PrepAnchorSubDecision,
  PrepCard,
  PrepCardBase,
  PrepCategory,
  PrepConditional,
  PrepDecisionTreeNode,
  PrepDeck,
  PrepDeckSection,
  PrepMetric,
  PrepNumbersToKnow,
  PrepPhasedFrameworkPhase,
  PrepStackAlignmentRow,
  PrepStoryBlock,
  PrepStoryVariant,
} from '../types/prep'
import {
  PREP_CARD_ROUND_STATUS_VALUES,
  PREP_CONDITIONAL_TONE_VALUES,
  PREP_STORY_BLOCK_LABEL_VALUES,
  isPrepStackAlignmentConfidence,
  parsePrepScriptKind,
  resolvePrepCardKind,
} from '../types/prep'
import { INTERVIEW_FORMAT_VALUES } from '../types/pipeline'
import { createId } from './idUtils'
import { claimPrepDeckSectionCardIds, createPrepDeckSectionId } from './prepDeckSections'

const MAX_IMPORT_BYTES = 2 * 1024 * 1024 // 2 MB
const now = () => new Date().toISOString()

const VALID_CATEGORIES = new Set<string>([
  'opener',
  'behavioral',
  'technical',
  'project',
  'metrics',
  'situational',
])

const nullableString = (value: unknown): string | null =>
  typeof value === 'string' ? value.trim() || null : null

const nullableIdentifier = (value: unknown): string | null | undefined => {
  if (value === null) return null
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed || null
}

const optionalString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined

function validateObject<T>(raw: unknown): T | undefined {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as T) : undefined
}

function validateArray<T>(raw: unknown): T[] | undefined {
  return Array.isArray(raw) ? (raw as T[]) : undefined
}

function validateStringRecord(raw: unknown): Record<string, string> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const entries = Object.entries(raw as Record<string, unknown>).flatMap(([key, value]) =>
    typeof value === 'string' ? [[key, value] as const] : [],
  )
  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

function validateQuestionsToAsk(raw: unknown): PrepDeck['questionsToAsk'] | undefined {
  if (!Array.isArray(raw)) return undefined
  const questions = raw.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const record = item as Record<string, unknown>
    const question = typeof record.question === 'string' ? record.question.trim() : ''
    const context = typeof record.context === 'string' ? record.context.trim() : ''
    return question && context ? [{ question, context }] : []
  })
  return questions.length > 0 ? questions : undefined
}

function validateRoundType(raw: unknown): PrepDeck['roundType'] | undefined {
  if (typeof raw !== 'string') return undefined
  return (INTERVIEW_FORMAT_VALUES as readonly string[]).includes(raw)
    ? (raw as PrepDeck['roundType'])
    : undefined
}

function validateMetricList(raw: unknown): PrepMetric[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const metrics = raw.flatMap((metric) => {
    if (!metric || typeof metric !== 'object') return []
    const record = metric as Record<string, unknown>
    const value =
      typeof record.value === 'string'
        ? record.value.trim()
        : typeof record.value === 'number' && Number.isFinite(record.value)
          ? String(record.value)
          : ''
    const label = typeof record.label === 'string' ? record.label.trim() : ''
    return value && label
      ? [
          {
            id: typeof record.id === 'string' ? record.id : undefined,
            value,
            label,
          },
        ]
      : []
  })

  return metrics.length > 0 ? metrics : undefined
}

function validateNumbersToKnow(raw: unknown): PrepNumbersToKnow | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const record = raw as Record<string, unknown>
  const candidate = validateMetricList(record.candidate)
  const company = validateMetricList(record.company)
  return candidate || company
    ? {
        ...(candidate ? { candidate } : {}),
        ...(company ? { company } : {}),
      }
    : undefined
}

function validateDecisionTree(raw: unknown): PrepDecisionTreeNode[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const nodes = raw.flatMap((node) => {
    if (!node || typeof node !== 'object') return []
    const record = node as Record<string, unknown>
    const title = typeof record.title === 'string' ? record.title.trim() : ''
    if (!title) return []
    const options = Array.isArray(record.options)
      ? record.options.flatMap((option) => {
          if (!option || typeof option !== 'object') return []
          const item = option as Record<string, unknown>
          const optionText = typeof item.option === 'string' ? item.option.trim() : ''
          const whenRight = typeof item.whenRight === 'string' ? item.whenRight.trim() : ''
          const tradeoff = typeof item.tradeoff === 'string' ? item.tradeoff.trim() : ''
          return optionText && whenRight && tradeoff
            ? [{ option: optionText, whenRight, tradeoff }]
            : []
        })
      : undefined
    return [
      {
        title,
        options: options && options.length > 0 ? options : undefined,
        recommendation:
          typeof record.recommendation === 'string'
            ? record.recommendation.trim() || undefined
            : undefined,
        trap: typeof record.trap === 'string' ? record.trap.trim() || undefined : undefined,
      },
    ]
  })
  return nodes.length > 0 ? nodes : undefined
}

function validatePhasedFramework(raw: unknown): PrepPhasedFrameworkPhase[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const phases = raw.flatMap((phase) => {
    if (!phase || typeof phase !== 'object') return []
    const record = phase as Record<string, unknown>
    const phaseTitle = typeof record.phase === 'string' ? record.phase.trim() : ''
    const bullets = Array.isArray(record.bullets)
      ? record.bullets.filter((bullet): bullet is string => typeof bullet === 'string')
      : []
    const normalizedBullets = bullets.map((bullet) => bullet.trim()).filter(Boolean)
    if (!phaseTitle || normalizedBullets.length === 0) return []
    return [
      {
        phase: phaseTitle,
        timeframe:
          typeof record.timeframe === 'string' ? record.timeframe.trim() || undefined : undefined,
        bullets: normalizedBullets,
      },
    ]
  })
  return phases.length > 0 ? phases : undefined
}

function validateStringList(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const values = raw.flatMap((item) =>
    typeof item === 'string' && item.trim() ? [item.trim()] : [],
  )
  return values.length > 0 ? values : undefined
}

function validateStoryBlocks(raw: unknown): PrepStoryBlock[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const blocks = raw.flatMap((block) => {
    if (!block || typeof block !== 'object') return []
    const record = block as Record<string, unknown>
    const label = typeof record.label === 'string' ? record.label.trim() : ''
    const text = typeof record.text === 'string' ? record.text.trim() : ''
    return text && (PREP_STORY_BLOCK_LABEL_VALUES as readonly string[]).includes(label)
      ? [{ label: label as PrepStoryBlock['label'], text }]
      : []
  })
  return blocks.length > 0 ? blocks : undefined
}

function validateStoryVariants(raw: unknown): PrepStoryVariant[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const variants = raw.flatMap((variant) => {
    if (!variant || typeof variant !== 'object') return []
    const record = variant as Record<string, unknown>
    const id =
      typeof record.id === 'string' && record.id.trim()
        ? record.id.trim()
        : createId('prep-story-variant')
    const label = typeof record.label === 'string' ? record.label.trim() : ''
    const storyBlocks = validateStoryBlocks(record.storyBlocks)
    if (!label || !storyBlocks) return []
    return [
      {
        id,
        label,
        storyBlocks,
        keyPoints: validateStringList(record.keyPoints),
        roleContext:
          typeof record.roleContext === 'string'
            ? record.roleContext.trim() || undefined
            : undefined,
        when: typeof record.when === 'string' ? record.when.trim() || undefined : undefined,
      },
    ]
  })
  return variants.length > 0 ? variants : undefined
}

function validateDeckSections(raw: unknown, cardIds: Set<string>): PrepDeckSection[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const seenSectionIds = new Set<string>()
  const claimedCardIds = new Set<string>()
  const sections = raw.flatMap((section) => {
    if (!section || typeof section !== 'object') return []
    const record = section as Record<string, unknown>
    const title = typeof record.title === 'string' ? record.title.trim() : ''
    if (!title) return []

    const sectionCardIds = claimPrepDeckSectionCardIds(
      validateStringList(record.cardIds),
      cardIds,
      claimedCardIds,
    )
    if (!sectionCardIds) return []

    const id = createPrepDeckSectionId({
      id: typeof record.id === 'string' ? record.id : undefined,
      title,
      seenIds: seenSectionIds,
    })
    return [{ id, title, cardIds: sectionCardIds }]
  })

  return sections.length > 0 ? sections : undefined
}

function validateAnchorSubDecisions(raw: unknown): PrepAnchorSubDecision[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const decisions = raw.flatMap((decision) => {
    if (!decision || typeof decision !== 'object') return []
    const record = decision as Record<string, unknown>
    const id =
      typeof record.id === 'string' && record.id.trim()
        ? record.id.trim()
        : createId('prep-anchor-decision')
    const title = typeof record.title === 'string' ? record.title.trim() : ''
    const blocks = validateStoryBlocks(record.blocks)
    if (!title || !blocks) return []
    return [
      {
        id,
        title,
        tag: typeof record.tag === 'string' ? record.tag.trim() || undefined : undefined,
        blocks,
        pushbackResponse:
          typeof record.pushbackResponse === 'string'
            ? record.pushbackResponse.trim() || undefined
            : undefined,
        honestTradeoff:
          typeof record.honestTradeoff === 'string'
            ? record.honestTradeoff.trim() || undefined
            : undefined,
      },
    ]
  })
  return decisions.length > 0 ? decisions : undefined
}

function validateConditionals(raw: unknown): PrepConditional[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const conditionals = raw.flatMap((conditional) => {
    if (!conditional || typeof conditional !== 'object') return []
    const record = conditional as Record<string, unknown>
    const trigger = typeof record.trigger === 'string' ? record.trigger.trim() : ''
    const response = typeof record.response === 'string' ? record.response.trim() : ''
    const tone = typeof record.tone === 'string' ? record.tone.trim() : ''
    if (!trigger || !response) return []
    return [
      {
        id: typeof record.id === 'string' ? record.id.trim() || undefined : undefined,
        trigger,
        response,
        tone: (PREP_CONDITIONAL_TONE_VALUES as readonly string[]).includes(tone)
          ? (tone as PrepConditional['tone'])
          : undefined,
      },
    ]
  })
  return conditionals.length > 0 ? conditionals : undefined
}

function validateRoundState(raw: unknown): PrepCardBase['perRoundState'] | undefined {
  if (!Array.isArray(raw)) return undefined
  const entries = raw.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const record = entry as Record<string, unknown>
    const round =
      typeof record.round === 'number' && Number.isFinite(record.round)
        ? Math.trunc(record.round)
        : 0
    const status = typeof record.status === 'string' ? record.status.trim() : ''
    if (round <= 0 || !(PREP_CARD_ROUND_STATUS_VALUES as readonly string[]).includes(status)) {
      return []
    }
    return [
      {
        round,
        status: status as NonNullable<PrepCardBase['perRoundState']>[number]['status'],
        notes: typeof record.notes === 'string' ? record.notes.trim() || undefined : undefined,
      },
    ]
  })
  return entries.length > 0 ? entries : undefined
}

function validateStackAlignment(raw: unknown): PrepStackAlignmentRow[] | undefined {
  if (!Array.isArray(raw)) return undefined

  const rows = raw.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const record = entry as Record<string, unknown>
    const theirTech = typeof record.theirTech === 'string' ? record.theirTech.trim() : ''
    const yourMatch = typeof record.yourMatch === 'string' ? record.yourMatch.trim() : ''
    const confidence = typeof record.confidence === 'string' ? record.confidence.trim() : undefined
    return theirTech && yourMatch && confidence && isPrepStackAlignmentConfidence(confidence)
      ? [{ theirTech, yourMatch, confidence }]
      : []
  })

  return rows.length > 0 ? rows : undefined
}

/**
 * Validates a single imported prep card. Rejects entries with
 * missing required fields and coerces optional fields to safe defaults.
 */
function validateCard(raw: unknown): PrepCard | null {
  if (!raw || typeof raw !== 'object') return null
  const c = raw as Record<string, unknown>

  // Required string fields
  if (typeof c.id !== 'string' || !c.id) return null
  if (typeof c.title !== 'string' || !c.title) return null
  if (!VALID_CATEGORIES.has(c.category as string)) return null
  const cardKind = resolvePrepCardKind(c.kind, c) ?? resolvePrepCardKind(undefined, c)
  if (!cardKind) return null

  const str = (v: unknown) => (typeof v === 'string' ? v : undefined)

  // Tags must be string array
  const tags = Array.isArray(c.tags) ? c.tags.filter((t): t is string => typeof t === 'string') : []

  // Follow-ups: array of {question, answer} pairs
  const followUps = Array.isArray(c.followUps)
    ? c.followUps
        .filter(
          (f): f is { question: string; answer: string } =>
            f &&
            typeof f === 'object' &&
            typeof f.question === 'string' &&
            typeof f.answer === 'string',
        )
        .map((item) => ({
          id:
            typeof (item as Record<string, unknown>).id === 'string'
              ? ((item as Record<string, unknown>).id as string)
              : undefined,
          question: item.question,
          answer: item.answer,
        }))
    : undefined

  // Deep dives: array of {title, content}
  const deepDives = Array.isArray(c.deepDives)
    ? c.deepDives
        .filter(
          (d): d is { title: string; content: string } =>
            d &&
            typeof d === 'object' &&
            typeof d.title === 'string' &&
            typeof d.content === 'string',
        )
        .map((item) => ({
          id:
            typeof (item as Record<string, unknown>).id === 'string'
              ? ((item as Record<string, unknown>).id as string)
              : undefined,
          title: item.title,
          content: item.content,
        }))
    : undefined

  // Metrics: array of {value, label}
  const metrics = validateMetricList(c.metrics)

  // Table data
  let tableData: PrepCard['tableData'] = undefined
  if (c.tableData && typeof c.tableData === 'object') {
    const td = c.tableData as Record<string, unknown>
    if (
      Array.isArray(td.headers) &&
      td.headers.every((h: unknown) => typeof h === 'string') &&
      Array.isArray(td.rows) &&
      td.rows.every(
        (r: unknown) => Array.isArray(r) && r.every((cell: unknown) => typeof cell === 'string'),
      )
    ) {
      tableData = { headers: td.headers as string[], rows: td.rows as string[][] }
    }
  }

  const baseCard: PrepCardBase = {
    id: c.id as string,
    deckId: str(c.deckId) ?? '',
    category: c.category as PrepCategory,
    title: c.title as string,
    tags,
    notes: str(c.notes),
    source:
      c.source === 'ai' || c.source === 'manual' || c.source === 'imported' ? c.source : undefined,
    company: str(c.company),
    role: str(c.role),
    vectorId: str(c.vectorId),
    pipelineEntryId: str(c.pipelineEntryId) ?? null,
    updatedAt: str(c.updatedAt) ?? now(),
    timeBudgetMinutes:
      typeof c.timeBudgetMinutes === 'number' && Number.isFinite(c.timeBudgetMinutes)
        ? c.timeBudgetMinutes
        : undefined,
    script: str(c.script),
    scriptKind: parsePrepScriptKind(c.scriptKind),
    scriptLabel: str(c.scriptLabel),
    pushbackScript: str(c.pushbackScript),
    pushbackLabel: str(c.pushbackLabel),
    alternativeTitle: str(c.alternativeTitle),
    alternativeScript: str(c.alternativeScript),
    warning: str(c.warning),
    storyBlocks: validateStoryBlocks(c.storyBlocks),
    storyVariants: validateStoryVariants(c.storyVariants),
    keyPoints: validateStringList(c.keyPoints),
    followUps: followUps && followUps.length > 0 ? followUps : undefined,
    deepDives: deepDives && deepDives.length > 0 ? deepDives : undefined,
    conditionals: validateConditionals(c.conditionals),
    metrics: metrics && metrics.length > 0 ? metrics : undefined,
    tableData,
    interviewerIds: validateStringList(c.interviewerIds),
    perRoundState: validateRoundState(c.perRoundState),
  }

  if (cardKind === 'scenario') {
    return {
      ...baseCard,
      kind: cardKind,
      whyLikely: typeof c.whyLikely === 'string' ? c.whyLikely.trim() : '',
      decisionTree: validateDecisionTree(c.decisionTree),
      phasedFramework: validatePhasedFramework(c.phasedFramework),
    }
  }

  if (cardKind === 'anchor') {
    return {
      ...baseCard,
      kind: cardKind,
      storyBlocks: baseCard.storyBlocks ?? [],
      subDecisions: validateAnchorSubDecisions(c.subDecisions) ?? [],
    }
  }

  return {
    ...baseCard,
    kind: cardKind,
  }
}

function validateDeck(raw: unknown): PrepDeck | null {
  if (!raw || typeof raw !== 'object') return null
  const deck = raw as Record<string, unknown>
  if (typeof deck.id !== 'string' || !deck.id) return null
  if (typeof deck.title !== 'string') return null
  if (typeof deck.company !== 'string') return null
  if (typeof deck.role !== 'string') return null
  if (!Array.isArray(deck.cards)) return null

  const deckId = deck.id as string
  const cards = deck.cards
    .map((card) => validateCard(card))
    .filter((card): card is PrepCard => card !== null)
    .map((card) => ({ ...card, deckId }))
  const cardIds = new Set(cards.map((card) => card.id))
  const rawOpenerCardId = typeof deck.openerCardId === 'string' ? deck.openerCardId.trim() : ''
  const rawCloserCardId = typeof deck.closerCardId === 'string' ? deck.closerCardId.trim() : ''
  const openerCardId = rawOpenerCardId && cardIds.has(rawOpenerCardId) ? rawOpenerCardId : undefined
  const closerCardId =
    rawCloserCardId && rawCloserCardId !== openerCardId && cardIds.has(rawCloserCardId)
      ? rawCloserCardId
      : undefined

  return {
    id: deck.id,
    title: deck.title,
    company: deck.company,
    role: deck.role,
    vectorId: optionalString(deck.vectorId),
    pipelineEntryId: nullableIdentifier(deck.pipelineEntryId) ?? null,
    // `null` is an explicit "not linked to a round" sentinel; `undefined` means absent.
    pipelineRoundId: nullableIdentifier(deck.pipelineRoundId),
    companyUrl: optionalString(deck.companyUrl),
    skillMatch: optionalString(deck.skillMatch),
    positioning: optionalString(deck.positioning),
    roundType: validateRoundType(deck.roundType),
    notes: optionalString(deck.notes),
    answerTemplate: optionalString(deck.answerTemplate),
    companyResearch: optionalString(deck.companyResearch),
    companyIntel: validateObject<PrepDeck['companyIntel']>(deck.companyIntel),
    interviewers: validateArray<NonNullable<PrepDeck['interviewers']>[number]>(deck.interviewers),
    jobDescription: optionalString(deck.jobDescription),
    jdAnalysisId: nullableString(deck.jdAnalysisId),
    jdAnalysisGeneratedAt: nullableString(deck.jdAnalysisGeneratedAt),
    jdAnalysisModelVersion: nullableString(deck.jdAnalysisModelVersion),
    jdTextHash: nullableString(deck.jdTextHash),
    rules: validateStringList(deck.rules),
    donts: validateStringList(deck.donts),
    questionsToAsk: validateQuestionsToAsk(deck.questionsToAsk),
    numbersToKnow: validateNumbersToKnow(deck.numbersToKnow),
    stackAlignment: validateStackAlignment(deck.stackAlignment),
    categoryGuidance: validateStringRecord(deck.categoryGuidance),
    contextGaps: validateArray<NonNullable<PrepDeck['contextGaps']>[number]>(deck.contextGaps),
    contextGapAnswers: validateStringRecord(deck.contextGapAnswers),
    contractViolations: validateArray<NonNullable<PrepDeck['contractViolations']>[number]>(
      deck.contractViolations,
    ),
    openerCardId,
    closerCardId,
    sections: validateDeckSections(deck.sections, cardIds),
    roundNumber:
      typeof deck.roundNumber === 'number' && Number.isFinite(deck.roundNumber)
        ? Math.trunc(deck.roundNumber)
        : undefined,
    roundDebriefs: validateArray<NonNullable<PrepDeck['roundDebriefs']>[number]>(
      deck.roundDebriefs,
    ),
    generatedAt: optionalString(deck.generatedAt),
    identityVersion:
      typeof deck.identityVersion === 'number' && Number.isFinite(deck.identityVersion)
        ? Math.trunc(deck.identityVersion)
        : undefined,
    identityFields: validateStringList(deck.identityFields),
    stalenessReview: validateObject<PrepDeck['stalenessReview']>(deck.stalenessReview),
    updatedAt: optionalString(deck.updatedAt) ?? now(),
    cards,
    studyProgress: validateObject<PrepDeck['studyProgress']>(deck.studyProgress),
  }
}

export interface PrepImportResult {
  decks: PrepDeck[]
  skipped: number
  error: string | null
}

/**
 * Parse and validate a prep cards JSON import file.
 * Returns validated cards with invalid entries skipped.
 */
export function parsePrepImport(file: File): Promise<PrepImportResult> {
  return new Promise((resolve) => {
    if (file.size > MAX_IMPORT_BYTES) {
      resolve({
        decks: [],
        skipped: 0,
        error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 2 MB.`,
      })
      return
    }

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string)
        const raw = Array.isArray(parsed) ? parsed : null
        if (!raw) {
          resolve({
            decks: [],
            skipped: 0,
            error: 'Expected a JSON array of prep cards or prep decks.',
          })
          return
        }

        let skipped = 0
        const maybeDecks = raw
          .map((item) => validateDeck(item))
          .filter((deck): deck is PrepDeck => deck !== null)

        if (maybeDecks.length > 0) {
          skipped = raw.length - maybeDecks.length
          resolve({ decks: maybeDecks, skipped, error: null })
          return
        }

        const cards: PrepCard[] = []
        for (const item of raw) {
          const validated = validateCard(item)
          if (validated) cards.push(validated)
          else skipped++
        }

        if (cards.length === 0 && skipped > 0) {
          resolve({ decks: [], skipped, error: `All ${skipped} cards failed validation.` })
          return
        }

        const deckId = createId('prep-deck')
        resolve({
          decks: [
            {
              id: deckId,
              title: 'Imported Prep Cards',
              company: '',
              role: '',
              vectorId: '',
              pipelineEntryId: null,
              updatedAt: now(),
              cards: cards.map((card) => ({ ...card, deckId })),
            },
          ],
          skipped,
          error: null,
        })
      } catch {
        resolve({ decks: [], skipped: 0, error: 'File is not valid JSON.' })
      }
    }
    reader.readAsText(file)
  })
}
