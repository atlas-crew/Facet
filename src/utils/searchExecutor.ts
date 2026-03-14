import type {
  SearchProfile,
  SearchRequest,
  SearchResultEntry,
  SearchTokenUsage,
} from '../types/search'
import { readAiProxyError } from './aiProxyErrors'
import { getHostedAccessToken } from './hostedSession'
import { createId } from './idUtils'

const REQUEST_TIMEOUT_MS = 120000
const DEFAULT_PROXY_API_KEY = 'facet-local-proxy'

interface SearchExecutionPayload {
  text: string
  searchLog: string[]
  tokenUsage?: SearchTokenUsage
}

export class JsonExtractionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'JsonExtractionError'
  }
}

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

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

export function collectQueryStrings(value: unknown): string[] {
  if (isString(value)) {
    const trimmed = value.trim()
    return trimmed ? [trimmed] : []
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectQueryStrings(item))
  }

  if (!value || typeof value !== 'object') {
    return []
  }

  const record = value as Record<string, unknown>
  return [
    ...collectQueryStrings(record.query),
    ...collectQueryStrings(record.queries),
    ...collectQueryStrings(record.search_query),
  ]
}

export async function callSearchProxy(
  endpoint: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<SearchExecutionPayload> {
  const controller = new AbortController()
  const timeoutId = globalThis.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const bearerToken = await getHostedAccessToken()
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
        'X-Proxy-API-Key':
          (import.meta.env.VITE_ANTHROPIC_PROXY_API_KEY as string | undefined) ??
          DEFAULT_PROXY_API_KEY,
      },
      body: JSON.stringify({
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        temperature: 1,
        thinking_budget: 8000,
        model: 'sonnet',
        feature: 'research.search',
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 15 }],
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      throw await readAiProxyError(response)
    }

    const payload = (await response.json()) as Record<string, unknown>
    const tokenUsage =
      payload.usage && typeof payload.usage === 'object'
        ? {
            inputTokens:
              typeof (payload.usage as { input_tokens?: unknown }).input_tokens === 'number'
                ? ((payload.usage as { input_tokens: number }).input_tokens ?? 0)
                : 0,
            outputTokens:
              typeof (payload.usage as { output_tokens?: unknown }).output_tokens === 'number'
                ? ((payload.usage as { output_tokens: number }).output_tokens ?? 0)
                : 0,
            totalTokens:
              typeof (payload.usage as { input_tokens?: unknown }).input_tokens === 'number' &&
              typeof (payload.usage as { output_tokens?: unknown }).output_tokens === 'number'
                ? ((payload.usage as { input_tokens: number }).input_tokens ?? 0) +
                  ((payload.usage as { output_tokens: number }).output_tokens ?? 0)
                : 0,
          }
        : undefined

    if (Array.isArray(payload.choices)) {
      const choice = payload.choices[0] as Record<string, unknown>
      const message = choice.message as Record<string, unknown>
      if (typeof message?.content === 'string') {
        return { text: message.content, searchLog: [], tokenUsage }
      }
    }

    if (Array.isArray(payload.content)) {
      const textParts: string[] = []
      const searchLog = new Set<string>()

      for (const part of payload.content) {
        if (!part || typeof part !== 'object') {
          continue
        }

        const record = part as Record<string, unknown>
        if (record.type === 'text' && isString(record.text)) {
          textParts.push(record.text)
        }

        for (const query of collectQueryStrings(record.input)) {
          searchLog.add(query)
        }

        for (const query of collectQueryStrings(record.query)) {
          searchLog.add(query)
        }
      }

      return {
        text: textParts.join('\n').trim() || JSON.stringify(payload),
        searchLog: [...searchLog],
        tokenUsage,
      }
    }

    return { text: JSON.stringify(payload), searchLog: [], tokenUsage }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`AI request timed out after ${REQUEST_TIMEOUT_MS}ms.`)
    }
    throw error
  } finally {
    globalThis.clearTimeout(timeoutId)
  }
}

export function clampMatchScore(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0
  }

  return Math.max(0, Math.min(100, Math.round(value)))
}

export function normalizeTier(value: unknown): 1 | 2 | 3 | null {
  if (value === 1 || value === '1') return 1
  if (value === 2 || value === '2') return 2
  if (value === 3 || value === '3') return 3
  return null
}

export function normalizeResults(payload: unknown, request: SearchRequest): SearchResultEntry[] {
  const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}
  const rawResults = Array.isArray(record.results) ? record.results : []
  const perTierCounts = { 1: 0, 2: 0, 3: 0 }
  const tierLimits = {
    1: request.maxResults.tier1,
    2: request.maxResults.tier2,
    3: request.maxResults.tier3,
  }

  const normalized = rawResults
    .flatMap((result) => {
      if (!result || typeof result !== 'object') {
        return []
      }

      const item = result as Record<string, unknown>
      const company = isString(item.company) ? item.company.trim() : ''
      const title = isString(item.title) ? item.title.trim() : ''
      const url = isString(item.url) ? item.url.trim() : ''
      const tier = normalizeTier(item.tier)
      if (!company || !title || !url || tier === null) {
        return []
      }

      return [
        {
          id: createId('sres'),
          tier,
          company,
          title,
          url,
          location: isString(item.location) ? item.location.trim() : undefined,
          matchScore: clampMatchScore(item.matchScore),
          matchReason: isString(item.matchReason) ? item.matchReason.trim() : '',
          vectorAlignment: isString(item.vectorAlignment) ? item.vectorAlignment.trim() : '',
          risks: Array.isArray(item.risks)
            ? item.risks.filter(isString).map((risk) => risk.trim()).filter(Boolean)
            : [],
          estimatedComp: isString(item.estimatedComp) ? item.estimatedComp.trim() : undefined,
          source: isString(item.source) ? item.source.trim() : 'web_search',
        },
      ]
    })
    .sort((left, right) => {
      if (left.tier !== right.tier) {
        return left.tier - right.tier
      }
      return right.matchScore - left.matchScore
    })

  return normalized.filter((entry) => {
    perTierCounts[entry.tier] += 1
    return perTierCounts[entry.tier] <= tierLimits[entry.tier]
  })
}

export function buildSearchPrompt(profile: SearchProfile, request: SearchRequest): string {
  const prioritizedSkills = profile.skills
    .filter((skill) => skill.depth !== 'avoid')
    .slice(0, 15)
    .map((skill) => ({
      name: skill.name,
      depth: skill.depth,
      category: skill.category,
      searchSignal: skill.searchSignal,
    }))

  const activeVectors =
    request.focusVectors.length > 0
      ? profile.vectors.filter((vector) => request.focusVectors.includes(vector.vectorId))
      : profile.vectors

  return `Find high-fit job opportunities for this candidate. Use web search to inspect active roles on major boards and company career pages.

Candidate profile:
${JSON.stringify(
    {
      skills: prioritizedSkills,
      vectors: activeVectors,
      workSummary: profile.workSummary,
      openQuestions: profile.openQuestions,
      constraints: profile.constraints,
      filters: profile.filters,
      interviewPrefs: profile.interviewPrefs,
    },
    null,
    2,
  )}

Search request:
${JSON.stringify(request, null, 2)}

Search targets:
- Prefer live roles on LinkedIn, Greenhouse, Lever, Ashby, Wellfound, and direct company career sites.
- Respect excluded companies.
- Tier 1 should be near-perfect matches.
- Tier 2 should be strong but slightly less aligned.
- Tier 3 should be interesting stretch or adjacent roles.

Return JSON only with this schema:
{
  "results": [
    {
      "tier": 1,
      "company": "string",
      "title": "string",
      "url": "string",
      "location": "optional string",
      "matchScore": 0,
      "matchReason": "string",
      "vectorAlignment": "string",
      "risks": ["string"],
      "estimatedComp": "optional string",
      "source": "string"
    }
  ]
}`
}

export async function executeSearch(
  profile: SearchProfile,
  request: SearchRequest,
  endpoint: string,
): Promise<{ results: SearchResultEntry[]; searchLog: string[]; tokenUsage?: SearchTokenUsage }> {
  const systemPrompt = `You are a strategic executive recruiter and job-search operator. Use web search actively, evaluate fit rigorously, and return JSON only.
Prioritize roles that match the candidate's vectors, seniority, and search constraints. Be realistic about fit, call out risks, and avoid duplicate listings.`

  const execution = await callSearchProxy(endpoint, systemPrompt, buildSearchPrompt(profile, request))

  try {
    return {
      results: normalizeResults(JSON.parse(extractJsonBlock(execution.text)), request),
      searchLog: execution.searchLog,
      tokenUsage: execution.tokenUsage,
    }
  } catch (error) {
    if (error instanceof JsonExtractionError) {
      throw error
    }
    throw new Error('Failed to parse search results response.')
  }
}
