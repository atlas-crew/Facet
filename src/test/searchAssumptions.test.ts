import { describe, expect, it } from 'vitest'
import { normalizeSearchAssumptions } from '../utils/searchAssumptions'

describe('normalizeSearchAssumptions', () => {
  it('preserves text by default when no generated-text normalizer is supplied', () => {
    const emDash = '\u2014'

    expect(
      normalizeSearchAssumptions([
        {
          claim: `Remote${emDash}friendly roles are acceptable.`,
          source: 'inferred',
          rationale: `Location context${emDash}needs review.`,
          confidence: 'high',
          overridable: true,
        },
      ]),
    ).toEqual([
      expect.objectContaining({
        claim: `Remote${emDash}friendly roles are acceptable.`,
        rationale: `Location context${emDash}needs review.`,
      }),
    ])
  })

  it('applies a supplied generated-text normalizer to claim and rationale', () => {
    expect(
      normalizeSearchAssumptions(
        [
          {
            claim: 'Remote-friendly roles are acceptable.',
            source: 'inferred',
            rationale: 'Location context needs review.',
            confidence: 'high',
            overridable: true,
          },
        ],
        {
          normalizeText: (value) => value.replace('Remote-friendly', 'Remote'),
        },
      ),
    ).toEqual([
      expect.objectContaining({
        claim: 'Remote roles are acceptable.',
        rationale: 'Location context needs review.',
      }),
    ])
  })

  it('drops assumptions whose claim is emptied by a supplied normalizer', () => {
    const result = normalizeSearchAssumptions(
      [
        {
          claim: 'drop me',
          source: 'inferred',
          rationale: 'This should disappear with the claim.',
          confidence: 'high',
          overridable: true,
        },
        {
          claim: 'Keep this assumption.',
          source: 'inferred',
          rationale: 'drop me',
          confidence: 'medium',
          overridable: true,
        },
      ],
      {
        normalizeText: (value) => (value === 'drop me' ? '' : value),
      },
    )

    expect(result).toEqual([
      expect.objectContaining({
        claim: 'Keep this assumption.',
      }),
    ])
    expect(result[0]).not.toHaveProperty('rationale')
  })
})
