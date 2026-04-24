import type { ProfessionalIdentityV3 } from '../../identity/schema'

export const identityFixture: ProfessionalIdentityV3 = {
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
    matching: {
      prioritize: [],
      avoid: [],
    },
  },
  skills: {
    groups: [
      {
        id: 'platform',
        label: 'Platform',
        items: [{ name: 'Kubernetes', tags: ['platform', 'kubernetes'] }],
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
          metrics: { services_ported: 8 },
          technologies: ['Kubernetes'],
          tags: ['platform', 'kubernetes'],
        },
      ],
    },
  ],
  projects: [],
  education: [],
  generator_rules: {
    voice_skill: 'candidate-voice',
    resume_skill: 'candidate-resume',
  },
}

export const cloneIdentityFixture = (): ProfessionalIdentityV3 =>
  structuredClone(identityFixture)
