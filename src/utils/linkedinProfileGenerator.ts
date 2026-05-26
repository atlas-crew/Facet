import type { ProfessionalIdentityV3 } from '../identity/schema'
import { notesText } from '../types/audience'
import type { JDAnalysis } from '../types/jdAnalysis'
import type { LinkedInOutputType, LinkedInProfileGenerationRequest } from '../types/linkedin'
import { callLlmProxy, extractJsonBlock, JsonExtractionError, isString } from './llmProxy'
import { projectForAudience } from './audienceFilter'

const LINKEDIN_PROFILE_MODEL = 'sonnet'

interface LinkedInProfileGenerationPayload {
  name: string
  headline: string
  about: string
  topSkills: unknown[]
  featuredHighlights: unknown[]
  outreachMessage?: unknown
  outreachTalkingPoints?: unknown[]
}

const normalizeStringList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter(isString).map((entry) => entry.trim()).filter(Boolean)
    : []

const audienceForOutputType = (outputType: LinkedInOutputType) => {
  if (outputType === 'recruiter_outreach') return 'recruiter'
  if (outputType === 'hiring_manager_outreach') return 'hiring_manager'
  return 'candidate'
}

const labelForOutputType = (outputType: LinkedInOutputType): string => {
  if (outputType === 'recruiter_outreach') return 'recruiter outreach message'
  if (outputType === 'hiring_manager_outreach') return 'hiring manager outreach message'
  return 'profile summary'
}

const buildProjectedJobContext = (
  analysis: JDAnalysis | null | undefined,
  outputType: LinkedInOutputType,
) => {
  if (!analysis) {
    return null
  }

  const projected = projectForAudience(analysis, audienceForOutputType(outputType))
  return {
    audience: projected.audience,
    company: projected.company,
    role: projected.role,
    oneLineSummary: projected.oneLineSummary,
    matchedVectors: projected.matchedVectors,
    strengthsToLead: notesText(projected.strengthsToLead),
    advantages: projected.advantages,
    gaps: projected.gaps,
    gapFocus: notesText(projected.gapFocus),
    watchOuts: projected.watchOuts,
    triggeredPrioritize: projected.triggeredPrioritize,
    triggeredAvoid: projected.triggeredAvoid,
    relevantAwareness: projected.relevantAwareness,
    positioningRecommendations: notesText(projected.positioningRecommendations),
    evidenceMapping: projected.evidenceMapping,
  }
}

export async function generateLinkedInProfile(
  endpoint: string,
  identity: ProfessionalIdentityV3,
  request: LinkedInProfileGenerationRequest = {},
): Promise<Omit<import('../types/linkedin').LinkedInProfileDraft, 'id' | 'generatedAt'>> {
  const outputType = request.outputType ?? 'profile_summary'
  const projectedJobContext = buildProjectedJobContext(request.jdAnalysis, outputType)
  const systemPrompt = `You are an expert LinkedIn profile writer for senior technical candidates. Return JSON only.
Use only the provided identity model. Do not invent employers, titles, metrics, technologies, or scope.
Write crisp, modern LinkedIn copy that is specific and credible.
Generate a ${labelForOutputType(outputType)}.
The headline should be compact and signal role direction clearly.
The about section should be 2 to 4 short paragraphs.
Top skills should be a concise ordered list.
Featured highlights should be 3 to 5 short bullets suitable for a profile summary or featured section.
For outreach outputs, also write one concise outreach message and 3 to 5 talking points for the selected recipient.

Response schema:
{
  "name": "string",
  "headline": "string",
  "about": "string",
  "topSkills": ["string"],
  "featuredHighlights": ["string"],
  "outreachMessage": "string",
  "outreachTalkingPoints": ["string"]
}
For profile summary outputs, omit outreachMessage and outreachTalkingPoints.
For outreach outputs, include both outreach fields.
Do not include comments in the JSON response.`

  const userPrompt = `Focus: ${request.focus?.trim() || 'Not provided'}
Audience: ${request.audience?.trim() || 'Not provided'}
Output type: ${outputType}

Professional Identity:
${JSON.stringify(identity, null, 2)}

Audience-projected JD context:
${projectedJobContext ? JSON.stringify(projectedJobContext, null, 2) : 'Not provided'}

Return JSON only.`

  const rawResponse = await callLlmProxy(endpoint, systemPrompt, userPrompt, {
    feature: 'linkedin.generate',
    model: LINKEDIN_PROFILE_MODEL,
    timeoutMs: 45000,
  })

  let parsed: LinkedInProfileGenerationPayload
  try {
    parsed = JSON.parse(extractJsonBlock(rawResponse)) as LinkedInProfileGenerationPayload
  } catch (error) {
    if (error instanceof JsonExtractionError) throw error
    throw new Error('Failed to parse LinkedIn profile response.')
  }

  const topSkills = normalizeStringList(parsed.topSkills)
  const featuredHighlights = normalizeStringList(parsed.featuredHighlights)
  const outreachTalkingPoints = normalizeStringList(parsed.outreachTalkingPoints)
  if (
    !isString(parsed.name) ||
    !isString(parsed.headline) ||
    !isString(parsed.about) ||
    topSkills.length === 0 ||
    featuredHighlights.length === 0
  ) {
    throw new Error('LinkedIn profile response schema was invalid.')
  }
  if (
    outputType !== 'profile_summary' &&
    (!isString(parsed.outreachMessage) ||
      !parsed.outreachMessage.trim() ||
      outreachTalkingPoints.length === 0)
  ) {
    throw new Error('LinkedIn outreach response schema was invalid.')
  }

  return {
    outputType,
    name: parsed.name.trim(),
    focus: request.focus?.trim() ?? '',
    audience: request.audience?.trim() ?? '',
    headline: parsed.headline.trim(),
    about: parsed.about.trim(),
    topSkills,
    featuredHighlights,
    ...(isString(parsed.outreachMessage) && parsed.outreachMessage.trim()
      ? { outreachMessage: parsed.outreachMessage.trim() }
      : {}),
    ...(outreachTalkingPoints.length > 0 ? { outreachTalkingPoints } : {}),
  }
}
