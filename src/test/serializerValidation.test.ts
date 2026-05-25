/* eslint-disable @typescript-eslint/no-explicit-any -- intentional invalid-shape casts for validation tests */
import { describe, expect, it } from 'vitest'
import { importResumeConfig } from '../engine/serializer'
import { defaultResumeData } from '../store/defaultData'

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

describe('serializer validation matrix', () => {
  const baseData = clone(defaultResumeData)
  const expectInvalidData = (mutate: (data: typeof baseData) => void, expected: RegExp) => {
    const data = clone(baseData)
    mutate(data)
    expect(() => importResumeConfig(JSON.stringify(data))).toThrow(expected)
  }

  it('accepts valid default data', () => {
    expect(() => importResumeConfig(JSON.stringify(baseData))).not.toThrow()
  })

  it('rejects malformed JSON', () => {
    expect(() => importResumeConfig('{ "version": 1, ')).toThrow(/Failed to parse JSON/)
  })

  it('rejects non-object root', () => {
    expect(() => importResumeConfig('["not", "an", "object"]')).toThrow(
      /Resume data must be an object/,
    )
  })

  it.each([
    ['null', 'null'],
    ['number', '42'],
    ['string', '"resume"'],
  ])('rejects %s root payloads', (_label, source) => {
    expect(() => importResumeConfig(source)).toThrow(/Resume data must be an object/)
  })

  it.each([
    [
      'vectors',
      (data: typeof baseData) => {
        const record = data as any
        record.vectors = {}
      },
      /vectors must be an array/,
    ],
    [
      'projects',
      (data: typeof baseData) => {
        const record = data as any
        record.projects = 'projects'
      },
      /projects must be an array/,
    ],
    [
      'education',
      (data: typeof baseData) => {
        const record = data as any
        record.education = null
      },
      /education must be an array/,
    ],
    [
      'role bullets',
      (data: typeof baseData) => {
        const role = data.roles[0] as any
        role.bullets = {}
      },
      /roles\[0\].bullets must be an array/,
    ],
  ])('rejects non-array %s collections', (_label, mutate, expected) => {
    expectInvalidData(mutate, expected)
  })

  describe('nested field presence', () => {
    it('precondition: defaultResumeData has required elements', () => {
      expect(baseData.roles.length).toBeGreaterThan(0)
      expect(baseData.roles[0].bullets.length).toBeGreaterThan(0)
      expect(baseData.projects.length).toBeGreaterThan(0)
      expect(baseData.vectors.length).toBeGreaterThan(0)
      expect(baseData.education.length).toBeGreaterThan(0)
      expect(baseData.skill_groups.length).toBeGreaterThan(0)
      expect(baseData.target_lines.length).toBeGreaterThan(0)
    })

    it('rejects roles missing company', () => {
      const data = clone(baseData)
      delete (data.roles[0] as any).company
      expect(() => importResumeConfig(JSON.stringify(data))).toThrow(
        /roles\[0\].company must be a string/,
      )
    })

    it('rejects bullets missing id', () => {
      const data = clone(baseData)
      delete (data.roles[0].bullets[0] as any).id
      expect(() => importResumeConfig(JSON.stringify(data))).toThrow(
        /roles\[0\].bullets\[0\].id must be a string/,
      )
    })

    it('rejects projects missing name', () => {
      const data = clone(baseData)
      delete (data.projects[0] as any).name
      expect(() => importResumeConfig(JSON.stringify(data))).toThrow(
        /projects\[0\].name must be a string/,
      )
    })

    it('rejects vectors missing color', () => {
      const data = clone(baseData)
      delete (data.vectors[0] as any).color
      expect(() => importResumeConfig(JSON.stringify(data))).toThrow(
        /vectors\[0\].color must be a string/,
      )
    })

    it('rejects education missing degree', () => {
      const data = clone(baseData)
      delete (data.education[0] as any).degree
      expect(() => importResumeConfig(JSON.stringify(data))).toThrow(
        /education\[0\].degree must be a string/,
      )
    })

    it.each([
      [
        'vector id',
        (data: typeof baseData) => delete (data.vectors[0] as any).id,
        /vectors\[0\].id must be a string/,
      ],
      [
        'vector label',
        (data: typeof baseData) => delete (data.vectors[0] as any).label,
        /vectors\[0\].label must be a string/,
      ],
      [
        'target line vectors',
        (data: typeof baseData) => delete (data.target_lines[0] as any).vectors,
        /target_lines\[0\].vectors must be an object/,
      ],
      [
        'project text',
        (data: typeof baseData) => delete (data.projects[0] as any).text,
        /projects\[0\].text must be a string/,
      ],
      [
        'project vectors',
        (data: typeof baseData) => delete (data.projects[0] as any).vectors,
        /projects\[0\].vectors must be an object/,
      ],
      [
        'bullet text',
        (data: typeof baseData) => delete (data.roles[0].bullets[0] as any).text,
        /roles\[0\].bullets\[0\].text must be a string/,
      ],
      [
        'bullet vectors',
        (data: typeof baseData) => delete (data.roles[0].bullets[0] as any).vectors,
        /roles\[0\].bullets\[0\].vectors must be an object/,
      ],
      [
        'skill group id',
        (data: typeof baseData) => delete (data.skill_groups[0] as any).id,
        /skill_groups\[0\].id must be a string/,
      ],
      [
        'skill group label',
        (data: typeof baseData) => delete (data.skill_groups[0] as any).label,
        /skill_groups\[0\].label must be a string/,
      ],
      [
        'skill group content',
        (data: typeof baseData) => delete (data.skill_groups[0] as any).content,
        /skill_groups\[0\].content must be a string/,
      ],
      [
        'role id',
        (data: typeof baseData) => delete (data.roles[0] as any).id,
        /roles\[0\].id must be a string/,
      ],
      [
        'role title',
        (data: typeof baseData) => delete (data.roles[0] as any).title,
        /roles\[0\].title must be a string/,
      ],
      [
        'role dates',
        (data: typeof baseData) => delete (data.roles[0] as any).dates,
        /roles\[0\].dates must be a string/,
      ],
      [
        'education school',
        (data: typeof baseData) => delete (data.education[0] as any).school,
        /education\[0\].school must be a string/,
      ],
      [
        'education location',
        (data: typeof baseData) => delete (data.education[0] as any).location,
        /education\[0\].location must be a string/,
      ],
    ])('rejects nested records missing required %s', (_label, mutate, expected) => {
      expectInvalidData(mutate, expected)
    })
  })

  describe('nested object-shape guards', () => {
    it.each([
      [
        'vectors',
        (data: typeof baseData) => {
          data.vectors[0] = 'backend' as any
        },
        /vectors\[0\] must be an object/,
      ],
      [
        'projects',
        (data: typeof baseData) => {
          data.projects[0] = null as any
        },
        /projects\[0\] must be an object/,
      ],
      [
        'target lines',
        (data: typeof baseData) => {
          data.target_lines[0] = false as any
        },
        /target_lines\[0\] must be an object/,
      ],
      [
        'skill groups',
        (data: typeof baseData) => {
          data.skill_groups[0] = 'skills' as any
        },
        /skill_groups\[0\] must be an object/,
      ],
      [
        'roles',
        (data: typeof baseData) => {
          data.roles[0] = null as any
        },
        /roles\[0\] must be an object/,
      ],
      [
        'project vector maps',
        (data: typeof baseData) => {
          data.projects[0].vectors = 'backend' as any
        },
        /projects\[0\].vectors must be an object/,
      ],
      [
        'bullet vector maps',
        (data: typeof baseData) => {
          data.roles[0].bullets[0].vectors = 'backend' as any
        },
        /roles\[0\].bullets\[0\].vectors must be an object/,
      ],
      [
        'role bullets',
        (data: typeof baseData) => {
          data.roles[0].bullets[0] = [] as any
        },
        /roles\[0\].bullets\[0\] must be an object/,
      ],
      [
        'education',
        (data: typeof baseData) => {
          data.education[0] = 'school' as any
        },
        /education\[0\] must be an object/,
      ],
    ])('rejects non-object %s entries', (_label, mutate, expected) => {
      expectInvalidData(mutate, expected)
    })
  })

  describe('value type constraints', () => {
    it('rejects invalid skill order map shape', () => {
      const data = clone(baseData)
      data.skill_groups[0].order = ['backend'] as any
      expect(() => importResumeConfig(JSON.stringify(data))).toThrow(
        /skill_groups\[0\].order must be an object/,
      )
    })

    it('rejects invalid skill order value (non-number)', () => {
      const data = clone(baseData)
      data.skill_groups[0].order = { backend: 'one' as any }
      expect(() => importResumeConfig(JSON.stringify(data))).toThrow(
        /skill_groups\[0\].order.backend must be a number/,
      )
    })

    it('rejects invalid vector skill order value', () => {
      const data = clone(baseData)
      data.skill_groups[0].vectors = {
        backend: { priority: 'include', order: 'first' as any },
      }
      expect(() => importResumeConfig(JSON.stringify(data))).toThrow(
        /skill_groups\[0\].vectors.backend.order must be a number/,
      )
    })

    it('rejects invalid vector skill priority value', () => {
      const data = clone(baseData)
      data.skill_groups[0].vectors = {
        backend: { priority: 'maybe' as any, order: 1 },
      }
      expect(() => importResumeConfig(JSON.stringify(data))).toThrow(
        /skill_groups\[0\].vectors.backend.priority must be one of/,
      )
    })

    it('rejects invalid vector priority value', () => {
      const data = clone(baseData)
      data.target_lines[0].vectors.backend = 123 as any
      expect(() => importResumeConfig(JSON.stringify(data))).toThrow(
        /target_lines\[0\].vectors.backend must be one of/,
      )
    })

    it('rejects invalid optional education year values', () => {
      const data = clone(baseData)
      data.education[0].year = { label: '2024' } as any
      expect(() => importResumeConfig(JSON.stringify(data))).toThrow(
        /education\[0\].year must be a string/,
      )
    })

    it('rejects invalid project vector priority values', () => {
      const data = clone(baseData)
      data.projects[0].vectors.backend = 'maybe' as any
      expect(() => importResumeConfig(JSON.stringify(data))).toThrow(
        /projects\[0\].vectors.backend must be one of/,
      )
    })

    it('rejects invalid bullet vector priority values', () => {
      const data = clone(baseData)
      data.roles[0].bullets[0].vectors.backend = 'maybe' as any
      expect(() => importResumeConfig(JSON.stringify(data))).toThrow(
        /roles\[0\].bullets\[0\].vectors.backend must be one of/,
      )
    })

    it('rejects non-boolean manual override value', () => {
      const data = clone(baseData)
      data.manualOverrides = { backend: { b1: 'yes' as any } }
      expect(() => importResumeConfig(JSON.stringify(data))).toThrow(
        /manualOverrides.backend.b1 must be a boolean/,
      )
    })
  })

  describe('logical constraints', () => {
    it('rejects roles array with no bullets across all roles', () => {
      const data = clone(baseData)
      data.roles = data.roles.map((r) => ({ ...r, bullets: [] }))
      expect(() => importResumeConfig(JSON.stringify(data))).toThrow(/at least one bullet/)
    })

    it('accepts single role with no bullets if another role HAS bullets', () => {
      const data = clone(baseData)
      // Add a role with no bullets
      data.roles.push({
        id: 'empty-role',
        company: 'Empty',
        title: 'T',
        dates: 'D',
        vectors: {},
        bullets: [],
      })
      expect(() => importResumeConfig(JSON.stringify(data))).not.toThrow()
    })
  })
})
