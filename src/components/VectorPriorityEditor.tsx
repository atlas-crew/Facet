import type { ComponentPriority, PriorityByVector, VectorDef } from '../types'

interface VectorPriorityEditorProps {
  vectors: PriorityByVector
  vectorDefs: VectorDef[]
  onChange: (nextVectors: PriorityByVector) => void
}

const priorityOptions: Array<{ value: ComponentPriority; label: string }> = [
  { value: 'must', label: 'Must' },
  { value: 'strong', label: 'Strong' },
  { value: 'optional', label: 'Optional' },
  { value: 'exclude', label: 'Exclude' },
]

export function VectorPriorityEditor({ vectors, vectorDefs, onChange }: VectorPriorityEditorProps) {
  if (!vectorDefs.length) {
    return null
  }

  return (
    <fieldset className="vector-priority-editor">
      <legend className="vector-priority-title">Vector Priority</legend>
      <div className="vector-priority-grid">
        {vectorDefs.map((vector) => (
          <label className="vector-priority-row" key={vector.id}>
            <span className="vector-priority-label">
              <span className="vector-priority-dot" style={{ backgroundColor: vector.color }} aria-hidden />
              {vector.label}
            </span>
            <select
              className="component-input compact vector-priority-select"
              value={vectors[vector.id] ?? 'exclude'}
              onChange={(event) => {
                const nextPriority = event.target.value as ComponentPriority
                const nextVectors: PriorityByVector = { ...vectors }
                if (nextPriority === 'exclude') {
                  delete nextVectors[vector.id]
                } else {
                  nextVectors[vector.id] = nextPriority
                }
                onChange(nextVectors)
              }}
            >
              {priorityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
