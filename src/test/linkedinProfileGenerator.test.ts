import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProfessionalIdentityV3 } from '../identity/schema'
import { generateLinkedInProfile } from '../utils/linkedinProfileGenerator'

const identityFixture: ProfessionalIdentityV3 = {
  version: 3,
  schema_revision: '3.1',
  model_revision: 0,
  identity: {
    name: 'Nick Ferguson',
    email: 'nick@example.com',
    phone: '555-0100',
    location: 'Tampa, FL',
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
  roles: [
    {
      id: 'a10',
      company: 'A10 Networks',
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
