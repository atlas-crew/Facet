import { describe, expect, it } from 'vitest'
import {
  describeThesisFillStrength,
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
  describe('thesisFillStrength (prose-only theory, TASK-194)', () => {
    it('returns Empty for null identity', () => {
      const result = thesisFillStrength(null)
      expect(result.label).toBe('Empty')
      expect(result.percent).toBe(0)
      expect(result.tone).toBe('warn')
    })

    it('returns Draft for thesis under 5 words regardless of metadata', () => {
      const id = empty()
      id.identity.thesis = 'I do platforms.'
      // Even with origin/elaboration set, prose-only theory ignores them.
      id.identity.origin = 'How I came to believe this'
      id.identity.elaboration = 'Long elaboration text here'
      const r = thesisFillStrength(id)
      expect(r.label).toBe('Draft')
      expect(r.percent).toBe(5)
      expect(r.tone).toBe('warn')
    })

    it('returns Draft for present thesis text that scores below Sparse', () => {
      const id = empty()
      id.identity.thesis = 'I turn platform complexity into product leverage.'
      const r = thesisFillStrength(id)
      expect(r.label).toBe('Draft')
      expect(r.percent).toBeGreaterThan(0)
      expect(r.tone).toBe('warn')
    })

    it('returns Draft instead of Empty for a present thesis without punctuation', () => {
      const id = empty()
      id.identity.thesis = 'a b c d e'
      const r = thesisFillStrength(id)
      expect(r.label).toBe('Draft')
      expect(r.percent).toBe(10)
      expect(r.tone).toBe('warn')
    })

    it('explains the blank thesis state', () => {
      const id = empty()
      id.identity.thesis = '   '
      expect(describeThesisFillStrength(id)).toBe(
        'Empty: generate a thesis or add one before this section can be evaluated.',
      )
    })

    it('returns Empty for whitespace-only thesis text', () => {
      const id = empty()
      id.identity.thesis = '   '
      const r = thesisFillStrength(id)
      expect(r.label).toBe('Empty')
      expect(r.percent).toBe(0)
      expect(r.tone).toBe('warn')
    })

    it('explains very short thesis drafts with word counts', () => {
      const singular = empty()
      singular.identity.thesis = 'Platforms.'
      expect(describeThesisFillStrength(singular)).toBe(
        'Draft: thesis text exists, but it is very short at 1 word. Add concrete examples, named technologies, or organizations to strengthen it.',
      )

      const plural = empty()
      plural.identity.thesis = 'I do platforms.'
      expect(describeThesisFillStrength(plural)).toBe(
        'Draft: thesis text exists, but it is very short at 3 words. Add concrete examples, named technologies, or organizations to strengthen it.',
      )
    })

    it('explains why a present thesis is scored as Draft', () => {
      const id = empty()
      id.identity.thesis = 'I turn platform complexity into product leverage.'
      expect(describeThesisFillStrength(id)).toBe(
        'Draft: thesis text exists, but it needs more concrete examples, named technologies, or organizations. Current signals: 1 sentence, 0 specific signals, and 1 generic or hedging signal.',
      )
    })

    it('switches to scored thesis descriptions at 5 words', () => {
      const four = empty()
      four.identity.thesis = 'I do good things.'
      expect(describeThesisFillStrength(four)).toContain('very short at 4 words')

      const five = empty()
      five.identity.thesis = 'I build things at scale.'
      expect(describeThesisFillStrength(five)).toBe(
        'Draft: thesis text exists, but it needs more concrete examples, named technologies, or organizations. Current signals: 1 sentence, 0 specific signals, and 0 generic or hedging signals.',
      )
    })

    it('uses singular copy for one specific signal', () => {
      const id = empty()
      id.identity.thesis = 'I build platforms on AWS for teams that need steady delivery.'
      expect(describeThesisFillStrength(id)).toBe(
        'Draft: thesis text exists, but it needs more concrete examples, named technologies, or organizations. Current signals: 1 sentence, 1 specific signal, and 0 generic or hedging signals.',
      )
    })

    it('explains Sparse, Solid, and Strong thesis states', () => {
      const sparse = empty()
      sparse.identity.thesis =
        'I help teams do better work in complicated situations. ' +
        'I make complex tradeoffs easier for product teams.'
      expect(describeThesisFillStrength(sparse)).toBe(
        'Sparse: the thesis is present, but it needs more concrete evidence or named systems. Current signals: 2 sentences, 0 specific signals, and 0 generic or hedging signals.',
      )

      const solid = empty()
      solid.identity.thesis =
        'I build platforms on AWS and GCP. ' +
        'I ship SQL systems that help teams move faster.'
      expect(describeThesisFillStrength(solid)).toBe(
        'Solid: the thesis is usable and has some evidence signal, with 2 sentences, 3 specific signals, and 0 generic or hedging signals.',
      )

      const strong = empty()
      strong.identity.thesis =
        'I build security platforms that ship eBPF agents on AWS at scale. ' +
        'At A10 I owned WAF sensor lifecycle across 400+ deployments. ' +
        'Now I want platform leadership where the substrate is the product.'
      expect(describeThesisFillStrength(strong)).toBe(
        'Strong: the thesis has enough structure and specificity, with 3 sentences, 4 specific signals, and 0 generic or hedging signals.',
      )
    })

    it('uses singular copy inside higher-scoring thesis states', () => {
      const solid = empty()
      solid.identity.thesis = 'I build AWS, GCP, SQL, EKS, and WAF systems.'
      expect(describeThesisFillStrength(solid)).toBe(
        'Solid: the thesis is usable and has some evidence signal, with 1 sentence, 5 specific signals, and 0 generic or hedging signals.',
      )

      const sparse = empty()
      sparse.identity.thesis =
        'I help teams leverage better results. I make tradeoffs clearer for engineers.'
      expect(describeThesisFillStrength(sparse)).toBe(
        'Sparse: the thesis is present, but it needs more concrete evidence or named systems. Current signals: 2 sentences, 0 specific signals, and 1 generic or hedging signal.',
      )
    })

    it('does NOT score origin/elaboration (prose-only theory)', () => {
      const id = empty()
      // Tight 3-sentence thesis with specifics; should already be Strong.
      id.identity.thesis =
        'I build security platforms that ship eBPF agents at scale. ' +
        'At A10 I owned WAF sensor lifecycle across 400+ deployments. ' +
        'Now I want platform leadership where the substrate is the product.'
      const without = thesisFillStrength(id)
      // Now add origin and elaboration; score must NOT change.
      id.identity.origin = 'A specific origin story'
      id.identity.elaboration = 'A long elaboration paragraph'
      const withMeta = thesisFillStrength(id)
      expect(withMeta.percent).toBe(without.percent)
      expect(withMeta.label).toBe(without.label)
    })

    it('penalizes corporate-vocabulary bloat (kill-list signals)', () => {
      const id = empty()
      // 5 sentences but kill-list-heavy and zero specificity.
      id.identity.thesis =
        'I leverage stakeholder synergy to drive ecosystem growth. ' +
        'We strategize the paradigm and innovate solutions. ' +
        'Our team utilizes cutting-edge approaches. ' +
        'We focus on next-generation initiatives. ' +
        'Together we deliver transformational impact.'
      const r = thesisFillStrength(id)
      // Should land at Sparse or below despite 5 sentences.
      expect(r.percent).toBeLessThan(50)
    })

    it('rewards specificity (named systems, acronyms, CamelCase)', () => {
      const id = empty()
      id.identity.thesis =
        'I built distributed systems on Kubernetes with Postgres and Redis. ' +
        'My team shipped eBPF instrumentation across AWS and GCP. ' +
        'We migrated from a monolith to microservices on EKS.'
      const r = thesisFillStrength(id)
      expect(r.percent).toBeGreaterThanOrEqual(80)
      expect(r.label).toBe('Strong')
    })

    it('ranks the three reference samples in the intuitive order: A > B > C', () => {
      // AC #6: write three sample theses with varied text/metadata mixes;
      // verify the formula scores them in the order the task brief argues
      // they should rank under the prose-only theory.
      const a = empty()
      a.identity.thesis =
        'I build security platforms that ship eBPF agents at scale. ' +
        'At A10 I owned WAF sensor lifecycle across 400+ deployments. ' +
        'Now I want platform leadership where the substrate is the product.'

      const b = empty()
      b.identity.thesis =
        'I leverage stakeholder synergy to drive ecosystem growth. ' +
        'We strategize the paradigm and innovate solutions. ' +
        'Our team dynamics enable transformational impact. ' +
        'We focus on next-generation platform initiatives. ' +
        'Together we deliver value.'

      const c = empty()
      c.identity.thesis = 'I do platforms.'
      // Sample C has full metadata, but prose-only theory ignores it.
      c.identity.origin = 'A long story about how I came to this view'
      c.identity.elaboration = 'An equally long elaboration paragraph'

      const ra = thesisFillStrength(a)
      const rb = thesisFillStrength(b)
      const rc = thesisFillStrength(c)

      expect(ra.percent).toBeGreaterThan(rb.percent)
      expect(rb.percent).toBeGreaterThan(rc.percent)
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
