import { Link, type ErrorComponentProps } from '@tanstack/react-router'
import { AlertTriangle, Home, RefreshCw, RotateCcw } from 'lucide-react'
import { reloadPage } from '../utils/windowLocation'

export function RouteErrorFallback({ error, reset }: ErrorComponentProps) {
  const message =
    error instanceof Error && error.message.trim()
      ? error.message
      : 'The current workspace view stopped rendering.'

  return (
    <div className="route-error-boundary" role="alert" aria-labelledby="route-error-title">
      <AlertTriangle
        className="route-error-icon"
        size={24}
        strokeWidth={1.75}
        aria-hidden="true"
      />
      <div className="route-error-content">
        <p className="route-error-eyebrow">Workspace interrupted</p>
        <h2 id="route-error-title">This view hit a rendering error.</h2>
        <p>
          Your workspace data is still available. Retry this view, go back to Overview, or reload
          the workspace if the problem repeats.
        </p>
        <details className="route-error-details">
          <summary>Error details</summary>
          <code>{message}</code>
        </details>
        <div className="route-error-actions">
          <button className="btn-secondary" type="button" onClick={reset}>
            <RotateCcw size={14} aria-hidden="true" />
            Try Again
          </button>
          <Link className="btn-secondary" to="/">
            <Home size={14} aria-hidden="true" />
            Overview
          </Link>
          <button className="btn-ghost" type="button" onClick={() => reloadPage()}>
            <RefreshCw size={14} aria-hidden="true" />
            Reload Workspace
          </button>
        </div>
      </div>
    </div>
  )
}
