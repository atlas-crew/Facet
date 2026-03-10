import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearch } from '@tanstack/react-router'
import { BookOpen, Download, Plus, Sparkles, Trash2, Upload } from 'lucide-react'
import { assembleResume } from '../../engine/assembler'
import { PrepCardGrid } from './PrepCardGrid'
import { PrepPracticeMode } from './PrepPracticeMode'
import { PrepSearch } from './PrepSearch'
import { usePrepStore } from '../../store/prepStore'
import { usePipelineStore } from '../../store/pipelineStore'
import { useResumeStore } from '../../store/resumeStore'
import { parsePrepImport } from '../../utils/prepImport'
import { generateInterviewPrep } from '../../utils/prepGenerator'
import { sanitizeEndpointUrl } from '../../utils/idUtils'
import type { PrepCard, PrepCategory, PrepDeck } from '../../types/prep'
import './prep.css'

export function PrepPage() {
  const search = useSearch({ strict: false }) as { vector?: string; skills?: string; q?: string }
  const importRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState(search.q ?? '')
  const [category, setCategory] = useState<PrepCategory | 'all'>('all')
  const [vectorFilter, setVectorFilter] = useState(search.vector ?? '')
  const [selectedEntryId, setSelectedEntryId] = useState<string>('')
  const [selectedVectorId, setSelectedVectorId] = useState(search.vector ?? '')
  const [companyResearchDraft, setCompanyResearchDraft] = useState('')
  const [isPracticeMode, setIsPracticeMode] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationError, setGenerationError] = useState<string | null>(null)

  const { decks, activeDeckId, setActiveDeck, createDeck, updateDeck, addCard, updateCard, duplicateCard, removeCard, deleteDeck, importDecks, exportDecks } =
    usePrepStore()
  const pipelineEntries = usePipelineStore((state) => state.entries)
  const resumeData = useResumeStore((state) => state.data)
  const activeDeck = useMemo(
    () => decks.find((deck) => deck.id === activeDeckId) ?? null,
    [decks, activeDeckId],
  )

  useEffect(() => {
    if (!activeDeckId && decks.length > 0) {
      setActiveDeck(decks[0].id)
    }
  }, [activeDeckId, decks, setActiveDeck])

  const aiEndpoint = useMemo(
    () => sanitizeEndpointUrl((import.meta.env.VITE_ANTHROPIC_PROXY_URL as string | undefined) ?? ''),
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
    const vectorId = selectedVectorId || activeDeck?.vectorId || ''
    const title =
      selectedEntry != null
        ? `${selectedEntry.company} ${selectedEntry.role} Interview Prep`
        : 'Interview Prep'
    createDeck({
      title,
      company: selectedEntry?.company ?? activeDeck?.company ?? '',
      role: selectedEntry?.role ?? activeDeck?.role ?? '',
      vectorId,
      pipelineEntryId: selectedEntry?.id ?? null,
      companyUrl: selectedEntry?.url || undefined,
      skillMatch: selectedEntry?.skillMatch || undefined,
      positioning: selectedEntry?.positioning || undefined,
      notes: selectedEntry?.notes || undefined,
      companyResearch: companyResearchDraft || undefined,
      jobDescription: selectedEntry?.jobDescription || undefined,
      cards: [],
    })
  }, [activeDeck?.company, activeDeck?.role, activeDeck?.vectorId, companyResearchDraft, createDeck, selectedEntry, selectedVectorId])

  const handleGenerate = useCallback(async () => {
    if (!aiEndpoint) {
      setGenerationError('AI generation is disabled. Configure VITE_ANTHROPIC_PROXY_URL.')
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

    const vector = resumeData.vectors.find((item) => item.id === selectedVectorId)
    if (!vector) {
      setGenerationError('The selected vector could not be found in resume data.')
      return
    }

    setGenerationError(null)
    setIsGenerating(true)

    try {
      const freshResumeData = useResumeStore.getState().data
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
        companyUrl: selectedEntry.url || undefined,
        skillMatch: selectedEntry.skillMatch || undefined,
        positioning: selectedEntry.positioning || undefined,
        notes: selectedEntry.notes || undefined,
        companyResearch: companyResearchDraft || undefined,
        jobDescription: selectedEntry.jobDescription,
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
  }, [aiEndpoint, companyResearchDraft, createDeck, selectedEntry, selectedVectorId])

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

  const updateActiveDeck = useCallback(
    (patch: Partial<Omit<PrepDeck, 'id' | 'cards'>>) => {
      if (!activeDeck) return
      updateDeck(activeDeck.id, patch)
    },
    [activeDeck, updateDeck],
  )

  if (isPracticeMode && activeDeck) {
    return <PrepPracticeMode cards={filteredCards} onExit={() => setIsPracticeMode(false)} />
  }

  return (
    <div className="prep-page">
      <div className="prep-header">
        <div>
          <h1>Interview Prep</h1>
          <p className="prep-header-copy">
            Generate editable prep sets from a pipeline entry, the matching resume vector, the job description, and your company research notes.
          </p>
        </div>

        <div className="prep-header-actions">
          <button
            className="prep-btn prep-btn-primary"
            onClick={() => setIsPracticeMode(true)}
            disabled={!activeDeck || filteredCards.length === 0}
          >
            <BookOpen size={16} />
            Practice Mode
          </button>
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

      <section className="prep-panel">
        <div className="prep-panel-header">
          <div>
            <h2>Generate Prep</h2>
            <p>Pick the opportunity, confirm the vector, add company research notes, then let the model draft a full prep set you can edit.</p>
          </div>
          <div className="prep-panel-actions">
            <button className="prep-btn" onClick={handleCreateBlankDeck}>
              <Plus size={16} />
              Blank Set
            </button>
            <button className="prep-btn prep-btn-primary" onClick={() => void handleGenerate()} disabled={isGenerating}>
              <Sparkles size={16} />
              {isGenerating ? 'Generating...' : 'Generate with AI'}
            </button>
          </div>
        </div>

        <div className="prep-generator-grid">
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

          <label className="prep-field prep-field-span-2">
            <span className="prep-field-label">Company research notes</span>
            <textarea
              className="prep-textarea prep-textarea-lg"
              value={companyResearchDraft}
              onChange={(event) => setCompanyResearchDraft(event.target.value)}
              placeholder="Paste company research, interviewer notes, earnings-call notes, product context, or any talking points you want the model to incorporate."
            />
          </label>

          {selectedEntry && (
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

      {activeDeck ? (
        <>
          <section className="prep-panel">
            <div className="prep-panel-header">
              <div>
                <h2>Active Prep Set</h2>
                <p>Edit the generated deck, keep adding cards, and tailor the narratives before practice mode.</p>
              </div>
              <label className="prep-field prep-field-inline">
                <span className="prep-field-label">Prep set</span>
                <select className="prep-input" value={activeDeck.id} onChange={(event) => setActiveDeck(event.target.value)}>
                  {decks.map((deck) => (
                    <option key={deck.id} value={deck.id}>
                      {deck.title}
                    </option>
                  ))}
                </select>
              </label>
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
          </section>

          <PrepSearch
            query={query}
            category={category}
            vectorFilter={vectorFilter}
            cards={activeDeck.cards}
            onQueryChange={setQuery}
            onCategoryChange={setCategory}
            onClearVector={() => setVectorFilter('')}
          />

          {filteredCards.length > 0 ? (
            <PrepCardGrid
              cards={filteredCards}
              onUpdateCard={handleUpdateCard}
              onDuplicateCard={handleDuplicateCard}
              onRemoveCard={handleRemoveCard}
            />
          ) : (
            <div className="prep-empty">
              <h2>No cards match your filters</h2>
              <p>Adjust the filters above or add a new card to keep building out this prep set.</p>
            </div>
          )}
        </>
      ) : (
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
      )}
    </div>
  )
}
