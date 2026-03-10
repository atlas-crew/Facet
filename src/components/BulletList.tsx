import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { ChevronRight, Eye, EyeOff, GripVertical, RotateCcw, Sparkles, X, Check, Wand2 } from 'lucide-react'
import { useState, memo, useMemo, useCallback, useRef } from 'react'
import type { ComponentPriority, PriorityByVector, Role, VectorDef, VectorSelection, ComponentSuggestion } from '../types'
import { getPriorityForVector } from '../engine/assembler'
import { resolveDisplayText } from '../utils/resolveDisplayText'
import { useSortableItem } from '../hooks/useSortableItem'
import { highlightVariables } from '../utils/variableHighlighting'

interface BulletListProps {
  role: Role
  vectorDefs: VectorDef[]
  selectedVector: VectorSelection
  customOrderLabel?: string
  canResetOrder: boolean
  onResetOrder: (roleId: string) => void
  includedByKey: Record<string, boolean>
  onToggleBullet: (roleId: string, bulletId: string, vectors: PriorityByVector) => void
  onReorder: (roleId: string, nextOrder: string[]) => void
  onChangeBulletText: (roleId: string, bulletId: string, text: string) => void
  onChangeBulletLabel: (roleId: string, bulletId: string, label: string) => void
  onSetBulletVectors: (roleId: string, bulletId: string, vectors: PriorityByVector) => void
  onUpdateRole: (roleId: string, field: 'company' | 'title' | 'dates' | 'location' | 'subtitle', value: string | null) => void
  onReframe: (roleId: string, bulletId: string) => void
  onResetBulletVariant?: (roleId: string, bulletId: string) => void
  reframeLoadingId: string | null
  aiEnabled: boolean
  suggestions?: Record<string, ComponentSuggestion>
  onAcceptSuggestion?: (roleId: string, bulletId: string, suggestion: ComponentSuggestion) => void
  onIgnoreSuggestion?: (roleId: string, bulletId: string) => void
}

interface SortableBulletProps {
  id: string
  label?: string
  text: string
  vectors: PriorityByVector
  included: boolean
  hasVariant: boolean
  vectorDefs: VectorDef[]
  selectedVector: VectorSelection
  onToggle: (id: string, vectors: PriorityByVector) => void
  onChangeText: (id: string, value: string) => void
  onLabelChange: (id: string, value: string) => void
  onVectorsChange: (id: string, vectors: PriorityByVector) => void
  onReframe: (id: string) => void
  onResetVariant?: (id: string) => void
  isLoading: boolean
  aiEnabled: boolean
  suggestion?: ComponentSuggestion
  onAcceptSuggestion?: (id: string, suggestion: ComponentSuggestion) => void
  onIgnoreSuggestion?: (id: string) => void
}

function cyclePriority(current: ComponentPriority): ComponentPriority {
  return current === 'exclude' ? 'include' : 'exclude'
}

const SortableBullet = memo(function SortableBullet({
  id,
  label,
  text,
  vectors,
  included,
  hasVariant,
  vectorDefs,
  selectedVector,
  onToggle,
  onChangeText,
  onLabelChange,
  onVectorsChange,
  onReframe,
  onResetVariant,
  isLoading,
  aiEnabled,
  suggestion,
  onAcceptSuggestion,
  onIgnoreSuggestion,
}: SortableBulletProps) {
  const { setNodeRef, style, dragHandleProps, isDragging } = useSortableItem(id)
  const hasVariables = text.includes('{{')
  const overlayRef = useRef<HTMLDivElement>(null)

  const handleMatrixDotClick = (vectorId: string) => {
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

  const handleAccept = useCallback(() => {
    if (suggestion) onAcceptSuggestion?.(id, suggestion)
  }, [id, suggestion, onAcceptSuggestion])

  return (
    <article
      className={`component-card bullet-card ${included ? '' : 'dimmed'} ${isDragging ? 'dragging' : ''} ${suggestion ? 'has-suggestion' : ''}`}
      ref={setNodeRef}
      style={style}
    >
      <header className="component-card-header">
        <div className="bullet-title-row">
          <button
            className="drag-handle"
            type="button"
            aria-label="Reorder bullet"
            {...dragHandleProps}
            aria-describedby="dnd-instructions-global"
          >
            <GripVertical size={14} />
          </button>
          <h4>Bullet</h4>
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
          {selectedVector !== 'all' && (
            <button
              type="button"
              className="btn-ghost"
              onClick={() => onReframe(id)}
              disabled={!aiEnabled || isLoading}
              title={aiEnabled ? 'AI Reframe for Vector' : 'Configure AI proxy to enable reframing'}
              aria-busy={isLoading}
            >
              <span className="btn-label">
                {isLoading ? 'Reframing...' : 'Reframe'}
              </span>
              <Sparkles size={14} className={isLoading ? 'animate-pulse' : ''} />
            </button>
          )}
          <button type="button" className="btn-ghost" aria-pressed={included} onClick={() => onToggle(id, vectors)}>
            {included ? <Eye size={14} /> : <EyeOff size={14} />}
            {included ? 'Included' : 'Excluded'}
          </button>
        </div>
      </header>

      <div className="component-input-wrapper">
        <textarea
          value={text}
          className={`component-input ${hasVariables ? 'with-variables' : ''}`}
          aria-label="Bullet text"
          onChange={(event) => onChangeText(id, event.target.value)}
          onScroll={hasVariables ? (e) => {
            if (overlayRef.current) {
              overlayRef.current.scrollTop = e.currentTarget.scrollTop
              overlayRef.current.scrollLeft = e.currentTarget.scrollLeft
            }
          } : undefined}
        />
        {hasVariables && (
          <div className="variable-preview" ref={overlayRef} aria-hidden="true">
            {highlightVariables(text)}
          </div>
        )}
      </div>

      <label className="field-label bullet-label-field">
        Bullet Label
        <input
          className="component-input compact"
          placeholder="optional (e.g. 'Project Highlight')"
          value={label ?? ''}
          onChange={(event) => onLabelChange(id, event.target.value)}
        />
      </label>

      <div className="bullet-footer-row">
        <div />

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
                onClick={handleAccept}
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

export function BulletList({
  role,
  vectorDefs,
  selectedVector,
  customOrderLabel,
  canResetOrder,
  onResetOrder,
  includedByKey,
  onToggleBullet,
  onReorder,
  onChangeBulletText,
  onChangeBulletLabel,
  onSetBulletVectors,
  onUpdateRole,
  onReframe,
  onResetBulletVariant,
  reframeLoadingId,
  aiEnabled,
  suggestions = {},
  onAcceptSuggestion,
  onIgnoreSuggestion,
}: BulletListProps) {
  const bulletIds = useMemo(() => role.bullets.map((bullet) => bullet.id), [role.bullets])
  const [expanded, setExpanded] = useState(true)
  const [announcement, setAnnouncement] = useState('')
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const getPosition = (id: string | number) => bulletIds.indexOf(String(id)) + 1

  const handleDragStart = (event: { active: { id: string | number } }) => {
    setAnnouncement(`Picked up bullet ${getPosition(event.active.id)}.`)
  }

  const handleDragCancel = () => {
    setAnnouncement('Bullet move canceled.')
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) {
      return
    }

    const oldIndex = bulletIds.indexOf(String(active.id))
    const newIndex = bulletIds.indexOf(String(over.id))
    if (oldIndex === -1 || newIndex === -1) {
      return
    }
    const moved = arrayMove(bulletIds, oldIndex, newIndex)
    onReorder(role.id, moved)
    setAnnouncement(`Dropped bullet at position ${newIndex + 1}.`)
  }

  // Memoized handlers that bake in role.id
  const handleToggle = useCallback((bulletId: string, vectors: PriorityByVector) => onToggleBullet(role.id, bulletId, vectors), [onToggleBullet, role.id])
  const handleChangeText = useCallback((bulletId: string, text: string) => onChangeBulletText(role.id, bulletId, text), [onChangeBulletText, role.id])
  const handleLabelChange = useCallback((bulletId: string, label: string) => onChangeBulletLabel(role.id, bulletId, label), [onChangeBulletLabel, role.id])
  const handleVectorsChange = useCallback((bulletId: string, vectors: PriorityByVector) => onSetBulletVectors(role.id, bulletId, vectors), [onSetBulletVectors, role.id])
  const handleReframeBound = useCallback((bulletId: string) => onReframe(role.id, bulletId), [onReframe, role.id])
  const handleResetVariant = useCallback((bulletId: string) => onResetBulletVariant?.(role.id, bulletId), [onResetBulletVariant, role.id])
  const handleAccept = useCallback((bulletId: string, suggestion: ComponentSuggestion) => onAcceptSuggestion?.(role.id, bulletId, suggestion), [onAcceptSuggestion, role.id])
  const handleIgnore = useCallback((bulletId: string) => onIgnoreSuggestion?.(role.id, bulletId), [onIgnoreSuggestion, role.id])

  const collapseId = `role-collapse-${role.id}`

  return (
    <section className="role-block">
      <header className="role-header">
        <button
          className={`role-collapse-toggle ${expanded ? 'expanded' : ''}`}
          type="button"
          aria-expanded={expanded}
          aria-controls={collapseId}
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? 'Collapse role' : 'Expand role'}
        >
          <ChevronRight size={14} />
        </button>
        <div className="role-header-main">
          <div className="role-fields">
            <label className="field-label">
              Company
              <input
                className="component-input compact"
                value={role.company}
                onChange={(event) => onUpdateRole(role.id, 'company', event.target.value)}
              />
            </label>
            <label className="field-label">
              Title
              <input
                className="component-input compact"
                value={role.title}
                onChange={(event) => onUpdateRole(role.id, 'title', event.target.value)}
              />
            </label>
            <label className="field-label">
              Dates
              <input
                className="component-input compact"
                value={role.dates}
                onChange={(event) => onUpdateRole(role.id, 'dates', event.target.value)}
              />
            </label>
            {role.location != null ? (
              <label className="field-label optional-field">
                Location
                <div className="optional-field-row">
                  <input
                    className="component-input compact"
                    value={role.location}
                    onChange={(event) => onUpdateRole(role.id, 'location', event.target.value)}
                  />
                  <button
                    type="button"
                    className="btn-ghost btn-icon"
                    onClick={() => onUpdateRole(role.id, 'location', null)}
                    aria-label="Remove location"
                  >
                    <X size={14} />
                  </button>
                </div>
              </label>
            ) : (
              <button
                type="button"
                className="btn-ghost btn-add-optional"
                onClick={() => onUpdateRole(role.id, 'location', '')}
              >
                <span>+ Location</span>
              </button>
            )}
            {role.subtitle != null ? (
              <label className="field-label optional-field">
                Subtitle
                <div className="optional-field-row">
                  <input
                    className="component-input compact"
                    value={role.subtitle}
                    onChange={(event) => onUpdateRole(role.id, 'subtitle', event.target.value)}
                  />
                  <button
                    type="button"
                    className="btn-ghost btn-icon"
                    onClick={() => onUpdateRole(role.id, 'subtitle', null)}
                    aria-label="Remove subtitle"
                  >
                    <X size={14} />
                  </button>
                </div>
              </label>
            ) : (
              <button
                type="button"
                className="btn-ghost btn-add-optional"
                onClick={() => onUpdateRole(role.id, 'subtitle', '')}
              >
                <span>+ Subtitle</span>
              </button>
            )}
          </div>
          {customOrderLabel ? <span className="custom-order-badge">{customOrderLabel}</span> : null}
        </div>
        <div className="role-header-actions">
          <button
            type="button"
            className="btn-ghost"
            disabled={!canResetOrder}
            onClick={() => onResetOrder(role.id)}
          >
            Reset Order
          </button>
        </div>
      </header>

      <div
        className={`role-collapse ${expanded ? 'expanded' : ''}`}
        id={collapseId}
        aria-hidden={!expanded}
      >
        <div className="role-collapse-panel">
          <p className="sr-only" aria-live="polite" aria-atomic="true">
            {announcement}
          </p>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragCancel={handleDragCancel}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={bulletIds} strategy={verticalListSortingStrategy}>
              <div className="bullet-list">
                {role.bullets.map((bullet) => {
                  const key = `role:${role.id}:bullet:${bullet.id}`
                  const autoIncluded = getPriorityForVector(bullet.vectors, selectedVector) !== 'exclude'
                  const included = includedByKey[key] ?? includedByKey[`role:${role.id}:${bullet.id}`] ?? includedByKey[`bullet:${bullet.id}`] ?? includedByKey[bullet.id] ?? autoIncluded
                  const hasVariant = selectedVector !== 'all' && Boolean(bullet.variants?.[selectedVector])

                  return (
                    <SortableBullet
                      key={bullet.id}
                      id={bullet.id}
                      label={bullet.label}
                      text={resolveDisplayText(bullet.text, bullet.variants, selectedVector)}
                      vectors={bullet.vectors}
                      included={included}
                      hasVariant={hasVariant}
                      vectorDefs={vectorDefs}
                      selectedVector={selectedVector}
                      onToggle={handleToggle}
                      onChangeText={handleChangeText}
                      onLabelChange={handleLabelChange}
                      onVectorsChange={handleVectorsChange}
                      onReframe={handleReframeBound}
                      onResetVariant={handleResetVariant}
                      isLoading={reframeLoadingId === bullet.id}
                      aiEnabled={aiEnabled}
                      suggestion={suggestions[bullet.id]}
                      onAcceptSuggestion={handleAccept}
                      onIgnoreSuggestion={handleIgnore}
                    />
                  )
                })}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      </div>
    </section>
  )
}
