import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProfessionalIdentityV3 } from '../identity/schema'
import { applyRulesBasedAudiences } from '../utils/audienceRules'
import { generateLinkedInProfile } from '../utils/linkedinProfileGenerator'

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

describe('linkedinProfileGenerator', () => {
  beforeEach(() => {
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
    vi.restoreAllMocks()
  })

  it('normalizes generated LinkedIn profile output', async () => {
    const result = await generateLinkedInProfile('https://ai.example/proxy', identityFixture, {
      focus: 'Staff platform engineer',
      audience: 'Hiring managers',
    })

    expect(result).toEqual({
      outputType: 'profile_summary',
      name: 'Platform LinkedIn Draft',
      focus: 'Staff platform engineer',
      audience: 'Hiring managers',
      headline: 'Staff Platform Engineer | Kubernetes | Developer Productivity',
      about: 'I build platform systems that reduce complexity for product teams.',
      topSkills: ['Kubernetes', 'Platform Engineering', 'Developer Productivity'],
      featuredHighlights: [
        'Ported a platform for on-prem installs.',
        'Translate infrastructure tradeoffs into product delivery decisions.',
      ],
    })
  })

  it('projects JD context by LinkedIn output audience before prompting', async () => {
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
                featuredHighlights: ['Built platform deployment systems.'],
                outreachMessage: 'Hi, this background maps cleanly to the platform mandate.',
                outreachTalkingPoints: ['Platform mandate', 'Deployment systems'],
              }),
            },
          },
        ],
      }),
    }) as typeof fetch
    const jdAnalysis = applyRulesBasedAudiences({
      id: 'analysis-linkedin',
      pipelineEntryId: 'pipe-linkedin',
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

    const result = await generateLinkedInProfile('https://ai.example/proxy', identityFixture, {
      outputType: 'recruiter_outreach',
      jdAnalysis,
    })

    const requestBody = JSON.parse(
      ((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as RequestInit).body as string,
    ) as { messages: Array<{ content: string }> }
    expect(requestBody.messages[0]!.content).toContain('"audience": "recruiter"')
    expect(requestBody.messages[0]!.content).toContain('Recruiter-only proof point.')
    expect(requestBody.messages[0]!.content).not.toContain('Candidate-only profile note.')
    expect(result).toMatchObject({
      outputType: 'recruiter_outreach',
      outreachMessage: 'Hi, this background maps cleanly to the platform mandate.',
      outreachTalkingPoints: ['Platform mandate', 'Deployment systems'],
    })
  })

  it('projects JD context to the candidate audience for profile summary prompts', async () => {
    const jdAnalysis = applyRulesBasedAudiences({
      id: 'analysis-linkedin-profile',
      pipelineEntryId: 'pipe-linkedin-profile',
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

    await generateLinkedInProfile('https://ai.example/proxy', identityFixture, { jdAnalysis })

    const requestBody = JSON.parse(
      ((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as RequestInit).body as string,
    ) as { messages: Array<{ content: string }> }
    expect(requestBody.messages[0]!.content).toContain('"audience": "candidate"')
    expect(requestBody.messages[0]!.content).toContain('Candidate-only profile note.')
    expect(requestBody.messages[0]!.content).not.toContain('Recruiter-only proof point.')
  })

  it('labels hiring manager outreach prompts', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                name: 'Hiring Manager Outreach Draft',
                headline: 'Staff Platform Engineer',
                about: 'Short supporting context.',
                topSkills: ['Kubernetes'],
                featuredHighlights: ['Built deployment systems.'],
                outreachMessage: 'Hi, this maps to your platform ownership needs.',
                outreachTalkingPoints: ['Platform ownership'],
              }),
            },
          },
        ],
      }),
    }) as typeof fetch

    const jdAnalysis = applyRulesBasedAudiences({
      id: 'analysis-linkedin-hm',
      pipelineEntryId: 'pipe-linkedin-hm',
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
          id: 'adv-hm',
          claim: 'Hiring-manager proof point.',
          requirementIds: [],
          evidence: [],
          audiences: { inferred: ['hiring_manager'], asserted: ['hiring_manager'] },
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

    await generateLinkedInProfile('https://ai.example/proxy', identityFixture, {
      outputType: 'hiring_manager_outreach',
      jdAnalysis,
    })

    const requestBody = JSON.parse(
      ((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as RequestInit).body as string,
    ) as { system: string; messages: Array<{ content: string }> }
    expect(requestBody.system).toContain('Generate a hiring manager outreach message.')
    expect(requestBody.messages[0]!.content).toContain('"audience": "hiring_manager"')
    expect(requestBody.messages[0]!.content).toContain('Hiring-manager proof point.')
    expect(requestBody.messages[0]!.content).not.toContain('Candidate-only profile note.')
  })

  it('rejects outreach outputs missing outreach fields', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                name: 'Broken Outreach Draft',
                headline: 'Staff Platform Engineer',
                about: 'Short supporting context.',
                topSkills: ['Kubernetes'],
                featuredHighlights: ['Built deployment systems.'],
              }),
            },
          },
        ],
      }),
    }) as typeof fetch

    await expect(
      generateLinkedInProfile('https://ai.example/proxy', identityFixture, {
        outputType: 'recruiter_outreach',
      }),
    ).rejects.toThrow('LinkedIn outreach response schema was invalid.')
  })

  it('rejects outreach outputs with empty outreach fields', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                name: 'Broken Outreach Draft',
                headline: 'Staff Platform Engineer',
                about: 'Short supporting context.',
                topSkills: ['Kubernetes'],
                featuredHighlights: ['Built deployment systems.'],
                outreachMessage: '   ',
                outreachTalkingPoints: [],
              }),
            },
          },
        ],
      }),
    }) as typeof fetch

    await expect(
      generateLinkedInProfile('https://ai.example/proxy', identityFixture, {
        outputType: 'recruiter_outreach',
      }),
    ).rejects.toThrow('LinkedIn outreach response schema was invalid.')
  })

  it('rejects outreach outputs missing talking points only', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                name: 'Broken Outreach Draft',
                headline: 'Staff Platform Engineer',
                about: 'Short supporting context.',
                topSkills: ['Kubernetes'],
                featuredHighlights: ['Built deployment systems.'],
                outreachMessage: 'Valid outreach message.',
                outreachTalkingPoints: [],
              }),
            },
          },
        ],
      }),
    }) as typeof fetch

    await expect(
      generateLinkedInProfile('https://ai.example/proxy', identityFixture, {
        outputType: 'recruiter_outreach',
      }),
    ).rejects.toThrow('LinkedIn outreach response schema was invalid.')
  })

  it('rejects outreach outputs missing message only', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                name: 'Broken Outreach Draft',
                headline: 'Staff Platform Engineer',
                about: 'Short supporting context.',
                topSkills: ['Kubernetes'],
                featuredHighlights: ['Built deployment systems.'],
                outreachMessage: '   ',
                outreachTalkingPoints: ['Valid talking point.'],
              }),
            },
          },
        ],
      }),
    }) as typeof fetch

    await expect(
      generateLinkedInProfile('https://ai.example/proxy', identityFixture, {
        outputType: 'recruiter_outreach',
      }),
    ).rejects.toThrow('LinkedIn outreach response schema was invalid.')
  })

  it('rejects invalid schemas', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                headline: 'Broken output',
                about: 'Missing required fields.',
                topSkills: [],
                featuredHighlights: [],
              }),
            },
          },
        ],
      }),
    }) as typeof fetch

    await expect(
      generateLinkedInProfile('https://ai.example/proxy', identityFixture),
    ).rejects.toThrow('LinkedIn profile response schema was invalid.')
  })
})
