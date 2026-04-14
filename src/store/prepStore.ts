import { create } from 'zustand'
import type {
  PrepCard,
  PrepCardConfidence,
  PrepCardStudyState,
  PrepDeck,
  PrepCategory,
  PrepWorkspaceMode,
} from '../types/prep'
import { PREP_CARD_CONFIDENCE_VALUES, PREP_CATEGORY_VALUES } from '../types/prep'
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
  vectorId: string
  pipelineEntryId?: string | null
  companyUrl?: string
  skillMatch?: string
  positioning?: string
  notes?: string
  companyResearch?: string
  jobDescription?: string
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

function createEmptyCard(deckId: string, partial: Partial<PrepCard> = {}): PrepCard {
  return {
    id: partial.id ?? createId('prep-card'),
    deckId,
    category: partial.category ?? 'behavioral',
    title: partial.title?.trim() || 'New Prep Card',
    tags: partial.tags ?? [],
    notes: partial.notes?.trim() || undefined,
    source: partial.source ?? 'manual',
    company: partial.company?.trim() || undefined,
    role: partial.role?.trim() || undefined,
    vectorId: partial.vectorId,
    pipelineEntryId: partial.pipelineEntryId ?? null,
    updatedAt: now(),
    script: partial.script?.trim() || undefined,
    warning: partial.warning?.trim() || undefined,
    followUps: partial.followUps?.filter((item) => item.question || item.answer),
    deepDives: partial.deepDives?.filter((item) => item.title || item.content),
    metrics: partial.metrics?.filter((item) => item.value || item.label),
    tableData: partial.tableData,
  }
}

function sanitizeCard(deckId: string, card: PrepCard): PrepCard {
  const category = PREP_CATEGORY_VALUES.includes(card.category) ? card.category : 'behavioral'

  return {
    ...createEmptyCard(deckId, card),
    id: card.id,
    deckId,
    category,
    title: card.title.trim() || 'Untitled Prep Card',
    tags: card.tags.map((tag) => tag.trim()).filter(Boolean),
    followUps: card.followUps?.map((item) => ({
      id: item.id ?? createId('prep-follow-up'),
      question: item.question.trim(),
      answer: item.answer.trim(),
    })),
    deepDives: card.deepDives?.map((item) => ({
      id: item.id ?? createId('prep-deep-dive'),
      title: item.title.trim(),
      content: item.content.trim(),
    })),
    metrics: card.metrics?.map((item) => ({
      id: item.id ?? createId('prep-metric'),
      value: item.value.trim(),
      label: item.label.trim(),
    })),
    updatedAt: now(),
  }
}

function sanitizeDeck(deck: PrepDeck, options: { touch?: boolean } = {}): PrepDeck {
  const timestamp = now()
  const cards = deck.cards.map((card) => sanitizeCard(deck.id, card))
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
    vectorId: deck.vectorId.trim(),
    pipelineEntryId: deck.pipelineEntryId ?? null,
    companyUrl: deck.companyUrl?.trim() || undefined,
    skillMatch: deck.skillMatch?.trim() || undefined,
    positioning: deck.positioning?.trim() || undefined,
    notes: deck.notes?.trim() || undefined,
    companyResearch: deck.companyResearch?.trim() || undefined,
    jobDescription: deck.jobDescription?.trim() || undefined,
    generatedAt: deck.generatedAt,
    updatedAt: timestamp,
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
): PrepDeck[] {
  return decks.map((deck) => (
    deck.id === deckId ? sanitizeDeck(updater(deck), { touch: true }) : deck
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
          notes: input.notes,
          companyResearch: input.companyResearch,
          jobDescription: input.jobDescription,
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
          decks: updateDeckCollection(state.decks, deckId, (deck) => ({ ...deck, ...restPatch })),
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
              card.id === cardId ? sanitizeCard(deckId, { ...card, ...patch }) : card,
            ),
          })),
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

      exportDecks: () => get().decks,
    }))

export const DEFAULT_PREP_CARD_CATEGORY: PrepCategory = 'behavioral'
