import { describe, expect, it } from 'vitest'
import { derivePrepCheatsheetSections } from '../utils/prepCheatsheet'
import type { PrepDeck } from '../types/prep'

const deck: PrepDeck = {
  id: 'deck-1',
  title: 'Acme prep',
  company: 'Acme',
  role: 'Staff Engineer',
  vectorId: 'backend',
  pipelineEntryId: null,
  positioning: 'Lead with platform reliability and delivery cadence.',
  skillMatch: 'platform engineering, distributed systems',
  notes: 'Hiring manager cares about ownership and practical judgment.',
  companyResearch: 'Acme is investing in platform reliability and internal developer tooling.',
  jobDescription: 'Lead systems design, CI/CD, and infrastructure automation.',
  updatedAt: '2026-04-14T12:00:00.000Z',
  cards: [
    {
      id: 'opener-1',
      category: 'opener',
      title: 'Tell me about yourself',
      tags: ['opener'],
      script: 'I build resilient backend systems and improve developer workflows.',
    },
    {
      id: 'technical-1',
      category: 'technical',
      title: 'Discuss release automation',
      tags: ['technical'],
      warning: 'Do not imply direct Kubernetes ownership if the question is about migration strategy.',
    },
  ],
}

describe('derivePrepCheatsheetSections', () => {
  it('builds overview, intel, category, and warning sections from a prep deck', () => {
    const sections = derivePrepCheatsheetSections(deck)

    expect(sections.map((section) => section.id)).toEqual([
      'overview',
      'intel',
      'opener',
      'technical',
      'warnings',
    ])
    expect(sections[0].items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: 'Acme' }),
        expect.objectContaining({ title: 'Staff Engineer' }),
        expect.objectContaining({ title: 'Vector: backend' }),
        expect.objectContaining({ title: 'Positioning', detail: expect.stringContaining('platform reliability') }),
      ]),
    )
    expect(sections[1].items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: 'Research notes', detail: expect.stringContaining('platform reliability') }),
        expect.objectContaining({ title: 'Skill match', detail: expect.stringContaining('distributed systems') }),
        expect.objectContaining({ title: 'Working notes', detail: expect.stringContaining('ownership') }),
        expect.objectContaining({ title: 'Job description snapshot', detail: expect.stringContaining('CI/CD') }),
      ]),
    )
    expect(sections[4].items[0]).toMatchObject({
      title: 'Discuss release automation',
      category: 'technical',
      detail: expect.stringContaining('Do not imply'),
    })
  })

  it('omits category and warning sections when a blank deck has no cards', () => {
    const sections = derivePrepCheatsheetSections({
      ...deck,
      companyResearch: undefined,
      skillMatch: undefined,
      notes: undefined,
      jobDescription: undefined,
      positioning: undefined,
      cards: [],
    })

    expect(sections.map((section) => section.id)).toEqual(['overview'])
  })

  it('keeps multiple cards in the same category together and skips empty warnings', () => {
    const sections = derivePrepCheatsheetSections({
      ...deck,
      cards: [
        ...deck.cards,
        {
          id: 'technical-2',
          category: 'technical',
          title: 'Debugging production rollouts',
          tags: ['technical'],
          warning: '',
        },
        {
          id: 'technical-3',
          category: 'technical',
          title: 'Kubernetes delivery tradeoffs',
          tags: ['technical'],
        },
      ],
    })

    const technical = sections.find((section) => section.id === 'technical')
    const warnings = sections.find((section) => section.id === 'warnings')

    expect(technical?.items).toHaveLength(3)
    expect(warnings?.items).toHaveLength(1)
  })
})
