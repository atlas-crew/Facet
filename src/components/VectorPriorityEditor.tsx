import type { PriorityByVector, VectorDef } from '../types'

interface VectorPriorityEditorProps {
  vectors: PriorityByVector
  vectorDefs: VectorDef[]
  onChange: (nextVectors: PriorityByVector) => void
}

export function VectorPriorityEditor({ vectors, vectorDefs, onChange }: VectorPriorityEditorProps) {
  if (!vectorDefs.length) {
    return null
  }

  return (
    <fieldset className="vector-priority-editor">
      <legend className="vector-priority-title">Vector Inclusion</legend>
      <div className="vector-priority-grid">
        {vectorDefs.map((vector) => (
          <label className="vector-priority-row" key={vector.id}>
            <span className="vector-priority-label">
              <span className="vector-priority-dot" style={{ backgroundColor: vector.color }} aria-hidden />
              {vector.label}
            </span>
            <input
              type="checkbox"
              className="vector-priority-checkbox"
              checked={(vectors[vector.id] ?? 'exclude') === 'include'}
              onChange={(event) => {
                const nextVectors: PriorityByVector = { ...vectors }
                if (event.target.checked) {
                  nextVectors[vector.id] = 'include'
                } else {
                  delete nextVectors[vector.id]
                }
                onChange(nextVectors)
              }}
              aria-label={`${vector.label} included`}
            />
          </label>
        ))}
      </div>
    </fieldset>
  )
}
