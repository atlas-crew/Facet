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
    questions: 'Pick 2-3. Save 8-10 minutes for questions.',
  },
  donts: ['Do not spend too long on the setup before the answer.', 'Do not overclaim ownership on shared work.'],
  questionsToAsk: [
    { question: 'What does success look like in 90 days?', context: 'Use this to learn the evaluation criteria.' },
    { question: 'Which team would I partner with most closely?', context: 'Useful for scope and cross-functional context.' },
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
      id: 'card-2',
      category: 'behavioral',
      title: 'Describe a hard stakeholder moment',
      tags: ['stakeholders'],
      script: 'I aligned engineering and product on a reliability roadmap.',
      warning: 'Do not frame product as the enemy.',
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

function getSectionContainer(title: string) {
  const heading = screen.getByRole('heading', { name: title })
  return heading.closest('.prep-live-section')
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
    expect(screen.getByRole('heading', { name: 'Core' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Technical' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Tactical' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Questions to Ask' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: "Don'ts" })).toBeTruthy()
    expect(screen.getByText('Tell me about yourself')).toBeTruthy()
    expect(screen.getByText('Scale')).toBeTruthy()
    expect(screen.getByText('Pick 2-3. Save 8-10 minutes for questions.')).toBeTruthy()
    expect(screen.getByText('Do not spend too long on the setup before the answer.')).toBeTruthy()
    expect(screen.getByText('99.95%')).toBeTruthy()
    expect(screen.getByText('Lead with reliability wins.')).toBeTruthy()
    expect(screen.getAllByText('Do not frame product as the enemy.')).toHaveLength(2)
    expect(screen.getAllByText('Avoid guessing at the root cause before you check the logs, deploy timeline, or rollback plan.')).toHaveLength(2)
    expect(getSectionContainer('Technical Topics')?.textContent).toContain('How do you debug a flaky distributed system?')
    expect(getSectionContainer('Technical Topics')?.textContent).not.toContain('Tell me about yourself')

    const shortcutBar = container.querySelector('.prep-live-kbd-bar')
    expect(shortcutBar?.textContent).toContain('Q / D / M / W')
    expect(shortcutBar?.textContent).toContain('Space')

    expect(getSectionContainer('Questions to Ask')?.querySelector('.prep-live-budget-badge')).toBeNull()
    expect(getSectionContainer("Don'ts")?.querySelector('.prep-live-budget-badge')).toBeNull()
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

    fireEvent.keyDown(document.body, { key: 'Q' })
    expect(container.querySelector('.prep-live-nav-link-active')?.textContent).toContain('Questions to Ask')

    fireEvent.keyDown(document.body, { key: '5' })
    expect(container.querySelector('.prep-live-nav-link-active')?.textContent).toContain('Projects')

    fireEvent.keyDown(document.body, { key: 'J' })
    expect(container.querySelector('.prep-live-nav-link-active')?.textContent).toContain('Technical Topics')

    fireEvent.keyDown(document.body, { key: 'K' })
    expect(container.querySelector('.prep-live-nav-link-active')?.textContent).toContain('Projects')
  })

  it('resets the timer from the visible control', () => {
    render(<PrepLiveMode deck={mockDeck} />)

    fireEvent.keyDown(screen.getByRole('button', { name: 'Start timer' }), { key: ' ' })
    act(() => {
      vi.advanceTimersByTime(2000)
    })

    const resetButton = screen.getByRole('button', { name: 'Reset timer' })
    fireEvent.click(resetButton)
    fireEvent.keyDown(resetButton, { key: ' ' })
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
    expect(screen.getByText('Tell me about yourself')).toBeTruthy()
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

  it('cleans up the timer interval on unmount', () => {
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval')
    const { unmount } = render(<PrepLiveMode deck={mockDeck} />)

    fireEvent.keyDown(document.body, { key: ' ' })
    unmount()

    expect(clearIntervalSpy).toHaveBeenCalled()
    clearIntervalSpy.mockRestore()
  })
})
