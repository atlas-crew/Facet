import type { PrepCard, PrepGenerationRequest } from '../types/prep'
import { createId } from './idUtils'

const REQUEST_TIMEOUT_MS = 45000

interface PrepGenerationPayload {
  deckTitle: string
  companyResearchSummary: string
  cards: Array<Omit<PrepCard, 'id'>>
}

class JsonExtractionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'JsonExtractionError'
  }
}

function extractJsonBlock(text: string): string {
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

async function callLlmProxy(endpoint: string, systemPrompt: string, userPrompt: string) {
  const controller = new AbortController()
  const timeoutId = globalThis.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        temperature: 0.3,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`AI proxy error (${response.status}): ${(await response.text()).slice(0, 160)}`)
    }

    const payload = (await response.json()) as Record<string, unknown>
    if (Array.isArray(payload.choices)) {
      const choice = payload.choices[0] as Record<string, unknown>
      const message = choice.message as Record<string, unknown>
      if (typeof message?.content === 'string') {
        return message.content
      }
    }

    if (Array.isArray(payload.content)) {
      const textPart = payload.content.find(
        (part) => part && typeof part === 'object' && (part as { type?: unknown }).type === 'text',
      ) as { text?: string } | undefined
      if (typeof textPart?.text === 'string') {
        return textPart.text
      }
    }

    return JSON.stringify(payload)
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`AI request timed out after ${REQUEST_TIMEOUT_MS}ms.`)
    }
    throw error
  } finally {
    globalThis.clearTimeout(timeoutId)
  }
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function normalizeCards(cards: unknown[]): PrepCard[] {
  return cards.flatMap((card) => {
    if (!card || typeof card !== 'object') return []
    const record = card as Record<string, unknown>
    if (!isString(record.title) || !isString(record.category)) return []
    if (
      record.category !== 'opener' &&
      record.category !== 'behavioral' &&
      record.category !== 'technical' &&
      record.category !== 'project' &&
      record.category !== 'metrics' &&
      record.category !== 'situational'
    ) {
      return []
    }

    const tags = Array.isArray(record.tags)
      ? record.tags.filter(isString).map((tag) => tag.trim()).filter(Boolean)
      : []

    return [
      {
        id: createId('prep-card'),
        category: record.category,
        title: record.title.trim(),
        tags,
        notes: isString(record.notes) ? record.notes.trim() : undefined,
        script: isString(record.script) ? record.script.trim() : undefined,
        warning: isString(record.warning) ? record.warning.trim() : undefined,
        followUps: Array.isArray(record.followUps)
          ? record.followUps.flatMap((followUp) => {
              if (!followUp || typeof followUp !== 'object') return []
              const item = followUp as Record<string, unknown>
              return isString(item.question) && isString(item.answer)
                ? [{ question: item.question.trim(), answer: item.answer.trim() }]
                : []
            })
          : undefined,
        deepDives: Array.isArray(record.deepDives)
          ? record.deepDives.flatMap((deepDive) => {
              if (!deepDive || typeof deepDive !== 'object') return []
              const item = deepDive as Record<string, unknown>
              return isString(item.title) && isString(item.content)
                ? [{ title: item.title.trim(), content: item.content.trim() }]
                : []
            })
          : undefined,
        metrics: Array.isArray(record.metrics)
          ? record.metrics.flatMap((metric) => {
              if (!metric || typeof metric !== 'object') return []
              const item = metric as Record<string, unknown>
              return isString(item.value) && isString(item.label)
                ? [{ value: item.value.trim(), label: item.label.trim() }]
                : []
            })
          : undefined,
        tableData:
          record.tableData && typeof record.tableData === 'object'
            ? {
                headers: Array.isArray((record.tableData as { headers?: unknown[] }).headers)
                  ? ((record.tableData as { headers: unknown[] }).headers.filter(isString) as string[])
                  : [],
                rows: Array.isArray((record.tableData as { rows?: unknown[] }).rows)
                  ? (record.tableData as { rows: unknown[] }).rows.flatMap((row) =>
                      Array.isArray(row) && row.every(isString) ? [row] : [],
                    )
                  : [],
              }
            : undefined,
        source: 'ai',
      },
    ]
  })
}

export async function generateInterviewPrep(
  endpoint: string,
  request: PrepGenerationRequest,
): Promise<{ deckTitle: string; companyResearchSummary: string; cards: PrepCard[] }> {
  const systemPrompt = `You are an expert interview coach. Return JSON only.
Generate a strong interview prep pack from a candidate's resume context, a target vector, a job description, and company research notes.
Focus on truthful storytelling, quantified evidence, likely interview themes, and specific follow-up questions the candidate should prepare for.
Include 8 to 12 cards spanning opener, behavioral, technical, project, metrics, and situational categories when supported by the input.
Use the resume context to ground answers; do not invent facts or metrics not present in the candidate material. If company research is uncertain, say so in notes instead of presenting it as fact.

Response schema:
{
  "deckTitle": "string",
  "companyResearchSummary": "string",
  "cards": [
    {
      "category": "opener|behavioral|technical|project|metrics|situational",
      "title": "string",
      "tags": ["string"],
      "notes": "optional string",
      "script": "optional string",
      "warning": "optional string",
      "followUps": [{ "question": "string", "answer": "string" }],
      "deepDives": [{ "title": "string", "content": "string" }],
      "metrics": [{ "value": "string", "label": "string" }],
      "tableData": {
        "headers": ["string"],
        "rows": [["string"]]
      }
    }
  ]
}`

  const userPrompt = `Target Company: ${request.company}
Target Role: ${request.role}
Target Vector: ${request.vectorLabel} (${request.vectorId})
Company URL: ${request.companyUrl ?? 'Not provided'}
Skill Match Notes: ${request.skillMatch ?? 'Not provided'}
Positioning Notes: ${request.positioning ?? 'Not provided'}
Additional Notes: ${request.notes ?? 'Not provided'}
Company Research Notes: ${request.companyResearch ?? 'Not provided'}

Job Description:
${request.jobDescription}

Tailored Resume Context:
${JSON.stringify(request.resumeContext, null, 2)}

Return JSON only.`

  const rawResponse = await callLlmProxy(endpoint, systemPrompt, userPrompt)

  let parsed: PrepGenerationPayload
  try {
    parsed = JSON.parse(extractJsonBlock(rawResponse)) as PrepGenerationPayload
  } catch (error) {
    if (error instanceof JsonExtractionError) throw error
    throw new Error('Failed to parse interview prep response.')
  }

  const cards = normalizeCards(Array.isArray(parsed.cards) ? parsed.cards : [])
  if (!isString(parsed.deckTitle) || !isString(parsed.companyResearchSummary) || cards.length === 0) {
    throw new Error('Interview prep response schema was invalid.')
  }

  return {
    deckTitle: parsed.deckTitle.trim(),
    companyResearchSummary: parsed.companyResearchSummary.trim(),
    cards,
  }
}
