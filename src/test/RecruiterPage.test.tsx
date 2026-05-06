// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { RecruiterPage } from '../routes/recruiter/RecruiterPage'
import { cloneIdentityFixture } from './fixtures/identityFixture'
import { useIdentityStore } from '../store/identityStore'
import { useMatchStore } from '../store/matchStore'
import { useRecruiterStore } from '../store/recruiterStore'
import type { MatchReport } from '../types/match'
import type { JDAnalysis } from '../types/jdAnalysis'
import { untagged, untaggedNote } from '../types/audience'
import { applyRulesBasedAudiences, type JDAnalysisLike } from '../utils/audienceRules'

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
    untagged({
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
    }),
  ],
  topSkills: [
    untagged({
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
    }),
  ],
  topProjects: [],
  topProfiles: [],
  topPhilosophy: [],
  gaps: [],
  advantages: [
    untagged({
      id: 'adv-platform',
      claim: 'Brings credible platform modernization evidence.',
      requirementIds: ['req-platform'],
      evidence: [],
    }),
  ],
  positioningRecommendations: [untaggedNote('Lead with platform modernization and customer-environment delivery.')],
  gapFocus: [],
  warnings: [],
}

const buildJdAnalysisFixture = (): JDAnalysis => {
  const draft: JDAnalysisLike = {
    id: 'analysis-1',
    pipelineEntryId: 'pipe-1',
    jdTextHash: 'abc123',
    identityVersion: 3,
    modelVersion: 'jd-analysis.v1.test',
    generatedAt: '2026-04-03T12:00:00.000Z',
    updatedAt: '2026-04-03T12:00:00.000Z',
    warnings: [],
    company: 'Atlas',
    role: 'Staff Platform Engineer',
    summary: 'Strong platform fit with credible migration and reliability evidence.',
    analyzedJobDescription: matchReportFixture.jobDescription,
    jobDescriptionWordCount: 6,
    jobDescriptionTruncated: false,
    requirements: [],
    overallFit: 'strong',
    fitScore: 0.84,
    confidence: 'high',
    recommendation: 'apply',
    oneLineSummary: 'Strong platform match.',
    rationale: 'Candidate evidence supports backend platform ownership.',
    matchedVectors: [],
    primaryVectorId: null,
    skillMatches: [
      untagged({
        skillName: 'Kubernetes',
        jdRequirement: 'Own Kubernetes-backed platform delivery.',
        requirementStrength: 'required',
        userDepth: 'strong',
        userPositioning: 'Lead with Kubernetes platform migration stories.',
        matchQuality: 'strong',
        presentationGuidance: 'Lead with Kubernetes platform migration stories.',
      }),
    ],
    evidenceMapping: {
      topBullets: [],
      topSkills: [],
      topProjects: [],
      topProfiles: [],
      topPhilosophy: [],
    },
    strengthsToLead: [untaggedNote('Platform delivery track record.')],
    advantages: [
      untagged({
        id: 'adv-platform',
        claim: 'Brings credible platform modernization evidence.',
        requirementIds: ['req-platform'],
        evidence: [],
      }),
    ],
    advantageHypotheses: [],
    gaps: [],
    gapFocus: [],
    watchOuts: [],
    triggeredPrioritize: [],
    triggeredAvoid: [],
    relevantAwareness: [],
    positioningRecommendations: [],
    requirementCoverageScore: 0.84,
    matchedRequirementIds: [],
    matchedKeywords: ['platform'],
  }
  return applyRulesBasedAudiences(draft)
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
      currentJDAnalysis: buildJdAnalysisFixture(),
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

  it('generates a recruiter card from the active JD analysis and lets the user edit it', async () => {
    render(<RecruiterPage />)

    fireEvent.click(screen.getByText('Generate from JD Analysis'))

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

  it('shows a gating message when a JD analysis is not available', () => {
    useMatchStore.setState({
      jobDescription: '',
      currentJDAnalysis: null,
      currentReport: null,
      warnings: [],
      history: [],
    })

    render(<RecruiterPage />)

    expect(
      screen.getByText('Run JD analysis on a pipeline entry before creating a recruiter card.'),
    ).toBeTruthy()
    expect(screen.getByText('Generate from JD Analysis')).toHaveProperty('disabled', true)
  })
})
