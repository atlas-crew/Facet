import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Eye, Shuffle, X } from 'lucide-react'
import { PrepCardView } from './PrepCardView'
import type { PrepCard, PrepCardConfidence, PrepCardStudyState } from '../../types/prep'

interface PrepPracticeModeProps {
  cards: PrepCard[]
  studyProgress?: Record<string, PrepCardStudyState>
  onExit: () => void
  onRecordReview: (cardId: string, confidence: PrepCardConfidence) => void
}

type HomeworkFilter = 'all' | 'needs_work' | 'unreviewed'

const HOMEWORK_FILTER_LABELS: Record<HomeworkFilter, string> = {
  all: 'All cards',
  needs_work: 'Needs work',
  unreviewed: 'Unreviewed',
}

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

function selectCardsForFilter(
  cards: readonly PrepCard[],
  studyProgress: Record<string, PrepCardStudyState> | undefined,
  filter: HomeworkFilter,
): PrepCard[] {
  if (filter === 'all') return [...cards]
  if (filter === 'needs_work') {
    return cards.filter((card) => {
      const progress = studyProgress?.[card.id]
      return (progress?.needsWorkCount ?? 0) > 0 || progress?.confidence === 'needs_work'
    })
  }
  return cards.filter((card) => !studyProgress?.[card.id])
}

export function PrepPracticeMode({
  cards,
  studyProgress,
  onExit,
  onRecordReview,
}: PrepPracticeModeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [filter, setFilter] = useState<HomeworkFilter>('all')
  const [queue, setQueue] = useState<string[]>(() => fisherYatesShuffle(cards).map((card) => card.id))
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isRevealed, setIsRevealed] = useState(false)
  const [sessionReviewedCount, setSessionReviewedCount] = useState(0)
  const [sessionNeedsWorkCount, setSessionNeedsWorkCount] = useState(0)

  const filterCounts = useMemo(
    () => ({
      all: cards.length,
      needs_work: selectCardsForFilter(cards, studyProgress, 'needs_work').length,
      unreviewed: selectCardsForFilter(cards, studyProgress, 'unreviewed').length,
    }),
    [cards, studyProgress],
  )

  const rebuildQueue = useCallback(
    (nextFilter: HomeworkFilter) => {
      const nextCards = selectCardsForFilter(cards, studyProgress, nextFilter)
      setQueue(fisherYatesShuffle(nextCards).map((card) => card.id))
      setCurrentIndex(0)
      setIsRevealed(false)
      setSessionReviewedCount(0)
      setSessionNeedsWorkCount(0)
    },
    [cards, studyProgress],
  )

  useEffect(() => {
    containerRef.current?.focus()
  }, [])

  const cardsById = useMemo(
    () => new Map(cards.map((card) => [card.id, card])),
    [cards],
  )

  const currentCardId = queue[currentIndex] ?? null
  const currentCard = currentCardId ? cardsById.get(currentCardId) ?? null : null
  const isComplete = queue.length > 0 && currentIndex >= queue.length

  const handleShuffle = useCallback(() => {
    rebuildQueue(filter)
  }, [filter, rebuildQueue])

  const handleRecord = useCallback(
    (confidence: PrepCardConfidence) => {
      if (!currentCard) return

      onRecordReview(currentCard.id, confidence)
      setSessionReviewedCount((count) => count + 1)
      setSessionNeedsWorkCount((count) => count + (confidence === 'needs_work' ? 1 : 0))
      setQueue((currentQueue) => {
        if (confidence !== 'needs_work') return currentQueue
        const nextQueue = [...currentQueue]
        const insertAt = Math.min(nextQueue.length, currentIndex + 3)
        nextQueue.splice(insertAt, 0, currentCard.id)
        return nextQueue
      })
      setCurrentIndex((index) => index + 1)
      setIsRevealed(false)
    },
    [currentCard, currentIndex, onRecordReview],
  )

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onExit()
        return
      }

      if (!currentCard) return

      if (event.key === ' ' || event.key === 'Enter') {
        const tag = (event.target as HTMLElement | null)?.tagName
        if (tag === 'BUTTON' || tag === 'A' || tag === 'INPUT' || tag === 'TEXTAREA') return
        if (!isRevealed) {
          if (event.key === ' ') event.preventDefault()
          setIsRevealed(true)
        }
        return
      }

      if (!isRevealed) return

      const tag = (event.target as HTMLElement | null)?.tagName
      if (tag === 'BUTTON' || tag === 'A' || tag === 'INPUT' || tag === 'TEXTAREA') return

      if (event.key === '1') handleRecord('nailed_it')
      if (event.key === '2') handleRecord('okay')
      if (event.key === '3') handleRecord('needs_work')
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentCard, handleRecord, isRevealed, onExit])

  if (cards.length === 0) {
    return (
      <div className="prep-practice-mode" ref={containerRef} tabIndex={-1} role="region" aria-label="Homework mode">
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

        <div className="prep-practice-filter-row">
          {(Object.keys(HOMEWORK_FILTER_LABELS) as HomeworkFilter[]).map((option) => (
            <button
              key={option}
              type="button"
              className={`prep-pill ${filter === option ? 'prep-pill-active' : ''}`}
              onClick={() => {
                setFilter(option)
                rebuildQueue(option)
              }}
            >
              {HOMEWORK_FILTER_LABELS[option]}
              <span className="prep-practice-filter-count">{filterCounts[option]}</span>
            </button>
          ))}
        </div>

        <div className="prep-empty">
          <h2>No cards match this homework filter</h2>
          <p>Switch filters or go back to Edit to add more prompts before the next study round.</p>
          <div className="prep-empty-actions">
            <button
              className="prep-btn"
              onClick={() => {
                setFilter('all')
                rebuildQueue('all')
              }}
            >
              Show all cards
            </button>
            <button className="prep-btn" onClick={onExit}>Back to Edit</button>
          </div>
        </div>
      </div>
    )
  }

  if (isComplete || !currentCard) {
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

        <div className="prep-practice-stats" role="status" aria-label="Homework round summary">
          <span className="prep-mode-chip">Reviewed: {sessionReviewedCount}</span>
          <span className="prep-mode-chip">Marked needs work: {sessionNeedsWorkCount}</span>
          <span className="prep-mode-chip">Filter: {HOMEWORK_FILTER_LABELS[filter]}</span>
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
                onClick={() => {
                  setFilter('needs_work')
                  rebuildQueue('needs_work')
                }}
              >
                Study weak cards
              </button>
            ) : null}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="prep-practice-mode" ref={containerRef} tabIndex={-1} role="region" aria-label="Homework mode">
      <div className="prep-practice-header">
        <div>
          <div className="prep-practice-progress" role="status" aria-label={`Card ${currentIndex + 1} of ${queue.length}`}>
            Card {currentIndex + 1} of {queue.length}
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

      <div className="prep-practice-filter-row">
        {(Object.keys(HOMEWORK_FILTER_LABELS) as HomeworkFilter[]).map((option) => (
          <button
            key={option}
            type="button"
            className={`prep-pill ${filter === option ? 'prep-pill-active' : ''}`}
            onClick={() => {
              setFilter(option)
              rebuildQueue(option)
            }}
          >
            {HOMEWORK_FILTER_LABELS[option]}
            <span className="prep-practice-filter-count">{filterCounts[option]}</span>
          </button>
        ))}
      </div>

      <div className="prep-practice-stats">
        <span className="prep-mode-chip">Reviewed this round: {sessionReviewedCount}</span>
        <span className="prep-mode-chip">Needs work this round: {sessionNeedsWorkCount}</span>
        <span className="prep-mode-chip">Saved weak cards: {filterCounts.needs_work}</span>
      </div>

      <div className="prep-practice-card-container" aria-live="polite">
        {!isRevealed ? (
          <div className="prep-practice-flashcard">
            <h2 className="prep-practice-title">{currentCard.title}</h2>
            <div className="prep-practice-meta">
              <span className={`prep-category prep-category-${currentCard.category}`}>
                {currentCard.category}
              </span>
            </div>
            {currentCard.tags.length > 0 ? (
              <div className="prep-tags">
                {currentCard.tags.map((tag) => (
                  <span key={tag} className="prep-tag">{tag}</span>
                ))}
              </div>
            ) : null}
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
            <PrepCardView card={currentCard} readOnly />

            <div className="prep-practice-grade-panel">
              <div>
                <h3>How did that answer feel?</h3>
                <p>Save the result and move to the next prompt. Cards marked needs work will come back later in the round.</p>
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
