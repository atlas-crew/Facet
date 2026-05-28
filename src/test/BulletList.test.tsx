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

function renderBulletListWithProps(props: Partial<Parameters<typeof BulletList>[0]>) {
  return render(
    <BulletList
      role={buildRole(3)}
      vectorDefs={mockVectors}
      selectedVector="backend"
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
      {...props}
    />,
  )
}

function getInclusionToggle() {
  const toggle = document.querySelector<HTMLButtonElement>(
    '.component-card-actions button[aria-pressed]',
  )
  if (!toggle) {
    throw new Error('Expected bullet inclusion toggle to render')
  }
  return toggle
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

  it('resolves bullet inclusion overrides by key precedence', () => {
    const role = buildRole(1)

    const { rerender } = renderBulletListWithProps({
      role,
      includedByKey: {
        'bullet-1': true,
        'bullet:bullet-1': true,
        'role:role-1:bullet-1': false,
      },
    })

    expect(getInclusionToggle().getAttribute('aria-pressed')).toBe('false')

    rerender(
      <BulletList
        role={role}
        vectorDefs={mockVectors}
        selectedVector="backend"
        canResetOrder={false}
        onResetOrder={vi.fn()}
        includedByKey={{ 'bullet-1': false }}
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

    expect(getInclusionToggle().getAttribute('aria-pressed')).toBe('false')

    rerender(
      <BulletList
        role={role}
        vectorDefs={mockVectors}
        selectedVector="backend"
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

    expect(getInclusionToggle().getAttribute('aria-pressed')).toBe('true')
  })

  it('resolves vector-specific bullet variants and reset affordance', () => {
    const role = buildRole(1)
    role.bullets[0] = {
      ...role.bullets[0],
      text: 'Base bullet',
      variants: { backend: 'Backend variant bullet' },
    }

    const { rerender } = renderBulletListWithProps({
      role,
      selectedVector: 'backend',
      onResetBulletVariant: vi.fn(),
    })

    expect(screen.getByDisplayValue('Backend variant bullet')).toBeDefined()
    expect(screen.getByText('V')).toBeDefined()
    expect(screen.getByRole('button', { name: /^Reset$/i })).toBeDefined()

    rerender(
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
        onResetBulletVariant={vi.fn()}
        reframeLoadingId={null}
        aiEnabled={false}
      />,
    )

    expect(screen.getByDisplayValue('Base bullet')).toBeDefined()
    expect(screen.queryByText('V')).toBeNull()
    expect(screen.queryByRole('button', { name: /^Reset$/i })).toBeNull()
  })
})
