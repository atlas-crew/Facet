import { describe, expect, it, vi } from 'vitest'
import {
  type ProfessionalSkillGroup,
  importProfessionalIdentity,
  normalizeRuntimeProfessionalIdentity,
} from '../identity/schema'
import { dedupeSkillGroupsByItemName, dedupeSkillItemsByName } from '../identity/skillDedupe'
import {
  applySkillDepthEdit,
  skillNamesMatch,
  updateIdentityEnrichmentSkill,
} from '../utils/identityEnrichment'
import { cloneIdentityFixture } from './fixtures/identityFixture'

const createIdentityWithCaseVariantSkills = () => {
  const identity = cloneIdentityFixture()
  identity.skills.groups = [
    {
      id: 'platform',
      label: 'Platform',
      items: [
        {
          name: 'Kubernetes',
          tags: ['platform', 'kubernetes'],
        },
        {
          name: 'kubernetes',
          tags: ['orchestration', 'platform'],
          depth: 'strong',
          context: 'Used for customer-hosted and internal platform delivery.',
          positioning: 'Platform modernization and Kubernetes operations.',
          enriched_at: '2026-04-08T14:23:17.000Z',
          enriched_by: 'llm-accepted',
        },
      ],
    },
  ]
  return identity
}

describe('identity enrichment skill dedupe', () => {
  it('matches skill names case-insensitively after trimming edge whitespace', () => {
    expect(skillNamesMatch('Kubernetes ', 'kubernetes')).toBe(true)
    expect(skillNamesMatch('  ', '')).toBe(true)
    expect(skillNamesMatch('K8s', 'Kubernetes')).toBe(false)
  })

  it('applies user-corrected depth metadata and marks existing notes stale', () => {
    const updated = applySkillDepthEdit(
      {
        name: 'Kubernetes',
        tags: ['platform'],
        depth: 'strong',
        context: 'Existing context.',
        positioning: 'Existing positioning.',
      },
      'expert',
      '2026-05-29T12:00:00.000Z',
    )

    expect(updated).toMatchObject({
      depth: 'expert',
      depthSource: 'corrected',
      enriched_at: '2026-05-29T12:00:00.000Z',
      enriched_by: 'user',
      context_stale: true,
      positioning_stale: true,
    })
    expect(updated.skipped_at).toBeUndefined()
  })

  it('preserves depth metadata when inline edits leave depth unchanged', () => {
    const skill = {
      name: 'Kubernetes',
      tags: ['platform'],
      depth: 'strong' as const,
      depthSource: 'corrected' as const,
      enriched_at: '2026-01-01T00:00:00.000Z',
      enriched_by: 'user' as const,
    }

    expect(applySkillDepthEdit(skill, 'strong', '2026-05-29T12:00:00.000Z')).toBe(skill)
  })

  it('clears depth metadata and marks populated notes stale when depth is cleared', () => {
    const updated = applySkillDepthEdit(
      {
        name: 'Kubernetes',
        tags: ['platform'],
        depth: 'strong',
        depthSource: 'corrected',
        context: 'Existing context.',
        positioning: 'Existing positioning.',
        skipped_at: '2026-01-01T00:00:00.000Z',
      },
      '',
      '2026-05-29T12:00:00.000Z',
    )

    expect(updated.depth).toBeUndefined()
    expect(updated.depthSource).toBeUndefined()
    expect(updated.context_stale).toBe(true)
    expect(updated.positioning_stale).toBe(true)
    expect(updated.skipped_at).toBeUndefined()
  })

  it('clears orphaned enrichment provenance when depth is cleared without notes', () => {
    const updated = applySkillDepthEdit(
      {
        name: 'Kubernetes',
        tags: ['platform'],
        depth: 'strong',
        depthSource: 'corrected',
        context: '   ',
        positioning: '',
        enriched_at: '2026-01-01T00:00:00.000Z',
        enriched_by: 'user',
      },
      '',
      '2026-05-29T12:00:00.000Z',
    )

    expect(updated.depth).toBeUndefined()
    expect(updated.depthSource).toBeUndefined()
    expect(updated.enriched_at).toBeUndefined()
    expect(updated.enriched_by).toBeUndefined()
  })

  it('dedupes case-variant skills during import and reports the repair', () => {
    const result = importProfessionalIdentity(createIdentityWithCaseVariantSkills())

    expect(result.warnings).toContain(
      'skills.groups: duplicate skill "kubernetes" in "Platform" merged into "Kubernetes" in "Platform".',
    )
    expect(result.data.skills.groups[0]?.items).toEqual([
      {
        name: 'Kubernetes',
        tags: ['platform', 'kubernetes', 'orchestration'],
        depth: 'strong',
        depthSource: 'inferred',
        context: 'Used for customer-hosted and internal platform delivery.',
        positioning: 'Platform modernization and Kubernetes operations.',
        enriched_at: '2026-04-08T14:23:17.000Z',
        enriched_by: 'llm-accepted',
      },
    ])
  })

  it('dedupes case-variant skills during runtime load normalization', () => {
    const identity = createIdentityWithCaseVariantSkills()
    identity.skills.groups[0]!.items[0]!.depth = 'working'
    identity.skills.groups[0]!.items[0]!.depthSource = 'corrected'

    const normalized = normalizeRuntimeProfessionalIdentity(identity)

    expect(normalized.skills.groups[0]?.items).toEqual([
      {
        name: 'Kubernetes',
        tags: ['platform', 'kubernetes', 'orchestration'],
        depth: 'working',
        depthSource: 'corrected',
        context: 'Used for customer-hosted and internal platform delivery.',
        positioning: 'Platform modernization and Kubernetes operations.',
        enriched_at: '2026-04-08T14:23:17.000Z',
        enriched_by: 'llm-accepted',
      },
    ])
  })

  it('dedupes cross-group duplicate skills during import and reports the repair', () => {
    const identity = cloneIdentityFixture()
    identity.skills.groups = [
      {
        id: 'languages',
        label: 'Languages',
        items: [{ name: 'Python', tags: ['language'], depth: 'working' }],
      },
      {
        id: 'tooling',
        label: 'Tooling',
        items: [
          {
            name: 'python',
            tags: ['automation'],
            depth: 'strong',
            depthSource: 'corrected',
            context: 'Used for automation and platform tooling.',
          },
          { name: 'AWS', tags: ['cloud'] },
        ],
      },
    ]

    const result = importProfessionalIdentity(identity)

    expect(result.warnings).toContain(
      'skills.groups: duplicate skill "python" in "Tooling" merged into "Python" in "Languages".',
    )
    expect(result.data.skills.groups).toEqual([
      {
        id: 'languages',
        label: 'Languages',
        items: [
          {
            name: 'Python',
            tags: ['language', 'automation'],
            depth: 'strong',
            depthSource: 'corrected',
            context: 'Used for automation and platform tooling.',
          },
        ],
      },
      {
        id: 'tooling',
        label: 'Tooling',
        items: [{ name: 'AWS', tags: ['cloud'] }],
      },
    ])
  })

  it('removes imported groups that only contain duplicate skills', () => {
    const identity = cloneIdentityFixture()
    identity.skills.groups = [
      {
        id: 'languages',
        label: 'Languages',
        items: [{ name: 'Python', tags: ['language'] }],
      },
      {
        id: 'tooling',
        label: 'Tooling',
        items: [{ name: 'python', tags: ['automation'] }],
      },
    ]

    const result = importProfessionalIdentity(identity)

    expect(result.warnings).toContain(
      'skills.groups: duplicate skill "python" in "Tooling" merged into "Python" in "Languages".',
    )
    expect(result.data.skills.groups).toEqual([
      {
        id: 'languages',
        label: 'Languages',
        items: [{ name: 'Python', tags: ['language', 'automation'] }],
      },
    ])
  })

  it('removes empty skill groups consistently during group dedupe', () => {
    const groups: ProfessionalSkillGroup[] = [
      { id: 'empty', label: 'Empty', items: [] },
      { id: 'platform', label: 'Platform', items: [{ name: 'Kubernetes', tags: [] }] },
    ]

    expect(dedupeSkillGroupsByItemName(groups)).toEqual([
      { id: 'platform', label: 'Platform', items: [{ name: 'Kubernetes', tags: [] }] },
    ])
  })

  it('preserves blank skill names across groups without reporting duplicate repairs', () => {
    const onDuplicate = vi.fn()
    const groups: ProfessionalSkillGroup[] = [
      { id: 'a', label: 'A', items: [{ name: '', tags: ['a'] }] },
      { id: 'b', label: 'B', items: [{ name: '   ', tags: ['b'] }] },
    ]

    expect(dedupeSkillGroupsByItemName(groups, onDuplicate)).toBe(groups)
    expect(onDuplicate).not.toHaveBeenCalled()
  })

  it('prefers corrected duplicate depth while preserving the first skill casing', () => {
    const items = dedupeSkillItemsByName([
      {
        name: 'kubernetes',
        tags: [],
        depth: 'working',
        depthSource: 'inferred',
      },
      {
        name: 'Kubernetes',
        tags: [],
        depth: 'expert',
        depthSource: 'corrected',
      },
    ])

    expect(items).toEqual([
      {
        name: 'kubernetes',
        tags: [],
        depth: 'expert',
        depthSource: 'corrected',
      },
    ])
  })

  it('merges three case variants into the running canonical skill', () => {
    const onDuplicate = vi.fn()
    const items = dedupeSkillItemsByName(
      [
        {
          name: 'Kubernetes',
          tags: ['platform'],
          depth: 'working',
          depthSource: 'inferred',
          context: 'Original context.',
          enriched_at: '2026-04-08T14:23:17.000Z',
        },
        {
          name: 'kubernetes',
          tags: ['orchestration'],
          depth: 'expert',
          depthSource: 'corrected',
          context: 'Corrected-depth context.',
          enriched_at: '2026-04-09T14:23:17.000Z',
          enriched_by: 'user',
        },
        {
          name: 'KUBERNETES',
          tags: ['runtime'],
          context: 'Latest enrichment context.',
          positioning: 'Latest positioning.',
          enriched_at: '2026-04-10T14:23:17.000Z',
          enriched_by: 'llm-accepted',
        },
      ],
      onDuplicate,
    )

    expect(items).toEqual([
      {
        name: 'Kubernetes',
        tags: ['platform', 'orchestration', 'runtime'],
        depth: 'expert',
        depthSource: 'corrected',
        context: 'Latest enrichment context.',
        positioning: 'Latest positioning.',
        enriched_at: '2026-04-10T14:23:17.000Z',
        enriched_by: 'llm-accepted',
        skipped_at: undefined,
      },
    ])
    expect(onDuplicate).toHaveBeenCalledTimes(2)
  })

  it('keeps enrichment metadata from the latest case-variant record', () => {
    const items = dedupeSkillItemsByName([
      {
        name: 'Kubernetes',
        tags: [],
        depth: 'working',
        depthSource: 'inferred',
        context: 'Older context.',
        positioning: 'Older positioning.',
        enriched_at: '2026-04-08T14:23:17.000Z',
        enriched_by: 'llm-accepted',
      },
      {
        name: 'kubernetes',
        tags: [],
        context: 'Newer user-edited context.',
        positioning: 'Newer user-edited positioning.',
        enriched_at: '2026-04-09T14:23:17.000Z',
        enriched_by: 'user-edited-llm',
      },
    ])

    expect(items).toEqual([
      {
        name: 'Kubernetes',
        tags: [],
        depth: 'working',
        depthSource: 'inferred',
        context: 'Newer user-edited context.',
        positioning: 'Newer user-edited positioning.',
        enriched_at: '2026-04-09T14:23:17.000Z',
        enriched_by: 'user-edited-llm',
        skipped_at: undefined,
      },
    ])
  })

  it('uses the latest status timestamp as the depth tiebreaker when depth sources match', () => {
    const items = dedupeSkillItemsByName([
      {
        name: 'Kubernetes',
        tags: [],
        depth: 'working',
        depthSource: 'inferred',
        enriched_at: '2026-04-08T14:23:17.000Z',
      },
      {
        name: 'kubernetes',
        tags: [],
        depth: 'expert',
        depthSource: 'inferred',
        enriched_at: '2026-04-09T14:23:17.000Z',
      },
    ])

    expect(items[0]).toMatchObject({
      name: 'Kubernetes',
      depth: 'expert',
      depthSource: 'inferred',
      enriched_at: '2026-04-09T14:23:17.000Z',
    })
  })

  it('treats malformed enrichment timestamps as older than valid timestamps', () => {
    const items = dedupeSkillItemsByName([
      {
        name: 'Kubernetes',
        tags: [],
        context: 'Malformed timestamp context.',
        positioning: 'Malformed timestamp positioning.',
        enriched_at: 'not-a-date',
        enriched_by: 'user',
      },
      {
        name: 'kubernetes',
        tags: [],
        context: 'Valid timestamp context.',
        positioning: 'Valid timestamp positioning.',
        enriched_at: '2026-04-09T14:23:17.000Z',
        enriched_by: 'llm-accepted',
      },
    ])

    expect(items[0]).toMatchObject({
      name: 'Kubernetes',
      context: 'Valid timestamp context.',
      positioning: 'Valid timestamp positioning.',
      enriched_at: '2026-04-09T14:23:17.000Z',
      enriched_by: 'llm-accepted',
    })
  })

  it('uses enrichment provenance rank when case variants have tied timestamps', () => {
    const items = dedupeSkillItemsByName([
      {
        name: 'Kubernetes',
        tags: [],
        context: 'LLM accepted context.',
        positioning: 'LLM accepted positioning.',
        enriched_at: '2026-04-08T14:23:17.000Z',
        enriched_by: 'llm-accepted',
      },
      {
        name: 'kubernetes',
        tags: [],
        context: 'User-authored context.',
        positioning: 'User-authored positioning.',
        enriched_at: '2026-04-08T14:23:17.000Z',
        enriched_by: 'user',
      },
    ])

    expect(items[0]).toMatchObject({
      name: 'Kubernetes',
      context: 'User-authored context.',
      positioning: 'User-authored positioning.',
      enriched_at: '2026-04-08T14:23:17.000Z',
      enriched_by: 'user',
    })
  })

  it('treats skipped_at as an enrichment timestamp when merging case variants', () => {
    const items = dedupeSkillItemsByName([
      {
        name: 'Kubernetes',
        tags: [],
        context: 'Older accepted context.',
        positioning: 'Older accepted positioning.',
        enriched_at: '2026-04-08T14:23:17.000Z',
        enriched_by: 'llm-accepted',
      },
      {
        name: 'kubernetes',
        tags: [],
        skipped_at: '2026-04-09T14:23:17.000Z',
      },
    ])

    expect(items[0]).toMatchObject({
      name: 'Kubernetes',
      context: 'Older accepted context.',
      positioning: 'Older accepted positioning.',
      enriched_at: undefined,
      enriched_by: undefined,
      skipped_at: '2026-04-09T14:23:17.000Z',
    })
  })

  it('carries stale flags according to the winning enrichment record', () => {
    const items = dedupeSkillItemsByName([
      {
        name: 'Kubernetes',
        tags: [],
        context: 'Older context.',
        context_stale: false,
        positioning: 'Older positioning.',
        positioning_stale: true,
        enriched_at: '2026-04-08T14:23:17.000Z',
      },
      {
        name: 'kubernetes',
        tags: [],
        context: 'Newer context.',
        context_stale: true,
        positioning: 'Newer positioning.',
        enriched_at: '2026-04-09T14:23:17.000Z',
      },
    ])

    expect(items[0]).toMatchObject({
      name: 'Kubernetes',
      context: 'Newer context.',
      context_stale: true,
      positioning: 'Newer positioning.',
      positioning_stale: true,
      enriched_at: '2026-04-09T14:23:17.000Z',
    })
  })

  it('preserves empty skill names without reporting duplicate repairs', () => {
    const onDuplicate = vi.fn()
    const items = [
      { name: '', tags: ['a'] },
      { name: '   ', tags: ['b'] },
      { name: 'Kubernetes', tags: [] },
    ]

    expect(dedupeSkillItemsByName(items, onDuplicate)).toBe(items)
    expect(onDuplicate).not.toHaveBeenCalled()
  })

  it('dedupes a target group before applying enrichment updates', () => {
    const identity = createIdentityWithCaseVariantSkills()
    identity.skills.groups[0]!.items[0]!.name = 'Kubernetes '

    const updated = updateIdentityEnrichmentSkill(identity, 'platform', 'kubernetes', (skill) => ({
      ...skill,
      depth: 'expert',
      depthSource: 'corrected',
      context: 'User-confirmed canonical Kubernetes evidence.',
      enriched_by: 'user',
    }))

    expect(updated.skills.groups[0]?.items).toEqual([
      expect.objectContaining({
        name: 'Kubernetes ',
        tags: ['platform', 'kubernetes', 'orchestration'],
        depth: 'expert',
        depthSource: 'corrected',
        context: 'User-confirmed canonical Kubernetes evidence.',
        positioning: 'Platform modernization and Kubernetes operations.',
        enriched_by: 'user',
      }),
    ])
  })

  it('dedupes case-variant skills across groups during runtime load normalization', () => {
    const identity = cloneIdentityFixture()
    identity.skills.groups = [
      {
        id: 'platform',
        label: 'Platform',
        items: [{ name: 'Kubernetes', tags: ['platform'] }],
      },
      {
        id: 'operations',
        label: 'Operations',
        items: [{ name: 'kubernetes', tags: ['operations'] }],
      },
    ]

    const normalized = normalizeRuntimeProfessionalIdentity(identity)

    expect(normalized.skills.groups).toEqual([
      {
        id: 'platform',
        label: 'Platform',
        items: [{ name: 'Kubernetes', tags: ['platform', 'operations'] }],
      },
    ])
  })
})
