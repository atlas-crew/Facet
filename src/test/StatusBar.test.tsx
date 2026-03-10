// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

afterEach(cleanup)
import { StatusBar } from '../components/StatusBar'

const baseProps = {
  pageCount: 1,
  bulletCount: 12,
  skillGroupCount: 3,
  nearBudget: false,
  overBudget: false,
  matchScore: null,
}

describe('StatusBar', () => {
  it('renders page count, bullet count, and skill group count', () => {
    render(<StatusBar {...baseProps} />)
    expect(screen.getByText('1 page')).toBeTruthy()
    expect(screen.getByText('12 bullets')).toBeTruthy()
    expect(screen.getByText('3 skill groups')).toBeTruthy()
  })

  it('pluralizes page count when more than 1', () => {
    render(<StatusBar {...baseProps} pageCount={2} />)
    expect(screen.getByText('2 pages')).toBeTruthy()
  })

  it('defaults to 1 page when pageCount is null and not pending', () => {
    render(<StatusBar {...baseProps} pageCount={null} />)
    expect(screen.getByText('1 page')).toBeTruthy()
  })

  it('shows rendering message when pending with null page count', () => {
    render(<StatusBar {...baseProps} pageCount={null} pageCountPending />)
    expect(screen.getByText('Rendering PDF...')).toBeTruthy()
  })

  it('shows page count even when pending if count is available', () => {
    render(<StatusBar {...baseProps} pageCount={2} pageCountPending />)
    expect(screen.getByText('2 pages')).toBeTruthy()
  })

  it('applies warning class when nearBudget', () => {
    const { container } = render(<StatusBar {...baseProps} nearBudget />)
    expect(container.querySelector('footer')?.className).toContain('warning')
  })

  it('applies critical class when overBudget', () => {
    const { container } = render(<StatusBar {...baseProps} overBudget />)
    expect(container.querySelector('footer')?.className).toContain('critical')
  })

  it('shows near-budget warning text', () => {
    render(<StatusBar {...baseProps} nearBudget />)
    expect(screen.getByText(/Approaching 2-page target/)).toBeTruthy()
  })

  it('shows over-budget warning text', () => {
    render(<StatusBar {...baseProps} overBudget />)
    expect(screen.getByText(/bottom bullets were trimmed/)).toBeTruthy()
  })

  it('does not show warning when budget is fine', () => {
    render(<StatusBar {...baseProps} />)
    expect(screen.queryByText(/Approaching|trimmed|exceeds/)).toBeNull()
  })

  it('shows active preset label', () => {
    render(<StatusBar {...baseProps} activePresetLabel="Backend v2" />)
    expect(screen.getByText(/Editing: Backend v2/)).toBeTruthy()
  })

  it('shows dirty indicator when preset has unsaved changes', () => {
    render(<StatusBar {...baseProps} activePresetLabel="Backend v2" presetDirty />)
    expect(screen.getByText(/Editing: Backend v2/)).toBeTruthy()
    expect(screen.getByText('(unsaved changes)')).toBeTruthy()
  })

  it('does not show preset section when no label', () => {
    render(<StatusBar {...baseProps} />)
    expect(screen.queryByText(/Editing:/)).toBeNull()
  })

  it('has role="status" and aria-live for accessibility', () => {
    render(<StatusBar {...baseProps} />)
    const footer = screen.getByRole('status')
    expect(footer.getAttribute('aria-live')).toBe('polite')
  })
})
