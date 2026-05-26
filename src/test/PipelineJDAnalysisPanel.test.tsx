// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { PipelineJDAnalysisPanel } from '../routes/pipeline/PipelineJDAnalysisPanel'
import type { PipelineJDAnalysisViewState } from '../routes/pipeline/pipelineAnalysis'
import { JD_ANALYSIS_MODEL_VERSION, type JDAnalysis } from '../types/jdAnalysis'
import type { AudienceAssignment, AudienceTag, AudienceTagged, TaggedNote } from '../types/audience'

const audienceAssignment = (audiences: AudienceTag[]): AudienceAssignment => ({
  inferred: audiences,
  asserted: null,
})

const tagged = <T,>(item: T, audiences: AudienceTag[] = ['candidate']): T & AudienceTagged => ({
  ...item,
  audiences: audienceAssignment(audiences),
})

const taggedNote = (text: string, audiences: AudienceTag[] = ['candidate']): TaggedNote => ({
  text,
  audiences: audienceAssignment(audiences),
})

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
          tagged({
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

  it('projects saved analysis rendering to the candidate audience', () => {
    renderPanel({
      analysis: analysis({
        strengthsToLead: [taggedNote('Candidate-visible strength')],
        positioningRecommendations: [taggedNote('Recruiter-only hook', ['recruiter'])],
        watchOuts: [
          tagged({
            type: 'awareness_item',
            referenceId: 'candidate-gap-prep',
            description: 'Candidate gap prep',
            severity: 'soft',
            suggestedAction: 'Bring evidence',
          }),
        ],
        warnings: [taggedNote('Internal data-quality flag', ['internal'])],
      }),
      driftReasons: [],
      status: 'current',
    })

    expect(screen.getByText('Candidate-visible strength')).toBeTruthy()
    expect(screen.getByText('Candidate gap prep: Bring evidence')).toBeTruthy()
    expect(screen.queryByText('Recruiter-only hook')).toBeNull()
    expect(screen.queryByText('Internal data-quality flag')).toBeNull()
  })

  it('renders the empty drift reason fallback', () => {
    renderPanel({
      analysis: analysis(),
      driftReasons: [],
      status: 'stale',
    })

    expect(
      screen.getByText('Saved analysis may need review because the source inputs changed.'),
    ).toBeTruthy()
  })
})
