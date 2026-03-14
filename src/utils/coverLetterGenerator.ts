import type { CoverLetterParagraph } from '../types/coverLetter'
import type { ResumeMeta, ResumeVector } from '../types'
import { callLlmProxy, extractJsonBlock, JsonExtractionError, isString } from './llmProxy'

/** Model used for cover letters — needs creative, polished prose. */
const COVER_LETTER_MODEL = 'sonnet'

interface CoverLetterGenerationPayload {
  name: string
  greeting: string
  signOff: string
  paragraphs: unknown[]
}

export interface CoverLetterGenerationRequest {
  company: string
  role: string
  contact?: string
  vectorId: string
  vectorLabel: string
  companyUrl?: string
  skillMatch?: string
  positioning?: string
  notes?: string
  companyResearch?: string
  jobDescription: string
  resumeContext: {
    candidate: ResumeMeta
    vector: ResumeVector
    assembled: unknown
  }
}

export type GeneratedCoverLetterParagraph = Pick<CoverLetterParagraph, 'label' | 'text'>

export interface CoverLetterGenerationResult {
  name: string
  header: string
  greeting: string
  signOff: string
  paragraphs: GeneratedCoverLetterParagraph[]
}

function buildHeader(meta: ResumeMeta): string {
  const contactLine = [meta.location, meta.email, meta.phone]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' | ')

  const linksLine = meta.links
    .map((link) => [link.label?.trim(), link.url.trim()].filter(Boolean).join(': '))
    .filter(Boolean)
    .join(' | ')

  return [meta.name.trim(), contactLine, linksLine].filter(Boolean).join('\n')
}

function normalizeParagraphs(paragraphs: unknown[]): GeneratedCoverLetterParagraph[] {
  return paragraphs.flatMap((paragraph) => {
    if (!paragraph || typeof paragraph !== 'object') return []
    const record = paragraph as Record<string, unknown>
    if (!isString(record.text) || !record.text.trim()) return []

    return [
      {
        label: isString(record.label) && record.label.trim() ? record.label.trim() : undefined,
        text: record.text.trim(),
      },
    ]
  })
}

export async function generateCoverLetter(
  endpoint: string,
  request: CoverLetterGenerationRequest,
): Promise<CoverLetterGenerationResult> {
  const systemPrompt = `You are an expert cover-letter writer for senior technical candidates. Return JSON only.
Draft a concise, specific, truthful cover letter grounded only in the provided resume and job context.
Favor 3 to 5 paragraphs with direct, modern language. Keep the tone confident but not inflated.
Do not invent employers, projects, metrics, technologies, or responsibilities not present in the input.
Use the target vector and job description to decide what to emphasize.
If a hiring contact is unavailable, use a professional generic greeting.

Response schema:
{
  "name": "string",
  "greeting": "string",
  "signOff": "string",
  "paragraphs": [
    {
      "label": "optional short label",
      "text": "string"
    }
  ]
}`

  const header = buildHeader(request.resumeContext.candidate)
  const userPrompt = `Target Company: ${request.company}
Target Role: ${request.role}
Hiring Contact: ${request.contact || 'Not provided'}
Target Vector: ${request.vectorLabel} (${request.vectorId})
Company URL: ${request.companyUrl ?? 'Not provided'}
Skill Match Notes: ${request.skillMatch ?? 'Not provided'}
Positioning Notes: ${request.positioning ?? 'Not provided'}
Additional Notes: ${request.notes ?? 'Not provided'}
Company Research Notes: ${request.companyResearch ?? 'Not provided'}

Candidate Header:
${header}

Job Description:
${request.jobDescription}

Resume Context:
${JSON.stringify(request.resumeContext, null, 2)}

Return JSON only.`

  const rawResponse = await callLlmProxy(endpoint, systemPrompt, userPrompt, {
    feature: 'letters.generate',
    model: COVER_LETTER_MODEL,
    timeoutMs: 45000,
  })

  let parsed: CoverLetterGenerationPayload
  try {
    parsed = JSON.parse(extractJsonBlock(rawResponse)) as CoverLetterGenerationPayload
  } catch (error) {
    if (error instanceof JsonExtractionError) throw error
    throw new Error('Failed to parse cover letter response.')
  }

  const paragraphs = normalizeParagraphs(Array.isArray(parsed.paragraphs) ? parsed.paragraphs : [])
  if (!isString(parsed.name) || !isString(parsed.greeting) || !isString(parsed.signOff) || paragraphs.length === 0) {
    throw new Error('Cover letter response schema was invalid.')
  }

  return {
    name: parsed.name.trim(),
    header,
    greeting: parsed.greeting.trim(),
    signOff: parsed.signOff.trim(),
    paragraphs,
  }
}
