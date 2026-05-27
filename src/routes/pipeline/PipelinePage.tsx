import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { Plus, Download, Upload, BarChart3 } from 'lucide-react'
import { usePipelineStore } from '../../store/pipelineStore'
import { useHandoffStore } from '../../store/handoffStore'
import { useIdentityStore } from '../../store/identityStore'
import { useJDAnalysisStore } from '../../store/jdAnalysisStore'
import { useUiStore } from '../../store/uiStore'
import type { PipelineEntry, PipelineStatus, PipelineTier } from '../../types/pipeline'
import { getFacetClientEnv } from '../../utils/facetEnv'
import { sanitizeEndpointUrl } from '../../utils/idUtils'
import { sanitizeUrl } from '../../utils/sanitizeUrl'
import { investigatePipelineEntry } from '../../utils/pipelineInvestigation'
import type { PipelineFilterState, PipelineSavedFilterSet } from './PipelineFilters'
import type { SortField } from './PipelineTable'
import { PipelineStats } from './PipelineStats'
import { PipelineFilters } from './PipelineFilters'
import { PipelineTable } from './PipelineTable'
import { PipelineEntryModal } from './PipelineEntryModal'
import { PipelineAnalytics } from './PipelineAnalytics'
import { PasteJdModal } from './PasteJdModal'
import { samplePipelineData } from './samplePipelineData'
import { parsePipelineImport } from '../../utils/pipelineImport'
import { analyzePipelineJobDescription, savePipelineJDAnalysis } from '../../utils/jdAnalysis'
import {
  getPipelineResumePresetId,
  getPipelineResumePrimaryVectorId,
  getPipelineResumeVectorIds,
} from '../../utils/resumeGeneration'
import {
  getPipelineJDAnalysisViewState,
  type PipelineJDAnalysisViewState,
} from './pipelineAnalysis'
import './pipeline.css'

type ModalState = 
  | null 
  | 'add' 
  | PipelineEntry 
  | 'paste-jd' 
  | { type: 'add-prefilled'; data: Partial<PipelineEntry> }

const TIER_ORDER: Record<string, number> = { '1': 1, '2': 2, '3': 3, watch: 4 }
const PIPELINE_HANDOFF_DEFAULT_MODE = 'dynamic'
// TASK-51 scopes saved filter sets as browser-local presets, not workspace artifacts.
const PIPELINE_SAVED_FILTERS_STORAGE_KEY = 'facet:pipeline:saved-filter-sets:v1'
const FILTER_SET_NAME_MAX_LENGTH = 48
const MAX_SAVED_FILTER_SETS = 20
const MAX_SEARCHABLE_JOB_DESCRIPTION_CHARS = 4000
const VALID_FILTER_TIERS = new Set<PipelineTier>(['1', '2', '3', 'watch'])
const VALID_FILTER_STATUSES = new Set<PipelineStatus>([
  'researching',
  'applied',
  'screening',
  'interviewing',
  'offer',
  'accepted',
  'rejected',
  'withdrawn',
  'closed',
])

type PipelineNoticeTone = 'success' | 'warning' | 'error'

interface PipelineNotice {
  tone: PipelineNoticeTone
  title: string
  detail?: string
}

function normalizeSavedFilterState(value: unknown): PipelineFilterState | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  return {
    tiers: Array.isArray(raw.tiers)
      ? Array.from(
          new Set(
            raw.tiers.filter((tier): tier is PipelineTier =>
              VALID_FILTER_TIERS.has(tier as PipelineTier),
            ),
          ),
        )
      : [],
    statuses: Array.isArray(raw.statuses)
      ? Array.from(
          new Set(
            raw.statuses.filter((status): status is PipelineStatus =>
              VALID_FILTER_STATUSES.has(status as PipelineStatus),
            ),
          ),
        )
      : [],
    search: typeof raw.search === 'string' ? raw.search : '',
  }
}

function getLocalStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  const storage = window.localStorage
  if (
    !storage ||
    typeof storage.getItem !== 'function' ||
    typeof storage.setItem !== 'function' ||
    typeof storage.removeItem !== 'function'
  ) {
    return null
  }
  return storage
}

function readSavedFilterSets(): PipelineSavedFilterSet[] {
  try {
    const storage = getLocalStorage()
    const raw = storage?.getItem(PIPELINE_SAVED_FILTERS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((item): PipelineSavedFilterSet[] => {
      if (!item || typeof item !== 'object') return []
      const rawItem = item as Record<string, unknown>
      const filters = normalizeSavedFilterState(rawItem.filters)
      if (!filters || typeof rawItem.id !== 'string' || typeof rawItem.name !== 'string') {
        return []
      }
      return [{ id: rawItem.id, name: rawItem.name, filters }]
    })
  } catch {
    return []
  }
}

function writeSavedFilterSets(
  filterSets: PipelineSavedFilterSet[],
): boolean {
  try {
    const storage = getLocalStorage()
    if (!storage) return false
    storage.setItem(PIPELINE_SAVED_FILTERS_STORAGE_KEY, JSON.stringify(filterSets))
    return true
  } catch {
    return false
  }
}

function createSavedFilterId(name: string, existing: PipelineSavedFilterSet[]): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'filter'
  let id = base
  let suffix = 2
  while (existing.some((set) => set.id === id)) {
    id = `${base}-${suffix}`
    suffix += 1
  }
  return id
}

function getPipelineSearchText(entry: PipelineEntry): string {
  return [
    entry.company,
    entry.role,
    entry.notes,
    entry.nextStep,
    entry.skillMatch,
    entry.jobDescription?.slice(0, MAX_SEARCHABLE_JOB_DESCRIPTION_CHARS),
  ].filter(Boolean).join(' ').toLowerCase()
}

function entryCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'entry' : 'entries'}`
}

function normalizeFilterSetName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

function detectLegacyPipelineData(): boolean {
  try {
    const raw = getLocalStorage()?.getItem('pipeline-data')
    if (!raw) return false
    const parsed = JSON.parse(raw)
    const legacy = Array.isArray(parsed) ? parsed : parsed?.entries
    return Array.isArray(legacy) ? legacy.length > 0 : true
  } catch {
    return true
  }
}

export function PipelinePage() {
  const allEntries = usePipelineStore((s) => s.entries)
  const addEntry = usePipelineStore((s) => s.addEntry)
  const updateEntry = usePipelineStore((s) => s.updateEntry)
  const deleteEntry = usePipelineStore((s) => s.deleteEntry)
  const importEntries = usePipelineStore((s) => s.importEntries)
  const setStatus = usePipelineStore((s) => s.setStatus)
  const addHistoryNote = usePipelineStore((s) => s.addHistoryNote)
  const currentIdentity = useIdentityStore((s) => s.currentIdentity)
  const jdAnalyses = useJDAnalysisStore((s) => s.analyses)

  const navigate = useNavigate()

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [modal, setModal] = useState<ModalState>(null)
  const [analyticsOpen, setAnalyticsOpen] = useState(false)
  const [filters, setFilters] = useState<PipelineFilterState>({ tiers: [], statuses: [], search: '' })
  const [sortField, setSortField] = useState<SortField>('tier')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [openAnalysisId, setOpenAnalysisId] = useState<string | null>(null)
  const [investigatingId, setInvestigatingId] = useState<string | null>(null)
  const [analyzingJdId, setAnalyzingJdId] = useState<string | null>(null)
  const [investigationErrors, setInvestigationErrors] = useState<Record<string, string>>({})
  const [analysisErrors, setAnalysisErrors] = useState<Record<string, string>>({})
  const [savedFilterSets, setSavedFilterSets] = useState<PipelineSavedFilterSet[]>(() =>
    readSavedFilterSets(),
  )
  const [activeFilterSetId, setActiveFilterSetId] = useState<string | null>(null)
  const [hasLegacyData, setHasLegacyData] = useState(detectLegacyPipelineData)
  const [pipelineNotice, setPipelineNotice] = useState<PipelineNotice | null>(null)
  const honoredLinkedEntryRef = useRef<string | null>(null)

  const importRef = useRef<HTMLInputElement>(null)
  const aiEndpoint = useMemo(
    () => sanitizeEndpointUrl(getFacetClientEnv().anthropicProxyUrl),
    [],
  )
  const search = useSearch({ strict: false }) as { entry?: string }
  const requestedEntryId = typeof search.entry === 'string' ? search.entry : ''
  const entries = useMemo(
    () => allEntries.filter((entry) => !entry.deletedAt),
    [allEntries],
  )
  const jdAnalysisById = useMemo(
    () => new Map(jdAnalyses.map((analysis) => [analysis.id, analysis])),
    [jdAnalyses],
  )
  const analysisStates = useMemo<Record<string, PipelineJDAnalysisViewState>>(() => {
    const identityVersion = currentIdentity?.model_revision ?? null

    return Object.fromEntries(
      entries.map((entry) => [
        entry.id,
        getPipelineJDAnalysisViewState(
          entry,
          entry.jdAnalysisId ? jdAnalysisById.get(entry.jdAnalysisId) ?? null : null,
          identityVersion,
        ),
      ]),
    )
  }, [currentIdentity?.model_revision, entries, jdAnalysisById])

  useEffect(() => {
    setHasLegacyData(detectLegacyPipelineData())
  }, [])

  useEffect(() => {
    if (pipelineNotice?.tone !== 'success') return
    const timeoutId = window.setTimeout(() => {
      setPipelineNotice((current) => (current === pipelineNotice ? null : current))
    }, 5000)
    return () => window.clearTimeout(timeoutId)
  }, [pipelineNotice])

  useEffect(() => {
    if (!requestedEntryId) return
    if (honoredLinkedEntryRef.current === requestedEntryId) return
    if (entries.some((entry) => entry.id === requestedEntryId)) {
      setExpandedId(requestedEntryId)
      honoredLinkedEntryRef.current = requestedEntryId
    }
  }, [entries, requestedEntryId])

  const handleSort = useCallback(
    (field: SortField) => {
      setSortDir((prev) => (sortField === field ? (prev === 'asc' ? 'desc' : 'asc') : 'asc'))
      setSortField(field)
    },
    [sortField]
  )

  const searchTextByEntryId = useMemo(
    () => new Map(entries.map((entry) => [entry.id, getPipelineSearchText(entry)])),
    [entries],
  )

  const filteredEntries = useMemo(() => {
    let result = [...entries]

    if (filters.tiers.length > 0) {
      result = result.filter((e) => filters.tiers.includes(e.tier))
    }
    if (filters.statuses.length > 0) {
      result = result.filter((e) => filters.statuses.includes(e.status))
    }
    const query = filters.search.trim().toLowerCase()
    if (query) {
      result = result.filter((entry) => (searchTextByEntryId.get(entry.id) ?? '').includes(query))
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
  }, [entries, filters, searchTextByEntryId, sortField, sortDir])

  const handleSaveFilterSet = useCallback(
    (name: string) => {
      const trimmedName = normalizeFilterSetName(name)
      if (!trimmedName) {
        setPipelineNotice({
          tone: 'warning',
          title: 'Filter set not saved',
          detail: 'Name this filter set before saving it.',
        })
        return
      }
      if (trimmedName.length > FILTER_SET_NAME_MAX_LENGTH) {
        setPipelineNotice({
          tone: 'warning',
          title: 'Filter set not saved',
          detail: `Use ${FILTER_SET_NAME_MAX_LENGTH} characters or fewer for the filter set name.`,
        })
        return
      }

      const existing = savedFilterSets.find(
        (set) => set.name.toLowerCase() === trimmedName.toLowerCase(),
      )
      if (!existing && savedFilterSets.length >= MAX_SAVED_FILTER_SETS) {
        setPipelineNotice({
          tone: 'warning',
          title: 'Filter set not saved',
          detail: `You can save up to ${MAX_SAVED_FILTER_SETS} filter sets. Replace an existing saved filter to continue.`,
        })
        return
      }
      const nextSet: PipelineSavedFilterSet = {
        id: existing?.id ?? createSavedFilterId(trimmedName, savedFilterSets),
        name: existing?.name ?? trimmedName,
        filters: {
          tiers: [...filters.tiers],
          statuses: [...filters.statuses],
          search: filters.search.trim(),
        },
      }
      const nextSets = existing
        ? savedFilterSets.map((set) => (set.id === existing.id ? nextSet : set))
        : [...savedFilterSets, nextSet]

      setSavedFilterSets(nextSets)
      setFilters(nextSet.filters)
      setActiveFilterSetId(nextSet.id)
      const didPersist = writeSavedFilterSets(nextSets)
      setPipelineNotice({
        tone: didPersist ? 'success' : 'error',
        title: didPersist ? `Saved filter set "${trimmedName}"` : 'Filter set not saved',
        detail: didPersist
          ? 'This saved filter is available in this browser.'
          : 'Local storage was unavailable, so the filter set could not be saved.',
      })
    },
    [filters, savedFilterSets],
  )

  const handleApplyFilterSet = useCallback(
    (id: string) => {
      const filterSet = savedFilterSets.find((set) => set.id === id)
      if (!filterSet) return
      setFilters({
        tiers: [...filterSet.filters.tiers],
        statuses: [...filterSet.filters.statuses],
        search: filterSet.filters.search,
      })
      setPipelineNotice({
        tone: 'success',
        title: `Applied filter set "${filterSet.name}"`,
      })
      setActiveFilterSetId(filterSet.id)
    },
    [savedFilterSets],
  )

  const handleFilterChange = useCallback((nextFilters: PipelineFilterState) => {
    setFilters(nextFilters)
    setActiveFilterSetId(null)
  }, [])

  const activeFilterSetName = useMemo(
    () => savedFilterSets.find((set) => set.id === activeFilterSetId)?.name ?? null,
    [activeFilterSetId, savedFilterSets],
  )

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
    if (!useJDAnalysisStore.getState().findByPipelineEntry(entry.id)) {
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
    async (entry: PipelineEntry) => {
      const jobDescription = entry.jobDescription?.trim() ?? ''
      if (!jobDescription) {
        setAnalysisErrors((current) => ({
          ...current,
          [entry.id]: 'Attach a job description before analyzing this pipeline entry.',
        }))
        return
      }
      setAnalysisErrors((current) => ({ ...current, [entry.id]: '' }))
      if (!aiEndpoint) {
        setAnalysisErrors((current) => ({
          ...current,
          [entry.id]: 'JD analysis is disabled. Configure VITE_ANTHROPIC_PROXY_URL.',
        }))
        return
      }
      if (!currentIdentity) {
        setAnalysisErrors((current) => ({
          ...current,
          [entry.id]: 'Apply an identity model before analyzing a pipeline JD.',
        }))
        return
      }

      try {
        setAnalyzingJdId(entry.id)
        const analysis = await analyzePipelineJobDescription({
          endpoint: aiEndpoint,
          pipelineEntryId: entry.id,
          jobDescription,
          identity: currentIdentity,
        })
        savePipelineJDAnalysis(analysis)
        addHistoryNote(entry.id, entry.jdAnalysisId ? 'Refreshed JD analysis' : 'Analyzed JD')
      } catch (error) {
        const message = error instanceof Error ? error.message : 'JD analysis failed.'
        setAnalysisErrors((current) => ({ ...current, [entry.id]: message }))
      } finally {
        setAnalyzingJdId((current) => (current === entry.id ? null : current))
      }
    },
    [addHistoryNote, aiEndpoint, currentIdentity],
  )

  const handleOpenInBuilder = useCallback(
    (entry: PipelineEntry) => {
      const handoff = buildPipelineHandoff(entry)
      if (handoff) {
        useHandoffStore.getState().setPendingGeneration(handoff)
        void navigate({ to: '/build' })
        return
      }

      if (entry.jobDescription?.trim()) {
        setAnalysisErrors((current) => ({
          ...current,
          [entry.id]: 'Analyze this JD from Pipeline before generating a resume.',
        }))
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
          setPipelineNotice({
            tone: 'error',
            title: 'Import failed',
            detail:
              result.skipped > 0
                ? `${result.error} Check that each entry includes id, company, and role.`
                : result.error,
          })
          return
        }
        importEntries(result.entries)
        if (result.skipped > 0) {
          setPipelineNotice({
            tone: 'warning',
            title: `Imported ${entryCountLabel(result.entries.length)}`,
            detail: `${entryCountLabel(result.skipped)} skipped because they were missing required fields or had invalid format.`,
          })
          return
        }
        setPipelineNotice({
          tone: 'success',
          title: `Imported ${entryCountLabel(result.entries.length)}`,
          detail: 'Pipeline data replaced with imported JSON.',
        })
      }).catch(() => {
        setPipelineNotice({
          tone: 'error',
          title: 'Import failed',
          detail: 'The selected file could not be read. Try exporting the pipeline again and re-importing the JSON file.',
        })
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
      const storage = getLocalStorage()
      const raw = storage?.getItem('pipeline-data')
      if (!raw) {
        setHasLegacyData(false)
        return
      }
      const parsed = JSON.parse(raw)
      const legacy = Array.isArray(parsed) ? parsed : parsed?.entries
      if (Array.isArray(legacy) && legacy.length > 0) {
        // Sanitize URLs in legacy data before importing
        const sanitized = legacy.map((e: PipelineEntry) => ({
          ...e,
          url: e.url ? (sanitizeUrl(e.url) ?? '') : '',
        }))
        importEntries(sanitized)
        storage?.removeItem('pipeline-data')
        setHasLegacyData(false)
        setPipelineNotice({
          tone: 'success',
          title: `Imported ${entryCountLabel(sanitized.length)} from legacy data`,
          detail: 'Legacy pipeline data was moved into the current workspace.',
        })
        return
      }
      setPipelineNotice({
        tone: 'warning',
        title: 'Legacy import skipped',
        detail: 'Saved legacy data did not contain pipeline entries.',
      })
      setHasLegacyData(false)
    } catch {
      setPipelineNotice({
        tone: 'error',
        title: 'Legacy import failed',
        detail: 'Saved legacy pipeline data was not valid JSON.',
      })
      setHasLegacyData(false)
    }
  }, [importEntries])

  const pipelineNoticeElement = pipelineNotice
    ? (() => {
        const toneLabel =
          pipelineNotice.tone === 'success'
            ? 'Success'
            : pipelineNotice.tone === 'warning'
              ? 'Warning'
              : 'Error'
        return (
          <div
            className={`pipeline-notice pipeline-notice-${pipelineNotice.tone}`}
            role={pipelineNotice.tone === 'error' ? 'alert' : 'status'}
          >
            <div>
              <strong>
                {toneLabel}: {pipelineNotice.title}
              </strong>
              {pipelineNotice.detail && <span>{pipelineNotice.detail}</span>}
            </div>
            <button
              className="pipeline-notice-dismiss"
              aria-label="Dismiss pipeline notice"
              onClick={() => setPipelineNotice(null)}
            >
              Dismiss
            </button>
          </div>
        )
      })()
    : null

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
        {pipelineNoticeElement}
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

      {pipelineNoticeElement}

      <PipelineStats entries={entries} />

      {analyticsOpen && <PipelineAnalytics entries={entries} onClose={() => setAnalyticsOpen(false)} />}

      <PipelineFilters
        filters={filters}
        savedFilterSets={savedFilterSets}
        activeFilterSetName={activeFilterSetName}
        onFilterChange={handleFilterChange}
        onSaveFilterSet={handleSaveFilterSet}
        onApplyFilterSet={handleApplyFilterSet}
      />

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
        onToggleAnalysis={(entry) => setOpenAnalysisId((current) => (current === entry.id ? null : entry.id))}
        onStatusChange={setStatus}
        onOpenInBuilder={handleOpenInBuilder}
        onInvestigate={handleInvestigate}
        analysisStates={analysisStates}
        openAnalysisId={openAnalysisId}
        canInvestigate={Boolean(aiEndpoint)}
        investigatingId={investigatingId}
        analyzingJdId={analyzingJdId}
        investigationErrors={investigationErrors}
        analysisErrors={analysisErrors}
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
