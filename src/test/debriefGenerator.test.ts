import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cloneIdentityFixture } from './fixtures/identityFixture'
import { buildAudienceJdAnalysisFixture } from './fixtures/jdAnalysisAudienceFixture'
import { generateDebriefReport } from '../utils/debriefGenerator'

describe('debriefGenerator', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                summary: 'The migration story landed well.',
                overallTakeaway: 'Lead with platform migrations.',
                questionsAsked: [
                  {
                    question: 'How did you handle rollout risk?',
                    takeaway: 'Bring a tighter risk story.',
                  },
                ],
                whatWorked: ['Migration narrative'],
                whatDidnt: ['Metrics were light'],
                anchorStories: [
                  {
                    id: 'platform-migration',
                    label: 'Platform migration story',
                    reason: 'High interviewer engagement.',
                    roleId: 'contoso',
                    bulletId: 'platform-migration',
                  },
                ],
                recurringGaps: [
                  {
                    id: 'missing-metrics',
                    label: 'Missing metrics',
                    reason: 'Need harder numbers.',
                  },
                ],
                bestFitCompanyTypes: [
                  {
                    id: 'platform-heavy',
                    label: 'Platform-heavy companies',
                    reason: 'Platform depth resonated.',
                  },
                ],
                identityPatch: {
                  summary: 'Confirm rollout metrics and mark this as interview-tested.',
                  correctionNotes: ['Confirm rollout size.'],
                  followUpQuestions: ['How many customers were in the first wave?'],
                  updatedInterviewStyle: {
                    strengths: ['migration storytelling'],
                  },
                  bulletUpdates: [
                    {
                      roleId: 'contoso',
                      bulletId: 'platform-migration',
                      addTags: ['interview-tested'],
                      impactAdditions: ['Validated in hiring-manager interview'],
                    },
                  ],
                  newBullets: [],
                  rewrites: [],
                },
                warnings: ['Metrics still need confirmation.'],
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

  const readUserPrompt = (): string => {
    const [, init] = vi.mocked(fetch).mock.calls[0] ?? []
    const body = JSON.parse((init as RequestInit).body as string) as {
      messages: Array<{ content: string }>
    }
    return body.messages[0]?.content ?? ''
  }

  it('normalizes a generated debrief response and tags the paid feature id', async () => {
    const result = await generateDebriefReport('https://ai.example/proxy', {
      company: 'Acme',
      role: 'Staff Engineer',
      sourceKind: 'match',
      jobDescription: 'Build platform systems.',
      jdAnalysis: buildAudienceJdAnalysisFixture(),
      matchSummary: 'Strong platform fit.',
      positioningNotes: 'Recruiter-only positioning note.',
      roundName: 'Hiring Manager',
      interviewDate: '2026-04-03',
      outcome: 'advance',
      rawNotes: 'We talked through the migration and rollout.',
      questionsAsked: ['How did you handle rollout risk?'],
      whatWorked: ['Migration narrative'],
      whatDidnt: ['Metrics were light'],
      storiesTold: [
        {
          id: 'story-1',
          roleId: 'contoso',
          bulletId: 'platform-migration',
          notes: 'Migration story',
          outcome: 'strong',
        },
      ],
      currentIdentity: cloneIdentityFixture(),
    })

    expect(result.summary).toBe('The migration story landed well.')
    expect(result.identityPatch.bulletUpdates[0]?.addTags).toEqual(['interview-tested'])
    expect(result.warnings).toEqual(['Metrics still need confirmation.'])

    const [, init] = vi.mocked(fetch).mock.calls[0] ?? []
    const body = JSON.parse((init as RequestInit).body as string) as {
      feature: string
      messages: Array<{ content: string }>
    }
    expect(body).toEqual(
      expect.objectContaining({
        feature: 'debrief.generate',
      }),
    )

    const userPrompt = readUserPrompt()
    expect(userPrompt).toContain('Canonical JD Analysis:')
    expect(userPrompt).toContain('"audience": "candidate"')
    expect(userPrompt).toContain('Operate Kubernetes-backed platforms')
    expect(userPrompt).toContain('Lead with platform migration and reliability outcomes.')
    expect(userPrompt).not.toContain('Recruiter advocacy summary')
    expect(userPrompt).not.toContain('Recruiter-only positioning note')
    expect(userPrompt).not.toContain('Internal calibration note only.')
  })

  it('falls back to request match context when no JD analysis is available', async () => {
    await generateDebriefReport('https://ai.example/proxy', {
      company: 'Acme',
      role: 'Staff Engineer',
      sourceKind: 'match',
      jobDescription: 'Build platform systems.',
      matchSummary: 'Fallback match summary.',
      positioningNotes: 'Fallback positioning note.',
      roundName: 'Hiring Manager',
      interviewDate: '2026-04-03',
      outcome: 'advance',
      rawNotes: 'Notes',
      questionsAsked: [],
      whatWorked: [],
      whatDidnt: [],
      storiesTold: [],
      currentIdentity: cloneIdentityFixture(),
    })

    const userPrompt = readUserPrompt()
    expect(userPrompt).toContain('Match Summary: Fallback match summary.')
    expect(userPrompt).toContain('Positioning Notes:\nFallback positioning note.')
    expect(userPrompt).toContain('Canonical JD Analysis:\nNot provided.')
  })

  it('keeps request positioning notes when projected JD analysis has none', async () => {
    await generateDebriefReport('https://ai.example/proxy', {
      company: 'Acme',
      role: 'Staff Engineer',
      sourceKind: 'match',
      jobDescription: 'Build platform systems.',
      jdAnalysis: {
        ...buildAudienceJdAnalysisFixture(),
        positioningRecommendations: [],
      },
      matchSummary: 'Fallback match summary.',
      positioningNotes: 'Manual fallback positioning note.',
      roundName: 'Hiring Manager',
      interviewDate: '2026-04-03',
      outcome: 'advance',
      rawNotes: 'Notes',
      questionsAsked: [],
      whatWorked: [],
      whatDidnt: [],
      storiesTold: [],
      currentIdentity: cloneIdentityFixture(),
    })

    const userPrompt = readUserPrompt()
    expect(userPrompt).toContain('Match Summary: Distributed systems and platform tooling.')
    expect(userPrompt).toContain('Positioning Notes:\nManual fallback positioning note.')
  })

  it('rejects invalid schemas', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                summary: 'Broken',
                whatWorked: [],
              }),
            },
          },
        ],
      }),
    }) as typeof fetch

    await expect(
      generateDebriefReport('https://ai.example/proxy', {
        company: 'Acme',
        role: 'Staff Engineer',
        sourceKind: 'match',
        roundName: 'Hiring Manager',
        interviewDate: '2026-04-03',
        outcome: 'advance',
        rawNotes: 'Notes',
        questionsAsked: [],
        whatWorked: [],
        whatDidnt: [],
        storiesTold: [],
        currentIdentity: cloneIdentityFixture(),
      }),
    ).rejects.toThrow('Debrief response schema was invalid.')
  })
})
