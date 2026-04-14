// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'
import {
  migratePrepState,
  usePrepStore,
} from '../store/prepStore'
import { resolveStorage } from '../store/storage'
import { DEFAULT_LOCAL_WORKSPACE_ID } from '../types/durable'

describe('prepStore', () => {
  beforeEach(() => {
    resolveStorage().removeItem('facet-prep-workspace')
    resolveStorage().removeItem('facet-prep-data')
    usePrepStore.setState({ decks: [], activeDeckId: null, activeMode: 'edit' })
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
    expect(state.activeMode).toBe('edit')
    expect(state.decks[0].title).toBe('Acme Staff Prep')
    expect(state.decks[0].company).toBe('Acme')
    expect(state.decks[0].durableMeta?.workspaceId).toBe(DEFAULT_LOCAL_WORKSPACE_ID)
    expect(state.decks[0].durableMeta?.revision).toBe(0)
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
    expect(deck.durableMeta?.workspaceId).toBe(DEFAULT_LOCAL_WORKSPACE_ID)
    expect(deck.durableMeta?.revision).toBe(4)
  })

  it('tracks homework mode and card review progress in shared prep state', () => {
    const deckId = usePrepStore.getState().createDeck({
      title: 'Prep',
      company: 'Acme',
      role: 'Staff Engineer',
      vectorId: 'backend',
      cards: [],
    })

    const cardId = usePrepStore.getState().addCard(deckId, {
      title: 'Leadership example',
      category: 'behavioral',
      tags: ['leadership'],
    })

    usePrepStore.getState().setActiveMode('homework')
    usePrepStore.getState().recordCardReview(deckId, cardId, 'needs_work')

    let deck = usePrepStore.getState().decks[0]
    expect(usePrepStore.getState().activeMode).toBe('homework')
    expect(deck.studyProgress?.[cardId]).toMatchObject({
      confidence: 'needs_work',
      attempts: 1,
      needsWorkCount: 1,
    })

    usePrepStore.getState().removeCard(deckId, cardId)
    deck = usePrepStore.getState().decks[0]
    expect(usePrepStore.getState().activeMode).toBe('edit')
    expect(deck.studyProgress).toEqual({})
  })

  it('ignores review updates for cards that are not in the deck', () => {
    const deckId = usePrepStore.getState().createDeck({
      title: 'Prep',
      company: 'Acme',
      role: 'Staff Engineer',
      vectorId: 'backend',
      cards: [],
    })

    usePrepStore.getState().recordCardReview(deckId, 'missing-card', 'okay')

    expect(usePrepStore.getState().decks[0].studyProgress).toEqual({})
  })

  it('resets back to edit mode when the active deck is deleted', () => {
    const deckId = usePrepStore.getState().createDeck({
      title: 'Prep',
      company: 'Acme',
      role: 'Staff Engineer',
      vectorId: 'backend',
      cards: [],
    })

    usePrepStore.getState().setActiveMode('live')
    usePrepStore.getState().deleteDeck(deckId)

    expect(usePrepStore.getState().activeDeckId).toBeNull()
    expect(usePrepStore.getState().activeMode).toBe('edit')
  })

  it('updateDeck ignores incoming durable metadata patches and preserves ownership metadata', () => {
    const deckId = usePrepStore.getState().createDeck({
      title: 'Prep',
      company: 'Acme',
      role: 'Staff Engineer',
      vectorId: 'backend',
      cards: [],
    })

    const before = usePrepStore.getState().decks[0]

    usePrepStore.getState().updateDeck(deckId, {
      company: 'Initech',
      durableMeta: {
        workspaceId: 'ignored-workspace',
        tenantId: 'tenant-x',
        userId: 'user-y',
        schemaVersion: 5,
        revision: 18,
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
      },
    })

    const updated = usePrepStore.getState().decks[0]
    expect(updated.company).toBe('Initech')
    expect(updated.durableMeta?.workspaceId).toBe(DEFAULT_LOCAL_WORKSPACE_ID)
    expect(updated.durableMeta?.createdAt).toBe(before.durableMeta?.createdAt)
    expect(updated.durableMeta?.revision).toBe((before.durableMeta?.revision ?? 0) + 1)
  })

  it('migrates persisted decks and safely defaults invalid state', () => {
    const migrated = migratePrepState({
      decks: [
        {
          id: 'prep-deck-legacy',
          title: ' Legacy Prep ',
          company: ' Acme ',
          role: ' Staff Engineer ',
          vectorId: ' backend ',
          pipelineEntryId: null,
          updatedAt: '2025-01-02T00:00:00.000Z',
          cards: [],
        },
      ],
    })

    expect(migrated.decks).toHaveLength(1)
    expect(migrated.decks[0].title).toBe('Legacy Prep')
    expect(migrated.decks[0].vectorId).toBe('backend')
    expect(migrated.decks[0].durableMeta?.workspaceId).toBe(DEFAULT_LOCAL_WORKSPACE_ID)
    expect(migrated.activeDeckId).toBe('prep-deck-legacy')
    expect(migrated.activeMode).toBe('edit')

    expect(migratePrepState('bad-state').decks).toEqual([])
  })

  it('resets active mode to edit when imported decks have no cards', () => {
    usePrepStore.getState().setActiveMode('live')

    usePrepStore.getState().importDecks([
      {
        id: 'prep-deck-imported',
        title: 'Imported',
        company: 'Acme',
        role: 'Staff Engineer',
        vectorId: 'backend',
        pipelineEntryId: null,
        updatedAt: '2025-01-02T00:00:00.000Z',
        cards: [],
      },
    ])

    expect(usePrepStore.getState().activeMode).toBe('edit')
  })
})
