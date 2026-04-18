import { useState, useMemo, useCallback, useRef } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Plus, Download, Upload, BarChart3 } from 'lucide-react'
import { usePipelineStore } from '../../store/pipelineStore'
import { useHandoffStore } from '../../store/handoffStore'
import { useUiStore } from '../../store/uiStore'
import type { PipelineEntry } from '../../types/pipeline'
import { getFacetClientEnv } from '../../utils/facetEnv'
import { sanitizeEndpointUrl } from '../../utils/idUtils'
import { sanitizeUrl } from '../../utils/sanitizeUrl'
import { investigatePipelineEntry } from '../../utils/pipelineInvestigation'
import type { PipelineFilterState } from './PipelineFilters'
import type { SortField } from './PipelineTable'
import { PipelineStats } from './PipelineStats'
import { PipelineFilters } from './PipelineFilters'
import { PipelineTable } from './PipelineTable'
import { PipelineEntryModal } from './PipelineEntryModal'
import { PipelineAnalytics } from './PipelineAnalytics'
import { PasteJdModal } from './PasteJdModal'
import { samplePipelineData } from './samplePipelineData'
import { parsePipelineImport } from '../../utils/pipelineImport'
import {
  getPipelineResumePresetId,
  getPipelineResumePrimaryVectorId,
  getPipelineResumeVectorIds,
} from '../../utils/resumeGeneration'
import './pipeline.css'

type ModalState = 
  | null 
  | 'add' 
  | PipelineEntry 
  | 'paste-jd' 
  | { type: 'add-prefilled'; data: Partial<PipelineEntry> }

const TIER_ORDER: Record<string, number> = { '1': 1, '2': 2, '3': 3, watch: 4 }
const PIPELINE_HANDOFF_DEFAULT_MODE = 'dynamic'

export function PipelinePage() {
  const entries = usePipelineStore((s) => s.entries)
  const addEntry = usePipelineStore((s) => s.addEntry)
  const updateEntry = usePipelineStore((s) => s.updateEntry)
  const deleteEntry = usePipelineStore((s) => s.deleteEntry)
  const importEntries = usePipelineStore((s) => s.importEntries)
  const setStatus = usePipelineStore((s) => s.setStatus)
  const addHistoryNote = usePipelineStore((s) => s.addHistoryNote)

  const navigate = useNavigate()

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [modal, setModal] = useState<ModalState>(null)
  const [analyticsOpen, setAnalyticsOpen] = useState(false)
  const [filters, setFilters] = useState<PipelineFilterState>({ tiers: [], statuses: [], search: '' })
  const [sortField, setSortField] = useState<SortField>('tier')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [investigatingId, setInvestigatingId] = useState<string | null>(null)
  const [investigationErrors, setInvestigationErrors] = useState<Record<string, string>>({})

  const importRef = useRef<HTMLInputElement>(null)
  const aiEndpoint = useMemo(
    () => sanitizeEndpointUrl(getFacetClientEnv().anthropicProxyUrl),
    [],
  )

  const handleSort = useCallback(
    (field: SortField) => {
      setSortDir((prev) => (sortField === field ? (prev === 'asc' ? 'desc' : 'asc') : 'asc'))
      setSortField(field)
    },
    [sortField]
  )

  const filteredEntries = useMemo(() => {
    let result = [...entries]

    if (filters.tiers.length > 0) {
      result = result.filter((e) => filters.tiers.includes(e.tier))
    }
    if (filters.statuses.length > 0) {
      result = result.filter((e) => filters.statuses.includes(e.status))
    }
    if (filters.search) {
      const q = filters.search.toLowerCase()
      result = result.filter(
        (e) => e.company.toLowerCase().includes(q) || e.role.toLowerCase().includes(q)
      )
    }

    result.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'company': cmp = a.company.localeCompare(b.company); break
        case 'role': cmp = a.role.localeCompare(b.role); break
        case 'tier': cmp = (TIER_ORDER[a.tier] ?? 9) - (TIER_ORDER[b.tier] ?? 9); break
        case 'status': cmp = a.status.localeCompare(b.status); break
        case 'comp': cmp = a.comp.localeCompare(b.comp); break
        case 'lastAction': cmp = (a.lastAction || '').localeCompare(b.lastAction || ''); break
        case 'nextStep': cmp = (a.nextStep || '').localeCompare(b.nextStep || ''); break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

    return result
  }, [entries, filters, sortField, sortDir])

  const handleSave = useCallback(
    (data: Omit<PipelineEntry, 'id' | 'createdAt' | 'lastAction' | 'history'>) => {
      if (modal && typeof modal === 'object' && 'id' in modal) {
        updateEntry((modal as PipelineEntry).id, data)
      } else {
        addEntry(data)
      }
      setModal(null)
    },
    [modal, addEntry, updateEntry]
  )

  const handleDelete = useCallback(
    (id: string) => {
      deleteEntry(id)
      setExpandedId(null)
    },
    [deleteEntry]
  )

  const buildPipelineHandoff = useCallback((entry: PipelineEntry) => {
    if (!entry.jobDescription) {
      return null
    }

    return {
      mode: entry.resumeGeneration?.mode ?? PIPELINE_HANDOFF_DEFAULT_MODE,
      vectorMode: entry.resumeGeneration?.vectorMode ?? 'manual',
      source: 'pipeline' as const,
      jobDescription: entry.jobDescription,
      pipelineEntryId: entry.id,
      presetId: getPipelineResumePresetId(entry),
      primaryVectorId: getPipelineResumePrimaryVectorId(entry),
      vectorIds: getPipelineResumeVectorIds(entry),
      suggestedVectorIds: entry.resumeGeneration?.suggestedVectorIds ?? [],
      resumeGeneration: entry.resumeGeneration,
    }
  }, [])

  const handleAnalyze = useCallback(
    (entry: PipelineEntry) => {
      const handoff = buildPipelineHandoff(entry)
      if (handoff) {
        useHandoffStore.getState().setPendingGeneration(handoff)
        void navigate({ to: '/build' })
      }
    },
    [buildPipelineHandoff, navigate]
  )

  const handleOpenInBuilder = useCallback(
    (entry: PipelineEntry) => {
      const handoff = buildPipelineHandoff(entry)
      if (handoff) {
        useHandoffStore.getState().setPendingGeneration(handoff)
        void navigate({ to: '/build' })
        return
      }

      const primaryVectorId = getPipelineResumePrimaryVectorId(entry)
      if (primaryVectorId) {
        useUiStore.getState().setSelectedVector(primaryVectorId)
        void navigate({ to: '/build' })
      }
    },
    [buildPipelineHandoff, navigate]
  )

  const handlePrep = useCallback(
    (entry: PipelineEntry) => {
      void navigate({
        to: '/prep',
        search: {
          vector: getPipelineResumePrimaryVectorId(entry) ?? '',
          skills: entry.skillMatch ?? '',
          q: '',
        },
      })
    },
    [navigate]
  )

  const handleInvestigate = useCallback(
    async (entry: PipelineEntry) => {
      try {
        if (!aiEndpoint) {
          throw new Error('AI research is disabled. Configure VITE_ANTHROPIC_PROXY_URL.')
        }
        setInvestigationErrors((current) => ({
          ...current,
          [entry.id]: '',
        }))
        setInvestigatingId(entry.id)

        const update = await investigatePipelineEntry(entry, aiEndpoint)
        updateEntry(entry.id, {
          jobDescription: update.jobDescription,
          format: update.format,
          nextStep: update.nextStep,
          research: update.research,
        })
        addHistoryNote(entry.id, 'Investigated with AI')
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Pipeline investigation failed.'
        setInvestigationErrors((current) => ({
          ...current,
          [entry.id]: message,
        }))
      } finally {
        setInvestigatingId((current) => (current === entry.id ? null : current))
      }
    },
    [addHistoryNote, aiEndpoint, updateEntry],
  )

  const handleImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      void parsePipelineImport(file).then((result) => {
        if (result.error) {
          window.alert(result.error)
          return
        }
        importEntries(result.entries)
        if (result.skipped > 0) {
          window.alert(`Imported ${result.entries.length} entries. ${result.skipped} entries skipped (invalid format).`)
        }
      })
      e.target.value = ''
    },
    [importEntries]
  )

  const handleExport = useCallback(() => {
    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pipeline-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [entries])

  const handleLoadSample = useCallback(() => {
    importEntries(samplePipelineData)
  }, [importEntries])

  const modalEntry = modal && typeof modal === 'object' && 'id' in modal ? modal : null
  const initialData = modal && typeof modal === 'object' && 'type' in modal && modal.type === 'add-prefilled' ? modal.data : undefined
  const { activeEntryCount, interviewingCount, offerCount } = useMemo(() => {
    let active = 0
    let interviewing = 0
    let offers = 0

    for (const entry of entries) {
      if (
        entry.status !== 'rejected' &&
        entry.status !== 'withdrawn' &&
        entry.status !== 'closed'
      ) {
        active += 1
      }
      if (entry.status === 'interviewing') {
        interviewing += 1
      }
      if (entry.status === 'offer') {
        offers += 1
      }
    }

    return {
      activeEntryCount: active,
      interviewingCount: interviewing,
      offerCount: offers,
    }
  }, [entries])
  const pipelineStatusLine = entries.length === 0
    ? 'No tracked opportunities yet. Start with one role and grow the pipeline from there.'
    : activeEntryCount === 0
      ? 'All tracked opportunities are closed. Add a new role to restart the pipeline.'
    : `${activeEntryCount} active opportunities, ${interviewingCount} in interviews, ${offerCount} offers in play.`

  const handleImportLegacy = useCallback(() => {
    try {
      const raw = localStorage.getItem('pipeline-data')
      if (!raw) return
      const parsed = JSON.parse(raw)
      const legacy = Array.isArray(parsed) ? parsed : parsed?.entries
      if (Array.isArray(legacy) && legacy.length > 0) {
        // Sanitize URLs in legacy data before importing
        const sanitized = legacy.map((e: PipelineEntry) => ({
          ...e,
          url: e.url ? (sanitizeUrl(e.url) ?? '') : '',
        }))
        importEntries(sanitized)
        localStorage.removeItem('pipeline-data')
      }
    } catch { /* invalid legacy data */ }
  }, [importEntries])

  const hasLegacyData = useMemo(() => {
    try {
      const raw = localStorage.getItem('pipeline-data')
      if (!raw) return false
      const parsed = JSON.parse(raw)
      const legacy = Array.isArray(parsed) ? parsed : parsed?.entries
      return Array.isArray(legacy) && legacy.length > 0
    } catch { return false }
  }, [])

  // Empty state
  if (entries.length === 0 && !modal) {
    return (
      <div className="pipeline-page">
        <div className="pipeline-header">
          <div className="pipeline-header-copy">
            <p className="pipeline-eyebrow">Execution Workspace</p>
            <h1>Pipeline</h1>
            <p className="pipeline-copy">
              Track roles, reuse research, and keep the strongest opportunities moving.
            </p>
            <p className="pipeline-status-line">{pipelineStatusLine}</p>
          </div>
        </div>
        <div className="pipeline-empty">
          <h2>Start your opportunity pipeline</h2>
          <p>
            Add a role, paste a JD for faster capture, or pull in sample data if you want a guided tour of the workflow.
          </p>
          <div className="pipeline-empty-actions">
            <button className="pipeline-btn pipeline-btn-primary" onClick={() => setModal('add')}>
              <Plus size={16} /> Add Entry
            </button>
            <button className="pipeline-btn" onClick={() => setModal('paste-jd')}>
              <Plus size={16} /> Paste JD
            </button>
          </div>
          <div className="pipeline-empty-utilities">
            {hasLegacyData && (
              <button className="pipeline-btn" onClick={handleImportLegacy}>
                <Upload size={16} /> Import Legacy Data
              </button>
            )}
            <button className="pipeline-btn" onClick={handleLoadSample}>
              Load Sample Data
            </button>
            <button className="pipeline-btn" onClick={() => importRef.current?.click()}>
              <Upload size={16} /> Import JSON
            </button>
            <input ref={importRef} type="file" accept=".json" className="import-file-input" onChange={handleImport} />
          </div>
        </div>
        {modal === 'add' && (
          <PipelineEntryModal entry={null} onSave={handleSave} onClose={() => setModal(null)} />
        )}
      </div>
    )
  }

  return (
    <div className="pipeline-page">
      <div className="pipeline-header">
        <div className="pipeline-header-copy">
          <p className="pipeline-eyebrow">Execution Workspace</p>
          <h1>Pipeline</h1>
          <p className="pipeline-copy">
            Track roles, reuse research, and keep the strongest opportunities moving.
          </p>
          <p className="pipeline-status-line">{pipelineStatusLine}</p>
        </div>
        <div className="pipeline-header-action-groups">
          <div className="pipeline-header-actions">
            <button className="pipeline-btn pipeline-btn-primary" onClick={() => setModal('add')}>
              <Plus size={16} /> Add Entry
            </button>
          </div>
          <div className="pipeline-header-utilities">
            <button className="pipeline-btn" onClick={() => setModal('paste-jd')}>
              <Plus size={16} /> Paste JD
            </button>
            <button className="pipeline-btn" onClick={() => importRef.current?.click()}>
              <Upload size={16} /> Import
            </button>
            <input ref={importRef} type="file" accept=".json" className="import-file-input" onChange={handleImport} />
            <button className="pipeline-btn" onClick={handleExport}>
              <Download size={16} /> Export
            </button>
            <button
              className={`pipeline-btn ${analyticsOpen ? 'pipeline-btn-active' : ''}`}
              onClick={() => setAnalyticsOpen((o) => !o)}
              aria-pressed={analyticsOpen}
            >
              <BarChart3 size={16} /> Analytics
            </button>
          </div>
        </div>
      </div>

      <PipelineStats entries={entries} />

      {analyticsOpen && <PipelineAnalytics entries={entries} onClose={() => setAnalyticsOpen(false)} />}

      <PipelineFilters filters={filters} onFilterChange={setFilters} />

      <PipelineTable
        entries={filteredEntries}
        sortField={sortField}
        sortDir={sortDir}
        onSort={handleSort}
        expandedId={expandedId}
        onToggleExpand={(id) => setExpandedId((prev) => (prev === id ? null : id))}
        onEdit={(entry) => setModal(entry)}
        onDelete={handleDelete}
        onAnalyze={handleAnalyze}
        onPrep={handlePrep}
        onStatusChange={setStatus}
        onOpenInBuilder={handleOpenInBuilder}
        onInvestigate={handleInvestigate}
        canInvestigate={Boolean(aiEndpoint)}
        investigatingId={investigatingId}
        investigationErrors={investigationErrors}
      />

      {(modal === 'add' || modalEntry || initialData) && (
        <PipelineEntryModal
          key={modalEntry?.id ?? 'new'}
          entry={modalEntry}
          initialData={initialData}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'paste-jd' && (
        <PasteJdModal
          onClose={() => setModal(null)}
          onParse={(data) => setModal({ type: 'add-prefilled', data })}
        />
      )}
    </div>
  )
}
