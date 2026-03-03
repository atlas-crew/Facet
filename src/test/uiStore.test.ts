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
    appearance: 'system',
  })
})

describe('uiStore', () => {
  it('defaults to system appearance', () => {
    expect(useUiStore.getState().appearance).toBe('system')
  })

  it('updates appearance', () => {
    useUiStore.getState().setAppearance('light')
    expect(useUiStore.getState().appearance).toBe('light')

    useUiStore.getState().setAppearance('dark')
    expect(useUiStore.getState().appearance).toBe('dark')
  })

  it('clamps panel ratio to configured bounds', () => {
    useUiStore.getState().setPanelRatio(0.1)
    expect(useUiStore.getState().panelRatio).toBe(0.3)

    useUiStore.getState().setPanelRatio(0.9)
    expect(useUiStore.getState().panelRatio).toBe(0.7)
  })

  it('updates selected vector', () => {
    useUiStore.getState().setSelectedVector('backend')
    expect(useUiStore.getState().selectedVector).toBe('backend')
  })
})
