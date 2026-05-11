import { describe, expect, it } from 'vitest'
import {
  PREP_CARD_KIND_VALUES,
  PREP_CONTRACT_VIOLATION_KINDS,
  PREP_SCRIPT_KIND_VALUES,
  type PrepDecisionTreeNode,
  type PrepPhasedFrameworkPhase,
  isAnchorCard,
  isCloserCard,
  isDeepDiveCard,
  isFollowUpQACard,
  isIntelCard,
  isOpenerCard,
  isPrepCardKind,
  isPrepScriptKind,
  isReferenceCard,
  isScenarioCard,
  isStoryCard,
  parsePrepCardKind,
  parsePrepScriptKind,
  resolvePrepCardKind,
} from '../types/prep'
import type { PrepCard, PrepCardBase, PrepCardKind } from '../types/prep'

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
  const base: PrepCardBase = {
    id: `${kind}-card`,
    category: kind === 'opener' ? 'opener' : 'behavioral',
    title: `${kind} card`,
    tags: [],
  }

  if (kind === 'scenario') {
    return {
      ...base,
      kind,
      whyLikely: 'The interviewer has asked comparable architecture tradeoff questions.',
    }
  }

  return { ...base, kind } as PrepCard
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

  it('validates and parses explicit script kind values', () => {
    expect(PREP_SCRIPT_KIND_VALUES).toEqual([
      'opener',
      'honest-bridge',
      'closer',
      'line-that-lands',
      'pivot',
    ])
    expect(isPrepScriptKind('honest-bridge')).toBe(true)
    expect(isPrepScriptKind(' honest-bridge ')).toBe(false)
    expect(isPrepScriptKind('HONEST-BRIDGE')).toBe(false)
    expect(parsePrepScriptKind('  line-that-lands\n')).toBe('line-that-lands')
    expect(parsePrepScriptKind('line_that_lands')).toBeUndefined()
    expect(parsePrepScriptKind(null)).toBeUndefined()
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

  it('models scenario decision trees and phased frameworks', () => {
    const decisionTree = [
      {
        title: 'Choose the migration path',
        options: [
          {
            option: 'Strangler migration',
            whenRight: 'Traffic can move incrementally.',
            tradeoff: 'Requires routing discipline.',
          },
        ],
        recommendation: 'Pick the incremental route when production risk dominates.',
        trap: 'Do not hand-wave data consistency.',
      },
    ] satisfies PrepDecisionTreeNode[]
    const phasedFramework = [
      {
        phase: 'Map risk',
        timeframe: 'Week 1',
        bullets: ['Inventory blast radius', 'Pick rollback points'],
      },
    ] satisfies PrepPhasedFrameworkPhase[]
    const card: PrepCard = {
      id: 'scenario-card',
      kind: 'scenario',
      category: 'situational',
      title: 'How would you migrate the platform?',
      tags: ['system-design'],
      whyLikely: 'The role is explicitly about platform migrations.',
      decisionTree,
      phasedFramework,
    }

    expect(isScenarioCard(card)).toBe(true)
    expect(card.decisionTree?.[0]?.options?.[0]?.tradeoff).toBe('Requires routing discipline.')
    expect(card.phasedFramework?.[0]?.bullets).toContain('Pick rollback points')
  })
})
