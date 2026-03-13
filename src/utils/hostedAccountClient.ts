import type {
  FacetBillingCheckoutSessionResponse,
  FacetBillingCustomerLinkResponse,
  FacetHostedAccountContextResponse,
} from '../types/hosted'

const DEFAULT_PROXY_API_KEY = 'facet-local-proxy'

interface HostedAccountClientOptions {
  endpoint: string
  bearerToken: string
  proxyApiKey?: string
  fetchFn?: typeof fetch
}

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '')

async function readJson<T>(response: Response): Promise<T> {
  const payload = await response.json()
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
        ? payload.error
        : `Hosted account API error (${response.status})`
    throw new Error(message)
  }

  return payload as T
}

function createRequest(options: HostedAccountClientOptions) {
  const baseUrl = trimTrailingSlash(options.endpoint)
  const fetchFn = options.fetchFn ?? fetch

  return (path: string, init: RequestInit = {}) =>
    fetchFn(`${baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${options.bearerToken}`,
        'Content-Type': 'application/json',
        'X-Proxy-API-Key': options.proxyApiKey ?? DEFAULT_PROXY_API_KEY,
        ...(init.headers ?? {}),
      },
    })
}

export async function fetchHostedAccountContext(
  options: HostedAccountClientOptions,
): Promise<FacetHostedAccountContextResponse> {
  const response = await createRequest(options)('/api/account/context', {
    method: 'GET',
  })
  return readJson<FacetHostedAccountContextResponse>(response)
}

export async function createHostedBillingCustomer(
  options: HostedAccountClientOptions,
  customerId?: string,
): Promise<FacetBillingCustomerLinkResponse> {
  const response = await createRequest(options)('/api/billing/customer', {
    method: 'POST',
    body: JSON.stringify(customerId ? { customerId } : {}),
  })
  return readJson<FacetBillingCustomerLinkResponse>(response)
}

export async function createHostedCheckoutSession(
  options: HostedAccountClientOptions,
): Promise<FacetBillingCheckoutSessionResponse> {
  const response = await createRequest(options)('/api/billing/checkout-session', {
    method: 'POST',
    body: JSON.stringify({}),
  })
  return readJson<FacetBillingCheckoutSessionResponse>(response)
}
