// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'
import { resolveDeckIdentityDrift } from '../routes/prep/deckDrift'
import { usePrepStore } from '../store/prepStore'
import { resolveStorage } from '../store/storage'
import type { ArtifactStalenessReview } from '../types/artifactMeta'

const makeDeck = (identityVersion: number | undefined) => {
  const id = usePrepStore.getState().createDeck({
    title: 'Acme Loop',
    company: 'Acme',
    role: 'Staff Engineer',
    identityVersion,
  })
  const deck = usePrepStore.getState().decks.find((entry) => entry.id === id)
  if (!deck) throw new Error('deck was not created')
  return deck
}

const review = (reviewedIdentityVersion: number): ArtifactStalenessReview => ({
  decision: 'accepted-current',
  reviewedAt: '2026-06-20T00:00:00.000Z',
  reviewedIdentityVersion,
  artifactIdentityVersionAtReview: 3,
  mutationLabel: 'Identity updated',
  mutationFields: [],
  mutationFromRevision: 3,
  mutationToRevision: reviewedIdentityVersion,
  reason: 'test',
})

describe('resolveDeckIdentityDrift — prep deck identity drift (survey path, #63)', () => {
  beforeEach(() => {
    resolveStorage().removeItem('facet-prep-workspace')
    resolveStorage().removeItem('facet-prep-data')
    usePrepStore.setState({ decks: [], activeDeckId: null, activeMode: 'edit' })
  })

  it('flags drift when the deck version is behind the current revision', () => {
    const drift = resolveDeckIdentityDrift(makeDeck(3), 5)
    expect(drift?.title).toMatch(/identity changed/i)
  })

  it('suppresses once the gap has been reviewed at the current revision (dismiss)', () => {
    const deck = { ...makeDeck(3), stalenessReview: review(5) }
    expect(resolveDeckIdentityDrift(deck, 5)).toBeNull()
  })

  it('re-flags after a further identity advance past the reviewed revision', () => {
    const deck = { ...makeDeck(3), stalenessReview: review(5) }
    expect(resolveDeckIdentityDrift(deck, 6)).not.toBeNull()
  })

  it('is clear when the deck is stamped at the current revision (regen re-stamps version)', () => {
    expect(resolveDeckIdentityDrift(makeDeck(5), 5)).toBeNull()
  })

  it('does not compare a deck with no stamped identity version', () => {
    expect(resolveDeckIdentityDrift(makeDeck(undefined), 5)).toBeNull()
  })

  it('returns null when there is no current identity revision', () => {
    expect(resolveDeckIdentityDrift(makeDeck(3), null)).toBeNull()
  })
})
