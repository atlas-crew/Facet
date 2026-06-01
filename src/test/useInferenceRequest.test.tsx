// @vitest-environment jsdom

import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useInferenceRequest } from '../routes/identity/useInferenceRequest'

describe('useInferenceRequest', () => {
  it('does not fire on mount and fires once per request id increment', () => {
    const handler = vi.fn()
    const { rerender } = renderHook(
      ({ requestId }) => useInferenceRequest({ requestId, handler }),
      { initialProps: { requestId: 0 } },
    )

    expect(handler).not.toHaveBeenCalled()

    rerender({ requestId: 1 })
    expect(handler).toHaveBeenCalledTimes(1)

    rerender({ requestId: 2 })
    expect(handler).toHaveBeenCalledTimes(2)
  })

  it('runs the skipped callback instead of the handler when the guard is active', () => {
    const handler = vi.fn()
    const onSkipped = vi.fn()
    const { rerender } = renderHook(
      ({ requestId, blocked }) =>
        useInferenceRequest({
          requestId,
          handler,
          skipWhen: () => blocked,
          onSkipped,
        }),
      { initialProps: { requestId: 0, blocked: true } },
    )

    rerender({ requestId: 1, blocked: true })

    expect(handler).not.toHaveBeenCalled()
    expect(onSkipped).toHaveBeenCalledTimes(1)
  })

  it('uses the latest handler closure when a later request id arrives', () => {
    const seen: string[] = []
    const { rerender } = renderHook(
      ({ requestId, label }) =>
        useInferenceRequest({
          requestId,
          handler: () => {
            seen.push(label)
          },
        }),
      { initialProps: { requestId: 0, label: 'first' } },
    )

    rerender({ requestId: 0, label: 'second' })
    rerender({ requestId: 1, label: 'second' })

    expect(seen).toEqual(['second'])
  })
})
