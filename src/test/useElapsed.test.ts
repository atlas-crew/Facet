// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { formatElapsed, useElapsed } from '../hooks/useElapsed'

describe('useElapsed', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns 0 while inactive', () => {
    const { result } = renderHook(({ active }) => useElapsed(active), {
      initialProps: { active: false },
    })
    expect(result.current).toBe(0)

    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(result.current).toBe(0)
  })

  it('counts up roughly every second once active', () => {
    const { result } = renderHook(({ active }) => useElapsed(active), {
      initialProps: { active: true },
    })

    expect(result.current).toBe(0)
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current).toBeGreaterThanOrEqual(1000)

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(result.current).toBeGreaterThanOrEqual(3000)
  })

  it('resets to 0 when active flips back to false', () => {
    const { result, rerender } = renderHook(({ active }) => useElapsed(active), {
      initialProps: { active: true },
    })

    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(result.current).toBeGreaterThanOrEqual(3000)

    rerender({ active: false })
    expect(result.current).toBe(0)
  })

  it('restarts from 0 when reactivated', () => {
    const { result, rerender } = renderHook(({ active }) => useElapsed(active), {
      initialProps: { active: true },
    })

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(result.current).toBeGreaterThanOrEqual(2000)

    rerender({ active: false })
    expect(result.current).toBe(0)

    rerender({ active: true })
    expect(result.current).toBe(0)

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current).toBeGreaterThanOrEqual(1000)
  })
})

describe('formatElapsed', () => {
  it('formats seconds-only durations', () => {
    expect(formatElapsed(0)).toBe('0s')
    expect(formatElapsed(999)).toBe('0s')
    expect(formatElapsed(1000)).toBe('1s')
    expect(formatElapsed(47_500)).toBe('47s')
    expect(formatElapsed(59_999)).toBe('59s')
  })

  it('formats minute durations as "Nm Ss"', () => {
    expect(formatElapsed(60_000)).toBe('1m')
    expect(formatElapsed(72_000)).toBe('1m 12s')
    expect(formatElapsed(125_000)).toBe('2m 5s')
  })

  it('clamps negative values to 0s', () => {
    expect(formatElapsed(-500)).toBe('0s')
  })
})
