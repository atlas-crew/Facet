import { describe, expect, it } from 'vitest'
import { ensureSkillGroupVectors, reorderSkillGroupForSelection } from '../utils/skillGroupVectors'
import type { ResumeVector, SkillGroupComponent } from '../types'

const vectors: ResumeVector[] = [
  { id: 'backend', label: 'Backend', color: '#3b82f6' },
  { id: 'security', label: 'Security', color: '#ef4444' },
]

const baseSkillGroup: SkillGroupComponent = {
  id: 'sg-1',
  label: 'Languages',
  content: 'TypeScript, Rust',
}

describe('ensureSkillGroupVectors', () => {
  it('creates default vector configs when skill group has none', () => {
    const result = ensureSkillGroupVectors(baseSkillGroup, vectors)
    expect(result).toEqual({
      backend: { priority: 'include', order: 1, content: undefined },
      security: { priority: 'include', order: 2, content: undefined },
    })
  })

  it('preserves existing vector config values', () => {
    const sg: SkillGroupComponent = {
      ...baseSkillGroup,
      vectors: {
        backend: { priority: 'include', order: 5, content: 'Go, Rust' },
      },
    }
    const result = ensureSkillGroupVectors(sg, vectors)
    expect(result.backend).toEqual({ priority: 'include', order: 5, content: 'Go, Rust' })
    expect(result.security).toEqual({ priority: 'include', order: 2, content: undefined })
  })

  it('falls back to legacy order map when vector config is missing', () => {
    const sg: SkillGroupComponent = {
      ...baseSkillGroup,
      order: { backend: 10, default: 99 },
    }
    const result = ensureSkillGroupVectors(sg, vectors)
    expect(result.backend.order).toBe(10)
    expect(result.security.order).toBe(99) // falls back to default
  })

  it('uses index-based fallback when no legacy order exists', () => {
    const result = ensureSkillGroupVectors(baseSkillGroup, vectors)
    expect(result.backend.order).toBe(1) // index 0 + 1
    expect(result.security.order).toBe(2) // index 1 + 1
  })

  it('returns empty object for empty vectors array', () => {
    const result = ensureSkillGroupVectors(baseSkillGroup, [])
    expect(result).toEqual({})
  })
})

describe('reorderSkillGroupForSelection', () => {
  it('updates order for all vectors when selection is "all"', () => {
    const result = reorderSkillGroupForSelection(baseSkillGroup, 'all', vectors, 42)
    expect(result.vectors?.backend?.order).toBe(42)
    expect(result.vectors?.security?.order).toBe(42)
  })

  it('updates order for only the selected vector', () => {
    const result = reorderSkillGroupForSelection(baseSkillGroup, 'backend', vectors, 7)
    expect(result.vectors?.backend?.order).toBe(7)
    // Security should keep its default order (index 1 + 1 = 2)
    expect(result.vectors?.security?.order).toBe(2)
  })

  it('preserves other vector config fields when reordering', () => {
    const sg: SkillGroupComponent = {
      ...baseSkillGroup,
      vectors: {
        backend: { priority: 'include', order: 1, content: 'Go' },
        security: { priority: 'include', order: 3, content: 'SAST' },
      },
    }
    const result = reorderSkillGroupForSelection(sg, 'backend', vectors, 10)
    expect(result.vectors?.backend).toEqual({ priority: 'include', order: 10, content: 'Go' })
    expect(result.vectors?.security).toEqual({ priority: 'include', order: 3, content: 'SAST' })
  })

  it('preserves base skill group fields', () => {
    const result = reorderSkillGroupForSelection(baseSkillGroup, 'all', vectors, 1)
    expect(result.id).toBe('sg-1')
    expect(result.label).toBe('Languages')
    expect(result.content).toBe('TypeScript, Rust')
  })
})
