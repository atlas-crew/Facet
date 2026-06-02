import { describe, expect, it } from 'vitest'
import {
  areNearDuplicateUnfairAdvantages,
  dedupeUnfairAdvantages,
  getUniqueUnfairAdvantages,
} from '../utils/unfairAdvantagesDedupe'

describe('unfairAdvantagesDedupe', () => {
  it('matches exact entries after whitespace and case normalization', () => {
    expect(
      areNearDuplicateUnfairAdvantages(
        ' Platform infrastructure depth plus product judgment ',
        'platform   infrastructure depth plus product judgment',
      ),
    ).toBe(true)
    expect(areNearDuplicateUnfairAdvantages(' Of and with ', 'of and with')).toBe(true)
  })

  it('matches reordered and lightly reworded generated advantages', () => {
    expect(
      areNearDuplicateUnfairAdvantages(
        'Platform infrastructure depth plus product judgment',
        'Product-aware platform infrastructure depth',
      ),
    ).toBe(true)
    expect(
      areNearDuplicateUnfairAdvantages(
        'Customer deployment architecture evidence',
        'Customer-facing deployment architecture proof',
      ),
    ).toBe(true)
  })

  it('matches normalized suffix and punctuation variants', () => {
    expect(
      areNearDuplicateUnfairAdvantages(
        'Deploying APIs for e-commerce platform companies',
        'Deployed API for ecommerce platform company',
      ),
    ).toBe(true)
    expect(
      areNearDuplicateUnfairAdvantages(
        "Customer's awareness of process boxes",
        'Customers awareness of process boxes',
      ),
    ).toBe(true)
  })

  it('does not merge distinct advantages with different evidence', () => {
    expect(
      areNearDuplicateUnfairAdvantages(
        'Platform infrastructure depth plus product judgment',
        'Security enablement through incident-response operating models',
      ),
    ).toBe(false)
    expect(
      areNearDuplicateUnfairAdvantages(
        'Platform reliability leadership across migrations',
        'Platform reliability evidence through audits',
      ),
    ).toBe(false)
  })

  it('preserves short technical differentiators when comparing advantages', () => {
    expect(
      areNearDuplicateUnfairAdvantages(
        'Built AI pipeline for production matching',
        'Built CI pipeline for production matching',
      ),
    ).toBe(false)
    expect(
      areNearDuplicateUnfairAdvantages(
        'Senior C++ platform systems depth',
        'Senior C# platform systems depth',
      ),
    ).toBe(false)
    expect(
      areNearDuplicateUnfairAdvantages(
        'Python data platform depth for regulated analytics',
        'Java data platform depth for regulated analytics',
      ),
    ).toBe(false)
    expect(
      areNearDuplicateUnfairAdvantages(
        'React frontend architecture for design systems',
        'Angular frontend architecture for design systems',
      ),
    ).toBe(false)
    expect(
      areNearDuplicateUnfairAdvantages(
        'C systems programming depth for infrastructure',
        'Java systems programming depth for infrastructure',
      ),
    ).toBe(false)
    expect(
      areNearDuplicateUnfairAdvantages(
        'R analytics depth for experimentation systems',
        'Python analytics depth for experimentation systems',
      ),
    ).toBe(false)
    expect(
      areNearDuplicateUnfairAdvantages(
        'Led A/B testing for user flows',
        'Led unit testing for user flows',
      ),
    ).toBe(false)
  })

  it('allows a specific technical detail to replace a generic duplicate', () => {
    expect(
      dedupeUnfairAdvantages([
        'Built scalable distributed systems',
        'Built scalable distributed systems in Go',
      ]),
    ).toEqual(['Built scalable distributed systems in Go'])
  })

  it('keeps short phrases conservative unless the token order matches', () => {
    expect(areNearDuplicateUnfairAdvantages('Deep security expertise', 'Security deep expertise')).toBe(
      false,
    )
    expect(areNearDuplicateUnfairAdvantages('Deep security expertise', 'deep security expertise')).toBe(
      true,
    )
    expect(areNearDuplicateUnfairAdvantages('to the', 'and of')).toBe(false)
    expect(areNearDuplicateUnfairAdvantages('', '')).toBe(false)
    expect(areNearDuplicateUnfairAdvantages('!!!', '???')).toBe(false)
  })

  it('enforces token-count and shared-token boundaries', () => {
    expect(areNearDuplicateUnfairAdvantages('Alpha beta gamma', 'Alpha beta gamma extra')).toBe(
      false,
    )
    expect(
      areNearDuplicateUnfairAdvantages(
        'Alpha beta gamma delta',
        'Alpha beta gamma delta extra',
      ),
    ).toBe(true)
    expect(
      areNearDuplicateUnfairAdvantages(
        'Platform reliability leadership across migrations',
        'Platform reliability evidence through audits',
      ),
    ).toBe(false)
  })

  it('drops blanks and keeps the longer duplicate as the sharper statement', () => {
    expect(
      dedupeUnfairAdvantages([
        '',
        'Platform depth',
        'Platform infrastructure depth plus product judgment',
        'Product-aware platform infrastructure depth',
        'Security enablement through incident-response operating models',
      ]),
    ).toEqual([
      'Platform depth',
      'Platform infrastructure depth plus product judgment',
      'Security enablement through incident-response operating models',
    ])
  })

  it('keeps the first duplicate when candidates have equal strength', () => {
    expect(
      dedupeUnfairAdvantages([
        'Platform reliability through migration proof',
        'Reliability platform through migration proof',
      ]),
    ).toEqual(['Platform reliability through migration proof'])
  })

  it('handles empty advantage lists', () => {
    expect(dedupeUnfairAdvantages([])).toEqual([])
    expect(getUniqueUnfairAdvantages([], [])).toEqual([])
  })

  it('filters generated advantages that duplicate existing saved advantages', () => {
    expect(
      getUniqueUnfairAdvantages(
        ['Customer deployment architecture evidence'],
        [
          'Customer-facing deployment architecture proof',
          'Security enablement through incident-response operating models',
        ],
      ),
    ).toEqual(['Security enablement through incident-response operating models'])
    expect(
      getUniqueUnfairAdvantages([], [
        'Platform infrastructure depth plus product judgment',
        'Product-aware platform infrastructure depth',
      ]),
    ).toEqual(['Platform infrastructure depth plus product judgment'])
  })
})
