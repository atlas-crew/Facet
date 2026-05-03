const RESUME_VECTOR_CONTEXT_KEYS = new Set([
  'vectors',
  'variants',
  'manualOverrides',
  'bulletOrders',
  'presets',
  'vectorId',
  'vectorIds',
  'vectorMode',
  'primaryVectorId',
  'variantId',
  'variantLabel',
  'presetId',
  'resumeVariant',
  'resumeGeneration',
])

export function stripResumeVectorContext(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => stripResumeVectorContext(entry))
  }

  if (!value || typeof value !== 'object') {
    return value
  }

  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) {
    return value
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !RESUME_VECTOR_CONTEXT_KEYS.has(key))
      .map(([key, entry]) => [key, stripResumeVectorContext(entry)]),
  )
}
