import { useMemo } from 'react'
import { X } from 'lucide-react'
import type { PipelineEntry, PipelineStatus } from '../../types/pipeline'
import { getPipelineResumeVariantLabel } from '../../utils/resumeGeneration'

interface PipelineAnalyticsProps {
  entries: PipelineEntry[]
  onClose: () => void
}

const RESPONDED: Set<PipelineStatus> = new Set([
  'screening', 'interviewing', 'offer', 'accepted', 'rejected', 'closed',
])

function pct(n: number, d: number): number {
  return d === 0 ? 0 : Math.round((n / d) * 100)
}

function rateClass(rate: number): string {
  if (rate >= 30) return 'kpi-green'
  if (rate >= 10) return 'kpi-amber'
  return 'kpi-red'
}

const BAR_COLORS = ['pipeline-bar-fill-blue', 'pipeline-bar-fill-cyan', 'pipeline-bar-fill-purple', 'pipeline-bar-fill-green', 'pipeline-bar-fill-amber', 'pipeline-bar-fill-red']

export function PipelineAnalytics({ entries, onClose }: PipelineAnalyticsProps) {
  const analytics = useMemo(() => {
    const applied = entries.filter((e) => e.status !== 'researching')
    const responded = entries.filter((e) => RESPONDED.has(e.status))
    const offers = entries.filter((e) => e.status === 'offer' || e.status === 'accepted')
    const responseRate = pct(responded.length, applied.length)

    // Avg days to response
    const days = entries
      .filter((e) => e.daysToResponse != null && e.daysToResponse >= 0)
      .map((e) => e.daysToResponse!)
    const avgDays = days.length ? Math.round(days.reduce((s, v) => s + v, 0) / days.length) : null

    // Avg rounds
    const rounds = entries.filter((e) => e.rounds != null && e.rounds > 0).map((e) => e.rounds!)
    const avgRounds = rounds.length ? (rounds.reduce((s, v) => s + v, 0) / rounds.length).toFixed(1) : null

    // By application method
    const byMethod = new Map<string, { total: number; responded: number }>()
    for (const e of applied) {
      const m = e.appMethod || 'unknown'
      const c = byMethod.get(m) ?? { total: 0, responded: 0 }
      c.total++
      if (RESPONDED.has(e.status)) c.responded++
      byMethod.set(m, c)
    }

    // Rejection stages
    const rejStages = new Map<string, number>()
    for (const e of entries.filter((x) => x.status === 'rejected')) {
      const s = e.rejectionStage || 'unknown'
      rejStages.set(s, (rejStages.get(s) ?? 0) + 1)
    }

    // Interview formats
    const fmts = new Map<string, number>()
    for (const e of entries) {
      for (const f of e.format) {
        fmts.set(f, (fmts.get(f) ?? 0) + 1)
      }
    }

    // By tier
    const byTier = new Map<string, { total: number; applied: number; responded: number }>()
    for (const e of entries) {
      const t = e.tier === 'watch' ? 'Watch' : `T${e.tier}`
      const c = byTier.get(t) ?? { total: 0, applied: 0, responded: 0 }
      c.total++
      if (e.status !== 'researching') c.applied++
      if (RESPONDED.has(e.status)) c.responded++
      byTier.set(t, c)
    }

    // By vector
    const byVector = new Map<string, { total: number; applied: number; responded: number }>()
    for (const e of entries) {
      const v = e.vectorId || '(none)'
      const c = byVector.get(v) ?? { total: 0, applied: 0, responded: 0 }
      c.total++
      if (e.status !== 'researching') c.applied++
      if (RESPONDED.has(e.status)) c.responded++
      byVector.set(v, c)
    }

    // By resume variant
    const byVariant = new Map<string, { total: number; responded: number }>()
    for (const e of applied) {
      const v = getPipelineResumeVariantLabel(e) || '(none)'
      const c = byVariant.get(v) ?? { total: 0, responded: 0 }
      c.total++
      if (RESPONDED.has(e.status)) c.responded++
      byVariant.set(v, c)
    }

    return {
      applied: applied.length,
      responded: responded.length,
      offers: offers.length,
      responseRate,
      avgDays,
      avgRounds,
      byMethod: [...byMethod.entries()].sort((a, b) => b[1].total - a[1].total),
      rejStages: [...rejStages.entries()].sort((a, b) => b[1] - a[1]),
      fmts: [...fmts.entries()].sort((a, b) => b[1] - a[1]),
      byTier: [...byTier.entries()],
      byVector: [...byVector.entries()].sort((a, b) => b[1].total - a[1].total),
      byVariant: [...byVariant.entries()].sort((a, b) => b[1].total - a[1].total),
    }
  }, [entries])

  return (
    <div className="pipeline-analytics">
      <div className="pipeline-analytics-header">
        <h2>Analytics</h2>
        <button className="pipeline-btn pipeline-btn-ghost pipeline-btn-sm" onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      <div className="pipeline-analytics-kpis">
        <div className="pipeline-kpi">
          <span className={`pipeline-kpi-value ${rateClass(analytics.responseRate)}`}>
            {analytics.applied > 0 ? `${analytics.responseRate}%` : '\u2014'}
          </span>
          <span className="pipeline-kpi-label">Response Rate</span>
        </div>
        <div className="pipeline-kpi">
          <span className="pipeline-kpi-value">
            {analytics.avgDays != null ? `${analytics.avgDays}d` : '\u2014'}
          </span>
          <span className="pipeline-kpi-label">Avg Days to Response</span>
        </div>
        <div className="pipeline-kpi">
          <span className="pipeline-kpi-value">
            {analytics.avgRounds ?? '\u2014'}
          </span>
          <span className="pipeline-kpi-label">Avg Rounds</span>
        </div>
        <div className="pipeline-kpi">
          <span className={`pipeline-kpi-value ${rateClass(pct(analytics.offers, analytics.applied))}`}>
            {analytics.applied > 0 ? `${pct(analytics.offers, analytics.applied)}%` : '\u2014'}
          </span>
          <span className="pipeline-kpi-label">App → Offer</span>
        </div>
      </div>

      <BarSection
        title="By Tier"
        rows={analytics.byTier.map(([k, v], i) => ({
          label: k,
          fill: BAR_COLORS[i % BAR_COLORS.length],
          width: pct(v.total, Math.max(...analytics.byTier.map(([, x]) => x.total), 1)),
          text: `${v.total} / ${v.applied}a / ${v.responded}r`,
        }))}
      />

      <BarSection
        title="By Vector"
        rows={analytics.byVector.map(([k, v], i) => ({
          label: k,
          fill: BAR_COLORS[i % BAR_COLORS.length],
          width: pct(v.total, Math.max(...analytics.byVector.map(([, x]) => x.total), 1)),
          text: `${v.total} / ${v.applied}a / ${v.responded}r`,
        }))}
      />

      <BarSection
        title="By Application Method"
        rows={analytics.byMethod.map(([k, v], i) => ({
          label: k,
          fill: BAR_COLORS[i % BAR_COLORS.length],
          width: pct(v.total, Math.max(...analytics.byMethod.map(([, x]) => x.total), 1)),
          text: `${v.total} (${pct(v.responded, v.total)}% resp)`,
        }))}
      />

      <BarSection
        title="Rejection Stages"
        rows={analytics.rejStages.map(([k, v]) => ({
          label: k,
          fill: 'pipeline-bar-fill-red',
          width: pct(v, Math.max(...analytics.rejStages.map(([, x]) => x), 1)),
          text: String(v),
        }))}
      />

      <BarSection
        title="Interview Formats"
        rows={analytics.fmts.map(([k, v]) => ({
          label: k,
          fill: 'pipeline-bar-fill-purple',
          width: pct(v, Math.max(...analytics.fmts.map(([, x]) => x), 1)),
          text: String(v),
        }))}
      />

      <BarSection
        title="By Resume Variant"
        rows={analytics.byVariant.map(([k, v], i) => ({
          label: k,
          fill: BAR_COLORS[i % BAR_COLORS.length],
          width: pct(v.total, Math.max(...analytics.byVariant.map(([, x]) => x.total), 1)),
          text: `${v.total} (${pct(v.responded, v.total)}% resp)`,
        }))}
      />
    </div>
  )
}

interface BarRow {
  label: string
  fill: string
  width: number
  text: string
}

function BarSection({ title, rows }: { title: string; rows: BarRow[] }) {
  if (rows.length === 0) return null
  return (
    <div className="pipeline-analytics-section">
      <h3>{title}</h3>
      {rows.map((r) => (
        <div key={r.label} className="pipeline-bar-row">
          <span className="pipeline-bar-label">{r.label}</span>
          <div className="pipeline-bar-track">
            <div className={`pipeline-bar-fill ${r.fill}`} style={{ width: `${r.width}%` }} />
          </div>
          <span className="pipeline-bar-value">{r.text}</span>
        </div>
      ))}
    </div>
  )
}
