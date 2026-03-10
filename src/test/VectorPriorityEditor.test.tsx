// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { VectorPriorityEditor } from '../components/VectorPriorityEditor'
import type { PriorityByVector, VectorDef } from '../types'

afterEach(cleanup)

const vectorDefs: VectorDef[] = [
  { id: 'backend', label: 'Backend', color: '#3b82f6' },
  { id: 'security', label: 'Security', color: '#ef4444' },
]

function renderEditor(overrides: Partial<{
  vectors: PriorityByVector
  vectorDefs: VectorDef[]
  onChange: (v: PriorityByVector) => void
}> = {}) {
  const props = {
    vectors: { backend: 'include' as const },
    vectorDefs,
    onChange: vi.fn(),
    ...overrides,
  }
  const result = render(<VectorPriorityEditor {...props} />)
  return { ...result, ...props }
}

describe('VectorPriorityEditor', () => {
  it('renders nothing when vectorDefs is empty', () => {
    const { container } = renderEditor({ vectorDefs: [] })
    expect(container.innerHTML).toBe('')
  })

  it('renders a fieldset with legend', () => {
    renderEditor()
    expect(screen.getByText('Vector Inclusion')).toBeTruthy()
  })

  it('renders a checkbox for each vector', () => {
    renderEditor()
    expect(screen.getByRole('checkbox', { name: 'Backend included' })).toBeTruthy()
    expect(screen.getByRole('checkbox', { name: 'Security included' })).toBeTruthy()
  })

  it('checks included vectors and leaves excluded vectors unchecked', () => {
    renderEditor({ vectors: { backend: 'include', security: 'exclude' } })
    expect(screen.getByRole('checkbox', { name: 'Backend included' })).toHaveProperty('checked', true)
    expect(screen.getByRole('checkbox', { name: 'Security included' })).toHaveProperty('checked', false)
  })

  it('defaults to unchecked when vector has no inclusion state', () => {
    renderEditor({ vectors: {} })
    expect(screen.getByRole('checkbox', { name: 'Backend included' })).toHaveProperty('checked', false)
    expect(screen.getByRole('checkbox', { name: 'Security included' })).toHaveProperty('checked', false)
  })

  it('calls onChange with included vector when checked', () => {
    const { onChange } = renderEditor({ vectors: {} })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Backend included' }))
    expect(onChange).toHaveBeenCalledWith({ backend: 'include' })
  })

  it('removes vector key from map when unchecked', () => {
    const { onChange } = renderEditor({ vectors: { backend: 'include', security: 'include' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Backend included' }))
    expect(onChange).toHaveBeenCalledWith({ security: 'include' })
  })
})
