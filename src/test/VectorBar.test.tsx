// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'

afterEach(cleanup)
import { VectorBar } from '../components/VectorBar'
import type { VectorDef, VectorSelection } from '../types'

const vectors: VectorDef[] = [
  { id: 'backend', label: 'Backend Engineering', color: '#3b82f6' },
  { id: 'security', label: 'Security Platform', color: '#ef4444' },
]

function renderBar(overrides: Partial<{
  vectors: VectorDef[]
  selectedVector: VectorSelection
  onSelect: (v: VectorSelection) => void
  onAddVector: () => void
  onResetOverrides: () => void
}> = {}) {
  const props = {
    vectors,
    selectedVector: 'all' as VectorSelection,
    onSelect: vi.fn(),
    onAddVector: vi.fn(),
    onResetOverrides: vi.fn(),
    ...overrides,
  }
  const result = render(<VectorBar {...props} />)
  return { ...result, ...props }
}

describe('VectorBar', () => {
  it('renders vector pills without mixing in the all-bullets affordance', () => {
    renderBar()
    expect(screen.queryByText('All')).toBeNull()
    expect(screen.getByText('Backend Engineering')).toBeTruthy()
    expect(screen.getByText('Security Platform')).toBeTruthy()
    expect(screen.getByText('View All Bullets')).toBeTruthy()
  })

  it('marks View All Bullets as active when selectedVector is "all"', () => {
    renderBar({ selectedVector: 'all' })
    const viewAllBtn = screen.getByRole('button', { name: /View All Bullets/i })
    expect(viewAllBtn.getAttribute('aria-pressed')).toBe('true')
    expect(viewAllBtn.classList.contains('active')).toBe(true)
  })

  it('marks the correct vector pill as active', () => {
    renderBar({ selectedVector: 'backend' })
    const viewAllBtn = screen.getByRole('button', { name: /View All Bullets/i })
    const backendBtn = screen.getByText('Backend Engineering')
    expect(viewAllBtn.getAttribute('aria-pressed')).toBe('false')
    expect(backendBtn.getAttribute('aria-pressed')).toBe('true')
  })

  it('calls onSelect("all") when clicking View All Bullets', () => {
    const { onSelect } = renderBar()
    fireEvent.click(screen.getByText('View All Bullets'))
    expect(onSelect).toHaveBeenCalledWith('all')
  })

  it('calls onSelect with vector id when clicking a vector pill', () => {
    const { onSelect } = renderBar()
    fireEvent.click(screen.getByText('Security Platform'))
    expect(onSelect).toHaveBeenCalledWith('security')
  })

  it('calls onAddVector when clicking New Vector', () => {
    const { onAddVector } = renderBar()
    fireEvent.click(screen.getByText('New Vector'))
    expect(onAddVector).toHaveBeenCalledOnce()
  })

  it('scopes actions to the active vector', () => {
    renderBar({ selectedVector: 'backend' })
    const scope = screen.getByText('Actions for Backend Engineering')
    const resetButton = screen.getByRole('button', { name: /Reset overrides for Backend Engineering/i })
    expect(scope).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Rename Backend Engineering' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Delete Backend Engineering' })).toBeTruthy()
    expect(resetButton.getAttribute('aria-label')).toBe('Reset overrides for Backend Engineering')
  })

  it('disables vector-specific actions when all vectors are selected', () => {
    renderBar({ selectedVector: 'all' })
    expect(screen.getByText('Select a vector for actions')).toBeTruthy()
    const renameButton = screen.getByRole('button', { name: 'Rename vector' }) as HTMLButtonElement
    const deleteButton = screen.getByRole('button', { name: 'Delete vector' }) as HTMLButtonElement
    const resetButton = screen.getByRole('button', { name: /Reset overrides/i }) as HTMLButtonElement
    expect(renameButton.disabled).toBe(true)
    expect(deleteButton.disabled).toBe(true)
    expect(resetButton.disabled).toBe(true)
  })

  it('treats an unknown selected vector as no active vector', () => {
    renderBar({ selectedVector: 'ghost' as VectorSelection })
    expect(screen.getByText('Select a vector for actions')).toBeTruthy()
    const renameButton = screen.getByRole('button', { name: 'Rename vector' }) as HTMLButtonElement
    const deleteButton = screen.getByRole('button', { name: 'Delete vector' }) as HTMLButtonElement
    const resetButton = screen.getByRole('button', { name: /Reset overrides/i }) as HTMLButtonElement
    expect(renameButton.disabled).toBe(true)
    expect(deleteButton.disabled).toBe(true)
    expect(resetButton.disabled).toBe(true)
  })

  it('calls onResetOverrides when clicking Reset Overrides', () => {
    const { onResetOverrides } = renderBar({ selectedVector: 'backend' })
    fireEvent.click(screen.getByText('Reset Overrides'))
    expect(onResetOverrides).toHaveBeenCalledOnce()
  })

  it('renders with empty vectors array', () => {
    renderBar({ vectors: [] })
    expect(screen.getByText('View All Bullets')).toBeTruthy()
    expect(screen.getByText('New Vector')).toBeTruthy()
  })

  it('shows rename and delete controls', () => {
    renderBar({ selectedVector: 'backend' })
    expect(screen.getByText('Rename')).toBeTruthy()
    expect(screen.getByText('Delete')).toBeTruthy()
  })
})
