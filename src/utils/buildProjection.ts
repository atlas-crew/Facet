import type { JdAnalysisResult, JdBulletAdjustment, ResumeData } from '../types'
import { notesText } from '../types/audience'
import type { JDAnalysis } from '../types/jdAnalysis'
import type { MatchAssetScore } from '../types/match'
import { projectForAudience } from './audienceFilter'

const dedupe = (values: string[]): string[] =>
  Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))

const joinSentences = (values: string[]): string => dedupe(values).join(' ')

const knownBulletIds = (data: ResumeData): Set<string> =>
  new Set(data.roles.flatMap((role) => role.bullets.map((bullet) => bullet.id)))

const formatAssetReason = (asset: MatchAssetScore): string => {
  const matched = asset.matchedKeywords.length > 0
    ? ` Matches ${asset.matchedKeywords.slice(0, 3).join(', ')}.`
    : ''
  return `${asset.label || asset.sourceLabel || 'Identity evidence'} is relevant to this role.${matched}`.trim()
}

const mapBulletAdjustments = (
  analysis: JDAnalysis,
  data: ResumeData,
): JdBulletAdjustment[] => {
  const bullets = knownBulletIds(data)

  return analysis.evidenceMapping.topBullets
    .filter((asset) => bullets.has(asset.id))
    .map((asset) => ({
      bullet_id: asset.id,
      recommended_priority: 'include',
      reason: formatAssetReason(asset),
    }))
}

const resolvePrimaryVectorId = (analysis: JDAnalysis, data: ResumeData): string => {
  const knownVectors = new Set(data.vectors.map((vector) => vector.id))
  if (analysis.primaryVectorId && knownVectors.has(analysis.primaryVectorId)) {
    return analysis.primaryVectorId
  }

  const matchedKnownVector = analysis.matchedVectors.find((vector) => knownVectors.has(vector.vectorId))
  return matchedKnownVector?.vectorId ?? data.vectors[0]?.id ?? ''
}

const resolveSuggestedVectorIds = (analysis: JDAnalysis, data: ResumeData, primaryVectorId: string): string[] => {
  const knownVectors = new Set(data.vectors.map((vector) => vector.id))
  const matched = analysis.matchedVectors
    .map((vector) => vector.vectorId)
    .filter((vectorId) => knownVectors.has(vectorId))

  return dedupe([...matched, primaryVectorId])
}

const buildSkillGaps = (analysis: JDAnalysis): string[] =>
  dedupe([
    ...notesText(analysis.gapFocus),
    ...analysis.gaps.map((gap) => gap.label || gap.reason),
    ...analysis.skillMatches
      .filter((skill) => skill.matchQuality === 'weak')
      .map((skill) => skill.skillName),
  ])

const buildInternalProjectionNotes = (analysis: JDAnalysis): string[] =>
  dedupe([
    ...analysis.triggeredPrioritize.map((trigger) =>
      [trigger.label, trigger.jdEvidence].filter(Boolean).join(': '),
    ),
    ...analysis.watchOuts.map((watchOut) =>
      [watchOut.description, watchOut.suggestedAction].filter(Boolean).join(' '),
    ),
    ...notesText(analysis.warnings),
  ])

const buildVectorStrategy = (analysis: JDAnalysis, suggestedVectorIds: string[]): string => {
  const vectorSummary = analysis.matchedVectors
    .filter((vector) => suggestedVectorIds.includes(vector.vectorId))
    .map((vector) => `${vector.title}: ${vector.matchStrength}`)

  if (vectorSummary.length > 0) {
    return `Use ${vectorSummary.join('; ')}. ${analysis.rationale}`.trim()
  }

  return analysis.rationale || analysis.oneLineSummary || 'Use the best aligned resume vector for this role.'
}

const buildSuggestedVariables = (analysis: JDAnalysis): Record<string, string> => {
  const variables: Record<string, string> = {}
  if (analysis.company.trim()) variables.company = analysis.company.trim()
  if (analysis.role.trim()) variables.role = analysis.role.trim()
  return variables
}

export const buildProjectionFromJDAnalysis = (
  analysis: JDAnalysis,
  data: ResumeData,
): JdAnalysisResult => {
  const internalAnalysis = projectForAudience(analysis, 'internal')
  const primaryVectorId = resolvePrimaryVectorId(internalAnalysis, data)
  const suggestedVectorIds = resolveSuggestedVectorIds(internalAnalysis, data, primaryVectorId)
  const positioningTexts = notesText(internalAnalysis.positioningRecommendations)
  const internalProjectionNotes = buildInternalProjectionNotes(internalAnalysis)
  const positioningNote =
    joinSentences([...positioningTexts, ...internalProjectionNotes]) ||
    internalAnalysis.rationale ||
    internalAnalysis.oneLineSummary ||
    internalAnalysis.summary

  return {
    primary_vector: primaryVectorId,
    suggested_vectors: suggestedVectorIds,
    bullet_adjustments: mapBulletAdjustments(internalAnalysis, data),
    suggested_target_line: positioningTexts[0] ?? internalAnalysis.oneLineSummary,
    skill_gaps: buildSkillGaps(internalAnalysis),
    matched_keywords: internalAnalysis.matchedKeywords,
    suggested_variables: buildSuggestedVariables(internalAnalysis),
    positioning_note: positioningNote,
    vector_strategy: buildVectorStrategy(internalAnalysis, suggestedVectorIds),
  }
}
