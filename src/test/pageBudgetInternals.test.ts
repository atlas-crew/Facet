import { describe, expect, it } from 'vitest'
import { estimateResumeLines } from '../engine/pageBudget'
import type { AssembledResume } from '../types'

describe('pageBudget internals', () => {
  it('estimateResumeLines handles empty resume', () => {
    const emptyResume: AssembledResume = {
      selectedVector: 'all',
      header: { name: '', email: '', phone: '', location: '', links: [] },
      skillGroups: [],
      roles: [],
      projects: [],
      education: [],
      certifications: [],
    }
    // Baseline lines: 2 (name/contact container) + 0 (content)
    const lines = estimateResumeLines(emptyResume)
    expect(lines).toBeGreaterThanOrEqual(1)
    expect(lines).toBeLessThanOrEqual(3)
  })

  it('estimateResumeLines handles full content', () => {
    const resume: AssembledResume = {
      selectedVector: 'all',
      header: { 
        name: 'Jane Doe', 
        email: 'jane@example.com', 
        phone: '555-5555', 
        location: 'City, State', 
        links: [{ url: 'github.com/jane' }] 
      },
      targetLine: { id: 'tl', text: 'Target Line Text' },
      profile: { id: 'p', text: 'Profile text goes here.' },
      skillGroups: [
        { id: 's1', label: 'Skills', content: 'React, TypeScript, Node.js' }
      ],
      roles: [
        {
          id: 'r1',
          company: 'Co',
          title: 'Title',
          dates: '2020-2021',
          bullets: [{ id: 'b1', text: 'Bullet text' }]
        }
      ],
      projects: [
        { id: 'pr1', name: 'Proj', text: 'Project description' }
      ],
      education: [
        { id: 'e1', school: 'Uni', degree: 'BS', location: 'Loc', year: '2020' }
      ],
      certifications: [],
    }

    const lines = estimateResumeLines(resume)
    // Tighter bounds catch regressions while allowing for minor heuristic tuning
    expect(lines).toBeGreaterThan(12)
    expect(lines).toBeLessThan(25)
  })

  it('estimateResumeLines handles very long wrapped text', () => {
    const resume: AssembledResume = {
      selectedVector: 'all',
      header: { name: 'N', email: 'E', phone: 'P', location: 'L', links: [] },
      profile: { id: 'p', text: 'A'.repeat(500) }, // ~6 lines at 92 chars/line
      skillGroups: [],
      roles: [],
      projects: [],
      education: [],
      certifications: [],
    }
    const lines = estimateResumeLines(resume)
    // Base 3 + 1 (profile space) + ~6 (profile text) = ~10
    expect(lines).toBeGreaterThan(8)
    expect(lines).toBeLessThan(15)
  })
})
