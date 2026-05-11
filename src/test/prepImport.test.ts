// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import { parsePrepImport } from '../utils/prepImport'

describe('prepImport', () => {
  it('preserves and normalizes JDAnalysis metadata on imported decks', async () => {
    const file = new File(
      [
        JSON.stringify([
          {
            id: 'prep-deck-import',
            title: ' Imported Deck ',
            company: ' Acme ',
            role: ' Staff Engineer ',
            pipelineEntryId: 'pipe-entry-1',
            jdAnalysisId: ' jd-analysis-1 ',
            jdAnalysisGeneratedAt: ' 2026-04-22T09:00:00.000Z ',
            jdAnalysisModelVersion: ' jd-analysis.v1.match-multipass-sonnet ',
            jdTextHash: ' jdhash_1 ',
            updatedAt: '2026-04-22T10:00:00.000Z',
            cards: [
              {
                id: 'prep-card-1',
                title: 'Ownership story',
                category: 'behavioral',
                kind: 'story',
                tags: ['ownership'],
              },
            ],
          },
          {
            id: 'prep-deck-bad-metadata',
            title: 'Bad Metadata',
            company: 'Acme',
            role: 'Staff Engineer',
            pipelineEntryId: null,
            jdAnalysisId: 123,
            jdAnalysisGeneratedAt: '',
            jdAnalysisModelVersion: false,
            jdTextHash: ' ',
            updatedAt: '2026-04-22T10:00:00.000Z',
            cards: [
              {
                id: 'prep-card-2',
                title: 'Scope story',
                category: 'behavioral',
                kind: 'story',
                tags: [],
              },
            ],
          },
        ]),
      ],
      'prep.json',
      { type: 'application/json' },
    )

    const result = await parsePrepImport(file)

    expect(result.error).toBeNull()
    expect(result.decks).toHaveLength(2)
    expect(result.decks[0]).toEqual(
      expect.objectContaining({
        jdAnalysisId: 'jd-analysis-1',
        jdAnalysisGeneratedAt: '2026-04-22T09:00:00.000Z',
        jdAnalysisModelVersion: 'jd-analysis.v1.match-multipass-sonnet',
        jdTextHash: 'jdhash_1',
      }),
    )
    expect(result.decks[1]).toEqual(
      expect.objectContaining({
        jdAnalysisId: null,
        jdAnalysisGeneratedAt: null,
        jdAnalysisModelVersion: null,
        jdTextHash: null,
      }),
    )
  })

  it('infers missing legacy card kinds and malformed explicit kinds', async () => {
    const file = new File(
      [
        JSON.stringify([
          {
            id: 'prep-card-legacy',
            title: 'Legacy opener',
            category: 'opener',
            tags: ['intro'],
            scriptKind: 'opener',
          },
          {
            id: 'prep-card-invalid',
            title: 'Invalid shape',
            category: 'behavioral',
            kind: 'freeform',
            tags: [],
          },
        ]),
      ],
      'prep.json',
      { type: 'application/json' },
    )

    const result = await parsePrepImport(file)

    expect(result.error).toBeNull()
    expect(result.decks).toHaveLength(1)
    expect(result.decks[0]?.cards).toEqual([
      expect.objectContaining({
        id: 'prep-card-legacy',
        kind: 'opener',
        scriptKind: 'opener',
      }),
      expect.objectContaining({
        id: 'prep-card-invalid',
        kind: 'story',
      }),
    ])
    expect(result.skipped).toBe(0)
  })
})
