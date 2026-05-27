import { useState } from 'react'
import { Save, Search } from 'lucide-react'
import type { PipelineStatus, PipelineTier } from '../../types/pipeline'

const FILTER_SET_NAME_MAX_LENGTH = 48

export interface PipelineFilterState {
  tiers: PipelineTier[]
  statuses: PipelineStatus[]
  search: string
}

export interface PipelineSavedFilterSet {
  id: string
  name: string
  filters: PipelineFilterState
}

interface PipelineFiltersProps {
  filters: PipelineFilterState
  savedFilterSets: PipelineSavedFilterSet[]
  activeFilterSetName: string | null
  onFilterChange: (filters: PipelineFilterState) => void
  onSaveFilterSet: (name: string) => void
  onApplyFilterSet: (id: string) => void
}

const TIERS: { value: PipelineTier; label: string }[] = [
  { value: '1', label: 'T1' },
  { value: '2', label: 'T2' },
  { value: '3', label: 'T3' },
  { value: 'watch', label: 'Watch' },
]

const STATUSES: { value: PipelineStatus; label: string }[] = [
  { value: 'researching', label: 'Researching' },
  { value: 'applied', label: 'Applied' },
  { value: 'screening', label: 'Screening' },
  { value: 'interviewing', label: 'Interviewing' },
  { value: 'offer', label: 'Offer' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'withdrawn', label: 'Withdrawn' },
  { value: 'closed', label: 'Closed' },
]

function toggleItem<T>(arr: T[], item: T): T[] {
  return arr.includes(item) ? arr.filter((v) => v !== item) : [...arr, item]
}

export function PipelineFilters({
  filters,
  savedFilterSets,
  activeFilterSetName,
  onFilterChange,
  onSaveFilterSet,
  onApplyFilterSet,
}: PipelineFiltersProps) {
  const [draftName, setDraftName] = useState('')

  const handleSave = () => {
    onSaveFilterSet(draftName)
    setDraftName('')
  }

  return (
    <div className="pipeline-filters">
      <div className="pipeline-filter-group">
        <span className="pipeline-filter-group-label">Tier</span>
        {TIERS.map((t) => (
          <button
            key={t.value}
            className={`pipeline-pill ${filters.tiers.includes(t.value) ? 'pipeline-pill-active' : ''}`}
            aria-pressed={filters.tiers.includes(t.value)}
            onClick={() =>
              onFilterChange({ ...filters, tiers: toggleItem(filters.tiers, t.value) })
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="pipeline-filter-group">
        <span className="pipeline-filter-group-label">Status</span>
        {STATUSES.map((s) => (
          <button
            key={s.value}
            className={`pipeline-pill ${filters.statuses.includes(s.value) ? 'pipeline-pill-active' : ''}`}
            aria-pressed={filters.statuses.includes(s.value)}
            onClick={() =>
              onFilterChange({ ...filters, statuses: toggleItem(filters.statuses, s.value) })
            }
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="pipeline-filter-group" style={{ position: 'relative' }}>
        <Search size={14} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
        <input
          type="text"
          className="pipeline-search"
          style={{ paddingLeft: 28 }}
          aria-label="Search pipeline fields"
          placeholder="Search pipeline..."
          title="Searches company, role, notes, next step, skills, and job description."
          value={filters.search}
          onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
        />
      </div>

      <div className="pipeline-filter-group pipeline-filter-presets">
        <span className="pipeline-filter-group-label">Local sets</span>
        <input
          type="text"
          className="pipeline-filter-name"
          aria-label="Filter set name"
          placeholder="Name filter set"
          maxLength={FILTER_SET_NAME_MAX_LENGTH}
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleSave()
            }
          }}
        />
        <button className="pipeline-btn pipeline-filter-save" onClick={handleSave}>
          <Save size={14} /> Save
        </button>
        <select
          className="pipeline-filter-select"
          aria-label="Saved filter sets"
          value=""
          onChange={(e) => {
            const selectedId = e.target.value
            if (selectedId) onApplyFilterSet(selectedId)
          }}
        >
          <option value="">Apply saved filter</option>
          {savedFilterSets.map((set) => (
            <option key={set.id} value={set.id}>
              {set.name}
            </option>
          ))}
        </select>
        {activeFilterSetName && (
          <span className="pipeline-active-filter-set">Active: {activeFilterSetName}</span>
        )}
      </div>
    </div>
  )
}
