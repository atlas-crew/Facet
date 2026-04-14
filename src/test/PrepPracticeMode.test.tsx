// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import type { PrepCard } from '../types/prep'
import { PrepPracticeMode } from '../routes/prep/PrepPracticeMode'

afterEach(cleanup)

const mockCards: PrepCard[] = [
  { id: 'c1', category: 'opener', title: 'Card 1', tags: ['tag1'], script: 'Script 1' },
  { id: 'c2', category: 'behavioral', title: 'Card 2', tags: ['tag2'], script: 'Script 2' },
  { id: 'c3', category: 'technical', title: 'Card 3', tags: ['tag3'], script: 'Script 3' }
]

describe('PrepPracticeMode', () => {
  let mathRandomSpy: MockInstance

  beforeEach(() => {
    // Mocks Math.random so that elements always sort backwards: [3, 2, 1]
    // because Math.random() - 0.5 will always be > 0
    mathRandomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.99)
  })

  afterEach(() => {
    mathRandomSpy.mockRestore()
  })

  it('renders an empty state when no cards are provided', () => {
    const handleExit = vi.fn()
    render(<PrepPracticeMode cards={[]} onExit={handleExit} />)
    expect(screen.getByText('No cards available')).toBeTruthy()
    fireEvent.click(screen.getByText('Back to Edit'))
    expect(handleExit).toHaveBeenCalled()
  })

  it('renders the first card unrevealed and allows revealing', () => {
    render(<PrepPracticeMode cards={mockCards} onExit={() => {}} />)
    
    // With 0.99, Fisher-Yates does not swap. So it's [Card 1, Card 2, Card 3]
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Card 1')
    expect(screen.queryByText('Script 1')).toBeNull()
    
    fireEvent.click(screen.getByText('Reveal Answer'))
    expect(screen.getByText('Script 1')).toBeTruthy()
  })

  it('allows forward and backward navigation with disabled guards', () => {
    render(<PrepPracticeMode cards={mockCards} onExit={() => {}} />)
    
    fireEvent.click(screen.getByText('Reveal Answer'))
    
    const prevBtn = screen.getByText(/Previous/)
    const nextBtn = screen.getByText(/Next Card/)
    
    // Prev is disabled at start
    expect((prevBtn as HTMLButtonElement).disabled).toBe(true)
    
    // Go to next
    fireEvent.click(nextBtn)
    expect(screen.queryByText('Script 2')).toBeNull() // now on Card 2, unrevealed
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Card 2')
    
    fireEvent.click(screen.getByText('Reveal Answer'))
    
    // Previous is enabled now
    expect((screen.getByText(/Previous/) as HTMLButtonElement).disabled).toBe(false)
    
    // Go back to first
    fireEvent.click(screen.getByText(/Previous/))
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Card 1')
    expect(screen.queryByText('Script 1')).toBeNull() // resets to unrevealed
  })

  it('handles keyboard navigation and guards', () => {
    const handleExit = vi.fn()
    render(<PrepPracticeMode cards={mockCards} onExit={handleExit} />)
    
    // Space reveals
    const event = new KeyboardEvent('keydown', { key: ' ' })
    vi.spyOn(event, 'preventDefault')
    fireEvent(window, event)
    expect(event.preventDefault).toHaveBeenCalled()
    expect(screen.getByText('Script 1')).toBeTruthy()
    
    // ArrowRight to next
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Card 2')
    
    // Enter reveals
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(screen.getByText('Script 2')).toBeTruthy()

    // ArrowLeft to previous
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Card 1')
    
    // Escape exits
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(handleExit).toHaveBeenCalled()
  })

  it('Space/Enter skipped on BUTTON targets', () => {
    render(<PrepPracticeMode cards={mockCards} onExit={() => {}} />)
    
    const shuffleBtn = screen.getByText('Shuffle')
    // Space on a button shouldn't reveal the card
    fireEvent.keyDown(shuffleBtn, { key: ' ' })
    expect(screen.queryByText('Script 1')).toBeNull() // Still unrevealed
  })

  it('shows completion UI and allows restart', () => {
    render(<PrepPracticeMode cards={mockCards} onExit={() => {}} />)
    
    // Skip to last card
    fireEvent.click(screen.getByText('Reveal Answer'))
    fireEvent.click(screen.getByText(/Next Card/))
    fireEvent.click(screen.getByText('Reveal Answer'))
    fireEvent.click(screen.getByText(/Next Card/))
    fireEvent.click(screen.getByText('Reveal Answer'))
    
    expect(screen.getByText(`You've reviewed all ${mockCards.length} cards.`)).toBeTruthy()
    
    // Shuffle & Restart (with 0.01, Fisher-Yates results in [Card 2, Card 3, Card 1])
    mathRandomSpy.mockReturnValue(0.01)
    fireEvent.click(screen.getByText('Shuffle & Restart'))
    
    expect(screen.getByText('Card 1 of 3')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Card 2')
    expect(screen.queryByText('Script 2')).toBeNull() // unrevealed
  })

  it('handles single card deck gracefully', () => {
    render(<PrepPracticeMode cards={[mockCards[0]]} onExit={() => {}} />)
    
    expect(screen.getByText('Card 1 of 1')).toBeTruthy()
    fireEvent.click(screen.getByText('Reveal Answer'))
    
    // Immediately shows completion
    expect(screen.getByText("You've reviewed all 1 cards.")).toBeTruthy()
    expect(screen.queryByText(/Next Card/)).toBeNull()
  })

  it('does not render tags if empty array', () => {
    const noTagsCard = { ...mockCards[0], tags: [] }
    const { container } = render(<PrepPracticeMode cards={[noTagsCard]} onExit={() => {}} />)
    
    expect(container.querySelector('.prep-tags')).toBeNull()
  })

  it('applies accessibility attributes', () => {
    const { container } = render(<PrepPracticeMode cards={mockCards} onExit={() => {}} />)
    
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.getAttribute('role')).toBe('region')
    expect(wrapper.getAttribute('aria-label')).toBe('Homework mode')
    
    expect(document.activeElement).toBe(wrapper)
    
    const progress = screen.getByText('Card 1 of 3')
    expect(progress.getAttribute('role')).toBe('status')
  })
})
