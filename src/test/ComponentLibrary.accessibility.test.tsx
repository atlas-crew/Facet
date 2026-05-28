// @vitest-environment jsdom

import { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ComponentLibrary } from '../components/ComponentLibrary'
import { defaultResumeData } from '../store/defaultData'
import type { ComponentLibraryActions } from '../hooks/useComponentLibraryActions'
import type { ResumeData } from '../types'

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

function renderLibrary() {
  return render(
    <ComponentLibrary
      data={cloneDefaultData()}
      selectedVector="backend"
      includedByKey={{}}
      bulletOrderByRole={{}}
      activeVectorBulletOrderByRole={{}}
      defaultBulletOrderByRole={{}}
      actions={buildActions()}
      onReframeBullet={vi.fn()}
      reframeLoadingId={null}
      aiEnabled={false}
    />,
  )
}

function describedInstructionFor(handle: HTMLElement) {
  const describedBy = handle.getAttribute('aria-describedby')
  expect(describedBy).not.toBeNull()
  const instructions = document.getElementById(describedBy ?? '')
  expect(instructions).not.toBeNull()
  return instructions?.textContent ?? ''
}

describe('ComponentLibrary accessibility polish', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('wires drag handles to discoverable keyboard instructions', () => {
    renderLibrary()

    const bulletInstruction = describedInstructionFor(screen.getAllByLabelText('Reorder bullet')[0])
    const skillInstruction = describedInstructionFor(
      screen.getAllByLabelText(/Reorder skill group/i)[0],
    )

    expect(bulletInstruction).toContain('Space or Enter')
    expect(bulletInstruction).toContain('Arrow keys')
    expect(bulletInstruction).toContain('Escape')
    expect(skillInstruction).toContain('Space or Enter')
    expect(skillInstruction).toContain('Arrow keys')
    expect(skillInstruction).toContain('Escape')
  })

  it('announces add component type changes in a polite live region', () => {
    vi.useFakeTimers()
    renderLibrary()

    fireEvent.click(screen.getByRole('button', { name: 'Add Component' }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Type' }), {
      target: { value: 'project' },
    })

    act(() => {
      vi.advanceTimersByTime(20)
    })

    const announcement = screen.getByText('Switched to Project form')
    expect(announcement.closest('[aria-live]')?.getAttribute('aria-live')).toBe('polite')
  })
})
