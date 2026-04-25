import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SearchFeedbackEvent } from '../types/search'
import {
  buildThesisGenerationPrompt,
  generateSearchThesisFromIdentity,
  validateSearchThesis,
} from '../utils/thesisGenerator'
import { cloneIdentityFixture } from './fixtures/identityFixture'

const { mockCallLlmProxy } = vi.hoisted(() => ({
  mockCallLlmProxy: vi.fn(),
}))

vi.mock('../utils/llmProxy', async () => {
  const actual = await vi.importActual<typeof import('../utils/llmProxy')>('../utils/llmProxy')
  return {
    ...actual,
    callLlmProxy: (...args: Parameters<typeof actual.callLlmProxy>) => mockCallLlmProxy(...args),
  }
})

const narrative = [
  'Alex should search for platform roles where deployment architecture is not background plumbing but a product lever. The identity evidence points to someone who can translate infrastructure constraints into reliable customer delivery.',
  'The strongest moat is the mix of Kubernetes implementation depth and product-facing judgment. That is rarer than generic backend experience because it lets Alex evaluate whether a company needs platform architecture, developer productivity, or simple operations coverage.',
  'The search should prioritize modernization teams with explicit signals around installability, on-prem delivery, and internal platform leverage. It should avoid jobs where Kubernetes administration is the product instead of the enabling substrate.',
].join('\n\n')

describe('thesisGenerator', () => {
  beforeEach(() => {
    mockCallLlmProxy.mockReset()
  })

  it('builds a full identity prompt with pending feedback events', () => {
    const identity = cloneIdentityFixture()
    const prompt = buildThesisGenerationPrompt(identity, [
      {
        id: 'fb-1',
        createdAt: '2026-04-20T10:00:00.000Z',
        runId: 'srun-1',
        resultId: 'sres-1',
        rating: 'down',
        reason: 'Too much Kubernetes admin framing',
        appliedToIdentity: false,
      },
    ])

    expect(prompt).toContain('Professional identity model:')
    expect(prompt).toContain('"self_model"')
    expect(prompt).toContain('"preferences"')
    expect(prompt).toContain('"skills"')
    expect(prompt).toContain('"roles"')
    expect(prompt).toContain('Too much Kubernetes admin framing')
  })

  it('generates a normalized thesis with Opus thinking budget options', async () => {
    const identity = cloneIdentityFixture()
    identity.model_revision = 7
    const feedback: SearchFeedbackEvent[] = [
      {
        id: 'fb-1',
        createdAt: '2026-04-20T10:00:00.000Z',
        runId: 'srun-1',
        resultId: 'sres-1',
        rating: 'down',
        reason: 'Prefer modernization over cluster admin roles',
        appliedToIdentity: false,
      },
    ]

    mockCallLlmProxy.mockResolvedValueOnce(
      '<result>' +
        JSON.stringify({
          id: 'sthesis-generated',
          narrative,
          competitiveMoat:
            'Kubernetes delivery depth combined with product-aware platform strategy and customer deployment evidence.',
          unfairAdvantages: [
            {
              combination: 'Kubernetes delivery plus product judgment',
              depth: 'strong',
              targetCompanyProfile: 'Platform modernization teams',
            },
          ],
          searchLanes: [
            {
              id: 'lane-modernization',
              title: 'Platform modernization',
              rationale:
                'This lane is strong because it seeks teams whose deployment model is strategically important. It fits the identity evidence without reducing the role to cluster administration.',
              targetSignals: ['on-prem delivery', 'installability'],
            },
          ],
          interviewStrategy: 'Anchor on deployment architecture tradeoffs and product delivery outcomes.',
          lookFor: ['platform modernization', 'developer leverage'],
          avoid: [
            {
              label: 'Pure Kubernetes administration',
              condition: 'Building around Kubernetes is fine; owning clusters as the whole job is not.',
            },
          ],
          keywordCombinations: [
            {
              query: '"platform modernization" Kubernetes',
              lane: 'lane-modernization',
              noiseLevel: 'low',
            },
          ],
          skillDepthMap: [
            {
              skill: 'Kubernetes',
              depth: 'strong',
              context: 'Contoso evidence shows Kubernetes-based installs that unlocked customer deployment paths.',
              searchSignal: 'Use as a strong match signal for deployment architecture roles.',
            },
          ],
          feedbackIncorporated: ['fb-1', 'made-up-feedback-id'],
        }) +
        '</result>',
    )

    const result = await generateSearchThesisFromIdentity(
      identity,
      'https://ai.example/proxy',
      feedback,
    )

    expect(mockCallLlmProxy).toHaveBeenCalledWith(
      'https://ai.example/proxy',
      expect.stringContaining('SearchThesis'),
      expect.stringContaining('"model_revision":7'),
      expect.objectContaining({
        feature: 'research.thesis',
        model: 'opus',
        maxTokens: 32000,
        thinkingBudget: 10000,
        timeoutMs: 90000,
      }),
    )
    expect(result.thesis).toMatchObject({
      id: 'sthesis-generated',
      identityVersion: 7,
      source: 'generated',
      feedbackIncorporated: ['fb-1'],
    })
    expect(result.contractViolations).toEqual([])
  })

  it('fails before calling the proxy when identity context is too large', async () => {
    const identity = cloneIdentityFixture()
    identity.roles[0]!.bullets[0]!.action = 'x'.repeat(130_000)

    await expect(
      generateSearchThesisFromIdentity(identity, 'https://ai.example/proxy'),
    ).rejects.toThrow(/too large for thesis generation/i)
    expect(mockCallLlmProxy).not.toHaveBeenCalled()
  })

  it('wraps malformed model responses in an actionable error', async () => {
    mockCallLlmProxy.mockResolvedValueOnce('no json here')

    await expect(
      generateSearchThesisFromIdentity(cloneIdentityFixture(), 'https://ai.example/proxy'),
    ).rejects.toThrow(/malformed/i)
  })

  it('validates narrative, lane rationale, and identity skill coverage', () => {
    const identity = cloneIdentityFixture()
    const violations = validateSearchThesis({
      id: 'sthesis-short',
      createdAt: '2026-04-20T10:00:00.000Z',
      updatedAt: '2026-04-20T10:00:00.000Z',
      narrative: 'Too short.',
      competitiveMoat: 'Thin.',
      unfairAdvantages: [],
      searchLanes: [
        {
          id: 'lane-1',
          title: 'Generic lane',
          rationale: 'One sentence only.',
          targetSignals: [],
        },
      ],
      interviewStrategy: '',
      lookFor: [],
      avoid: [],
      keywordCombinations: [],
      skillDepthMap: [],
      source: 'generated',
      identityVersion: 0,
      feedbackIncorporated: [],
    }, identity)

    expect(violations).toEqual(
      expect.arrayContaining([
        'narrative: expected 3-5 paragraphs with at least 240 characters',
        'competitiveMoat: missing or too short',
        'searchLanes[0].rationale: expected prose rationale with at least 2 sentences',
        'skillDepthMap: expected at least one skill-depth entry',
        'skillDepthMap: missing identity skills: Kubernetes',
      ]),
    )
  })
})
