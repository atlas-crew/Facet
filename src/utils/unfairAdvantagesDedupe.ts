const STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'aware',
  'be',
  'because',
  'but',
  'by',
  'facing',
  'for',
  'from',
  'has',
  'have',
  'in',
  'into',
  'is',
  'it',
  'its',
  'of',
  'on',
  'or',
  'over',
  'that',
  'the',
  'their',
  'this',
  'to',
  'with',
])

const SYNONYMS = new Map<string, string>([
  ['apis', 'api'],
  ['apps', 'app'],
  ['architectural', 'architecture'],
  ['architectures', 'architecture'],
  ['bots', 'bot'],
  ['bugs', 'bug'],
  ['built', 'build'],
  ['customer', 'customers'],
  ['deployment', 'deploy'],
  ['deployments', 'deploy'],
  ['deployed', 'deploy'],
  ['depths', 'depth'],
  ['evidence', 'proof'],
  ['infra', 'infrastructure'],
  ['judgement', 'judgment'],
  ['platforms', 'platform'],
  ['strategic', 'strategy'],
])

// Tuned from the recurring generation failures we have seen in identity strategy:
// keep short phrases conservative, but catch reordered/subsumed longer statements.
const MIN_COMPARISON_TOKENS = 4
const MIN_SHARED_TOKENS = 3
const JACCARD_DUPLICATE_THRESHOLD = 0.58
const CONTAINMENT_DUPLICATE_THRESHOLD = 0.74
const TECHNICAL_DIFFERENTIATORS = new Set([
  'ab',
  'ai',
  'android',
  'angular',
  'aws',
  'azure',
  'c',
  'cd',
  'ci',
  'c#',
  'c++',
  'docker',
  'e2e',
  'gcp',
  'go',
  'ios',
  'java',
  'javascript',
  'js',
  'kafka',
  'kotlin',
  'kubernetes',
  'linux',
  'ml',
  'mongodb',
  'mysql',
  'node',
  'php',
  'postgres',
  'python',
  'qa',
  'r',
  'rails',
  'react',
  'redis',
  'ruby',
  'rust',
  'scala',
  'sql',
  'swift',
  'terraform',
  'ts',
  'typescript',
  'ui',
  'unit',
  'ux',
  'vue',
])

const normalizeAdvantageText = (value: string) => value.trim().replace(/\s+/g, ' ')

const normalizeToken = (token: string) => {
  const normalized = SYNONYMS.get(token) ?? token
  if (TECHNICAL_DIFFERENTIATORS.has(normalized)) return normalized
  if (normalized.length > 6 && normalized.endsWith('ing')) return normalized.slice(0, -3)
  if (normalized.length > 5 && normalized.endsWith('ed')) return normalized.slice(0, -2)
  if (normalized.length > 5 && normalized.endsWith('ies')) return `${normalized.slice(0, -3)}y`
  if (normalized.length > 6 && normalized.endsWith('ness')) return normalized.slice(0, -4)
  if (normalized.length > 5 && /(sses|xes|ches|shes|zes)$/.test(normalized)) {
    return normalized.slice(0, -2)
  }
  if (normalized.length > 5 && normalized.endsWith('s') && !normalized.endsWith('ss')) {
    return normalized.slice(0, -1)
  }
  return normalized
}

const tokenizeList = (value: string): string[] =>
  normalizeAdvantageText(value)
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/\ba\/b\b/g, 'ab')
    .replace(/\be-commerce\b/g, 'ecommerce')
    .replace(/[^a-z0-9+#]+/g, ' ')
    .split(/\s+/)
    .filter(
      (token) => (token.length > 1 || TECHNICAL_DIFFERENTIATORS.has(token)) && !STOPWORDS.has(token),
    )
    .map(normalizeToken)
    .filter(
      (token) => (token.length > 1 || TECHNICAL_DIFFERENTIATORS.has(token)) && !STOPWORDS.has(token),
    )

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

const getAdvantageFingerprint = (value: string) => {
  const tokens = tokenizeList(value)
  return {
    key: tokens.join(' '),
    tokens: new Set(tokens),
  }
}

const hasUnmatchedTechnicalDifferentiator = (left: Set<string>, right: Set<string>) => {
  const leftOnly: string[] = []
  const rightOnly: string[] = []
  for (const token of left) {
    if (TECHNICAL_DIFFERENTIATORS.has(token) && !right.has(token)) leftOnly.push(token)
  }
  for (const token of right) {
    if (TECHNICAL_DIFFERENTIATORS.has(token) && !left.has(token)) rightOnly.push(token)
  }

  // Generic-to-specific sharpening can still dedupe; conflicting tech claims cannot.
  return leftOnly.length > 0 && rightOnly.length > 0
}

export const areNearDuplicateUnfairAdvantages = (left: string, right: string) => {
  const leftText = normalizeAdvantageText(left).toLowerCase()
  const rightText = normalizeAdvantageText(right).toLowerCase()
  if (leftText && leftText === rightText) return true

  const leftFingerprint = getAdvantageFingerprint(left)
  const rightFingerprint = getAdvantageFingerprint(right)
  const { tokens: leftTokens } = leftFingerprint
  const { tokens: rightTokens } = rightFingerprint
  if (leftTokens.size === 0 || rightTokens.size === 0) return false
  if (leftFingerprint.key === rightFingerprint.key) return true
  if (hasUnmatchedTechnicalDifferentiator(leftTokens, rightTokens)) return false

  // Short phrases dedupe only on exact token order to avoid collapsing distinct claims.
  if (Math.min(leftTokens.size, rightTokens.size) < MIN_COMPARISON_TOKENS) return false
  const shared = intersectionSize(leftTokens, rightTokens)
  if (shared < MIN_SHARED_TOKENS) return false

  const similarity = jaccardSimilarity(leftTokens, rightTokens)
  const containment = shared / Math.min(leftTokens.size, rightTokens.size)

  return (
    similarity >= JACCARD_DUPLICATE_THRESHOLD ||
    containment >= CONTAINMENT_DUPLICATE_THRESHOLD
  )
}

export const dedupeUnfairAdvantages = (advantages: string[]): string[] => {
  const deduped: string[] = []

  advantages.forEach((advantage) => {
    const normalizedAdvantage = normalizeAdvantageText(advantage)
    if (!normalizedAdvantage) return

    const duplicateIndex = deduped.findIndex((candidate) =>
      areNearDuplicateUnfairAdvantages(candidate, normalizedAdvantage),
    )
    if (duplicateIndex === -1) {
      deduped.push(normalizedAdvantage)
      return
    }

    if (normalizedAdvantage.length > deduped[duplicateIndex].length) {
      deduped[duplicateIndex] = normalizedAdvantage
    }
  })

  return deduped
}

export const getUniqueUnfairAdvantages = (existing: string[], generated: string[]) => {
  const uniqueGenerated = dedupeUnfairAdvantages(generated)
  return uniqueGenerated.filter(
    (advantage) =>
      !existing.some((candidate) => areNearDuplicateUnfairAdvantages(candidate, advantage)),
  )
}
