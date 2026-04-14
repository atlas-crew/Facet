import { useState, useEffect, useCallback, useRef } from 'react'
import { Shuffle, ChevronRight, ChevronLeft, Eye, X } from 'lucide-react'
import type { PrepCard } from '../../types/prep'
import { PrepCardView } from './PrepCardView'

interface PrepPracticeModeProps {
  cards: PrepCard[]
  onExit: () => void
}

function fisherYatesShuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function PrepPracticeMode({ cards, onExit }: PrepPracticeModeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [shuffledCards, setShuffledCards] = useState<PrepCard[]>(() => fisherYatesShuffle(cards))
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isRevealed, setIsRevealed] = useState(false)

  // Focus container on mount for accessibility
  useEffect(() => {
    containerRef.current?.focus()
  }, [])

  // Shuffle when manually requested
  const shuffleCards = useCallback(() => {
    setShuffledCards(fisherYatesShuffle(cards))
    setCurrentIndex(0)
    setIsRevealed(false)
  }, [cards])

  const handleNext = useCallback(() => {
    if (currentIndex < shuffledCards.length - 1) {
      setCurrentIndex((prev) => prev + 1)
      setIsRevealed(false)
    }
  }, [currentIndex, shuffledCards.length])

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1)
      setIsRevealed(false)
    }
  }, [currentIndex])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onExit()
      } else if (e.key === 'ArrowRight') {
        handleNext()
      } else if (e.key === 'ArrowLeft') {
        handlePrev()
      } else if ((e.key === ' ' || e.key === 'Enter') && !isRevealed) {
        const tag = (e.target as HTMLElement)?.tagName
        if (tag === 'BUTTON' || tag === 'A' || tag === 'INPUT') return
        // Prevent default scrolling for spacebar
        if (e.key === ' ') e.preventDefault()
        setIsRevealed(true)
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isRevealed, handleNext, handlePrev, onExit])

  if (shuffledCards.length === 0) {
    return (
      <div className="prep-practice-mode" ref={containerRef} tabIndex={-1} role="region" aria-label="Homework mode">
        <div className="prep-empty">
          <h2>No cards available</h2>
          <button className="prep-btn" onClick={onExit}>Back to Edit</button>
        </div>
      </div>
    )
  }

  const currentCard = shuffledCards[currentIndex]
  const isEnd = currentIndex === shuffledCards.length - 1

  return (
    <div className="prep-practice-mode" ref={containerRef} tabIndex={-1} role="region" aria-label="Homework mode">
      <div className="prep-practice-header">
        <div className="prep-practice-progress" role="status" aria-label={`Card ${currentIndex + 1} of ${shuffledCards.length}`}>
          Card {currentIndex + 1} of {shuffledCards.length}
        </div>
        <div className="prep-practice-actions">
          <button className="prep-btn" onClick={shuffleCards}>
            <Shuffle size={16} /> Shuffle
          </button>
          <button className="prep-btn" onClick={onExit}>
            <X size={16} /> Back to Edit
          </button>
        </div>
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
            {currentCard.tags.length > 0 && (
              <div className="prep-tags">
                {currentCard.tags.map((tag) => (
                  <span key={tag} className="prep-tag">{tag}</span>
                ))}
              </div>
            )}
            <button 
              className="prep-btn prep-btn-primary prep-practice-reveal" 
              onClick={() => setIsRevealed(true)}
            >
              <Eye size={18} /> Reveal Answer
            </button>
            <div className="prep-practice-hint">
              Press Space to reveal · ← → to navigate
            </div>
          </div>
        ) : (
          <div className="prep-practice-revealed">
            <PrepCardView
              card={currentCard}
              readOnly
            />
            
            {isEnd ? (
              <div className="prep-practice-complete">
                <h3>You've reviewed all {shuffledCards.length} cards.</h3>
                <p>Great job! Want to go again?</p>
                <button className="prep-btn prep-btn-primary" onClick={shuffleCards}>
                  <Shuffle size={16} /> Shuffle & Restart
                </button>
              </div>
            ) : (
              <div className="prep-practice-nav">
                <button 
                  className="prep-btn" 
                  onClick={handlePrev}
                  disabled={currentIndex === 0}
                  title={currentIndex === 0 ? "You're on the first card" : undefined}
                >
                  <ChevronLeft size={18} /> Previous
                </button>
                <button 
                  className="prep-btn prep-btn-primary" 
                  onClick={handleNext}
                  disabled={isEnd}
                  title={isEnd ? "You've reached the last card" : undefined}
                  style={{ marginLeft: 'var(--space-2)' }}
                >
                  Next Card <ChevronRight size={18} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
