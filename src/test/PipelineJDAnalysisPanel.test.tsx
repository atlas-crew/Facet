// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { PipelineJDAnalysisPanel } from '../routes/pipeline/PipelineJDAnalysisPanel'
import type { PipelineJDAnalysisViewState } from '../routes/pipeline/pipelineAnalysis'
import { JD_ANALYSIS_MODEL_VERSION, type JDAnalysis } from '../types/jdAnalysis'
import { untagged } from '../types/audience'

const analysis = (overrides: Partial<JDAnalysis> = {}): JDAnalysis => ({
  id: 'analysis-1',
  pipelineEntryId: 'pipe-1',
  jdTextHash: 'hash',
  identityVersion: 1,
  modelVersion: JD_ANALYSIS_MODEL_VERSION,
  audienceRulesVersion: 'audience-rules.v1',
  generatedAt: '2026-04-14T12:00:00.000Z',
  updatedAt: '2026-04-14T12:00:00.000Z',
  warnings: [],
  company: 'Acme Corp',
  role: 'Staff Platform Engineer',
  summary: 'Platform reliability role.',
  analyzedJobDescription: 'Build platform systems.',
  jobDescriptionWordCount: 3,
  jobDescriptionTruncated: false,
  requirements: [],
  overallFit: 'strong',
  fitScore: 0.86,
  confidence: 'high',
  recommendation: 'apply',
  oneLineSummary: 'Lead with platform reliability.',
  rationale: 'Strong platform match.',
  matchedVectors: [],
  primaryVectorId: null,
  skillMatches: [],
  evidenceMapping: {
    topBullets: [],
    topSkills: [],
    topProjects: [],
    topProfiles: [],
    topPhilosophy: [],
  },
  strengthsToLead: [],
  advantages: [],
  advantageHypotheses: [],
  gaps: [],
  gapFocus: [],
  watchOuts: [],
  triggeredPrioritize: [],
  triggeredAvoid: [],
  relevantAwareness: [],
  positioningRecommendations: [],
  requirementCoverageScore: 0,
  matchedRequirementIds: [],
  matchedKeywords: [],
  ...overrides,
})

const renderPanel = (state: PipelineJDAnalysisViewState) =>
  render(<PipelineJDAnalysisPanel panelId="panel" titleId="title" state={state} />)

describe('PipelineJDAnalysisPanel', () => {
  afterEach(() => cleanup())

  it('uses heading and empty-list fallbacks for sparse analyses', () => {
    renderPanel({
      analysis: analysis({
        generatedAt: 'not-a-date',
        oneLineSummary: '',
        summary: '',
      }),
      driftReasons: [],
      status: 'current',
    })

    expect(screen.getByRole('heading', { name: 'Saved analysis' })).toBeTruthy()
    expect(screen.getByText(/Unknown date/)).toBeTruthy()
    expect(screen.getByText('No matched vectors saved.')).toBeTruthy()
    expect(screen.getByText('No strengths saved.')).toBeTruthy()
    expect(screen.getByText('No gaps or watch outs saved.')).toBeTruthy()
    expect(screen.getByText('No warnings.')).toBeTruthy()
  })

  it('falls back from one-line summary to analysis summary', () => {
    renderPanel({
      analysis: analysis({ oneLineSummary: '' }),
      driftReasons: [],
      status: 'current',
    })

    expect(screen.getByRole('heading', { name: 'Platform reliability role.' })).toBeTruthy()
  })

  it('renders watch outs and raw metric values', () => {
    renderPanel({
      analysis: analysis({
        recommendation: 'maybe' as JDAnalysis['recommendation'],
        watchOuts: [
          untagged({
            type: 'filter_risk',
            referenceId: 'watch-1',
            description: 'Latency claims',
            severity: 'soft',
            suggestedAction: 'Have data ready',
          }),
        ],
      }),
      driftReasons: [],
      status: 'current',
    })

    expect(screen.getByText('maybe')).toBeTruthy()
    expect(screen.getByText('Latency claims: Have data ready')).toBeTruthy()
  })

  it('renders the empty drift reason fallback', () => {
    renderPanel({
      analysis: analysis(),
      driftReasons: [],
      status: 'stale',
    })

    expect(screen.getByText('Saved analysis may need review because the source inputs changed.')).toBeTruthy()
  })
})
