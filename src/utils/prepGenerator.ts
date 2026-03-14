import type { PrepCard, PrepGenerationRequest } from '../types/prep'
import { createId } from './idUtils'
import { callLlmProxy, extractJsonBlock, JsonExtractionError, isString } from './llmProxy'

/** Model used for interview prep — needs creative, detailed output. */
const PREP_MODEL = 'sonnet'

interface PrepGenerationPayload {
  deckTitle: string
  companyResearchSummary: string
  cards: Array<Omit<PrepCard, 'id'>>
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

  const rawResponse = await callLlmProxy(endpoint, systemPrompt, userPrompt, {
    feature: 'prep.generate',
    model: PREP_MODEL,
    timeoutMs: 45000,
  })

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
