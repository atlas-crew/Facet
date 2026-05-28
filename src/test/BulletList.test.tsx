// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { BulletList } from '../components/BulletList'
import type { Role, VectorDef } from '../types'

afterEach(() => {
  cleanup()
})

const mockVectors: VectorDef[] = [{ id: 'backend', label: 'Backend', color: '#2563eb' }]

function buildRole(count: number): Role {
  return {
    id: 'role-1',
    company: 'Acme Corp',
    title: 'Staff Engineer',
    dates: '2020 - Present',
    vectors: {},
    bullets: Array.from({ length: count }, (_, index) => ({
      id: `bullet-${index + 1}`,
      text: `Bullet ${index + 1}`,
      vectors: { backend: 'include' },
    })),
  }
}

function renderBulletList(role: Role) {
  return render(
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
}

describe('BulletList', () => {
  it('renders every card for normal-sized bullet lists', () => {
    renderBulletList(buildRole(3))

    expect(screen.getByTestId('bullet-list-role-1').getAttribute('data-virtualized')).toBe('true')
    expect(screen.getByDisplayValue('Bullet 1')).toBeDefined()
    expect(screen.getByDisplayValue('Bullet 3')).toBeDefined()
    expect(screen.getAllByLabelText('Reorder bullet')).toHaveLength(3)
  })

  it('virtualizes large bullet lists while preserving visible keyboard drag handles', () => {
    renderBulletList(buildRole(60))

    expect(screen.getByTestId('bullet-list-role-1').getAttribute('data-virtualized')).toBe('true')
    expect(screen.getByDisplayValue('Bullet 1')).toBeDefined()
    expect(screen.queryByDisplayValue('Bullet 60')).toBeNull()
    expect(screen.getAllByLabelText('Reorder bullet').length).toBeLessThan(60)
    expect(document.querySelectorAll('[data-virtualized-placeholder]').length).toBeGreaterThan(0)

    fireEvent.scroll(screen.getByTestId('bullet-list-role-1'), { target: { scrollTop: 16_000 } })
    expect(screen.getByDisplayValue('Bullet 60')).toBeDefined()
  })
})
