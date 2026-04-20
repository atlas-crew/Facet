import { describe, expect, it } from 'vitest'
import type { DebriefSession } from '../types/debrief'
import { summarizeDebriefPatterns } from '../utils/debriefPatterns'

const buildSession = (
  id: string,
  overrides: Partial<DebriefSession> = {},
): DebriefSession => ({
  id,
  generatedAt: '2026-04-03T12:00:00.000Z',
  company: 'Acme',
  role: 'Staff Engineer',
  sourceKind: 'match',
  pipelineEntryId: null,
  roundName: 'Hiring Manager',
  interviewDate: '2026-04-03',
  outcome: 'advance',
  rawNotes: 'notes',
  questionsAsked: [],
  whatWorked: [],
  whatDidnt: [],
  storiesTold: [],
  summary: 'summary',
  overallTakeaway: 'takeaway',
  anchorStories: [],
  recurringGaps: [],
  bestFitCompanyTypes: [],
  identityDraft: {
    generatedAt: '2026-04-03T12:00:00.000Z',
    summary: 'draft',
    followUpQuestions: [],
    identity: {
      version: 3,
      schema_revision: '3.1',
      model_revision: 0,
      identity: {
        name: 'Test',
        email: '',
        phone: '',
        location: '',
        links: [],
        thesis: '',
      },
      self_model: {
        arc: [],
        philosophy: [],
        interview_style: {
          strengths: [],
          weaknesses: [],
          prep_strategy: '',
        },
      },
      preferences: {
        compensation: { priorities: [] },
        work_model: { preference: 'remote' },
        matching: { prioritize: [], avoid: [] },
      },
      skills: { groups: [] },
      profiles: [],
      roles: [],
      projects: [],
      education: [],
      generator_rules: {
        voice_skill: 'voice',
        resume_skill: 'resume',
      },
    },
    bullets: [],
    warnings: [],
  },
  correctionNotes: [],
  followUpQuestions: [],
  warnings: [],
  ...overrides,
})

describe('debriefPatterns', () => {
  it('summarizes repeated pattern signals across sessions', () => {
    const summary = summarizeDebriefPatterns([
      buildSession('s1', {
        anchorStories: [
          {
            id: 'platform-migration',
            label: 'Platform migration story',
            reason: 'Got strong follow-up questions.',
          },
        ],
        recurringGaps: [
          {
            id: 'missing-metrics',
            label: 'Missing metrics',
            reason: 'Impact numbers were weak.',
          },
        ],
      }),
      buildSession('s2', {
        anchorStories: [
          {
            id: 'platform-migration',
            label: 'Platform migration story',
            reason: 'Still the strongest example.',
          },
        ],
        bestFitCompanyTypes: [
          {
            id: 'platform-heavy',
            label: 'Platform-heavy companies',
            reason: 'Interviewers responded to platform depth.',
          },
        ],
      }),
    ])

    expect(summary.anchorStories[0]).toEqual(
      expect.objectContaining({
        id: 'platform-migration',
        count: 2,
      }),
    )
    expect(summary.recurringGaps[0]?.id).toBe('missing-metrics')
    expect(summary.bestFitCompanyTypes[0]?.id).toBe('platform-heavy')
  })
})
