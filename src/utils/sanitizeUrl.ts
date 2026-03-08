const SAFE_PROTOCOLS = new Set(['https:', 'http:'])

/**
 * Returns the URL if it uses a safe protocol (http/https), otherwise null.
 * Blocks javascript:, data:, vbscript:, and other dangerous schemes.
 */
export function sanitizeUrl(raw: string | undefined | null): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  try {
    const parsed = new URL(trimmed)
    return SAFE_PROTOCOLS.has(parsed.protocol) ? trimmed : null
  } catch {
    return null
  }
}
