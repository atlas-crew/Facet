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
  onResetAuto: () => void
}> = {}) {
  const props = {
    vectors,
    selectedVector: 'all' as VectorSelection,
    onSelect: vi.fn(),
    onAddVector: vi.fn(),
    onResetAuto: vi.fn(),
    ...overrides,
  }
  const result = render(<VectorBar {...props} />)
  return { ...result, ...props }
}

describe('VectorBar', () => {
  it('renders the "All" pill and all vector pills', () => {
    renderBar()
    expect(screen.getByText('All')).toBeTruthy()
    expect(screen.getByText('Backend Engineering')).toBeTruthy()
    expect(screen.getByText('Security Platform')).toBeTruthy()
  })

  it('marks "All" as active when selectedVector is "all"', () => {
    renderBar({ selectedVector: 'all' })
    const allBtn = screen.getByText('All')
    expect(allBtn.getAttribute('aria-pressed')).toBe('true')
  })

  it('marks the correct vector pill as active', () => {
    renderBar({ selectedVector: 'backend' })
    const allBtn = screen.getByText('All')
    const backendBtn = screen.getByText('Backend Engineering')
    expect(allBtn.getAttribute('aria-pressed')).toBe('false')
    expect(backendBtn.getAttribute('aria-pressed')).toBe('true')
  })

  it('calls onSelect("all") when clicking the All pill', () => {
    const { onSelect } = renderBar()
    fireEvent.click(screen.getByText('All'))
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

  it('calls onResetAuto when clicking Reset to Auto', () => {
    const { onResetAuto } = renderBar()
    fireEvent.click(screen.getByText('Reset to Auto'))
    expect(onResetAuto).toHaveBeenCalledOnce()
  })

  it('renders with empty vectors array', () => {
    renderBar({ vectors: [] })
    expect(screen.getByText('All')).toBeTruthy()
    expect(screen.getByText('New Vector')).toBeTruthy()
  })

  it('shows rename and delete controls', () => {
    renderBar({ selectedVector: 'backend' })
    expect(screen.getByText('Rename')).toBeTruthy()
    expect(screen.getByText('Delete')).toBeTruthy()
  })
})
