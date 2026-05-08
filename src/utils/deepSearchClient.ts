import type { ProfessionalIdentityV3 } from '../identity/schema'
import { CITATION_TYPE_VALUES } from '../types/search'
import type {
  DeepResearchIdentityEvidence,
  ResearchJob,
  ResearchJobStatus,
  ResearchUsageBudgetWarning,
  ResearchUsageSnapshot,
  SearchProfile,
  SearchRequest,
  SearchRun,
  SearchThesis,
} from '../types/search'
import { readAiProxyError } from './aiProxyErrors'
import { facetClientEnv } from './facetEnv'
import { getHostedAccessToken } from './hostedSession'
import { normalizeRunNarrative, validateNarrativeCandidateEdges } from './searchExecutor'
import { formatSearchProfileFilterEntry } from './searchProfileFilters'

const DEFAULT_PROXY_API_KEY = 'facet-local-proxy'

export const RESEARCH_JOB_POLL_DELAYS_MS = [2000, 5000, 15000, 30000] as const

export const DEEP_RESEARCH_OUTPUT_CONTRACT = [
  'Your response must include run-level narrative fields: competitiveMoat, selectionMethodology, marketContext, executiveSummary, surprises[], rejectedCandidates[], nextSteps[], and references[] when factual claims are cited.',
  'Include run-level synthesis when useful: laneSummaries[], objectiveRecommendations[], applicationPlan tied to SearchTimeline.deadline, and Mermaid visualizations[].',
  'If thesisSnapshot.assumptions[] is present, carry those assumptions forward in narrative.assumptions[] and add any new material assumptions made during deep research. Do not silently assume missing visa status, location precision, compensation flexibility, travel willingness, remote/hybrid scope, sponsorship, or timeline constraints.',
  'Each narrative.assumptions[] item must include claim, source (inferred|assumed-default|explicit-fallback), rationale, confidence (high|medium|low), and overridable.',
  'Each result must include candidateEdge as 2-4 sentences using candidate fact + company fact + interpretation.',
  'Each result should include interviewProcess, companyIntel, signalGroup, and advantageMatch when evidence is available.',
  'When params.resumeVariants is non-empty, each top result must include recommendedVariant matching one params.resumeVariants[].id.',
  'When params.resumeVariants is non-empty, each top result must include exactly 3 bulletEdits: one lead edit followed by two supporting edits; each bullet text must be paste-ready, first-person past-tense, metric-bearing, and under 30 words.',
  'keywordsToInclude must contain 8-12 posting-specific phrases from the source posting, not generic skills.',
  'Each result may include jobDescription only when raw job posting text is directly available from a cited/source page; include jobDescriptionSourceUrl with the same-origin source URL and do not infer or synthesize a JD.',
  'Every factual claim about interview process, compensation, company size, team structure, hiring status, policies, or funding must use [cite:<id>] markers resolving to a Citation in result.citations[] or narrative.citations[].',
  'Citation objects must include id, source, optional url, optional type (' +
    CITATION_TYPE_VALUES.join('|') +
    '), and optional claim. Do not leave unresolved [cite:<id>] markers in prose.',
  'Do not collapse reasoning into fragments. Fields labeled narrative or summary expect prose. Fields labeled edge or reason expect 2-4 sentences. If you cannot cite a factual claim, do not claim it.',
].join('\n')

export interface DeepResearchCreateInput {
  endpoint: string
  thesisSnapshot: SearchThesis
  params: SearchRequest
  identityEvidence?: DeepResearchIdentityEvidence
}

export interface DeepResearchCreateResponse {
  jobId: string
  status: Extract<ResearchJobStatus, 'queued' | 'running'>
  duplicate?: boolean
  warning?: ResearchUsageBudgetWarning
  usage?: ResearchUsageSnapshot
}

export function getResearchJobPollDelay(attempt: number): number {
  const index = Math.max(0, Math.min(RESEARCH_JOB_POLL_DELAYS_MS.length - 1, attempt))
  return RESEARCH_JOB_POLL_DELAYS_MS[index]
}

export function resolveResearchJobsUrl(endpoint: string, path = ''): string {
  const origin = globalThis.location?.origin ?? 'http://localhost'
  const base = new URL(endpoint, origin)
  const basePath = base.pathname === '/' ? '' : base.pathname.replace(/\/+$/, '')
  return new URL(basePath + '/research/jobs' + path, base.origin).toString()
}

export function resolveResearchUsageUrl(endpoint: string): string {
  const origin = globalThis.location?.origin ?? 'http://localhost'
  const base = new URL(endpoint, origin)
  const basePath = base.pathname === '/' ? '' : base.pathname.replace(/\/+$/, '')
  return new URL(basePath + '/research/usage', base.origin).toString()
}

export async function researchJobHeaders(): Promise<Record<string, string>> {
  const bearerToken = await getHostedAccessToken()
  const configuredProxyApiKey = facetClientEnv.anthropicProxyApiKey || undefined
  const resolvedProxyApiKey =
    configuredProxyApiKey ?? (bearerToken ? undefined : DEFAULT_PROXY_API_KEY)

  return {
    'Content-Type': 'application/json',
    ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
    ...(resolvedProxyApiKey ? { 'X-Proxy-API-Key': resolvedProxyApiKey } : {}),
  }
}

export type DeepResearchStreamEventType =
  | 'thinking'
  | 'search_query'
  | 'finding'
  | 'status'
  | 'complete'

export interface DeepResearchStreamEvent {
  type: DeepResearchStreamEventType
  data: string
}

export interface DeepResearchStreamHandlers {
  onEvent: (event: DeepResearchStreamEvent) => void
  onError?: (error: unknown) => void
  onClose?: () => void
}

const parseSseEvent = (chunk: string): DeepResearchStreamEvent | null => {
  let type = 'message'
  const data: string[] = []
  for (const line of chunk.split(/\r?\n/)) {
    if (line.startsWith('event:')) {
      type = line.slice('event:'.length).trim()
    } else if (line.startsWith('data:')) {
      data.push(line.slice('data:'.length).replace(/^ /, ''))
    }
  }
  if (!['thinking', 'search_query', 'finding', 'status', 'complete'].includes(type)) {
    return null
  }
  return { type: type as DeepResearchStreamEventType, data: data.join('\n') }
}

export function streamDeepResearchJob(
  endpoint: string,
  jobId: string,
  handlers: DeepResearchStreamHandlers,
): { close: () => void } {
  const controller = new AbortController()

  void (async () => {
    try {
      const response = await fetch(
        resolveResearchJobsUrl(endpoint, '/' + encodeURIComponent(jobId) + '/stream'),
        {
          method: 'GET',
          headers: {
            ...(await researchJobHeaders()),
            Accept: 'text/event-stream',
          },
          signal: controller.signal,
        },
      )
      if (!response.ok) {
        throw await readAiProxyError(response)
      }
      if (!response.body) {
        throw new Error('Deep research stream did not include a response body.')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (!controller.signal.aborted) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const chunks = buffer.split(/\r?\n\r?\n/)
        buffer = chunks.pop() ?? ''
        for (const chunk of chunks) {
          const event = parseSseEvent(chunk)
          if (event) handlers.onEvent(event)
        }
      }
      if (!controller.signal.aborted) {
        handlers.onClose?.()
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        handlers.onError?.(error)
      }
    }
  })()

  return {
    close: () => controller.abort(),
  }
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw await readAiProxyError(response)
  }
  return (await response.json()) as T
}

export async function createDeepResearchJob({
  endpoint,
  thesisSnapshot,
  params,
  identityEvidence,
}: DeepResearchCreateInput): Promise<DeepResearchCreateResponse> {
  if (params.focusLanes.length === 0) {
    throw new Error('Deep research requires at least one thesis focus lane.')
  }

  const response = await fetch(resolveResearchJobsUrl(endpoint), {
    method: 'POST',
    headers: await researchJobHeaders(),
    body: JSON.stringify({
      thesisId: thesisSnapshot.id,
      thesisSnapshot,
      identityVersion: thesisSnapshot.identityVersion,
      params,
      identityEvidence,
      promptContract: DEEP_RESEARCH_OUTPUT_CONTRACT,
    }),
  })

  return readJsonResponse<DeepResearchCreateResponse>(response)
}

export async function fetchDeepResearchJob(endpoint: string, jobId: string): Promise<ResearchJob> {
  const response = await fetch(resolveResearchJobsUrl(endpoint, `/${encodeURIComponent(jobId)}`), {
    method: 'GET',
    headers: await researchJobHeaders(),
  })
  const payload = await readJsonResponse<{ job: ResearchJob }>(response)
  return payload.job
}

export async function cancelDeepResearchJob(endpoint: string, jobId: string): Promise<ResearchJob> {
  const response = await fetch(
    resolveResearchJobsUrl(endpoint, `/${encodeURIComponent(jobId)}/cancel`),
    {
      method: 'POST',
      headers: await researchJobHeaders(),
    },
  )
  const payload = await readJsonResponse<{ job: ResearchJob }>(response)
  return payload.job
}

export async function fetchResearchUsage(endpoint: string): Promise<ResearchUsageSnapshot> {
  const response = await fetch(resolveResearchUsageUrl(endpoint), {
    method: 'GET',
    headers: await researchJobHeaders(),
  })
  return readJsonResponse<ResearchUsageSnapshot>(response)
}

export function buildDeepResearchIdentityEvidence(
  identity: ProfessionalIdentityV3 | null,
  profile: SearchProfile,
): DeepResearchIdentityEvidence {
  if (!identity) {
    return {
      archetype: profile.source?.label ?? 'Resume-backed search profile',
      arc: profile.workSummary.map((entry) => `${entry.title}: ${entry.summary}`).slice(0, 6),
      profiles: profile.workSummary.map((entry, index) => ({
        id: `work-summary-${index + 1}`,
        tags: [entry.title],
        text: entry.summary,
      })),
      paioHighlights: [
        ...profile.skills
          .filter((skill) => skill.context)
          .map((skill) => `${skill.name}: ${skill.context}`),
        ...profile.openQuestions.map((question) => `Open question: ${question}`),
      ].slice(0, 16),
      calibrations: [
        ...profile.filters.prioritize.map(
          (item) => `Prioritize: ${formatSearchProfileFilterEntry(item)}`,
        ),
        ...profile.filters.avoid.map((item) => `Avoid: ${formatSearchProfileFilterEntry(item)}`),
        ...profile.interviewPrefs.strongFit.map((item) => `Strong interview fit: ${item}`),
        ...profile.interviewPrefs.redFlags.map((item) => `Interview red flag: ${item}`),
      ],
    }
  }

  const roleHighlights = identity.roles.flatMap((role) =>
    role.bullets
      .slice(0, 2)
      .map((bullet) =>
        [role.company, bullet.problem, bullet.action, bullet.outcome].filter(Boolean).join(' | '),
      ),
  )
  const projectHighlights = identity.projects.map((project) =>
    [project.name, project.description, project.portfolio_dive].filter(Boolean).join(' | '),
  )
  const vectorEvidence = (identity.search_vectors ?? []).flatMap((vector) => [
    `${vector.title}: ${vector.thesis}`,
    ...(vector.evidence ?? []),
  ])
  const skillCalibrations = identity.skills.groups.flatMap((group) => [
    ...(group.calibration ? [`${group.label}: ${group.calibration}`] : []),
    ...group.items
      .filter((item) => item.context || item.positioning)
      .map((item) =>
        [item.name, item.depth, item.context, item.positioning].filter(Boolean).join(' | '),
      ),
  ])
  const matchingCalibrations = [
    ...identity.preferences.matching.prioritize.map((item) =>
      [`Prioritize: ${item.label}`, item.description, item.condition].filter(Boolean).join(' | '),
    ),
    ...identity.preferences.matching.avoid.map((item) =>
      [`Avoid: ${item.label}`, item.description, item.condition].filter(Boolean).join(' | '),
    ),
  ]

  return {
    archetype: identity.identity.thesis || identity.identity.title || identity.identity.name,
    arc: identity.self_model.arc.map((entry) => `${entry.company}: ${entry.chapter}`),
    profiles: identity.profiles.map((identityProfile) => ({
      id: identityProfile.id,
      tags: identityProfile.tags,
      text: identityProfile.text,
    })),
    paioHighlights: [...roleHighlights, ...projectHighlights, ...vectorEvidence].slice(0, 24),
    calibrations: [...skillCalibrations, ...matchingCalibrations].slice(0, 24),
  }
}

export function hydrateSearchRunFromResearchJob(job: ResearchJob): Partial<SearchRun> {
  if (job.status === 'completed') {
    if (!job.result) {
      return {
        status: 'failed',
        error: 'Deep research job completed but the result payload was missing.',
      }
    }
    const narrativeNormalization = normalizeRunNarrative(job.result.narrative)
    const narrative =
      narrativeNormalization.status === 'ready' ? narrativeNormalization.narrative : job.result.narrative
    const contractViolations = [
      ...(job.result.contractViolations ?? []),
      ...narrativeNormalization.contractViolations,
      ...validateNarrativeCandidateEdges(job.result.results),
    ]
    console.info('[research] assumption count', {
      jobId: job.id,
      thesisId: job.thesisId,
      phase: 'deep-research',
      count: narrative.assumptions?.length ?? 0,
    })
    return {
      status: 'completed',
      results: job.result.results,
      searchLog: job.progress?.searchQueries ?? [],
      tokenUsage: job.result.tokenUsage,
      narrative,
      contractViolations,
      error: undefined,
    }
  }

  if (job.status === 'failed') {
    return {
      status: 'failed',
      error: job.error?.message ?? 'Deep research job failed.',
    }
  }

  if (job.status === 'canceled') {
    return {
      status: 'failed',
      error: 'Deep research job was canceled. Thesis and request are preserved for retry.',
    }
  }

  return {
    status: 'running',
    searchLog: job.progress?.searchQueries ?? [],
    error: undefined,
  }
}
