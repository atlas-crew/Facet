import { describe, expect, it } from 'vitest'
import { resolveIdentityEnrichmentNavTarget } from '../routes/identity/identityNavigation'
import { cloneIdentityFixture } from './fixtures/identityFixture'

describe('identity navigation helpers', () => {
  it('routes missing identities to the skill enrichment overview', () => {
    expect(resolveIdentityEnrichmentNavTarget(null)).toEqual({
      to: '/identity/enrich',
    })
    expect(resolveIdentityEnrichmentNavTarget(undefined)).toEqual({
      to: '/identity/enrich',
    })
  })

  it('routes to the next pending skill when one exists', () => {
    const identity = cloneIdentityFixture()
    identity.skills.groups[0]!.items = [
      {
        name: 'Kubernetes',
        tags: ['platform', 'kubernetes'],
        depth: 'strong',
      },
      {
        name: 'TypeScript',
        tags: ['backend', 'typescript'],
      },
    ]

    expect(resolveIdentityEnrichmentNavTarget(identity)).toEqual({
      to: '/identity/enrich/$groupId/$skillName',
      params: {
        groupId: 'platform',
        skillName: 'TypeScript',
      },
    })
  })

  it('routes to the overview when every skill is complete or skipped', () => {
    const identity = cloneIdentityFixture()
    identity.skills.groups[0]!.items = [
      {
        name: 'Kubernetes',
        tags: ['platform', 'kubernetes'],
        depth: 'strong',
      },
      {
        name: 'Terraform',
        tags: ['platform', 'iac'],
        skipped_at: '2026-04-08T00:00:00.000Z',
      },
    ]

    expect(resolveIdentityEnrichmentNavTarget(identity)).toEqual({
      to: '/identity/enrich',
    })
  })
})
