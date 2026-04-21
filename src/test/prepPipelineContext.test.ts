import { describe, expect, it } from 'vitest'
import type { PipelineEntry } from '../types/pipeline'
import {
  buildPrepCompanyResearchNotes,
  buildPrepPipelineEntryContext,
} from '../utils/prepPipelineContext'

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
}

describe('prepPipelineContext', () => {
  it('builds a research-rich notes draft from the pipeline entry', () => {
    const notes = buildPrepCompanyResearchNotes(pipelineEntryFixture)

    expect(notes).toContain('Positioning Notes:')
    expect(notes).toContain('Pipeline Notes:')
    expect(notes).toContain('Research Summary:')
    expect(notes).toContain('Interview Signals:')
    expect(notes).toContain('Relevant People:')
    expect(notes).toContain('Jordan Lee')
    expect(notes).toContain('Research Sources:')
  })

  it('builds structured pipeline context for prep generation', () => {
    const context = buildPrepPipelineEntryContext(pipelineEntryFixture) as {
      research?: {
        people?: Array<{ name: string }>
        summary?: string
      }
      nextStep?: string
      status?: string
    }

    expect(context.status).toBe('interviewing')
    expect(context.nextStep).toBe('Prepare for the system design round.')
    expect(context.research?.summary).toContain('platform-heavy reliability role')
    expect(context.research?.people?.[0]?.name).toBe('Jordan Lee')
  })
})
