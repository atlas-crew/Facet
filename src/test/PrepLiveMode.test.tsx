// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PrepLiveMode } from '../routes/prep/PrepLiveMode'
import type { PrepDeck } from '../types/prep'

const mockDeck: PrepDeck = {
  id: 'deck-1',
  title: 'Acme Staff Engineer Prep',
  company: 'Acme',
  role: 'Staff Engineer',
  vectorId: 'backend',
  pipelineEntryId: 'pipe-1',
  companyResearch: 'Acme is investing heavily in developer tooling.',
  skillMatch: 'platform leadership, distributed systems',
  notes: 'Lead with reliability wins.',
  jobDescription: 'Build platform tooling and improve developer velocity.',
  categoryGuidance: {
    opener: 'Keep the opening answer under two minutes and land on your through-line.',
    behavioral: 'Anchor each behavioral answer in one decision you owned.',
    technical: 'Name the signal, likely failure domain, and the next verification step.',
    questions: 'Pick 2-3. Save 8-10 minutes for questions.',
  },
  donts: ['Do not spend too long on the setup before the answer.', 'Do not overclaim ownership on shared work.'],
  questionsToAsk: [
    { question: 'What does success look like in 90 days?', context: 'Use this to learn the evaluation criteria.' },
    { question: 'Which team would I partner with most closely?', context: 'Useful for scope and cross-functional context.' },
  ],
  numbersToKnow: {
    candidate: [
      { id: 'metric-candidate-1', value: '38%', label: 'Incident reduction' },
      { id: 'metric-candidate-2', value: '12', label: 'Pipelines owned' },
    ],
    company: [
      { id: 'metric-company-1', value: '3', label: 'Core platform bets' },
    ],
  },
  stackAlignment: [
    {
      theirTech: 'Kubernetes',
      yourMatch: 'Built and operated shared platform clusters.',
      confidence: 'Strong',
    },
    {
      theirTech: 'Terraform',
      yourMatch: 'Built shared modules and review guardrails.',
      confidence: 'Solid',
    },
    {
      theirTech: 'Go',
      yourMatch: 'Mostly adjacent systems debugging experience.',
      confidence: 'Adjacent experience',
    },
    {
      theirTech: 'Rust',
      yourMatch: 'No direct production usage yet.',
      confidence: 'Gap',
    },
  ],
  updatedAt: '2026-04-14T17:00:00.000Z',
  cards: [
    {
      id: 'card-1',
      category: 'opener',
      title: 'Tell me about yourself',
      tags: ['intro'],
      script: 'I lead backend platform work and enjoy scaling teams and systems.',
      notes: 'Lead with the platform angle and keep it under two minutes.',
      keyPoints: ['Scale', 'Ownership', 'Outcome'],
      storyBlocks: [
        { label: 'problem', text: 'Platform was slowing product teams.' },
        { label: 'solution', text: 'Built shared tooling and guardrails.' },
        { label: 'result', text: 'Reduced lead time by 45%.' },
      ],
    },
    {
      id: 'card-1b',
      category: 'opener',
      title: 'Why this role/company?',
      tags: ['motivation'],
      script: 'This role connects the platform work I already love with a product scope that is still growing fast.',
      notes: 'Bridge your recent wins into the company priorities and this team’s scope.',
      warning: 'Do not make this sound interchangeable with any other staff role.',
      conditionals: [
        { id: 'conditional-1b', trigger: 'If they ask why now', response: 'Explain why the timing and scope line up with the work you want to keep doing.', tone: 'pivot' },
      ],
    },
    {
      id: 'card-1c',
      category: 'opener',
      title: 'Why did you leave your last role?',
      tags: ['departure'],
      script: 'I wanted broader platform ownership and more direct product impact than the role could realistically offer.',
      notes: 'Keep it positive and future-focused.',
      warning: 'Do not drift into complaining about the prior company.',
      conditionals: [
        { id: 'conditional-1c', trigger: 'If they push on conflict', response: 'Acknowledge the fit change plainly, then return to the growth you were looking for.', tone: 'escalation' },
      ],
    },
    {
      id: 'card-2',
      category: 'behavioral',
      title: 'Describe a hard stakeholder moment',
      tags: ['stakeholders'],
      script: 'I aligned engineering and product on a reliability roadmap.',
      warning: 'Do not frame product as the enemy.',
      conditionals: [
        { id: 'conditional-1', trigger: 'If they push on ownership', response: 'Acknowledge the shared work, then narrow to your decisions.', tone: 'pivot' },
        { id: 'conditional-2', trigger: 'Were you just reacting late?', response: 'Name the signal, the decision, and the prevention step.', tone: 'trap' },
        { id: 'conditional-3', trigger: 'If they push on residual risk', response: 'Be explicit about what you escalated and what you would verify next.', tone: 'escalation' },
      ],
      storyBlocks: [
        { label: 'problem', text: 'A launch was blocked by missing reliability work.' },
        { label: 'solution', text: 'Reframed the discussion around customer impact.' },
        { label: 'closer', text: 'We agreed on a shared plan and shipped together.' },
      ],
    },
    {
      id: 'card-3',
      category: 'technical',
      title: 'How do you debug a flaky distributed system?',
      tags: ['debugging'],
      script: 'Start with blast radius, recent changes, and observability gaps.',
      warning: 'Avoid guessing at the root cause before you check the logs, deploy timeline, or rollback plan.',
      keyPoints: ['Check the blast radius', 'Reproduce the issue', 'Compare deploys'],
    },
    {
      id: 'card-4',
      category: 'project',
      title: 'A project you are proud of',
      tags: ['ownership'],
      script: 'I led a migration that cut deploy time in half.',
      notes: 'Use this when they ask about your biggest win.',
      storyBlocks: [
        { label: 'problem', text: 'Deploys were slow and risky.' },
        { label: 'solution', text: 'Split the rollout into smaller reversible steps.' },
        { label: 'result', text: 'Deploy time dropped from 40 minutes to 20 minutes.' },
      ],
    },
    {
      id: 'card-5',
      category: 'metrics',
      title: 'Reliability metrics',
      tags: ['outcomes'],
      metrics: [
        { value: '99.95%', label: 'Uptime' },
        { value: '45%', label: 'MTTR cut' },
      ],
      notes: 'Keep the denominator ready.',
    },
    {
      id: 'card-6',
      category: 'situational',
      title: 'A tradeoff scenario',
      tags: ['judgment'],
      script: 'I would optimize for customer impact first.',
      warning: 'Do not over-rotate into hypotheticals without data.',
    },
  ],
}

const alternateDeck: PrepDeck = {
  ...mockDeck,
  id: 'deck-2',
  title: 'Beacon Engineering Manager Prep',
  company: 'Beacon',
  role: 'Engineering Manager',
  notes: 'Lead with team-building and execution clarity.',
  cards: [
    {
      id: 'alt-card-1',
      category: 'opener',
      title: 'Tell me about yourself',
      tags: ['intro'],
      script: 'I build product engineering teams that deliver clean execution under pressure.',
      notes: 'Keep the focus on management scope and cross-functional trust.',
    },
    {
      id: 'alt-card-2',
      category: 'behavioral',
      title: 'Coach through a scope disagreement',
      tags: ['coaching'],
      script: 'I clarify the decision owner, tradeoffs, and what success looks like by the end of the conversation.',
      notes: 'Stay specific about coaching and decision-making.',
    },
  ],
}

function getSectionContainer(title: string) {
  const heading = screen
    .getAllByRole('heading', { name: title })
    .find((candidate) => candidate.closest('.prep-live-section'))
  return heading?.closest('.prep-live-section') ?? null
}

describe('PrepLiveMode', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('renders grouped rich content from the deck', () => {
    const { container } = render(<PrepLiveMode deck={mockDeck} />)

    expect(screen.getByLabelText('Live cheatsheet mode')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Warm-up notes' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Answer bank' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Intel' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Openers' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Core' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Technical' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Tactical' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Questions to Ask' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: "Don'ts" })).toBeTruthy()
    expect(screen.getByText('Your Work')).toBeTruthy()
    expect(screen.getByText('Their Company')).toBeTruthy()
    expect(screen.getByText('Incident reduction')).toBeTruthy()
    expect(screen.getByText('Core platform bets')).toBeTruthy()
    expect(getSectionContainer('Tell me about yourself')).toBeTruthy()
    expect(getSectionContainer('Why this role/company?')).toBeTruthy()
    expect(getSectionContainer('Why did you leave your last role?')).toBeTruthy()
    expect(screen.getByText('Scale')).toBeTruthy()
    expect(screen.getByText('Pick 2-3. Save 8-10 minutes for questions.')).toBeTruthy()
    expect(screen.getByText('Do not spend too long on the setup before the answer.')).toBeTruthy()
    expect(screen.getByText('99.95%')).toBeTruthy()
    expect(screen.getByText('Lead with reliability wins.')).toBeTruthy()
    expect(getSectionContainer('Tell me about yourself')?.textContent).toContain('Keep the opening answer under two minutes')
    expect(getSectionContainer('Tell me about yourself')?.textContent).toContain('Lead with the platform angle')
    expect(getSectionContainer('Why this role/company?')?.textContent).toContain('Do not make this sound interchangeable')
    expect(getSectionContainer('Why did you leave your last role?')?.textContent).toContain('Keep it positive and future-focused')
    expect(getSectionContainer('Behavioral Stories')?.textContent).toContain('Anchor each behavioral answer in one decision you owned.')
    expect(getSectionContainer('Behavioral Stories')?.textContent).toContain('If they push on ownership')
    expect(getSectionContainer('Behavioral Stories')?.textContent).toContain('Acknowledge the shared work, then narrow to your decisions.')
    expect(getSectionContainer('Behavioral Stories')?.textContent).toContain('Trap')
    expect(getSectionContainer('Behavioral Stories')?.textContent).toContain('Reframe')
    expect(screen.getAllByText('Do not frame product as the enemy.')).toHaveLength(2)
    expect(screen.getAllByText('Avoid guessing at the root cause before you check the logs, deploy timeline, or rollback plan.')).toHaveLength(2)
    expect(screen.getAllByText('Do not over-rotate into hypotheticals without data.')).toHaveLength(2)
    expect(getSectionContainer('Technical Topics')?.textContent).toContain('Name the signal, likely failure domain, and the next verification step.')
    expect(getSectionContainer('Technical Topics')?.textContent).toContain('How do you debug a flaky distributed system?')
    expect(getSectionContainer('Technical Topics')?.textContent).not.toContain('Tell me about yourself')
    expect(screen.getByText('Build platform tooling and improve developer velocity.')).toBeTruthy()
    expect(screen.getByText('platform leadership, distributed systems')).toBeTruthy()
    expect(screen.getByText('Acme Staff Engineer Prep')).toBeTruthy()
    expect(screen.getAllByText('opener').length).toBeGreaterThan(0)

    const shortcutBar = container.querySelector('.prep-live-kbd-bar')
    expect(shortcutBar?.textContent).toContain('Q / D / M / W')
    expect(shortcutBar?.textContent).toContain('Space')
    expect(shortcutBar?.textContent).toContain('R')
    expect(shortcutBar?.textContent).toContain('J / K')
    expect(shortcutBar?.textContent).toContain('/')
    expect(shortcutBar?.textContent).toContain('3 / 4 / 5')
    expect(shortcutBar?.textContent).toContain('6 / 7 / 8 / 9')

    expect(container.querySelectorAll('.prep-live-section-opener .prep-live-budget-badge')).toHaveLength(3)
    expect(getSectionContainer('Questions to Ask')?.querySelector('.prep-live-budget-badge')).toBeNull()
    expect(getSectionContainer("Don'ts")?.querySelector('.prep-live-budget-badge')).toBeNull()
    expect(getSectionContainer('Your Work')?.querySelector('.prep-live-budget-badge')).toBeNull()
    expect(getSectionContainer('Reliability metrics')?.querySelector('.prep-live-budget-badge')).toBeNull()
  })

  it('supports search, timer, and section shortcuts', () => {
    const { container } = render(<PrepLiveMode deck={mockDeck} />)

    fireEvent.keyDown(document.body, { key: '/' })
    expect(document.activeElement).toBe(screen.getByRole('searchbox', { name: 'Search cheatsheet' }))

    fireEvent.keyDown(document.body, { key: ' ' })
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.getByText('00:02')).toBeTruthy()

    fireEvent.keyDown(document.body, { key: ' ' })
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByText('00:02')).toBeTruthy()

    fireEvent.keyDown(document.body, { key: 'R' })
    expect(screen.getByText('00:00')).toBeTruthy()

    const expectedSectionShortcuts = [
      ['Q', 'Questions to Ask'],
      ['D', "Don'ts"],
      ['M', 'Numbers to Know'],
      ['W', 'Risks and Reminders'],
      ['3', 'Tell me about yourself'],
      ['4', 'Why this role/company?'],
      ['5', 'Why did you leave your last role?'],
      ['6', 'Behavioral Stories'],
      ['7', 'Projects'],
      ['8', 'Technical Topics'],
      ['9', 'Situational Drills'],
    ] as const

    expectedSectionShortcuts.forEach(([key, title]) => {
      fireEvent.keyDown(document.body, { key })
      expect(container.querySelector('.prep-live-nav-link-active')?.textContent).toContain(title)
    })

    fireEvent.keyDown(document.body, { key: '7' })
    expect(container.querySelector('.prep-live-nav-link-active')?.textContent).toContain('Projects')

    fireEvent.keyDown(document.body, { key: 'J' })
    expect(container.querySelector('.prep-live-nav-link-active')?.textContent).toContain('Technical Topics')

    fireEvent.keyDown(document.body, { key: 'K' })
    expect(container.querySelector('.prep-live-nav-link-active')?.textContent).toContain('Projects')
  })

  it('resets the timer from the visible control', () => {
    render(<PrepLiveMode deck={mockDeck} />)

    fireEvent.click(screen.getByRole('button', { name: 'Start timer' }))
    act(() => {
      vi.advanceTimersByTime(2000)
    })

    const resetButton = screen.getByRole('button', { name: 'Reset timer' })
    fireEvent.click(resetButton)
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByText('00:00')).toBeTruthy()
  })

  it('starts the timer from the visible control', () => {
    render(<PrepLiveMode deck={mockDeck} />)

    fireEvent.click(screen.getByRole('button', { name: 'Start timer' }))
    act(() => {
      vi.advanceTimersByTime(2000)
    })

    expect(screen.getByText('00:02')).toBeTruthy()
  })

  it('does not start the timer when space is pressed on a non-timer button', () => {
    render(<PrepLiveMode deck={mockDeck} />)

    const collapseButton = screen.getByRole('button', { name: 'Collapse pre-interview' })
    collapseButton.focus()
    fireEvent.keyDown(collapseButton, { key: ' ', code: 'Space' })
    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(screen.getByText('00:00')).toBeTruthy()
  })

  it('starts the timer when the visible timer display is clicked', () => {
    render(<PrepLiveMode deck={mockDeck} />)

    fireEvent.click(screen.getByRole('timer'))
    act(() => {
      vi.advanceTimersByTime(2000)
    })

    expect(screen.getByText('00:02')).toBeTruthy()
  })

  it('resumes the timer from the paused value', () => {
    render(<PrepLiveMode deck={mockDeck} />)

    fireEvent.keyDown(document.body, { key: ' ' })
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    fireEvent.keyDown(document.body, { key: ' ' })
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    fireEvent.keyDown(document.body, { key: ' ' })
    act(() => {
      vi.advanceTimersByTime(3000)
    })

    expect(screen.getByText('00:05')).toBeTruthy()
  })

  it('narrows search results to matching items inside a section', () => {
    render(<PrepLiveMode deck={mockDeck} />)

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search cheatsheet' }), {
      target: { value: '90 days' },
    })

    expect(screen.getByRole('heading', { name: 'Questions to Ask' })).toBeTruthy()
    expect(screen.getByText('What does success look like in 90 days?')).toBeTruthy()
    expect(screen.queryByText('Which team would I partner with most closely?')).toBeNull()
  })

  it('filters sections by rich card content and restores them when search is cleared', () => {
    render(<PrepLiveMode deck={mockDeck} />)

    const searchInput = screen.getByRole('searchbox', { name: 'Search cheatsheet' })
    fireEvent.change(searchInput, { target: { value: 'blast radius' } })

    expect(screen.getByRole('heading', { name: 'Technical Topics' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Behavioral Stories' })).toBeNull()
    expect(screen.getAllByText('Avoid guessing at the root cause before you check the logs, deploy timeline, or rollback plan.')).toHaveLength(2)

    fireEvent.keyDown(searchInput, { key: 'Escape' })

    expect(screen.getByRole('heading', { name: 'Behavioral Stories' })).toBeTruthy()
    expect(getSectionContainer('Tell me about yourself')).toBeTruthy()
  })

  it('matches search queries regardless of case or surrounding whitespace', () => {
    render(<PrepLiveMode deck={mockDeck} />)

    const searchInput = screen.getByRole('searchbox', { name: 'Search cheatsheet' })
    fireEvent.change(searchInput, { target: { value: 'BLAST RADIUS' } })
    expect(screen.getByRole('heading', { name: 'Technical Topics' })).toBeTruthy()

    fireEvent.change(searchInput, { target: { value: '  blast radius  ' } })
    expect(screen.getByRole('heading', { name: 'Technical Topics' })).toBeTruthy()
  })

  it('treats whitespace-only search queries as empty', () => {
    render(<PrepLiveMode deck={mockDeck} />)

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search cheatsheet' }), {
      target: { value: '   ' },
    })

    expect(screen.getByRole('heading', { name: 'Behavioral Stories' })).toBeTruthy()
    expect(screen.queryByText('No cheatsheet sections match that search')).toBeNull()
  })

  it('hides draft-only rich rows in live card rendering and search', () => {
    const draftDeck: PrepDeck = {
      ...mockDeck,
      companyResearch: undefined,
      notes: undefined,
      cards: mockDeck.cards.map((card) => (
        card.id === 'card-1'
          ? {
              ...card,
              notes: undefined,
              keyPoints: ['Scale', ''],
              storyBlocks: [
                { label: 'problem' as const, text: 'Platform was slowing product teams.' },
                { label: 'note' as const, text: '' },
              ],
              conditionals: [
                { id: 'conditional-1', trigger: 'If they push on ownership', response: 'Name the decisions you owned.', tone: 'pivot' as const },
                { id: 'conditional-2', trigger: 'If they trap you', response: '', tone: 'trap' as const },
              ],
              metrics: [
                { value: '45%', label: 'Lead time cut' },
                { value: '', label: '' },
              ],
            }
          : {
              ...card,
              notes: undefined,
            }
      )).filter((card) => card.id === 'card-1'),
    }

    const { container } = render(<PrepLiveMode deck={draftDeck} />)

    const openerSection = getSectionContainer('Tell me about yourself')
    expect(openerSection?.querySelectorAll('.prep-live-keypoint')).toHaveLength(1)
    expect(openerSection?.querySelectorAll('.prep-live-story-block')).toHaveLength(1)
    expect(openerSection?.textContent).toContain('If they push on ownership')
    expect(openerSection?.querySelectorAll('.prep-live-stat-box')).toHaveLength(1)

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search cheatsheet' }), {
      target: { value: 'lead time cut' },
    })
    expect(container.querySelector('.prep-live-nav-link-active')?.textContent).toContain('Tell me about yourself')

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search cheatsheet' }), {
      target: { value: 'name the decisions you owned' },
    })
    expect(container.querySelector('.prep-live-nav-link-active')?.textContent).toContain('Tell me about yourself')

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search cheatsheet' }), {
      target: { value: 'note' },
    })
    expect(screen.queryByRole('heading', { name: 'Tell me about yourself' })).toBeNull()
  })

  it('marks placeholder-heavy cards with a review badge and review surface styling', () => {
    const needsReviewDeck: PrepDeck = {
      ...mockDeck,
      cards: [
        {
          ...mockDeck.cards[0],
          title: 'Why this role',
          script: '[[needs-review]] tighten the company-specific motivation.',
          notes: '[[fill-in: exact product area]]',
        },
      ],
    }

    const { container } = render(<PrepLiveMode deck={needsReviewDeck} />)

    expect(screen.getAllByText('Needs Review').length).toBeGreaterThan(0)
    expect(container.querySelector('.prep-live-review-surface')).toBeTruthy()
  })

  it('does not show review styling when the deck has no placeholder markers', () => {
    const { container } = render(<PrepLiveMode deck={mockDeck} />)

    expect(screen.queryByText('Needs Review')).toBeNull()
    expect(container.querySelector('.prep-live-review-surface')).toBeNull()
  })

  it('renders conditional tone labels for pivot, trap, and escalation guidance', () => {
    render(<PrepLiveMode deck={mockDeck} />)

    const pivotConditional = screen.getAllByText('If they push on ownership')[0]?.closest('.prep-live-conditional')
    const trapConditional = screen.getAllByText('Were you just reacting late?')[0]?.closest('.prep-live-conditional')
    const escalationConditional = screen.getAllByText('If they push on residual risk')[0]?.closest('.prep-live-conditional')

    expect(pivotConditional?.textContent).toContain('Pivot')
    expect(trapConditional?.textContent).toContain('Trap')
    expect(trapConditional?.textContent).toContain('Reframe')
    expect(escalationConditional?.textContent).toContain('Escalation')
    expect(escalationConditional?.textContent).not.toContain('Reframe')
  })

  it('collapses and expands a rich section', () => {
    render(<PrepLiveMode deck={mockDeck} />)

    const technicalToggle = screen
      .getByRole('heading', { name: 'Technical Topics' })
      .closest('.prep-live-section')
      ?.querySelector('button')

    expect(technicalToggle).toBeTruthy()
    const controlledId = technicalToggle?.getAttribute('aria-controls')
    expect(controlledId).toBeTruthy()

    const controlledSection = document.getElementById(controlledId!)
    expect(controlledSection?.hasAttribute('hidden')).toBe(false)

    fireEvent.click(technicalToggle!)
    expect(technicalToggle?.getAttribute('aria-expanded')).toBe('false')
    expect(controlledSection?.hasAttribute('hidden')).toBe(true)

    fireEvent.click(technicalToggle!)
    expect(controlledSection?.hasAttribute('hidden')).toBe(false)
  })

  it('ignores live shortcuts while typing in the search input', () => {
    const { container } = render(<PrepLiveMode deck={mockDeck} />)

    fireEvent.keyDown(document.body, { key: 'Q' })
    expect(container.querySelector('.prep-live-nav-link-active')?.textContent).toContain('Questions to Ask')

    const searchInput = screen.getByRole('searchbox', { name: 'Search cheatsheet' })
    searchInput.focus()

    fireEvent.keyDown(searchInput, { key: '7' })
    expect(container.querySelector('.prep-live-nav-link-active')?.textContent).toContain('Questions to Ask')

    fireEvent.keyDown(searchInput, { key: 'E' })
    expect(getSectionContainer('Questions to Ask')?.querySelector('[hidden]')).toBeNull()

    fireEvent.keyDown(searchInput, { key: ' ' })
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.getByText('00:00')).toBeTruthy()
  })

  it('shows the empty search state when no sections match', () => {
    render(<PrepLiveMode deck={mockDeck} />)

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search cheatsheet' }), {
      target: { value: 'totally missing term' },
    })

    expect(screen.getByText('No cheatsheet sections match that search')).toBeTruthy()
    expect(screen.getByText('Clear the search to get the full interview view back.')).toBeTruthy()
  })

  it('ignores J and K navigation when search results are empty', () => {
    render(<PrepLiveMode deck={mockDeck} />)

    const searchInput = screen.getByRole('searchbox', { name: 'Search cheatsheet' })
    fireEvent.change(searchInput, { target: { value: 'totally missing term' } })

    expect(screen.getByText('No cheatsheet sections match that search')).toBeTruthy()
    expect(() => {
      fireEvent.keyDown(document.body, { key: 'J' })
      fireEvent.keyDown(document.body, { key: 'K' })
    }).not.toThrow()
    expect(screen.getByText('No cheatsheet sections match that search')).toBeTruthy()
  })

  it('searches follow-ups, deep dives, conditionals, and table content from the source card', () => {
    const supportingDeck: PrepDeck = {
      ...mockDeck,
      cards: [
        {
          ...mockDeck.cards[0],
          followUps: [{ id: 'follow-up-1', question: 'What changed after launch?', answer: 'We held the rollback line.' }],
          deepDives: [{ id: 'deep-dive-1', title: 'Incident review', content: 'Covered the rollback decision tree.' }],
          conditionals: [{ id: 'conditional-1', trigger: 'If they push on risk', response: 'Name the mitigation and rollback path.', tone: 'pivot' }],
          tableData: {
            headers: ['Signal', 'Action'],
            rows: [['pager spike', 'throttle retries']],
          },
        },
      ],
    }

    render(<PrepLiveMode deck={supportingDeck} />)

    const openerSection = getSectionContainer('Tell me about yourself')
    expect(openerSection?.textContent).toContain('What changed after launch?')
    expect(openerSection?.textContent).toContain('We held the rollback line.')
    expect(openerSection?.textContent).toContain('Incident review')
    expect(openerSection?.textContent).toContain('Covered the rollback decision tree.')
    expect(openerSection?.textContent).toContain('Signal')
    expect(openerSection?.textContent).toContain('pager spike')

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search cheatsheet' }), {
      target: { value: 'rollback decision tree' },
    })
    expect(screen.getByRole('heading', { name: 'Openers' })).toBeTruthy()

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search cheatsheet' }), {
      target: { value: 'pager spike' },
    })
    expect(screen.getByRole('heading', { name: 'Openers' })).toBeTruthy()

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search cheatsheet' }), {
      target: { value: 'held the rollback line' },
    })
    expect(screen.getByRole('heading', { name: 'Openers' })).toBeTruthy()

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search cheatsheet' }), {
      target: { value: 'mitigation and rollback path' },
    })
    expect(screen.getByRole('heading', { name: 'Openers' })).toBeTruthy()
  })

  it('reopens pre-interview sections when a shortcut jumps into them', () => {
    const { container } = render(<PrepLiveMode deck={mockDeck} />)

    fireEvent.click(screen.getByRole('button', { name: 'Collapse pre-interview' }))
    expect(screen.getByText('Pre-interview sections are collapsed. Expand them when you want the setup notes.')).toBeTruthy()

    fireEvent.keyDown(document.body, { key: 'Q' })

    expect(screen.queryByText('Pre-interview sections are collapsed. Expand them when you want the setup notes.')).toBeNull()
    expect(container.querySelector('.prep-live-nav-link-active')?.textContent).toContain('Questions to Ask')
  })

  it('moves focus into the target section after a keyboard jump', () => {
    render(<PrepLiveMode deck={mockDeck} />)

    fireEvent.keyDown(document.body, { key: '7' })

    const projectSection = getSectionContainer('Projects')
    expect(projectSection).toBeTruthy()
    expect(document.activeElement?.closest('.prep-live-section')).toBe(projectSection)
  })

  it('auto-expands matching sections while search is active', () => {
    render(<PrepLiveMode deck={mockDeck} />)

    const technicalToggle = screen
      .getByRole('heading', { name: 'Technical Topics' })
      .closest('.prep-live-section')
      ?.querySelector('button')
    const technicalSection = getSectionContainer('Technical Topics')
    const technicalBody = technicalSection?.querySelector('.prep-live-item-list-rich')

    fireEvent.click(technicalToggle!)
    expect(technicalBody?.hasAttribute('hidden')).toBe(true)

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search cheatsheet' }), {
      target: { value: 'blast radius' },
    })

    expect(technicalBody?.hasAttribute('hidden')).toBe(false)
    expect(screen.getAllByText('Check the blast radius').length).toBeGreaterThan(0)
  })

  it('supports home/end navigation and clamps movement at the boundaries', () => {
    const { container } = render(<PrepLiveMode deck={mockDeck} />)

    fireEvent.keyDown(document.body, { key: 'End' })
    expect(container.querySelector('.prep-live-nav-link-active')?.textContent).toContain('Risks and Reminders')

    fireEvent.keyDown(document.body, { key: 'J' })
    expect(container.querySelector('.prep-live-nav-link-active')?.textContent).toContain('Risks and Reminders')

    fireEvent.keyDown(document.body, { key: 'Home' })
    expect(container.querySelector('.prep-live-nav-link-active')?.textContent).toContain('Overview')

    fireEvent.keyDown(document.body, { key: 'K' })
    expect(container.querySelector('.prep-live-nav-link-active')?.textContent).toContain('Overview')
  })

  it('supports lowercase shortcuts and ignores modified shortcuts', () => {
    const { container } = render(<PrepLiveMode deck={mockDeck} />)

    fireEvent.keyDown(document.body, { key: 'q' })
    expect(container.querySelector('.prep-live-nav-link-active')?.textContent).toContain('Questions to Ask')

    fireEvent.click(screen.getByRole('button', { name: 'Start timer' }))
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.getByText('00:02')).toBeTruthy()

    fireEvent.keyDown(document.body, { key: 'r', metaKey: true })
    expect(screen.getByText('00:02')).toBeTruthy()
  })

  it('ignores shift-modified shortcut keys that would collide with browser defaults', () => {
    const { container } = render(<PrepLiveMode deck={mockDeck} />)

    fireEvent.keyDown(document.body, { key: ' ', code: 'Space', shiftKey: true })
    fireEvent.keyDown(document.body, { key: '&', code: 'Digit7', shiftKey: true })
    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(screen.getByText('00:00')).toBeTruthy()
    expect(container.querySelector('.prep-live-nav-link-active')?.textContent).toContain('Overview')
  })

  it('ignores section shortcuts when ctrl or alt modifiers are held', () => {
    const { container } = render(<PrepLiveMode deck={mockDeck} />)

    expect(container.querySelector('.prep-live-nav-link-active')?.textContent).toContain('Overview')

    fireEvent.keyDown(document.body, { key: 'q', ctrlKey: true })
    fireEvent.keyDown(document.body, { key: '7', altKey: true })

    expect(container.querySelector('.prep-live-nav-link-active')?.textContent).toContain('Overview')
  })

  it('ignores live shortcuts while focus is inside another editable field', () => {
    const { container } = render(<PrepLiveMode deck={mockDeck} />)
    const scratchInput = document.createElement('textarea')
    document.body.appendChild(scratchInput)
    scratchInput.focus()

    fireEvent.keyDown(scratchInput, { key: 'q' })
    expect(container.querySelector('.prep-live-nav-link-active')?.textContent).toContain('Overview')

    scratchInput.blur()
    fireEvent.keyDown(document.body, { key: 'q' })
    expect(container.querySelector('.prep-live-nav-link-active')?.textContent).toContain('Questions to Ask')

    scratchInput.remove()
  })

  it('ignores live shortcuts while focus is inside a contenteditable field', () => {
    const { container } = render(<PrepLiveMode deck={mockDeck} />)
    const editable = document.createElement('div')
    editable.setAttribute('contenteditable', 'true')
    document.body.appendChild(editable)
    editable.focus()

    fireEvent.keyDown(editable, { key: 'q' })
    fireEvent.keyDown(editable, { key: ' ' })
    act(() => {
      vi.advanceTimersByTime(2000)
    })

    expect(container.querySelector('.prep-live-nav-link-active')?.textContent).toContain('Overview')
    expect(screen.getByText('00:00')).toBeTruthy()

    editable.remove()
  })

  it('formats the timer correctly across minute boundaries', () => {
    render(<PrepLiveMode deck={mockDeck} />)

    fireEvent.keyDown(document.body, { key: ' ' })
    act(() => {
      vi.advanceTimersByTime(59000)
    })
    expect(screen.getByText('00:59')).toBeTruthy()

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByText('01:00')).toBeTruthy()

    act(() => {
      vi.advanceTimersByTime(61000)
    })
    expect(screen.getByText('02:01')).toBeTruthy()
  })

  it('formats the timer consistently past one hour', () => {
    render(<PrepLiveMode deck={mockDeck} />)

    fireEvent.keyDown(document.body, { key: ' ' })
    act(() => {
      vi.advanceTimersByTime(3_600_000)
    })

    expect(screen.getByText('60:00')).toBeTruthy()
  })

  it('handles special-character search terms without crashing', () => {
    render(<PrepLiveMode deck={mockDeck} />)

    const searchInput = screen.getByRole('searchbox', { name: 'Search cheatsheet' })

    expect(() => {
      fireEvent.change(searchInput, { target: { value: '[[fill' } })
    }).not.toThrow()
    expect((screen.getByRole('searchbox', { name: 'Search cheatsheet' }) as HTMLInputElement).value).toBe('[[fill')
    expect(screen.getByLabelText('Live cheatsheet mode')).toBeTruthy()

    expect(() => {
      fireEvent.change(searchInput, { target: { value: '(' } })
    }).not.toThrow()
    expect(screen.getByText('No cheatsheet sections match that search')).toBeTruthy()
  })

  it('renders a back control when provided and calls it', () => {
    const onBack = vi.fn()
    render(<PrepLiveMode deck={mockDeck} onBack={onBack} />)

    fireEvent.click(screen.getByRole('button', { name: 'Back to Prep' }))

    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('omits the back control when onBack is not provided', () => {
    render(<PrepLiveMode deck={mockDeck} />)

    expect(screen.queryByRole('button', { name: 'Back to Prep' })).toBeNull()
  })

  it('resets the timer cleanly while it is still running', () => {
    render(<PrepLiveMode deck={mockDeck} />)

    fireEvent.keyDown(document.body, { key: ' ' })
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.getByText('00:02')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Reset timer' }))
    act(() => {
      vi.advanceTimersByTime(2000)
    })

    expect(screen.getByText('00:00')).toBeTruthy()
  })

  it('renders a minimal deck without optional sections', () => {
    render(<PrepLiveMode deck={{
      ...mockDeck,
      companyResearch: undefined,
      skillMatch: undefined,
      notes: undefined,
      jobDescription: undefined,
      categoryGuidance: undefined,
      donts: undefined,
      questionsToAsk: undefined,
      numbersToKnow: undefined,
      cards: [],
    }} />)

    expect(screen.getByRole('heading', { name: 'Answer bank' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Questions to Ask' })).toBeNull()
    expect(screen.queryByRole('heading', { name: "Don'ts" })).toBeNull()
    expect(screen.queryByText('Your Work')).toBeNull()
  })

  it('ignores shortcuts for sections that are not present in the deck', () => {
    const sparseDeck: PrepDeck = {
      ...mockDeck,
      cards: mockDeck.cards.filter((card) => card.category === 'opener'),
      donts: undefined,
      questionsToAsk: undefined,
      numbersToKnow: undefined,
    }
    const { container } = render(<PrepLiveMode deck={sparseDeck} />)

    expect(container.querySelector('.prep-live-nav-link-active')?.textContent).toContain('Overview')

    fireEvent.keyDown(document.body, { key: '8' })
    fireEvent.keyDown(document.body, { key: 'Q' })

    expect(container.querySelector('.prep-live-nav-link-active')?.textContent).toContain('Overview')
  })

  it('renders numbers-to-know sections when only one side is populated', () => {
    const candidateOnlyDeck: PrepDeck = {
      ...mockDeck,
      numbersToKnow: {
        candidate: [{ id: 'metric-candidate-only', value: '45%', label: 'Lead time cut' }],
        company: [],
      },
    }
    const companyOnlyDeck: PrepDeck = {
      ...mockDeck,
      numbersToKnow: {
        candidate: [],
        company: [{ id: 'metric-company-only', value: '2', label: 'Platform priorities' }],
      },
    }

    const { rerender } = render(<PrepLiveMode deck={candidateOnlyDeck} />)
    expect(screen.getByText('Your Work')).toBeTruthy()
    expect(screen.queryByText('Their Company')).toBeNull()

    rerender(<PrepLiveMode deck={companyOnlyDeck} />)
    expect(screen.queryByText('Your Work')).toBeNull()
    expect(screen.getByText('Their Company')).toBeTruthy()
  })

  it('handles decks with undefined cards without throwing', () => {
    expect(() => render(<PrepLiveMode deck={{
      ...mockDeck,
      id: 'deck-without-cards',
      cards: undefined as unknown as PrepDeck['cards'],
    }} />)).not.toThrow()

    expect(screen.getByRole('heading', { name: 'Answer bank' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Technical Topics' })).toBeNull()
  })

  it('keeps sparse decks mounted when only updatedAt changes', () => {
    const sparseDeck: PrepDeck = {
      ...mockDeck,
      id: '',
      title: '',
      company: '',
      role: '',
      pipelineEntryId: null,
      updatedAt: '2026-04-14T17:00:00.000Z',
    }
    const { rerender } = render(<PrepLiveMode deck={sparseDeck} />)

    fireEvent.keyDown(document.body, { key: ' ' })
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search cheatsheet' }), {
      target: { value: 'blast radius' },
    })

    rerender(<PrepLiveMode deck={{ ...sparseDeck, updatedAt: '2026-04-15T17:00:00.000Z' }} />)
    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(screen.getByText('00:02')).toBeTruthy()
    expect(screen.getByDisplayValue('blast radius')).toBeTruthy()
  })

  it('renders malformed table data without crashing', () => {
    const malformedTableDeck: PrepDeck = {
      ...mockDeck,
      cards: mockDeck.cards.map((card) => (
        card.id === 'card-3'
          ? {
              ...card,
              tableData: {
                headers: ['Stage', 'Owner', 'Status'],
                rows: [
                  ['Detect'],
                  [],
                  ['Mitigate', 'Platform', { status: 'Done' } as unknown as string, 'Overflow'],
                ],
              },
            }
          : card
      )),
    }
    const missingRowsDeck: PrepDeck = {
      ...mockDeck,
      cards: mockDeck.cards.map((card) => (
        card.id === 'card-3'
          ? {
              ...card,
              tableData: {
                headers: ['Stage', 'Owner'],
              } as PrepDeck['cards'][number]['tableData'],
            }
          : card
      )),
    }

    expect(() => render(<PrepLiveMode deck={malformedTableDeck} />)).not.toThrow()

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search cheatsheet' }), {
      target: { value: 'mitigate' },
    })

    expect(screen.getByRole('heading', { name: 'Technical Topics' })).toBeTruthy()
    cleanup()
    expect(() => render(<PrepLiveMode deck={missingRowsDeck} />)).not.toThrow()
    expect(screen.getByRole('heading', { name: 'Technical Topics' })).toBeTruthy()
  })

  it('renders stack alignment rows with confidence styling', () => {
    render(<PrepLiveMode deck={mockDeck} />)

    expect(screen.getByRole('heading', { name: 'Numbers to Know' })).toBeTruthy()
    expect(screen.getByText('Their Stack vs Your Match')).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: 'Their Stack' })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: 'Your Match' })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: 'Confidence' })).toBeTruthy()

    expect(screen.getByText('Kubernetes')).toBeTruthy()
    expect(screen.getByText('Built and operated shared platform clusters.')).toBeTruthy()
    expect(screen.getByText('Strong').className).toContain('prep-live-confidence-positive')
    expect(screen.getByText('Solid').className).toContain('prep-live-confidence-positive')
    expect(screen.getByText('Adjacent experience').className).toContain('prep-live-confidence-caution')
    expect(screen.getByText('Gap').className).toContain('prep-live-confidence-gap')
  })

  it('resets transient state when two identity-free decks reuse the live mode component', () => {
    const identityFreeDeckA: PrepDeck = {
      ...mockDeck,
      id: '',
      title: '',
      company: '',
      role: '',
      vectorId: '',
      pipelineEntryId: '',
      generatedAt: undefined,
      cards: [],
    }
    const identityFreeDeckB: PrepDeck = {
      ...identityFreeDeckA,
      title: 'Second transient deck',
      notes: 'Fresh deck object with no stable identity.',
    }

    const { rerender } = render(<PrepLiveMode deck={identityFreeDeckA} />)
    const searchInput = screen.getByRole('searchbox', { name: 'Search cheatsheet' }) as HTMLInputElement

    fireEvent.keyDown(document.body, { key: ' ' })
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    fireEvent.change(searchInput, { target: { value: 'fresh start' } })

    rerender(<PrepLiveMode deck={identityFreeDeckB} />)

    expect(screen.getByText('00:00')).toBeTruthy()
    expect((screen.getByRole('searchbox', { name: 'Search cheatsheet' }) as HTMLInputElement).value).toBe('')
  })

  it('resets transient state when the mounted deck changes', () => {
    const { rerender } = render(<PrepLiveMode deck={mockDeck} />)
    const searchInput = screen.getByRole('searchbox', { name: 'Search cheatsheet' }) as HTMLInputElement

    fireEvent.change(searchInput, { target: { value: 'blast radius' } })
    fireEvent.keyDown(document.body, { key: ' ' })
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.getByText('00:02')).toBeTruthy()
    expect(searchInput.value).toBe('blast radius')

    rerender(<PrepLiveMode deck={alternateDeck} />)

    expect(screen.getByText('00:00')).toBeTruthy()
    expect((screen.getByRole('searchbox', { name: 'Search cheatsheet' }) as HTMLInputElement).value).toBe('')
    expect(screen.getByText('Coach through a scope disagreement')).toBeTruthy()
    expect(screen.queryByText('How do you debug a flaky distributed system?')).toBeNull()
  })

  it('keeps timer and search state when the same deck id rerenders with a new object', () => {
    const { rerender } = render(<PrepLiveMode deck={mockDeck} />)
    const searchInput = screen.getByRole('searchbox', { name: 'Search cheatsheet' }) as HTMLInputElement

    fireEvent.keyDown(document.body, { key: ' ' })
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    fireEvent.change(searchInput, { target: { value: 'blast radius' } })

    rerender(<PrepLiveMode deck={{
      ...mockDeck,
      title: 'Acme Staff Engineer Prep v2',
      company: 'Acme AI',
      role: 'Principal Engineer',
      generatedAt: '2026-04-15T08:00:00.000Z',
      notes: 'Updated note without changing deck identity.',
    }} />)

    expect(screen.getByText('00:02')).toBeTruthy()
    expect((screen.getByRole('searchbox', { name: 'Search cheatsheet' }) as HTMLInputElement).value).toBe('blast radius')
  })

  it('cleans up the timer interval on unmount', () => {
    const createdIntervals: unknown[] = []
    const clearedIntervals: unknown[] = []
    const originalSetInterval = window.setInterval.bind(window)
    const originalClearInterval = window.clearInterval.bind(window)
    const setIntervalSpy = vi.spyOn(window, 'setInterval').mockImplementation(((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
      const intervalId = originalSetInterval(handler, timeout, ...args)
      createdIntervals.push(intervalId)
      return intervalId
    }) as typeof window.setInterval)
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval').mockImplementation(((intervalId?: number) => {
      clearedIntervals.push(intervalId)
      return originalClearInterval(intervalId)
    }) as typeof window.clearInterval)
    const { unmount } = render(<PrepLiveMode deck={mockDeck} />)

    fireEvent.keyDown(document.body, { key: ' ' })
    unmount()

    expect(createdIntervals.length).toBeGreaterThan(0)
    expect(clearedIntervals).toContain(createdIntervals[0])
    expect(clearIntervalSpy).toHaveBeenCalled()
    setIntervalSpy.mockRestore()
    clearIntervalSpy.mockRestore()
  })

  it('removes the global keydown listener on unmount', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener')
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')
    const { unmount } = render(<PrepLiveMode deck={mockDeck} />)

    const keydownHandler = addEventListenerSpy.mock.calls.find(([eventName]) => eventName === 'keydown')?.[1]
    expect(keydownHandler).toBeTruthy()

    unmount()

    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', keydownHandler)
    addEventListenerSpy.mockRestore()
    removeEventListenerSpy.mockRestore()
  })
})
