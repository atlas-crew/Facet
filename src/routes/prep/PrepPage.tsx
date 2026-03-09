import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useSearch } from '@tanstack/react-router'
import { Download, Upload, Play } from 'lucide-react'
import type { PrepCard, PrepCategory } from '../../types/prep'
import { PrepSearch } from './PrepSearch'
import { PrepCardGrid } from './PrepCardGrid'
import { PrepPracticeMode } from './PrepPracticeMode'
import { samplePrepData } from './samplePrepData'
import { parsePrepImport } from '../../utils/prepImport'
import './prep.css'

const STORAGE_KEY = 'facet-prep-data'

function loadCards(): PrepCard[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as PrepCard[]
    }
  } catch { /* ignore */ }
  return []
}

function saveCards(cards: PrepCard[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cards))
}

export function PrepPage() {
  const search = useSearch({ strict: false }) as { vector?: string; skills?: string; q?: string }
  const [cards, setCards] = useState<PrepCard[]>(loadCards)
  const [query, setQuery] = useState(search.q ?? '')
  const [category, setCategory] = useState<PrepCategory | 'all'>('all')
  const [vectorFilter, setVectorFilter] = useState(search.vector ?? '')
  const [isPracticeMode, setIsPracticeMode] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)

  // Parse skills from URL
  const skillTags = useMemo(() => {
    if (!search.skills) return [] as string[]
    return search.skills.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
  }, [search.skills])

  // Persist cards when they change
  useEffect(() => {
    if (cards.length > 0) saveCards(cards)
  }, [cards])

  const filteredCards = useMemo(() => {
    let result = [...cards]

    if (category !== 'all') {
      result = result.filter((c) => c.category === category)
    }

    if (vectorFilter) {
      const v = vectorFilter.toLowerCase()
      result = result.filter((c) =>
        c.tags.some((t) => t.toLowerCase().includes(v))
      )
    }

    if (skillTags.length > 0) {
      result = result.filter((c) =>
        skillTags.some((skill) =>
          c.tags.some((t) => t.toLowerCase().includes(skill))
        )
      )
    }

    if (query) {
      const q = query.toLowerCase()
      result = result.filter((c) =>
        c.title.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q)) ||
        (c.script && c.script.toLowerCase().includes(q)) ||
        (c.followUps && c.followUps.some((fu) =>
          fu.question.toLowerCase().includes(q) || fu.answer.toLowerCase().includes(q)
        ))
      )
    }

    return result
  }, [cards, category, vectorFilter, skillTags, query])

  const handleImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      void parsePrepImport(file).then((result) => {
        if (result.error) {
          window.alert(result.error)
          return
        }
        setCards(result.cards)
        if (result.skipped > 0) {
          window.alert(`Imported ${result.cards.length} cards. ${result.skipped} cards skipped (invalid format).`)
        }
      })
      e.target.value = ''
    },
    []
  )

  const handleExport = useCallback(() => {
    const blob = new Blob([JSON.stringify(cards, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `prep-cards-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [cards])

  const handleLoadSample = useCallback(() => {
    setCards(samplePrepData)
  }, [])

  // Empty state
  if (cards.length === 0) {
    return (
      <div className="prep-page">
        <div className="prep-header">
          <h1>Interview Prep</h1>
        </div>
        <div className="prep-empty">
          <h2>No prep cards yet</h2>
          <p>
            Import your interview prep cards as JSON, or load sample data to explore
            the interface. Cards are searchable by title, tags, and content.
          </p>
          <div className="prep-empty-actions">
            <button className="prep-btn prep-btn-primary" onClick={handleLoadSample}>
              Load Sample Data
            </button>
            <button className="prep-btn" onClick={() => importRef.current?.click()}>
              <Upload size={16} /> Import JSON
            </button>
            <input ref={importRef} type="file" accept=".json" className="import-file-input" onChange={handleImport} />
          </div>
        </div>
      </div>
    )
  }

  if (isPracticeMode) {
    return (
      <PrepPracticeMode 
        cards={filteredCards} 
        onExit={() => setIsPracticeMode(false)} 
      />
    )
  }

  return (
    <div className="prep-page">
      <div className="prep-header">
        <h1>Interview Prep</h1>
        <div className="prep-header-actions">
          <button 
            className="prep-btn prep-btn-primary" 
            onClick={() => setIsPracticeMode(true)}
            disabled={filteredCards.length === 0}
            title={filteredCards.length === 0 ? "No cards match your filters" : undefined}
          >
            <Play size={16} /> Practice Mode
          </button>
          <button className="prep-btn" onClick={() => importRef.current?.click()}>
            <Upload size={16} /> Import
          </button>
          <input ref={importRef} type="file" accept=".json" className="import-file-input" onChange={handleImport} />
          <button className="prep-btn" onClick={handleExport}>
            <Download size={16} /> Export
          </button>
        </div>
      </div>

      <PrepSearch
        query={query}
        category={category}
        vectorFilter={vectorFilter}
        cards={cards}
        onQueryChange={setQuery}
        onCategoryChange={setCategory}
        onClearVector={() => setVectorFilter('')}
      />

      {filteredCards.length > 0 ? (
        <PrepCardGrid cards={filteredCards} />
      ) : (
        <div className="prep-empty" style={{ padding: '40px' }}>
          <p>No cards match your filters.</p>
        </div>
      )}
    </div>
  )
}
