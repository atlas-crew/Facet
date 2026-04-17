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
      roundType: 'hm-screen',
      donts: [' Ramble ', '', 'Skip the ask'],
      questionsToAsk: [
        { question: ' Which team owns this? ', context: ' Clarify collaboration scope ' },
        { question: ' ', context: 'missing' },
      ],
      numbersToKnow: {
        candidate: [
          { value: ' 38% ', label: ' Incident reduction ' },
        ],
        company: [
          { value: ' 3 ', label: ' Core priorities ' },
        ],
      },
      categoryGuidance: {
        behavioral: ' Lead with scope ',
        '': 'ignored',
      },
      cards: [],
    })

    const state = usePrepStore.getState()
    expect(state.activeDeckId).toBe(deckId)
    expect(state.activeMode).toBe('edit')
    expect(state.decks[0].title).toBe('Acme Staff Prep')
    expect(state.decks[0].company).toBe('Acme')
    expect(state.decks[0].roundType).toBe('hm-screen')
    expect(state.decks[0].donts).toEqual(['Ramble', 'Skip the ask'])
    expect(state.decks[0].questionsToAsk).toEqual([
      { question: 'Which team owns this?', context: 'Clarify collaboration scope' },
    ])
    expect(state.decks[0].numbersToKnow).toEqual({
      candidate: [expect.objectContaining({ value: '38%', label: 'Incident reduction' })],
      company: [expect.objectContaining({ value: '3', label: 'Core priorities' })],
    })
    expect(state.decks[0].categoryGuidance).toEqual({ behavioral: 'Lead with scope' })
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

  it('assigns stable ids to new conditionals created from partial card data', () => {
    const deckId = usePrepStore.getState().createDeck({
      title: 'Prep',
      company: 'Acme',
      role: 'Staff Engineer',
      vectorId: 'backend',
      cards: [],
    })

    const cardId = usePrepStore.getState().addCard(deckId, {
      title: 'Pushback handling',
      category: 'behavioral',
      tags: ['leadership'],
      conditionals: [
        { trigger: 'If they push on scope', response: 'Name the decision you owned.', tone: 'pivot' },
      ],
    })

    const card = usePrepStore.getState().decks[0].cards.find((entry) => entry.id === cardId)
    expect(card?.conditionals).toEqual([
      expect.objectContaining({
        id: expect.stringMatching(/^prep-conditional-/),
        trigger: 'If they push on scope',
        response: 'Name the decision you owned.',
        tone: 'pivot',
      }),
    ])
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
          numbersToKnow: {
            candidate: [{ value: ' 12 ', label: ' Pipelines ' }],
          },
          updatedAt: '2025-01-02T00:00:00.000Z',
          cards: [],
        },
      ],
    })

    expect(migrated.decks).toHaveLength(1)
    expect(migrated.decks[0].title).toBe('Legacy Prep')
    expect(migrated.decks[0].vectorId).toBe('backend')
    expect(migrated.decks[0].numbersToKnow).toEqual({
      candidate: [expect.objectContaining({ value: '12', label: 'Pipelines' })],
    })
    expect(migrated.decks[0].durableMeta?.workspaceId).toBe(DEFAULT_LOCAL_WORKSPACE_ID)
    expect(migrated.activeDeckId).toBe('prep-deck-legacy')
    expect(migrated.activeMode).toBe('edit')

    expect(migratePrepState('bad-state').decks).toEqual([])
  })

  it('migrates malformed nested card payloads without throwing', () => {
    const migrated = migratePrepState({
      decks: [
        {
          id: 'prep-deck-malformed',
          title: 'Malformed',
          company: 'Acme',
          role: 'Staff Engineer',
          vectorId: 'backend',
          pipelineEntryId: null,
          updatedAt: '2025-01-02T00:00:00.000Z',
          cards: [
            {
              id: 'prep-card-malformed',
              category: 'behavioral',
              title: 'Handle malformed data',
              tags: ['cleanup'],
              followUps: [
                null,
                { question: ' Why now? ', answer: ' Because it was blocking startup. ', context: 9 },
              ],
              deepDives: [
                null,
                { title: ' Detail ', content: ' Keep the startup path resilient. ' },
              ],
              conditionals: [
                null,
                { trigger: ' If they push on scope ', response: ' Clarify where you led directly. ', tone: ' pivot ' as never },
                { trigger: 'Skip me', response: ' ', tone: 'trap' as never },
              ],
              metrics: [
                null,
                { value: ' 38% ', label: ' Incident reduction ' },
              ],
            },
          ],
        },
      ],
    })

    const card = migrated.decks[0].cards[0]
    expect(card.followUps).toEqual([
      expect.objectContaining({
        question: 'Why now?',
        answer: 'Because it was blocking startup.',
        context: undefined,
      }),
    ])
    expect(card.deepDives).toEqual([
      expect.objectContaining({
        title: 'Detail',
        content: 'Keep the startup path resilient.',
      }),
    ])
    expect(card.conditionals).toEqual([
      expect.objectContaining({
        trigger: 'If they push on scope',
        response: 'Clarify where you led directly.',
        tone: 'pivot',
      }),
    ])
    expect(card.metrics).toEqual([
      expect.objectContaining({
        value: '38%',
        label: 'Incident reduction',
      }),
    ])
  })

  it('strips draft-only rows from exported decks while preserving them in edit state', () => {
    const deckId = usePrepStore.getState().createDeck({
      title: 'Prep',
      company: 'Acme',
      role: 'Staff Engineer',
      vectorId: 'backend',
      donts: [],
      questionsToAsk: [],
      cards: [{
        id: 'card-1',
        category: 'behavioral',
        title: 'Leadership story',
        tags: [],
      }],
    })

    usePrepStore.getState().updateDeck(deckId, {
      donts: ['Do not ramble', ''],
      questionsToAsk: [
        { question: 'What does success look like?', context: 'Align on goals' },
        { question: '', context: '' },
      ],
      numbersToKnow: {
        candidate: [
          { id: 'deck-metric-1', value: '45%', label: 'Faster delivery' },
          { id: 'deck-metric-2', value: '', label: '' },
        ],
      },
    })

    usePrepStore.getState().updateCard(deckId, 'card-1', {
      keyPoints: ['Lead with scope', ''],
      storyBlocks: [
        { label: 'problem', text: 'Inherited a brittle release process.' },
        { label: 'result', text: '' },
      ],
      conditionals: [
        { id: 'conditional-1', trigger: 'If they push on ownership', response: 'Name the decision you owned.', tone: 'pivot' },
        { id: 'conditional-2', trigger: 'If they ask a trap question', response: '', tone: 'trap' },
      ],
      metrics: [
        { id: 'metric-1', value: '45%', label: 'Faster delivery' },
        { id: 'metric-2', value: '', label: '' },
      ],
    })

    const editingDeck = usePrepStore.getState().decks[0]
    expect(editingDeck.donts).toEqual(['Do not ramble', ''])
    expect(editingDeck.questionsToAsk).toEqual([
      { question: 'What does success look like?', context: 'Align on goals' },
      { question: '', context: '' },
    ])
    expect(editingDeck.numbersToKnow).toEqual({
      candidate: [
        { id: 'deck-metric-1', value: '45%', label: 'Faster delivery' },
        { id: 'deck-metric-2', value: '', label: '' },
      ],
    })
    expect(editingDeck.cards[0].keyPoints).toEqual(['Lead with scope', ''])
    expect(editingDeck.cards[0].storyBlocks).toEqual([
      { label: 'problem', text: 'Inherited a brittle release process.' },
      { label: 'result', text: '' },
    ])
    expect(editingDeck.cards[0].conditionals).toEqual([
      { id: 'conditional-1', trigger: 'If they push on ownership', response: 'Name the decision you owned.', tone: 'pivot' },
      { id: 'conditional-2', trigger: 'If they ask a trap question', response: '', tone: 'trap' },
    ])
    expect(editingDeck.cards[0].metrics).toEqual([
      { id: 'metric-1', value: '45%', label: 'Faster delivery' },
      { id: 'metric-2', value: '', label: '' },
    ])

    const [exportedDeck] = usePrepStore.getState().exportDecks()
    expect(exportedDeck.donts).toEqual(['Do not ramble'])
    expect(exportedDeck.questionsToAsk).toEqual([
      { question: 'What does success look like?', context: 'Align on goals' },
    ])
    expect(exportedDeck.numbersToKnow).toEqual({
      candidate: [
        { id: 'deck-metric-1', value: '45%', label: 'Faster delivery' },
      ],
    })
    expect(exportedDeck.cards[0].keyPoints).toEqual(['Lead with scope'])
    expect(exportedDeck.cards[0].storyBlocks).toEqual([
      { label: 'problem', text: 'Inherited a brittle release process.' },
    ])
    expect(exportedDeck.cards[0].conditionals).toEqual([
      { id: 'conditional-1', trigger: 'If they push on ownership', response: 'Name the decision you owned.', tone: 'pivot' },
    ])
    expect(exportedDeck.cards[0].metrics).toEqual([
      { id: 'metric-1', value: '45%', label: 'Faster delivery' },
    ])
  })

  it('sanitizes study progress during migration and export', () => {
    const migrated = migratePrepState({
      decks: [
        {
          id: 'prep-deck-progress',
          title: 'Progress Deck',
          company: 'Acme',
          role: 'Staff Engineer',
          vectorId: 'backend',
          pipelineEntryId: null,
          updatedAt: '2025-01-02T00:00:00.000Z',
          cards: [
            {
              id: 'prep-card-valid',
              category: 'behavioral',
              title: 'Valid card',
              tags: [],
            },
          ],
          studyProgress: {
            'prep-card-valid': {
              confidence: 'not-real',
              attempts: -4,
              needsWorkCount: -2,
              lastReviewedAt: 42,
            },
            'prep-card-stale': {
              confidence: 'needs_work',
              attempts: 7,
              needsWorkCount: 3,
              lastReviewedAt: '2025-01-03T00:00:00.000Z',
            },
          },
        },
      ],
    })

    expect(migrated.decks[0].studyProgress).toEqual({
      'prep-card-valid': {
        confidence: undefined,
        attempts: 0,
        needsWorkCount: 0,
        lastReviewedAt: undefined,
      },
    })

    const deckId = usePrepStore.getState().createDeck({
      title: 'Export Deck',
      company: 'Acme',
      role: 'Staff Engineer',
      vectorId: 'backend',
      cards: [{
        id: 'prep-card-export',
        category: 'behavioral',
        title: 'Export card',
        tags: [],
      }],
    })

    const deck = usePrepStore.getState().decks[0]
    usePrepStore.setState({
      decks: [
        {
          ...deck,
          studyProgress: {
            'prep-card-export': {
              confidence: 'okay',
              attempts: -1,
              needsWorkCount: -9,
              lastReviewedAt: '2025-01-04T00:00:00.000Z',
            },
            'missing-card': {
              confidence: 'needs_work',
              attempts: 4,
              needsWorkCount: 4,
              lastReviewedAt: '2025-01-05T00:00:00.000Z',
            },
          },
        },
      ],
      activeDeckId: deckId,
      activeMode: 'edit',
    })

    const [exportedDeck] = usePrepStore.getState().exportDecks()
    expect(exportedDeck.studyProgress).toEqual({
      'prep-card-export': {
        confidence: 'okay',
        attempts: 0,
        needsWorkCount: 0,
        lastReviewedAt: '2025-01-04T00:00:00.000Z',
      },
    })
  })

  it('sanitizes rich card and deck fields during import', () => {
    usePrepStore.getState().importDecks([
      {
        id: 'prep-deck-rich',
        title: ' Rich Deck ',
        company: ' Acme ',
        role: ' Staff Engineer ',
        vectorId: ' backend ',
        pipelineEntryId: null,
        roundType: ' hm-screen ' as never,
        donts: [' Be vague ', '', null as never, 4 as never],
        questionsToAsk: [
          { question: ' What breaks first? ', context: ' Expose scale tradeoffs ' },
          { question: 'Missing context', context: ' ' },
          null as never,
        ],
        categoryGuidance: {
          behavioral: ' Use one example ',
          ' ': 'ignored',
          metrics: 12 as never,
        } as never,
        updatedAt: '2025-01-02T00:00:00.000Z',
        cards: [
          {
            id: 'prep-card-rich',
            category: 'behavioral',
            title: ' Leadership story ',
            tags: [' leadership ', ''],
            script: ' Lead with the scope ',
            scriptLabel: ' Say This ',
            storyBlocks: [
              { label: 'problem', text: ' Service health was slipping ' },
              { label: 'oops' as never, text: 'invalid label' },
              { label: 'result', text: ' ' },
              { label: 'solution', text: 42 as never },
              null as never,
            ],
            keyPoints: [' Own the incident ', ' ', 'Close with the metric', null as never],
            followUps: [
              {
                question: 'What changed?',
                answer: 'We moved the rollout window.',
                context: ' Why the decision mattered ',
              },
            ],
            conditionals: [
              { trigger: ' If they push on ownership ', response: ' Name the decisions you made ', tone: ' pivot ' as never },
              { trigger: 'If they keep pressing', response: ' ', tone: 'trap' as never },
              { trigger: 'Bad tone', response: 'Still keep the answer', tone: 'bad' as never },
            ],
          },
        ],
      },
    ])

    const deck = usePrepStore.getState().decks[0]
    const card = deck.cards[0]

    expect(deck.roundType).toBe('hm-screen')
    expect(deck.donts).toEqual(['Be vague'])
    expect(deck.questionsToAsk).toEqual([
      { question: 'What breaks first?', context: 'Expose scale tradeoffs' },
    ])
    expect(deck.categoryGuidance).toEqual({ behavioral: 'Use one example' })
    expect(card.scriptLabel).toBe('Say This')
    expect(card.storyBlocks).toEqual([{ label: 'problem', text: 'Service health was slipping' }])
    expect(card.keyPoints).toEqual(['Own the incident', 'Close with the metric'])
    expect(card.followUps).toEqual([
      expect.objectContaining({
        question: 'What changed?',
        answer: 'We moved the rollout window.',
        context: 'Why the decision mattered',
      }),
    ])
    expect(card.conditionals).toEqual([
      expect.objectContaining({
        trigger: 'If they push on ownership',
        response: 'Name the decisions you made',
        tone: 'pivot',
      }),
      expect.objectContaining({
        trigger: 'Bad tone',
        response: 'Still keep the answer',
        tone: 'pivot',
      }),
    ])
  })

  it('preserves draft-rich rows through updateDeck and updateCard while editing', () => {
    const deckId = usePrepStore.getState().createDeck({
      title: 'Prep',
      company: 'Acme',
      role: 'Staff Engineer',
      vectorId: 'backend',
      cards: [],
    })

    const cardId = usePrepStore.getState().addCard(deckId, {
      title: 'Original card',
      category: 'behavioral',
      tags: [],
    })

    usePrepStore.getState().updateDeck(deckId, {
      roundType: ' system-design ' as never,
      donts: [' Be generic ', ''] as never,
      questionsToAsk: [
        { question: ' Which partner team joins? ', context: ' Surface collaboration scope ' },
        { question: ' ', context: ' ' },
      ] as never,
      categoryGuidance: {
        project: ' Name the tradeoff ',
        behavioral: ' ',
      } as never,
    })

    usePrepStore.getState().updateCard(deckId, cardId, {
      scriptLabel: ' Lead With ',
      keyPoints: [' Keep it crisp ', ''] as never,
      storyBlocks: [
        { label: 'problem', text: ' Latency spiked ' },
        { label: 'result', text: ' ' },
      ] as never,
      conditionals: [
        { trigger: ' If they push on scope ', response: ' ', tone: 'pivot' as never },
        { trigger: 'If they ask a trap question', response: 'Reframe to the decision.', tone: 'trap' as never },
      ] as never,
    })

    const deck = usePrepStore.getState().decks[0]
    const card = deck.cards[0]

    expect(deck.roundType).toBe('system-design')
    expect(deck.donts).toEqual(['Be generic', ''])
    expect(deck.questionsToAsk).toEqual([
      { question: 'Which partner team joins?', context: 'Surface collaboration scope' },
      { question: '', context: '' },
    ])
    expect(deck.categoryGuidance).toEqual({ project: 'Name the tradeoff', behavioral: '' })
    expect(card.scriptLabel).toBe('Lead With')
    expect(card.keyPoints).toEqual(['Keep it crisp', ''])
    expect(card.storyBlocks).toEqual([
      { label: 'problem', text: 'Latency spiked' },
      { label: 'result', text: '' },
    ])
    expect(card.conditionals).toEqual([
      { id: expect.stringMatching(/^prep-conditional-/), trigger: 'If they push on scope', response: '', tone: 'pivot' },
      { id: expect.stringMatching(/^prep-conditional-/), trigger: 'If they ask a trap question', response: 'Reframe to the decision.', tone: 'trap' },
    ])
  })

  it('sanitizes rich fields through replaceDeckCards', () => {
    const deckId = usePrepStore.getState().createDeck({
      title: 'Prep',
      company: 'Acme',
      role: 'Staff Engineer',
      vectorId: 'backend',
      cards: [],
    })

    const cardId = usePrepStore.getState().addCard(deckId, {
      title: 'Original card',
      category: 'behavioral',
      tags: [],
    })

    usePrepStore.getState().replaceDeckCards(deckId, [
      {
        id: cardId,
        deckId,
        category: 'behavioral',
        title: ' Replacement card ',
        tags: [' ownership ', ''],
        keyPoints: [' Close with the metric ', 9 as never] as never,
        storyBlocks: [
          { label: 'result', text: ' Reduced incidents by 38% ' },
          { label: 'note', text: '' },
        ] as never,
        conditionals: [
          { trigger: ' If they push on ownership ', response: ' Name the part you led. ', tone: 'pivot' as never },
          { trigger: 'If they trap you', response: ' ', tone: 'trap' as never },
        ] as never,
      },
    ] as never)

    const deck = usePrepStore.getState().decks[0]
    const card = deck.cards[0]

    expect(card.title).toBe('Replacement card')
    expect(card.tags).toEqual(['ownership'])
    expect(card.keyPoints).toEqual(['Close with the metric'])
    expect(card.storyBlocks).toEqual([{ label: 'result', text: 'Reduced incidents by 38%' }])
    expect(card.conditionals).toEqual([
      { id: expect.stringMatching(/^prep-conditional-/), trigger: 'If they push on ownership', response: 'Name the part you led.', tone: 'pivot' },
    ])
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
