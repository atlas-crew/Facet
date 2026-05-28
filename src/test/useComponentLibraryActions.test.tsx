// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useComponentLibraryActions } from '../hooks/useComponentLibraryActions'
import { defaultResumeData } from '../store/defaultData'
import { normalizeResumeWorkspaceData, useResumeStore } from '../store/resumeStore'
import type { VectorSelection } from '../types'
import { componentKeys } from '../utils/componentKeys'

const cloneDefaultWorkspace = () =>
  normalizeResumeWorkspaceData(JSON.parse(JSON.stringify(defaultResumeData)))

const getOptions = (selectedVector: VectorSelection = 'backend') => {
  const data = useResumeStore.getState().data
  const vectorKey = selectedVector

  return {
    data,
    selectedVector,
    vectorKey,
    overridesForVector: data.manualOverrides?.[vectorKey] ?? {},
  }
}

const renderActions = (selectedVector: VectorSelection = 'backend') =>
  renderHook((options: ReturnType<typeof getOptions>) => useComponentLibraryActions(options), {
    initialProps: getOptions(selectedVector),
  })

describe('useComponentLibraryActions', () => {
  beforeEach(() => {
    useResumeStore.setState({
      ...cloneDefaultWorkspace(),
      past: [],
      future: [],
      canUndo: false,
      canRedo: false,
    })
  })

  it('toggles manual overrides relative to vector priority', () => {
    const { result, rerender } = renderActions()
    const componentKey = componentKeys.targetLine('tl-backend')

    act(() => {
      result.current.toggleComponent(componentKey, { backend: 'include' })
    })

    expect(useResumeStore.getState().data.manualOverrides?.backend?.[componentKey]).toBe(false)

    rerender(getOptions())

    act(() => {
      result.current.toggleComponent(componentKey, { backend: 'include' })
    })

    expect(useResumeStore.getState().data.manualOverrides?.backend?.[componentKey]).toBeUndefined()
  })

  it('adds an explicit include override for auto-excluded components', () => {
    const { result } = renderActions()
    const componentKey = componentKeys.project('project-1')

    act(() => {
      result.current.toggleComponent(componentKey, { backend: 'exclude' })
    })

    expect(useResumeStore.getState().data.manualOverrides?.backend?.[componentKey]).toBe(true)
  })

  it('toggles education overrides from included by default', () => {
    const { result, rerender } = renderActions()
    const componentKey = componentKeys.education('edu-ucb')

    act(() => {
      result.current.toggleEducation('edu-ucb')
    })

    expect(useResumeStore.getState().data.manualOverrides?.backend?.[componentKey]).toBe(false)

    rerender(getOptions())

    act(() => {
      result.current.toggleEducation('edu-ucb')
    })

    expect(useResumeStore.getState().data.manualOverrides?.backend?.[componentKey]).toBeUndefined()
  })

  it('toggles bullet overrides through bullet-specific component keys', () => {
    const { result } = renderActions()
    const componentKey = componentKeys.bullet('acme', 'acme-b1')

    act(() => {
      result.current.toggleBullet('acme', 'acme-b1', { backend: 'include' })
    })

    expect(useResumeStore.getState().data.manualOverrides?.backend?.[componentKey]).toBe(false)
  })

  it('writes vector-specific variants and falls back to base text for all-vectors editing', () => {
    const specific = renderActions('backend')

    act(() => {
      specific.result.current.updateBulletVariant('acme', 'acme-b1', 'Backend-specific bullet')
    })

    let bullet = useResumeStore
      .getState()
      .data.roles.find((role) => role.id === 'acme')
      ?.bullets.find((item) => item.id === 'acme-b1')

    expect(bullet?.variants?.backend).toBe('Backend-specific bullet')
    expect(bullet?.text).toBe(
      'Designed and built a high-throughput order processing pipeline serving 25M+ events/day.',
    )

    const allVectors = renderActions('all')

    act(() => {
      allVectors.result.current.updateBulletVariant('acme', 'acme-b1', 'Updated base bullet')
    })

    bullet = useResumeStore
      .getState()
      .data.roles.find((role) => role.id === 'acme')
      ?.bullets.find((item) => item.id === 'acme-b1')

    expect(bullet?.text).toBe('Updated base bullet')
    expect(bullet?.variants?.backend).toBe('Backend-specific bullet')

    act(() => {
      allVectors.result.current.resetBulletVariant('acme', 'acme-b1')
    })

    bullet = useResumeStore
      .getState()
      .data.roles.find((role) => role.id === 'acme')
      ?.bullets.find((item) => item.id === 'acme-b1')

    expect(bullet?.variants?.backend).toBe('Backend-specific bullet')

    act(() => {
      specific.result.current.resetBulletVariant('acme', 'acme-b1')
    })

    bullet = useResumeStore
      .getState()
      .data.roles.find((role) => role.id === 'acme')
      ?.bullets.find((item) => item.id === 'acme-b1')

    expect(bullet?.variants?.backend).toBeUndefined()
  })

  it('routes project variant edits to variants or base text by vector selection', () => {
    const specific = renderActions('platform')

    act(() => {
      specific.result.current.updateProjectVariant('project-1', 'Platform project variant')
    })

    let project = useResumeStore.getState().data.projects.find((item) => item.id === 'project-1')
    expect(project?.variants?.platform).toBe('Platform project variant')
    expect(project?.text).toBe(
      'Distributed task queue library with adaptive retry and dead-letter routing.',
    )

    const allVectors = renderActions('all')

    act(() => {
      allVectors.result.current.updateProjectVariant('project-1', 'Updated project base text')
    })

    project = useResumeStore.getState().data.projects.find((item) => item.id === 'project-1')
    expect(project?.text).toBe('Updated project base text')
    expect(project?.variants?.platform).toBe('Platform project variant')
  })

  it('routes target line, profile, and project variant resets by vector selection', () => {
    const specific = renderActions('platform')

    act(() => {
      specific.result.current.updateTargetLineVariant('tl-backend', 'Platform target line')
      specific.result.current.updateProfileVariant('profile-backend', 'Platform profile')
      specific.result.current.updateProjectVariant('project-1', 'Platform project')
    })

    let state = useResumeStore.getState().data
    expect(state.target_lines.find((item) => item.id === 'tl-backend')?.variants?.platform).toBe(
      'Platform target line',
    )
    expect(state.profiles.find((item) => item.id === 'profile-backend')?.variants?.platform).toBe(
      'Platform profile',
    )
    expect(state.projects.find((item) => item.id === 'project-1')?.variants?.platform).toBe(
      'Platform project',
    )

    act(() => {
      specific.result.current.resetTargetLineVariant('tl-backend')
      specific.result.current.resetProfileVariant('profile-backend')
      specific.result.current.resetProjectVariant('project-1')
    })

    state = useResumeStore.getState().data
    expect(
      state.target_lines.find((item) => item.id === 'tl-backend')?.variants?.platform,
    ).toBeUndefined()
    expect(
      state.profiles.find((item) => item.id === 'profile-backend')?.variants?.platform,
    ).toBeUndefined()
    expect(
      state.projects.find((item) => item.id === 'project-1')?.variants?.platform,
    ).toBeUndefined()

    const allVectors = renderActions('all')

    act(() => {
      allVectors.result.current.updateTargetLineVariant('tl-backend', 'Updated target base')
      allVectors.result.current.updateProfileVariant('profile-backend', 'Updated profile base')
    })

    state = useResumeStore.getState().data
    expect(state.target_lines.find((item) => item.id === 'tl-backend')?.text).toBe(
      'Updated target base',
    )
    expect(state.profiles.find((item) => item.id === 'profile-backend')?.text).toBe(
      'Updated profile base',
    )
  })

  it('adds new components using the active vector and trims entered text', () => {
    const { result } = renderActions('platform')

    act(() => {
      result.current.addComponent('bullet', {
        roleId: 'acme',
        text: '  Added platform bullet  ',
      })
    })

    const role = useResumeStore.getState().data.roles.find((item) => item.id === 'acme')
    const addedBullet = role?.bullets.at(-1)

    expect(addedBullet?.text).toBe('Added platform bullet')
    expect(addedBullet?.vectors).toEqual({ platform: 'include' })
  })

  it('maps add payload fields for every non-bullet component type', () => {
    const { result } = renderActions('platform')

    act(() => {
      result.current.addComponent('target_line', {
        text: '  Target line  ',
      })
      result.current.addComponent('profile', {
        text: '  Profile statement  ',
      })
      result.current.addComponent('skill_group', {
        label: '  Data Systems  ',
        content: '  Kafka, Flink  ',
      })
      result.current.addComponent('project', {
        name: '  Project Atlas  ',
        url: '  atlas.example  ',
        text: '  Project summary  ',
      })
      result.current.addComponent('role', {})
      result.current.addComponent('education', {
        name: '  State University  ',
        label: '  Austin, TX  ',
        text: '  B.S. Systems  ',
        url: '  2020  ',
      })
      result.current.addComponent('certification', {
        name: '  Cloud Cert  ',
        issuer: '  Cloud Org  ',
        date: '  2024  ',
        content: '  CERT-123  ',
        url: '  cert.example  ',
      })
    })

    const state = useResumeStore.getState().data

    expect(state.target_lines.at(-1)).toMatchObject({
      text: 'Target line',
      vectors: { platform: 'include' },
    })
    expect(state.profiles.at(-1)).toMatchObject({
      text: 'Profile statement',
      vectors: { platform: 'include' },
    })
    expect(state.skill_groups.at(-1)).toMatchObject({
      label: 'Data Systems',
      content: 'Kafka, Flink',
    })
    expect(state.projects.at(-1)).toMatchObject({
      name: 'Project Atlas',
      url: 'atlas.example',
      text: 'Project summary',
      vectors: { platform: 'include' },
    })
    expect(state.roles.at(-1)).toMatchObject({
      company: 'New Company',
      title: 'Role Title',
      dates: 'Jan 2024 – Present',
      vectors: { platform: 'include' },
    })
    expect(state.education.at(-1)).toMatchObject({
      school: 'State University',
      location: 'Austin, TX',
      degree: 'B.S. Systems',
      year: '2020',
      vectors: {},
    })
    expect(state.certifications.at(-1)).toMatchObject({
      name: 'Cloud Cert',
      issuer: 'Cloud Org',
      date: '2024',
      credential_id: 'CERT-123',
      url: 'cert.example',
      vectors: { platform: 'include' },
    })
  })

  it('handles empty add payload fallbacks and skips bullets when no role exists', () => {
    const { result } = renderActions('platform')

    act(() => {
      result.current.addComponent('target_line', {})
      result.current.addComponent('profile', {})
      result.current.addComponent('skill_group', {})
      result.current.addComponent('project', {})
      result.current.addComponent('bullet', {})
      result.current.addComponent('education', {})
      result.current.addComponent('certification', {})
    })

    let state = useResumeStore.getState().data
    expect(state.target_lines.at(-1)).toMatchObject({ text: '', vectors: { platform: 'include' } })
    expect(state.profiles.at(-1)).toMatchObject({ text: '', vectors: { platform: 'include' } })
    expect(state.skill_groups.at(-1)).toMatchObject({
      label: 'New Skill Group',
      content: '',
    })
    expect(state.projects.at(-1)).toMatchObject({
      name: 'New Project',
      text: '',
      vectors: { platform: 'include' },
    })
    expect(state.roles[0]?.bullets.at(-1)).toMatchObject({
      text: '',
      vectors: { platform: 'include' },
    })
    expect(state.education.at(-1)).toMatchObject({
      school: 'New School',
      location: 'Location',
      degree: 'Degree',
      year: new Date().getFullYear().toString(),
      vectors: {},
    })
    expect(state.certifications.at(-1)).toMatchObject({
      name: 'New Certification',
      issuer: 'Issuer',
      vectors: { platform: 'include' },
    })

    useResumeStore.setState((current) => ({
      data: {
        ...current.data,
        roles: [],
      },
    }))

    const emptyRoleActions = renderActions('platform')

    act(() => {
      emptyRoleActions.result.current.addComponent('bullet', {})
    })

    state = useResumeStore.getState().data
    expect(state.roles).toEqual([])
  })

  it('stores and resets vector-scoped bullet order', () => {
    const { result } = renderActions('platform')
    const order = ['acme-b3', 'acme-b1', 'acme-b2']

    act(() => {
      result.current.reorderBullets('acme', order)
    })

    expect(useResumeStore.getState().data.bulletOrders?.platform?.acme).toEqual(order)

    act(() => {
      result.current.resetRoleBulletOrder('acme')
    })

    expect(useResumeStore.getState().data.bulletOrders?.platform?.acme).toBeUndefined()
  })
})
