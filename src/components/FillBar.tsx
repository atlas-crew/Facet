import './fillBar.css'

export interface FillBarProps {
  label: string
  percent: number
  tone?: 'ok' | 'warn'
}

export function FillBar({ label, percent, tone = 'ok' }: FillBarProps) {
  const clamped = Math.max(0, Math.min(100, percent))
  return (
    <div className="fill-bar" data-tone={tone}>
      <span className="label-tracked fill-bar-label">{label}</span>
      <div className="fill-bar-track" role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100}>
        <div className="fill-bar-inner" style={{ width: `${clamped}%` }} />
      </div>
    </div>
  )
}
