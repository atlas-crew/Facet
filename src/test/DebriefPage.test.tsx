// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { DebriefPage } from '../routes/debrief/DebriefPage'
import { useDebriefStore } from '../store/debriefStore'
import { useIdentityStore } from '../store/identityStore'
import { useMatchStore } from '../store/matchStore'
import { usePipelineStore } from '../store/pipelineStore'
import { resolveStorage } from '../store/storage'
import { cloneIdentityFixture } from './fixtures/identityFixture'
import type { MatchReport } from '../types/match'

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
    {
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
    },
  ],
  topSkills: [],
  topProjects: [],
  topProfiles: [],
  topPhilosophy: [],
  gaps: [],
  advantages: [],
  positioningRecommendations: ['Lead with platform migration.'],
  gapFocus: [],
  warnings: [],
}

describe('DebriefPage', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_ANTHROPIC_PROXY_URL', 'https://ai.example/proxy')
    resolveStorage().removeItem('facet-debrief-workspace')
    resolveStorage().removeItem('facet-identity-workspace')

    useDebriefStore.setState({ sessions: [], selectedSessionId: null })
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

    fireEvent.change(
      screen.getByPlaceholderText(/paste interview notes/i),
      {
        target: { value: 'We talked through the platform migration and rollout.' },
      },
    )
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
  })
})
