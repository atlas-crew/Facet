import { Sparkles } from 'lucide-react'
import { formatElapsed, useElapsed } from '../hooks/useElapsed'
import './aiActivity.css'

type AiWorkingStatusProps = {
  active: boolean
  /** Headline label, e.g. "Generating thesis". */
  label: string
  /** Optional sub-line of supporting copy, e.g. "Opus is reasoning through your identity model…". */
  caption?: string
  /**
   * Expected duration in milliseconds. Once elapsed exceeds this, the caption
   * switches to an "extended-wait" message so the user knows the call is
   * still alive past its typical envelope. Omit to disable extended-wait copy.
   */
  expectedDurationMs?: number
  /**
   * Copy used after `expectedDurationMs` is exceeded.
   * Defaults to "Still working — past expected duration. The model is taking longer than usual."
   */
  extendedWaitCaption?: string
  /** Show the indeterminate progress bar. Default true. */
  showBar?: boolean
  className?: string
}

const DEFAULT_EXTENDED_WAIT_CAPTION =
  'Still working — past the typical duration. The model is taking longer than usual.'

/**
 * Card-level "AI is working" indicator. Combines a calm pulsing icon, a label,
 * a live elapsed-time counter, an optional caption, and an indeterminate
 * progress bar. Designed for 15s–2min calls (thesis generation, profile
 * inference, identity deepen, etc.) where the user is staring at the screen
 * waiting and the existing button-halo pattern can read as frozen.
 *
 * Renders nothing when `active` is false so it can be safely mounted alongside
 * the trigger UI without affecting layout in the idle state.
 */
export function AiWorkingStatus({
  active,
  label,
  caption,
  expectedDurationMs,
  extendedWaitCaption = DEFAULT_EXTENDED_WAIT_CAPTION,
  showBar = true,
  className,
}: AiWorkingStatusProps) {
  const elapsedMs = useElapsed(active)

  if (!active) return null

  const isExtendedWait =
    expectedDurationMs !== undefined && elapsedMs > expectedDurationMs
  const visibleCaption = isExtendedWait ? extendedWaitCaption : caption

  const classes = ['ai-working-status', className].filter(Boolean).join(' ')

  return (
    <div className={classes} role="status" aria-live="polite" aria-atomic="true">
      <div className="ai-working-status-row">
        <span className="ai-working-status-icon" aria-hidden="true">
          <Sparkles size={16} />
        </span>
        <span className="ai-working-status-label">
          {label}
          <span className="ai-working-status-elapsed"> · {formatElapsed(elapsedMs)}</span>
        </span>
      </div>
      {visibleCaption ? (
        <p
          className={
            'ai-working-status-caption' +
            (isExtendedWait ? ' ai-working-status-caption-extended' : '')
          }
        >
          {visibleCaption}
        </p>
      ) : null}
      {showBar ? (
        <div className="ai-working-status-bar" aria-hidden="true">
          <span className="ai-working-status-bar-fill" />
        </div>
      ) : null}
    </div>
  )
}
