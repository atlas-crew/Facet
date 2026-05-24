import { useEffect, useState } from 'react'

/**
 * Tracks elapsed milliseconds since `active` last transitioned from false → true.
 *
 * - Returns `0` whenever `active` is false (no timer running).
 * - On activation, the counter resets to 0 and increments approximately every
 *   second; the actual value is computed from `performance.now()` so any drift
 *   in the interval doesn't accumulate.
 * - On deactivation, the interval is cleared and the value resets to 0.
 *
 * Intended for AI-progress UI ("Generating thesis · 23s") where rough seconds
 * resolution is fine. For sub-second precision use `requestAnimationFrame`
 * directly; this hook explicitly targets per-second updates to avoid flooding
 * the render loop on long-running operations.
 */
export function useElapsed(active: boolean): number {
  const [elapsedMs, setElapsedMs] = useState(0)

  useEffect(() => {
    if (!active) {
      // This hook promises an immediate visual reset when work stops.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setElapsedMs(0)
      return
    }

    const startedAt =
      typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now()
    // This hook promises an immediate visual reset on each activation.
    setElapsedMs(0)

    const interval = setInterval(() => {
      const now =
        typeof performance !== 'undefined' && typeof performance.now === 'function'
          ? performance.now()
          : Date.now()
      setElapsedMs(now - startedAt)
    }, 1000)

    return () => {
      clearInterval(interval)
    }
  }, [active])

  return elapsedMs
}

/** Format an elapsed-ms value as a compact human label: `"3s"`, `"47s"`, `"1m 12s"`. */
export function formatElapsed(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000))
  if (totalSeconds < 60) return `${totalSeconds}s`
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`
}
