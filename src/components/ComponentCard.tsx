import { Eye, EyeOff, Check, X, Wand2, RotateCcw } from 'lucide-react'
import { memo, useCallback, useRef } from 'react'
import type { ComponentPriority, PriorityByVector, VectorDef, VectorSelection, ComponentSuggestion } from '../types'
import { highlightVariables } from '../utils/variableHighlighting'

interface ComponentCardProps {
  id: string
  title: string
  body: string
  vectors: PriorityByVector
  vectorDefs: VectorDef[]
  selectedVector: VectorSelection
  included: boolean
  hasVariant?: boolean
  onToggleIncluded: (id: string, vectors: PriorityByVector) => void
  onBodyChange: (id: string, value: string) => void
  onVectorsChange?: (id: string, nextVectors: PriorityByVector) => void
  onResetVariant?: (id: string) => void
  suggestion?: ComponentSuggestion
  onAcceptSuggestion?: (id: string, suggestion: ComponentSuggestion) => void
  onIgnoreSuggestion?: (id: string) => void
}

function cyclePriority(current: ComponentPriority): ComponentPriority {
  return current === 'exclude' ? 'include' : 'exclude'
}

export const ComponentCard = memo(function ComponentCard({
  id,
  title,
  body,
  vectors,
  vectorDefs,
  selectedVector: _selectedVector,
  included,
  hasVariant,
  onToggleIncluded,
  onBodyChange,
  onVectorsChange,
  onResetVariant,
  suggestion,
  onAcceptSuggestion,
  onIgnoreSuggestion,
}: ComponentCardProps) {
  const hasVariables = body.includes('{{')
  const overlayRef = useRef<HTMLDivElement>(null)

  const handleMatrixDotClick = (vectorId: string) => {
    if (!onVectorsChange) return
    const currentPriority = vectors[vectorId] ?? 'exclude'
    const next = cyclePriority(currentPriority)
    const nextVectors = { ...vectors }
    if (next === 'exclude') {
      delete nextVectors[vectorId]
    } else {
      nextVectors[vectorId] = next
    }
    onVectorsChange(id, nextVectors)
  }

  const handleToggle = useCallback(() => {
    onToggleIncluded(id, vectors)
  }, [id, vectors, onToggleIncluded])

  const handleBodyChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onBodyChange(id, e.target.value)
  }, [id, onBodyChange])

  return (
    <article className={`component-card ${included ? '' : 'dimmed'} ${suggestion ? 'has-suggestion' : ''}`}>
      <header className="component-card-header">
        <div className="bullet-title-row">
          <h4>{title}</h4>
          {hasVariant && <span className="variant-badge" title="Has vector-specific variant">V</span>}
        </div>
        <div className="component-card-actions">
          {hasVariant && onResetVariant && (
            <button
              type="button"
              className="btn-ghost"
              onClick={() => onResetVariant(id)}
              title="Reset to base text"
            >
              <RotateCcw size={14} />
              Reset
            </button>
          )}
          <button type="button" className="btn-ghost" aria-pressed={included} onClick={handleToggle}>
            {included ? <Eye size={14} /> : <EyeOff size={14} />}
            {included ? 'Included' : 'Excluded'}
          </button>
        </div>
      </header>

      <div className="component-input-wrapper">
        <textarea
          aria-label={title}
          value={body}
          onChange={handleBodyChange}
          className={`component-input ${hasVariables ? 'with-variables' : ''}`}
          onScroll={hasVariables ? (e) => {
            if (overlayRef.current) {
              overlayRef.current.scrollTop = e.currentTarget.scrollTop
              overlayRef.current.scrollLeft = e.currentTarget.scrollLeft
            }
          } : undefined}
        />
        {hasVariables && (
          <div className="variable-preview" ref={overlayRef} aria-hidden="true">
            {highlightVariables(body)}
          </div>
        )}
      </div>

      <div className="bullet-footer-row">
        <div />

        {onVectorsChange && (
          <div className="vector-matrix">
            {vectorDefs.map((vector, idx) => {
              const p = vectors[vector.id] ?? 'exclude'
              const isLastFew = idx >= vectorDefs.length - 2
              return (
                <button
                key={vector.id}
                type="button"
                className={`matrix-dot priority-${p} ${isLastFew ? 'tooltip-left' : ''}`}
                style={{ '--vector-color': vector.color } as React.CSSProperties}
                data-tooltip={`${vector.label}: ${p === 'include' ? 'included' : 'excluded'}`}
                onClick={() => handleMatrixDotClick(vector.id)}
                aria-label={`${vector.label}: ${p === 'include' ? 'included' : 'excluded'}`}
              />
            )
          })}
          </div>
        )}
      </div>

      {suggestion && (
        <div className="suggestion-overlay">
          <div className="suggestion-badge">
            <Wand2 size={12} /> AI Recommendation
          </div>
          <p className="suggestion-reason">{suggestion.reason}</p>
          <div className="suggestion-action-row">
            <div className={`suggestion-preview priority-${suggestion.recommendedPriority}`}>
              Change to {suggestion.recommendedPriority === 'include' ? 'Include' : 'Exclude'}
            </div>
            <div className="suggestion-buttons">
              <button
                className="btn-secondary btn-xs"
                onClick={() => onIgnoreSuggestion?.(id)}
                title="Ignore suggestion"
              >
                <X size={12} />
              </button>
              <button
                className="btn-primary btn-xs"
                onClick={() => onAcceptSuggestion?.(id, suggestion)}
                title="Accept suggestion"
              >
                <Check size={12} />
                Accept
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  )
})
