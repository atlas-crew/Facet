// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { EducationList } from '../components/EducationList'
import type { EducationEntry } from '../types'

afterEach(() => {
  cleanup()
})

const mockEducation: EducationEntry[] = [
  {
    id: 'edu-1',
    school: 'State U',
    location: 'Austin, TX',
    degree: 'B.S. Computer Science',
    year: '2020',
    vectors: {},
  },
]

describe('EducationList', () => {
  it('renders editable education fields', () => {
    render(
      <EducationList
        education={mockEducation}
        includedByKey={{}}
        onReorder={vi.fn()}
        onUpdate={vi.fn()}
        onToggleIncluded={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    expect(screen.getByDisplayValue('State U')).toBeDefined()
    expect(screen.getByDisplayValue('Austin, TX')).toBeDefined()
    expect(screen.getByDisplayValue('B.S. Computer Science')).toBeDefined()
    expect(screen.getByDisplayValue('2020')).toBeDefined()
  })

  it('renders a manual include toggle but no vector-priority controls for education', () => {
    render(
      <EducationList
        education={mockEducation}
        includedByKey={{}}
        onReorder={vi.fn()}
        onUpdate={vi.fn()}
        onToggleIncluded={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: /included/i })).toBeDefined()
    expect(screen.queryAllByRole('button', { name: /included/i })).toHaveLength(1)
  })

  it('calls onUpdate for edited fields and keeps a blank year input when year is missing', () => {
    const onUpdate = vi.fn()
    render(
      <EducationList
        education={[{ ...mockEducation[0], id: 'edu-2', year: undefined }]}
        includedByKey={{}}
        onReorder={vi.fn()}
        onUpdate={onUpdate}
        onToggleIncluded={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    const yearInput = screen.getByLabelText('Year') as HTMLInputElement
    expect(yearInput.value).toBe('')

    fireEvent.change(screen.getByLabelText('School'), { target: { value: 'Updated U' } })
    fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'Seattle, WA' } })
    fireEvent.change(screen.getByLabelText('Degree'), { target: { value: 'M.S. CS' } })
    fireEvent.change(yearInput, { target: { value: '2024' } })

    expect(onUpdate).toHaveBeenCalledWith('edu-2', 'school', 'Updated U')
    expect(onUpdate).toHaveBeenCalledWith('edu-2', 'location', 'Seattle, WA')
    expect(onUpdate).toHaveBeenCalledWith('edu-2', 'degree', 'M.S. CS')
    expect(onUpdate).toHaveBeenCalledWith('edu-2', 'year', '2024')
  })

  it('calls onDelete, exposes the drag-and-drop instructions, and supports manual include overrides', () => {
    const onDelete = vi.fn()
    const onToggleIncluded = vi.fn()
    render(
      <EducationList
        education={mockEducation}
        includedByKey={{ 'education:edu-1': false }}
        onReorder={vi.fn()}
        onUpdate={vi.fn()}
        onToggleIncluded={onToggleIncluded}
        onDelete={onDelete}
      />,
    )

    expect(screen.getByText(/to reorder, press space or enter to lift/i)).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: /excluded/i }))
    expect(onToggleIncluded).toHaveBeenCalledWith('edu-1')
    fireEvent.click(screen.getByRole('button', { name: /delete education state u/i }))
    expect(onDelete).toHaveBeenCalledWith('edu-1')
  })
})
