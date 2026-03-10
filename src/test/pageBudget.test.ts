import { describe, expect, it } from 'vitest'
import { applyPageBudget, estimateResumePages } from '../engine/pageBudget'
import type { AssembledResume } from '../types'

function createResume(): AssembledResume {
  return {
    selectedVector: 'backend',
    header: {
      name: 'Test User',
      email: 'test@example.com',
      phone: '555-111-2222',
      location: 'SF',
      links: [],
    },
    targetLine: {
      id: 'tl-1',
      text: 'Platform engineer',
    },
    profile: {
      id: 'p-1',
      text: 'Profile text '.repeat(10),
    },
    skillGroups: [],
    roles: [
      {
        id: 'new-role',
        company: 'New Co',
        title: 'Engineer',
        dates: '2024-Present',
        bullets: [
          { id: 'new-last', text: 'Last content '.repeat(20) },
          { id: 'new-keep', text: 'Keep content '.repeat(20) },
        ],
      },
      {
        id: 'old-role',
        company: 'Old Co',
        title: 'Engineer',
        dates: '2020-2024',
        bullets: [
          { id: 'old-last', text: 'Old content '.repeat(20) },
          { id: 'old-first', text: 'Earlier content '.repeat(20) },
        ],
      },
    ],
    projects: [],
    education: [],
    certifications: [],
  }
}

describe('pageBudget', () => {
  it('trims from the bottom of the ordered list', () => {
    const resume = createResume()
    const result = applyPageBudget(resume, {
      targetPages: 1,
      linesPerPage: 8,
      trim: true,
    })

    expect(result.trimmedBulletIds.length).toBeGreaterThan(0)
    expect(result.trimmedBulletIds[0]).toBe('old-first')
    expect(result.trimmedBulletIds).toContain('old-last')
  })

  it('does not trim when trim is disabled', () => {
    const resume = createResume()
    const before = resume.roles.flatMap((role) => role.bullets).length

    const result = applyPageBudget(resume, {
      targetPages: 1,
      linesPerPage: 8,
      trim: false,
    })

    expect(result.trimmedBulletIds).toHaveLength(0)
    expect(result.resume.roles.flatMap((role) => role.bullets)).toHaveLength(before)
  })

  it('guards estimateResumePages against non-positive linesPerPage', () => {
    const resume = createResume()
    expect(estimateResumePages(resume, 0)).toBeGreaterThanOrEqual(1)
    expect(estimateResumePages(resume, -5)).toBeGreaterThanOrEqual(1)
  })

  it('warns if still over budget after all bullets are trimmed', () => {
    const resume = createResume()
    resume.roles = [
      {
        id: 'must-only',
        company: 'Must Co',
        title: 'Engineer',
        dates: 'Now',
        bullets: [
          { id: 'm1', text: 'Must text '.repeat(40) },
          { id: 'm2', text: 'Must text '.repeat(40) },
        ],
      },
    ]

    const result = applyPageBudget(resume, {
      targetPages: 1,
      linesPerPage: 5,
      trim: true,
    })

    expect(result.trimmedBulletIds).toEqual(['m2', 'm1'])
    expect(result.resume.roles).toEqual([])
    expect(result.warnings.some((warning) => warning.code === 'over_budget_after_trim')).toBe(true)
  })

  it('does not mutate input resume while trimming', () => {
    const resume = createResume()
    const original = JSON.parse(JSON.stringify(resume)) as AssembledResume

    applyPageBudget(resume, {
      targetPages: 1,
      linesPerPage: 8,
      trim: true,
    })

    expect(resume).toEqual(original)
  })
})
