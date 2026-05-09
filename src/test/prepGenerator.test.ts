import { beforeEach, describe, expect, it, vi } from 'vitest'
import { generateInterviewPrep } from '../utils/prepGenerator'
import type { JDAnalysis } from '../types/jdAnalysis'
import { untagged, untaggedNote } from '../types/audience'
import { applyRulesBasedAudiences, type JDAnalysisLike } from '../utils/audienceRules'

const { callLlmProxyMock } = vi.hoisted(() => ({
  callLlmProxyMock: vi.fn(),
}))

vi.mock('../utils/llmProxy', async () => {
  const actual = await vi.importActual<typeof import('../utils/llmProxy')>('../utils/llmProxy')
  return {
    ...actual,
    callLlmProxy: callLlmProxyMock,
  }
})

const testJdAnalysis: JDAnalysis = applyRulesBasedAudiences({
  id: 'jd-analysis-test',
  pipelineEntryId: 'pipe-test',
  jdTextHash: 'jdhash-test',
  identityVersion: 0,
  modelVersion: 'jd-analysis.v1.match-multipass-sonnet',
  generatedAt: '2026-04-20T12:00:00.000Z',
  updatedAt: '2026-04-20T12:00:00.000Z',
  warnings: [],
  company: 'Acme',
  role: 'Staff Engineer',
  summary: 'Distributed systems and platform tooling.',
  analyzedJobDescription: 'Build distributed systems and platform tooling.',
  jobDescriptionWordCount: 6,
  jobDescriptionTruncated: false,
  requirements: [
    untagged({
      id: 'req-candidate-core',
      label: 'Operate Kubernetes-backed platforms',
      priority: 'core',
      evidence: 'Role needs practical platform operations.',
      tags: ['platform'],
      keywords: ['kubernetes'],
      coverageScore: 0.9,
      matchedAssetCount: 2,
      matchedTags: ['platform'],
    }),
    untagged({
      id: 'req-recruiter-only',
      label: 'Recruiter advocacy summary',
      priority: 'supporting',
      evidence: 'Useful for recruiter-facing framing, not prep.',
      tags: ['advocacy'],
      keywords: ['advocacy'],
      coverageScore: 0.4,
      matchedAssetCount: 0,
      matchedTags: [],
    }),
  ],
  overallFit: 'strong',
  fitScore: 0.82,
  confidence: 'high',
  recommendation: 'apply',
  oneLineSummary: 'Strong platform fit.',
  rationale: 'The role maps to backend platform evidence.',
  matchedVectors: [],
  primaryVectorId: 'backend',
  skillMatches: [
    untagged({
      skillName: 'Kubernetes',
      jdRequirement: 'Operate Kubernetes-backed platforms',
      requirementStrength: 'required',
      userDepth: 'strong',
      userPositioning: 'Built platforms around Kubernetes workloads.',
      matchQuality: 'strong',
      presentationGuidance: 'Do not overclaim: not a K8s admin, built platforms around K8s.',
    }),
    untagged({
      skillName: 'COBOL',
      jdRequirement: 'Maintain COBOL integrations',
      requirementStrength: 'nice-to-have',
      userDepth: 'avoid',
      userPositioning: 'No truthful COBOL claim.',
      matchQuality: 'negative',
      presentationGuidance: 'Avoid claiming COBOL depth.',
    }),
  ],
  evidenceMapping: {
    topBullets: [
      untagged({
        kind: 'bullet',
        id: 'bullet-candidate',
        label: 'Platform reliability bullet',
        sourceLabel: 'Northwind',
        text: 'Reduced incident volume by 38%.',
        tags: ['platform'],
        matchedTags: ['platform'],
        matchedKeywords: ['incident'],
        matchedRequirementIds: ['req-candidate-core'],
        score: 0.92,
      }),
      untagged({
        kind: 'bullet',
        id: 'bullet-recruiter-only',
        label: 'Recruiter-only proof',
        sourceLabel: 'Recruiter Notes',
        text: 'Recruiter advocacy proof point.',
        tags: ['advocacy'],
        matchedTags: ['advocacy'],
        matchedKeywords: ['advocacy'],
        matchedRequirementIds: ['req-recruiter-only'],
        score: 0.4,
      }),
    ],
    topSkills: [],
    topProjects: [],
    topProfiles: [],
    topPhilosophy: [],
  },
  strengthsToLead: [untaggedNote('Distributed systems')],
  advantages: [],
  advantageHypotheses: [],
  gaps: [
    untagged({
      requirementId: 'req-candidate-core',
      label: 'Explain Kubernetes operations boundary',
      severity: 'low',
      reason: 'Candidate should frame platform ownership without overclaiming admin work.',
      tags: ['platform'],
    }),
  ],
  gapFocus: ['Clarify the Kubernetes operations boundary.'],
  watchOuts: [
    untagged({
      type: 'avoid_skill',
      referenceId: 'skill-cobol',
      description: 'Do not claim COBOL depth.',
      severity: 'soft',
      suggestedAction: 'Bridge back to adjacent systems migration experience.',
    }),
  ],
  triggeredPrioritize: [],
  triggeredAvoid: [],
  relevantAwareness: [
    untagged({
      awarenessId: 'awareness-platform-boundary',
      topic: 'Platform ownership boundary',
      severity: 'medium',
      appliesBecause: 'The role mixes platform operations and application support.',
      action: 'Prepare a crisp boundary statement.',
    }),
  ],
  positioningRecommendations: [untaggedNote('Lead with platform reliability.')],
  requirementCoverageScore: 0.8,
  matchedRequirementIds: [],
  matchedKeywords: ['distributed systems', 'platform tooling'],
} satisfies JDAnalysisLike)

describe('generateInterviewPrep', () => {
  beforeEach(() => {
    callLlmProxyMock.mockReset()
  })

  it('uses an extended timeout for larger interview prep payloads', async () => {
    callLlmProxyMock.mockResolvedValueOnce(
      JSON.stringify({
        deckTitle: 'Acme Staff Engineer Prep',
        companyResearchSummary: 'Acme is scaling carefully.',
        cards: [
          {
            category: 'opener',
            title: 'Tell me about yourself',
            tags: ['backend'],
            script: 'I build resilient backend systems.',
          },
        ],
      }),
    )

    await generateInterviewPrep('https://ai.example/proxy', {
      company: 'Acme',
      role: 'Staff Engineer',
      vectorId: 'backend',
      vectorLabel: 'Backend',
      companyUrl: 'https://acme.example/jobs/1',
      skillMatch: 'distributed systems',
      positioning: 'Lead with backend systems depth.',
      notes: 'Hiring manager cares about platform judgment.',
      companyResearch: 'Platform reliability is a priority.',
      jobDescription: 'Build distributed systems and platform tooling.',
      jdAnalysis: testJdAnalysis,
      resumeContext: {
        resume: {
          basics: { name: 'Alex Example' },
        },
      },
    })

    expect(callLlmProxyMock).toHaveBeenCalledWith(
      'https://ai.example/proxy',
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        feature: 'prep.generate',
        model: 'sonnet',
        timeoutMs: 240000,
        maxTokens: 8192,
      }),
    )
  })

  it('passes structured identity context to the prompt when available', async () => {
    callLlmProxyMock.mockResolvedValueOnce(
      JSON.stringify({
        deckTitle: 'Acme Staff Engineer Prep',
        companyResearchSummary: 'Acme is scaling carefully.',
        cards: [
          {
            category: 'behavioral',
            title: 'Leadership story',
            tags: ['leadership'],
            script: 'Lead with the incident response story.',
          },
        ],
      }),
    )

    const result = await generateInterviewPrep('https://ai.example/proxy', {
      company: 'Acme',
      role: 'Staff Engineer',
      vectorId: 'backend',
      vectorLabel: 'Backend',
      roundType: 'hm-screen',
      jobDescription: 'Build distributed systems and platform tooling.',
      jdAnalysis: testJdAnalysis,
      identityContext: {
        candidate_metrics: [
          {
            metricKey: 'incidents',
            metricValue: '38%',
            suggestedLabel: 'Incidents',
            company: 'Acme',
            roleTitle: 'Principal Engineer',
            bulletId: 'bullet-1',
            roleId: 'role-1',
            evidence: 'Reduced incidents by 38%.',
          },
        ],
        fallback_candidate_metrics: [
          {
            metricKey: 'aws_savings_monthly',
            metricValue: '$60K/mo',
            suggestedLabel: 'AWS Savings Monthly',
            company: 'Helios Security',
            roleTitle: 'Platform Engineer',
            bulletId: 'bullet-2',
            roleId: 'role-2',
            evidence: 'Cut the AWS bill in half by consolidating infrastructure.',
          },
        ],
        self_model: {
          interview_style: {
            strengths: ['incident response'],
          },
        },
        roles: [
          {
            title: 'Principal Engineer',
            bullets: [
              {
                problem: 'Latency was spiking during peak load.',
                action: 'Redesigned the request pipeline.',
                outcome: 'Stabilized the service.',
              },
            ],
          },
        ],
      },
      pipelineEntryContext: {
        company: 'Acme',
        role: 'Staff Engineer',
        tier: '1',
        status: 'interviewing',
        appMethod: 'direct-apply',
        response: 'interview-scheduled',
        formats: ['hm-screen'],
        research: {
          status: 'investigated',
          summary: 'Public evidence points to a platform-heavy reliability role.',
          interviewSignals: [],
          sources: [],
          searchQueries: [],
        },
        round: {
          id: 'round-1',
          label: 'HM screen',
          format: 'hm-screen',
          interviewers: [
            {
              id: 'iv-jordan',
              name: 'Jordan Lee',
              title: 'Director of Platform',
            },
          ],
        },
      },
      resumeContext: {
        resume: {
          basics: { name: 'Alex Example' },
        },
      },
    })

    const [, systemPrompt, userPrompt] = callLlmProxyMock.mock.calls[0]

    expect(systemPrompt).toContain('storyBlocks')
    expect(systemPrompt).toContain('keyPoints')
    expect(systemPrompt).toContain('alternativeTitle')
    expect(systemPrompt).toContain('alternativeScript')
    expect(systemPrompt).toContain('answerTemplate')
    expect(systemPrompt).toContain('questionsToAsk')
    expect(systemPrompt).toContain('numbersToKnow')
    expect(systemPrompt).toContain('stackAlignment')
    expect(systemPrompt).toContain('contextGaps')
    expect(systemPrompt).toContain('categoryGuidance')
    expect(systemPrompt).toContain('"rules"')
    expect(systemPrompt).toContain('conditionals')

    expect(userPrompt).toContain('Structured Identity Context')
    expect(userPrompt).toContain('Structured Pipeline Entry Context')
    expect(userPrompt).toContain('Prep Stack Alignment Confidence Mapping')
    expect(userPrompt).toContain('Canonical JD Analysis')
    expect(userPrompt).toContain('"id": "jd-analysis-test"')
    expect(userPrompt).toContain('"strengthsToLead"')
    expect(userPrompt).toContain('"watchOuts"')
    expect(userPrompt).toContain('Original Job Description Source Text')
    expect(userPrompt).toContain(
      'Do not re-infer the job analysis from Original Job Description Source Text',
    )
    expect(userPrompt).not.toContain(
      '\nJob Description:\nBuild distributed systems and platform tooling.',
    )
    const canonicalBlock = userPrompt
      .split('Canonical JD Analysis:\n')[1]
      ?.split('\n\nOriginal Job Description Source Text:')[0]
    expect(canonicalBlock).toBeTruthy()
    const canonicalAnalysis = JSON.parse(canonicalBlock ?? '{}') as Record<string, unknown>
    expect(Object.keys(canonicalAnalysis).sort()).toEqual(
      [
        'audience',
        'advantages',
        'confidence',
        'evidenceMapping',
        'fitScore',
        'gapFocus',
        'gaps',
        'generatedAt',
        'id',
        'jdTextHash',
        'matchedKeywords',
        'matchedRequirementIds',
        'matchedVectors',
        'modelVersion',
        'oneLineSummary',
        'pipelineEntryId',
        'positioningRecommendations',
        'primaryVectorId',
        'rationale',
        'recommendation',
        'relevantAwareness',
        'requirementCoverageScore',
        'requirements',
        'skillMatches',
        'strengthsToLead',
        'summary',
        'triggeredAvoid',
        'triggeredPrioritize',
        'watchOuts',
      ].sort(),
    )
    expect(canonicalAnalysis).not.toHaveProperty('analyzedJobDescription')
    expect(canonicalAnalysis).not.toHaveProperty('warnings')
    const skillMatches = canonicalAnalysis.skillMatches as Array<Record<string, unknown>>
    expect(skillMatches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          skillName: 'Kubernetes',
          prepStackConfidence: 'Solid',
        }),
        expect.objectContaining({
          skillName: 'COBOL',
          prepStackConfidence: 'Gap',
        }),
      ]),
    )
    expect(canonicalAnalysis.audience).toBe('candidate')
    expect(canonicalAnalysis.requirements).toEqual([
      expect.objectContaining({ id: 'req-candidate-core' }),
    ])
    expect(JSON.stringify(canonicalAnalysis.requirements)).not.toContain('req-recruiter-only')
    expect(canonicalAnalysis.evidenceMapping).toEqual(
      expect.objectContaining({
        topBullets: [expect.objectContaining({ id: 'bullet-candidate' })],
      }),
    )
    expect(JSON.stringify(canonicalAnalysis.evidenceMapping)).not.toContain('bullet-recruiter-only')
    expect(canonicalAnalysis.gaps).toEqual([
      expect.objectContaining({ label: 'Explain Kubernetes operations boundary' }),
    ])
    expect(canonicalAnalysis.gapFocus).toEqual([
      expect.objectContaining({ text: 'Clarify the Kubernetes operations boundary.' }),
    ])
    expect(canonicalAnalysis.watchOuts).toEqual([
      expect.objectContaining({ description: 'Do not claim COBOL depth.' }),
    ])
    expect(canonicalAnalysis.relevantAwareness).toEqual([
      expect.objectContaining({ topic: 'Platform ownership boundary' }),
    ])
    expect(userPrompt).toContain('Candidate Metrics From Identity')
    expect(userPrompt).toContain('Additional Candidate Metrics Outside The Vector Slice')
    expect(userPrompt).toContain('Existing Context Gaps')
    expect(userPrompt).toContain('Context Gap Answers')
    expect(userPrompt).toContain('Latency was spiking during peak load.')
    expect(userPrompt).toContain('"metricKey": "incidents"')
    expect(userPrompt).toContain('"metricKey": "aws_savings_monthly"')
    expect(userPrompt).toContain('Jordan Lee')
    expect(userPrompt.match(/"metricKey": "incidents"/g)).toHaveLength(1)
    expect(userPrompt.match(/"metricKey": "aws_savings_monthly"/g)).toHaveLength(1)
    expect(userPrompt).toContain('use it as the source of truth for candidate evidence')
    expect(userPrompt).toContain('Target Round Type: hm-screen')
    expect(userPrompt).toContain('generate an answerTemplate at the deck level')
    expect(userPrompt).toContain('Otherwise, omit answerTemplate')
    expect(userPrompt).toContain('aim for 5 to 8 situational drill cards')
    expect(userPrompt).toContain('aim for 2 to 3')
    expect(userPrompt).toContain('For opener cards, make keyPoints a beat sheet')
    expect(userPrompt).toContain('do not prefix items with ordinals, bullets, or labels')
    expect(userPrompt).toContain('including landmine and intel-tag people cards')
    expect(userPrompt).toContain('around 10 words')
    expect(userPrompt).toContain('Example: "38% incident reduction"')
    expect(userPrompt).toContain('Canonical JD Analysis requirements and evidenceMapping')
    expect(userPrompt).toContain(
      'add alternativeTitle and alternativeScript only when Canonical JD Analysis evidenceMapping.topBullets or evidenceMapping.topProjects plus advantages',
    )
    expect(userPrompt).toContain(
      'Do not create alternatives by re-ranking roles or projects from Original Job Description Source Text',
    )
    expect(userPrompt).toContain(
      'Do not infer keyPoints directly from Original Job Description Source Text',
    )
    expect(userPrompt).toContain('outside the vector slice')
    expect(userPrompt).toContain('use those exact metrics')
    expect(userPrompt).toContain('return a stackAlignment table')
    expect(userPrompt).toContain('source of truth for stackAlignment.confidence')
    expect(userPrompt).toContain('generate 1 to 2 technical gap-framing cards')
    expect(userPrompt).toContain('tag "gap-framing"')
    expect(userPrompt).toContain('Generate 3 to 5 landmine cards tagged "landmine"')
    expect(userPrompt).toContain('Preserve the existing intel-tag people cards')
    expect(userPrompt).toContain('include conditionals')
    expect(userPrompt).toContain('imperative one-liners')
    expect(userPrompt).toContain('quotable one-sentence takeaway')
    expect(userPrompt).toContain('after problem/solution/result')
    expect(userPrompt).toContain('20 words or fewer')
    expect(userPrompt).toContain('specific system, metric, decision, or candidate evidence')
    expect(userPrompt).toContain('Canonical JD Analysis strengthsToLead')
    expect(userPrompt).toContain('positioningRecommendations')
    expect(userPrompt).toContain('structured candidate evidence from identity bullets')
    expect(userPrompt).toContain('do not derive it by raw-job re-inference')
    expect(userPrompt).toContain('Only use scriptLabel "The One-Liner"')
    expect(userPrompt).toContain(
      'Generate dedicated opener cards for the predictable opening questions',
    )
    expect(userPrompt).toContain('Always include a "Tell me about yourself" opener card')
    expect(userPrompt).toContain('make the "Tell me about yourself" opener a 3-act career arc')
    expect(userPrompt).toContain('union of distinct sourceLabel values')
    expect(userPrompt).toContain('one "note" thesis')
    expect(userPrompt).toContain('three "solution" act blocks')
    expect(userPrompt).toContain('one "closer" tying the arc back to the target role')
    expect(userPrompt).toContain('Use keyPoints as one beat per act plus the closer')
    expect(userPrompt).toContain('Keep the opener closer around 20 words')
    expect(userPrompt).toContain('Do not re-rank roles from Original Job Description Source Text')
    expect(userPrompt).toContain('Otherwise, keep the standard single-role opener')
    expect(userPrompt).toContain(
      'use it as the source of truth for company, process, and interviewer intel',
    )
    expect(userPrompt).toContain('Always include a "Why this role/company?" opener card')
    expect(userPrompt).toContain('identity.departureContext')
    expect(userPrompt).toContain('Prefix the affected field with [[needs-review]]')
    expect(result.deck.jdAnalysisId).toBe(testJdAnalysis.id)
    expect(result.deck.jdAnalysisGeneratedAt).toBe(testJdAnalysis.generatedAt)
    expect(result.deck.jdAnalysisModelVersion).toBe(testJdAnalysis.modelVersion)
    expect(result.deck.jdTextHash).toBe(testJdAnalysis.jdTextHash)
    expect(result.deck.generatedAt).toBe(result.deck.updatedAt)
  })

  it('marks structured identity context as not provided when absent', async () => {
    callLlmProxyMock.mockResolvedValueOnce(
      JSON.stringify({
        deckTitle: 'Acme Staff Engineer Prep',
        companyResearchSummary: 'Acme is scaling carefully.',
        cards: [
          {
            category: 'opener',
            title: 'Tell me about yourself',
            tags: ['intro'],
            script: 'I build reliable systems.',
          },
        ],
      }),
    )

    await generateInterviewPrep('https://ai.example/proxy', {
      company: 'Acme',
      role: 'Staff Engineer',
      vectorId: 'backend',
      vectorLabel: 'Backend',
      jobDescription: 'Build distributed systems and platform tooling.',
      jdAnalysis: testJdAnalysis,
      resumeContext: {
        resume: {
          basics: { name: 'Alex Example' },
        },
      },
    })

    expect(callLlmProxyMock).toHaveBeenCalledWith(
      'https://ai.example/proxy',
      expect.any(String),
      expect.stringContaining('Structured Identity Context:\nNot provided'),
      expect.any(Object),
    )
  })

  it('requests and preserves per-card time budgets for live mode section timing', async () => {
    callLlmProxyMock.mockResolvedValueOnce(
      JSON.stringify({
        deckTitle: 'Acme Staff Engineer Prep',
        companyResearchSummary: 'Acme is scaling carefully.',
        cards: [
          {
            category: 'opener',
            title: 'Tell me about yourself',
            tags: ['intro'],
            script: 'I build reliable systems.',
            timeBudgetMinutes: 1.5,
          },
          {
            category: 'technical',
            title: 'How do you debug a distributed system?',
            tags: ['debugging'],
            script: 'Start with the blast radius.',
            timeBudgetMinutes: '4',
          },
        ],
      }),
    )

    const result = await generateInterviewPrep('https://ai.example/proxy', {
      company: 'Acme',
      role: 'Staff Engineer',
      vectorId: 'backend',
      vectorLabel: 'Backend',
      roundType: 'hm-screen',
      jobDescription: 'Build distributed systems and platform tooling.',
      jdAnalysis: testJdAnalysis,
      resumeContext: {
        resume: {
          basics: { name: 'Alex Example' },
        },
      },
    })

    const [, systemPrompt, userPrompt] = callLlmProxyMock.mock.calls[0]

    expect(systemPrompt).toContain('timeBudgetMinutes')
    expect(userPrompt).toContain('Add timeBudgetMinutes to every card')
    expect(result.cards[0]?.timeBudgetMinutes).toBe(1.5)
    expect(result.cards[1]?.timeBudgetMinutes).toBe(4)
  })

  it('persists pipelineRoundId on the generated deck when supplied', async () => {
    callLlmProxyMock.mockResolvedValueOnce(
      JSON.stringify({
        deckTitle: 'Acme Staff Engineer Prep',
        companyResearchSummary: 'Acme is scaling carefully.',
        cards: [
          {
            category: 'opener',
            title: 'Tell me about yourself',
            tags: ['intro'],
            script: 'I build reliable systems.',
          },
        ],
      }),
    )

    const result = await generateInterviewPrep('https://ai.example/proxy', {
      company: 'Acme',
      role: 'Staff Engineer',
      vectorId: 'backend',
      vectorLabel: 'Backend',
      jobDescription: 'Build distributed systems and platform tooling.',
      jdAnalysis: testJdAnalysis,
      pipelineRoundId: 'round-42',
      resumeContext: { resume: { basics: { name: 'Alex Example' } } },
    })

    expect(result.deck.pipelineRoundId).toBe('round-42')
  })

  it('defaults pipelineRoundId to null when no round was targeted', async () => {
    callLlmProxyMock.mockResolvedValueOnce(
      JSON.stringify({
        deckTitle: 'Acme Staff Engineer Prep',
        cards: [
          {
            category: 'opener',
            title: 'Tell me about yourself',
            tags: ['intro'],
            script: 'I build reliable systems.',
          },
        ],
      }),
    )

    const result = await generateInterviewPrep('https://ai.example/proxy', {
      company: 'Acme',
      role: 'Staff Engineer',
      jobDescription: 'Build distributed systems and platform tooling.',
      jdAnalysis: testJdAnalysis,
      resumeContext: { resume: { basics: { name: 'Alex Example' } } },
    })

    expect(result.deck.pipelineRoundId).toBeNull()
  })

  it('drops AI-emitted interviewers when no round was targeted', async () => {
    // Even if the model speculates interviewer records (despite the prompt
    // instruction), the store must not persist names unless the user supplied
    // them via round.interviewers. See doc-30 §Interviewer Capture.
    callLlmProxyMock.mockResolvedValueOnce(
      JSON.stringify({
        deckTitle: 'Acme Staff Engineer Prep',
        interviewers: [
          {
            id: 'speculated',
            name: 'Speculated Name',
            intel: { role: 'guessed' },
          },
        ],
        cards: [
          {
            category: 'opener',
            title: 'Tell me about yourself',
            tags: ['intro'],
            script: 'I build reliable systems.',
          },
        ],
      }),
    )

    const result = await generateInterviewPrep('https://ai.example/proxy', {
      company: 'Acme',
      role: 'Staff Engineer',
      jobDescription: 'Build distributed systems and platform tooling.',
      jdAnalysis: testJdAnalysis,
      resumeContext: { resume: { basics: { name: 'Alex Example' } } },
    })

    expect(result.deck.interviewers).toBeUndefined()
  })

  it('preserves AI-emitted interviewers when round.interviewers is present', async () => {
    callLlmProxyMock.mockResolvedValueOnce(
      JSON.stringify({
        deckTitle: 'Acme Staff Engineer Prep',
        interviewers: [
          {
            id: 'iv-1',
            name: 'Alice',
            title: 'Principal',
            likelyRole: 'manager',
            coachingNote: ' Lead with reliability operations. ',
            intel: {
              role: 'Principal on the platform team',
              caresAbout: 'reliability over velocity',
            },
            lineThatLands: 'I lean on specific reliability outcomes.',
            metInRounds: [2, 1, 2],
            notes: ' Mention incident command. ',
          },
          {
            id: 'iv-unknown',
            name: '',
            likelyRole: 'unknown',
            coachingNote: "If unsure who you're talking to, ask how they connect to the role.",
            intel: {},
          },
        ],
        cards: [
          {
            category: 'situational',
            title: 'Alice — intel',
            tags: ['intel'],
            interviewerIds: ['iv-1'],
            notes: 'Alice — likely hiring manager. Lead with on-call stories.',
          },
        ],
      }),
    )

    const result = await generateInterviewPrep('https://ai.example/proxy', {
      company: 'Acme',
      role: 'Staff Engineer',
      jobDescription: 'Build distributed systems and platform tooling.',
      jdAnalysis: testJdAnalysis,
      pipelineRoundId: 'round-42',
      pipelineEntryContext: {
        company: 'Acme',
        role: 'Staff Engineer',
        tier: '1',
        status: 'interviewing',
        appMethod: 'direct-apply',
        response: 'interview-scheduled',
        formats: ['hm-screen'],
        round: {
          id: 'round-42',
          label: 'HM panel',
          format: 'hm-screen',
          interviewers: [{ id: 'iv-1', name: 'Alice', title: 'Principal' }],
        },
      },
      resumeContext: { resume: { basics: { name: 'Alex Example' } } },
    })

    expect(result.deck.interviewers).toHaveLength(2)
    expect(result.deck.interviewers?.[0].name).toBe('Alice')
    expect(result.deck.interviewers?.[0].likelyRole).toBe('hiring-manager')
    expect(result.deck.interviewers?.[0].coachingNote).toBe('Lead with reliability operations.')
    expect(result.deck.interviewers?.[0].metInRounds).toEqual([1, 2])
    expect(result.deck.interviewers?.[0].notes).toBe('Mention incident command.')
    expect(result.deck.interviewers?.[1]).toEqual(
      expect.objectContaining({
        name: '',
        likelyRole: 'unknown',
        coachingNote: "If unsure who you're talking to, ask how they connect to the role.",
      }),
    )
  })

  it('normalizes rich card fields and deck-level guidance from the AI response', async () => {
    callLlmProxyMock.mockResolvedValueOnce(
      JSON.stringify({
        deckTitle: 'Acme Staff Engineer Prep',
        companyResearchSummary: 'Acme is scaling carefully.',
        answerTemplate:
          ' 1. Frame the problem. 2. Take a position. 3. Name concrete steps. 4. Call out a gotcha. 5. Close with evidence.\u202e ',
        companyIntel: {
          whatTheyDo: ' Developer productivity platform ',
          scale: ' 800 engineers ',
          theRole: ' Newly created platform role ',
          stack: ' Kubernetes, Terraform, Go ',
          team: ' Platform group inside product engineering ',
          aiPosture: {
            strength: 'STRONG',
            narrative: ' They already use AI tooling in SDLC. ',
            signals: [' Claude pilots ', ' ', 9],
          },
          other: {
            ' Buying motion ': ' Enterprise SaaS ',
            Empty: ' ',
          },
        },
        rules: [' Lead with specifics ', '', 7],
        donts: [' Be generic ', '', 7],
        questionsToAsk: [
          {
            question: 'What is the platform team optimizing for next?',
            context: 'Shows systems thinking.',
          },
          { question: ' ', context: 'Skip empty question.' },
        ],
        numbersToKnow: {
          candidate: [
            { value: ' 38% ', label: ' Incident reduction ' },
            { value: '', label: 'Skip blank' },
          ],
          company: [{ value: '3', label: ' Core platform bets ' }],
        },
        stackAlignment: [
          {
            theirTech: 'Kubernetes',
            yourMatch: 'Operated multi-cluster platform infrastructure.',
            confidence: ' strong ',
          },
          {
            theirTech: 'Terraform',
            yourMatch: 'Built shared IaC modules for platform teams.',
            confidence: 'Adjacent',
          },
          {
            theirTech: 'Go',
            yourMatch: 'No direct production ownership yet.',
            confidence: 'gap',
          },
          {
            theirTech: ' ',
            yourMatch: 'skip invalid row',
            confidence: 'Solid',
          },
        ],
        categoryGuidance: {
          behavioral: 'Lead with scope and tradeoffs.',
          metrics: 'Name the number early.',
          extra: 'Ignore unsupported categories.',
        },
        contextGaps: [
          {
            id: 'gap-departure',
            section: 'Openers',
            question: 'Why did you leave your last role?',
            why: 'This answer needs candidate-authored context.',
            feedbackTarget: 'identity.departureContext',
            priority: 'required',
          },
          {
            section: 'Technical Topics',
            question: 'What scale did the rollout support?',
            why: 'The current notes do not say.',
            priority: 'optional',
          },
          {
            id: 'gap-invalid',
            section: ' ',
            question: 'skip invalid',
            why: 'missing section',
            priority: 'required',
          },
        ],
        cards: [
          {
            category: 'behavioral',
            title: 'Leadership story',
            tags: [' leadership ', 'backend'],
            script: 'Lead with the incident response story.',
            scriptLabel: ' Lead With ',
            alternativeTitle: ' Alternative: migration story ',
            alternativeScript:
              ' Use the platform migration proof if they ask for another example. ',
            keyPoints: ['Own the incident', ' ', null, 'Close with the metric'],
            storyBlocks: [
              {
                label: 'Problem Statement',
                text: 'Latency spiked during peak load.',
              },
              { label: 'Action', text: 'Redesigned the request pipeline.' },
              { label: 'Outcome', text: 'Reduced incidents by 38%.' },
              { label: 'Unknown', text: 'Drop this malformed label.' },
            ],
            conditionals: [
              {
                trigger: ' If they push on ownership ',
                response: ' Clarify what you led directly. ',
                tone: ' pivot ',
              },
              {
                trigger: 'Were you just reacting late?',
                response: 'Name the signal, the decision, and the prevention step.',
                tone: 'trap',
              },
              {
                trigger: 'If they keep pushing on certainty',
                response: 'Say what you knew, what you escalated, and what you would verify next.',
                tone: 'escalation',
              },
              { trigger: ' ', response: 'skip blank', tone: 'pivot' },
            ],
            metrics: [{ value: '38%', label: 'Incident reduction' }],
          },
        ],
      }),
    )

    const result = await generateInterviewPrep('https://ai.example/proxy', {
      company: 'Acme',
      role: 'Staff Engineer',
      vectorId: 'backend',
      vectorLabel: 'Backend',
      jobDescription: 'Build distributed systems and platform tooling.',
      jdAnalysis: testJdAnalysis,
      resumeContext: {
        resume: {
          basics: { name: 'Alex Example' },
        },
      },
    })

    expect(result.rules).toEqual(['Lead with specifics'])
    expect(result.answerTemplate).toBe(
      '1. Frame the problem. 2. Take a position. 3. Name concrete steps. 4. Call out a gotcha. 5. Close with evidence.',
    )
    expect(result.deck.answerTemplate).toBe(result.answerTemplate)
    expect(result.donts).toEqual(['Be generic'])
    expect(result.questionsToAsk).toEqual([
      {
        question: 'What is the platform team optimizing for next?',
        context: 'Shows systems thinking.',
      },
    ])
    expect(result.numbersToKnow).toEqual({
      candidate: [{ value: '38%', label: 'Incident reduction' }],
      company: [{ value: '3', label: 'Core platform bets' }],
    })
    expect(result.deck.companyIntel).toEqual({
      whatTheyDo: 'Developer productivity platform',
      scale: '800 engineers',
      theRole: 'Newly created platform role',
      stack: 'Kubernetes, Terraform, Go',
      team: 'Platform group inside product engineering',
      aiPosture: {
        strength: 'strong',
        narrative: 'They already use AI tooling in SDLC.',
        signals: ['Claude pilots'],
      },
      other: {
        'Buying motion': 'Enterprise SaaS',
      },
    })
    expect(result.stackAlignment).toEqual([
      {
        theirTech: 'Kubernetes',
        yourMatch: 'Operated multi-cluster platform infrastructure.',
        confidence: 'Solid',
      },
      {
        theirTech: 'Terraform',
        yourMatch: 'Built shared IaC modules for platform teams.',
        confidence: 'Adjacent experience',
      },
      {
        theirTech: 'Go',
        yourMatch: 'No direct production ownership yet.',
        confidence: 'Gap',
      },
    ])
    expect(result.categoryGuidance).toEqual({
      behavioral: 'Lead with scope and tradeoffs.',
      metrics: 'Name the number early.',
    })
    expect(result.contextGaps).toEqual([
      {
        id: 'gap-departure',
        section: 'Openers',
        question: 'Why did you leave your last role?',
        why: 'This answer needs candidate-authored context.',
        feedbackTarget: 'identity.departureContext',
        priority: 'required',
      },
      expect.objectContaining({
        id: expect.stringMatching(/^prep-gap-/),
        section: 'Technical Topics',
        question: 'What scale did the rollout support?',
        why: 'The current notes do not say.',
        priority: 'optional',
      }),
    ])
    expect(result.cards[0].scriptLabel).toBe('Lead With')
    expect(result.cards[0].alternativeTitle).toBe('Alternative: migration story')
    expect(result.cards[0].alternativeScript).toBe(
      'Use the platform migration proof if they ask for another example.',
    )
    expect(result.cards[0].keyPoints).toEqual(['Own the incident', 'Close with the metric'])
    expect(result.cards[0].storyBlocks).toEqual([
      { label: 'problem', text: 'Latency spiked during peak load.' },
      { label: 'solution', text: 'Redesigned the request pipeline.' },
      { label: 'result', text: 'Reduced incidents by 38%.' },
    ])
    expect(result.cards[0].conditionals).toEqual([
      {
        trigger: 'If they push on ownership',
        response: 'Clarify what you led directly.',
        tone: 'pivot',
      },
      {
        trigger: 'Were you just reacting late?',
        response: 'Name the signal, the decision, and the prevention step.',
        tone: 'trap',
      },
      {
        trigger: 'If they keep pushing on certainty',
        response: 'Say what you knew, what you escalated, and what you would verify next.',
        tone: 'escalation',
      },
    ])
  })

  it('applies stack confidence ceilings only to exact skill matches', async () => {
    callLlmProxyMock.mockResolvedValueOnce(
      JSON.stringify({
        deckTitle: 'Acme Staff Engineer Prep',
        companyResearchSummary: 'Acme is scaling carefully.',
        stackAlignment: [
          {
            theirTech: 'Node.js',
            yourMatch: 'No truthful Node claim.',
            confidence: 'Strong',
          },
          {
            theirTech: 'Java',
            yourMatch: 'No truthful Java claim.',
            confidence: 'Strong',
          },
          {
            theirTech: 'JavaScript',
            yourMatch: 'Built production frontend workflows.',
            confidence: 'Strong',
          },
        ],
        cards: [
          {
            category: 'technical',
            title: 'Frontend systems',
            tags: ['frontend'],
            script: 'Lead with production JavaScript systems.',
          },
        ],
      }),
    )

    const result = await generateInterviewPrep('https://ai.example/proxy', {
      company: 'Acme',
      role: 'Staff Engineer',
      vectorId: 'frontend',
      vectorLabel: 'Frontend',
      jobDescription: 'Build JavaScript systems; Java is a nice-to-have.',
      jdAnalysis: applyRulesBasedAudiences({
        ...testJdAnalysis,
        audienceRulesVersion: undefined,
        skillMatches: [
          untagged({
            skillName: 'Node',
            jdRequirement: 'Maintain Node services',
            requirementStrength: 'preferred',
            userDepth: 'avoid',
            userPositioning: 'No truthful Node claim.',
            matchQuality: 'negative',
            presentationGuidance: 'Avoid claiming Node depth.',
          }),
          untagged({
            skillName: 'Java',
            jdRequirement: 'Maintain Java services',
            requirementStrength: 'nice-to-have',
            userDepth: 'avoid',
            userPositioning: 'No truthful Java claim.',
            matchQuality: 'negative',
            presentationGuidance: 'Avoid claiming Java depth.',
          }),
        ],
      } as JDAnalysisLike),
      resumeContext: {
        resume: {
          basics: { name: 'Alex Example' },
        },
      },
    })

    expect(result.stackAlignment).toEqual([
      {
        theirTech: 'Node.js',
        yourMatch: 'No truthful Node claim.',
        confidence: 'Gap',
      },
      {
        theirTech: 'Java',
        yourMatch: 'No truthful Java claim.',
        confidence: 'Gap',
      },
      {
        theirTech: 'JavaScript',
        yourMatch: 'Built production frontend workflows.',
        confidence: 'Strong',
      },
    ])
  })

  it('allows company research summary to be omitted', async () => {
    callLlmProxyMock.mockResolvedValueOnce(
      JSON.stringify({
        deckTitle: 'Acme Staff Engineer Prep',
        cards: [
          {
            category: 'opener',
            title: 'Tell me about yourself',
            tags: ['intro'],
            script: 'I build reliable systems.',
          },
        ],
      }),
    )

    const result = await generateInterviewPrep('https://ai.example/proxy', {
      company: 'Acme',
      role: 'Staff Engineer',
      vectorId: 'backend',
      vectorLabel: 'Backend',
      jobDescription: 'Build distributed systems and platform tooling.',
      jdAnalysis: testJdAnalysis,
      resumeContext: {
        resume: {
          basics: { name: 'Alex Example' },
        },
      },
    })

    expect(result.companyResearchSummary).toBe('')
    expect(result.numbersToKnow).toBeUndefined()
    expect(result.stackAlignment).toBeUndefined()
  })

  it('repairs malformed JSON when the model drops a closing array bracket near the end', async () => {
    callLlmProxyMock.mockResolvedValueOnce(
      '<result>\n{"deckTitle":"Acme Staff Engineer Prep","companyResearchSummary":"Acme is scaling carefully.","cards":[{"category":"opener","title":"Tell me about yourself","tags":["intro"],"script":"I build reliable systems.","keyPoints":["Lead with platform depth","Close with outcomes"}]}\n</result>',
    )

    const result = await generateInterviewPrep('https://ai.example/proxy', {
      company: 'Acme',
      role: 'Staff Engineer',
      vectorId: 'backend',
      vectorLabel: 'Backend',
      jobDescription: 'Build distributed systems and platform tooling.',
      jdAnalysis: testJdAnalysis,
      resumeContext: {
        resume: {
          basics: { name: 'Alex Example' },
        },
      },
    })

    expect(result.deckTitle).toBe('Acme Staff Engineer Prep')
    expect(result.companyResearchSummary).toBe('Acme is scaling carefully.')
    expect(result.cards).toHaveLength(4)
    expect(result.cards[0]).toMatchObject({
      category: 'opener',
      title: 'Tell me about yourself',
      script: 'I build reliable systems.',
      keyPoints: ['Lead with platform depth', 'Close with outcomes'],
    })
    expect(result.cards.filter((card) => card.tags.includes('landmine'))).toHaveLength(3)
  })

  it('adds fallback landmine cards when the model omits them and preserves intel tags', async () => {
    callLlmProxyMock.mockResolvedValueOnce(
      JSON.stringify({
        deckTitle: 'Acme Staff Engineer Prep',
        companyResearchSummary: 'Acme is scaling carefully.',
        stackAlignment: [
          {
            theirTech: 'Go',
            yourMatch: 'Mostly adjacent systems debugging experience.',
            confidence: 'Adjacent experience',
          },
        ],
        cards: [
          {
            category: 'situational',
            title: 'Named people intel',
            tags: ['intel'],
            script: 'Focus on the hiring manager and team shape.',
          },
        ],
      }),
    )

    const result = await generateInterviewPrep('https://ai.example/proxy', {
      company: 'Acme',
      role: 'Staff Engineer',
      vectorId: 'backend',
      vectorLabel: 'Backend',
      jobDescription: 'Build distributed systems and platform tooling.',
      jdAnalysis: testJdAnalysis,
      resumeContext: {
        resume: {
          basics: { name: 'Alex Example' },
        },
      },
    })

    const landmineCards = result.cards.filter((card) => card.tags.includes('landmine'))
    const intelCards = result.cards.filter((card) => card.tags.includes('intel'))

    expect(landmineCards).toHaveLength(3)
    expect(intelCards).toHaveLength(1)
  })

  it('adds fallback technical gap-framing cards when alignment shows gaps and the model omits them', async () => {
    callLlmProxyMock.mockResolvedValueOnce(
      JSON.stringify({
        deckTitle: 'Acme Staff Engineer Prep',
        stackAlignment: [
          {
            theirTech: 'GovCloud',
            yourMatch: 'Shipped regulated platform migrations and audit-heavy environments.',
            confidence: 'Gap',
          },
          {
            theirTech: 'Go',
            yourMatch: 'Led adjacent distributed systems debugging and service design work.',
            confidence: 'Adjacent experience',
          },
        ],
        cards: [
          {
            category: 'technical',
            title: 'How do you debug a flaky distributed system?',
            tags: ['debugging'],
            script: 'Start with blast radius and the most recent changes.',
          },
        ],
      }),
    )

    const result = await generateInterviewPrep('https://ai.example/proxy', {
      company: 'Acme',
      role: 'Staff Engineer',
      vectorId: 'backend',
      vectorLabel: 'Backend',
      jobDescription: 'Build distributed systems and platform tooling.',
      jdAnalysis: testJdAnalysis,
      resumeContext: {
        resume: {
          basics: { name: 'Alex Example' },
        },
      },
    })

    const gapCards = result.cards.filter((card) => card.tags.includes('gap-framing'))
    expect(gapCards).toHaveLength(2)
    expect(gapCards[0]).toMatchObject({
      category: 'technical',
      title: "What you know, what you don't: GovCloud",
      notes: 'I have not shipped GovCloud directly yet.',
      scriptLabel: 'Bridge This Gap',
      warning: 'Do not imply direct GovCloud ownership. Lean on the transferable proof instead.',
      source: 'ai',
    })
    expect(gapCards[0].script).toBe(
      'I want to be direct: I have not shipped GovCloud directly yet. What transfers well is Shipped regulated platform migrations and audit-heavy environments. That is a focused ramp-up area, not a fundamental mismatch.',
    )
    expect(gapCards[0].keyPoints).toEqual(
      expect.arrayContaining([
        'Closest transferable proof: Shipped regulated platform migrations and audit-heavy environments.',
        'Close by naming the ramp-up plan you would use to get productive in GovCloud.',
      ]),
    )
    expect(gapCards[0].tags).toEqual(
      expect.arrayContaining(['gap-framing', 'transferable-experience', 'govcloud']),
    )
    expect(gapCards[1]).toMatchObject({
      category: 'technical',
      title: "What you know, what you don't: Go",
    })
    expect(gapCards[1].script).toBe(
      'I want to be direct: My experience with Go is adjacent, not end-to-end production ownership yet. What transfers well is Led adjacent distributed systems debugging and service design work. That is a depth gap I can close quickly because the underlying patterns already show up in my work.',
    )
    expect(gapCards[1].tags).toEqual(
      expect.arrayContaining(['gap-framing', 'transferable-experience', 'go']),
    )
    expect(gapCards[1].warning).toBe(
      'Do not imply direct Go ownership if your closest evidence is adjacent.',
    )
    expect(gapCards[1].keyPoints).toEqual(
      expect.arrayContaining([
        'Name the adjacent system or pattern that transfers cleanly into Go.',
      ]),
    )
  })

  it('does not add fallback gap-framing cards when stack alignment has no gaps', async () => {
    callLlmProxyMock.mockResolvedValueOnce(
      JSON.stringify({
        deckTitle: 'Acme Staff Engineer Prep',
        stackAlignment: [
          {
            theirTech: 'Kubernetes',
            yourMatch: 'Built and operated shared platform clusters.',
            confidence: 'Strong',
          },
          {
            theirTech: 'Terraform',
            yourMatch: 'Built shared modules and review guardrails.',
            confidence: 'Solid',
          },
        ],
        cards: [
          {
            category: 'technical',
            title: 'How do you debug a flaky distributed system?',
            tags: ['debugging'],
            script: 'Start with blast radius and the most recent changes.',
          },
        ],
      }),
    )

    const result = await generateInterviewPrep('https://ai.example/proxy', {
      company: 'Acme',
      role: 'Staff Engineer',
      vectorId: 'backend',
      vectorLabel: 'Backend',
      jobDescription: 'Build distributed systems and platform tooling.',
      jdAnalysis: testJdAnalysis,
      resumeContext: {
        resume: {
          basics: { name: 'Alex Example' },
        },
      },
    })

    expect(result.cards.some((card) => card.tags.includes('gap-framing'))).toBe(false)
  })

  it('keeps AI-authored gap-framing cards but forces them into the technical group', async () => {
    callLlmProxyMock.mockResolvedValueOnce(
      JSON.stringify({
        deckTitle: 'Acme Staff Engineer Prep',
        stackAlignment: [
          {
            theirTech: 'GovCloud',
            yourMatch: 'Shipped regulated platform migrations and audit-heavy environments.',
            confidence: 'Gap',
          },
        ],
        cards: [
          {
            category: 'behavioral',
            title: "What you know, what you don't: GovCloud",
            tags: ['gap-framing'],
            notes: 'I have not shipped GovCloud directly yet.',
            script: 'Bridge from regulated platform work.',
            warning: 'Do not pretend the gap is already closed.',
            keyPoints: ['Transferable proof from regulated environments.'],
          },
        ],
      }),
    )

    const result = await generateInterviewPrep('https://ai.example/proxy', {
      company: 'Acme',
      role: 'Staff Engineer',
      vectorId: 'backend',
      vectorLabel: 'Backend',
      jobDescription: 'Build distributed systems and platform tooling.',
      jdAnalysis: testJdAnalysis,
      resumeContext: {
        resume: {
          basics: { name: 'Alex Example' },
        },
      },
    })

    expect(result.cards).toHaveLength(4)
    expect(result.cards[0].category).toBe('technical')
    expect(result.cards[0].tags).toEqual(['gap-framing'])
  })

  it('adds a fallback gap-framing card when the AI title drifts without the canonical tag', async () => {
    callLlmProxyMock.mockResolvedValueOnce(
      JSON.stringify({
        deckTitle: 'Acme Staff Engineer Prep',
        stackAlignment: [
          {
            theirTech: 'GovCloud',
            yourMatch: 'Shipped regulated platform migrations and audit-heavy environments.',
            confidence: 'Gap',
          },
        ],
        cards: [
          {
            category: 'behavioral',
            title: 'What you know, what you don’t: GovCloud',
            tags: ['transferable-experience'],
            notes: 'I have not shipped GovCloud directly yet.',
            script: 'Bridge from regulated platform work.',
            warning: 'Do not pretend the gap is already closed.',
            keyPoints: ['Transferable proof from regulated environments.'],
          },
        ],
      }),
    )

    const result = await generateInterviewPrep('https://ai.example/proxy', {
      company: 'Acme',
      role: 'Staff Engineer',
      vectorId: 'backend',
      vectorLabel: 'Backend',
      jobDescription: 'Build distributed systems and platform tooling.',
      jdAnalysis: testJdAnalysis,
      resumeContext: {
        resume: {
          basics: { name: 'Alex Example' },
        },
      },
    })

    expect(result.cards).toHaveLength(5)
    expect(result.cards.filter((card) => card.tags.includes('gap-framing'))).toHaveLength(1)
  })

  it('canonicalizes case-variant gap-framing tags on AI-authored cards', async () => {
    callLlmProxyMock.mockResolvedValueOnce(
      JSON.stringify({
        deckTitle: 'Acme Staff Engineer Prep',
        stackAlignment: [
          {
            theirTech: 'GovCloud',
            yourMatch: 'Shipped regulated platform migrations and audit-heavy environments.',
            confidence: 'Gap',
          },
        ],
        cards: [
          {
            category: 'behavioral',
            title: 'Gap framing',
            tags: ['Gap-Framing', 'transferable-experience'],
            notes: 'I have not shipped GovCloud directly yet.',
            script: 'Bridge from regulated platform work.',
          },
        ],
      }),
    )

    const result = await generateInterviewPrep('https://ai.example/proxy', {
      company: 'Acme',
      role: 'Staff Engineer',
      vectorId: 'backend',
      vectorLabel: 'Backend',
      jobDescription: 'Build distributed systems and platform tooling.',
      jdAnalysis: testJdAnalysis,
      resumeContext: {
        resume: {
          basics: { name: 'Alex Example' },
        },
      },
    })

    expect(result.cards).toHaveLength(4)
    expect(result.cards[0].category).toBe('technical')
    expect(result.cards[0].tags.filter((tag) => tag === 'gap-framing')).toHaveLength(1)
    expect(result.cards[0].tags).toEqual(['transferable-experience', 'gap-framing'])
  })

  it('deduplicates stack alignment rows by tech before gap-framing fallback generation', async () => {
    callLlmProxyMock.mockResolvedValueOnce(
      JSON.stringify({
        deckTitle: 'Acme Staff Engineer Prep',
        stackAlignment: [
          {
            theirTech: 'Kubernetes',
            yourMatch: 'Ran platform clusters.',
            confidence: 'Gap',
          },
          {
            theirTech: 'kubernetes',
            yourMatch: 'Built cluster tooling.',
            confidence: 'Adjacent experience',
          },
        ],
        cards: [],
      }),
    )

    const result = await generateInterviewPrep('https://ai.example/proxy', {
      company: 'Acme',
      role: 'Staff Engineer',
      vectorId: 'backend',
      vectorLabel: 'Backend',
      jobDescription: 'Build distributed systems and platform tooling.',
      jdAnalysis: testJdAnalysis,
      resumeContext: {
        resume: {
          basics: { name: 'Alex Example' },
        },
      },
    })

    expect(result.stackAlignment).toEqual([
      {
        theirTech: 'Kubernetes',
        yourMatch: 'Ran platform clusters.',
        confidence: 'Gap',
      },
    ])
    expect(result.cards.filter((card) => card.tags.includes('gap-framing'))).toHaveLength(1)
  })

  it('passes prior round debriefs and card state into the prompt', async () => {
    callLlmProxyMock.mockResolvedValueOnce(
      JSON.stringify({
        deckTitle: 'Acme Staff Engineer Prep',
        cards: [
          {
            category: 'opener',
            title: 'Tell me about yourself',
            tags: ['intro'],
            script: 'I build reliable systems.',
          },
        ],
      }),
    )

    await generateInterviewPrep('https://ai.example/proxy', {
      company: 'Acme',
      role: 'Staff Engineer',
      roundNumber: 2,
      roundType: 'hm-screen',
      jobDescription: 'Build distributed systems and platform tooling.',
      jdAnalysis: testJdAnalysis,
      priorRoundDebriefs: [
        {
          round: 1,
          date: '2026-04-21',
          intel: {
            teamCulture: 'Warm but direct.',
            topChallenge: 'Ownership under ambiguity.',
          },
          questionsAsked: ['Tell me about your background.'],
          surprises: ['They cut me off after the opener.'],
          newIntel: ['opener worked'],
          notes: 'opener worked',
        },
      ],
      priorRoundCards: [
        {
          id: 'card-r1',
          category: 'behavioral',
          title: 'Leadership story',
          tags: ['leadership'],
          perRoundState: [{ round: 1, status: 'fumbled', notes: 'Lead with the decision sooner.' }],
        },
      ],
      resumeContext: {
        resume: {
          basics: { name: 'Alex Example' },
        },
      },
    })

    const [, , userPrompt] = callLlmProxyMock.mock.calls[0]

    expect(userPrompt).toContain('Target Round Number: 2')
    expect(userPrompt).toContain('Prior Round Debriefs')
    expect(userPrompt).toContain('Prior Round Card State')
    expect(userPrompt).toContain('Detected Round Contradictions')
    expect(userPrompt).toContain('Ownership under ambiguity.')
    expect(userPrompt).toContain('Lead with the decision sooner.')
    expect(userPrompt).toContain('cut me off')
  })

  it('adds remediation cards for prior-round misses when the model does not carry them forward', async () => {
    callLlmProxyMock.mockResolvedValueOnce(
      JSON.stringify({
        deckTitle: 'Acme Staff Engineer Prep',
        cards: [
          {
            category: 'opener',
            title: 'Tell me about yourself',
            tags: ['intro'],
            script: 'I build reliable systems.',
          },
        ],
      }),
    )

    const result = await generateInterviewPrep('https://ai.example/proxy', {
      company: 'Acme',
      role: 'Staff Engineer',
      roundNumber: 2,
      jobDescription: 'Build distributed systems and platform tooling.',
      jdAnalysis: testJdAnalysis,
      priorRoundCards: [
        {
          id: 'card-r1',
          category: 'behavioral',
          title: 'Leadership story',
          tags: ['leadership'],
          script: 'Walk through the incident response timeline.',
          keyPoints: ['Name the decision early.'],
          perRoundState: [{ round: 1, status: 'fumbled', notes: 'Lead with the decision sooner.' }],
        },
      ],
      resumeContext: {
        resume: {
          basics: { name: 'Alex Example' },
        },
      },
    })

    expect(result.cards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Practice this again: Leadership story',
          tags: expect.arrayContaining(['practice-this']),
          scriptLabel: 'Remediation',
        }),
      ]),
    )
  })

  it('uses the latest known prior-round state for remediation carry-forward', async () => {
    callLlmProxyMock.mockResolvedValueOnce(
      JSON.stringify({
        deckTitle: 'Acme Staff Engineer Prep',
        cards: [
          {
            category: 'opener',
            title: 'Tell me about yourself',
            tags: ['intro'],
            script: 'I build reliable systems.',
          },
        ],
      }),
    )

    const result = await generateInterviewPrep('https://ai.example/proxy', {
      company: 'Acme',
      role: 'Staff Engineer',
      roundNumber: 3,
      jobDescription: 'Build distributed systems and platform tooling.',
      jdAnalysis: testJdAnalysis,
      priorRoundCards: [
        {
          id: 'card-r2',
          category: 'behavioral',
          title: 'Leadership story',
          tags: ['leadership'],
          perRoundState: [{ round: 1, status: 'fumbled', notes: 'Old round 1 miss.' }],
        },
      ],
      resumeContext: {
        resume: {
          basics: { name: 'Alex Example' },
        },
      },
    })

    expect(result.cards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Practice this again: Leadership story',
          tags: expect.arrayContaining(['practice-this']),
        }),
      ]),
    )
  })
})
