import { PREP_CATEGORY_VALUES } from '../types/prep'
import type { PrepCard, PrepCategory, PrepDeck } from '../types/prep'

export interface PrepCheatsheetItem {
  id: string
  title: string
  detail?: string
  cardId?: string
  category?: PrepCategory
}

export interface PrepCheatsheetSection {
  id: string
  title: string
  description: string
  items: PrepCheatsheetItem[]
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

function truncate(text: string, maxLength: number): string {
  const normalized = text.trim()
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`
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
    overviewItems.push({ id: 'vector', title: `Vector: ${deck.vectorId}` })
  }
  if (deck.positioning) {
    overviewItems.push({ id: 'positioning', title: 'Positioning', detail: deck.positioning })
  }

  const sections: PrepCheatsheetSection[] = [
    {
      id: 'overview',
      title: 'Overview',
      description: 'High-signal context to anchor the conversation before you start answering.',
      items: overviewItems,
    },
  ]

  if (deck.companyResearch || deck.jobDescription) {
    sections.push({
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
    })
  }

  const categorySections: Array<[PrepCategory, string, string]> = [
    ['opener', 'Openers', 'Quick framing, tell-me-about-yourself, and conversation starters.'],
    ['behavioral', 'Behavioral Stories', 'Leadership, collaboration, conflict, and ownership examples.'],
    ['technical', 'Technical Topics', 'Architecture, systems, debugging, and implementation depth.'],
    ['project', 'Projects', 'Project-specific stories and execution details.'],
    ['metrics', 'Metrics', 'Numbers and measurable outcomes you should keep ready.'],
    ['situational', 'Situational Drills', 'Scenario questions, tradeoffs, and judgment calls.'],
  ]

  for (const [category, title, description] of categorySections) {
    const items = buildCardItems(cardsByCategory[category])
    if (items.length === 0) continue
    sections.push({
      id: category,
      title,
      description,
      items,
    })
  }

  const warningItems = deck.cards.flatMap((card) =>
    card.warning
      ? [{ id: `${card.id}-warning`, title: card.title, detail: card.warning, cardId: card.id, category: card.category }]
      : [],
  )
  if (warningItems.length > 0) {
    sections.push({
      id: 'warnings',
      title: 'Risks and Reminders',
      description: 'Cautions to keep in view while you are live in the room.',
      items: warningItems,
    })
  }

  return sections
}
