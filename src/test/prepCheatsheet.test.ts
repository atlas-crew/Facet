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
  donts: [' Ramble ', '', 'Skip the ask'],
  questionsToAsk: [
    {
      question: 'What should I prioritize in the first 90 days?',
      context: 'Listen for operating cadence and metrics.',
    },
    {
      question: 'How does the team define success?',
      context: 'Understand what the hiring manager values.',
    },
  ],
  categoryGuidance: {
    opener: 'Lead with relevance',
    behavioral: 'Lead with scope',
    project: 'Name the tradeoff',
    technical: 'Call out tradeoffs',
    situational: 'State assumptions',
  },
  updatedAt: '2026-04-14T12:00:00.000Z',
  cards: [
    {
      id: 'opener-1',
      category: 'opener',
      title: 'Tell me about yourself',
      tags: ['opener'],
      keyPoints: ['Keep it under 90 seconds', 'Lead with platform impact'],
      script: 'I build resilient backend systems and improve developer workflows.',
      notes: 'Use this to frame the rest of the interview.',
      warning: 'Do not over-index on management if the role is IC.',
    },
    {
      id: 'behavioral-1',
      category: 'behavioral',
      title: 'Resolve a stakeholder conflict',
      tags: ['behavioral'],
      storyBlocks: [
        { label: 'problem', text: 'The release plan was slipping and product was worried.' },
        { label: 'solution', text: 'I aligned both teams on the smallest useful change.' },
        { label: 'result', text: 'We shipped on time and reduced escalation noise.' },
      ],
    },
    {
      id: 'project-1',
      category: 'project',
      title: 'Platform migration',
      tags: ['project'],
      storyBlocks: [
        { label: 'closer', text: 'I learned to sell the tradeoff, not just the implementation.' },
      ],
    },
    {
      id: 'technical-1',
      category: 'technical',
      title: 'Debug a flaky distributed system',
      tags: ['technical'],
      metrics: [
        { value: '< 500ms', label: 'Detection latency' },
        { value: '50K/sec', label: 'Peak throughput' },
      ],
    },
    {
      id: 'situational-1',
      category: 'situational',
      title: 'Tradeoffs in a fast-moving rollout',
      tags: ['situational'],
      warning: 'Always state assumptions before picking a path.',
    },
    {
      id: 'metrics-1',
      category: 'metrics',
      title: 'Key numbers to remember',
      tags: ['metrics'],
      metrics: [
        { value: '40+', label: 'Engineers supported' },
      ],
    },
  ],
}

describe('derivePrepCheatsheetSections', () => {
  it('builds grouped sections, guidance, and deck-level tactical sections', () => {
    const sections = derivePrepCheatsheetSections(deck)

    expect(sections.map((section) => section.id)).toEqual([
      'overview',
      'intel',
      'opener',
      'behavioral',
      'project',
      'technical',
      'situational',
      'questions',
      'donts',
      'metrics',
      'warnings',
    ])

    expect(sections.map((section) => section.group)).toEqual([
      'Intel',
      'Intel',
      'Core',
      'Core',
      'Core',
      'Technical',
      'Technical',
      'Tactical',
      'Tactical',
      'Tactical',
      'Tactical',
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

    expect(sections.find((section) => section.id === 'opener')?.guidance).toBe('Lead with relevance')
    expect(sections.find((section) => section.id === 'questions')?.guidance).toBe(
      'Pick 2-3. Save 8-10 minutes for questions.',
    )
    expect(sections.find((section) => section.id === 'technical')?.guidance).toBe('Call out tradeoffs')
    expect(sections.find((section) => section.id === 'situational')?.guidance).toBe('State assumptions')

    expect(sections.find((section) => section.id === 'questions')?.items).toEqual([
      expect.objectContaining({
        id: 'question-what-should-i-prioritize-in-the-first-90-days',
        title: 'What should I prioritize in the first 90 days?',
        detail: 'Listen for operating cadence and metrics.',
      }),
      expect.objectContaining({
        id: 'question-how-does-the-team-define-success',
        title: 'How does the team define success?',
        detail: 'Understand what the hiring manager values.',
      }),
    ])

    expect(sections.find((section) => section.id === 'donts')?.items).toEqual([
      expect.objectContaining({ id: 'dont-ramble', title: 'Ramble' }),
      expect.objectContaining({ id: 'dont-skip-the-ask', title: 'Skip the ask' }),
    ])

    const openerItem = sections.find((section) => section.id === 'opener')?.items[0]
    expect(openerItem).toMatchObject({
      id: 'opener-1',
      title: 'Tell me about yourself',
      cardId: 'opener-1',
      category: 'opener',
      detail: 'I build resilient backend systems and improve developer workflows.',
    })
    expect(openerItem).not.toHaveProperty('keyPoints')
    expect(openerItem).not.toHaveProperty('storyBlocks')
    expect(openerItem).not.toHaveProperty('metrics')
  })

  it('omits empty tactical sections and keeps overview only when the deck is blank', () => {
    const sections = derivePrepCheatsheetSections({
      ...deck,
      companyResearch: undefined,
      skillMatch: undefined,
      notes: undefined,
      jobDescription: undefined,
      positioning: undefined,
      donts: [],
      questionsToAsk: [],
      cards: [],
    })

    expect(sections.map((section) => section.id)).toEqual(['overview'])
    expect(sections[0].group).toBe('Intel')
  })
})
