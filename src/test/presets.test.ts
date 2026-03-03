import { describe, expect, it } from 'vitest'
import {
  arePresetOverridesEqual,
  createPreset,
  createPresetSnapshot,
} from '../utils/presets'

describe('preset helpers', () => {
  it('creates deterministic snapshots for current overrides', () => {
    const snapshot = createPresetSnapshot(
      { 'bullet:a': true },
      { 'bullet:a': 'default' },
      { role1: ['b1', 'b2'] },
      {
        preset: 'ferguson-v12',
        overrides: { marginLeft: 0.85 },
      },
    )

    expect(snapshot).toEqual({
      manualOverrides: { 'bullet:a': true },
      variantOverrides: { 'bullet:a': 'default' },
      bulletOrders: { role1: ['b1', 'b2'] },
      theme: {
        preset: 'ferguson-v12',
        overrides: { marginLeft: 0.85 },
      },
    })
  })

  it('compares overrides independent of object key order', () => {
    const left = {
      manualOverrides: { b: true, a: false },
      variantOverrides: {},
      bulletOrders: { role1: ['b1', 'b2'] },
    }
    const right = {
      manualOverrides: { a: false, b: true },
      variantOverrides: {},
      bulletOrders: { role1: ['b1', 'b2'] },
    }

    expect(arePresetOverridesEqual(left, right)).toBe(true)
  })

  it('creates a preset model with timestamps and optional description', () => {
    const created = createPreset(
      'preset-1',
      'Security',
      '',
      'backend',
      {
        manualOverrides: {},
        variantOverrides: {},
        bulletOrders: {},
        theme: { preset: 'ferguson-v12' },
      },
      '2026-01-01T00:00:00.000Z',
    )

    expect(created.id).toBe('preset-1')
    expect(created.baseVector).toBe('backend')
    expect(created.description).toBeUndefined()
    expect(created.createdAt).toBe('2026-01-01T00:00:00.000Z')
  })
})
