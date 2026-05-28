// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ProjectList } from '../components/ProjectList'
import type { ProjectComponent, VectorDef } from '../types'

afterEach(() => {
  cleanup()
})

const mockProjects: ProjectComponent[] = [
  {
    id: 'p1',
    name: 'Project One',
    text: 'Description One',
    vectors: { all: 'include' },
  },
  {
    id: 'p2',
    name: 'Project Two',
    text: 'Description Two',
    vectors: { all: 'include' },
  },
]

const mockVectors: VectorDef[] = [{ id: 'v1', label: 'Vector 1', color: '#ff0000' }]

describe('ProjectList', () => {
  it('renders a list of projects', () => {
    render(
      <ProjectList
        projects={mockProjects}
        vectorDefs={mockVectors}
        selectedVector="all"
        includedByKey={{}}
        onReorder={vi.fn()}
        onUpdate={vi.fn()}
        onUpdateVectors={vi.fn()}
        onToggleIncluded={vi.fn()}
      />,
    )

    expect(screen.getByTestId('project-list').getAttribute('data-virtualized')).toBe('true')
    expect(screen.getByDisplayValue('Project One')).toBeDefined()
    expect(screen.getByDisplayValue('Project Two')).toBeDefined()
    expect(screen.getAllByLabelText(/Reorder project/)).toHaveLength(2)
  })

  it('renders project URL when provided', () => {
    const projectsWithUrl: ProjectComponent[] = [{ ...mockProjects[0], url: 'https://example.com' }]
    render(
      <ProjectList
        projects={projectsWithUrl}
        vectorDefs={mockVectors}
        selectedVector="all"
        includedByKey={{}}
        onReorder={vi.fn()}
        onUpdate={vi.fn()}
        onUpdateVectors={vi.fn()}
        onToggleIncluded={vi.fn()}
      />,
    )

    expect(screen.getByDisplayValue('https://example.com')).toBeDefined()
  })

  it('calls onToggleIncluded when eye icon is clicked', () => {
    const onToggle = vi.fn()
    render(
      <ProjectList
        projects={[mockProjects[0]]}
        vectorDefs={mockVectors}
        selectedVector="all"
        includedByKey={{}}
        onReorder={vi.fn()}
        onUpdate={vi.fn()}
        onUpdateVectors={vi.fn()}
        onToggleIncluded={onToggle}
      />,
    )

    screen.getByTestId('project-toggle-included').click()
    expect(onToggle).toHaveBeenCalledWith('p1', mockProjects[0].vectors)
  })

  it('virtualizes large project lists while keeping visible actions interactive', () => {
    const manyProjects: ProjectComponent[] = Array.from({ length: 60 }, (_, index) => ({
      id: `project-${index + 1}`,
      name: `Project ${index + 1}`,
      text: `Description ${index + 1}`,
      vectors: { all: 'include' },
    }))
    const onToggle = vi.fn()

    render(
      <ProjectList
        projects={manyProjects}
        vectorDefs={mockVectors}
        selectedVector="all"
        includedByKey={{}}
        onReorder={vi.fn()}
        onUpdate={vi.fn()}
        onUpdateVectors={vi.fn()}
        onToggleIncluded={onToggle}
      />,
    )

    expect(screen.getByTestId('project-list').getAttribute('data-virtualized')).toBe('true')
    expect(screen.getByDisplayValue('Project 1')).toBeDefined()
    expect(screen.queryByDisplayValue('Project 60')).toBeNull()
    expect(screen.getAllByLabelText(/Reorder project/).length).toBeLessThan(manyProjects.length)
    expect(document.querySelectorAll('[data-virtualized-placeholder]').length).toBeGreaterThan(0)

    screen.getAllByTestId('project-toggle-included')[0].click()
    expect(onToggle).toHaveBeenCalledWith('project-1', manyProjects[0].vectors)

    fireEvent.scroll(screen.getByTestId('project-list'), { target: { scrollTop: 15_000 } })
    expect(screen.getByDisplayValue('Project 60')).toBeDefined()
  })
})
