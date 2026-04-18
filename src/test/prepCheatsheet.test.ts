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
  numbersToKnow: {
    candidate: [
      { id: 'candidate-1', value: '38%', label: 'Incident reduction' },
      { id: 'candidate-2', value: '12', label: 'Pipelines owned' },
    ],
    company: [
      { id: 'company-1', value: '3', label: 'Core platform bets' },
    ],
  },
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
      id: 'opener-2',
      category: 'opener',
      title: 'Why this role/company?',
      tags: ['opener', 'motivation'],
      script: 'This role sits at the intersection of platform depth, product leverage, and the systems work I want to keep doing.',
      notes: 'Bridge your recent work into the company priorities.',
      conditionals: [
        {
          id: 'opener-2-conditional',
          trigger: 'If they ask why now',
          response: 'Explain why the scope and timing line up with the work you want to keep growing into.',
          tone: 'pivot',
        },
      ],
    },
    {
      id: 'opener-3',
      category: 'opener',
      title: 'Why did you leave your last role?',
      tags: ['opener', 'departure'],
      script: 'I wanted broader platform ownership and more direct product impact than the role could realistically offer.',
      notes: 'Keep the answer positive and future-focused.',
      warning: 'Do not turn this into a complaint about the prior company.',
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
      'opener-1',
      'opener-2',
      'opener-3',
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
      'Openers',
      'Openers',
      'Openers',
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

    expect(sections.find((section) => section.id === 'questions')?.guidance).toBe(
      'Pick 2-3. Save 8-10 minutes for questions.',
    )
    expect(sections.find((section) => section.id === 'technical')?.guidance).toBe('Call out tradeoffs')
    expect(sections.find((section) => section.id === 'situational')?.guidance).toBe('State assumptions')
    expect(sections.find((section) => section.id === 'opener-1')?.guidance).toContain('Lead with the through-line')
    expect(sections.find((section) => section.id === 'opener-1')?.guidance).toContain('Lead with relevance')
    expect(sections.find((section) => section.id === 'opener-2')?.group).toBe('Openers')
    expect(sections.find((section) => section.id === 'opener-3')?.title).toBe('Why did you leave your last role?')
    expect(sections.find((section) => section.id === 'opener-1')?.sectionCategory).toBe('opener')

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

    expect(sections.find((section) => section.id === 'metrics')).toMatchObject({
      title: 'Numbers to Know',
      items: [
        expect.objectContaining({
          id: 'numbers-your-work',
          title: 'Your Work',
          metrics: [
            expect.objectContaining({ value: '38%', label: 'Incident reduction' }),
            expect.objectContaining({ value: '12', label: 'Pipelines owned' }),
          ],
        }),
        expect.objectContaining({
          id: 'numbers-their-company',
          title: 'Their Company',
          metrics: [expect.objectContaining({ value: '3', label: 'Core platform bets' })],
        }),
        expect.objectContaining({
          id: 'metrics-1',
          title: 'Key numbers to remember',
        }),
      ],
    })

    const openerItem = sections.find((section) => section.id === 'opener-1')?.items[0]
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

  it('preserves distinct opener cards even when they normalize to the same canonical title', () => {
    const sections = derivePrepCheatsheetSections({
      ...deck,
      cards: [
        ...deck.cards,
        {
          id: 'opener-4',
          category: 'opener',
          title: 'Walk me through your background',
          tags: ['intro'],
          script: 'I grew from infra work into product-facing platform leadership.',
          notes: 'Use this version when they ask for the longer intro.',
        },
      ],
    })

    const tellMeAboutYourselfSections = sections.filter((section) => section.title === 'Tell me about yourself')
    expect(tellMeAboutYourselfSections).toHaveLength(2)
    expect(tellMeAboutYourselfSections.map((section) => section.id)).toEqual([
      'opener-1',
      'opener-4',
    ])
  })

  it('classifies departure openers by title even without explicit departure tags', () => {
    const sections = derivePrepCheatsheetSections({
      ...deck,
      cards: deck.cards.map((card) => (
        card.id === 'opener-3'
          ? {
              ...card,
              tags: ['opener'],
            }
          : card
      )),
    })

    const departureSection = sections.find((section) => section.items.some((item) => item.id === 'opener-3'))
    expect(departureSection?.title).toBe('Why did you leave your last role?')
    expect(departureSection?.openerKind).toBe('why-did-you-leave')
  })

  it('does not double-prefix opener section ids when card ids already use the opener prefix', () => {
    const sections = derivePrepCheatsheetSections(deck)

    expect(sections.find((section) => section.id === 'opener-opener-1')).toBeUndefined()
    expect(sections.find((section) => section.id === 'opener-1')?.items[0]?.cardId).toBe('opener-1')
  })

  it('omits empty tactical sections and keeps overview only when the deck is blank', () => {
    const sections = derivePrepCheatsheetSections({
      ...deck,
      companyResearch: undefined,
      skillMatch: undefined,
      notes: undefined,
      jobDescription: undefined,
      positioning: undefined,
      numbersToKnow: undefined,
      donts: [],
      questionsToAsk: [],
      cards: [],
    })

    expect(sections.map((section) => section.id)).toEqual(['overview'])
    expect(sections[0].group).toBe('Intel')
  })
})
