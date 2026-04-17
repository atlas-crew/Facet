import { describe, expect, it } from 'vitest'
import { hasPrepCardNeedsReviewContent, hasPrepNeedsReviewText, resolvePrepConditionalTone } from '../utils/prepCardContent'

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

describe('prep needs-review markers', () => {
  it('detects placeholder markers in freeform text', () => {
    expect(hasPrepNeedsReviewText('[[needs-review]] confirm this number')).toBe(true)
    expect(hasPrepNeedsReviewText('[[fill-in: exact project name]]')).toBe(true)
    expect(hasPrepNeedsReviewText('ship the answer')).toBe(false)
    expect(hasPrepNeedsReviewText('[needs review by legal]')).toBe(false)
  })

  it('detects needs-review content anywhere on a prep card', () => {
    expect(hasPrepCardNeedsReviewContent({
      title: 'Why this role',
      script: '[[needs-review]] tighten the exact departure context',
      keyPoints: ['Ownership'],
    })).toBe(true)

    expect(hasPrepCardNeedsReviewContent({
      title: 'Stable opener',
      script: 'I build reliable platforms.',
      keyPoints: ['Scale', 'Ownership'],
    })).toBe(false)
  })
})
