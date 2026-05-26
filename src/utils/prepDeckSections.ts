import { createId, slugify } from './idUtils'

export function makeUniqueId(baseId: string, seenIds: Set<string>): string {
  let id = baseId
  let suffix = 2
  while (seenIds.has(id)) {
    id = `${baseId}-${suffix}`
    suffix += 1
  }
  seenIds.add(id)
  return id
}

export function createPrepDeckSectionId(params: {
  id?: string | null
  title: string
  seenIds: Set<string>
}): string {
  const providedId = params.id?.trim()
  const titleSlug = slugify(params.title)
  const baseId =
    providedId || (titleSlug ? `prep-deck-section-${titleSlug}` : createId('prep-deck-section'))
  return makeUniqueId(baseId, params.seenIds)
}

export function claimPrepDeckSectionCardIds(
  cardIds: string[] | undefined,
  availableCardIds: Set<string>,
  claimedCardIds: Set<string>,
): string[] | undefined {
  if (!cardIds) return undefined
  const claimedIds = cardIds.filter((cardId) => {
    if (!availableCardIds.has(cardId) || claimedCardIds.has(cardId)) return false
    claimedCardIds.add(cardId)
    return true
  })
  return claimedIds.length > 0 ? claimedIds : undefined
}
