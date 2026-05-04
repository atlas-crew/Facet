import type { JDAnalysis, JDAnalysisDriftReason } from '../../types/jdAnalysis'
import type { PipelineEntry } from '../../types/pipeline'
import { getJdAnalysisDriftStatus } from '../../utils/jdAnalysis'

export type PipelineJDAnalysisStatus = 'none' | 'current' | 'stale' | 'missing' | 'unknown'

export interface PipelineJDAnalysisViewState {
  analysis: JDAnalysis | null
  driftReasons: JDAnalysisDriftReason[]
  status: PipelineJDAnalysisStatus
}

export const getPipelineJDAnalysisViewState = (
  entry: PipelineEntry,
  analysis: JDAnalysis | null,
  identityVersion: number | null,
): PipelineJDAnalysisViewState => {
  if (!entry.jdAnalysisId && !analysis) {
    return {
      analysis: null,
      driftReasons: [],
      status: 'none',
    }
  }

  if (!analysis) {
    return {
      analysis: null,
      driftReasons: [],
      status: 'missing',
    }
  }

  if (identityVersion === null) {
    const drift = getJdAnalysisDriftStatus(analysis, {
      jobDescription: entry.jobDescription ?? '',
      identityVersion: analysis.identityVersion,
    })

    return {
      analysis,
      driftReasons: drift.reasons,
      status: drift.stale ? 'stale' : 'unknown',
    }
  }

  const drift = getJdAnalysisDriftStatus(analysis, {
    jobDescription: entry.jobDescription ?? '',
    identityVersion,
  })

  return {
    analysis,
    driftReasons: drift.reasons,
    status: drift.stale ? 'stale' : 'current',
  }
}

export const describePipelineJDAnalysisDriftReason = (reason: JDAnalysisDriftReason): string => {
  const labels: Record<JDAnalysisDriftReason, string> = {
    'jd-text': 'the job description changed',
    'identity-version': 'the identity model changed',
    'model-version': 'the analysis model changed',
  }

  return labels[reason]
}
