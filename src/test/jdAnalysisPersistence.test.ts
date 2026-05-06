// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'
import { defaultResumeData } from '../store/defaultData'
import { useCoverLetterStore } from '../store/coverLetterStore'
import { useDebriefStore } from '../store/debriefStore'
import { useJDAnalysisStore } from '../store/jdAnalysisStore'
import { useLinkedInStore } from '../store/linkedinStore'
import { usePipelineStore } from '../store/pipelineStore'
import { usePrepStore } from '../store/prepStore'
import { useRecruiterStore } from '../store/recruiterStore'
import { useResumeStore } from '../store/resumeStore'
import { useSearchStore } from '../store/searchStore'
import { useUiStore } from '../store/uiStore'
import { applyWorkspaceSnapshotToStores } from '../persistence/hydration'
import { normalizeWorkspaceSnapshot } from '../persistence/normalization'
import { createWorkspaceSnapshotFromStores } from '../persistence/snapshot'
import { assertValidWorkspaceSnapshot } from '../persistence/validation'
import { mergeWorkspaceSnapshots } from '../persistence/workspaceImportMerge'
import type { JDAnalysis } from '../types/jdAnalysis'
import type { PipelineEntry } from '../types/pipeline'
import { buildWorkspaceSnapshot } from './fixtures/workspaceSnapshot'

const analysisFixture: JDAnalysis = {
  id: 'jd-analysis-1',
  pipelineEntryId: 'pipe-1',
  jdTextHash: 'abc123',
  identityVersion: 3,
  modelVersion: 'jd-analysis.v1.match-multipass-sonnet',
  audienceRulesVersion: 'audience-rules.v1',
  generatedAt: '2026-04-30T12:00:00.000Z',
  updatedAt: '2026-04-30T12:00:00.000Z',
  warnings: [],
  company: 'Atlas',
  role: 'Staff Platform Engineer',
  summary: 'Strong platform fit.',
  analyzedJobDescription: 'Own platform delivery.',
  jobDescriptionWordCount: 3,
  jobDescriptionTruncated: false,
  requirements: [],
  overallFit: 'strong',
  fitScore: 0.86,
  confidence: 'high',
  recommendation: 'apply',
  oneLineSummary: 'Strong platform fit.',
  rationale: 'Lead with platform ownership.',
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
  jobDescription: 'Own platform delivery.',
  jdAnalysisId: 'jd-analysis-old',
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

const resetStores = () => {
  useResumeStore.setState({
    data: defaultResumeData,
    past: [],
    future: [],
    canUndo: false,
    canRedo: false,
  })
  usePipelineStore.setState({
    entries: [],
    sortField: 'tier',
    sortDir: 'asc',
    filters: { tier: 'all', status: 'all', search: '' },
  })
  useJDAnalysisStore.setState({ analyses: [] })
  usePrepStore.setState({ decks: [], activeDeckId: null })
  useCoverLetterStore.setState({ templates: [] })
  useLinkedInStore.setState({ drafts: [], selectedDraftId: null })
  useRecruiterStore.setState({ cards: [], selectedCardId: null })
  useDebriefStore.setState({ sessions: [], selectedSessionId: null })
  useSearchStore.setState({ profile: null, requests: [], runs: [] })
  useUiStore.setState({
    selectedVector: 'all',
    panelRatio: 0.45,
    appearance: 'system',
    viewMode: 'pdf',
    showHeatmap: false,
    showDesignHealth: false,
    suggestionModeActive: false,
    comparisonVector: null,
    backupRemindersEnabled: true,
    backupReminderIntervalDays: 7,
    backupReminderSnoozedUntil: null,
    lastBackupAt: null,
    tourCompleted: false,
  })
}

describe('JDAnalysis persistence', () => {
  beforeEach(() => {
    resetStores()
  })

  it('round-trips canonical analyses through workspace snapshots', () => {
    useJDAnalysisStore.setState({ analyses: [analysisFixture] })

    const snapshot = createWorkspaceSnapshotFromStores({
      workspaceId: 'ws-1',
      exportedAt: '2026-04-30T12:00:00.000Z',
    })

    expect(snapshot.artifacts.jdAnalysis.payload.analyses).toEqual([analysisFixture])
    assertValidWorkspaceSnapshot(snapshot)

    useJDAnalysisStore.setState({ analyses: [] })
    applyWorkspaceSnapshotToStores(snapshot)

    expect(useJDAnalysisStore.getState().analyses).toEqual([analysisFixture])
  })

  it('normalizes older snapshots that predate the JDAnalysis artifact', () => {
    const legacySnapshot = buildWorkspaceSnapshot()
    delete ((legacySnapshot.artifacts as unknown) as { jdAnalysis?: unknown }).jdAnalysis

    expect(() => assertValidWorkspaceSnapshot(legacySnapshot)).toThrow(
      'Workspace snapshot is missing artifacts.jdAnalysis.',
    )

    const normalized = normalizeWorkspaceSnapshot(legacySnapshot)

    expect(normalized.artifacts.jdAnalysis.payload.analyses).toEqual([])
    assertValidWorkspaceSnapshot(normalized)
  })

  it('realigns pipeline references when importing a newer analysis', () => {
    const currentAnalysis = {
      ...analysisFixture,
      id: 'jd-analysis-old',
      updatedAt: '2026-04-30T12:00:00.000Z',
    }
    const importedAnalysis = {
      ...analysisFixture,
      id: 'jd-analysis-new',
      updatedAt: '2026-04-30T13:00:00.000Z',
    }
    const current = buildWorkspaceSnapshot({
      artifacts: {
        ...buildWorkspaceSnapshot().artifacts,
        pipeline: {
          ...buildWorkspaceSnapshot().artifacts.pipeline,
          payload: { entries: [pipelineEntryFixture] },
        },
        jdAnalysis: {
          ...buildWorkspaceSnapshot().artifacts.jdAnalysis,
          payload: { analyses: [currentAnalysis] },
        },
      },
    })
    const imported = buildWorkspaceSnapshot({
      artifacts: {
        ...buildWorkspaceSnapshot().artifacts,
        pipeline: {
          ...buildWorkspaceSnapshot().artifacts.pipeline,
          payload: {
            entries: [
              {
                ...pipelineEntryFixture,
                jdAnalysisId: 'jd-analysis-new',
              },
            ],
          },
        },
        jdAnalysis: {
          ...buildWorkspaceSnapshot().artifacts.jdAnalysis,
          payload: { analyses: [importedAnalysis] },
        },
      },
    })

    const merged = mergeWorkspaceSnapshots(current, imported)

    expect(merged.artifacts.jdAnalysis.payload.analyses[0]?.id).toBe('jd-analysis-new')
    expect(merged.artifacts.pipeline.payload.entries[0]?.jdAnalysisId).toBe('jd-analysis-new')
  })

  it('keeps merged JDAnalysis artifact metadata scoped to the current workspace', () => {
    const current = buildWorkspaceSnapshot()
    delete ((current.artifacts as unknown) as { jdAnalysis?: unknown }).jdAnalysis
    const imported = buildWorkspaceSnapshot({
      workspace: {
        id: 'imported-workspace',
        name: 'Imported',
        revision: 1,
        updatedAt: '2026-04-30T12:00:00.000Z',
      },
      artifacts: {
        ...buildWorkspaceSnapshot().artifacts,
        jdAnalysis: {
          ...buildWorkspaceSnapshot().artifacts.jdAnalysis,
          artifactId: 'imported-workspace:jdAnalysis',
          workspaceId: 'imported-workspace',
          payload: { analyses: [] },
        },
      },
    })

    const merged = mergeWorkspaceSnapshots(current, imported)

    expect(merged.artifacts.jdAnalysis.artifactId).toBe('ws-1:jdAnalysis')
    expect(merged.artifacts.jdAnalysis.workspaceId).toBe('ws-1')
  })

  it('drops imported analyses that do not reference merged pipeline entries', () => {
    const base = buildWorkspaceSnapshot()
    const importedAnalysis = {
      ...analysisFixture,
      id: 'jd-analysis-orphan',
      pipelineEntryId: 'missing-pipeline-entry',
    }
    const imported = buildWorkspaceSnapshot({
      artifacts: {
        ...base.artifacts,
        jdAnalysis: {
          ...base.artifacts.jdAnalysis,
          payload: { analyses: [importedAnalysis] },
        },
      },
    })

    const merged = mergeWorkspaceSnapshots(base, imported)

    expect(merged.artifacts.jdAnalysis.payload.analyses).toEqual([])
  })

  it('keeps one imported analysis per pipeline entry', () => {
    const base = buildWorkspaceSnapshot()
    const olderAnalysis = {
      ...analysisFixture,
      id: 'jd-analysis-imported-old',
      updatedAt: '2026-04-30T12:00:00.000Z',
    }
    const newerAnalysis = {
      ...analysisFixture,
      id: 'jd-analysis-imported-new',
      updatedAt: '2026-04-30T13:00:00.000Z',
    }
    const imported = buildWorkspaceSnapshot({
      artifacts: {
        ...base.artifacts,
        pipeline: {
          ...base.artifacts.pipeline,
          payload: { entries: [pipelineEntryFixture] },
        },
        jdAnalysis: {
          ...base.artifacts.jdAnalysis,
          payload: { analyses: [olderAnalysis, newerAnalysis] },
        },
      },
    })

    const merged = mergeWorkspaceSnapshots(base, imported)

    expect(merged.artifacts.jdAnalysis.payload.analyses).toHaveLength(1)
    expect(merged.artifacts.jdAnalysis.payload.analyses[0]?.id).toBe('jd-analysis-imported-new')
  })

  it('keeps the current analysis when importing an older analysis', () => {
    const currentAnalysis = {
      ...analysisFixture,
      id: 'jd-analysis-current',
      updatedAt: '2026-04-30T13:00:00.000Z',
    }
    const importedAnalysis = {
      ...analysisFixture,
      id: 'jd-analysis-imported-old',
      updatedAt: '2026-04-30T12:00:00.000Z',
    }
    const base = buildWorkspaceSnapshot()
    const current = buildWorkspaceSnapshot({
      artifacts: {
        ...base.artifacts,
        pipeline: {
          ...base.artifacts.pipeline,
          payload: {
            entries: [
              {
                ...pipelineEntryFixture,
                jdAnalysisId: 'jd-analysis-current',
              },
            ],
          },
        },
        jdAnalysis: {
          ...base.artifacts.jdAnalysis,
          payload: { analyses: [currentAnalysis] },
        },
      },
    })
    const imported = buildWorkspaceSnapshot({
      artifacts: {
        ...base.artifacts,
        pipeline: {
          ...base.artifacts.pipeline,
          payload: {
            entries: [
              {
                ...pipelineEntryFixture,
                jdAnalysisId: 'jd-analysis-imported-old',
              },
            ],
          },
        },
        jdAnalysis: {
          ...base.artifacts.jdAnalysis,
          payload: { analyses: [importedAnalysis] },
        },
      },
    })

    const merged = mergeWorkspaceSnapshots(current, imported)

    expect(merged.artifacts.jdAnalysis.payload.analyses[0]?.id).toBe('jd-analysis-current')
    expect(merged.artifacts.pipeline.payload.entries[0]?.jdAnalysisId).toBe('jd-analysis-current')
  })

  it('keeps the current analysis when imported analysis has the same timestamp', () => {
    const currentAnalysis = {
      ...analysisFixture,
      id: 'jd-analysis-current',
      updatedAt: '2026-04-30T13:00:00.000Z',
    }
    const importedAnalysis = {
      ...analysisFixture,
      id: 'jd-analysis-imported',
      updatedAt: '2026-04-30T13:00:00.000Z',
    }
    const base = buildWorkspaceSnapshot()
    const current = buildWorkspaceSnapshot({
      artifacts: {
        ...base.artifacts,
        pipeline: {
          ...base.artifacts.pipeline,
          payload: {
            entries: [
              {
                ...pipelineEntryFixture,
                jdAnalysisId: 'jd-analysis-current',
              },
            ],
          },
        },
        jdAnalysis: {
          ...base.artifacts.jdAnalysis,
          payload: { analyses: [currentAnalysis] },
        },
      },
    })
    const imported = buildWorkspaceSnapshot({
      artifacts: {
        ...base.artifacts,
        pipeline: {
          ...base.artifacts.pipeline,
          payload: {
            entries: [
              {
                ...pipelineEntryFixture,
                jdAnalysisId: 'jd-analysis-imported',
              },
            ],
          },
        },
        jdAnalysis: {
          ...base.artifacts.jdAnalysis,
          payload: { analyses: [importedAnalysis] },
        },
      },
    })

    const merged = mergeWorkspaceSnapshots(current, imported)

    expect(merged.artifacts.jdAnalysis.payload.analyses[0]?.id).toBe('jd-analysis-current')
    expect(merged.artifacts.pipeline.payload.entries[0]?.jdAnalysisId).toBe('jd-analysis-current')
  })

  it('does not attach an imported analysis to a colliding different pipeline entry', () => {
    const base = buildWorkspaceSnapshot()
    const currentAnalysis = {
      ...analysisFixture,
      id: 'jd-analysis-current',
      updatedAt: '2026-04-30T12:00:00.000Z',
    }
    const importedAnalysis = {
      ...analysisFixture,
      id: 'jd-analysis-imported',
      updatedAt: '2026-04-30T13:00:00.000Z',
    }
    const current = buildWorkspaceSnapshot({
      artifacts: {
        ...base.artifacts,
        pipeline: {
          ...base.artifacts.pipeline,
          payload: { entries: [pipelineEntryFixture] },
        },
        jdAnalysis: {
          ...base.artifacts.jdAnalysis,
          payload: { analyses: [currentAnalysis] },
        },
      },
    })
    const imported = buildWorkspaceSnapshot({
      artifacts: {
        ...base.artifacts,
        pipeline: {
          ...base.artifacts.pipeline,
          payload: {
            entries: [
              {
                ...pipelineEntryFixture,
                company: 'Different Co',
                role: 'Different Role',
                jdAnalysisId: 'jd-analysis-imported',
              },
            ],
          },
        },
        jdAnalysis: {
          ...base.artifacts.jdAnalysis,
          payload: { analyses: [importedAnalysis] },
        },
      },
    })

    const merged = mergeWorkspaceSnapshots(current, imported)

    expect(merged.artifacts.jdAnalysis.payload.analyses[0]?.id).toBe('jd-analysis-current')
    expect(merged.artifacts.pipeline.payload.entries[0]?.company).toBe('Atlas')
    expect(merged.artifacts.pipeline.payload.entries[0]?.jdAnalysisId).toBe('jd-analysis-current')
  })

  it('rejects malformed JDAnalysis payloads during workspace validation', () => {
    const snapshot = buildWorkspaceSnapshot({
      artifacts: {
        ...buildWorkspaceSnapshot().artifacts,
        jdAnalysis: {
          ...buildWorkspaceSnapshot().artifacts.jdAnalysis,
          payload: {
            analyses: [
              {
                ...analysisFixture,
                pipelineEntryId: 42 as unknown as string,
              },
            ],
          },
        },
      },
    })

    expect(() => assertValidWorkspaceSnapshot(snapshot)).toThrow(
      'Workspace snapshot has invalid artifacts.jdAnalysis.payload.analyses[0] metadata.',
    )

    const malformedScalarSnapshot = buildWorkspaceSnapshot({
      artifacts: {
        ...buildWorkspaceSnapshot().artifacts,
        jdAnalysis: {
          ...buildWorkspaceSnapshot().artifacts.jdAnalysis,
          payload: {
            analyses: [
              {
                ...analysisFixture,
                fitScore: 'high' as unknown as number,
              },
            ],
          },
        },
      },
    })

    expect(() => assertValidWorkspaceSnapshot(malformedScalarSnapshot)).toThrow(
      'Workspace snapshot has invalid artifacts.jdAnalysis.payload.analyses[0] scalars.',
    )

    const malformedTimestampSnapshot = buildWorkspaceSnapshot({
      artifacts: {
        ...buildWorkspaceSnapshot().artifacts,
        jdAnalysis: {
          ...buildWorkspaceSnapshot().artifacts.jdAnalysis,
          payload: {
            analyses: [
              {
                ...analysisFixture,
                updatedAt: 'not-a-date',
              },
            ],
          },
        },
      },
    })

    expect(() => assertValidWorkspaceSnapshot(malformedTimestampSnapshot)).toThrow(
      'Workspace snapshot has invalid artifacts.jdAnalysis.payload.analyses[0] metadata.',
    )

    const missingFieldSnapshot = buildWorkspaceSnapshot({
      artifacts: {
        ...buildWorkspaceSnapshot().artifacts,
        jdAnalysis: {
          ...buildWorkspaceSnapshot().artifacts.jdAnalysis,
          payload: {
            analyses: [
              {
                ...analysisFixture,
                pipelineEntryId: undefined as unknown as string,
              },
            ],
          },
        },
      },
    })

    expect(() => assertValidWorkspaceSnapshot(missingFieldSnapshot)).toThrow(
      'Workspace snapshot has invalid artifacts.jdAnalysis.payload.analyses[0] metadata.',
    )
  })
})
