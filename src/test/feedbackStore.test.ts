import { describe, expect, it } from 'vitest'
import { createFeedbackCollection } from '../store/feedbackStore'
import type { CoverLetterFeedbackEvent, PrepFeedbackEvent } from '../types/feedback'

type TestFeedbackEvent = PrepFeedbackEvent | CoverLetterFeedbackEvent

describe('createFeedbackCollection', () => {
  const createCollection = () => {
    let id = 0
    let tick = 0

    return createFeedbackCollection<TestFeedbackEvent>([], {
      createEventId: () => `fbe-${++id}`,
      now: () => `2026-05-08T09:30:0${tick++}.000Z`,
    })
  }

  it('creates feedback events for each domain with generated identity and timestamps', () => {
    const feedback = createCollection()

    const prepEvent = feedback.addEvent({
      domain: 'prep',
      artifactId: 'deck-1',
      targetId: 'card-1',
      rating: 'down',
      reason: 'This overstates Kubernetes depth.',
      payload: {
        skillDepth: { name: 'Kubernetes', suggestedDepth: 'architectural' },
      },
      appliedToIdentity: false,
    })

    const letterEvent = feedback.addEvent({
      domain: 'cover-letter',
      artifactId: 'letter-1',
      rating: 'up',
      payload: {
        voice: { facet: 'tone', note: 'This is the right level of direct.' },
      },
      appliedToIdentity: false,
    })

    expect(prepEvent).toMatchObject({
      id: 'fbe-1',
      domain: 'prep',
      artifactId: 'deck-1',
      targetId: 'card-1',
      createdAt: '2026-05-08T09:30:00.000Z',
      updatedAt: '2026-05-08T09:30:00.000Z',
    })
    expect(letterEvent).toMatchObject({
      id: 'fbe-2',
      domain: 'cover-letter',
      artifactId: 'letter-1',
      createdAt: '2026-05-08T09:30:01.000Z',
    })
    expect(feedback.events).toHaveLength(2)
  })

  it('uses default id and timestamp factories when options are omitted', () => {
    const feedback = createFeedbackCollection<PrepFeedbackEvent>()

    const event = feedback.addEvent({
      domain: 'prep',
      artifactId: 'deck-defaults',
      rating: 'up',
      appliedToIdentity: false,
    })

    expect(event.id).toMatch(/^fbe-/)
    expect(Number.isNaN(Date.parse(event.createdAt))).toBe(false)
    expect(event.updatedAt).toBe(event.createdAt)
  })

  it('queries feedback across domains by artifact and unreflected writeback state', () => {
    const feedback = createCollection()
    const prepEvent = feedback.addEvent({
      domain: 'prep',
      artifactId: 'deck-1',
      rating: 'down',
      payload: { calibration: { group: 'platform', note: 'Not a cluster admin.' } },
      appliedToIdentity: false,
    })
    feedback.addEvent({
      domain: 'cover-letter',
      artifactId: 'letter-1',
      rating: 'up',
      payload: { positioning: { aspect: 'security', note: 'Keep this angle.' } },
      appliedToIdentity: false,
    })

    feedback.markApplied(prepEvent.id, 12)

    expect(feedback.getEventsForArtifact('deck-1')).toEqual([
      expect.objectContaining({ id: prepEvent.id, domain: 'prep' }),
    ])
    expect(feedback.getUnreflected('prep')).toEqual([
      expect.objectContaining({
        id: prepEvent.id,
        appliedToIdentity: true,
        appliedAtVersion: 12,
      }),
    ])
    expect(feedback.getUnreflected('cover-letter')).toEqual([])
  })

  it('excludes same-domain unapplied events from unreflected feedback', () => {
    const feedback = createCollection()
    const unapplied = feedback.addEvent({
      domain: 'prep',
      artifactId: 'deck-1',
      rating: 'down',
      appliedToIdentity: false,
    })
    const applied = feedback.addEvent({
      domain: 'prep',
      artifactId: 'deck-1',
      targetId: 'card-2',
      rating: 'up',
      appliedToIdentity: true,
      appliedAtVersion: 6,
    })

    expect(feedback.getUnreflected('prep')).toEqual([expect.objectContaining({ id: applied.id })])
    expect(feedback.getUnreflected('prep')).not.toEqual([
      expect.objectContaining({ id: unapplied.id }),
    ])
  })

  it('tracks which regenerated artifact first reflected applied feedback', () => {
    const feedback = createCollection()
    const prepEvent = feedback.addEvent({
      domain: 'prep',
      artifactId: 'deck-1',
      targetId: 'card-1',
      rating: 'down',
      payload: { storyFraming: { cardId: 'card-1', note: 'Lead with the migration.' } },
      appliedToIdentity: true,
      appliedAtVersion: 4,
    })

    feedback.markReflectedInArtifact([prepEvent.id], 'deck-2')

    expect(feedback.getUnreflected('prep', 'deck-2')).toEqual([])
    expect(feedback.getUnreflected('prep', 'deck-3')).toEqual([
      expect.objectContaining({
        id: prepEvent.id,
        reflectedInArtifactId: 'deck-2',
      }),
    ])
  })

  it('hydrates seeded events into artifact and unreflected queries', () => {
    const feedback = createFeedbackCollection<TestFeedbackEvent>([
      {
        id: 'fbe-seeded-1',
        domain: 'prep',
        artifactId: 'deck-seeded',
        rating: 'down',
        payload: { skillDepth: { name: 'Rust', suggestedDepth: 'conceptual' } },
        appliedToIdentity: true,
        appliedAtVersion: 2,
        createdAt: '2026-05-08T09:00:00.000Z',
      },
      {
        id: 'fbe-seeded-2',
        domain: 'cover-letter',
        artifactId: 'letter-seeded',
        rating: 'up',
        appliedToIdentity: false,
        createdAt: '2026-05-08T09:01:00.000Z',
      },
    ])

    expect(feedback.events).toHaveLength(2)
    expect(feedback.getEventsForArtifact('deck-seeded')).toEqual([
      expect.objectContaining({ id: 'fbe-seeded-1' }),
    ])
    expect(feedback.getUnreflected('prep')).toEqual([
      expect.objectContaining({ id: 'fbe-seeded-1', appliedAtVersion: 2 }),
    ])
    expect(feedback.getUnreflected('cover-letter')).toEqual([])
  })

  it('leaves events unchanged when mutation ids are unknown', () => {
    const feedback = createCollection()
    const event = feedback.addEvent({
      domain: 'prep',
      artifactId: 'deck-1',
      rating: 'down',
      appliedToIdentity: false,
    })
    const before = feedback.events

    expect(() => feedback.markApplied('ghost', 3)).not.toThrow()
    expect(() => feedback.markReflectedInArtifact(['ghost'], 'deck-2')).not.toThrow()

    expect(feedback.events).toEqual(before)
    expect(feedback.events[0]).toEqual(event)
  })

  it('updates writeback timestamps when marking feedback applied', () => {
    const feedback = createCollection()
    const event = feedback.addEvent({
      domain: 'prep',
      artifactId: 'deck-1',
      rating: 'down',
      appliedToIdentity: false,
    })

    feedback.markApplied(event.id, 8)

    expect(feedback.events[0]).toMatchObject({
      id: event.id,
      appliedToIdentity: true,
      appliedAtVersion: 8,
      updatedAt: '2026-05-08T09:30:01.000Z',
    })
  })

  it('overwrites applied identity version and timestamp on repeated writeback', () => {
    const feedback = createCollection()
    const event = feedback.addEvent({
      domain: 'prep',
      artifactId: 'deck-1',
      rating: 'down',
      appliedToIdentity: false,
    })

    feedback.markApplied(event.id, 4)
    feedback.markApplied(event.id, 9)

    expect(feedback.events[0]).toMatchObject({
      id: event.id,
      appliedToIdentity: true,
      appliedAtVersion: 9,
      updatedAt: '2026-05-08T09:30:02.000Z',
    })
  })

  it('preserves reflection while advancing writeback state on re-apply', () => {
    const feedback = createCollection()
    const event = feedback.addEvent({
      domain: 'prep',
      artifactId: 'deck-1',
      rating: 'down',
      appliedToIdentity: true,
      appliedAtVersion: 4,
    })

    feedback.markReflectedInArtifact([event.id], 'deck-2')
    feedback.markApplied(event.id, 9)

    expect(feedback.events[0]).toMatchObject({
      id: event.id,
      appliedToIdentity: true,
      appliedAtVersion: 9,
      reflectedInArtifactId: 'deck-2',
      updatedAt: '2026-05-08T09:30:02.000Z',
    })
  })

  it('marks a batch reflected without overwriting the first reflected artifact', () => {
    const feedback = createCollection()
    const first = feedback.addEvent({
      domain: 'prep',
      artifactId: 'deck-1',
      rating: 'down',
      appliedToIdentity: true,
      appliedAtVersion: 4,
    })
    const second = feedback.addEvent({
      domain: 'prep',
      artifactId: 'deck-1',
      targetId: 'card-2',
      rating: 'up',
      appliedToIdentity: true,
      appliedAtVersion: 4,
    })

    feedback.markReflectedInArtifact([first.id, second.id], 'deck-2')
    const firstReflectedAt = feedback.events.find((event) => event.id === first.id)?.updatedAt
    feedback.markReflectedInArtifact([first.id], 'deck-3')

    expect(feedback.events).toEqual([
      expect.objectContaining({
        id: first.id,
        reflectedInArtifactId: 'deck-2',
        updatedAt: '2026-05-08T09:30:02.000Z',
      }),
      expect.objectContaining({
        id: second.id,
        reflectedInArtifactId: 'deck-2',
        updatedAt: '2026-05-08T09:30:02.000Z',
      }),
    ])
    expect(feedback.events.find((event) => event.id === first.id)?.updatedAt).toBe(firstReflectedAt)
  })

  it('reflects only matching ids in mixed batches', () => {
    const feedback = createCollection()
    const first = feedback.addEvent({
      domain: 'prep',
      artifactId: 'deck-1',
      rating: 'down',
      appliedToIdentity: true,
      appliedAtVersion: 4,
    })
    const untouched = feedback.addEvent({
      domain: 'prep',
      artifactId: 'deck-1',
      targetId: 'card-2',
      rating: 'up',
      appliedToIdentity: true,
      appliedAtVersion: 4,
    })
    const third = feedback.addEvent({
      domain: 'prep',
      artifactId: 'deck-1',
      targetId: 'card-3',
      rating: 'down',
      appliedToIdentity: true,
      appliedAtVersion: 4,
    })
    const untouchedBefore = feedback.events.find((event) => event.id === untouched.id)

    feedback.markReflectedInArtifact([first.id, third.id], 'deck-2')

    expect(feedback.events.find((event) => event.id === first.id)).toMatchObject({
      reflectedInArtifactId: 'deck-2',
    })
    expect(feedback.events.find((event) => event.id === third.id)).toMatchObject({
      reflectedInArtifactId: 'deck-2',
    })
    expect(feedback.events.find((event) => event.id === untouched.id)).toEqual(untouchedBefore)
  })

  it('returns immutable event snapshots from collection accessors', () => {
    const feedback = createCollection()
    const event = feedback.addEvent({
      domain: 'prep',
      artifactId: 'deck-1',
      rating: 'down',
      appliedToIdentity: true,
      appliedAtVersion: 4,
    })
    const snapshot = feedback.events as TestFeedbackEvent[]

    snapshot.push({
      ...event,
      id: 'fbe-injected',
      artifactId: 'deck-1',
      rating: 'up',
    })
    snapshot[0]!.rating = 'up'

    expect(feedback.getEventsForArtifact('deck-1')).toEqual([
      expect.objectContaining({
        id: event.id,
        rating: 'down',
      }),
    ])
    expect(feedback.getEventsForArtifact('deck-1')).toHaveLength(1)
  })
})
