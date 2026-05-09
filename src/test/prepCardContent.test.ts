import { describe, expect, it } from 'vitest'
import {
  getPrepPushbackLabel,
  getPrepPushbackPracticeCardId,
  getPrepPushbackPracticeKey,
  getPrepRenderableStoryVariants,
  getPrepStoryVariantPracticeKey,
  hasPrepCardNeedsReviewContent,
  hasPrepNeedsReviewText,
  parsePrepStoryVariantPracticeKey,
  resolvePrepConditionalTone,
} from '../utils/prepCardContent'

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

describe('prep story variant helpers', () => {
  it('uses story variants only when they should replace fallback story blocks', () => {
    expect(
      getPrepRenderableStoryVariants({
        storyBlocks: [{ label: 'problem', text: 'Fallback story' }],
        storyVariants: [
          {
            id: 'primary',
            label: 'Primary',
            storyBlocks: [{ label: 'problem', text: 'Primary story' }],
          },
        ],
      }),
    ).toEqual([])

    expect(
      getPrepRenderableStoryVariants({
        storyVariants: [
          {
            id: 'primary',
            label: 'Primary',
            storyBlocks: [{ label: 'problem', text: 'Primary story' }],
          },
        ],
      }),
    ).toHaveLength(1)

    expect(
      getPrepRenderableStoryVariants({
        storyVariants: [
          {
            id: 'primary',
            label: 'Primary',
            storyBlocks: [{ label: 'problem', text: 'Primary story' }],
          },
          {
            id: 'alt',
            label: 'Alternative',
            storyBlocks: [{ label: 'solution', text: 'Alternative story' }],
          },
        ],
      }),
    ).toHaveLength(2)
    expect(getPrepStoryVariantPracticeKey('card-1', 'alt')).toBe('story-variant::card-1::alt')
    expect(parsePrepStoryVariantPracticeKey(getPrepStoryVariantPracticeKey('card-1', 'a'))).toEqual({
      cardId: 'card-1',
      variantId: 'a',
    })
    expect(
      parsePrepStoryVariantPracticeKey(getPrepStoryVariantPracticeKey('card::legacy', 'a')),
    ).toEqual({
      cardId: 'card::legacy',
      variantId: 'a',
    })
  })

  it('detects needs-review markers in story variants', () => {
    expect(
      hasPrepCardNeedsReviewContent({
        title: 'Influence story',
        script: 'Pick the right story.',
        storyVariants: [
          {
            id: 'primary',
            label: 'Primary',
            storyBlocks: [{ label: 'problem', text: 'Stable story' }],
          },
          {
            id: 'alt',
            label: 'Alternative',
            when: '[[needs-review]] choose when this is appropriate',
            storyBlocks: [{ label: 'solution', text: 'Alternative story' }],
          },
        ],
      }),
    ).toBe(true)
    expect(
      hasPrepCardNeedsReviewContent({
        title: 'Influence story',
        script: 'Pick the right story.',
        storyVariants: [
          {
            id: 'draft',
            label: '',
            storyBlocks: [{ label: 'problem', text: 'Stable story' }],
          },
        ],
      }),
    ).toBe(true)
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
    expect(
      hasPrepCardNeedsReviewContent({
        title: 'Why this role',
        script: '[[needs-review]] tighten the exact departure context',
        keyPoints: ['Ownership'],
      }),
    ).toBe(true)

    expect(
      hasPrepCardNeedsReviewContent({
        title: 'Stable opener',
        script: 'I build reliable platforms.',
        keyPoints: ['Scale', 'Ownership'],
      }),
    ).toBe(false)
  })

  it('detects needs-review markers in pushback content', () => {
    expect(
      hasPrepCardNeedsReviewContent({
        title: 'Why this transition',
        script: 'Keep the first answer concise.',
        pushbackScript: '[[needs-review]] add honest extra context',
      }),
    ).toBe(true)

    expect(
      hasPrepCardNeedsReviewContent({
        title: 'Why this transition',
        script: 'Keep the first answer concise.',
        pushbackLabel: 'If they push on [[fill-in: exact concern]]',
      }),
    ).toBe(true)
  })
})

describe('prep pushback helpers', () => {
  it('normalizes pushback labels and practice keys', () => {
    expect(getPrepPushbackLabel({ pushbackLabel: ' If they ask why now ' })).toBe(
      'If they ask why now',
    )
    expect(getPrepPushbackLabel({})).toBe('If they push')
    expect(getPrepPushbackPracticeKey('card-1')).toBe('pushback::card-1')
    expect(getPrepPushbackPracticeCardId('pushback::card-1')).toBe('card-1')
    expect(getPrepPushbackPracticeCardId('card-1')).toBe('card-1')
  })
})
