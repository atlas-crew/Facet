import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('../utils/llmProxy', async () => {
  const actual = await vi.importActual<typeof import('../utils/llmProxy')>(
    '../utils/llmProxy',
  )

  return {
    ...actual,
    callLlmProxy: vi.fn(),
  }
})

import { importProfessionalIdentity } from '../identity/schema'
import {
  BULLET_DEEPENING_SYSTEM_PROMPT,
  EXTRACTION_SYSTEM_PROMPT,
  buildDeepenBulletPrompt,
  deepenIdentityBullet,
  parseDeepenIdentityBulletResponse,
  parseIdentityExtractionResponse,
} from '../utils/identityExtraction'
import { callLlmProxy } from '../utils/llmProxy'

const responseIdentityResult = importProfessionalIdentity({
  $schema: 'https://atlascrew.dev/schemas/identity.json',
  version: 3,
  schema_revision: '3.1',
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
    philosophy: [{ id: 'boring-systems', text: 'Prefer boring systems that fail well.', tags: ['platform'] }],
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
    matching: {
      prioritize: [
        {
          id: 'platform-priority',
          label: 'platform',
          description: 'platform',
          weight: 'medium',
        },
      ],
      avoid: [
        {
          id: 'bait-and-switch',
          label: 'bait-and-switch',
          description: 'bait-and-switch',
          severity: 'soft',
        },
      ],
    },
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
        {
          id: 'acme-2',
          problem: 'Teams had inconsistent release mechanics.',
          action: 'Standardized release workflows for product teams.',
          outcome: 'Reduced deployment pain across the org.',
          impact: ['Reduced friction'],
          metrics: {},
          technologies: ['GitHub Actions'],
          tags: ['platform', 'enablement'],
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

if (!responseIdentityResult.data) {
  throw new Error('identityExtraction test fixture is invalid.')
}

const responseIdentity = responseIdentityResult.data

const responseBody = {
  summary: 'Strong platform draft with one open metric question.',
  follow_up_questions: ['What was the scope of the migration?'],
  identity: responseIdentity,
}

beforeEach(() => {
  vi.mocked(callLlmProxy).mockReset()
})

const cloneIdentityAsRecord = (): Record<string, unknown> =>
  structuredClone(responseBody.identity) as unknown as Record<string, unknown>

const cloneNativeV31ExtractionIdentity = (): Record<string, unknown> => {
  const identity = cloneIdentityAsRecord()
  identity.schema_revision = '3.1'
  identity.search_vectors = []
  identity.awareness = { open_questions: [] }
  const preferences = identity.preferences as Record<string, unknown>
  delete preferences.role_fit
  preferences.matching = { prioritize: [], avoid: [] }
  preferences.constraints = {}
  return identity
}

describe('identityExtraction', () => {
  it('exports v3.1 extraction prompts without legacy role_fit guidance', () => {
    expect(EXTRACTION_SYSTEM_PROMPT).toContain('Professional Identity Schema v3.1')
    expect(EXTRACTION_SYSTEM_PROMPT).not.toContain('"role_fit"')
    expect(EXTRACTION_SYSTEM_PROMPT).toContain('"schema_revision": "3.1"')
    expect(EXTRACTION_SYSTEM_PROMPT).toContain('"matching": {')
    expect(EXTRACTION_SYSTEM_PROMPT).toContain('"prioritize": [{ "id": string, "label": string, "description": string, "weight": "high" | "medium" | "low" }]')
    expect(EXTRACTION_SYSTEM_PROMPT).toContain('"avoid": [{ "id": string, "label": string, "description": string, "severity": "hard" | "soft" }]')
    expect(EXTRACTION_SYSTEM_PROMPT).toContain('"search_vectors": []')
    expect(EXTRACTION_SYSTEM_PROMPT).toContain('"awareness": { "open_questions": [] }')
    expect(BULLET_DEEPENING_SYSTEM_PROMPT).toContain('Professional Identity Schema v3.1')
  })

  it('parses extraction output and backfills bullets that were not annotated', () => {
    const parsed = parseIdentityExtractionResponse(
      JSON.stringify({
        ...responseBody,
        bullets: [
          {
            role_id: 'acme',
            bullet_id: 'acme-1',
            rewrite: 'Led platform migration [scope: guessing] to a unified deployment workflow with org-wide adoption.',
            tags: ['platform', 'delivery', 'platform'],
            assumptions: [{ label: 'scope', confidence: 'guessing' }],
          },
          {
            role_id: 'missing',
            bullet_id: 'ghost',
            rewrite: 'Ignore me',
            tags: ['ghost'],
            assumptions: [],
          },
        ],
      }),
    )

    expect(parsed.summary).toContain('Strong platform draft')
    expect(parsed.followUpQuestions).toEqual(['What was the scope of the migration?'])
    expect(parsed.bullets).toHaveLength(2)
    expect(parsed.bullets[0]?.assumptions).toEqual([{ label: 'scope', confidence: 'guessing' }])
    expect(parsed.bullets[0]?.tags).toEqual(['platform', 'delivery'])
    expect(parsed.bullets[1]?.bulletId).toBe('acme-2')
    expect(parsed.bullets[1]?.rewrite).toBe(
      'Teams had inconsistent release mechanics. Standardized release workflows for product teams. Reduced deployment pain across the org.',
    )
    expect(parsed.bullets[1]?.assumptions).toEqual([])
    expect(parsed.warnings.some((warning) => warning.includes('unknown bullet'))).toBe(true)
  })

  it('rejects invalid confidence labels', () => {
    expect(() =>
      parseIdentityExtractionResponse(
        JSON.stringify({
          ...responseBody,
          bullets: [
            {
              role_id: 'acme',
              bullet_id: 'acme-1',
              rewrite: 'Invalid confidence label',
              tags: ['platform'],
              assumptions: [{ label: 'scope', confidence: 'maybe' }],
            },
          ],
        }),
      ),
    ).toThrow(/must be one of stated, confirmed, guessing, corrected/)
  })

  it('repairs minor JSON syntax issues before validation', () => {
    const malformed = `{
      "summary": "Strong platform draft with one open metric question.",
      "follow_up_questions": [
        "What was the scope of the migration?"
        "How many pipelines were involved?"
      ],
      "identity": ${JSON.stringify(responseBody.identity, null, 2)},
      "bullets": []
    }`

    const parsed = parseIdentityExtractionResponse(malformed)

    expect(parsed.followUpQuestions).toEqual([
      'What was the scope of the migration?',
      'How many pipelines were involved?',
    ])
    expect(parsed.warnings).toContain(
      'Repaired minor JSON syntax issues in the AI response before validation.',
    )
  })

  it('normalizes generator_rules when the AI returns a string', () => {
    const parsed = parseIdentityExtractionResponse(
      JSON.stringify({
        ...responseBody,
        identity: {
          ...responseBody.identity,
          generator_rules: 'nick-default',
        },
      }),
    )

    expect(parsed.identity.generator_rules).toEqual({
      voice_skill: 'nick-default',
      resume_skill: 'nick-default',
    })
    expect(parsed.warnings).toContain(
      'Normalized generator_rules from a string into { voice_skill, resume_skill } for AI extraction output.',
    )
  })

  it('adds default generator_rules when the AI omits them', () => {
    const identityWithoutGeneratorRules = cloneIdentityAsRecord()
    delete identityWithoutGeneratorRules.generator_rules

    const parsed = parseIdentityExtractionResponse(
      JSON.stringify({
        ...responseBody,
        identity: identityWithoutGeneratorRules,
      }),
    )

    expect(parsed.identity.generator_rules).toEqual({
      voice_skill: '',
      resume_skill: '',
    })
    expect(parsed.warnings).toContain(
      'Added missing generator_rules object with empty defaults for AI extraction output.',
    )
  })

  it('normalizes bullet technologies when the AI returns a string', () => {
    const malformedIdentity = cloneIdentityAsRecord()
    const roles = malformedIdentity.roles as Array<Record<string, unknown>>
    const bullets = roles[0]?.bullets as Array<Record<string, unknown>>
    bullets[1] = {
      ...bullets[1],
      technologies: 'GitHub Actions, Terraform',
    }

    const parsed = parseIdentityExtractionResponse(
      JSON.stringify({
        ...responseBody,
        identity: malformedIdentity,
      }),
    )

    expect(parsed.identity.roles[0]?.bullets[1]?.technologies).toEqual([
      'GitHub Actions',
      'Terraform',
    ])
    expect(parsed.warnings).toContain(
      'Normalized roles[0].bullets[1].technologies from a string into a string array for AI extraction output.',
    )
  })

  it('normalizes bullet tags when the AI returns a string', () => {
    const malformedIdentity = cloneIdentityAsRecord()
    const roles = malformedIdentity.roles as Array<Record<string, unknown>>
    const bullets = roles[0]?.bullets as Array<Record<string, unknown>>
    bullets[1] = {
      ...bullets[1],
      tags: 'Platform, Delivery',
    }

    const parsed = parseIdentityExtractionResponse(
      JSON.stringify({
        ...responseBody,
        identity: malformedIdentity,
      }),
    )

    expect(parsed.identity.roles[0]?.bullets[1]?.tags).toEqual(['platform', 'delivery'])
    expect(parsed.warnings).toContain(
      'Normalized roles[0].bullets[1].tags from a string into a string array for AI extraction output.',
    )
  })

  it('normalizes mixed bullet tag arrays without failing extraction', () => {
    const malformedIdentity = cloneIdentityAsRecord()
    const roles = malformedIdentity.roles as Array<Record<string, unknown>>
    const bullets = roles[0]?.bullets as Array<Record<string, unknown>>
    bullets[1] = {
      ...bullets[1],
      tags: ['Platform', 2024, { invalid: true }, false],
    }

    const parsed = parseIdentityExtractionResponse(
      JSON.stringify({
        ...responseBody,
        identity: malformedIdentity,
      }),
    )

    expect(parsed.identity.roles[0]?.bullets[1]?.tags).toEqual(['platform', '2024', 'false'])
    expect(parsed.warnings).toContain(
      'Normalized roles[0].bullets[1].tags[1] into a string for AI extraction output.',
    )
    expect(parsed.warnings).toContain(
      'Dropped invalid roles[0].bullets[1].tags[2] entry for AI extraction output.',
    )
  })

  it('normalizes mixed technology arrays without failing extraction', () => {
    const malformedIdentity = cloneIdentityAsRecord()
    const roles = malformedIdentity.roles as Array<Record<string, unknown>>
    const bullets = roles[0]?.bullets as Array<Record<string, unknown>>
    bullets[1] = {
      ...bullets[1],
      technologies: ['GitHub Actions', 2024, { invalid: true }, false],
    }

    const parsed = parseIdentityExtractionResponse(
      JSON.stringify({
        ...responseBody,
        identity: malformedIdentity,
      }),
    )

    expect(parsed.identity.roles[0]?.bullets[1]?.technologies).toEqual([
      'GitHub Actions',
      '2024',
      'false',
    ])
    expect(parsed.warnings).toContain(
      'Normalized roles[0].bullets[1].technologies[1] into a string for AI extraction output.',
    )
    expect(parsed.warnings).toContain(
      'Dropped invalid roles[0].bullets[1].technologies[2] entry for AI extraction output.',
    )
  })

  it('normalizes projects when the AI returns a single object', () => {
    const malformedIdentity = cloneIdentityAsRecord()
    const firstProject = (malformedIdentity.projects as Array<Record<string, unknown>>)[0]
    malformedIdentity.projects = firstProject

    const parsed = parseIdentityExtractionResponse(
      JSON.stringify({
        ...responseBody,
        identity: malformedIdentity,
      }),
    )

    expect(parsed.identity.projects).toHaveLength(1)
    expect(parsed.identity.projects[0]).toEqual({
      id: 'facet',
      name: 'Facet',
      description: 'Resume and identity tooling.',
      tags: ['career-tools'],
    })
    expect(parsed.warnings).toContain(
      'Normalized projects from an object into a single-item array for AI extraction output.',
    )
  })

  it('normalizes education when the AI returns a single object', () => {
    const malformedIdentity = cloneIdentityAsRecord()
    const firstEducation = (malformedIdentity.education as Array<Record<string, unknown>>)[0]
    malformedIdentity.education = firstEducation

    const parsed = parseIdentityExtractionResponse(
      JSON.stringify({
        ...responseBody,
        identity: malformedIdentity,
      }),
    )

    expect(parsed.identity.education).toHaveLength(1)
    expect(parsed.identity.education[0]).toEqual({
      school: 'State College',
      location: 'Florida',
      degree: 'B.S. Computer Science',
      year: '2018',
    })
    expect(parsed.warnings).toContain(
      'Normalized education from an object into a single-item array for AI extraction output.',
    )
  })

  it('accepts native v3.1 extraction payloads without legacy warnings', () => {
    const identity = cloneNativeV31ExtractionIdentity()
    ;(identity.preferences as Record<string, unknown>).matching = {
      prioritize: [
        {
          id: 'prioritize-platform',
          label: 'Platform leadership',
          description: 'Platform leadership',
          weight: 'high',
        },
      ],
      avoid: [
        {
          id: 'avoid-onsite',
          label: 'Onsite-only',
          description: 'Onsite-only',
          severity: 'hard',
        },
      ],
    }

    const parsed = parseIdentityExtractionResponse(
      JSON.stringify({
        ...responseBody,
        identity,
        bullets: [],
      }),
    )

    expect(parsed.identity.schema_revision).toBe('3.1')
    expect(parsed.identity.preferences.matching).toEqual({
      prioritize: [
        {
          id: 'prioritize-platform',
          label: 'Platform leadership',
          description: 'Platform leadership',
          weight: 'high',
        },
      ],
      avoid: [
        {
          id: 'avoid-onsite',
          label: 'Onsite-only',
          description: 'Onsite-only',
          severity: 'hard',
        },
      ],
    })
    expect(parsed.identity.preferences.constraints).toEqual({})
    expect('role_fit' in (parsed.identity.preferences as unknown as Record<string, unknown>)).toBe(false)
    expect(parsed.identity.search_vectors).toEqual([])
    expect(parsed.identity.awareness).toEqual({ open_questions: [] })
    expect(parsed.warnings.some((warning) => warning.includes('role_fit'))).toBe(false)
    expect(parsed.warnings.some((warning) => warning.includes('schema_revision'))).toBe(false)
  })

  it('drops legacy role_fit instead of deriving matching from it', () => {
    const malformedIdentity = cloneNativeV31ExtractionIdentity()
    delete malformedIdentity.schema_revision
    delete malformedIdentity.search_vectors
    malformedIdentity.awareness = 'unknown'
    const preferences = malformedIdentity.preferences as Record<string, unknown>
    preferences.role_fit = {
      ideal: ['platform'],
      red_flags: ['bait-and-switch'],
      evaluation_criteria: ['scope'],
    }
    preferences.matching = { prioritize: 'platform-first', avoid: null }
    preferences.constraints = 'unknown'

    const parsed = parseIdentityExtractionResponse(
      JSON.stringify({
        ...responseBody,
        identity: malformedIdentity,
        bullets: [],
      }),
    )

    expect(parsed.identity.schema_revision).toBe('3.1')
    expect(parsed.identity.preferences.matching).toEqual({ prioritize: [], avoid: [] })
    expect(parsed.identity.preferences.constraints).toEqual({})
    expect('role_fit' in (parsed.identity.preferences as unknown as Record<string, unknown>)).toBe(false)
    expect(parsed.identity.search_vectors).toEqual([])
    expect(parsed.identity.awareness).toEqual({ open_questions: [] })
    expect(parsed.warnings).toContain('Added missing schema_revision "3.1" for AI extraction output.')
    expect(parsed.warnings).toContain(
      'Dropped legacy preferences.role_fit from AI extraction output before schema import.',
    )
    expect(parsed.warnings).toContain(
      'Normalized invalid preferences.matching.prioritize into an empty array for AI extraction output.',
    )
    expect(parsed.warnings).toContain(
      'Normalized invalid preferences.matching.avoid into an empty array for AI extraction output.',
    )
    expect(parsed.warnings.some((warning) => warning.includes('Derived missing preferences.matching entries from legacy preferences.role_fit values'))).toBe(false)
  })

  it('sanitizes partial matching rows instead of dropping the whole array', () => {
    const malformedIdentity = cloneNativeV31ExtractionIdentity()
    const preferences = malformedIdentity.preferences as Record<string, unknown>
    preferences.matching = {
      prioritize: [
        {
          label: 'Platform leadership',
          description: 'Drive platform strategy.',
        },
        {
          id: 'invalid-priority',
          description: 'Missing label should be dropped.',
          weight: 'high',
        },
      ],
      avoid: [
        {
          label: 'Onsite-only',
          description: 'Avoid strict onsite expectations.',
        },
      ],
    }

    const parsed = parseIdentityExtractionResponse(
      JSON.stringify({
        ...responseBody,
        identity: malformedIdentity,
        bullets: [],
      }),
    )

    expect(parsed.identity.preferences.matching).toEqual({
      prioritize: [
        {
          id: 'prioritize-platform-leadership',
          label: 'Platform leadership',
          description: 'Drive platform strategy.',
          weight: 'medium',
        },
      ],
      avoid: [
        {
          id: 'avoid-onsite-only',
          label: 'Onsite-only',
          description: 'Avoid strict onsite expectations.',
          severity: 'soft',
        },
      ],
    })
    expect(parsed.warnings).toContain(
      'Derived missing preferences.matching.prioritize[0].id for AI extraction output.',
    )
    expect(parsed.warnings).toContain(
      'Normalized invalid preferences.matching.prioritize[0].weight to "medium" for AI extraction output.',
    )
    expect(parsed.warnings).toContain(
      'Dropped invalid preferences.matching.prioritize[1] entry for AI extraction output.',
    )
    expect(parsed.warnings).toContain(
      'Derived missing preferences.matching.avoid[0].id for AI extraction output.',
    )
    expect(parsed.warnings).toContain(
      'Normalized invalid preferences.matching.avoid[0].severity to "soft" for AI extraction output.',
    )
  })

  it('adds a missing preferences object with empty v3.1 defaults', () => {
    const malformedIdentity = cloneNativeV31ExtractionIdentity()
    delete malformedIdentity.preferences

    const parsed = parseIdentityExtractionResponse(
      JSON.stringify({
        ...responseBody,
        identity: malformedIdentity,
        bullets: [],
      }),
    )

    expect(parsed.identity.preferences.compensation.priorities).toEqual([])
    expect(parsed.identity.preferences.work_model.preference).toBe('')
    expect(parsed.identity.preferences.matching).toEqual({ prioritize: [], avoid: [] })
    expect(parsed.identity.preferences.constraints).toEqual({})
    expect('role_fit' in (parsed.identity.preferences as unknown as Record<string, unknown>)).toBe(false)
    expect(parsed.warnings).toContain(
      'Added missing preferences object with empty v3.1 defaults for AI extraction output.',
    )
    expect(parsed.warnings).toContain(
      'Added missing preferences.compensation object with empty priorities for AI extraction output.',
    )
    expect(parsed.warnings).toContain(
      'Added missing preferences.work_model object with an empty preference for AI extraction output.',
    )
  })

  it('filters malformed search_vectors and awareness entries before import', () => {
    const malformedIdentity = cloneNativeV31ExtractionIdentity()
    malformedIdentity.search_vectors = [
      {
        title: 'Platform leadership',
        thesis: 'Position for platform leadership roles.',
        target_roles: ['Platform Director', 2026],
        keywords: {
          primary: ['platform', true],
          secondary: ['leadership'],
        },
      },
      {
        id: 'bad-vector',
        thesis: 'Missing title should be dropped.',
      },
    ]
    malformedIdentity.awareness = {
      open_questions: [
        {
          topic: 'Scope calibration',
          description: 'Need a tighter scope example.',
          action: 'Collect one quantified migration story.',
          severity: 'medium',
        },
        {
          id: 'bad-question',
          description: 'Missing topic should be dropped.',
          action: 'Ignore me.',
        },
      ],
    }

    const parsed = parseIdentityExtractionResponse(
      JSON.stringify({
        ...responseBody,
        identity: malformedIdentity,
        bullets: [],
      }),
    )

    expect(parsed.identity.search_vectors).toEqual([
      {
        id: 'search-vector-platform-leadership',
        title: 'Platform leadership',
        priority: 'medium',
        thesis: 'Position for platform leadership roles.',
        target_roles: ['Platform Director', '2026'],
        keywords: {
          primary: ['platform', 'true'],
          secondary: ['leadership'],
        },
      },
    ])
    expect(parsed.identity.awareness).toEqual({
      open_questions: [
        {
          id: 'open-question-scope-calibration',
          topic: 'Scope calibration',
          description: 'Need a tighter scope example.',
          action: 'Collect one quantified migration story.',
          severity: 'medium',
        },
      ],
    })
    expect(parsed.warnings).toContain(
      'Derived missing search_vectors[0].id for AI extraction output.',
    )
    expect(parsed.warnings).toContain(
      'Normalized invalid search_vectors[0].priority to "medium" for AI extraction output.',
    )
    expect(parsed.warnings).toContain(
      'Normalized search_vectors[0].target_roles[1] into a string for AI extraction output.',
    )
    expect(parsed.warnings).toContain(
      'Normalized search_vectors[0].keywords.primary[1] into a string for AI extraction output.',
    )
    expect(parsed.warnings).toContain(
      'Dropped invalid search_vectors[1] entry for AI extraction output.',
    )
    expect(parsed.warnings).toContain(
      'Derived missing awareness.open_questions[0].id for AI extraction output.',
    )
    expect(parsed.warnings).toContain(
      'Dropped invalid awareness.open_questions[1] entry for AI extraction output.',
    )
  })
})

describe('identity bullet deepening', () => {
  it('builds a prompt that preserves named technologies and metrics from source_text', () => {
    const prompt = buildDeepenBulletPrompt({
      identity: responseBody.identity,
      roleId: 'acme',
      bulletId: 'acme-1',
      correctionNotes: 'Keep the exact platform names.',
    })

    expect(prompt).toContain('Scanned identity shell:')
    expect(prompt).toContain('"role_id": "acme"')
    expect(prompt).toContain('"bullet_id": "acme-1"')
    expect(prompt).toContain('Keep the exact platform names.')
  })

  it('parses a deepened bullet and preserves exact technologies and metrics', () => {
    const parsed = parseDeepenIdentityBulletResponse(
      JSON.stringify({
        summary: 'Deepened the deployment migration bullet.',
        bullet: {
          role_id: 'acme',
          bullet_id: 'acme-1',
          problem: 'Deployment workflow was fragmented across EKS clusters.',
          action: 'Led a migration to EKS with Helm charts and Terraform modules.',
          outcome: 'Teams shipped through one deployment workflow.',
          impact: ['Standardized delivery across 12 pipelines'],
          metrics: { pipelines: 12, latency_reduction: '18%' },
          technologies: ['EKS', 'Helm', 'Terraform'],
          tags: ['platform', 'delivery', 'platform'],
          rewrite:
            'Led a migration to EKS with Helm charts and Terraform modules, standardizing delivery across 12 pipelines.',
          assumptions: [{ label: 'scope', confidence: 'stated' }],
        },
      }),
      responseBody.identity,
    )

    expect(parsed.summary).toBe('Deepened the deployment migration bullet.')
    expect(parsed.roleId).toBe('acme')
    expect(parsed.bulletId).toBe('acme-1')
    expect(parsed.bullet.source_text).toBeUndefined()
    expect(parsed.bullet.technologies).toEqual(['EKS', 'Helm', 'Terraform'])
    expect(parsed.bullet.metrics).toEqual({ pipelines: 12, latency_reduction: '18%' })
    expect(parsed.bullet.tags).toEqual(['platform', 'delivery'])
    expect(parsed.assumptions).toEqual([{ label: 'scope', confidence: 'stated' }])
  })

  it('rejects a deepened bullet when metrics contain nested objects', () => {
    expect(() =>
      parseDeepenIdentityBulletResponse(
        JSON.stringify({
          summary: 'Invalid bullet payload.',
          bullet: {
            role_id: 'acme',
            bullet_id: 'acme-1',
            problem: 'Deployment workflow was fragmented.',
            action: 'Led platform migration.',
            outcome: 'Standardized delivery.',
            impact: ['Standardized delivery'],
            metrics: { pipelines: { count: 12 } },
            technologies: ['Terraform'],
            tags: ['platform'],
            rewrite: 'Led platform migration.',
            assumptions: [],
          },
        }),
        responseBody.identity,
      ),
    ).toThrow(/bullet.metrics.pipelines must be a string, number, or boolean/)
  })

  it('surfaces technology normalization warnings for deepened bullets', () => {
    const parsed = parseDeepenIdentityBulletResponse(
      JSON.stringify({
        summary: 'Deepened the deployment migration bullet.',
        bullet: {
          role_id: 'acme',
          bullet_id: 'acme-1',
          problem: 'Deployment workflow was fragmented across EKS clusters.',
          action: 'Led a migration to EKS with Helm charts and Terraform modules.',
          outcome: 'Teams shipped through one deployment workflow.',
          impact: ['Standardized delivery across 12 pipelines'],
          metrics: { pipelines: 12 },
          technologies: 'EKS, Helm, Terraform',
          tags: ['platform', 'delivery'],
          rewrite:
            'Led a migration to EKS with Helm charts and Terraform modules, standardizing delivery across 12 pipelines.',
          assumptions: [],
        },
      }),
      responseBody.identity,
    )

    expect(parsed.bullet.technologies).toEqual(['EKS', 'Helm', 'Terraform'])
    expect(parsed.warnings).toContain(
      'Normalized bullet.technologies from a string into a string array for AI extraction output.',
    )
  })

  it('normalizes deepened bullet tags when the AI returns a string', () => {
    const parsed = parseDeepenIdentityBulletResponse(
      JSON.stringify({
        summary: 'Deepened the deployment migration bullet.',
        bullet: {
          role_id: 'acme',
          bullet_id: 'acme-1',
          problem: 'Deployment workflow was fragmented across EKS clusters.',
          action: 'Led a migration to EKS with Helm charts and Terraform modules.',
          outcome: 'Teams shipped through one deployment workflow.',
          impact: ['Standardized delivery across 12 pipelines'],
          metrics: { pipelines: 12 },
          technologies: ['EKS', 'Helm', 'Terraform'],
          tags: 'Platform, Delivery',
          rewrite:
            'Led a migration to EKS with Helm charts and Terraform modules, standardizing delivery across 12 pipelines.',
          assumptions: [],
        },
      }),
      responseBody.identity,
    )

    expect(parsed.bullet.tags).toEqual(['platform', 'delivery'])
    expect(parsed.warnings).toContain(
      'Normalized bullet.tags from a string into a string array for AI extraction output.',
    )
  })

  it('accepts an existing identity whose schema_revision was persisted as a number', () => {
    const identity = structuredClone(responseBody.identity) as unknown as Record<string, unknown>
    identity.schema_revision = 3.1

    const parsed = parseDeepenIdentityBulletResponse(
      JSON.stringify({
        summary: 'Deepened the deployment migration bullet.',
        bullet: {
          role_id: 'acme',
          bullet_id: 'acme-1',
          problem: 'Deployment workflow was fragmented across EKS clusters.',
          action: 'Led a migration to EKS with Helm charts and Terraform modules.',
          outcome: 'Teams shipped through one deployment workflow.',
          impact: ['Standardized delivery across 12 pipelines'],
          metrics: { pipelines: 12 },
          technologies: ['EKS', 'Helm', 'Terraform'],
          tags: ['platform', 'delivery'],
          rewrite:
            'Led a migration to EKS with Helm charts and Terraform modules, standardizing delivery across 12 pipelines.',
          assumptions: [],
        },
      }),
      identity as unknown as typeof responseBody.identity,
    )

    expect(parsed.bulletId).toBe('acme-1')
    expect(parsed.bullet.tags).toEqual(['platform', 'delivery'])
  })

  it('normalizes numeric schema_revision values before sending a deepen request', async () => {
    const identity = structuredClone(responseBody.identity) as unknown as Record<
      string,
      unknown
    >
    identity.schema_revision = 3.1
    vi.mocked(callLlmProxy).mockResolvedValueOnce(
      JSON.stringify({
        summary: 'Deepened the deployment migration bullet.',
        bullet: {
          role_id: 'acme',
          bullet_id: 'acme-1',
          problem: 'Deployment workflow was fragmented across EKS clusters.',
          action:
            'Led a migration to EKS with Helm charts and Terraform modules.',
          outcome: 'Teams shipped through one deployment workflow.',
          impact: ['Standardized delivery across 12 pipelines'],
          metrics: { pipelines: 12 },
          technologies: ['EKS', 'Helm', 'Terraform'],
          tags: ['platform', 'delivery'],
          rewrite:
            'Led a migration to EKS with Helm charts and Terraform modules, standardizing delivery across 12 pipelines.',
          assumptions: [],
        },
      }),
    )

    await expect(
      deepenIdentityBullet({
        endpoint: 'https://facet.test/api/ai',
        identity: identity as unknown as typeof responseBody.identity,
        roleId: 'acme',
        bulletId: 'acme-1',
      }),
    ).resolves.toMatchObject({
      roleId: 'acme',
      bulletId: 'acme-1',
    })

    const prompt = vi.mocked(callLlmProxy).mock.calls[0]?.[2]
    expect(prompt).toContain('"schema_revision": "3.1"')
    expect(prompt).not.toContain('"schema_revision": 3.1')
  })

  it('rejects an unknown role when deepening a bullet', () => {
    expect(() =>
      parseDeepenIdentityBulletResponse(
        JSON.stringify({
          summary: 'Invalid bullet payload.',
          bullet: {
            role_id: 'missing-role',
            bullet_id: 'acme-1',
            problem: 'Deployment workflow was fragmented.',
            action: 'Led platform migration.',
            outcome: 'Standardized delivery.',
            impact: ['Standardized delivery'],
            metrics: { pipelines: 12 },
            technologies: ['Terraform'],
            tags: ['platform'],
            rewrite: 'Led platform migration.',
            assumptions: [],
          },
        }),
        responseBody.identity,
      ),
    ).toThrow(/Role "missing-role" does not exist/)
  })

  it('rejects an unknown bullet when deepening a bullet', () => {
    expect(() =>
      parseDeepenIdentityBulletResponse(
        JSON.stringify({
          summary: 'Invalid bullet payload.',
          bullet: {
            role_id: 'acme',
            bullet_id: 'missing-bullet',
            problem: 'Deployment workflow was fragmented.',
            action: 'Led platform migration.',
            outcome: 'Standardized delivery.',
            impact: ['Standardized delivery'],
            metrics: { pipelines: 12 },
            technologies: ['Terraform'],
            tags: ['platform'],
            rewrite: 'Led platform migration.',
            assumptions: [],
          },
        }),
        responseBody.identity,
      ),
    ).toThrow(/Bullet "missing-bullet" does not exist in role "acme"/)
  })

  it('rejects unparseable deepening JSON with a clear error', () => {
    expect(() => parseDeepenIdentityBulletResponse('{', responseBody.identity)).toThrow(
      /Identity bullet deepening response/,
    )
  })

})
