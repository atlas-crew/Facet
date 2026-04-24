import { describe, expect, it } from 'vitest'
import type { PipelineEntry, PipelineRound } from '../types/pipeline'
import {
  buildPrepCompanyResearchNotes,
  buildPrepPipelineEntryContext,
} from '../utils/prepPipelineContext'

const makeRound = (overrides: Partial<PipelineRound> = {}): PipelineRound => ({
  id: 'round-42',
  label: 'HM panel',
  format: 'hm-screen',
  scheduledFor: '2026-05-01T14:00:00.000Z',
  interviewers: [
    {
      id: 'iv-jordan',
      name: 'Jordan Lee',
      title: 'Director of Platform',
      linkedInUrl: 'https://linkedin.example/jordan-lee',
    },
  ],
  createdAt: '2026-04-10T10:00:00.000Z',
  updatedAt: '2026-04-10T10:00:00.000Z',
  ...overrides,
})

const pipelineEntryFixture: PipelineEntry = {
  id: 'pipe-1',
  company: 'Acme Corp',
  role: 'Staff Engineer',
  tier: '1',
  status: 'interviewing',
  comp: '$220k',
  url: 'https://acme.example/jobs/1',
  contact: 'Jordan Lee',
  vectorId: 'backend',
  jobDescription: 'Build distributed systems and platform tooling.',
  presetId: null,
  resumeVariant: '',
  resumeGeneration: null,
  positioning: 'Lead with backend platform wins.',
  skillMatch: 'distributed systems, platform',
  nextStep: 'Prepare for the system design round.',
  notes: 'Hiring manager cares about operational excellence.',
  appMethod: 'recruiter-inbound',
  response: 'interview-scheduled',
  daysToResponse: null,
  rounds: 3,
  format: ['system-design'],
  rejectionStage: '',
  rejectionReason: '',
  offerAmount: '',
  dateApplied: '2026-03-01',
  dateClosed: '',
  lastAction: '2026-03-09',
  createdAt: '2026-03-01',
  history: [
    { date: '2026-03-01', note: 'Created' },
    { date: '2026-03-08', note: 'Recruiter screen scheduled' },
  ],
  research: {
    status: 'investigated',
    summary: 'Public evidence points to a platform-heavy reliability role.',
    jobDescriptionSummary: 'Reliability, developer experience, and cross-functional influence.',
    interviewSignals: ['Public reports mention a recruiter screen and system design loop.'],
    // Legacy people data — kept in the fixture to prove the context builder
    // intentionally does not forward it under the new architecture.
    people: [
      {
        name: 'Jordan Lee',
        title: 'Director of Platform',
        company: 'Acme Corp',
        profileUrl: 'https://linkedin.example/jordan-lee',
        relevance: 'Likely org leader for this team.',
      },
    ],
    sources: [
      {
        label: 'Acme careers',
        url: 'https://acme.example/jobs/1',
        kind: 'job-posting',
      },
    ],
    searchQueries: ['Acme staff engineer interview'],
    lastInvestigatedAt: '2026-03-08T12:00:00.000Z',
  },
  interviewRounds: [makeRound()],
}

describe('prepPipelineContext', () => {
  describe('buildPrepCompanyResearchNotes', () => {
    it('builds a research-rich notes draft from the pipeline entry', () => {
      const notes = buildPrepCompanyResearchNotes(pipelineEntryFixture)

      expect(notes).toContain('Positioning Notes:')
      expect(notes).toContain('Pipeline Notes:')
      expect(notes).toContain('Research Summary:')
      expect(notes).toContain('Interview Signals:')
      expect(notes).toContain('Research Sources:')
    })

    it('never includes a Relevant People section even when legacy data exists', () => {
      // doc-30 §Interviewer Capture: user-sourced round.interviewers is the
      // only valid source of interviewer identity; legacy research.people
      // must not flow into the generator as a prose section.
      const notes = buildPrepCompanyResearchNotes(pipelineEntryFixture)

      expect(notes).not.toContain('Relevant People')
      expect(notes).not.toContain('Jordan Lee')
    })
  })

  describe('buildPrepPipelineEntryContext', () => {
    it('carries status, nextStep, and research summary into the structured context', () => {
      const context = buildPrepPipelineEntryContext(pipelineEntryFixture)

      expect(context.status).toBe('interviewing')
      expect(context.nextStep).toBe('Prepare for the system design round.')
      expect(context.research?.summary).toContain('platform-heavy reliability role')
    })

    it('omits the round field when no roundId is supplied', () => {
      const context = buildPrepPipelineEntryContext(pipelineEntryFixture)
      expect(context.round).toBeUndefined()
    })

    it('populates the round field when roundId matches an entry round', () => {
      const context = buildPrepPipelineEntryContext(pipelineEntryFixture, 'round-42')

      expect(context.round).toBeDefined()
      expect(context.round?.id).toBe('round-42')
      expect(context.round?.label).toBe('HM panel')
      expect(context.round?.format).toBe('hm-screen')
      expect(context.round?.scheduledFor).toBe('2026-05-01T14:00:00.000Z')
      expect(context.round?.interviewers).toHaveLength(1)
      expect(context.round?.interviewers[0]).toMatchObject({
        id: 'iv-jordan',
        name: 'Jordan Lee',
        title: 'Director of Platform',
        linkedInUrl: 'https://linkedin.example/jordan-lee',
      })
    })

    it('leaves round undefined when roundId does not match any entry round', () => {
      const context = buildPrepPipelineEntryContext(pipelineEntryFixture, 'round-nonexistent')
      expect(context.round).toBeUndefined()
    })

    it('propagates PipelineInterviewer.dossier as round interviewer intel', () => {
      // Future-proofs step 5: once T3 writes dossiers onto PipelineInterviewer,
      // the context builder hands them through as intel for the generator.
      const entry: PipelineEntry = {
        ...pipelineEntryFixture,
        interviewRounds: [
          makeRound({
            interviewers: [
              {
                id: 'iv-alice',
                name: 'Alice',
                title: 'Principal',
                dossier: {
                  role: 'Principal on platform team',
                  caresAbout: 'reliability over velocity',
                },
                lineThatLands: 'I take on-call burden seriously.',
              },
            ],
          }),
        ],
      }

      const context = buildPrepPipelineEntryContext(entry, 'round-42')
      expect(context.round?.interviewers[0].intel?.caresAbout).toBe(
        'reliability over velocity',
      )
      expect(context.round?.interviewers[0].lineThatLands).toBe(
        'I take on-call burden seriously.',
      )
    })

    it('never exposes research.people on the structured context', () => {
      // The context type deliberately omits `people` from research; the
      // runtime must match. Legacy blob data on `entry.research.people` is
      // ignored at the translation boundary.
      const context = buildPrepPipelineEntryContext(pipelineEntryFixture)
      expect(context.research).toBeDefined()
      expect('people' in (context.research ?? {})).toBe(false)
    })
  })
})
