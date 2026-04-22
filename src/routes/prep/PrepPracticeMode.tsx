import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Eye, Shuffle, X } from 'lucide-react'
import { PrepCardView } from './PrepCardView'
import { PrepRulesPanel } from './PrepRulesPanel'
import type { PrepCard, PrepCardConfidence, PrepCardStudyState } from '../../types/prep'
import {
  filterPrepConditionals,
  filterPrepKeyPoints,
  filterPrepStoryBlocks,
  hasPrepCardNeedsReviewContent,
  resolvePrepConditionalTone,
} from '../../utils/prepCardContent'

interface PrepPracticeModeProps {
  cards: PrepCard[]
  rules?: string[]
  studyProgress?: Record<string, PrepCardStudyState>
  onExit: () => void
  onRecordReview: (cardId: string, confidence: PrepCardConfidence) => void
}

type HomeworkFilter = 'all' | 'openers' | 'needs_work' | 'unreviewed'

type HomeworkQueueEntry =
  | {
      id: string
      kind: 'card'
      cardId: string
    }
  | {
      id: string
      kind: 'conditional'
      cardId: string
      conditionalIndex: number
    }

const HOMEWORK_FILTER_LABELS: Record<HomeworkFilter, string> = {
  all: 'All cards',
  openers: 'Openers',
  needs_work: 'Needs work',
  unreviewed: 'Unreviewed',
}

const CONDITIONAL_TONE_LABELS = {
  pivot: 'Pivot',
  trap: 'Trap',
  escalation: 'Escalation',
} as const

const CONFIDENCE_LABELS: Record<PrepCardConfidence, string> = {
  nailed_it: 'Nailed it',
  okay: 'Okay',
  needs_work: 'Needs work',
}

function fisherYatesShuffle<T>(items: readonly T[]): T[] {
  const next = [...items]
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[next[index], next[swapIndex]] = [next[swapIndex], next[index]]
  }
  return next
}

function isInteractiveTag(tagName: string | undefined): boolean {
  return tagName === 'BUTTON' || tagName === 'A' || tagName === 'INPUT' || tagName === 'TEXTAREA'
}

function selectCardsForFilter(
  cards: readonly PrepCard[],
  studyProgress: Record<string, PrepCardStudyState> | undefined,
  filter: HomeworkFilter,
): PrepCard[] {
  if (filter === 'all') return [...cards]
  if (filter === 'openers') return cards.filter((card) => card.category === 'opener')
  if (filter === 'needs_work') {
    return cards.filter((card) => {
      const progress = studyProgress?.[card.id]
      return (progress?.needsWorkCount ?? 0) > 0 || progress?.confidence === 'needs_work'
    })
  }
  return cards.filter((card) => !studyProgress?.[card.id])
}

function createInitialHomeworkQueue(
  cards: readonly PrepCard[],
  studyProgress: Record<string, PrepCardStudyState> | undefined,
): HomeworkQueueEntry[] {
  return fisherYatesShuffle(selectCardsForFilter(cards, studyProgress, 'all')).map((card, index) => ({
    id: `card:${card.id}:initial:${index}`,
    kind: 'card',
    cardId: card.id,
  }))
}

export function PrepPracticeMode({
  cards,
  rules,
  studyProgress,
  onExit,
  onRecordReview,
}: PrepPracticeModeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const studyProgressRef = useRef(studyProgress)
  const filterRef = useRef<HomeworkFilter>('all')
  const queueEntryCounterRef = useRef(0)
  const [filter, setFilter] = useState<HomeworkFilter>('all')

  const createHomeworkCardEntry = useCallback((cardId: string): HomeworkQueueEntry => {
    queueEntryCounterRef.current += 1
    return {
      id: `card:${cardId}:${queueEntryCounterRef.current}`,
      kind: 'card',
      cardId,
    }
  }, [])

  const createHomeworkConditionalEntry = useCallback((cardId: string, conditionalIndex: number): HomeworkQueueEntry => {
    queueEntryCounterRef.current += 1
    return {
      id: `conditional:${cardId}:${conditionalIndex}:${queueEntryCounterRef.current}`,
      kind: 'conditional',
      cardId,
      conditionalIndex,
    }
  }, [])

  const eligibleCards = useMemo(
    () => cards.filter((card) => !hasPrepCardNeedsReviewContent(card)),
    [cards],
  )

  const [queue, setQueue] = useState<HomeworkQueueEntry[]>(() =>
    createInitialHomeworkQueue(eligibleCards, studyProgress),
  )
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isRevealed, setIsRevealed] = useState(false)
  const [sessionReviewedCount, setSessionReviewedCount] = useState(0)
  const [sessionNeedsWorkCount, setSessionNeedsWorkCount] = useState(0)

  useEffect(() => {
    containerRef.current?.focus()
  }, [])

  useEffect(() => {
    studyProgressRef.current = studyProgress
  }, [studyProgress])

  const needsAttentionCount = cards.length - eligibleCards.length

  const cardsById = useMemo(
    () => new Map(eligibleCards.map((card) => [card.id, card])),
    [eligibleCards],
  )
  const cardsByIdRef = useRef(cardsById)

  useEffect(() => {
    cardsByIdRef.current = cardsById
  }, [cardsById])

  const filterCounts = useMemo(
    () => ({
      all: eligibleCards.length,
      openers: selectCardsForFilter(eligibleCards, studyProgress, 'openers').length,
      needs_work: selectCardsForFilter(eligibleCards, studyProgress, 'needs_work').length,
      unreviewed: selectCardsForFilter(eligibleCards, studyProgress, 'unreviewed').length,
    }),
    [eligibleCards, studyProgress],
  )

  const rebuildQueue = useCallback(
    (nextFilter: HomeworkFilter) => {
      // Snapshot study progress only when the user intentionally resets the queue.
      // Mid-round grading should not reshuffle the session out from under them.
      const nextCards = selectCardsForFilter(eligibleCards, studyProgressRef.current, nextFilter)
      setQueue(fisherYatesShuffle(nextCards).map((card) => createHomeworkCardEntry(card.id)))
      setCurrentIndex(0)
      setIsRevealed(false)
      setSessionReviewedCount(0)
      setSessionNeedsWorkCount(0)
    },
    [createHomeworkCardEntry, eligibleCards],
  )

  useEffect(() => {
    if (filterRef.current === filter) return
    filterRef.current = filter
    rebuildQueue(filter)
  }, [filter, rebuildQueue])

  const activeIndex = useMemo(() => {
    // Homework sessions are intentionally snapshot-based. If cards disappear mid-session,
    // skip their queued entries and attached follow-up drills until the next shuffle/filter reset.
    for (let index = currentIndex; index < queue.length; index += 1) {
      const entry = queue[index]
      const card = cardsById.get(entry.cardId)
      if (!card) continue
      if (
        entry.kind === 'conditional' &&
        entry.conditionalIndex >= filterPrepConditionals(card.conditionals).length
      ) {
        continue
      }
      return index
    }
    return queue.length
  }, [cardsById, currentIndex, queue])

  const currentEntry = queue[activeIndex] ?? null
  const currentCard = currentEntry ? cardsById.get(currentEntry.cardId) ?? null : null
  const currentConditionals = useMemo(
    () => filterPrepConditionals(currentCard?.conditionals),
    [currentCard],
  )
  const currentConditional =
    currentEntry?.kind === 'conditional'
      ? currentConditionals[currentEntry.conditionalIndex] ?? null
      : null
  const currentStoryBlocks = useMemo(
    () => filterPrepStoryBlocks(currentCard?.storyBlocks),
    [currentCard],
  )
  const currentKeyPoints = useMemo(
    () => filterPrepKeyPoints(currentCard?.keyPoints),
    [currentCard],
  )
  const isComplete = queue.length > 0 && activeIndex >= queue.length

  const handleShuffle = useCallback(() => {
    rebuildQueue(filter)
  }, [filter, rebuildQueue])

  const handleRecord = useCallback(
    (confidence: PrepCardConfidence) => {
      if (!currentEntry || !currentCard) return
      const liveCard = cardsByIdRef.current.get(currentEntry.cardId)
      if (!liveCard) return
      const liveConditionals = filterPrepConditionals(liveCard.conditionals)
      if (
        currentEntry.kind === 'conditional' &&
        currentEntry.conditionalIndex >= liveConditionals.length
      ) {
        return
      }

      onRecordReview(liveCard.id, confidence)
      setSessionReviewedCount((count) => count + 1)
      setSessionNeedsWorkCount((count) => count + (confidence === 'needs_work' ? 1 : 0))
      setQueue((currentQueue) => {
        const nextQueue = [...currentQueue]

        if (currentEntry.kind === 'card' && liveConditionals.length > 0) {
          nextQueue.splice(
            activeIndex + 1,
            0,
            ...liveConditionals.map((_, conditionalIndex) =>
              createHomeworkConditionalEntry(liveCard.id, conditionalIndex),
            ),
          )
        }

        if (confidence === 'needs_work') {
          const requeueEntry =
            currentEntry.kind === 'card'
              ? createHomeworkCardEntry(liveCard.id)
              : createHomeworkConditionalEntry(liveCard.id, currentEntry.conditionalIndex)
          const insertedConditionalCount = currentEntry.kind === 'card' ? liveConditionals.length : 0
          const insertAt = Math.min(nextQueue.length, activeIndex + insertedConditionalCount + 3)
          nextQueue.splice(insertAt, 0, requeueEntry)
        }

        return nextQueue
      })
      setCurrentIndex(activeIndex + 1)
      setIsRevealed(false)
    },
    [activeIndex, createHomeworkCardEntry, createHomeworkConditionalEntry, currentCard, currentEntry, onRecordReview],
  )

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onExit()
        return
      }

      if (!currentCard || !currentEntry) return

      const tag = (event.target as HTMLElement | null)?.tagName

      if (event.key === ' ' || event.key === 'Enter') {
        if (isInteractiveTag(tag)) return
        if (!isRevealed) {
          if (event.key === ' ') event.preventDefault()
          setIsRevealed(true)
        }
        return
      }

      if (!isRevealed || isInteractiveTag(tag)) return

      if (event.key === '1') handleRecord('nailed_it')
      if (event.key === '2') handleRecord('okay')
      if (event.key === '3') handleRecord('needs_work')
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentCard, currentEntry, handleRecord, isRevealed, onExit])

  const attentionChip = needsAttentionCount > 0
    ? <span className="prep-mode-chip prep-practice-attention">{needsAttentionCount} needs attention</span>
    : null

  if (cards.length === 0) {
    return (
      <div className="prep-practice-mode" ref={containerRef} tabIndex={-1} role="region" aria-label="Homework mode">
        <PrepRulesPanel
          rules={rules}
          variant="practice"
          title="The Rules"
          subtitle="Keep these deck-level delivery reminders in view while you drill."
        />
        <div className="prep-empty">
          <h2>No cards available</h2>
          <button className="prep-btn" onClick={onExit}>Back to Edit</button>
        </div>
      </div>
    )
  }

  if (queue.length === 0) {
    return (
      <div className="prep-practice-mode" ref={containerRef} tabIndex={-1} role="region" aria-label="Homework mode">
        <div className="prep-practice-header">
          <div>
            <div className="prep-practice-progress">Homework</div>
            <p className="prep-practice-subcopy">Use confidence grading to keep weak answers coming back until they stick.</p>
          </div>
          <div className="prep-practice-actions">
            <button className="prep-btn" onClick={onExit}>
              <X size={16} /> Back to Edit
            </button>
          </div>
        </div>

        <PrepRulesPanel
          rules={rules}
          variant="practice"
          title="The Rules"
          subtitle="Keep these deck-level delivery reminders in view while you drill."
        />

        <div className="prep-practice-filter-row">
          {(Object.keys(HOMEWORK_FILTER_LABELS) as HomeworkFilter[]).map((option) => (
            <button
              key={option}
              type="button"
              className={`prep-pill ${filter === option ? 'prep-pill-active' : ''}`}
              onClick={() => setFilter(option)}
              aria-pressed={filter === option}
            >
              {HOMEWORK_FILTER_LABELS[option]}
              <span className="prep-practice-filter-count" aria-label={`${filterCounts[option]} cards`}>{filterCounts[option]}</span>
            </button>
          ))}
        </div>

        <div className="prep-practice-stats">
          {attentionChip}
        </div>

        <div className="prep-empty">
          <h2>No cards match this homework filter</h2>
          <p>
            Switch filters or go back to Edit to add more prompts before the next study round.
            {needsAttentionCount > 0 ? ` ${needsAttentionCount} cards are hidden until their placeholders are filled.` : ''}
          </p>
          <div className="prep-empty-actions">
            <button
              className="prep-btn"
              onClick={() => setFilter('all')}
            >
              Show all cards
            </button>
            <button className="prep-btn" onClick={onExit}>Back to Edit</button>
          </div>
        </div>
      </div>
    )
  }

  if (isComplete || !currentCard || !currentEntry) {
    return (
      <div className="prep-practice-mode" ref={containerRef} tabIndex={-1} role="region" aria-label="Homework mode">
        <div className="prep-practice-header">
          <div>
            <div className="prep-practice-progress">Homework complete</div>
            <p className="prep-practice-subcopy">Use the next round to keep tightening the answers that still need repetition.</p>
          </div>
          <div className="prep-practice-actions">
            <button className="prep-btn" onClick={handleShuffle}>
              <Shuffle size={16} /> Shuffle
            </button>
            <button className="prep-btn" onClick={onExit}>
              <X size={16} /> Back to Edit
            </button>
          </div>
        </div>

        <PrepRulesPanel
          rules={rules}
          variant="practice"
          title="The Rules"
          subtitle="Keep these deck-level delivery reminders in view while you drill."
        />

        <div className="prep-practice-stats" role="status" aria-label="Homework round summary">
          <span className="prep-mode-chip">Reviewed: {sessionReviewedCount}</span>
          <span className="prep-mode-chip">Marked needs work: {sessionNeedsWorkCount}</span>
          <span className="prep-mode-chip">Filter: {HOMEWORK_FILTER_LABELS[filter]}</span>
          <span className="prep-mode-chip">Saved weak cards: {filterCounts.needs_work}</span>
          {attentionChip}
        </div>

        <div className="prep-practice-complete">
          <h3>You completed this homework round.</h3>
          <p>
            {sessionNeedsWorkCount > 0
              ? 'Cards marked needs work will benefit from another pass or a focused weak-card round.'
              : 'Nice work. Try a shuffled round or switch filters to target weaker material.'}
          </p>
          <div className="prep-empty-actions">
            <button className="prep-btn prep-btn-primary" onClick={handleShuffle}>
              <Shuffle size={16} /> Shuffle & Restart
            </button>
            {filter !== 'needs_work' && filterCounts.needs_work > 0 ? (
              <button
                className="prep-btn"
                onClick={() => setFilter('needs_work')}
              >
                Study weak cards
              </button>
            ) : null}
          </div>
        </div>
      </div>
    )
  }

  const conditionalTone = currentConditional ? resolvePrepConditionalTone(currentConditional) : null
  const resolvedConditionalTone = conditionalTone ?? 'pivot'
  const revealMode =
    currentEntry.kind === 'conditional'
      ? 'conditional'
      : currentStoryBlocks.length > 0
        ? 'story'
        : currentKeyPoints.length > 0
          ? 'key_points'
          : 'fallback'

  return (
    <div className="prep-practice-mode" ref={containerRef} tabIndex={-1} role="region" aria-label="Homework mode">
      <div className="prep-practice-header">
        <div>
          <div className="prep-practice-progress" role="status" aria-label={`Card ${activeIndex + 1} of ${queue.length}`}>
            Card {activeIndex + 1} of {queue.length}
          </div>
          <p className="prep-practice-subcopy">Reveal the answer, grade how it felt, and weak cards will resurface automatically.</p>
        </div>
        <div className="prep-practice-actions">
          <button className="prep-btn" onClick={handleShuffle}>
            <Shuffle size={16} /> Shuffle
          </button>
          <button className="prep-btn" onClick={onExit}>
            <X size={16} /> Back to Edit
          </button>
        </div>
      </div>

      <PrepRulesPanel
        rules={rules}
        variant="practice"
        title="The Rules"
        subtitle="Keep these deck-level delivery reminders in view while you drill."
      />

      <div className="prep-practice-filter-row">
        {(Object.keys(HOMEWORK_FILTER_LABELS) as HomeworkFilter[]).map((option) => (
          <button
            key={option}
            type="button"
            className={`prep-pill ${filter === option ? 'prep-pill-active' : ''}`}
            onClick={() => setFilter(option)}
            aria-pressed={filter === option}
          >
            {HOMEWORK_FILTER_LABELS[option]}
            <span className="prep-practice-filter-count" aria-label={`${filterCounts[option]} cards`}>{filterCounts[option]}</span>
          </button>
        ))}
      </div>

      <div className="prep-practice-stats">
        <span className="prep-mode-chip">Reviewed this round: {sessionReviewedCount}</span>
        <span className="prep-mode-chip">Needs work this round: {sessionNeedsWorkCount}</span>
        <span className="prep-mode-chip">Saved weak cards: {filterCounts.needs_work}</span>
        {attentionChip}
      </div>

      <div className="prep-practice-card-container" aria-live="polite">
        {!isRevealed ? (
          <div className="prep-practice-flashcard">
            <h2 className="prep-practice-title">{currentEntry.kind === 'conditional' ? `${currentCard.title} follow-up` : currentCard.title}</h2>
            <div className="prep-practice-meta">
              <span className={`prep-category prep-category-${currentCard.category}`}>
                {currentCard.category}
              </span>
              {currentEntry.kind === 'conditional' && conditionalTone ? (
                <span className="prep-conditional-label prep-practice-tone">
                  {CONDITIONAL_TONE_LABELS[conditionalTone]}
                </span>
              ) : null}
            </div>
            {currentEntry.kind === 'conditional' && currentConditional ? (
              <>
                <p className="prep-practice-parent">After your main answer, handle this follow-up angle.</p>
                <div className={`prep-conditional-pair prep-conditional-${resolvedConditionalTone}`}>
                  <span className="prep-conditional-label">Interviewer push</span>
                  <p className="prep-practice-conditional-prompt">{currentConditional.trigger}</p>
                </div>
              </>
            ) : (
              <>
                {currentCard.tags.length > 0 ? (
                  <div className="prep-tags">
                    {currentCard.tags.map((tag) => (
                      <span key={tag} className="prep-tag">{tag}</span>
                    ))}
                  </div>
                ) : null}
                {revealMode === 'story' ? (
                  <div className="prep-practice-cues">
                    {currentKeyPoints.length > 0 ? (
                      <>
                        <div className="prep-practice-section-label">Recall cues</div>
                        <ul className="prep-practice-cue-list">
                          {currentKeyPoints.map((point, index) => (
                            <li key={`${index}:${point}`}>{point}</li>
                          ))}
                        </ul>
                      </>
                    ) : (
                      <p className="prep-practice-parent">Talk through the story before you reveal the coached structure.</p>
                    )}
                  </div>
                ) : null}
              </>
            )}
            <button
              className="prep-btn prep-btn-primary prep-practice-reveal"
              onClick={() => setIsRevealed(true)}
            >
              <Eye size={18} /> Reveal Answer
            </button>
            <div className="prep-practice-hint">
              Press Space to reveal · use 1 / 2 / 3 to score after reveal
            </div>
          </div>
        ) : (
          <div className="prep-practice-revealed">
            {revealMode === 'story' ? (
              <section className="prep-practice-section">
                <div className="prep-practice-section-label">Story blocks</div>
                <div className="prep-practice-story-grid">
                  {currentStoryBlocks.map((block, index) => (
                    <article key={`${index}:${block.label}:${block.text}`} className="prep-practice-story-card">
                      <div className="prep-practice-section-label">{block.label}</div>
                      <p>{block.text}</p>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {revealMode === 'key_points' ? (
              <section className="prep-practice-section">
                <div className="prep-practice-section-label">Key points</div>
                <ul className="prep-practice-cue-list prep-practice-answer-list">
                  {currentKeyPoints.map((point, index) => (
                    <li key={`${index}:${point}`}>{point}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            {revealMode === 'conditional' && currentConditional ? (
              <section className={`prep-conditional-pair prep-conditional-${resolvedConditionalTone}`}>
                <div className="prep-practice-section-label">How to answer</div>
                <div className="prep-conditional-pair-grid">
                  <div>
                    <span className="prep-conditional-label">Interviewer push</span>
                    <p className="prep-practice-conditional-copy">{currentConditional.trigger}</p>
                  </div>
                  <div>
                    <span className="prep-conditional-label">
                      {resolvedConditionalTone === 'trap' ? 'Reframe' : 'Response'}
                    </span>
                    <p className="prep-practice-conditional-copy">{currentConditional.response}</p>
                  </div>
                </div>
              </section>
            ) : null}

            {revealMode === 'fallback' ? (
              <PrepCardView card={currentCard} readOnly />
            ) : null}

            <div className="prep-practice-grade-panel">
              <div>
                <h3>How did that answer feel?</h3>
                <p>
                  Save the result and move to the next prompt.
                  {currentEntry.kind === 'card' && currentConditionals.length > 0
                    ? ' This card has follow-up drills queued next.'
                    : ' Cards marked needs work will come back later in the round.'}
                </p>
              </div>
              <div className="prep-practice-grade-actions">
                {(['nailed_it', 'okay', 'needs_work'] as PrepCardConfidence[]).map((confidence, index) => (
                  <button
                    key={confidence}
                    type="button"
                    className={`prep-btn ${confidence === 'needs_work' ? '' : 'prep-btn-primary'} prep-practice-grade prep-practice-grade-${confidence}`}
                    onClick={() => handleRecord(confidence)}
                  >
                    <span className="prep-practice-grade-key">{index + 1}</span>
                    {CONFIDENCE_LABELS[confidence]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
