import type { ResumeData, JdAnalysisResult, JdBulletAdjustment } from '../types'

export interface PreparedJobDescription {
  content: string
  wordCount: number
  truncated: boolean
}

export interface JdAnalysisRequestOptions {
  apiKey?: string
  strategy?: string
}

export interface ReframedBulletResult {
  original: string
  reframed: string
  reasoning: string
}

const MAX_JD_WORDS = 800
const REQUEST_TIMEOUT_MS = 30000

export const prepareJobDescription = (raw: string): PreparedJobDescription => {
  const words = raw.split(/\s+/).filter((w) => w.length > 0)
  const wordCount = words.length
  const truncated = wordCount > MAX_JD_WORDS
  const content = words.slice(0, MAX_JD_WORDS).join(' ')

  return { content, wordCount, truncated }
}

export function sanitizeEndpointUrl(value: string) {
  try {
    const url = new URL(value)
    if (url.username || url.password) {
      return ''
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return ''
    }
    return url.toString()
  } catch {
    return ''
  }
}

class JsonExtractionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'JsonExtractionError'
  }
}

/**
 * Robustly extract a JSON block from LLM output that might contain markdown or preamble.
 */
function extractJsonBlock(text: string): string {
  // Look for ```json ... ``` blocks
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/)
  if (jsonMatch?.[1]) {
    return jsonMatch[1].trim()
  }

  // Look for any { ... } block
  const firstBrace = text.indexOf('{')
  const lastBrace = text.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1)
  }

  throw new JsonExtractionError('Could not find JSON block in AI response.')
}

const callLlmProxy = async (
  endpoint: string,
  systemPrompt: string,
  userPrompt: string,
  options: JdAnalysisRequestOptions = {},
): Promise<string> => {
  const controller = new AbortController()
  const timeoutId = globalThis.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(options.apiKey ? { 'X-API-Key': options.apiKey } : {}),
      },
      body: JSON.stringify({
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        temperature: 0,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`AI proxy error (${response.status}): ${errorText.slice(0, 100)}`)
    }

    const payload = (await response.json()) as unknown
    const payloadRecord = payload as Record<string, unknown>

    // Support OpenAI-style { choices: [{ message: { content: '...' } }] } (Format 1)
    if (Array.isArray(payloadRecord.choices)) {
      const choice = payloadRecord.choices[0] as Record<string, unknown>
      const message = choice.message as Record<string, unknown>
      if (typeof message?.content === 'string') {
        return message.content
      }
    }

    // Support simple { analysis: { ... } } or { reframed: '...' } (Format 2)
    if (payloadRecord.analysis || payloadRecord.reframed) {
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
${options.strategy ? `Positioning Strategy: "${options.strategy}"` : ''}

Respond in JSON only.`

  const rawResponse = await callLlmProxy(endpoint, systemPrompt, userPrompt, options)
  
  try {
    const extracted = extractJsonBlock(rawResponse)
    const json = JSON.parse(extracted) as any
    const parsed = json.analysis || json
    
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
    throw new Error('Failed to parse AI reframe response.')
  }
}

const isStringArray = (val: unknown): val is string[] =>
  Array.isArray(val) && val.every((item) => typeof item === 'string')

const normalizeRecommendedPriority = (value: unknown): 'include' | 'exclude' | null => {
  if (value === 'exclude') {
    return 'exclude'
  }
  if (value === 'include' || value === 'must' || value === 'strong' || value === 'optional') {
    return 'include'
  }
  return null
}

const isBulletAdjustment = (val: unknown): val is JdBulletAdjustment => {
  const v = val as JdBulletAdjustment
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof v.bullet_id === 'string' &&
    normalizeRecommendedPriority(v.recommended_priority) !== null &&
    typeof v.reason === 'string'
  )
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
    !isStringArray(parsed.skill_gaps) ||
    !isStringArray(parsed.matched_keywords) ||
    typeof parsed.suggested_variables !== 'object'
  ) {
    throw new Error('Analysis response schema was invalid.')
  }
  if (!parsed.bullet_adjustments.every(isBulletAdjustment)) {
    throw new Error('Analysis response schema was invalid.')
  }

  return {
    primary_vector: parsed.primary_vector,
    bullet_adjustments: parsed.bullet_adjustments.map((adjustment) => ({
      ...adjustment,
      recommended_priority: normalizeRecommendedPriority(adjustment.recommended_priority) ?? 'exclude',
    })),
    suggested_target_line: typeof parsed.suggested_target_line === 'string' ? parsed.suggested_target_line : '',
    skill_gaps: parsed.skill_gaps,
    matched_keywords: parsed.matched_keywords,
    suggested_variables: (parsed.suggested_variables as Record<string, string>) || {},
    positioning_note: typeof parsed.positioning_note === 'string' ? parsed.positioning_note : '',
  }
}

const systemPrompt = `You are a resume strategist. Return JSON only.
Given the job description and candidate data, return:
1. primary_vector
2. bullet_adjustments: [{ bullet_id, recommended_priority, reason }]
3. suggested_target_line
4. skill_gaps: [string] (Top skills requested in JD but missing/weak in resume)
5. matched_keywords: [string] (Key technical skills or terms from JD that ARE present in the resume)
6. suggested_variables: { company: string, role: string } (Values extracted from JD)
7. positioning_note`

const buildContext = (data: ResumeData): Record<string, unknown> => ({
  vectors: data.vectors,
  target_lines: data.target_lines,
  profiles: data.profiles,
  skill_groups: data.skill_groups,
  roles: data.roles,
  projects: data.projects,
})

export const analyzeJobDescription = async (
  prepared: PreparedJobDescription,
  data: ResumeData,
  endpoint: string,
  options: JdAnalysisRequestOptions = {},
): Promise<JdAnalysisResult> => {
  const context = buildContext(data)
  const userPrompt = `Job Description:
${prepared.content}

Candidate Data (Resume Components):
${JSON.stringify(context, null, 2)}

Analyze how to best position this candidate for the JD. Respond in JSON only.`

  const rawResponse = await callLlmProxy(endpoint, systemPrompt, userPrompt, options)
  return parseJdAnalysisResponseWithKnownBullets(rawResponse, data)
}

/**
 * Wrapper that ensures bullet_adjustments only include IDs that actually exist in the data.
 */
export function parseJdAnalysisResponseWithKnownBullets(raw: string, data: ResumeData): JdAnalysisResult {
  const parsed = parseJdAnalysisResponse(raw)
  const knownBulletIds = new Set(
    data.roles.flatMap((role) => role.bullets.map((bullet) => bullet.id)),
  )
  return {
    ...parsed,
    bullet_adjustments: parsed.bullet_adjustments.filter((adjustment) => knownBulletIds.has(adjustment.bullet_id)),
  }
}
