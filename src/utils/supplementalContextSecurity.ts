export const SUPPLEMENTAL_CONTEXT_MAX_TOKENS = 20_000

export interface SupplementalContextFlag {
  label: string
  snippet: string
}

export interface SupplementalContextSecurityScan {
  wordCount: number
  estimatedTokens: number
  detectedSections: string[]
  flaggedContent: SupplementalContextFlag[]
}

const INJECTION_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  {
    label: 'Ignore previous instructions',
    pattern: /\bignore\s+(?:all\s+)?(?:previous|prior|above)\s+instructions?\b/gi,
  },
  { label: 'System prompt request', pattern: /\bsystem\s+prompt\b/gi },
  {
    label: 'Disregard instructions',
    pattern: /\bdisregard\s+(?:all\s+)?(?:previous|prior|above|the)\s+instructions?\b/gi,
  },
  { label: 'As an AI roleplay', pattern: /\bas\s+an\s+ai\b/gi },
  { label: 'New instructions', pattern: /\bnew\s+instructions?\b/gi },
  {
    label: 'Prompt disclosure request',
    pattern:
      /\b(?:output|reveal|print|show)\s+(?:your\s+)?(?:system|developer)\s+(?:prompt|message)\b/gi,
  },
]

const SECTION_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  {
    label: 'Role history',
    pattern: /\b(?:role|roles|company|companies|title|experience|worked at|managed|led)\b/i,
  },
  {
    label: 'Skills',
    pattern: /\b(?:skill|skills|technology|technologies|typescript|python|go|aws|kubernetes)\b/i,
  },
  {
    label: 'Projects',
    pattern: /\b(?:project|projects|built|launched|shipped|migration|platform)\b/i,
  },
  {
    label: 'Career goals',
    pattern: /\b(?:goal|goals|prefer|preference|target|next role|want to)\b/i,
  },
  { label: 'Interview prep', pattern: /\b(?:interview|prep|question|story|stories|answer)\b/i },
  { label: 'Communication style', pattern: /\b(?:voice|tone|communication|style|writing)\b/i },
  {
    label: 'Constraints',
    pattern: /\b(?:avoid|constraint|constraints|not good at|do not want|don't want)\b/i,
  },
]

const SNIPPET_RADIUS = 48

export const estimateSupplementalContextTokens = (text: string): number => {
  const trimmed = text.trim()
  if (!trimmed) {
    return 0
  }

  return Math.ceil(trimmed.length / 4)
}

const countWords = (text: string): number => {
  const matches = text.trim().match(/\S+/g)
  return matches?.length ?? 0
}

const buildSnippet = (text: string, index: number, matchedText: string): string => {
  const start = Math.max(0, index - SNIPPET_RADIUS)
  const end = Math.min(text.length, index + matchedText.length + SNIPPET_RADIUS)
  const prefix = start > 0 ? '...' : ''
  const suffix = end < text.length ? '...' : ''
  return `${prefix}${text.slice(start, end).replace(/\s+/g, ' ').trim()}${suffix}`
}

export const scanSupplementalContextSecurity = (text: string): SupplementalContextSecurityScan => {
  const trimmed = text.trim()
  const detectedSections = SECTION_PATTERNS.filter(({ pattern }) => pattern.test(trimmed)).map(
    ({ label }) => label,
  )
  const flaggedContent = INJECTION_PATTERNS.flatMap(({ label, pattern }) => {
    pattern.lastIndex = 0
    return Array.from(trimmed.matchAll(pattern)).flatMap((match) =>
      match[0] && match.index !== undefined
        ? [{ label, snippet: buildSnippet(trimmed, match.index, match[0]) }]
        : [],
    )
  })

  return {
    wordCount: countWords(trimmed),
    estimatedTokens: estimateSupplementalContextTokens(trimmed),
    detectedSections,
    flaggedContent,
  }
}

export const getSupplementalContextTokenLimitError = (
  text: string,
  label = 'Pasted context',
): string | null => {
  const estimatedTokens = estimateSupplementalContextTokens(text)
  if (estimatedTokens <= SUPPLEMENTAL_CONTEXT_MAX_TOKENS) {
    return null
  }

  return `${label} is estimated at ${estimatedTokens.toLocaleString()} tokens; keep each paste under ${SUPPLEMENTAL_CONTEXT_MAX_TOKENS.toLocaleString()} tokens.`
}
