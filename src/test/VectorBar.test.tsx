// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, fireEvent, within } from '@testing-library/react'

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
    const vectorChoices = screen.getByRole('group', { name: 'Resume vector choices' })
    expect(screen.queryByText('All')).toBeNull()
    expect(within(vectorChoices).getByText('Backend Engineering')).toBeTruthy()
    expect(within(vectorChoices).getByText('Security Platform')).toBeTruthy()
    expect(within(vectorChoices).queryByText('View All')).toBeNull()
    expect(screen.getByRole('button', { name: 'View All Bullets' })).toBeTruthy()
  })

  it('marks the correct vector pill as active', () => {
    renderBar({ selectedVector: 'backend' })
    const backendBtn = screen.getByText('Backend Engineering')
    expect(backendBtn.getAttribute('aria-pressed')).toBe('true')
  })

  it('calls onSelect with vector id when clicking a vector pill', () => {
    const { onSelect } = renderBar()
    fireEvent.click(screen.getByText('Security Platform'))
    expect(onSelect).toHaveBeenCalledWith('security')
  })

  it('calls onSelect with all when clicking View All Bullets', () => {
    const { onSelect } = renderBar({ selectedVector: 'backend' })
    fireEvent.click(screen.getByRole('button', { name: 'View All Bullets' }))
    expect(onSelect).toHaveBeenCalledWith('all')
  })

  it('calls onAddVector when clicking New Vector', () => {
    const { onAddVector } = renderBar()
    fireEvent.click(screen.getByRole('button', { name: 'New Vector' }))
    expect(onAddVector).toHaveBeenCalledOnce()
  })

  it('scopes actions to the active vector', () => {
    const { container } = renderBar({ selectedVector: 'backend' })
    const scope = screen.getByText('Actions for Backend Engineering')
    const resetButton = screen.getByRole('button', { name: /Reset overrides for Backend Engineering/i })
    expect(scope).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Rename Backend Engineering' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Delete Backend Engineering' })).toBeTruthy()
    expect(resetButton.getAttribute('aria-label')).toBe('Reset overrides for Backend Engineering')
    expect(container.querySelector('.vector-actions')?.getAttribute('style')).toContain('--active-vector-color: #3b82f6')
  })

  it('disables vector-specific actions when all vectors are selected', () => {
    const { container } = renderBar({ selectedVector: 'all' })
    expect(screen.getByText('Select a vector for actions')).toBeTruthy()
    const renameButton = screen.getByRole('button', { name: 'Rename vector' }) as HTMLButtonElement
    const deleteButton = screen.getByRole('button', { name: 'Delete vector' }) as HTMLButtonElement
    const resetButton = screen.getByRole('button', { name: /Reset overrides/i }) as HTMLButtonElement
    expect(renameButton.disabled).toBe(true)
    expect(deleteButton.disabled).toBe(true)
    expect(resetButton.disabled).toBe(true)
    expect(container.querySelector('.vector-actions')?.getAttribute('style')).toBeNull()
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
    expect(screen.getByRole('button', { name: 'View All Bullets' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'New Vector' })).toBeTruthy()
  })

  it('shows rename and delete controls', () => {
    renderBar({ selectedVector: 'backend' })
    expect(screen.getByText('Rename')).toBeTruthy()
    expect(screen.getByText('Delete')).toBeTruthy()
  })
})
