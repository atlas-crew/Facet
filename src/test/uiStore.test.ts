// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'
import { useUiStore } from '../store/uiStore'

beforeEach(() => {
  if (typeof globalThis.localStorage?.clear === 'function') {
    globalThis.localStorage.clear()
  }
  useUiStore.setState({
    selectedVector: 'all',
    panelRatio: 0.45,
    manualOverrides: {},
    variantOverrides: {},
    bulletOrders: {},
  })
})

describe('uiStore', () => {
  it('clamps panel ratio to configured bounds', () => {
    useUiStore.getState().setPanelRatio(0.1)
    expect(useUiStore.getState().panelRatio).toBe(0.3)

    useUiStore.getState().setPanelRatio(0.9)
    expect(useUiStore.getState().panelRatio).toBe(0.7)
  })

  it('supports set and clear include overrides', () => {
    useUiStore.getState().setOverride('backend', 'bullet:r1:b1', true)
    expect(useUiStore.getState().manualOverrides.backend['bullet:r1:b1']).toBe(true)

    useUiStore.getState().setOverride('backend', 'bullet:r1:b1', null)
    expect(useUiStore.getState().manualOverrides.backend['bullet:r1:b1']).toBeUndefined()
  })

  it('resets manual, variant, and bullet-order overrides for one vector', () => {
    const state = useUiStore.getState()
    state.setOverride('backend', 'bullet:r1:b1', false)
    state.setVariantOverride('backend', 'bullet:r1:b1', 'default')
    state.setRoleBulletOrder('backend', 'r1', ['b1', 'b2'])

    state.setOverride('platform', 'bullet:r2:b4', true)
    state.setRoleBulletOrder('platform', 'r2', ['b4'])

    state.resetOverridesForVector('backend')

    const next = useUiStore.getState()
    expect(next.manualOverrides.backend).toBeUndefined()
    expect(next.variantOverrides.backend).toBeUndefined()
    expect(next.bulletOrders.backend).toBeUndefined()

    expect(next.manualOverrides.platform['bullet:r2:b4']).toBe(true)
    expect(next.bulletOrders.platform.r2).toEqual(['b4'])
  })
})
