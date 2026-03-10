// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'
import { usePrepStore } from '../store/prepStore'

describe('prepStore', () => {
  beforeEach(() => {
    localStorage.clear()
    usePrepStore.setState({ decks: [], activeDeckId: null })
  })

  it('creates a deck and makes it active', () => {
    const deckId = usePrepStore.getState().createDeck({
      title: 'Acme Staff Prep',
      company: 'Acme',
      role: 'Staff Engineer',
      vectorId: 'backend',
      cards: [],
    })

    const state = usePrepStore.getState()
    expect(state.activeDeckId).toBe(deckId)
    expect(state.decks[0].title).toBe('Acme Staff Prep')
    expect(state.decks[0].company).toBe('Acme')
  })

  it('adds, updates, duplicates, and removes cards', () => {
    const deckId = usePrepStore.getState().createDeck({
      title: 'Prep',
      company: 'Acme',
      role: 'Staff Engineer',
      vectorId: 'backend',
      cards: [],
    })

    const cardId = usePrepStore.getState().addCard(deckId, {
      title: 'Tell me about yourself',
      category: 'opener',
      tags: ['backend'],
    })

    usePrepStore.getState().updateCard(deckId, cardId, {
      notes: 'Lead with scale and systems ownership.',
    })
    usePrepStore.getState().duplicateCard(deckId, cardId)

    let deck = usePrepStore.getState().decks[0]
    expect(deck.cards).toHaveLength(2)
    expect(deck.cards.some((card) => card.notes?.includes('scale'))).toBe(true)

    usePrepStore.getState().removeCard(deckId, cardId)
    deck = usePrepStore.getState().decks[0]
    expect(deck.cards).toHaveLength(1)
    expect(deck.cards[0].title).toContain('Copy')
  })
})
