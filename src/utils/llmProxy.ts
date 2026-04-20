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

/**
 * Failure classification for `extractJsonBlock`. Consumers read `kind` to decide
 * whether to surface a retry affordance vs a hard error.
 */
export type JsonExtractionFailureKind =
  | 'no-json-found' // No sentinel, no fence, no balanced braces
  | 'empty-sentinel' // `<result>...</result>` present but body is empty/whitespace

export class JsonExtractionError extends Error {
  readonly kind: JsonExtractionFailureKind
  readonly diagnostic: { head: string; tail: string; length: number }
  constructor(
    message: string,
    kind: JsonExtractionFailureKind,
    diagnostic: { head: string; tail: string; length: number },
  ) {
    super(message)
    this.name = 'JsonExtractionError'
    this.kind = kind
    this.diagnostic = diagnostic
  }
}

/** Sentinel tag wrapping the model's final JSON payload (see TASK-167 prompt contract). */
export const JSON_RESULT_SENTINEL_OPEN = '<result>'
export const JSON_RESULT_SENTINEL_CLOSE = '</result>'
// Non-greedy global match; handles `<result>` appearing anywhere in the body.
// [\s\S] covers newlines because JS regex `.` doesn't match `\n` by default.
// The `g` flag is load-bearing — we iterate all matches and prefer the LAST non-empty
// one. Models commonly narrate ("I'll wrap the output in <result>...</result>") before
// emitting the real payload; the literal prose tags match first, so taking the first
// match would return an example body and fail JSON.parse downstream.
const JSON_RESULT_SENTINEL_PATTERN = /<result>([\s\S]*?)<\/result>/g

const DIAGNOSTIC_WINDOW = 500

function buildDiagnostic(text: string): { head: string; tail: string; length: number } {
  return {
    head: text.slice(0, DIAGNOSTIC_WINDOW),
    tail: text.length > DIAGNOSTIC_WINDOW ? text.slice(-DIAGNOSTIC_WINDOW) : '',
    length: text.length,
  }
}

/**
 * Peel a ` ```json ... ``` ` (or generic ` ``` ... ``` `) fence from around a body
 * when the model nested a fenced block inside the sentinel. Claude's formatting habits
 * sometimes produce both markers simultaneously; without this unwrap, callers receive
 * the raw ``` markers and `JSON.parse` fails.
 *
 * Returns the body unchanged when no surrounding fence is present.
 */
function unwrapFencedJson(body: string): string {
  const fence = body.match(/^```(?:json)?\s*([\s\S]*?)\s*```\s*$/)
  return fence ? fence[1].trim() : body
}

/**
 * Extract a JSON block from LLM output. Tries, in order:
 *
 *   1. **Sentinel tags** — `<result>…</result>` wrapping the JSON. Primary strategy for
 *      long-form reasoning responses where prose contains stray braces that would
 *      confuse the brace-matching fallback.
 *   2. **Fenced code block** — ` ```json … ``` `. Legacy strategy; backward compatible
 *      with prompts that haven't been updated to use sentinels.
 *   3. **First-brace-to-last-brace** — permissive fallback for simple responses.
 *
 * On failure, throws `JsonExtractionError` with a classification `kind` and a diagnostic
 * window (first/last ~500 chars of the input) for debugging. The caller is responsible
 * for `JSON.parse` — extraction and parsing are deliberately separated so callers can
 * attach their own context on parse errors.
 *
 * The `kind` field distinguishes:
 *   - `'no-json-found'` — none of the three strategies matched
 *   - `'empty-sentinel'` — sentinel tags present but body was whitespace-only
 */
export function extractJsonBlock(text: string): string {
  const sentinelMatches = Array.from(text.matchAll(JSON_RESULT_SENTINEL_PATTERN))
  let sawSentinel = false
  if (sentinelMatches.length > 0) {
    sawSentinel = true
    // Prefer the LAST non-empty <result>...</result> block. See pattern-definition
    // comment — models narrate about the sentinel before emitting the real payload,
    // so earlier matches are typically prose examples, not the actual output.
    for (let i = sentinelMatches.length - 1; i >= 0; i -= 1) {
      const body = sentinelMatches[i][1].trim()
      if (body) return unwrapFencedJson(body)
    }
    // All sentinel bodies were whitespace-only. Don't throw yet — the model may
    // have referenced <result></result> in prose (as an example) while emitting
    // the actual payload via a fenced block or bare braces further down. Fall
    // through to the legacy strategies and only classify as empty-sentinel if
    // nothing else matches either.
  }

  const fencedMatch = text.match(/```json\s*([\s\S]*?)\s*```/)
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim()
  }

  const firstBrace = text.indexOf('{')
  const lastBrace = text.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1)
  }

  const diagnostic = buildDiagnostic(text)
  if (sawSentinel) {
    console.warn(
      '[extractJsonBlock] <result> sentinel present but body empty and no fallback JSON found',
      diagnostic,
    )
    throw new JsonExtractionError(
      'AI response contained <result></result> sentinel but the body was empty and no fallback JSON was found.',
      'empty-sentinel',
      diagnostic,
    )
  }
  console.warn(
    '[extractJsonBlock] no sentinel, fenced block, or balanced braces found',
    diagnostic,
  )
  throw new JsonExtractionError(
    'Could not find JSON block in AI response (no <result> sentinel, fenced block, or balanced braces).',
    'no-json-found',
    diagnostic,
  )
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
