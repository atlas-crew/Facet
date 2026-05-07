import { describe, expect, it } from 'vitest'
import { adaptIdentityToSearchProfile } from '../utils/identitySearchProfile'
import { cloneIdentityFixture } from './fixtures/identityFixture'
import type { SearchIndustry } from '../types/search'

// @ts-expect-error Compile-time guard: custom industry strings must not typecheck.
const invalidIndustry: SearchIndustry = 'general-tech'
void invalidIndustry

describe('identitySearchProfile', () => {
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
