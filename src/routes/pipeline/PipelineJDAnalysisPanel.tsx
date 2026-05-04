import type { PipelineJDAnalysisViewState } from './pipelineAnalysis'
import { describePipelineJDAnalysisDriftReason } from './pipelineAnalysis'

const EMPTY_VALUE = '\u2014'
const META_SEPARATOR = ' \u00b7 '

const METRIC_LABELS: Record<string, string> = {
  apply: 'Apply',
  consider: 'Consider',
  'filter-out': 'Filter out',
  high: 'High',
  low: 'Low',
  moderate: 'Moderate',
  skip: 'Skip',
  strong: 'Strong',
  weak: 'Weak',
}

interface PipelineJDAnalysisPanelProps {
  panelId: string
  state?: PipelineJDAnalysisViewState
  titleId: string
}

export function PipelineJDAnalysisPanel({ panelId, state, titleId }: PipelineJDAnalysisPanelProps) {
  const analysis = state?.analysis ?? null

  if (!state || state.status === 'missing' || !analysis) {
    return (
      <section className="pipeline-jd-analysis" id={panelId} aria-labelledby={titleId}>
        <div className="pipeline-jd-analysis-header">
          <div>
            <span className="pipeline-detail-action-label">JD Analysis</span>
            <h3 id={titleId}>Saved analysis unavailable</h3>
          </div>
          <span className="pipeline-analysis-badge is-missing">Analysis missing</span>
        </div>
        <p className="pipeline-jd-analysis-summary">
          This entry has a saved analysis reference, but the analysis artifact is no longer available.
          Refresh JD Analysis to recreate it.
        </p>
      </section>
    )
  }

  const generatedAt = formatGeneratedAt(analysis.generatedAt)
  const fitScore = `${Math.round(analysis.fitScore * 100)}%`
  const needsReview = state.status === 'stale'
  const company = analysis.company || EMPTY_VALUE
  const role = analysis.role || EMPTY_VALUE
  const metadata = [company, role, generatedAt].join(META_SEPARATOR)

  return (
    <section className="pipeline-jd-analysis" id={panelId} aria-labelledby={titleId}>
      <div className="pipeline-jd-analysis-header">
        <div>
          <span className="pipeline-detail-action-label">JD Analysis</span>
          <h3 id={titleId}>{analysis.oneLineSummary || analysis.summary || 'Saved analysis'}</h3>
          <p>{metadata}</p>
        </div>
        <span
          className={`pipeline-analysis-badge ${
            needsReview ? 'is-stale' : state.status === 'unknown' ? 'is-pending' : 'is-current'
          }`}
        >
          {needsReview ? 'Review suggested' : state.status === 'unknown' ? 'Saved' : 'Current'}
        </span>
      </div>

      {needsReview ? (
        <div className="pipeline-jd-analysis-alert" role="note">
          Saved analysis may need review because {formatDriftReasons(state.driftReasons)}.
        </div>
      ) : null}

      <div className="pipeline-jd-analysis-metrics">
        <Metric label="Fit" value={formatMetricValue(analysis.overallFit)} />
        <Metric label="Score" value={fitScore} />
        <Metric label="Confidence" value={formatMetricValue(analysis.confidence)} />
        <Metric label="Recommendation" value={formatMetricValue(analysis.recommendation)} />
      </div>

      {analysis.summary || analysis.rationale ? (
        <div className="pipeline-jd-analysis-copy">
          {analysis.summary ? <p>{analysis.summary}</p> : null}
          {analysis.rationale ? <p>{analysis.rationale}</p> : null}
        </div>
      ) : null}

      <div className="pipeline-jd-analysis-grid">
        <AnalysisList
          title="Matched vectors"
          items={analysis.matchedVectors.map((vector) =>
            `${vector.title}${vector.vectorId === analysis.primaryVectorId ? ' (primary)' : ''}: ${formatMetricValue(vector.matchStrength)}`,
          )}
          empty="No matched vectors saved."
        />
        <AnalysisList
          title="Strengths to lead"
          items={[...analysis.strengthsToLead, ...analysis.positioningRecommendations]}
          empty="No strengths saved."
        />
        <AnalysisList
          title="Gaps and watch outs"
          items={[
            ...analysis.gaps.map((gap) => `${gap.label}: ${gap.reason}`),
            ...analysis.watchOuts.map((watchOut) => `${watchOut.description}: ${watchOut.suggestedAction}`),
          ]}
          empty="No gaps or watch outs saved."
        />
        <AnalysisList
          title="Warnings"
          items={analysis.warnings}
          empty="No warnings."
        />
      </div>
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="pipeline-jd-analysis-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function AnalysisList({
  title,
  items,
  empty,
}: {
  title: string
  items: string[]
  empty: string
}) {
  const visibleItems = items.filter(Boolean)

  return (
    <div className="pipeline-jd-analysis-list">
      <h4>{title}</h4>
      {visibleItems.length > 0 ? (
        <ul>
          {visibleItems.map((item, index) => (
            <li key={`${item}-${index}`}>{item}</li>
          ))}
        </ul>
      ) : (
        <p>{empty}</p>
      )}
    </div>
  )
}

function formatGeneratedAt(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown date'

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatDriftReasons(reasons: PipelineJDAnalysisViewState['driftReasons']): string {
  if (reasons.length === 0) return 'the source inputs changed'

  return reasons.map(describePipelineJDAnalysisDriftReason).join(', ')
}

function formatMetricValue(value: string): string {
  return METRIC_LABELS[value] ?? value
}
