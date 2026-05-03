export const cloneValue = <T>(value: T): T => {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }

  // Fallback is intentionally limited to plain JSON-safe values.
  return JSON.parse(JSON.stringify(value)) as T
}
