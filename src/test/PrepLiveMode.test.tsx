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
  updatedAt: '2026-04-14T17:00:00.000Z',
  cards: [
    {
      id: 'card-1',
      category: 'opener',
      title: 'Tell me about yourself',
      tags: ['intro'],
      script: 'I lead backend platform work and enjoy scaling teams and systems.',
    },
    {
      id: 'card-2',
      category: 'behavioral',
      title: 'Describe a hard stakeholder moment',
      tags: ['stakeholders'],
      script: 'I aligned engineering and product on a reliability roadmap.',
    },
    {
      id: 'card-3',
      category: 'technical',
      title: 'How do you debug a flaky distributed system?',
      tags: ['debugging'],
      script: 'Start with blast radius, recent changes, and observability gaps.',
    },
  ],
}

describe('PrepLiveMode', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('renders the live cheatsheet surface for the active deck', () => {
    const { container } = render(<PrepLiveMode deck={mockDeck} />)

    expect(screen.getByLabelText('Live cheatsheet mode')).toBeTruthy()
    expect(screen.getByText('Interview timer')).toBeTruthy()
    expect(screen.getByText('Sections')).toBeTruthy()
    expect(screen.getByText('Live viewer')).toBeTruthy()
    expect(screen.getByText('Tell me about yourself')).toBeTruthy()

    const sidebar = container.querySelector('.prep-live-sidebar')
    const shortcutBar = container.querySelector('.prep-live-kbd-bar')

    expect(sidebar).toBeTruthy()
    expect(sidebar?.textContent).toContain('Acme Staff Engineer Prep')
    expect(sidebar?.textContent).toContain('Interview timer')
    expect(sidebar?.textContent).toContain('Search cheatsheet')
    expect(sidebar?.textContent).not.toContain('Quick Jumps')
    expect(shortcutBar).toBeTruthy()
    expect(shortcutBar?.textContent).toContain('Space')
    expect(shortcutBar?.textContent).toContain('Search')
  })

  it('renders overview metadata from the deck in the live viewer', () => {
    render(<PrepLiveMode deck={mockDeck} />)

    expect(screen.getByText('Acme is investing heavily in developer tooling.')).toBeTruthy()
    expect(screen.getByText('platform leadership, distributed systems')).toBeTruthy()
    expect(screen.getByText('Lead with reliability wins.')).toBeTruthy()
    expect(screen.getByText('Build platform tooling and improve developer velocity.')).toBeTruthy()
  })

  it('supports keyboard shortcuts for search focus and timer restart', () => {
    const { container } = render(<PrepLiveMode deck={mockDeck} />)
    const keyboardSurface = document.body

    fireEvent.keyDown(keyboardSurface, { key: '/' })
    const searchInput = screen.getAllByLabelText('Search cheatsheet')[0]
    expect(document.activeElement).toBe(searchInput)

    fireEvent.keyDown(keyboardSurface, { key: ' ' })
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.getByText('00:02')).toBeTruthy()

    fireEvent.keyDown(keyboardSurface, { key: ' ' })
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByText('00:01')).toBeTruthy()

    const timerCard = container.querySelector('.prep-live-timer-card')
    expect(timerCard?.className).not.toContain('warning')

    act(() => {
      vi.advanceTimersByTime(29000)
    })
    expect(timerCard?.className).toContain('prep-live-timer-card-warning')

    act(() => {
      vi.advanceTimersByTime(30000)
    })
    expect(timerCard?.className).toContain('prep-live-timer-card-urgent')

    act(() => {
      vi.advanceTimersByTime(30000)
    })
    expect(timerCard?.className).toContain('prep-live-timer-card-critical')
    expect(screen.getByText('01:30')).toBeTruthy()
  })

  it('filters sections and moves keyboard navigation to the next section', () => {
    const { container } = render(<PrepLiveMode deck={mockDeck} />)
    const keyboardSurface = document.body

    fireEvent.keyDown(keyboardSurface, { key: 'j' })
    const activeNav = container.querySelector('.prep-live-nav-link-active')
    expect(activeNav?.textContent).toContain('Company Intel')

    fireEvent.change(screen.getAllByLabelText('Search cheatsheet')[0], { target: { value: 'debug' } })
    expect(screen.getAllByText('Technical Topics').length).toBeGreaterThan(0)
    expect(screen.queryByText('Behavioral Stories')).toBeNull()
    expect(screen.getByText('How do you debug a flaky distributed system?')).toBeTruthy()
  })

  it('does not trigger shortcuts while typing in the search input', () => {
    const { container } = render(<PrepLiveMode deck={mockDeck} />)
    const searchInput = screen.getByRole('searchbox', { name: 'Search cheatsheet' })

    fireEvent.focus(searchInput)
    fireEvent.keyDown(searchInput, { key: ' ' })
    fireEvent.keyDown(searchInput, { key: 'j' })
    fireEvent.keyDown(searchInput, { key: '5' })
    fireEvent.keyDown(searchInput, { key: 'e' })

    expect(screen.getByText('00:00')).toBeTruthy()
    expect(container.querySelector('.prep-live-nav-link-active')?.textContent).toContain('Overview')

    const overviewToggle = screen.getAllByRole('button', { name: 'Collapse' })[0]
    const controlledSection = document.getElementById(overviewToggle.getAttribute('aria-controls')!)
    expect(controlledSection?.hasAttribute('hidden')).toBe(false)
  })

  it('uses the visible badge numbers when sections are filtered', () => {
    const { container } = render(<PrepLiveMode deck={mockDeck} />)
    const keyboardSurface = document.body

    fireEvent.change(screen.getAllByLabelText('Search cheatsheet')[0], { target: { value: 'lead' } })

    fireEvent.keyDown(keyboardSurface, { key: '3' })
    const activeNav = container.querySelector('.prep-live-nav-link-active')
    expect(activeNav?.textContent).toContain('Openers')

    fireEvent.keyDown(keyboardSurface, { key: '2' })
    expect(container.querySelector('.prep-live-nav-link-active')?.textContent).toContain('Company Intel')
  })

  it('keeps shortcuts in a dedicated footer bar instead of repeating a quick jump rail', () => {
    const { container } = render(<PrepLiveMode deck={mockDeck} />)

    expect(container.querySelector('.prep-live-jump-rail')).toBeNull()
    expect(container.querySelector('.prep-live-kbd-bar')?.textContent).toContain('Collapse')
    expect(container.querySelector('.prep-live-nav-link-active')?.textContent).toContain('Overview')
  })

  it('supports numeric jump shortcuts and section collapse toggling', () => {
    const { container } = render(<PrepLiveMode deck={mockDeck} />)
    const keyboardSurface = document.body

    fireEvent.keyDown(keyboardSurface, { key: '5' })
    const activeNav = container.querySelector('.prep-live-nav-link-active')
    expect(activeNav?.textContent).toContain('Technical Topics')

    fireEvent.keyDown(keyboardSurface, { key: 'e' })
    const technicalPrompt = screen.getByText('How do you debug a flaky distributed system?')
    expect(technicalPrompt.closest('.prep-live-item-list')?.hasAttribute('hidden')).toBe(true)

    fireEvent.keyDown(keyboardSurface, { key: 'e' })
    expect(screen.getByText('How do you debug a flaky distributed system?')).toBeTruthy()
  })

  it('shows a no-results state and restores sections when search is cleared', () => {
    render(<PrepLiveMode deck={mockDeck} />)

    const searchInput = screen.getByRole('searchbox', { name: 'Search cheatsheet' })
    fireEvent.change(searchInput, { target: { value: 'zzz_nonexistent' } })

    expect(screen.getByText('No cheatsheet sections match that search')).toBeTruthy()
    expect(screen.queryByText('Tell me about yourself')).toBeNull()

    fireEvent.keyDown(searchInput, { key: 'Escape' })

    expect(screen.queryByText('No cheatsheet sections match that search')).toBeNull()
    expect(screen.getByText('Tell me about yourself')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Behavioral Stories' })).toBeTruthy()
  })

  it('collapses and expands overview content from the section button', () => {
    render(<PrepLiveMode deck={mockDeck} />)

    const overviewToggle = screen.getAllByRole('button', { name: 'Collapse' })[0]
    const controlledId = overviewToggle.getAttribute('aria-controls')
    expect(controlledId).toBeTruthy()

    const controlledSection = document.getElementById(controlledId!)
    expect(controlledSection?.hasAttribute('hidden')).toBe(false)

    fireEvent.click(overviewToggle)
    expect(overviewToggle.getAttribute('aria-expanded')).toBe('false')
    expect(controlledSection?.hasAttribute('hidden')).toBe(true)

    fireEvent.click(screen.getAllByRole('button', { name: 'Expand' })[0])
    expect(controlledSection?.hasAttribute('hidden')).toBe(false)
  })

  it('ignores live shortcuts while focus is inside another editable control', () => {
    const { container } = render(
      <div>
        <label htmlFor="external-mode">External mode</label>
        <select id="external-mode" defaultValue="default">
          <option value="default">Default</option>
          <option value="alt">Alt</option>
        </select>
        <PrepLiveMode deck={mockDeck} />
      </div>,
    )

    const externalSelect = screen.getByLabelText('External mode')
    fireEvent.focus(externalSelect)
    fireEvent.keyDown(externalSelect, { key: '5' })
    fireEvent.keyDown(externalSelect, { key: ' ' })

    const activeNav = container.querySelector('.prep-live-nav-link-active')
    expect(activeNav?.textContent).toContain('Overview')
    expect(screen.getByText('00:00')).toBeTruthy()
  })

  it('renders gracefully when the deck has no cards', () => {
    render(<PrepLiveMode deck={{ ...mockDeck, cards: [] }} />)

    expect(screen.getByLabelText('Live cheatsheet mode')).toBeTruthy()
    expect(screen.getByText('Interview timer')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Overview' })).toBeTruthy()
    expect(screen.queryByText('Tell me about yourself')).toBeNull()
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
