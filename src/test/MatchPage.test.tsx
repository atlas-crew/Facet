// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MatchPage } from '../routes/match/MatchPage'
import { useJDAnalysisStore } from '../store/jdAnalysisStore'
import { useMatchStore } from '../store/matchStore'
import { usePipelineStore } from '../store/pipelineStore'
import { resolveStorage } from '../store/storage'
import type { JDAnalysis } from '../types/jdAnalysis'
import type { MatchReport, VectorAwareMatchResult } from '../types/match'
import { hashJobDescriptionText } from '../utils/jdAnalysis'

const navigateMock = vi.fn(async () => undefined)

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}))

const reportFixture: MatchReport = {
  generatedAt: '2026-04-08T00:00:00.000Z',
  identityVersion: 3,
  company: 'Atlas',
  role: 'Staff Platform Engineer',
  summary: 'Strong platform fit with a modest AI caution.',
  jobDescription: 'Own platform delivery and Linux debugging.',
  matchScore: 0.82,
  requirements: [
    {
      id: 'platform-delivery',
      label: 'Platform delivery',
      priority: 'core',
      evidence: 'Own platform delivery systems.',
      tags: ['platform'],
      keywords: ['platform'],
      coverageScore: 0.9,
      matchedAssetCount: 3,
      matchedTags: ['platform'],
    },
  ],
  topBullets: [
    {
      kind: 'bullet',
      id: 'platform-migration',
      label: 'Platform migration',
      sourceLabel: 'Contoso Networks - Senior Platform Engineer',
      text: 'Migrated the platform to Kubernetes-based on-prem installs.',
      tags: ['platform', 'kubernetes'],
      matchedTags: ['platform'],
      matchedKeywords: ['platform'],
      matchedRequirementIds: ['platform-delivery'],
      score: 0.92,
    },
  ],
  topSkills: [],
  topProjects: [],
  topProfiles: [],
  topPhilosophy: [],
  gaps: [],
  advantages: [],
  positioningRecommendations: ['Lead with platform migration stories.'],
  gapFocus: ['Do not over-claim AI depth.'],
  warnings: ['No search vectors defined.'],
}

const analysisFixture: VectorAwareMatchResult = {
  id: 'match-analysis-1',
  generatedAt: '2026-04-08T00:00:00.000Z',
  identityVersion: 3,
  company: 'Atlas',
  role: 'Staff Platform Engineer',
  jobDescription: reportFixture.jobDescription,
  overallFit: 'strong',
  fitScore: 0.82,
  confidence: 'high',
  oneLineSummary: 'Strong match - Platform lead',
  matchedVectors: [
    {
      vectorId: 'platform-lead',
      title: 'Platform lead',
      priority: 'high',
      matchStrength: 'strong',
      evidence: ['Own platform delivery systems.'],
      thesisApplies: true,
      thesisFitExplanation: 'The JD centers platform ownership.',
    },
  ],
  primaryVectorId: 'platform-lead',
  skillMatches: [
    {
      skillName: 'Kubernetes',
      jdRequirement: 'Own Kubernetes-backed platform delivery.',
      requirementStrength: 'required',
      userDepth: 'strong',
      userPositioning: 'Lead with Kubernetes platform migration stories.',
      matchQuality: 'strong',
      presentationGuidance: 'Lead with Kubernetes platform migration stories.',
    },
  ],
  strengthsToLead: ['Kubernetes'],
  watchOuts: [
    {
      type: 'awareness_item',
      referenceId: 'ai-depth',
      description: 'Some AI platform depth is requested.',
      severity: 'soft',
      suggestedAction: 'Do not over-claim AI depth.',
    },
  ],
  triggeredPrioritize: [
    {
      filterId: 'platform-ownership',
      label: 'Platform ownership',
      weight: 'high',
      jdEvidence: 'Own platform architecture and delivery systems.',
    },
  ],
  triggeredAvoid: [],
  relevantAwareness: [
    {
      awarenessId: 'ai-depth',
      topic: 'AI depth',
      severity: 'medium',
      appliesBecause: 'Some AI platform depth is requested.',
      action: 'Do not over-claim AI depth.',
    },
  ],
  recommendation: 'apply',
  rationale: 'Strong platform fit with a modest AI caution.',
  warnings: ['No search vectors defined.'],
}

const jdAnalysisFixture: JDAnalysis = {
  id: 'match-analysis-1',
  pipelineEntryId: 'match-workspace-transient',
  jdTextHash: hashJobDescriptionText(reportFixture.jobDescription),
  identityVersion: 3,
  modelVersion: 'jd-analysis.v1.match-multipass-sonnet',
  generatedAt: '2026-04-08T00:00:00.000Z',
  updatedAt: '2026-04-08T00:00:00.000Z',
  warnings: ['No search vectors defined.'],
  company: 'Atlas',
  role: 'Staff Platform Engineer',
  summary: reportFixture.summary,
  analyzedJobDescription: reportFixture.jobDescription,
  jobDescriptionWordCount: 6,
  jobDescriptionTruncated: false,
  requirements: reportFixture.requirements,
  overallFit: 'strong',
  fitScore: 0.82,
  confidence: 'high',
  recommendation: 'apply',
  oneLineSummary: 'Strong match - Platform lead',
  rationale: 'Strong platform fit with a modest AI caution.',
  matchedVectors: analysisFixture.matchedVectors,
  primaryVectorId: 'platform-lead',
  skillMatches: analysisFixture.skillMatches,
  evidenceMapping: {
    topBullets: reportFixture.topBullets,
    topSkills: [],
    topProjects: [],
    topProfiles: [],
    topPhilosophy: [],
  },
  strengthsToLead: ['Kubernetes'],
  advantages: [],
  advantageHypotheses: [],
  gaps: [],
  gapFocus: ['Do not over-claim AI depth.'],
  watchOuts: analysisFixture.watchOuts,
  triggeredPrioritize: analysisFixture.triggeredPrioritize,
  triggeredAvoid: [],
  relevantAwareness: analysisFixture.relevantAwareness,
  positioningRecommendations: reportFixture.positioningRecommendations,
  requirementCoverageScore: 0.9,
  matchedRequirementIds: ['platform-delivery'],
  matchedKeywords: ['platform'],
}

describe('MatchPage', () => {
  let exportedBlob: Blob | null

  beforeEach(() => {
    exportedBlob = null
    navigateMock.mockReset()
    resolveStorage().removeItem('facet-match-workspace')
    useJDAnalysisStore.setState({ analyses: [] })
    usePipelineStore.setState({
      entries: [],
      sortField: 'tier',
      sortDir: 'asc',
      filters: { tier: 'all', status: 'all', search: '' },
    })
    useMatchStore.setState({
      jobDescription: reportFixture.jobDescription,
      currentJDAnalysis: jdAnalysisFixture,
      currentAnalysis: analysisFixture,
      currentReport: reportFixture,
      warnings: reportFixture.warnings,
      history: [],
    })
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn((blob: Blob) => {
        exportedBlob = blob
        return 'blob:match-export'
      }),
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders the rich vector-aware analysis when currentAnalysis exists', () => {
    render(<MatchPage />)

    expect(screen.getByText('Vector-Aware Summary')).toBeTruthy()
    expect(screen.getAllByText('Platform lead').length).toBeGreaterThan(0)
    expect(screen.getByText('Kubernetes')).toBeTruthy()
    expect(screen.getByText('Filters and awareness')).toBeTruthy()
    expect(screen.getByText('Requirement Coverage')).toBeTruthy()
  })

  it('renders safely for legacy-only persisted match state', () => {
    useMatchStore.setState({
      jobDescription: reportFixture.jobDescription,
      currentJDAnalysis: null,
      currentAnalysis: null,
      currentReport: reportFixture,
      warnings: reportFixture.warnings,
      history: [],
    })

    render(<MatchPage />)

    expect(screen.queryByText('Vector-Aware Summary')).toBeNull()
    expect(screen.getByText('Summary')).toBeTruthy()
    expect(screen.getByText(reportFixture.summary)).toBeTruthy()
  })

  it('exports the combined analysis and report payload', async () => {
    render(<MatchPage />)

    fireEvent.click(screen.getByRole('button', { name: /export report/i }))

    expect(exportedBlob).toBeTruthy()
    const payload = JSON.parse(await exportedBlob!.text()) as {
      jdAnalysis: JDAnalysis | null
      analysis: VectorAwareMatchResult | null
      report: MatchReport | null
    }

    expect(payload.jdAnalysis?.id).toBe('match-analysis-1')
    expect(payload.analysis?.id).toBe('match-analysis-1')
    expect(payload.report?.summary).toBe(reportFixture.summary)
    expect(screen.getByRole('status').textContent).toContain('Exported the current match report.')
  })

  it('saves the canonical JD analysis to a new pipeline entry without recomputing', () => {
    render(<MatchPage />)

    fireEvent.click(screen.getByRole('button', { name: /save to pipeline/i }))

    const entry = usePipelineStore.getState().entries[0]
    expect(entry?.company).toBe('Atlas')
    expect(entry?.role).toBe('Staff Platform Engineer')
    expect(entry?.jobDescription).toBe(reportFixture.jobDescription)
    expect(entry?.jdAnalysisId).toBe('match-analysis-1')
    expect(entry?.vectorId).toBe('platform-lead')

    const attachedAnalysis = entry ? useJDAnalysisStore.getState().findByPipelineEntry(entry.id) : null
    expect(attachedAnalysis?.id).toBe('match-analysis-1')
    expect(attachedAnalysis?.pipelineEntryId).toBe(entry?.id)
    expect(attachedAnalysis?.jdTextHash).toBe(hashJobDescriptionText(entry?.jobDescription ?? ''))
    expect(screen.getByRole('status').textContent).toContain('Saved Atlas · Staff Platform Engineer to Pipeline')
  })
})
