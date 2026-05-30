/**
 * Validates, sanitizes, and normalizes an endpoint URL.
 * Rejects URLs with embedded credentials and non-HTTPS protocols, except local HTTP dev URLs.
 */
export function sanitizeEndpointUrl(raw: string | undefined): string {
  if (!raw) {
    return ''
  }

  try {
    const url = new URL(raw)
    if (url.username || url.password) {
      return ''
    }
    const isLocalHttp =
      url.protocol === 'http:' &&
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]')
    if (url.protocol !== 'https:' && !isLocalHttp) {
      return ''
    }
    return url.toString()
  } catch {
    return ''
  }
}
