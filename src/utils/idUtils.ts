export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function createId(prefix: string) {
  const uuid = globalThis.crypto?.randomUUID?.()
  if (uuid) {
    return `${prefix}-${uuid}`
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export { sanitizeEndpointUrl } from './urlUtils'
