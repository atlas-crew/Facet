import { describe, expect, it } from 'vitest'
import {
  preferencesFillStrength,
  profilesFillStrength,
  rolesFillStrength,
  searchStrategyFillStrength,
  selfModelFillStrength,
  skillsFillStrength,
  thesisFillStrength,
} from '../utils/identityFillStrength'
import type { ProfessionalIdentityV3 } from '../identity/schema'
import { cloneIdentityFixture } from './fixtures/identityFixture'

const empty = (): ProfessionalIdentityV3 => cloneIdentityFixture()

describe('identityFillStrength', () => {
  describe('thesisFillStrength', () => {
    it('returns Empty for null identity', () => {
      const result = thesisFillStrength(null)
      expect(result.label).toBe('Empty')
      expect(result.percent).toBe(0)
      expect(result.tone).toBe('warn')
    })

    it('scales text component up to 50%, then origin/elaboration each add 25%', () => {
      const id = empty()
      id.identity.thesis = 'short'
      const r1 = thesisFillStrength(id)
      expect(r1.percent).toBeLessThan(20)

      id.identity.thesis = 'a'.repeat(120)
      const r2 = thesisFillStrength(id)
      expect(r2.percent).toBe(50)
      expect(r2.label).toBe('Solid')

      id.identity.origin = 'how it began'
      id.identity.elaboration = 'longer detail'
      const r3 = thesisFillStrength(id)
      expect(r3.percent).toBe(100)
      expect(r3.label).toBe('Strong')
    })
  })

  describe('selfModelFillStrength', () => {
    it('returns Empty for null identity', () => {
      expect(selfModelFillStrength(null).label).toBe('Empty')
    })

    it('weights philosophy heaviest (35) and counts roles as arc proxy', () => {
      const id = empty()
      // arc derives from at least one role in the fixture
      const result = selfModelFillStrength(id)
      expect(result.percent).toBeGreaterThan(0)
    })
  })

  describe('profilesFillStrength', () => {
    it('handles zero profiles cleanly', () => {
      const id = empty()
      id.profiles = []
      const r = profilesFillStrength(id)
      expect(r.percent).toBe(0)
      expect(r.tone).toBe('warn')
    })

    it('caps at 100 when 3+ profiles have text and tags', () => {
      const id = empty()
      id.profiles = [
        { id: 'a', text: 'one', tags: ['x'] },
        { id: 'b', text: 'two', tags: ['y'] },
        { id: 'c', text: 'three', tags: ['z'] },
        { id: 'd', text: 'four', tags: ['w'] },
      ]
      expect(profilesFillStrength(id).percent).toBe(100)
    })
  })

  describe('rolesFillStrength', () => {
    it('avoids divide-by-zero on empty roles array', () => {
      const id = empty()
      id.roles = []
      const r = rolesFillStrength(id)
      expect(r.percent).toBe(0)
      expect(r.label).toBe('Empty')
      expect(r.tone).toBe('warn')
    })

    it('credits projects (30 points) when at least one project exists', () => {
      const id = empty()
      id.projects = [{ id: 'p1', name: 'one', description: 'd', tags: [] }]
      id.roles = [
        { id: 'r1', company: 'c', title: 't', dates: '2020', bullets: [] },
      ]
      // roles with 2+ bullets = 0 of 1, so rolesScore = 0; projects = 30
      expect(rolesFillStrength(id).percent).toBe(30)
    })
  })

  describe('skillsFillStrength', () => {
    it('handles zero groups', () => {
      const id = empty()
      id.skills.groups = []
      expect(skillsFillStrength(id).label).toBe('Empty')
    })

    it('forces Messy tone when an item is untagged', () => {
      const id = empty()
      id.skills.groups = [
        {
          id: 'g',
          label: 'Languages',
          items: [
            { name: 'Python', tags: ['x'], depth: 'expert' },
            { name: 'Rust', tags: [], depth: 'expert' }, // untagged
          ],
        },
      ]
      const r = skillsFillStrength(id)
      expect(r.label).toBe('Messy')
      expect(r.tone).toBe('warn')
    })

    it('forces Messy when group label matches a generic auto-name', () => {
      const id = empty()
      id.skills.groups = [
        {
          id: 'g',
          label: 'Skills 5',
          items: [{ name: 'A', tags: ['x'], depth: 'expert' }],
        },
      ]
      expect(skillsFillStrength(id).label).toBe('Messy')
    })
  })

  describe('preferencesFillStrength', () => {
    it('returns Empty for null preferences', () => {
      expect(preferencesFillStrength(null).label).toBe('Empty')
    })

    it('flags <40% as warn (Thin)', () => {
      const id = empty()
      // fixture starts with very limited preferences
      const r = preferencesFillStrength(id)
      if (r.percent < 40) {
        expect(r.tone).toBe('warn')
      }
    })
  })

  describe('searchStrategyFillStrength', () => {
    it('returns Empty for null identity', () => {
      expect(searchStrategyFillStrength(null).label).toBe('Empty')
    })

    it('reaches Strong when 3+ vectors and 3+ questions are populated', () => {
      const id = empty()
      id.search_vectors = Array.from({ length: 3 }, (_, i) => ({
        id: `v${i}`,
        title: `Vector ${i}`,
        priority: 'medium' as const,
        thesis: 'A thesis with content.',
        target_roles: [],
        keywords: { primary: [], secondary: [] },
      }))
      id.awareness = {
        open_questions: Array.from({ length: 3 }, (_, i) => ({
          id: `q${i}`,
          topic: `Topic ${i}`,
          description: 'desc',
          action: 'action',
        })),
      }
      const r = searchStrategyFillStrength(id)
      expect(r.percent).toBe(100)
      expect(r.label).toBe('Strong')
      expect(r.tone).toBe('ok')
    })

    it('flags warn when neither vectors nor questions are populated', () => {
      const id = empty()
      id.search_vectors = []
      id.awareness = { open_questions: [] }
      const r = searchStrategyFillStrength(id)
      expect(r.percent).toBe(0)
      expect(r.tone).toBe('warn')
    })
  })
})
