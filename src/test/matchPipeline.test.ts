import { describe, expect, it } from 'vitest'
import type { PipelineEntry } from '../types/pipeline'
import {
  findMatchingPipelineEntry,
  normalizePipelineMatchKey,
} from '../routes/match/matchPipeline'

const entry = (overrides: Partial<PipelineEntry>): PipelineEntry => ({
  id: overrides.id ?? 'pipe-1',
  company: overrides.company ?? 'Atlas',
  role: overrides.role ?? 'Staff Platform Engineer',
  tier: '1',
  status: 'researching',
  comp: '',
  url: '',
  contact: '',
  vectorId: null,
  jobDescription: '',
  jdAnalysisId: null,
  presetId: null,
  resumeVariant: '',
  resumeGeneration: null,
  positioning: '',
  skillMatch: '',
  nextStep: '',
  notes: '',
  appMethod: 'unknown',
  response: 'none',
  daysToResponse: null,
  rounds: null,
  format: [],
  rejectionStage: '',
  rejectionReason: '',
  offerAmount: '',
  dateApplied: '',
  dateClosed: '',
  createdAt: overrides.createdAt ?? '2026-04-01',
  lastAction: overrides.lastAction ?? '2026-04-01',
  history: [],
  ...overrides,
})

describe('matchPipeline helpers', () => {
  it('normalizes company suffixes and punctuation for pipeline matching', () => {
    expect(normalizePipelineMatchKey(' Atlas, Inc. ')).toBe('atlas')
    expect(normalizePipelineMatchKey('Atlas GmbH')).toBe('atlas')
    expect(normalizePipelineMatchKey('Research & Development Co.')).toBe('research and development')
    expect(normalizePipelineMatchKey('   ')).toBe('')
    expect(normalizePipelineMatchKey('Inc.')).toBe('')
    expect(normalizePipelineMatchKey(',./')).toBe('')
  })

  it('finds the newest non-deleted matching company and role', () => {
    const match = findMatchingPipelineEntry(
      [
        entry({
          id: 'old-match',
          company: 'Atlas LLC',
          role: 'Staff Platform Engineer',
          lastAction: '2026-04-01',
        }),
        entry({
          id: 'deleted-match',
          company: 'Atlas',
          role: 'Staff Platform Engineer',
          deletedAt: '2026-04-03T12:00:00.000Z',
          lastAction: '2026-04-03',
        }),
        entry({
          id: 'role-mismatch',
          company: 'Atlas',
          role: 'Principal Product Manager',
          lastAction: '2026-04-04',
        }),
        entry({
          id: 'rejected-match',
          company: 'Atlas SA',
          role: 'Staff Platform Engineer',
          status: 'rejected',
          lastAction: '2026-04-06',
        }),
        entry({
          id: 'new-match',
          company: 'Atlas, Inc.',
          role: 'Staff Platform Engineer',
          lastAction: '2026-04-05',
        }),
      ],
      'Atlas',
      'Staff Platform Engineer',
    )

    expect(match?.id).toBe('new-match')
    expect(findMatchingPipelineEntry([entry({})], '', 'Staff Platform Engineer')).toBeNull()
    expect(findMatchingPipelineEntry([entry({})], 'Atlas', '')).toBeNull()
    expect(
      findMatchingPipelineEntry(
        [entry({ company: 'Globex', role: 'Senior Backend Engineer' })],
        'Atlas',
        'Staff Platform Engineer',
      ),
    ).toBeNull()
  })

  it.each(['accepted', 'withdrawn', 'closed'] as const)(
    'skips %s entries when matching pipeline saves',
    (status) => {
      const match = findMatchingPipelineEntry(
        [
          entry({
            id: `${status}-match`,
            company: 'Atlas',
            role: 'Staff Platform Engineer',
            status,
            lastAction: '2026-04-10',
          }),
          entry({
            id: 'active-match',
            company: 'Atlas',
            role: 'Staff Platform Engineer',
            status: 'researching',
            lastAction: '2026-04-01',
          }),
        ],
        'Atlas',
        'Staff Platform Engineer',
      )

      expect(match?.id).toBe('active-match')
    },
  )

  it('falls back to createdAt and treats invalid dates as oldest when sorting matches', () => {
    expect(
      findMatchingPipelineEntry(
        [
          entry({
            id: 'older-created',
            company: 'Atlas',
            role: 'Staff Platform Engineer',
            lastAction: '',
            createdAt: '2026-04-01',
          }),
          entry({
            id: 'newer-created',
            company: 'Atlas',
            role: 'Staff Platform Engineer',
            lastAction: '',
            createdAt: '2026-04-10',
          }),
        ],
        'Atlas',
        'Staff Platform Engineer',
      )?.id,
    ).toBe('newer-created')

    expect(
      findMatchingPipelineEntry(
        [
          entry({
            id: 'invalid-date',
            company: 'Atlas',
            role: 'Staff Platform Engineer',
            lastAction: 'not-a-date',
          }),
          entry({
            id: 'valid-date',
            company: 'Atlas',
            role: 'Staff Platform Engineer',
            lastAction: '2026-04-05',
          }),
        ],
        'Atlas',
        'Staff Platform Engineer',
      )?.id,
    ).toBe('valid-date')
  })
})
