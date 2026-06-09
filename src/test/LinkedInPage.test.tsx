// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { LinkedInPage } from '../routes/linkedin/LinkedInPage'
import { useIdentityStore } from '../store/identityStore'
import { useJDAnalysisStore } from '../store/jdAnalysisStore'
import { migrateLinkedInState, useLinkedInStore } from '../store/linkedinStore'
import { resolveStorage } from '../store/storage'
import { applyRulesBasedAudiences } from '../utils/audienceRules'
import type { ProfessionalIdentityV3 } from '../identity/schema'

const identityFixture: ProfessionalIdentityV3 = {
  version: 3,
  schema_revision: '3.1',
  model_revision: 0,
  identity: {
    name: 'Alex Example',
    email: 'alex@example.com',
    phone: '555-555-0100',
    location: 'Denver, CO',
    links: [],
    thesis: 'I build platform systems that make hard things routine.',
  },
  self_model: {
    arc: [],
    philosophy: [
      {
        id: 'absorb-complexity',
        text: 'I absorb platform complexity so product teams can move faster.',
        tags: ['platform', 'devex'],
      },
    ],
    interview_style: {
      strengths: ['system design'],
      weaknesses: ['whiteboard trivia'],
      prep_strategy: 'Map stories to requirements.',
    },
  },
  preferences: {
    compensation: {
      priorities: [{ item: 'base', weight: 'high' }],
    },
    work_model: {
      preference: 'remote',
    },
    matching: { prioritize: [], avoid: [] },
  },
  skills: {
    groups: [
      {
        id: 'platform',
        label: 'Platform',
        items: [
          { name: 'Kubernetes', tags: ['platform', 'kubernetes'] },
        ],
      },
    ],
  },
  profiles: [
    {
      id: 'platform-profile',
      tags: ['platform'],
      text: 'I make infrastructure tradeoffs legible for product teams.',
    },
  ],
  expertise: [],
  roles: [
    {
      id: 'contoso',
      company: 'Contoso Networks',
      title: 'Senior Platform Engineer',
      dates: '2025-2026',
      bullets: [
        {
          id: 'platform-migration',
          problem: 'Cloud-only delivery blocked on-prem deployments.',
          action: 'Ported the platform to Kubernetes-based installs.',
          outcome: 'Made the product deployable in customer environments.',
          impact: ['Unlocked on-prem delivery'],
          metrics: { services_ported: 12 },
          technologies: ['Kubernetes'],
          tags: ['platform', 'kubernetes'],
        },
      ],
    },
  ],
  projects: [],
  education: [],
  generator_rules: {
    voice_skill: 'nick-voice',
    resume_skill: 'nick-resume',
  },
}

const jdAnalysisFixture = () =>
  applyRulesBasedAudiences({
    id: 'analysis-linkedin-page',
    pipelineEntryId: 'pipe-linkedin-page',
    jdTextHash: 'hash',
    identityVersion: 1,
    modelVersion: 'jd-analysis.v1.match-multipass-sonnet',
    generatedAt: '2026-05-06T00:00:00.000Z',
    updatedAt: '2026-05-06T00:00:00.000Z',
    warnings: [],
    company: 'Acme',
    role: 'Staff Platform Engineer',
    summary: '',
    analyzedJobDescription: '',
    jobDescriptionWordCount: 0,
    jobDescriptionTruncated: false,
    requirements: [],
    overallFit: 'strong',
    fitScore: 0.8,
    confidence: 'high',
    recommendation: 'apply',
    oneLineSummary: 'Platform-heavy role.',
    rationale: '',
    matchedVectors: [],
    primaryVectorId: null,
    skillMatches: [],
    evidenceMapping: {
      topBullets: [],
      topSkills: [],
      topProjects: [],
      topProfiles: [],
      topPhilosophy: [],
    },
    strengthsToLead: [],
    advantages: [
      {
        id: 'adv-recruiter',
        claim: 'Recruiter-only proof point.',
        requirementIds: [],
        evidence: [],
        audiences: { inferred: ['recruiter'], asserted: ['recruiter'] },
      },
    ],
    advantageHypotheses: [],
    gaps: [],
    gapFocus: [],
    watchOuts: [],
    triggeredPrioritize: [],
    triggeredAvoid: [],
    relevantAwareness: [],
    positioningRecommendations: [
      {
        text: 'Candidate-only profile note.',
        audiences: { inferred: ['candidate'], asserted: ['candidate'] },
      },
    ],
    requirementCoverageScore: 0,
    matchedRequirementIds: [],
    matchedKeywords: [],
  })

const mockOutreachResponse = () => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      choices: [
        {
          message: {
            content: JSON.stringify({
              name: 'Recruiter Outreach Draft',
              headline: 'Staff Platform Engineer | Kubernetes',
              about: 'Short supporting context.',
              topSkills: ['Kubernetes'],
              featuredHighlights: ['Built deployment systems.'],
              outreachMessage: 'Hi, this background maps to the platform mandate.',
              outreachTalkingPoints: ['Platform mandate', 'Deployment systems'],
            }),
          },
        },
      ],
    }),
  }) as typeof fetch
}

describe('LinkedInPage', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_ANTHROPIC_PROXY_URL', 'https://ai.example/proxy')
    resolveStorage().removeItem('facet-linkedin-workspace')
    useLinkedInStore.setState({ drafts: [], selectedDraftId: null })
    useJDAnalysisStore.setState({ analyses: [] })
    useIdentityStore.setState({
      sourceMaterial: '',
      correctionNotes: '',
      currentIdentity: identityFixture,
      draft: null,
      draftDocument: JSON.stringify(identityFixture, null, 2),
      warnings: [],
      changelog: [],
      lastError: null,
    })

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                name: 'Platform LinkedIn Draft',
                headline: 'Staff Platform Engineer | Kubernetes | Developer Productivity',
                about: 'I build platform systems that reduce complexity for product teams.',
                topSkills: ['Kubernetes', 'Platform Engineering', 'Developer Productivity'],
                featuredHighlights: ['Ported a platform for on-prem installs.', 'Translate infrastructure tradeoffs into product delivery decisions.'],
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

  it('generates a LinkedIn draft from the current identity model', async () => {
    render(<LinkedInPage />)

    fireEvent.change(screen.getByPlaceholderText(/Staff platform engineer/i), {
      target: { value: 'Staff platform engineer' },
    })
    fireEvent.click(screen.getByText('Generate with AI'))

    await waitFor(() => {
      expect(useLinkedInStore.getState().drafts).toHaveLength(1)
    })

    expect(screen.getByDisplayValue('Platform LinkedIn Draft')).toBeTruthy()
    expect(screen.getByDisplayValue('Staff Platform Engineer | Kubernetes | Developer Productivity')).toBeTruthy()
  })

  it('uses selected output type and latest JD context when generating outreach drafts', async () => {
    mockOutreachResponse()
    useJDAnalysisStore.setState({ analyses: [jdAnalysisFixture()] })
    render(<LinkedInPage />)

    const contextToggle = screen.getByLabelText('Use latest match context') as HTMLInputElement
    expect(contextToggle.checked).toBe(true)
    fireEvent.change(screen.getByLabelText('Output'), {
      target: { value: 'recruiter_outreach' },
    })
    fireEvent.click(screen.getByText('Generate with AI'))

    await waitFor(() => {
      expect(useLinkedInStore.getState().drafts[0]?.outputType).toBe('recruiter_outreach')
    })

    const firstRequest = JSON.parse(
      ((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as RequestInit).body as string,
    ) as { messages: Array<{ content: string }> }
    expect(firstRequest.messages[0]!.content).toContain('"audience": "recruiter"')
    expect(firstRequest.messages[0]!.content).toContain('Recruiter-only proof point.')
    expect(firstRequest.messages[0]!.content).not.toContain('Candidate-only profile note.')
    expect(screen.getByLabelText('Outreach message')).toBeTruthy()
    expect(screen.getByLabelText('Outreach talking points')).toBeTruthy()

    fireEvent.click(contextToggle)
    fireEvent.click(screen.getByText('Generate with AI'))

    await waitFor(() => {
      expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2)
    })
    const secondRequest = JSON.parse(
      ((global.fetch as ReturnType<typeof vi.fn>).mock.calls[1]?.[1] as RequestInit).body as string,
    ) as { messages: Array<{ content: string }> }
    expect(secondRequest.messages[0]!.content).toContain('Audience-projected JD context:\nNot provided')
  })

  it('keeps list textarea typing local until blur syncs the draft', () => {
    useLinkedInStore.setState({
      selectedDraftId: 'draft-1',
      drafts: [
        {
          id: 'draft-1',
          outputType: 'profile_summary',
          name: 'Editable Draft',
          focus: '',
          audience: '',
          headline: 'Headline',
          about: 'About',
          topSkills: ['Original'],
          featuredHighlights: ['Highlight'],
          generatedAt: '2026-05-06T00:00:00.000Z',
        },
      ],
    })

    render(<LinkedInPage />)

    const topSkills = screen.getByLabelText('Top skills')
    fireEvent.change(topSkills, { target: { value: 'One\nTwo\n' } })
    expect(useLinkedInStore.getState().drafts[0]?.topSkills).toEqual(['Original'])
    fireEvent.blur(topSkills)
    expect(useLinkedInStore.getState().drafts[0]?.topSkills).toEqual(['One', 'Two'])
  })

  it('refreshes list textarea buffers when the active draft changes', () => {
    useLinkedInStore.setState({
      selectedDraftId: 'draft-a',
      drafts: [
        {
          id: 'draft-a',
          outputType: 'profile_summary',
          name: 'Draft A',
          focus: '',
          audience: '',
          headline: 'Headline A',
          about: 'About A',
          topSkills: ['Skill A'],
          featuredHighlights: ['Highlight A'],
          generatedAt: '2026-05-06T00:00:00.000Z',
        },
        {
          id: 'draft-b',
          outputType: 'profile_summary',
          name: 'Draft B',
          focus: '',
          audience: '',
          headline: 'Headline B',
          about: 'About B',
          topSkills: ['Skill B'],
          featuredHighlights: ['Highlight B'],
          generatedAt: '2026-05-06T00:00:00.000Z',
        },
      ],
    })

    render(<LinkedInPage />)

    expect(screen.getByLabelText('Top skills')).toHaveProperty('value', 'Skill A')
    fireEvent.click(screen.getByRole('button', { name: 'Draft B' }))
    expect(screen.getByLabelText('Top skills')).toHaveProperty('value', 'Skill B')
  })

  it('exports outreach fields in downloaded draft text', async () => {
    const createObjectUrlMock = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:linkedin')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    useLinkedInStore.setState({
      selectedDraftId: 'draft-outreach',
      drafts: [
        {
          id: 'draft-outreach',
          outputType: 'recruiter_outreach',
          name: 'Outreach Draft',
          focus: '',
          audience: '',
          headline: 'Headline',
          about: 'About',
          topSkills: ['Kubernetes'],
          featuredHighlights: ['Built deployment systems.'],
          outreachMessage: 'Hi, this background maps to the platform mandate.',
          outreachTalkingPoints: ['Platform mandate', 'Deployment systems'],
          generatedAt: '2026-05-06T00:00:00.000Z',
        },
      ],
    })

    render(<LinkedInPage />)
    fireEvent.click(screen.getByText('Export'))

    const exportedBlob = createObjectUrlMock.mock.calls[0]?.[0] as Blob
    await expect(exportedBlob.text()).resolves.toContain('Outreach Message')
    await expect(exportedBlob.text()).resolves.toContain(
      'Hi, this background maps to the platform mandate.',
    )
    await expect(exportedBlob.text()).resolves.toContain('Outreach Talking Points')
    await expect(exportedBlob.text()).resolves.toContain('- Platform mandate')
  })

  it('backfills profile summary output type on older persisted drafts', () => {
    const migrated = migrateLinkedInState({
      drafts: [
        {
          id: 'legacy-draft',
          name: 'Legacy Draft',
          focus: '',
          audience: '',
          headline: '',
          about: '',
          topSkills: [],
          featuredHighlights: [],
          generatedAt: '2026-05-06T00:00:00.000Z',
        },
      ],
      selectedDraftId: 'legacy-draft',
    })

    expect(migrated.drafts[0]?.outputType).toBe('profile_summary')
  })

  it('shows hosted upgrade messaging when LinkedIn generation is paywalled', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 402,
      text: async () =>
        JSON.stringify({
          code: 'ai_access_denied',
          reason: 'upgrade_required',
          feature: 'linkedin.generate',
          error: 'Upgrade to AI Pro to use this hosted AI feature.',
        }),
    }) as typeof fetch

    render(<LinkedInPage />)
    fireEvent.click(screen.getByText('Generate with AI'))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Upgrade to AI Pro')
    })
  })
})
