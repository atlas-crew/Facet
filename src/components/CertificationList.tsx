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
import type { CertificationComponent, ComponentPriority, PriorityByVector, VectorDef, VectorSelection } from '../types'
import { getPriorityForVector } from '../engine/assembler'
import { componentKeys } from '../utils/componentKeys'
import { useSortableItem } from '../hooks/useSortableItem'

interface CertificationListProps {
  certifications: CertificationComponent[]
  vectorDefs: VectorDef[]
  selectedVector: VectorSelection
  includedByKey: Record<string, boolean>
  onReorder: (nextOrder: string[]) => void
  onUpdate: (id: string, field: 'name' | 'issuer' | 'date' | 'credential_id' | 'url', value: string) => void
  onUpdateVectors: (id: string, vectors: PriorityByVector) => void
  onToggleIncluded: (id: string, vectors: PriorityByVector) => void
  onDelete: (id: string) => void
}

interface SortableCertificationCardProps {
  cert: CertificationComponent
  vectorDefs: VectorDef[]
  selectedVector: VectorSelection
  included: boolean
  onUpdate: (id: string, field: 'name' | 'issuer' | 'date' | 'credential_id' | 'url', value: string) => void
  onUpdateVectors: (id: string, vectors: PriorityByVector) => void
  onToggleIncluded: (id: string, vectors: PriorityByVector) => void
  onDelete: (id: string) => void
}

function cyclePriority(current: ComponentPriority): ComponentPriority {
  return current === 'exclude' ? 'include' : 'exclude'
}

const SortableCertificationCard = memo(function SortableCertificationCard({
  cert,
  vectorDefs,
  selectedVector: _selectedVector,
  included,
  onUpdate,
  onUpdateVectors,
  onToggleIncluded,
  onDelete,
}: SortableCertificationCardProps) {
  const { setNodeRef, style, dragHandleProps, isDragging } = useSortableItem(cert.id)

  const handleMatrixDotClick = (vectorId: string) => {
    const currentPriority = cert.vectors[vectorId] ?? 'exclude'
    const next = cyclePriority(currentPriority)
    const nextVectors = { ...cert.vectors }
    if (next === 'exclude') {
      delete nextVectors[vectorId]
    } else {
      nextVectors[vectorId] = next
    }
    onUpdateVectors(cert.id, nextVectors)
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
            aria-label={`Reorder certification ${cert.name || cert.id}`}
            {...dragHandleProps}
            aria-describedby="dnd-instructions-certifications"
          >
            <GripVertical size={14} />
          </button>
          <h4>Certification</h4>
        </div>
        <div className="component-card-actions">
          <button
            type="button"
            className="btn-ghost"
            aria-pressed={included}
            onClick={() => onToggleIncluded(cert.id, cert.vectors)}
          >
            {included ? <Eye size={14} /> : <EyeOff size={14} />}
            {included ? 'Included' : 'Excluded'}
          </button>
          <button
            type="button"
            className="btn-ghost btn-danger"
            onClick={() => onDelete(cert.id)}
            aria-label={`Delete certification ${cert.name || cert.id}`}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </header>
      <input
        className="component-input compact"
        aria-label="Certification name"
        value={cert.name}
        placeholder="Name"
        onChange={(event) => onUpdate(cert.id, 'name', event.target.value)}
      />
      <input
        className="component-input compact"
        aria-label="Issuer"
        value={cert.issuer}
        placeholder="Issuer"
        onChange={(event) => onUpdate(cert.id, 'issuer', event.target.value)}
      />
      <input
        className="component-input compact"
        aria-label="Date"
        value={cert.date ?? ''}
        placeholder="Date"
        onChange={(event) => onUpdate(cert.id, 'date', event.target.value)}
      />
      <input
        className="component-input compact"
        aria-label="Credential ID"
        value={cert.credential_id ?? ''}
        placeholder="Credential ID"
        onChange={(event) => onUpdate(cert.id, 'credential_id', event.target.value)}
      />
      <input
        className="component-input compact"
        aria-label="URL"
        value={cert.url ?? ''}
        placeholder="URL"
        onChange={(event) => onUpdate(cert.id, 'url', event.target.value)}
      />

      <div className="bullet-footer-row">
        <div />
        <div className="vector-matrix">
          {vectorDefs.map((vector, idx) => {
            const p = cert.vectors[vector.id] ?? 'exclude'
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

export const CertificationList = memo(function CertificationList({
  certifications,
  vectorDefs,
  selectedVector,
  includedByKey,
  onReorder,
  onUpdate,
  onUpdateVectors,
  onToggleIncluded,
  onDelete,
}: CertificationListProps) {
  const certIds = useMemo(() => certifications.map((c) => c.id), [certifications])
  const [announcement, setAnnouncement] = useState('')
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const getPosition = (id: string | number) => certIds.indexOf(String(id)) + 1

  const handleDragStart = (event: DragStartEvent) => {
    setAnnouncement(`Picked up certification ${getPosition(event.active.id)}.`)
  }

  const handleDragCancel = () => {
    setAnnouncement('Certification move canceled.')
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) {
      return
    }

    const oldIndex = certIds.indexOf(String(active.id))
    const newIndex = certIds.indexOf(String(over.id))
    if (oldIndex === -1 || newIndex === -1) {
      return
    }
    onReorder(arrayMove(certIds, oldIndex, newIndex))
    setAnnouncement(`Dropped certification at position ${newIndex + 1}.`)
  }

  return (
    <>
      <span id="dnd-instructions-certifications" className="sr-only">
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
        <SortableContext items={certIds} strategy={verticalListSortingStrategy}>
          <div className="library-grid">
            {certifications.map((cert) => {
              const key = componentKeys.certification(cert.id)
              const included = includedByKey[key] ?? getPriorityForVector(cert.vectors, selectedVector) !== 'exclude'
              return (
                <SortableCertificationCard
                  key={cert.id}
                  cert={cert}
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
