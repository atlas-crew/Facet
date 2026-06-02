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
    <span className={classes} role="status">
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
