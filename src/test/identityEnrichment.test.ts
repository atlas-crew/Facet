import { describe, expect, it } from 'vitest'
import { cloneIdentityFixture } from './fixtures/identityFixture'
import {
  applySkillEnrichmentSuggestion,
  findNextPendingIdentitySkill,
  getIdentityEnrichmentProgress,
  getSkillEnrichmentStatus,
  hasSkillEnrichmentData,
  listIdentityEnrichmentSkills,
  resolveIdentityEnrichmentSkill,
  resolveIdentityMapSkillDraftSelection,
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
        context: '',
        positioning: '',
        skipped_at: '2026-04-08T00:00:00.000Z',
      }),
    ).toBe('skipped')
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
    ).toBe('complete')
  })

  it('detects whether a skill has enrichment data', () => {
    expect(hasSkillEnrichmentData({})).toBe(false)
    expect(hasSkillEnrichmentData({ depth: 'strong' })).toBe(true)
    expect(hasSkillEnrichmentData({ context: 'Evidence note.' })).toBe(true)
    expect(hasSkillEnrichmentData({ positioning: 'Positioning note.' })).toBe(true)
    expect(hasSkillEnrichmentData({ enriched_at: '2026-05-30T00:00:00.000Z' })).toBe(true)
    expect(hasSkillEnrichmentData({ enriched_by: 'user' })).toBe(true)
    expect(hasSkillEnrichmentData({ skipped_at: '2026-05-30T00:00:00.000Z' })).toBe(
      true,
    )
    expect(
      hasSkillEnrichmentData({
        context: '   ',
        positioning: '',
        enriched_at: ' ',
        skipped_at: '',
      }),
    ).toBe(false)
  })

  it('applies accepted AI skill enrichment suggestions as reviewed identity data', () => {
    expect(
      applySkillEnrichmentSuggestion(
        {
          name: 'Ansible',
          tags: ['automation', 'ansible'],
          depth: 'working',
          depthConfidence: 'low',
          context: 'Existing context.',
          context_stale: true,
          positioning: 'Existing positioning.',
          positioning_stale: true,
          skipped_at: '2026-04-08T00:00:00.000Z',
        },
        {
          depth: 'expert',
          depthConfidence: 'medium',
          context: '  Authors custom modules and plugins in Python.  ',
          positioning: '  Lead with it when automation depth matters.  ',
        },
        '2026-06-02T12:00:00.000Z',
      ),
    ).toMatchObject({
      name: 'Ansible',
      depth: 'expert',
      depthSource: 'corrected',
      depthConfidence: 'medium',
      context: 'Authors custom modules and plugins in Python.',
      context_stale: undefined,
      positioning: 'Lead with it when automation depth matters.',
      positioning_stale: undefined,
      enriched_at: '2026-06-02T12:00:00.000Z',
      enriched_by: 'llm-accepted',
      skipped_at: undefined,
    })
  })

  it('preserves existing confidence only when an accepted suggestion keeps the same depth', () => {
    const sameDepth = applySkillEnrichmentSuggestion(
      {
        name: 'Kubernetes',
        tags: ['platform', 'kubernetes'],
        depth: 'strong',
        depthConfidence: 'high',
      },
      {
        depth: 'strong',
        context: 'Uses Kubernetes for embedded delivery.',
        positioning: 'Mention when relevant.',
      },
      '2026-06-02T12:00:00.000Z',
    )

    expect(sameDepth).toMatchObject({
      depth: 'strong',
      depthConfidence: 'high',
      context: 'Uses Kubernetes for embedded delivery.',
      positioning: 'Mention when relevant.',
      enriched_at: '2026-06-02T12:00:00.000Z',
      enriched_by: 'llm-accepted',
    })
    expect(sameDepth.depthSource).toBe('corrected')

    expect(
      applySkillEnrichmentSuggestion(
        {
          name: 'Terraform',
          tags: ['platform', 'iac'],
          depth: 'working',
          depthConfidence: 'high',
        },
        {
          depth: 'strong',
          context: 'Owns infrastructure-as-code delivery.',
          positioning: 'Mention for platform roles.',
        },
        '2026-06-02T12:00:00.000Z',
      ).depthConfidence,
    ).toBeUndefined()
  })

  it('removes blank accepted context and positioning suggestions', () => {
    const next = applySkillEnrichmentSuggestion(
      {
        name: 'TypeScript',
        tags: ['backend', 'typescript'],
        context: 'Existing context.',
        positioning: 'Existing positioning.',
      },
      {
        depth: 'strong',
        context: '   ',
        positioning: '',
      },
      '2026-06-02T12:00:00.000Z',
    )

    expect(next.context).toBeUndefined()
    expect(next.positioning).toBeUndefined()
    expect(next.enriched_by).toBe('llm-accepted')
  })

  it('uses a generated timestamp when accepted AI skill enrichment omits editedAt', () => {
    const next = applySkillEnrichmentSuggestion(
      {
        name: 'Python',
        tags: ['backend', 'python'],
      },
      {
        depth: 'strong',
        context: 'Builds Python services.',
        positioning: 'Mention for backend roles.',
      },
    )

    expect(next.enriched_at).toEqual(expect.any(String))
    expect(Number.isNaN(Date.parse(next.enriched_at ?? ''))).toBe(false)
  })

  it('handles accepted AI skill enrichment suggestions with only a depth', () => {
    const next = applySkillEnrichmentSuggestion(
      {
        name: 'Go',
        tags: ['backend', 'go'],
        context: 'Existing context.',
        positioning: 'Existing positioning.',
      },
      {
        depth: 'working',
      },
      '2026-06-02T12:00:00.000Z',
    )

    expect(next.depth).toBe('working')
    expect(next.depthConfidence).toBeUndefined()
    expect(next.context).toBeUndefined()
    expect(next.positioning).toBeUndefined()
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

  it('returns null for map skill draft selection when the identity has no skills', () => {
    const identity = cloneIdentityFixture()
    identity.skills.groups = []

    expect(resolveIdentityMapSkillDraftSelection(identity)).toBeNull()
  })

  it('returns the next pending skill as a draft map selection', () => {
    expect(resolveIdentityMapSkillDraftSelection(createIdentity())).toEqual({
      type: 'skill-item',
      groupId: 'backend',
      itemId: 'TypeScript',
      draft: true,
    })
  })

  it('falls back to the first skill without drafting when every skill is complete', () => {
    const identity = createIdentity()
    identity.skills.groups[0]!.items[1] = {
      ...identity.skills.groups[0]!.items[1]!,
      depth: 'working',
      skipped_at: undefined,
    }
    identity.skills.groups[1]!.items[0] = {
      ...identity.skills.groups[1]!.items[0]!,
      depth: 'strong',
    }

    expect(resolveIdentityMapSkillDraftSelection(identity)).toEqual({
      type: 'skill-item',
      groupId: 'platform',
      itemId: 'Kubernetes',
      draft: false,
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
    expect(skills[0]).toMatchObject({
      skillName: 'Kubernetes',
      status: 'complete',
      stale: false,
    })
    expect(skills[1]).toMatchObject({
      skillName: 'Terraform',
      status: 'skipped',
      stale: false,
    })
    expect(skills[2]).toMatchObject({
      skillName: 'TypeScript',
      status: 'pending',
      stale: false,
    })
    expect(resolveIdentityEnrichmentSkill(identity, 'platform', 'Kubernetes')).toMatchObject({
      groupId: 'platform',
      skillName: 'Kubernetes',
      groupLabel: 'Platform',
      status: 'complete',
      stale: false,
    })
  })

  it('marks stale skills without changing their completion status', () => {
    const identity = createIdentity()
    identity.skills.groups[0]!.items[0]!.context_stale = true

    expect(listIdentityEnrichmentSkills(identity)[0]).toMatchObject({
      skillName: 'Kubernetes',
      status: 'complete',
      stale: true,
    })
  })
})
