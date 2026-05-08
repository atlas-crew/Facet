/**
 * Canonical "Round N" display label for prep decks. Returns "Round TBD" when
 * roundNumber is unset so the caller doesn't have to guard separately.
 */
export function formatPrepRoundNumberLabel(roundNumber?: number): string {
  return roundNumber ? `Round ${roundNumber}` : 'Round TBD'
}
