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
    <span className={classes} aria-live="polite" aria-atomic="true">
      {active ? (
        <>
          <span className="ai-activity-indicator-orb" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span className="ai-activity-indicator-label">{label}</span>
        </>
      ) : null}
    </span>
  )
}
