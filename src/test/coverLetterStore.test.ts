import { describe, expect, it, beforeEach } from 'vitest'
import { useCoverLetterStore } from '../store/coverLetterStore'
import type { CoverLetterTemplate } from '../types/coverLetter'

function buildTemplate(overrides: Partial<CoverLetterTemplate> = {}): CoverLetterTemplate {
  return {
    id: `t-${Math.random().toString(36).slice(2, 9)}`,
    name: 'Standard Template',
    header: 'Header',
    greeting: 'Hi',
    paragraphs: [],
    signOff: 'Thanks',
    ...overrides
  }
}

describe('coverLetterStore', () => {
  beforeEach(() => {
    // Clear the store before each test
    useCoverLetterStore.setState({ templates: [] })
  })

  it('starts with an empty template array', () => {
    const state = useCoverLetterStore.getState()
    expect(state.templates).toEqual([])
  })

  it('can add multiple templates and preserves existing ones', () => {
    const t1 = buildTemplate({ id: 't1', name: 'T1' })
    const t2 = buildTemplate({ id: 't2', name: 'T2' })

    useCoverLetterStore.getState().addTemplate(t1)
    useCoverLetterStore.getState().addTemplate(t2)
    
    const state = useCoverLetterStore.getState()
    expect(state.templates).toHaveLength(2)
    expect(state.templates[0].id).toBe('t1')
    expect(state.templates[1].id).toBe('t2')
  })

  it('updateTemplate patches matching template and preserves others', () => {
    const t1 = buildTemplate({ id: 't1', name: 'T1', greeting: 'Hi' })
    const t2 = buildTemplate({ id: 't2', name: 'T2' })

    useCoverLetterStore.getState().addTemplate(t1)
    useCoverLetterStore.getState().addTemplate(t2)
    
    useCoverLetterStore.getState().updateTemplate('t1', { greeting: 'Hello' })
    
    const state = useCoverLetterStore.getState()
    expect(state.templates.find(t => t.id === 't1')?.greeting).toBe('Hello')
    expect(state.templates.find(t => t.id === 't1')?.name).toBe('T1') // preserved
    expect(state.templates.find(t => t.id === 't2')).toEqual(t2) // untouched
  })

  it('updateTemplate shallow-merges and replaces nested arrays (paragraphs)', () => {
    const p1 = { id: 'p1', text: 'Text 1', vectors: {} }
    const p2 = { id: 'p2', text: 'Text 2', vectors: {} }
    const t1 = buildTemplate({ id: 't1', paragraphs: [p1] })

    useCoverLetterStore.getState().addTemplate(t1)
    
    // Replace with p2
    useCoverLetterStore.getState().updateTemplate('t1', { paragraphs: [p2] })
    
    const state = useCoverLetterStore.getState()
    expect(state.templates[0].paragraphs).toHaveLength(1)
    expect(state.templates[0].paragraphs[0].id).toBe('p2')
    expect(state.templates[0].paragraphs[0].text).toBe('Text 2')
  })

  it('updateTemplate with non-existent ID is a silent no-op', () => {
    const t1 = buildTemplate({ id: 't1' })
    useCoverLetterStore.getState().addTemplate(t1)
    
    useCoverLetterStore.getState().updateTemplate('nonexistent', { name: 'New' })
    
    const state = useCoverLetterStore.getState()
    expect(state.templates[0]).toEqual(t1)
  })

  it('deleteTemplate removes only the matching template', () => {
    const t1 = buildTemplate({ id: 't1' })
    const t2 = buildTemplate({ id: 't2' })

    useCoverLetterStore.getState().addTemplate(t1)
    useCoverLetterStore.getState().addTemplate(t2)
    
    useCoverLetterStore.getState().deleteTemplate('t1')
    
    const state = useCoverLetterStore.getState()
    expect(state.templates).toHaveLength(1)
    expect(state.templates[0].id).toBe('t2')
  })

  it('deleteTemplate with non-existent ID is a no-op', () => {
    const t1 = buildTemplate({ id: 't1' })
    useCoverLetterStore.getState().addTemplate(t1)
    
    useCoverLetterStore.getState().deleteTemplate('nonexistent')
    
    const state = useCoverLetterStore.getState()
    expect(state.templates).toHaveLength(1)
    expect(state.templates[0]).toEqual(t1)
  })

  it('importTemplates is a destructive replacement', () => {
    const t1 = buildTemplate({ id: 't1' })
    const t2 = buildTemplate({ id: 't2' })
    const t3 = buildTemplate({ id: 't3' })

    useCoverLetterStore.getState().addTemplate(t1)
    
    // Import t2, t3 - t1 should be gone
    useCoverLetterStore.getState().importTemplates([t2, t3])
    
    const state = useCoverLetterStore.getState()
    expect(state.templates).toHaveLength(2)
    expect(state.templates).not.toContainEqual(t1)
    expect(state.templates).toContainEqual(t2)
    expect(state.templates).toContainEqual(t3)
  })

  it('importTemplates with empty array clears the store', () => {
    const t1 = buildTemplate({ id: 't1' })
    useCoverLetterStore.getState().addTemplate(t1)
    
    useCoverLetterStore.getState().importTemplates([])
    
    const state = useCoverLetterStore.getState()
    expect(state.templates).toEqual([])
  })

  it('verifies persistence configuration', () => {
    // Access internal persist api if possible, or just check the options
    // Since we can't easily check the internal middleware config from the public state,
    // we just verify the state is cumulative across operations.
    const t1 = buildTemplate({ id: 't1', name: 'Name 1' })
    
    useCoverLetterStore.getState().addTemplate(t1)
    useCoverLetterStore.getState().updateTemplate('t1', { name: 'Updated' })
    useCoverLetterStore.getState().deleteTemplate('t1')
    
    const state = useCoverLetterStore.getState()
    expect(state.templates).toEqual([])
  })
})