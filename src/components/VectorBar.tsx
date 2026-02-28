import { Plus, RotateCcw, Target } from 'lucide-react'
import type { VectorDef, VectorSelection } from '../types'

interface VectorBarProps {
  vectors: VectorDef[]
  selectedVector: VectorSelection
  onSelect: (vector: VectorSelection) => void
  onAddVector: () => void
  onResetAuto: () => void
}

export function VectorBar({
  vectors,
  selectedVector,
  onSelect,
  onAddVector,
  onResetAuto,
}: VectorBarProps) {
  return (
    <div className="vector-bar">
      <div className="vector-pills">
        <button
          className={`vector-pill ${selectedVector === 'all' ? 'active' : ''}`}
          onClick={() => onSelect('all')}
          type="button"
          aria-pressed={selectedVector === 'all'}
        >
          All
        </button>
        {vectors.map((vector) => (
          <button
            className={`vector-pill ${selectedVector === vector.id ? 'active' : ''}`}
            style={{ ['--vector-color' as string]: vector.color }}
            key={vector.id}
            onClick={() => onSelect(vector.id)}
            type="button"
            aria-pressed={selectedVector === vector.id}
          >
            <Target size={14} />
            {vector.label}
          </button>
        ))}
      </div>
      <div className="vector-actions">
        <button className="vector-pill add-pill" onClick={onAddVector} type="button">
          <Plus size={14} />
          New Vector
        </button>
        <button className="btn-ghost" type="button" onClick={onResetAuto}>
          <RotateCcw size={14} />
          Reset to Auto
        </button>
      </div>
    </div>
  )
}
