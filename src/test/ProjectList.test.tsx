// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
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
    vectors: { all: 'include' }
  },
  {
    id: 'p2',
    name: 'Project Two',
    text: 'Description Two',
    vectors: { all: 'include' }
  }
]

const mockVectors: VectorDef[] = [
  { id: 'v1', label: 'Vector 1', color: '#ff0000' }
]

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

      />
    )

    expect(screen.getByDisplayValue('Project One')).toBeDefined()
    expect(screen.getByDisplayValue('Project Two')).toBeDefined()
  })

  it('renders project URL when provided', () => {
    const projectsWithUrl: ProjectComponent[] = [
      { ...mockProjects[0], url: 'https://example.com' }
    ]
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

      />
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

      />
    )

    screen.getByTestId('project-toggle-included').click()
    expect(onToggle).toHaveBeenCalledWith('p1', mockProjects[0].vectors)
  })
})
