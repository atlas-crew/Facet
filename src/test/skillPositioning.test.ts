import { describe, expect, it } from 'vitest'
import {
  CUSTOM_POSITIONING_VALUE,
  isPositioningPreset,
  resolvePositioningSelection,
} from '../utils/skillPositioning'

describe('skill positioning helpers', () => {
  it('recognizes exact preset positioning values', () => {
    expect(isPositioningPreset('Strong match signal. Lead with it.')).toBe(true)
    expect(resolvePositioningSelection('Strong match signal. Lead with it.')).toBe(
      'Strong match signal. Lead with it.',
    )
  })

  it('trims preset values before resolving the selection', () => {
    expect(resolvePositioningSelection('  Strong supporting signal. Mention early.  ')).toBe(
      'Strong supporting signal. Mention early.',
    )
  })

  it('returns no selection for empty positioning text', () => {
    expect(resolvePositioningSelection('')).toBe('')
    expect(resolvePositioningSelection('   ')).toBe('')
  })

  it('routes arbitrary text to the custom positioning selection', () => {
    expect(isPositioningPreset('Lead with Kubernetes migration wins.')).toBe(false)
    expect(resolvePositioningSelection('Lead with Kubernetes migration wins.')).toBe(
      CUSTOM_POSITIONING_VALUE,
    )
  })
})
