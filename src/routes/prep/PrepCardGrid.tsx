import type { PrepCard } from '../../types/prep'
import { PrepCardView } from './PrepCardView'

interface PrepCardGridProps {
  cards: PrepCard[]
  onUpdateCard: (cardId: string, patch: Partial<PrepCard>) => void
  onDuplicateCard: (cardId: string) => void
  onRemoveCard: (cardId: string) => void
  layout?: 'responsive' | 'single'
}

export function PrepCardGrid({
  cards,
  onUpdateCard,
  onDuplicateCard,
  onRemoveCard,
  layout = 'responsive',
}: PrepCardGridProps) {
  return (
    <div className={`prep-card-grid ${layout === 'single' ? 'prep-card-grid-single' : ''}`}>
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
