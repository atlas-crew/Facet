// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest'
import { resumeMigration, useResumeStore } from '../store/resumeStore'
import { defaultResumeData } from '../store/defaultData'

describe('resumeStore', () => {
  beforeEach(() => {
    useResumeStore.setState({
      data: { ...defaultResumeData },
      past: [],
      future: [],
      canUndo: false,
      canRedo: false,
    })
  })

  it('setData pushes to history', () => {
    const nextData = { ...defaultResumeData, meta: { ...defaultResumeData.meta, name: 'New Name' } }
    useResumeStore.getState().setData(nextData)
    
    expect(useResumeStore.getState().data.meta.name).toBe('New Name')
    expect(useResumeStore.getState().past.length).toBe(1)
    expect(useResumeStore.getState().past[0].meta.name).toBe('Jane Smith')
    expect(useResumeStore.getState().canUndo).toBe(true)
  })

  it('undo/redo works for data changes', () => {
    const store = useResumeStore.getState()
    const nextData = { ...defaultResumeData, meta: { ...defaultResumeData.meta, name: 'New Name' } }
    
    store.setData(nextData)
    expect(useResumeStore.getState().data.meta.name).toBe('New Name')
    
    useResumeStore.getState().undo()
    expect(useResumeStore.getState().data.meta.name).toBe('Jane Smith')
    expect(useResumeStore.getState().canRedo).toBe(true)
    
    useResumeStore.getState().redo()
    expect(useResumeStore.getState().data.meta.name).toBe('New Name')
  })

  it('undo with empty history is a no-op', () => {
    const before = useResumeStore.getState().data
    useResumeStore.getState().undo()
    expect(useResumeStore.getState().data).toBe(before)
  })

  it('setOverride pushes to history', () => {
    useResumeStore.getState().setOverride('backend', 'b1', true)
    
    expect(useResumeStore.getState().data.manualOverrides?.backend?.b1).toBe(true)
    expect(useResumeStore.getState().past.length).toBe(1)
    
    useResumeStore.getState().undo()
    expect(useResumeStore.getState().data.manualOverrides?.backend?.b1).toBeUndefined()
  })

  it('handles null override (deletion)', () => {
    useResumeStore.getState().setOverride('backend', 'b1', true)
    useResumeStore.getState().setOverride('backend', 'b1', null)
    
    expect(useResumeStore.getState().data.manualOverrides?.backend?.b1).toBeUndefined()
    expect(useResumeStore.getState().past.length).toBe(2)
  })

  it('resetOverridesForVector clears specific vector', () => {
    useResumeStore.getState().setOverride('backend', 'b1', true)
    useResumeStore.getState().setOverride('platform', 'b2', true)
    
    useResumeStore.getState().resetOverridesForVector('backend')
    
    const data = useResumeStore.getState().data
    expect(data.manualOverrides?.backend).toBeUndefined()
    expect(data.manualOverrides?.platform?.b2).toBe(true)
  })

  it('setVariantOverride pushes to history and handles null', () => {
    useResumeStore.getState().setVariantOverride('backend', 'b1', 'v1')
    expect(useResumeStore.getState().data.variantOverrides?.backend?.b1).toBe('v1')
    
    useResumeStore.getState().setVariantOverride('backend', 'b1', null)
    expect(useResumeStore.getState().data.variantOverrides?.backend?.b1).toBeUndefined()
    
    useResumeStore.getState().undo()
    expect(useResumeStore.getState().data.variantOverrides?.backend?.b1).toBe('v1')
  })

  it('resetAllOverrides works and undoes', () => {
    useResumeStore.getState().setOverride('backend', 'b1', true)
    useResumeStore.getState().resetAllOverrides()
    
    expect(useResumeStore.getState().data.manualOverrides).toEqual({})
    
    useResumeStore.getState().undo()
    expect(useResumeStore.getState().data.manualOverrides?.backend?.b1).toBe(true)
  })

  it('resetRoleBulletOrder works and undoes', () => {
    useResumeStore.getState().setRoleBulletOrder('backend', 'r1', ['b1'])
    useResumeStore.getState().resetRoleBulletOrder('backend', 'r1')
    
    expect(useResumeStore.getState().data.bulletOrders?.backend?.r1).toBeUndefined()
    
    useResumeStore.getState().undo()
    expect(useResumeStore.getState().data.bulletOrders?.backend?.r1).toEqual(['b1'])
  })

  it('updateData skips history if next state is identical', () => {
    useResumeStore.getState().updateData((current) => current)
    
    expect(useResumeStore.getState().past.length).toBe(0)
    expect(useResumeStore.getState().canUndo).toBe(false)
  })

  it('setData skips history if data is referentially identical', () => {
    const data = useResumeStore.getState().data
    useResumeStore.getState().setData(data)
    expect(useResumeStore.getState().past.length).toBe(0)
  })

  it('canUndo/canRedo flags are correctly synchronized', () => {
    expect(useResumeStore.getState().canUndo).toBe(false)
    expect(useResumeStore.getState().canRedo).toBe(false)
    
    useResumeStore.getState().setOverride('backend', 'b1', true)
    expect(useResumeStore.getState().canUndo).toBe(true)
    
    useResumeStore.getState().undo()
    expect(useResumeStore.getState().canUndo).toBe(false)
    expect(useResumeStore.getState().canRedo).toBe(true)
    
    useResumeStore.getState().redo()
    expect(useResumeStore.getState().canUndo).toBe(true)
    expect(useResumeStore.getState().canRedo).toBe(false)
  })

  it('limits history to MAX_HISTORY', () => {
    // MAX_HISTORY is 50
    for (let i = 0; i < 60; i++) {
      useResumeStore.getState().setOverride('backend', `b${i}`, true)
    }
    
    expect(useResumeStore.getState().past.length).toBe(50)
  })

  it('resumeMigration recovers positioning overrides from legacy data', () => {
    const mockUiData = JSON.stringify({
      state: {
        manualOverrides: { backend: { b1: true } },
        variantOverrides: { backend: { b1: 'v1' } },
        bulletOrders: { backend: { r1: ['b1'] } }
      }
    })
    
    // Pass persistedState.data as a valid object but without _overridesMigrated
    const persistedState = { 
      data: { 
        ...defaultResumeData,
        _overridesMigrated: false 
      } 
    }
    const migrated = resumeMigration(persistedState, 1, mockUiData)
    
    expect(migrated.data.manualOverrides.backend.b1).toBe(true)
    expect(migrated.data.variantOverrides.backend.b1).toBe('v1')
    expect(migrated.data.bulletOrders.backend.r1).toEqual(['b1'])
    expect(migrated.data._overridesMigrated).toBe(true)
  })
})

