import type { ProfessionalIdentityV3 } from '../identity/schema'
import { useCoverLetterStore } from '../store/coverLetterStore'
import { usePipelineStore } from '../store/pipelineStore'
import type { CoverLetter, CoverLetterContent } from '../types/coverLetter'
import type { JDAnalysis, JDAnalysisDriftStatus } from '../types/jdAnalysis'
import type { PipelineEntry } from '../types/pipeline'
import type { ResumeEntity } from '../types/resume'
import { resolveCoverLetterCandidateMeta } from './coverLetterCandidate'
import { stripResumeVectorContext } from './coverLetterContext'
import { generateCoverLetter } from './coverLetterGenerator'
import { createId } from './idUtils'
import { getJdAnalysisDriftStatus } from './jdAnalysis'

export function resolveLetterIdentityVersion(
  resume: Pick<ResumeEntity, 'identityVersion'>,
  identity: Pick<ProfessionalIdentityV3, 'model_revision'> | null,
): number | null {
  return identity?.model_revision ?? resume.identityVersion ?? null
}

export function buildJobPromptContext(value: unknown): unknown {
  const stripped = stripResumeVectorContext(value)
  if (!stripped || typeof stripped !== 'object' || Array.isArray(stripped)) {
    return stripped
  }
  const { jobDescription: _jobDescription, ...rest } = stripped as Record<string, unknown>
  return rest
}

export function resolvePipelineJdAnalysis(
  entry: PipelineEntry | null,
  analyses: JDAnalysis[],
): JDAnalysis | null {
  if (!entry) return null
  if (entry.jdAnalysisId) {
    const referencedAnalysis = analyses.find(
      (analysis) => analysis.id === entry.jdAnalysisId && analysis.pipelineEntryId === entry.id,
    )
    return referencedAnalysis ?? null
  }
  return analyses.find((analysis) => analysis.pipelineEntryId === entry.id) ?? null
}

function resolveGenerationIdentityVersion(
  analysis: JDAnalysis,
  resume: Pick<ResumeEntity, 'identityVersion'> | null,
  identity: Pick<ProfessionalIdentityV3, 'model_revision'> | null,
): number {
  return identity?.model_revision ?? resume?.identityVersion ?? analysis.identityVersion
}

function formatJdAnalysisDriftReason(reasons: JDAnalysisDriftStatus['reasons']): string {
  const labels: Record<JDAnalysisDriftStatus['reasons'][number], string> = {
    'jd-text': 'job description changed',
    'identity-version': 'identity model changed',
    'model-version': 'analysis model changed',
  }
  return reasons.map((reason) => labels[reason]).join(', ')
}

export function resolveJdAnalysisGenerationIssue(
  entry: PipelineEntry | null,
  resume: ResumeEntity | null,
  identity: ProfessionalIdentityV3 | null,
  analysis: JDAnalysis | null,
): string | null {
  if (!entry || !resume || !entry.jobDescription.trim()) return null
  if (!analysis) return 'Analyze this pipeline JD before generating a cover letter.'

  const identityVersion = resolveGenerationIdentityVersion(analysis, resume, identity)
  const drift = getJdAnalysisDriftStatus(analysis, {
    jobDescription: entry.jobDescription,
    identityVersion,
  })
  if (!drift.stale) return null

  const reasonText = formatJdAnalysisDriftReason(drift.reasons)
  return reasonText
    ? 'Refresh JD analysis before generating a cover letter (' + reasonText + ').'
    : 'Refresh JD analysis before generating a cover letter.'
}

export interface RegenerateCoverLetterInput {
  endpoint: string
  entry: PipelineEntry
  resume: ResumeEntity
  identity: ProfessionalIdentityV3 | null
  jdAnalysis: JDAnalysis | null
  companyResearch?: string | null
}

export interface RegenerateCoverLetterResult {
  letter: CoverLetter
  identityVersion: number | null
  generatedAt: string
}

export async function regenerateCoverLetterForEntry(
  input: RegenerateCoverLetterInput,
): Promise<RegenerateCoverLetterResult> {
  const { endpoint, entry, resume, identity, jdAnalysis, companyResearch } = input

  if (!entry.jobDescription.trim()) {
    throw new Error('The selected pipeline entry does not have a job description yet.')
  }
  const issue = resolveJdAnalysisGenerationIssue(entry, resume, identity, jdAnalysis)
  if (issue) throw new Error(issue)

  const candidateMeta = resolveCoverLetterCandidateMeta(resume.content.meta, identity)
  const fullResumeContext = {
    ...(stripResumeVectorContext(resume.content) as Record<string, unknown>),
    meta: candidateMeta,
  }

  const generated = await generateCoverLetter(endpoint, {
    company: entry.company,
    role: entry.role,
    contact: entry.contact || undefined,
    companyUrl: entry.url || undefined,
    skillMatch: entry.skillMatch || undefined,
    positioning: entry.positioning || undefined,
    notes: entry.notes || undefined,
    companyResearch: companyResearch || undefined,
    jobDescription: entry.jobDescription,
    jdAnalysis: jdAnalysis ?? undefined,
    resumeContext: {
      candidate: candidateMeta,
      assembled: {
        resume: fullResumeContext,
        pipelineEntry: buildJobPromptContext(entry),
      },
      identity,
    },
  })

  const generatedAt = new Date().toISOString()
  const content: CoverLetterContent = {
    name: generated.name,
    header: generated.header,
    greeting: generated.greeting,
    paragraphs: generated.paragraphs.map((paragraph) => ({
      id: createId('clp'),
      label: paragraph.label,
      text: paragraph.text,
      vectors: {},
    })),
    signOff: generated.signOff,
  }
  const identityVersion = resolveLetterIdentityVersion(resume, identity)
  const letter = useCoverLetterStore.getState().upsertLetterForPipelineEntry({
    content,
    pipelineEntryId: entry.id,
    sourceResumeId: resume.id,
    sourceResumeHash: resume.contentHash,
    identityVersion,
    generatedAt,
  })
  usePipelineStore.getState().updateEntry(entry.id, {
    coverLetterId: letter.id,
    resumeId: resume.id,
  })

  return { letter, identityVersion, generatedAt }
}
