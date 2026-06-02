import { describe, expect, it } from 'vitest'
import {
  computePositioningDraftApplication,
  formatPositioningApplyMessage,
  getPositioningGenerationKey,
  getResidualPositioningDraft,
  hasPositioningDraftSections,
  uniquifyGeneratedItems,
} from '../routes/identity/positioningDraft'
import { getUniqueUnfairAdvantages } from '../utils/unfairAdvantagesDedupe'
import { cloneIdentityFixture } from './fixtures/identityFixture'

describe('positioningDraft helpers', () => {
  it('uses model revision as the generation key change signal', () => {
    const identity = cloneIdentityFixture()
    const originalKey = getPositioningGenerationKey(identity)
    const edited = cloneIdentityFixture()
    edited.model_revision = identity.model_revision + 1

    expect(getPositioningGenerationKey(edited)).not.toBe(originalKey)
  })

  it('deduplicates generated items by normalized signature and assigns fresh ids', () => {
    const next = uniquifyGeneratedItems({
      existing: [{ id: 'existing-platform', title: 'Platform Strategy' }],
      generated: [
        { id: 'duplicate-generated', title: ' platform   strategy ' },
        { id: 'new-generated', title: 'Security Platform' },
        { id: 'new-generated-duplicate', title: 'security platform' },
        { id: 'empty-generated', title: '   ' },
      ],
      idPrefix: 'search-vector',
      getSignature: (item) => item.title,
    })

    expect(next).toHaveLength(1)
    expect(next[0]).toMatchObject({ title: 'Security Platform' })
    expect(next[0]?.id).not.toBe('new-generated')
    expect(next[0]?.id.startsWith('search-vector')).toBe(true)
  })

  it('deduplicates generated unfair advantages by normalized text', () => {
    expect(
      getUniqueUnfairAdvantages(['Existing advantage'], [
        ' existing   advantage ',
        'Platform plus product judgment',
        '',
        'platform plus product judgment',
      ]),
    ).toEqual(['Platform plus product judgment'])
  })

  it('detects empty and non-empty positioning drafts', () => {
    expect(
      hasPositioningDraftSections({
        unfair_advantages: [],
        search_vectors: [],
        open_questions: [],
      }),
    ).toBe(false)
    expect(
      hasPositioningDraftSections({
        competitive_moat: 'Platform moat',
        unfair_advantages: [],
        search_vectors: [],
        open_questions: [],
      }),
    ).toBe(true)
  })

  it('formats apply messages with changed sections and a no-op fallback', () => {
    expect(
      formatPositioningApplyMessage({
        replacedMoat: true,
        advantageCount: 1,
        vectorCount: 2,
        questionCount: 1,
      }),
    ).toBe('Applied moat, 1 advantage, 2 vectors, 1 question from the positioning draft.')
    expect(
      formatPositioningApplyMessage({
        replacedMoat: false,
        advantageCount: 0,
        vectorCount: 0,
        questionCount: 0,
      }),
    ).toBe('Draft matched the current identity; nothing new was applied.')
  })

  it('computes draft application diffs and resolves targeted unchanged moat proposals', () => {
    const identity = cloneIdentityFixture()
    identity.self_model.competitive_moat = 'Existing moat'
    identity.self_model.unfair_advantages = ['Existing advantage']
    identity.search_vectors = []
    identity.awareness = { open_questions: [] }
    const draft = {
      competitive_moat: 'Existing moat',
      unfair_advantages: ['New advantage'],
      search_vectors: [],
      open_questions: [],
    }

    const application = computePositioningDraftApplication({
      draft,
      identity,
      sections: { moat: true, advantages: true },
    })

    expect(application.shouldReplaceMoat).toBe(false)
    expect(application.nextAdvantages).toEqual(['New advantage'])
    expect(
      getResidualPositioningDraft(draft, {
        moat: true,
        advantages: true,
      }),
    ).toBeNull()
  })
})
