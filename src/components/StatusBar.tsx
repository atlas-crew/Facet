import { AlertTriangle } from 'lucide-react'
import { HelpHint } from './HelpHint'

interface StatusBarProps {
  pageCount: number | null
  pageCountPending?: boolean
  bulletCount: number
  skillGroupCount: number
  nearBudget: boolean
  overBudget: boolean
  activePresetLabel?: string
  presetDirty?: boolean
  matchScore?: number | null
}

export function StatusBar({
  pageCount,
  pageCountPending,
  bulletCount,
  skillGroupCount,
  nearBudget,
  overBudget,
  activePresetLabel,
  presetDirty,
  matchScore,
}: StatusBarProps) {
  const showWarning = nearBudget || overBudget

  return (
    <footer
      className={`status-bar ${overBudget ? 'critical' : nearBudget ? 'warning' : ''}`}
      role="status"
      aria-live="polite"
      data-tour="status-bar"
    >
      <span>
        {pageCountPending && pageCount === null
          ? 'Rendering PDF...'
          : `${pageCount ?? 1} page${(pageCount ?? 1) === 1 ? '' : 's'}`}
        <HelpHint text="Page count from the PDF render. Bullets auto-trim if over budget." placement="top" />
      </span>
      {matchScore != null && (
        <span className="match-score-status">
          Match: {Math.round(matchScore * 100)}%
          <HelpHint text="Keyword match percentage based on JD analysis." placement="top" />
        </span>
      )}
      <span>{bulletCount} bullets</span>
      <span>{skillGroupCount} skill groups</span>
      {activePresetLabel ? (
        <span className={`preset-status ${presetDirty ? 'dirty' : ''}`}>
          Editing: {activePresetLabel}
          {presetDirty ? ' *' : ''}
          {presetDirty ? <span className="sr-only"> (unsaved changes)</span> : null}
        </span>
      ) : null}
      {showWarning && (
        <span className="status-warning">
          <AlertTriangle size={14} />
          {overBudget
            ? 'Estimated at 2+ pages; bottom bullets were trimmed'
            : 'Approaching 2-page target (>= 1.8 pages)'}
        </span>
      )}
    </footer>
  )
}
