import { beforeEach, describe, expect, it } from 'vitest'
import { useHandoffStore } from '../store/handoffStore'

describe('handoffStore', () => {
  beforeEach(() => {
    useHandoffStore.setState({ pendingGeneration: null })
  })

  it('setPendingAnalysis preserves the legacy handoff contract while seeding generation metadata', () => {
    useHandoffStore.getState().setPendingAnalysis('JD text', 'platform', 'pipe-123')

    const handoff = useHandoffStore.getState().consume()
    expect(handoff).toEqual({
      mode: 'single',
      vectorMode: 'manual',
      source: 'pipeline',
      jobDescription: 'JD text',
      pipelineEntryId: 'pipe-123',
      presetId: null,
      primaryVectorId: 'platform',
      vectorIds: ['platform'],
      suggestedVectorIds: [],
      resumeGeneration: null,
      jd: 'JD text',
      vectorId: 'platform',
      entryId: 'pipe-123',
    })
    expect(useHandoffStore.getState().pendingGeneration).toBeNull()
  })

  it('setPendingGeneration normalizes structured payloads before consume', () => {
    useHandoffStore.getState().setPendingGeneration({
      mode: 'dynamic',
      vectorMode: 'auto',
      source: 'pipeline',
      jobDescription: ' Tailored JD ',
      pipelineEntryId: 'pipe-9',
      presetId: 'preset-1',
      primaryVectorId: 'backend',
      vectorIds: ['backend', 'backend', 'platform'],
      suggestedVectorIds: ['platform', 'platform'],
      resumeGeneration: {
        mode: 'dynamic',
        vectorMode: 'auto',
        source: 'pipeline',
        presetId: 'preset-1',
        variantId: 'variant-9',
        variantLabel: ' Platform Variant ',
        primaryVectorId: 'backend',
        vectorIds: ['backend', 'platform', 'backend'],
        suggestedVectorIds: ['platform', 'platform'],
        lastGeneratedAt: '2026-04-18T11:00:00.000Z',
      },
    })

    const handoff = useHandoffStore.getState().consume()
    expect(handoff?.jobDescription).toBe('Tailored JD')
    expect(handoff?.vectorIds).toEqual(['backend', 'platform'])
    expect(handoff?.suggestedVectorIds).toEqual(['platform'])
    expect(handoff?.resumeGeneration?.variantLabel).toBe('Platform Variant')
    expect(handoff?.resumeGeneration?.vectorIds).toEqual(['backend', 'platform'])
    expect(handoff?.jd).toBe('Tailored JD')
    expect(handoff?.vectorId).toBe('backend')
    expect(handoff?.entryId).toBe('pipe-9')
  })
})
