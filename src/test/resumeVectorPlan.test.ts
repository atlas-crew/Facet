import { describe, expect, it } from 'vitest'
import type { JdAnalysisResult, ResumeVector } from '../types'
import type { ResumeWorkspaceGenerationState } from '../types/resumeGeneration'
import {
  applyResumeVectorPlan,
  buildInitialResumeVectorPlan,
  resolvePlannedVectorIds,
} from '../utils/resumeVectorPlan'

const vectors: ResumeVector[] = [
  { id: 'backend', label: 'Backend', color: '#111111' },
  { id: 'platform', label: 'Platform', color: '#222222' },
  { id: 'leadership', label: 'Leadership', color: '#333333' },
]

const baseGeneration: ResumeWorkspaceGenerationState = {
  mode: 'single',
  vectorMode: 'manual',
  source: 'manual',
  pipelineEntryId: null,
  presetId: null,
  variantId: null,
  variantLabel: '',
  primaryVectorId: null,
  vectorIds: [],
  suggestedVectorIds: [],
}

const analysis = (overrides: Partial<JdAnalysisResult> = {}): JdAnalysisResult => ({
  primary_vector: 'platform',
  suggested_vectors: ['platform', 'backend'],
  bullet_adjustments: [],
  suggested_target_line: '',
  skill_gaps: [],
  matched_keywords: [],
  suggested_variables: {},
  positioning_note: '',
  vector_strategy: 'Start with platform and keep backend as a secondary lane.',
  ...overrides,
})

describe('resumeVectorPlan', () => {
  it('builds an initial multi-vector auto plan from AI suggestions', () => {
    expect(buildInitialResumeVectorPlan(analysis(), vectors, baseGeneration)).toEqual({
      mode: 'multi-vector',
      vectorMode: 'auto',
      primaryVectorId: 'platform',
      vectorIds: ['platform', 'backend'],
      suggestedVectorIds: ['platform', 'backend'],
    })
  })

  it('falls back to a single vector when only one known suggestion survives', () => {
    expect(
      buildInitialResumeVectorPlan(
        analysis({ primary_vector: 'backend', suggested_vectors: ['unknown', 'backend'] }),
        vectors,
        baseGeneration,
      ),
    ).toEqual({
      mode: 'single',
      vectorMode: 'auto',
      primaryVectorId: 'backend',
      vectorIds: ['backend'],
      suggestedVectorIds: ['backend'],
    })
  })

  it('keeps AI suggestions empty when only fallback selection is available', () => {
    expect(
      buildInitialResumeVectorPlan(
        analysis({ primary_vector: 'unknown', suggested_vectors: ['unknown'] }),
        vectors,
        { ...baseGeneration, primaryVectorId: 'backend' },
      ),
    ).toEqual({
      mode: 'single',
      vectorMode: 'auto',
      primaryVectorId: 'backend',
      vectorIds: ['backend'],
      suggestedVectorIds: [],
    })
  })

  it('resolves manual single-vector plans down to one vector', () => {
    expect(
      resolvePlannedVectorIds(vectors, 'single', 'manual', ['leadership', 'backend'], ['platform'], 'platform'),
    ).toEqual(['leadership'])
  })

  it('keeps manual multi-vector selections when they are valid', () => {
    expect(
      resolvePlannedVectorIds(vectors, 'multi-vector', 'manual', ['leadership', 'backend'], ['platform'], 'platform'),
    ).toEqual(['leadership', 'backend'])
  })

  it('requires an explicit manual selection in multi-vector mode', () => {
    expect(resolvePlannedVectorIds(vectors, 'multi-vector', 'manual', [], ['platform'], 'platform')).toEqual([])
  })

  it('applies a vector plan onto existing generation metadata', () => {
    expect(
      applyResumeVectorPlan(
        {
          ...baseGeneration,
          source: 'identity',
          variantId: 'variant-1',
          variantLabel: 'Imported',
        },
        {
          mode: 'multi-vector',
          vectorMode: 'manual',
          primaryVectorId: 'platform',
          vectorIds: ['platform', 'backend'],
          suggestedVectorIds: ['platform', 'backend'],
        },
        vectors,
        ['backend', 'platform'],
      ),
    ).toMatchObject({
      source: 'identity',
      variantId: 'variant-1',
      variantLabel: 'Imported',
      mode: 'multi-vector',
      vectorMode: 'manual',
      primaryVectorId: 'platform',
      vectorIds: ['backend', 'platform'],
      suggestedVectorIds: ['platform', 'backend'],
    })
  })

  it('preserves dynamic mode when applying a vector plan for pipeline-driven workspaces', () => {
    expect(
      applyResumeVectorPlan(
        {
          ...baseGeneration,
          mode: 'dynamic',
          source: 'pipeline',
          pipelineEntryId: 'pipe-9',
        },
        {
          mode: 'single',
          vectorMode: 'auto',
          primaryVectorId: 'platform',
          vectorIds: ['platform'],
          suggestedVectorIds: ['platform'],
        },
        vectors,
        ['platform'],
      ),
    ).toMatchObject({
      mode: 'dynamic',
      source: 'pipeline',
      primaryVectorId: 'platform',
      vectorIds: ['platform'],
    })
  })
})
