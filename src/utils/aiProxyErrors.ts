import type { FacetAiAccessDenialReason, FacetAiFeatureKey } from '../types/hosted'

type FacetAiProxyErrorCode =
  | 'ai_access_denied'
  | 'ai_overloaded'
  | 'ai_rate_limited'
  | 'auth_required'
  | 'auth_internal_error'

type FacetAiProxyErrorReason =
  | FacetAiAccessDenialReason
  | 'auth_required'
  | 'temporary_capacity'
  | 'rate_limited'

interface FacetAiProxyErrorPayload {
  error?: unknown
  code?: unknown
  reason?: unknown
  feature?: unknown
  message?: unknown
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export class FacetAiProxyError extends Error {
  status: number
  code: FacetAiProxyErrorCode | null
  reason: FacetAiProxyErrorReason | null
  feature: FacetAiFeatureKey | null

  constructor(
    message: string,
    options: {
      status: number
      code?: FacetAiProxyErrorCode | null
      reason?: FacetAiProxyErrorReason | null
      feature?: FacetAiFeatureKey | null
    },
  ) {
    super(message)
    this.name = 'FacetAiProxyError'
    this.status = options.status
    this.code = options.code ?? null
    this.reason = options.reason ?? null
    this.feature = options.feature ?? null
  }
}

function toErrorText(status: number, fallback: string) {
  const message = fallback.trim()
  return `AI proxy error (${status}): ${message.slice(0, 160)}`
}

function readNestedMessage(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim()
  }

  if (!isRecord(value)) {
    return ''
  }

  if (typeof value.message === 'string' && value.message.trim()) {
    return value.message.trim()
  }

  return ''
}

function isBillingIssueMessage(message: string): boolean {
  const normalized = message.toLowerCase()
  return (
    normalized.includes('credit balance is too low') ||
    normalized.includes('plans & billing') ||
    (normalized.includes('billing') && normalized.includes('anthropic api'))
  )
}

function isTemporaryCapacityMessage(message: string): boolean {
  const normalized = message.toLowerCase()
  return (
    normalized.includes('overload') ||
    normalized.includes('try again in a few minutes') ||
    normalized.includes('try again in a moment') ||
    normalized.includes('high demand') ||
    normalized.includes('temporarily unavailable')
  )
}

function isRateLimitMessage(message: string): boolean {
  const normalized = message.toLowerCase()
  return (
    normalized.includes('rate limit') ||
    normalized.includes('too many requests') ||
    normalized.includes('input tokens per minute') ||
    normalized.includes('output tokens per minute')
  )
}

export async function readAiProxyError(response: Response): Promise<Error> {
  const text = await response.text()
  let parsed: unknown = null

  if (text.trim()) {
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = null
    }
  }

  const payload = isRecord(parsed) ? (parsed as FacetAiProxyErrorPayload) : null
  const errorMessage =
    (
      payload &&
      (
        (typeof payload.error === 'string' && payload.error.trim()) ||
        readNestedMessage(payload.error) ||
        (typeof payload.message === 'string' && payload.message.trim())
      )
    ) || text.trim()

  const code =
    payload?.code === 'ai_access_denied' ||
    payload?.code === 'ai_overloaded' ||
    payload?.code === 'ai_rate_limited' ||
    payload?.code === 'auth_required' ||
    payload?.code === 'auth_internal_error'
      ? payload.code
      : null
  const reason =
    payload?.reason === 'upgrade_required' ||
    payload?.reason === 'access_expired' ||
    payload?.reason === 'billing_issue' ||
    payload?.reason === 'self_hosted_proxy_unavailable' ||
    payload?.reason === 'temporary_capacity' ||
    payload?.reason === 'rate_limited' ||
    payload?.reason === 'auth_required'
      ? payload.reason
      : code === 'auth_required'
        ? 'auth_required'
        : null
  const feature = typeof payload?.feature === 'string' ? (payload.feature as FacetAiFeatureKey) : null

  if (code) {
    return new FacetAiProxyError(
      errorMessage || toErrorText(response.status, 'Hosted AI access was denied.'),
      {
        status: response.status,
        code,
        reason,
        feature,
      },
    )
  }

  if (isBillingIssueMessage(errorMessage)) {
    return new FacetAiProxyError(
      'AI proxy billing issue: the Anthropic account behind the proxy is out of credits. Update Plans & Billing and try again.',
      {
        status: response.status,
        code: 'ai_access_denied',
        reason: 'billing_issue',
        feature: null,
      },
    )
  }

  if (response.status === 429 || isRateLimitMessage(errorMessage)) {
    return new FacetAiProxyError(
      'AI provider rate limit reached. Please wait a minute and try again.',
      {
        status: response.status,
        code: 'ai_rate_limited',
        reason: 'rate_limited',
        feature,
      },
    )
  }

  if (response.status === 529 || (response.status >= 500 && isTemporaryCapacityMessage(errorMessage))) {
    return new FacetAiProxyError(
      'AI provider is temporarily overloaded. Please try again in a moment.',
      {
        status: response.status,
        code: 'ai_overloaded',
        reason: 'temporary_capacity',
        feature,
      },
    )
  }

  return new Error(toErrorText(response.status, errorMessage || response.statusText || 'Unknown error'))
}
