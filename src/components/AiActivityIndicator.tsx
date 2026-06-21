import './aiActivity.css'

type AiActivityIndicatorProps = {
  active: boolean
  label: string
  className?: string
}

export function AiActivityIndicator({
  active,
  label,
  className,
}: AiActivityIndicatorProps) {
  const classes = [
    'ai-activity-indicator',
    active ? 'is-active' : 'is-idle',
    className,
  ].filter(Boolean).join(' ')

  return (
    // Only a live region while there's something to announce. An idle indicator renders an empty
    // span; keeping role="status" on it pollutes the a11y tree and collides with page-level status
    // banners (two role="status" nodes break single-element getByRole('status') queries).
    <span className={classes} role={active ? 'status' : undefined}>
      {active ? (
        <>
          <span className="ai-activity-indicator-row">
            <span className="ai-activity-indicator-orb" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span className="ai-activity-indicator-label">{label}</span>
          </span>
          <span className="ai-activity-indicator-bar" aria-hidden="true">
            <span className="ai-activity-indicator-bar-fill" />
          </span>
        </>
      ) : null}
    </span>
  )
}
