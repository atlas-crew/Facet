import type { PrepCard } from '../../types/prep'
import { PrepCardView } from './PrepCardView'

interface PrepCardGridProps {
  cards: PrepCard[]
  onUpdateCard: (cardId: string, patch: Partial<PrepCard>) => void
  onDuplicateCard: (cardId: string) => void
  onRemoveCard: (cardId: string) => void
}

export function PrepCardGrid({
  cards,
  onUpdateCard,
  onDuplicateCard,
  onRemoveCard,
}: PrepCardGridProps) {
  return (
    <div className="prep-card-grid">
      {cards.map((card) => (
        <PrepCardView
          key={card.id}
          card={card}
          onUpdateCard={onUpdateCard}
          onDuplicateCard={onDuplicateCard}
          onRemoveCard={onRemoveCard}
        />
      ))}
    </div>
  )
}
