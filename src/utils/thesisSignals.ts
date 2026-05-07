import type { SearchThesisSignal } from '../types/search'
import { createId } from './idUtils'

const signalLabelKey = (label: string): string => label.trim().toLowerCase()

export const createSearchThesisSignal = (
  label: string,
  severity: SearchThesisSignal['severity'] = 'soft',
): SearchThesisSignal => ({
  id: createId('ssig'),
  label,
  severity,
})

export const reconcileThesisSignalsFromLabels = (
  current: readonly SearchThesisSignal[],
  labels: readonly string[],
): SearchThesisSignal[] => {
  const byLabel = new Map<string, SearchThesisSignal[]>()
  current.forEach((signal) => {
    const key = signalLabelKey(signal.label)
    byLabel.set(key, [...(byLabel.get(key) ?? []), signal])
  })

  const incomingKeys = new Set(
    labels.map((rawLabel) => signalLabelKey(rawLabel)).filter((key) => key.length > 0),
  )
  const emitted = new Set<string>()
  const consumed = new Set<SearchThesisSignal>()
  return labels.flatMap((rawLabel, index) => {
    const label = rawLabel.trim()
    const key = signalLabelKey(label)
    if (!label || emitted.has(key)) return []
    emitted.add(key)

    const existing =
      byLabel.get(key)?.find((signal) => !consumed.has(signal)) ??
      (current[index] &&
      !consumed.has(current[index]) &&
      !incomingKeys.has(signalLabelKey(current[index].label))
        ? current[index]
        : undefined)
    if (existing) consumed.add(existing)
    return [existing ? { ...existing, label } : createSearchThesisSignal(label)]
  })
}
