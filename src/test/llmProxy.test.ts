import { beforeEach, describe, expect, it, vi } from 'vitest'
import { callLlmProxy } from '../utils/llmProxy'

describe('callLlmProxy', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('passes optional task-budget parameters through to the proxy request body', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: '{"ok":true}' }],
      }),
    } as Response)

    await callLlmProxy('https://ai.example/proxy', 'System', 'User prompt', {
      feature: 'research.thesis',
      model: 'sonnet',
      maxTokens: 128000,
      outputConfig: {
        task_budget: { type: 'tokens', total: 80000 },
        effort: 'high',
      },
      betas: ['task-budgets-2026-03-13'],
    })

    const [, init] = vi.mocked(fetch).mock.calls[0] ?? []
    expect(JSON.parse((init as RequestInit).body as string)).toEqual(
      expect.objectContaining({
        feature: 'research.thesis',
        model: 'sonnet',
        max_tokens: 128000,
        output_config: {
          task_budget: { type: 'tokens', total: 80000 },
          effort: 'high',
        },
        betas: ['task-budgets-2026-03-13'],
      }),
    )
  })
})
