export const POSITIONING_EXAMPLES = [
  'Strong match signal. Lead with it.',
  'Strong supporting signal. Mention early.',
  "Standard expectation. Don't oversell.",
  'Useful secondary signal. Mention when relevant.',
  'Specialized signal. Use selectively.',
  'Growth signal. Frame as ramping.',
  "Don't lead with this.",
] as const

export const CUSTOM_POSITIONING_EXAMPLES = [
  'Strong match signal, especially with Python. Rare combo.',
  'Expected for Linux roles. Keep it brief unless the role is infra-heavy.',
  'Lead with platform modernization and Kubernetes operations.',
  'Use as supporting evidence for backend breadth and systems judgment.',
  'Position as recent ramping with real delivery, not deep specialization.',
] as const

export const CUSTOM_POSITIONING_VALUE = '__custom__'

export type PositioningPreset = (typeof POSITIONING_EXAMPLES)[number]
export type PositioningSelection = '' | PositioningPreset | typeof CUSTOM_POSITIONING_VALUE

export const isPositioningPreset = (value: string): value is PositioningPreset =>
  POSITIONING_EXAMPLES.includes(value as PositioningPreset)

export const resolvePositioningSelection = (value: string): PositioningSelection => {
  const trimmed = value.trim()
  if (!trimmed) {
    return ''
  }

  return isPositioningPreset(trimmed) ? trimmed : CUSTOM_POSITIONING_VALUE
}
