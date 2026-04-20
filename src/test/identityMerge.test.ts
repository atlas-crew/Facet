import { describe, expect, it } from 'vitest'
import { importProfessionalIdentity, type ProfessionalIdentityV3 } from '../identity/schema'
import { mergeProfessionalIdentity, replaceProfessionalIdentity } from '../utils/identityMerge'

const createIdentity = (): ProfessionalIdentityV3 => ({
  $schema: 'https://atlascrew.dev/schemas/identity.json',
  version: 3,
  schema_revision: '3.1',
  model_revision: 0,
  identity: {
    name: 'Jordan Example',
    email: 'jordan@example.com',
    phone: '555-0100',
    location: 'Remote',
    links: [{ id: 'linkedin', url: 'https://example.com/in/jordan' }],
    thesis: 'Platform-minded staff engineer.',
  },
  self_model: {
    arc: [{ company: 'Acme', chapter: 'Scaled platform delivery' }],
    philosophy: [
      { id: 'boring-systems', text: 'Prefer boring systems that fail well.', tags: ['platform'] },
    ],
    interview_style: {
      strengths: ['System design'],
      weaknesses: ['Over-explaining'],
      prep_strategy: 'Map stories to company context.',
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
        id: 'languages',
        label: 'Languages',
        items: [{ name: 'TypeScript', tags: ['platform'] }],
      },
    ],
  },
  profiles: [
    {
      id: 'default',
      tags: ['platform'],
      text: 'Platform engineer who ships maintainable systems.',
    },
  ],
  roles: [
    {
      id: 'acme',
      company: 'Acme',
      title: 'Senior Engineer',
      dates: '2022 - Present',
      bullets: [
        {
          id: 'acme-1',
          problem: 'Deployment workflow was fragmented.',
          action: 'Led platform migration to a unified pipeline.',
          outcome: 'Teams shipped through one deployment workflow.',
          impact: ['Standardized delivery'],
          metrics: { pipelines: 12 },
          technologies: ['TypeScript', 'Terraform'],
          tags: ['platform', 'delivery'],
        },
      ],
    },
  ],
  projects: [
    {
      id: 'facet',
      name: 'Facet',
      description: 'Resume and identity tooling.',
      tags: ['career-tools'],
    },
  ],
  education: [
    {
      school: 'State College',
      location: 'Florida',
      degree: 'B.S. Computer Science',
      year: '2018',
    },
  ],
  generator_rules: {
    voice_skill: 'nick-voice',
    resume_skill: 'nick-resume',
  },
})

describe('identityMerge', () => {
  it('merges by id and preserves existing entries that are not replaced', () => {
    const current = createIdentity()
    const incoming = createIdentity()
    incoming.identity.title = 'Staff Engineer'
    incoming.self_model.philosophy = [
      ...incoming.self_model.philosophy,
      { id: 'handoff-first', text: 'Everything is built to hand off from day one.', tags: ['leadership'] },
    ]
    incoming.skills.groups = [
      {
        id: 'languages',
        label: 'Languages',
        items: [
          { name: 'TypeScript', tags: ['platform'] },
          { name: 'Go', tags: ['infrastructure'] },
        ],
      },
      {
        id: 'infra',
        label: 'Infrastructure',
        items: [{ name: 'Kubernetes', tags: ['platform'] }],
      },
    ]
    incoming.profiles = [
      {
        id: 'default',
        tags: ['platform', 'leadership'],
        text: 'Staff platform engineer for scale-sensitive systems.',
      },
      {
        id: 'founding',
        tags: ['startup'],
        text: 'Builds systems quickly with small teams.',
      },
    ]
    incoming.roles = [
      incoming.roles[0],
      {
        id: 'beta',
        company: 'Beta',
        title: 'Principal Engineer',
        dates: '2020 - 2022',
        bullets: [
          {
            id: 'beta-1',
            problem: 'Platform work was fragmented.',
            action: 'Built internal platform.',
            outcome: 'Established paved-road tooling for product teams.',
            impact: ['Created paved road'],
            metrics: {},
            technologies: ['Go'],
            tags: ['platform', 'enablement'],
          },
        ],
      },
    ]
    incoming.projects = [
      incoming.projects[0],
      {
        id: 'cortex',
        name: 'Cortex',
        description: 'Agent workflow tooling.',
        tags: ['agents'],
      },
    ]

    const result = mergeProfessionalIdentity(current, incoming)

    expect(result.data.identity.title).toBe('Staff Engineer')
    expect(result.data.skills.groups).toHaveLength(2)
    expect(result.data.profiles).toHaveLength(2)
    expect(result.data.roles).toHaveLength(2)
    expect(result.data.projects).toHaveLength(2)
    expect(result.details).toEqual(
      expect.arrayContaining([
        'Replaced identity core from draft.',
        'Replaced self model from draft.',
        'Added skill groups: infra.',
        'Updated skill groups: languages.',
        'Added profiles: founding.',
        'Updated profiles: default.',
        'Added roles: beta.',
        'Added projects: cortex.',
      ]),
    )
  })

  it('deduplicates identical education entries and can replace wholesale', () => {
    const current = createIdentity()
    const incoming = createIdentity()
    incoming.education = [
      {
        school: 'State College',
        location: 'Florida',
        degree: 'B.S. Computer Science',
        year: '2018',
      },
    ]

    const merged = mergeProfessionalIdentity(current, incoming)
    expect(merged.data.education).toHaveLength(1)

    const replaced = replaceProfessionalIdentity(incoming)
    expect(replaced.summary).toContain('Replaced identity model')
    expect(replaced.data.roles).toHaveLength(1)
  })

  it('preserves existing vectors and awareness when the incoming merge draft omits them', () => {
    const current = createIdentity()
    current.search_vectors = [
      {
        id: 'v1-platform',
        title: 'Platform Engineer',
        priority: 'high',
        thesis: 'Platform systems builder.',
        target_roles: ['Platform Engineer'],
        keywords: {
          primary: ['platform'],
          secondary: ['developer experience'],
        },
      },
    ]
    current.awareness = {
      open_questions: [
        {
          id: 'degree-filter-risk',
          topic: 'Degree filter risk',
          description: 'Some companies filter.',
          action: 'Check requirements.',
        },
      ],
    }

    const incoming = createIdentity()

    const merged = mergeProfessionalIdentity(current, incoming)

    expect(merged.data.search_vectors).toEqual(current.search_vectors)
    expect(merged.data.awareness).toEqual(current.awareness)
  })

  it('preserves optional v3.1 fields when an older normalized draft omitted them', () => {
    const current = createIdentity()
    current.search_vectors = [
      {
        id: 'v1-platform',
        title: 'Platform Engineer',
        priority: 'high',
        thesis: 'Platform systems builder.',
        target_roles: ['Platform Engineer'],
        keywords: {
          primary: ['platform'],
          secondary: ['developer experience'],
        },
      },
    ]
    current.preferences.constraints = {
      education: {
        highest: 'B.S.',
        show_on_resume: true,
      },
    }
    current.preferences.matching = {
      prioritize: [
        {
          id: 'builder-friendly',
          label: 'Builder-friendly process',
          description: 'Practical screening.',
          weight: 'high',
        },
      ],
      avoid: [],
    }
    current.awareness = {
      open_questions: [
        {
          id: 'degree-filter-risk',
          topic: 'Degree filter risk',
          description: 'Some companies filter.',
          action: 'Check requirements.',
        },
      ],
    }

    const incoming = importProfessionalIdentity(createIdentity()).data

    const merged = mergeProfessionalIdentity(current, incoming, {
      awareness: false,
      search_vectors: false,
      preferences: {
        constraints: false,
        matching: false,
      },
    })

    expect(merged.data.search_vectors).toEqual(current.search_vectors)
    expect(merged.data.preferences.constraints).toEqual(current.preferences.constraints)
    expect(merged.data.preferences.matching).toEqual(current.preferences.matching)
    expect(merged.data.awareness).toEqual(current.awareness)
    expect(merged.details).not.toContain('Removed search vectors: v1-platform.')
    expect(merged.details).not.toContain('Removed awareness items: degree-filter-risk.')
  })

  it('preserves enriched skill metadata when a legacy draft omits it', () => {
    const current = createIdentity()
    current.skills.groups[0] = {
      ...current.skills.groups[0],
      positioning: 'Primary differentiator.',
      is_differentiator: true,
      items: [
        {
          ...current.skills.groups[0].items[0],
          depth: 'expert',
          context: 'Primary language across platform roles.',
          positioning: 'Lead with this skill.',
          enriched_at: '2026-04-08T14:23:17Z',
          enriched_by: 'user-edited-llm',
        },
      ],
    }

    const incoming = createIdentity()

    const merged = mergeProfessionalIdentity(current, incoming)

    expect(merged.data.skills.groups[0]?.positioning).toBe('Primary differentiator.')
    expect(merged.data.skills.groups[0]?.is_differentiator).toBe(true)
    expect(merged.data.skills.groups[0]?.items[0]?.depth).toBe('expert')
    expect(merged.data.skills.groups[0]?.items[0]?.context).toContain('Primary language')
    expect(merged.data.skills.groups[0]?.items[0]?.positioning).toContain('Lead with this skill')
    expect(merged.data.skills.groups[0]?.items[0]?.enriched_by).toBe('user-edited-llm')
  })

  it('removes omitted skills from a provided group during merge', () => {
    const current = createIdentity()
    current.skills.groups[0].items.push({ name: 'Go', tags: ['infrastructure'] })

    const incoming = createIdentity()

    const merged = mergeProfessionalIdentity(current, incoming)

    expect(merged.data.skills.groups[0]?.items).toEqual([
      { name: 'TypeScript', tags: ['platform'] },
    ])
  })

  it('clears skill enrichment fields when the draft explicitly sets them to null', () => {
    const current = createIdentity()
    current.skills.groups[0] = {
      ...current.skills.groups[0],
      positioning: 'Primary differentiator.',
      is_differentiator: true,
      items: [
        {
          ...current.skills.groups[0].items[0],
          depth: 'expert',
          context: 'Primary language across platform roles.',
          positioning: 'Lead with this skill.',
          enriched_at: '2026-04-08T14:23:17Z',
          enriched_by: 'user-edited-llm',
          skipped_at: '2026-04-08T14:25:01Z',
        },
      ],
    }

    const incoming = importProfessionalIdentity({
      ...createIdentity(),
      skills: {
        groups: [
          {
            id: 'languages',
            label: 'Languages',
            positioning: null,
            is_differentiator: null,
            items: [
              {
                name: 'TypeScript',
                depth: null,
                context: null,
                positioning: null,
                tags: ['platform'],
                enriched_at: null,
                enriched_by: null,
                skipped_at: null,
              },
            ],
          },
        ],
      },
    }).data

    const merged = mergeProfessionalIdentity(current, incoming)

    expect(merged.data.skills.groups[0]?.positioning).toBeUndefined()
    expect(merged.data.skills.groups[0]?.is_differentiator).toBeUndefined()
    expect(merged.data.skills.groups[0]?.items[0]?.depth).toBeUndefined()
    expect(merged.data.skills.groups[0]?.items[0]?.context).toBeUndefined()
    expect(merged.data.skills.groups[0]?.items[0]?.positioning).toBeUndefined()
    expect(merged.data.skills.groups[0]?.items[0]?.enriched_at).toBeUndefined()
    expect(merged.data.skills.groups[0]?.items[0]?.enriched_by).toBeUndefined()
    expect(merged.data.skills.groups[0]?.items[0]?.skipped_at).toBeUndefined()
  })

  it('applies incoming matching updates when the merge draft provides them', () => {
    const current = createIdentity()
    current.preferences.matching = {
      prioritize: [
        {
          id: 'builder-friendly',
          label: 'Builder-friendly process',
          description: 'Practical screening.',
          weight: 'high',
        },
      ],
      avoid: [],
    }

    const incoming = createIdentity()
    incoming.preferences.matching = {
      prioritize: [
        {
          id: 'security-tooling',
          label: 'Security tooling',
          description: 'Hands-on platform security work.',
          weight: 'medium',
        },
      ],
      avoid: [
        {
          id: 'bureaucratic-approvals',
          label: 'Bureaucratic approvals',
          description: 'Heavy approval chains slow delivery.',
          severity: 'soft',
        },
      ],
    }

    const merged = mergeProfessionalIdentity(current, incoming, {
      preferences: {
        matching: true,
      },
    })

    expect(merged.data.preferences.matching).toEqual(incoming.preferences.matching)
  })

  it('honors preference field masks even when the current value is undefined', () => {
    const current = createIdentity()
    const incomingDraft = createIdentity()
    incomingDraft.preferences.matching = {
      prioritize: [
        {
          id: 'builder-friendly',
          label: 'Builder-friendly process',
          description: 'Practical screening.',
          weight: 'high',
        },
      ],
      avoid: [],
    }
    incomingDraft.preferences.constraints = {
      education: {
        highest: 'B.S.',
        show_on_resume: true,
      },
    }
    const incoming = importProfessionalIdentity(incomingDraft).data
    const currentMatching = importProfessionalIdentity(current).data.preferences.matching

    const merged = mergeProfessionalIdentity(current, incoming, {
      preferences: {
        constraints: false,
        matching: false,
      },
    })

    expect(merged.data.preferences.constraints).toBeUndefined()
    expect(merged.data.preferences.matching).toEqual(currentMatching)
    expect(merged.data.preferences.matching).not.toEqual(incoming.preferences.matching)
  })

  it('merges vectors and awareness items by id instead of replacing them wholesale', () => {
    const current = createIdentity()
    current.search_vectors = [
      {
        id: 'v1-platform',
        title: 'Platform Engineer',
        priority: 'high',
        thesis: 'Platform systems builder.',
        target_roles: ['Platform Engineer'],
        keywords: {
          primary: ['platform'],
          secondary: ['developer experience'],
        },
      },
    ]
    current.awareness = {
      open_questions: [
        {
          id: 'degree-filter-risk',
          topic: 'Degree filter risk',
          description: 'Some companies filter.',
          action: 'Check requirements.',
        },
      ],
    }

    const incoming = createIdentity()
    incoming.search_vectors = [
      {
        id: 'v1-platform',
        title: 'Staff Platform Engineer',
        priority: 'high',
        thesis: 'Updated thesis.',
        target_roles: ['Staff Platform Engineer'],
        keywords: {
          primary: ['platform'],
          secondary: ['systems'],
        },
      },
      {
        id: 'v2-security',
        title: 'Security Tooling Engineer',
        priority: 'medium',
        thesis: 'Security tooling angle.',
        target_roles: ['Security Tooling Engineer'],
        keywords: {
          primary: ['security tooling'],
          secondary: ['platform'],
        },
      },
    ]
    incoming.awareness = {
      open_questions: [
        {
          id: 'degree-filter-risk',
          topic: 'Degree filter risk',
          description: 'Updated concern.',
          action: 'Check stricter requirements.',
        },
        {
          id: 'salary-anchor-risk',
          topic: 'Salary anchoring',
          description: 'Comp is below market.',
          action: 'Practice better framing.',
        },
      ],
    }

    const merged = mergeProfessionalIdentity(current, incoming)

    expect(merged.data.search_vectors).toEqual([
      incoming.search_vectors[0],
      incoming.search_vectors[1],
    ])
    expect(merged.data.awareness).toEqual({
      open_questions: [
        incoming.awareness.open_questions[0],
        incoming.awareness.open_questions[1],
      ],
    })
    expect(merged.details).toEqual(
      expect.arrayContaining([
        'Updated search vectors: v1-platform.',
        'Added search vectors: v2-security.',
        'Updated awareness items: degree-filter-risk.',
        'Added awareness items: salary-anchor-risk.',
      ]),
    )
  })

  it('removes vectors and awareness items when the incoming draft explicitly omits them', () => {
    const current = createIdentity()
    current.search_vectors = [
      {
        id: 'v1-platform',
        title: 'Platform Engineer',
        priority: 'high',
        thesis: 'Platform systems builder.',
        target_roles: ['Platform Engineer'],
        keywords: {
          primary: ['platform'],
          secondary: ['developer experience'],
        },
      },
      {
        id: 'v2-security',
        title: 'Security Tooling Engineer',
        priority: 'medium',
        thesis: 'Security tooling angle.',
        target_roles: ['Security Tooling Engineer'],
        keywords: {
          primary: ['security tooling'],
          secondary: ['platform'],
        },
      },
    ]
    current.awareness = {
      open_questions: [
        {
          id: 'degree-filter-risk',
          topic: 'Degree filter risk',
          description: 'Some companies filter.',
          action: 'Check requirements.',
        },
        {
          id: 'salary-anchor-risk',
          topic: 'Salary anchoring',
          description: 'Comp is below market.',
          action: 'Practice better framing.',
        },
      ],
    }

    const incoming = createIdentity()
    incoming.search_vectors = [current.search_vectors[0]]
    incoming.awareness = {
      open_questions: [current.awareness.open_questions[0]],
    }

    const merged = mergeProfessionalIdentity(current, incoming)

    expect(merged.data.search_vectors).toEqual([current.search_vectors[0]])
    expect(merged.data.awareness).toEqual({
      open_questions: [current.awareness.open_questions[0]],
    })
    expect(merged.details).toEqual(
      expect.arrayContaining([
        'Removed search vectors: v2-security.',
        'Removed awareness items: salary-anchor-risk.',
      ]),
    )
  })
})
