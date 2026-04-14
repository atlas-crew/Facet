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
})
