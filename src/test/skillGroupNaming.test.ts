import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProfessionalSkillGroup } from '../identity/schema'
import { cloneIdentityFixture } from './fixtures/identityFixture'

const { callLlmProxyMock } = vi.hoisted(() => ({
  callLlmProxyMock: vi.fn(),
}))

vi.mock('../utils/llmProxy', async () => {
  const actual = await vi.importActual<typeof import('../utils/llmProxy')>('../utils/llmProxy')
  return {
    ...actual,
    callLlmProxy: (...args: Parameters<typeof actual.callLlmProxy>) => callLlmProxyMock(...args),
  }
})

import {
  applySkillGroupNameSuggestions,
  generateSkillGroupNameSuggestions,
} from '../utils/skillGroupNaming'

beforeEach(() => {
  callLlmProxyMock.mockReset()
})

describe('skill group naming', () => {
  it('applies suggested labels while preserving group metadata and items', () => {
    const items = [{ name: 'Kubernetes', tags: ['platform'] }]
    const groups: ProfessionalSkillGroup[] = [
      {
        id: 'platform',
        label: 'Skills 1',
        positioning: 'Lead with platform evidence.',
        calibration: 'Primary for infrastructure roles.',
        is_differentiator: true,
        items,
      },
      {
        id: 'languages',
        label: 'Languages',
        items: [{ name: 'TypeScript', tags: ['typescript'] }],
      },
      {
        id: 'systems',
        label: 'Systems',
        items: [{ name: 'Linux', tags: ['systems'] }],
      },
      {
        id: 'runaway',
        label: 'Writing',
        items: [{ name: 'Executive narratives', tags: ['communication'] }],
      },
    ]
    const tooLongLabel = 'Executive Narrative Systems and Cross Functional Communication Strategy'

    const renamed = applySkillGroupNameSuggestions(groups, [
      {
        groupId: 'platform',
        currentLabel: 'Skills 1',
        suggestedLabel: 'Platform Infrastructure',
      },
      {
        groupId: 'languages',
        currentLabel: 'Languages',
        suggestedLabel: 'Skills 2',
      },
      {
        groupId: 'missing',
        currentLabel: 'Missing',
        suggestedLabel: 'Missing Group',
      },
      {
        groupId: 'systems',
        currentLabel: 'Systems',
        suggestedLabel: 'platform infrastructure',
      },
      {
        groupId: 'runaway',
        currentLabel: 'Writing',
        suggestedLabel: tooLongLabel,
      },
    ])

    expect(renamed[0]).toEqual({
      ...groups[0],
      label: 'Platform Infrastructure',
    })
    expect(renamed[0]!.items).toBe(items)
    expect(renamed[1]).toBe(groups[1])
    expect(renamed[2]).toBe(groups[2])
    expect(renamed[3]).toBe(groups[3])
  })

  it('does not rewrite a group when the suggestion matches the current label', () => {
    const groups: ProfessionalSkillGroup[] = [
      {
        id: 'platform',
        label: 'Platform Infrastructure',
        items: [{ name: 'Kubernetes', tags: ['platform'] }],
      },
    ]

    const renamed = applySkillGroupNameSuggestions(groups, [
      {
        groupId: 'platform',
        currentLabel: 'Platform Infrastructure',
        suggestedLabel: ' Platform Infrastructure ',
      },
    ])

    expect(renamed[0]).toBe(groups[0])
  })

  it('generates only changed non-generic labels with the dedicated proxy feature', async () => {
    const identity = cloneIdentityFixture()
    identity.skills.groups = [
      {
        id: 'platform',
        label: 'Skills 1',
        items: [{ name: 'Kubernetes', tags: ['platform'] }],
      },
      {
        id: 'languages',
        label: 'Application Languages',
        items: [{ name: 'TypeScript', tags: ['typescript'] }],
      },
      {
        id: 'generic',
        label: 'Also',
        items: [{ name: 'Writing', tags: ['communication'] }],
      },
      {
        id: 'systems',
        label: 'Systems',
        items: [{ name: 'Linux', tags: ['systems'] }],
      },
    ]
    callLlmProxyMock.mockResolvedValueOnce(
      JSON.stringify({
        groups: [
          {
            groupId: 'platform',
            suggestedLabel: 'Platform Infrastructure',
          },
          {
            groupId: 'languages',
            suggestedLabel: ' Application Languages ',
          },
          {
            groupId: 'generic',
            suggestedLabel: 'Skills 2',
          },
          {
            groupId: 'systems',
            suggestedLabel: 'platform infrastructure',
          },
        ],
      }),
    )

    const suggestions = await generateSkillGroupNameSuggestions({
      endpoint: 'https://ai.example/proxy',
      identity,
    })

    expect(suggestions).toEqual([
      {
        groupId: 'platform',
        currentLabel: 'Skills 1',
        suggestedLabel: 'Platform Infrastructure',
      },
    ])
    expect(callLlmProxyMock).toHaveBeenCalledWith(
      'https://ai.example/proxy',
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        feature: 'identity.skill-group-naming',
        timeoutMs: 45000,
      }),
    )
  })
})
