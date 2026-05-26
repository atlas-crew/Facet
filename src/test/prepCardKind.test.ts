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
import type {
  PrepAnchorSubDecision,
  PrepCard,
  PrepCardBase,
  PrepCardKind,
  PrepDeckSection,
} from '../types/prep'

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

  if (kind === 'anchor') {
    return {
      ...base,
      kind,
      storyBlocks: [{ label: 'problem', text: 'One umbrella technical problem.' }],
      subDecisions: [
        {
          id: 'decision-1',
          title: 'Pick the rollout path',
          blocks: [{ label: 'solution', text: 'Moved traffic incrementally.' }],
        },
      ],
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

  it('models anchor sub-decisions as required technical story structure', () => {
    const subDecisions = [
      {
        id: 'decision-1',
        title: 'Choose staged migration',
        tag: 'rollout',
        blocks: [
          { label: 'problem', text: 'The old platform could not move all at once.' },
          { label: 'solution', text: 'I sequenced the rollout behind explicit checkpoints.' },
          { label: 'result', text: 'The team kept rollback options during migration.' },
        ],
        pushbackResponse: 'I would name the reconciliation risk before defending the sequence.',
        honestTradeoff: 'The staged path took longer but reduced customer blast radius.',
      },
    ] satisfies PrepAnchorSubDecision[]
    const card: PrepCard = {
      id: 'anchor-card',
      category: 'technical',
      kind: 'anchor',
      title: 'Platform migration anchor',
      tags: ['system-design'],
      storyBlocks: [{ label: 'note', text: 'One story ties the architecture choices together.' }],
      subDecisions,
    }

    expect(isAnchorCard(card)).toBe(true)
    expect(card.subDecisions).toEqual(subDecisions)
  })

  it('models deck-scoped sections as ordered card id groups', () => {
    const sections = [
      { id: 'anchor', title: 'Anchor', cardIds: ['anchor-card'] },
      { id: 'scenarios', title: 'Scenarios', cardIds: ['scenario-card-1', 'scenario-card-2'] },
    ] satisfies PrepDeckSection[]

    expect(sections[0].title).toBe('Anchor')
    expect(sections[1].cardIds).toEqual(['scenario-card-1', 'scenario-card-2'])
  })
})
