const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '')

export function getHostedApiBaseUrl(): string {
  const configured = (import.meta.env.VITE_FACET_API_BASE_URL as string | undefined)?.trim()
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
