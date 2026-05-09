import { beforeEach, describe, expect, it, vi } from 'vitest'
import { migrateJDAnalysisState, useJDAnalysisStore } from '../store/jdAnalysisStore'
import { usePipelineStore } from '../store/pipelineStore'
import type { JdMatchExtraction, MatchReport, VectorAwareMatchResult } from '../types/match'
import type { PipelineEntry } from '../types/pipeline'
import type { TaggedNote } from '../types/audience'
import { untagged, untaggedNote } from '../types/audience'
import {
  createJdAnalysisFromMatchArtifacts,
  analyzePipelineJobDescription,
  getJdAnalysisDriftStatus,
  hashJobDescriptionText,
  removePipelineJDAnalysis,
  savePipelineJDAnalysis,
} from '../utils/jdAnalysis'

const baseAnalysis: VectorAwareMatchResult = {
  id: 'match-analysis-1',
  generatedAt: '2026-04-30T12:00:00.000Z',
  identityVersion: 7,
  company: 'Atlas',
  role: 'Staff Platform Engineer',
  jobDescription: 'Own Kubernetes delivery systems.',
  overallFit: 'strong',
  fitScore: 0.86,
  confidence: 'high',
  oneLineSummary: 'Strong platform fit.',
  matchedVectors: [
    untagged({
      vectorId: 'platform-lead',
      title: 'Platform lead',
      priority: 'high',
      matchStrength: 'strong',
      evidence: ['Own Kubernetes delivery systems.'],
      thesisApplies: true,
      thesisFitExplanation: 'The JD centers platform ownership.',
    }),
  ],
  primaryVectorId: 'platform-lead',
  skillMatches: [
    untagged({
      skillName: 'Kubernetes',
      jdRequirement: 'Own Kubernetes delivery systems.',
      requirementStrength: 'required',
      userDepth: 'strong',
      userPositioning: 'Lead with platform migration evidence.',
      matchQuality: 'strong',
      presentationGuidance: 'Lead with Kubernetes platform migration evidence.',
    }),
  ],
  strengthsToLead: [untaggedNote('Kubernetes')],
  watchOuts: [],
  triggeredPrioritize: [
    untagged({
      filterId: 'platform-ownership',
      label: 'Platform ownership',
      weight: 'high',
      jdEvidence: 'Own Kubernetes delivery systems.',
    }),
  ],
  triggeredAvoid: [],
  relevantAwareness: [],
  recommendation: 'apply',
  rationale: 'Lead with the platform ownership story.',
  warnings: [],
}

const baseReport: MatchReport = {
  generatedAt: '2026-04-30T12:00:00.000Z',
  identityVersion: 7,
  company: 'Atlas',
  role: 'Staff Platform Engineer',
  summary: 'Lead with the platform ownership story.',
  jobDescription: 'Own Kubernetes delivery systems.',
  matchScore: 0.86,
  requirements: [
    untagged({
      id: 'platform-delivery',
      label: 'Platform delivery',
      priority: 'core',
      evidence: 'Own Kubernetes delivery systems.',
      tags: ['platform', 'kubernetes'],
      keywords: ['Kubernetes'],
      coverageScore: 0.9,
      matchedAssetCount: 2,
      matchedTags: ['platform', 'kubernetes'],
    }),
  ],
  topBullets: [
    untagged({
      kind: 'bullet',
      id: 'bullet-1',
      label: 'Platform migration',
      sourceLabel: 'Contoso - Staff Engineer',
      text: 'Migrated delivery to Kubernetes.',
      tags: ['platform', 'kubernetes'],
      matchedTags: ['platform', 'kubernetes'],
      matchedKeywords: ['Kubernetes'],
      matchedRequirementIds: ['platform-delivery'],
      score: 0.92,
    }),
  ],
  topSkills: [],
  topProjects: [],
  topProfiles: [],
  topPhilosophy: [],
  gaps: [],
  advantages: [
    untagged({
      id: 'platform-ownership',
      claim: 'The identity has direct platform ownership evidence.',
      requirementIds: ['platform-delivery'],
      evidence: [],
    }),
  ],
  positioningRecommendations: [untaggedNote('Lead with platform ownership.')],
  gapFocus: [],
  warnings: [],
}

const baseExtraction: JdMatchExtraction = {
  summary: 'Platform-focused role.',
  company: 'Atlas',
  role: 'Staff Platform Engineer',
  requirements: baseReport.requirements,
  advantageHypotheses: [
    untagged({
      id: 'platform-ownership',
      claim: 'The identity has direct platform ownership evidence.',
      requirementIds: ['platform-delivery'],
    }),
  ],
  positioningRecommendations: [untaggedNote('Lead with platform ownership.')],
  gapFocus: [],
  warnings: [],
}

const pipelineEntryFixture: PipelineEntry = {
  id: 'pipe-1',
  company: 'Atlas',
  role: 'Staff Platform Engineer',
  tier: '1',
  status: 'researching',
  comp: '',
  url: '',
  contact: '',
  vectorId: null,
  jobDescription: 'Own Kubernetes delivery systems.',
  jdAnalysisId: null,
  presetId: null,
  resumeVariant: '',
  resumeGeneration: null,
  positioning: '',
  skillMatch: '',
  nextStep: '',
  notes: '',
  appMethod: 'unknown',
  response: 'none',
  daysToResponse: null,
  rounds: null,
  format: [],
  rejectionStage: '',
  rejectionReason: '',
  offerAmount: '',
  dateApplied: '',
  dateClosed: '',
  lastAction: '2026-04-30',
  createdAt: '2026-04-30',
  history: [],
}

describe('JDAnalysis canonical helpers', () => {
  beforeEach(() => {
    useJDAnalysisStore.setState({ analyses: [] })
    usePipelineStore.setState({
      entries: [pipelineEntryFixture],
      sortField: 'tier',
      sortDir: 'asc',
      filters: { tier: 'all', status: 'all', search: '' },
    })
  })

  it('maps JD Match artifacts into the canonical core shape', () => {
    const analysis = createJdAnalysisFromMatchArtifacts({
      pipelineEntryId: 'pipe-1',
      jobDescription: 'Own Kubernetes delivery systems.',
      artifacts: {
        analysis: baseAnalysis,
        report: baseReport,
        extraction: baseExtraction,
      },
    })

    expect(analysis.pipelineEntryId).toBe('pipe-1')
    expect(analysis.modelVersion).toContain('jd-analysis.v1')
    expect(analysis.primaryVectorId).toBe('platform-lead')
    expect(analysis.requirements[0]?.coverageScore).toBe(0.9)
    expect(analysis.evidenceMapping.topBullets[0]?.id).toBe('bullet-1')
    expect(analysis.advantageHypotheses[0]?.id).toBe('platform-ownership')
    expect(analysis.requirementCoverageScore).toBe(0.9)
    expect(analysis.matchedRequirementIds).toEqual(['platform-delivery'])
    expect(analysis.matchedKeywords).toEqual(['Kubernetes'])
  })

  it('orchestrates pipeline analysis through the injected matcher', async () => {
    const analyzeJobMatch = vi.fn().mockResolvedValue({
      analysis: baseAnalysis,
      report: baseReport,
      extraction: baseExtraction,
    })

    const analysis = await analyzePipelineJobDescription({
      endpoint: 'https://ai.example/proxy',
      pipelineEntryId: 'pipe-1',
      jobDescription: 'Own Kubernetes delivery systems.',
      identity: { model_revision: 7 } as unknown as Parameters<typeof analyzePipelineJobDescription>[0]['identity'],
      analyzeJobMatch,
    })

    expect(analyzeJobMatch).toHaveBeenCalledWith({
      endpoint: 'https://ai.example/proxy',
      identity: { model_revision: 7 },
      jobDescription: 'Own Kubernetes delivery systems.',
    })
    expect(analysis.pipelineEntryId).toBe('pipe-1')
    expect(analysis.primaryVectorId).toBe('platform-lead')
  })

  it('propagates pipeline analysis matcher failures without mutating stores', async () => {
    const analyzeJobMatch = vi.fn().mockRejectedValue(new Error('analysis failed'))

    await expect(
      analyzePipelineJobDescription({
        endpoint: 'https://ai.example/proxy',
        pipelineEntryId: 'pipe-1',
        jobDescription: 'Own Kubernetes delivery systems.',
        identity: { model_revision: 7 } as unknown as Parameters<typeof analyzePipelineJobDescription>[0]['identity'],
        analyzeJobMatch,
      }),
    ).rejects.toThrow('analysis failed')
    expect(useJDAnalysisStore.getState().analyses).toEqual([])
    expect(usePipelineStore.getState().entries[0]?.jdAnalysisId).toBeNull()
  })

  it('detects stale analysis by JD hash and identity version', () => {
    const analysis = createJdAnalysisFromMatchArtifacts({
      pipelineEntryId: 'pipe-1',
      jobDescription: 'Own Kubernetes delivery systems.',
      artifacts: {
        analysis: baseAnalysis,
        report: baseReport,
        extraction: baseExtraction,
      },
    })

    expect(hashJobDescriptionText('Own Kubernetes delivery systems.')).toBe(analysis.jdTextHash)
    expect(
      getJdAnalysisDriftStatus(analysis, {
        jobDescription: 'Own Kubernetes delivery systems.',
        identityVersion: 7,
      }),
    ).toEqual({ stale: false, reasons: [] })
    expect(
      getJdAnalysisDriftStatus(analysis, {
        jobDescription: 'Own Terraform delivery systems.',
        identityVersion: 8,
      }),
    ).toEqual({ stale: true, reasons: ['jd-text', 'identity-version'] })
    expect(
      getJdAnalysisDriftStatus(
        {
          ...analysis,
          jdTextHash: undefined,
          identityVersion: undefined,
          modelVersion: undefined,
        } as unknown as typeof analysis,
        {
          jobDescription: 'Own Kubernetes delivery systems.',
          identityVersion: 7,
        },
      ),
    ).toEqual({ stale: true, reasons: ['jd-text', 'identity-version', 'model-version'] })
    expect(
      getJdAnalysisDriftStatus(
        {
          ...analysis,
          modelVersion: 'jd-analysis.v0',
        },
        {
          jobDescription: 'Own Kubernetes delivery systems.',
          identityVersion: 7,
        },
      ),
    ).toEqual({ stale: true, reasons: ['model-version'] })
  })

  it('hashes boundary JD text consistently', () => {
    expect(hashJobDescriptionText('')).toBe(hashJobDescriptionText('   '))
    expect(hashJobDescriptionText('Line 1\r\nLine 2')).toBe(hashJobDescriptionText('Line 1\nLine 2'))
    expect(hashJobDescriptionText('Platform 🚀\u200b')).toBe(hashJobDescriptionText('Platform 🚀\u200b'))
  })

  it('keeps one canonical analysis per pipeline entry in the store', () => {
    const first = createJdAnalysisFromMatchArtifacts({
      pipelineEntryId: 'pipe-1',
      jobDescription: 'Own Kubernetes delivery systems.',
      artifacts: {
        analysis: baseAnalysis,
        report: baseReport,
        extraction: baseExtraction,
      },
    })
    const replacement = {
      ...first,
      id: 'match-analysis-2',
      updatedAt: '2026-04-30T13:00:00.000Z',
      fitScore: 0.72,
    }

    savePipelineJDAnalysis(first)
    savePipelineJDAnalysis(replacement)

    expect(useJDAnalysisStore.getState().analyses).toHaveLength(1)
    expect(useJDAnalysisStore.getState().findByPipelineEntry('pipe-1')?.id).toBe('match-analysis-2')
    expect(usePipelineStore.getState().entries[0]?.jdAnalysisId).toBe('match-analysis-2')

    removePipelineJDAnalysis('pipe-1')

    expect(useJDAnalysisStore.getState().findByPipelineEntry('pipe-1')).toBeNull()
    expect(usePipelineStore.getState().entries[0]?.jdAnalysisId).toBeNull()
    expect(useJDAnalysisStore.getState().findByPipelineEntry('missing')).toBeNull()
  })

  it('maps sparse JD Match artifacts without crashing', () => {
    const analysis = createJdAnalysisFromMatchArtifacts({
      pipelineEntryId: 'pipe-1',
      jobDescription: 'Own Kubernetes delivery systems.',
      artifacts: {
        analysis: {
          ...baseAnalysis,
          matchedVectors: undefined,
          skillMatches: undefined,
          strengthsToLead: undefined,
          watchOuts: undefined,
          triggeredPrioritize: undefined,
          triggeredAvoid: undefined,
          relevantAwareness: undefined,
          warnings: undefined,
        } as unknown as VectorAwareMatchResult,
        report: {
          ...baseReport,
          requirements: [],
          topBullets: undefined,
          topSkills: undefined,
          topProjects: undefined,
          topProfiles: undefined,
          topPhilosophy: undefined,
          advantages: undefined,
          gaps: undefined,
          gapFocus: undefined,
          positioningRecommendations: undefined,
          warnings: undefined,
        } as unknown as MatchReport,
        extraction: {
          ...baseExtraction,
          advantageHypotheses: undefined,
        } as unknown as JdMatchExtraction,
      },
    })

    expect(analysis.requirements).toEqual([])
    expect(analysis.evidenceMapping.topBullets).toEqual([])
    expect(analysis.matchedVectors).toEqual([])
    expect(analysis.advantageHypotheses).toEqual([])
    expect(analysis.requirementCoverageScore).toBe(0)
    expect(analysis.warnings).toEqual([])
  })

  it('throws a handled error for missing root match artifacts', () => {
    expect(() =>
      createJdAnalysisFromMatchArtifacts({
        pipelineEntryId: 'pipe-1',
        jobDescription: 'Own Kubernetes delivery systems.',
        artifacts: {
          analysis: null,
          report: null,
          extraction: baseExtraction,
        } as unknown as {
          analysis: VectorAwareMatchResult
          report: MatchReport
          extraction: JdMatchExtraction
        },
      }),
    ).toThrow('JD analysis requires match analysis and report artifacts.')
  })

  it('marks unknown future model versions as stale', () => {
    const analysis = createJdAnalysisFromMatchArtifacts({
      pipelineEntryId: 'pipe-1',
      jobDescription: 'Own Kubernetes delivery systems.',
      artifacts: {
        analysis: baseAnalysis,
        report: baseReport,
        extraction: baseExtraction,
      },
    })

    expect(
      getJdAnalysisDriftStatus(
        {
          ...analysis,
          modelVersion: 'jd-analysis.v999',
        },
        {
          jobDescription: 'Own Kubernetes delivery systems.',
          identityVersion: 7,
        },
      ),
    ).toEqual({ stale: true, reasons: ['model-version'] })
    expect(
      getJdAnalysisDriftStatus(
        {
          ...analysis,
          modelVersion: 'jd-analysis.custom',
        },
        {
          jobDescription: 'Own Kubernetes delivery systems.',
          identityVersion: 7,
          expectedModelVersion: 'jd-analysis.custom',
        },
      ),
    ).toEqual({ stale: false, reasons: [] })
  })

  it('sanitizes malformed persisted warnings safely', () => {
    const analysis = createJdAnalysisFromMatchArtifacts({
      pipelineEntryId: 'pipe-1',
      jobDescription: 'Own Kubernetes delivery systems.',
      artifacts: {
        analysis: baseAnalysis,
        report: baseReport,
        extraction: baseExtraction,
      },
    })

    for (const warnings of [undefined, null, 'warning', { value: 'warning' }] as unknown[]) {
      useJDAnalysisStore.getState().setAnalyses([
        {
          ...analysis,
          warnings: warnings as TaggedNote[],
        },
      ])
      expect(useJDAnalysisStore.getState().analyses[0]?.warnings).toEqual([])
    }
  })

  it('migrates arbitrary persisted JDAnalysis state safely', () => {
    expect(migrateJDAnalysisState(null)).toEqual({ analyses: [] })
    expect(migrateJDAnalysisState({})).toEqual({ analyses: [] })
    expect(migrateJDAnalysisState({ analyses: null })).toEqual({ analyses: [] })

    const analysis = createJdAnalysisFromMatchArtifacts({
      pipelineEntryId: 'pipe-1',
      jobDescription: 'Own Kubernetes delivery systems.',
      artifacts: {
        analysis: baseAnalysis,
        report: baseReport,
        extraction: baseExtraction,
      },
    })

    expect(
      migrateJDAnalysisState({
        analyses: [
          {
            ...analysis,
            warnings: [' keep ', 42, ''] as unknown as TaggedNote[],
          },
        ],
      }).analyses[0]?.warnings,
    ).toEqual([{ text: 'keep', audiences: { inferred: ['internal'], asserted: null } }])
  })

  it('removes canonical analysis when a pipeline entry is deleted', () => {
    const analysis = createJdAnalysisFromMatchArtifacts({
      pipelineEntryId: 'pipe-1',
      jobDescription: 'Own Kubernetes delivery systems.',
      artifacts: {
        analysis: baseAnalysis,
        report: baseReport,
        extraction: baseExtraction,
      },
    })

    savePipelineJDAnalysis(analysis)
    usePipelineStore.getState().deleteEntry('pipe-1')

    // deleteEntry is a soft-delete: the entry remains in `entries` with a
    // non-null deletedAt and a cleared jdAnalysisId.
    const liveEntries = usePipelineStore
      .getState()
      .entries.filter((entry) => !entry.deletedAt)
    expect(liveEntries).toEqual([])
    expect(useJDAnalysisStore.getState().findByPipelineEntry('pipe-1')).toBeNull()
  })

  it('no-ops when removing a missing pipeline analysis', () => {
    const analysis = createJdAnalysisFromMatchArtifacts({
      pipelineEntryId: 'pipe-1',
      jobDescription: 'Own Kubernetes delivery systems.',
      artifacts: {
        analysis: baseAnalysis,
        report: baseReport,
        extraction: baseExtraction,
      },
    })

    savePipelineJDAnalysis(analysis)

    expect(() => removePipelineJDAnalysis('missing-pipeline-entry')).not.toThrow()
    expect(useJDAnalysisStore.getState().findByPipelineEntry('pipe-1')?.id).toBe(analysis.id)
    expect(usePipelineStore.getState().entries[0]?.jdAnalysisId).toBe(analysis.id)
  })

  it('removes analysis directly by analysis id', () => {
    const analysis = createJdAnalysisFromMatchArtifacts({
      pipelineEntryId: 'pipe-1',
      jobDescription: 'Own Kubernetes delivery systems.',
      artifacts: {
        analysis: baseAnalysis,
        report: baseReport,
        extraction: baseExtraction,
      },
    })

    useJDAnalysisStore.getState().upsertAnalysis(analysis)
    expect(() => useJDAnalysisStore.getState().removeAnalysis('missing-analysis')).not.toThrow()
    expect(useJDAnalysisStore.getState().analyses).toHaveLength(1)

    useJDAnalysisStore.getState().removeAnalysis(analysis.id)

    expect(useJDAnalysisStore.getState().analyses).toEqual([])
  })

  it('does not save an analysis after the pipeline entry is gone', () => {
    const analysis = createJdAnalysisFromMatchArtifacts({
      pipelineEntryId: 'missing-pipe',
      jobDescription: 'Own Kubernetes delivery systems.',
      artifacts: {
        analysis: baseAnalysis,
        report: baseReport,
        extraction: baseExtraction,
      },
    })

    expect(() => savePipelineJDAnalysis(analysis)).not.toThrow()
    expect(useJDAnalysisStore.getState().findByPipelineEntry('missing-pipe')).toBeNull()
  })
})
