import { describe, expect, it } from 'vitest'
import {
  buildLegacyPipelineResumeGeneration,
  buildPipelineResumeVariantLabel,
  getPipelineResumePresetId,
  getPipelineResumePrimaryVectorId,
  getPipelineResumeVariantLabel,
  getPipelineResumeVectorIds,
  normalizePipelineResumeGeneration,
  normalizeResumeGenerationHandoff,
  normalizeResumeWorkspaceGeneration,
} from '../utils/resumeGeneration'

describe('resumeGeneration normalization', () => {
  it('normalizes workspace generation metadata and preserves a missing primary vector by seeding vectorIds', () => {
    expect(
      normalizeResumeWorkspaceGeneration({
        mode: 'multi-vector',
        vectorMode: 'auto',
        source: 'pipeline',
        pipelineEntryId: ' pipe-22 ',
        presetId: ' preset-2 ',
        variantId: ' variant-7 ',
        variantLabel: ' Platform Draft ',
        primaryVectorId: 'platform',
        vectorIds: ['backend', 'backend', 42],
        suggestedVectorIds: ['platform', 'backend', 'platform', null],
      }),
    ).toEqual({
      mode: 'multi-vector',
      vectorMode: 'auto',
      source: 'pipeline',
      pipelineEntryId: 'pipe-22',
      presetId: 'preset-2',
      variantId: 'variant-7',
      variantLabel: 'Platform Draft',
      primaryVectorId: 'platform',
      vectorIds: ['platform', 'backend'],
      suggestedVectorIds: ['platform', 'backend'],
    })
  })

  it('falls back invalid workspace enums to the safe defaults', () => {
    expect(
      normalizeResumeWorkspaceGeneration({
        mode: 'wild',
        vectorMode: 'sideways',
        source: 'unknown',
        vectorIds: ['backend'],
      }),
    ).toEqual({
      mode: 'single',
      vectorMode: 'manual',
      source: 'manual',
      pipelineEntryId: null,
      presetId: null,
      variantId: null,
      variantLabel: '',
      primaryVectorId: 'backend',
      vectorIds: ['backend'],
      suggestedVectorIds: [],
    })
  })

  it('returns safe workspace defaults for nullish and malformed inputs', () => {
    expect(normalizeResumeWorkspaceGeneration(null)).toEqual({
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
    })

    expect(normalizeResumeWorkspaceGeneration(undefined)).toEqual({
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
    })

    expect(normalizeResumeWorkspaceGeneration([])).toEqual({
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
    })

    expect(
      normalizeResumeWorkspaceGeneration({
        primaryVectorId: 42,
        vectorIds: 'platform',
        suggestedVectorIds: { value: 'backend' },
      }),
    ).toEqual({
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
    })
  })

  it('keeps vector ordering stable when the primary vector is already present', () => {
    expect(
      normalizeResumeWorkspaceGeneration({
        primaryVectorId: 'backend',
        vectorIds: ['platform', 'backend', 'security'],
      }),
    ).toEqual({
      mode: 'single',
      vectorMode: 'manual',
      source: 'manual',
      pipelineEntryId: null,
      presetId: null,
      variantId: null,
      variantLabel: '',
      primaryVectorId: 'backend',
      vectorIds: ['platform', 'backend', 'security'],
      suggestedVectorIds: [],
    })
  })

  it('derives pipeline generation state from legacy variant fields when no structured payload exists', () => {
    expect(
      normalizePipelineResumeGeneration(null, {
        resumeVariant: ' Platform Focus ',
        vectorId: 'platform',
        presetId: ' preset-4 ',
      }),
    ).toEqual({
      mode: 'single',
      vectorMode: 'manual',
      source: 'manual',
      presetId: 'preset-4',
      variantId: null,
      variantLabel: 'Platform Focus',
      primaryVectorId: 'platform',
      vectorIds: ['platform'],
      suggestedVectorIds: [],
      lastGeneratedAt: null,
    })
  })

  it('normalizes structured pipeline state and collapses invalid enums to defaults', () => {
    expect(
      normalizePipelineResumeGeneration({
        mode: 'dynamic',
        vectorMode: 'auto',
        source: 'pipeline',
        presetId: ' preset-9 ',
        variantId: ' variant-9 ',
        variantLabel: ' Dynamic Draft ',
        primaryVectorId: 'staff',
        vectorIds: ['platform', 'staff', 'platform'],
        suggestedVectorIds: ['manager', 'manager'],
        lastGeneratedAt: ' 2026-04-18T12:00:00.000Z ',
      }),
    ).toEqual({
      mode: 'dynamic',
      vectorMode: 'auto',
      source: 'pipeline',
      presetId: 'preset-9',
      variantId: 'variant-9',
      variantLabel: 'Dynamic Draft',
      primaryVectorId: 'staff',
      vectorIds: ['platform', 'staff'],
      suggestedVectorIds: ['manager'],
      lastGeneratedAt: '2026-04-18T12:00:00.000Z',
    })
  })

  it('falls back to legacy preset and variant values for partial structured pipeline state', () => {
    expect(
      normalizePipelineResumeGeneration(
        {
          mode: 'single',
          vectorIds: [],
          lastGeneratedAt: 1234,
        },
        {
          resumeVariant: ' Legacy Variant ',
          presetId: ' legacy-preset ',
        },
      ),
    ).toEqual({
      mode: 'single',
      vectorMode: 'manual',
      source: 'manual',
      presetId: 'legacy-preset',
      variantId: null,
      variantLabel: 'Legacy Variant',
      primaryVectorId: null,
      vectorIds: [],
      suggestedVectorIds: [],
      lastGeneratedAt: null,
    })
  })

  it('prefers structured pipeline fields over legacy fallback values', () => {
    expect(
      normalizePipelineResumeGeneration(
        {
          presetId: 'structured-preset',
          variantLabel: 'Structured Variant',
        },
        {
          presetId: 'legacy-preset',
          resumeVariant: 'Legacy Variant',
        },
      ),
    ).toEqual({
      mode: 'single',
      vectorMode: 'manual',
      source: 'manual',
      presetId: 'structured-preset',
      variantId: null,
      variantLabel: 'Structured Variant',
      primaryVectorId: null,
      vectorIds: [],
      suggestedVectorIds: [],
      lastGeneratedAt: null,
    })
  })

  it('falls back to the legacy vector when structured pipeline payload omits vector selection', () => {
    expect(
      normalizePipelineResumeGeneration(
        {
          mode: 'single',
        },
        {
          vectorId: ' platform ',
        },
      ),
    ).toEqual({
      mode: 'single',
      vectorMode: 'manual',
      source: 'manual',
      presetId: null,
      variantId: null,
      variantLabel: '',
      primaryVectorId: 'platform',
      vectorIds: ['platform'],
      suggestedVectorIds: [],
      lastGeneratedAt: null,
    })
  })

  it('keeps structured vector selections authoritative over legacy vector fallback', () => {
    expect(
      normalizePipelineResumeGeneration(
        {
          primaryVectorId: 'platform',
          vectorIds: ['platform', 'backend'],
        },
        {
          vectorId: 'legacy-vec',
        },
      ),
    ).toEqual({
      mode: 'single',
      vectorMode: 'manual',
      source: 'manual',
      presetId: null,
      variantId: null,
      variantLabel: '',
      primaryVectorId: 'platform',
      vectorIds: ['platform', 'backend'],
      suggestedVectorIds: [],
      lastGeneratedAt: null,
    })
  })

  it('routes malformed non-object pipeline payloads through the legacy fallback', () => {
    expect(
      normalizePipelineResumeGeneration('legacy-string', {
        resumeVariant: ' Legacy Variant ',
        vectorId: ' platform ',
      }),
    ).toEqual({
      mode: 'single',
      vectorMode: 'manual',
      source: 'manual',
      presetId: null,
      variantId: null,
      variantLabel: 'Legacy Variant',
      primaryVectorId: 'platform',
      vectorIds: ['platform'],
      suggestedVectorIds: [],
      lastGeneratedAt: null,
    })

    expect(normalizePipelineResumeGeneration([], {})).toBeNull()
  })

  it('normalizes invalid enums on structured pipeline payloads', () => {
    expect(
      normalizePipelineResumeGeneration({
        mode: 'wild',
        vectorMode: 'sideways',
        source: 'unknown',
        variantLabel: ' Structured Variant ',
      }),
    ).toEqual({
      mode: 'single',
      vectorMode: 'manual',
      source: 'manual',
      presetId: null,
      variantId: null,
      variantLabel: 'Structured Variant',
      primaryVectorId: null,
      vectorIds: [],
      suggestedVectorIds: [],
      lastGeneratedAt: null,
    })
  })

  it('returns null for legacy pipeline generation when no meaningful data exists', () => {
    expect(buildLegacyPipelineResumeGeneration({})).toBeNull()
    expect(
      buildLegacyPipelineResumeGeneration({
        resumeVariant: '   ',
        vectorId: '   ',
        presetId: '   ',
      }),
    ).toBeNull()
    expect(buildLegacyPipelineResumeGeneration({ presetId: ' preset-only ' })).toEqual({
      mode: 'single',
      vectorMode: 'manual',
      source: 'manual',
      presetId: 'preset-only',
      variantId: null,
      variantLabel: '',
      primaryVectorId: null,
      vectorIds: [],
      suggestedVectorIds: [],
      lastGeneratedAt: null,
    })
    expect(
      buildLegacyPipelineResumeGeneration({
        resumeVariant: ' Platform Focus ',
        vectorId: ' platform ',
        presetId: ' preset-1 ',
      }),
    ).toEqual({
      mode: 'single',
      vectorMode: 'manual',
      source: 'manual',
      presetId: 'preset-1',
      variantId: null,
      variantLabel: 'Platform Focus',
      primaryVectorId: 'platform',
      vectorIds: ['platform'],
      suggestedVectorIds: [],
      lastGeneratedAt: null,
    })
    expect(buildLegacyPipelineResumeGeneration({ resumeVariant: ' Only Variant ' })).toEqual({
      mode: 'single',
      vectorMode: 'manual',
      source: 'manual',
      presetId: null,
      variantId: null,
      variantLabel: 'Only Variant',
      primaryVectorId: null,
      vectorIds: [],
      suggestedVectorIds: [],
      lastGeneratedAt: null,
    })
    expect(buildLegacyPipelineResumeGeneration({ vectorId: ' only-vec ' })).toEqual({
      mode: 'single',
      vectorMode: 'manual',
      source: 'manual',
      presetId: null,
      variantId: null,
      variantLabel: '',
      primaryVectorId: 'only-vec',
      vectorIds: ['only-vec'],
      suggestedVectorIds: [],
      lastGeneratedAt: null,
    })
    expect(
      buildLegacyPipelineResumeGeneration({
        resumeVariant: 'Variant',
        vectorId: null,
        presetId: null,
      }),
    ).toEqual({
      mode: 'single',
      vectorMode: 'manual',
      source: 'manual',
      presetId: null,
      variantId: null,
      variantLabel: 'Variant',
      primaryVectorId: null,
      vectorIds: [],
      suggestedVectorIds: [],
      lastGeneratedAt: null,
    })
  })

  it('normalizes handoffs and rejects empty job descriptions', () => {
    expect(
      normalizeResumeGenerationHandoff({
        mode: 'dynamic',
        vectorMode: 'auto',
        source: 'pipeline',
        jobDescription: ' Staff platform role ',
        pipelineEntryId: ' pipe-3 ',
        presetId: ' preset-3 ',
        primaryVectorId: 'platform',
        vectorIds: ['backend'],
        suggestedVectorIds: ['platform', 'platform'],
        resumeGeneration: {
          mode: 'dynamic',
          vectorMode: 'auto',
          source: 'pipeline',
          variantLabel: ' Staff Variant ',
          primaryVectorId: 'platform',
          vectorIds: ['backend'],
          suggestedVectorIds: [],
          lastGeneratedAt: null,
        },
      }),
    ).toEqual({
      mode: 'dynamic',
      vectorMode: 'auto',
      source: 'pipeline',
      jobDescription: 'Staff platform role',
      pipelineEntryId: 'pipe-3',
      presetId: 'preset-3',
      primaryVectorId: 'platform',
      vectorIds: ['platform', 'backend'],
      suggestedVectorIds: ['platform'],
      resumeGeneration: {
        mode: 'dynamic',
        vectorMode: 'auto',
        source: 'pipeline',
        presetId: null,
        variantId: null,
        variantLabel: 'Staff Variant',
        primaryVectorId: 'platform',
        vectorIds: ['platform', 'backend'],
        suggestedVectorIds: [],
        lastGeneratedAt: null,
      },
    })

    expect(
      normalizeResumeGenerationHandoff({
        mode: 'dynamic',
        vectorMode: 'auto',
        source: 'pipeline',
        jobDescription: '   ',
      }),
    ).toBeNull()
  })

  it('returns null for non-object or missing-job handoff payloads', () => {
    expect(normalizeResumeGenerationHandoff(null)).toBeNull()
    expect(normalizeResumeGenerationHandoff(undefined)).toBeNull()
    expect(normalizeResumeGenerationHandoff('handoff')).toBeNull()
    expect(normalizeResumeGenerationHandoff({})).toBeNull()
    expect(normalizeResumeGenerationHandoff([])).toBeNull()
    expect(normalizeResumeGenerationHandoff(['jobDescription'])).toBeNull()
    expect(normalizeResumeGenerationHandoff({ jobDescription: 42 })).toBeNull()
    expect(normalizeResumeGenerationHandoff({ jobDescription: { text: 'x' } })).toBeNull()
  })

  it('normalizes invalid enums on handoff payloads', () => {
    expect(
      normalizeResumeGenerationHandoff({
        mode: 'wild',
        vectorMode: 'sideways',
        source: 'unknown',
        jobDescription: 'Valid JD',
      }),
    ).toEqual({
      mode: 'single',
      vectorMode: 'manual',
      source: 'manual',
      jobDescription: 'Valid JD',
      pipelineEntryId: null,
      presetId: null,
      primaryVectorId: null,
      vectorIds: [],
      suggestedVectorIds: [],
      resumeGeneration: null,
    })
  })

  it('keeps valid handoffs stable when nested generation payload is missing or malformed', () => {
    expect(
      normalizeResumeGenerationHandoff({
        mode: 'single',
        vectorMode: 'manual',
        source: 'manual',
        jobDescription: 'Platform role',
      }),
    ).toEqual({
      mode: 'single',
      vectorMode: 'manual',
      source: 'manual',
      jobDescription: 'Platform role',
      pipelineEntryId: null,
      presetId: null,
      primaryVectorId: null,
      vectorIds: [],
      suggestedVectorIds: [],
      resumeGeneration: null,
    })

    expect(
      normalizeResumeGenerationHandoff({
        mode: 'single',
        vectorMode: 'manual',
        source: 'manual',
        jobDescription: 'Platform role',
        resumeGeneration: 'bad-payload',
      }),
    ).toEqual({
      mode: 'single',
      vectorMode: 'manual',
      source: 'manual',
      jobDescription: 'Platform role',
      pipelineEntryId: null,
      presetId: null,
      primaryVectorId: null,
      vectorIds: [],
      suggestedVectorIds: [],
      resumeGeneration: null,
    })
  })

  it('prefers generated pipeline variant labels and falls back to legacy labels', () => {
    expect(
      getPipelineResumeVariantLabel({
        resumeGeneration: {
          mode: 'dynamic',
          vectorMode: 'auto',
          source: 'pipeline',
          presetId: null,
          variantId: null,
          variantLabel: ' Generated Label ',
          primaryVectorId: null,
          vectorIds: [],
          suggestedVectorIds: [],
          lastGeneratedAt: null,
        },
        resumeVariant: 'Legacy Label',
      }),
    ).toBe('Generated Label')

    expect(
      getPipelineResumeVariantLabel({
        resumeGeneration: null,
        resumeVariant: ' Legacy Label ',
      }),
    ).toBe('Legacy Label')

    expect(
      getPipelineResumeVariantLabel({
        resumeGeneration: {
          mode: 'dynamic',
          vectorMode: 'auto',
          source: 'pipeline',
          presetId: null,
          variantId: null,
          variantLabel: '   ',
          primaryVectorId: null,
          vectorIds: [],
          suggestedVectorIds: [],
          lastGeneratedAt: null,
        },
        resumeVariant: ' Fallback Label ',
      }),
    ).toBe('Fallback Label')

    expect(getPipelineResumeVariantLabel({})).toBe('')
    expect(getPipelineResumeVariantLabel({ resumeVariant: 42 as unknown as string })).toBe('')
  })

  it('reads structured pipeline preset and vector metadata with legacy fallbacks', () => {
    expect(
      getPipelineResumePresetId({
        presetId: 'preset-legacy',
        resumeGeneration: {
          mode: 'dynamic',
          vectorMode: 'auto',
          source: 'pipeline',
          presetId: 'preset-structured',
          variantId: null,
          variantLabel: '',
          primaryVectorId: 'platform',
          vectorIds: ['platform', 'backend'],
          suggestedVectorIds: ['platform'],
          lastGeneratedAt: null,
        },
      }),
    ).toBe('preset-structured')

    expect(
      getPipelineResumePrimaryVectorId({
        vectorId: 'legacy',
        resumeGeneration: {
          mode: 'dynamic',
          vectorMode: 'auto',
          source: 'pipeline',
          presetId: null,
          variantId: null,
          variantLabel: '',
          primaryVectorId: 'platform',
          vectorIds: ['platform', 'backend'],
          suggestedVectorIds: ['platform'],
          lastGeneratedAt: null,
        },
      }),
    ).toBe('platform')

    expect(
      getPipelineResumeVectorIds({
        vectorId: 'legacy',
        resumeGeneration: {
          mode: 'dynamic',
          vectorMode: 'auto',
          source: 'pipeline',
          presetId: null,
          variantId: null,
          variantLabel: '',
          primaryVectorId: 'platform',
          vectorIds: ['platform', 'backend'],
          suggestedVectorIds: ['platform'],
          lastGeneratedAt: null,
        },
      }),
    ).toEqual(['platform', 'backend'])
  })

  it('builds a dynamic pipeline variant label from company and role when no label exists', () => {
    expect(
      buildPipelineResumeVariantLabel({
        company: 'Acme Corp',
        role: 'Staff Platform Engineer',
      }),
    ).toBe('Acme Corp · Staff Platform Engineer')
  })

  it('adds an entry suffix when a dynamic pipeline variant has no company or role', () => {
    expect(
      buildPipelineResumeVariantLabel({
        entryId: 'entry-123456789',
      }),
    ).toBe('Dynamic Resume Variant · entry-')
  })
})
