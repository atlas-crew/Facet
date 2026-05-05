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
})
