import { create } from 'zustand'
import type {
  PrepCard,
  PrepCardBase,
  PrepCardKind,
  PrepCardPatch,
  PrepScenarioCard,
  PrepCardConfidence,
  PrepCardRoundState,
  PrepCardRoundStatus,
  PrepCardStudyState,
  PrepCompanyIntel,
  PrepConditional,
  PrepConditionalTone,
  PrepContractViolation,
  PrepContextGap,
  PrepContextGapPriority,
  PrepDeck,
  PrepCategory,
  PrepDeepDive,
  PrepFollowUp,
  PrepInterviewer,
  PrepMetric,
  PrepNumbersToKnow,
  PrepQuestionToAsk,
  PrepRoundDebrief,
  PrepRoundDebriefIntel,
  PrepStackAlignmentRow,
  PrepStoryBlock,
  PrepStoryBlockLabel,
  PrepStoryVariant,
  PrepWorkspaceMode,
} from '../types/prep'
import {
  PREP_COMPANY_AI_POSTURE_STRENGTH_VALUES,
  PREP_CARD_CONFIDENCE_VALUES,
  PREP_CARD_ROUND_STATUS_VALUES,
  PREP_CATEGORY_VALUES,
  PREP_CONDITIONAL_TONE_VALUES,
  PREP_CONTRACT_VIOLATION_KINDS,
  PREP_CONTRACT_VIOLATION_SEVERITIES,
  PREP_CONTEXT_GAP_PRIORITY_VALUES,
  PREP_INTERVIEWER_LIKELY_ROLE_VALUES,
  PREP_STORY_BLOCK_LABEL_VALUES,
  parsePrepScriptKind,
  isPrepStackAlignmentConfidence,
  resolvePrepCardKind,
} from '../types/prep'
import type { InterviewFormat } from '../types/pipeline'
import { INTERVIEW_FORMAT_VALUES } from '../types/pipeline'
import {
  ensureDurableMetadata,
  stripDurableMetadataPatch,
  touchDurableMetadata,
} from './durableMetadata'
import { resolveStorage } from './storage'
import { createId, slugify } from '../utils/idUtils'
import {
  sanitizeArtifactStalenessReview,
  sanitizeIdentityFields,
  sanitizeIdentityVersion,
} from '../types/artifactMeta'
import { normalizePrepAnswerTemplate } from '../utils/prepAnswerTemplate'
import {
  getPrepPushbackPracticeCardId,
  isPrepPushbackPracticeKey,
  isPrepStoryVariantPracticeKey,
  parsePrepStoryVariantPracticeKey,
} from '../utils/prepCardContent'

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
  answerTemplate?: string
  companyResearch?: string
  companyIntel?: PrepCompanyIntel
  interviewers?: PrepInterviewer[]
  jobDescription?: string
  jdAnalysisId?: string | null
  jdAnalysisGeneratedAt?: string | null
  jdAnalysisModelVersion?: string | null
  jdTextHash?: string | null
  rules?: string[]
  donts?: string[]
  questionsToAsk?: PrepQuestionToAsk[]
  numbersToKnow?: PrepNumbersToKnow
  stackAlignment?: PrepStackAlignmentRow[]
  categoryGuidance?: Record<string, string>
  contextGaps?: PrepContextGap[]
  contextGapAnswers?: Record<string, string>
  contractViolations?: PrepContractViolation[]
  openerCardId?: string
  closerCardId?: string
  roundNumber?: number
  roundDebriefs?: PrepRoundDebrief[]
  generatedAt?: string
  identityVersion?: number
  identityFields?: string[]
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
  addCard: (deckId: string, partial?: PrepCardPatch) => string
  updateCard: (deckId: string, cardId: string, patch: PrepCardPatch) => void
  /** reviewKey may be a card id or a synthetic pushback practice key. */
  recordCardReview: (deckId: string, reviewKey: string, confidence: PrepCardConfidence) => boolean
  duplicateCard: (deckId: string, cardId: string) => void
  removeCard: (deckId: string, cardId: string) => void
  deleteDeck: (deckId: string) => void
  importDecks: (decks: PrepDeck[]) => void
  exportDecks: () => PrepDeck[]
}

interface SanitizeOptions {
  preserveDrafts?: boolean
  defaultTitle?: string
}

type PrepCardSanitizeInput = PrepCardPatch & {
  id?: unknown
  deckId?: unknown
}

type PrepScenarioFields = Partial<
  Pick<PrepScenarioCard, 'whyLikely' | 'decisionTree' | 'phasedFramework'>
>
type PrepCardBaseWithScenarioFields = PrepCardBase & PrepScenarioFields

function sanitizeText(value: unknown, options: SanitizeOptions = {}): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return options.preserveDrafts ? trimmed : trimmed || undefined
}

function sanitizeIdentifier(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

function sanitizeIdentifierList(values: unknown): string[] | undefined {
  if (!Array.isArray(values)) return undefined
  const sanitized = values.flatMap((value) => {
    const id = sanitizeIdentifier(value)
    return id ? [id] : []
  })
  return sanitized.length > 0 ? sanitized : undefined
}

function sanitizeNullableText(value: unknown): string | null {
  return typeof value === 'string' ? value.trim() || null : null
}

function sanitizeRoundNumber(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  const normalized = Math.trunc(value)
  return normalized > 0 ? normalized : undefined
}

function sanitizeCardRoundStatus(value: unknown): PrepCardRoundStatus | undefined {
  const normalized = sanitizeText(value)
  return normalized && PREP_CARD_ROUND_STATUS_VALUES.includes(normalized as PrepCardRoundStatus)
    ? (normalized as PrepCardRoundStatus)
    : undefined
}

function createEmptyCard(
  deckId: string,
  partial: PrepCardSanitizeInput = {},
  options: SanitizeOptions = {},
): PrepCard {
  const category =
    typeof partial.category === 'string' &&
    (PREP_CATEGORY_VALUES as readonly string[]).includes(partial.category)
      ? partial.category
      : 'behavioral'
  const id =
    typeof partial.id === 'string' && partial.id.trim() ? partial.id : createId('prep-card')
  const source =
    partial.source === 'ai' || partial.source === 'manual' || partial.source === 'imported'
      ? partial.source
      : 'manual'
  const kind =
    resolvePrepCardKind(partial.kind, partial) ??
    resolvePrepCardKind(undefined, {
      category,
      tags: partial.tags,
      interviewerIds: partial.interviewerIds,
    }) ??
    'story'

  const baseCard: PrepCardBaseWithScenarioFields = {
    id,
    deckId,
    category,
    title: sanitizeText(partial.title, options) || options.defaultTitle || 'New Prep Card',
    tags: sanitizeStringList(partial.tags, options) ?? [],
    timeBudgetMinutes:
      typeof partial.timeBudgetMinutes === 'number' && Number.isFinite(partial.timeBudgetMinutes)
        ? Math.round(partial.timeBudgetMinutes * 10) / 10
        : undefined,
    notes: sanitizeText(partial.notes, options),
    source,
    company: sanitizeText(partial.company, options),
    role: sanitizeText(partial.role, options),
    vectorId: sanitizeIdentifier(partial.vectorId),
    pipelineEntryId: sanitizeIdentifier(partial.pipelineEntryId) ?? null,
    interviewerIds: sanitizeIdentifierList(partial.interviewerIds),
    updatedAt: now(),
    script: sanitizeText(partial.script, options),
    scriptKind: parsePrepScriptKind(partial.scriptKind),
    scriptLabel: sanitizeText(partial.scriptLabel, options),
    pushbackScript: sanitizeText(partial.pushbackScript, options),
    pushbackLabel: sanitizeText(partial.pushbackLabel, options),
    alternativeTitle: sanitizeText(partial.alternativeTitle, options),
    alternativeScript: sanitizeText(partial.alternativeScript, options),
    warning: sanitizeText(partial.warning, options),
    storyBlocks: sanitizeStoryBlocks(partial.storyBlocks, options),
    storyVariants: sanitizeStoryVariants(partial.storyVariants, options),
    keyPoints: sanitizeStringList(partial.keyPoints, options),
    followUps: sanitizeFollowUps(partial.followUps, options)?.map((item) => ({
      ...item,
      id: item.id ?? createId('prep-follow-up'),
    })),
    deepDives: sanitizeDeepDives(partial.deepDives, options)?.map((item) => ({
      ...item,
      id: item.id ?? createId('prep-deep-dive'),
    })),
    conditionals: sanitizeConditionals(partial.conditionals, options)?.map((item) => ({
      ...item,
      id: item.id ?? createId('prep-conditional'),
    })),
    metrics: sanitizeMetrics(partial.metrics, options),
    tableData: sanitizeTableData(partial.tableData, options),
    whyLikely: sanitizeText(partial.whyLikely, options),
    decisionTree: sanitizeScenarioDecisionTree(partial.decisionTree),
    phasedFramework: sanitizeScenarioPhasedFramework(partial.phasedFramework),
    perRoundState: sanitizeCardRoundState(partial.perRoundState, options),
  }
  return cardWithKind(baseCard, kind, {
    whyLikely: baseCard.whyLikely,
    decisionTree: baseCard.decisionTree,
    phasedFramework: baseCard.phasedFramework,
  })
}

function sanitizeStringList(
  values?: string[],
  options: SanitizeOptions = {},
): string[] | undefined {
  if (!Array.isArray(values)) return undefined
  const sanitized = values.flatMap((value) => (typeof value === 'string' ? [value.trim()] : []))
  if (options.preserveDrafts) {
    return sanitized.length > 0 ? sanitized : undefined
  }
  const filtered = sanitized.filter(Boolean)
  return filtered.length > 0 ? filtered : undefined
}

function sanitizeScenarioDecisionTree(value: unknown): PrepScenarioFields['decisionTree'] {
  if (!Array.isArray(value)) return undefined
  const nodes = value.flatMap((node) => {
    if (!node || typeof node !== 'object') return []
    const record = node as Record<string, unknown>
    const title = sanitizeText(record.title) ?? ''
    if (!title) return []
    const options = Array.isArray(record.options)
      ? record.options.flatMap((option) => {
          if (!option || typeof option !== 'object') return []
          const item = option as Record<string, unknown>
          const optionText = sanitizeText(item.option) ?? ''
          const whenRight = sanitizeText(item.whenRight) ?? ''
          const tradeoff = sanitizeText(item.tradeoff) ?? ''
          return optionText && whenRight && tradeoff
            ? [{ option: optionText, whenRight, tradeoff }]
            : []
        })
      : undefined
    return [
      {
        title,
        options: options && options.length > 0 ? options : undefined,
        recommendation: sanitizeText(record.recommendation),
        trap: sanitizeText(record.trap),
      },
    ]
  })
  return nodes.length > 0 ? nodes : undefined
}

function sanitizeScenarioPhasedFramework(value: unknown): PrepScenarioFields['phasedFramework'] {
  if (!Array.isArray(value)) return undefined
  const phases = value.flatMap((phase) => {
    if (!phase || typeof phase !== 'object') return []
    const record = phase as Record<string, unknown>
    const phaseTitle = sanitizeText(record.phase) ?? ''
    const bullets = sanitizeStringList(record.bullets as string[]) ?? []
    if (!phaseTitle || bullets.length === 0) return []
    return [
      {
        phase: phaseTitle,
        timeframe: sanitizeText(record.timeframe),
        bullets,
      },
    ]
  })
  return phases.length > 0 ? phases : undefined
}

function sanitizeTableData(
  tableData: PrepCard['tableData'] | undefined,
  options: SanitizeOptions = {},
): PrepCard['tableData'] | undefined {
  if (!tableData || typeof tableData !== 'object' || Array.isArray(tableData)) return undefined
  const headers = Array.isArray(tableData.headers)
    ? tableData.headers.map((header) => (typeof header === 'string' ? header.trim() : ''))
    : []
  const rows = Array.isArray(tableData.rows)
    ? tableData.rows.flatMap((row) => {
        if (!Array.isArray(row)) return []
        const cells = row.map((cell) => (typeof cell === 'string' ? cell.trim() : ''))
        return cells.some(Boolean) || options.preserveDrafts ? [cells] : []
      })
    : []
  if (!options.preserveDrafts && !headers.some(Boolean) && rows.length === 0) return undefined
  if (headers.length === 0 && rows.length === 0) return undefined
  return { headers, rows }
}

function sanitizeStringRecord(
  value?: Record<string, string>,
  _options: SanitizeOptions = {},
): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const sanitized = Object.fromEntries(
    Object.entries(value).flatMap(([key, rawValue]) => {
      const normalizedKey = key.trim()
      const normalizedValue = typeof rawValue === 'string' ? rawValue.trim() : ''
      if (!normalizedKey) return []
      if (!normalizedValue) return []
      return [[normalizedKey, normalizedValue]]
    }),
  )
  return Object.keys(sanitized).length > 0 ? sanitized : undefined
}

function sanitizeCompanyIntel(
  companyIntel?: PrepCompanyIntel,
  options: SanitizeOptions = {},
): PrepCompanyIntel | undefined {
  if (!companyIntel || typeof companyIntel !== 'object' || Array.isArray(companyIntel))
    return undefined
  const aiPostureNarrative = sanitizeText(companyIntel.aiPosture?.narrative, options)
  const normalizedAiPostureStrength =
    typeof companyIntel.aiPosture?.strength === 'string'
      ? companyIntel.aiPosture.strength.trim().toLowerCase()
      : ''
  const aiPostureStrength = PREP_COMPANY_AI_POSTURE_STRENGTH_VALUES.includes(
    normalizedAiPostureStrength as (typeof PREP_COMPANY_AI_POSTURE_STRENGTH_VALUES)[number],
  )
    ? (normalizedAiPostureStrength as (typeof PREP_COMPANY_AI_POSTURE_STRENGTH_VALUES)[number])
    : 'unknown'
  const aiPosture =
    aiPostureNarrative !== undefined && aiPostureNarrative.length >= 4
      ? {
          strength: aiPostureStrength,
          narrative: aiPostureNarrative,
          signals: sanitizeStringList(companyIntel.aiPosture?.signals, options),
        }
      : undefined
  const sanitized: PrepCompanyIntel = {
    whatTheyDo: sanitizeText(companyIntel.whatTheyDo, options),
    scale: sanitizeText(companyIntel.scale, options),
    theRole: sanitizeText(companyIntel.theRole, options),
    stack: sanitizeText(companyIntel.stack, options),
    team: sanitizeText(companyIntel.team, options),
    aiPosture,
    other: sanitizeStringRecord(companyIntel.other, options),
  }

  return Object.values(sanitized).some((value) => value !== undefined) ? sanitized : undefined
}

function sanitizeRoundNumbers(values?: number[]): number[] | undefined {
  if (!Array.isArray(values)) return undefined
  const sanitized = Array.from(
    new Set(
      values.flatMap((value) => {
        const round = sanitizeRoundNumber(value)
        return round ? [round] : []
      }),
    ),
  ).sort((left, right) => left - right)
  return sanitized.length > 0 ? sanitized : undefined
}

function sanitizeInterviewers(
  interviewers?: PrepInterviewer[],
  options: SanitizeOptions = {},
): PrepInterviewer[] | undefined {
  if (!Array.isArray(interviewers)) return undefined
  const sanitized = interviewers.flatMap((interviewer) => {
    if (!interviewer || typeof interviewer !== 'object') return []
    const id = sanitizeText(interviewer.id, options)
    if (!id) return []
    const name = sanitizeText(interviewer.name, options) ?? ''
    const title = sanitizeText(interviewer.title, options)
    const linkedInUrl = sanitizeText(interviewer.linkedInUrl, options)
    const providedLikelyRole = PREP_INTERVIEWER_LIKELY_ROLE_VALUES.includes(
      interviewer.likelyRole as (typeof PREP_INTERVIEWER_LIKELY_ROLE_VALUES)[number],
    )
      ? interviewer.likelyRole
      : undefined
    const coachingNote = sanitizeText(interviewer.coachingNote, options)
    const likelyRole = !name && coachingNote ? 'unknown' : providedLikelyRole
    const notes = sanitizeText(interviewer.notes, options)
    const intel = {
      role: sanitizeText(interviewer.intel?.role, options),
      background: sanitizeText(interviewer.intel?.background, options),
      stack: sanitizeText(interviewer.intel?.stack, options),
      caresAbout: sanitizeText(interviewer.intel?.caresAbout, options),
      yourAngle: sanitizeText(interviewer.intel?.yourAngle, options),
      keyTell: sanitizeText(interviewer.intel?.keyTell, options),
      linkedInPositioning: sanitizeText(interviewer.intel?.linkedInPositioning, options),
      education: sanitizeText(interviewer.intel?.education, options),
    }

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
        lineThatLands: sanitizeText(interviewer.lineThatLands, options),
        metInRounds: sanitizeRoundNumbers(interviewer.metInRounds),
        notes,
      },
    ]
  })
  return sanitized.length > 0 ? sanitized : undefined
}

function sanitizeStoryBlocks(
  blocks?: PrepStoryBlock[],
  options: SanitizeOptions = {},
): PrepStoryBlock[] | undefined {
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

function sanitizeStoryVariants(
  variants?: PrepStoryVariant[],
  options: SanitizeOptions = {},
): PrepStoryVariant[] | undefined {
  if (!Array.isArray(variants)) return undefined
  const seenIds = new Set<string>()
  const sanitized = variants.flatMap((variant) => {
    if (!variant || typeof variant !== 'object') return []
    const record = variant as Partial<PrepStoryVariant>
    const storyBlocks = sanitizeStoryBlocks(record.storyBlocks, options)
    const label = typeof record.label === 'string' ? record.label.trim() : ''
    if ((!storyBlocks && !options.preserveDrafts) || (!options.preserveDrafts && !label)) {
      return []
    }
    const stableId = slugify(
      [label, typeof record.roleContext === 'string' ? record.roleContext.trim() : '']
        .filter(Boolean)
        .join(' '),
    )
    const baseId =
      typeof record.id === 'string' && record.id.trim().length > 0
        ? record.id.trim()
        : stableId
          ? `prep-story-variant-${stableId}`
          : createId('prep-story-variant')
    const id = getUniqueStoryVariantId(baseId, seenIds)
    return [
      {
        id,
        label: label || (options.preserveDrafts ? '' : 'Story option'),
        storyBlocks: storyBlocks ?? [],
        keyPoints: sanitizeStringList(record.keyPoints, options),
        roleContext: sanitizeText(record.roleContext, options),
        when: sanitizeText(record.when, options),
      },
    ]
  })
  return sanitized.length > 0 ? sanitized : undefined
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

function sanitizeQuestionsToAsk(
  entries?: PrepQuestionToAsk[],
  options: SanitizeOptions = {},
): PrepQuestionToAsk[] | undefined {
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

function sanitizeCategoryGuidance(
  categoryGuidance?: Record<string, string>,
  options: SanitizeOptions = {},
): Record<string, string> | undefined {
  if (
    !categoryGuidance ||
    typeof categoryGuidance !== 'object' ||
    Array.isArray(categoryGuidance)
  ) {
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

    return [
      {
        round,
        date,
        intel,
        questionsAsked,
        surprises,
        newIntel,
        ...(notes !== undefined ? { notes } : {}),
      },
    ]
  })
  return sanitized.length > 0 ? sanitized : undefined
}

function sanitizeContextGapPriority(value: unknown): PrepContextGapPriority {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return PREP_CONTEXT_GAP_PRIORITY_VALUES.includes(normalized as PrepContextGapPriority)
    ? (normalized as PrepContextGapPriority)
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
    const feedbackTarget =
      typeof record.feedbackTarget === 'string' ? record.feedbackTarget.trim() : ''
    if (!id) return []
    if (options.preserveDrafts) {
      if (!section && !question && !why && !feedbackTarget) return []
    } else if (!section || !question || !why) {
      return []
    }
    return [
      {
        id,
        section,
        question,
        why,
        feedbackTarget: feedbackTarget || undefined,
        priority: sanitizeContextGapPriority(record.priority),
      },
    ]
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

function sanitizeContractViolations(
  violations?: PrepContractViolation[],
): PrepContractViolation[] | undefined {
  if (!Array.isArray(violations)) return undefined
  const sanitized = violations.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const record = item as Partial<PrepContractViolation>
    const kind = typeof record.kind === 'string' ? record.kind.trim() : ''
    const field = typeof record.field === 'string' ? record.field.trim() : ''
    const message = typeof record.message === 'string' ? record.message.trim() : ''
    const severity = typeof record.severity === 'string' ? record.severity.trim() : ''
    if (
      !PREP_CONTRACT_VIOLATION_KINDS.includes(
        kind as (typeof PREP_CONTRACT_VIOLATION_KINDS)[number],
      ) ||
      !field ||
      !message ||
      !PREP_CONTRACT_VIOLATION_SEVERITIES.includes(
        severity as (typeof PREP_CONTRACT_VIOLATION_SEVERITIES)[number],
      )
    ) {
      return []
    }
    const cardId = typeof record.cardId === 'string' ? record.cardId.trim() : ''
    return [
      {
        kind: kind as PrepContractViolation['kind'],
        ...(cardId ? { cardId } : {}),
        field,
        message,
        severity: severity as PrepContractViolation['severity'],
      },
    ]
  })
  return sanitized.length > 0 ? sanitized : undefined
}

function sanitizeFollowUps(
  followUps?: PrepFollowUp[],
  options: SanitizeOptions = {},
): PrepFollowUp[] | undefined {
  if (!Array.isArray(followUps)) return undefined
  const sanitized = followUps.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const record = item as Partial<PrepFollowUp>
    const question = typeof record.question === 'string' ? record.question.trim() : ''
    const answer = typeof record.answer === 'string' ? record.answer.trim() : ''
    const context = typeof record.context === 'string' ? record.context.trim() : undefined
    if (!options.preserveDrafts && !question && !answer) return []
    return [
      {
        id: record.id,
        question,
        answer,
        context: context || undefined,
      },
    ]
  })
  return sanitized.length > 0 ? sanitized : undefined
}

function sanitizeDeepDives(
  deepDives?: PrepDeepDive[],
  options: SanitizeOptions = {},
): PrepDeepDive[] | undefined {
  if (!Array.isArray(deepDives)) return undefined
  const sanitized = deepDives.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const record = item as Partial<PrepDeepDive>
    const title = typeof record.title === 'string' ? record.title.trim() : ''
    const content = typeof record.content === 'string' ? record.content.trim() : ''
    if (!options.preserveDrafts && !title && !content) return []
    return [
      {
        id: record.id,
        title,
        content,
      },
    ]
  })
  return sanitized.length > 0 ? sanitized : undefined
}

function sanitizeConditionals(
  conditionals?: PrepConditional[],
  options: SanitizeOptions = {},
): PrepConditional[] | undefined {
  if (!Array.isArray(conditionals)) return undefined
  const sanitized = conditionals.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const record = item as Partial<PrepConditional>
    const trigger = typeof record.trigger === 'string' ? record.trigger.trim() : ''
    const response = typeof record.response === 'string' ? record.response.trim() : ''
    const toneValue = typeof record.tone === 'string' ? record.tone.trim() : undefined
    const tone = (PREP_CONDITIONAL_TONE_VALUES as readonly string[]).includes(toneValue ?? '')
      ? (toneValue as PrepConditionalTone)
      : undefined
    const normalizedTone = tone ?? 'pivot'

    if (options.preserveDrafts) {
      if (!trigger && !response && !tone) return []
      return [
        {
          id: record.id,
          trigger,
          response,
          tone: normalizedTone,
        },
      ]
    }

    if (!trigger || !response) return []
    return [
      {
        id: record.id,
        trigger,
        response,
        tone: normalizedTone,
      },
    ]
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
    return [
      {
        round,
        status,
        ...(notes !== undefined ? { notes } : {}),
      },
    ]
  })
  return sanitized.length > 0 ? sanitized : undefined
}

function sanitizeMetrics(
  metrics?: PrepMetric[],
  options: SanitizeOptions = {},
): PrepMetric[] | undefined {
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
    return [
      {
        id: typeof record.id === 'string' ? record.id : createId('prep-metric'),
        value,
        label,
      },
    ]
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

    return [
      {
        theirTech,
        yourMatch,
        confidence,
      },
    ]
  })

  return sanitized.length > 0 ? sanitized : undefined
}

function sanitizeCard(
  deckId: string,
  card: PrepCardSanitizeInput,
  options: SanitizeOptions = {},
): PrepCard {
  // AI generation, JSON import, and persisted snapshots can all bypass static typing.
  const baseCard = createEmptyCard(deckId, card, {
    ...options,
    defaultTitle: 'Untitled Prep Card',
  })
  const cardId = isPrepPushbackPracticeKey(baseCard.id) ? createId('prep-card') : baseCard.id

  return {
    ...baseCard,
    id: cardId,
    deckId,
    updatedAt: now(),
  }
}

function cardWithKind(
  base: PrepCardBaseWithScenarioFields,
  kind: PrepCardKind,
  scenarioFields: PrepScenarioFields = {},
): PrepCard {
  if (kind === 'scenario') {
    return {
      ...base,
      kind,
      whyLikely: scenarioFields.whyLikely?.trim() ?? '',
      decisionTree: scenarioFields.decisionTree,
      phasedFramework: scenarioFields.phasedFramework,
    }
  }
  return { ...base, kind }
}

function applyCardPatch(deckId: string, card: PrepCard, patch: PrepCardPatch): PrepCard {
  // Legacy/runtime callers can still provide prohibited identity fields; updateCard keeps them pinned.
  const runtimePatch = patch as PrepCardPatch & { id?: unknown; deckId?: unknown }
  const {
    id: _ignoredId,
    deckId: _ignoredDeckId,
    kind: patchKind,
    scriptKind: patchScriptKind,
    ...safePatch
  } = runtimePatch
  const mergedCard = {
    ...card,
    ...safePatch,
    id: card.id,
    deckId: card.deckId ?? deckId,
  }
  const kind = resolvePrepCardKind(patchKind ?? card.kind, mergedCard) ?? card.kind
  const hasScriptKindPatch = 'scriptKind' in runtimePatch
  const scriptKind = hasScriptKindPatch
    ? patchScriptKind === undefined || patchScriptKind === null
      ? undefined
      : parsePrepScriptKind(patchScriptKind)
    : card.scriptKind
  const runtimeScenarioFields = card as PrepCard & PrepScenarioFields
  const previousScenarioFields: PrepScenarioFields = {
    whyLikely: runtimeScenarioFields.whyLikely,
    decisionTree: runtimeScenarioFields.decisionTree,
    phasedFramework: runtimeScenarioFields.phasedFramework,
  }
  const isScenarioTransition = card.kind !== 'scenario' && kind === 'scenario'
  // Preserve scenario drafts across temporary kind toggles; only the scenario renderer reads them.
  const nextWhyLikely =
    'whyLikely' in safePatch
      ? sanitizeText(safePatch.whyLikely)
      : isScenarioTransition
        ? (previousScenarioFields.whyLikely ?? '[[needs-review]]')
        : previousScenarioFields.whyLikely
  return cardWithKind({ ...mergedCard, scriptKind, updatedAt: now() }, kind, {
    ...previousScenarioFields,
    whyLikely: nextWhyLikely,
    decisionTree:
      'decisionTree' in safePatch
        ? sanitizeScenarioDecisionTree(safePatch.decisionTree)
        : previousScenarioFields.decisionTree,
    phasedFramework:
      'phasedFramework' in safePatch
        ? sanitizeScenarioPhasedFramework(safePatch.phasedFramework)
        : previousScenarioFields.phasedFramework,
  })
}

function shouldKeepStudyProgressEntry(
  cardsById: Map<string, PrepCard>,
  reviewKey: string,
): boolean {
  const storyVariantKey = parsePrepStoryVariantPracticeKey(reviewKey)
  if (storyVariantKey) {
    const card = cardsById.get(storyVariantKey.cardId)
    return Boolean(card?.storyVariants?.some((variant) => variant.id === storyVariantKey.variantId))
  }
  if (isPrepStoryVariantPracticeKey(reviewKey)) return false
  const card = cardsById.get(getPrepPushbackPracticeCardId(reviewKey))
  if (!card) return false
  return !isPrepPushbackPracticeKey(reviewKey) || Boolean(card.pushbackScript?.trim())
}

function sanitizeDeck(
  deck: PrepDeck,
  options: { touch?: boolean; preserveDrafts?: boolean } = {},
): PrepDeck {
  const timestamp = now()
  const cards = deck.cards.map((card) => sanitizeCard(deck.id, card, options))
  const cardsById = new Map(cards.map((card) => [card.id, card]))
  const openerCardId = sanitizeIdentifier(deck.openerCardId)
  const closerCardId = sanitizeIdentifier(deck.closerCardId)
  const resolvedOpenerCardId =
    openerCardId && cardsById.has(openerCardId) ? openerCardId : undefined
  const resolvedCloserCardId =
    closerCardId && closerCardId !== resolvedOpenerCardId && cardsById.has(closerCardId)
      ? closerCardId
      : undefined
  const studyProgress = Object.fromEntries(
    Object.entries(deck.studyProgress ?? {}).flatMap(([reviewKey, state]) => {
      if (
        !shouldKeepStudyProgressEntry(cardsById, reviewKey) ||
        !state ||
        typeof state !== 'object'
      )
        return []
      const record = state as PrepCardStudyState
      return [
        [
          reviewKey,
          {
            confidence: PREP_CARD_CONFIDENCE_VALUES.includes(
              record.confidence as PrepCardConfidence,
            )
              ? record.confidence
              : undefined,
            attempts: Number.isFinite(record.attempts) ? Math.max(0, record.attempts) : 0,
            needsWorkCount: Number.isFinite(record.needsWorkCount)
              ? Math.max(0, record.needsWorkCount)
              : 0,
            lastReviewedAt:
              typeof record.lastReviewedAt === 'string' ? record.lastReviewedAt : undefined,
          } satisfies PrepCardStudyState,
        ],
      ]
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
    roundType:
      typeof deck.roundType === 'string' &&
      INTERVIEW_FORMAT_VALUES.includes(deck.roundType.trim() as InterviewFormat)
        ? (deck.roundType.trim() as InterviewFormat)
        : undefined,
    roundNumber: sanitizeRoundNumber(deck.roundNumber),
    roundDebriefs: sanitizeRoundDebriefs(deck.roundDebriefs, options),
    notes: deck.notes?.trim() || undefined,
    answerTemplate: normalizePrepAnswerTemplate(deck.answerTemplate),
    companyResearch: deck.companyResearch?.trim() || undefined,
    companyIntel: sanitizeCompanyIntel(deck.companyIntel, options),
    interviewers: sanitizeInterviewers(deck.interviewers, options),
    jobDescription: deck.jobDescription?.trim() || undefined,
    jdAnalysisId: sanitizeNullableText(deck.jdAnalysisId),
    jdAnalysisGeneratedAt: sanitizeNullableText(deck.jdAnalysisGeneratedAt),
    jdAnalysisModelVersion: sanitizeNullableText(deck.jdAnalysisModelVersion),
    jdTextHash: sanitizeNullableText(deck.jdTextHash),
    identityVersion: sanitizeIdentityVersion(deck.identityVersion),
    identityFields: sanitizeIdentityFields(deck.identityFields),
    stalenessReview: sanitizeArtifactStalenessReview(deck.stalenessReview),
    rules: sanitizeStringList(deck.rules, options),
    donts: sanitizeStringList(deck.donts, options),
    questionsToAsk: sanitizeQuestionsToAsk(deck.questionsToAsk, options),
    numbersToKnow: sanitizeNumbersToKnow(deck.numbersToKnow, options),
    stackAlignment: sanitizeStackAlignment(deck.stackAlignment),
    categoryGuidance: sanitizeCategoryGuidance(deck.categoryGuidance, options),
    contextGaps: sanitizeContextGaps(deck.contextGaps, options),
    contextGapAnswers: sanitizeContextGapAnswers(deck.contextGapAnswers, options),
    contractViolations: sanitizeContractViolations(deck.contractViolations),
    openerCardId: resolvedOpenerCardId,
    closerCardId: resolvedCloserCardId,
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
    pushbackScript: card.pushbackScript?.trim() || undefined,
    pushbackLabel: card.pushbackLabel?.trim() || undefined,
    alternativeTitle: card.alternativeTitle?.trim() || undefined,
    alternativeScript: card.alternativeScript?.trim() || undefined,
    warning: card.warning?.trim() || undefined,
    timeBudgetMinutes:
      typeof card.timeBudgetMinutes === 'number' && Number.isFinite(card.timeBudgetMinutes)
        ? Math.round(card.timeBudgetMinutes * 10) / 10
        : undefined,
    storyBlocks: sanitizeStoryBlocks(card.storyBlocks),
    storyVariants: sanitizeStoryVariants(card.storyVariants),
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
  const cardsById = new Map(cards.map((card) => [card.id, card]))
  const studyProgress = Object.fromEntries(
    Object.entries(deck.studyProgress ?? {}).flatMap(([reviewKey, state]) => {
      if (
        !shouldKeepStudyProgressEntry(cardsById, reviewKey) ||
        !state ||
        typeof state !== 'object'
      )
        return []
      const record = state as PrepCardStudyState
      return [
        [
          reviewKey,
          {
            confidence: PREP_CARD_CONFIDENCE_VALUES.includes(
              record.confidence as PrepCardConfidence,
            )
              ? record.confidence
              : undefined,
            attempts: Number.isFinite(record.attempts) ? Math.max(0, record.attempts) : 0,
            needsWorkCount: Number.isFinite(record.needsWorkCount)
              ? Math.max(0, record.needsWorkCount)
              : 0,
            lastReviewedAt:
              typeof record.lastReviewedAt === 'string' ? record.lastReviewedAt : undefined,
          } satisfies PrepCardStudyState,
        ],
      ]
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
    roundType:
      typeof deck.roundType === 'string' &&
      INTERVIEW_FORMAT_VALUES.includes(deck.roundType.trim() as InterviewFormat)
        ? (deck.roundType.trim() as InterviewFormat)
        : undefined,
    roundNumber: sanitizeRoundNumber(deck.roundNumber),
    roundDebriefs: sanitizeRoundDebriefs(deck.roundDebriefs),
    notes: deck.notes?.trim() || undefined,
    answerTemplate: normalizePrepAnswerTemplate(deck.answerTemplate),
    companyResearch: deck.companyResearch?.trim() || undefined,
    companyIntel: sanitizeCompanyIntel(deck.companyIntel),
    interviewers: sanitizeInterviewers(deck.interviewers),
    jobDescription: deck.jobDescription?.trim() || undefined,
    jdAnalysisId: sanitizeNullableText(deck.jdAnalysisId),
    jdAnalysisGeneratedAt: sanitizeNullableText(deck.jdAnalysisGeneratedAt),
    jdAnalysisModelVersion: sanitizeNullableText(deck.jdAnalysisModelVersion),
    jdTextHash: sanitizeNullableText(deck.jdTextHash),
    rules: sanitizeStringList(deck.rules),
    donts: sanitizeStringList(deck.donts),
    questionsToAsk: sanitizeQuestionsToAsk(deck.questionsToAsk),
    numbersToKnow: sanitizeNumbersToKnow(deck.numbersToKnow),
    stackAlignment: sanitizeStackAlignment(deck.stackAlignment),
    categoryGuidance: sanitizeCategoryGuidance(deck.categoryGuidance),
    contextGaps: sanitizeContextGaps(deck.contextGaps),
    contextGapAnswers: sanitizeContextGapAnswers(deck.contextGapAnswers),
    contractViolations: sanitizeContractViolations(deck.contractViolations),
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
  return decks.map((deck) =>
    deck.id === deckId ? sanitizeDeck(updater(deck), { touch: true, ...options }) : deck,
  )
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
      state?.activeMode === 'homework' ||
      state?.activeMode === 'live' ||
      state?.activeMode === 'edit'
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
      answerTemplate: input.answerTemplate,
      companyResearch: input.companyResearch,
      companyIntel: input.companyIntel,
      interviewers: input.interviewers,
      jobDescription: input.jobDescription,
      jdAnalysisId: input.jdAnalysisId,
      jdAnalysisGeneratedAt: input.jdAnalysisGeneratedAt,
      jdAnalysisModelVersion: input.jdAnalysisModelVersion,
      jdTextHash: input.jdTextHash,
      rules: input.rules,
      donts: input.donts,
      questionsToAsk: input.questionsToAsk,
      numbersToKnow: input.numbersToKnow,
      stackAlignment: input.stackAlignment,
      categoryGuidance: input.categoryGuidance,
      contextGaps: input.contextGaps,
      contextGapAnswers: input.contextGapAnswers,
      contractViolations: input.contractViolations,
      openerCardId: input.openerCardId,
      closerCardId: input.closerCardId,
      roundNumber: input.roundNumber,
      roundDebriefs: input.roundDebriefs,
      generatedAt: input.generatedAt,
      identityVersion: input.identityVersion,
      identityFields: input.identityFields,
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
    const hasStalenessReviewPatch = 'stalenessReview' in restPatch
    const nextIdentityVersion = sanitizeIdentityVersion(restPatch.identityVersion)
    set((state) => ({
      decks: updateDeckCollection(
        state.decks,
        deckId,
        (deck) => {
          const clearsReviewForNewIdentity =
            !hasStalenessReviewPatch &&
            nextIdentityVersion !== undefined &&
            deck.identityVersion !== nextIdentityVersion &&
            deck.stalenessReview?.reviewedIdentityVersion !== nextIdentityVersion
          return {
            ...deck,
            ...restPatch,
            ...(clearsReviewForNewIdentity ? { stalenessReview: undefined } : {}),
          }
        },
        { preserveDrafts: true },
      ),
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
      decks: updateDeckCollection(
        state.decks,
        deckId,
        (deck) => ({
          ...deck,
          cards: deck.cards.map((card) =>
            card.id === cardId ? applyCardPatch(deckId, card, patch) : card,
          ),
        }),
        { preserveDrafts: true },
      ),
    }))
  },

  recordCardReview: (deckId, reviewKey, confidence) => {
    const deck = get().decks.find((entry) => entry.id === deckId)
    const accepted = deck
      ? shouldKeepStudyProgressEntry(new Map(deck.cards.map((card) => [card.id, card])), reviewKey)
      : false
    if (!accepted) return false

    set((state) => ({
      decks: updateDeckCollection(state.decks, deckId, (deck) => {
        const current = deck.studyProgress?.[reviewKey]
        return {
          ...deck,
          studyProgress: {
            ...(deck.studyProgress ?? {}),
            [reviewKey]: {
              confidence,
              attempts: (current?.attempts ?? 0) + 1,
              needsWorkCount:
                (current?.needsWorkCount ?? 0) + (confidence === 'needs_work' ? 1 : 0),
              lastReviewedAt: now(),
            },
          },
        }
      }),
    }))
    return true
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
          state.activeDeckId === deckId ? (remaining[0]?.id ?? null) : state.activeDeckId,
        activeMode:
          state.activeDeckId === deckId && remaining.length === 0 ? 'edit' : state.activeMode,
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
