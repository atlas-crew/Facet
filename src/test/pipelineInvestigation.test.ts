import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PipelineEntry } from '../types/pipeline'
import { investigatePipelineEntry } from '../utils/pipelineInvestigation'

const mockCallSearchProxy = vi.fn()

vi.mock('../utils/searchExecutor', async () => {
  const actual = await vi.importActual<typeof import('../utils/searchExecutor')>('../utils/searchExecutor')
  return {
    ...actual,
    callSearchProxy: (...args: Parameters<typeof actual.callSearchProxy>) =>
      mockCallSearchProxy(...args),
  }
})

const baseEntry: PipelineEntry = {
  id: 'pipe-1',
  company: 'Acme Corp',
  role: 'Staff Platform Engineer',
  tier: '1',
  status: 'researching',
  comp: '$250k-$320k',
  url: 'https://example.com/jobs/acme',
  contact: '',
  vectorId: 'backend',
  jobDescription: '',
  presetId: null,
  resumeVariant: '',
  resumeGeneration: null,
  positioning: 'Platform leadership',
  skillMatch: 'Distributed systems and reliability',
  nextStep: 'Review opportunity and tailor resume',
  notes: 'High-fit platform role',
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
  lastAction: '2026-04-14',
  createdAt: '2026-04-14',
  history: [],
  research: {
    status: 'seeded',
    summary: 'Strong platform fit',
    jobDescriptionSummary: '',
    interviewSignals: [],
    people: [],
    sources: [{ label: 'Acme Corp job posting', url: 'https://example.com/jobs/acme', kind: 'job-posting' }],
    searchQueries: ['Acme staff platform engineer'],
    lastInvestigatedAt: '',
  },
}

describe('investigatePipelineEntry', () => {
  beforeEach(() => {
    mockCallSearchProxy.mockReset()
  })

  it('merges AI investigation output with seeded research context', async () => {
    mockCallSearchProxy.mockResolvedValue({
      text: `\`\`\`json
{
  "summary": "Public evidence suggests a platform reliability role with strong cross-functional influence.",
  "jobDescription": "Lead platform reliability initiatives, improve developer experience, and partner with product teams.",
  "jobDescriptionSummary": "Reliability, developer experience, and cross-functional platform leadership.",
  "interviewSignals": ["Public candidate reports mention a recruiter screen and system design loop."],
  "formats": ["hr-screen", "system-design"],
  "people": [
    {
      "name": "Jordan Lee",
      "title": "Director of Platform",
      "company": "Acme Corp",
      "profileUrl": "https://www.linkedin.com/in/jordan-lee",
      "relevance": "Likely org leader for this team."
    }
  ],
  "sources": [
    {
      "label": "Acme careers",
      "url": "https://example.com/jobs/acme",
      "kind": "job-posting"
    },
    {
      "label": "Glassdoor interview reports",
      "url": "https://glassdoor.example/acme-interviews",
      "kind": "review"
    }
  ],
  "nextStep": "Prepare a system design story that highlights platform reliability wins."
}
\`\`\``,
      searchLog: ['Acme platform interview process', 'Acme director of platform linkedin'],
      tokenUsage: undefined,
    })

    const result = await investigatePipelineEntry(baseEntry, 'https://ai.example/proxy')

    expect(result.jobDescription).toContain('Lead platform reliability initiatives')
    expect(result.format).toEqual(['hr-screen', 'system-design'])
    expect(result.nextStep).toContain('system design story')
    expect(result.research.status).toBe('investigated')
    expect(result.research.summary).toContain('platform reliability role')
    // People discovery is intentionally stripped from the investigator — even
    // when the AI returns named people, we discard them. Users supply interviewer
    // names directly when scheduling is known. See doc-30 §Interviewer Capture.
    expect(result.research.people).toEqual([])
    expect(result.research.sources).toEqual([
      { label: 'Acme Corp job posting', url: 'https://example.com/jobs/acme', kind: 'job-posting' },
      { label: 'Acme careers', url: 'https://example.com/jobs/acme', kind: 'job-posting' },
      { label: 'Glassdoor interview reports', url: 'https://glassdoor.example/acme-interviews', kind: 'review' },
    ])
    expect(result.research.searchQueries).toEqual([
      'Acme staff platform engineer',
      'Acme platform interview process',
      'Acme director of platform linkedin',
    ])
    expect(result.research.lastInvestigatedAt).toMatch(/T/)
  })

  it('preserves existing entry fields when AI leaves them blank', async () => {
    mockCallSearchProxy.mockResolvedValue({
      text: '{"summary":"Still promising","jobDescription":"","jobDescriptionSummary":"","interviewSignals":[],"formats":[],"people":[],"sources":[],"nextStep":""}',
      searchLog: ['Acme platform role public interview loop'],
      tokenUsage: undefined,
    })

    const result = await investigatePipelineEntry(
      {
        ...baseEntry,
        jobDescription: 'Existing JD text',
        format: ['behavioral'],
        nextStep: 'Existing next step',
      },
      'https://ai.example/proxy',
    )

    expect(result.jobDescription).toBe('Existing JD text')
    expect(result.format).toEqual(['behavioral'])
    expect(result.nextStep).toBe('Existing next step')
    expect(result.research.summary).toBe('Still promising')
  })

  it('sanitizes URLs and dedupes repeated string fields on refresh', async () => {
    mockCallSearchProxy.mockResolvedValue({
      text: JSON.stringify({
        summary: 'Still promising',
        interviewSignals: [
          'Public candidate reports mention a recruiter screen and system design loop.',
          'public candidate reports mention a recruiter screen and system design loop.',
        ],
        people: [
          {
            name: 'Jordan Lee',
            title: 'Director of Platform',
            company: 'Acme Corp',
            profileUrl: 'javascript:alert(1)',
            relevance: 'Likely org leader for this team.',
          },
        ],
        sources: [
          {
            label: 'Unsafe source',
            url: 'javascript:alert(1)',
            kind: 'other',
          },
        ],
      }),
      searchLog: ['Acme staff platform engineer', 'acme staff platform engineer'],
      tokenUsage: undefined,
    })

    const result = await investigatePipelineEntry(
      {
        ...baseEntry,
        research: {
          ...baseEntry.research!,
          status: 'investigated',
          interviewSignals: ['Public candidate reports mention a recruiter screen and system design loop.'],
        },
      },
      'https://ai.example/proxy',
    )

    expect(result.research.interviewSignals).toEqual([
      'Public candidate reports mention a recruiter screen and system design loop.',
    ])
    expect(result.research.searchQueries).toEqual(['Acme staff platform engineer'])
    // AI-provided people are discarded — we do not auto-discover interviewers.
    expect(result.research.people).toEqual([])
    expect(result.research.sources).toContainEqual({
      label: 'Unsafe source',
      kind: 'other',
    })
  })
})
