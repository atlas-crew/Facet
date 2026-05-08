import { describe, expect, it } from 'vitest'
import {
  formatPrepSkillDepthConfidenceGuidance,
  mapSkillDepthToStackConfidence,
} from '../utils/prepSkillDepthMapping'

describe('mapSkillDepthToStackConfidence', () => {
  it('maps every explicit depth value to the prep stack confidence scale', () => {
    expect(mapSkillDepthToStackConfidence('expert')).toBe('Strong')
    expect(mapSkillDepthToStackConfidence('strong')).toBe('Strong')
    expect(mapSkillDepthToStackConfidence('hands-on-working')).toBe('Solid')
    expect(mapSkillDepthToStackConfidence('architectural')).toBe('Solid')
    expect(mapSkillDepthToStackConfidence('working')).toBe('Working knowledge')
    expect(mapSkillDepthToStackConfidence('conceptual')).toBe('Adjacent experience')
    expect(mapSkillDepthToStackConfidence('basic')).toBe('Adjacent experience')
    expect(mapSkillDepthToStackConfidence('avoid')).toBe('Gap')
  })

  it('maps missing evidence to Gap', () => {
    expect(mapSkillDepthToStackConfidence(undefined)).toBe('Gap')
  })

  it('softens Strong to Solid when calibration warns against overclaiming', () => {
    expect(
      mapSkillDepthToStackConfidence('strong', 'Not a K8s admin; builds platforms around K8s.'),
    ).toBe('Solid')
  })

  it('does not soften Strong for benign calibration wording', () => {
    expect(
      mapSkillDepthToStackConfidence('expert', 'Production-grade work in a limited domain.'),
    ).toBe('Strong')
    expect(
      mapSkillDepthToStackConfidence('strong', 'Transferable lessons from a prior role.'),
    ).toBe('Strong')
    expect(
      mapSkillDepthToStackConfidence('strong', 'Strong fundamentals and basic internals.'),
    ).toBe('Strong')
    expect(mapSkillDepthToStackConfidence('strong', 'Fast ramp on team conventions.')).toBe(
      'Strong',
    )
  })

  it('treats basic calibrated as non-direct evidence as a Gap', () => {
    expect(mapSkillDepthToStackConfidence('basic', 'No direct hands-on experience.')).toBe('Gap')
  })

  it('demotes solid tiers when calibration says the evidence is not direct', () => {
    expect(
      mapSkillDepthToStackConfidence('hands-on-working', 'No direct production ownership.'),
    ).toBe('Working knowledge')
    expect(mapSkillDepthToStackConfidence('architectural', 'Not hands-on with operations.')).toBe(
      'Working knowledge',
    )
  })

  it('maps explicit anti-claim calibration to Gap at any depth', () => {
    expect(mapSkillDepthToStackConfidence('expert', 'Do not claim this in interviews.')).toBe('Gap')
  })

  it('keeps the prompt guidance synchronized with the exported mapping', () => {
    const guidance = formatPrepSkillDepthConfidenceGuidance()

    expect(guidance).toContain('expert -> Strong')
    expect(guidance).toContain('undefined -> Gap')
    expect(guidance).toContain('anti-overselling notes soften Strong -> Solid')
  })
})
