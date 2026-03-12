import { describe, expect, it } from 'vitest'
import { assembleResume, buildComponentKeys, getPriorityForVector } from '../engine/assembler'
import { defaultResumeData } from '../store/defaultData'

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T

describe('assembleResume', () => {
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
    expect(result.trimmedBulletIds.length).toBeGreaterThan(0)
  })

  it('resolves variant text for selected vector', () => {
    const data = clone(defaultResumeData)

    const result = assembleResume(data, {
      selectedVector: 'platform',
    })

    const bullet = result.resume.roles
      .flatMap((role) => role.bullets)
      .find((bullet) => bullet.id === 'acme-b1')

    // When viewing 'platform' vector, if acme-b1 has a platform variant it should use it
    // otherwise it uses the base text
    expect(bullet?.text).toBeDefined()
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

    const platform = assembleResume(data, { selectedVector: 'platform' })
    expect(platform.resume.skillGroups.map((group) => group.id)).toEqual(['languages'])
    expect(platform.resume.skillGroups[0]?.content).toContain('TypeScript')
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
        bullets: [
          { id: 'b1', text: 'Text', vectors: { backend: 'include' } }
        ]
      }
    ]

    const result = assembleResume(data, { selectedVector: 'backend' })
    expect(result.resume.roles).toHaveLength(1)
    expect(result.resume.roles[0].id).toBe('empty-vectors-role')
  })

  it('passes through meta header and education data', () => {
    const data = clone(defaultResumeData)
    data.meta.name = 'Custom Name'
    data.education = [
      { id: 'edu-1', school: 'Test Uni', degree: 'BS', location: 'City', year: '2020', vectors: { backend: 'include' } }
    ]

    const result = assembleResume(data, { selectedVector: 'backend' })
    expect(result.resume.header.name).toBe('Custom Name')
    expect(result.resume.education).toHaveLength(1)
    expect(result.resume.education[0].school).toBe('Test Uni')
  })

  it('always includes education entries even when their vectors are empty', () => {
    const data = clone(defaultResumeData)
    data.education = [
      { id: 'edu-1', school: 'State U', degree: 'BS', location: 'Austin, TX', year: '2020', vectors: {} },
    ]

    expect(assembleResume(data, { selectedVector: 'backend' }).resume.education).toHaveLength(1)
    expect(assembleResume(data, { selectedVector: 'leadership' }).resume.education).toHaveLength(1)
    expect(assembleResume(data, { selectedVector: 'all' }).resume.education).toHaveLength(1)
  })

  it('still honors manual exclusion overrides for education entries', () => {
    const data = clone(defaultResumeData)
    data.education = [
      { id: 'edu-1', school: 'State U', degree: 'BS', location: 'Austin, TX', year: '2020', vectors: {} },
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
    const baseRole = baseline.resume.roles.find(r => r.id === roleId)
    expect(baseRole?.bullets.find(b => b.id === bulletId)).toBeDefined()

    // role:bullet override should trump global bullet ID override
    const result = assembleResume(data, {
      selectedVector: 'backend',
      manualOverrides: {
        [bulletId]: true, // Global ID: Include
        [`role:${roleId}:bullet:${bulletId}`]: false, // Specific: Exclude
      }
    })

    const role = result.resume.roles.find(r => r.id === roleId)
    const bullet = role?.bullets.find(b => b.id === bulletId)
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
      }
    })

    const role = result.resume.roles.find(r => r.id === roleId)
    const bullet = role?.bullets.find(b => b.id === bulletId)
    expect(bullet).toBeUndefined()
  })
})
