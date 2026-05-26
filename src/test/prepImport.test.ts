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

  it('imports scenario fields and drops invalid or duplicate deck bookends', async () => {
    const file = new File(
      [
        JSON.stringify([
          {
            id: 'prep-deck-scenario',
            title: 'Scenario Deck',
            company: 'Acme',
            role: 'Staff Engineer',
            pipelineEntryId: 'pipeline-1',
            pipelineRoundId: 'round-1',
            roundType: 'system-design',
            roundNumber: 1,
            interviewers: [
              {
                id: 'interviewer-1',
                name: 'Sample Panelist',
                intel: { role: 'Engineering Manager' },
              },
            ],
            categoryGuidance: {
              situational: 'Answer the scenario directly.',
            },
            rules: ['Be specific.'],
            openerCardId: 'scenario-card',
            closerCardId: 'missing-card',
            sections: [
              null,
              123,
              {
                id: ' scenarios ',
                title: ' Scenarios ',
                cardIds: ['scenario-card', 'scenario-card', 'missing'],
              },
              { id: 'untitled', title: ' ', cardIds: ['second-scenario-card'] },
              { id: 'scenarios', title: 'Second Scenarios', cardIds: ['second-scenario-card'] },
              { id: 'duplicate', title: 'Duplicate', cardIds: ['scenario-card'] },
            ],
            updatedAt: '2026-04-22T10:00:00.000Z',
            cards: [
              {
                id: 'scenario-card',
                title: 'How would you migrate the platform?',
                category: 'situational',
                kind: 'scenario',
                tags: ['system-design'],
                scriptLabel: ' Frame it ',
                script: ' Use a staged rollout answer. ',
                keyPoints: [' Name rollback. ', ' ', ' Show risk ownership. '],
                storyBlocks: [
                  { label: 'problem', text: ' Legacy path is coupled. ' },
                  { label: 'result', text: ' Support load stayed low. ' },
                ],
                storyVariants: [
                  {
                    label: 'Migration variant',
                    storyBlocks: [{ label: 'problem', text: ' Variant problem. ' }],
                    keyPoints: [' Variant point. '],
                    roleContext: ' Platform migration ',
                    when: ' When they ask for another proof point ',
                  },
                  {
                    label: 'Drop missing blocks',
                    storyBlocks: [],
                  },
                  {
                    storyBlocks: [{ label: 'problem', text: ' Drop missing label. ' }],
                  },
                ],
                conditionals: [
                  {
                    trigger: ' If they push for big-bang migration ',
                    response: ' Acknowledge speed, then name blast-radius risk. ',
                    tone: 'pivot',
                  },
                  {
                    trigger: ' If they use an unknown tone ',
                    response: ' Keep the response and drop the tone. ',
                    tone: 'mystery',
                  },
                ],
                interviewerIds: [' interviewer-1 ', ' '],
                perRoundState: [{ round: 1, status: 'practice-this', notes: ' Review once. ' }],
                timeBudgetMinutes: 3.5,
                whyLikely: ' The role emphasizes staged migrations. ',
                decisionTree: [
                  {
                    title: ' Pick the path ',
                    options: [
                      {
                        option: ' Strangler ',
                        whenRight: ' Traffic can move gradually. ',
                        tradeoff: ' Requires routing discipline. ',
                      },
                    ],
                    recommendation: ' Move incrementally. ',
                    trap: ' Do not hand-wave data consistency. ',
                  },
                ],
                phasedFramework: [
                  {
                    phase: ' Map risk ',
                    timeframe: ' Week 1 ',
                    bullets: [' Inventory blast radius ', ' ', ' Pick rollback points '],
                  },
                ],
              },
              {
                id: 'second-scenario-card',
                title: 'How would you handle constraints?',
                category: 'situational',
                kind: 'scenario',
                tags: ['tradeoffs'],
              },
            ],
          },
          {
            id: 'prep-deck-duplicate-bookends',
            title: 'Duplicate Bookends',
            company: 'Acme',
            role: 'Staff Engineer',
            pipelineEntryId: null,
            pipelineRoundId: null,
            openerCardId: 'bookend-card',
            closerCardId: 'bookend-card',
            sections: [],
            updatedAt: '2026-04-22T10:00:00.000Z',
            cards: [
              {
                id: 'bookend-card',
                title: 'Tell me about yourself',
                category: 'opener',
                kind: 'opener',
                tags: ['intro'],
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
    expect(result.decks[0]).toMatchObject({
      openerCardId: 'scenario-card',
      closerCardId: undefined,
      pipelineRoundId: 'round-1',
      roundType: 'system-design',
      roundNumber: 1,
      interviewers: [
        {
          id: 'interviewer-1',
          name: 'Sample Panelist',
          intel: { role: 'Engineering Manager' },
        },
      ],
      categoryGuidance: {
        situational: 'Answer the scenario directly.',
      },
      rules: ['Be specific.'],
      sections: [
        { id: 'scenarios', title: 'Scenarios', cardIds: ['scenario-card'] },
        {
          id: 'scenarios-2',
          title: 'Second Scenarios',
          cardIds: ['second-scenario-card'],
        },
      ],
    })
    expect(result.decks[0]?.cards[0]).toMatchObject({
      kind: 'scenario',
      scriptLabel: ' Frame it ',
      script: ' Use a staged rollout answer. ',
      keyPoints: ['Name rollback.', 'Show risk ownership.'],
      storyBlocks: [
        { label: 'problem', text: 'Legacy path is coupled.' },
        { label: 'result', text: 'Support load stayed low.' },
      ],
      storyVariants: [
        expect.objectContaining({
          id: expect.stringMatching(/^prep-story-variant-/),
          label: 'Migration variant',
          storyBlocks: [{ label: 'problem', text: 'Variant problem.' }],
          keyPoints: ['Variant point.'],
          roleContext: 'Platform migration',
          when: 'When they ask for another proof point',
        }),
      ],
      conditionals: [
        {
          trigger: 'If they push for big-bang migration',
          response: 'Acknowledge speed, then name blast-radius risk.',
          tone: 'pivot',
        },
        {
          trigger: 'If they use an unknown tone',
          response: 'Keep the response and drop the tone.',
          tone: undefined,
        },
      ],
      interviewerIds: ['interviewer-1'],
      perRoundState: [{ round: 1, status: 'practice-this', notes: 'Review once.' }],
      timeBudgetMinutes: 3.5,
      whyLikely: 'The role emphasizes staged migrations.',
      decisionTree: [
        {
          title: 'Pick the path',
          options: [
            {
              option: 'Strangler',
              whenRight: 'Traffic can move gradually.',
              tradeoff: 'Requires routing discipline.',
            },
          ],
          recommendation: 'Move incrementally.',
          trap: 'Do not hand-wave data consistency.',
        },
      ],
      phasedFramework: [
        {
          phase: 'Map risk',
          timeframe: 'Week 1',
          bullets: ['Inventory blast radius', 'Pick rollback points'],
        },
      ],
    })
    expect(result.decks[1]?.sections).toBeUndefined()
    expect(result.decks[1]).toMatchObject({
      openerCardId: 'bookend-card',
      closerCardId: undefined,
      pipelineEntryId: null,
      pipelineRoundId: null,
    })
  })
})
