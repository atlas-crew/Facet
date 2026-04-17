// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PrepPracticeMode } from '../routes/prep/PrepPracticeMode'
import type { PrepCard } from '../types/prep'

afterEach(cleanup)

const mockCards: PrepCard[] = [
  { id: 'c1', category: 'opener', title: 'Card 1', tags: ['tag1'], script: 'Script 1' },
  { id: 'c2', category: 'behavioral', title: 'Card 2', tags: ['tag2'], script: 'Script 2' },
  { id: 'c3', category: 'technical', title: 'Card 3', tags: ['tag3'], script: 'Script 3' },
]

describe('PrepPracticeMode', () => {
  let mathRandomSpy: MockInstance

  beforeEach(() => {
    mathRandomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.99)
  })

  afterEach(() => {
    mathRandomSpy.mockRestore()
  })

  it('renders an empty state when no cards are provided', () => {
    const handleExit = vi.fn()
    render(
      <PrepPracticeMode
        cards={[]}
        onExit={handleExit}
        onRecordReview={() => {}}
      />,
    )

    expect(screen.getByText('No cards available')).toBeTruthy()
    fireEvent.click(screen.getByText('Back to Edit'))
    expect(handleExit).toHaveBeenCalled()
  })

  it('reveals the answer and records confidence', () => {
    const handleRecordReview = vi.fn()
    render(
      <PrepPracticeMode
        cards={mockCards}
        onExit={() => {}}
        onRecordReview={handleRecordReview}
      />,
    )

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Card 1')
    expect(screen.queryByText('Script 1')).toBeNull()

    fireEvent.click(screen.getByText('Reveal Answer'))
    expect(screen.getByText('Script 1')).toBeTruthy()

    fireEvent.click(screen.getAllByRole('button', { name: /Okay/i })[0])
    expect(handleRecordReview).toHaveBeenCalledWith('c1', 'okay')
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Card 2')
  })

  it('requeues cards marked needs work later in the session', () => {
    const handleRecordReview = vi.fn()
    render(
      <PrepPracticeMode
        cards={mockCards}
        onExit={() => {}}
        onRecordReview={handleRecordReview}
      />,
    )

    fireEvent.click(screen.getByText('Reveal Answer'))
    fireEvent.click(screen.getAllByRole('button', { name: /Needs work/i })[1])
    expect(handleRecordReview).toHaveBeenCalledWith('c1', 'needs_work')

    fireEvent.click(screen.getByText('Reveal Answer'))
    fireEvent.click(screen.getAllByRole('button', { name: /Nailed it/i })[0])
    fireEvent.click(screen.getByText('Reveal Answer'))
    fireEvent.click(screen.getAllByRole('button', { name: /Nailed it/i })[0])

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Card 1')
  })

  it('supports weak-card and unreviewed filters', () => {
    render(
      <PrepPracticeMode
        cards={mockCards}
        studyProgress={{
          c1: {
            confidence: 'needs_work',
            attempts: 2,
            needsWorkCount: 1,
            lastReviewedAt: '2026-04-14T12:00:00.000Z',
          },
          c2: {
            confidence: 'okay',
            attempts: 1,
            needsWorkCount: 0,
            lastReviewedAt: '2026-04-14T12:05:00.000Z',
          },
        }}
        onExit={() => {}}
        onRecordReview={() => {}}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Needs work/i }))
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Card 1')

    fireEvent.click(screen.getByRole('button', { name: /Unreviewed/i }))
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Card 3')
  })

  it('shows an empty homework filter state when no cards match', () => {
    render(
      <PrepPracticeMode
        cards={mockCards}
        studyProgress={{
          c1: {
            confidence: 'okay',
            attempts: 1,
            needsWorkCount: 0,
            lastReviewedAt: '2026-04-14T12:00:00.000Z',
          },
          c2: {
            confidence: 'okay',
            attempts: 1,
            needsWorkCount: 0,
            lastReviewedAt: '2026-04-14T12:05:00.000Z',
          },
          c3: {
            confidence: 'nailed_it',
            attempts: 1,
            needsWorkCount: 0,
            lastReviewedAt: '2026-04-14T12:10:00.000Z',
          },
        }}
        onExit={() => {}}
        onRecordReview={() => {}}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Needs work/i }))
    expect(screen.getByText('No cards match this homework filter')).toBeTruthy()
  })

  it('supports keyboard shortcuts for reveal and confidence grading', () => {
    const handleExit = vi.fn()
    const handleRecordReview = vi.fn()
    render(
      <PrepPracticeMode
        cards={mockCards}
        onExit={handleExit}
        onRecordReview={handleRecordReview}
      />,
    )

    const spaceEvent = new KeyboardEvent('keydown', { key: ' ' })
    vi.spyOn(spaceEvent, 'preventDefault')
    fireEvent(window, spaceEvent)
    expect(spaceEvent.preventDefault).toHaveBeenCalled()
    expect(screen.getByText('Script 1')).toBeTruthy()

    fireEvent.keyDown(window, { key: '2' })
    expect(handleRecordReview).toHaveBeenCalledWith('c1', 'okay')
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Card 2')

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(handleExit).toHaveBeenCalled()
  })

  it('ignores grading shortcuts while focus is on an interactive element', () => {
    const handleRecordReview = vi.fn()
    render(
      <PrepPracticeMode
        cards={mockCards}
        onExit={() => {}}
        onRecordReview={handleRecordReview}
      />,
    )

    fireEvent.click(screen.getByText('Reveal Answer'))
    const okayButton = screen.getAllByRole('button', { name: /Okay/i })[0]
    fireEvent.keyDown(okayButton, { key: '1' })

    expect(handleRecordReview).not.toHaveBeenCalled()
    expect(screen.getByText('Script 1')).toBeTruthy()
  })

  it('shows completion UI and allows restart', () => {
    render(
      <PrepPracticeMode
        cards={mockCards}
        onExit={() => {}}
        onRecordReview={() => {}}
      />,
    )

    fireEvent.click(screen.getByText('Reveal Answer'))
    fireEvent.click(screen.getAllByRole('button', { name: /Nailed it/i })[0])
    fireEvent.click(screen.getByText('Reveal Answer'))
    fireEvent.click(screen.getAllByRole('button', { name: /Nailed it/i })[0])
    fireEvent.click(screen.getByText('Reveal Answer'))
    fireEvent.click(screen.getAllByRole('button', { name: /Nailed it/i })[0])

    expect(screen.getByText('You completed this homework round.')).toBeTruthy()

    mathRandomSpy.mockReturnValue(0.01)
    fireEvent.click(screen.getByText('Shuffle & Restart'))

    expect(screen.getByText('Card 1 of 3')).toBeTruthy()
  })

  it('applies accessibility attributes', () => {
    const { container } = render(
      <PrepPracticeMode
        cards={mockCards}
        onExit={() => {}}
        onRecordReview={() => {}}
      />,
    )

    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.getAttribute('role')).toBe('region')
    expect(wrapper.getAttribute('aria-label')).toBe('Homework mode')
    expect(document.activeElement).toBe(wrapper)
    expect(screen.getByText('Card 1 of 3').getAttribute('role')).toBe('status')
  })
})
