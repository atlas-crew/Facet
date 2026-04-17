import { useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { PrepLiveMode } from './PrepLiveMode'
import { usePrepStore } from '../../store/prepStore'
import './prep.css'

export function PrepLivePage() {
  const navigate = useNavigate()
  const decks = usePrepStore((state) => state.decks)
  const activeDeckId = usePrepStore((state) => state.activeDeckId)

  const activeDeck = useMemo(
    () => decks.find((deck) => deck.id === activeDeckId) ?? null,
    [decks, activeDeckId],
  )

  if (!activeDeck || activeDeck.cards.length === 0) {
    return (
      <div className="prep-live-page prep-live-page-empty">
        <div className="prep-empty">
          <h2>No prep deck ready</h2>
          <p>Go back to Prep and generate or select a deck with cards before opening the live cheatsheet.</p>
          <div className="prep-empty-actions">
            <button
              className="prep-btn prep-btn-primary"
              onClick={() => void navigate({ to: '/prep', search: { vector: '', skills: '', q: '' } })}
            >
              <ArrowLeft size={16} />
              Back to Prep
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="prep-live-page">
      <PrepLiveMode
        deck={activeDeck}
        onBack={() => void navigate({ to: '/prep', search: { vector: '', skills: '', q: '' } })}
      />
    </div>
  )
}
