import { useId } from 'react'
import './fillBar.css'
import { HelpHint } from './HelpHint'

export interface FillBarProps {
  label: string
  percent: number
  tone?: 'ok' | 'warn'
  helpText?: string
  helpLabel?: string
}

export function FillBar({ label, percent, tone = 'ok', helpText, helpLabel }: FillBarProps) {
  const clamped = Math.max(0, Math.min(100, percent))
  const labelId = useId()
  return (
    <div className="fill-bar" data-tone={tone}>
      <span className="label-tracked fill-bar-label" id={labelId}>
        {label}
      </span>
      {helpText ? (
        <HelpHint text={helpText} ariaLabel={helpLabel ?? `${label} fill strength help`} />
      ) : null}
      <div
        className="fill-bar-track"
        role="progressbar"
        aria-labelledby={labelId}
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="fill-bar-inner" style={{ width: `${clamped}%` }} />
      </div>
    </div>
  )
}
