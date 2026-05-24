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

  it('maps provider authentication payloads to proxy auth configuration errors', async () => {
    const response = new Response(
      JSON.stringify({
        type: 'error',
        error: {
          type: 'authentication_error',
          message: 'Invalid API key.',
        },
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      },
    )

    const error = await readAiProxyError(response)

    expect(error).toBeInstanceOf(FacetAiProxyError)
    expect(error.message).toBe('Invalid API key.')
    expect((error as FacetAiProxyError).code).toBe('auth_internal_error')
    expect((error as FacetAiProxyError).reason).toBeNull()
    expect((error as FacetAiProxyError).status).toBe(401)
  })

  it('uses the provider auth fallback message when the trimmed error type has no message', async () => {
    const response = new Response(
      JSON.stringify({
        type: 'error',
        error: {
          type: ' authentication_error ',
        },
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      },
    )

    const error = await readAiProxyError(response)

    expect(error).toBeInstanceOf(FacetAiProxyError)
    expect(error.message).toBe(
      'AI proxy authentication failed. Check the configured provider credentials and try again.',
    )
    expect((error as FacetAiProxyError).code).toBe('auth_internal_error')
    expect((error as FacetAiProxyError).status).toBe(401)
  })

  it('uses root-level provider auth messages when nested errors omit a message', async () => {
    const response = new Response(
      JSON.stringify({
        type: 'error',
        error: {
          type: 'authentication_error',
        },
        message: 'Root level auth message',
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      },
    )

    const error = await readAiProxyError(response)

    expect(error).toBeInstanceOf(FacetAiProxyError)
    expect(error.message).toBe('Root level auth message')
    expect((error as FacetAiProxyError).code).toBe('auth_internal_error')
  })

  it('maps raw unauthorized proxy responses to the auth fallback error', async () => {
    const response = new Response('', {
      status: 401,
      statusText: 'Unauthorized',
    })

    const error = await readAiProxyError(response)

    expect(error).toBeInstanceOf(FacetAiProxyError)
    expect(error.message).toBe(
      'AI proxy authentication failed. Check the configured provider credentials and try again.',
    )
    expect((error as FacetAiProxyError).code).toBe('auth_internal_error')
    expect((error as FacetAiProxyError).status).toBe(401)
  })

  it('preserves explicit hosted auth-required proxy payloads', async () => {
    const response = new Response(
      JSON.stringify({
        error: 'Sign in to use hosted AI.',
        code: 'auth_required',
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      },
    )

    const error = await readAiProxyError(response)

    expect(error).toBeInstanceOf(FacetAiProxyError)
    expect(error.message).toBe('Sign in to use hosted AI.')
    expect((error as FacetAiProxyError).code).toBe('auth_required')
    expect((error as FacetAiProxyError).reason).toBe('auth_required')
    expect((error as FacetAiProxyError).status).toBe(401)
  })

  it('returns generic errors for malformed or non-JSON proxy responses without crashing', async () => {
    const malformed = await readAiProxyError(
      new Response('{"error": "truncated"', {
        status: 502,
        statusText: 'Bad Gateway',
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const html = await readAiProxyError(
      new Response('<html>Gateway timeout</html>', {
        status: 504,
        statusText: 'Gateway Timeout',
        headers: { 'Content-Type': 'text/html' },
      }),
    )

    expect(malformed).not.toBeInstanceOf(FacetAiProxyError)
    expect(malformed.message).toBe('AI proxy error (502): {"error": "truncated"')
    expect(html).not.toBeInstanceOf(FacetAiProxyError)
    expect(html.message).toBe('AI proxy error (504): <html>Gateway timeout</html>')
  })

  it('uses status fallback text for empty proxy error bodies', async () => {
    const response = new Response('', {
      status: 503,
      statusText: 'Service Unavailable',
    })

    const error = await readAiProxyError(response)

    expect(error).not.toBeInstanceOf(FacetAiProxyError)
    expect(error.message).toBe('AI proxy error (503): Service Unavailable')
  })

  it('handles structurally incomplete JSON payloads without crashing', async () => {
    const response = new Response(JSON.stringify({ error: {} }), {
      status: 500,
      statusText: 'Internal Server Error',
      headers: { 'Content-Type': 'application/json' },
    })

    const error = await readAiProxyError(response)

    expect(error).not.toBeInstanceOf(FacetAiProxyError)
    expect(error.message).toBe('AI proxy error (500): {"error":{}}')
  })

  it('falls back cleanly if the response body has already been consumed', async () => {
    const response = new Response('consumed upstream', {
      status: 500,
      statusText: 'Internal Server Error',
    })
    await response.text()

    const error = await readAiProxyError(response)

    expect(error).not.toBeInstanceOf(FacetAiProxyError)
    expect(error.message).toBe('AI proxy error (500): Internal Server Error')
  })

  it('preserves explicit Opus capability errors from the proxy', async () => {
    const response = new Response(
      JSON.stringify({
        error: 'Opus is currently unavailable.',
        code: 'ai_capability_unavailable',
        reason: 'opus_unavailable',
        feature: 'research.thesis',
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      },
    )

    const error = await readAiProxyError(response)

    expect(error).toBeInstanceOf(FacetAiProxyError)
    expect(error.message).toBe('Opus is currently unavailable.')
    expect((error as FacetAiProxyError).code).toBe('ai_capability_unavailable')
    expect((error as FacetAiProxyError).reason).toBe('opus_unavailable')
    expect((error as FacetAiProxyError).feature).toBe('research.thesis')
    expect((error as FacetAiProxyError).status).toBe(503)
  })
})
