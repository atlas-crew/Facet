import { create } from 'zustand'
import type {
  PrepCard,
  PrepCardConfidence,
  PrepCardRoundState,
  PrepCardRoundStatus,
  PrepCardStudyState,
  PrepConditional,
  PrepConditionalTone,
  PrepContextGap,
  PrepContextGapPriority,
  PrepDeck,
  PrepCategory,
  PrepDeepDive,
  PrepFollowUp,
  PrepMetric,
  PrepNumbersToKnow,
  PrepQuestionToAsk,
  PrepRoundDebrief,
  PrepRoundDebriefIntel,
  PrepStackAlignmentRow,
  PrepStoryBlock,
  PrepStoryBlockLabel,
  PrepWorkspaceMode,
} from '../types/prep'
import {
  PREP_CARD_CONFIDENCE_VALUES,
  PREP_CARD_ROUND_STATUS_VALUES,
  PREP_CATEGORY_VALUES,
  PREP_CONDITIONAL_TONE_VALUES,
  PREP_CONTEXT_GAP_PRIORITY_VALUES,
  PREP_STORY_BLOCK_LABEL_VALUES,
  isPrepStackAlignmentConfidence,
} from '../types/prep'
import type { InterviewFormat } from '../types/pipeline'
import { INTERVIEW_FORMAT_VALUES } from '../types/pipeline'
import {
  ensureDurableMetadata,
  stripDurableMetadataPatch,
  touchDurableMetadata,
} from './durableMetadata'
import { resolveStorage } from './storage'
import { createId } from '../utils/idUtils'

const LEGACY_STORAGE_KEY = 'facet-prep-data'

const now = () => new Date().toISOString()

interface CreateDeckInput {
  title: string
  company: string
  role: string
  vectorId?: string
  pipelineEntryId?: string | null
  companyUrl?: string
  skillMatch?: string
  positioning?: string
  roundType?: InterviewFormat
  notes?: string
  companyResearch?: string
  jobDescription?: string
  rules?: string[]
  donts?: string[]
  questionsToAsk?: PrepQuestionToAsk[]
  numbersToKnow?: PrepNumbersToKnow
  stackAlignment?: PrepStackAlignmentRow[]
  categoryGuidance?: Record<string, string>
  contextGaps?: PrepContextGap[]
  contextGapAnswers?: Record<string, string>
  roundNumber?: number
  roundDebriefs?: PrepRoundDebrief[]
  generatedAt?: string
  cards?: PrepCard[]
}

interface PrepState {
  decks: PrepDeck[]
  activeDeckId: string | null
  activeMode: PrepWorkspaceMode
  setActiveDeck: (deckId: string | null) => void
  setActiveMode: (mode: PrepWorkspaceMode) => void
  createDeck: (input: CreateDeckInput) => string
  updateDeck: (deckId: string, patch: Partial<Omit<PrepDeck, 'id' | 'cards'>>) => void
  replaceDeckCards: (deckId: string, cards: PrepCard[]) => void
  addCard: (deckId: string, partial?: Partial<PrepCard>) => string
  updateCard: (deckId: string, cardId: string, patch: Partial<PrepCard>) => void
  recordCardReview: (deckId: string, cardId: string, confidence: PrepCardConfidence) => void
  duplicateCard: (deckId: string, cardId: string) => void
  removeCard: (deckId: string, cardId: string) => void
  deleteDeck: (deckId: string) => void
  importDecks: (decks: PrepDeck[]) => void
  exportDecks: () => PrepDeck[]
}

interface SanitizeOptions {
  preserveDrafts?: boolean
}

function sanitizeText(value: unknown, options: SanitizeOptions = {}): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return options.preserveDrafts ? trimmed : trimmed || undefined
}

function sanitizeRoundNumber(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  const normalized = Math.trunc(value)
  return normalized > 0 ? normalized : undefined
}

function sanitizeCardRoundStatus(value: unknown): PrepCardRoundStatus | undefined {
  const normalized = sanitizeText(value)
  return normalized && PREP_CARD_ROUND_STATUS_VALUES.includes(normalized as PrepCardRoundStatus)
    ? normalized as PrepCardRoundStatus
    : undefined
}

function createEmptyCard(deckId: string, partial: Partial<PrepCard> = {}): PrepCard {
  return {
    id: partial.id ?? createId('prep-card'),
    deckId,
    category: partial.category ?? 'behavioral',
    title: partial.title?.trim() || 'New Prep Card',
    tags: partial.tags ?? [],
    timeBudgetMinutes: typeof partial.timeBudgetMinutes === 'number' && Number.isFinite(partial.timeBudgetMinutes)
      ? partial.timeBudgetMinutes
      : undefined,
    notes: partial.notes?.trim() || undefined,
    source: partial.source ?? 'manual',
    company: partial.company?.trim() || undefined,
    role: partial.role?.trim() || undefined,
    vectorId: partial.vectorId,
    pipelineEntryId: partial.pipelineEntryId ?? null,
    updatedAt: now(),
    script: partial.script?.trim() || undefined,
    scriptLabel: partial.scriptLabel?.trim() || undefined,
    warning: partial.warning?.trim() || undefined,
    storyBlocks: sanitizeStoryBlocks(partial.storyBlocks),
    keyPoints: sanitizeStringList(partial.keyPoints),
    followUps: sanitizeFollowUps(partial.followUps),
    deepDives: sanitizeDeepDives(partial.deepDives),
    conditionals: sanitizeConditionals(partial.conditionals)?.map((item) => ({
      ...item,
      id: item.id ?? createId('prep-conditional'),
    })),
    metrics: sanitizeMetrics(partial.metrics),
    tableData: partial.tableData,
    perRoundState: sanitizeCardRoundState(partial.perRoundState),
  }
}

function sanitizeStringList(values?: string[], options: SanitizeOptions = {}): string[] | undefined {
  if (!Array.isArray(values)) return undefined
  const sanitized = values.flatMap((value) => (
    typeof value === 'string'
      ? [value.trim()]
      : []
  ))
  if (options.preserveDrafts) {
    return sanitized.length > 0 ? sanitized : undefined
  }
  const filtered = sanitized.filter(Boolean)
  return filtered.length > 0 ? filtered : undefined
}

function sanitizeStoryBlocks(blocks?: PrepStoryBlock[], options: SanitizeOptions = {}): PrepStoryBlock[] | undefined {
  if (!Array.isArray(blocks)) return undefined
  const sanitized = blocks.flatMap((block) => {
    if (!block || typeof block !== 'object') return []
    const record = block as Partial<PrepStoryBlock>
    const label = PREP_STORY_BLOCK_LABEL_VALUES.includes(record.label as PrepStoryBlockLabel)
      ? record.label
      : null
    const text = typeof record.text === 'string' ? record.text.trim() : ''
    if (!label || (!options.preserveDrafts && !text)) return []
    return [{ label, text }]
  })
  return sanitized && sanitized.length > 0 ? sanitized : undefined
}

function sanitizeQuestionsToAsk(entries?: PrepQuestionToAsk[], options: SanitizeOptions = {}): PrepQuestionToAsk[] | undefined {
  if (!Array.isArray(entries)) return undefined
  const sanitized = entries.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const record = entry as Partial<PrepQuestionToAsk>
    const questionValue = typeof record.question === 'string' ? record.question : null
    const contextValue = typeof record.context === 'string' ? record.context : null
    const hasQuestion = questionValue != null
    const hasContext = contextValue != null
    const question = questionValue?.trim() ?? ''
    const context = contextValue?.trim() ?? ''
    if (options.preserveDrafts) {
      if (!hasQuestion && !hasContext) return []
      return [{ question, context }]
    }
    if (!question || !context) return []
    return [{ question, context }]
  })
  return sanitized && sanitized.length > 0 ? sanitized : undefined
}

function sanitizeCategoryGuidance(categoryGuidance?: Record<string, string>, options: SanitizeOptions = {}): Record<string, string> | undefined {
  if (!categoryGuidance || typeof categoryGuidance !== 'object' || Array.isArray(categoryGuidance)) {
    return undefined
  }
  const sanitized = Object.fromEntries(
    Object.entries(categoryGuidance).flatMap(([key, value]) => {
      const nextKey = key.trim()
      const nextValue = typeof value === 'string' ? value.trim() : ''
      if (!nextKey) return []
      if (!options.preserveDrafts && !nextValue) return []
      return [[nextKey, nextValue]]
    }),
  )
  return Object.keys(sanitized).length > 0 ? sanitized : undefined
}

function sanitizeRoundDebriefIntel(
  intel?: PrepRoundDebriefIntel,
  options: SanitizeOptions = {},
): PrepRoundDebriefIntel | undefined {
  if (!intel || typeof intel !== 'object' || Array.isArray(intel)) return undefined
  const record = intel as Partial<PrepRoundDebriefIntel>
  const teamCulture = sanitizeText(record.teamCulture, options)
  const aiUsage = sanitizeText(record.aiUsage, options)
  const topChallenge = sanitizeText(record.topChallenge, options)
  const volume = sanitizeText(record.volume, options)
  const securityPosture = sanitizeText(record.securityPosture, options)
  const goodSigns = sanitizeStringList(record.goodSigns, options)
  const redFlags = sanitizeStringList(record.redFlags, options)
  const other = sanitizeCategoryGuidance(record.other, options)

  if (
    teamCulture === undefined &&
    aiUsage === undefined &&
    topChallenge === undefined &&
    volume === undefined &&
    securityPosture === undefined &&
    goodSigns === undefined &&
    redFlags === undefined &&
    other === undefined
  ) {
    return undefined
  }

  return {
    ...(teamCulture !== undefined ? { teamCulture } : {}),
    ...(aiUsage !== undefined ? { aiUsage } : {}),
    ...(topChallenge !== undefined ? { topChallenge } : {}),
    ...(volume !== undefined ? { volume } : {}),
    ...(securityPosture !== undefined ? { securityPosture } : {}),
    ...(goodSigns !== undefined ? { goodSigns } : {}),
    ...(redFlags !== undefined ? { redFlags } : {}),
    ...(other !== undefined ? { other } : {}),
  }
}

function sanitizeRoundDebriefs(
  roundDebriefs?: PrepRoundDebrief[],
  options: SanitizeOptions = {},
): PrepRoundDebrief[] | undefined {
  if (!Array.isArray(roundDebriefs)) return undefined
  const sanitized = roundDebriefs.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const record = item as Partial<PrepRoundDebrief>
    const round = sanitizeRoundNumber(record.round)
    const hasDate = typeof record.date === 'string'
    const date = sanitizeText(record.date, options) ?? ''
    if (!round || !hasDate || (!options.preserveDrafts && !date)) return []

    const intel = sanitizeRoundDebriefIntel(record.intel, options) ?? {}
    const questionsAsked = sanitizeStringList(record.questionsAsked, options) ?? []
    const surprises = sanitizeStringList(record.surprises, options) ?? []
    const newIntel = sanitizeStringList(record.newIntel, options) ?? []
    const notes = sanitizeText(record.notes, options)

    return [{
      round,
      date,
      intel,
      questionsAsked,
      surprises,
      newIntel,
      ...(notes !== undefined ? { notes } : {}),
    }]
  })
  return sanitized.length > 0 ? sanitized : undefined
}

function sanitizeContextGapPriority(value: unknown): PrepContextGapPriority {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return PREP_CONTEXT_GAP_PRIORITY_VALUES.includes(normalized as PrepContextGapPriority)
    ? normalized as PrepContextGapPriority
    : 'recommended'
}

function sanitizeContextGaps(
  contextGaps?: PrepContextGap[],
  options: SanitizeOptions = {},
): PrepContextGap[] | undefined {
  if (!Array.isArray(contextGaps)) return undefined
  const sanitized = contextGaps.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const record = item as Partial<PrepContextGap>
    const id = typeof record.id === 'string' ? record.id.trim() : createId('prep-gap')
    const section = typeof record.section === 'string' ? record.section.trim() : ''
    const question = typeof record.question === 'string' ? record.question.trim() : ''
    const why = typeof record.why === 'string' ? record.why.trim() : ''
    const feedbackTarget = typeof record.feedbackTarget === 'string' ? record.feedbackTarget.trim() : ''
    if (!id) return []
    if (options.preserveDrafts) {
      if (!section && !question && !why && !feedbackTarget) return []
    } else if (!section || !question || !why) {
      return []
    }
    return [{
      id,
      section,
      question,
      why,
      feedbackTarget: feedbackTarget || undefined,
      priority: sanitizeContextGapPriority(record.priority),
    }]
  })
  return sanitized.length > 0 ? sanitized : undefined
}

function sanitizeContextGapAnswers(
  answers?: Record<string, string>,
  options: SanitizeOptions = {},
): Record<string, string> | undefined {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return undefined
  const sanitized = Object.fromEntries(
    Object.entries(answers).flatMap(([rawKey, rawValue]) => {
      const key = rawKey.trim()
      const value = typeof rawValue === 'string' ? rawValue.trim() : ''
      if (!key) return []
      if (!options.preserveDrafts && !value) return []
      return [[key, value]]
    }),
  )
  return Object.keys(sanitized).length > 0 ? sanitized : undefined
}

function sanitizeFollowUps(followUps?: PrepFollowUp[], options: SanitizeOptions = {}): PrepFollowUp[] | undefined {
  if (!Array.isArray(followUps)) return undefined
  const sanitized = followUps.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const record = item as Partial<PrepFollowUp>
    const question = typeof record.question === 'string' ? record.question.trim() : ''
    const answer = typeof record.answer === 'string' ? record.answer.trim() : ''
    const context = typeof record.context === 'string' ? record.context.trim() : undefined
    if (!options.preserveDrafts && !question && !answer) return []
    return [{
      id: record.id,
      question,
      answer,
      context: context || undefined,
    }]
  })
  return sanitized.length > 0 ? sanitized : undefined
}

function sanitizeDeepDives(deepDives?: PrepDeepDive[], options: SanitizeOptions = {}): PrepDeepDive[] | undefined {
  if (!Array.isArray(deepDives)) return undefined
  const sanitized = deepDives.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const record = item as Partial<PrepDeepDive>
    const title = typeof record.title === 'string' ? record.title.trim() : ''
    const content = typeof record.content === 'string' ? record.content.trim() : ''
    if (!options.preserveDrafts && !title && !content) return []
    return [{
      id: record.id,
      title,
      content,
    }]
  })
  return sanitized.length > 0 ? sanitized : undefined
}

function sanitizeConditionals(conditionals?: PrepConditional[], options: SanitizeOptions = {}): PrepConditional[] | undefined {
  if (!Array.isArray(conditionals)) return undefined
  const sanitized = conditionals.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const record = item as Partial<PrepConditional>
    const trigger = typeof record.trigger === 'string' ? record.trigger.trim() : ''
    const response = typeof record.response === 'string' ? record.response.trim() : ''
    const toneValue = typeof record.tone === 'string' ? record.tone.trim() : undefined
    const tone = (PREP_CONDITIONAL_TONE_VALUES as readonly string[]).includes(toneValue ?? '')
      ? toneValue as PrepConditionalTone
      : undefined
    const normalizedTone = tone ?? 'pivot'

    if (options.preserveDrafts) {
      if (!trigger && !response && !tone) return []
      return [{
        id: record.id,
        trigger,
        response,
        tone: normalizedTone,
      }]
    }

    if (!trigger || !response) return []
    return [{
      id: record.id,
      trigger,
      response,
      tone: normalizedTone,
    }]
  })
  return sanitized.length > 0 ? sanitized : undefined
}

function sanitizeCardRoundState(
  perRoundState?: PrepCardRoundState[],
  options: SanitizeOptions = {},
): PrepCardRoundState[] | undefined {
  if (!Array.isArray(perRoundState)) return undefined
  const sanitized = perRoundState.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const record = item as Partial<PrepCardRoundState>
    const round = sanitizeRoundNumber(record.round)
    const status = sanitizeCardRoundStatus(record.status)
    const notes = sanitizeText(record.notes, options)
    if (!round || !status) return []
    return [{
      round,
      status,
      ...(notes !== undefined ? { notes } : {}),
    }]
  })
  return sanitized.length > 0 ? sanitized : undefined
}

function sanitizeMetrics(metrics?: PrepMetric[], options: SanitizeOptions = {}): PrepMetric[] | undefined {
  if (!Array.isArray(metrics)) return undefined
  const sanitized = metrics.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const record = item as Partial<PrepMetric>
    const value =
      typeof record.value === 'string'
        ? record.value.trim()
        : typeof record.value === 'number' && Number.isFinite(record.value)
          ? String(record.value)
          : ''
    const label = typeof record.label === 'string' ? record.label.trim() : ''
    if (!options.preserveDrafts && !value && !label) return []
    return [{
      id: typeof record.id === 'string' ? record.id : createId('prep-metric'),
      value,
      label,
    }]
  })
  return sanitized.length > 0 ? sanitized : undefined
}

function sanitizeNumbersToKnow(
  numbersToKnow?: PrepNumbersToKnow,
  options: SanitizeOptions = {},
): PrepNumbersToKnow | undefined {
  if (!numbersToKnow || typeof numbersToKnow !== 'object' || Array.isArray(numbersToKnow)) {
    return undefined
  }

  const candidate = sanitizeMetrics(numbersToKnow.candidate, options)
  const company = sanitizeMetrics(numbersToKnow.company, options)

  return candidate || company
    ? {
        ...(candidate ? { candidate } : {}),
        ...(company ? { company } : {}),
      }
    : undefined
}

function sanitizeStackAlignment(
  stackAlignment?: PrepStackAlignmentRow[],
  _options: SanitizeOptions = {},
): PrepStackAlignmentRow[] | undefined {
  if (!Array.isArray(stackAlignment)) return undefined

  // Stack alignment feeds color-coded live rendering and downstream gap framing,
  // so rows must stay enum-clean even in draft-preserving update paths.
  const sanitized = stackAlignment.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const record = entry as PrepStackAlignmentRow
    const theirTech = typeof record.theirTech === 'string' ? record.theirTech.trim() : ''
    const yourMatch = typeof record.yourMatch === 'string' ? record.yourMatch.trim() : ''
    const confidence = isPrepStackAlignmentConfidence(record.confidence)
      ? record.confidence
      : undefined

    if (!theirTech || !yourMatch || !confidence) return []

    return [{
      theirTech,
      yourMatch,
      confidence,
    }]
  })

  return sanitized.length > 0 ? sanitized : undefined
}

function sanitizeCard(deckId: string, card: PrepCard, options: SanitizeOptions = {}): PrepCard {
  const category = PREP_CATEGORY_VALUES.includes(card.category) ? card.category : 'behavioral'

  return {
    ...createEmptyCard(deckId, card),
    id: card.id,
    deckId,
    category,
    title: card.title.trim() || 'Untitled Prep Card',
    tags: card.tags.map((tag) => tag.trim()).filter(Boolean),
    scriptLabel: card.scriptLabel?.trim() || undefined,
    storyBlocks: sanitizeStoryBlocks(card.storyBlocks, options),
    keyPoints: sanitizeStringList(card.keyPoints, options),
    followUps: sanitizeFollowUps(card.followUps, options)?.map((item) => ({
      ...item,
      id: item.id ?? createId('prep-follow-up'),
    })),
    deepDives: sanitizeDeepDives(card.deepDives, options)?.map((item) => ({
      ...item,
      id: item.id ?? createId('prep-deep-dive'),
    })),
    conditionals: sanitizeConditionals(card.conditionals, options)?.map((item) => ({
      ...item,
      id: item.id ?? createId('prep-conditional'),
    })),
    metrics: sanitizeMetrics(card.metrics, options),
    perRoundState: sanitizeCardRoundState(card.perRoundState, options),
    timeBudgetMinutes: typeof card.timeBudgetMinutes === 'number' && Number.isFinite(card.timeBudgetMinutes)
      ? Math.round(card.timeBudgetMinutes * 10) / 10
      : undefined,
    updatedAt: now(),
  }
}

function sanitizeDeck(deck: PrepDeck, options: { touch?: boolean; preserveDrafts?: boolean } = {}): PrepDeck {
  const timestamp = now()
  const cards = deck.cards.map((card) => sanitizeCard(deck.id, card, options))
  const validCardIds = new Set(cards.map((card) => card.id))
  const studyProgress = Object.fromEntries(
    Object.entries(deck.studyProgress ?? {}).flatMap(([cardId, state]) => {
      if (!validCardIds.has(cardId) || !state || typeof state !== 'object') return []
      const record = state as PrepCardStudyState
      return [[cardId, {
        confidence: PREP_CARD_CONFIDENCE_VALUES.includes(record.confidence as PrepCardConfidence)
          ? record.confidence
          : undefined,
        attempts: Number.isFinite(record.attempts) ? Math.max(0, record.attempts) : 0,
        needsWorkCount: Number.isFinite(record.needsWorkCount) ? Math.max(0, record.needsWorkCount) : 0,
        lastReviewedAt: typeof record.lastReviewedAt === 'string' ? record.lastReviewedAt : undefined,
      } satisfies PrepCardStudyState]]
    }),
  )

  return {
    ...deck,
    durableMeta: options.touch
      ? touchDurableMetadata(deck.durableMeta, timestamp)
      : ensureDurableMetadata(deck.durableMeta, deck.updatedAt ?? timestamp),
    title: deck.title.trim() || 'Interview Prep',
    company: deck.company.trim(),
    role: deck.role.trim(),
    vectorId: deck.vectorId?.trim() || undefined,
    pipelineEntryId: deck.pipelineEntryId ?? null,
    companyUrl: deck.companyUrl?.trim() || undefined,
    skillMatch: deck.skillMatch?.trim() || undefined,
    positioning: deck.positioning?.trim() || undefined,
    roundType: typeof deck.roundType === 'string' && INTERVIEW_FORMAT_VALUES.includes(deck.roundType.trim() as InterviewFormat)
      ? deck.roundType.trim() as InterviewFormat
      : undefined,
    roundNumber: sanitizeRoundNumber(deck.roundNumber),
    roundDebriefs: sanitizeRoundDebriefs(deck.roundDebriefs, options),
    notes: deck.notes?.trim() || undefined,
    companyResearch: deck.companyResearch?.trim() || undefined,
    jobDescription: deck.jobDescription?.trim() || undefined,
    rules: sanitizeStringList(deck.rules, options),
    donts: sanitizeStringList(deck.donts, options),
    questionsToAsk: sanitizeQuestionsToAsk(deck.questionsToAsk, options),
    numbersToKnow: sanitizeNumbersToKnow(deck.numbersToKnow, options),
    stackAlignment: sanitizeStackAlignment(deck.stackAlignment),
    categoryGuidance: sanitizeCategoryGuidance(deck.categoryGuidance, options),
    contextGaps: sanitizeContextGaps(deck.contextGaps, options),
    contextGapAnswers: sanitizeContextGapAnswers(deck.contextGapAnswers, options),
    generatedAt: deck.generatedAt,
    updatedAt: timestamp,
    cards,
    studyProgress,
  }
}

function stripDraftCardForExport(deckId: string, card: PrepCard): PrepCard {
  const category = PREP_CATEGORY_VALUES.includes(card.category) ? card.category : 'behavioral'

  return {
    ...card,
    id: card.id,
    deckId,
    category,
    title: card.title.trim() || 'Untitled Prep Card',
    tags: card.tags.map((tag) => tag.trim()).filter(Boolean),
    notes: card.notes?.trim() || undefined,
    source: card.source ?? 'manual',
    company: card.company?.trim() || undefined,
    role: card.role?.trim() || undefined,
    pipelineEntryId: card.pipelineEntryId ?? null,
    script: card.script?.trim() || undefined,
    scriptLabel: card.scriptLabel?.trim() || undefined,
    warning: card.warning?.trim() || undefined,
    timeBudgetMinutes: typeof card.timeBudgetMinutes === 'number' && Number.isFinite(card.timeBudgetMinutes)
      ? Math.round(card.timeBudgetMinutes * 10) / 10
      : undefined,
    storyBlocks: sanitizeStoryBlocks(card.storyBlocks),
    keyPoints: sanitizeStringList(card.keyPoints),
    followUps: sanitizeFollowUps(card.followUps)?.map((item) => ({
      ...item,
      id: item.id ?? createId('prep-follow-up'),
    })),
    deepDives: sanitizeDeepDives(card.deepDives)?.map((item) => ({
      ...item,
      id: item.id ?? createId('prep-deep-dive'),
    })),
    conditionals: sanitizeConditionals(card.conditionals)?.map((item) => ({
      ...item,
      id: item.id ?? createId('prep-conditional'),
    })),
    metrics: sanitizeMetrics(card.metrics),
    perRoundState: sanitizeCardRoundState(card.perRoundState),
  }
}

function stripDraftDeckForExport(deck: PrepDeck): PrepDeck {
  const cards = deck.cards.map((card) => stripDraftCardForExport(deck.id, card))
  const validCardIds = new Set(cards.map((card) => card.id))
  const studyProgress = Object.fromEntries(
    Object.entries(deck.studyProgress ?? {}).flatMap(([cardId, state]) => {
      if (!validCardIds.has(cardId) || !state || typeof state !== 'object') return []
      const record = state as PrepCardStudyState
      return [[cardId, {
        confidence: PREP_CARD_CONFIDENCE_VALUES.includes(record.confidence as PrepCardConfidence)
          ? record.confidence
          : undefined,
        attempts: Number.isFinite(record.attempts) ? Math.max(0, record.attempts) : 0,
        needsWorkCount: Number.isFinite(record.needsWorkCount) ? Math.max(0, record.needsWorkCount) : 0,
        lastReviewedAt: typeof record.lastReviewedAt === 'string' ? record.lastReviewedAt : undefined,
      } satisfies PrepCardStudyState]]
    }),
  )

  return {
    ...deck,
    title: deck.title.trim() || 'Interview Prep',
    company: deck.company.trim(),
    role: deck.role.trim(),
    vectorId: deck.vectorId?.trim() || undefined,
    pipelineEntryId: deck.pipelineEntryId ?? null,
    companyUrl: deck.companyUrl?.trim() || undefined,
    skillMatch: deck.skillMatch?.trim() || undefined,
    positioning: deck.positioning?.trim() || undefined,
    roundType: typeof deck.roundType === 'string' && INTERVIEW_FORMAT_VALUES.includes(deck.roundType.trim() as InterviewFormat)
      ? deck.roundType.trim() as InterviewFormat
      : undefined,
    roundNumber: sanitizeRoundNumber(deck.roundNumber),
    roundDebriefs: sanitizeRoundDebriefs(deck.roundDebriefs),
    notes: deck.notes?.trim() || undefined,
    companyResearch: deck.companyResearch?.trim() || undefined,
    jobDescription: deck.jobDescription?.trim() || undefined,
    rules: sanitizeStringList(deck.rules),
    donts: sanitizeStringList(deck.donts),
    questionsToAsk: sanitizeQuestionsToAsk(deck.questionsToAsk),
    numbersToKnow: sanitizeNumbersToKnow(deck.numbersToKnow),
    stackAlignment: sanitizeStackAlignment(deck.stackAlignment),
    categoryGuidance: sanitizeCategoryGuidance(deck.categoryGuidance),
    contextGaps: sanitizeContextGaps(deck.contextGaps),
    contextGapAnswers: sanitizeContextGapAnswers(deck.contextGapAnswers),
    cards,
    studyProgress,
  }
}

function loadLegacyDecks(): PrepDeck[] {
  try {
    const storage = resolveStorage()
    const raw = storage.getItem(LEGACY_STORAGE_KEY)
    if (raw instanceof Promise) return []
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length === 0) return []

    const deckId = createId('prep-deck')
    return [
      sanitizeDeck({
        id: deckId,
        title: 'Imported Prep Cards',
        company: '',
        role: '',
        vectorId: '',
        pipelineEntryId: null,
        updatedAt: now(),
        cards: parsed
          .filter((item): item is PrepCard => item && typeof item === 'object')
          .map((card) => sanitizeCard(deckId, { ...card, source: 'imported' })),
      }),
    ]
  } catch {
    return []
  }
}

function updateDeckCollection(
  decks: PrepDeck[],
  deckId: string,
  updater: (deck: PrepDeck) => PrepDeck,
  options: SanitizeOptions = {},
): PrepDeck[] {
  return decks.map((deck) => (
    deck.id === deckId ? sanitizeDeck(updater(deck), { touch: true, ...options }) : deck
  ))
}

export const migratePrepState = (persistedState: unknown) => {
  const state =
    typeof persistedState === 'object' && persistedState !== null
      ? (persistedState as {
          decks?: PrepDeck[]
          activeDeckId?: string | null
          activeMode?: PrepWorkspaceMode
        })
      : undefined

  const decks = Array.isArray(state?.decks)
    ? state.decks.map((deck) => sanitizeDeck(deck))
    : loadLegacyDecks()

  return {
    ...state,
    decks,
    activeDeckId: state?.activeDeckId ?? decks[0]?.id ?? null,
    activeMode:
      state?.activeMode === 'homework' || state?.activeMode === 'live' || state?.activeMode === 'edit'
        ? state.activeMode
        : 'edit',
  }
}

export const usePrepStore = create<PrepState>()((set, get) => ({
      decks: [],
      activeDeckId: null,
      activeMode: 'edit',

      setActiveDeck: (deckId) => set({ activeDeckId: deckId }),
      setActiveMode: (activeMode) => set({ activeMode }),

      createDeck: (input) => {
        const deckId = createId('prep-deck')
        const nextDeck = sanitizeDeck({
          id: deckId,
          title: input.title,
          company: input.company,
          role: input.role,
          vectorId: input.vectorId,
          pipelineEntryId: input.pipelineEntryId ?? null,
          companyUrl: input.companyUrl,
          skillMatch: input.skillMatch,
          positioning: input.positioning,
          roundType: input.roundType,
          notes: input.notes,
          companyResearch: input.companyResearch,
          jobDescription: input.jobDescription,
          rules: input.rules,
          donts: input.donts,
          questionsToAsk: input.questionsToAsk,
          numbersToKnow: input.numbersToKnow,
          stackAlignment: input.stackAlignment,
          categoryGuidance: input.categoryGuidance,
          contextGaps: input.contextGaps,
          contextGapAnswers: input.contextGapAnswers,
          roundNumber: input.roundNumber,
          roundDebriefs: input.roundDebriefs,
          generatedAt: input.generatedAt,
          updatedAt: now(),
          cards: (input.cards ?? []).map((card) => sanitizeCard(deckId, card)),
        })
        set((state) => ({
          decks: [nextDeck, ...state.decks],
          activeDeckId: deckId,
        }))
        return deckId
      },

      updateDeck: (deckId, patch) => {
        const restPatch = stripDurableMetadataPatch(patch)
        set((state) => ({
          decks: updateDeckCollection(state.decks, deckId, (deck) => ({ ...deck, ...restPatch }), { preserveDrafts: true }),
        }))
      },

      replaceDeckCards: (deckId, cards) => {
        set((state) => ({
          decks: updateDeckCollection(state.decks, deckId, (deck) => ({
            ...deck,
            cards: cards.map((card) => sanitizeCard(deckId, card)),
          })),
        }))
      },

      addCard: (deckId, partial) => {
        const cardId = createId('prep-card')
        set((state) => ({
          decks: updateDeckCollection(state.decks, deckId, (deck) => ({
            ...deck,
            cards: [
              createEmptyCard(deckId, {
                ...partial,
                id: cardId,
              }),
              ...deck.cards,
            ],
          })),
          activeDeckId: state.activeDeckId ?? deckId,
        }))
        return cardId
      },

      updateCard: (deckId, cardId, patch) => {
        set((state) => ({
          decks: updateDeckCollection(state.decks, deckId, (deck) => ({
            ...deck,
            cards: deck.cards.map((card) =>
              card.id === cardId ? { ...card, ...patch } : card,
            ),
          }), { preserveDrafts: true }),
        }))
      },

      recordCardReview: (deckId, cardId, confidence) => {
        set((state) => ({
          decks: updateDeckCollection(state.decks, deckId, (deck) => {
            if (!deck.cards.some((card) => card.id === cardId)) {
              return deck
            }
            const current = deck.studyProgress?.[cardId]
            return {
              ...deck,
              studyProgress: {
                ...(deck.studyProgress ?? {}),
                [cardId]: {
                  confidence,
                  attempts: (current?.attempts ?? 0) + 1,
                  needsWorkCount: (current?.needsWorkCount ?? 0) + (confidence === 'needs_work' ? 1 : 0),
                  lastReviewedAt: now(),
                },
              },
            }
          }),
        }))
      },

      duplicateCard: (deckId, cardId) => {
        set((state) => ({
          decks: updateDeckCollection(state.decks, deckId, (deck) => {
            const original = deck.cards.find((card) => card.id === cardId)
            if (!original) return deck
            const duplicate = sanitizeCard(deckId, {
              ...original,
              id: createId('prep-card'),
              title: `${original.title} Copy`,
              source: 'manual',
            })
            return {
              ...deck,
              cards: [duplicate, ...deck.cards],
            }
          }),
        }))
      },

      removeCard: (deckId, cardId) => {
        set((state) => {
          let shouldResetMode = false
          const decks = updateDeckCollection(state.decks, deckId, (deck) => {
            const cards = deck.cards.filter((card) => card.id !== cardId)
            shouldResetMode = cards.length === 0
            return {
              ...deck,
              cards,
            }
          })

          return {
            decks,
            activeMode: shouldResetMode ? 'edit' : state.activeMode,
          }
        })
      },

      deleteDeck: (deckId) => {
        set((state) => {
          const remaining = state.decks.filter((deck) => deck.id !== deckId)
          return {
            decks: remaining,
            activeDeckId:
              state.activeDeckId === deckId ? remaining[0]?.id ?? null : state.activeDeckId,
            activeMode:
              state.activeDeckId === deckId && remaining.length === 0
                ? 'edit'
                : state.activeMode,
          }
        })
      },

      importDecks: (decks) => {
        const sanitized = decks.map((deck) => sanitizeDeck(deck))
        const nextActiveDeck = sanitized[0] ?? null
        set({
          decks: sanitized,
          activeDeckId: nextActiveDeck?.id ?? null,
          activeMode: nextActiveDeck && nextActiveDeck.cards.length > 0 ? get().activeMode : 'edit',
        })
      },

      exportDecks: () => get().decks.map((deck) => stripDraftDeckForExport(deck)),
    }))

export const DEFAULT_PREP_CARD_CATEGORY: PrepCategory = 'behavioral'
