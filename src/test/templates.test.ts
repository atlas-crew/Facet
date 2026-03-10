import { describe, expect, it } from 'vitest'
import { TEMPLATES, DEFAULT_TEMPLATE_ID } from '../templates/registry'
import { toTemplateResumeData } from '../templates/types'
import { buildAssembledResume } from './fixtures/assembledResume'

describe('template registry', () => {
  it('contains entries for all TemplateId values', () => {
    const ids = Object.keys(TEMPLATES)
    expect(ids).toContain('classic')
    expect(ids).toContain('sidebar')
    expect(ids).toContain('minimalist')
  })

  it('has consistent IDs matching record keys', () => {
    for (const [key, template] of Object.entries(TEMPLATES)) {
      expect(template.id).toBe(key)
    }
  })

  it('has non-empty metadata for all templates', () => {
    for (const template of Object.values(TEMPLATES)) {
      expect(template.name.length).toBeGreaterThan(0)
      expect(template.description.length).toBeGreaterThan(0)
      expect(template.content.length).toBeGreaterThan(0)
    }
  })

  it('DEFAULT_TEMPLATE_ID is a valid key in TEMPLATES', () => {
    expect(TEMPLATES[DEFAULT_TEMPLATE_ID]).toBeDefined()
  })
})

describe('toTemplateResumeData', () => {
  it('strips internal assembled metadata', () => {
    const assembled = buildAssembledResume({
      roles: [
        {
          id: 'role-1',
          company: 'Co',
          title: 'T',
          dates: 'D',
          bullets: [{ id: 'b1', text: 'Text' }],
        },
      ],
    })
    const result = toTemplateResumeData(assembled)
    
    // Check that role bullets are just strings, no id or priority
    expect(result.roles[0].bullets[0]).toBe('Text')
    expect((result.roles[0].bullets[0] as unknown as Record<string, unknown>).id).toBeUndefined()
    expect((result.roles[0].bullets[0] as unknown as Record<string, unknown>).priority).toBeUndefined()
  })

  it('handles optional profile and targetLine correctly', () => {
    const noProfile = buildAssembledResume({ profile: undefined, targetLine: undefined })
    const resultNo = toTemplateResumeData(noProfile)
    expect(resultNo.profile).toBe('')
    expect(resultNo.targetLine).toBeUndefined()

    const withProfile = buildAssembledResume({
      profile: { id: 'p1', text: 'Summary' },
      targetLine: { id: 't1', text: 'Target' }
    })
    const resultWith = toTemplateResumeData(withProfile)
    expect(resultWith.profile).toBe('Summary')
    expect(resultWith.targetLine).toBe('Target')
  })

  it('maps all sections via shallow copy', () => {
    const assembled = buildAssembledResume({
      header: {
        name: 'N',
        email: 'E',
        phone: 'P',
        location: 'L',
        links: [{ url: 'U' }]
      },
      skillGroups: [{ id: 's1', label: 'L', content: 'C' }],
      projects: [{ id: 'pr1', name: 'N', text: 'T', url: 'U' }],
      education: [{ id: 'e1', school: 'S', degree: 'D', location: 'L', year: 'Y' }],
      certifications: []
    })
    
    const result = toTemplateResumeData(assembled)
    
    expect(result.header.links).not.toBe(assembled.header.links)
    expect(result.header.links[0]).toEqual(assembled.header.links[0])
    
    expect(result.skillGroups[0]).toEqual({ label: 'L', content: 'C' })
    expect(result.projects[0]).toEqual({ name: 'N', text: 'T', url: 'U' })
    expect(result.education[0]).not.toBe(assembled.education[0])
    expect(result.education[0]).toEqual({ school: 'S', degree: 'D', location: 'L', year: 'Y' })
  })

  it('handles empty arrays gracefully', () => {
    const assembled = buildAssembledResume({
      roles: [],
      projects: [],
      skillGroups: [],
      education: []
    })
    const result = toTemplateResumeData(assembled)
    expect(result.roles).toEqual([])
    expect(result.projects).toEqual([])
    expect(result.skillGroups).toEqual([])
    expect(result.education).toEqual([])
  })
})
