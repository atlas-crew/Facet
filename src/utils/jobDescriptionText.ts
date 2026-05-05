const MAX_PIPELINE_JOB_DESCRIPTION_BYTES = 50_000
const textEncoder = new TextEncoder()

export const normalizeJobDescriptionText = (value: unknown): string => {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  if (!trimmed) return ''

  if (textEncoder.encode(trimmed).byteLength <= MAX_PIPELINE_JOB_DESCRIPTION_BYTES) {
    return trimmed
  }

  let byteCount = 0
  let result = ''
  for (const character of trimmed) {
    const characterBytes = textEncoder.encode(character).byteLength
    if (byteCount + characterBytes > MAX_PIPELINE_JOB_DESCRIPTION_BYTES) break
    result += character
    byteCount += characterBytes
  }
  return result
}

export const normalizeJobDescriptionSourceUrl = (
  value: unknown,
  expectedPostingUrl?: string,
): string | undefined => {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined

  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined

    const expectedTrimmed = expectedPostingUrl?.trim()
    if (expectedTrimmed) {
      const expected = new URL(expectedTrimmed)
      if (parsed.origin !== expected.origin) return undefined
    }

    return parsed.toString()
  } catch {
    return undefined
  }
}
