import { describe, expect, it } from 'vitest'
import {
  PREP_CARD_KIND_VALUES,
  PREP_CONTRACT_VIOLATION_KINDS,
  isAnchorCard,
  isCloserCard,
  isDeepDiveCard,
  isFollowUpQACard,
  isIntelCard,
  isOpenerCard,
  isPrepCardKind,
  isReferenceCard,
  isScenarioCard,
  isStoryCard,
  parsePrepCardKind,
  resolvePrepCardKind,
} from '../types/prep'
import type { PrepCard, PrepCardKind } from '../types/prep'

const guardByKind = {
  opener: isOpenerCard,
  intel: isIntelCard,
  story: isStoryCard,
  anchor: isAnchorCard,
  scenario: isScenarioCard,
  'deep-dive': isDeepDiveCard,
  closer: isCloserCard,
  reference: isReferenceCard,
  'followup-qa': isFollowUpQACard,
} satisfies Record<PrepCardKind, (card: PrepCard) => boolean>

function makeCard(kind: PrepCardKind): PrepCard {
  return {
    id: `${kind}-card`,
    category: kind === 'opener' ? 'opener' : 'behavioral',
    kind,
    title: `${kind} card`,
    tags: [],
  }
}

describe('prep card kind helpers', () => {
  it('validates and parses explicit card kind values', () => {
    expect(PREP_CARD_KIND_VALUES).toEqual([
      'opener',
      'intel',
      'story',
      'anchor',
      'scenario',
      'deep-dive',
      'closer',
      'reference',
      'followup-qa',
    ])
    expect(PREP_CONTRACT_VIOLATION_KINDS).toContain('invalid-field')
    expect(isPrepCardKind('story')).toBe(true)
    expect(isPrepCardKind(' story ')).toBe(false)
    expect(isPrepCardKind('STORY')).toBe(false)
    expect(isPrepCardKind({ kind: 'story' })).toBe(false)
    expect(parsePrepCardKind('  story\n')).toBe('story')
    expect(parsePrepCardKind('STORY')).toBeUndefined()
    expect(parsePrepCardKind(123)).toBeUndefined()
  })

  it('infers missing legacy card kinds in priority order', () => {
    expect(
      resolvePrepCardKind(undefined, {
        tags: ['intel'],
        interviewerIds: ['interviewer-1'],
        category: 'opener',
      }),
    ).toBe('intel')
    expect(
      resolvePrepCardKind(undefined, {
        interviewerIds: ['interviewer-1'],
        category: 'opener',
      }),
    ).toBe('intel')
    expect(resolvePrepCardKind(undefined, { category: 'opener' })).toBe('opener')
    expect(resolvePrepCardKind(undefined, {})).toBe('story')
    expect(resolvePrepCardKind(null, {})).toBe('story')
  })

  it('normalizes legacy intel tags but keeps explicit malformed values invalid', () => {
    expect(resolvePrepCardKind(undefined, { tags: ['Intel'] })).toBe('intel')
    expect(resolvePrepCardKind(undefined, { tags: ['  intel  '] })).toBe('intel')
    expect(resolvePrepCardKind(undefined, { tags: ['intel', 42, null, { x: 1 }] })).toBe('intel')
    expect(resolvePrepCardKind('bogus', { tags: ['intel'], category: 'opener' })).toBeUndefined()
    expect(resolvePrepCardKind('OPENER', { category: 'opener' })).toBeUndefined()
  })

  it('handles malformed legacy context shapes without throwing', () => {
    expect(resolvePrepCardKind(undefined, { tags: 'intel' })).toBe('story')
    expect(resolvePrepCardKind(undefined, { interviewerIds: 'interviewer-1' })).toBe('story')
  })

  it('keeps kind guard predicates aligned with their matching discriminator', () => {
    const cards = PREP_CARD_KIND_VALUES.map((kind) => makeCard(kind))

    PREP_CARD_KIND_VALUES.forEach((kind) => {
      const guard = guardByKind[kind]

      cards.forEach((card) => {
        expect(guard(card)).toBe(card.kind === kind)
      })
    })
  })
})
