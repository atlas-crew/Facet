import { describe, expect, it } from 'vitest'
import {
  claimPrepDeckSectionCardIds,
  createPrepDeckSectionId,
  makeUniqueId,
} from '../utils/prepDeckSections'

describe('prepDeckSections helpers', () => {
  it('creates unique ids from provided ids and title fallbacks', () => {
    const seenIds = new Set<string>()

    expect(makeUniqueId('section', seenIds)).toBe('section')
    expect(makeUniqueId('section', seenIds)).toBe('section-2')
    expect(makeUniqueId('section', seenIds)).toBe('section-3')
    expect(createPrepDeckSectionId({ id: ' custom ', title: 'Ignored', seenIds })).toBe('custom')
    expect(createPrepDeckSectionId({ id: 'custom', title: 'Ignored', seenIds })).toBe('custom-2')
    expect(createPrepDeckSectionId({ title: 'Deep Dives', seenIds })).toBe(
      'prep-deck-section-deep-dives',
    )
    expect(createPrepDeckSectionId({ title: 'Deep Dives', seenIds })).toBe(
      'prep-deck-section-deep-dives-2',
    )
    expect(createPrepDeckSectionId({ id: '   ', title: 'Stories', seenIds })).toBe(
      'prep-deck-section-stories',
    )
    expect(createPrepDeckSectionId({ id: null, title: 'Stories', seenIds })).toBe(
      'prep-deck-section-stories-2',
    )

    const emptySlugId = createPrepDeckSectionId({ title: '!!!', seenIds })
    const secondEmptySlugId = createPrepDeckSectionId({ title: '!!!', seenIds })
    expect(emptySlugId).toMatch(/^prep-deck-section-/)
    expect(emptySlugId.length).toBeGreaterThan('prep-deck-section-'.length)
    expect(secondEmptySlugId).toMatch(/^prep-deck-section-/)
    expect(secondEmptySlugId).not.toBe(emptySlugId)
  })

  it('claims section card ids once across sections', () => {
    const availableCardIds = new Set(['card-a', 'card-b', 'card-c'])
    const claimedCardIds = new Set<string>()

    expect(claimPrepDeckSectionCardIds(undefined, availableCardIds, claimedCardIds)).toBeUndefined()
    expect(claimPrepDeckSectionCardIds([], availableCardIds, claimedCardIds)).toBeUndefined()
    expect(claimedCardIds.size).toBe(0)
    expect(
      claimPrepDeckSectionCardIds(
        ['card-a', 'card-a', 'missing-card', 'card-b'],
        availableCardIds,
        claimedCardIds,
      ),
    ).toEqual(['card-a', 'card-b'])
    expect(
      claimPrepDeckSectionCardIds(['card-a', 'card-c'], availableCardIds, claimedCardIds),
    ).toEqual(['card-c'])
    expect(
      claimPrepDeckSectionCardIds(['missing-card', 'card-a'], availableCardIds, claimedCardIds),
    ).toBeUndefined()
  })
})
