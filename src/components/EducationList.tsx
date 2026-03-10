import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { Eye, EyeOff, GripVertical, Trash2 } from 'lucide-react'
import { useState, memo, useMemo } from 'react'
import type { ComponentPriority, EducationEntry, PriorityByVector, VectorDef, VectorSelection } from '../types'
import { getPriorityForVector } from '../engine/assembler'
import { componentKeys } from '../utils/componentKeys'
import { useSortableItem } from '../hooks/useSortableItem'

interface EducationListProps {
  education: EducationEntry[]
  vectorDefs: VectorDef[]
  selectedVector: VectorSelection
  includedByKey: Record<string, boolean>
  onReorder: (nextOrder: string[]) => void
  onUpdate: (id: string, field: 'school' | 'location' | 'degree' | 'year', value: string) => void
  onUpdateVectors: (id: string, vectors: PriorityByVector) => void
  onToggleIncluded: (id: string, vectors: PriorityByVector) => void
  onDelete: (id: string) => void
}

interface SortableEducationCardProps {
  entry: EducationEntry
  vectorDefs: VectorDef[]
  selectedVector: VectorSelection
  included: boolean
  onUpdate: (id: string, field: 'school' | 'location' | 'degree' | 'year', value: string) => void
  onUpdateVectors: (id: string, vectors: PriorityByVector) => void
  onToggleIncluded: (id: string, vectors: PriorityByVector) => void
  onDelete: (id: string) => void
}

function cyclePriority(current: ComponentPriority): ComponentPriority {
  return current === 'exclude' ? 'include' : 'exclude'
}

const SortableEducationCard = memo(function SortableEducationCard({
  entry,
  vectorDefs,
  selectedVector: _selectedVector,
  included,
  onUpdate,
  onUpdateVectors,
  onToggleIncluded,
  onDelete,
}: SortableEducationCardProps) {
  const { setNodeRef, style, dragHandleProps, isDragging } = useSortableItem(entry.id)

  const handleMatrixDotClick = (vectorId: string) => {
    const currentPriority = entry.vectors[vectorId] ?? 'exclude'
    const next = cyclePriority(currentPriority)
    const nextVectors = { ...entry.vectors }
    if (next === 'exclude') {
      delete nextVectors[vectorId]
    } else {
      nextVectors[vectorId] = next
    }
    onUpdateVectors(entry.id, nextVectors)
  }

  return (
    <article
      className={`component-card bullet-card ${included ? '' : 'dimmed'} ${isDragging ? 'dragging' : ''}`}
      ref={setNodeRef}
      style={style}
    >
      <header className="component-card-header">
        <div className="bullet-title-row">
          <button
            className="drag-handle"
            type="button"
            aria-label={`Reorder education ${entry.school || entry.id}`}
            {...dragHandleProps}
            aria-describedby="dnd-instructions-education"
          >
            <GripVertical size={14} />
          </button>
          <h4>Education</h4>
        </div>
        <div className="component-card-actions">
          <button
            type="button"
            className="btn-ghost"
            aria-pressed={included}
            onClick={() => onToggleIncluded(entry.id, entry.vectors)}
          >
            {included ? <Eye size={14} /> : <EyeOff size={14} />}
            {included ? 'Included' : 'Excluded'}
          </button>
          <button
            type="button"
            className="btn-ghost btn-danger"
            onClick={() => onDelete(entry.id)}
            aria-label={`Delete education ${entry.school || entry.id}`}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </header>
      <input
        className="component-input compact"
        aria-label="School"
        value={entry.school}
        placeholder="School"
        onChange={(event) => onUpdate(entry.id, 'school', event.target.value)}
      />
      <input
        className="component-input compact"
        aria-label="Location"
        value={entry.location}
        placeholder="Location"
        onChange={(event) => onUpdate(entry.id, 'location', event.target.value)}
      />
      <input
        className="component-input compact"
        aria-label="Degree"
        value={entry.degree}
        placeholder="Degree"
        onChange={(event) => onUpdate(entry.id, 'degree', event.target.value)}
      />
      <input
        className="component-input compact"
        aria-label="Year"
        value={entry.year ?? ''}
        placeholder="Year"
        onChange={(event) => onUpdate(entry.id, 'year', event.target.value)}
      />

      <div className="bullet-footer-row">
        <div />
        <div className="vector-matrix">
          {vectorDefs.map((vector, idx) => {
            const p = entry.vectors[vector.id] ?? 'exclude'
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
    </article>
  )
})

export const EducationList = memo(function EducationList({
  education,
  vectorDefs,
  selectedVector,
  includedByKey,
  onReorder,
  onUpdate,
  onUpdateVectors,
  onToggleIncluded,
  onDelete,
}: EducationListProps) {
  const educationIds = useMemo(() => education.map((e) => e.id), [education])
  const [announcement, setAnnouncement] = useState('')
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const getPosition = (id: string | number) => educationIds.indexOf(String(id)) + 1

  const handleDragStart = (event: DragStartEvent) => {
    setAnnouncement(`Picked up education ${getPosition(event.active.id)}.`)
  }

  const handleDragCancel = () => {
    setAnnouncement('Education move canceled.')
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) {
      return
    }

    const oldIndex = educationIds.indexOf(String(active.id))
    const newIndex = educationIds.indexOf(String(over.id))
    if (oldIndex === -1 || newIndex === -1) {
      return
    }
    onReorder(arrayMove(educationIds, oldIndex, newIndex))
    setAnnouncement(`Dropped education at position ${newIndex + 1}.`)
  }

  return (
    <>
      <span id="dnd-instructions-education" className="sr-only">
        To reorder, press Space or Enter to lift, use Arrow keys to move, and Space or Enter to drop. Press Escape to cancel.
      </span>

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
        <SortableContext items={educationIds} strategy={verticalListSortingStrategy}>
          <div className="library-grid">
            {education.map((entry) => {
              const key = componentKeys.education(entry.id)
              const included = includedByKey[key] ?? getPriorityForVector(entry.vectors, selectedVector) !== 'exclude'
              return (
                <SortableEducationCard
                  key={entry.id}
                  entry={entry}
                  vectorDefs={vectorDefs}
                  selectedVector={selectedVector}
                  included={included}
                  onUpdate={onUpdate}
                  onUpdateVectors={onUpdateVectors}
                  onToggleIncluded={onToggleIncluded}
                  onDelete={onDelete}
                />
              )
            })}
          </div>
        </SortableContext>
      </DndContext>
    </>
  )
})
