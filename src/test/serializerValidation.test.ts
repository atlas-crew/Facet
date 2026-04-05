/* eslint-disable @typescript-eslint/no-explicit-any -- intentional invalid-shape casts for validation tests */
import { describe, expect, it } from 'vitest'
import { importResumeConfig } from '../engine/serializer'
import { defaultResumeData } from '../store/defaultData'

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T

describe('serializer validation matrix', () => {
  const baseData = clone(defaultResumeData)

  it('accepts valid default data', () => {
    expect(() => importResumeConfig(JSON.stringify(baseData))).not.toThrow()
  })

  it('rejects malformed JSON', () => {
    expect(() => importResumeConfig('{ "version": 1, ')).toThrow(/Failed to parse JSON/)
  })

  it('rejects non-object root', () => {
    expect(() => importResumeConfig('["not", "an", "object"]')).toThrow(/Resume data must be an object/)
  })

  describe('nested field presence', () => {
    it('precondition: defaultResumeData has required elements', () => {
      expect(baseData.roles.length).toBeGreaterThan(0)
      expect(baseData.roles[0].bullets.length).toBeGreaterThan(0)
      expect(baseData.projects.length).toBeGreaterThan(0)
      expect(baseData.vectors.length).toBeGreaterThan(0)
      expect(baseData.education.length).toBeGreaterThan(0)
      expect(baseData.skill_groups.length).toBeGreaterThan(0)
      expect(baseData.target_lines.length).toBeGreaterThan(0)
    })

    it('rejects roles missing company', () => {
      const data = clone(baseData)
      delete (data.roles[0] as any).company
      expect(() => importResumeConfig(JSON.stringify(data))).toThrow(/roles\[0\].company must be a string/)
    })

    it('rejects bullets missing id', () => {
      const data = clone(baseData)
      delete (data.roles[0].bullets[0] as any).id
      expect(() => importResumeConfig(JSON.stringify(data))).toThrow(/roles\[0\].bullets\[0\].id must be a string/)
    })

    it('rejects projects missing name', () => {
      const data = clone(baseData)
      delete (data.projects[0] as any).name
      expect(() => importResumeConfig(JSON.stringify(data))).toThrow(/projects\[0\].name must be a string/)
    })

    it('rejects vectors missing color', () => {
      const data = clone(baseData)
      delete (data.vectors[0] as any).color
      expect(() => importResumeConfig(JSON.stringify(data))).toThrow(/vectors\[0\].color must be a string/)
    })

    it('rejects education missing degree', () => {
      const data = clone(baseData)
      delete (data.education[0] as any).degree
      expect(() => importResumeConfig(JSON.stringify(data))).toThrow(/education\[0\].degree must be a string/)
    })
  })

  describe('value type constraints', () => {
    it('rejects invalid skill order value (non-number)', () => {
      const data = clone(baseData)
      data.skill_groups[0].order = { backend: 'one' as any }
      expect(() => importResumeConfig(JSON.stringify(data))).toThrow(/skill_groups\[0\].order.backend must be a number/)
    })

    it('rejects invalid vector priority value', () => {
      const data = clone(baseData)
      data.target_lines[0].vectors.backend = 123 as any
      expect(() => importResumeConfig(JSON.stringify(data))).toThrow(/target_lines\[0\].vectors.backend must be one of/)
    })

    it('rejects non-boolean manual override value', () => {
      const data = clone(baseData)
      data.manualOverrides = { backend: { b1: 'yes' as any } }
      expect(() => importResumeConfig(JSON.stringify(data))).toThrow(/manualOverrides.backend.b1 must be a boolean/)
    })
  })

  describe('logical constraints', () => {
    it('rejects roles array with no bullets across all roles', () => {
      const data = clone(baseData)
      data.roles = data.roles.map(r => ({ ...r, bullets: [] }))
      expect(() => importResumeConfig(JSON.stringify(data))).toThrow(/at least one bullet/)
    })

    it('accepts single role with no bullets if another role HAS bullets', () => {
      const data = clone(baseData)
      // Add a role with no bullets
      data.roles.push({
        id: 'empty-role',
        company: 'Empty',
        title: 'T',
        dates: 'D',
        vectors: {},
        bullets: []
      })
      expect(() => importResumeConfig(JSON.stringify(data))).not.toThrow()
    })
  })
})
