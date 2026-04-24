// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { RecruiterPage } from '../routes/recruiter/RecruiterPage'
import { cloneIdentityFixture } from './fixtures/identityFixture'
import { useIdentityStore } from '../store/identityStore'
import { useMatchStore } from '../store/matchStore'
import { useRecruiterStore } from '../store/recruiterStore'
import type { MatchReport } from '../types/match'

const matchReportFixture: MatchReport = {
  generatedAt: '2026-04-03T12:00:00.000Z',
  identityVersion: 3,
  company: 'Atlas',
  role: 'Staff Platform Engineer',
  summary: 'Strong platform fit with credible migration and reliability evidence.',
  jobDescription: 'Lead platform modernization and improve developer velocity.',
  matchScore: 0.84,
  requirements: [],
  topBullets: [
    {
      kind: 'bullet',
      id: 'platform-migration',
      label: 'Platform migration',
      sourceLabel: 'Contoso Networks',
      text: 'Ported the platform to Kubernetes-based installs.',
      tags: ['platform', 'kubernetes'],
      matchedTags: ['platform'],
      matchedKeywords: ['platform'],
      matchedRequirementIds: ['req-platform'],
      score: 0.96,
    },
  ],
  topSkills: [
    {
      kind: 'skill',
      id: 'skill-kubernetes',
      label: 'Kubernetes',
      sourceLabel: 'Platform',
      text: 'Kubernetes',
      tags: ['platform', 'kubernetes'],
      matchedTags: ['platform'],
      matchedKeywords: ['kubernetes'],
      matchedRequirementIds: ['req-platform'],
      score: 0.88,
    },
  ],
  topProjects: [],
  topProfiles: [],
  topPhilosophy: [],
  gaps: [],
  advantages: [
    {
      id: 'adv-platform',
      claim: 'Brings credible platform modernization evidence.',
      requirementIds: ['req-platform'],
      evidence: [],
    },
  ],
  positioningRecommendations: ['Lead with platform modernization and customer-environment delivery.'],
  gapFocus: [],
  warnings: [],
}

describe('RecruiterPage', () => {
  beforeEach(() => {
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
      jobDescription: matchReportFixture.jobDescription,
      currentReport: matchReportFixture,
      warnings: [],
      history: [],
    })
    useRecruiterStore.setState({
      cards: [],
      selectedCardId: null,
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('generates a recruiter card from the active match report and lets the user edit it', async () => {
    render(<RecruiterPage />)

    fireEvent.click(screen.getByText('Generate from Match'))

    await waitFor(() => {
      expect(useRecruiterStore.getState().cards).toHaveLength(1)
    })

    expect(screen.getByLabelText('Company')).toHaveProperty('value', 'Atlas')
    expect(screen.getByLabelText('Role')).toHaveProperty('value', 'Staff Platform Engineer')
    expect(screen.getByLabelText('Candidate name')).toHaveProperty('value', 'Alex Example')

    fireEvent.change(screen.getByLabelText('Summary'), {
      target: { value: 'Edited recruiter-facing summary.' },
    })

    expect(useRecruiterStore.getState().cards[0]?.summary).toBe('Edited recruiter-facing summary.')
  })

  it('shows a gating message when a match report is not available', () => {
    useMatchStore.setState({
      jobDescription: '',
      currentReport: null,
      warnings: [],
      history: [],
    })

    render(<RecruiterPage />)

    expect(
      screen.getByText('Generate a Phase 1 match report before creating a recruiter card.'),
    ).toBeTruthy()
    expect(screen.getByText('Generate from Match')).toHaveProperty('disabled', true)
  })
})
