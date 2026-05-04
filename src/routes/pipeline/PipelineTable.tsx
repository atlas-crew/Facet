import { Fragment } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { PipelineEntry, PipelineStatus } from '../../types/pipeline'
import { PipelineDetail } from './PipelineDetail'
import type { PipelineJDAnalysisViewState } from './pipelineAnalysis'

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
  onToggleAnalysis: (entry: PipelineEntry) => void
  onStatusChange: (id: string, status: PipelineStatus) => void
  onOpenInBuilder: (entry: PipelineEntry) => void
  onInvestigate: (entry: PipelineEntry) => void
  analysisStates: Record<string, PipelineJDAnalysisViewState>
  openAnalysisId: string | null
  canInvestigate: boolean
  investigatingId: string | null
  analyzingJdId: string | null
  investigationErrors: Record<string, string>
  analysisErrors: Record<string, string>
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
  onToggleAnalysis,
  onStatusChange,
  onOpenInBuilder,
  onInvestigate,
  analysisStates,
  openAnalysisId,
  canInvestigate,
  investigatingId,
  analyzingJdId,
  investigationErrors,
  analysisErrors,
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
            <th className="pipeline-th-static">Analysis</th>
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
                <td>
                  <PipelineAnalysisBadge state={analysisStates[entry.id]} />
                </td>
              </tr>
              {expandedId === entry.id && (
                <tr className="pipeline-detail-row">
                  <td colSpan={COLUMNS.length + 1}>
                    <PipelineDetail
                      key={entry.id}
                      entry={entry}
                      onEdit={() => onEdit(entry)}
                      onDelete={() => onDelete(entry.id)}
                      onAnalyze={() => onAnalyze(entry)}
                      onPrep={() => onPrep(entry)}
                      onToggleAnalysis={() => onToggleAnalysis(entry)}
                      onOpenInBuilder={() => onOpenInBuilder(entry)}
                      onInvestigate={() => onInvestigate(entry)}
                      analysisState={analysisStates[entry.id]}
                      isAnalysisOpen={openAnalysisId === entry.id}
                      canInvestigate={canInvestigate}
                      isInvestigating={investigatingId === entry.id}
                      isAnalyzingJd={analyzingJdId === entry.id}
                      investigationError={investigationErrors[entry.id]}
                      analysisError={analysisErrors[entry.id]}
                    />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
          {entries.length === 0 && (
            <tr>
              <td colSpan={COLUMNS.length + 1} className="pipeline-cell-muted" style={{ textAlign: 'center', padding: '32px' }}>
                No entries match your filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function PipelineAnalysisBadge({ state }: { state?: PipelineJDAnalysisViewState }) {
  if (!state || state.status === 'none') {
    return <span className="pipeline-analysis-badge is-empty">Not run</span>
  }

  if (state.status === 'missing') {
    return <span className="pipeline-analysis-badge is-missing">Analysis missing</span>
  }

  if (state.status === 'unknown') {
    return <span className="pipeline-analysis-badge is-pending">JD saved</span>
  }

  if (state.status === 'stale') {
    return <span className="pipeline-analysis-badge is-stale">JD stale</span>
  }

  return <span className="pipeline-analysis-badge is-current">JD saved</span>
}
