// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MatchPage } from '../routes/match/MatchPage'
import { useIdentityStore } from '../store/identityStore'
import { useJDAnalysisStore } from '../store/jdAnalysisStore'
import { useMatchStore } from '../store/matchStore'
import { usePipelineStore } from '../store/pipelineStore'
import { useHandoffStore } from '../store/handoffStore'
import { normalizeResumeWorkspaceData, useResumeStore } from '../store/resumeStore'
import { resolveStorage } from '../store/storage'
import type { AudienceAssignment, AudienceTag } from '../types/audience'
import type { JDAnalysis } from '../types/jdAnalysis'
import type { MatchHistoryEntry, MatchReport, VectorAwareMatchResult } from '../types/match'
import { hashJobDescriptionText } from '../utils/jdAnalysis'
import { cloneIdentityFixture } from './fixtures/identityFixture'

const navigateMock = vi.fn(async () => undefined)

const assignment = (inferred: AudienceTag[] = ['candidate']): AudienceAssignment => ({
  inferred,
  asserted: null,
})

const tagged = <T,>(
  item: T,
  inferred: AudienceTag[] = ['candidate'],
): T & { audiences: AudienceAssignment } => ({
  ...item,
  audiences: assignment(inferred),
})

const taggedNote = (text: string, inferred: AudienceTag[] = ['candidate']) => ({
  text,
  audiences: assignment(inferred),
})

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}))

const reportFixture: MatchReport = {
  generatedAt: '2026-04-08T00:00:00.000Z',
  identityVersion: 3,
  company: 'Atlas',
  role: 'Staff Platform Engineer',
  summary: 'Strong platform fit with a modest AI caution.',
  jobDescription: 'Own platform delivery and Linux debugging.',
  matchScore: 0.82,
  requirements: [
    tagged({
      id: 'platform-delivery',
      label: 'Platform delivery',
      priority: 'core',
      evidence: 'Own platform delivery systems.',
      tags: ['platform'],
      keywords: ['platform'],
      coverageScore: 0.9,
      matchedAssetCount: 3,
      matchedTags: ['platform'],
    }),
  ],
  topBullets: [
    tagged({
      kind: 'bullet',
      id: 'platform-migration',
      label: 'Platform migration',
      sourceLabel: 'Contoso Networks - Senior Platform Engineer',
      text: 'Migrated the platform to Kubernetes-based on-prem installs.',
      tags: ['platform', 'kubernetes'],
      matchedTags: ['platform'],
      matchedKeywords: ['platform'],
      matchedRequirementIds: ['platform-delivery'],
      score: 0.92,
    }),
  ],
  topSkills: [],
  topProjects: [],
  topProfiles: [],
  topPhilosophy: [],
  gaps: [],
  advantages: [],
  positioningRecommendations: [taggedNote('Lead with platform migration stories.')],
  gapFocus: [taggedNote('Do not over-claim AI depth.')],
  warnings: [taggedNote('No search vectors defined.')],
}

const analysisFixture: VectorAwareMatchResult = {
  id: 'match-analysis-1',
  generatedAt: '2026-04-08T00:00:00.000Z',
  identityVersion: 3,
  company: 'Atlas',
  role: 'Staff Platform Engineer',
  jobDescription: reportFixture.jobDescription,
  overallFit: 'strong',
  fitScore: 0.82,
  confidence: 'high',
  oneLineSummary: 'Strong match - Platform lead',
  matchedVectors: [
    tagged({
      vectorId: 'platform-lead',
      title: 'Platform lead',
      priority: 'high',
      matchStrength: 'strong',
      evidence: ['Own platform delivery systems.'],
      thesisApplies: true,
      thesisFitExplanation: 'The JD centers platform ownership.',
    }),
  ],
  primaryVectorId: 'platform-lead',
  skillMatches: [
    tagged({
      skillName: 'Kubernetes',
      jdRequirement: 'Own Kubernetes-backed platform delivery.',
      requirementStrength: 'required',
      userDepth: 'strong',
      userPositioning: 'Lead with Kubernetes platform migration stories.',
      matchQuality: 'strong',
      presentationGuidance: 'Lead with Kubernetes platform migration stories.',
    }),
  ],
  strengthsToLead: [taggedNote('Kubernetes')],
  watchOuts: [
    tagged({
      type: 'awareness_item',
      referenceId: 'ai-depth',
      description: 'Some AI platform depth is requested.',
      severity: 'soft',
      suggestedAction: 'Do not over-claim AI depth.',
    }),
  ],
  triggeredPrioritize: [
    tagged({
      filterId: 'platform-ownership',
      label: 'Platform ownership',
      weight: 'high',
      jdEvidence: 'Own platform architecture and delivery systems.',
    }),
  ],
  triggeredAvoid: [],
  relevantAwareness: [
    tagged({
      awarenessId: 'ai-depth',
      topic: 'AI depth',
      severity: 'medium',
      appliesBecause: 'Some AI platform depth is requested.',
      action: 'Do not over-claim AI depth.',
    }),
  ],
  recommendation: 'apply',
  rationale: 'Strong platform fit with a modest AI caution.',
  warnings: [taggedNote('No search vectors defined.')],
}

const jdAnalysisFixture: JDAnalysis = {
  id: 'match-analysis-1',
  pipelineEntryId: 'match-workspace-transient',
  jdTextHash: hashJobDescriptionText(reportFixture.jobDescription),
  identityVersion: 3,
  modelVersion: 'jd-analysis.v1.match-multipass-sonnet',
  audienceRulesVersion: 'audience-rules.v1',
  generatedAt: '2026-04-08T00:00:00.000Z',
  updatedAt: '2026-04-08T00:00:00.000Z',
  warnings: [taggedNote('No search vectors defined.')],
  company: 'Atlas',
  role: 'Staff Platform Engineer',
  summary: reportFixture.summary,
  analyzedJobDescription: reportFixture.jobDescription,
  jobDescriptionWordCount: 6,
  jobDescriptionTruncated: false,
  requirements: reportFixture.requirements,
  overallFit: 'strong',
  fitScore: 0.82,
  confidence: 'high',
  recommendation: 'apply',
  oneLineSummary: 'Strong match - Platform lead',
  rationale: 'Strong platform fit with a modest AI caution.',
  matchedVectors: analysisFixture.matchedVectors,
  primaryVectorId: 'platform-lead',
  skillMatches: analysisFixture.skillMatches,
  evidenceMapping: {
    topBullets: reportFixture.topBullets,
    topSkills: [],
    topProjects: [],
    topProfiles: [],
    topPhilosophy: [],
  },
  strengthsToLead: [taggedNote('Kubernetes')],
  advantages: [],
  advantageHypotheses: [],
  gaps: [],
  gapFocus: [taggedNote('Do not over-claim AI depth.')],
  watchOuts: analysisFixture.watchOuts,
  triggeredPrioritize: analysisFixture.triggeredPrioritize,
  triggeredAvoid: [],
  relevantAwareness: analysisFixture.relevantAwareness,
  positioningRecommendations: reportFixture.positioningRecommendations,
  requirementCoverageScore: 0.9,
  matchedRequirementIds: ['platform-delivery'],
  matchedKeywords: ['platform'],
}

describe('MatchPage', () => {
  let exportedBlob: Blob | null

  beforeEach(() => {
    exportedBlob = null
    navigateMock.mockReset()
    resolveStorage().removeItem('facet-match-workspace')
    useIdentityStore.setState({ currentIdentity: cloneIdentityFixture() })
    useJDAnalysisStore.setState({ analyses: [] })
    usePipelineStore.setState({
      entries: [],
      sortField: 'tier',
      sortDir: 'asc',
      filters: { tier: 'all', status: 'all', search: '' },
    })
    useResumeStore.setState({
      ...normalizeResumeWorkspaceData(undefined),
      past: [],
      future: [],
      canUndo: false,
      canRedo: false,
    })
    useHandoffStore.setState({ pendingGeneration: null })
    useMatchStore.setState({
      jobDescription: reportFixture.jobDescription,
      currentJDAnalysis: jdAnalysisFixture,
      currentAnalysis: analysisFixture,
      currentReport: reportFixture,
      warnings: reportFixture.warnings,
      history: [],
    })
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn((blob: Blob) => {
        exportedBlob = blob
        return 'blob:match-export'
      }),
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  })

  afterEach(() => {
    window.location.hash = ''
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders the rich vector-aware analysis when currentAnalysis exists', () => {
    render(<MatchPage />)

    expect(screen.getByText('Vector-Aware Summary')).toBeTruthy()
    expect(screen.getAllByText('Platform lead').length).toBeGreaterThan(0)
    expect(screen.getByText('Kubernetes')).toBeTruthy()
    expect(screen.getByText('Filters and awareness')).toBeTruthy()
    expect(screen.getByText('Requirement Coverage')).toBeTruthy()
  })

  it('projects Match rendering to candidate-facing JD analysis fields', () => {
    useMatchStore.setState({
      currentJDAnalysis: {
        ...jdAnalysisFixture,
        warnings: [
          taggedNote('Candidate caution is visible.'),
          taggedNote('Internal parser warning is hidden.', ['internal']),
        ],
        matchedVectors: [
          tagged({
            ...analysisFixture.matchedVectors[0]!,
            vectorId: 'candidate-vector',
            title: 'Candidate vector',
          }),
          tagged(
            {
              ...analysisFixture.matchedVectors[0]!,
              vectorId: 'recruiter-vector',
              title: 'Recruiter vector',
            },
            ['recruiter'],
          ),
        ],
        skillMatches: [
          tagged({
            ...analysisFixture.skillMatches[0]!,
            skillName: 'Candidate skill',
          }),
          tagged(
            {
              ...analysisFixture.skillMatches[0]!,
              skillName: 'Hiring manager skill',
            },
            ['hiring_manager'],
          ),
        ],
        evidenceMapping: {
          ...jdAnalysisFixture.evidenceMapping,
          topBullets: [
            tagged({
              ...jdAnalysisFixture.evidenceMapping.topBullets[0]!,
              id: 'candidate-proof',
              label: 'Candidate proof',
            }),
            tagged(
              {
                ...jdAnalysisFixture.evidenceMapping.topBullets[0]!,
                id: 'recruiter-proof',
                label: 'Recruiter proof',
              },
              ['recruiter'],
            ),
          ],
        },
        advantages: [
          tagged({
            id: 'candidate-advantage',
            claim: 'Candidate advantage is visible.',
            requirementIds: ['candidate-requirement'],
            evidence: [],
          }),
          tagged(
            {
              id: 'recruiter-advantage',
              claim: 'Recruiter hook is hidden.',
              requirementIds: ['recruiter-requirement'],
              evidence: [],
            },
            ['recruiter'],
          ),
        ],
        gapFocus: [
          taggedNote('Candidate gap focus is visible.'),
          taggedNote('Hiring manager gap focus is hidden.', ['hiring_manager']),
        ],
        positioningRecommendations: [
          taggedNote('Candidate positioning is visible.'),
          taggedNote('Recruiter positioning hook is hidden.', ['recruiter']),
        ],
      },
      currentAnalysis: {
        ...analysisFixture,
        matchedVectors: [
          ...analysisFixture.matchedVectors,
          tagged(
            {
              ...analysisFixture.matchedVectors[0]!,
              vectorId: 'recruiter-vector',
              title: 'Recruiter vector',
            },
            ['recruiter'],
          ),
        ],
      },
      currentReport: {
        ...reportFixture,
        advantages: [
          tagged({
            id: 'candidate-advantage',
            claim: 'Candidate advantage is visible.',
            requirementIds: ['candidate-requirement'],
            evidence: [],
          }),
          tagged(
            {
              id: 'recruiter-advantage',
              claim: 'Recruiter hook is hidden.',
              requirementIds: ['recruiter-requirement'],
              evidence: [],
            },
            ['recruiter'],
          ),
        ],
        positioningRecommendations: [
          taggedNote('Candidate positioning is visible.'),
          taggedNote('Recruiter positioning hook is hidden.', ['recruiter']),
        ],
        gapFocus: [
          taggedNote('Candidate gap focus is visible.'),
          taggedNote('Hiring manager gap focus is hidden.', ['hiring_manager']),
        ],
        warnings: [
          taggedNote('Candidate caution is visible.'),
          taggedNote('Internal parser warning is hidden.', ['internal']),
        ],
      },
      warnings: [
        taggedNote('Candidate caution is visible.'),
        taggedNote('Internal parser warning is hidden.', ['internal']),
      ],
    })

    render(<MatchPage />)

    expect(screen.getAllByText('Candidate vector').length).toBeGreaterThan(0)
    expect(screen.getByText('Candidate skill')).toBeTruthy()
    expect(screen.getByText('Candidate proof')).toBeTruthy()
    expect(screen.getAllByText('Candidate advantage is visible.').length).toBeGreaterThan(0)
    expect(screen.getByText('Candidate positioning is visible.')).toBeTruthy()
    expect(screen.getByText('Candidate gap focus is visible.')).toBeTruthy()
    expect(screen.getByText('Candidate caution is visible.')).toBeTruthy()
    expect(screen.queryByText('Recruiter vector')).toBeNull()
    expect(screen.queryByText('Hiring manager skill')).toBeNull()
    expect(screen.queryByText('Recruiter proof')).toBeNull()
    expect(screen.queryByText('Recruiter hook is hidden.')).toBeNull()
    expect(screen.queryByText('Recruiter positioning hook is hidden.')).toBeNull()
    expect(screen.queryByText('Hiring manager gap focus is hidden.')).toBeNull()
    expect(screen.queryByText('Internal parser warning is hidden.')).toBeNull()
  })

  it('exports the candidate-projected match report', async () => {
    useMatchStore.setState({
      currentJDAnalysis: {
        ...jdAnalysisFixture,
        warnings: [
          taggedNote('Candidate export warning.'),
          taggedNote('Internal export warning.', ['internal']),
        ],
        matchedVectors: [
          tagged({
            ...analysisFixture.matchedVectors[0]!,
            vectorId: 'candidate-vector',
            title: 'Candidate export vector',
          }),
          tagged(
            {
              ...analysisFixture.matchedVectors[0]!,
              vectorId: 'recruiter-vector',
              title: 'Recruiter export vector',
            },
            ['recruiter'],
          ),
        ],
        skillMatches: [
          tagged({
            ...analysisFixture.skillMatches[0]!,
            skillName: 'Candidate export skill',
          }),
          tagged(
            {
              ...analysisFixture.skillMatches[0]!,
              skillName: 'Recruiter export skill',
            },
            ['recruiter'],
          ),
        ],
        positioningRecommendations: [
          taggedNote('Candidate export positioning.'),
          taggedNote('Recruiter export hook.', ['recruiter']),
        ],
      },
      currentAnalysis: {
        ...analysisFixture,
        matchedVectors: [
          ...analysisFixture.matchedVectors,
          tagged(
            {
              ...analysisFixture.matchedVectors[0]!,
              vectorId: 'recruiter-vector',
              title: 'Recruiter export vector',
            },
            ['recruiter'],
          ),
        ],
      },
      currentReport: {
        ...reportFixture,
        positioningRecommendations: [
          taggedNote('Candidate export positioning.'),
          taggedNote('Recruiter export hook.', ['recruiter']),
        ],
        warnings: [
          taggedNote('Candidate export warning.'),
          taggedNote('Internal export warning.', ['internal']),
        ],
      },
    })

    render(<MatchPage />)
    fireEvent.click(screen.getByRole('button', { name: /export report/i }))

    expect(exportedBlob).toBeTruthy()
    const exported = JSON.parse(await exportedBlob!.text())
    const serialized = JSON.stringify(exported)
    expect(serialized).toContain('Candidate export vector')
    expect(serialized).toContain('Candidate export skill')
    expect(serialized).toContain('Candidate export positioning.')
    expect(serialized).toContain('Candidate export warning.')
    expect(serialized).not.toContain('Recruiter export vector')
    expect(serialized).not.toContain('Recruiter export skill')
    expect(serialized).not.toContain('Recruiter export hook.')
    expect(serialized).not.toContain('Internal export warning.')
  })

  it('assembles Build handoff from the candidate-projected report', () => {
    const candidateSkill = tagged({
      kind: 'skill' as const,
      id: 'candidate-skill',
      label: 'Kubernetes',
      sourceLabel: 'Infrastructure',
      text: 'Kubernetes',
      tags: ['kubernetes'],
      matchedTags: ['kubernetes'],
      matchedKeywords: ['kubernetes'],
      matchedRequirementIds: ['platform-delivery'],
      score: 0.95,
    })
    const recruiterSkill = tagged(
      {
        kind: 'skill' as const,
        id: 'recruiter-skill',
        label: 'Terraform',
        sourceLabel: 'Infrastructure',
        text: 'Terraform',
        tags: ['terraform'],
        matchedTags: ['terraform'],
        matchedKeywords: ['terraform'],
        matchedRequirementIds: ['platform-delivery'],
        score: 0.9,
      },
      ['recruiter'],
    )

    useMatchStore.setState({
      currentJDAnalysis: {
        ...jdAnalysisFixture,
        role: '',
        evidenceMapping: {
          ...jdAnalysisFixture.evidenceMapping,
          topSkills: [candidateSkill, recruiterSkill],
        },
        positioningRecommendations: [
          taggedNote('Candidate Build target line.'),
          taggedNote('Recruiter Build hook.', ['recruiter']),
        ],
      },
      currentReport: {
        ...reportFixture,
        role: '',
        topSkills: [recruiterSkill, candidateSkill],
        positioningRecommendations: [
          taggedNote('Recruiter Build hook.', ['recruiter']),
          taggedNote('Candidate Build target line.'),
        ],
      },
    })

    render(<MatchPage />)
    fireEvent.click(screen.getByRole('button', { name: /assemble in build/i }))

    const handoff = useHandoffStore.getState().pendingGeneration
    const vectorId = handoff?.primaryVectorId
    expect(vectorId).toBeTruthy()
    expect(handoff?.jobDescription).toBe(reportFixture.jobDescription)

    const resumeData = useResumeStore.getState().data
    expect(
      resumeData.target_lines.find((line) => line.id === `match-target-${vectorId}`)?.text,
    ).toBe('Candidate Build target line.')
    const assembledSkillContent = resumeData.skill_groups.find(
      (group) => group.id === 'infrastructure',
    )?.vectors?.[vectorId!]?.content
    expect(assembledSkillContent).toBe('Kubernetes')
    expect(assembledSkillContent).not.toContain('Terraform')
    expect(JSON.stringify(resumeData)).not.toContain('Recruiter Build hook.')
  })

  it('shows report navigation only when a report exists', () => {
    const { rerender } = render(<MatchPage />)

    const nav = screen.getByRole('navigation', { name: /match report sections/i })
    expect(nav.querySelector('a[href="#match-report-summary"]')?.textContent).toBe('Summary')
    expect(nav.querySelector('a[href="#match-report-requirements"]')?.textContent).toBe(
      'Requirements',
    )
    expect(nav.querySelector('a[href="#match-report-history"]')).toBeNull()

    useMatchStore.setState({
      jobDescription: '',
      currentJDAnalysis: null,
      currentAnalysis: null,
      currentReport: null,
      warnings: [],
      history: [],
    })
    rerender(<MatchPage />)

    expect(screen.queryByRole('navigation', { name: /match report sections/i })).toBeNull()
  })

  it('updates the workflow rail as inputs become ready', () => {
    useIdentityStore.setState({ currentIdentity: null })
    useMatchStore.setState({
      jobDescription: '',
      currentJDAnalysis: null,
      currentAnalysis: null,
      currentReport: null,
      warnings: [],
      history: [],
    })

    const { container, rerender } = render(<MatchPage />)
    const emptySteps = Array.from(container.querySelectorAll<HTMLLIElement>('.match-flow-rail li'))

    expect(emptySteps).toHaveLength(4)
    expect(emptySteps.every((step) => !step.classList.contains('match-flow-step-ready'))).toBe(true)
    expect(screen.getByText('Load a model first')).toBeTruthy()
    expect(screen.getByText('Paste the full JD')).toBeTruthy()
    expect(screen.getByText('Run the matcher')).toBeTruthy()
    expect(screen.getByText('Unlocks after analysis')).toBeTruthy()

    useIdentityStore.setState({ currentIdentity: cloneIdentityFixture() })
    useMatchStore.setState({
      jobDescription: reportFixture.jobDescription,
      currentJDAnalysis: jdAnalysisFixture,
      currentAnalysis: analysisFixture,
      currentReport: reportFixture,
      warnings: reportFixture.warnings,
      history: [],
    })
    rerender(<MatchPage />)

    const readySteps = Array.from(container.querySelectorAll<HTMLLIElement>('.match-flow-rail li'))
    expect(readySteps.every((step) => step.classList.contains('match-flow-step-ready'))).toBe(true)
    expect(screen.getByText('Model loaded')).toBeTruthy()
    expect(screen.getByText('6 words ready')).toBeTruthy()
    expect(screen.getByText('Generated')).toBeTruthy()
    expect(screen.getByText('Build, save, or export')).toBeTruthy()
  })

  it('shows the history nav item and collapsed history disclosure when saved reports exist', () => {
    const historyEntry: MatchHistoryEntry = {
      id: 'history-1',
      createdAt: '2026-04-08T00:10:00.000Z',
      company: 'Atlas',
      role: 'Staff Platform Engineer',
      matchScore: 0.82,
      requirementCount: 1,
      gapCount: 0,
      summary: 'Saved report summary.',
    }

    useMatchStore.setState({ history: [historyEntry] })

    const { container } = render(<MatchPage />)
    const nav = screen.getByRole('navigation', { name: /match report sections/i })
    const history = container.querySelector<HTMLDetailsElement>('#match-report-history details')

    expect(nav.querySelector('a[href="#match-report-history"]')?.textContent).toBe('History')
    expect(history?.open).toBe(false)
    expect(screen.getByText('1 saved')).toBeTruthy()
    expect(screen.getByText('Staff Platform Engineer')).toBeTruthy()
    expect(screen.getByText('Atlas · 1 requirements · 0 gaps')).toBeTruthy()
    expect(screen.getByText('Saved report summary.')).toBeTruthy()
  })

  it('progressively discloses dense report sections', () => {
    const { container } = render(<MatchPage />)

    const vectorSummary = container.querySelector<HTMLDetailsElement>(
      '#match-report-vector-summary details',
    )
    const summary = container.querySelector<HTMLDetailsElement>('#match-report-summary details')
    const advantages = container.querySelector<HTMLDetailsElement>(
      '#match-report-advantages details',
    )
    const requirements = container.querySelector<HTMLDetailsElement>(
      '#match-report-requirements details',
    )
    const evidence = container.querySelector<HTMLDetailsElement>('#match-report-evidence details')
    const gaps = container.querySelector<HTMLDetailsElement>('#match-report-gaps details')

    expect(vectorSummary?.open).toBe(true)
    expect(summary?.open).toBe(true)
    expect(advantages?.open).toBe(true)
    expect(requirements?.open).toBe(false)
    expect(evidence?.open).toBe(false)
    expect(gaps?.open).toBe(false)

    fireEvent.click(screen.getByText('Requirement Coverage'))

    expect(requirements?.open).toBe(true)
  })

  it('uses nested disclosures for dense report details', () => {
    const { container, rerender } = render(<MatchPage />)

    const vectorNestedSections = Array.from(
      container.querySelectorAll<HTMLDetailsElement>(
        '#match-report-vector-summary .match-nested-disclosure',
      ),
    )
    const evidenceNestedSections = Array.from(
      container.querySelectorAll<HTMLDetailsElement>(
        '#match-report-evidence .match-nested-disclosure',
      ),
    )
    const requirementNestedSection = container.querySelector<HTMLDetailsElement>(
      '#match-report-requirements .match-nested-disclosure',
    )

    expect(vectorNestedSections).toHaveLength(4)
    expect(vectorNestedSections[0]?.open).toBe(true)
    expect(vectorNestedSections.slice(1).every((section) => !section.open)).toBe(true)
    expect(evidenceNestedSections).toHaveLength(5)
    expect(evidenceNestedSections.every((section) => !section.open)).toBe(true)
    expect(requirementNestedSection?.open).toBe(false)

    fireEvent.click(screen.getByText('Skill matches'))
    expect(vectorNestedSections[1]?.open).toBe(true)

    useMatchStore.setState({
      warnings: [taggedNote('Updated warning after nested section opened.')],
    })
    rerender(<MatchPage />)

    expect(
      container.querySelectorAll<HTMLDetailsElement>(
        '#match-report-vector-summary .match-nested-disclosure',
      )[1]?.open,
    ).toBe(true)
  })

  it('renders inline empty states for empty advantages and requirements', () => {
    useMatchStore.setState({
      currentJDAnalysis: {
        ...jdAnalysisFixture,
        requirements: [],
        advantages: [],
      },
      currentReport: {
        ...reportFixture,
        advantages: [],
        requirements: [],
      },
    })

    render(<MatchPage />)

    expect(screen.getByText('No distinct advantages were identified in this report.')).toBeTruthy()
    expect(screen.getByText('No structured requirements flagged for this JD.')).toBeTruthy()
  })

  it('opens a collapsed report section when reached from a hash link', () => {
    const { container } = render(<MatchPage />)

    const requirements = container.querySelector<HTMLDetailsElement>(
      '#match-report-requirements details',
    )
    expect(requirements?.open).toBe(false)

    window.location.hash = '#match-report-requirements'
    fireEvent(window, new Event('hashchange'))

    expect(requirements?.open).toBe(true)
  })

  it('opens a collapsed report section when the page loads with a section hash', () => {
    window.location.hash = '#match-report-requirements'

    const { container } = render(<MatchPage />)

    expect(
      container.querySelector<HTMLDetailsElement>('#match-report-requirements details')?.open,
    ).toBe(true)
  })

  it('ignores unknown report section hashes', () => {
    const { container } = render(<MatchPage />)
    const requirements = container.querySelector<HTMLDetailsElement>(
      '#match-report-requirements details',
    )

    expect(requirements?.open).toBe(false)

    window.location.hash = '#not-a-section'
    fireEvent(window, new Event('hashchange'))

    expect(requirements?.open).toBe(false)
  })

  it('cleans up the report hash listener on unmount', () => {
    const removeListener = vi.spyOn(window, 'removeEventListener')
    const { unmount } = render(<MatchPage />)

    unmount()

    expect(removeListener).toHaveBeenCalledWith('hashchange', expect.any(Function))
    window.location.hash = '#match-report-requirements'
    expect(() => fireEvent(window, new Event('hashchange'))).not.toThrow()
  })

  it('reopens a manually collapsed section when its nav link is clicked again', async () => {
    const { container } = render(<MatchPage />)
    const requirements = container.querySelector<HTMLDetailsElement>(
      '#match-report-requirements details',
    )
    const nav = screen.getByRole('navigation', { name: /match report sections/i })
    const requirementLink = nav.querySelector<HTMLAnchorElement>(
      'a[href="#match-report-requirements"]',
    )

    expect(requirementLink).toBeTruthy()
    expect(requirements?.open).toBe(false)

    fireEvent.click(requirementLink!)
    expect(requirements?.open).toBe(true)

    fireEvent.click(screen.getByText('Requirement Coverage'))
    expect(
      container.querySelector<HTMLDetailsElement>('#match-report-requirements details')?.open,
    ).toBe(false)

    const refreshedRequirementLink = screen
      .getByRole('navigation', { name: /match report sections/i })
      .querySelector<HTMLAnchorElement>('a[href="#match-report-requirements"]')
    fireEvent.click(refreshedRequirementLink!)
    await waitFor(() => {
      expect(
        container.querySelector<HTMLDetailsElement>('#match-report-requirements details')?.open,
      ).toBe(true)
    })
  })

  it('renders safely for legacy-only persisted match state', () => {
    useMatchStore.setState({
      jobDescription: reportFixture.jobDescription,
      currentJDAnalysis: null,
      currentAnalysis: null,
      currentReport: reportFixture,
      warnings: reportFixture.warnings,
      history: [],
    })

    render(<MatchPage />)

    expect(screen.queryByText('Vector-Aware Summary')).toBeNull()
    expect(
      screen
        .getByRole('navigation', { name: /match report sections/i })
        .querySelector('a[href="#match-report-vector-summary"]'),
    ).toBeNull()
    expect(screen.getAllByText('Summary').length).toBeGreaterThan(0)
    expect(screen.getByText(reportFixture.summary)).toBeTruthy()
  })

  it('exports the combined analysis and report payload', async () => {
    const exportScopedAnalysis: JDAnalysis = {
      ...jdAnalysisFixture,
      warnings: [
        taggedNote('Candidate export warning.'),
        taggedNote('Internal export warning.', ['internal']),
      ],
      positioningRecommendations: [
        taggedNote('Candidate export positioning.'),
        taggedNote('Recruiter export hook.', ['recruiter']),
      ],
    }

    useMatchStore.setState({
      currentJDAnalysis: exportScopedAnalysis,
      currentAnalysis: {
        ...analysisFixture,
        warnings: exportScopedAnalysis.warnings,
      },
      currentReport: {
        ...reportFixture,
        warnings: exportScopedAnalysis.warnings,
        positioningRecommendations: exportScopedAnalysis.positioningRecommendations,
      },
      warnings: exportScopedAnalysis.warnings,
    })

    render(<MatchPage />)

    fireEvent.click(screen.getByRole('button', { name: /export report/i }))

    expect(exportedBlob).toBeTruthy()
    const payload = JSON.parse(await exportedBlob!.text()) as {
      jdAnalysis: JDAnalysis | null
      analysis: VectorAwareMatchResult | null
      report: MatchReport | null
    }

    expect(payload.jdAnalysis?.id).toBe('match-analysis-1')
    expect(payload.analysis?.id).toBe('match-analysis-1')
    expect(payload.report?.summary).toBe(reportFixture.summary)
    expect(JSON.stringify(payload)).toContain('Candidate export warning.')
    expect(JSON.stringify(payload)).toContain('Candidate export positioning.')
    expect(JSON.stringify(payload)).not.toContain('Internal export warning.')
    expect(JSON.stringify(payload)).not.toContain('Recruiter export hook.')
    expect(screen.getByRole('status').textContent).toContain('Exported the current match report.')
  })

  it('saves the canonical JD analysis to a new pipeline entry without recomputing', () => {
    render(<MatchPage />)

    fireEvent.click(screen.getByRole('button', { name: /save to pipeline/i }))

    const entry = usePipelineStore.getState().entries[0]
    expect(entry?.company).toBe('Atlas')
    expect(entry?.role).toBe('Staff Platform Engineer')
    expect(entry?.jobDescription).toBe(reportFixture.jobDescription)
    expect(entry?.jdAnalysisId).toBe('match-analysis-1')
    expect(entry?.vectorId).toBe('platform-lead')

    const attachedAnalysis = entry
      ? useJDAnalysisStore.getState().findByPipelineEntry(entry.id)
      : null
    expect(attachedAnalysis?.id).toBe('match-analysis-1')
    expect(attachedAnalysis?.pipelineEntryId).toBe(entry?.id)
    expect(attachedAnalysis?.jdTextHash).toBe(hashJobDescriptionText(entry?.jobDescription ?? ''))
    expect(entry?.history.at(-1)?.note).toBe('Saved JD Match analysis')
    expect(screen.getByRole('status').textContent).toContain(
      'Saved Atlas · Staff Platform Engineer to Pipeline',
    )
  })

  it('reuses a matching pipeline entry when saving the canonical JD analysis', () => {
    usePipelineStore.getState().addEntry({
      company: 'Atlas, Inc.',
      role: 'Staff Platform Engineer',
      tier: '1',
      status: 'interviewing',
      comp: '$250k',
      url: 'https://atlas.example/jobs/platform',
      contact: 'recruiter@atlas.example',
      vectorId: 'backend',
      jobDescription: 'Old job description.',
      jdAnalysisId: null,
      presetId: null,
      resumeVariant: '',
      resumeGeneration: null,
      positioning: 'Curated recruiter-facing positioning.',
      skillMatch: 'Curated skill framing.',
      nextStep: 'Prepare for the recruiter screen.',
      notes: 'Existing hand-written note.',
      appMethod: 'referral',
      response: 'screen-scheduled',
      daysToResponse: 2,
      rounds: 3,
      format: ['hm-screen'],
      rejectionStage: '',
      rejectionReason: '',
      offerAmount: '',
      dateApplied: '2026-04-02',
      dateClosed: '',
    })
    const existingEntryId = usePipelineStore.getState().entries[0]!.id

    render(<MatchPage />)

    fireEvent.click(screen.getByRole('button', { name: /save to pipeline/i }))

    const entries = usePipelineStore.getState().entries
    expect(entries).toHaveLength(1)
    const entry = entries[0]!
    expect(entry.id).toBe(existingEntryId)
    expect(entry.company).toBe('Atlas, Inc.')
    expect(entry.role).toBe('Staff Platform Engineer')
    expect(entry.status).toBe('interviewing')
    expect(entry.comp).toBe('$250k')
    expect(entry.appMethod).toBe('referral')
    expect(entry.dateApplied).toBe('2026-04-02')
    expect(entry.notes).toBe('Existing hand-written note.')
    expect(entry.nextStep).toBe('Prepare for the recruiter screen.')
    expect(entry.jobDescription).toBe(reportFixture.jobDescription)
    expect(entry.jdAnalysisId).toBe('match-analysis-1')
    expect(entry.vectorId).toBe('backend')
    expect(entry.positioning).toBe('Curated recruiter-facing positioning.')
    expect(entry.skillMatch).toBe('Curated skill framing.')
    expect(entry.history.at(-1)?.note).toBe('Updated JD Match analysis')

    const attachedAnalysis = useJDAnalysisStore.getState().findByPipelineEntry(existingEntryId)
    expect(attachedAnalysis?.id).toBe('match-analysis-1')
    expect(attachedAnalysis?.pipelineEntryId).toBe(existingEntryId)
    expect(screen.getByRole('status').textContent).toContain(
      'most recent matching Atlas · Staff Platform Engineer',
    )
  })

  it('fills blank analysis-derived fields on a matching pipeline entry', () => {
    usePipelineStore.getState().addEntry({
      company: 'Atlas',
      role: 'Staff Platform Engineer',
      tier: '2',
      status: 'researching',
      comp: '',
      url: '',
      contact: '',
      vectorId: null,
      jobDescription: '',
      jdAnalysisId: null,
      presetId: null,
      resumeVariant: '',
      resumeGeneration: null,
      positioning: '',
      skillMatch: '',
      nextStep: '',
      notes: '',
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
    })

    render(<MatchPage />)

    fireEvent.click(screen.getByRole('button', { name: /save to pipeline/i }))

    const entry = usePipelineStore.getState().entries[0]!
    expect(entry.vectorId).toBe('platform-lead')
    expect(entry.positioning).toBe('Lead with platform migration stories.')
    expect(entry.skillMatch).toBe('Kubernetes')
    expect(entry.nextStep).toBe('Review JD analysis and decide whether to apply.')
    expect(entry.jdAnalysisId).toBe('match-analysis-1')
    expect(usePipelineStore.getState().entries).toHaveLength(1)
  })

  it('fills blank Pipeline fields from candidate-facing analysis text', () => {
    usePipelineStore.getState().addEntry({
      company: 'Atlas',
      role: 'Staff Platform Engineer',
      tier: '2',
      status: 'researching',
      comp: '',
      url: '',
      contact: '',
      vectorId: null,
      jobDescription: '',
      jdAnalysisId: null,
      presetId: null,
      resumeVariant: '',
      resumeGeneration: null,
      positioning: '',
      skillMatch: '',
      nextStep: '',
      notes: '',
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
    })
    useMatchStore.setState({
      currentJDAnalysis: {
        ...jdAnalysisFixture,
        positioningRecommendations: [
          taggedNote('Candidate Pipeline positioning.'),
          taggedNote('Recruiter Pipeline hook.', ['recruiter']),
        ],
        skillMatches: [
          tagged({
            ...analysisFixture.skillMatches[0]!,
            skillName: 'Candidate Pipeline skill',
          }),
          tagged(
            {
              ...analysisFixture.skillMatches[0]!,
              skillName: 'Recruiter Pipeline skill',
            },
            ['recruiter'],
          ),
        ],
      },
      currentReport: {
        ...reportFixture,
        positioningRecommendations: [
          taggedNote('Recruiter Pipeline hook.', ['recruiter']),
          taggedNote('Candidate Pipeline positioning.'),
        ],
      },
    })

    render(<MatchPage />)
    fireEvent.click(screen.getByRole('button', { name: /save to pipeline/i }))

    const entry = usePipelineStore.getState().entries[0]!
    expect(entry.positioning).toBe('Candidate Pipeline positioning.')
    expect(entry.skillMatch).toBe('Candidate Pipeline skill')
    expect(entry.positioning).not.toContain('Recruiter Pipeline hook.')
    expect(entry.skillMatch).not.toContain('Recruiter Pipeline skill')

    const attachedAnalysis = useJDAnalysisStore.getState().findByPipelineEntry(entry.id)
    expect(
      attachedAnalysis?.positioningRecommendations.some(
        (note) => note.text === 'Recruiter Pipeline hook.',
      ),
    ).toBe(true)
    expect(
      attachedAnalysis?.skillMatches.some(
        (skillMatch) => skillMatch.skillName === 'Recruiter Pipeline skill',
      ),
    ).toBe(true)
  })

  it('keeps skill match blank when candidate skill matches are filtered out', () => {
    usePipelineStore.getState().addEntry({
      company: 'Atlas',
      role: 'Staff Platform Engineer',
      tier: '2',
      status: 'researching',
      comp: '',
      url: '',
      contact: '',
      vectorId: null,
      jobDescription: '',
      jdAnalysisId: null,
      presetId: null,
      resumeVariant: '',
      resumeGeneration: null,
      positioning: '',
      skillMatch: '',
      nextStep: '',
      notes: '',
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
    })
    useMatchStore.setState({
      currentJDAnalysis: {
        ...jdAnalysisFixture,
        skillMatches: [
          tagged(
            {
              ...analysisFixture.skillMatches[0]!,
              skillName: 'Recruiter-only skill',
            },
            ['recruiter'],
          ),
        ],
        matchedKeywords: ['platform', 'linux'],
      },
    })

    render(<MatchPage />)
    fireEvent.click(screen.getByRole('button', { name: /save to pipeline/i }))

    const entry = usePipelineStore.getState().entries[0]!
    expect(entry.skillMatch).toBe('')
    expect(entry.skillMatch).not.toContain('Recruiter-only skill')
  })

  it('creates a new pipeline entry when existing entries do not match the JD analysis role', () => {
    usePipelineStore.getState().addEntry({
      company: 'Globex',
      role: 'Senior Backend Engineer',
      tier: '2',
      status: 'researching',
      comp: '$210k',
      url: 'https://globex.example/jobs/backend',
      contact: '',
      vectorId: 'backend',
      jobDescription: 'Build backend APIs.',
      jdAnalysisId: null,
      presetId: null,
      resumeVariant: '',
      resumeGeneration: null,
      positioning: 'Backend systems fit.',
      skillMatch: 'backend',
      nextStep: 'Follow up with Globex.',
      notes: 'Keep this entry untouched.',
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
    })
    const globexId = usePipelineStore.getState().entries[0]!.id

    render(<MatchPage />)

    fireEvent.click(screen.getByRole('button', { name: /save to pipeline/i }))

    const entries = usePipelineStore.getState().entries
    expect(entries).toHaveLength(2)
    expect(entries.find((entry) => entry.id === globexId)).toMatchObject({
      company: 'Globex',
      role: 'Senior Backend Engineer',
      jobDescription: 'Build backend APIs.',
      notes: 'Keep this entry untouched.',
      jdAnalysisId: null,
    })
    const atlas = entries.find((entry) => entry.company === 'Atlas')
    expect(atlas?.role).toBe('Staff Platform Engineer')
    expect(atlas?.jobDescription).toBe(reportFixture.jobDescription)
    expect(atlas?.jdAnalysisId).toBe('match-analysis-1')
    expect(screen.getByRole('status').textContent).toContain(
      'Saved Atlas · Staff Platform Engineer to Pipeline',
    )
  })

  it('creates a fresh entry instead of reusing a terminal matching pipeline entry', () => {
    usePipelineStore.getState().addEntry({
      company: 'Atlas',
      role: 'Staff Platform Engineer',
      tier: '1',
      status: 'rejected',
      comp: '',
      url: '',
      contact: '',
      vectorId: null,
      jobDescription: 'Rejected role JD.',
      jdAnalysisId: null,
      presetId: null,
      resumeVariant: '',
      resumeGeneration: null,
      positioning: 'Rejected positioning.',
      skillMatch: '',
      nextStep: '',
      notes: 'Closed-out history.',
      appMethod: 'unknown',
      response: 'human-reject',
      daysToResponse: null,
      rounds: null,
      format: [],
      rejectionStage: 'technical',
      rejectionReason: 'Past process closed.',
      offerAmount: '',
      dateApplied: '2026-03-10',
      dateClosed: '2026-03-20',
    })
    const rejectedId = usePipelineStore.getState().entries[0]!.id

    render(<MatchPage />)

    fireEvent.click(screen.getByRole('button', { name: /save to pipeline/i }))

    const entries = usePipelineStore.getState().entries
    expect(entries).toHaveLength(2)
    expect(entries.find((entry) => entry.id === rejectedId)).toMatchObject({
      status: 'rejected',
      jobDescription: 'Rejected role JD.',
      jdAnalysisId: null,
      notes: 'Closed-out history.',
      dateClosed: '2026-03-20',
    })
    const fresh = entries.find((entry) => entry.id !== rejectedId)
    expect(fresh?.company).toBe('Atlas')
    expect(fresh?.jdAnalysisId).toBe('match-analysis-1')
    expect(useJDAnalysisStore.getState().findByPipelineEntry(fresh?.id ?? '')?.id).toBe(
      'match-analysis-1',
    )
    expect(screen.getByRole('status').textContent).toContain(
      'Saved Atlas · Staff Platform Engineer to Pipeline',
    )
  })

  it('creates a fresh entry instead of reusing a soft-deleted matching pipeline entry', () => {
    usePipelineStore.getState().addEntry({
      company: 'Atlas',
      role: 'Staff Platform Engineer',
      tier: '1',
      status: 'researching',
      comp: '',
      url: '',
      contact: '',
      vectorId: null,
      jobDescription: 'Deleted role JD.',
      jdAnalysisId: null,
      presetId: null,
      resumeVariant: '',
      resumeGeneration: null,
      positioning: '',
      skillMatch: '',
      nextStep: '',
      notes: 'Deleted row.',
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
      deletedAt: '2026-04-03T12:00:00.000Z',
    })
    const deletedId = usePipelineStore.getState().entries[0]!.id

    render(<MatchPage />)

    fireEvent.click(screen.getByRole('button', { name: /save to pipeline/i }))

    const entries = usePipelineStore.getState().entries
    expect(entries).toHaveLength(2)
    expect(entries.find((entry) => entry.id === deletedId)).toMatchObject({
      deletedAt: '2026-04-03T12:00:00.000Z',
      jobDescription: 'Deleted role JD.',
      jdAnalysisId: null,
    })
    const fresh = entries.find((entry) => entry.id !== deletedId)
    expect(fresh?.company).toBe('Atlas')
    expect(fresh?.jdAnalysisId).toBe('match-analysis-1')
    expect(useJDAnalysisStore.getState().findByPipelineEntry(fresh?.id ?? '')?.id).toBe(
      'match-analysis-1',
    )
    expect(screen.getByRole('status').textContent).toContain(
      'Saved Atlas · Staff Platform Engineer to Pipeline',
    )
  })
})
