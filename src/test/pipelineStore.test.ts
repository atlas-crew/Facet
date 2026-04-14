import { describe, it, expect, beforeEach } from 'vitest'
import {
  migratePipelineState,
  usePipelineStore,
} from '../store/pipelineStore'
import type { PipelineEntry } from '../types/pipeline'
import { DEFAULT_LOCAL_WORKSPACE_ID } from '../types/durable'

const makeEntry = (overrides: Partial<PipelineEntry> = {}): Omit<PipelineEntry, 'id' | 'createdAt' | 'lastAction' | 'history'> => ({
  company: 'Acme Corp',
  role: 'Staff Engineer',
  tier: '1',
  status: 'researching',
  comp: '$170K–$210K',
  url: 'https://example.com',
  contact: '',
  vectorId: null,
  jobDescription: '',
  presetId: null,
  resumeVariant: '',
  positioning: '',
  skillMatch: '',
  nextStep: '',
  notes: '',
  appMethod: 'direct-apply',
  response: 'none',
  daysToResponse: null,
  rounds: null,
  format: [],
  rejectionStage: '',
  rejectionReason: '',
  offerAmount: '',
  dateApplied: '',
  dateClosed: '',
  ...overrides,
})

describe('pipelineStore', () => {
  beforeEach(() => {
    usePipelineStore.setState({ entries: [], sortField: 'tier', sortDir: 'asc', filters: { tier: 'all', status: 'all', search: '' } })
  })

  it('adds an entry with generated id, createdAt, lastAction, and history', () => {
    usePipelineStore.getState().addEntry(makeEntry())
    const entries = usePipelineStore.getState().entries
    expect(entries).toHaveLength(1)
    expect(entries[0].id).toMatch(/^pipe-/)
    expect(entries[0].createdAt).toBeTruthy()
    expect(entries[0].lastAction).toBeTruthy()
    expect(entries[0].history).toHaveLength(1)
    expect(entries[0].history[0].note).toBe('Created')
    expect(entries[0].company).toBe('Acme Corp')
    expect(entries[0].durableMeta?.workspaceId).toBe(DEFAULT_LOCAL_WORKSPACE_ID)
    expect(entries[0].durableMeta?.revision).toBe(0)
  })

  it('updates an entry and bumps lastAction', () => {
    usePipelineStore.getState().addEntry(makeEntry())
    const id = usePipelineStore.getState().entries[0].id
    const before = usePipelineStore.getState().entries[0]
    usePipelineStore.getState().updateEntry(id, {
      company: 'Initech',
      durableMeta: {
        workspaceId: 'ignored-workspace',
        tenantId: 'tenant-x',
        userId: 'user-x',
        schemaVersion: 99,
        revision: 41,
        createdAt: '2020-01-01T00:00:00.000Z',
        updatedAt: '2020-01-01T00:00:00.000Z',
      },
    })
    const updated = usePipelineStore.getState().entries[0]
    expect(updated.company).toBe('Initech')
    expect(updated.durableMeta?.workspaceId).toBe(DEFAULT_LOCAL_WORKSPACE_ID)
    expect(updated.durableMeta?.createdAt).toBe(before.durableMeta?.createdAt)
    expect(updated.durableMeta?.revision).toBe((before.durableMeta?.revision ?? 0) + 1)
  })

  it('deletes an entry', () => {
    usePipelineStore.getState().addEntry(makeEntry())
    usePipelineStore.getState().addEntry(makeEntry({ company: 'Other' }))
    expect(usePipelineStore.getState().entries).toHaveLength(2)
    const id = usePipelineStore.getState().entries[0].id
    usePipelineStore.getState().deleteEntry(id)
    expect(usePipelineStore.getState().entries).toHaveLength(1)
    expect(usePipelineStore.getState().entries[0].company).toBe('Other')
  })

  it('adds a history note', () => {
    usePipelineStore.getState().addEntry(makeEntry())
    const id = usePipelineStore.getState().entries[0].id
    usePipelineStore.getState().addHistoryNote(id, 'Recruiter call')
    const entry = usePipelineStore.getState().entries[0]
    expect(entry.history).toHaveLength(2)
    expect(entry.history[1].note).toBe('Recruiter call')
  })

  it('sets status and adds history entry', () => {
    usePipelineStore.getState().addEntry(makeEntry())
    const id = usePipelineStore.getState().entries[0].id
    usePipelineStore.getState().setStatus(id, 'applied')
    const entry = usePipelineStore.getState().entries[0]
    expect(entry.status).toBe('applied')
    expect(entry.history).toHaveLength(2)
    expect(entry.history[1].note).toContain('applied')
  })

  it('sets sort field and toggles direction', () => {
    usePipelineStore.getState().setSort('company')
    expect(usePipelineStore.getState().sortField).toBe('company')
    expect(usePipelineStore.getState().sortDir).toBe('asc')
    usePipelineStore.getState().setSort('company')
    expect(usePipelineStore.getState().sortDir).toBe('desc')
  })

  it('sets filters', () => {
    usePipelineStore.getState().setFilter('tier', '1')
    expect(usePipelineStore.getState().filters.tier).toBe('1')
    usePipelineStore.getState().setFilter('search', 'acme')
    expect(usePipelineStore.getState().filters.search).toBe('acme')
  })

  it('imports entries replacing existing', () => {
    usePipelineStore.getState().addEntry(makeEntry())
    expect(usePipelineStore.getState().entries).toHaveLength(1)
    const imported: PipelineEntry[] = [
      { ...makeEntry({ company: 'Imported' }), id: 'pipe-imp-1', createdAt: '2026-01-01', lastAction: '2026-01-01', history: [] },
    ]
    usePipelineStore.getState().importEntries(imported)
    expect(usePipelineStore.getState().entries).toHaveLength(1)
    expect(usePipelineStore.getState().entries[0].company).toBe('Imported')
    expect(usePipelineStore.getState().entries[0].durableMeta?.workspaceId).toBe(DEFAULT_LOCAL_WORKSPACE_ID)
    expect(usePipelineStore.getState().entries[0].durableMeta?.createdAt).toBe('2026-01-01T00:00:00.000Z')
  })

  it('exports entries', () => {
    usePipelineStore.getState().addEntry(makeEntry())
    usePipelineStore.getState().addEntry(makeEntry({ company: 'Two' }))
    const exported = usePipelineStore.getState().exportEntries()
    expect(exported).toHaveLength(2)
  })

  it('migrates persisted entries to durable ISO timestamps and defaults invalid state', () => {
    const migrated = migratePipelineState({
      entries: [
        {
          ...makeEntry({ company: 'Legacy' }),
          id: 'pipe-legacy-1',
          createdAt: '2026-01-01',
          lastAction: '2026-01-01',
          history: [],
          research: {
            status: 'investigated',
            summary: 'Fetched public job and company context',
            jobDescriptionSummary: '',
            interviewSignals: ['Recruiter screen is likely'],
            people: [
              {
                name: 'Alex Smith',
                title: 'Director of Platform',
                company: 'Legacy',
                profileUrl: 'https://www.linkedin.com/in/alex-smith',
                relevance: 'Likely org lead',
              },
            ],
            sources: [
              {
                label: 'Legacy job posting',
                url: 'https://example.com/jobs/legacy',
                kind: 'job-posting',
              },
              {
                label: '',
                kind: 'other',
              },
            ],
            searchQueries: ['Legacy staff engineer job'],
            lastInvestigatedAt: '2026-01-03T12:00:00.000Z',
          },
        },
      ],
    })

    expect(migrated.entries).toHaveLength(1)
    expect(migrated.entries[0].durableMeta?.workspaceId).toBe(DEFAULT_LOCAL_WORKSPACE_ID)
    expect(migrated.entries[0].durableMeta?.createdAt).toBe('2026-01-01T00:00:00.000Z')
    expect(migrated.entries[0].research).toEqual({
      status: 'investigated',
      summary: 'Fetched public job and company context',
      jobDescriptionSummary: '',
      interviewSignals: ['Recruiter screen is likely'],
      people: [
        {
          name: 'Alex Smith',
          title: 'Director of Platform',
          company: 'Legacy',
          profileUrl: 'https://www.linkedin.com/in/alex-smith',
          relevance: 'Likely org lead',
        },
      ],
      sources: [
        {
          label: 'Legacy job posting',
          url: 'https://example.com/jobs/legacy',
          kind: 'job-posting',
        },
      ],
      searchQueries: ['Legacy staff engineer job'],
      lastInvestigatedAt: '2026-01-03T12:00:00.000Z',
    })
    expect(migrated.sortField).toBe('tier')
    expect(migrated.sortDir).toBe('asc')

    expect(migratePipelineState('bad-state').entries).toEqual([])
  })

  it('drops research snapshots that only preserve timestamp metadata', () => {
    const migrated = migratePipelineState({
      entries: [
        {
          ...makeEntry({ company: 'Timestamp Only' }),
          id: 'pipe-legacy-2',
          createdAt: '2026-01-01',
          lastAction: '2026-01-01',
          history: [],
          research: {
            status: 'investigated',
            summary: '',
            jobDescriptionSummary: '',
            interviewSignals: [],
            people: [],
            sources: [],
            searchQueries: [],
            lastInvestigatedAt: '2026-01-03T12:00:00.000Z',
          },
        },
      ],
    })

    expect(migrated.entries[0]?.research).toBeUndefined()
  })
})
