// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { SkillGroupList } from '../components/SkillGroupList'
import type { SkillGroup, VectorDef } from '../types'

afterEach(() => {
  cleanup()
})

const mockSkillGroups: SkillGroup[] = [
  {
    id: 's1',
    label: 'Languages',
    content: 'TypeScript, Rust',
    vectors: { all: { priority: 'include', order: 1 } }
  },
  {
    id: 's2',
    label: 'Frameworks',
    content: 'React, Next.js',
    vectors: { all: { priority: 'include', order: 2 } }
  }
]

const mockVectors: VectorDef[] = [
  { id: 'v1', label: 'Vector 1', color: '#ff0000' }
]

describe('SkillGroupList', () => {
  it('renders a list of skill groups', () => {
    render(
      <SkillGroupList
        skillGroups={mockSkillGroups}
        vectorDefs={mockVectors}
        selectedVector="all"
        includedByKey={{}}
        onReorder={vi.fn()}
        onUpdate={vi.fn()}
        onUpdateVectors={vi.fn()}
        onToggleIncluded={vi.fn()}
      />
    )

    expect(screen.getByDisplayValue('Languages')).toBeDefined()
    expect(screen.getByDisplayValue('Frameworks')).toBeDefined()
  })

  it('renders content for each skill group', () => {
    render(
      <SkillGroupList
        skillGroups={mockSkillGroups}
        vectorDefs={mockVectors}
        selectedVector="all"
        includedByKey={{}}
        onReorder={vi.fn()}
        onUpdate={vi.fn()}
        onUpdateVectors={vi.fn()}
        onToggleIncluded={vi.fn()}
      />
    )

    expect(screen.getByDisplayValue('TypeScript, Rust')).toBeDefined()
    expect(screen.getByDisplayValue('React, Next.js')).toBeDefined()
  })

  it('calls onToggleIncluded when eye icon is clicked', () => {
    const onToggle = vi.fn()
    render(
      <SkillGroupList
        skillGroups={[mockSkillGroups[0]]}
        vectorDefs={mockVectors}
        selectedVector="all"
        includedByKey={{}}
        onReorder={vi.fn()}
        onUpdate={vi.fn()}
        onUpdateVectors={vi.fn()}
        onToggleIncluded={onToggle}
      />
    )

    const toggleBtn = screen.getByRole('button', { name: /^Included$/i })
    toggleBtn.click()
    expect(onToggle).toHaveBeenCalledWith('s1')
  })
})
