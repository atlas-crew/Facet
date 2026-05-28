// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { ComponentLibrary } from '../components/ComponentLibrary'
import { BulletList } from '../components/BulletList'
import { defaultResumeData } from '../store/defaultData'
import type { ComponentLibraryActions } from '../hooks/useComponentLibraryActions'
import type { ResumeData, Role } from '../types'

vi.mock('../components/BulletList', () => ({
  BulletList: vi.fn(() => <div data-testid="bullet-list-probe" />),
}))

const bulletListMock = vi.mocked(BulletList)

const cloneDefaultData = (): ResumeData => JSON.parse(JSON.stringify(defaultResumeData))

const buildActions = (): ComponentLibraryActions => ({
  addComponent: vi.fn(),
  addMetaLink: vi.fn(),
  deleteCertification: vi.fn(),
  deleteEducation: vi.fn(),
  removeMetaLink: vi.fn(),
  reorderBullets: vi.fn(),
  reorderCertifications: vi.fn(),
  reorderEducation: vi.fn(),
  reorderProjects: vi.fn(),
  reorderSkillGroups: vi.fn(),
  resetBulletVariant: vi.fn(),
  resetProfileVariant: vi.fn(),
  resetProjectVariant: vi.fn(),
  resetRoleBulletOrder: vi.fn(),
  resetTargetLineVariant: vi.fn(),
  toggleBullet: vi.fn(),
  toggleComponent: vi.fn(),
  toggleEducation: vi.fn(),
  updateBullet: vi.fn(),
  updateBulletLabel: vi.fn(),
  updateBulletVariant: vi.fn(),
  updateBulletVectors: vi.fn(),
  updateCertification: vi.fn(),
  updateCertificationVectors: vi.fn(),
  updateEducation: vi.fn(),
  updateMetaField: vi.fn(),
  updateMetaLink: vi.fn(),
  updateProfile: vi.fn(),
  updateProfileVariant: vi.fn(),
  updateProfileVectors: vi.fn(),
  updateProject: vi.fn(),
  updateProjectVariant: vi.fn(),
  updateProjectVectors: vi.fn(),
  updateRole: vi.fn(),
  updateSkillGroup: vi.fn(),
  updateSkillGroupVectors: vi.fn(),
  updateTargetLine: vi.fn(),
  updateTargetLineVariant: vi.fn(),
  updateTargetLineVectors: vi.fn(),
})

const renderLibrary = (overrides: Partial<ComponentProps<typeof ComponentLibrary>> = {}) => {
  const data = overrides.data ?? cloneDefaultData()

  return render(
    <ComponentLibrary
      data={data}
      selectedVector="backend"
      includedByKey={{}}
      bulletOrderByRole={{}}
      activeVectorBulletOrderByRole={{}}
      defaultBulletOrderByRole={{}}
      actions={buildActions()}
      onReframeBullet={vi.fn()}
      reframeLoadingId={null}
      aiEnabled={false}
      {...overrides}
    />,
  )
}

const firstBulletListProps = () => bulletListMock.mock.calls[0]?.[0]
const latestBulletListPropsForRole = (roleId: string) =>
  bulletListMock.mock.calls
    .map((call) => call[0])
    .reverse()
    .find((props) => props.role.id === roleId)

describe('ComponentLibrary hot path props', () => {
  beforeEach(() => {
    bulletListMock.mockClear()
  })

  afterEach(() => {
    cleanup()
  })

  it('preserves the original role reference when no custom bullet order applies', () => {
    const data = cloneDefaultData()
    const { rerender } = renderLibrary({ data })

    const firstRole = firstBulletListProps()?.role

    rerender(
      <ComponentLibrary
        data={data}
        selectedVector="backend"
        includedByKey={{}}
        bulletOrderByRole={{}}
        activeVectorBulletOrderByRole={{}}
        defaultBulletOrderByRole={{}}
        actions={buildActions()}
        onReframeBullet={vi.fn()}
        reframeLoadingId="unrelated-bullet"
        aiEnabled={false}
      />,
    )

    expect(firstRole).toBe(data.roles[0])
    expect(latestBulletListPropsForRole('acme')?.role).toBe(firstRole)
  })

  it('creates an ordered role copy only when a custom bullet order applies', () => {
    const data = cloneDefaultData()
    const order = ['acme-b3', 'acme-b1', 'acme-b2']

    renderLibrary({
      data,
      bulletOrderByRole: { acme: order },
    })

    const orderedRole = firstBulletListProps()?.role as Role

    expect(orderedRole).not.toBe(data.roles[0])
    expect(orderedRole.bullets.map((bullet) => bullet.id)).toEqual(order)
  })

  it('passes default-order reset state in all-vectors mode without a custom label', () => {
    renderLibrary({
      selectedVector: 'all',
      defaultBulletOrderByRole: { acme: ['acme-b1', 'acme-b2'] },
    })

    expect(firstBulletListProps()).toMatchObject({
      canResetOrder: true,
      customOrderLabel: undefined,
    })
  })

  it('passes vector custom-order labels and falls back to the vector id when unknown', () => {
    const defaultOrder = { acme: ['acme-b1', 'acme-b2', 'acme-b3'] }
    const vectorOrder = { acme: ['acme-b2', 'acme-b1', 'acme-b3'] }

    const { rerender } = renderLibrary({
      selectedVector: 'backend',
      defaultBulletOrderByRole: defaultOrder,
      activeVectorBulletOrderByRole: vectorOrder,
    })

    expect(firstBulletListProps()).toMatchObject({
      canResetOrder: true,
      customOrderLabel: 'Custom order for Backend Engineering',
    })

    rerender(
      <ComponentLibrary
        data={cloneDefaultData()}
        selectedVector="unknown-vector"
        includedByKey={{}}
        bulletOrderByRole={{}}
        activeVectorBulletOrderByRole={vectorOrder}
        defaultBulletOrderByRole={defaultOrder}
        actions={buildActions()}
        onReframeBullet={vi.fn()}
        reframeLoadingId={null}
        aiEnabled={false}
      />,
    )

    expect(latestBulletListPropsForRole('acme')).toMatchObject({
      customOrderLabel: 'Custom order for unknown-vector',
    })
  })

  it('does not inherit default reset state for a specific vector without active order', () => {
    renderLibrary({
      selectedVector: 'backend',
      defaultBulletOrderByRole: { acme: ['acme-b1', 'acme-b2'] },
      activeVectorBulletOrderByRole: {},
    })

    expect(firstBulletListProps()).toMatchObject({
      canResetOrder: false,
      customOrderLabel: undefined,
    })
  })
})
