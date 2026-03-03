import type { ResumeData } from '../types'

export interface JdBulletAdjustment {
  bullet_id: string
  recommended_priority: 'must' | 'strong' | 'optional' | 'exclude'
  reason: string
}

export interface JdAnalysisResult {
  primary_vector: string
  bullet_adjustments: JdBulletAdjustment[]
  suggested_target_line: string
  skill_gaps: string[]
  positioning_note: string
}

export interface PreparedJobDescription {
  content: string
  wordCount: number
  truncated: boolean
}

export interface JdAnalysisRequestOptions {
  apiKey?: string
}

export interface ReframedBulletResult {
  original: string
  reframed: string
  reasoning: string
}

const MODEL_ID = 'claude-sonnet-4-20250514'
const MAX_JD_WORDS = 1800
const REQUEST_TIMEOUT_MS = 30_000
class JsonExtractionError extends Error {}

const callAnthropicProxy = async (
  endpoint: string,
  systemPrompt: string,
  userPrompt: string,
  options: JdAnalysisRequestOptions = {},
  extraBody: Record<string, unknown> = {},
): Promise<string> => {
  const normalizedEndpoint = normalizeEndpoint(endpoint)
  const timeoutController = new AbortController()
  const timeoutId = globalThis.setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS)
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  }
  if (options.apiKey) {
    headers.authorization = `Bearer ${options.apiKey}`
  }

  try {
    const response = await fetch(normalizedEndpoint, {
      method: 'POST',
      headers,
      redirect: 'manual',
      signal: timeoutController.signal,
      body: JSON.stringify({
        model: MODEL_ID,
        system_prompt: systemPrompt,
        prompt: userPrompt,
        ...extraBody,
      }),
    })
    if (response.status >= 300 && response.status < 400) {
      throw new Error('AI proxy endpoint returned a redirect, which is not allowed.')
    }
    if (!response.ok) {
      const errorBody = (await response.text()).trim().replace(/\s+/g, ' ').slice(0, 200)
      throw new Error(`Anthropic API error (${response.status}): ${errorBody || 'Request failed.'}`)
    }

    const payload = (await response.json()) as unknown
    if (!payload || typeof payload !== 'object') {
      throw new Error('AI response schema was invalid.')
    }

    const payloadRecord = payload as Record<string, unknown>
    
    // Check for nested analysis property (Format 1)
    if (payloadRecord.analysis && typeof payloadRecord.analysis === 'object') {
      return JSON.stringify(payloadRecord.analysis)
    }
    
    // Check for common fields directly (Format 2)
    if ('primary_vector' in payloadRecord || 'reframed' in payloadRecord) {
      return JSON.stringify(payloadRecord)
    }

    // Anthropic-style { content: [{ type: 'text', text: '...json...' }] } (Format 3)
    const content = Array.isArray(payloadRecord.content) ? payloadRecord.content : []
    const text = content.find((part) => part && typeof part === 'object' && (part as { type?: unknown }).type === 'text')
    const rawText = text && typeof (text as { text?: unknown }).text === 'string' ? (text as { text: string }).text : ''

    if (!rawText) {
      throw new Error('AI response schema was invalid.')
    }

    return rawText
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`AI request timed out after ${REQUEST_TIMEOUT_MS}ms.`)
    }
    throw error
  } finally {
    globalThis.clearTimeout(timeoutId)
  }
}

export const reframeBulletForVector = async (
  bulletText: string,
  vectorLabel: string,
  endpoint: string,
  options: JdAnalysisRequestOptions = {},
): Promise<ReframedBulletResult> => {
  const systemPrompt = `You are a resume positioning expert. Return JSON only.
Given a resume bullet and a target positioning vector, strategically rewrite the bullet to emphasize accomplishments and skills most relevant to that vector.
The rewrite should remain truthful but use vocabulary and emphasis appropriate for the target role level and focus.

Response schema:
{
  "original": "string",
  "reframed": "string",
  "reasoning": "one sentence explaining the strategy used"
}`

  const userPrompt = `Original Bullet: "${bulletText}"
Target Vector: "${vectorLabel}"

Respond in JSON only.`

  const rawResponse = await callAnthropicProxy(endpoint, systemPrompt, userPrompt, options)
  
  try {
    const parsed = JSON.parse(extractJsonBlock(rawResponse)) as Partial<ReframedBulletResult>
    if (typeof parsed.reframed !== 'string' || typeof parsed.reasoning !== 'string') {
      throw new Error('Invalid reframe response schema.')
    }
    return {
      original: bulletText,
      reframed: parsed.reframed,
      reasoning: parsed.reasoning,
    }
  } catch (error) {
    if (error instanceof JsonExtractionError) throw error
    throw new Error('Failed to parse reframing response.', { cause: error })
  }
}

const isRecommendedPriority = (value: unknown): value is JdBulletAdjustment['recommended_priority'] =>
  value === 'must' || value === 'strong' || value === 'optional' || value === 'exclude'

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string')

const isBulletAdjustment = (value: unknown): value is JdBulletAdjustment => {
  if (!value || typeof value !== 'object') {
    return false
  }
  const entry = value as Record<string, unknown>
  return (
    typeof entry.bullet_id === 'string' &&
    isRecommendedPriority(entry.recommended_priority) &&
    typeof entry.reason === 'string'
  )
}

const extractJsonBlock = (raw: string): string => {
  let start = -1
  let depth = 0
  let inString = false
  let escaped = false

  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index]

    if (inString) {
      if (escaped) {
        escaped = false
        continue
      }
      if (char === '\\') {
        escaped = true
        continue
      }
      if (char === '"') {
        inString = false
      }
      continue
    }

    if (char === '"') {
      inString = true
      continue
    }

    if (char === '{') {
      if (depth === 0) {
        start = index
      }
      depth += 1
      continue
    }

    if (char !== '}' || depth === 0) {
      continue
    }

    depth -= 1
    if (depth !== 0 || start === -1) {
      continue
    }

    const candidate = raw.slice(start, index + 1)
    try {
      JSON.parse(candidate)
      return candidate
    } catch {
      start = -1
    }
  }

  throw new JsonExtractionError('Analysis response did not include valid JSON output.')
}

export const prepareJobDescription = (input: string): PreparedJobDescription => {
  const words = input.trim().split(/\s+/).filter(Boolean)
  const truncated = words.length > MAX_JD_WORDS
  return {
    content: truncated ? words.slice(0, MAX_JD_WORDS).join(' ') : input.trim(),
    wordCount: words.length,
    truncated,
  }
}

export const parseJdAnalysisResponse = (raw: string): JdAnalysisResult => {
  let parsed: Partial<JdAnalysisResult>
  try {
    parsed = JSON.parse(extractJsonBlock(raw)) as Partial<JdAnalysisResult>
  } catch (error) {
    if (error instanceof JsonExtractionError) {
      throw error
    }
    throw new Error('Analysis response contained invalid JSON.')
  }

  if (
    typeof parsed.primary_vector !== 'string' ||
    !Array.isArray(parsed.bullet_adjustments) ||
    !isStringArray(parsed.skill_gaps)
  ) {
    throw new Error('Analysis response schema was invalid.')
  }
  if (!parsed.bullet_adjustments.every(isBulletAdjustment)) {
    throw new Error('Analysis response schema was invalid.')
  }

  return {
    primary_vector: parsed.primary_vector,
    bullet_adjustments: parsed.bullet_adjustments,
    suggested_target_line: typeof parsed.suggested_target_line === 'string' ? parsed.suggested_target_line : '',
    skill_gaps: parsed.skill_gaps,
    positioning_note: typeof parsed.positioning_note === 'string' ? parsed.positioning_note : '',
  }
}

const systemPrompt = `You are a resume strategist. Return JSON only.
Given the job description and candidate data, return:
1. primary_vector
2. bullet_adjustments: [{ bullet_id, recommended_priority, reason }]
3. suggested_target_line
4. skill_gaps
5. positioning_note`

const buildContext = (data: ResumeData): Record<string, unknown> => ({
  vectors: data.vectors,
  target_lines: data.target_lines,
  profiles: data.profiles,
  skill_groups: data.skill_groups,
  roles: data.roles,
})

const parseIpv4Octets = (hostname: string): number[] | null => {
  const segments = hostname.split('.')
  if (segments.length !== 4) {
    return null
  }
  const octets = segments.map((segment) => Number(segment))
  if (octets.some((octet) => Number.isNaN(octet) || octet < 0 || octet > 255)) {
    return null
  }
  return octets
}

const isPrivateIpv4Address = (hostname: string): boolean => {
  const octets = parseIpv4Octets(hostname)
  if (!octets) {
    return false
  }
  const [first, second] = octets
  return (
    first === 10 ||
    first === 127 ||
    first === 0 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 169 && second === 254) ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 198 && (second === 18 || second === 19)) ||
    first >= 240
  )
}

const normalizeHostForChecks = (hostname: string): string =>
  hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname

const isPrivateIpv6Address = (hostname: string): boolean => {
  const normalized = normalizeHostForChecks(hostname).toLowerCase()
  if (!normalized.includes(':')) {
    return false
  }

  if (normalized === '::') {
    return true
  }

  const firstSegment = normalized.split(':').find((segment) => segment.length > 0) ?? '0'
  const firstHextet = Number.parseInt(firstSegment, 16)
  if (!Number.isNaN(firstHextet)) {
    if ((firstHextet & 0xfe00) === 0xfc00) {
      return true
    }
    if ((firstHextet & 0xffc0) === 0xfe80) {
      return true
    }
  }

  if (!normalized.startsWith('::ffff:')) {
    return false
  }

  const mappedSuffix = normalized.slice('::ffff:'.length)
  const mappedIpv4Octets = parseIpv4Octets(mappedSuffix)
  if (mappedIpv4Octets) {
    return isPrivateIpv4Address(mappedSuffix)
  }

  const mappedSegments = mappedSuffix.split(':')
  if (mappedSegments.length !== 2) {
    return true
  }
  const high = Number.parseInt(mappedSegments[0], 16)
  const low = Number.parseInt(mappedSegments[1], 16)
  if (Number.isNaN(high) || Number.isNaN(low) || high < 0 || high > 0xffff || low < 0 || low > 0xffff) {
    return true
  }

  const octets = [high >> 8, high & 0xff, low >> 8, low & 0xff]
  return isPrivateIpv4Address(octets.join('.'))
}

const normalizeEndpoint = (endpoint: string): string => {
  let url: URL
  try {
    url = new URL(endpoint)
  } catch {
    throw new Error('JD analysis endpoint URL is invalid.')
  }
  if (url.username || url.password) {
    throw new Error('JD analysis endpoint must not include credentials.')
  }
  const normalizedHost = normalizeHostForChecks(url.hostname)
  const isLoopbackHost =
    normalizedHost === 'localhost' ||
    normalizedHost === '127.0.0.1' ||
    normalizedHost === '::1'

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('JD analysis endpoint must use HTTP or HTTPS.')
  }
  if (url.protocol === 'http:' && !isLoopbackHost) {
    throw new Error('JD analysis endpoint must use HTTPS (HTTP is only allowed for localhost).')
  }
  if (!isLoopbackHost && (isPrivateIpv4Address(normalizedHost) || isPrivateIpv6Address(normalizedHost))) {
    throw new Error('JD analysis endpoint must not target private network IP addresses.')
  }
  return url.toString()
}

export const analyzeJobDescription = async (
  preparedJd: PreparedJobDescription,
  data: ResumeData,
  endpoint: string,
  options: JdAnalysisRequestOptions = {},
): Promise<JdAnalysisResult> => {
  const contextObject = buildContext(data)
  const contextJson = JSON.stringify(contextObject)
  const userPrompt = `Job description:\n${preparedJd.content}\n\nCandidate data:\n${contextJson}\n\nRespond in JSON only.`

  const rawText = await callAnthropicProxy(endpoint, systemPrompt, userPrompt, options, {
    job_description: preparedJd.content,
    resume_data: contextObject,
  })
  return parseJdAnalysisResponseWithKnownBullets(rawText, data)
}

const parseJdAnalysisResponseWithKnownBullets = (raw: string, data: ResumeData): JdAnalysisResult => {
  const parsed = parseJdAnalysisResponse(raw)
  const knownBulletIds = new Set(
    data.roles.flatMap((role) => role.bullets.map((bullet) => bullet.id)),
  )
  return {
    ...parsed,
    bullet_adjustments: parsed.bullet_adjustments.filter((adjustment) => knownBulletIds.has(adjustment.bullet_id)),
  }
}
