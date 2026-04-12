import { describe, expect, it } from 'vitest'
import { cloneIdentityFixture } from './fixtures/identityFixture'
import {
  findNextPendingIdentitySkill,
  getIdentityEnrichmentProgress,
  getSkillEnrichmentStatus,
  listIdentityEnrichmentSkills,
  resolveIdentityEnrichmentSkill,
} from '../utils/identityEnrichment'

const createIdentity = () => {
  const identity = cloneIdentityFixture()
  identity.skills.groups = [
    {
      id: 'platform',
      label: 'Platform',
      items: [
        {
          name: 'Kubernetes',
          depth: 'strong',
          context: 'Used for on-prem and hosted platform delivery.',
          positioning: 'Platform and infrastructure modernization.',
          tags: ['platform', 'kubernetes'],
        },
        {
          name: 'Terraform',
          tags: ['platform', 'iac'],
          skipped_at: '2026-04-08T00:00:00.000Z',
        },
      ],
    },
    {
      id: 'backend',
      label: 'Backend',
      items: [
        {
          name: 'TypeScript',
          tags: ['backend', 'typescript'],
        },
      ],
    },
  ]
  return identity
}

describe('identityEnrichment helpers', () => {
  it('classifies pending, complete, and skipped skills', () => {
    expect(
      getSkillEnrichmentStatus({
        depth: 'strong',
        context: 'Built platform systems.',
        positioning: 'Platform engineering',
        skipped_at: '2026-04-08T00:00:00.000Z',
      }),
    ).toBe('complete')
    expect(
      getSkillEnrichmentStatus({
        depth: undefined,
        context: '',
        positioning: '',
        skipped_at: '2026-04-08T00:00:00.000Z',
      }),
    ).toBe('skipped')
    expect(
      getSkillEnrichmentStatus({
        depth: 'working',
        context: '',
        positioning: '',
        skipped_at: undefined,
      }),
    ).toBe('pending')
  })

  it('computes progress counts from the current identity', () => {
    const progress = getIdentityEnrichmentProgress(createIdentity())
    expect(progress).toEqual({
      total: 3,
      pending: 1,
      skipped: 1,
      complete: 1,
    })
  })

  it('finds the next pending skill after the current skill and wraps when needed', () => {
    const identity = createIdentity()
    expect(findNextPendingIdentitySkill(identity)).toMatchObject({
      groupId: 'backend',
      skillName: 'TypeScript',
    })
    expect(
      findNextPendingIdentitySkill(identity, {
        groupId: 'platform',
        skillName: 'Terraform',
      }),
    ).toMatchObject({
      groupId: 'backend',
      skillName: 'TypeScript',
    })
    expect(
      findNextPendingIdentitySkill(identity, {
        groupId: 'backend',
        skillName: 'TypeScript',
      }),
    ).toMatchObject({
      groupId: 'backend',
      skillName: 'TypeScript',
    })
  })

  it('lists and resolves skills by group id and skill name', () => {
    const identity = createIdentity()
    const skills = listIdentityEnrichmentSkills(identity)
    expect(skills).toHaveLength(3)
    expect(resolveIdentityEnrichmentSkill(identity, 'platform', 'Kubernetes')).toMatchObject({
      groupId: 'platform',
      skillName: 'Kubernetes',
      groupLabel: 'Platform',
      status: 'complete',
    })
  })
})
