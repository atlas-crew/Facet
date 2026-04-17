import { describe, expect, it } from 'vitest'
import { resolvePrepConditionalTone } from '../utils/prepCardContent'

describe('resolvePrepConditionalTone', () => {
  it('defaults missing or invalid tones to pivot', () => {
    expect(resolvePrepConditionalTone({ tone: undefined })).toBe('pivot')
    expect(resolvePrepConditionalTone({ tone: 'not-real' as never })).toBe('pivot')
  })

  it('preserves supported tones', () => {
    expect(resolvePrepConditionalTone({ tone: 'pivot' })).toBe('pivot')
    expect(resolvePrepConditionalTone({ tone: 'trap' })).toBe('trap')
    expect(resolvePrepConditionalTone({ tone: 'escalation' })).toBe('escalation')
  })
})
