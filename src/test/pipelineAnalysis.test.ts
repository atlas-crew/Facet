import { describe, expect, it } from 'vitest'
import {
  describePipelineJDAnalysisDriftReason,
  getPipelineJDAnalysisViewState,
} from '../routes/pipeline/pipelineAnalysis'
import { JD_ANALYSIS_MODEL_VERSION, type JDAnalysis } from '../types/jdAnalysis'
import type { PipelineEntry } from '../types/pipeline'
import { hashJobDescriptionText } from '../utils/jdAnalysis'

const jobDescription = 'Build reliable platform systems.'

const entry = (overrides: Partial<PipelineEntry> = {}): PipelineEntry => ({
  id: 'pipe-1',
  jdAnalysisId: 'analysis-1',
  jobDescription,
  ...overrides,
} as PipelineEntry)

const analysis = (overrides: Partial<JDAnalysis> = {}): JDAnalysis => ({
  id: 'analysis-1',
  pipelineEntryId: 'pipe-1',
  jdTextHash: hashJobDescriptionText(jobDescription),
  identityVersion: 1,
  modelVersion: JD_ANALYSIS_MODEL_VERSION,
  ...overrides,
} as JDAnalysis)

describe('pipeline JD analysis view state', () => {
  it('returns none when an entry has no saved analysis reference or artifact', () => {
    expect(getPipelineJDAnalysisViewState(entry({ jdAnalysisId: null }), null, 1)).toEqual({
      analysis: null,
      driftReasons: [],
      status: 'none',
    })
  })

  it('returns missing when an entry references an unavailable analysis artifact', () => {
    expect(getPipelineJDAnalysisViewState(entry(), null, 1)).toEqual({
      analysis: null,
      driftReasons: [],
      status: 'missing',
    })
  })

  it('returns current when saved inputs match the entry and identity', () => {
    expect(getPipelineJDAnalysisViewState(entry(), analysis(), 1)).toMatchObject({
      driftReasons: [],
      status: 'current',
    })
  })

  it('returns stale when saved inputs drift from the entry or identity', () => {
    expect(getPipelineJDAnalysisViewState(entry({ jobDescription: 'Changed JD.' }), analysis(), 2)).toMatchObject({
      driftReasons: ['jd-text', 'identity-version'],
      status: 'stale',
    })
  })

  it('returns unknown without showing false drift when identity is unloaded', () => {
    expect(getPipelineJDAnalysisViewState(entry(), analysis(), null)).toMatchObject({
      driftReasons: [],
      status: 'unknown',
    })
  })

  it('keeps concrete drift signals when identity is unloaded', () => {
    expect(getPipelineJDAnalysisViewState(entry({ jobDescription: 'Changed JD.' }), analysis(), null)).toMatchObject({
      driftReasons: ['jd-text'],
      status: 'stale',
    })
  })

  it('describes every drift reason used by the pipeline view', () => {
    expect(describePipelineJDAnalysisDriftReason('jd-text')).toBe('the job description changed')
    expect(describePipelineJDAnalysisDriftReason('identity-version')).toBe('the identity model changed')
    expect(describePipelineJDAnalysisDriftReason('model-version')).toBe('the analysis model changed')
  })
})
