import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Clock3, Pause, Play, RotateCcw, Search } from 'lucide-react'
import { derivePrepCheatsheetSections } from '../../utils/prepCheatsheet'
import type { PrepCheatsheetSection } from '../../utils/prepCheatsheet'
import type { PrepDeck } from '../../types/prep'

interface PrepLiveModeProps {
  deck: PrepDeck
}

const SECTION_META: Record<string, { budget?: number; shortcut: string; scanLabel: string; tone: string }> = {
  overview: { budget: 2, shortcut: '1', scanLabel: 'Slate', tone: 'overview' },
  intel: { budget: 4, shortcut: '2', scanLabel: 'Blue', tone: 'intel' },
  opener: { budget: 3, shortcut: '3', scanLabel: 'Green', tone: 'opener' },
  behavioral: { budget: 10, shortcut: '4', scanLabel: 'Violet', tone: 'behavioral' },
  technical: { budget: 15, shortcut: '5', scanLabel: 'Cyan', tone: 'technical' },
  project: { budget: 8, shortcut: '6', scanLabel: 'Amber', tone: 'project' },
  metrics: { budget: 4, shortcut: '7', scanLabel: 'Gold', tone: 'metrics' },
  situational: { budget: 6, shortcut: '8', scanLabel: 'Orange', tone: 'situational' },
  warnings: { budget: 2, shortcut: '9', scanLabel: 'Rose', tone: 'warnings' },
}

const LIVE_SHORTCUT_BAR = [
  { keys: 'Space', label: 'Timer' },
  { keys: '/', label: 'Search' },
  { keys: 'Esc', label: 'Clear' },
  { keys: 'J / K', label: 'Move' },
  { keys: 'H / L', label: 'Ends' },
  { keys: 'E', label: 'Collapse' },
]

const LIVE_SHORTCUT_KEYS = {
  focusSearch: ['/'],
  clearSearch: ['Escape'],
  restartTimer: [' ', 'Spacebar'],
  nextSection: ['j', 'J', 'ArrowDown'],
  previousSection: ['k', 'K', 'ArrowUp'],
  toggleSection: ['e', 'E'],
  firstSection: ['h', 'H', 'Home'],
  lastSection: ['l', 'L', 'End'],
} as const

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function filterSections(sections: PrepCheatsheetSection[], query: string): PrepCheatsheetSection[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return sections

  return sections
    .map((section) => {
      const matchesSection =
        section.title.toLowerCase().includes(normalized) ||
        section.description.toLowerCase().includes(normalized)
      const items = matchesSection
        ? section.items
        : section.items.filter((item) => {
            const haystack = [item.title, item.detail ?? '', item.category ?? '']
              .join(' ')
              .toLowerCase()
            return haystack.includes(normalized)
          })
      if (matchesSection || items.length > 0) {
        return {
          ...section,
          items,
        }
      }
      return null
    })
    .filter((section): section is PrepCheatsheetSection => section !== null)
}

function isTypingTarget(target: EventTarget | null): boolean {
  const element = target instanceof HTMLElement ? target : null
  if (!element) return false
  return element.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]') !== null
}

function matchesShortcut(keys: readonly string[], key: string): boolean {
  return keys.includes(key)
}

type LiveTimerState = 'calm' | 'warning' | 'urgent' | 'critical'

function getLiveTimerState(totalSeconds: number): LiveTimerState {
  if (totalSeconds >= 90) return 'critical'
  if (totalSeconds >= 60) return 'urgent'
  if (totalSeconds >= 30) return 'warning'
  return 'calm'
}

export function PrepLiveMode({ deck }: PrepLiveModeProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null)
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({})
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [isTimerRunning, setIsTimerRunning] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})
  const timerStartedAtRef = useRef<number | null>(null)
  const timerElapsedBeforeRunRef = useRef(0)
  const elapsedSecondsRef = useRef(0)
  const isTimerRunningRef = useRef(false)

  const sections = useMemo(() => derivePrepCheatsheetSections(deck), [deck])
  const filteredSections = useMemo(() => filterSections(sections, searchQuery), [sections, searchQuery])
  const visibleSectionLegend = useMemo(
    () =>
      filteredSections.map((section, index) => ({
        ...section,
        shortcut: SECTION_META[section.id]?.shortcut ?? String(index + 1),
        budget: SECTION_META[section.id]?.budget,
        tone: SECTION_META[section.id]?.tone ?? 'overview',
        scanLabel: SECTION_META[section.id]?.scanLabel ?? 'Neutral',
      })),
    [filteredSections],
  )
  const shortcutToSectionId = useMemo(
    () => new Map(visibleSectionLegend.map((section) => [section.shortcut, section.id])),
    [visibleSectionLegend],
  )
  const timerState = useMemo(() => getLiveTimerState(elapsedSeconds), [elapsedSeconds])
  const effectiveActiveSectionId =
    filteredSections.find((section) => section.id === activeSectionId)?.id ?? filteredSections[0]?.id ?? null
  const deckMeta = [deck.company, deck.role].filter(Boolean).join(' · ') || 'Interview prep set'

  const scrollToSection = useCallback((sectionId: string) => {
    const section = sectionRefs.current[sectionId]
    if (section && typeof section.scrollIntoView === 'function') {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  const toggleSection = useCallback((sectionId: string) => {
    setCollapsedSections((current) => ({
      ...current,
      [sectionId]: !current[sectionId],
    }))
  }, [])

  const resetTimer = useCallback(() => {
    timerStartedAtRef.current = null
    timerElapsedBeforeRunRef.current = 0
    elapsedSecondsRef.current = 0
    isTimerRunningRef.current = false
    setIsTimerRunning(false)
    setElapsedSeconds(0)
  }, [])

  const restartTimer = useCallback(() => {
    timerStartedAtRef.current = Date.now()
    timerElapsedBeforeRunRef.current = 0
    elapsedSecondsRef.current = 0
    isTimerRunningRef.current = true
    setElapsedSeconds(0)
    setIsTimerRunning(true)
  }, [])

  const toggleTimer = useCallback(() => {
    if (isTimerRunningRef.current) {
      const nextElapsed =
        timerStartedAtRef.current === null
          ? elapsedSecondsRef.current
          : Math.floor((Date.now() - timerStartedAtRef.current) / 1000)
      timerStartedAtRef.current = null
      timerElapsedBeforeRunRef.current = nextElapsed
      elapsedSecondsRef.current = nextElapsed
      isTimerRunningRef.current = false
      setElapsedSeconds(nextElapsed)
      setIsTimerRunning(false)
      return
    }

    timerStartedAtRef.current = Date.now() - timerElapsedBeforeRunRef.current * 1000
    setElapsedSeconds(timerElapsedBeforeRunRef.current)
    elapsedSecondsRef.current = timerElapsedBeforeRunRef.current
    isTimerRunningRef.current = true
    setIsTimerRunning(true)
  }, [])

  useEffect(() => {
    elapsedSecondsRef.current = elapsedSeconds
  }, [elapsedSeconds])

  useEffect(() => {
    isTimerRunningRef.current = isTimerRunning
  }, [isTimerRunning])

  useEffect(() => {
    if (!isTimerRunning) return

    const syncElapsedSeconds = () => {
      if (timerStartedAtRef.current === null) return
      setElapsedSeconds(Math.floor((Date.now() - timerStartedAtRef.current) / 1000))
    }

    syncElapsedSeconds()
    const timerId = window.setInterval(syncElapsedSeconds, 1000)
    return () => window.clearInterval(timerId)
  }, [isTimerRunning])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const editingTarget = isTypingTarget(target)

      if (matchesShortcut(LIVE_SHORTCUT_KEYS.focusSearch, event.key) && !editingTarget) {
        event.preventDefault()
        searchInputRef.current?.focus()
        return
      }

      if (matchesShortcut(LIVE_SHORTCUT_KEYS.clearSearch, event.key)) {
        if (searchQuery) {
          event.preventDefault()
          setSearchQuery('')
        }
        if (target === searchInputRef.current) {
          searchInputRef.current?.blur()
        }
        return
      }

      if (editingTarget) return

      if (matchesShortcut(LIVE_SHORTCUT_KEYS.restartTimer, event.key) || event.code === 'Space') {
        event.preventDefault()
        restartTimer()
        return
      }

      if (matchesShortcut(LIVE_SHORTCUT_KEYS.toggleSection, event.key) && effectiveActiveSectionId) {
        event.preventDefault()
        toggleSection(effectiveActiveSectionId)
        return
      }

      if (matchesShortcut(LIVE_SHORTCUT_KEYS.firstSection, event.key) && filteredSections.length > 0) {
        event.preventDefault()
        const firstSection = filteredSections[0]
        setActiveSectionId(firstSection.id)
        scrollToSection(firstSection.id)
        return
      }

      if (matchesShortcut(LIVE_SHORTCUT_KEYS.lastSection, event.key) && filteredSections.length > 0) {
        event.preventDefault()
        const lastSection = filteredSections[filteredSections.length - 1]
        setActiveSectionId(lastSection.id)
        scrollToSection(lastSection.id)
        return
      }

      if (/^[1-9]$/.test(event.key)) {
        const targetSectionId = shortcutToSectionId.get(event.key)
        if (targetSectionId) {
          event.preventDefault()
          setActiveSectionId(targetSectionId)
          scrollToSection(targetSectionId)
        }
        return
      }

      if (matchesShortcut(LIVE_SHORTCUT_KEYS.nextSection, event.key) && effectiveActiveSectionId) {
        event.preventDefault()
        const currentIndex = filteredSections.findIndex((section) => section.id === effectiveActiveSectionId)
        const nextSection = filteredSections[Math.min(filteredSections.length - 1, currentIndex + 1)]
        if (nextSection) {
          setActiveSectionId(nextSection.id)
          scrollToSection(nextSection.id)
        }
        return
      }

      if (matchesShortcut(LIVE_SHORTCUT_KEYS.previousSection, event.key) && effectiveActiveSectionId) {
        event.preventDefault()
        const currentIndex = filteredSections.findIndex((section) => section.id === effectiveActiveSectionId)
        const nextSection = filteredSections[Math.max(0, currentIndex - 1)]
        if (nextSection) {
          setActiveSectionId(nextSection.id)
          scrollToSection(nextSection.id)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    effectiveActiveSectionId,
    filteredSections,
    restartTimer,
    scrollToSection,
    searchQuery,
    shortcutToSectionId,
    toggleSection,
  ])

  return (
    <div className="prep-live-mode" role="region" aria-label="Live cheatsheet mode">
      <aside className="prep-live-sidebar">
        <div className="prep-live-sidebar-card prep-live-sidebar-card-header">
          <div className="prep-live-sidebar-title">Live viewer</div>
          <h2 className="prep-live-deck-heading">{deck.title}</h2>
          <p className="prep-live-deck-subtitle">{deckMeta}</p>
          <div className="prep-live-deck-meta">
            <span className="prep-live-deck-meta-chip">{visibleSectionLegend.length} sections</span>
            <span className="prep-live-deck-meta-chip">{deck.cards.length} cards</span>
          </div>
        </div>

        <div className={`prep-live-sidebar-card prep-live-timer-card prep-live-timer-card-${timerState}`}>
          <LiveTimerCard
            elapsedSeconds={elapsedSeconds}
            isTimerRunning={isTimerRunning}
            onReset={resetTimer}
            onToggle={toggleTimer}
            timerState={timerState}
          />
        </div>

        <div className="prep-live-sidebar-card">
          <label className="prep-field">
            <span className="prep-field-label">Search cheatsheet</span>
            <div className="prep-live-search">
              <Search size={16} />
              <input
                type="search"
                ref={searchInputRef}
                className="prep-input"
                aria-keyshortcuts="/"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Filter sections, prompts, and notes"
              />
            </div>
          </label>
        </div>

        <nav className="prep-live-sidebar-card prep-live-nav" aria-label="Live cheatsheet sections">
          <div className="prep-live-nav-heading">
            <span className="prep-live-sidebar-title">Sections</span>
            <span className="prep-live-nav-summary">{filteredSections.length} visible</span>
          </div>

          {visibleSectionLegend.map((section) => {
            const budget = section.budget
            return (
              <button
                key={section.id}
                type="button"
                className={`prep-live-nav-link prep-live-nav-link-${section.tone} ${effectiveActiveSectionId === section.id ? 'prep-live-nav-link-active' : ''}`}
                onClick={() => {
                  setActiveSectionId(section.id)
                  scrollToSection(section.id)
                }}
                aria-keyshortcuts={section.shortcut}
                aria-current={effectiveActiveSectionId === section.id ? 'true' : undefined}
              >
                <span className="prep-live-nav-copy">
                  <span className="prep-live-nav-title">
                    <span className={`prep-live-tone-dot prep-live-tone-${section.tone}`} aria-hidden="true" />
                    {section.title}
                  </span>
                  <span className="prep-live-nav-meta">{section.items.length} items</span>
                </span>
                <span className="prep-live-nav-meta-cluster">
                  <span className="prep-live-shortcut-badge">{section.shortcut}</span>
                  {budget ? <span className="prep-live-nav-budget">{budget}m</span> : null}
                </span>
              </button>
            )
          })}
        </nav>
      </aside>

      <div className="prep-live-main">
        {filteredSections.length === 0 ? (
          <div className="prep-empty">
            <h2>No cheatsheet sections match that search</h2>
            <p>Clear the search to get the full interview view back.</p>
          </div>
        ) : (
          visibleSectionLegend.map((section) => {
            const budget = section.budget
            const isCollapsed = collapsedSections[section.id] === true
            return (
              <section
                key={section.id}
                ref={(element) => {
                  sectionRefs.current[section.id] = element
                }}
                className={`prep-live-section prep-live-section-${section.tone} ${effectiveActiveSectionId === section.id ? 'prep-live-section-active' : ''}`}
              >
                <div className="prep-live-section-header">
                  <div>
                    <div className="prep-live-section-badges">
                      <span className={`prep-live-scan-badge prep-live-scan-badge-${section.tone}`}>
                        {section.shortcut} • {section.scanLabel}
                      </span>
                      {budget ? <span className="prep-live-budget-badge">Recommended {budget}m</span> : null}
                      <span className="prep-live-count-badge">{section.items.length} items</span>
                    </div>
                    <h2>{section.title}</h2>
                    <p>{section.description}</p>
                  </div>
                  <button
                    className="prep-btn"
                    aria-expanded={!isCollapsed}
                    aria-controls={`prep-live-section-content-${section.id}`}
                    onClick={() => toggleSection(section.id)}
                  >
                    {isCollapsed ? 'Expand' : 'Collapse'}
                  </button>
                </div>

                <div
                  id={`prep-live-section-content-${section.id}`}
                  className="prep-live-item-list"
                  hidden={isCollapsed}
                >
                  {section.items.map((item) => (
                    <article key={item.id} className={`prep-live-item prep-live-item-${section.tone}`}>
                      <div className="prep-live-item-header">
                        <h3>{item.title}</h3>
                        {item.category ? (
                          <span className={`prep-category prep-category-${item.category}`}>
                            {item.category}
                          </span>
                        ) : null}
                      </div>
                      {item.detail ? <p>{item.detail}</p> : null}
                    </article>
                  ))}
                </div>
              </section>
            )
          })
        )}
      </div>

      <div className="prep-live-kbd-bar" aria-label="Live cheatsheet shortcuts">
        {LIVE_SHORTCUT_BAR.map((shortcut) => (
          <span key={shortcut.keys} className="prep-live-kbd-item">
            <span className="prep-live-legend-keys">{shortcut.keys}</span>
            <span className="prep-live-kbd-label">{shortcut.label}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

interface LiveTimerCardProps {
  elapsedSeconds: number
  isTimerRunning: boolean
  onReset: () => void
  onToggle: () => void
  timerState: LiveTimerState
}

function LiveTimerCard({ elapsedSeconds, isTimerRunning, onReset, onToggle, timerState }: LiveTimerCardProps) {
  return (
    <>
      <div className={`prep-live-timer-label prep-live-timer-label-${timerState}`}>Interview timer</div>
      <div className={`prep-live-timer-display prep-live-timer-display-${timerState}`} role="timer">
        <Clock3 size={16} />
        <span>{formatDuration(elapsedSeconds)}</span>
      </div>
      <div className="prep-live-timer-actions">
        <button className="prep-btn prep-btn-primary" onClick={onToggle}>
          {isTimerRunning ? <Pause size={16} /> : <Play size={16} />}
          {isTimerRunning ? 'Pause' : 'Start'}
        </button>
        <button className="prep-btn" onClick={onReset}>
          <RotateCcw size={16} />
          Reset
        </button>
      </div>
    </>
  )
}
