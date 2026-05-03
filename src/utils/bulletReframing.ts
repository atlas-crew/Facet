import { callLlmProxy, extractJsonBlock, JsonExtractionError } from './llmProxy'

const BULLET_REFRAMING_MODEL = 'sonnet'

export interface BulletReframingOptions {
  apiKey?: string
  strategy?: string
}

export interface ReframedBulletResult {
  original: string
  reframed: string
  reasoning: string
}

const escapePromptXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

export const reframeBulletForVector = async (
  bulletText: string,
  vectorLabel: string,
  endpoint: string,
  options: BulletReframingOptions = {},
): Promise<ReframedBulletResult> => {
  const systemPrompt = `You are a resume positioning expert. Return JSON only.
Given a resume bullet and a target positioning vector, strategically rewrite the bullet to emphasize accomplishments and skills most relevant to that vector.
The rewrite should remain truthful but use vocabulary and emphasis appropriate for the target role level and focus.

Response schema:
{
  "reframed": "string",
  "reasoning": "one sentence explaining the strategy used"
}`

  const userPrompt = `<original_bullet>${escapePromptXml(bulletText)}</original_bullet>
<target_vector>${escapePromptXml(vectorLabel)}</target_vector>
${options.strategy ? `<positioning_strategy>${escapePromptXml(options.strategy)}</positioning_strategy>` : ''}

Respond in JSON only.`

  const rawResponse = await callLlmProxy(endpoint, systemPrompt, userPrompt, {
    feature: 'build.bullet-reframe',
    model: BULLET_REFRAMING_MODEL,
    temperature: 0,
    apiKey: options.apiKey,
  })

  let parsed: Record<string, unknown>
  try {
    const extracted = extractJsonBlock(rawResponse)
    parsed = JSON.parse(extracted) as Record<string, unknown>
  } catch (error) {
    if (error instanceof JsonExtractionError) throw error
    const detail = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Failed to parse AI reframe response: ${detail}`)
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof parsed.reframed !== 'string' ||
    typeof parsed.reasoning !== 'string'
  ) {
    throw new Error('Invalid reframe response schema.')
  }

  return {
    original: bulletText,
    reframed: parsed.reframed,
    reasoning: parsed.reasoning,
  }
}
