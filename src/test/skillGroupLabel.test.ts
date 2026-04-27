import { describe, expect, it } from 'vitest'
import { displaySkillGroupLabel, isGenericSkillGroupLabel } from '../utils/identityEnrichment'

describe('isGenericSkillGroupLabel', () => {
  it('flags Skills N patterns regardless of casing or spacing', () => {
    expect(isGenericSkillGroupLabel('Skills 5')).toBe(true)
    expect(isGenericSkillGroupLabel('skills 12')).toBe(true)
    expect(isGenericSkillGroupLabel('SKILL 1')).toBe(true)
    expect(isGenericSkillGroupLabel('Skills5')).toBe(true)
    expect(isGenericSkillGroupLabel('  skill 7  ')).toBe(true)
  })

  it('flags Also as a generic fallback bucket', () => {
    expect(isGenericSkillGroupLabel('Also')).toBe(true)
    expect(isGenericSkillGroupLabel('also')).toBe(true)
    expect(isGenericSkillGroupLabel('  ALSO ')).toBe(true)
  })

  it('does not flag user-authored labels', () => {
    expect(isGenericSkillGroupLabel('Languages')).toBe(false)
    expect(isGenericSkillGroupLabel('Infrastructure & Cloud')).toBe(false)
    expect(isGenericSkillGroupLabel('Platform Engineering')).toBe(false)
  })

  it('does not match Skills with no number (e.g. the band header collision is not the same pattern)', () => {
    expect(isGenericSkillGroupLabel('Skills')).toBe(false)
  })
})

describe('displaySkillGroupLabel', () => {
  it('rewrites Skills N to a non-colliding placeholder that preserves the index', () => {
    expect(displaySkillGroupLabel('Skills 5')).toBe('Unnamed group · #5')
    expect(displaySkillGroupLabel('skill 12')).toBe('Unnamed group · #12')
  })

  it('rewrites Also to Uncategorized', () => {
    expect(displaySkillGroupLabel('Also')).toBe('Uncategorized')
    expect(displaySkillGroupLabel('also')).toBe('Uncategorized')
  })

  it('returns user-authored labels untouched (trimmed)', () => {
    expect(displaySkillGroupLabel('Languages')).toBe('Languages')
    expect(displaySkillGroupLabel('  Infrastructure & Cloud  ')).toBe('Infrastructure & Cloud')
  })

  it('falls back to a placeholder for empty labels', () => {
    expect(displaySkillGroupLabel('')).toBe('(no label)')
    expect(displaySkillGroupLabel('   ')).toBe('(no label)')
  })
})
