import { beforeEach, describe, expect, it, vi } from 'vitest'
import { callLlmProxy, fetchAiProxyCapabilities } from '../utils/llmProxy'

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
      thinkingBudget: 10000,
      outputConfig: {
        task_budget: { type: 'tokens', total: 80000 },
        effort: 'high',
      },
      betas: ['task-budgets-2026-03-13'],
      capabilityFallback: 'opus_unavailable',
      pastedContentTokenCounts: [{ label: 'AI conversation export', tokens: 123 }],
    })

    const [, init] = vi.mocked(fetch).mock.calls[0] ?? []
    expect(JSON.parse((init as RequestInit).body as string)).toEqual(
      expect.objectContaining({
        feature: 'research.thesis',
        model: 'sonnet',
        max_tokens: 128000,
        thinking_budget: 10000,
        capability_fallback: 'opus_unavailable',
        pasted_content_token_counts: [{ label: 'AI conversation export', tokens: 123 }],
        output_config: {
          task_budget: { type: 'tokens', total: 80000 },
          effort: 'high',
        },
        betas: ['task-budgets-2026-03-13'],
      }),
    )
  })

  it('fetches model capability status from the proxy companion endpoint', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        modelCapabilities: {
          opus: {
            available: false,
            model: 'claude-opus-4-7',
            phase1FallbackModel: 'claude-sonnet-4-6',
            phase2Required: true,
          },
          sonnet: { available: true, model: 'claude-sonnet-4-6' },
          haiku: { available: true, model: 'claude-haiku-4-5-20251001' },
        },
      }),
    } as Response)

    const capabilities = await fetchAiProxyCapabilities('https://ai.example/proxy')

    expect(capabilities.modelCapabilities.opus.available).toBe(false)
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe('https://ai.example/proxy/capabilities')
  })
})
