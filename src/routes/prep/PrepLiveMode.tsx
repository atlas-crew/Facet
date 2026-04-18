import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ChevronRight, Search } from 'lucide-react'
import { derivePrepCheatsheetSections, OPENER_PREFERRED_SHORTCUTS } from '../../utils/prepCheatsheet'
import {
  filterPrepConditionals,
  filterPrepDeepDives,
  filterPrepFollowUps,
  filterPrepKeyPoints,
  filterPrepMetrics,
  filterPrepStoryBlocks,
  hasPrepCardNeedsReviewContent,
  hasPrepMetricNeedsReview,
  hasPrepNeedsReviewText,
  resolvePrepConditionalTone,
} from '../../utils/prepCardContent'
import type { PrepCheatsheetGroup, PrepCheatsheetItem, PrepCheatsheetSection, PrepOpenerKind } from '../../utils/prepCheatsheet'
import type { PrepCard, PrepDeck } from '../../types/prep'

interface PrepLiveModeProps {
  deck: PrepDeck
  onBack?: () => void
}

type SectionPhase = 'pre' | 'live'

type LiveSection = PrepCheatsheetSection & {
  shortcut: string
  itemBudget?: number
  phase: SectionPhase
  tone: string
}

type SectionGroupView = {
  group: PrepCheatsheetGroup
  sections: LiveSection[]
}

/** Per-item recommended time in minutes. */
const SECTION_META: Record<string, { itemBudget?: number; shortcut?: string; tone: string; phase: SectionPhase }> = {
  overview: { shortcut: '1', tone: 'overview', phase: 'pre' },
  intel: { shortcut: '2', tone: 'intel', phase: 'pre' },
  questions: { shortcut: 'Q', tone: 'overview', phase: 'pre' },
  donts: { shortcut: 'D', tone: 'warnings', phase: 'pre' },
  metrics: { shortcut: 'M', tone: 'metrics', phase: 'pre' },
  warnings: { shortcut: 'W', tone: 'warnings', phase: 'pre' },
  opener: { itemBudget: 2, tone: 'opener', phase: 'live' },
  behavioral: { itemBudget: 3, shortcut: '6', tone: 'behavioral', phase: 'live' },
  project: { itemBudget: 3, shortcut: '7', tone: 'project', phase: 'live' },
  technical: { itemBudget: 3, shortcut: '8', tone: 'technical', phase: 'live' },
  situational: { itemBudget: 2, shortcut: '9', tone: 'situational', phase: 'live' },
}

const QUESTIONS_GUIDANCE = 'Pick 2-3. Save 8-10 minutes for questions.'

const LIVE_SHORTCUT_KEYS = {
  focusSearch: ['/'],
  clearSearch: ['Escape'],
  toggleTimer: [' ', 'Spacebar'],
  resetTimer: ['r', 'R'],
  nextSection: ['j', 'J', 'ArrowDown'],
  previousSection: ['k', 'K', 'ArrowUp'],
  toggleSection: ['e', 'E'],
  firstSection: ['h', 'H', 'Home'],
  lastSection: ['l', 'L', 'End'],
} as const

const SECTION_GROUP_ORDER: PrepCheatsheetGroup[] = ['Intel', 'Openers', 'Core', 'Technical', 'Tactical']
const BASE_SHORTCUT_BAR = [
  { keys: 'Space', label: 'Start / Pause' },
  { keys: 'R', label: 'Reset' },
  { keys: '/', label: 'Search' },
  { keys: 'Esc', label: 'Clear' },
  { keys: 'J / K', label: 'Move' },
  { keys: 'H / L', label: 'Ends' },
  { keys: 'E', label: 'Collapse' },
  { keys: 'Q / D / M / W', label: 'Pre jumps' },
] as const

type ShortcutLegendItem = {
  keys: string
  label: string
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function normalizeShortcutKey(key: string): string {
  return key.length === 1 ? key.toLowerCase() : key
}

const RESERVED_STATIC_SHORTCUTS = new Set(
  Object.values(SECTION_META)
    .flatMap((meta) => (meta.shortcut ? [normalizeShortcutKey(meta.shortcut)] : [])),
)
const RESERVED_COMMAND_SHORTCUTS = new Set(
  Object.values(LIVE_SHORTCUT_KEYS)
    .flatMap((keys) => keys.map(normalizeShortcutKey))
    .filter((key) => key.length === 1),
)
const RESERVED_OPENER_SHORTCUTS = new Set(Object.values(OPENER_PREFERRED_SHORTCUTS).map(normalizeShortcutKey))
const OPENER_SHORTCUT_CANDIDATES = [...'123456789', ...'abcdefghijklmnopqrstuvwxyz'] as const
// Keep opener shortcuts on single-character keys that do not overlap with fixed section jumps or command shortcuts.
const OPENER_SHORTCUT_POOL = OPENER_SHORTCUT_CANDIDATES.filter((shortcut) => {
  const normalizedShortcut = normalizeShortcutKey(shortcut)
  return (
    !RESERVED_STATIC_SHORTCUTS.has(normalizedShortcut) &&
    !RESERVED_COMMAND_SHORTCUTS.has(normalizedShortcut) &&
    !RESERVED_OPENER_SHORTCUTS.has(normalizedShortcut)
  )
})

function groupSectionsByGroup(sections: LiveSection[]): SectionGroupView[] {
  const grouped = new Map<PrepCheatsheetGroup, LiveSection[]>()
  const orderedGroups: PrepCheatsheetGroup[] = []

  for (const section of sections) {
    if (!grouped.has(section.group)) {
      orderedGroups.push(section.group)
    }
    const nextSections = grouped.get(section.group) ?? []
    nextSections.push(section)
    grouped.set(section.group, nextSections)
  }

  const orderedKnownGroups = SECTION_GROUP_ORDER.flatMap((group) => {
    const groupSections = grouped.get(group)
    return groupSections ? [{ group, sections: groupSections }] : []
  })

  const unknownGroups = orderedGroups
    .filter((group) => !SECTION_GROUP_ORDER.includes(group))
    .flatMap((group) => {
      const groupSections = grouped.get(group)
      return groupSections ? [{ group, sections: groupSections }] : []
    })

  return [...orderedKnownGroups, ...unknownGroups]
}

function getRenderableTableData(tableData: PrepCard['tableData']) {
  if (!tableData || !Array.isArray(tableData.headers) || !Array.isArray(tableData.rows)) return null

  const headers = tableData.headers.filter((header): header is string => typeof header === 'string')
  const rows = tableData.rows
    .filter((row) => Array.isArray(row))
    .map((row) => row.map((cell) => (typeof cell === 'string' ? cell : typeof cell === 'number' ? String(cell) : '')))
    .filter((row) => row.length > 0)

  if (headers.length === 0) return null

  return {
    headers,
    rows,
  }
}

function buildCardSearchText(card: PrepCard): string {
  const keyPoints = filterPrepKeyPoints(card.keyPoints)
  const storyBlocks = filterPrepStoryBlocks(card.storyBlocks)
  const metrics = filterPrepMetrics(card.metrics)
  const followUps = filterPrepFollowUps(card.followUps)
  const deepDives = filterPrepDeepDives(card.deepDives)
  const conditionals = filterPrepConditionals(card.conditionals)
  const tableData = getRenderableTableData(card.tableData)

  return [
    card.title,
    card.script ?? '',
    card.scriptLabel ?? '',
    card.warning ?? '',
    card.notes ?? '',
    ...keyPoints,
    ...storyBlocks.flatMap((block) => [block.label, block.text]),
    ...metrics.flatMap((metric) => [metric.value, metric.label]),
    ...followUps.flatMap((followUp) => [followUp.question, followUp.answer, followUp.context ?? '']),
    ...deepDives.flatMap((deepDive) => [deepDive.title, deepDive.content]),
    ...conditionals.flatMap((conditional) => [conditional.trigger, conditional.response]),
    ...(tableData?.headers ?? []),
    ...(tableData?.rows ?? []).flat(),
  ]
    .join(' ')
    .toLowerCase()
}

function buildItemSearchText(item: PrepCheatsheetItem, cardsById: Map<string, PrepCard>): string {
  const parts = [
    item.title,
    item.detail ?? '',
    item.category ?? '',
    ...(item.metrics?.flatMap((metric) => [metric.value, metric.label]) ?? []),
  ]

  if (item.cardId) {
    const card = cardsById.get(item.cardId)
    if (card) {
      parts.push(buildCardSearchText(card))
    }
  }

  return parts.join(' ').toLowerCase()
}

function filterSections(
  sections: PrepCheatsheetSection[],
  query: string,
  cardsById: Map<string, PrepCard>,
): PrepCheatsheetSection[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return sections

  return sections
    .map((section) => {
      const matchesSection =
        section.title.toLowerCase().includes(normalized) ||
        section.description.toLowerCase().includes(normalized) ||
        section.guidance?.toLowerCase().includes(normalized)
      const items = matchesSection
        ? section.items
        : section.items.filter((item) => {
            return buildItemSearchText(item, cardsById).includes(normalized)
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

function isInteractiveShortcutTarget(target: EventTarget | null): boolean {
  const element = target instanceof HTMLElement ? target : null
  if (!element) return false
  return element.closest('button, a[href], summary, [role="button"], [role="link"], [role="switch"], [role="checkbox"], [role="tab"], [role="menuitem"]') !== null
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

function getSectionMetaKey(section: PrepCheatsheetSection): string {
  return section.sectionCategory ?? section.id
}

function getSectionShortcutCandidate(section: PrepCheatsheetSection): string {
  const meta = SECTION_META[getSectionMetaKey(section)]
  return meta?.shortcut ?? ''
}

function collectReservedSectionShortcuts(sections: PrepCheatsheetSection[]): Set<string> {
  const reserved = new Set<string>(RESERVED_STATIC_SHORTCUTS)

  sections.forEach((section) => {
    if (getSectionMetaKey(section) === 'opener') return
    const shortcut = getSectionShortcutCandidate(section)
    if (shortcut) {
      reserved.add(normalizeShortcutKey(shortcut))
    }
  })

  return reserved
}

function resolveOpenerShortcut(openerKind: PrepOpenerKind | undefined, usedShortcuts: Set<string>): string {
  const preferredShortcut = openerKind && openerKind !== 'general'
    ? OPENER_PREFERRED_SHORTCUTS[openerKind]
    : undefined
  const normalizedPreferredShortcut = preferredShortcut ? normalizeShortcutKey(preferredShortcut) : undefined

  if (normalizedPreferredShortcut && !usedShortcuts.has(normalizedPreferredShortcut)) {
    usedShortcuts.add(normalizedPreferredShortcut)
    return preferredShortcut!
  }

  const fallbackShortcut = OPENER_SHORTCUT_POOL.find((shortcut) => !usedShortcuts.has(shortcut))
  if (!fallbackShortcut) {
    if (import.meta.env.DEV) {
      console.warn('PrepLiveMode exhausted opener shortcuts; remaining opener sections will use nav fallback only.')
    }
    return ''
  }

  usedShortcuts.add(fallbackShortcut)
  return fallbackShortcut
}

function getStableDeckIdentityPart(value: string | null | undefined): string | null {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function buildLiveModeDeckKey(deck: PrepDeck): string {
  const stableIdentity = [
    deck.id,
    deck.pipelineEntryId,
    deck.vectorId,
  ]
    .map(getStableDeckIdentityPart)
    .filter((part): part is string => Boolean(part))
    .join(':')

  if (stableIdentity) {
    return stableIdentity
  }

  if (import.meta.env.DEV) {
    console.warn('PrepLiveMode received a deck without stable identity fields; using the empty-session fallback key.')
  }

  return buildTransientDeckKey(deck)
}

function buildTransientDeckKey(deck: PrepDeck): string {
  const fingerprint = [
    deck.title,
    deck.company,
    deck.role,
    deck.generatedAt,
    Array.isArray(deck.cards)
      ? deck.cards.map((card) => [card.id, card.category, card.title].join('|')).join(';')
      : null,
  ]
    .map(getStableDeckIdentityPart)
    .filter((part): part is string => Boolean(part))
    .join(':')

  if (!fingerprint) {
    return 'prep-live-transient-empty'
  }

  return 'prep-live-transient-' + fingerprint
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function dedupeSectionShortcuts(sections: LiveSection[]): LiveSection[] {
  const assignedShortcuts = new Set<string>()

  return sections.map((section) => {
    const normalizedShortcut = normalizeShortcutKey(section.shortcut)
    if (!normalizedShortcut) return section

    if (assignedShortcuts.has(normalizedShortcut)) {
      if (import.meta.env.DEV) {
        console.warn(`Duplicate live shortcut "${normalizedShortcut}" removed from section ${section.id}`)
      }
      return {
        ...section,
        shortcut: '',
      }
    }

    assignedShortcuts.add(normalizedShortcut)
    return section
  })
}

function scheduleNextPaint(callback: () => void): () => void {
  if (typeof requestAnimationFrame === 'function' && typeof cancelAnimationFrame === 'function') {
    const frameId = requestAnimationFrame(callback)
    return () => cancelAnimationFrame(frameId)
  }

  const timeoutId = globalThis.setTimeout(callback, 0)
  return () => globalThis.clearTimeout(timeoutId)
}

function formatConditionalToneLabel(tone: 'pivot' | 'trap' | 'escalation'): string {
  if (tone === 'trap') return 'Trap'
  if (tone === 'escalation') return 'Escalation'
  return 'Pivot'
}

export function PrepLiveMode(props: PrepLiveModeProps) {
  const liveModeDeckKey = buildLiveModeDeckKey(props.deck)
  // Switching decks should start a fresh live session so timer, search, and collapsed sections do not leak across interviews.
  return <PrepLiveModeInner key={liveModeDeckKey} {...props} />
}

function PrepLiveModeInner({ deck, onBack }: PrepLiveModeProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null)
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({})
  const [preInterviewOpen, setPreInterviewOpen] = useState(true)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [isTimerRunning, setIsTimerRunning] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})
  const [pendingScrollSectionId, setPendingScrollSectionId] = useState<string | null>(null)
  const timerStartedAtRef = useRef<number | null>(null)
  const timerElapsedBeforeRunRef = useRef(0)
  const elapsedSecondsRef = useRef(0)
  const isTimerRunningRef = useRef(false)
  // Imported decks can briefly hydrate before store normalization restores cards. Treat that as an empty live session instead of crashing.
  const deckCards = useMemo(() => (Array.isArray(deck.cards) ? deck.cards : []), [deck.cards])

  const sections = useMemo(() => derivePrepCheatsheetSections(deck), [deck])
  const cardsById = useMemo(() => new Map(deckCards.map((card) => [card.id, card])), [deckCards])
  const cardNeedsReviewById = useMemo(
    () => new Map(deckCards.map((card) => [card.id, hasPrepCardNeedsReviewContent(card)])),
    [deckCards],
  )
  const filteredSections = useMemo(
    () => filterSections(sections, searchQuery, cardsById),
    [cardsById, searchQuery, sections],
  )
  const visibleSectionLegend = useMemo(
    () => {
      const reservedShortcuts = collectReservedSectionShortcuts(filteredSections)

      return dedupeSectionShortcuts(
        filteredSections.map((section) => {
          const metaKey = getSectionMetaKey(section)
          const meta = SECTION_META[metaKey]
          const phase = meta?.phase ?? ('live' as SectionPhase)
          const shortcut = metaKey === 'opener'
            ? resolveOpenerShortcut(section.openerKind, reservedShortcuts)
            : getSectionShortcutCandidate(section)

          return {
            ...section,
            shortcut,
            itemBudget: meta?.itemBudget,
            tone: meta?.tone ?? 'overview',
            phase,
          }
        }) satisfies LiveSection[],
      )
    },
    [filteredSections],
  )
  const preSections = useMemo(
    () => visibleSectionLegend.filter((section) => section.phase === 'pre'),
    [visibleSectionLegend],
  )
  const liveSections = useMemo(
    () => visibleSectionLegend.filter((section) => section.phase === 'live'),
    [visibleSectionLegend],
  )
  const preSectionGroups = useMemo(() => groupSectionsByGroup(preSections), [preSections])
  const liveSectionGroups = useMemo(() => groupSectionsByGroup(liveSections), [liveSections])
  const keyboardSections = preInterviewOpen ? visibleSectionLegend : liveSections
  const shortcutToSectionId = useMemo(() => {
    const shortcutMap = new Map<string, string>()

    for (const section of visibleSectionLegend) {
      const normalizedShortcut = normalizeShortcutKey(section.shortcut)
      if (!normalizedShortcut) continue

      shortcutMap.set(normalizedShortcut, section.id)
    }

    return shortcutMap
  }, [visibleSectionLegend])
  const shortcutLegend = useMemo(() => {
    const openerSections = visibleSectionLegend.filter((section) => getSectionMetaKey(section) === 'opener')
    const openerShortcuts = openerSections.flatMap((section) => (section.shortcut ? [section.shortcut] : []))
    const openerHasUnassignedShortcut = openerSections.some((section) => !section.shortcut)
    const liveJumpShortcuts = visibleSectionLegend.flatMap((section) => {
      const metaKey = getSectionMetaKey(section)
      return ['behavioral', 'project', 'technical', 'situational'].includes(metaKey) && section.shortcut
        ? [section.shortcut]
        : []
    }).filter(Boolean)
    const items: ShortcutLegendItem[] = [...BASE_SHORTCUT_BAR]

    if (openerSections.length > 0) {
      items.push({
        keys: openerShortcuts.length > 0 ? openerShortcuts.join(' / ') : 'J / K',
        label: openerHasUnassignedShortcut ? 'Openers (nav fallback)' : 'Openers',
      })
    }

    if (liveJumpShortcuts.length > 0) {
      items.push({
        keys: Array.from(new Set(liveJumpShortcuts)).join(' / '),
        label: 'Live jumps',
      })
    }

    return items
  }, [visibleSectionLegend])
  const timerState = useMemo(() => getLiveTimerState(elapsedSeconds), [elapsedSeconds])
  const effectiveActiveSectionId =
    filteredSections.find((section) => section.id === activeSectionId)?.id ?? filteredSections[0]?.id ?? null
  const deckMeta = [deck.company, deck.role].filter(Boolean).join(' · ') || 'Interview prep set'

  const scrollToSection = useCallback((sectionId: string) => {
    const section = sectionRefs.current[sectionId]
    if (section && typeof section.scrollIntoView === 'function') {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    if (section && typeof section.focus === 'function') {
      section.focus({ preventScroll: true })
    }
  }, [])

  const jumpToSection = useCallback(
    (sectionId: string) => {
      const targetSection = visibleSectionLegend.find((section) => section.id === sectionId)
      if (targetSection?.phase === 'pre' && !preInterviewOpen) {
        setPreInterviewOpen(true)
      }

      setActiveSectionId(sectionId)
      if (sectionRefs.current[sectionId]) {
        scrollToSection(sectionId)
        setPendingScrollSectionId(null)
        return
      }
      setPendingScrollSectionId(sectionId)
    },
    [preInterviewOpen, scrollToSection, visibleSectionLegend],
  )

  useEffect(() => {
    if (!pendingScrollSectionId) return

    const targetSectionId = pendingScrollSectionId
    const cancelScroll = scheduleNextPaint(() => {
      // Defer one frame so newly-mounted section refs exist before we attempt to scroll.
      const section = sectionRefs.current[targetSectionId]
      if (section) {
        scrollToSection(targetSectionId)
      }

      setPendingScrollSectionId((current) => (current === targetSectionId ? null : current))
    })

    return cancelScroll
  }, [pendingScrollSectionId, preInterviewOpen, scrollToSection])

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
      const interactiveTarget = isInteractiveShortcutTarget(target)
      const timerTarget = target?.closest('.prep-live-timer')

      // Keep Shift-enabled uppercase shortcuts working, but let browser/OS modifier chords pass through untouched.
      if (event.metaKey || event.ctrlKey || event.altKey) return

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

      if ((matchesShortcut(LIVE_SHORTCUT_KEYS.toggleTimer, event.key) || event.code === 'Space') && !timerTarget) {
        if (interactiveTarget || event.shiftKey) return
        event.preventDefault()
        toggleTimer()
        return
      }

      if (matchesShortcut(LIVE_SHORTCUT_KEYS.resetTimer, event.key)) {
        event.preventDefault()
        resetTimer()
        return
      }

      if (matchesShortcut(LIVE_SHORTCUT_KEYS.toggleSection, event.key) && effectiveActiveSectionId) {
        event.preventDefault()
        toggleSection(effectiveActiveSectionId)
        return
      }

      if (matchesShortcut(LIVE_SHORTCUT_KEYS.firstSection, event.key) && keyboardSections.length > 0) {
        event.preventDefault()
        const firstSection = keyboardSections[0]
        jumpToSection(firstSection.id)
        return
      }

      if (matchesShortcut(LIVE_SHORTCUT_KEYS.lastSection, event.key) && keyboardSections.length > 0) {
        event.preventDefault()
        const lastSection = keyboardSections[keyboardSections.length - 1]
        jumpToSection(lastSection.id)
        return
      }

      const normalizedKey = normalizeShortcutKey(event.key)

      if (/^[1-9]$/.test(event.key) || /^[a-z]$/.test(normalizedKey)) {
        const targetSectionId = shortcutToSectionId.get(normalizedKey)
        if (targetSectionId) {
          event.preventDefault()
          jumpToSection(targetSectionId)
          return
        }
      }

      if (matchesShortcut(LIVE_SHORTCUT_KEYS.nextSection, event.key) && effectiveActiveSectionId) {
        event.preventDefault()
        const currentIndex = keyboardSections.findIndex((section) => section.id === effectiveActiveSectionId)
        const nextSection = keyboardSections[Math.min(keyboardSections.length - 1, currentIndex + 1)]
        if (nextSection) {
          jumpToSection(nextSection.id)
        }
        return
      }

      if (matchesShortcut(LIVE_SHORTCUT_KEYS.previousSection, event.key) && effectiveActiveSectionId) {
        event.preventDefault()
        const currentIndex = keyboardSections.findIndex((section) => section.id === effectiveActiveSectionId)
        const nextSection = keyboardSections[Math.max(0, currentIndex - 1)]
        if (nextSection) {
          jumpToSection(nextSection.id)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    effectiveActiveSectionId,
    keyboardSections,
    jumpToSection,
    resetTimer,
    scrollToSection,
    searchQuery,
    shortcutToSectionId,
    toggleSection,
    toggleTimer,
  ])

  return (
    <div className="prep-live-mode" role="region" aria-label="Live cheatsheet mode">
      <aside className="prep-live-sidebar">
        <div className="prep-live-sidebar-header">
          {onBack ? (
            <button className="prep-live-back" type="button" onClick={onBack} aria-label="Back to Prep">
              <ArrowLeft size={14} />
            </button>
          ) : null}
          <div className="prep-live-sidebar-header-copy">
            <h2 className="prep-live-sidebar-heading">{deck.title}</h2>
            <p className="prep-live-sidebar-sub">{deckMeta}</p>
          </div>
        </div>

        <div
          className={`prep-live-timer prep-live-timer-${timerState}`}
          role="button"
          tabIndex={0}
          onClick={() => {
            toggleTimer()
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              event.stopPropagation()
              toggleTimer()
            }
          }}
          aria-label={isTimerRunning ? 'Pause timer' : 'Start timer'}
        >
          <span className="prep-live-timer-label">Timer</span>
          <span className={`prep-live-timer-display prep-live-timer-display-${timerState}`} role="timer">
            {formatDuration(elapsedSeconds)}
          </span>
          <span className="prep-live-timer-hint">
            {isTimerRunning ? 'space to pause' : elapsedSeconds > 0 ? 'space to resume' : 'space to start'}
          </span>
          <button
            type="button"
            className="prep-live-timer-reset"
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.stopPropagation()
              }
            }}
            onClick={(event) => {
              event.stopPropagation()
              resetTimer()
            }}
            aria-label="Reset timer"
          >
            Reset
          </button>
        </div>

        <div className="prep-live-search">
          <Search size={14} />
          <input
            type="search"
            ref={searchInputRef}
            className="prep-live-search-input"
            aria-label="Search cheatsheet"
            aria-keyshortcuts="/"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="/ to search"
          />
        </div>

        <nav className="prep-live-nav" aria-label="Live cheatsheet sections">
          <div className="prep-live-nav-heading">
            <span className="prep-live-nav-label">Pre-Interview</span>
            <span className="prep-live-nav-summary">{preSections.length} sections</span>
          </div>
          {preSections.length > 0 ? (
            <div className="prep-live-nav-group">
              <button
                type="button"
                className={`prep-live-nav-group-toggle ${preInterviewOpen ? 'prep-live-nav-group-toggle-open' : ''}`}
                onClick={() => setPreInterviewOpen((open) => !open)}
                aria-expanded={preInterviewOpen}
              >
                <ChevronRight size={12} className={`prep-live-nav-group-chevron ${preInterviewOpen ? 'prep-live-nav-group-chevron-open' : ''}`} />
                <span>Sections</span>
                <span className="prep-live-nav-group-count">{preSections.length}</span>
              </button>
              {preInterviewOpen ? (
                <SectionGroupNavList
                  groups={preSectionGroups}
                  activeSectionId={effectiveActiveSectionId}
                  onNavigate={(sectionId) => {
                    setActiveSectionId(sectionId)
                    scrollToSection(sectionId)
                  }}
                />
              ) : null}
            </div>
          ) : null}

          <div className="prep-live-nav-heading">
            <span className="prep-live-nav-label">Live</span>
            <span className="prep-live-nav-summary">{liveSections.length} sections</span>
          </div>

          <SectionGroupNavList
            groups={liveSectionGroups}
            activeSectionId={effectiveActiveSectionId}
            onNavigate={(sectionId) => {
              setActiveSectionId(sectionId)
              scrollToSection(sectionId)
            }}
          />
        </nav>
      </aside>

      <main className="prep-live-main">
        {filteredSections.length === 0 ? (
          <div className="prep-empty">
            <h2>No cheatsheet sections match that search</h2>
            <p>Clear the search to get the full interview view back.</p>
          </div>
        ) : (
          <div className="prep-live-phases">
            {preSectionGroups.length > 0 ? (
              <section className={`prep-live-phase prep-live-phase-pre ${preInterviewOpen ? 'prep-live-phase-open' : ''}`}>
                <div className="prep-live-phase-header">
                  <div>
                    <span className="prep-live-phase-label">Pre-Interview</span>
                    <h2>Warm-up notes</h2>
                    <p>Use these sections to set the frame before you start answering live questions.</p>
                  </div>
                  <button
                    type="button"
                    className="prep-btn"
                    aria-expanded={preInterviewOpen}
                    onClick={() => setPreInterviewOpen((open) => !open)}
                  >
                    {preInterviewOpen ? 'Collapse pre-interview' : 'Expand pre-interview'}
                  </button>
                </div>
                {preInterviewOpen ? (
                  <SectionGroupList
                    groups={preSectionGroups}
                    cardsById={cardsById}
                    cardNeedsReviewById={cardNeedsReviewById}
                    activeSectionId={effectiveActiveSectionId}
                    collapsedSections={collapsedSections}
                    searchActive={searchQuery.trim().length > 0}
                    onToggleSection={toggleSection}
                    onSectionRef={(sectionId, el) => {
                      sectionRefs.current[sectionId] = el
                    }}
                  />
                ) : (
                  <div className="prep-live-phase-collapsed">
                    Pre-interview sections are collapsed. Expand them when you want the setup notes.
                  </div>
                )}
              </section>
            ) : null}

            <section className="prep-live-phase prep-live-phase-live">
              <div className="prep-live-phase-header">
                <div>
                  <span className="prep-live-phase-label">Live</span>
                  <h2>Answer bank</h2>
                  <p>Keep these cards in view while you answer and steer the conversation live.</p>
                </div>
              </div>
              <SectionGroupList
                groups={liveSectionGroups}
                cardsById={cardsById}
                cardNeedsReviewById={cardNeedsReviewById}
                activeSectionId={effectiveActiveSectionId}
                collapsedSections={collapsedSections}
                searchActive={searchQuery.trim().length > 0}
                onToggleSection={toggleSection}
                onSectionRef={(sectionId, el) => {
                  sectionRefs.current[sectionId] = el
                }}
              />
            </section>
          </div>
        )}
      </main>

      <div className="prep-live-kbd-bar" aria-label="Live cheatsheet shortcuts">
        {shortcutLegend.map((shortcut) => (
          <span key={shortcut.keys} className="prep-live-kbd-item">
            <span className="prep-live-legend-keys">{shortcut.keys}</span>
            <span className="prep-live-kbd-label">{shortcut.label}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

interface NavLinkProps {
  section: LiveSection
  isActive: boolean
  onNavigate: () => void
}

function NavLink({ section, isActive, onNavigate }: NavLinkProps) {
  return (
    <button
      type="button"
      className={`prep-live-nav-link prep-live-nav-link-${section.tone} ${isActive ? 'prep-live-nav-link-active' : ''}`}
      onClick={onNavigate}
      aria-keyshortcuts={section.shortcut || undefined}
      aria-current={isActive ? 'true' : undefined}
    >
      <span className="prep-live-nav-copy">
        <span className="prep-live-nav-title">
          <span className={`prep-live-tone-dot prep-live-tone-${section.tone}`} aria-hidden="true" />
          {section.title}
        </span>
        <span className="prep-live-nav-meta">{section.items.length} items</span>
      </span>
      {section.shortcut ? <span className="prep-live-shortcut-badge">{section.shortcut}</span> : null}
    </button>
  )
}

interface SectionGroupNavListProps {
  groups: SectionGroupView[]
  activeSectionId: string | null
  onNavigate: (sectionId: string) => void
}

function SectionGroupNavList({ groups, activeSectionId, onNavigate }: SectionGroupNavListProps) {
  return (
    <div className="prep-live-nav-groups">
      {groups.map((group) => (
        <div key={group.group} className="prep-live-nav-subgroup">
          <div className="prep-live-nav-subgroup-header">
            <span className="prep-live-nav-subgroup-title">{group.group}</span>
            <span className="prep-live-nav-subgroup-count">{group.sections.length}</span>
          </div>
          <div className="prep-live-nav-subgroup-divider" />
          {group.sections.map((section) => (
            <NavLink
              key={section.id}
              section={section}
              isActive={activeSectionId === section.id}
              onNavigate={() => onNavigate(section.id)}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

interface SectionBlockProps {
  section: LiveSection
  cardsById: Map<string, PrepCard>
  cardNeedsReviewById: Map<string, boolean>
  isActive: boolean
  isCollapsed: boolean
  onToggle: () => void
  sectionRef: (el: HTMLElement | null) => void
}

interface SectionGroupListProps {
  groups: SectionGroupView[]
  cardsById: Map<string, PrepCard>
  cardNeedsReviewById: Map<string, boolean>
  activeSectionId: string | null
  collapsedSections: Record<string, boolean>
  searchActive: boolean
  onToggleSection: (sectionId: string) => void
  onSectionRef: (sectionId: string, el: HTMLElement | null) => void
}

function SectionGroupList({
  groups,
  cardsById,
  cardNeedsReviewById,
  activeSectionId,
  collapsedSections,
  searchActive,
  onToggleSection,
  onSectionRef,
}: SectionGroupListProps) {
  return (
    <div className="prep-live-section-groups">
      {groups.map((group) => (
        <div key={group.group} className="prep-live-section-group">
          <div className="prep-live-section-group-header">
            <h3 className="prep-live-section-group-title">{group.group}</h3>
            <span className="prep-live-section-group-count">{group.sections.length} sections</span>
          </div>
          <div className="prep-live-section-group-divider" />
          <div className="prep-live-section-group-body">
            {group.sections.map((section) => (
              <SectionBlock
                key={section.id}
                section={section}
                cardsById={cardsById}
                cardNeedsReviewById={cardNeedsReviewById}
                isActive={activeSectionId === section.id}
                isCollapsed={!searchActive && collapsedSections[section.id] === true}
                onToggle={() => onToggleSection(section.id)}
                sectionRef={(el) => onSectionRef(section.id, el)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function SectionBlock({ section, cardsById, cardNeedsReviewById, isActive, isCollapsed, onToggle, sectionRef }: SectionBlockProps) {
  let sectionGuidance = section.guidance
  if (!sectionGuidance && section.id === 'questions') {
    sectionGuidance = QUESTIONS_GUIDANCE
  }

  return (
    <section
      ref={sectionRef}
      tabIndex={-1}
      className={`prep-live-section prep-live-section-${section.tone} ${isActive ? 'prep-live-section-active' : ''}`}
    >
      <div className="prep-live-section-header">
        <div>
          <div className="prep-live-section-badges">
            {section.shortcut ? (
              <span className={`prep-live-scan-badge prep-live-scan-badge-${section.tone}`}>
                {section.shortcut}
              </span>
            ) : null}
            {section.itemBudget ? <span className="prep-live-budget-badge">{section.itemBudget}m</span> : null}
            <span className="prep-live-count-badge">{section.items.length} items</span>
          </div>
          <h2>{section.title}</h2>
          <p>{section.description}</p>
          {sectionGuidance ? <div className="prep-live-section-guidance">{sectionGuidance}</div> : null}
        </div>
        <button
          className="prep-btn"
          aria-expanded={!isCollapsed}
          aria-controls={`prep-live-section-content-${section.id}`}
          onClick={onToggle}
        >
          {isCollapsed ? 'Expand' : 'Collapse'}
        </button>
      </div>

      <div
        id={`prep-live-section-content-${section.id}`}
        className="prep-live-item-list prep-live-item-list-rich"
        hidden={isCollapsed}
      >
        {renderSectionItems(section, cardsById, cardNeedsReviewById)}
      </div>
    </section>
  )
}

function renderSectionItems(section: LiveSection, cardsById: Map<string, PrepCard>, cardNeedsReviewById: Map<string, boolean>) {
  if (section.id === 'questions') return renderQuestionCards(section)
  if (section.id === 'donts') return renderDonts(section)
  if (section.id === 'metrics') return renderMetricCards(section, cardsById, cardNeedsReviewById)

  return section.items.flatMap((item) => {
    if (item.cardId) {
      const card = cardsById.get(item.cardId)
      return card ? [renderCardBlock(card, section, cardNeedsReviewById.get(card.id) ?? false)] : [renderSimpleItem(section, item)]
    }

    return [renderSimpleItem(section, item)]
  })
}

function renderSimpleItem(section: LiveSection, item: PrepCheatsheetItem) {
  const needsReview = hasPrepNeedsReviewText(item.title) || hasPrepNeedsReviewText(item.detail)
  return (
    <article key={item.id} className={`prep-live-item prep-live-item-${section.tone}${needsReview ? ' prep-live-review-surface' : ''}`}>
      <div className="prep-live-item-header">
        <h3>{item.title}</h3>
        <div className="prep-live-item-meta">
          {item.category ? <span className={`prep-category prep-category-${item.category}`}>{item.category}</span> : null}
          {needsReview ? <span className="prep-review-badge">Needs Review</span> : null}
        </div>
      </div>
      {item.detail ? <p>{item.detail}</p> : null}
    </article>
  )
}

function renderQuestionCards(section: LiveSection) {
  return section.items.map((item) => {
    const needsReview = hasPrepNeedsReviewText(item.title) || hasPrepNeedsReviewText(item.detail)
    return (
      <article key={item.id} className={`prep-live-question-card${needsReview ? ' prep-live-review-surface' : ''}`}>
        <div className="prep-live-question-card-header">
          <div className="prep-live-question-card-question">{item.title}</div>
          {needsReview ? <span className="prep-review-badge">Needs Review</span> : null}
        </div>
        {item.detail ? <div className="prep-live-question-card-context">{item.detail}</div> : null}
      </article>
    )
  })
}

function renderDonts(section: LiveSection) {
  return section.items.map((item) => {
    const needsReview = hasPrepNeedsReviewText(item.title)
    return (
      <article key={item.id} className={`prep-live-dont-card${needsReview ? ' prep-live-review-surface' : ''}`} aria-label={'Do not: ' + item.title}>
        <div className="prep-live-dont-card-marker" aria-hidden="true">
          Do not
        </div>
        <div className="prep-live-dont-card-body">
          <div className="prep-live-dont-card-title">{item.title}</div>
          {needsReview ? <span className="prep-review-badge">Needs Review</span> : null}
        </div>
      </article>
    )
  })
}

function renderMetricCards(section: LiveSection, cardsById: Map<string, PrepCard>, cardNeedsReviewById: Map<string, boolean>) {
  return section.items.flatMap((item) => {
    const card = item.cardId ? cardsById.get(item.cardId) : null
    if (card) return [renderCardBlock(card, section, cardNeedsReviewById.get(card.id) ?? false)]
    if (item.metrics && item.metrics.length > 0) return [renderMetricGroupItem(section, item)]
    return [renderSimpleItem(section, item)]
  })
}

function renderMetricGroupItem(section: LiveSection, item: PrepCheatsheetItem) {
  const needsReview = hasPrepNeedsReviewText(item.title) || hasPrepNeedsReviewText(item.detail) || (item.metrics?.some((metric) => hasPrepMetricNeedsReview(metric)) ?? false)
  return (
    <article
      key={item.id}
      className={`prep-live-card-block prep-live-card-block-${section.tone} prep-live-card-block-metrics${needsReview ? ' prep-live-review-surface' : ''}`}
    >
      <div className="prep-live-card-block-header">
        <div>
          <div className="prep-live-card-block-title-row">
            <h3>{item.title}</h3>
            {needsReview ? <span className="prep-review-badge">Needs Review</span> : null}
          </div>
          {item.detail ? <div className="prep-live-card-block-script-label">{item.detail}</div> : null}
        </div>
      </div>

      <div className="prep-live-stat-grid">
        {item.metrics?.map((metric) => (
          <div key={metric.id ?? `${item.id}-${metric.value}-${metric.label}`} className="prep-live-stat-box">
            <span className="prep-live-stat-value">{metric.value}</span>
            <span className="prep-live-stat-label">{metric.label}</span>
          </div>
        ))}
      </div>
    </article>
  )
}

function renderCardBlock(card: PrepCard, section: LiveSection, needsReview: boolean) {
  const keyPoints = filterPrepKeyPoints(card.keyPoints)
  const storyBlocks = filterPrepStoryBlocks(card.storyBlocks)
  const followUps = filterPrepFollowUps(card.followUps)
  const deepDives = filterPrepDeepDives(card.deepDives)
  const conditionals = filterPrepConditionals(card.conditionals)
  const metrics = filterPrepMetrics(card.metrics)
  const tableData = getRenderableTableData(card.tableData)

  return (
    <article key={card.id} className={`prep-live-card-block prep-live-card-block-${section.tone}${needsReview ? ' prep-live-review-surface' : ''}`}>
      <div className="prep-live-card-block-header">
        <div>
          <div className="prep-live-card-block-title-row">
            <h3>{card.title}</h3>
            <span className={`prep-category prep-category-${card.category}`}>{card.category}</span>
            {needsReview ? <span className="prep-review-badge">Needs Review</span> : null}
          </div>
          {card.scriptLabel ? <div className="prep-live-card-block-script-label">{card.scriptLabel}</div> : null}
        </div>
      </div>

      {keyPoints.length > 0 ? (
        <div className="prep-live-keypoints">
          {keyPoints.map((point, index) => (
            <div key={`${card.id}-keypoint-${point}-${index}`} className="prep-live-keypoint">
              <span className="prep-live-keypoint-marker" aria-hidden="true">
                -
              </span>
              <span>{point}</span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="prep-live-card-block-grid">
        {card.notes ? (
          <section className="prep-live-callout prep-live-callout-context">
            <span className="prep-live-callout-label">Context</span>
            <p>{card.notes}</p>
          </section>
        ) : null}

        {card.script ? (
          <section className="prep-live-callout prep-live-callout-script">
            <span className="prep-live-callout-label">Script</span>
            <p>{card.script}</p>
          </section>
        ) : null}

        {card.warning ? (
          <section className="prep-live-callout prep-live-callout-warning">
            <span className="prep-live-callout-label">Warning</span>
            <p>{card.warning}</p>
          </section>
        ) : null}

        {followUps.map((followUp, index) => (
          <section
            key={followUp.id ?? `${card.id}-follow-up-${index}`}
            className="prep-live-callout prep-live-callout-context"
          >
            <span className="prep-live-callout-label">Follow-up</span>
            <p>{followUp.question}</p>
            <p>{followUp.answer}</p>
            {followUp.context ? <p>{followUp.context}</p> : null}
          </section>
        ))}

        {deepDives.map((deepDive, index) => (
          <section
            key={deepDive.id ?? `${card.id}-deep-dive-${index}`}
            className="prep-live-callout prep-live-callout-script"
          >
            <span className="prep-live-callout-label">{deepDive.title}</span>
            <p>{deepDive.content}</p>
          </section>
        ))}
      </div>

      {storyBlocks.length > 0 ? (
        <div className="prep-live-story-blocks">
          {storyBlocks.map((storyBlock, index) => (
            <div
              key={`${card.id}-story-${storyBlock.label}-${storyBlock.text}-${index}`}
              className={`prep-live-story-block prep-live-story-block-${storyBlock.label}`}
            >
              <span className="prep-live-story-block-label">{storyBlock.label}</span>
              <p>{storyBlock.text}</p>
            </div>
          ))}
        </div>
      ) : null}

      {conditionals.length > 0 ? (
        <div className="prep-live-conditionals">
          {conditionals.map((conditional, index) => {
            const tone = resolvePrepConditionalTone(conditional)
            const key = conditional.id ?? `${card.id}-${conditional.trigger}-${conditional.response}-${index}`

            if (tone === 'trap') {
              return (
                <div key={key} className="prep-live-conditional">
                  <div className="prep-live-conditional-pair-grid">
                    <div className="prep-live-conditional-pair prep-live-conditional-pair-trap">
                      <span className="prep-live-conditional-label">Trap</span>
                      <p>{conditional.trigger}</p>
                    </div>
                    <div className="prep-live-conditional-pair prep-live-conditional-pair-reframe">
                      <span className="prep-live-conditional-label">Reframe</span>
                      <p>{conditional.response}</p>
                    </div>
                  </div>
                </div>
              )
            }

            return (
              <div key={key} className={`prep-live-conditional prep-live-conditional-${tone}`}>
                <div className="prep-live-conditional-heading">
                  <span className="prep-live-conditional-label">{formatConditionalToneLabel(tone)}</span>
                  <span>{conditional.trigger}</span>
                </div>
                <p>{conditional.response}</p>
              </div>
            )
          })}
        </div>
      ) : null}

      {metrics.length > 0 ? (
        <div className="prep-live-stat-grid">
          {metrics.map((metric) => (
            <div key={metric.id ?? `${card.id}-${metric.value}-${metric.label}`} className="prep-live-stat-box">
              <span className="prep-live-stat-value">{metric.value}</span>
              <span className="prep-live-stat-label">{metric.label}</span>
            </div>
          ))}
        </div>
      ) : null}

      {tableData ? (
        <table className="prep-live-table">
          <thead>
            <tr>
              {tableData.headers.map((header, index) => (
                <th key={`${card.id}-table-header-${header}-${index}`} scope="col">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableData.rows.map((row, rowIndex) => (
              <tr key={`${card.id}-table-row-${rowIndex}`}>
                {tableData.headers.map((header, cellIndex) => (
                  <td key={`${card.id}-table-cell-${rowIndex}-${header}-${cellIndex}`}>
                    {row[cellIndex] ?? ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </article>
  )
}
