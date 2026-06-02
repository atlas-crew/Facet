import type { ProfessionalPhilosophyEntry } from '../identity/schema'

const STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'also',
  'always',
  'be',
  'because',
  'before',
  'but',
  'by',
  'can',
  'for',
  'from',
  'has',
  'have',
  'in',
  'into',
  'is',
  'it',
  'its',
  'just',
  'less',
  'may',
  'more',
  'never',
  'no',
  'not',
  'of',
  'on',
  'or',
  'over',
  'so',
  'that',
  'than',
  'the',
  'their',
  'then',
  'they',
  'this',
  'to',
  'will',
  'when',
  'with',
])

// Three conservative merge paths: high Jaccard for close rewordings,
// containment for shorter entries subsumed by longer ones, and exact-tag
// assistance only when the language still overlaps substantially.
const MIN_COMPARISON_TOKENS = 4
const MIN_SHARED_TOKENS = 3
const JACCARD_MERGE_THRESHOLD = 0.68
const CONTAINMENT_MERGE_THRESHOLD = 0.82
const TAG_ASSISTED_JACCARD_THRESHOLD = 0.5
const TAG_ASSISTED_MIN_SHARED_TOKENS = 4

// Curated for common philosophy-generation variants. Extend intentionally
// when generated entries expose new recurring vocabulary patterns.
const SYNONYMS = new Map<string, string>([
  ['built', 'build'],
  ['changed', 'change'],
  ['judgement', 'judgment'],
  ['legibility', 'legible'],
  ['made', 'make'],
  ['readable', 'legible'],
  ['unlocking', 'unlock'],
  ['unlocks', 'unlock'],
  ['unlocked', 'unlock'],
])

const normalizeToken = (token: string): string => {
  const normalized = SYNONYMS.get(token) ?? token
  if (normalized.length > 6 && normalized.endsWith('ing')) return normalized.slice(0, -3)
  if (normalized.length > 5 && normalized.endsWith('ed')) return normalized.slice(0, -2)
  if (normalized.length > 5 && normalized.endsWith('ies')) return `${normalized.slice(0, -3)}y`
  if (normalized.length > 6 && normalized.endsWith('ness')) return normalized.slice(0, -4)
  if (normalized.length > 5 && /(sses|xes|ches|shes|zes|ses)$/.test(normalized)) {
    return normalized.slice(0, -2)
  }
  if (normalized.length > 5 && normalized.endsWith('s') && !normalized.endsWith('ss')) {
    return normalized.slice(0, -1)
  }
  return normalized
}

const tokenizeList = (value: string): string[] =>
  value
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token))
    .map(normalizeToken)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token))

const tokenize = (value: string): Set<string> => new Set(tokenizeList(value))

const intersectionSize = (left: Set<string>, right: Set<string>) => {
  let count = 0
  const smaller = left.size < right.size ? left : right
  const larger = left.size < right.size ? right : left
  smaller.forEach((token) => {
    if (larger.has(token)) count += 1
  })
  return count
}

const jaccardSimilarity = (left: Set<string>, right: Set<string>) => {
  const intersection = intersectionSize(left, right)
  const union = left.size + right.size - intersection
  return union > 0 ? intersection / union : 0
}

const orderedTokenKey = (value: string) => tokenizeList(value).join(' ')

const tagsOverlap = (
  left: ProfessionalPhilosophyEntry['tags'],
  right: ProfessionalPhilosophyEntry['tags'],
) => {
  const leftTags = new Set(left.map((tag) => tag.trim().toLowerCase()).filter(Boolean))
  const rightTags = new Set(right.map((tag) => tag.trim().toLowerCase()).filter(Boolean))
  return intersectionSize(leftTags, rightTags) > 0
}

const normalizeTags = (tags: ProfessionalPhilosophyEntry['tags']) =>
  Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)))

const mergeTags = (
  left: ProfessionalPhilosophyEntry['tags'],
  right: ProfessionalPhilosophyEntry['tags'],
) => Array.from(new Set([...normalizeTags(left), ...normalizeTags(right)]))

const areNearDuplicatePhilosophyEntries = (
  left: ProfessionalPhilosophyEntry,
  right: ProfessionalPhilosophyEntry,
) => {
  const leftTokens = tokenize(left.text)
  const rightTokens = tokenize(right.text)
  if (leftTokens.size === 0 || rightTokens.size === 0) return false
  if (orderedTokenKey(left.text) === orderedTokenKey(right.text)) return true

  if (Math.min(leftTokens.size, rightTokens.size) < MIN_COMPARISON_TOKENS) return false
  const shared = intersectionSize(leftTokens, rightTokens)
  if (shared < MIN_SHARED_TOKENS) return false

  const similarity = jaccardSimilarity(leftTokens, rightTokens)
  const containment = shared / Math.min(leftTokens.size, rightTokens.size)

  // Conservative thresholds: exact/high-overlap entries merge on their own;
  // tag-assisted matches still need substantial shared language.
  return (
    similarity >= JACCARD_MERGE_THRESHOLD ||
    containment >= CONTAINMENT_MERGE_THRESHOLD ||
    (tagsOverlap(left.tags, right.tags) &&
      similarity >= TAG_ASSISTED_JACCARD_THRESHOLD &&
      shared >= TAG_ASSISTED_MIN_SHARED_TOKENS)
  )
}

/**
 * Keeps output stable but order-dependent: first entry wins on equal strength,
 * while a longer duplicate replaces shorter text as a cheap sharpness proxy.
 */
export const dedupePhilosophyEntries = (
  entries: ProfessionalPhilosophyEntry[],
): ProfessionalPhilosophyEntry[] => {
  const deduped: ProfessionalPhilosophyEntry[] = []

  entries.forEach((entry) => {
    const text = entry.text.trim()
    if (!text) return

    const normalizedEntry = {
      ...entry,
      text,
      tags: normalizeTags(entry.tags),
    }
    const duplicateIndex = deduped.findIndex((candidate) =>
      areNearDuplicatePhilosophyEntries(candidate, normalizedEntry),
    )

    if (duplicateIndex === -1) {
      deduped.push(normalizedEntry)
      return
    }

    const duplicate = deduped[duplicateIndex]
    const strongerEntry =
      duplicate.text.length >= normalizedEntry.text.length ? duplicate : normalizedEntry
    deduped[duplicateIndex] = {
      ...strongerEntry,
      tags: mergeTags(duplicate.tags, normalizedEntry.tags),
    }
  })

  return deduped
}
