import { describe, expect, it } from 'vitest'
import { FacetAiProxyError, readAiProxyError } from '../utils/aiProxyErrors'

describe('readAiProxyError', () => {
  it('maps Anthropic low-credit payloads to a Facet billing issue error', async () => {
    const response = new Response(
      JSON.stringify({
        type: 'error',
        error: {
          type: 'invalid_request_error',
          message:
            'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.',
        },
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      },
    )

    const error = await readAiProxyError(response)

    expect(error).toBeInstanceOf(FacetAiProxyError)
    expect(error.message).toBe(
      'AI proxy billing issue: the Anthropic account behind the proxy is out of credits. Update Plans & Billing and try again.',
    )
    expect((error as FacetAiProxyError).reason).toBe('billing_issue')
    expect((error as FacetAiProxyError).code).toBe('ai_access_denied')
    expect((error as FacetAiProxyError).status).toBe(400)
  })

  it('maps provider overload payloads to a friendly retryable error', async () => {
    const response = new Response(
      JSON.stringify({
        error: 'Overloaded. Please try again in a few minutes.',
      }),
      {
        status: 529,
        headers: { 'Content-Type': 'application/json' },
      },
    )

    const error = await readAiProxyError(response)

    expect(error).toBeInstanceOf(FacetAiProxyError)
    expect(error.message).toBe(
      'AI provider is temporarily overloaded. Please try again in a moment.',
    )
    expect((error as FacetAiProxyError).code).toBe('ai_overloaded')
    expect((error as FacetAiProxyError).reason).toBe('temporary_capacity')
    expect((error as FacetAiProxyError).status).toBe(529)
  })

  it('maps provider rate-limit payloads to a friendly retryable error', async () => {
    const response = new Response(
      JSON.stringify({
        type: 'error',
        error: {
          type: 'rate_limit_error',
          message:
            "This request would exceed your organization's rate limit of 30,000 input tokens per minute.",
        },
      }),
      {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      },
    )

    const error = await readAiProxyError(response)

    expect(error).toBeInstanceOf(FacetAiProxyError)
    expect(error.message).toBe(
      'AI provider rate limit reached. Please wait a minute and try again.',
    )
    expect((error as FacetAiProxyError).code).toBe('ai_rate_limited')
    expect((error as FacetAiProxyError).reason).toBe('rate_limited')
    expect((error as FacetAiProxyError).status).toBe(429)
  })
})
