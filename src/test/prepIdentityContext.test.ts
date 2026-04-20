import { describe, expect, it } from 'vitest'
import type { ProfessionalIdentityV3 } from '../identity/schema'
import { buildPrepIdentityContext } from '../utils/prepIdentityContext'

const identityFixture: ProfessionalIdentityV3 = {
  version: 3,
  schema_revision: '3.1',
  model_revision: 0,
  identity: {
    name: 'Alex Example',
    display_name: 'Alex',
    email: 'alex@example.com',
    phone: '555-0100',
    location: 'New York, NY',
    links: [],
    thesis: 'Builds reliable backend platforms.',
  },
  self_model: {
    arc: [],
    philosophy: [
      { id: 'phil-1', text: 'Keep systems understandable.', tags: ['systems'] },
    ],
    interview_style: {
      strengths: ['incident response'],
      weaknesses: ['rambling'],
      prep_strategy: 'Use short STAR answers.',
    },
  },
  preferences: {
    compensation: { priorities: [] },
    work_model: { preference: 'remote' },
    matching: { prioritize: [], avoid: [] },
  },
  skills: {
    groups: [
      {
        id: 'skills-platform',
        label: 'Platform',
        items: [
          {
            name: 'Kubernetes',
            depth: 'strong',
            positioning: 'Operates production clusters.',
            tags: ['platform'],
          },
          { name: 'COBOL', depth: 'basic', tags: ['legacy'] },
        ],
      },
    ],
  },
  profiles: [],
  roles: [
    {
      id: 'role-acme',
      company: 'Acme',
      title: 'Principal Engineer',
      dates: '2021-2024',
      bullets: [
        {
          id: 'bullet-keep',
          problem: 'Latency spiked during peak traffic.',
          action: 'Redesigned the service mesh rollout.',
          outcome: 'Reduced incidents by 38%.',
          impact: ['Restored SLO compliance'],
          metrics: { incidents: '38%' },
          technologies: ['Kubernetes'],
          tags: ['platform'],
        },
        {
          id: 'bullet-drop',
          problem: 'Maintained legacy data feeds.',
          action: 'Patched batch jobs.',
          outcome: 'Kept the nightly job alive.',
          impact: ['Minimal'],
          metrics: { feeds: 1 },
          technologies: ['COBOL'],
          tags: ['legacy'],
        },
      ],
    },
  ],
  projects: [],
  education: [],
  generator_rules: {
    voice_skill: 'clear',
    resume_skill: 'targeted',
  },
  search_vectors: [
    {
      id: 'backend',
      title: 'Backend Platform',
      priority: 'high',
      thesis: 'Lead with distributed systems and platform reliability.',
      target_roles: ['Staff Engineer'],
      keywords: {
        primary: ['distributed systems'],
        secondary: ['platform reliability'],
      },
      supporting_skills: ['Kubernetes'],
      supporting_bullets: ['bullet-keep'],
    },
  ],
}

describe('buildPrepIdentityContext', () => {
  it('filters roles and skills to vector-relevant assets and keeps interview style context', () => {
    const context = buildPrepIdentityContext(identityFixture, 'backend') as {
      identity: { display_name?: string }
      self_model: {
        interview_style: { strengths: string[] }
        prep_strategy?: string
      }
      candidate_metrics?: Array<{
        metricKey: string
        metricValue: string
        company: string
        suggestedLabel: string
      }>
      fallback_candidate_metrics?: Array<{
        metricKey: string
        metricValue: string
        company: string
        suggestedLabel: string
      }>
      roles: Array<{ bullets: Array<{ id: string }> }>
      skills: Array<{ items: Array<{ name: string }> }>
      philosophy?: unknown
      education?: unknown
      generator_rules?: unknown
    }

    expect(context.self_model.interview_style.strengths).toEqual([
      'incident response',
    ])
    expect(context.self_model.prep_strategy).toBe('Use short STAR answers.')
    expect(context.identity.display_name).toBe('Alex')
    expect(context.roles).toHaveLength(1)
    expect(context.roles[0].bullets).toEqual([
      expect.objectContaining({ id: 'bullet-keep' }),
    ])
    expect(context.candidate_metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          metricKey: 'incidents',
          metricValue: '38%',
          company: 'Acme',
          suggestedLabel: 'Incidents',
        }),
      ]),
    )
    expect(context.candidate_metrics?.[0]).toEqual(
      expect.objectContaining({
        metricKey: 'incidents',
        metricValue: '38%',
      }),
    )
    expect(context.fallback_candidate_metrics).toEqual([
      expect.objectContaining({
        metricKey: 'feeds',
        metricValue: '1',
        company: 'Acme',
        suggestedLabel: 'Feeds',
      }),
    ])
    expect(context.skills).toEqual([
      expect.objectContaining({
        items: [expect.objectContaining({ name: 'Kubernetes' })],
      }),
    ])
    expect(context.philosophy).toBeUndefined()
    expect(context.education).toBeUndefined()
    expect(context.generator_rules).toBeUndefined()
  })

  it('preserves raw bullet evidence for vector-relevant stories', () => {
    const context = buildPrepIdentityContext(
      {
        ...identityFixture,
        roles: [
          {
            ...identityFixture.roles[0],
            bullets: [
              {
                ...identityFixture.roles[0].bullets[0],
                source_text:
                  'Cut the AWS bill in half by consolidating per-tenant infrastructure.',
                portfolio_dive: '#aws-savings',
              },
              ...identityFixture.roles[0].bullets.slice(1),
            ],
          },
        ],
      },
      'backend',
    ) as {
      roles: Array<{
        bullets: Array<{
          source_text?: string
          portfolio_dive?: string | null
        }>
      }>
    }

    expect(context.roles[0].bullets[0]?.source_text).toBe(
      'Cut the AWS bill in half by consolidating per-tenant infrastructure.',
    )
    expect(context.roles[0].bullets[0]?.portfolio_dive).toBe('#aws-savings')
  })

  it('keeps non-vector metrics available to prep even when their bullets are filtered out', () => {
    const identityWithExtraMetric: ProfessionalIdentityV3 = {
      ...identityFixture,
      roles: [
        {
          ...identityFixture.roles[0],
          bullets: identityFixture.roles[0].bullets.map((bullet) =>
            bullet.id === 'bullet-drop'
              ? {
                  ...bullet,
                  metrics: {
                    aws_savings_monthly: '$60K/mo',
                    aws_bill_reduction: '50%',
                  },
                }
              : bullet,
          ),
        },
      ],
    }

    const context = buildPrepIdentityContext(
      identityWithExtraMetric,
      'backend',
    ) as {
      candidate_metrics?: Array<{ metricKey: string; metricValue: string }>
      fallback_candidate_metrics?: Array<{
        metricKey: string
        metricValue: string
      }>
      roles: Array<{ bullets: Array<{ id: string }> }>
    }

    expect(context.roles[0].bullets).toEqual([
      expect.objectContaining({ id: 'bullet-keep' }),
    ])
    expect(context.candidate_metrics).toEqual([
      expect.objectContaining({ metricKey: 'incidents', metricValue: '38%' }),
    ])
    expect(context.fallback_candidate_metrics).toEqual([
      expect.objectContaining({
        metricKey: 'aws_savings_monthly',
        metricValue: '$60K/mo',
      }),
      expect.objectContaining({
        metricKey: 'aws_bill_reduction',
        metricValue: '50%',
      }),
    ])
  })

  it('surfaces fallback metrics when the selected vector has no matching bullets', () => {
    const noMatchIdentity: ProfessionalIdentityV3 = {
      ...identityFixture,
      search_vectors: [
        {
          id: 'frontend',
          title: 'Frontend Product Surface',
          priority: 'high',
          thesis: 'Lead with browser-facing product delivery.',
          target_roles: ['Frontend Engineer'],
          keywords: {
            primary: ['react'],
            secondary: ['ui'],
          },
        },
      ],
    }

    const context = buildPrepIdentityContext(noMatchIdentity, 'frontend') as {
      candidate_metrics?: Array<{ metricKey: string; metricValue: string }>
      fallback_candidate_metrics?: Array<{
        metricKey: string
        metricValue: string
      }>
      roles: Array<{ bullets: Array<{ id: string }> }>
    }

    expect(context.roles).toEqual([])
    expect(context.candidate_metrics).toBeUndefined()
    expect(context.fallback_candidate_metrics).toEqual([
      expect.objectContaining({ metricKey: 'incidents', metricValue: '38%' }),
      expect.objectContaining({ metricKey: 'feeds', metricValue: '1' }),
    ])
  })

  it('falls back to broad structured context when the vector is missing', () => {
    const context = buildPrepIdentityContext(identityFixture, 'missing') as {
      candidate_metrics?: Array<{ metricKey: string; metricValue: string }>
      roles: Array<{ bullets: Array<{ id: string }> }>
      skills: Array<{ items: Array<{ name: string }> }>
    }

    expect(context.roles[0].bullets).toHaveLength(2)
    expect(context.skills[0].items).toHaveLength(2)
    expect(context.candidate_metrics).toEqual([
      expect.objectContaining({ metricKey: 'incidents', metricValue: '38%' }),
      expect.objectContaining({ metricKey: 'feeds', metricValue: '1' }),
    ])
  })

  it('uses vector id and label terms to scope fallback matching when an exact vector is unavailable', () => {
    const context = buildPrepIdentityContext(
      identityFixture,
      'missing',
      'Platform Reliability',
    ) as {
      roles: Array<{ bullets: Array<{ id: string }> }>
      skills: Array<{ items: Array<{ name: string }> }>
    }

    expect(context.roles[0].bullets).toEqual([
      expect.objectContaining({ id: 'bullet-keep' }),
    ])
    expect(context.skills).toEqual([
      expect.objectContaining({
        items: [expect.objectContaining({ name: 'Kubernetes' })],
      }),
    ])
  })

  it('uses keyword and evidence matching when a vector exists without explicit support ids', () => {
    const identityWithKeywordVector: ProfessionalIdentityV3 = {
      ...identityFixture,
      search_vectors: [
        {
          id: 'reliability',
          title: 'Reliability Story',
          priority: 'high',
          thesis: 'Lean on customer-facing stability wins.',
          target_roles: ['Staff Engineer'],
          keywords: {
            primary: [],
            secondary: [],
          },
          evidence: [
            'Reduced incidents by 38%',
            'Kubernetes platform reliability',
          ],
        },
      ],
    }

    const context = buildPrepIdentityContext(
      identityWithKeywordVector,
      'reliability',
    ) as {
      roles: Array<{ bullets: Array<{ id: string }> }>
      skills: Array<{ items: Array<{ name: string }> }>
    }

    expect(context.roles[0].bullets).toEqual([
      expect.objectContaining({ id: 'bullet-keep' }),
    ])
    expect(context.skills[0].items).toEqual([
      expect.objectContaining({ name: 'Kubernetes' }),
    ])
  })

  it('keeps relevant assets when vector metadata mixes explicit support and keyword evidence', () => {
    const identityWithPartialSupport: ProfessionalIdentityV3 = {
      ...identityFixture,
      search_vectors: [
        {
          id: 'platform',
          title: 'Platform Reliability',
          priority: 'high',
          thesis: 'Focus on reliability wins.',
          target_roles: ['Staff Engineer'],
          keywords: {
            primary: [],
            secondary: [],
          },
          evidence: ['Kubernetes platform reliability'],
          supporting_bullets: ['bullet-keep'],
        },
      ],
    }

    const context = buildPrepIdentityContext(
      identityWithPartialSupport,
      'platform',
    ) as {
      roles: Array<{ bullets: Array<{ id: string }> }>
      skills: Array<{ items: Array<{ name: string }> }>
    }

    expect(context.roles[0].bullets).toEqual([
      expect.objectContaining({ id: 'bullet-keep' }),
    ])
    expect(context.skills).toEqual([
      expect.objectContaining({
        items: [expect.objectContaining({ name: 'Kubernetes' })],
      }),
    ])
  })
})
