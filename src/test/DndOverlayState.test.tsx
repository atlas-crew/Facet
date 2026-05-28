// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { BulletList } from '../components/BulletList'
import { ProjectList } from '../components/ProjectList'
import type { ProjectComponent, Role, VectorDef } from '../types'

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({
    children,
    onDragStart,
    onDragEnd,
    onDragCancel,
  }: {
    children: ReactNode
    onDragStart?: (event: { active: { id: string } }) => void
    onDragEnd?: (event: { active: { id: string }; over: { id: string } | null }) => void
    onDragCancel?: () => void
  }) => (
    <div>
      <button
        type="button"
        data-testid="start-bullet-drag"
        onClick={() => onDragStart?.({ active: { id: 'bullet-1' } })}
      >
        start bullet
      </button>
      <button
        type="button"
        data-testid="start-project-drag"
        onClick={() => onDragStart?.({ active: { id: 'project-1' } })}
      >
        start project
      </button>
      <button
        type="button"
        data-testid="end-drag"
        onClick={() => onDragEnd?.({ active: { id: 'bullet-1' }, over: { id: 'bullet-1' } })}
      >
        end
      </button>
      <button type="button" data-testid="cancel-drag" onClick={() => onDragCancel?.()}>
        cancel
      </button>
      {children}
    </div>
  ),
  DragOverlay: ({ children }: { children: ReactNode }) => (
    <div data-testid="drag-overlay">{children}</div>
  ),
  KeyboardSensor: vi.fn(),
  PointerSensor: vi.fn(),
  closestCenter: vi.fn(),
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn(() => []),
}))

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: ReactNode }) => <>{children}</>,
  arrayMove: <T,>(items: T[], from: number, to: number) => {
    const next = [...items]
    const [item] = next.splice(from, 1)
    if (item !== undefined) next.splice(to, 0, item)
    return next
  },
  sortableKeyboardCoordinates: vi.fn(),
  verticalListSortingStrategy: {},
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
}))

vi.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Transform: {
      toString: () => undefined,
    },
  },
}))

afterEach(() => {
  cleanup()
})

const mockVectors: VectorDef[] = [{ id: 'backend', label: 'Backend', color: '#2563eb' }]

const role: Role = {
  id: 'role-1',
  company: 'Acme Corp',
  title: 'Staff Engineer',
  dates: '2020 - Present',
  vectors: {},
  bullets: [
    { id: 'bullet-1', text: 'Bullet 1', vectors: { backend: 'include' } },
    { id: 'bullet-2', text: 'Bullet 2', vectors: { backend: 'include' } },
  ],
}

const projects: ProjectComponent[] = [
  { id: 'project-1', name: 'Project 1', text: 'Description 1', vectors: { all: 'include' } },
  { id: 'project-2', name: 'Project 2', text: 'Description 2', vectors: { all: 'include' } },
]

function buildLargeRole(): Role {
  return {
    ...role,
    bullets: Array.from({ length: 60 }, (_, index) => ({
      id: `bullet-${index + 1}`,
      text: `Bullet ${index + 1}`,
      vectors: { backend: 'include' },
    })),
  }
}

describe('virtualized dnd overlays', () => {
  it('renders and clears the active bullet overlay', () => {
    render(
      <BulletList
        role={role}
        vectorDefs={mockVectors}
        selectedVector="all"
        canResetOrder={false}
        onResetOrder={vi.fn()}
        includedByKey={{}}
        onToggleBullet={vi.fn()}
        onReorder={vi.fn()}
        onChangeBulletText={vi.fn()}
        onChangeBulletLabel={vi.fn()}
        onSetBulletVectors={vi.fn()}
        onUpdateRole={vi.fn()}
        onReframe={vi.fn()}
        reframeLoadingId={null}
        aiEnabled={false}
      />,
    )

    fireEvent.click(screen.getByTestId('start-bullet-drag'))
    expect(screen.getByTestId('drag-overlay').textContent).toContain('Bullet 1')

    fireEvent.click(screen.getByTestId('cancel-drag'))
    expect(screen.getByTestId('drag-overlay').textContent).not.toContain('Bullet 1')

    fireEvent.click(screen.getByTestId('start-bullet-drag'))
    expect(screen.getByTestId('drag-overlay').textContent).toContain('Bullet 1')
    fireEvent.click(screen.getByTestId('end-drag'))
    expect(screen.getByTestId('drag-overlay').textContent).not.toContain('Bullet 1')
  })

  it('renders and clears the active project overlay', () => {
    render(
      <ProjectList
        projects={projects}
        vectorDefs={mockVectors}
        selectedVector="all"
        includedByKey={{}}
        onReorder={vi.fn()}
        onUpdate={vi.fn()}
        onUpdateVectors={vi.fn()}
        onToggleIncluded={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByTestId('start-project-drag'))
    expect(screen.getByTestId('drag-overlay').textContent).toContain('Project 1')

    fireEvent.click(screen.getByTestId('cancel-drag'))
    expect(screen.getByTestId('drag-overlay').textContent).not.toContain('Project 1')

    fireEvent.click(screen.getByTestId('start-project-drag'))
    expect(screen.getByTestId('drag-overlay').textContent).toContain('Project 1')
    fireEvent.click(screen.getByTestId('end-drag'))
    expect(screen.getByTestId('drag-overlay').textContent).not.toContain('Project 1')
  })

  it('keeps the active bullet card mounted after virtualized scrolling', () => {
    render(
      <BulletList
        role={buildLargeRole()}
        vectorDefs={mockVectors}
        selectedVector="all"
        canResetOrder={false}
        onResetOrder={vi.fn()}
        includedByKey={{}}
        onToggleBullet={vi.fn()}
        onReorder={vi.fn()}
        onChangeBulletText={vi.fn()}
        onChangeBulletLabel={vi.fn()}
        onSetBulletVectors={vi.fn()}
        onUpdateRole={vi.fn()}
        onReframe={vi.fn()}
        reframeLoadingId={null}
        aiEnabled={false}
      />,
    )

    fireEvent.click(screen.getByTestId('start-bullet-drag'))
    fireEvent.scroll(screen.getByTestId('bullet-list-role-1'), { target: { scrollTop: 16_000 } })

    expect(screen.getByDisplayValue('Bullet 1')).toBeDefined()
  })
})
