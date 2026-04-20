import { describe, expect, it } from 'vitest'
import { defaultResumeData } from '../store/defaultData'
import { importResumeConfig } from '../engine/serializer'
import { professionalIdentityToResumeData } from '../identity/resumeAdapter'
import {
  importProfessionalIdentity,
  looksLikeProfessionalIdentity,
  type ProfessionalIdentityV3,
} from '../identity/schema'

const baseIdentityFixture: ProfessionalIdentityV3 = {
  $schema: 'https://atlascrew.dev/schemas/identity.json',
  version: 3,
  schema_revision: '3.1',
  identity: {
    name: 'Nicholas Ferguson',
    display_name: 'Nicholas Crew Ferguson',
    email: 'nick@atlascrew.dev',
    phone: '727.266.8813',
    location: 'Tampa Bay Area, FL',
    remote: true,
    title: 'Product Engineer',
    links: [
      { id: 'github', url: 'https://github.com/NickCrew' },
      { id: 'portfolio', url: 'https://portfolio.atlascrew.dev' },
    ],
    thesis: 'I solve business problems with computers.',
    elaboration: 'Bridge prototype-to-production gaps.',
    origin: 'Background in hospitality and photography.',
  },
  self_model: {
    arc: [
      { company: 'vispero', chapter: 'I can build anything' },
      { company: 'a10', chapter: 'I know why to build it' },
    ],
    philosophy: [
      {
        id: 'handoff-first',
        text: 'Everything is built to hand off from day one.',
        tags: ['Leadership', ' leadership '],
      },
      {
        id: 'problem-solving',
        text: 'I solve problems nobody knew to ask about.',
        tags: ['product'],
      },
    ],
    interview_style: {
      strengths: ['System design'],
      weaknesses: ['Timed coding challenges'],
      prep_strategy: 'Lead with stories.',
    },
  },
  preferences: {
    compensation: {
      base_floor: 180000,
      base_target: 200000,
      priorities: [
        { item: 'Base salary', weight: 'critical' },
        { item: 'Health insurance', weight: 'high' },
      ],
    },
    work_model: {
      preference: 'remote',
      hard_no: 'On-site required without relocation assistance',
    },
    matching: {
      prioritize: [
        {
          id: 'platform-roles',
          label: 'Platform roles',
          description: 'Platform roles',
          weight: 'medium',
        },
      ],
      avoid: [
        {
          id: 'pure-ticket-queue-work',
          label: 'Pure ticket queue work',
          description: 'Pure ticket queue work',
          severity: 'soft',
        },
      ],
    },
  },
  skills: {
    groups: [
      {
        id: 'sg-languages',
        label: 'Languages',
        items: [
          { name: 'TypeScript', depth: 'strong', tags: ['Platform', 'platform', ' DevEx '] },
          { name: 'Python', depth: 'strong', tags: ['backend', 'data'] },
        ],
      },
      {
        id: 'sg-practices',
        label: 'Also',
        items: [
          { name: 'Technical writing', tags: ['documentation', 'platform'] },
        ],
      },
    ],
  },
  profiles: [
    {
      id: 'profile-default',
      tags: ['General', 'platform', 'platform'],
      text: 'I drop into unfamiliar environments and ship.',
    },
  ],
  roles: [
    {
      id: 'a10',
      company: 'A10 Networks',
      subtitle: '(acquired ThreatX)',
      title: 'Senior Platform Engineer',
      dates: 'Feb 2025 – Mar 2026',
      portfolio_anchor: '#background',
      bullets: [
        {
          id: 'a10-delivery',
          problem: 'Legacy cloud-only architecture limited deployment options.',
          action: 'Rebuilt the product as a standalone edge sensor.',
          outcome: 'Product deployable anywhere.',
          impact: ['Unlocked deployment flexibility', 'Opened new market segment'],
          metrics: { latency_improvement: '4400x', services_replaced: 12 },
          technologies: ['Rust', 'Pingora'],
          portfolio_dive: '#synapse',
          tags: ['Security', 'security', ' Product '],
        },
      ],
    },
  ],
  projects: [
    {
      id: 'proj-facet',
      name: 'Facet',
      url: 'https://atlascrew.dev/facet',
      description: 'Targeted resume generation and job search workflow.',
      portfolio_dive: '#opensource',
      tags: ['product', 'typescript'],
    },
  ],
  education: [
    {
      school: 'St. Petersburg College',
      location: 'Clearwater, FL',
      degree: 'AAS, Computer Information Systems',
    },
  ],
  generator_rules: {
    voice_skill: 'nick-voice',
    resume_skill: 'nick-resume',
    accuracy: {
      platform_count: 'Four platforms across three companies',
      endpoint_platforms: ['Windows', 'Linux', 'macOS'],
    },
  },
}

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T

describe('professional identity schema', () => {
  it('normalizes and deduplicates tags during identity import', () => {
    const parsed = importProfessionalIdentity(clone(baseIdentityFixture))

    expect(parsed.data.schema_revision).toBe('3.1')
    expect(parsed.data.self_model.philosophy[0]?.tags).toEqual(['leadership'])
    expect(parsed.data.skills.groups[0]?.items[0]?.tags).toEqual(['platform', 'devex'])
    expect(parsed.data.profiles[0]?.tags).toEqual(['general', 'platform'])
    expect(parsed.data.roles[0]?.bullets[0]?.tags).toEqual(['security', 'product'])
    expect(parsed.warnings.some((warning) => warning.includes('duplicate tag "platform"'))).toBe(true)
  })

  it('imports native v3.1 fields without migration warnings', () => {
    const parsed = importProfessionalIdentity(clone(baseIdentityFixture))

    expect(parsed.data.schema_revision).toBe('3.1')
    expect(parsed.data.skills.groups[0]?.items[0]?.depth).toBe('strong')
    expect(parsed.data.skills.groups[0]?.items[1]?.depth).toBe('strong')
    expect(parsed.data.skills.groups[1]?.items[0]?.depth).toBeUndefined()
    expect(parsed.data.preferences.matching).toEqual(baseIdentityFixture.preferences.matching)
    expect(parsed.data.awareness).toBeUndefined()
    expect(parsed.warnings.some((warning) => warning.includes('schema_revision'))).toBe(false)
    expect(parsed.warnings.some((warning) => warning.includes('role_fit'))).toBe(false)
    expect(parsed.warnings.some((warning) => warning.includes('proficiency'))).toBe(false)
  })

  it('requires schema_revision to be present and native', () => {
    const missingRevision = clone(baseIdentityFixture) as unknown as Record<string, unknown>
    delete missingRevision.schema_revision

    expect(() => importProfessionalIdentity(missingRevision)).toThrow(/schema_revision/i)
  })

  it('normalizes numeric schema_revision 3.1 into the canonical string value', () => {
    const numericRevision = clone(baseIdentityFixture) as unknown as Record<string, unknown>
    numericRevision.schema_revision = 3.1

    const parsed = importProfessionalIdentity(numericRevision)

    expect(parsed.data.schema_revision).toBe('3.1')
  })

  it('requires preferences.matching in the native v3.1 contract', () => {
    const missingMatching = clone(baseIdentityFixture)
    delete (missingMatching.preferences as unknown as Record<string, unknown>).matching

    expect(() => importProfessionalIdentity(missingMatching)).toThrow(/preferences\.matching/i)
  })

  it('preserves explicit v3.1 fields when they are already present', () => {
    const enriched = clone(baseIdentityFixture)
    enriched.schema_revision = '3.1'
    enriched.preferences.matching = {
      prioritize: [
        {
          id: 'builder-friendly',
          label: 'Builder-friendly process',
          description: 'Take-homes and practical screens.',
          weight: 'high',
        },
      ],
      avoid: [
        {
          id: 'leetcode-gauntlet',
          label: 'Leetcode gauntlet',
          description: 'Extended algorithm interview loops.',
          severity: 'hard',
        },
      ],
    }
    enriched.preferences.constraints = {
      clearance: {
        status: 'none',
        willing_to_obtain: false,
        exclude_required: true,
      },
      education: {
        highest: 'AAS',
        in_progress: 'BAS',
        show_on_resume: false,
        filter_risk: 'Some companies filter on bachelors requirements.',
      },
      title_flexibility: ['Senior Platform Engineer', 'Staff Engineer'],
    }
    enriched.skills.groups[0].positioning = 'Primary differentiator.'
    enriched.skills.groups[0].is_differentiator = true
    enriched.skills.groups[0].items[0] = {
      ...enriched.skills.groups[0].items[0],
      depth: 'expert',
      context: 'Primary language across multiple platform roles.',
      context_stale: true,
      positioning: 'Strong match signal. List first.',
      positioning_stale: true,
      enriched_at: '2026-04-08T14:23:17Z',
      enriched_by: 'user-edited-llm',
    }
    enriched.skills.groups[1].items[0] = {
      ...enriched.skills.groups[1].items[0],
      depth: 'avoid',
      skipped_at: '2026-04-08T14:25:01Z',
    }
    enriched.search_vectors = [
      {
        id: 'v1-security-platform',
        title: 'Security Platform Engineer',
        priority: 'high',
        subtitle: 'Deepest moat',
        thesis: 'Blend of security and platform systems work.',
        target_roles: ['Platform Engineer', 'Security Tooling Engineer'],
        keywords: {
          primary: ['security platform'],
          secondary: ['tooling'],
        },
        supporting_skills: ['sg-languages'],
        supporting_bullets: ['a10-delivery'],
      },
    ]
    enriched.awareness = {
      open_questions: [
        {
          id: 'degree-filter-risk',
          topic: 'Degree filter risk',
          description: 'Some companies filter on bachelors.',
          action: 'Check requirements before applying.',
          severity: 'medium',
        },
      ],
    }

    const parsed = importProfessionalIdentity(enriched)

    expect(parsed.data.schema_revision).toBe('3.1')
    expect(parsed.data.skills.groups[0]?.positioning).toBe('Primary differentiator.')
    expect(parsed.data.skills.groups[0]?.is_differentiator).toBe(true)
    expect(parsed.data.skills.groups[0]?.items[0]?.depth).toBe('expert')
    expect(parsed.data.skills.groups[0]?.items[0]?.context).toContain('Primary language')
    expect(parsed.data.skills.groups[0]?.items[0]?.context_stale).toBe(true)
    expect(parsed.data.skills.groups[0]?.items[0]?.positioning).toContain('List first')
    expect(parsed.data.skills.groups[0]?.items[0]?.positioning_stale).toBe(true)
    expect(parsed.data.skills.groups[0]?.items[0]?.enriched_by).toBe('user-edited-llm')
    expect(parsed.data.skills.groups[1]?.items[0]?.depth).toBe('avoid')
    expect(parsed.data.preferences.constraints?.clearance?.status).toBe('none')
    expect(parsed.data.preferences.matching?.avoid[0]?.severity).toBe('hard')
    expect(parsed.data.search_vectors?.[0]?.id).toBe('v1-security-platform')
    expect(parsed.data.awareness?.open_questions[0]?.id).toBe('degree-filter-risk')
  })

  it('bridges identity.json into the current resume data model', () => {
    const parsed = importResumeConfig(JSON.stringify(baseIdentityFixture), 'json')

    expect(parsed.sourceKind).toBe('professional-identity-v3')
    expect(parsed.data.meta.name).toBe('Nicholas Crew Ferguson')
    expect(parsed.data.generation).toEqual({
      mode: 'single',
      vectorMode: 'manual',
      source: 'identity',
      pipelineEntryId: null,
      presetId: null,
      variantId: null,
      variantLabel: '',
      primaryVectorId: 'identity-default',
      vectorIds: ['identity-default'],
      suggestedVectorIds: [],
    })
    expect(parsed.data.vectors).toEqual([
      {
        id: 'identity-default',
        label: 'Identity Default',
        color: '#2563EB',
      },
    ])
    expect(parsed.data.target_lines[0]?.text).toBe('Product Engineer')
    expect(parsed.data.roles[0]?.bullets[0]?.label).toBe('Unlocked deployment flexibility')
    expect(parsed.data.roles[0]?.bullets[0]?.text).toBe(
      'Legacy cloud-only architecture limited deployment options. Rebuilt the product as a standalone edge sensor. Product deployable anywhere.',
    )
    expect(parsed.data.skill_groups[0]?.content).toBe('TypeScript, Python')
    expect(
      parsed.warnings.some((warning) =>
        warning.includes('without configured search vectors'),
      ),
    ).toBe(true)
  })

  it('derives first-class resume vectors and identity-backed priorities from search_vectors', () => {
    const enriched = clone(baseIdentityFixture)
    enriched.search_vectors = [
      {
        id: 'platform-builder',
        title: 'Platform Builder',
        priority: 'high',
        thesis: 'Platform systems with strong delivery leverage.',
        target_roles: ['Platform Engineer'],
        keywords: {
          primary: ['platform'],
          secondary: ['typescript'],
        },
        supporting_skills: ['sg-languages'],
        supporting_bullets: ['a10-delivery'],
        evidence: ['proj-facet'],
      },
      {
        id: 'documentation-lead',
        title: 'Documentation Lead',
        priority: 'medium',
        thesis: 'Technical writing and developer education.',
        target_roles: ['Technical Writer'],
        keywords: {
          primary: ['documentation'],
          secondary: ['writing'],
        },
        supporting_skills: ['sg-practices'],
      },
    ]

    const adapted = professionalIdentityToResumeData(enriched)

    expect(adapted.data.vectors).toEqual([
      {
        id: 'platform-builder',
        label: 'Platform Builder',
        color: '#2563EB',
      },
      {
        id: 'documentation-lead',
        label: 'Documentation Lead',
        color: '#0D9488',
      },
    ])
    expect(adapted.data.generation).toEqual({
      mode: 'multi-vector',
      vectorMode: 'manual',
      source: 'identity',
      pipelineEntryId: null,
      presetId: null,
      variantId: null,
      variantLabel: '',
      primaryVectorId: 'platform-builder',
      vectorIds: ['platform-builder', 'documentation-lead'],
      suggestedVectorIds: [],
    })
    expect(adapted.data.target_lines[0]).toMatchObject({
      text: 'Product Engineer',
      variants: {
        'platform-builder': 'Platform Builder',
        'documentation-lead': 'Documentation Lead',
      },
    })
    expect(adapted.data.profiles[0]?.vectors).toEqual({
      'platform-builder': 'include',
    })
    expect(adapted.data.skill_groups[0]?.vectors).toEqual({
      'platform-builder': { priority: 'include', order: 1 },
      'documentation-lead': { priority: 'exclude', order: 1 },
    })
    expect(adapted.data.skill_groups[1]?.vectors).toEqual({
      'platform-builder': { priority: 'exclude', order: 2 },
      'documentation-lead': { priority: 'include', order: 2 },
    })
    expect(adapted.data.roles[0]?.vectors).toEqual({
      'platform-builder': 'include',
    })
    expect(adapted.data.roles[0]?.bullets[0]?.vectors).toEqual({
      'platform-builder': 'include',
    })
    expect(adapted.data.projects[0]?.vectors).toEqual({
      'platform-builder': 'include',
    })
    expect(adapted.warnings.some((warning) => warning.includes('identity-derived vectors'))).toBe(true)
  })

  it('falls back unmatched content to the primary vector instead of broadcasting to all vectors', () => {
    const enriched = clone(baseIdentityFixture)
    enriched.search_vectors = [
      {
        id: 'platform-builder',
        title: 'Platform Builder',
        priority: 'high',
        thesis: 'Platform systems with strong delivery leverage.',
        target_roles: ['Platform Engineer'],
        keywords: {
          primary: ['platform'],
          secondary: ['typescript'],
        },
        supporting_skills: ['sg-languages'],
      },
      {
        id: 'documentation-lead',
        title: 'Documentation Lead',
        priority: 'medium',
        thesis: 'Technical writing and developer education.',
        target_roles: ['Technical Writer'],
        keywords: {
          primary: ['documentation'],
          secondary: ['writing'],
        },
        supporting_skills: ['sg-practices'],
      },
    ]
    enriched.projects.push({
      id: 'proj-unmatched',
      name: 'Cross-Team Operations',
      description: 'Kept the release train moving.',
      portfolio_dive: 'General operational support without a vector-specific signal.',
      tags: ['operations'],
    })

    const adapted = professionalIdentityToResumeData(enriched)

    expect(adapted.data.projects.at(-1)?.vectors).toEqual({
      'platform-builder': 'include',
    })
  })

  it('safely matches aliases with regex metacharacters and deduplicates repeated vector ids', () => {
    const enriched = clone(baseIdentityFixture)
    enriched.search_vectors = [
      {
        id: 'brace-vector',
        title: 'Platform {Builder}',
        priority: 'high',
        thesis: 'Platform {Builder} narratives.',
        target_roles: ['Platform {Builder}'],
        keywords: {
          primary: ['platform {builder}'],
          secondary: [],
        },
        supporting_skills: ['sg-languages'],
      },
      {
        id: 'brace-vector',
        title: 'Duplicate vector',
        priority: 'low',
        thesis: 'Should be ignored.',
        target_roles: ['Duplicate role'],
        keywords: {
          primary: ['duplicate'],
          secondary: [],
        },
      },
    ]
    enriched.profiles[0] = {
      ...enriched.profiles[0],
      text: 'Platform {Builder} shipping systems with confidence.',
    }

    const adapted = professionalIdentityToResumeData(enriched)

    expect(adapted.data.vectors).toEqual([
      {
        id: 'brace-vector',
        label: 'Platform {Builder}',
        color: '#2563EB',
      },
    ])
    expect(adapted.data.generation).toMatchObject({
      mode: 'single',
      primaryVectorId: 'brace-vector',
      vectorIds: ['brace-vector'],
    })
    expect(adapted.data.profiles[0]?.vectors).toEqual({
      'brace-vector': 'include',
    })
    expect(
      adapted.warnings.some((warning) =>
        warning.includes('Ignored duplicate identity search vector "brace-vector"'),
      ),
    ).toBe(true)
  })

  it('imports legacy search_signal data as positioning', () => {
    const legacy = clone(baseIdentityFixture) as typeof baseIdentityFixture & {
      skills: {
        groups: Array<{
          items: Array<Record<string, unknown>>
        }>
      }
    }
    legacy.skills.groups[0]!.items[0] = {
      ...legacy.skills.groups[0]!.items[0],
      search_signal: 'Strong match signal. List first.',
    }

    const parsed = importProfessionalIdentity(legacy)

    expect(parsed.data.skills.groups[0]?.items[0]?.positioning).toBe('Strong match signal. List first.')
  })

  it('rejects unsupported schema versions', () => {
    const invalid = clone(baseIdentityFixture)
    invalid.version = 2 as 3

    expect(() => importProfessionalIdentity(invalid)).toThrow(/version must be 3/i)
  })

  it('rejects missing required identity fields', () => {
    const invalid = clone(baseIdentityFixture)
    delete (invalid.identity as unknown as Record<string, unknown>).name

    expect(() => importProfessionalIdentity(invalid)).toThrow(/identity.name/)
  })

  it('rejects duplicate role ids', () => {
    const invalid = clone(baseIdentityFixture)
    invalid.roles.push(clone(baseIdentityFixture.roles[0]))

    expect(() => importProfessionalIdentity(invalid)).toThrow(/duplicate id/i)
  })

  it('rejects duplicate matching ids', () => {
    const invalid = clone(baseIdentityFixture)
    invalid.schema_revision = '3.1'
    invalid.preferences.matching = {
      prioritize: [
        {
          id: 'builder-friendly',
          label: 'Builder-friendly',
          description: 'Builder-friendly',
          weight: 'high',
        },
        {
          id: 'builder-friendly',
          label: 'Builder-friendly duplicate',
          description: 'Builder-friendly duplicate',
          weight: 'medium',
        },
      ],
      avoid: [],
    }

    expect(() => importProfessionalIdentity(invalid)).toThrow(/preferences\.matching\.prioritize has duplicate id/i)
  })

  it('rejects duplicate search vector ids', () => {
    const invalid = clone(baseIdentityFixture)
    invalid.schema_revision = '3.1'
    invalid.search_vectors = [
      {
        id: 'v1-security-platform',
        title: 'Security Platform Engineer',
        priority: 'high',
        thesis: 'Vector one.',
        target_roles: ['Platform Engineer'],
        keywords: { primary: ['security'], secondary: [] },
      },
      {
        id: 'v1-security-platform',
        title: 'Security Platform Engineer duplicate',
        priority: 'medium',
        thesis: 'Vector two.',
        target_roles: ['Security Engineer'],
        keywords: { primary: ['security'], secondary: [] },
      },
    ]

    expect(() => importProfessionalIdentity(invalid)).toThrow(/search_vectors has duplicate id/i)
  })

  it('rejects duplicate awareness ids', () => {
    const invalid = clone(baseIdentityFixture)
    invalid.schema_revision = '3.1'
    invalid.awareness = {
      open_questions: [
        {
          id: 'degree-filter-risk',
          topic: 'Degree filter risk',
          description: 'One.',
          action: 'Check requirements.',
        },
        {
          id: 'degree-filter-risk',
          topic: 'Duplicate degree filter risk',
          description: 'Two.',
          action: 'Check requirements again.',
        },
      ],
    }

    expect(() => importProfessionalIdentity(invalid)).toThrow(/awareness\.open_questions has duplicate id/i)
  })

  it('rejects duplicate bullet ids across different roles', () => {
    const invalid = clone(baseIdentityFixture)
    invalid.roles.push({
      id: 'threatx',
      company: 'ThreatX',
      subtitle: '(acquired by A10 Networks)',
      title: 'Senior Platform Engineer',
      dates: 'Jan 2022 – Feb 2025',
      portfolio_anchor: '#background',
      bullets: [
        {
          id: 'a10-delivery',
          problem: 'Repeated id in another role.',
          action: 'This should fail validation.',
          outcome: 'Parser should reject duplicate ids.',
          impact: ['Reject duplicate ids'],
          metrics: {},
          technologies: ['TypeScript'],
          portfolio_dive: '#duplicate',
          tags: ['platform'],
        },
      ],
    })

    expect(() => importProfessionalIdentity(invalid)).toThrow(/duplicate id/i)
  })

  it('does not confuse resume configs for professional identity files', () => {
    expect(looksLikeProfessionalIdentity(defaultResumeData)).toBe(false)
  })

  it('handles identity files with optional fields omitted', () => {
    const minimal = clone(baseIdentityFixture)
    delete (minimal.identity as unknown as Record<string, unknown>).display_name
    delete (minimal.identity as unknown as Record<string, unknown>).title
    delete (minimal.identity as unknown as Record<string, unknown>).elaboration
    delete (minimal.identity as unknown as Record<string, unknown>).origin
    delete (minimal.skills.groups[0]?.items[0] as unknown as Record<string, unknown>).depth
    delete (minimal.roles[0] as unknown as Record<string, unknown>).subtitle
    delete (minimal.roles[0] as unknown as Record<string, unknown>).portfolio_anchor
    delete (minimal.roles[0]?.bullets[0] as unknown as Record<string, unknown>).portfolio_dive
    delete (minimal.projects[0] as unknown as Record<string, unknown>).url
    delete (minimal.projects[0] as unknown as Record<string, unknown>).portfolio_dive
    delete (minimal.education[0] as unknown as Record<string, unknown>).year

    const parsed = importResumeConfig(JSON.stringify(minimal), 'json')

    expect(parsed.sourceKind).toBe('professional-identity-v3')
    expect(parsed.data.meta.name).toBe('Nicholas Ferguson')
    expect(parsed.data.target_lines[0]?.text).toBe('I solve business problems with computers.')
    expect(parsed.data.projects[0]?.url).toBeUndefined()
    expect(parsed.data.education[0]?.id).toBe('edu-st-petersburg-college-aas-computer-information-systems-clearwater-fl')
  })

  it('supports sparse sections and stable deduplicated education ids', () => {
    const sparse = clone(baseIdentityFixture)
    sparse.profiles = []
    sparse.roles = []
    sparse.projects = []
    sparse.education = [
      clone(baseIdentityFixture.education[0]),
      clone(baseIdentityFixture.education[0]),
    ]

    const parsed = importResumeConfig(JSON.stringify(sparse), 'json')

    expect(parsed.sourceKind).toBe('professional-identity-v3')
    expect(parsed.data.profiles).toEqual([])
    expect(parsed.data.roles).toEqual([])
    expect(parsed.data.projects).toEqual([])
    expect(parsed.data.education.map((entry) => entry.id)).toEqual([
      'edu-st-petersburg-college-aas-computer-information-systems-clearwater-fl',
      'edu-st-petersburg-college-aas-computer-information-systems-clearwater-fl--2',
    ])
  })

  it('rejects prototype pollution keys in identity input', () => {
    const polluted = clone(baseIdentityFixture) as unknown as Record<string, unknown>
    Object.defineProperty(polluted, '__proto__', {
      value: { polluted: true },
      enumerable: true,
      configurable: true,
    })

    expect(() => importProfessionalIdentity(polluted)).toThrow(/unsupported key/i)
  })

  it('trims empty bullet fragments when adapting bullet text', () => {
    const sparseBullet = clone(baseIdentityFixture)
    sparseBullet.roles[0].bullets[0].problem = '   '

    const parsed = importResumeConfig(JSON.stringify(sparseBullet), 'json')

    expect(parsed.sourceKind).toBe('professional-identity-v3')
    expect(parsed.data.roles[0]?.bullets[0]?.text).toBe(
      'Rebuilt the product as a standalone edge sensor. Product deployable anywhere.',
    )
  })

  it('falls back to source_text when decomposed fields are still empty', () => {
    const scannedBullet = clone(baseIdentityFixture)
    scannedBullet.roles[0].bullets[0].problem = ''
    scannedBullet.roles[0].bullets[0].action = ''
    scannedBullet.roles[0].bullets[0].outcome = ''
    scannedBullet.roles[0].bullets[0].impact = []
    scannedBullet.roles[0].bullets[0].source_text =
      'Ported the platform to Kubernetes-based installs for on-prem customer environments.'

    const parsed = importResumeConfig(JSON.stringify(scannedBullet), 'json')

    expect(parsed.data.roles[0]?.bullets[0]?.label).toBe(
      'Ported the platform to Kubernetes-based installs for on-prem customer environments.',
    )
    expect(parsed.data.roles[0]?.bullets[0]?.text).toBe(
      'Ported the platform to Kubernetes-based installs for on-prem customer environments.',
    )
  })

  it('accepts new semantic skill depth levels', () => {
    const enriched = clone(baseIdentityFixture)
    enriched.skills.groups[0].items = [
      { name: 'Python', depth: 'expert', tags: ['backend'] },
      { name: 'Rust', depth: 'hands-on-working', tags: ['systems'] },
      { name: 'Kubernetes', depth: 'architectural', tags: ['platform'] },
      { name: 'Go', depth: 'conceptual', tags: ['backend'] },
      { name: 'Docker', depth: 'strong', tags: ['devops'] },
      { name: 'Bash', depth: 'working', tags: ['scripting'] },
      { name: 'React', depth: 'basic', tags: ['frontend'] },
      { name: 'Jenkins', depth: 'avoid', tags: ['ci'] },
    ]

    const { data: parsed } = importProfessionalIdentity(enriched)
    const items = parsed.skills.groups[0].items

    expect(items[0].depth).toBe('expert')
    expect(items[1].depth).toBe('hands-on-working')
    expect(items[2].depth).toBe('architectural')
    expect(items[3].depth).toBe('conceptual')
    expect(items[4].depth).toBe('strong')
    expect(items[5].depth).toBe('working')
    expect(items[6].depth).toBe('basic')
    expect(items[7].depth).toBe('avoid')
  })

  it('accepts calibration field on skill groups', () => {
    const enriched = clone(baseIdentityFixture)
    enriched.skills.groups[0].calibration =
      'Not a traditional security engineer. Strength is building security platforms.'

    const { data: parsed } = importProfessionalIdentity(enriched)

    expect(parsed.skills.groups[0].calibration).toBe(
      'Not a traditional security engineer. Strength is building security platforms.',
    )
  })

  it('omits calibration when not provided', () => {
    const { data: parsed } = importProfessionalIdentity(clone(baseIdentityFixture))

    expect(parsed.skills.groups[0].calibration).toBeUndefined()
  })

  it('accepts conditional severity and condition on matching avoid filters', () => {
    const enriched = clone(baseIdentityFixture)
    enriched.preferences.matching.avoid = [
      {
        id: 'k8s-admin',
        label: 'Kubernetes admin roles',
        description: 'Do not want to be the K8s person',
        severity: 'conditional',
        condition: 'building around k8s is fine, being a k8s admin is not',
      },
    ]

    const { data: parsed } = importProfessionalIdentity(enriched)
    const avoid = parsed.preferences.matching.avoid[0]

    expect(avoid.severity).toBe('conditional')
    expect(avoid.condition).toBe('building around k8s is fine, being a k8s admin is not')
  })

  it('accepts condition on matching prioritize filters', () => {
    const enriched = clone(baseIdentityFixture)
    enriched.preferences.matching.prioritize = [
      {
        id: 'builder-friendly',
        label: 'Builder-friendly interviews',
        description: 'Take-homes, portfolio reviews',
        weight: 'high',
        condition: 'especially paid work trials',
      },
    ]

    const { data: parsed } = importProfessionalIdentity(enriched)
    const prioritize = parsed.preferences.matching.prioritize[0]

    expect(prioritize.weight).toBe('high')
    expect(prioritize.condition).toBe('especially paid work trials')
  })

  it('omits condition when not provided on matching filters', () => {
    const { data: parsed } = importProfessionalIdentity(clone(baseIdentityFixture))

    expect(parsed.preferences.matching.avoid[0].condition).toBeUndefined()
    expect(parsed.preferences.matching.prioritize[0].condition).toBeUndefined()
  })

  it('preserves backward compatibility with hard and soft severity values', () => {
    const enriched = clone(baseIdentityFixture)
    enriched.preferences.matching.avoid = [
      { id: 'clearance', label: 'Security clearance', description: 'No clearance', severity: 'hard' },
      { id: 'jenkins', label: 'Jenkins roles', description: 'Avoid', severity: 'soft' },
    ]

    const { data: parsed } = importProfessionalIdentity(enriched)

    expect(parsed.preferences.matching.avoid[0].severity).toBe('hard')
    expect(parsed.preferences.matching.avoid[1].severity).toBe('soft')
  })
})
