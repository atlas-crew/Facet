import type { ProfessionalRoleBullet } from '../identity/schema'
import type {
  DebriefGenerationRequest,
  DebriefGenerationResult,
  DebriefIdentityPatch,
  DebriefPatternSignal,
  DebriefQuestionReview,
} from '../types/debrief'
import { notesText } from '../types/audience'
import type { IdentityAssumptionTag } from '../types/identity'
import type { AudienceProjection } from './audienceFilter'
import { projectForAudience } from './audienceFilter'
import { callLlmProxy, extractJsonBlock, JsonExtractionError, isString } from './llmProxy'

const DEBRIEF_MODEL = 'sonnet'

type RawObject = Record<string, unknown>

const normalizeStringList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .filter(isString)
        .map((entry) => entry.trim())
        .filter(Boolean)
    : []

const normalizeAssumptions = (value: unknown): IdentityAssumptionTag[] =>
  Array.isArray(value)
    ? value.flatMap((entry) => {
        if (!entry || typeof entry !== 'object') return []
        const record = entry as RawObject
        if (!isString(record.label) || !isString(record.confidence)) return []
        if (
          record.confidence !== 'stated' &&
          record.confidence !== 'confirmed' &&
          record.confidence !== 'guessing' &&
          record.confidence !== 'corrected'
        ) {
          return []
        }
        return [{ label: record.label.trim(), confidence: record.confidence }]
      })
    : []

const normalizeQuestionReviews = (value: unknown): DebriefQuestionReview[] =>
  Array.isArray(value)
    ? value.flatMap((entry) => {
        if (!entry || typeof entry !== 'object') return []
        const record = entry as RawObject
        if (!isString(record.question)) return []
        return [
          {
            question: record.question.trim(),
            takeaway: isString(record.takeaway) ? record.takeaway.trim() : undefined,
          },
        ]
      })
    : []

const normalizePatternSignals = (value: unknown): DebriefPatternSignal[] =>
  Array.isArray(value)
    ? value.flatMap((entry) => {
        if (!entry || typeof entry !== 'object') return []
        const record = entry as RawObject
        if (!isString(record.id) || !isString(record.label) || !isString(record.reason)) return []
        return [
          {
            id: record.id.trim(),
            label: record.label.trim(),
            reason: record.reason.trim(),
            roleId: isString(record.roleId) ? record.roleId.trim() : undefined,
            bulletId: isString(record.bulletId) ? record.bulletId.trim() : undefined,
          },
        ]
      })
    : []

// Explicit LLM-context allow-list. When JDAnalysis grows, update this serializer
// deliberately instead of sending every canonical/internal field by default.
const formatJdAnalysisForPrompt = (analysis: AudienceProjection | null): string => {
  if (!analysis) return 'Not provided.'

  return JSON.stringify(
    {
      id: analysis.id,
      audience: analysis.audience,
      pipelineEntryId: analysis.pipelineEntryId,
      generatedAt: analysis.generatedAt,
      modelVersion: analysis.modelVersion,
      jdTextHash: analysis.jdTextHash,
      summary: analysis.summary,
      oneLineSummary: analysis.oneLineSummary,
      recommendation: analysis.recommendation,
      confidence: analysis.confidence,
      fitScore: analysis.fitScore,
      rationale: analysis.rationale,
      requirements: analysis.requirements,
      skillMatches: analysis.skillMatches,
      matchedVectors: analysis.matchedVectors,
      primaryVectorId: analysis.primaryVectorId,
      strengthsToLead: analysis.strengthsToLead,
      advantages: analysis.advantages,
      advantageHypotheses: analysis.advantageHypotheses,
      gaps: analysis.gaps,
      gapFocus: analysis.gapFocus,
      watchOuts: analysis.watchOuts,
      triggeredPrioritize: analysis.triggeredPrioritize,
      triggeredAvoid: analysis.triggeredAvoid,
      relevantAwareness: analysis.relevantAwareness,
      positioningRecommendations: analysis.positioningRecommendations,
      evidenceMapping: analysis.evidenceMapping,
      requirementCoverageScore: analysis.requirementCoverageScore,
      matchedRequirementIds: analysis.matchedRequirementIds,
      matchedKeywords: analysis.matchedKeywords,
    },
    null,
    2,
  )
}

const normalizeBullet = (value: unknown): ProfessionalRoleBullet | null => {
  if (!value || typeof value !== 'object') return null
  const record = value as RawObject
  if (
    !isString(record.id) ||
    !isString(record.problem) ||
    !isString(record.action) ||
    !isString(record.outcome)
  ) {
    return null
  }

  const metrics =
    record.metrics && typeof record.metrics === 'object'
      ? Object.fromEntries(
          Object.entries(record.metrics as RawObject).flatMap(([key, metricValue]) => {
            if (
              typeof metricValue === 'string' ||
              typeof metricValue === 'boolean' ||
              (typeof metricValue === 'number' && Number.isFinite(metricValue))
            ) {
              return [[key, metricValue]]
            }
            return []
          }),
        )
      : {}

  return {
    id: record.id.trim(),
    problem: record.problem.trim(),
    action: record.action.trim(),
    outcome: record.outcome.trim(),
    impact: normalizeStringList(record.impact),
    metrics,
    technologies: normalizeStringList(record.technologies),
    portfolio_dive:
      record.portfolio_dive === null
        ? null
        : isString(record.portfolio_dive)
          ? record.portfolio_dive.trim()
          : undefined,
    tags: normalizeStringList(record.tags).map((entry) => entry.toLowerCase()),
  }
}

const normalizeIdentityPatch = (value: unknown): DebriefIdentityPatch | null => {
  if (!value || typeof value !== 'object') return null
  const record = value as RawObject
  if (!isString(record.summary)) return null
  const updatedInterviewStyle =
    record.updatedInterviewStyle && typeof record.updatedInterviewStyle === 'object'
      ? (record.updatedInterviewStyle as RawObject)
      : null

  return {
    summary: record.summary.trim(),
    correctionNotes: normalizeStringList(record.correctionNotes),
    followUpQuestions: normalizeStringList(record.followUpQuestions),
    updatedInterviewStyle: updatedInterviewStyle
      ? {
          strengths: normalizeStringList(updatedInterviewStyle.strengths),
          weaknesses: normalizeStringList(updatedInterviewStyle.weaknesses),
          prep_strategy: isString(updatedInterviewStyle.prep_strategy)
            ? updatedInterviewStyle.prep_strategy.trim()
            : undefined,
        }
      : undefined,
    bulletUpdates: Array.isArray(record.bulletUpdates)
      ? record.bulletUpdates.flatMap((entry) => {
          if (!entry || typeof entry !== 'object') return []
          const item = entry as RawObject
          if (!isString(item.roleId) || !isString(item.bulletId)) return []
          return [
            {
              roleId: item.roleId.trim(),
              bulletId: item.bulletId.trim(),
              addTags: normalizeStringList(item.addTags).map((tag) => tag.toLowerCase()),
              impactAdditions: normalizeStringList(item.impactAdditions),
              portfolioDive:
                item.portfolioDive === null
                  ? null
                  : isString(item.portfolioDive)
                    ? item.portfolioDive.trim()
                    : undefined,
            },
          ]
        })
      : [],
    newBullets: Array.isArray(record.newBullets)
      ? record.newBullets.flatMap((entry) => {
          if (!entry || typeof entry !== 'object') return []
          const item = entry as RawObject
          if (!isString(item.roleId)) return []
          const bullet = normalizeBullet(item.bullet)
          if (!bullet) return []
          return [
            {
              roleId: item.roleId.trim(),
              bullet,
              rewrite: isString(item.rewrite) ? item.rewrite.trim() : undefined,
              assumptions: normalizeAssumptions(item.assumptions),
            },
          ]
        })
      : [],
    rewrites: Array.isArray(record.rewrites)
      ? record.rewrites.flatMap((entry) => {
          if (!entry || typeof entry !== 'object') return []
          const item = entry as RawObject
          if (
            !isString(item.roleId) ||
            !isString(item.roleLabel) ||
            !isString(item.bulletId) ||
            !isString(item.rewrite)
          ) {
            return []
          }
          return [
            {
              roleId: item.roleId.trim(),
              roleLabel: item.roleLabel.trim(),
              bulletId: item.bulletId.trim(),
              rewrite: item.rewrite.trim(),
              tags: normalizeStringList(item.tags).map((tag) => tag.toLowerCase()),
              assumptions: normalizeAssumptions(item.assumptions),
            },
          ]
        })
      : [],
  }
}

export async function generateDebriefReport(
  endpoint: string,
  request: DebriefGenerationRequest,
): Promise<DebriefGenerationResult> {
  const candidateJdAnalysis = request.jdAnalysis
    ? projectForAudience(request.jdAnalysis, 'candidate')
    : null
  const candidatePositioningRecommendations = candidateJdAnalysis?.positioningRecommendations ?? []
  const matchSummary = candidateJdAnalysis?.summary || request.matchSummary || 'Not provided'
  const positioningNotes =
    candidatePositioningRecommendations.length > 0
      ? notesText(candidatePositioningRecommendations).join('\n')
      : request.positioningNotes || 'Not provided'

  const systemPrompt = `You are an expert interview debrief analyst. Return JSON only.
You are given a candidate identity model, interview notes, explicit question/stories inputs, and target company context.
Your job is to:
1. Normalize the debrief into clear takeaways.
2. Identify which stories are becoming anchor stories.
3. Identify recurring or newly exposed gaps.
4. Infer best-fit company types from what energized or punished the candidate.
5. Produce a conservative identity patch that the candidate can review before it is merged back into their identity model.

Do not invent employers, metrics, technologies, or outcomes.
When canonical JD analysis is provided, use it as the source of truth for role requirements, strengths, gaps, watch-outs, priorities, and positioning. The Canonical JD Analysis block is already projected to audience "candidate"; do not recover or infer recruiter-only or internal-only material from omitted fields. Use the raw job description only for source wording when the canonical analysis omits a detail.
When suggesting identity updates, prefer adding evidence tags, impact additions, interview-style refinements, and new bullet drafts only when the notes justify them.
All bullet references must use existing roleId/bulletId values unless you are explicitly creating a new bullet draft.

Response schema:
{
  "summary": "string",
  "overallTakeaway": "string",
  "questionsAsked": [{ "question": "string", "takeaway": "optional string" }],
  "whatWorked": ["string"],
  "whatDidnt": ["string"],
  "anchorStories": [{ "id": "string", "label": "string", "reason": "string", "roleId": "optional string", "bulletId": "optional string" }],
  "recurringGaps": [{ "id": "string", "label": "string", "reason": "string" }],
  "bestFitCompanyTypes": [{ "id": "string", "label": "string", "reason": "string" }],
  "identityPatch": {
    "summary": "string",
    "correctionNotes": ["string"],
    "followUpQuestions": ["string"],
    "updatedInterviewStyle": {
      "strengths": ["string"],
      "weaknesses": ["string"],
      "prep_strategy": "string"
    },
    "bulletUpdates": [
      {
        "roleId": "string",
        "bulletId": "string",
        "addTags": ["string"],
        "impactAdditions": ["string"],
        "portfolioDive": "optional string or null"
      }
    ],
    "newBullets": [
      {
        "roleId": "string",
        "bullet": {
          "id": "string",
          "problem": "string",
          "action": "string",
          "outcome": "string",
          "impact": ["string"],
          "metrics": {},
          "technologies": ["string"],
          "portfolio_dive": "optional string or null",
          "tags": ["string"]
        },
        "rewrite": "optional string",
        "assumptions": [{ "label": "string", "confidence": "stated|confirmed|guessing|corrected" }]
      }
    ],
    "rewrites": [
      {
        "roleId": "string",
        "roleLabel": "string",
        "bulletId": "string",
        "rewrite": "string",
        "tags": ["string"],
        "assumptions": [{ "label": "string", "confidence": "stated|confirmed|guessing|corrected" }]
      }
    ]
  },
  "warnings": ["string"]
}`

  const userPrompt = `Company: ${request.company}
Role: ${request.role}
Source: ${request.sourceKind}
Round: ${request.roundName}
Interview Date: ${request.interviewDate}
Outcome: ${request.outcome}
Original Job Description Source Text: ${request.jobDescription ?? 'Not provided'}
Match Summary: ${matchSummary}
Positioning Notes:
${positioningNotes}

Canonical JD Analysis:
${formatJdAnalysisForPrompt(candidateJdAnalysis)}

Questions Asked:
${request.questionsAsked.join('\n') || 'Not provided'}

What Worked:
${request.whatWorked.join('\n') || 'Not provided'}

What Did Not:
${request.whatDidnt.join('\n') || 'Not provided'}

Stories Told:
${JSON.stringify(request.storiesTold, null, 2)}

Raw Interview Notes:
${request.rawNotes}

Identity Model:
${JSON.stringify(request.currentIdentity, null, 2)}

Return JSON only.`

  const rawResponse = await callLlmProxy(endpoint, systemPrompt, userPrompt, {
    feature: 'debrief.generate',
    model: DEBRIEF_MODEL,
    timeoutMs: 45000,
  })

  let parsed: RawObject
  try {
    parsed = JSON.parse(extractJsonBlock(rawResponse)) as RawObject
  } catch (error) {
    if (error instanceof JsonExtractionError) throw error
    throw new Error('Failed to parse debrief response.')
  }

  const identityPatch = normalizeIdentityPatch(parsed.identityPatch)
  if (!isString(parsed.summary) || !isString(parsed.overallTakeaway) || !identityPatch) {
    throw new Error('Debrief response schema was invalid.')
  }

  return {
    summary: parsed.summary.trim(),
    overallTakeaway: parsed.overallTakeaway.trim(),
    questionsAsked: normalizeQuestionReviews(parsed.questionsAsked),
    whatWorked: normalizeStringList(parsed.whatWorked),
    whatDidnt: normalizeStringList(parsed.whatDidnt),
    anchorStories: normalizePatternSignals(parsed.anchorStories),
    recurringGaps: normalizePatternSignals(parsed.recurringGaps),
    bestFitCompanyTypes: normalizePatternSignals(parsed.bestFitCompanyTypes),
    identityPatch,
    warnings: normalizeStringList(parsed.warnings),
  }
}
