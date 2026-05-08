import { describe, expect, it } from 'vitest'
import { adaptIdentityToSearchProfile } from '../utils/identitySearchProfile'
import { cloneIdentityFixture } from './fixtures/identityFixture'
import type { SearchIndustry } from '../types/search'

// @ts-expect-error Compile-time guard: custom industry strings must not typecheck.
const invalidIndustry: SearchIndustry = 'general-tech'
void invalidIndustry

describe('identitySearchProfile', () => {
  it('does not infer depth from word-boundary false positives', () => {
    const identity = cloneIdentityFixture()
    identity.skills.groups[0]!.items = [{ name: 'Rust', tags: ['rust'] }]
    identity.roles[0]!.bullets = [
      {
        id: 'trust-controls',
        problem: 'Incident response lacked customer trust controls.',
        action: 'Built trust dashboards and disclosure workflows.',
        outcome: 'Improved trust posture for enterprise buyers.',
        impact: [],
        metrics: {},
        technologies: [],
        tags: [],
      },
    ]
    identity.projects = []
    identity.profiles = []
    identity.search_vectors = []

    const profile = adaptIdentityToSearchProfile(identity)
    expect(profile.skills[0]?.depth).toBe('basic')
  })

  it('infers depth from regex-escaped aliases in free text', () => {
    const identity = cloneIdentityFixture()
    identity.skills.groups[0]!.items = [{ name: 'Node.js', tags: ['node.js'] }]
    identity.roles[0]!.bullets = [
      {
        id: 'node-service',
        problem: 'Internal tooling needed a shared service runtime.',
        action: 'Built the Node.js service layer for release automation.',
        outcome: 'Gave teams a repeatable automation path.',
        impact: [],
        metrics: {},
        technologies: [],
        tags: [],
      },
    ]
    identity.projects = [
      {
        id: 'node-tooling',
        name: 'Release Tooling',
        description: 'Extended Node.js automation for deployment previews.',
        tags: [],
      },
    ]
    identity.profiles = []
    identity.search_vectors = []

    const profile = adaptIdentityToSearchProfile(identity)
    expect(profile.skills[0]?.depth).toBe('working')
  })

  it('excludes generic skill terms from inferred depth scoring', () => {
    const identity = cloneIdentityFixture()
    identity.skills.groups[0]!.label = 'Engineering'
    identity.skills.groups[0]!.items = [
      { name: 'Backend', tags: ['backend'] },
      { name: 'Security', tags: ['security'] },
    ]
    identity.roles[0]!.bullets = [
      {
        id: 'generic-scope',
        problem: 'Backend security services needed architecture reviews.',
        action: 'Led backend security architecture and platform hardening.',
        outcome: 'Improved backend security system reliability.',
        impact: [],
        metrics: {},
        technologies: [],
        tags: [],
      },
    ]
    identity.projects = [
      {
        id: 'generic-project',
        name: 'Backend Security Review',
        description: 'Reviewed backend security architecture and services.',
        tags: [],
      },
    ]
    identity.profiles = [
      {
        id: 'generic-profile',
        tags: [],
        text: 'Backend security platform work across services and systems.',
      },
    ]
    identity.search_vectors = [
      {
        id: 'generic-vector',
        priority: 'medium',
        title: 'Backend Security',
        subtitle: 'Backend security platform systems',
        thesis: 'Focus on backend security architecture.',
        keywords: {
          primary: ['backend', 'security'],
          secondary: ['services', 'systems'],
        },
        target_roles: [],
        supporting_skills: [],
        evidence: ['Backend security services and systems.'],
      },
    ]

    const profile = adaptIdentityToSearchProfile(identity)
    expect(profile.skills.map((skill) => [skill.name, skill.depth])).toEqual([
      ['Backend', 'basic'],
      ['Security', 'basic'],
    ])
  })

  it('infers strong depth from direct role-technology evidence', () => {
    const identity = cloneIdentityFixture()
    identity.skills.groups[0]!.items = [{ name: 'Kubernetes', tags: ['kubernetes'] }]
    identity.roles[0]!.bullets = [
      {
        id: 'runtime-port',
        problem: 'Customer deployments needed a portable runtime.',
        action: 'Ported deployment workflows to a container platform.',
        outcome: 'Unlocked customer-hosted installs.',
        impact: [],
        metrics: {},
        technologies: ['Kubernetes'],
        tags: [],
      },
    ]
    identity.projects = []
    identity.profiles = []
    identity.search_vectors = []

    const profile = adaptIdentityToSearchProfile(identity)
    expect(profile.skills[0]?.depth).toBe('strong')
  })

  it('infers strong depth from the score threshold without direct role technology evidence', () => {
    const identity = cloneIdentityFixture()
    identity.skills.groups[0]!.items = [{ name: 'Terraform', tags: ['terraform'] }]
    identity.roles[0]!.bullets = [
      {
        id: 'tagged-infra',
        problem: 'Infrastructure modules were inconsistent across teams.',
        action: 'Standardized deployment modules and review workflows.',
        outcome: 'Reduced release setup time.',
        impact: [],
        metrics: {},
        technologies: [],
        tags: ['terraform'],
      },
    ]
    identity.projects = [
      {
        id: 'module-catalog',
        name: 'Module Catalog',
        description: 'Cataloged reusable infrastructure modules.',
        tags: ['terraform'],
      },
    ]
    identity.profiles = []
    identity.search_vectors = []

    const profile = adaptIdentityToSearchProfile(identity)
    expect(profile.skills[0]?.depth).toBe('strong')
  })

  it('falls back to basic depth when evidence does not meet inference thresholds', () => {
    const identity = cloneIdentityFixture()
    identity.skills.groups[0]!.items = [{ name: 'GraphQL', tags: ['graphql'] }]
    identity.roles[0]!.bullets = []
    identity.projects = []
    identity.profiles = []
    identity.search_vectors = []

    const profile = adaptIdentityToSearchProfile(identity)
    expect(profile.skills[0]?.depth).toBe('basic')
  })

  it('uses lighter identity evidence to infer a working depth', () => {
    const identity = cloneIdentityFixture()
    identity.skills.groups[0]!.items = [{ name: 'Terraform', tags: ['terraform'] }]
    identity.roles[0]!.bullets = []
    identity.projects = [
      {
        id: 'terraform-catalog',
        name: 'Terraform Module Catalog',
        description: 'Built a Terraform module catalog and onboarding docs for platform teams.',
        tags: ['terraform'],
      },
    ]

    const profile = adaptIdentityToSearchProfile(identity)
    expect(profile.skills[0]?.depth).toBe('working')
  })

  it('passes through explicit expert depth from identity', () => {
    const identity = cloneIdentityFixture()
    identity.skills.groups[0]!.items = [{ name: 'Python', depth: 'expert', tags: ['python'] }]

    const profile = adaptIdentityToSearchProfile(identity)
    expect(profile.skills[0]?.depth).toBe('expert')
  })

  it('passes through explicit hands-on-working depth from identity', () => {
    const identity = cloneIdentityFixture()
    identity.skills.groups[0]!.items = [{ name: 'Rust', depth: 'hands-on-working', tags: ['rust'] }]

    const profile = adaptIdentityToSearchProfile(identity)
    expect(profile.skills[0]?.depth).toBe('hands-on-working')
  })

  it('passes through explicit architectural depth from identity', () => {
    const identity = cloneIdentityFixture()
    identity.skills.groups[0]!.items = [
      { name: 'Kubernetes', depth: 'architectural', tags: ['kubernetes'] },
    ]

    const profile = adaptIdentityToSearchProfile(identity)
    expect(profile.skills[0]?.depth).toBe('architectural')
  })

  it('passes through explicit conceptual depth from identity', () => {
    const identity = cloneIdentityFixture()
    identity.skills.groups[0]!.items = [{ name: 'Go', depth: 'conceptual', tags: ['go'] }]

    const profile = adaptIdentityToSearchProfile(identity)
    expect(profile.skills[0]?.depth).toBe('conceptual')
  })

  it('passes through explicit avoid depth from identity', () => {
    const identity = cloneIdentityFixture()
    identity.skills.groups[0]!.items = [{ name: 'Jenkins', depth: 'avoid', tags: ['jenkins'] }]

    const profile = adaptIdentityToSearchProfile(identity)
    expect(profile.skills[0]?.depth).toBe('avoid')
  })

  it('includes calibration from skill groups in the adapted profile context', () => {
    const identity = cloneIdentityFixture()
    identity.skills.groups[0]!.calibration = 'Not a K8s admin. Builds platforms around it.'
    identity.skills.groups[0]!.items = [
      { name: 'Kubernetes', depth: 'strong', tags: ['kubernetes'] },
    ]

    const profile = adaptIdentityToSearchProfile(identity)
    expect(profile.skills[0]?.depth).toBe('strong')
  })

  it('includes filter conditions in adapted profile filters', () => {
    const identity = cloneIdentityFixture()
    identity.preferences.matching.avoid = [
      {
        id: 'k8s-admin',
        label: 'Kubernetes admin roles',
        description: 'Do not want to be the K8s person',
        severity: 'conditional',
        condition: 'building around k8s is fine, being a k8s admin is not',
      },
    ]

    const profile = adaptIdentityToSearchProfile(identity)
    expect(profile.filters.avoid).toContain('Kubernetes admin roles')
  })

  it('mirrors identity constraint banks and work model preference into search constraints', () => {
    const identity = cloneIdentityFixture()
    identity.preferences.constraints = {
      ...identity.preferences.constraints,
      industries_to_avoid: ['adtech', 'predatory-lending'],
      funding_stages_acceptable: ['seed', 'series-a', 'profitable-private'],
      employment_types: ['w2-fulltime', 'either-acceptable'],
    }
    identity.preferences.work_model.preference = 'hybrid'

    const profile = adaptIdentityToSearchProfile(identity)

    expect(profile.constraints.industriesToAvoid).toEqual(['adtech', 'predatory-lending'])
    expect(profile.constraints.fundingStagesAcceptable).toEqual([
      'seed',
      'series-a',
      'profitable-private',
    ])
    expect(profile.constraints.remotePolicies).toEqual(['hybrid'])
    expect(profile.constraints.employmentTypes).toEqual(['w2-fulltime', 'either-acceptable'])
  })

  it('maps legacy remote work model preference to the search remote-friendly policy', () => {
    const identity = cloneIdentityFixture()
    identity.preferences.work_model.preference = 'remote'

    const profile = adaptIdentityToSearchProfile(identity)

    expect(profile.constraints.remotePolicies).toEqual(['remote-friendly'])
  })

  it('maps free-form work model preferences by policy keywords', () => {
    const identity = cloneIdentityFixture()
    identity.preferences.work_model.preference = 'Fully remote, US time zones preferred'

    const profile = adaptIdentityToSearchProfile(identity)

    expect(profile.constraints.remotePolicies).toEqual(['remote-friendly'])
    expect(profile.constraints.remotePolicyNote).toBe('Fully remote, US time zones preferred')
  })

  it('preserves unmapped free-form work model preferences as a search constraint note', () => {
    const identity = cloneIdentityFixture()
    identity.preferences.work_model.preference = 'Distributed team with quarterly retreats'

    const profile = adaptIdentityToSearchProfile(identity)

    expect(profile.constraints.remotePolicies).toEqual([])
    expect(profile.constraints.remotePolicyNote).toBe('Distributed team with quarterly retreats')
  })
})
