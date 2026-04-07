import { facetClientEnv } from './facetEnv'

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '')

export function getHostedApiBaseUrl(): string {
  const configured = facetClientEnv.facetApiBaseUrl
  if (configured) {
    return trimTrailingSlash(configured)
  }

  if (typeof window !== 'undefined') {
    return trimTrailingSlash(window.location.origin)
  }

  return ''
}

export function getHostedPersistenceEndpoint(): string {
  return `${getHostedApiBaseUrl()}/api/persistence`
}
