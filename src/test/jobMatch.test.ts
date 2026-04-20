import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ProfessionalIdentityV3 } from '../identity/schema'
import {
  adaptVectorAwareMatchToReport,
  analyzeIdentityJobMatch,
  createMatchHistoryEntry,
  composeVectorAwareMatchResult,
  createJobMatchReport,
  normalizeFilterAwarenessPayload,
  normalizeSkillMatchPayload,
  normalizeVectorMatchPayload,
  parseJdMatchExtractionResponse,
  prepareMatchJobDescription,
  runHardFilters,
} from '../utils/jobMatch'

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
      base_floor: 220000,
      priorities: [{ item: 'base', weight: 'high' }],
    },
    work_model: {
      preference: 'remote',
      hard_no: 'five days onsite',
    },
    constraints: {
      clearance: {
        status: 'none',
        exclude_required: true,
      },
    },
    matching: {
      prioritize: [
        {
          id: 'platform-ownership',
          label: 'Platform ownership',
          description: 'The role owns platform architecture and delivery systems.',
          weight: 'high',
        },
      ],
      avoid: [
        {
          id: 'onsite-only',
          label: 'Onsite-only expectation',
          description: 'The role requires five days onsite.',
          severity: 'hard',
        },
        {
          id: 'legacy-only',
          label: 'Legacy-only maintenance',
          description: 'The role is mostly legacy maintenance.',
          severity: 'soft',
        },
      ],
    },
  },
  skills: {
    groups: [
      {
        id: 'platform',
        label: 'Platform',
        items: [
          {
            name: 'Kubernetes',
            depth: 'strong',
            positioning: 'Lead with Kubernetes platform migration stories.',
            tags: ['platform', 'kubernetes', 'infrastructure'],
          },
          { name: 'Terraform', depth: 'working', tags: ['terraform', 'infrastructure'] },
          { name: 'Linux', depth: 'strong', tags: ['linux', 'systems'] },
          { name: 'COBOL', depth: 'avoid', tags: ['legacy', 'cobol'] },
        ],
      },
    ],
  },
  profiles: [
    {
      id: 'platform-profile',
      tags: ['platform', 'pm-communication', 'tradeoffs'],
      text: 'I work with PMs and engineers to make infrastructure tradeoffs legible.',
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
          action: 'Ported the platform to Kubernetes-based on-prem installs with Terraform-backed infrastructure.',
          outcome: 'Made the product deployable in customer environments.',
          impact: ['Unlocked on-prem delivery'],
          metrics: { services_ported: 12 },
          technologies: ['Kubernetes', 'Terraform'],
          tags: ['platform', 'kubernetes', 'migration', 'infrastructure'],
        },
        {
          id: 'kernel-debug',
          problem: 'Edge deployments were failing under Linux networking constraints.',
          action: 'Debugged low-level Linux behavior and packet handling issues in production-like environments.',
          outcome: 'Stabilized the sensor runtime.',
          impact: ['Resolved Linux edge instability'],
          metrics: { incidents_resolved: 4 },
          technologies: ['Linux'],
          tags: ['linux', 'debugging', 'systems'],
        },
      ],
    },
  ],
  projects: [
    {
      id: 'obs',
      name: 'Observability Console',
      description: 'Built Grafana-based visibility for platform teams.',
      tags: ['observability', 'platform', 'grafana'],
    },
  ],
  education: [],
  generator_rules: {
    voice_skill: 'nick-voice',
    resume_skill: 'nick-resume',
  },
  search_vectors: [
    {
      id: 'platform-lead',
      title: 'Platform lead',
      priority: 'high',
      thesis: 'Platform ownership and reliability leadership.',
      target_roles: ['staff platform engineer'],
      keywords: {
        primary: ['platform', 'reliability'],
        secondary: ['kubernetes', 'terraform'],
      },
      supporting_skills: ['Kubernetes', 'Terraform'],
    },
    {
      id: 'debugger',
      title: 'Systems debugger',
      priority: 'low',
      thesis: 'Kernel-adjacent debugging in production.',
      target_roles: ['systems engineer'],
      keywords: {
        primary: ['linux', 'debugging'],
        secondary: ['kernel'],
      },
      supporting_skills: ['Linux'],
    },
  ],
  awareness: {
    open_questions: [
      {
        id: 'ai-depth',
        topic: 'AI depth',
        description: 'The identity does not show deep AI platform work yet.',
        action: 'Do not over-claim AI depth.',
        severity: 'medium',
      },
    ],
  },
}

afterEach(() => {
  vi.restoreAllMocks()
})

const buildPrepared = (content: string) => prepareMatchJobDescription(content)

const buildExtraction = () => ({
  summary: 'Platform-heavy role with systems work and one AI gap.',
  company: 'Atlas',
  role: 'Staff Platform Engineer',
  requirements: [
    {
      id: 'platform-delivery',
      label: 'Platform delivery',
      priority: 'core' as const,
      evidence: 'Own Kubernetes and Terraform-backed delivery systems.',
      tags: ['platform', 'kubernetes', 'infrastructure'],
      keywords: ['Kubernetes', 'Terraform'],
    },
    {
      id: 'linux-debugging',
      label: 'Linux debugging',
      priority: 'important' as const,
      evidence: 'Debug Linux and kernel-adjacent production issues.',
      tags: ['linux', 'debugging', 'systems'],
      keywords: ['Linux', 'kernel'],
    },
    {
      id: 'ai-systems',
      label: 'AI systems',
      priority: 'supporting' as const,
      evidence: 'Some AI platform exposure is preferred.',
      tags: ['ai', 'machine-learning'],
      keywords: ['AI'],
    },
  ],
  advantageHypotheses: [
    {
      id: 'platform-systems-bridge',
      claim: 'You have evidence for both platform delivery and Linux debugging, which is a strong combination for this role.',
      requirementIds: ['platform-delivery', 'linux-debugging'],
    },
  ],
  positioningRecommendations: ['Lead with the on-prem platform migration and the Linux stabilization story.'],
  gapFocus: ['Do not over-claim AI depth.'],
  warnings: [],
})

const openAiEnvelope = (payload: unknown) => ({
  ok: true,
  json: async () => ({
    choices: [
      {
        message: {
          content: JSON.stringify(payload),
        },
      },
    ],
  }),
})

describe('jobMatch', () => {
  it('parses structured JD match output from fenced JSON', () => {
    const parsed = parseJdMatchExtractionResponse(`\`\`\`json
{
  "summary": "Strong platform fit with explicit Linux debugging requirements.",
  "company": "Atlas",
  "role": "Staff Platform Engineer",
  "requirements": [
    {
      "id": "platform-delivery",
      "label": "Platform delivery",
      "priority": "core",
      "evidence": "The JD needs someone to own deployment platforms.",
      "tags": ["platform", "kubernetes", "infrastructure"],
      "keywords": ["Kubernetes", "Terraform"]
    }
  ],
  "advantage_hypotheses": [
    {
      "id": "platform-and-systems",
      "claim": "The candidate can bridge platform architecture and low-level operations.",
      "requirement_ids": ["platform-delivery"]
    }
  ],
  "positioning_recommendations": ["Lead with platform migration stories."],
  "gap_focus": ["Call out on-call ownership explicitly."],
  "warnings": []
}
\`\`\``)

    expect(parsed.company).toBe('Atlas')
    expect(parsed.requirements[0]?.tags).toEqual(['platform', 'kubernetes', 'infrastructure'])
    expect(parsed.advantageHypotheses[0]?.requirementIds).toEqual(['platform-delivery'])
  })

  it('parses structured JD match output from raw JSON', () => {
    const parsed = parseJdMatchExtractionResponse(
      JSON.stringify({
        summary: 'Platform-heavy role.',
        company: 'Atlas',
        role: 'Platform Engineer',
        requirements: [
          {
            id: 'platform-delivery',
            label: 'Platform delivery',
            priority: 'core',
            evidence: 'Own the internal platform.',
            tags: ['platform'],
            keywords: ['platform'],
          },
        ],
        advantage_hypotheses: [],
        positioning_recommendations: [],
        gap_focus: [],
        warnings: [],
      }),
    )

    expect(parsed.summary).toBe('Platform-heavy role.')
    expect(parsed.requirements).toHaveLength(1)
  })

  it('throws when the JD extraction payload is malformed', () => {
    expect(() => parseJdMatchExtractionResponse('not-json')).toThrow()
    expect(() =>
      parseJdMatchExtractionResponse(
        JSON.stringify({
          summary: 'Broken payload.',
          company: 'Atlas',
          role: 'Platform Engineer',
          requirements: [
            {
              id: 'broken',
              label: 'Broken requirement',
              priority: 'mandatory',
              evidence: 'Broken evidence.',
              tags: ['platform'],
              keywords: ['platform'],
            },
          ],
          advantage_hypotheses: [],
          positioning_recommendations: [],
          gap_focus: [],
          warnings: [],
        }),
      ),
    ).toThrow()
    expect(() =>
      normalizeVectorMatchPayload({
        rawResponse: 'not-json',
        vectors: identityFixture.search_vectors ?? [],
        prepared: buildPrepared('Platform delivery'),
      }),
    ).toThrow()
    expect(() =>
      normalizeSkillMatchPayload({
        rawResponse: 'not-json',
        candidates: [],
      }),
    ).toThrow()
    expect(() =>
      normalizeFilterAwarenessPayload({
        rawResponse: 'not-json',
        identity: identityFixture,
      }),
    ).toThrow()
  })

  it('scores identity assets and surfaces gaps and advantages', () => {
    const report = createJobMatchReport({
      identity: identityFixture,
      prepared: prepareMatchJobDescription('Need a platform engineer with Kubernetes, Terraform, Linux debugging, and AI experience.'),
      extraction: buildExtraction(),
    })

    expect(report.company).toBe('Atlas')
    expect(report.matchScore).toBeGreaterThan(0.5)
    expect(report.topBullets[0]?.id).toBe('platform-migration')
    expect(report.topSkills.some((asset) => asset.label === 'Kubernetes')).toBe(true)
    expect(report.gaps.some((gap) => gap.requirementId === 'ai-systems')).toBe(true)
    expect(report.advantages[0]?.evidence.length).toBeGreaterThan(0)
    expect(report.requirements.find((entry) => entry.id === 'platform-delivery')?.coverageScore).toBeGreaterThan(0.6)
  })

  it('truncates long job descriptions and propagates truncation warnings', () => {
    const longDescription = Array.from({ length: 1205 }, (_, index) => 'word-' + index).join(' ')
    const prepared = prepareMatchJobDescription(longDescription)
    const report = createJobMatchReport({
      identity: identityFixture,
      prepared,
      extraction: buildExtraction(),
    })

    expect(prepared.wordCount).toBe(1205)
    expect(prepared.content.split(/\s+/)).toHaveLength(1200)
    expect(prepared.truncated).toBe(true)
    expect(report.warnings.some((warning) => warning.includes('Job description exceeded 1200 words'))).toBe(
      true,
    )
  })

  it('triggers a hard avoid filter when the JD matches a hard-no description', () => {
    const result = runHardFilters(
      identityFixture,
      buildPrepared('Staff engineer role that requires five days onsite with platform ownership.'),
    )

    expect(result.filterOut).toBe(true)
    expect(result.triggeredAvoid[0]?.filterId).toBe('onsite-only')
    expect(result.watchOuts[0]?.severity).toBe('hard')
  })

  it('triggers a clearance hard filter when clearance is excluded', () => {
    const result = runHardFilters(
      identityFixture,
      buildPrepared('Requires active TS/SCI clearance and platform operations leadership.'),
    )

    expect(result.filterOut).toBe(true)
    expect(result.watchOuts.some((watchOut) => watchOut.referenceId === 'clearance-required')).toBe(true)
  })

  it('triggers a comp-floor hard filter when the salary range is too low', () => {
    const result = runHardFilters(
      identityFixture,
      buildPrepared('Base salary range is $180,000-$190,000 with staff-level platform ownership.'),
    )

    expect(result.filterOut).toBe(true)
    expect(result.watchOuts.some((watchOut) => watchOut.referenceId === 'comp-floor')).toBe(true)
  })

  it('ignores unrelated bare numbers when evaluating compensation filters', () => {
    const result = runHardFilters(
      identityFixture,
      buildPrepared('Join a Fortune 500 team of 150 engineers. Base salary range is $180k to $190k.'),
    )

    expect(result.filterOut).toBe(true)
    expect(result.watchOuts.some((watchOut) => watchOut.referenceId === 'comp-floor')).toBe(true)
  })

  it('parses unformatted salary numbers without inflating them', () => {
    const result = runHardFilters(
      identityFixture,
      buildPrepared('Base salary is USD 50000 for this staff platform role.'),
    )

    expect(result.filterOut).toBe(true)
    expect(result.watchOuts.some((watchOut) => watchOut.referenceId === 'comp-floor')).toBe(true)
  })

  it('normalizes vector matches, drops unknown ids, and caps low-priority vectors', () => {
    const normalized = normalizeVectorMatchPayload({
      rawResponse: JSON.stringify({
        vector_matches: [
          {
            vector_id: 'missing-vector',
            match_strength: 'strong',
            evidence: ['invented evidence'],
            thesis_applies: true,
            thesis_fit_explanation: 'Ignore me.',
          },
          {
            vector_id: 'debugger',
            match_strength: 'strong',
            evidence: ['Debug Linux and kernel-adjacent production issues.'],
            thesis_applies: true,
            thesis_fit_explanation: 'The JD explicitly calls for Linux debugging.',
          },
        ],
      }),
      vectors: identityFixture.search_vectors ?? [],
      prepared: buildPrepared('Need someone to debug Linux and kernel-adjacent production issues.'),
    })

    expect(normalized.warnings).toContain('Dropped unknown vector match id: missing-vector.')
    expect(normalized.matchedVectors[0]?.vectorId).toBe('debugger')
    expect(normalized.matchedVectors[0]?.matchStrength).toBe('moderate')
    expect(normalized.matchedVectors[0]?.evidence[0]).toContain('Linux')
  })

  it('normalizes skill matches, preserves avoid skills, and falls back for partial enrichment', () => {
    const normalized = normalizeSkillMatchPayload({
      rawResponse: JSON.stringify({
        skill_matches: [
          {
            skill_name: 'COBOL',
            jd_requirement: 'Legacy modernization experience is required.',
            presentation_guidance: 'Do not center COBOL; redirect to migration patterns.',
          },
          {
            skill_name: 'Unknown',
            jd_requirement: 'Ignore',
            presentation_guidance: 'Ignore',
          },
        ],
      }),
      candidates: [
        {
          name: 'COBOL',
          groupLabel: 'Platform',
          item: { name: 'COBOL', depth: 'avoid', tags: ['legacy', 'cobol'] },
          relatedRequirements: [buildExtraction().requirements[0]!],
          requirementStrength: 'required',
        },
        {
          name: 'Terraform',
          groupLabel: 'Platform',
          item: { name: 'Terraform', depth: 'working', tags: ['terraform'] },
          relatedRequirements: [buildExtraction().requirements[0]!],
          requirementStrength: 'required',
        },
      ],
    })

    expect(normalized.warnings).toContain('Dropped unknown skill match: Unknown.')
    expect(normalized.skillMatches.find((entry) => entry.skillName === 'COBOL')?.matchQuality).toBe('negative')
    expect(normalized.skillMatches.find((entry) => entry.skillName === 'Terraform')?.userDepth).toBe('working')
    expect(
      normalized.skillMatches.find((entry) => entry.skillName === 'Terraform')?.presentationGuidance,
    ).toContain('working depth')
  })

  it('normalizes prioritize, avoid, and awareness hits', () => {
    const normalized = normalizeFilterAwarenessPayload({
      rawResponse: JSON.stringify({
        triggered_prioritize: [
          {
            filter_id: 'platform-ownership',
            evidence: 'Own platform architecture and delivery systems.',
          },
        ],
        triggered_avoid: [
          {
            filter_id: 'legacy-only',
            severity: 'soft',
            evidence: 'Some maintenance-only responsibilities appear in the JD.',
          },
        ],
        relevant_awareness: [
          {
            awareness_id: 'ai-depth',
            applies_because: 'The JD asks for some AI platform depth.',
          },
        ],
      }),
      identity: identityFixture,
    })

    expect(normalized.triggeredPrioritize[0]?.weight).toBe('high')
    expect(normalized.triggeredAvoid[0]?.severity).toBe('soft')
    expect(normalized.relevantAwareness[0]?.topic).toBe('AI depth')
  })

  it('composes a moderate fit with apply recommendation when vectors, skills, and filters are aligned', () => {
    const result = composeVectorAwareMatchResult({
      identity: identityFixture,
      prepared: buildPrepared('Need platform ownership, Linux debugging, and Terraform delivery.'),
      extraction: buildExtraction(),
      matchedVectors: [
        {
          vectorId: 'platform-lead',
          title: 'Platform lead',
          priority: 'high',
          matchStrength: 'strong',
          evidence: ['Own Kubernetes and Terraform-backed delivery systems.'],
          thesisApplies: true,
          thesisFitExplanation: 'Strong ownership fit.',
        },
      ],
      skillMatches: [
        {
          skillName: 'Kubernetes',
          jdRequirement: 'Own Kubernetes delivery systems.',
          requirementStrength: 'required',
          userDepth: 'strong',
          userPositioning: 'Lead with Kubernetes platform migration stories.',
          matchQuality: 'strong',
          presentationGuidance: 'Lead with Kubernetes platform migration stories.',
        },
      ],
      hardFilter: { filterOut: false, reason: null, watchOuts: [], triggeredAvoid: [], warnings: [] },
      triggeredPrioritize: [
        {
          filterId: 'platform-ownership',
          label: 'Platform ownership',
          weight: 'high',
          jdEvidence: 'Own platform architecture and delivery systems.',
        },
      ],
      triggeredAvoid: [],
      relevantAwareness: [],
      rationale: 'Strong platform angle with clear evidence.',
      warnings: [],
    })

    expect(result.fitScore).toBeGreaterThan(0.78)
    expect(result.overallFit).toBe('strong')
    expect(result.recommendation).toBe('apply')
    expect(result.confidence).toBe('medium')
  })

  it('forces filter-out composition when a hard filter triggers', () => {
    const result = composeVectorAwareMatchResult({
      identity: identityFixture,
      prepared: buildPrepared('Requires five days onsite.'),
      extraction: buildExtraction(),
      matchedVectors: [],
      skillMatches: [],
      hardFilter: {
        filterOut: true,
        reason: 'JD appears to match the work-model hard-no preference.',
        watchOuts: [
          {
            type: 'filter_risk',
            referenceId: 'work-model-hard-no',
            description: 'JD appears to match the work-model hard-no preference.',
            severity: 'hard',
            suggestedAction: 'Skip unless the work model can be negotiated.',
          },
        ],
        triggeredAvoid: [],
        warnings: ['Work model hard-no triggered a hard filter.'],
      },
      triggeredPrioritize: [],
      triggeredAvoid: [],
      relevantAwareness: [],
      rationale: 'Skip this opportunity.',
      warnings: ['Work model hard-no triggered a hard filter.'],
    })

    expect(result.fitScore).toBe(0.05)
    expect(result.overallFit).toBe('filter-out')
    expect(result.recommendation).toBe('skip')
    expect(result.confidence).toBe('high')
  })

  it('allows a strong fit without configured search vectors when skill evidence is strong', () => {
    const identityWithoutVectors = {
      ...identityFixture,
      search_vectors: [],
    }
    const result = composeVectorAwareMatchResult({
      identity: identityWithoutVectors,
      prepared: buildPrepared('Need platform ownership and Linux debugging.'),
      extraction: buildExtraction(),
      matchedVectors: [],
      skillMatches: [
        {
          skillName: 'Kubernetes',
          jdRequirement: 'Own Kubernetes delivery systems.',
          requirementStrength: 'required',
          userDepth: 'strong',
          userPositioning: 'Lead with Kubernetes platform migration stories.',
          matchQuality: 'strong',
          presentationGuidance: 'Lead with Kubernetes platform migration stories.',
        },
        {
          skillName: 'Linux',
          jdRequirement: 'Debug Linux systems.',
          requirementStrength: 'required',
          userDepth: 'strong',
          userPositioning: '',
          matchQuality: 'strong',
          presentationGuidance: 'Lead with Linux debugging examples.',
        },
      ],
      hardFilter: { filterOut: false, reason: null, watchOuts: [], triggeredAvoid: [], warnings: [] },
      triggeredPrioritize: [
        {
          filterId: 'platform-ownership',
          label: 'Platform ownership',
          weight: 'high',
          jdEvidence: 'Own platform architecture and delivery systems.',
        },
      ],
      triggeredAvoid: [],
      relevantAwareness: [],
      rationale: 'Strong skill-first match.',
      warnings: ['No search vectors defined. Falling back to skill-first analysis.'],
    })

    expect(result.overallFit).toBe('strong')
    expect(result.fitScore).toBeGreaterThan(0.78)
  })

  it('adapts vector-aware analysis back into the legacy report contract', () => {
    const analysis = composeVectorAwareMatchResult({
      identity: identityFixture,
      prepared: buildPrepared('Need platform ownership, Linux debugging, and Terraform delivery.'),
      extraction: buildExtraction(),
      matchedVectors: [
        {
          vectorId: 'platform-lead',
          title: 'Platform lead',
          priority: 'high',
          matchStrength: 'strong',
          evidence: ['Own Kubernetes and Terraform-backed delivery systems.'],
          thesisApplies: true,
          thesisFitExplanation: 'Strong ownership fit.',
        },
      ],
      skillMatches: [
        {
          skillName: 'Kubernetes',
          jdRequirement: 'Own Kubernetes delivery systems.',
          requirementStrength: 'required',
          userDepth: 'strong',
          userPositioning: 'Lead with Kubernetes platform migration stories.',
          matchQuality: 'strong',
          presentationGuidance: 'Lead with Kubernetes platform migration stories.',
        },
      ],
      hardFilter: { filterOut: false, reason: null, watchOuts: [], triggeredAvoid: [], warnings: [] },
      triggeredPrioritize: [],
      triggeredAvoid: [],
      relevantAwareness: [
        {
          awarenessId: 'ai-depth',
          topic: 'AI depth',
          severity: 'medium',
          appliesBecause: 'The JD asks for some AI platform depth.',
          action: 'Do not over-claim AI depth.',
        },
      ],
      rationale: 'Strong platform angle with a modest AI caution.',
      warnings: ['No search vectors defined.'],
    })

    const report = adaptVectorAwareMatchToReport({
      identity: identityFixture,
      prepared: buildPrepared('Need platform ownership, Linux debugging, and Terraform delivery.'),
      extraction: buildExtraction(),
      analysis,
    })

    expect(report.matchScore).toBe(analysis.fitScore)
    expect(report.requirements.length).toBeGreaterThan(0)
    expect(report.topBullets.length).toBeGreaterThan(0)
    expect(report.positioningRecommendations.length).toBeGreaterThan(0)
    expect(report.summary).toBe('Strong platform angle with a modest AI caution.')
  })

  it('runs the full vector-aware matcher and returns both analysis and adapted report', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          openAiEnvelope({
            summary: 'Strong platform fit with some AI caveats.',
            company: 'Atlas',
            role: 'Staff Platform Engineer',
            requirements: buildExtraction().requirements,
            advantage_hypotheses: [
              {
                id: 'platform-systems-bridge',
                claim: 'Strong platform and systems overlap.',
                requirement_ids: ['platform-delivery', 'linux-debugging'],
              },
            ],
            positioning_recommendations: ['Lead with platform migration stories.'],
            gap_focus: ['Do not over-claim AI depth.'],
            warnings: [],
          }),
        )
        .mockResolvedValueOnce(
          openAiEnvelope({
            vector_matches: [
              {
                vector_id: 'platform-lead',
                match_strength: 'strong',
                evidence: ['Own Kubernetes and Terraform-backed delivery systems.'],
                thesis_applies: true,
                thesis_fit_explanation: 'The JD centers platform ownership.',
              },
            ],
          }),
        )
        .mockResolvedValueOnce(
          openAiEnvelope({
            skill_matches: [
              {
                skill_name: 'Kubernetes',
                jd_requirement: 'Own Kubernetes delivery systems.',
                presentation_guidance: 'Lead with Kubernetes platform migration stories.',
              },
            ],
          }),
        )
        .mockResolvedValueOnce(
          openAiEnvelope({
            triggered_prioritize: [
              {
                filter_id: 'platform-ownership',
                evidence: 'Own platform architecture and delivery systems.',
              },
            ],
            triggered_avoid: [],
            relevant_awareness: [
              {
                awareness_id: 'ai-depth',
                applies_because: 'The JD asks for some AI platform depth.',
              },
            ],
          }),
        )
        .mockResolvedValueOnce(
          openAiEnvelope({
            rationale: 'Strong platform fit with a modest AI caution.',
          }),
        ),
    )

    const result = await analyzeIdentityJobMatch({
      endpoint: 'https://ai.example/proxy',
      identity: identityFixture,
      jobDescription: 'Own Kubernetes and Terraform-backed delivery systems. Debug Linux and kernel-adjacent production issues. Some AI platform exposure is preferred.',
    })

    expect(result.analysis.matchedVectors[0]?.vectorId).toBe('platform-lead')
    expect(result.analysis.relevantAwareness[0]?.awarenessId).toBe('ai-depth')
    expect(result.report.matchScore).toBe(result.analysis.fitScore)
    expect(result.report.topBullets.length).toBeGreaterThan(0)
  })

  it('short-circuits after the decomposition pass when a hard filter triggers', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        openAiEnvelope({
          summary: 'Looks like a strong platform fit.',
          company: 'Atlas',
          role: 'Staff Platform Engineer',
          requirements: buildExtraction().requirements,
          advantage_hypotheses: [],
          positioning_recommendations: [],
          gap_focus: [],
          warnings: [],
        }),
      )
    vi.stubGlobal('fetch', fetchMock)

    const result = await analyzeIdentityJobMatch({
      endpoint: 'https://ai.example/proxy',
      identity: identityFixture,
      jobDescription: 'Staff platform engineer role that requires five days onsite.',
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result.analysis.overallFit).toBe('filter-out')
    expect(result.analysis.recommendation).toBe('skip')
    expect(result.report.matchScore).toBe(0.05)
  })

  it('retries transient extraction failures and succeeds on the second attempt', async () => {
    let extractionAttempts = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input, init) => {
        const payload = JSON.parse(String(init?.body ?? '{}')) as { system?: string }
        const systemPrompt = payload.system ?? ''

        if (systemPrompt.includes('Read a job description and decompose it')) {
          extractionAttempts += 1
          if (extractionAttempts === 1) {
            throw new Error('temporary extraction failure')
          }

          return openAiEnvelope({
            summary: 'Recovered extraction response.',
            company: 'Atlas',
            role: 'Staff Platform Engineer',
            requirements: buildExtraction().requirements,
            advantage_hypotheses: [],
            positioning_recommendations: [],
            gap_focus: [],
            warnings: [],
          })
        }

        if (systemPrompt.includes('filter and awareness matcher')) {
          return openAiEnvelope({
            triggered_prioritize: [],
            triggered_avoid: [],
            relevant_awareness: [],
          })
        }

        if (systemPrompt.includes('match strategist')) {
          return openAiEnvelope({
            rationale: 'Recovered after retry.',
          })
        }

        throw new Error('Unexpected prompt: ' + systemPrompt)
      }),
    )

    const result = await analyzeIdentityJobMatch({
      endpoint: 'https://ai.example/proxy',
      identity: {
        ...identityFixture,
        search_vectors: [],
        skills: { groups: [] },
      },
      jobDescription: 'Own platform delivery systems.',
    })

    expect(extractionAttempts).toBe(2)
    expect(result.analysis.rationale).toBe('Recovered after retry.')
  })

  it('returns degraded analysis with warnings when non-critical LLM passes fail', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input, init) => {
        const payload = JSON.parse(String(init?.body ?? '{}')) as { system?: string }
        const systemPrompt = payload.system ?? ''

        if (systemPrompt.includes('Read a job description and decompose it')) {
          return openAiEnvelope({
            summary: 'Strong platform fit with some AI caveats.',
            company: 'Atlas',
            role: 'Staff Platform Engineer',
            requirements: buildExtraction().requirements,
            advantage_hypotheses: [],
            positioning_recommendations: [],
            gap_focus: [],
            warnings: [],
          })
        }

        if (
          systemPrompt.includes('vector matcher') ||
          systemPrompt.includes('skill matching pass') ||
          systemPrompt.includes('filter and awareness matcher') ||
          systemPrompt.includes('match strategist')
        ) {
          throw new Error('simulated pass failure')
        }

        throw new Error('Unexpected prompt: ' + systemPrompt)
      }),
    )

    const result = await analyzeIdentityJobMatch({
      endpoint: 'https://ai.example/proxy',
      identity: identityFixture,
      jobDescription:
        'Own Kubernetes and Terraform-backed delivery systems. Debug Linux and kernel-adjacent production issues.',
    })

    expect(result.analysis.matchedVectors).toEqual([])
    expect(result.analysis.skillMatches.length).toBeGreaterThan(0)
    expect(result.analysis.warnings.some((warning) => warning.includes('Vector matching pass failed'))).toBe(true)
    expect(result.analysis.warnings.some((warning) => warning.includes('Skill matching pass failed'))).toBe(true)
    expect(result.analysis.warnings.some((warning) => warning.includes('Filter and awareness pass failed'))).toBe(true)
    expect(result.analysis.warnings.some((warning) => warning.includes('Rationale generation failed'))).toBe(true)
  })

  it('rejects when extraction retries are exhausted by an invalid schema response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        openAiEnvelope({
          summary: 'Broken extraction payload.',
          company: 'Atlas',
          role: 'Staff Platform Engineer',
          requirements: [
            {
              id: 'platform-delivery',
              label: 'Platform delivery',
              priority: 'mandatory',
              evidence: 'Own platform delivery systems.',
              tags: ['platform'],
              keywords: ['platform'],
            },
          ],
          advantage_hypotheses: [],
          positioning_recommendations: [],
          gap_focus: [],
          warnings: [],
        }),
      ),
    )

    await expect(
      analyzeIdentityJobMatch({
        endpoint: 'https://ai.example/proxy',
        identity: {
          ...identityFixture,
          search_vectors: [],
          skills: { groups: [] },
        },
        jobDescription: 'Own platform delivery systems.',
      }),
    ).rejects.toThrow()
  })

  it('creates a compact match history entry from a report', () => {
    const report = createJobMatchReport({
      identity: identityFixture,
      prepared: buildPrepared('Need platform ownership, Linux debugging, and Terraform delivery.'),
      extraction: buildExtraction(),
    })

    const entry = createMatchHistoryEntry(report)

    expect(entry.company).toBe(report.company)
    expect(entry.role).toBe(report.role)
    expect(entry.gapCount).toBe(report.gaps.length)
    expect(entry.requirementCount).toBe(report.requirements.length)
  })
})
