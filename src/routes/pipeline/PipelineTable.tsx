import { Fragment } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { PipelineEntry, PipelineStatus } from '../../types/pipeline'
import { PipelineDetail } from './PipelineDetail'

const STATUSES: PipelineStatus[] = [
  'researching', 'applied', 'screening', 'interviewing',
  'offer', 'accepted', 'rejected', 'withdrawn', 'closed',
]

export type SortField = 'company' | 'role' | 'tier' | 'status' | 'comp' | 'lastAction' | 'nextStep'

interface PipelineTableProps {
  entries: PipelineEntry[]
  sortField: SortField
  sortDir: 'asc' | 'desc'
  onSort: (field: SortField) => void
  expandedId: string | null
  onToggleExpand: (id: string) => void
  onEdit: (entry: PipelineEntry) => void
  onDelete: (id: string) => void
  onAnalyze: (entry: PipelineEntry) => void
  onPrep: (entry: PipelineEntry) => void
  onStatusChange: (id: string, status: PipelineStatus) => void
  onOpenInBuilder: (entry: PipelineEntry) => void
  onInvestigate: (entry: PipelineEntry) => void
  canInvestigate: boolean
  investigatingId: string | null
  investigationErrors: Record<string, string>
}

const COLUMNS: { key: SortField; label: string }[] = [
  { key: 'company', label: 'Company' },
  { key: 'role', label: 'Role' },
  { key: 'tier', label: 'Tier' },
  { key: 'status', label: 'Status' },
  { key: 'comp', label: 'Comp' },
  { key: 'lastAction', label: 'Last Action' },
  { key: 'nextStep', label: 'Next Step' },
]

function tierLabel(tier: string): string {
  return tier === 'watch' ? 'Watch' : `T${tier}`
}

export function PipelineTable({
  entries,
  sortField,
  sortDir,
  onSort,
  expandedId,
  onToggleExpand,
  onEdit,
  onDelete,
  onAnalyze,
  onPrep,
  onStatusChange,
  onOpenInBuilder,
  onInvestigate,
  canInvestigate,
  investigatingId,
  investigationErrors,
}: PipelineTableProps) {
  return (
    <div className="pipeline-table-wrap">
      <table className="pipeline-table">
        <thead>
          <tr>
            {COLUMNS.map((col) => (
              <th key={col.key} onClick={() => onSort(col.key)}>
                {col.label}
                {sortField === col.key && (
                  sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <Fragment key={entry.id}>
              <tr
                className={`pipeline-row ${expandedId === entry.id ? 'pipeline-row-expanded' : ''}`}
                onClick={() => onToggleExpand(entry.id)}
              >
                <td>{entry.company}</td>
                <td>{entry.role}</td>
                <td>
                  <span className={`pipeline-tier pipeline-tier-${entry.tier}`}>
                    {tierLabel(entry.tier)}
                  </span>
                </td>
                <td>
                  <select
                    className={`pipeline-status-select pipeline-badge pipeline-badge-${entry.status}`}
                    value={entry.status}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => onStatusChange(entry.id, e.target.value as PipelineStatus)}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </td>
                <td className="pipeline-cell-mono">{entry.comp || '\u2014'}</td>
                <td className="pipeline-cell-muted">{entry.lastAction || '\u2014'}</td>
                <td className="pipeline-cell-muted">{entry.nextStep || '\u2014'}</td>
              </tr>
              {expandedId === entry.id && (
                <tr className="pipeline-detail-row">
                  <td colSpan={COLUMNS.length}>
                    <PipelineDetail
                      entry={entry}
                      onEdit={() => onEdit(entry)}
                      onDelete={() => onDelete(entry.id)}
                      onAnalyze={() => onAnalyze(entry)}
                      onPrep={() => onPrep(entry)}
                      onOpenInBuilder={() => onOpenInBuilder(entry)}
                      onInvestigate={() => onInvestigate(entry)}
                      canInvestigate={canInvestigate}
                      isInvestigating={investigatingId === entry.id}
                      investigationError={investigationErrors[entry.id]}
                    />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
          {entries.length === 0 && (
            <tr>
              <td colSpan={COLUMNS.length} className="pipeline-cell-muted" style={{ textAlign: 'center', padding: '32px' }}>
                No entries match your filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
