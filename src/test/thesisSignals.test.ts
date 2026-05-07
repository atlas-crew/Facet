import { describe, expect, it } from 'vitest'
import type { SearchThesisSignal } from '../types/search'
import { reconcileThesisSignalsFromLabels } from '../utils/thesisSignals'

const signals: SearchThesisSignal[] = [
  { id: 'ssig-a', label: 'Alpha', severity: 'hard', condition: 'must stay' },
  { id: 'ssig-b', label: 'Beta', severity: 'conditional', condition: 'when scoped' },
  { id: 'ssig-c', label: 'Gamma', severity: 'soft' },
]

describe('thesis signal reconciliation', () => {
  it('preserves ids and metadata when labels are reordered', () => {
    expect(reconcileThesisSignalsFromLabels(signals, ['Beta', 'Alpha'])).toEqual([
      signals[1],
      signals[0],
    ])
  })

  it('preserves positional identity when a label is renamed', () => {
    expect(reconcileThesisSignalsFromLabels(signals, ['Alpha Prime', 'Beta'])).toEqual([
      { ...signals[0], label: 'Alpha Prime' },
      signals[1],
    ])
  })

  it('does not steal an id from a later exact label match', () => {
    const reconciled = reconcileThesisSignalsFromLabels(signals, ['Renamed', 'Alpha'])

    expect(reconciled[0]).toEqual(
      expect.objectContaining({
        label: 'Renamed',
        severity: 'soft',
      }),
    )
    expect(reconciled[0]?.id).not.toBe('ssig-a')
    expect(reconciled[1]).toEqual(signals[0])
  })

  it('deduplicates case-insensitive input labels and drops deleted signals', () => {
    expect(reconcileThesisSignalsFromLabels(signals, ['alpha', 'ALPHA', 'Gamma'])).toEqual([
      { ...signals[0], label: 'alpha' },
      signals[2],
    ])
  })

  it('mints ids for appended labels', () => {
    const reconciled = reconcileThesisSignalsFromLabels(signals.slice(0, 1), [
      'Alpha',
      'Delta',
    ])

    expect(reconciled[0]).toEqual(signals[0])
    expect(reconciled[1]).toEqual(
      expect.objectContaining({
        label: 'Delta',
        severity: 'soft',
      }),
    )
    expect(reconciled[1]?.id).toMatch(/^ssig-/)
  })
})
