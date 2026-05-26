import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { generateCoverLetter, refineCoverLetterParagraph } from '../utils/coverLetterGenerator'
import { defaultResumeData } from '../store/defaultData'
import { cloneIdentityFixture } from './fixtures/identityFixture'
import { JsonExtractionError } from '../utils/llmProxy'
import { untagged, untaggedNote } from '../types/audience'
import type { JDAnalysis } from '../types/jdAnalysis'
import { JD_ANALYSIS_MODEL_VERSION } from '../types/jdAnalysis'
import { applyRulesBasedAudiences, type JDAnalysisLike } from '../utils/audienceRules'

const buildCoverLetterJdAnalysis = (overrides: Partial<JDAnalysisLike> = {}): JDAnalysis => {
  const draft: JDAnalysisLike = {
    id: 'analysis-1',
    pipelineEntryId: 'pipe-1',
    jdTextHash: 'abc123',
    identityVersion: 7,
    modelVersion: JD_ANALYSIS_MODEL_VERSION,
    generatedAt: '2026-03-09T00:00:00.000Z',
    updatedAt: '2026-03-09T00:00:00.000Z',
    warnings: [untaggedNote('Internal-only calibration.')],
    company: 'Acme Corp',
    role: 'Staff Engineer',
    summary: 'Own platform reliability for distributed systems.',
    analyzedJobDescription: 'Raw JD still grounds the generated letter.',
    jobDescriptionWordCount: 7,
    jobDescriptionTruncated: false,
    requirements: [
      untagged({
        id: 'req-platform',
        label: 'Platform reliability ownership',
        priority: 'core',
        evidence: 'Job asks for distributed systems reliability.',
        tags: ['platform'],
        keywords: ['distributed systems', 'reliability'],
        coverageScore: 0.92,
        matchedAssetCount: 4,
        matchedTags: ['platform'],
      }),
    ],
    overallFit: 'strong',
    fitScore: 88,
    confidence: 'high',
    recommendation: 'apply',
    oneLineSummary: 'Strong platform match.',
    rationale: 'Candidate evidence maps to backend platform ownership.',
    matchedVectors: [],
    primaryVectorId: 'backend',
    skillMatches: [
      untagged({
        skillName: 'Distributed systems',
        jdRequirement: 'Reliability ownership',
        requirementStrength: 'required',
        userDepth: 'expert',
        userPositioning: 'Lead with reliability systems.',
        matchQuality: 'strong',
        presentationGuidance: 'Use concrete platform evidence.',
      }),
    ],
    evidenceMapping: {
      topBullets: [],
      topSkills: [],
      topProjects: [],
      topProfiles: [],
      topPhilosophy: [],
    },
    strengthsToLead: [untaggedNote('Backend platform reliability')],
    advantages: [
      untagged({
        id: 'adv-1',
        claim: 'Can own distributed platform delivery.',
        requirementIds: ['req-platform'],
        evidence: [],
      }),
    ],
    advantageHypotheses: [],
    gaps: [],
    gapFocus: [untaggedNote('Do not over-index on frontend work.')],
    watchOuts: [],
    triggeredPrioritize: [],
    triggeredAvoid: [],
    relevantAwareness: [],
    positioningRecommendations: [untaggedNote('Lead with reliability outcomes.')],
    requirementCoverageScore: 0.92,
    matchedRequirementIds: ['req-platform'],
    matchedKeywords: ['distributed systems', 'reliability'],
    ...overrides,
  }
  return applyRulesBasedAudiences(draft)
}

describe('coverLetterGenerator', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                name: 'Acme Staff Engineer Cover Letter',
                greeting: 'Dear Hiring Manager,',
                signOff: 'Sincerely,\nJane Smith',
                paragraphs: [
                  {
                    label: 'Opening',
                    text: 'I am excited to apply for the Staff Engineer role at Acme Corp.',
                  },
                  {
                    text: 'My background in backend systems and platform engineering matches the role focus.',
                  },
                ],
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

  it('normalizes a generated cover letter response', async () => {
    const result = await generateCoverLetter('https://ai.example/proxy', {
      company: 'Acme Corp',
      role: 'Staff Engineer',
      companyUrl: 'https://acme.example/jobs/1',
      skillMatch: 'distributed systems, platform',
      positioning: 'Emphasize backend platform depth.',
      notes: 'Hiring manager cares about operational excellence.',
      companyResearch: 'Acme is investing in platform reliability.',
      jobDescription: 'Build distributed systems and platform tooling.',
      resumeContext: {
        candidate: defaultResumeData.meta,
        assembled: {
          profiles: defaultResumeData.profiles,
        },
      },
    })

    expect(result).toEqual({
      name: 'Acme Staff Engineer Cover Letter',
      header: [
        'Jane Smith',
        'San Francisco, CA (Remote) | jane@example.com | 555-123-4567',
        'github: github.com/janesmith | linkedin: linkedin.com/in/janesmith',
      ].join('\n'),
      greeting: 'Dear Hiring Manager,',
      signOff: 'Sincerely,\nJane Smith',
      paragraphs: [
        {
          label: 'Opening',
          text: 'I am excited to apply for the Staff Engineer role at Acme Corp.',
        },
        {
          label: undefined,
          text: 'My background in backend systems and platform engineering matches the role focus.',
        },
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
                greeting: 'Dear Hiring Manager,',
                signOff: 'Thanks',
                paragraphs: [],
              }),
            },
          },
        ],
      }),
    }) as typeof fetch

    await expect(
      generateCoverLetter('https://ai.example/proxy', {
        company: 'Acme Corp',
        role: 'Staff Engineer',
        jobDescription: 'Build distributed systems and platform tooling.',
        resumeContext: {
          candidate: defaultResumeData.meta,
          vector: defaultResumeData.vectors[0],
          assembled: {},
        },
      }),
    ).rejects.toThrow('Cover letter response schema was invalid.')
  })

  it('tags cover-letter generation requests with the paid AI feature id', async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')

    await generateCoverLetter('https://ai.example/proxy', {
      company: 'Acme Corp',
      role: 'Staff Engineer',
      jobDescription: 'Build distributed systems and platform tooling.',
      resumeContext: {
        candidate: defaultResumeData.meta,
        vector: defaultResumeData.vectors[0],
        assembled: {},
      },
    })

    const [, init] = vi.mocked(fetch).mock.calls[0] ?? []
    expect(JSON.parse((init as RequestInit).body as string)).toEqual(
      expect.objectContaining({
        feature: 'letters.generate',
        model: 'sonnet',
        max_tokens: 8000,
        thinking_budget: 6000,
        output_config: { effort: 'high' },
      }),
    )
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 180000)
  })

  it('adds direct connector and GitLab evidence instructions to the prompt', async () => {
    await generateCoverLetter('https://ai.example/proxy', {
      company: 'GitLab',
      role: 'Staff Platform Engineer',
      companyResearch: 'GitLab is investing in enterprise platform reliability.',
      jobDescription: 'GitLab needs someone to improve developer platform reliability.',
      resumeContext: {
        candidate: defaultResumeData.meta,
        vector: defaultResumeData.vectors[0],
        assembled: {
          roles: [
            {
              company: 'Acme Corp',
              bullets: ['Built Kubernetes delivery automation.'],
            },
          ],
        },
      },
    })

    const [, init] = vi.mocked(fetch).mock.calls[0] ?? []
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.system).toContain('Avoid hedges and vague-positive connectors')
    expect(body.system).toContain('For every audited term')
    expect(body.system).toContain('Do not frame the letter around resume vectors')
    expect(body.messages[0].content).not.toContain('Target Vector:')
    expect(body.messages[0].content).toContain(
      'Experience audit (GitLab): not found in candidate evidence.',
    )
    expect(body.messages[0].content).toContain(
      'Do not imply the candidate has worked at or directly used GitLab',
    )
  })

  it('uses canonical JD analysis as the role-emphasis source when provided', async () => {
    await generateCoverLetter('https://ai.example/proxy', {
      company: 'Acme Corp',
      role: 'Staff Engineer',
      jobDescription: 'Raw JD still grounds the generated letter.',
      jdAnalysis: buildCoverLetterJdAnalysis(),
      resumeContext: {
        candidate: defaultResumeData.meta,
        vector: { id: 'backend' },
        assembled: { keep: 'Candidate evidence survives.' },
      },
    })

    const [, init] = vi.mocked(fetch).mock.calls[0] ?? []
    const body = JSON.parse((init as RequestInit).body as string)
    const prompt = body.messages[0].content as string
    expect(body.system).toContain('When canonical JD analysis is provided')
    expect(body.system).toContain('projected to audience "hiring_manager"')
    expect(body.system).toContain(
      'do not recover or infer candidate-only, recruiter-only, or internal-only material',
    )
    expect(prompt).toContain('Canonical JD Analysis:')
    expect(prompt).toContain('Audience: hiring_manager')
    expect(prompt).toContain('Own platform reliability for distributed systems.')
    expect(prompt).toContain('Platform reliability ownership')
    expect(prompt).toContain('Use concrete platform evidence.')
    expect(prompt).toContain('Can own distributed platform delivery.')
    expect(prompt).not.toContain('Lead with reliability outcomes.')
    expect(prompt).not.toContain('Do not over-index on frontend work.')
    expect(prompt).not.toContain('Internal-only calibration.')
    expect(prompt).toContain('Matched keywords: distributed systems, reliability')
    expect(prompt).toContain('Raw JD still grounds the generated letter.')
    expect(prompt).toContain('Candidate evidence survives.')
    expect(prompt).not.toMatch(/\b(?:undefined|NaN)\b/)
    expect(prompt).not.toContain('"vector"')
    expect(prompt).not.toContain('"vectorId"')
  })

  it('bounds raw job-description backstop text when canonical JD analysis is present', async () => {
    await generateCoverLetter('https://ai.example/proxy', {
      company: 'Acme Corp',
      role: 'Staff Engineer',
      jobDescription: 'A'.repeat(6100),
      jdAnalysis: buildCoverLetterJdAnalysis({
        summary: 'Use canonical role emphasis.',
        oneLineSummary: 'Strong match.',
        rationale: 'Canonical analysis covers the role.',
        requirements: [],
        skillMatches: [],
        strengthsToLead: [],
        advantages: [],
        gaps: [],
        gapFocus: [],
        watchOuts: [],
        positioningRecommendations: [],
        requirementCoverageScore: 0,
        matchedRequirementIds: [],
        matchedKeywords: [],
      }),
      resumeContext: {
        candidate: defaultResumeData.meta,
        assembled: {},
      },
    })

    const [, init] = vi.mocked(fetch).mock.calls[0] ?? []
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.messages[0].content).toContain('... (100 characters omitted)')
  })

  it('bounds raw job-description text even when canonical JD analysis is absent', async () => {
    await generateCoverLetter('https://ai.example/proxy', {
      company: 'Acme Corp',
      role: 'Staff Engineer',
      jobDescription: 'B'.repeat(12100),
      resumeContext: {
        candidate: defaultResumeData.meta,
        assembled: {},
      },
    })

    const [, init] = vi.mocked(fetch).mock.calls[0] ?? []
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.messages[0].content).toContain('... (100 characters omitted)')
  })

  it('refines a single cover letter paragraph from user feedback', async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                text: 'Rewritten paragraph lines up well with the role with concrete platform evidence.',
              }),
            },
          },
        ],
      }),
    }) as typeof fetch

    const result = await refineCoverLetterParagraph('https://ai.example/proxy', {
      variantName: 'Acme Variant',
      sectionLabel: 'Opening',
      currentParagraph: 'Original paragraph lines up well with the role.',
      userFeedback: 'Make this direct and concrete.',
      fullLetterText: 'Original paragraph lines up well with the role.',
    })

    expect(result.text).toBe(
      'Rewritten paragraph matches the role with concrete platform evidence.',
    )
    const [, init] = vi.mocked(fetch).mock.calls[0] ?? []
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.feature).toBe('letters.generate')
    expect(body.model).toBe('sonnet')
    expect(body.max_tokens).toBe(8000)
    expect(body.thinking_budget).toBe(6000)
    expect(body.output_config).toEqual({ effort: 'high' })
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 120000)
    expect(body.system).toContain('Rewrite only the requested paragraph')
    expect(body.system).toContain('do not invent employers')
    expect(body.system).toContain('Avoid vague-positive connectors')
    expect(body.messages[0].content).toContain('Variant Name: Acme Variant')
    expect(body.messages[0].content).toContain('Section Label: Opening')
    expect(body.messages[0].content).toContain(
      'Current Paragraph:\nOriginal paragraph lines up well with the role.',
    )
    expect(body.messages[0].content).toContain('Make this direct and concrete.')
    expect(body.messages[0].content).toContain(
      'Full Letter Context:\nOriginal paragraph lines up well with the role.',
    )
  })

  it('rejects paragraph refinement responses without a JSON block', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: 'not json at all',
            },
          },
        ],
      }),
    }) as typeof fetch

    await expect(
      refineCoverLetterParagraph('https://ai.example/proxy', {
        variantName: 'Acme Variant',
        sectionLabel: 'Opening',
        currentParagraph: 'Original paragraph.',
        userFeedback: 'Make this direct and concrete.',
        fullLetterText: 'Original paragraph.',
      }),
    ).rejects.toThrow(JsonExtractionError)
  })

  it('wraps malformed paragraph refinement JSON parse failures', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: '{ invalid json }',
            },
          },
        ],
      }),
    }) as typeof fetch

    await expect(
      refineCoverLetterParagraph('https://ai.example/proxy', {
        variantName: 'Acme Variant',
        sectionLabel: 'Opening',
        currentParagraph: 'Original paragraph.',
        userFeedback: 'Make this direct and concrete.',
        fullLetterText: 'Original paragraph.',
      }),
    ).rejects.toThrow('Failed to parse cover letter paragraph refinement response.')
  })

  it('rejects paragraph refinement responses with invalid schemas', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                content: 'Missing text field.',
              }),
            },
          },
        ],
      }),
    }) as typeof fetch

    await expect(
      refineCoverLetterParagraph('https://ai.example/proxy', {
        variantName: 'Acme Variant',
        sectionLabel: 'Opening',
        currentParagraph: 'Original paragraph.',
        userFeedback: 'Make this direct and concrete.',
        fullLetterText: 'Original paragraph.',
      }),
    ).rejects.toThrow('Cover letter paragraph refinement response schema was invalid.')
  })

  it('builds paragraph refinement prompts with empty inputs and the default section label', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                text: 'Fallback paragraph response.',
              }),
            },
          },
        ],
      }),
    }) as typeof fetch

    const result = await refineCoverLetterParagraph('https://ai.example/proxy', {
      variantName: '',
      currentParagraph: '',
      userFeedback: '',
      fullLetterText: '',
    })

    expect(result.text).toBe('Fallback paragraph response.')
    const [, init] = vi.mocked(fetch).mock.calls[0] ?? []
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.messages[0].content).toContain('Variant Name: \nSection Label: Paragraph')
    expect(body.messages[0].content).toContain('Current Paragraph:')
    expect(body.messages[0].content).toContain('User Refinement Notes:')
    expect(body.messages[0].content).toContain('Full Letter Context:')
    expect(body.messages[0].content).toContain('Return JSON only.')
  })

  it('rejects paragraph refinement responses with whitespace-only text', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                text: '   ',
              }),
            },
          },
        ],
      }),
    }) as typeof fetch

    await expect(
      refineCoverLetterParagraph('https://ai.example/proxy', {
        variantName: 'Acme Variant',
        currentParagraph: 'Original paragraph.',
        userFeedback: 'Make this direct and concrete.',
        fullLetterText: 'Original paragraph.',
      }),
    ).rejects.toThrow('Cover letter paragraph refinement response schema was invalid.')
  })

  it('surfaces direct GitLab experience when it exists in candidate evidence', async () => {
    await generateCoverLetter('https://ai.example/proxy', {
      company: 'Acme Corp',
      role: 'Staff Platform Engineer',
      experienceAuditTerms: ['GitLab'],
      companyResearch: 'The team uses GitLab for source control and CI.',
      jobDescription: 'Own developer tooling for GitLab-heavy workflows.',
      resumeContext: {
        candidate: defaultResumeData.meta,
        vector: defaultResumeData.vectors[0],
        assembled: {
          skillGroups: [{ label: 'Tools', content: 'GitLab CI, Kubernetes, Terraform' }],
          roles: [{ company: 'Contoso', bullets: ['Administered GitLab CI runners.'] }],
        },
      },
    })

    const [, init] = vi.mocked(fetch).mock.calls[0] ?? []
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.messages[0].content).toContain(
      'Experience audit (GitLab): candidate evidence found.',
    )
    expect(body.messages[0].content).toContain('Administered GitLab CI runners.')
    expect(body.messages[0].content).toContain(
      'Safe to claim direct experience only with this evidence',
    )
  })

  it('does not treat job context as candidate evidence when routed beside resume context', async () => {
    await generateCoverLetter('https://ai.example/proxy', {
      company: 'GitLab',
      role: 'Staff Platform Engineer',
      jobDescription: 'Own developer tooling for GitLab-heavy workflows.',
      resumeContext: {
        candidate: defaultResumeData.meta,
        vector: defaultResumeData.vectors[0],
        assembled: {
          resume: {
            roles: [{ company: 'Contoso', bullets: ['Built Kubernetes release automation.'] }],
          },
          pipelineEntry: {
            company: 'GitLab',
            role: 'Staff Platform Engineer',
            jobDescription: 'Own developer tooling for GitLab-heavy workflows.',
          },
        },
      },
    })

    const [, init] = vi.mocked(fetch).mock.calls[0] ?? []
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.messages[0].content).toContain(
      'Experience audit (GitLab): not found in candidate evidence.',
    )
  })

  it('finds audited experience nested inside the identity model', async () => {
    const identity = cloneIdentityFixture()
    identity.roles[0].bullets[0].technologies = ['Buildkite']
    identity.roles[0].bullets[0].action = 'Migrated delivery pipelines from Jenkins to Buildkite.'

    await generateCoverLetter('https://ai.example/proxy', {
      company: 'Acme Corp',
      role: 'Staff Platform Engineer',
      experienceAuditTerms: ['Buildkite'],
      jobDescription: 'Own developer tooling for Buildkite-heavy workflows.',
      resumeContext: {
        candidate: defaultResumeData.meta,
        vector: defaultResumeData.vectors[0],
        assembled: {},
        identity,
      },
    })

    const [, init] = vi.mocked(fetch).mock.calls[0] ?? []
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.messages[0].content).toContain(
      'Experience audit (Buildkite): candidate evidence found.',
    )
    expect(body.messages[0].content).toContain(
      'Migrated delivery pipelines from Jenkins to Buildkite.',
    )
  })

  it('handles circular resume context objects while collecting audit evidence', async () => {
    const assembled: Record<string, unknown> = {
      roles: [{ bullets: ['Administered GitLab CI runners.'] }],
    }
    assembled.self = assembled

    await expect(
      generateCoverLetter('https://ai.example/proxy', {
        company: 'Acme Corp',
        role: 'Staff Platform Engineer',
        experienceAuditTerms: ['GitLab'],
        jobDescription: 'Own developer tooling for GitLab-heavy workflows.',
        resumeContext: {
          candidate: defaultResumeData.meta,
          vector: defaultResumeData.vectors[0],
          assembled,
        },
      }),
    ).resolves.toEqual(expect.objectContaining({ name: 'Acme Staff Engineer Cover Letter' }))

    const [, init] = vi.mocked(fetch).mock.calls[0] ?? []
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.messages[0].content).toContain('Administered GitLab CI runners.')
    expect(body.messages[0].content).toContain('"self": "[Circular]"')
  })

  it('serializes duplicate acyclic references without marking them circular', async () => {
    const shared = { note: 'Shared GitLab delivery note.' }

    await generateCoverLetter('https://ai.example/proxy', {
      company: 'Acme Corp',
      role: 'Staff Platform Engineer',
      experienceAuditTerms: ['GitLab'],
      jobDescription: 'Own developer tooling for GitLab-heavy workflows.',
      resumeContext: {
        candidate: defaultResumeData.meta,
        vector: defaultResumeData.vectors[0],
        assembled: {
          first: shared,
          second: shared,
        },
      },
    })

    const [, init] = vi.mocked(fetch).mock.calls[0] ?? []
    const body = JSON.parse((init as RequestInit).body as string)
    const prompt = body.messages[0].content as string
    expect(prompt.match(/Shared GitLab delivery note\./g)).toHaveLength(3)
    expect(prompt).not.toContain('"second": "[Circular]"')
  })

  it('matches audited evidence case-insensitively', async () => {
    await generateCoverLetter('https://ai.example/proxy', {
      company: 'Acme Corp',
      role: 'Staff Platform Engineer',
      experienceAuditTerms: ['gitlab'],
      jobDescription: 'Own developer tooling for GitLab-heavy workflows.',
      resumeContext: {
        candidate: defaultResumeData.meta,
        vector: defaultResumeData.vectors[0],
        assembled: {
          roles: [{ company: 'Contoso', bullets: ['Administered GitLab CI runners.'] }],
        },
      },
    })

    const [, init] = vi.mocked(fetch).mock.calls[0] ?? []
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.messages[0].content).toContain(
      'Experience audit (gitlab): candidate evidence found.',
    )
    expect(body.messages[0].content).toContain('Administered GitLab CI runners.')
  })

  it('does not treat audited terms as substrings inside larger words', async () => {
    await generateCoverLetter('https://ai.example/proxy', {
      company: 'Meta',
      role: 'Staff Platform Engineer',
      jobDescription: 'Own developer tooling and infrastructure workflows.',
      resumeContext: {
        candidate: defaultResumeData.meta,
        vector: defaultResumeData.vectors[0],
        assembled: {
          roles: [{ company: 'Contoso', bullets: ['Built metadata indexing services.'] }],
        },
      },
    })

    const [, init] = vi.mocked(fetch).mock.calls[0] ?? []
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.messages[0].content).toContain(
      'Experience audit (Meta): not found in candidate evidence.',
    )
    expect(body.messages[0].content).toContain(
      'Do not imply the candidate has worked at or directly used Meta',
    )
  })

  it('matches audited terms with regex special characters as literal evidence', async () => {
    await generateCoverLetter('https://ai.example/proxy', {
      company: 'Acme Corp',
      role: 'Staff Platform Engineer',
      experienceAuditTerms: ['C++', 'Vue.js'],
      jobDescription: 'Own platform UI and systems workflows.',
      resumeContext: {
        candidate: defaultResumeData.meta,
        vector: defaultResumeData.vectors[0],
        assembled: {
          roles: [
            {
              company: 'Contoso',
              bullets: ['Wrote C++ services for ingestion.', 'Built Vue.js operations dashboards.'],
            },
          ],
        },
      },
    })

    const [, init] = vi.mocked(fetch).mock.calls[0] ?? []
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.messages[0].content).toContain('Experience audit (C++): candidate evidence found.')
    expect(body.messages[0].content).toContain('Wrote C++ services for ingestion.')
    expect(body.messages[0].content).toContain(
      'Experience audit (Vue.js): candidate evidence found.',
    )
    expect(body.messages[0].content).toContain('Built Vue.js operations dashboards.')
  })

  it('keeps standalone dotted technical skills as candidate evidence', async () => {
    await generateCoverLetter('https://ai.example/proxy', {
      company: 'Acme Corp',
      role: 'Staff Platform Engineer',
      experienceAuditTerms: ['Vue.js', 'Node.js'],
      jobDescription: 'Own platform UI and Node services.',
      resumeContext: {
        candidate: defaultResumeData.meta,
        vector: defaultResumeData.vectors[0],
        assembled: {
          skills: ['Vue.js', 'Node.js'],
        },
      },
    })

    const [, init] = vi.mocked(fetch).mock.calls[0] ?? []
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.messages[0].content).toContain(
      'Experience audit (Vue.js): candidate evidence found.',
    )
    expect(body.messages[0].content).toContain(
      'Experience audit (Node.js): candidate evidence found.',
    )
  })

  it('matches multi-word audited terms across flexible whitespace', async () => {
    await generateCoverLetter('https://ai.example/proxy', {
      company: 'Acme Corp',
      role: 'Staff Platform Engineer',
      experienceAuditTerms: ['React Native'],
      jobDescription: 'Own mobile platform workflows.',
      resumeContext: {
        candidate: defaultResumeData.meta,
        vector: defaultResumeData.vectors[0],
        assembled: {
          roles: [
            { company: 'Contoso', bullets: ['Delivered React   Native release automation.'] },
          ],
        },
      },
    })

    const [, init] = vi.mocked(fetch).mock.calls[0] ?? []
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.messages[0].content).toContain(
      'Experience audit (React Native): candidate evidence found.',
    )
    expect(body.messages[0].content).toContain('Delivered React   Native release automation.')
  })

  it('renders independent audit sections for each audited term', async () => {
    await generateCoverLetter('https://ai.example/proxy', {
      company: 'Acme Corp',
      role: 'Staff Platform Engineer',
      experienceAuditTerms: ['GitLab', 'Kubernetes'],
      jobDescription: 'Own developer tooling for GitLab and Kubernetes-heavy workflows.',
      resumeContext: {
        candidate: defaultResumeData.meta,
        vector: defaultResumeData.vectors[0],
        assembled: {
          roles: [
            { company: 'Contoso', bullets: ['Administered GitLab CI and Kubernetes clusters.'] },
          ],
        },
      },
    })

    const [, init] = vi.mocked(fetch).mock.calls[0] ?? []
    const body = JSON.parse((init as RequestInit).body as string)
    const auditSection = (body.messages[0].content as string)
      .split('Candidate Experience Audit:\n')[1]
      .split('\n\nCanonical JD Analysis:')[0]
    expect(auditSection).toContain('Experience audit (Acme Corp):')
    expect(auditSection).toContain('Experience audit (GitLab):')
    expect(auditSection).toContain('Experience audit (Kubernetes):')
  })

  it('omits empty audit terms and uses the empty-audit fallback', async () => {
    await generateCoverLetter('https://ai.example/proxy', {
      company: ' ',
      role: 'Staff Platform Engineer',
      experienceAuditTerms: [' ', ''],
      jobDescription: 'Own developer tooling workflows.',
      resumeContext: {
        candidate: defaultResumeData.meta,
        vector: defaultResumeData.vectors[0],
        assembled: {},
      },
    })

    const [, init] = vi.mocked(fetch).mock.calls[0] ?? []
    const body = JSON.parse((init as RequestInit).body as string)
    const auditSection = (body.messages[0].content as string)
      .split('Candidate Experience Audit:\n')[1]
      .split('\n\nCanonical JD Analysis:')[0]
    expect(auditSection).toBe('No audited candidate evidence found.')
    expect(auditSection).not.toContain('Experience audit ():')
  })

  it('deduplicates target company and explicit audit terms', async () => {
    await generateCoverLetter('https://ai.example/proxy', {
      company: 'GitLab',
      role: 'Staff Platform Engineer',
      experienceAuditTerms: ['GitLab'],
      jobDescription: 'Own developer tooling for GitLab-heavy workflows.',
      resumeContext: {
        candidate: defaultResumeData.meta,
        vector: defaultResumeData.vectors[0],
        assembled: {},
      },
    })

    const [, init] = vi.mocked(fetch).mock.calls[0] ?? []
    const body = JSON.parse((init as RequestInit).body as string)
    const auditSection = (body.messages[0].content as string)
      .split('Candidate Experience Audit:\n')[1]
      .split('\n\nCanonical JD Analysis:')[0]
    expect(auditSection.match(/Experience audit \(GitLab\):/g)).toHaveLength(1)
  })

  it('deduplicates audit terms case-insensitively', async () => {
    await generateCoverLetter('https://ai.example/proxy', {
      company: 'GitLab',
      role: 'Staff Platform Engineer',
      experienceAuditTerms: ['gitlab'],
      jobDescription: 'Own developer tooling for GitLab-heavy workflows.',
      resumeContext: {
        candidate: defaultResumeData.meta,
        vector: defaultResumeData.vectors[0],
        assembled: {},
      },
    })

    const [, init] = vi.mocked(fetch).mock.calls[0] ?? []
    const body = JSON.parse((init as RequestInit).body as string)
    const auditSection = (body.messages[0].content as string)
      .split('Candidate Experience Audit:\n')[1]
      .split('\n\nCanonical JD Analysis:')[0]
    expect(auditSection.match(/Experience audit \(/g)).toHaveLength(1)
    expect(auditSection).toContain('Experience audit (GitLab):')
  })

  it('limits matched evidence lines for an audited term', async () => {
    const roles = Array.from({ length: 10 }, (_, index) => ({
      company: `Company ${index + 1}`,
      bullets: [`GitLab evidence line ${index + 1}`],
    }))

    await generateCoverLetter('https://ai.example/proxy', {
      company: 'Acme Corp',
      role: 'Staff Platform Engineer',
      experienceAuditTerms: ['GitLab'],
      jobDescription: 'Own developer tooling for GitLab-heavy workflows.',
      resumeContext: {
        candidate: defaultResumeData.meta,
        vector: defaultResumeData.vectors[0],
        assembled: { roles },
      },
    })

    const [, init] = vi.mocked(fetch).mock.calls[0] ?? []
    const body = JSON.parse((init as RequestInit).body as string)
    const prompt = body.messages[0].content as string
    const auditSection = prompt
      .split('Candidate Experience Audit:\n')[1]
      .split('\n\nCanonical JD Analysis:')[0]
    expect(auditSection).toContain('GitLab evidence line 8')
    expect(auditSection).not.toContain('GitLab evidence line 9')
    expect(auditSection).not.toContain('GitLab evidence line 10')
  })

  it('does not treat URL substrings as direct audited experience', async () => {
    await generateCoverLetter('https://ai.example/proxy', {
      company: 'Acme Corp',
      role: 'Staff Platform Engineer',
      experienceAuditTerms: ['GitLab'],
      companyResearch: 'The team uses GitLab for source control and CI.',
      jobDescription: 'Own developer tooling for GitLab-heavy workflows.',
      resumeContext: {
        candidate: {
          ...defaultResumeData.meta,
          links: [{ label: 'Portfolio', url: 'https://gitlab.example.dev/work' }],
        },
        vector: defaultResumeData.vectors[0],
        assembled: {},
      },
    })

    const [, init] = vi.mocked(fetch).mock.calls[0] ?? []
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.messages[0].content).toContain(
      'Experience audit (GitLab): not found in candidate evidence.',
    )
  })

  it('does not treat contact emails or link URLs as direct audited experience', async () => {
    await generateCoverLetter('https://ai.example/proxy', {
      company: 'GitLab',
      role: 'Staff Platform Engineer',
      jobDescription: 'Own developer tooling for GitLab-heavy workflows.',
      resumeContext: {
        candidate: {
          ...defaultResumeData.meta,
          email: 'jane@gitlab.com',
          links: [{ label: 'GitLab', url: 'gitlab.com' }],
        },
        vector: defaultResumeData.vectors[0],
        assembled: {},
      },
    })

    const [, init] = vi.mocked(fetch).mock.calls[0] ?? []
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.messages[0].content).toContain(
      'Experience audit (GitLab): not found in candidate evidence.',
    )
  })

  it('rewrites generated paragraphs with vague connector phrases', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                name: 'Acme Staff Engineer Cover Letter',
                greeting: 'Dear Hiring Manager,',
                signOff: 'Sincerely,\nJane Smith',
                paragraphs: [
                  {
                    text: 'My background lines up well with the role.',
                  },
                ],
              }),
            },
          },
        ],
      }),
    }) as typeof fetch

    const result = await generateCoverLetter('https://ai.example/proxy', {
      company: 'Acme Corp',
      role: 'Staff Engineer',
      jobDescription: 'Build distributed systems and platform tooling.',
      resumeContext: {
        candidate: defaultResumeData.meta,
        vector: defaultResumeData.vectors[0],
        assembled: {},
      },
    })

    expect(result.paragraphs[0]?.text).toBe('My background matches the role.')
  })

  it('normalizes horizontal whitespace in generated paragraphs while preserving line breaks', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                name: 'Acme Staff Engineer Cover Letter',
                greeting: 'Dear Hiring Manager,',
                signOff: 'Sincerely\nJane Smith',
                paragraphs: [{ text: 'This   is\n a\t test.' }],
              }),
            },
          },
        ],
      }),
    }) as typeof fetch

    const result = await generateCoverLetter('https://ai.example/proxy', {
      company: 'Acme Corp',
      role: 'Staff Engineer',
      jobDescription: 'Build distributed systems and platform tooling.',
      resumeContext: {
        candidate: defaultResumeData.meta,
        vector: defaultResumeData.vectors[0],
        assembled: {},
      },
    })

    expect(result.paragraphs[0]?.text).toBe('This is\n a test.')
  })

  it.each([
    ['My background lines up with the role.', 'My background matches the role.'],
    [
      'I build systems that scale with the org.',
      "I build reliable systems tied to the role's concrete operating needs.",
    ],
  ])('rewrites vague connector phrase: %s', async (source, expected) => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                name: 'Acme Staff Engineer Cover Letter',
                greeting: 'Dear Hiring Manager,',
                signOff: 'Sincerely\nJane Smith',
                paragraphs: [{ text: source }],
              }),
            },
          },
        ],
      }),
    }) as typeof fetch

    const result = await generateCoverLetter('https://ai.example/proxy', {
      company: 'Acme Corp',
      role: 'Staff Engineer',
      jobDescription: 'Build distributed systems and platform tooling.',
      resumeContext: {
        candidate: defaultResumeData.meta,
        vector: defaultResumeData.vectors[0],
        assembled: {},
      },
    })

    expect(result.paragraphs[0]?.text).toBe(expected)
  })

  it('does not rewrite connector words embedded inside larger words', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                name: 'Acme Staff Engineer Cover Letter',
                greeting: 'Dear Hiring Manager,',
                signOff: 'Sincerely\nJane Smith',
                paragraphs: [{ text: 'The team pipelines up with our data source.' }],
              }),
            },
          },
        ],
      }),
    }) as typeof fetch

    const result = await generateCoverLetter('https://ai.example/proxy', {
      company: 'Acme Corp',
      role: 'Staff Engineer',
      jobDescription: 'Build distributed systems and platform tooling.',
      resumeContext: {
        candidate: defaultResumeData.meta,
        vector: defaultResumeData.vectors[0],
        assembled: {},
      },
    })

    expect(result.paragraphs[0]?.text).toBe('The team pipelines up with our data source.')
  })

  it('preserves sentence capitalization when rewriting vague connector phrases', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                name: 'Acme Staff Engineer Cover Letter',
                greeting: 'Dear Hiring Manager,',
                signOff: 'Sincerely\nJane Smith',
                paragraphs: [
                  {
                    text: 'Lines up well with the role because of my platform background.',
                  },
                ],
              }),
            },
          },
        ],
      }),
    }) as typeof fetch

    const result = await generateCoverLetter('https://ai.example/proxy', {
      company: 'Acme Corp',
      role: 'Staff Engineer',
      jobDescription: 'Build distributed systems and platform tooling.',
      resumeContext: {
        candidate: defaultResumeData.meta,
        vector: defaultResumeData.vectors[0],
        assembled: {},
      },
    })

    expect(result.paragraphs[0]?.text).toBe('Matches the role because of my platform background.')
  })
})
