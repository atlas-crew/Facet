import type { ProfessionalIdentityV3 } from '../identity/schema'
import { useJDAnalysisStore } from '../store/jdAnalysisStore'
import { usePipelineStore } from '../store/pipelineStore'
import { type TaggedNote, untaggedNote } from '../types/audience'
import type { JDAnalysis, JDAnalysisDriftStatus } from '../types/jdAnalysis'
import { JD_ANALYSIS_MODEL_VERSION } from '../types/jdAnalysis'
import type { JdMatchExtraction, MatchReport, VectorAwareMatchResult } from '../types/match'
import { applyRulesBasedAudiences, type JDAnalysisLike } from './audienceRules'
import { analyzeIdentityJobMatch, prepareMatchJobDescription } from './jobMatch'

export interface AnalyzePipelineJdOptions {
  endpoint: string
  pipelineEntryId: string
  jobDescription: string
  identity: ProfessionalIdentityV3
  modelVersion?: string
  analyzeJobMatch?: typeof analyzeIdentityJobMatch
}

export interface MatchArtifactsForJdAnalysis {
  analysis: VectorAwareMatchResult
  report: MatchReport
  extraction: JdMatchExtraction
}

const normalizeHashInput = (value: string): string =>
  value.replace(/\r\n?/g, '\n').trim()

export const hashJobDescriptionText = (value: string): string => {
  const input = normalizeHashInput(value)
  let hash = 0x811c9dc5

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }

  return (hash >>> 0).toString(16).padStart(8, '0')
}

const dedupe = (values: string[]): string[] =>
  Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))

const list = <T>(values: T[] | null | undefined): T[] => Array.isArray(values) ? values : []

const textList = (values: unknown): string[] =>
  Array.isArray(values) ? values.filter((value): value is string => typeof value === 'string') : []

const averageCoverage = (requirements: MatchReport['requirements'] | null | undefined): number => {
  const requirementList = list(requirements)
  if (requirementList.length === 0) return 0
  const total = requirementList.reduce((sum, requirement) => sum + requirement.coverageScore, 0)
  return Math.round((total / requirementList.length) * 1000) / 1000
}

const deriveMatchedRequirementIds = (report: MatchReport): string[] => {
  const requirements = list(report.requirements)
  const ids = requirements
    .filter((requirement) => requirement.coverageScore > 0)
    .map((requirement) => requirement.id)

  const assetRequirementIds = [
    ...list(report.topBullets),
    ...list(report.topSkills),
    ...list(report.topProjects),
    ...list(report.topProfiles),
    ...list(report.topPhilosophy),
  ].flatMap((asset) => list(asset.matchedRequirementIds))

  return dedupe([...ids, ...assetRequirementIds])
}

const deriveMatchedKeywords = (report: MatchReport): string[] => {
  const assetKeywords = [
    ...list(report.topBullets),
    ...list(report.topSkills),
    ...list(report.topProjects),
    ...list(report.topProfiles),
    ...list(report.topPhilosophy),
  ].flatMap((asset) => list(asset.matchedKeywords))

  const coveredRequirementKeywords = list(report.requirements)
    .filter((requirement) => requirement.coverageScore > 0)
    .flatMap((requirement) => list(requirement.keywords))

  return dedupe([...assetKeywords, ...coveredRequirementKeywords])
}

export const sanitizeJDAnalysisWarnings = (warnings: unknown): string[] => dedupe(textList(warnings))

const dedupeNotes = (entries: Array<TaggedNote | string>): TaggedNote[] => {
  const seen = new Set<string>()
  const out: TaggedNote[] = []
  for (const entry of entries) {
    const note = typeof entry === 'string' ? untaggedNote(entry.trim()) : entry
    const key = note.text.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(note)
  }
  return out
}

const sanitizeWarningNotes = (warnings: unknown): TaggedNote[] => {
  if (!Array.isArray(warnings)) return []
  return warnings
    .map((entry): TaggedNote | null => {
      if (typeof entry === 'string') return untaggedNote(entry.trim())
      if (entry && typeof entry === 'object' && typeof (entry as { text?: unknown }).text === 'string') {
        return entry as TaggedNote
      }
      return null
    })
    .filter((entry): entry is TaggedNote => entry !== null && entry.text.length > 0)
}

export const createJdAnalysisFromMatchArtifacts = ({
  pipelineEntryId,
  jobDescription,
  artifacts,
  modelVersion = JD_ANALYSIS_MODEL_VERSION,
}: {
  pipelineEntryId: string
  jobDescription: string
  artifacts: MatchArtifactsForJdAnalysis
  modelVersion?: string
}): JDAnalysis => {
  const { analysis, report } = artifacts
  if (!analysis || !report) {
    throw new Error('JD analysis requires match analysis and report artifacts.')
  }

  const extraction = artifacts.extraction ?? ({} as JdMatchExtraction)
  const prepared = prepareMatchJobDescription(jobDescription)
  const now = new Date().toISOString()
  const requirements = list(report.requirements)
  const topBullets = list(report.topBullets)
  const topSkills = list(report.topSkills)
  const topProjects = list(report.topProjects)
  const topProfiles = list(report.topProfiles)
  const topPhilosophy = list(report.topPhilosophy)

  // Build the JDAnalysisLike (untagged-or-partially-tagged) and pipe through
  // the rules engine. applyRulesBasedAudiences stamps audienceRulesVersion,
  // promotes 'unclassified' insights to their proper rules-based audiences,
  // and preserves any LLM-asserted tags carried in from upstream extraction.
  const draft: JDAnalysisLike = {
    id: analysis.id,
    pipelineEntryId,
    jdTextHash: hashJobDescriptionText(jobDescription),
    identityVersion: analysis.identityVersion,
    modelVersion,
    generatedAt: analysis.generatedAt,
    updatedAt: now,
    warnings: dedupeNotes([
      ...sanitizeWarningNotes(analysis.warnings),
      ...sanitizeWarningNotes(report.warnings),
    ]),

    company: report.company || analysis.company || '',
    role: report.role || analysis.role || '',
    summary: report.summary || '',
    analyzedJobDescription: report.jobDescription || jobDescription || '',
    jobDescriptionWordCount: prepared.wordCount,
    jobDescriptionTruncated: prepared.truncated,

    requirements,
    overallFit: analysis.overallFit,
    fitScore: analysis.fitScore,
    confidence: analysis.confidence,
    recommendation: analysis.recommendation,
    oneLineSummary: analysis.oneLineSummary,
    rationale: analysis.rationale,

    matchedVectors: list(analysis.matchedVectors),
    primaryVectorId: analysis.primaryVectorId ?? null,
    skillMatches: list(analysis.skillMatches),
    evidenceMapping: {
      topBullets,
      topSkills,
      topProjects,
      topProfiles,
      topPhilosophy,
    },

    strengthsToLead: list(analysis.strengthsToLead),
    advantages: list(report.advantages),
    advantageHypotheses: list(extraction.advantageHypotheses),
    gaps: list(report.gaps),
    gapFocus: list(report.gapFocus),
    watchOuts: list(analysis.watchOuts),

    triggeredPrioritize: list(analysis.triggeredPrioritize),
    triggeredAvoid: list(analysis.triggeredAvoid),
    relevantAwareness: list(analysis.relevantAwareness),

    positioningRecommendations: list(report.positioningRecommendations),
    requirementCoverageScore: averageCoverage(requirements),
    matchedRequirementIds: deriveMatchedRequirementIds(report),
    matchedKeywords: deriveMatchedKeywords(report),
  }

  return applyRulesBasedAudiences(draft)
}

export const analyzePipelineJobDescription = async ({
  endpoint,
  pipelineEntryId,
  jobDescription,
  identity,
  modelVersion,
  analyzeJobMatch = analyzeIdentityJobMatch,
}: AnalyzePipelineJdOptions): Promise<JDAnalysis> => {
  const artifacts = await analyzeJobMatch({
    endpoint,
    identity,
    jobDescription,
  })

  return createJdAnalysisFromMatchArtifacts({
    pipelineEntryId,
    jobDescription,
    artifacts,
    modelVersion,
  })
}

export const savePipelineJDAnalysis = (analysis: JDAnalysis): void => {
  const hasPipelineEntry = usePipelineStore
    .getState()
    .entries.some((entry) => entry.id === analysis.pipelineEntryId)
  if (!hasPipelineEntry) return

  useJDAnalysisStore.getState().upsertAnalysis(analysis)
  usePipelineStore.getState().setJDAnalysisReference(analysis.pipelineEntryId, analysis.id)
}

export const removePipelineJDAnalysis = (pipelineEntryId: string): void => {
  useJDAnalysisStore.getState().removeAnalysisForPipelineEntry(pipelineEntryId)
  usePipelineStore.getState().setJDAnalysisReference(pipelineEntryId, null)
}

export const getJdAnalysisDriftStatus = (
  analysis: JDAnalysis,
  {
    jobDescription,
    identityVersion,
    expectedModelVersion = JD_ANALYSIS_MODEL_VERSION,
  }: {
    jobDescription: string
    identityVersion: number
    expectedModelVersion?: string
  },
): JDAnalysisDriftStatus => {
  const reasons: JDAnalysisDriftStatus['reasons'] = []

  if (analysis.jdTextHash !== hashJobDescriptionText(jobDescription)) {
    reasons.push('jd-text')
  }

  if (analysis.identityVersion !== identityVersion) {
    reasons.push('identity-version')
  }

  if (analysis.modelVersion !== expectedModelVersion) {
    reasons.push('model-version')
  }

  return {
    stale: reasons.length > 0,
    reasons,
  }
}
