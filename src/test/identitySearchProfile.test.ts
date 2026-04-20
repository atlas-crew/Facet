import { describe, expect, it } from 'vitest'
import { adaptIdentityToSearchProfile } from '../utils/identitySearchProfile'
import { cloneIdentityFixture } from './fixtures/identityFixture'

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
    identity.skills.groups[0]!.items = [{ name: 'Kubernetes', depth: 'architectural', tags: ['kubernetes'] }]

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
    identity.skills.groups[0]!.items = [{ name: 'Kubernetes', depth: 'strong', tags: ['kubernetes'] }]

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
})
