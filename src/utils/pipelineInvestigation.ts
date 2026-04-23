import type {
  InterviewFormat,
  PipelineEntry,
  PipelineResearchSnapshot,
  PipelineResearchSource,
  PipelineResearchSourceKind,
} from '../types/pipeline'
import { parseJsonWithRepair } from './jsonParsing'
import {
  JsonExtractionError,
  callSearchProxy,
  extractJsonBlock,
} from './searchExecutor'
import { normalizePipelineResearchSnapshot } from './pipelineResearch'
import { sanitizeUrl } from './sanitizeUrl'

const INVESTIGATION_FORMATS: InterviewFormat[] = [
  'hr-screen',
  'hm-screen',
  'tech-discussion',
  'system-design',
  'take-home',
  'live-coding',
  'leetcode',
  'pair-programming',
  'behavioral',
  'peer-panel',
  'cross-team',
  'exec',
  'presentation',
]

type PipelineInvestigationPayload = {
  summary?: unknown
  jobDescription?: unknown
  jobDescriptionSummary?: unknown
  interviewSignals?: unknown
  formats?: unknown
  sources?: unknown
  nextStep?: unknown
}

export type PipelineInvestigationUpdate = {
  jobDescription: string
  format: InterviewFormat[]
  nextStep: string
  research: PipelineResearchSnapshot
}

const trimString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : ''

const normalizeStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .map((item) => trimString(item))
        .filter(Boolean)
    : []

const dedupeStrings = (values: string[]): string[] => {
  const seen = new Set<string>()
  return values.filter((value) => {
    const key = value.toLowerCase()
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const normalizeFormat = (value: unknown): InterviewFormat | null => {
  return INVESTIGATION_FORMATS.includes(value as InterviewFormat)
    ? (value as InterviewFormat)
    : null
}

const normalizeFormats = (value: unknown): InterviewFormat[] =>
  Array.isArray(value)
    ? [...new Set(value.flatMap((item) => {
        const normalized = normalizeFormat(item)
        return normalized ? [normalized] : []
      }))]
    : []

const normalizeSourceKind = (value: unknown): PipelineResearchSourceKind => {
  switch (value) {
    case 'job-posting':
    case 'search-result':
    case 'company':
    case 'people':
    case 'review':
      return value
    default:
      return 'other'
  }
}

const normalizeSources = (value: unknown): PipelineResearchSource[] =>
  Array.isArray(value)
    ? value.flatMap((source) => {
        if (!isRecord(source)) {
          return []
        }

        const label = trimString(source.label)
        const url = sanitizeUrl(trimString(source.url)) ?? ''

        if (!label && !url) {
          return []
        }

        return [{
          label: label || url,
          ...(url ? { url } : {}),
          kind: normalizeSourceKind(source.kind),
        }]
      })
    : []

const dedupeSources = (sources: PipelineResearchSource[]): PipelineResearchSource[] => {
  const seen = new Set<string>()
  return sources.filter((source) => {
    const key = [
      source.kind,
      source.url?.toLowerCase() ?? '',
      source.label.toLowerCase(),
    ].join('|')
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

export async function investigatePipelineEntry(
  entry: PipelineEntry,
  endpoint: string,
): Promise<PipelineInvestigationUpdate> {
  const existingResearch = normalizePipelineResearchSnapshot(entry.research)

  const systemPrompt = `You are a strategic job researcher. Use web search actively and return JSON only.
Investigate this exact job opportunity as deeply as public evidence allows. Prefer the live job posting, company career pages, public candidate reports, and public team or recruiter profiles.
Do not invent details. If something cannot be found confidently, leave it blank or omit it.

Return JSON only with this schema:
{
  "summary": "string",
  "jobDescription": "string",
  "jobDescriptionSummary": "string",
  "interviewSignals": ["string"],
  "formats": ["hr-screen" | "hm-screen" | "tech-discussion" | "system-design" | "take-home" | "live-coding" | "leetcode" | "pair-programming" | "behavioral" | "peer-panel" | "cross-team" | "exec" | "presentation"],
  "sources": [
    {
      "label": "string",
      "url": "optional string",
      "kind": "job-posting | company | review | other"
    }
  ],
  "nextStep": "string"
}

Do not attempt to identify specific interviewers, recruiters, or team members by name. Who is on a given panel is scheduling-dependent and not reliably inferrable from public sources; users will supply interviewer names when they learn them from the recruiter.`

  const userPrompt = `Investigate this pipeline job and gather as much public context as possible.

Pipeline entry:
${JSON.stringify(
    {
      company: entry.company,
      role: entry.role,
      url: entry.url,
      comp: entry.comp,
      positioning: entry.positioning,
      skillMatch: entry.skillMatch,
      nextStep: entry.nextStep,
      notes: entry.notes,
      jobDescription: entry.jobDescription,
      existingResearch,
    },
    null,
    2,
  )}

Goals:
- Find the best available public job description or a faithful summary if the full posting is inaccessible.
- Infer likely interview steps only from public evidence such as the job posting, public candidate reports, or other reputable sources.
- Return source links so the user can verify the research.
- Suggest one concrete next step the candidate should take from here.
- Do not name specific interviewers, recruiters, or hiring managers. The user provides interviewer names separately when scheduling is known.`

  const execution = await callSearchProxy(endpoint, systemPrompt, userPrompt)

  let parsed: PipelineInvestigationPayload
  try {
    parsed = parseJsonWithRepair<PipelineInvestigationPayload>(
      extractJsonBlock(execution.text),
      'Pipeline investigation response',
    ).data
  } catch (error) {
    if (error instanceof JsonExtractionError) {
      throw error
    }
    throw new Error('Failed to parse pipeline investigation response.')
  }

  const mergedResearch = normalizePipelineResearchSnapshot({
    status: 'investigated',
    summary: trimString(parsed.summary) || existingResearch?.summary || '',
    jobDescriptionSummary:
      trimString(parsed.jobDescriptionSummary) || existingResearch?.jobDescriptionSummary || '',
    interviewSignals: dedupeStrings([
      ...(existingResearch?.interviewSignals ?? []),
      ...normalizeStringArray(parsed.interviewSignals),
    ]),
    // People discovery is intentionally not performed by the investigator —
    // AI-inferred interviewer identities are reliably wrong (scheduling-dependent,
    // not inferrable from public sources). Users supply names in the pipeline UI
    // when they learn them from the recruiter; see doc-30 §Interviewer Capture.
    people: [],
    sources: dedupeSources([
      ...(existingResearch?.sources ?? []),
      ...normalizeSources(parsed.sources),
    ]),
    searchQueries: dedupeStrings([
      ...(existingResearch?.searchQueries ?? []),
      ...execution.searchLog,
    ]),
    lastInvestigatedAt: new Date().toISOString(),
  })

  if (!mergedResearch) {
    throw new Error('Pipeline investigation returned no usable research.')
  }

  return {
    jobDescription: trimString(parsed.jobDescription) || entry.jobDescription,
    format: (() => {
      const formats = normalizeFormats(parsed.formats)
      return formats.length > 0 ? formats : entry.format
    })(),
    nextStep: trimString(parsed.nextStep) || entry.nextStep,
    research: mergedResearch,
  }
}
