export const PREP_ANSWER_TEMPLATE_MAX_LENGTH = 2000

function isUnsafeAnswerTemplateChar(char: string): boolean {
  const code = char.charCodeAt(0)
  return (
    (code >= 0x00 && code <= 0x08) ||
    code === 0x0b ||
    code === 0x0c ||
    (code >= 0x0e && code <= 0x1f) ||
    (code >= 0x7f && code <= 0x9f) ||
    (code >= 0x202a && code <= 0x202e) ||
    (code >= 0x2066 && code <= 0x2069)
  )
}

export function normalizePrepAnswerTemplate(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value
    .replace(/\r\n?/g, '\n')
    .split('')
    .filter((char) => !isUnsafeAnswerTemplateChar(char))
    .join('')
    .slice(0, PREP_ANSWER_TEMPLATE_MAX_LENGTH)
    .trim()
  return normalized || undefined
}

export function hasOwnAnswerTemplate(value: unknown): value is { answerTemplate: unknown } {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.prototype.hasOwnProperty.call(value, 'answerTemplate')
  )
}
