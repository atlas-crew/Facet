import { describe, expect, it } from 'vitest'
import { getSkillCategoryLabel, resolveCorrectedSkillProvenance } from '../utils/skillTaxonomy'

describe('skill taxonomy helpers', () => {
  it('keeps existing provenance when taxonomy details did not change', () => {
    expect(
      resolveCorrectedSkillProvenance({
        draftProvenance: 'inferred',
        currentProvenance: 'inferred',
        taxonomyDetailChanged: false,
      }),
    ).toBe('inferred')
  })

  it('marks unchanged-status taxonomy edits as corrected', () => {
    expect(
      resolveCorrectedSkillProvenance({
        draftProvenance: 'inferred',
        currentProvenance: 'inferred',
        taxonomyDetailChanged: true,
      }),
    ).toBe('corrected')
  })

  it('honors an explicitly changed provenance value', () => {
    expect(
      resolveCorrectedSkillProvenance({
        draftProvenance: 'claimed',
        currentProvenance: 'inferred',
        taxonomyDetailChanged: true,
      }),
    ).toBe('claimed')
  })

  it('clears provenance when no status is selected and taxonomy details did not change', () => {
    expect(
      resolveCorrectedSkillProvenance({
        draftProvenance: '',
        currentProvenance: undefined,
        taxonomyDetailChanged: false,
      }),
    ).toBeUndefined()
  })

  it('keeps provenance cleared when taxonomy details changed and status was explicitly cleared', () => {
    expect(
      resolveCorrectedSkillProvenance({
        draftProvenance: '',
        currentProvenance: 'inferred',
        taxonomyDetailChanged: true,
      }),
    ).toBeUndefined()
  })

  it('labels seeded categories while preserving custom category strings', () => {
    expect(getSkillCategoryLabel('operations-tools')).toBe('Operations & Tools')
    expect(getSkillCategoryLabel('enterprise-sales')).toBe('enterprise-sales')
    expect(getSkillCategoryLabel(undefined)).toBeUndefined()
    expect(getSkillCategoryLabel('')).toBeUndefined()
  })
})
