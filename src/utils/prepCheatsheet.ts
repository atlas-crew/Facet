import { PREP_CATEGORY_VALUES, isPrepStackAlignmentConfidence } from '../types/prep'
import type { PrepCard, PrepCategory, PrepDeck, PrepMetric, PrepQuestionToAsk, PrepStackAlignmentRow } from '../types/prep'

export type PrepCheatsheetGroup = 'Intel' | 'Openers' | 'Core' | 'Technical' | 'Tactical'
export type PrepOpenerKind = 'tell-me-about-yourself' | 'why-this-role-company' | 'why-did-you-leave' | 'general'

type CanonicalOpenerKind = Exclude<PrepOpenerKind, 'general'>

export interface PrepCheatsheetItem {
  id: string
  title: string
  detail?: string
  cardId?: string
  category?: PrepCategory
  metrics?: PrepMetric[]
  stackAlignment?: PrepStackAlignmentRow[]
}

export interface PrepCheatsheetSection {
  id: string
  title: string
  description: string
  items: PrepCheatsheetItem[]
  timeBudgetMinutes?: number
  guidance?: string
  group: PrepCheatsheetGroup
  sectionCategory?: PrepCategory
  openerKind?: PrepOpenerKind
}

const CATEGORY_GROUPS = {
  overview: 'Intel',
  intel: 'Intel',
  behavioral: 'Core',
  project: 'Core',
  technical: 'Technical',
  situational: 'Technical',
  questions: 'Tactical',
  donts: 'Tactical',
  metrics: 'Tactical',
  warnings: 'Tactical',
} satisfies Record<string, PrepCheatsheetGroup>

const QUESTIONS_GUIDANCE = 'Pick 2-3. Save 8-10 minutes for questions.'
const STATIC_SECTION_BUDGETS: Partial<Record<string, number>> = {
  overview: 1,
  intel: 2,
  questions: 8,
  donts: 1,
  metrics: 2,
  warnings: 1.5,
}
const DEFAULT_CARD_BUDGETS: Record<PrepCategory, number> = {
  opener: 2,
  behavioral: 3,
  technical: 4,
  project: 3,
  metrics: 1.5,
  situational: 3,
}
const NUMBERS_TO_KNOW_GROUPS = {
  candidate: 'Your Work',
  company: 'Their Company',
} as const
const OPENER_KIND_ORDER: CanonicalOpenerKind[] = [
  'tell-me-about-yourself',
  'why-did-you-leave',
  'why-this-role-company',
]
export const OPENER_PREFERRED_SHORTCUTS: Record<CanonicalOpenerKind, string> = {
  'tell-me-about-yourself': '3',
  'why-this-role-company': '4',
  'why-did-you-leave': '5',
}
const OPENER_KIND_META: Record<
  CanonicalOpenerKind,
  {
    titlePattern: RegExp
    tags: string[]
    canonicalTitle: string
    description: string
    guidance: string
    order: number
  }
> = {
  'tell-me-about-yourself': {
    titlePattern: /\b(tell me about yourself|walk me through your background|introduce yourself)\b/u,
    tags: ['tell-me-about-yourself', 'intro', 'tell-me-about-you', 'background'],
    canonicalTitle: 'Tell me about yourself',
    description: 'Your opening pitch and the through-line that frames the rest of the interview.',
    guidance: 'Lead with the through-line, keep it crisp, and land on why this role is the logical next step.',
    order: 0,
  },
  'why-this-role-company': {
    titlePattern: /\bwhy\b(?!.*\bleav\w*\b).*\b(role|company|team|join|interested)\b/u,
    tags: ['why-this-role', 'why-this-company', 'why-this-role-company', 'motivation'],
    canonicalTitle: 'Why this role/company?',
    description: 'Your bridge from your background into this role, this team, and this company.',
    guidance: 'Tie your strongest evidence to the role and company specifics instead of giving a generic motivation answer.',
    order: 1,
  },
  'why-did-you-leave': {
    titlePattern: /\b(why did you leave|why are you leaving|why leave|why you left|why you are leaving)\b/u,
    tags: ['departure', 'why-did-you-leave', 'leaving'],
    canonicalTitle: 'Why did you leave your last role?',
    description: 'A concise, positive departure answer that stays future-focused and low-drama.',
    guidance: 'Keep it honest, brief, and forward-looking. Explain the pull toward this role more than the push away from the last one.',
    order: 2,
  },
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function sanitizeText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function sanitizeStringList(values: unknown): string[] {
  if (!Array.isArray(values)) return []
  return values.flatMap((value) => {
    const normalized = sanitizeText(value)
    return normalized ? [normalized] : []
  })
}

function sanitizeQuestionsToAsk(values: unknown): PrepQuestionToAsk[] {
  if (!Array.isArray(values)) return []
  return values.flatMap((value) => {
    if (!isRecord(value)) return []
    const question = sanitizeText(value.question)
    if (!question) return []
    return [{ question, context: sanitizeText(value.context) ?? '' }]
  })
}

function buildCardItems(cards: PrepCard[]): PrepCheatsheetItem[] {
  return cards.map((card) => ({
    id: card.id,
    title: card.title,
    detail: card.script ?? card.notes ?? card.warning ?? undefined,
    cardId: card.id,
    category: card.category,
  }))
}

function buildQuestionsItems(questions: PrepQuestionToAsk[]): PrepCheatsheetItem[] {
  const seen = new Map<string, number>()
  return questions.map((entry) => ({
    id: makeUniqueItemId('question-', entry.question, seen),
    title: entry.question,
    detail: entry.context || undefined,
  }))
}

function buildDontsItems(donts: string[]): PrepCheatsheetItem[] {
  const seen = new Map<string, number>()
  return donts.map((entry) => ({
    id: makeUniqueItemId('dont-', entry, seen),
    title: entry,
  }))
}

function pickValidMetrics(metrics?: PrepMetric[]): PrepMetric[] {
  return metrics?.filter((metric) => metric.value.trim() && metric.label.trim()) ?? []
}

function buildNumbersToKnowItems(deck: PrepDeck): PrepCheatsheetItem[] {
  const items: PrepCheatsheetItem[] = []
  const candidateMetrics = pickValidMetrics(deck.numbersToKnow?.candidate)
  const companyMetrics = pickValidMetrics(deck.numbersToKnow?.company)

  if (candidateMetrics.length > 0) {
    items.push({
      id: 'numbers-your-work',
      title: NUMBERS_TO_KNOW_GROUPS.candidate,
      metrics: candidateMetrics,
    })
  }

  if (companyMetrics.length > 0) {
    items.push({
      id: 'numbers-their-company',
      title: NUMBERS_TO_KNOW_GROUPS.company,
      metrics: companyMetrics,
    })
  }

  return items
}

function buildStackAlignmentItems(deck: PrepDeck): PrepCheatsheetItem[] {
  const rows = (deck.stackAlignment ?? []).filter((row) => (
    row.theirTech.trim() && row.yourMatch.trim() && isPrepStackAlignmentConfidence(row.confidence)
  ))

  if (rows.length === 0) return []

  return [{
    id: 'stack-alignment',
    title: 'Their Stack vs Your Match',
    detail: 'Use this to anchor where you are strongest, adjacent, or need explicit gap framing.',
    stackAlignment: rows,
  }]
}

function makeUniqueItemId(prefix: string, value: string, seen: Map<string, number>): string {
  const base = slugifyId(value)
  const count = seen.get(base) ?? 0
  seen.set(base, count + 1)
  return count === 0 ? prefix + base : prefix + base + '-' + count
}

function makeStableSectionId(prefix: string, value: string, seen: Set<string>): string {
  const normalizedPrefix = prefix.endsWith('-') ? prefix : prefix + '-'
  const sluggedValue = slugifyId(value)
  const valueWithoutPrefix = sluggedValue.startsWith(normalizedPrefix)
    ? sluggedValue.slice(normalizedPrefix.length) || 'item'
    : sluggedValue
  const baseId = normalizedPrefix + valueWithoutPrefix
  if (!seen.has(baseId)) {
    seen.add(baseId)
    return baseId
  }

  let count = 1
  while (seen.has(baseId + '-' + count)) {
    count += 1
  }

  const nextId = baseId + '-' + count
  seen.add(nextId)
  return nextId
}

function slugifyId(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return normalized || 'item'
}

function resolveGuidance(deckGuidance: string | undefined, defaultGuidance: string | undefined): string | undefined {
  const primary = sanitizeText(deckGuidance)
  if (primary) return primary
  return sanitizeText(defaultGuidance) ?? undefined
}

function sumCardTimeBudgets(cards: PrepCard[], fallbackBudget: number): number | undefined {
  if (cards.length === 0) return undefined

  const budgetMinutes = cards.reduce((total, card) => total + (card.timeBudgetMinutes ?? fallbackBudget), 0)
  return Math.round(budgetMinutes * 10) / 10
}

function truncate(text: string, maxLength: number): string {
  const normalized = text.trim()
  if (normalized.length <= maxLength) return normalized
  return normalized.slice(0, maxLength - 1).trimEnd() + '…'
}

function normalizeOpenerTitle(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[’'"]/gu, '')
    .replace(/[\u2010-\u2015]/gu, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function withSectionMeta(
  deck: PrepDeck,
  section: {
    id: string
    title: string
    description: string
    items: PrepCheatsheetItem[]
    timeBudgetMinutes?: number
    guidance?: string
    group: PrepCheatsheetGroup
    sectionCategory?: PrepCategory
    openerKind?: PrepOpenerKind
  },
): PrepCheatsheetSection {
  // Dedicated opener sections carry their own ids so they can keep distinct guidance even when multiple cards map to the opener family.
  const guidanceKey = section.sectionCategory && section.sectionCategory !== 'opener'
    ? section.sectionCategory
    : section.id
  return {
    ...section,
    guidance: resolveGuidance(deck.categoryGuidance?.[guidanceKey], section.guidance),
  }
}

function classifyOpenerCard(card: PrepCard): PrepOpenerKind {
  const normalizedTags = new Set((card.tags ?? []).map((tag) => tag.trim().toLowerCase()).filter(Boolean))
  const normalizedTitle = normalizeOpenerTitle(card.title)

  for (const kind of OPENER_KIND_ORDER) {
    const meta = OPENER_KIND_META[kind]
    if (meta.tags.some((tag) => normalizedTags.has(tag))) {
      return kind
    }
  }

  for (const kind of OPENER_KIND_ORDER) {
    const meta = OPENER_KIND_META[kind]
    if (meta.titlePattern.test(normalizedTitle)) {
      return kind
    }
  }

  return 'general'
}

function getOpenerSectionMeta(card: PrepCard, id: string): {
  id: string
  title: string
  description: string
  guidance: string
  order: number
  openerKind: PrepOpenerKind
} {
  const kind = classifyOpenerCard(card)

  if (kind !== 'general') {
    const meta = OPENER_KIND_META[kind]
    return {
      id,
      title: meta.canonicalTitle,
      description: meta.description,
      guidance: meta.guidance,
      order: meta.order,
      openerKind: kind,
    }
  }

  return {
    id,
    title: card.title,
    description: 'A predictable opener question you should be ready to answer early in the conversation.',
    guidance: 'Answer directly, then bridge back to the strongest evidence you want the interviewer to remember.',
    order: 3,
    openerKind: 'general',
  }
}

export function derivePrepCheatsheetSections(deck: PrepDeck): PrepCheatsheetSection[] {
  // Imported decks can briefly exist before store normalization restores cards. Keep cheatsheet derivation resilient during that window.
  const cards = Array.isArray(deck.cards) ? deck.cards : []
  const cardsByCategory = cards.reduce<Record<PrepCategory, PrepCard[]>>(
    (map, card) => {
      const category = PREP_CATEGORY_VALUES.includes(card.category) ? card.category : 'behavioral'
      map[category].push(card)
      return map
    },
    {
      opener: [],
      behavioral: [],
      technical: [],
      project: [],
      metrics: [],
      situational: [],
    },
  )

  const overviewItems: PrepCheatsheetItem[] = [
    { id: 'company', title: deck.company || 'Target company' },
    { id: 'role', title: deck.role || 'Target role' },
  ]

  if (deck.vectorId) {
    overviewItems.push({ id: 'vector', title: 'Vector: ' + deck.vectorId })
  }
  if (deck.positioning) {
    overviewItems.push({ id: 'positioning', title: 'Positioning', detail: deck.positioning })
  }

  const sections: PrepCheatsheetSection[] = [
    withSectionMeta(deck, {
      id: 'overview',
      title: 'Overview',
      description: 'High-signal context to anchor the conversation before you start answering.',
      items: overviewItems,
      timeBudgetMinutes: STATIC_SECTION_BUDGETS.overview,
      group: CATEGORY_GROUPS.overview,
    }),
  ]

  if (deck.companyResearch || deck.jobDescription) {
    sections.push(
      withSectionMeta(deck, {
        id: 'intel',
        title: 'Company Intel',
        description: 'Role context and research notes worth scanning right before the interview.',
        items: [
          ...(deck.companyResearch
            ? [{ id: 'research', title: 'Research notes', detail: truncate(deck.companyResearch, 320) }]
            : []),
          ...(deck.skillMatch
            ? [{ id: 'skill-match', title: 'Skill match', detail: truncate(deck.skillMatch, 220) }]
            : []),
          ...(deck.notes
            ? [{ id: 'notes', title: 'Working notes', detail: truncate(deck.notes, 220) }]
            : []),
          ...(deck.jobDescription
            ? [{ id: 'jd', title: 'Job description snapshot', detail: truncate(deck.jobDescription, 320) }]
            : []),
        ],
        timeBudgetMinutes: STATIC_SECTION_BUDGETS.intel,
        group: CATEGORY_GROUPS.intel,
      }),
    )
  }

  const openerDeckGuidance = sanitizeText(deck.categoryGuidance?.opener)
  const openerSectionIds = new Set<string>()
  const openerSections = cardsByCategory.opener
    .map((card) => {
      const sectionId = makeStableSectionId('opener-', card.id, openerSectionIds)
      const meta = getOpenerSectionMeta(card, sectionId)
      const guidance = [meta.guidance, openerDeckGuidance]
        .filter((value, valueIndex, values): value is string => Boolean(value) && values.indexOf(value) === valueIndex)
        .join(' ')

      return {
        section: withSectionMeta(deck, {
          id: meta.id,
          title: meta.title,
          description: meta.description,
          items: buildCardItems([card]),
          timeBudgetMinutes: card.timeBudgetMinutes ?? DEFAULT_CARD_BUDGETS.opener,
          guidance,
          group: 'Openers',
          sectionCategory: 'opener',
          openerKind: meta.openerKind,
        }),
        order: meta.order,
        title: meta.title,
      }
    })
    .sort((left, right) => left.order - right.order || left.title.localeCompare(right.title))
    .map(({ section }) => section)

  sections.push(...openerSections)

  const categorySections: Record<Exclude<PrepCategory, 'metrics' | 'opener'>, { title: string; description: string }> = {
    behavioral: { title: 'Behavioral Stories', description: 'Leadership, collaboration, conflict, and ownership examples.' },
    project: { title: 'Projects', description: 'Project-specific stories and execution details.' },
    technical: { title: 'Technical Topics', description: 'Architecture, systems, debugging, and implementation depth.' },
    situational: { title: 'Situational Drills', description: 'Scenario questions, tradeoffs, and judgment calls.' },
  }

  for (const category of Object.keys(categorySections) as Array<Exclude<PrepCategory, 'metrics' | 'opener'>>) {
    const config = categorySections[category]
    const items = buildCardItems(cardsByCategory[category])
    if (items.length === 0) continue
    sections.push(
      withSectionMeta(deck, {
        id: category,
        title: config.title,
        description: config.description,
        items,
        timeBudgetMinutes: sumCardTimeBudgets(cardsByCategory[category], DEFAULT_CARD_BUDGETS[category]),
        group: CATEGORY_GROUPS[category],
        sectionCategory: category,
      }),
    )
  }

  const sanitizedQuestions = sanitizeQuestionsToAsk(deck.questionsToAsk)
  if (sanitizedQuestions.length > 0) {
    sections.push(
      withSectionMeta(deck, {
        id: 'questions',
        title: 'Questions to Ask',
        description: 'Prepared questions to ask the interviewer.',
        items: buildQuestionsItems(sanitizedQuestions),
        timeBudgetMinutes: STATIC_SECTION_BUDGETS.questions,
        guidance: QUESTIONS_GUIDANCE,
        group: CATEGORY_GROUPS.questions,
      }),
    )
  }

  const sanitizedDonts = sanitizeStringList(deck.donts)
  if (sanitizedDonts.length > 0) {
    sections.push(
      withSectionMeta(deck, {
        id: 'donts',
        title: "Don'ts",
        description: 'Personalized anti-patterns to avoid while you are live in the room.',
        items: buildDontsItems(sanitizedDonts),
        timeBudgetMinutes: STATIC_SECTION_BUDGETS.donts,
        group: CATEGORY_GROUPS.donts,
      }),
    )
  }

  // Metrics is intentionally rendered after the tactical questions/donts block.
  const numberItems = buildNumbersToKnowItems(deck)
  const stackAlignmentItems = buildStackAlignmentItems(deck)
  const metricItems = [...numberItems, ...stackAlignmentItems, ...buildCardItems(cardsByCategory.metrics)]
  if (metricItems.length > 0) {
    let metricsTitle = 'Metrics'
    if (numberItems.length > 0) metricsTitle = 'Numbers to Know'
    else if (stackAlignmentItems.length > 0) metricsTitle = 'Stack Alignment'
    sections.push(
      withSectionMeta(deck, {
        id: 'metrics',
        title: metricsTitle,
        description: 'Numbers and measurable outcomes you should keep ready.',
        items: metricItems,
        timeBudgetMinutes:
          sumCardTimeBudgets(cardsByCategory.metrics, DEFAULT_CARD_BUDGETS.metrics) ?? STATIC_SECTION_BUDGETS.metrics,
        group: CATEGORY_GROUPS.metrics,
        sectionCategory: 'metrics',
      }),
    )
  }

  const warningItems = cards.flatMap((card) =>
    card.warning
      ? [{ id: card.id + '-warning', title: card.title, detail: card.warning, cardId: card.id, category: card.category }]
      : [],
  )
  if (warningItems.length > 0) {
    sections.push(
      withSectionMeta(deck, {
        id: 'warnings',
        title: 'Risks and Reminders',
        description: 'Cautions to keep in view while you are live in the room.',
        items: warningItems,
        timeBudgetMinutes: STATIC_SECTION_BUDGETS.warnings,
        group: CATEGORY_GROUPS.warnings,
      }),
    )
  }

  return sections
}
