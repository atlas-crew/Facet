import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { Download, ExternalLink, Plus, Sparkles, Trash2, Upload } from 'lucide-react'
import { AiActivityIndicator } from '../../components/AiActivityIndicator'
import { assembleResume } from '../../engine/assembler'
import { PrepCardGrid } from './PrepCardGrid'
import { PrepPracticeMode } from './PrepPracticeMode'
import { PrepSearch } from './PrepSearch'
import { useMatchStore } from '../../store/matchStore'
import { useIdentityStore } from '../../store/identityStore'
import { usePrepStore } from '../../store/prepStore'
import { usePipelineStore } from '../../store/pipelineStore'
import { useResumeStore } from '../../store/resumeStore'
import { facetClientEnv } from '../../utils/facetEnv'
import { parsePrepImport } from '../../utils/prepImport'
import { buildPrepIdentityContext } from '../../utils/prepIdentityContext'
import { createMatchMaterialContext } from '../../utils/matchMaterial'
import { generateInterviewPrep } from '../../utils/prepGenerator'
import { sanitizeEndpointUrl } from '../../utils/idUtils'
import { INTERVIEW_FORMAT_VALUES } from '../../types/pipeline'
import type { InterviewFormat } from '../../types/pipeline'
import type { PrepCard, PrepCategory, PrepDeck, PrepWorkspaceMode } from '../../types/prep'
import './prep.css'

const MODE_LABELS: Record<PrepWorkspaceMode, string> = {
  edit: 'Edit',
  homework: 'Homework',
  live: 'Live Cheatsheet',
}

function formatPrepDeckUpdatedAt(updatedAt: string): string {
  const timestamp = Date.parse(updatedAt)
  if (Number.isNaN(timestamp)) return 'Updated recently'
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

const MAX_LIBRARY_DECKS_PER_GROUP = 5

const ROUND_TYPE_LABELS: Record<string, string> = {
  'hr-screen': 'HR Screen',
  'hm-screen': 'HM Screen',
  'tech-discussion': 'Technical',
  'system-design': 'System Design',
  'take-home': 'Take Home',
  'live-coding': 'Live Coding',
  leetcode: 'LeetCode',
  'pair-programming': 'Pair Programming',
  behavioral: 'Behavioral',
  'peer-panel': 'Peer Panel',
  'cross-team': 'Cross-Team',
  exec: 'Exec',
  presentation: 'Presentation',
}

function formatPrepRoundTypeLabel(roundType?: PrepDeck['roundType']): string {
  if (!roundType) return 'General'
  return ROUND_TYPE_LABELS[roundType] ?? roundType.split('-').map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1)).join(' ')
}

function formatPrepCategoryLabel(category: PrepCategory): string {
  return category.charAt(0).toUpperCase() + category.slice(1)
}

export function PrepPage() {
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as { vector?: string; skills?: string; q?: string }
  const importRef = useRef<HTMLInputElement>(null)
  const modeTabListRef = useRef<HTMLDivElement>(null)
  const currentReport = useMatchStore((state) => state.currentReport)
  const [query, setQuery] = useState(search.q ?? '')
  const [category, setCategory] = useState<PrepCategory | 'all'>('all')
  const [vectorFilter, setVectorFilter] = useState(search.vector ?? '')
  const [generationSource, setGenerationSource] = useState<'match' | 'pipeline'>(currentReport ? 'match' : 'pipeline')
  const [selectedEntryId, setSelectedEntryId] = useState<string>('')
  const [selectedVectorId, setSelectedVectorId] = useState(search.vector ?? '')
  const [companyResearchDraft, setCompanyResearchDraft] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationError, setGenerationError] = useState<string | null>(null)
  const [expandedLibraryGroups, setExpandedLibraryGroups] = useState<Record<string, boolean>>({})
  const [editGroupOpen, setEditGroupOpen] = useState({
    liveGuidance: true,
    categoryGuidance: false,
    sourceMaterial: true,
  })
  const previousCategoryCountRef = useRef(0)

  const {
    decks,
    activeDeckId,
    activeMode,
    setActiveDeck,
    setActiveMode,
    createDeck,
    updateDeck,
    addCard,
    updateCard,
    recordCardReview,
    duplicateCard,
    removeCard,
    deleteDeck,
    importDecks,
    exportDecks,
  } = usePrepStore()
  const currentIdentity = useIdentityStore((state) => state.currentIdentity)
  const pipelineEntries = usePipelineStore((state) => state.entries)
  const resumeData = useResumeStore((state) => state.data)
  const matchMaterial = useMemo(
    () => (currentReport ? createMatchMaterialContext(resumeData, currentReport) : null),
    [currentReport, resumeData],
  )
  const activeDeck = useMemo(
    () => decks.find((deck) => deck.id === activeDeckId) ?? null,
    [decks, activeDeckId],
  )
  const deckLibrary = useMemo(
    () => [...decks].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    [decks],
  )
  const groupedLibrary = useMemo(() => {
    const groups = new Map<string, PrepDeck[]>()
    for (const deck of deckLibrary) {
      const key = deck.company?.trim() || ''
      const existing = groups.get(key)
      if (existing) {
        existing.push(deck)
      } else {
        groups.set(key, [deck])
      }
    }
    return [...groups.entries()]
      .map(([companyKey, groupDecks]) => ({
        companyKey: companyKey || '__ungrouped__',
        company: companyKey || 'Ungrouped',
        decks: groupDecks,
      }))
      .sort((a, b) => {
        if (a.company === 'Ungrouped') return 1
        if (b.company === 'Ungrouped') return -1
        return b.decks[0].updatedAt.localeCompare(a.decks[0].updatedAt)
      })
  }, [deckLibrary])

  useEffect(() => {
    if (!activeDeckId && decks.length > 0) {
      setActiveDeck(decks[0].id)
    }
  }, [activeDeckId, decks, setActiveDeck])

  const aiEndpoint = useMemo(
    () => sanitizeEndpointUrl(facetClientEnv.anthropicProxyUrl),
    [],
  )

  const candidateEntries = useMemo(() => {
    const byStatus = [...pipelineEntries].sort((left, right) => right.lastAction.localeCompare(left.lastAction))
    if (!vectorFilter) return byStatus
    return byStatus.filter((entry) => entry.vectorId === vectorFilter)
  }, [pipelineEntries, vectorFilter])

  useEffect(() => {
    if (selectedEntryId) return
    const first = candidateEntries[0]
    if (first) {
      setSelectedEntryId(first.id)
      setSelectedVectorId(first.vectorId ?? search.vector ?? '')
      setCompanyResearchDraft(
        [first.positioning, first.notes, first.url].filter(Boolean).join('\n\n'),
      )
    }
  }, [candidateEntries, search.vector, selectedEntryId])

  useEffect(() => {
    if (!currentReport && generationSource === 'match') {
      setGenerationSource('pipeline')
    }
  }, [currentReport, generationSource])

  const selectedEntry = useMemo(
    () => pipelineEntries.find((entry) => entry.id === selectedEntryId) ?? null,
    [pipelineEntries, selectedEntryId],
  )

  useEffect(() => {
    if (!selectedEntryId) return
    if (!selectedEntry) {
      setSelectedEntryId('')
    }
  }, [selectedEntry, selectedEntryId])

  useEffect(() => {
    if (generationSource !== 'match' || !matchMaterial) return
    setSelectedVectorId(matchMaterial.vector.id)
    setCompanyResearchDraft((current) => current || matchMaterial.briefingNotes)
  }, [generationSource, matchMaterial])

  const filteredCards = useMemo(() => {
    const cards = activeDeck?.cards ?? []
    let result = [...cards]

    if (category !== 'all') {
      result = result.filter((card) => card.category === category)
    }

    if (vectorFilter) {
      result = result.filter(
        (card) =>
          card.vectorId === vectorFilter ||
          card.tags.some((tag) => tag.toLowerCase().includes(vectorFilter.toLowerCase())),
      )
    }

    if (search.skills) {
      const skillTerms = search.skills
        .split(',')
        .map((term) => term.trim().toLowerCase())
        .filter(Boolean)
      if (skillTerms.length > 0) {
        result = result.filter((card) =>
          skillTerms.some((term) => card.tags.some((tag) => tag.toLowerCase().includes(term))),
        )
      }
    }

    if (query) {
      const normalizedQuery = query.toLowerCase()
      result = result.filter(
        (card) =>
          card.title.toLowerCase().includes(normalizedQuery) ||
          card.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery)) ||
          (card.script ?? '').toLowerCase().includes(normalizedQuery) ||
          (card.notes ?? '').toLowerCase().includes(normalizedQuery),
      )
    }

    return result
  }, [activeDeck?.cards, category, query, search.skills, vectorFilter])
  const linkedPipelineEntry = useMemo(
    () => activeDeck?.pipelineEntryId ? pipelineEntries.find((entry) => entry.id === activeDeck.pipelineEntryId) ?? null : null,
    [activeDeck?.pipelineEntryId, pipelineEntries],
  )
  const roundTypeOptions = useMemo(() => {
    const sourceOptions = linkedPipelineEntry?.format.length
      ? linkedPipelineEntry.format
      : [...INTERVIEW_FORMAT_VALUES]
    return [...new Set([
      ...(activeDeck?.roundType ? [activeDeck.roundType] : []),
      ...sourceOptions,
    ])]
  }, [activeDeck?.roundType, linkedPipelineEntry])
  const activeDeckCategories = useMemo(
    () => [...new Set((activeDeck?.cards ?? []).map((card) => card.category))],
    [activeDeck?.cards],
  )

  useEffect(() => {
    const hasCategoryGuidance = activeDeckCategories.length > 0
    previousCategoryCountRef.current = activeDeckCategories.length
    setEditGroupOpen({
      liveGuidance: true,
      categoryGuidance: hasCategoryGuidance,
      sourceMaterial: true,
    })
  }, [activeDeck?.id])

  useEffect(() => {
    if (previousCategoryCountRef.current === 0 && activeDeckCategories.length > 0) {
      setEditGroupOpen((current) => ({
        ...current,
        categoryGuidance: true,
      }))
    }
    previousCategoryCountRef.current = activeDeckCategories.length
  }, [activeDeckCategories.length])

  useEffect(() => {
    if (!activeDeck && activeMode !== 'edit') {
      setActiveMode('edit')
      return
    }
    if (activeMode === 'homework' && (!activeDeck || filteredCards.length === 0)) {
      setActiveMode('edit')
    }
  }, [activeDeck, activeMode, filteredCards.length, setActiveMode])

  const handleImport = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return
      void parsePrepImport(file).then((result) => {
        if (result.error) {
          window.alert(result.error)
          return
        }
        importDecks(result.decks)
        if (result.skipped > 0) {
          window.alert(`Imported ${result.decks.length} deck(s). ${result.skipped} records were skipped.`)
        }
      })
      event.target.value = ''
    },
    [importDecks],
  )

  const handleExport = useCallback(() => {
    const blob = new Blob([JSON.stringify(exportDecks(), null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `prep-workspace-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }, [exportDecks])

  const handleCreateBlankDeck = useCallback(() => {
    const vectorId =
      generationSource === 'match'
        ? (matchMaterial?.vector.id ?? activeDeck?.vectorId ?? '')
        : (selectedVectorId || activeDeck?.vectorId || '')
    const title = generationSource === 'match' && matchMaterial
      ? `${matchMaterial.company} ${matchMaterial.role} Interview Prep`
      : selectedEntry != null
        ? `${selectedEntry.company} ${selectedEntry.role} Interview Prep`
        : 'Interview Prep'
    createDeck({
      title,
      company:
        generationSource === 'match'
          ? (matchMaterial?.company ?? activeDeck?.company ?? '')
          : (selectedEntry?.company ?? activeDeck?.company ?? ''),
      role:
        generationSource === 'match'
          ? (matchMaterial?.role ?? activeDeck?.role ?? '')
          : (selectedEntry?.role ?? activeDeck?.role ?? ''),
      vectorId,
      pipelineEntryId: generationSource === 'pipeline' ? selectedEntry?.id ?? null : null,
      companyUrl: generationSource === 'pipeline' ? selectedEntry?.url || undefined : undefined,
      skillMatch: generationSource === 'match' ? matchMaterial?.skillMatch : selectedEntry?.skillMatch || undefined,
      positioning: generationSource === 'match' ? matchMaterial?.positioning : selectedEntry?.positioning || undefined,
      notes: generationSource === 'match' ? matchMaterial?.notes : selectedEntry?.notes || undefined,
      companyResearch: companyResearchDraft || undefined,
      jobDescription: generationSource === 'match' ? matchMaterial?.jobDescription : selectedEntry?.jobDescription || undefined,
      cards: [],
    })
  }, [activeDeck?.company, activeDeck?.role, activeDeck?.vectorId, companyResearchDraft, createDeck, generationSource, matchMaterial, selectedEntry, selectedVectorId])

  const handleGenerate = useCallback(async () => {
    if (!aiEndpoint) {
      setGenerationError('AI generation is disabled. Configure VITE_ANTHROPIC_PROXY_URL.')
      return
    }

    setGenerationError(null)
    setIsGenerating(true)

    try {
      const freshResumeData = useResumeStore.getState().data
      const activeMatchMaterial =
        generationSource === 'match' && currentReport
          ? createMatchMaterialContext(freshResumeData, currentReport)
          : null

      if (generationSource === 'match') {
        if (!activeMatchMaterial) {
          setGenerationError('Generate a Phase 1 match report before generating prep.')
          return
        }

        const result = await generateInterviewPrep(aiEndpoint, {
          company: activeMatchMaterial.company,
          role: activeMatchMaterial.role,
          vectorId: activeMatchMaterial.vector.id,
          vectorLabel: activeMatchMaterial.vector.label,
          skillMatch: activeMatchMaterial.skillMatch,
          positioning: activeMatchMaterial.positioning,
          notes: activeMatchMaterial.notes,
          companyResearch: companyResearchDraft || undefined,
          jobDescription: activeMatchMaterial.jobDescription,
          identityContext: currentIdentity
            ? buildPrepIdentityContext(currentIdentity, activeMatchMaterial.vector.id, activeMatchMaterial.vector.label)
            : undefined,
          resumeContext: {
            candidate: freshResumeData.meta,
            vector: activeMatchMaterial.vector,
            assembled: activeMatchMaterial.assembled,
          },
        })

        createDeck({
          title: result.deckTitle,
          company: activeMatchMaterial.company,
          role: activeMatchMaterial.role,
          vectorId: activeMatchMaterial.vector.id,
          pipelineEntryId: null,
          donts: result.donts,
          questionsToAsk: result.questionsToAsk,
          categoryGuidance: result.categoryGuidance,
          skillMatch: activeMatchMaterial.skillMatch,
          positioning: activeMatchMaterial.positioning,
          notes: activeMatchMaterial.notes,
          companyResearch: result.companyResearchSummary || companyResearchDraft || undefined,
          jobDescription: activeMatchMaterial.jobDescription,
          generatedAt: new Date().toISOString(),
          cards: result.cards.map((card) => ({
            ...card,
            company: activeMatchMaterial.company,
            role: activeMatchMaterial.role,
            vectorId: activeMatchMaterial.vector.id,
            pipelineEntryId: null,
            source: 'ai',
          })),
        })
        return
      }

      if (!selectedEntry) {
        setGenerationError('Choose a pipeline entry before generating prep.')
        return
      }
      if (!selectedVectorId) {
        setGenerationError('Choose a matching vector before generating prep.')
        return
      }
      if (!selectedEntry.jobDescription.trim()) {
        setGenerationError('The selected pipeline entry does not have a job description yet.')
        return
      }

      const vector = freshResumeData.vectors.find((item) => item.id === selectedVectorId)
      if (!vector) {
        setGenerationError('The selected vector could not be found in resume data.')
        return
      }
      const selectedRoundType = selectedEntry.format.length === 1 ? selectedEntry.format[0] : undefined

      const assembled = assembleResume(freshResumeData, {
        selectedVector: vector.id,
        manualOverrides: freshResumeData.manualOverrides?.[vector.id] ?? {},
        bulletOrderByRole: freshResumeData.bulletOrders?.[vector.id] ?? {},
        targetPages: 2,
        variables: freshResumeData.variables ?? {},
      }).resume

      const result = await generateInterviewPrep(aiEndpoint, {
        company: selectedEntry.company,
        role: selectedEntry.role,
        vectorId: vector.id,
        vectorLabel: vector.label,
        roundType: selectedRoundType,
        companyUrl: selectedEntry.url || undefined,
        skillMatch: selectedEntry.skillMatch || undefined,
        positioning: selectedEntry.positioning || undefined,
        notes: selectedEntry.notes || undefined,
        companyResearch: companyResearchDraft || undefined,
        jobDescription: selectedEntry.jobDescription,
        identityContext: currentIdentity
          ? buildPrepIdentityContext(currentIdentity, vector.id, vector.label)
          : undefined,
        resumeContext: {
          candidate: freshResumeData.meta,
          vector,
          assembled,
        },
      })

      createDeck({
        title: result.deckTitle,
        company: selectedEntry.company,
        role: selectedEntry.role,
        vectorId: vector.id,
        pipelineEntryId: selectedEntry.id,
        roundType: selectedRoundType,
        donts: result.donts,
        questionsToAsk: result.questionsToAsk,
        categoryGuidance: result.categoryGuidance,
        companyUrl: selectedEntry.url || undefined,
        skillMatch: selectedEntry.skillMatch || undefined,
        positioning: selectedEntry.positioning || undefined,
        notes: selectedEntry.notes || undefined,
        companyResearch: result.companyResearchSummary || companyResearchDraft || undefined,
        jobDescription: selectedEntry.jobDescription,
        generatedAt: new Date().toISOString(),
        cards: result.cards.map((card) => ({
          ...card,
          company: selectedEntry.company,
          role: selectedEntry.role,
          vectorId: vector.id,
          pipelineEntryId: selectedEntry.id,
          source: 'ai',
        })),
      })
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : 'Prep generation failed.')
    } finally {
      setIsGenerating(false)
    }
  }, [aiEndpoint, companyResearchDraft, createDeck, currentIdentity, currentReport, generationSource, selectedEntry, selectedVectorId])

  const handleGenerationSourceChange = useCallback((nextSource: 'match' | 'pipeline') => {
    setGenerationSource(nextSource)
    setGenerationError(null)
    if (nextSource === 'match' && matchMaterial) {
      setSelectedVectorId(matchMaterial.vector.id)
      setCompanyResearchDraft(matchMaterial.briefingNotes)
      return
    }

    if (nextSource === 'pipeline' && selectedEntry) {
      setSelectedVectorId(selectedEntry.vectorId ?? '')
      setCompanyResearchDraft(
        [selectedEntry.positioning, selectedEntry.notes, selectedEntry.url].filter(Boolean).join('\n\n'),
      )
    }
  }, [matchMaterial, selectedEntry])

  const handleAddCard = useCallback(() => {
    if (!activeDeck) return
    addCard(activeDeck.id, {
      category: 'behavioral',
      title: 'New Prep Card',
      tags: [
        activeDeck.company,
        activeDeck.role,
        activeDeck.vectorId,
      ].filter(Boolean),
      company: activeDeck.company || undefined,
      role: activeDeck.role || undefined,
      vectorId: activeDeck.vectorId || undefined,
      pipelineEntryId: activeDeck.pipelineEntryId,
    })
  }, [activeDeck, addCard])

  const handleUpdateCard = useCallback(
    (cardId: string, patch: Partial<PrepCard>) => {
      if (!activeDeck) return
      updateCard(activeDeck.id, cardId, patch)
    },
    [activeDeck, updateCard],
  )

  const handleDuplicateCard = useCallback(
    (cardId: string) => {
      if (!activeDeck) return
      duplicateCard(activeDeck.id, cardId)
    },
    [activeDeck, duplicateCard],
  )

  const handleRemoveCard = useCallback(
    (cardId: string) => {
      if (!activeDeck) return
      removeCard(activeDeck.id, cardId)
    },
    [activeDeck, removeCard],
  )

  const handleDeleteDeck = useCallback(() => {
    if (!activeDeck) return
    if (!window.confirm(`Delete prep set "${activeDeck.title}"?`)) return
    deleteDeck(activeDeck.id)
  }, [activeDeck, deleteDeck])

  const isHomeworkDisabled = !activeDeck || filteredCards.length === 0
  const isLiveDisabled = !activeDeck || activeDeck.cards.length === 0

  const handleModeTabKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return

    const tabs = modeTabListRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    if (!tabs || tabs.length === 0) return

    const currentIndex = Array.from(tabs).findIndex((tab) => tab === document.activeElement)
    if (currentIndex === -1) return

    event.preventDefault()
    const delta = event.key === 'ArrowRight' ? 1 : -1
    let nextIndex = currentIndex

    for (let attempts = 0; attempts < tabs.length; attempts += 1) {
      nextIndex = (nextIndex + delta + tabs.length) % tabs.length
      if (tabs[nextIndex]?.getAttribute('aria-disabled') !== 'true') {
        tabs[nextIndex]?.focus()
        return
      }
    }
  }, [])

  const updateActiveDeck = useCallback(
    (patch: Partial<Omit<PrepDeck, 'id' | 'cards'>>) => {
      if (!activeDeck) return
      updateDeck(activeDeck.id, patch)
    },
    [activeDeck, updateDeck],
  )
  const updateActiveDeckListItem = useCallback(
    (field: 'donts', index: number, value: string) => {
      if (!activeDeck) return
      const currentItems = activeDeck[field] ?? []
      updateActiveDeck({
        [field]: currentItems.map((item, itemIndex) => itemIndex === index ? value : item),
      })
    },
    [activeDeck, updateActiveDeck],
  )
  const updateQuestionToAsk = useCallback(
    (index: number, patch: { question?: string; context?: string }) => {
      if (!activeDeck) return
      const currentItems = activeDeck.questionsToAsk ?? []
      updateActiveDeck({
        questionsToAsk: currentItems.map((item, itemIndex) => (
          itemIndex === index ? { ...item, ...patch } : item
        )),
      })
    },
    [activeDeck, updateActiveDeck],
  )
  const updateCategoryGuidance = useCallback(
    (prepCategory: PrepCategory, value: string) => {
      const currentGuidance = activeDeck?.categoryGuidance ?? {}
      const nextValue = value.trim()
      if (!nextValue) {
        const { [prepCategory]: _removed, ...rest } = currentGuidance
        updateActiveDeck({ categoryGuidance: Object.keys(rest).length > 0 ? rest : undefined })
        return
      }
      updateActiveDeck({
        categoryGuidance: {
          ...currentGuidance,
          [prepCategory]: value,
        },
      })
    },
    [activeDeck?.categoryGuidance, updateActiveDeck],
  )

  return (
    <div className="prep-page">
      <div className="prep-header">
        <div>
          <h1>Interview Prep</h1>
          <p className="prep-header-copy">
            Build one prep deck, then switch between editing, homework rehearsal, and a live interview cheatsheet from the same source.
          </p>
        </div>

        <div className="prep-header-actions">
          <button className="prep-btn" onClick={handleAddCard} disabled={!activeDeck}>
            <Plus size={16} />
            Add Card
          </button>
          <button className="prep-btn" onClick={() => importRef.current?.click()}>
            <Upload size={16} />
            Import
          </button>
          <input ref={importRef} type="file" accept=".json" className="import-file-input" onChange={handleImport} />
          <button className="prep-btn" onClick={handleExport}>
            <Download size={16} />
            Export
          </button>
          <button className="prep-btn prep-btn-danger" onClick={handleDeleteDeck} disabled={!activeDeck}>
            <Trash2 size={16} />
            Delete Set
          </button>
        </div>
      </div>

      {deckLibrary.length > 0 ? (
        <section className="prep-panel prep-library-panel">
          <div className="prep-panel-header">
            <div>
              <h2>Prep Library</h2>
              <p>Interview prep sets organized by company. Select a set to load it into the workspace.</p>
            </div>
            <span className="prep-mode-chip">{deckLibrary.length} saved</span>
          </div>

          <div className="prep-library-groups">
            {groupedLibrary.map((group) => {
              const isExpanded = expandedLibraryGroups[group.companyKey] ?? false
              const visibleDecks = isExpanded
                ? group.decks
                : group.decks.slice(0, MAX_LIBRARY_DECKS_PER_GROUP)
              const hiddenCount = group.decks.length - visibleDecks.length

              return (
                <div key={group.companyKey} className="prep-library-group">
                  <div className="prep-library-group-header">
                    <h3 className="prep-library-group-title">{group.company}</h3>
                    <span className="prep-library-group-count">{group.decks.length} {group.decks.length === 1 ? 'set' : 'sets'}</span>
                  </div>
                  <div className="prep-library-group-decks" role="list" aria-label={`${group.company} prep sets`}>
                    {visibleDecks.map((deck, index) => {
                      const isActive = deck.id === activeDeckId
                      const isNextUp = index === 0
                      const isMuted = !isNextUp && !isActive

                      return (
                        <div key={deck.id} role="listitem">
                          <button
                            type="button"
                            className={`prep-library-card ${isActive ? 'prep-library-card-active' : ''}`}
                            data-muted={isMuted ? 'true' : undefined}
                            onClick={() => setActiveDeck(deck.id)}
                            aria-current={isActive ? 'true' : undefined}
                          >
                            <div className="prep-library-card-header">
                              <div>
                                <div className="prep-library-card-title">{deck.title}</div>
                                <div className="prep-library-card-subtitle">
                                  {deck.role || 'Untitled prep set'}
                                </div>
                                <div className="prep-library-card-badges">
                                  <span className="prep-library-card-badge prep-library-card-badge-round">
                                    {formatPrepRoundTypeLabel(deck.roundType)}
                                  </span>
                                  {isNextUp ? <span className="prep-library-card-badge prep-library-card-badge-next-up">Next Up</span> : null}
                                </div>
                              </div>
                              {isActive ? <span className="prep-mode-chip">Active</span> : null}
                            </div>
                            <div className="prep-library-card-meta">
                              <span>{deck.cards.length} cards</span>
                              <span>{deck.vectorId || 'No vector'}</span>
                              <span>{formatPrepDeckUpdatedAt(deck.updatedAt)}</span>
                            </div>
                          </button>
                        </div>
                      )
                    })}
                  </div>
                  {group.decks.length > MAX_LIBRARY_DECKS_PER_GROUP ? (
                    <button
                      type="button"
                      className="prep-library-group-more"
                      aria-label={expandedLibraryGroups[group.companyKey]
                        ? `Show less prep sets for ${group.company}`
                        : `Show ${hiddenCount} more prep sets for ${group.company}`}
                      onClick={() =>
                        setExpandedLibraryGroups((current) => ({
                          ...current,
                          [group.companyKey]: !(current[group.companyKey] ?? false),
                        }))
                      }
                    >
                      {expandedLibraryGroups[group.companyKey] ? 'Show less' : `${hiddenCount} more`}
                    </button>
                  ) : null}
                </div>
              )
            })}
          </div>
        </section>
      ) : null}

      <section className="prep-panel prep-mode-shell">
        <div className="prep-panel-header">
          <div>
            <h2>Workspace Mode</h2>
            <p>Edit the deck, rehearse with flash cards, or open a compact cheatsheet view tuned for the live interview.</p>
          </div>
          <div
            ref={modeTabListRef}
            className="prep-mode-tabs"
            role="tablist"
            aria-label="Prep workspace modes"
            onKeyDown={handleModeTabKeyDown}
          >
            <button
              type="button"
              className={`prep-mode-tab ${activeMode === 'edit' ? 'prep-mode-tab-active' : ''}`}
              role="tab"
              id="prep-mode-tab-edit"
              aria-selected={activeMode === 'edit'}
              // Panels mount only for the active mode, so aria-controls is only valid when present in the DOM.
              aria-controls={activeMode === 'edit' ? 'prep-mode-panel-edit' : undefined}
              tabIndex={activeMode === 'edit' ? 0 : -1}
              onClick={() => setActiveMode('edit')}
            >
              Edit
            </button>
            <button
              type="button"
              className={`prep-mode-tab ${activeMode === 'homework' ? 'prep-mode-tab-active' : ''}`}
              role="tab"
              id="prep-mode-tab-homework"
              aria-selected={activeMode === 'homework'}
              aria-controls={activeMode === 'homework' ? 'prep-mode-panel-homework' : undefined}
              aria-disabled={isHomeworkDisabled || undefined}
              tabIndex={activeMode === 'homework' ? 0 : -1}
              onClick={() => {
                if (isHomeworkDisabled) return
                setActiveMode('homework')
              }}
            >
              Homework
            </button>
            <button
              type="button"
              className="prep-mode-tab prep-mode-tab-launch"
              disabled={isLiveDisabled}
              onClick={() => {
                if (isLiveDisabled) return
                void navigate({ to: '/prep/live' })
              }}
            >
              <ExternalLink size={14} />
              Live Cheatsheet
            </button>
          </div>
        </div>
        <div className="prep-mode-summary">
          <span className="prep-mode-chip">Deck: {activeDeck?.title ?? 'No active deck yet'}</span>
          <span className="prep-mode-chip">Cards: {activeDeck?.cards.length ?? 0}</span>
          <span className="prep-mode-chip">
            Mode: {MODE_LABELS[activeMode]}
          </span>
        </div>
      </section>

      <section className="prep-panel">
        <div className="prep-panel-header">
          <div>
            <h2>Generate Prep</h2>
            <p>Match mode uses the current Phase 1 report. Pipeline mode remains available for older opportunities and manual research notes.</p>
          </div>
          <div className="prep-panel-actions">
            <button className="prep-btn" onClick={handleCreateBlankDeck}>
              <Plus size={16} />
              Blank Set
            </button>
            <button
              className="prep-btn prep-btn-primary ai-working-button"
              onClick={() => void handleGenerate()}
              disabled={isGenerating}
              aria-busy={isGenerating}
            >
              <Sparkles size={16} />
              {isGenerating ? 'Generating...' : 'Generate with AI'}
            </button>
            <AiActivityIndicator
              active={isGenerating}
              label="AI is drafting prep cards and talking points."
            />
          </div>
        </div>

        <div className="prep-generator-grid">
          {currentReport && (
            <fieldset className="prep-field prep-field-span-2 prep-fieldset">
              <legend className="prep-field-label">Source</legend>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={`prep-btn ${generationSource === 'match' ? 'prep-btn-primary' : ''}`}
                  onClick={() => handleGenerationSourceChange('match')}
                  aria-pressed={generationSource === 'match'}
                >
                  Current Match Report
                </button>
                <button
                  type="button"
                  className={`prep-btn ${generationSource === 'pipeline' ? 'prep-btn-primary' : ''}`}
                  onClick={() => handleGenerationSourceChange('pipeline')}
                  aria-pressed={generationSource === 'pipeline'}
                >
                  Pipeline Entry
                </button>
              </div>
            </fieldset>
          )}

          {generationSource === 'match' && matchMaterial ? (
            <div className="prep-context-card prep-field-span-2">
              <div className="prep-context-row">
                <strong>{matchMaterial.company}</strong>
                <span>{matchMaterial.role}</span>
                <span>Match {Math.round(matchMaterial.matchScore * 100)}%</span>
              </div>
              <div className="prep-context-meta">
                <span>Vector: {matchMaterial.vector.label}</span>
                <span>Skills: {matchMaterial.skillMatch || 'n/a'}</span>
                <span>Gap focus: {matchMaterial.gapFocus.join(', ') || 'n/a'}</span>
              </div>
              <details className="prep-context-details">
                <summary>Match report preview</summary>
                <div className="prep-context-body">{matchMaterial.jobDescription}</div>
              </details>
            </div>
          ) : (
            <>
              <label className="prep-field">
                <span className="prep-field-label">Pipeline entry</span>
                <select
                  className="prep-input"
                  value={selectedEntryId}
                  onChange={(event) => {
                    const nextEntry = pipelineEntries.find((entry) => entry.id === event.target.value) ?? null
                    setSelectedEntryId(event.target.value)
                    setSelectedVectorId(nextEntry?.vectorId ?? '')
                    setCompanyResearchDraft(
                      [nextEntry?.positioning, nextEntry?.notes, nextEntry?.url].filter(Boolean).join('\n\n'),
                    )
                  }}
                >
                  <option value="">Select an entry</option>
                  {candidateEntries.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.company} - {entry.role}
                    </option>
                  ))}
                </select>
              </label>

              <label className="prep-field">
                <span className="prep-field-label">Vector</span>
                <select
                  className="prep-input"
                  value={selectedVectorId}
                  onChange={(event) => setSelectedVectorId(event.target.value)}
                >
                  <option value="">Select a vector</option>
                  {resumeData.vectors.map((vector) => (
                    <option key={vector.id} value={vector.id}>
                      {vector.label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}

          <label className="prep-field prep-field-span-2">
            <span className="prep-field-label">Additional notes</span>
            <textarea
              className="prep-textarea prep-textarea-lg"
              value={companyResearchDraft}
              onChange={(event) => setCompanyResearchDraft(event.target.value)}
              placeholder="Paste company research, interviewer notes, earnings-call notes, product context, or any talking points you want the model to incorporate."
            />
          </label>

          {generationSource === 'pipeline' && selectedEntry && (
            <div className="prep-context-card prep-field-span-2">
              <div className="prep-context-row">
                <strong>{selectedEntry.company}</strong>
                <span>{selectedEntry.role}</span>
                <span>{selectedEntry.status}</span>
              </div>
              <div className="prep-context-meta">
                <span>Vector: {selectedEntry.vectorId ?? 'none'}</span>
                <span>Skills: {selectedEntry.skillMatch || 'n/a'}</span>
                <span>URL: {selectedEntry.url || 'n/a'}</span>
              </div>
              {selectedEntry.jobDescription && (
                <details className="prep-context-details">
                  <summary>Job description preview</summary>
                  <div className="prep-context-body">{selectedEntry.jobDescription}</div>
                </details>
              )}
            </div>
          )}
        </div>

        {generationError && <div className="prep-error-banner">{generationError}</div>}
      </section>

      {activeMode === 'homework' && activeDeck ? (
        <section
          id="prep-mode-panel-homework"
          role="tabpanel"
          aria-labelledby="prep-mode-tab-homework"
        >
          <PrepPracticeMode
            // Remount practice mode when the visible card set changes so the study queue resets with the filtered cards.
            key={`${activeDeck.id}:${filteredCards.map((card) => card.id).join(',')}`}
            cards={filteredCards}
            studyProgress={activeDeck.studyProgress}
            onExit={() => setActiveMode('edit')}
            onRecordReview={(cardId, confidence) => recordCardReview(activeDeck.id, cardId, confidence)}
          />
        </section>
      ) : null}

      {activeMode === 'edit' && activeDeck ? (
        <div
          id="prep-mode-panel-edit"
          role="tabpanel"
          aria-labelledby="prep-mode-tab-edit"
          className="prep-mode-panel prep-edit-mode-panel"
        >
          <section className="prep-panel">
            <div className="prep-panel-header">
              <div>
                <h2>Active Prep Set</h2>
                <p>Edit the generated deck, keep adding cards, and tailor the narratives before switching into homework or live mode.</p>
              </div>
              <div className="prep-edit-active-set-meta">
                <span className="prep-mode-chip">{activeDeck.cards.length} cards</span>
                <span className="prep-mode-chip">{activeDeck.vectorId || 'No vector'}</span>
              </div>
            </div>

            <div className="prep-edit-groups">
              <section className="prep-edit-group">
                <div className="prep-edit-group-header">
                  <div>
                    <h3>Deck Basics</h3>
                    <p>Keep the title, company, role, and vector tidy so the rest of the workspace stays anchored to the same story.</p>
                  </div>
                  <span className="prep-mode-chip">Core Setup</span>
                </div>

                <div className="prep-generator-grid">
                  <label className="prep-field">
                    <span className="prep-field-label">Title</span>
                    <input className="prep-input" value={activeDeck.title} onChange={(event) => updateActiveDeck({ title: event.target.value })} />
                  </label>
                  <label className="prep-field">
                    <span className="prep-field-label">Company</span>
                    <input className="prep-input" value={activeDeck.company} onChange={(event) => updateActiveDeck({ company: event.target.value })} />
                  </label>
                  <label className="prep-field">
                    <span className="prep-field-label">Role</span>
                    <input className="prep-input" value={activeDeck.role} onChange={(event) => updateActiveDeck({ role: event.target.value })} />
                  </label>
                  <label className="prep-field">
                    <span className="prep-field-label">Vector</span>
                    <select className="prep-input" value={activeDeck.vectorId} onChange={(event) => updateActiveDeck({ vectorId: event.target.value })}>
                      <option value="">Select a vector</option>
                      {resumeData.vectors.map((vector) => (
                        <option key={vector.id} value={vector.id}>
                          {vector.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="prep-field">
                    <span className="prep-field-label">Round type</span>
                    <select
                      className="prep-input"
                      value={activeDeck.roundType ?? ''}
                      onChange={(event) => {
                        const nextRoundType = event.target.value.trim()
                        updateActiveDeck({
                          roundType: INTERVIEW_FORMAT_VALUES.includes(nextRoundType as InterviewFormat)
                            ? nextRoundType as InterviewFormat
                            : undefined,
                        })
                      }}
                    >
                      <option value="">Select a round type</option>
                      {roundTypeOptions.map((roundType) => (
                        <option key={roundType} value={roundType}>
                          {formatPrepRoundTypeLabel(roundType)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </section>

              <details
                className="prep-edit-group prep-edit-group-collapsible"
                open={editGroupOpen.liveGuidance}
                onToggle={(event) => {
                  const nextOpen = event.currentTarget.open
                  setEditGroupOpen((current) => ({
                    ...current,
                    liveGuidance: nextOpen,
                  }))
                }}
              >
                <summary className="prep-edit-group-summary">
                  <div className="prep-edit-group-copy">
                    <span className="prep-edit-group-title">Live Guidance</span>
                    <span className="prep-edit-group-subtitle">Tune the quick-hit reminders and ask-back prompts for the live cheatsheet.</span>
                  </div>
                  <span className="prep-mode-chip">Guidance</span>
                </summary>

                <div className="prep-edit-group-body">
                  <section className="prep-section">
                    <div className="prep-section-header">
                      <div className="prep-section-heading">
                        <span className="prep-section-title">Don'ts</span>
                        <span className="prep-section-subtitle">Short reminders about what to avoid in the room.</span>
                      </div>
                      <div className="prep-section-actions">
                        <span className="prep-section-count">{(activeDeck.donts ?? []).length} entries</span>
                        <button
                          className="prep-link-btn"
                          type="button"
                          onClick={() => updateActiveDeck({ donts: [...(activeDeck.donts ?? []), ''] })}
                        >
                          <Plus size={14} />
                          Add Don't
                        </button>
                      </div>
                    </div>

                    {(activeDeck.donts ?? []).length > 0 ? (
                      <div className="prep-section-body">
                        {(activeDeck.donts ?? []).map((entry, index) => (
                          <div key={`dont-${index}`} className="prep-section-item">
                            <label className="prep-field">
                              <span className="prep-field-label">Don't</span>
                              <input
                                className="prep-input"
                                aria-label={`Don't ${index + 1}`}
                                value={entry}
                                onChange={(event) => updateActiveDeckListItem('donts', index, event.target.value)}
                                placeholder="What should the candidate avoid?"
                              />
                            </label>
                            <button
                              className="prep-icon-btn prep-icon-btn-danger"
                              type="button"
                              onClick={() =>
                                updateActiveDeck({
                                  donts: (activeDeck.donts ?? []).filter((_, itemIndex) => itemIndex !== index),
                                })
                              }
                              title="Remove don't"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="prep-section-empty">No don'ts yet.</div>
                    )}
                  </section>

                  <section className="prep-section">
                    <div className="prep-section-header">
                      <div className="prep-section-heading">
                        <span className="prep-section-title">Questions to Ask</span>
                        <span className="prep-section-subtitle">Prompts and why they matter so the ask-back feels intentional.</span>
                      </div>
                      <div className="prep-section-actions">
                        <span className="prep-section-count">{(activeDeck.questionsToAsk ?? []).length} entries</span>
                        <button
                          className="prep-link-btn"
                          type="button"
                          onClick={() =>
                            updateActiveDeck({
                              questionsToAsk: [...(activeDeck.questionsToAsk ?? []), { question: '', context: '' }],
                            })
                          }
                        >
                          <Plus size={14} />
                          Add Question
                        </button>
                      </div>
                    </div>

                    {(activeDeck.questionsToAsk ?? []).length > 0 ? (
                      <div className="prep-section-body">
                        {(activeDeck.questionsToAsk ?? []).map((entry, index) => (
                          <div key={`question-${index}`} className="prep-section-item">
                            <div className="prep-inline-grid">
                              <label className="prep-field">
                                <span className="prep-field-label">Question</span>
                                <input
                                  className="prep-input"
                                  aria-label={`Question to ask ${index + 1}`}
                                  value={entry.question}
                                  onChange={(event) => updateQuestionToAsk(index, { question: event.target.value })}
                                  placeholder="What do you want to ask?"
                                />
                              </label>
                              <label className="prep-field">
                                <span className="prep-field-label">Context</span>
                                <input
                                  className="prep-input"
                                  aria-label={`Question context ${index + 1}`}
                                  value={entry.context}
                                  onChange={(event) => updateQuestionToAsk(index, { context: event.target.value })}
                                  placeholder="Why does this question matter?"
                                />
                              </label>
                            </div>
                            <button
                              className="prep-icon-btn prep-icon-btn-danger"
                              type="button"
                              onClick={() =>
                                updateActiveDeck({
                                  questionsToAsk: (activeDeck.questionsToAsk ?? []).filter((_, itemIndex) => itemIndex !== index),
                                })
                              }
                              title="Remove question"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="prep-section-empty">No questions to ask yet.</div>
                    )}
                  </section>

                  <details
                    className="prep-edit-group prep-edit-group-collapsible"
                    open={editGroupOpen.categoryGuidance}
                    onToggle={(event) => {
                      const nextOpen = event.currentTarget.open
                      setEditGroupOpen((current) => ({
                        ...current,
                        categoryGuidance: nextOpen,
                      }))
                    }}
                  >
                    <summary className="prep-edit-group-summary">
                      <div className="prep-edit-group-copy">
                        <span className="prep-edit-group-title">Category Guidance</span>
                        <span className="prep-edit-group-subtitle">Optional coaching notes for the live section headers.</span>
                      </div>
                      <span className="prep-mode-chip">{activeDeckCategories.length} categories</span>
                    </summary>

                    <div className="prep-edit-group-body">
                      {activeDeckCategories.length > 0 ? (
                        <div className="prep-generator-grid">
                          {activeDeckCategories.map((prepCategory) => (
                            <label key={prepCategory} className="prep-field prep-field-span-2">
                              <span className="prep-field-label">{formatPrepCategoryLabel(prepCategory)} guidance</span>
                              <textarea
                                className="prep-textarea"
                                value={activeDeck.categoryGuidance?.[prepCategory] ?? ''}
                                onChange={(event) => updateCategoryGuidance(prepCategory, event.target.value)}
                                placeholder={`Optional guidance for the ${formatPrepCategoryLabel(prepCategory).toLowerCase()} section.`}
                              />
                            </label>
                          ))}
                        </div>
                      ) : (
                        <div className="prep-section-empty">Add cards to unlock category-specific guidance.</div>
                      )}
                    </div>
                  </details>
                </div>
              </details>

              <details
                className="prep-edit-group prep-edit-group-collapsible"
                open={editGroupOpen.sourceMaterial}
                onToggle={(event) => {
                  const nextOpen = event.currentTarget.open
                  setEditGroupOpen((current) => ({
                    ...current,
                    sourceMaterial: nextOpen,
                  }))
                }}
              >
                <summary className="prep-edit-group-summary">
                  <div className="prep-edit-group-copy">
                    <span className="prep-edit-group-title">Source Material</span>
                    <span className="prep-edit-group-subtitle">Collapse the long-form research and job description when you want a cleaner editing view.</span>
                  </div>
                  <span className="prep-mode-chip">Reference</span>
                </summary>

                <div className="prep-edit-group-body">
                  <div className="prep-generator-grid">
                    <label className="prep-field prep-field-span-2">
                      <span className="prep-field-label">Company research summary</span>
                      <textarea
                        className="prep-textarea"
                        value={activeDeck.companyResearch ?? ''}
                        onChange={(event) => updateActiveDeck({ companyResearch: event.target.value })}
                        placeholder="Editable summary of what matters about the company and role."
                      />
                    </label>
                    <label className="prep-field prep-field-span-2">
                      <span className="prep-field-label">Job description</span>
                      <textarea
                        className="prep-textarea prep-textarea-lg"
                        value={activeDeck.jobDescription ?? ''}
                        onChange={(event) => updateActiveDeck({ jobDescription: event.target.value })}
                      />
                    </label>
                  </div>
                </div>
              </details>
            </div>
          </section>

          <section className="prep-panel prep-edit-filter-panel">
            <div className="prep-edit-card-stage-header">
              <div>
                <h2>Card Library</h2>
                <p>Filter down to the cards you want to work on, then open the grouped editor inside each card.</p>
              </div>
              <span className="prep-mode-chip">
                {filteredCards.length === activeDeck.cards.length
                  ? `${filteredCards.length} cards`
                  : `${filteredCards.length} of ${activeDeck.cards.length} cards`}
              </span>
            </div>

            <PrepSearch
              query={query}
              category={category}
              vectorFilter={vectorFilter}
              cards={activeDeck.cards}
              onQueryChange={setQuery}
              onCategoryChange={setCategory}
              onClearVector={() => setVectorFilter('')}
            />
          </section>

          <section className="prep-edit-card-stage">
            <div className="prep-edit-card-stage-header">
              <div>
                <h2>Editable Cards</h2>
                <p>Lead with the tight story first, then expand supporting material only when you need it.</p>
              </div>
            </div>

            {filteredCards.length > 0 ? (
              <PrepCardGrid
                cards={filteredCards}
                onUpdateCard={handleUpdateCard}
                onDuplicateCard={handleDuplicateCard}
                onRemoveCard={handleRemoveCard}
                layout="single"
              />
            ) : (
              <div className="prep-empty prep-edit-empty-state">
                <h2>No cards match your filters</h2>
                <p>Adjust the filters above or add a new card to keep building out this prep set.</p>
              </div>
            )}
          </section>
        </div>
      ) : activeMode === 'edit' ? (
        <div
          id="prep-mode-panel-edit"
          role="tabpanel"
          aria-labelledby="prep-mode-tab-edit"
          className="prep-mode-panel"
        >
          <div className="prep-empty">
            <h2>No prep sets yet</h2>
            <p>Generate a prep set from a pipeline entry or start a blank one. Once created, every card is fully editable.</p>
            <div className="prep-empty-actions">
              <button className="prep-btn prep-btn-primary" onClick={() => void handleGenerate()} disabled={isGenerating}>
                <Sparkles size={16} />
                Generate Prep Set
              </button>
              <button className="prep-btn" onClick={handleCreateBlankDeck}>
                <Plus size={16} />
                Blank Set
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
