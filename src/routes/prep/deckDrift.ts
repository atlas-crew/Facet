import type { PrepDeck } from '../../types/prep'
import { describeIdentityDiff, isArtifactStale } from '../../types/artifactMeta'

export interface DeckIdentityDriftNotice {
  title: string
  detail: string
}

/**
 * Detects identity drift on a prep deck: the deck's stamped `identityVersion` is behind the
 * current canonical revision and the gap hasn't been reviewed at that revision.
 *
 * Survey path (#63), coarse/version-only by design — the sibling of cover-letter identity drift.
 * Prep has no resume-drift axis here (its other staleness signal is JD-analysis drift, handled
 * separately), so this resolver is identity-only. Field-level precision is a deliberate follow-up.
 */
export function resolveDeckIdentityDrift(
  deck: PrepDeck | null,
  currentIdentityRevision: number | null,
): DeckIdentityDriftNotice | null {
  if (!deck) return null
  if (
    currentIdentityRevision === null ||
    deck.identityVersion === undefined ||
    !isArtifactStale({ identityVersion: deck.identityVersion }, currentIdentityRevision) ||
    deck.stalenessReview?.reviewedIdentityVersion === currentIdentityRevision
  ) {
    return null
  }
  const [message] = describeIdentityDiff(deck.identityVersion, currentIdentityRevision)
  return {
    title: 'Identity changed since this prep set was generated - regenerate?',
    detail:
      message ??
      'Your Identity has been updated since this prep set was generated. Regenerate to reflect the latest, or keep the current cards.',
  }
}
