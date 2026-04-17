import { PREP_CATEGORY_VALUES } from '../types/prep'
import type { PrepCard, PrepCategory, PrepDeck, PrepMetric, PrepQuestionToAsk } from '../types/prep'

export type PrepCheatsheetGroup = 'Intel' | 'Core' | 'Technical' | 'Tactical'

export interface PrepCheatsheetItem {
  id: string
  title: string
  detail?: string
  cardId?: string
  category?: PrepCategory
  metrics?: PrepMetric[]
}

export interface PrepCheatsheetSection {
  id: string
  title: string
  description: string
  items: PrepCheatsheetItem[]
  guidance?: string
  group: PrepCheatsheetGroup
}

const CATEGORY_GROUPS = {
  overview: 'Intel',
  intel: 'Intel',
  opener: 'Core',
  behavioral: 'Core',
  project: 'Core',
  technical: 'Technical',
  situational: 'Technical',
  questions: 'Tactical',
  donts: 'Tactical',
  metrics: 'Tactical',
  warnings: 'Tactical',
} satisfies Record<string, PrepCheatsheetGroup>

type PrepSectionId = keyof typeof CATEGORY_GROUPS

const QUESTIONS_GUIDANCE = 'Pick 2-3. Save 8-10 minutes for questions.'
const NUMBERS_TO_KNOW_GROUPS = {
  candidate: 'Your Work',
  company: 'Their Company',
} as const

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

function makeUniqueItemId(prefix: string, value: string, seen: Map<string, number>): string {
  const base = slugifyId(value)
  const count = seen.get(base) ?? 0
  seen.set(base, count + 1)
  return count === 0 ? prefix + base : prefix + base + '-' + count
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

function truncate(text: string, maxLength: number): string {
  const normalized = text.trim()
  if (normalized.length <= maxLength) return normalized
  return normalized.slice(0, maxLength - 1).trimEnd() + '…'
}

function withSectionMeta(
  deck: PrepDeck,
  section: {
    id: PrepSectionId
    title: string
    description: string
    items: PrepCheatsheetItem[]
    guidance?: string
  },
): PrepCheatsheetSection {
  return {
    ...section,
    group: CATEGORY_GROUPS[section.id],
    guidance: resolveGuidance(deck.categoryGuidance?.[section.id], section.guidance),
  }
}

export function derivePrepCheatsheetSections(deck: PrepDeck): PrepCheatsheetSection[] {
  const cardsByCategory = deck.cards.reduce<Record<PrepCategory, PrepCard[]>>(
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
      }),
    )
  }

  const categorySections = {
    opener: { title: 'Openers', description: 'Quick framing, tell-me-about-yourself, and conversation starters.' },
    behavioral: { title: 'Behavioral Stories', description: 'Leadership, collaboration, conflict, and ownership examples.' },
    project: { title: 'Projects', description: 'Project-specific stories and execution details.' },
    technical: { title: 'Technical Topics', description: 'Architecture, systems, debugging, and implementation depth.' },
    situational: { title: 'Situational Drills', description: 'Scenario questions, tradeoffs, and judgment calls.' },
  } satisfies Record<Exclude<PrepCategory, 'metrics'>, { title: string; description: string }>

  for (const category of Object.keys(categorySections) as Array<Exclude<PrepCategory, 'metrics'>>) {
    const config = categorySections[category]
    const items = buildCardItems(cardsByCategory[category])
    if (items.length === 0) continue
    sections.push(
      withSectionMeta(deck, {
        id: category,
        title: config.title,
        description: config.description,
        items,
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
        guidance: QUESTIONS_GUIDANCE,
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
      }),
    )
  }

  // Metrics is intentionally rendered after the tactical questions/donts block.
  const numberItems = buildNumbersToKnowItems(deck)
  const metricItems = [...numberItems, ...buildCardItems(cardsByCategory.metrics)]
  if (metricItems.length > 0) {
    sections.push(
      withSectionMeta(deck, {
        id: 'metrics',
        title: numberItems.length > 0 ? 'Numbers to Know' : 'Metrics',
        description: 'Numbers and measurable outcomes you should keep ready.',
        items: metricItems,
      }),
    )
  }

  const warningItems = deck.cards.flatMap((card) =>
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
      }),
    )
  }

  return sections
}
