import { AlertTriangle } from 'lucide-react'

interface StatusBarProps {
  pageCount: number
  bulletCount: number
  skillGroupCount: number
  overBudget: boolean
  mustOverBudget: boolean
}

export function StatusBar({
  pageCount,
  bulletCount,
  skillGroupCount,
  overBudget,
  mustOverBudget,
}: StatusBarProps) {
  return (
    <footer className={`status-bar ${overBudget ? 'warning' : ''}`}>
      <span>{pageCount} page(s)</span>
      <span>{bulletCount} bullets</span>
      <span>{skillGroupCount} skill groups</span>
      {overBudget && (
        <span className="status-warning">
          <AlertTriangle size={14} />
          {mustOverBudget
            ? 'Must-tagged content exceeds budget'
            : 'Over 2-page budget; lower-priority bullets were trimmed'}
        </span>
      )}
    </footer>
  )
}
