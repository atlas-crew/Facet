import { Eye, EyeOff } from 'lucide-react'
import type { Priority, PriorityByVector, TextVariantMap, VectorDef, VectorSelection } from '../types'
import { getPriorityForVector } from '../engine/assembler'
import { VectorPriorityEditor } from './VectorPriorityEditor'

interface ComponentCardProps {
  title: string
  body: string
  vectors: PriorityByVector
  vectorDefs: VectorDef[]
  selectedVector: VectorSelection
  included: boolean
  variants?: TextVariantMap
  selectedVariant?: string
  onToggleIncluded: () => void
  onVariantChange?: (variant: string | null) => void
  onBodyChange: (value: string) => void
  onVectorsChange?: (nextVectors: PriorityByVector) => void
}

const priorityClassMap: Record<Priority, string> = {
  must: 'priority-must',
  strong: 'priority-strong',
  optional: 'priority-optional',
  exclude: 'priority-exclude',
}

export function ComponentCard({
  title,
  body,
  vectors,
  vectorDefs,
  selectedVector,
  included,
  variants,
  selectedVariant,
  onToggleIncluded,
  onVariantChange,
  onBodyChange,
  onVectorsChange,
}: ComponentCardProps) {
  const selectedPriority = getPriorityForVector(vectors, selectedVector)
  const variantEntries = Object.entries(variants ?? {})
  const showVariantPicker = variantEntries.length > 0 && onVariantChange

  return (
    <article className={`component-card ${included ? '' : 'dimmed'}`}>
      <header className="component-card-header">
        <h4>{title}</h4>
        <div className="component-card-actions">
          {selectedPriority !== 'exclude' ? (
            <span className={`priority-badge ${priorityClassMap[selectedPriority]}`}>
              {selectedPriority}
            </span>
          ) : null}
          <button type="button" className="btn-ghost" aria-pressed={included} onClick={onToggleIncluded}>
            {included ? <Eye size={14} /> : <EyeOff size={14} />}
            {included ? 'Included' : 'Excluded'}
          </button>
        </div>
      </header>

      <textarea
        aria-label={title}
        value={body}
        onChange={(event) => onBodyChange(event.target.value)}
        className="component-input"
      />

      {showVariantPicker ? (
        <label className="field-label variant-control">
          Variant
          <select
            className="component-input compact"
            value={selectedVariant ?? 'auto'}
            onChange={(event) => onVariantChange(event.target.value === 'auto' ? null : event.target.value)}
          >
            <option value="auto">Auto</option>
            <option value="default">Default</option>
            {variantEntries.map(([variantId]) => {
              const vector = vectorDefs.find((item) => item.id === variantId)
              return (
                <option key={variantId} value={variantId}>
                  {vector?.label ?? variantId}
                </option>
              )
            })}
          </select>
        </label>
      ) : null}

      {onVectorsChange ? (
        <VectorPriorityEditor vectors={vectors} vectorDefs={vectorDefs} onChange={onVectorsChange} />
      ) : null}

      <div className="vector-badges">
        {Object.entries(vectors)
          .filter(([, priority]) => priority !== 'exclude')
          .map(([vectorId]) => {
            const vector = vectorDefs.find((item) => item.id === vectorId)
            if (!vector) return null

            return (
              <span
                className="vector-badge"
                key={vector.id}
                style={{ ['--vector-color' as string]: vector.color }}
              >
                {vector.label}
              </span>
            )
          })}
      </div>
    </article>
  )
}
