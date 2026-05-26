// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { DebriefPage } from '../routes/debrief/DebriefPage'
import { useDebriefStore } from '../store/debriefStore'
import { useIdentityStore } from '../store/identityStore'
import { useJDAnalysisStore } from '../store/jdAnalysisStore'
import { useMatchStore } from '../store/matchStore'
import { usePipelineStore } from '../store/pipelineStore'
import { resolveStorage } from '../store/storage'
import { cloneIdentityFixture } from './fixtures/identityFixture'
import {
  buildAudienceJdAnalysisFixture,
  candidateAudience,
} from './fixtures/jdAnalysisAudienceFixture'
import type { MatchReport } from '../types/match'
import type { PipelineEntry } from '../types/pipeline'
import { untagged, untaggedNote } from '../types/audience'

const navigateMock = vi.fn(async () => undefined)

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}))

const matchReport: MatchReport = {
  generatedAt: '2026-04-03T00:00:00.000Z',
  identityVersion: 3,
  company: 'Acme',
  role: 'Staff Engineer',
  summary: 'Strong platform fit.',
  jobDescription: 'Build platform systems.',
  matchScore: 0.84,
  requirements: [],
  topBullets: [
    untagged({
      kind: 'bullet',
      id: 'platform-migration',
      label: 'Platform migration story',
      sourceLabel: 'Contoso Networks',
      text: 'Ported the platform to Kubernetes-based installs.',
      tags: ['platform'],
      matchedTags: ['platform'],
      matchedKeywords: ['platform'],
      matchedRequirementIds: ['req-1'],
      score: 0.92,
    }),
  ],
  topSkills: [],
  topProjects: [],
  topProfiles: [],
  topPhilosophy: [],
  gaps: [],
  advantages: [],
  positioningRecommendations: [untaggedNote('Lead with platform migration.')],
  gapFocus: [],
  warnings: [],
}

const buildPipelineEntry = (patch: Partial<PipelineEntry> = {}): PipelineEntry => ({
  id: 'pipe-debrief',
  company: 'Beta',
  role: 'Principal Engineer',
  tier: '1',
  status: 'interviewing',
  comp: '',
  url: '',
  contact: '',
  vectorId: null,
  jobDescription: 'Build high-scale platform systems.',
  jobDescriptionSourceUrl: null,
  jdAnalysisId: null,
  presetId: null,
  resumeVariant: '',
  resumeGeneration: null,
  positioning: 'Pipeline fallback positioning.',
  skillMatch: '',
  nextStep: '',
  notes: 'Pipeline notes.',
  appMethod: 'unknown',
  response: 'interview-scheduled',
  daysToResponse: null,
  rounds: null,
  format: ['hm-screen'],
  rejectionStage: '',
  rejectionReason: '',
  offerAmount: '',
  dateApplied: '',
  dateClosed: '',
  lastAction: '2026-04-03',
  createdAt: '2026-04-01',
  history: [],
  ...patch,
})

const readUserPrompt = (): string => {
  const [, init] = vi.mocked(fetch).mock.calls[0] ?? []
  const body = JSON.parse((init as RequestInit).body as string) as {
    messages: Array<{ content: string }>
  }
  return body.messages[0]?.content ?? ''
}

describe('DebriefPage', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_ANTHROPIC_PROXY_URL', 'https://ai.example/proxy')
    resolveStorage().removeItem('facet-debrief-workspace')
    resolveStorage().removeItem('facet-identity-workspace')

    const jdAnalysis = buildAudienceJdAnalysisFixture()
    useDebriefStore.setState({ sessions: [], selectedSessionId: null })
    useJDAnalysisStore.setState({ analyses: [jdAnalysis] })
    useIdentityStore.setState({
      sourceMaterial: '',
      correctionNotes: '',
      currentIdentity: cloneIdentityFixture(),
      draft: null,
      draftDocument: JSON.stringify(cloneIdentityFixture(), null, 2),
      warnings: [],
      changelog: [],
      lastError: null,
    })
    useMatchStore.setState({
      jobDescription: matchReport.jobDescription,
      currentJDAnalysis: jdAnalysis,
      currentReport: matchReport,
      warnings: [],
      history: [],
    })
    usePipelineStore.setState({
      entries: [],
      sortField: 'tier',
      sortDir: 'asc',
      filters: { tier: 'all', status: 'all', search: '' },
    })

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
                warnings: [],
              }),
            },
          },
        ],
      }),
    }) as typeof fetch
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('generates a debrief session and stages the identity draft for review', async () => {
    render(<DebriefPage />)

    fireEvent.change(screen.getByPlaceholderText(/paste interview notes/i), {
      target: { value: 'We talked through the platform migration and rollout.' },
    })
    fireEvent.change(screen.getByLabelText('Questions asked'), {
      target: { value: 'How did you handle rollout risk?' },
    })

    fireEvent.click(screen.getByText('Generate Debrief'))

    await waitFor(() => {
      expect(useDebriefStore.getState().sessions).toHaveLength(1)
    })

    expect(screen.getByText('Active Debrief')).toBeTruthy()
    expect(screen.getByText(/Platform migration story/)).toBeTruthy()

    fireEvent.click(screen.getByText('Send to Identity'))

    await waitFor(() => {
      expect(useIdentityStore.getState().draft?.summary).toBe(
        'Confirm rollout metrics and mark this as interview-tested.',
      )
    })

    expect(useIdentityStore.getState().correctionNotes).toContain('Debrief: Acme')
    expect(useIdentityStore.getState().correctionNotes).toContain('Confirm rollout size.')
    expect(navigateMock).toHaveBeenCalledWith({ to: '/identity' })

    const userPrompt = readUserPrompt()
    expect(userPrompt).toContain('"audience": "candidate"')
    expect(userPrompt).toContain('Operate Kubernetes-backed platforms')
    expect(userPrompt).not.toContain('Recruiter advocacy summary')
    expect(userPrompt).not.toContain('Recruiter-only positioning note')
  })

  it('passes the newest pipeline JD analysis to debrief generation', async () => {
    const baseAnalysis = buildAudienceJdAnalysisFixture()
    const olderAnalysis = {
      ...baseAnalysis,
      id: 'jd-analysis-older',
      pipelineEntryId: 'pipe-debrief',
      generatedAt: '2026-04-01T12:00:00.000Z',
      summary: 'Older pipeline summary.',
      positioningRecommendations: [
        {
          text: 'Older pipeline positioning.',
          audiences: candidateAudience(),
        },
      ],
    }
    const newestAnalysis = {
      ...baseAnalysis,
      id: 'jd-analysis-newest',
      pipelineEntryId: 'pipe-debrief',
      generatedAt: '2026-04-03T12:00:00.000Z',
      summary: 'Newest pipeline summary.',
      positioningRecommendations: [
        {
          text: 'Newest pipeline candidate positioning.',
          audiences: candidateAudience(),
        },
      ],
    }

    useMatchStore.setState({
      jobDescription: '',
      currentJDAnalysis: null,
      currentReport: null,
      warnings: [],
      history: [],
    })
    usePipelineStore.setState({
      entries: [buildPipelineEntry()],
      sortField: 'tier',
      sortDir: 'asc',
      filters: { tier: 'all', status: 'all', search: '' },
    })
    useJDAnalysisStore.setState({ analyses: [olderAnalysis, newestAnalysis] })

    render(<DebriefPage />)

    fireEvent.change(screen.getByPlaceholderText(/paste interview notes/i), {
      target: { value: 'Pipeline interview notes.' },
    })
    fireEvent.click(screen.getByText('Generate Debrief'))

    await waitFor(() => {
      expect(useDebriefStore.getState().sessions).toHaveLength(1)
    })

    const userPrompt = readUserPrompt()
    expect(userPrompt).toContain('Match Summary: Newest pipeline summary.')
    expect(userPrompt).toContain('Newest pipeline candidate positioning.')
    expect(userPrompt).not.toContain('Older pipeline summary.')
    expect(userPrompt).not.toContain('Older pipeline positioning.')
  })

  it('uses the pipeline entry jdAnalysisId before the newest analysis fallback', async () => {
    const baseAnalysis = buildAudienceJdAnalysisFixture()
    const linkedAnalysis = {
      ...baseAnalysis,
      id: 'jd-analysis-linked',
      pipelineEntryId: 'pipe-debrief',
      generatedAt: '2026-04-01T12:00:00.000Z',
      summary: 'Explicitly linked pipeline summary.',
      positioningRecommendations: [
        {
          text: 'Explicitly linked candidate positioning.',
          audiences: candidateAudience(),
        },
      ],
    }
    const newerAnalysis = {
      ...baseAnalysis,
      id: 'jd-analysis-newest',
      pipelineEntryId: 'pipe-debrief',
      generatedAt: '2026-04-03T12:00:00.000Z',
      summary: 'Newest unlinked pipeline summary.',
      positioningRecommendations: [
        {
          text: 'Newest unlinked positioning.',
          audiences: candidateAudience(),
        },
      ],
    }

    useMatchStore.setState({
      jobDescription: '',
      currentJDAnalysis: null,
      currentReport: null,
      warnings: [],
      history: [],
    })
    usePipelineStore.setState({
      entries: [buildPipelineEntry({ jdAnalysisId: 'jd-analysis-linked' })],
      sortField: 'tier',
      sortDir: 'asc',
      filters: { tier: 'all', status: 'all', search: '' },
    })
    useJDAnalysisStore.setState({ analyses: [linkedAnalysis, newerAnalysis] })

    render(<DebriefPage />)

    fireEvent.change(screen.getByPlaceholderText(/paste interview notes/i), {
      target: { value: 'Pipeline interview notes.' },
    })
    fireEvent.click(screen.getByText('Generate Debrief'))

    await waitFor(() => {
      expect(useDebriefStore.getState().sessions).toHaveLength(1)
    })

    const userPrompt = readUserPrompt()
    expect(userPrompt).toContain('Match Summary: Explicitly linked pipeline summary.')
    expect(userPrompt).toContain('Explicitly linked candidate positioning.')
    expect(userPrompt).not.toContain('Newest unlinked pipeline summary.')
    expect(userPrompt).not.toContain('Newest unlinked positioning.')
  })

  it('serializes match positioning notes when no JD analysis is available', async () => {
    useMatchStore.setState({
      jobDescription: matchReport.jobDescription,
      currentJDAnalysis: null,
      currentReport: matchReport,
      warnings: [],
      history: [],
    })
    useJDAnalysisStore.setState({ analyses: [] })

    render(<DebriefPage />)

    fireEvent.change(screen.getByPlaceholderText(/paste interview notes/i), {
      target: { value: 'Match interview notes.' },
    })
    fireEvent.click(screen.getByText('Generate Debrief'))

    await waitFor(() => {
      expect(useDebriefStore.getState().sessions).toHaveLength(1)
    })

    const userPrompt = readUserPrompt()
    expect(userPrompt).toContain('Positioning Notes:\nLead with platform migration.')
    expect(userPrompt).toContain('Canonical JD Analysis:\nNot provided.')
    expect(userPrompt).not.toContain('[object Object]')
  })
})
