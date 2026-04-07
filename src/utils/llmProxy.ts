import type { FacetAiFeatureKey } from '../types/hosted'
import { readAiProxyError } from './aiProxyErrors'
import { facetClientEnv } from './facetEnv'
import { getHostedAccessToken } from './hostedSession'

/**
 * Shared AI proxy utilities.
 *
 * Consolidates the `callLlmProxy`, `extractJsonBlock`, and `JsonExtractionError`
 * helpers previously duplicated across jdAnalyzer, prepGenerator,
 * coverLetterGenerator, and searchProfileInference.
 *
 * Each feature passes its own `model` alias (e.g. 'haiku', 'sonnet', 'opus')
 * so cost/quality can be tuned per use-case without touching the proxy.
 */

const DEFAULT_TIMEOUT_MS = 30000
const DEFAULT_PROXY_API_KEY = 'facet-local-proxy'

export class JsonExtractionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'JsonExtractionError'
  }
}

/**
 * Robustly extract a JSON block from LLM output that might contain
 * markdown fences or preamble text.
 */
export function extractJsonBlock(text: string): string {
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/)
  if (jsonMatch?.[1]) {
    return jsonMatch[1].trim()
  }

  const firstBrace = text.indexOf('{')
  const lastBrace = text.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1)
  }

  throw new JsonExtractionError('Could not find JSON block in AI response.')
}

export function isString(value: unknown): value is string {
  return typeof value === 'string'
}

export interface LlmProxyOptions {
  /** Model alias sent to the proxy (e.g. 'haiku', 'sonnet', 'opus'). */
  model?: string
  /** Sampling temperature. Defaults to 0.3. */
  temperature?: number
  /** Request timeout in ms. Defaults to 30 000. */
  timeoutMs?: number
  /** Optional API key header. */
  apiKey?: string
  /** Optional proxy auth header override. */
  proxyApiKey?: string
  /** Identifies the hosted AI feature for entitlement checks. */
  feature?: FacetAiFeatureKey
  /** Optional external abort signal for cancellation. */
  signal?: AbortSignal
}

/**
 * Call the Facet AI proxy and extract the text response.
 *
 * Handles both Anthropic-style `{ content: [{ type: 'text', text }] }`
 * and OpenAI-style `{ choices: [{ message: { content } }] }` envelopes.
 */
export async function callLlmProxy(
  endpoint: string,
  systemPrompt: string,
  userPrompt: string,
  options: LlmProxyOptions = {},
): Promise<string> {
  const controller = new AbortController()
  const onAbort = () => controller.abort()
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs)

  try {
    if (options.signal?.aborted) {
      controller.abort()
    } else if (options.signal) {
      options.signal.addEventListener('abort', onAbort, { once: true })
    }

    const bearerToken = await getHostedAccessToken()
    const configuredProxyApiKey = facetClientEnv.anthropicProxyApiKey || undefined
    const resolvedProxyApiKey =
      options.proxyApiKey ??
      configuredProxyApiKey ??
      (bearerToken ? undefined : DEFAULT_PROXY_API_KEY)
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(options.apiKey ? { 'X-API-Key': options.apiKey } : {}),
        ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
        ...(resolvedProxyApiKey ? { 'X-Proxy-API-Key': resolvedProxyApiKey } : {}),
      },
      body: JSON.stringify({
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        temperature: options.temperature ?? 0.3,
        ...(options.model ? { model: options.model } : {}),
        ...(options.feature ? { feature: options.feature } : {}),
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      throw await readAiProxyError(response)
    }

    const payload = (await response.json()) as Record<string, unknown>

    // OpenAI-style { choices: [{ message: { content: '...' } }] }
    if (Array.isArray(payload.choices)) {
      const choice = payload.choices[0] as Record<string, unknown>
      const message = choice.message as Record<string, unknown>
      if (typeof message?.content === 'string') {
        return message.content
      }
    }

    // Anthropic-style { content: [{ type: 'text', text: '...' }] }
    if (Array.isArray(payload.content)) {
      const textPart = payload.content.find(
        (part) => part && typeof part === 'object' && (part as { type?: unknown }).type === 'text',
      ) as { text?: string } | undefined
      if (typeof textPart?.text === 'string') {
        return textPart.text
      }
    }

    // Simple envelope (e.g. { analysis: { ... } })
    if (payload.analysis || payload.reframed) {
      return JSON.stringify(payload)
    }

    return JSON.stringify(payload)
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`AI request timed out after ${timeoutMs}ms.`)
    }
    throw error
  } finally {
    options.signal?.removeEventListener('abort', onAbort)
    globalThis.clearTimeout(timeoutId)
  }
}
