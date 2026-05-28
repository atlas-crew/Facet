import { describe, expect, it } from 'vitest'
import { assembleResume, buildComponentKeys, getPriorityForVector } from '../engine/assembler'
import { defaultResumeData } from '../store/defaultData'
import type { ManualComponentOverrides, ResumeData } from '../types'

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

describe('assembleResume', () => {
  it('uses all-vector defaults when options are omitted', () => {
    const data = clone(defaultResumeData)
    const result = assembleResume(data)

    expect(result.resume.selectedVector).toBe('all')
    expect(result.targetPages).toBe(2)
    expect(result.resume.roles.flatMap((role) => role.bullets).map((bullet) => bullet.id)).toEqual(
      expect.arrayContaining(['acme-b1', 'acme-b2', 'acme-b3', 'byteforge-b1', 'byteforge-b2']),
    )
  })

  it('includes backend components for backend vector', () => {
    const data = clone(defaultResumeData)
    const result = assembleResume(data, { selectedVector: 'backend' })

    expect(result.resume.targetLine?.id).toBe('tl-backend')
    expect(result.resume.profile?.id).toBe('profile-backend')
    expect(result.resume.roles[0]?.bullets.length).toBeGreaterThan(0)
    expect(result.resume.roles[0]?.bullets.every((bullet) => bullet.text.length > 0)).toBe(true)
  })

  it('applies manual overrides for excluded components', () => {
    const data = clone(defaultResumeData)
    const result = assembleResume(data, {
      selectedVector: 'leadership',
      manualOverrides: {
        'target_line:tl-leadership': false,
        'target_line:tl-backend': true,
      },
    })

    expect(result.resume.targetLine?.id).toBe('tl-backend')
  })

  it('trims bottom bullets when page budget is exceeded', () => {
    const data = clone(defaultResumeData)

    data.roles[0].bullets = [
      ...data.roles[0].bullets,
      ...Array.from({ length: 40 }).map((_, index) => ({
        id: `extra-opt-${index}`,
        vectors: { backend: 'include' as const },
        text: `Optional filler bullet ${index} `.repeat(10),
      })),
    ]

    const result = assembleResume(data, {
      selectedVector: 'backend',
      targetPages: 1,
    })

    expect(result.estimatedPages).toBeLessThanOrEqual(1)
    expect(result.estimatedPageUsage).toBeLessThanOrEqual(1)
    expect(result.trimmedBulletIds.length).toBeGreaterThan(0)
    expect(result.warnings).toEqual([])
  })

  it('preserves oversized resumes when page-budget trimming is disabled', () => {
    const data = clone(defaultResumeData)
    data.roles[0].bullets = [
      ...data.roles[0].bullets,
      ...Array.from({ length: 40 }).map((_, index) => ({
        id: `untrimmed-extra-${index}`,
        vectors: { backend: 'include' as const },
        text: `Untrimmed filler bullet ${index} `.repeat(10),
      })),
    ]
    const sourceIncludedBulletCount = data.roles[0].bullets.filter(
      (bullet) => bullet.vectors.backend === 'include',
    ).length

    const result = assembleResume(data, {
      selectedVector: 'backend',
      targetPages: 1,
      trimToPageBudget: false,
    })

    expect(result.estimatedPages).toBeGreaterThan(1)
    expect(result.estimatedPageUsage).toBeGreaterThan(1)
    expect(result.trimmedBulletIds).toEqual([])
    expect(result.warnings).toEqual([
      {
        code: 'over_budget_after_trim',
        message: expect.stringContaining('target: 1'),
      },
    ])
    expect(result.resume.roles[0]?.bullets).toHaveLength(sourceIncludedBulletCount)
  })

  it('resolves variant text for selected vector', () => {
    const data = clone(defaultResumeData)
    data.roles = [
      {
        id: 'variant-role',
        company: 'Variant Co',
        title: 'Engineer',
        dates: '2024',
        vectors: {},
        bullets: [
          {
            id: 'variant-bullet',
            vectors: { platform: 'include' },
            text: 'Base variant text',
            variants: {
              platform: 'Platform-specific {{variantKind}} text',
            },
          },
          {
            id: 'fallback-bullet',
            vectors: { platform: 'include' },
            text: 'Base {{fallbackKind}} text',
            variants: {
              backend: 'Backend-only variant text',
            },
          },
        ],
      },
    ]

    const result = assembleResume(data, {
      selectedVector: 'platform',
      trimToPageBudget: false,
      variables: {
        fallbackKind: 'fallback',
        variantKind: 'variant',
      },
    })

    expect(result.resume.roles[0]?.bullets).toEqual([
      {
        id: 'variant-bullet',
        text: 'Platform-specific variant text',
      },
      {
        id: 'fallback-bullet',
        text: 'Base fallback text',
      },
    ])
  })

  it('uses an explicit empty string vector variant instead of falling back to base text', () => {
    const data = clone(defaultResumeData)
    data.roles = [
      {
        id: 'empty-variant-role',
        company: 'Variant Co',
        title: 'Engineer',
        dates: '2024',
        vectors: {},
        bullets: [
          {
            id: 'empty-variant-bullet',
            vectors: { backend: 'include' },
            text: 'Base text should not appear',
            variants: {
              backend: '',
            },
          },
          {
            id: 'undefined-variant-bullet',
            vectors: { backend: 'include' },
            text: 'Base text should appear',
            variants: {
              backend: undefined,
            },
          },
        ],
      },
    ]

    const result = assembleResume(data, {
      selectedVector: 'backend',
      trimToPageBudget: false,
    })

    expect(result.resume.roles[0]?.bullets[0]).toEqual({
      id: 'empty-variant-bullet',
      text: '',
    })
    expect(result.resume.roles[0]?.bullets[1]).toEqual({
      id: 'undefined-variant-bullet',
      text: 'Base text should appear',
    })
  })

  it('ignores inherited manual override keys', () => {
    const data = clone(defaultResumeData)
    data.target_lines = [
      {
        id: 'prototype-target',
        text: 'Inherited override should not include this',
        vectors: { backend: 'exclude' },
      },
    ]
    const manualOverrides = Object.create({
      'target_line:prototype-target': true,
    }) as Record<string, boolean>

    const result = assembleResume(data, {
      selectedVector: 'backend',
      trimToPageBudget: false,
      manualOverrides,
    })

    expect(result.resume.targetLine).toBeUndefined()
  })

  it('resolves all-vector selection using any included vector', () => {
    const data = clone(defaultResumeData)
    data.projects = [
      {
        id: 'all-mode-project',
        name: 'All Mode',
        vectors: {
          backend: 'include',
          leadership: 'include',
        },
        text: 'Should remain in all mode',
      },
    ]

    const result = assembleResume(data, { selectedVector: 'all' })
    expect(result.resume.projects[0]?.id).toBe('all-mode-project')
  })

  it('excludes roles with no qualifying bullets', () => {
    const data = clone(defaultResumeData)
    data.roles = [
      {
        ...data.roles[0],
        id: 'only-excluded',
        bullets: [
          {
            id: 'excluded-bullet',
            vectors: { backend: 'exclude' },
            text: 'Should be removed',
          },
        ],
      },
    ]

    const result = assembleResume(data, { selectedVector: 'backend' })
    expect(result.resume.roles).toHaveLength(0)
  })

  it('supports role-level manual exclusion', () => {
    const data = clone(defaultResumeData)
    const targetRole = data.roles[0].id
    const result = assembleResume(data, {
      selectedVector: 'backend',
      manualOverrides: {
        [`role:${targetRole}`]: false,
      },
    })

    expect(result.resume.roles.find((role) => role.id === targetRole)).toBeUndefined()
  })

  it('applies per-role bullet ordering map', () => {
    const data = clone(defaultResumeData)
    const role = data.roles[0]
    const includedIds = role.bullets
      .filter((bullet) => bullet.vectors.backend && bullet.vectors.backend !== 'exclude')
      .map((bullet) => bullet.id)
    const reversed = [...includedIds].reverse()

    const result = assembleResume(data, {
      selectedVector: 'backend',
      bulletOrderByRole: {
        [role.id]: reversed,
      },
    })

    const outputBullets = result.resume.roles.find((item) => item.id === role.id)?.bullets ?? []
    expect(outputBullets[0]?.id).toBe(reversed[0])
  })

  it('applies partial per-role bullet ordering while preserving unspecified source order', () => {
    const data = clone(defaultResumeData)
    data.roles = [
      {
        id: 'partial-order-role',
        company: 'Order Co',
        title: 'Engineer',
        dates: '2024',
        vectors: {},
        bullets: [
          { id: 'b1', text: 'First bullet', vectors: { backend: 'include' } },
          { id: 'b2', text: 'Second bullet', vectors: { backend: 'include' } },
          { id: 'b3', text: 'Third bullet', vectors: { backend: 'include' } },
        ],
      },
    ]

    const result = assembleResume(data, {
      selectedVector: 'backend',
      trimToPageBudget: false,
      bulletOrderByRole: {
        'partial-order-role': ['missing-bullet', 'b3'],
      },
    })

    expect(result.resume.roles[0]?.bullets.map((bullet) => bullet.id)).toEqual(['b3', 'b1', 'b2'])
  })

  it('preserves source bullet order for an empty per-role ordering array', () => {
    const data = clone(defaultResumeData)
    data.roles = [
      {
        id: 'empty-order-role',
        company: 'Order Co',
        title: 'Engineer',
        dates: '2024',
        vectors: {},
        bullets: [
          { id: 'b1', text: 'First bullet', vectors: { backend: 'include' } },
          { id: 'b2', text: 'Second bullet', vectors: { backend: 'include' } },
          { id: 'b3', text: 'Third bullet', vectors: { backend: 'include' } },
        ],
      },
    ]

    const result = assembleResume(data, {
      selectedVector: 'backend',
      trimToPageBudget: false,
      bulletOrderByRole: {
        'empty-order-role': [],
      },
    })

    expect(result.resume.roles[0]?.bullets.map((bullet) => bullet.id)).toEqual(['b1', 'b2', 'b3'])
  })

  it('handles duplicate ids in per-role bullet ordering deterministically', () => {
    const data = clone(defaultResumeData)
    data.roles = [
      {
        id: 'duplicate-order-role',
        company: 'Order Co',
        title: 'Engineer',
        dates: '2024',
        vectors: {},
        bullets: [
          { id: 'b1', text: 'First bullet', vectors: { backend: 'include' } },
          { id: 'b2', text: 'Second bullet', vectors: { backend: 'include' } },
          { id: 'b3', text: 'Third bullet', vectors: { backend: 'include' } },
        ],
      },
    ]

    const result = assembleResume(data, {
      selectedVector: 'backend',
      trimToPageBudget: false,
      bulletOrderByRole: {
        'duplicate-order-role': ['b2', 'b2', 'b1'],
      },
    })

    expect(result.resume.roles[0]?.bullets.map((bullet) => bullet.id)).toEqual(['b2', 'b1', 'b3'])
  })

  it('routes skill groups by vector priority, order, and content override', () => {
    const data = clone(defaultResumeData)
    data.skill_groups = [
      {
        id: 'languages',
        label: 'Languages',
        content: 'Go, Python',
        vectors: {
          backend: { priority: 'include', order: 2 },
          platform: { priority: 'include', order: 1, content: 'TypeScript, Go, Python' },
        },
      },
      {
        id: 'tooling',
        label: 'Tooling',
        content: 'Terraform, Docker',
        vectors: {
          backend: { priority: 'include', order: 1 },
          platform: { priority: 'exclude', order: 2 },
        },
      },
    ]

    const backend = assembleResume(data, { selectedVector: 'backend' })
    expect(backend.resume.skillGroups.map((group) => group.id)).toEqual(['tooling', 'languages'])
    expect(backend.resume.skillGroups.find((group) => group.id === 'languages')?.content).toBe(
      'Go, Python',
    )

    const platform = assembleResume(data, { selectedVector: 'platform' })
    expect(platform.resume.skillGroups.map((group) => group.id)).toEqual(['languages'])
    expect(platform.resume.skillGroups[0]?.content).toContain('TypeScript')
  })

  it('orders all-vector skill groups by the earliest included vector order and source order ties', () => {
    const data = clone(defaultResumeData)
    data.skill_groups = [
      {
        id: 'tie-first',
        label: 'Tie First',
        content: 'First',
        vectors: {
          backend: { priority: 'include', order: 3 },
          platform: { priority: 'include', order: 1, content: 'Platform First' },
        },
      },
      {
        id: 'tie-second',
        label: 'Tie Second',
        content: 'Second',
        vectors: {
          backend: { priority: 'include', order: 1 },
          platform: { priority: 'exclude', order: 0 },
        },
      },
      {
        id: 'last',
        label: 'Last',
        content: 'Last',
        vectors: {
          backend: { priority: 'include', order: 4 },
        },
      },
      {
        id: 'default-only',
        label: 'Default Only',
        content: 'Default',
        order: { default: 2 },
        vectors: {},
      },
      {
        id: 'unordered-one',
        label: 'Unordered One',
        content: 'Unordered one',
        vectors: {},
      },
      {
        id: 'unordered-two',
        label: 'Unordered Two',
        content: 'Unordered two',
        vectors: {},
      },
      {
        id: 'all-excluded',
        label: 'All Excluded',
        content: 'Included in all mode',
        vectors: {
          backend: { priority: 'exclude', order: 0 },
          platform: { priority: 'exclude', order: 0 },
        },
      },
      {
        id: 'missing-vector-order',
        label: 'Missing Vector Order',
        content: 'Missing vector order',
        vectors: {
          backend: { priority: 'include' },
        } as unknown as NonNullable<ResumeData['skill_groups'][number]['vectors']>,
      },
    ]

    const result = assembleResume(data, {
      selectedVector: 'all',
      trimToPageBudget: false,
    })

    expect(result.resume.skillGroups.map((group) => group.id)).toEqual([
      'tie-first',
      'tie-second',
      'default-only',
      'last',
      'unordered-one',
      'unordered-two',
      'all-excluded',
      'missing-vector-order',
    ])
    expect(result.resume.skillGroups[0]?.content).toBe('First')
  })

  it('includes skill groups when the selected vector is absent and uses legacy order fallback', () => {
    const data = clone(defaultResumeData)
    data.skill_groups = [
      {
        id: 'default-order',
        label: 'Default Order',
        content: 'Default order',
        order: { default: 5 },
        vectors: {},
      },
      {
        id: 'selected-vector-order',
        label: 'Selected Vector Order',
        content: 'Selected vector order',
        order: { backend: 2 },
        vectors: {},
      },
      {
        id: 'other-vector-only',
        label: 'Other Vector Only',
        content: 'Other vector only',
        vectors: {
          frontend: { priority: 'include', order: 1 },
        },
      },
    ]

    const result = assembleResume(data, {
      selectedVector: 'backend',
      trimToPageBudget: false,
    })

    expect(result.resume.skillGroups.map((group) => group.id)).toEqual([
      'selected-vector-order',
      'default-order',
      'other-vector-only',
    ])
  })

  it('sorts skill groups with non-finite explicit vector order to the end', () => {
    const data = clone(defaultResumeData)
    data.skill_groups = [
      {
        id: 'finite-order',
        label: 'Finite Order',
        content: 'Finite order',
        vectors: {
          backend: { priority: 'include', order: 1 },
        },
      },
      {
        id: 'nan-order',
        label: 'NaN Order',
        content: 'NaN order',
        vectors: {
          backend: { priority: 'include', order: Number.NaN },
        },
      },
    ]

    const result = assembleResume(data, {
      selectedVector: 'backend',
      trimToPageBudget: false,
    })

    expect(result.resume.skillGroups.map((group) => group.id)).toEqual([
      'finite-order',
      'nan-order',
    ])
  })

  it('ignores malformed non-boolean manual override values', () => {
    const data = clone(defaultResumeData)
    data.roles = [
      {
        id: 'malformed-overrides-role',
        company: 'Override Co',
        title: 'Engineer',
        dates: '2024',
        vectors: {},
        bullets: [
          { id: 'included-bullet', text: 'Included bullet', vectors: { backend: 'include' } },
          { id: 'excluded-bullet', text: 'Excluded bullet', vectors: { backend: 'exclude' } },
        ],
      },
    ]

    const result = assembleResume(data, {
      selectedVector: 'backend',
      trimToPageBudget: false,
      manualOverrides: {
        'bullet:included-bullet': null,
        'bullet:excluded-bullet': {},
      } as unknown as ManualComponentOverrides,
    })

    expect(result.resume.roles[0]?.bullets).toEqual([
      {
        id: 'included-bullet',
        text: 'Included bullet',
      },
    ])
  })

  it('honors manual overrides for skill groups', () => {
    const data = clone(defaultResumeData)
    data.skill_groups = [
      {
        id: 'auto-skill',
        label: 'Auto Skill',
        content: 'Automatically included',
        vectors: {
          backend: { priority: 'include', order: 1 },
        },
      },
      {
        id: 'excluded-skill',
        label: 'Excluded Skill',
        content: 'Force included',
        vectors: {
          backend: { priority: 'exclude', order: 2 },
        },
      },
    ]

    const result = assembleResume(data, {
      selectedVector: 'backend',
      trimToPageBudget: false,
      manualOverrides: {
        'skill_group:auto-skill': false,
        'skill_group:excluded-skill': true,
      },
    })

    expect(result.resume.skillGroups.map((group) => group.id)).toEqual(['excluded-skill'])
  })

  it('preserves included skill groups when resolved content is empty', () => {
    const data = clone(defaultResumeData)
    data.skill_groups = [
      {
        id: 'empty-content',
        label: 'Empty Content',
        content: '{{emptyContent}}',
        vectors: {
          backend: { priority: 'include', order: 1 },
        },
      },
    ]

    const result = assembleResume(data, {
      selectedVector: 'backend',
      trimToPageBudget: false,
      variables: {
        emptyContent: '',
      },
    })

    expect(result.resume.skillGroups).toEqual([
      {
        id: 'empty-content',
        label: 'Empty Content',
        content: '',
      },
    ])
  })

  it('uses base text instead of vector variants in all-vector mode', () => {
    const data = clone(defaultResumeData)
    data.projects = [
      {
        id: 'variant-project',
        name: 'Variant Project',
        text: 'Base project text',
        variants: {
          backend: 'Backend project variant',
        },
        vectors: { backend: 'include' },
      },
    ]

    const result = assembleResume(data, {
      selectedVector: 'all',
      trimToPageBudget: false,
    })

    expect(result.resume.projects[0]?.text).toBe('Base project text')
  })

  it('selects a manually force-included profile after excluding an earlier automatic match', () => {
    const data = clone(defaultResumeData)
    data.profiles = [
      {
        id: 'auto-profile',
        text: 'Automatically included profile',
        vectors: { backend: 'include' },
      },
      {
        id: 'manual-profile',
        text: 'Manually included profile',
        vectors: { platform: 'include' },
      },
    ]

    const result = assembleResume(data, {
      selectedVector: 'backend',
      trimToPageBudget: false,
      manualOverrides: {
        'profile:auto-profile': false,
        'profile:manual-profile': true,
      },
    })

    expect(result.resume.profile).toEqual({
      id: 'manual-profile',
      text: 'Manually included profile',
    })
  })

  it('exposes stable component key order for overrides', () => {
    expect(buildComponentKeys('bullet', 'b1', 'r1')).toEqual([
      'role:r1:bullet:b1',
      'role:r1:b1',
      'bullet:b1',
      'b1',
    ])
  })

  it('returns exclude priority when vector does not match', () => {
    expect(getPriorityForVector({ backend: 'include' }, 'leadership')).toBe('exclude')
  })

  it('resolves priority for all-vector and empty-vector selections', () => {
    expect(getPriorityForVector(null, 'backend')).toBe('exclude')
    expect(getPriorityForVector(undefined, 'backend')).toBe('exclude')
    expect(getPriorityForVector({}, 'all')).toBe('exclude')
    expect(getPriorityForVector({ backend: 'exclude', platform: 'exclude' }, 'all')).toBe('exclude')
    expect(getPriorityForVector({ backend: 'exclude' }, 'backend')).toBe('exclude')
    expect(getPriorityForVector({ backend: 'exclude', platform: 'include' }, 'all')).toBe('include')
    expect(getPriorityForVector({ backend: 'include' }, 'backend')).toBe('include')
  })

  it('builds top-level component override keys without role context', () => {
    expect(buildComponentKeys('project', 'project-1')).toEqual(['project:project-1', 'project-1'])
  })

  it('selects the first matching target line when multiple match', () => {
    const data = clone(defaultResumeData)
    data.target_lines = [
      { id: 'tl-first', text: 'First line', vectors: { backend: 'include' } },
      { id: 'tl-second', text: 'Second line', vectors: { backend: 'include' } },
      { id: 'tl-third', text: 'Third line', vectors: { backend: 'include' } },
    ]

    const result = assembleResume(data, { selectedVector: 'backend' })
    expect(result.resume.targetLine?.id).toBe('tl-first')
  })

  it('selects the first matching profile when multiple naturally match', () => {
    const data = clone(defaultResumeData)
    data.profiles = [
      { id: 'profile-first', text: 'First profile', vectors: { backend: 'include' } },
      { id: 'profile-second', text: 'Second profile', vectors: { backend: 'include' } },
      { id: 'profile-third', text: 'Third profile', vectors: { backend: 'include' } },
    ]

    const result = assembleResume(data, {
      selectedVector: 'backend',
      trimToPageBudget: false,
    })

    expect(result.resume.profile).toEqual({
      id: 'profile-first',
      text: 'First profile',
    })
  })

  it('force-includes excluded bullets', () => {
    const data = clone(defaultResumeData)
    data.roles = [
      {
        ...data.roles[0],
        id: 'force-include-role',
        bullets: [
          {
            id: 'excluded-by-default',
            vectors: { backend: 'exclude' },
            text: 'Force include me',
          },
        ],
      },
    ]

    const result = assembleResume(data, {
      selectedVector: 'backend',
      manualOverrides: {
        'role:force-include-role:bullet:excluded-by-default': true,
      },
    })

    const bullet = result.resume.roles[0]?.bullets[0]
    expect(bullet?.id).toBe('excluded-by-default')
  })

  it('auto-selects vector variant when override is not set', () => {
    const data = clone(defaultResumeData)
    const result = assembleResume(data, { selectedVector: 'platform' })

    const bullet = result.resume.roles
      .flatMap((role) => role.bullets)
      .find((item) => item.id === 'acme-b1')

    expect(bullet?.text).toContain('self-service order processing platform')
  })

  it('includes roles even when vectors field is empty (advisory only)', () => {
    const data = clone(defaultResumeData)
    data.roles = [
      {
        id: 'empty-vectors-role',
        company: 'Empty Co',
        title: 'Engineer',
        dates: '2020-2021',
        vectors: {}, // Should be ignored for role-level inclusion
        bullets: [{ id: 'b1', text: 'Text', vectors: { backend: 'include' } }],
      },
    ]

    const result = assembleResume(data, { selectedVector: 'backend' })
    expect(result.resume.roles).toHaveLength(1)
    expect(result.resume.roles[0].id).toBe('empty-vectors-role')
  })

  it('passes through meta header and education data', () => {
    const data = clone(defaultResumeData)
    data.meta.name = 'Custom Name'
    data.education = [
      {
        id: 'edu-1',
        school: 'Test Uni',
        degree: 'BS',
        location: 'City',
        year: '2020',
        vectors: { backend: 'include' },
      },
    ]

    const result = assembleResume(data, { selectedVector: 'backend' })
    expect(result.resume.header.name).toBe('Custom Name')
    expect(result.resume.education).toHaveLength(1)
    expect(result.resume.education[0].school).toBe('Test Uni')
  })

  it('filters projects by vector priority and manual overrides', () => {
    const data = clone(defaultResumeData)
    data.projects = [
      {
        id: 'auto-backend',
        name: 'Auto Backend',
        text: 'Included by backend vector',
        vectors: { backend: 'include' },
      },
      {
        id: 'platform-only',
        name: 'Platform Only',
        text: 'Excluded from backend vector',
        vectors: { platform: 'include' },
      },
      {
        id: 'manual-project',
        name: 'Manual Project',
        url: 'example.com/manual-project',
        text: 'Force included by override',
        vectors: { platform: 'include' },
      },
    ]

    const result = assembleResume(data, {
      selectedVector: 'backend',
      trimToPageBudget: false,
      manualOverrides: {
        'project:auto-backend': false,
        'project:manual-project': true,
      },
    })

    expect(result.resume.projects.map((project) => project.id)).toEqual(['manual-project'])
    expect(result.resume.projects[0]?.url).toBe('example.com/manual-project')
  })

  it('resolves display fields while preserving project and certification url identifiers verbatim', () => {
    const data = clone(defaultResumeData)
    data.projects = [
      {
        id: 'url-project',
        name: '{{projectName}}',
        url: 'example.com/{{projectName}}',
        text: '{{projectText}}',
        vectors: { backend: 'include' },
      },
    ]
    data.certifications = [
      {
        id: 'url-cert',
        name: '{{certName}}',
        issuer: '{{issuer}}',
        credential_id: 'credential-{{certName}}',
        url: 'example.com/certs/{{certName}}',
        vectors: { backend: 'include' },
      },
    ]

    const result = assembleResume(data, {
      selectedVector: 'backend',
      trimToPageBudget: false,
      variables: {
        certName: 'Security Cert',
        issuer: 'Cert Authority',
        projectName: 'Signal Project',
        projectText: 'Resolved project text',
      },
    })

    expect(result.resume.projects[0]).toMatchObject({
      name: 'Signal Project',
      text: 'Resolved project text',
      url: 'example.com/{{projectName}}',
    })
    expect(result.resume.certifications[0]).toMatchObject({
      name: 'Security Cert',
      issuer: 'Cert Authority',
      credential_id: 'credential-{{certName}}',
      url: 'example.com/certs/{{certName}}',
    })
  })

  it('preserves header contact/link fields and resolves education variables', () => {
    const data = clone(defaultResumeData)
    data.variables = {
      school: 'Variable University',
      degree: 'M.S. Systems',
      location: 'Remote City',
      year: '2024',
    }
    data.meta = {
      name: 'Header Name',
      email: 'header@example.com',
      phone: '555-0000',
      location: 'Header City',
      links: [{ label: 'Portfolio', url: 'example.com/portfolio' }],
    }
    data.education = [
      {
        id: 'edu-variable',
        school: '{{school}}',
        degree: '{{degree}}',
        location: '{{location}}',
        year: '{{year}}',
        vectors: {},
      },
    ]

    const result = assembleResume(data, {
      selectedVector: 'backend',
      trimToPageBudget: false,
    })

    expect(result.resume.header).toEqual(data.meta)
    expect(result.resume.education).toEqual([
      {
        id: 'edu-variable',
        school: 'Variable University',
        degree: 'M.S. Systems',
        location: 'Remote City',
        year: '2024',
      },
    ])
  })

  it('filters certifications by vector priority and manual overrides', () => {
    const data = clone(defaultResumeData)
    data.certifications = [
      {
        id: 'cert-backend',
        name: 'Backend Cert',
        issuer: 'Backend Issuer',
        date: '2024',
        credential_id: 'backend-123',
        url: 'example.com/backend-cert',
        vectors: { backend: 'include' },
      },
      {
        id: 'cert-platform',
        name: 'Platform Cert',
        issuer: 'Platform Issuer',
        vectors: { platform: 'include' },
      },
      {
        id: 'cert-manual',
        name: 'Manual Cert',
        issuer: 'Manual Issuer',
        date: '2026',
        credential_id: 'manual-123',
        url: 'example.com/manual-cert',
        vectors: { platform: 'include' },
      },
    ]

    const result = assembleResume(data, {
      selectedVector: 'backend',
      trimToPageBudget: false,
      manualOverrides: {
        'certification:cert-backend': false,
        'certification:cert-manual': true,
      },
    })

    expect(result.resume.certifications).toEqual([
      {
        id: 'cert-manual',
        name: 'Manual Cert',
        issuer: 'Manual Issuer',
        date: '2026',
        credential_id: 'manual-123',
        url: 'example.com/manual-cert',
      },
    ])
  })

  it('resolves variables across assembled roles, bullets, skills, projects, and certifications', () => {
    const data = clone(defaultResumeData)
    data.variables = {
      company: 'Variable Co',
      title: 'Principal Engineer',
      dates: '2020 - Present',
      location: 'Remote',
      subtitle: 'Platform Systems',
      bullet: 'variable bullet result',
      skillLabel: 'Variable Skills',
      skillContent: 'Rust, TypeScript',
      projectName: 'Variable Project',
      projectText: 'variable project result',
      certName: 'Variable Cert',
      certIssuer: 'Variable Issuer',
      certDate: '2025',
    }
    data.skill_groups = [
      {
        id: 'variable-skills',
        label: '{{skillLabel}}',
        content: 'Default content',
        vectors: {
          backend: { priority: 'include', order: 1, content: '{{skillContent}}' },
        },
      },
    ]
    data.roles = [
      {
        id: 'variable-role',
        company: '{{company}}',
        title: '{{title}}',
        dates: '{{dates}}',
        location: '{{location}}',
        subtitle: '{{subtitle}}',
        vectors: {},
        bullets: [{ id: 'variable-bullet', text: '{{bullet}}', vectors: { backend: 'include' } }],
      },
    ]
    data.projects = [
      {
        id: 'variable-project',
        name: '{{projectName}}',
        text: '{{projectText}}',
        vectors: { backend: 'include' },
      },
    ]
    data.certifications = [
      {
        id: 'variable-cert',
        name: '{{certName}}',
        issuer: '{{certIssuer}}',
        date: '{{certDate}}',
        vectors: { backend: 'include' },
      },
    ]

    const result = assembleResume(data, {
      selectedVector: 'backend',
      trimToPageBudget: false,
    })

    expect(result.resume.skillGroups[0]).toMatchObject({
      label: 'Variable Skills',
      content: 'Rust, TypeScript',
    })
    expect(result.resume.roles[0]).toMatchObject({
      company: 'Variable Co',
      title: 'Principal Engineer',
      dates: '2020 - Present',
      location: 'Remote',
      subtitle: 'Platform Systems',
    })
    expect(result.resume.roles[0]?.bullets[0]?.text).toBe('variable bullet result')
    expect(result.resume.projects[0]).toMatchObject({
      name: 'Variable Project',
      text: 'variable project result',
    })
    expect(result.resume.certifications[0]).toMatchObject({
      name: 'Variable Cert',
      issuer: 'Variable Issuer',
      date: '2025',
    })
  })

  it('resolves variables in header, target line, and profile text', () => {
    const data = clone(defaultResumeData)
    data.meta = {
      ...data.meta,
      name: '{{name}}',
      location: '{{location}}',
    }
    data.target_lines = [
      {
        id: 'variable-target',
        text: 'Targeting {{role}} roles',
        vectors: { backend: 'include' },
      },
    ]
    data.profiles = [
      {
        id: 'variable-profile',
        text: 'Profile focused on {{focus}}.',
        vectors: { backend: 'include' },
      },
    ]

    const result = assembleResume(data, {
      selectedVector: 'backend',
      trimToPageBudget: false,
      variables: {
        focus: 'platform resilience',
        location: 'New York, NY',
        name: 'Alice Example',
        role: 'backend',
      },
    })

    expect(result.resume.header.name).toBe('Alice Example')
    expect(result.resume.header.location).toBe('New York, NY')
    expect(result.resume.targetLine?.text).toBe('Targeting backend roles')
    expect(result.resume.profile?.text).toBe('Profile focused on platform resilience.')
  })

  it('uses options variables instead of data variables when provided', () => {
    const data = clone(defaultResumeData)
    data.variables = {
      name: 'Data Variable',
      title: 'Data Title',
    }
    data.roles = [
      {
        id: 'variable-role',
        company: '{{name}}',
        title: '{{title}}',
        dates: '2024',
        vectors: {},
        bullets: [{ id: 'b1', text: '{{title}}', vectors: { backend: 'include' } }],
      },
    ]

    const result = assembleResume(data, {
      selectedVector: 'backend',
      trimToPageBudget: false,
      variables: {
        name: 'Options Variable',
      },
    })

    expect(result.resume.roles[0]?.company).toBe('Options Variable')
    expect(result.resume.roles[0]?.title).toBe('{{title}}')
    expect(result.resume.roles[0]?.bullets[0]?.text).toBe('{{title}}')
  })

  it('handles legacy resume data without a certifications array', () => {
    type LegacyResumeData = Omit<ResumeData, 'certifications'> &
      Partial<Pick<ResumeData, 'certifications'>>
    const data = clone(defaultResumeData) as LegacyResumeData
    delete data.certifications

    const result = assembleResume(data as ResumeData, {
      selectedVector: 'backend',
      trimToPageBudget: false,
    })

    expect(result.resume.certifications).toEqual([])
  })

  it('handles sparse legacy resume data without top-level arrays or meta', () => {
    type SparseResumeData = Pick<ResumeData, 'version'> & Partial<Omit<ResumeData, 'version'>>
    const data: SparseResumeData = { version: 1 }

    const result = assembleResume(data as ResumeData, {
      selectedVector: 'backend',
      trimToPageBudget: false,
    })

    expect(result.resume.header).toEqual({
      name: '',
      email: '',
      phone: '',
      location: '',
      links: [],
    })
    expect(result.resume.targetLine).toBeUndefined()
    expect(result.resume.profile).toBeUndefined()
    expect(result.resume.skillGroups).toEqual([])
    expect(result.resume.roles).toEqual([])
    expect(result.resume.projects).toEqual([])
    expect(result.resume.education).toEqual([])
    expect(result.resume.certifications).toEqual([])
  })

  it('treats legacy components with missing vector maps as excluded instead of throwing', () => {
    type LegacyVectorComponent<T extends { vectors: unknown }> = Omit<T, 'vectors'> & {
      vectors?: T['vectors']
    }
    type LegacyRole = Omit<ResumeData['roles'][number], 'bullets'> & {
      bullets: Array<LegacyVectorComponent<ResumeData['roles'][number]['bullets'][number]>>
    }
    type LegacyResumeData = Omit<
      ResumeData,
      'target_lines' | 'profiles' | 'roles' | 'projects' | 'certifications'
    > & {
      target_lines: Array<LegacyVectorComponent<ResumeData['target_lines'][number]>>
      profiles: Array<LegacyVectorComponent<ResumeData['profiles'][number]>>
      roles: LegacyRole[]
      projects: Array<LegacyVectorComponent<ResumeData['projects'][number]>>
      certifications: Array<LegacyVectorComponent<ResumeData['certifications'][number]>>
    }
    const data = clone(defaultResumeData) as LegacyResumeData
    data.target_lines = [{ id: 'legacy-target', text: 'Legacy target' }]
    data.profiles = [{ id: 'legacy-profile', text: 'Legacy profile' }]
    data.roles = [
      {
        id: 'legacy-role',
        company: 'Legacy Co',
        title: 'Engineer',
        dates: '2024',
        vectors: {},
        bullets: [{ id: 'legacy-bullet', text: 'Legacy bullet' }],
      },
    ]
    data.projects = [{ id: 'legacy-project', name: 'Legacy Project', text: 'Legacy project' }]
    data.certifications = [{ id: 'legacy-cert', name: 'Legacy Cert', issuer: 'Legacy Issuer' }]

    const result = assembleResume(data as ResumeData, {
      selectedVector: 'backend',
      trimToPageBudget: false,
    })

    expect(result.resume.targetLine).toBeUndefined()
    expect(result.resume.profile).toBeUndefined()
    expect(result.resume.roles).toEqual([])
    expect(result.resume.projects).toEqual([])
    expect(result.resume.certifications).toEqual([])
  })

  it('treats legacy components with null vector maps as excluded instead of throwing', () => {
    type LegacyNullVectorComponent<T extends { vectors: unknown }> = Omit<T, 'vectors'> & {
      vectors: T['vectors'] | null
    }
    type LegacyRole = Omit<ResumeData['roles'][number], 'bullets'> & {
      bullets: Array<LegacyNullVectorComponent<ResumeData['roles'][number]['bullets'][number]>>
    }
    type LegacyResumeData = Omit<
      ResumeData,
      'target_lines' | 'profiles' | 'roles' | 'projects' | 'certifications'
    > & {
      target_lines: Array<LegacyNullVectorComponent<ResumeData['target_lines'][number]>>
      profiles: Array<LegacyNullVectorComponent<ResumeData['profiles'][number]>>
      roles: LegacyRole[]
      projects: Array<LegacyNullVectorComponent<ResumeData['projects'][number]>>
      certifications: Array<LegacyNullVectorComponent<ResumeData['certifications'][number]>>
    }
    const data = clone(defaultResumeData) as LegacyResumeData
    data.target_lines = [{ id: 'null-target', text: 'Null target', vectors: null }]
    data.profiles = [{ id: 'null-profile', text: 'Null profile', vectors: null }]
    data.roles = [
      {
        id: 'null-role',
        company: 'Null Co',
        title: 'Engineer',
        dates: '2024',
        vectors: {},
        bullets: [{ id: 'null-bullet', text: 'Null bullet', vectors: null }],
      },
    ]
    data.projects = [
      { id: 'null-project', name: 'Null Project', text: 'Null project', vectors: null },
    ]
    data.certifications = [
      { id: 'null-cert', name: 'Null Cert', issuer: 'Null Issuer', vectors: null },
    ]

    const result = assembleResume(data as ResumeData, {
      selectedVector: 'backend',
      trimToPageBudget: false,
    })

    expect(result.resume.targetLine).toBeUndefined()
    expect(result.resume.profile).toBeUndefined()
    expect(result.resume.roles).toEqual([])
    expect(result.resume.projects).toEqual([])
    expect(result.resume.certifications).toEqual([])
  })

  it('handles legacy roles without bullets and components without text', () => {
    type LegacyBullet = Omit<ResumeData['roles'][number]['bullets'][number], 'text'> & {
      text?: string
    }
    type LegacyRole = Omit<ResumeData['roles'][number], 'bullets'> & {
      bullets?: LegacyBullet[] | null
    }
    type LegacyProject = Omit<ResumeData['projects'][number], 'text'> & {
      text?: string
    }
    type LegacyResumeData = Omit<ResumeData, 'roles' | 'projects'> & {
      roles: LegacyRole[]
      projects: LegacyProject[]
    }
    const data = clone(defaultResumeData) as LegacyResumeData
    data.roles = [
      {
        id: 'missing-bullets-role',
        company: 'Missing Bullets Co',
        title: 'Engineer',
        dates: '2024',
        vectors: {},
        bullets: undefined,
      },
      {
        id: 'missing-bullet-text-role',
        company: 'Missing Text Co',
        title: 'Engineer',
        dates: '2025',
        vectors: {},
        bullets: [{ id: 'missing-text-bullet', vectors: { backend: 'include' } }],
      },
    ]
    data.projects = [
      {
        id: 'missing-project-text',
        name: 'Missing Project Text',
        vectors: { backend: 'include' },
      },
    ]

    const result = assembleResume(data as ResumeData, {
      selectedVector: 'backend',
      trimToPageBudget: false,
    })

    expect(result.resume.roles).toEqual([
      {
        id: 'missing-bullet-text-role',
        company: 'Missing Text Co',
        title: 'Engineer',
        dates: '2025',
        location: undefined,
        subtitle: undefined,
        bullets: [{ id: 'missing-text-bullet', text: '' }],
      },
    ])
    expect(result.resume.projects[0]).toMatchObject({
      id: 'missing-project-text',
      text: '',
    })
  })

  it('preserves empty optional fields while resolving populated optional variables', () => {
    type LegacyEducationEntry = Omit<ResumeData['education'][number], 'year'> & {
      year?: string | null
    }
    type LegacyCertification = Omit<ResumeData['certifications'][number], 'date'> & {
      date?: string | null
    }
    type LegacyResumeData = Omit<ResumeData, 'education' | 'certifications'> & {
      education: LegacyEducationEntry[]
      certifications: LegacyCertification[]
    }
    const data = clone(defaultResumeData) as LegacyResumeData
    data.variables = {
      subtitle: 'Resolved subtitle',
      year: '2026',
      certDate: '2027',
    }
    data.roles = [
      {
        id: 'empty-optionals-role',
        company: 'Optional Co',
        title: 'Engineer',
        dates: '2024',
        location: null,
        subtitle: '',
        vectors: {},
        bullets: [
          { id: 'optional-bullet', text: 'Included bullet', vectors: { backend: 'include' } },
        ],
      },
      {
        id: 'variable-optionals-role',
        company: 'Variable Co',
        title: 'Engineer',
        dates: '2025',
        subtitle: '{{subtitle}}',
        vectors: {},
        bullets: [
          {
            id: 'variable-optional-bullet',
            text: 'Included bullet',
            vectors: { backend: 'include' },
          },
        ],
      },
    ]
    data.education = [
      {
        id: 'empty-year',
        school: 'Empty U',
        degree: 'BS',
        location: 'Remote',
        year: '',
        vectors: {},
      },
      {
        id: 'null-year',
        school: 'Null U',
        degree: 'MS',
        location: 'Remote',
        year: null,
        vectors: {},
      },
      {
        id: 'variable-year',
        school: 'Variable U',
        degree: 'PhD',
        location: 'Remote',
        year: '{{year}}',
        vectors: {},
      },
    ]
    data.certifications = [
      {
        id: 'empty-date',
        name: 'Empty Date',
        issuer: 'Issuer',
        date: '',
        vectors: { backend: 'include' },
      },
      {
        id: 'null-date',
        name: 'Null Date',
        issuer: 'Issuer',
        date: null,
        vectors: { backend: 'include' },
      },
      {
        id: 'variable-date',
        name: 'Variable Date',
        issuer: 'Issuer',
        date: '{{certDate}}',
        vectors: { backend: 'include' },
      },
    ]

    const result = assembleResume(data as ResumeData, {
      selectedVector: 'backend',
      trimToPageBudget: false,
    })

    expect(result.resume.roles[0]).toMatchObject({
      location: null,
      subtitle: '',
    })
    expect(result.resume.roles[1]?.subtitle).toBe('Resolved subtitle')
    expect(result.resume.education.map((entry) => entry.year)).toEqual(['', null, '2026'])
    expect(result.resume.certifications.map((cert) => cert.date)).toEqual(['', null, '2027'])
  })

  it('always includes education entries even when their vectors are empty', () => {
    const data = clone(defaultResumeData)
    data.education = [
      {
        id: 'edu-1',
        school: 'State U',
        degree: 'BS',
        location: 'Austin, TX',
        year: '2020',
        vectors: {},
      },
    ]

    expect(assembleResume(data, { selectedVector: 'backend' }).resume.education).toHaveLength(1)
    expect(assembleResume(data, { selectedVector: 'leadership' }).resume.education).toHaveLength(1)
    expect(assembleResume(data, { selectedVector: 'all' }).resume.education).toHaveLength(1)
  })

  it('drops force-included roles when every bullet is excluded', () => {
    const data = clone(defaultResumeData)
    data.roles = [
      {
        id: 'empty-role',
        company: 'Empty Co',
        title: 'Engineer',
        dates: '2024',
        vectors: {},
        bullets: [
          { id: 'excluded-bullet', text: 'Excluded bullet', vectors: { backend: 'exclude' } },
        ],
      },
    ]

    const result = assembleResume(data, {
      selectedVector: 'backend',
      trimToPageBudget: false,
      manualOverrides: {
        'role:empty-role': true,
      },
    })

    expect(result.resume.roles).toEqual([])
  })

  it('still honors manual exclusion overrides for education entries', () => {
    const data = clone(defaultResumeData)
    data.education = [
      {
        id: 'edu-1',
        school: 'State U',
        degree: 'BS',
        location: 'Austin, TX',
        year: '2020',
        vectors: {},
      },
    ]

    const result = assembleResume(data, {
      selectedVector: 'backend',
      manualOverrides: {
        'education:edu-1': false,
      },
    })

    expect(result.resume.education).toHaveLength(0)
  })

  it('honors override precedence (specific trumps general)', () => {
    const data = clone(defaultResumeData)
    const roleId = data.roles[0].id
    const bulletId = data.roles[0].bullets[0].id

    // Preliminary: Confirm bullet is included without overrides
    const baseline = assembleResume(data, { selectedVector: 'backend' })
    const baseRole = baseline.resume.roles.find((r) => r.id === roleId)
    expect(baseRole?.bullets.find((b) => b.id === bulletId)).toBeDefined()

    // role:bullet override should trump global bullet ID override
    const result = assembleResume(data, {
      selectedVector: 'backend',
      manualOverrides: {
        [bulletId]: true, // Global ID: Include
        [`role:${roleId}:bullet:${bulletId}`]: false, // Specific: Exclude
      },
    })

    const role = result.resume.roles.find((r) => r.id === roleId)
    const bullet = role?.bullets.find((b) => b.id === bulletId)
    expect(bullet).toBeUndefined()
  })

  it('honors override precedence for mid-level keys', () => {
    const data = clone(defaultResumeData)
    const roleId = data.roles[0].id
    const bulletId = data.roles[0].bullets[0].id

    // role:r1:b1 (mid-level) should trump bullet:b1 (lower mid-level)
    const result = assembleResume(data, {
      selectedVector: 'backend',
      manualOverrides: {
        [`bullet:${bulletId}`]: true,
        [`role:${roleId}:${bulletId}`]: false,
      },
    })

    const role = result.resume.roles.find((r) => r.id === roleId)
    const bullet = role?.bullets.find((b) => b.id === bulletId)
    expect(bullet).toBeUndefined()
  })
})
