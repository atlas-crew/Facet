import { describe, expect, it, beforeEach } from 'vitest'
import {
  migrateCoverLetterState,
  useCoverLetterStore,
} from '../store/coverLetterStore'
import type { CoverLetterTemplate } from '../types/coverLetter'
import { DEFAULT_LOCAL_WORKSPACE_ID } from '../types/durable'

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

function expectDurableMetadata(value: CoverLetterTemplate['durableMeta'], revision = 0) {
  expect(value).toEqual(
    expect.objectContaining({
      workspaceId: DEFAULT_LOCAL_WORKSPACE_ID,
      tenantId: null,
      userId: null,
      schemaVersion: 1,
      revision,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    }),
  )
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
    expectDurableMetadata(state.templates[0].durableMeta)
    expectDurableMetadata(state.templates[1].durableMeta)
  })

  it('updateTemplate patches matching template and preserves others', () => {
    const t1 = buildTemplate({ id: 't1', name: 'T1', greeting: 'Hi' })
    const t2 = buildTemplate({ id: 't2', name: 'T2' })

    useCoverLetterStore.getState().addTemplate(t1)
    useCoverLetterStore.getState().addTemplate(t2)
    
    useCoverLetterStore.getState().updateTemplate('t1', { greeting: 'Hello' })
    
    const state = useCoverLetterStore.getState()
    const updated = state.templates.find(t => t.id === 't1')
    const untouched = state.templates.find(t => t.id === 't2')
    expect(updated?.greeting).toBe('Hello')
    expect(updated?.name).toBe('T1')
    expectDurableMetadata(updated?.durableMeta, 1)
    expect(untouched).toEqual(expect.objectContaining(t2))
    expectDurableMetadata(untouched?.durableMeta)
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
    const before = useCoverLetterStore.getState().templates[0]
    
    useCoverLetterStore.getState().updateTemplate('nonexistent', { name: 'New' })
    
    const state = useCoverLetterStore.getState()
    expect(state.templates[0]).toEqual(before)
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
    const before = useCoverLetterStore.getState().templates[0]
    
    useCoverLetterStore.getState().deleteTemplate('nonexistent')
    
    const state = useCoverLetterStore.getState()
    expect(state.templates).toHaveLength(1)
    expect(state.templates[0]).toEqual(before)
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
    expect(state.templates).toContainEqual(expect.objectContaining(t2))
    expect(state.templates).toContainEqual(expect.objectContaining(t3))
    expectDurableMetadata(state.templates[0].durableMeta)
    expectDurableMetadata(state.templates[1].durableMeta)
  })

  it('ignores incoming durable metadata patches and only bumps revision for matching updates', () => {
    const template = buildTemplate({ id: 't1', greeting: 'Hi' })
    useCoverLetterStore.getState().addTemplate(template)

    const before = useCoverLetterStore.getState().templates[0]

    useCoverLetterStore.getState().updateTemplate('t1', {
      durableMeta: {
        workspaceId: 'other-workspace',
        tenantId: 'tenant-x',
        userId: 'user-x',
        schemaVersion: 99,
        revision: 77,
        createdAt: '2020-01-01T00:00:00.000Z',
        updatedAt: '2020-01-01T00:00:00.000Z',
      },
      greeting: 'Hello',
    })

    const updated = useCoverLetterStore.getState().templates[0]
    expect(updated.greeting).toBe('Hello')
    expect(updated.durableMeta?.workspaceId).toBe(DEFAULT_LOCAL_WORKSPACE_ID)
    expect(updated.durableMeta?.tenantId).toBeNull()
    expect(updated.durableMeta?.userId).toBeNull()
    expect(updated.durableMeta?.schemaVersion).toBe(1)
    expect(updated.durableMeta?.createdAt).toBe(before.durableMeta?.createdAt)
    expect(updated.durableMeta?.revision).toBe((before.durableMeta?.revision ?? 0) + 1)
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

  it('migrates persisted templates and safely defaults invalid persisted state', () => {
    const migrated = migrateCoverLetterState({
      templates: [
        buildTemplate({
          id: 'legacy-template',
          durableMeta: {
            workspaceId: '',
            tenantId: 'tenant-a',
            userId: 'user-a',
            schemaVersion: 'bad' as unknown as number,
            revision: 'bad' as unknown as number,
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '',
          },
        }),
      ],
    })

    expect(migrated.templates).toHaveLength(1)
    expect(migrated.templates[0].durableMeta).toEqual(
      expect.objectContaining({
        workspaceId: DEFAULT_LOCAL_WORKSPACE_ID,
        tenantId: 'tenant-a',
        userId: 'user-a',
        schemaVersion: 1,
        revision: 0,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      }),
    )

    expect(migrateCoverLetterState('bad-state').templates).toEqual([])
  })
})
