import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { generateCoverLetter } from '../utils/coverLetterGenerator'
import { defaultResumeData } from '../store/defaultData'

describe('coverLetterGenerator', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                name: 'Acme Staff Engineer Cover Letter',
                greeting: 'Dear Hiring Manager,',
                signOff: 'Sincerely,\nJane Smith',
                paragraphs: [
                  {
                    label: 'Opening',
                    text: 'I am excited to apply for the Staff Engineer role at Acme Corp.',
                  },
                  {
                    text: 'My background in backend systems and platform engineering matches the role focus.',
                  },
                ],
              }),
            },
          },
        ],
      }),
    }) as typeof fetch
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('normalizes a generated cover letter response', async () => {
    const result = await generateCoverLetter('https://ai.example/proxy', {
      company: 'Acme Corp',
      role: 'Staff Engineer',
      vectorId: 'backend',
      vectorLabel: 'Backend Engineering',
      companyUrl: 'https://acme.example/jobs/1',
      skillMatch: 'distributed systems, platform',
      positioning: 'Emphasize backend platform depth.',
      notes: 'Hiring manager cares about operational excellence.',
      companyResearch: 'Acme is investing in platform reliability.',
      jobDescription: 'Build distributed systems and platform tooling.',
      resumeContext: {
        candidate: defaultResumeData.meta,
        vector: defaultResumeData.vectors[0],
        assembled: {
          profiles: defaultResumeData.profiles,
        },
      },
    })

    expect(result).toEqual({
      name: 'Acme Staff Engineer Cover Letter',
      header: [
        'Jane Smith',
        'San Francisco, CA (Remote) | jane@example.com | 555-123-4567',
        'github: github.com/janesmith | linkedin: linkedin.com/in/janesmith',
      ].join('\n'),
      greeting: 'Dear Hiring Manager,',
      signOff: 'Sincerely,\nJane Smith',
      paragraphs: [
        {
          label: 'Opening',
          text: 'I am excited to apply for the Staff Engineer role at Acme Corp.',
        },
        {
          label: undefined,
          text: 'My background in backend systems and platform engineering matches the role focus.',
        },
      ],
    })
  })

  it('rejects invalid schemas', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                greeting: 'Dear Hiring Manager,',
                signOff: 'Thanks',
                paragraphs: [],
              }),
            },
          },
        ],
      }),
    }) as typeof fetch

    await expect(
      generateCoverLetter('https://ai.example/proxy', {
        company: 'Acme Corp',
        role: 'Staff Engineer',
        vectorId: 'backend',
        vectorLabel: 'Backend Engineering',
        jobDescription: 'Build distributed systems and platform tooling.',
        resumeContext: {
          candidate: defaultResumeData.meta,
          vector: defaultResumeData.vectors[0],
          assembled: {},
        },
      }),
    ).rejects.toThrow('Cover letter response schema was invalid.')
  })

  it('tags cover-letter generation requests with the paid AI feature id', async () => {
    await generateCoverLetter('https://ai.example/proxy', {
      company: 'Acme Corp',
      role: 'Staff Engineer',
      vectorId: 'backend',
      vectorLabel: 'Backend Engineering',
      jobDescription: 'Build distributed systems and platform tooling.',
      resumeContext: {
        candidate: defaultResumeData.meta,
        vector: defaultResumeData.vectors[0],
        assembled: {},
      },
    })

    const [, init] = vi.mocked(fetch).mock.calls[0] ?? []
    expect(JSON.parse((init as RequestInit).body as string)).toEqual(
      expect.objectContaining({
        feature: 'letters.generate',
      }),
    )
  })
})
