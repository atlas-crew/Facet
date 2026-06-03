import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cloneIdentityFixture } from './fixtures/identityFixture'

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

import { generateSkillEnrichmentSuggestion } from '../utils/skillEnrichment'

describe('generateSkillEnrichmentSuggestion', () => {
  beforeEach(() => {
    callLlmProxyMock.mockReset()
  })

  const createInput = () => {
    const identity = cloneIdentityFixture()
    const group = identity.skills.groups[0]!
    const skill = group.items[0]!
    return {
      endpoint: 'https://ai.example/proxy',
      identity,
      group,
      skill,
    }
  }

  it('parses camelCase depthConfidence from LLM output', async () => {
    callLlmProxyMock.mockResolvedValueOnce(
      JSON.stringify({
        depth: 'strong',
        depthConfidence: 'high',
        context: 'Owns Kubernetes deployment architecture.',
        positioning: 'Mention when platform deployment is relevant.',
      }),
    )

    await expect(generateSkillEnrichmentSuggestion(createInput())).resolves.toMatchObject({
      depth: 'strong',
      depthConfidence: 'high',
      context: 'Owns Kubernetes deployment architecture.',
      positioning: 'Mention when platform deployment is relevant.',
    })
  })

  it('parses snake_case depth_confidence from LLM output', async () => {
    callLlmProxyMock.mockResolvedValueOnce(
      JSON.stringify({
        depth: 'working',
        depth_confidence: 'medium',
        context: 'Uses Kubernetes as a platform user.',
        positioning: 'Mention as supporting infrastructure fluency.',
      }),
    )

    await expect(generateSkillEnrichmentSuggestion(createInput())).resolves.toMatchObject({
      depth: 'working',
      depthConfidence: 'medium',
    })
  })

  it('rejects invalid depthConfidence values from LLM output', async () => {
    callLlmProxyMock.mockResolvedValueOnce(
      JSON.stringify({
        depth: 'strong',
        depthConfidence: 'very-high',
        context: '',
        positioning: '',
      }),
    )

    await expect(generateSkillEnrichmentSuggestion(createInput())).rejects.toThrow(
      /depth confidence/i,
    )
  })

  it('drops depthConfidence when LLM output omits depth', async () => {
    callLlmProxyMock.mockResolvedValueOnce(
      JSON.stringify({
        depth: null,
        depthConfidence: 'high',
        context: 'Existing context only.',
        positioning: '',
      }),
    )

    const suggestion = await generateSkillEnrichmentSuggestion(createInput())

    expect(suggestion).toMatchObject({ context: 'Existing context only.' })
    expect(suggestion).not.toHaveProperty('depthConfidence')
  })
})
