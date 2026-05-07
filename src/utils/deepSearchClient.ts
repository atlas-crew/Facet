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
import { createId } from './idUtils'
import { validateNarrativeCandidateEdges } from './searchExecutor'

const DEFAULT_PROXY_API_KEY = 'facet-local-proxy'

export const RESEARCH_JOB_POLL_DELAYS_MS = [2000, 5000, 15000, 30000] as const

export const DEEP_RESEARCH_OUTPUT_CONTRACT = [
  'Your response must include run-level narrative fields: competitiveMoat, selectionMethodology, marketContext, executiveSummary, surprises[], rejectedCandidates[], nextSteps[], and references[] when factual claims are cited.',
  'Include run-level synthesis when useful: laneSummaries[], objectiveRecommendations[], applicationPlan tied to SearchTimeline.deadline, and Mermaid visualizations[].',
  'Each result must include candidateEdge as 2-4 sentences using candidate fact + company fact + interpretation.',
  'Each result should include interviewProcess, companyIntel, signalGroup, and advantageMatch when evidence is available.',
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
        ...profile.filters.prioritize.map((item) => `Prioritize: ${item}`),
        ...profile.filters.avoid.map((item) => `Avoid: ${item}`),
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

export function buildDeepResearchThesisSnapshot({
  profile,
  request,
  identity,
  createdAt = new Date().toISOString(),
}: {
  profile: SearchProfile
  request: SearchRequest
  identity: ProfessionalIdentityV3 | null
  createdAt?: string
}): SearchThesis {
  const identityVersion = Math.max(0, Math.floor(identity?.model_revision ?? 0))
  const activeVectors =
    request.focusVectors.length > 0
      ? profile.vectors.filter((vector) => request.focusVectors.includes(vector.vectorId))
      : profile.vectors
  const vectors = activeVectors.length > 0 ? activeVectors : profile.vectors
  const prioritizedSkills = profile.skills.filter((skill) => skill.depth !== 'avoid').slice(0, 12)
  const skillDepthMap = prioritizedSkills.map((skill) => ({
    skill: skill.name,
    depth: skill.depth,
    context:
      skill.context ?? skill.positioning ?? `${skill.category} skill from the search profile`,
    searchSignal: skill.positioning ?? `Use ${skill.name} as a ${skill.depth} match signal.`,
  }))
  const fallbackSkill = profile.skills.find((skill) => skill.name.trim())
  const safeSkillDepthMap =
    skillDepthMap.length > 0
      ? skillDepthMap
      : [
          {
            skill: fallbackSkill?.name ?? 'Candidate profile',
            depth: fallbackSkill?.depth ?? 'working',
            context: fallbackSkill?.context ?? 'Search profile evidence is available but sparse.',
            searchSignal: 'Use the candidate profile as the primary fit signal.',
          },
        ]
  const lanes = vectors.map((vector, index) => ({
    id: vector.vectorId || `lane-${index + 1}`,
    title: vector.targetRoleTitles[0] || vector.description || `Search lane ${index + 1}`,
    rationale:
      vector.description ||
      `Search for roles where ${vector.searchKeywords.slice(0, 3).join(', ') || 'the candidate profile'} creates an advantage.`,
    targetSignals:
      vector.searchKeywords.length > 0 ? vector.searchKeywords : vector.targetRoleTitles,
  }))
  const safeLanes =
    lanes.length > 0
      ? lanes
      : [
          {
            id: 'general-fit',
            title: 'General fit',
            rationale: 'Search for roles that match the candidate profile and constraints.',
            targetSignals: prioritizedSkills.map((skill) => skill.name).slice(0, 5),
          },
        ]
  const keywordCombinations = safeLanes.flatMap((lane) => {
    const keywords = lane.targetSignals.length > 0 ? lane.targetSignals : [lane.title]
    return keywords.slice(0, 3).map((keyword) => ({
      id: createId('skwd'),
      query: [keyword, request.customKeywords].filter(Boolean).join(' '),
      lane: lane.id,
      noiseLevel: 'medium' as const,
    }))
  })
  const moat =
    identity?.identity.thesis ||
    profile.workSummary[0]?.summary ||
    `Candidate combines ${
      prioritizedSkills
        .slice(0, 3)
        .map((skill) => skill.name)
        .join(', ') || 'validated experience'
    } with the requested search constraints.`
  const narrative = [
    moat,
    `This search prioritizes ${safeLanes.map((lane) => lane.title).join(', ')} while respecting compensation, location, and company-fit constraints.`,
    `The deep research runner should use the raw identity evidence to prove candidate-edge claims instead of relying on the compressed thesis alone.`,
  ].join('\n\n')

  return {
    id: createId('sthesis'),
    createdAt,
    updatedAt: createdAt,
    narrative,
    competitiveMoat: moat,
    unfairAdvantages: safeSkillDepthMap.slice(0, 4).map((skill) => ({
      id: createId('sadv'),
      combination: skill.skill,
      depth: skill.depth,
      targetCompanyProfile: safeLanes[0]?.title ?? 'High-fit teams',
    })),
    searchLanes: safeLanes,
    interviewStrategy:
      profile.interviewPrefs.strongFit[0] ??
      identity?.self_model.interview_style.prep_strategy ??
      'Prefer evidence-backed work sample and architecture conversations over trivia-heavy screening.',
    lookFor: [...profile.filters.prioritize, ...safeLanes.flatMap((lane) => lane.targetSignals)]
      .slice(0, 16)
      .map((label) => ({ id: createId('ssig'), label, severity: 'soft' })),
    avoid: profile.filters.avoid.map((label) => ({
      id: createId('ssig'),
      label,
      severity: 'soft',
    })),
    keywordCombinations,
    skillDepthMap: safeSkillDepthMap,
    source: 'generated',
    identityVersion,
    feedbackIncorporated: [],
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
    const contractViolations = [
      ...(job.result.contractViolations ?? []),
      ...validateNarrativeCandidateEdges(job.result.results),
    ]
    return {
      status: 'completed',
      results: job.result.results,
      searchLog: job.progress?.searchQueries ?? [],
      tokenUsage: job.result.tokenUsage,
      narrative: job.result.narrative,
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
