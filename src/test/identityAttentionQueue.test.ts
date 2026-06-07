import { describe, expect, it } from 'vitest'
import {
  deriveIdentityAttentionItems,
  getNextIdentityAttentionItem,
} from '../utils/identityAttentionQueue'
import { cloneIdentityFixture } from './fixtures/identityFixture'

const makeCompleteIdentity = () => {
  const identity = cloneIdentityFixture()
  identity.identity.thesis =
    'I build Kubernetes and Postgres platforms for regulated SaaS teams. I turn ambiguous delivery constraints into reliable operating systems. I make infrastructure choices legible to product and security leaders.'
  identity.self_model = {
    arc: [
      {
        company: 'Contoso Networks',
        chapter: 'Built platform systems that made enterprise delivery predictable.',
      },
    ],
    philosophy: [
      { id: 'clarity', text: 'Make tradeoffs explicit.', tags: ['leadership'] },
      { id: 'systems', text: 'Prefer durable systems over heroic recovery.', tags: ['platform'] },
    ],
    interview_style: {
      strengths: ['system design', 'cross-functional strategy'],
      weaknesses: ['take-home exercises'],
      prep_strategy: 'Map every answer to an operating principle and a concrete artifact.',
    },
    competitive_moat: 'Combines platform depth with product-facing judgment.',
    unfair_advantages: [
      'Can translate infra work into business risk.',
      'Has shipped across constraints.',
    ],
  }
  identity.profiles = [
    { id: 'platform', tags: ['platform'], text: 'Platform systems profile.' },
    { id: 'security', tags: ['security'], text: 'Security and reliability profile.' },
    { id: 'leadership', tags: ['leadership'], text: 'Engineering leadership profile.' },
  ]
  identity.roles[0]!.bullets = [
    {
      id: 'delivery',
      problem: 'Enterprise delivery was blocked by cloud-only assumptions.',
      action: 'Designed a Kubernetes installation path.',
      outcome: 'Unlocked customer-hosted deployments.',
      impact: [],
      metrics: {},
      tags: ['platform'],
      technologies: ['Kubernetes'],
    },
    {
      id: 'reliability',
      problem: 'Operators lacked deployment confidence.',
      action: 'Added release guardrails and runbooks.',
      outcome: 'Reduced failed rollout risk.',
      impact: [],
      metrics: {},
      tags: ['reliability'],
      technologies: ['Postgres'],
    },
  ]
  identity.projects = [
    {
      id: 'installer',
      name: 'Enterprise installer',
      description: 'Customer-hosted installation path.',
      tags: ['platform'],
    },
  ]
  identity.skills.groups = [
    {
      id: 'platform',
      label: 'Platform Engineering',
      items: [
        {
          name: 'Kubernetes',
          tags: ['platform', 'kubernetes'],
          depth: 'strong',
          depthSource: 'corrected',
          context: 'Used across customer-hosted delivery.',
          positioning: 'Strong match for platform roles.',
        },
      ],
    },
  ]
  identity.preferences = {
    compensation: {
      base_floor: 175000,
      base_target: 210000,
      notes: 'Prioritizes strong teams and durable scope.',
      priorities: [{ item: 'base', weight: 'high' }],
    },
    work_model: {
      preference: 'remote',
      flexibility: 'Hybrid for the right team.',
      hard_no: 'No full-time office mandate.',
    },
    constraints: {
      clearance: { status: 'none' },
      education: { highest: 'BS' },
      title_flexibility: ['Staff', 'Principal'],
    },
    matching: {
      prioritize: [
        {
          id: 'platform',
          label: 'Platform ownership',
          description: 'Platform scope with durable ownership.',
          weight: 'high',
        },
      ],
      avoid: [
        {
          id: 'adtech',
          label: 'Adtech',
          description: 'Avoid adtech-heavy work.',
          severity: 'soft',
        },
      ],
    },
    interview_process: {
      accepted_formats: ['system design'],
      strong_fit_signals: ['collaborative team'],
      red_flags: ['opaque process'],
      max_rounds: 5,
      onsite_preferences: 'Remote-first preferred.',
    },
  }
  identity.search_vectors = [
    {
      id: 'platform',
      title: 'Platform',
      priority: 'high',
      thesis: 'Platform leadership.',
      target_roles: ['Staff Platform Engineer'],
      keywords: { primary: ['platform'], secondary: [] },
    },
    {
      id: 'infra',
      title: 'Infrastructure',
      priority: 'medium',
      thesis: 'Infrastructure strategy.',
      target_roles: ['Infrastructure Engineer'],
      keywords: { primary: ['infrastructure'], secondary: [] },
    },
    {
      id: 'security',
      title: 'Security',
      priority: 'medium',
      thesis: 'Security platform work.',
      target_roles: ['Security Platform Engineer'],
      keywords: { primary: ['security'], secondary: [] },
    },
  ]
  identity.awareness = { open_questions: [] }
  return identity
}

describe('deriveIdentityAttentionItems', () => {
  it('orders assumptions, inference gaps, taxonomy issues, and sparse fill signals', () => {
    const identity = cloneIdentityFixture()
    identity.awareness = {
      open_questions: [
        {
          id: 'visa',
          topic: 'Clarify visa status',
          severity: 'high',
          description: 'Work authorization is unclear.',
          action: 'Confirm sponsorship needs.',
        },
      ],
    }
    identity.roles[0]!.bullets[0] = {
      id: 'raw-bullet',
      problem: '',
      action: '',
      outcome: '',
      impact: [],
      metrics: {},
      technologies: [],
      source_text: 'Built installer for customer deployments.',
      tags: ['platform'],
    }
    identity.skills.groups[0]!.label = 'Skills 1'
    identity.skills.groups[0]!.items = [
      { name: 'Kubernetes', tags: ['platform'], skipped_at: '2026-06-01T00:00:00.000Z' },
      { name: 'Terraform', tags: [] },
    ]

    const items = deriveIdentityAttentionItems(identity)

    expect(items.map((item) => item.id).slice(0, 4)).toEqual([
      'awareness:visa',
      'bullet:contoso:raw-bullet',
      'skill-taxonomy:platform:group',
      'skill-skipped:platform:0:Kubernetes',
    ])
    expect(items.find((item) => item.id.includes('skill-pending'))?.selection).toEqual({
      type: 'skill-item',
      groupId: 'platform',
      itemId: 'Terraform',
      draft: true,
    })
    expect(items.some((item) => item.id === 'fill:roles')).toBe(true)
  })

  it('uses fallback copy for sparse awareness questions', () => {
    const identity = makeCompleteIdentity()
    identity.awareness = {
      open_questions: [{ id: 'unknown', topic: '', description: '', action: '' }],
    }

    expect(deriveIdentityAttentionItems(identity)[0]).toEqual(
      expect.objectContaining({
        id: 'awareness:unknown',
        title: 'Resolve open assumption',
        body: 'Answer or remove this open identity question.',
        statusLabel: 'open',
      }),
    )
  })

  it('includes stale and inferred skill review items', () => {
    const identity = makeCompleteIdentity()
    identity.skills.groups[0]!.items = [
      {
        name: 'Kubernetes',
        tags: ['platform'],
        depth: 'strong',
        context: 'Old platform context.',
        context_stale: true,
      },
      {
        name: 'Terraform',
        tags: ['iac'],
        depth: 'working',
        depthSource: 'inferred',
      },
    ]

    expect(deriveIdentityAttentionItems(identity).map((item) => item.id)).toEqual([
      'skill-stale:platform:0:Kubernetes',
      'skill-inferred:platform:1:Terraform',
    ])
  })

  it('routes skill taxonomy issues to the problematic skill when possible', () => {
    const identity = makeCompleteIdentity()
    identity.skills.groups[0]!.items = [
      {
        name: 'Kubernetes',
        tags: [],
        depth: 'strong',
        depthSource: 'corrected',
      },
    ]

    const taxonomyItem = deriveIdentityAttentionItems(identity).find((item) =>
      item.id.startsWith('skill-taxonomy'),
    )

    expect(taxonomyItem?.id).toBe('skill-taxonomy:platform:Kubernetes')
    expect(taxonomyItem?.selection).toEqual({
      type: 'skill-item',
      groupId: 'platform',
      itemId: 'Kubernetes',
    })
  })

  it('routes duplicate skill taxonomy issues to the group instead of an ambiguous skill', () => {
    const identity = makeCompleteIdentity()
    identity.skills.groups[0]!.items = [
      {
        name: 'Kubernetes',
        tags: ['platform'],
        depth: 'strong',
        depthSource: 'corrected',
      },
      {
        name: 'kubernetes',
        tags: ['platform'],
        depth: 'working',
        depthSource: 'inferred',
      },
    ]

    expect(deriveIdentityAttentionItems(identity)).toEqual([
      expect.objectContaining({
        id: 'skill-taxonomy:platform:group',
        statusLabel: 'Duplicate skill',
        selection: { type: 'skill-group', id: 'platform' },
      }),
    ])
  })

  it('selects the right inspector slot for sparse fill-strength bands', () => {
    const sparseCases = [
      {
        id: 'fill:thesis',
        mutate: (identity: ReturnType<typeof makeCompleteIdentity>) => {
          identity.identity.thesis = ''
        },
        selection: { type: 'thesis' },
      },
      {
        id: 'fill:self',
        mutate: (identity: ReturnType<typeof makeCompleteIdentity>) => {
          identity.self_model = {
            arc: [],
            philosophy: [],
            interview_style: { strengths: [], weaknesses: [], prep_strategy: '' },
          }
        },
        selection: { type: 'competitive-moat' },
      },
      {
        id: 'fill:profiles',
        mutate: (identity: ReturnType<typeof makeCompleteIdentity>) => {
          identity.profiles = [{ id: 'platform', tags: ['platform'], text: 'Platform profile.' }]
        },
        selection: { type: 'profile', id: 'platform' },
      },
      {
        id: 'fill:prefs',
        mutate: (identity: ReturnType<typeof makeCompleteIdentity>) => {
          identity.preferences = {
            compensation: { priorities: [] },
            work_model: { preference: '' },
            matching: { prioritize: [], avoid: [] },
          }
        },
        selection: { type: 'pref-field', field: 'compensation.notes' },
      },
      {
        id: 'fill:search',
        mutate: (identity: ReturnType<typeof makeCompleteIdentity>) => {
          identity.search_vectors = [
            {
              id: 'empty-vector',
              title: '',
              priority: 'medium',
              thesis: '',
              target_roles: [],
              keywords: { primary: [], secondary: [] },
            },
          ]
        },
        selection: { type: 'search-vector', id: 'empty-vector' },
      },
    ] as const

    for (const sparseCase of sparseCases) {
      const identity = makeCompleteIdentity()
      sparseCase.mutate(identity)

      expect(deriveIdentityAttentionItems(identity)).toContainEqual(
        expect.objectContaining({
          id: sparseCase.id,
          selection: sparseCase.selection,
        }),
      )
    }
  })

  it('does not emit sparse profile or search items without an inspector anchor', () => {
    const identity = makeCompleteIdentity()
    identity.profiles = []
    identity.search_vectors = []

    const ids = deriveIdentityAttentionItems(identity).map((item) => item.id)

    expect(ids).not.toContain('fill:profiles')
    expect(ids).not.toContain('fill:search')
  })

  it('returns an empty queue for null identity', () => {
    expect(deriveIdentityAttentionItems(null)).toEqual([])
  })

  it('returns an empty queue when the identity has no actionable gaps', () => {
    expect(deriveIdentityAttentionItems(makeCompleteIdentity())).toEqual([])
  })
})

describe('getNextIdentityAttentionItem', () => {
  it('advances after the current inspector selection and wraps', () => {
    const identity = makeCompleteIdentity()
    identity.awareness = {
      open_questions: [
        { id: 'one', topic: 'One', description: '', action: '' },
        { id: 'two', topic: 'Two', description: '', action: '' },
      ],
    }
    const items = deriveIdentityAttentionItems(identity)

    expect(getNextIdentityAttentionItem(items, null)?.id).toBe('awareness:one')
    expect(getNextIdentityAttentionItem(items, { type: 'awareness-question', id: 'one' })?.id).toBe(
      'awareness:two',
    )
    expect(getNextIdentityAttentionItem(items, { type: 'awareness-question', id: 'two' })?.id).toBe(
      'awareness:one',
    )
  })

  it('handles empty and unmatched selections defensively', () => {
    const identity = makeCompleteIdentity()
    identity.awareness = {
      open_questions: [{ id: 'one', topic: 'One', description: '', action: '' }],
    }
    const items = deriveIdentityAttentionItems(identity)

    expect(getNextIdentityAttentionItem([], null)).toBeNull()
    expect(getNextIdentityAttentionItem(items, { type: 'thesis' })?.id).toBe('awareness:one')
  })
})
