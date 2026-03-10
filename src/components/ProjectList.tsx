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
import { Eye, EyeOff, GripVertical, RotateCcw } from 'lucide-react'
import { useState, memo, useMemo } from 'react'
import type { ComponentPriority, PriorityByVector, ProjectComponent, VectorDef, VectorSelection } from '../types'
import { getPriorityForVector } from '../engine/assembler'
import { resolveDisplayText } from '../utils/resolveDisplayText'
import { useSortableItem } from '../hooks/useSortableItem'

interface ProjectListProps {
  projects: ProjectComponent[]
  vectorDefs: VectorDef[]
  selectedVector: VectorSelection
  includedByKey: Record<string, boolean>
  onReorder: (nextOrder: string[]) => void
  onUpdate: (projectId: string, field: 'name' | 'url' | 'text', value: string) => void
  onUpdateVectors: (projectId: string, vectors: PriorityByVector) => void
  onToggleIncluded: (projectId: string, vectors: PriorityByVector) => void
  onResetVariant?: (projectId: string) => void
}

interface SortableProjectCardProps {
  project: ProjectComponent
  vectorDefs: VectorDef[]
  selectedVector: VectorSelection
  included: boolean
  hasVariant: boolean
  onUpdate: (id: string, field: 'name' | 'url' | 'text', value: string) => void
  onUpdateVectors: (id: string, vectors: PriorityByVector) => void
  onToggleIncluded: (id: string, vectors: PriorityByVector) => void
  onResetVariant?: (id: string) => void
}

function cyclePriority(current: ComponentPriority): ComponentPriority {
  return current === 'exclude' ? 'include' : 'exclude'
}

const SortableProjectCard = memo(function SortableProjectCard({
  project,
  vectorDefs,
  selectedVector,
  included,
  hasVariant,
  onUpdate,
  onUpdateVectors,
  onToggleIncluded,
  onResetVariant,
}: SortableProjectCardProps) {
  const { setNodeRef, style, dragHandleProps, isDragging } = useSortableItem(project.id)

  const handleMatrixDotClick = (vectorId: string) => {
    const currentPriority = project.vectors[vectorId] ?? 'exclude'
    const next = cyclePriority(currentPriority)
    const nextVectors = { ...project.vectors }
    if (next === 'exclude') {
      delete nextVectors[vectorId]
    } else {
      nextVectors[vectorId] = next
    }
    onUpdateVectors(project.id, nextVectors)
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
            aria-label={`Reorder project ${project.name || project.id}`}
            {...dragHandleProps}
            aria-describedby="dnd-instructions-projects"
          >
            <GripVertical size={14} />
          </button>
          <h4>Project</h4>
          {hasVariant && <span className="variant-badge" title="Has vector-specific variant">V</span>}
        </div>
        <div className="component-card-actions">
          {hasVariant && onResetVariant && (
            <button
              type="button"
              className="btn-ghost"
              onClick={() => onResetVariant(project.id)}
              title="Reset to base text"
            >
              <RotateCcw size={14} />
              Reset
            </button>
          )}
          <button
            type="button"
            className="btn-ghost"
            aria-pressed={included}
            onClick={() => onToggleIncluded(project.id, project.vectors)}
            data-testid="project-toggle-included"
          >
            {included ? <Eye size={14} /> : <EyeOff size={14} />}
            {included ? 'Included' : 'Excluded'}
          </button>
        </div>
      </header>
      <input
        className="component-input compact"
        aria-label="Project name"
        value={project.name}
        onChange={(event) => onUpdate(project.id, 'name', event.target.value)}
      />
      <input
        className="component-input compact"
        aria-label="Project URL"
        value={project.url ?? ''}
        placeholder="URL"
        onChange={(event) => onUpdate(project.id, 'url', event.target.value)}
      />
      <textarea
        className="component-input"
        aria-label="Project description"
        value={resolveDisplayText(project.text, project.variants, selectedVector)}
        onChange={(event) => onUpdate(project.id, 'text', event.target.value)}
      />

      <div className="bullet-footer-row">
        <div />

        <div className="vector-matrix">
          {vectorDefs.map((vector, idx) => {
            const p = project.vectors[vector.id] ?? 'exclude'
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

export const ProjectList = memo(function ProjectList({
  projects,
  vectorDefs,
  selectedVector,
  includedByKey,
  onReorder,
  onUpdate,
  onUpdateVectors,
  onToggleIncluded,
  onResetVariant,
}: ProjectListProps) {
  const projectIds = useMemo(() => projects.map((project) => project.id), [projects])
  const [announcement, setAnnouncement] = useState('')
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const getPosition = (id: string | number) => projectIds.indexOf(String(id)) + 1

  const handleDragStart = (event: DragStartEvent) => {
    setAnnouncement(`Picked up project ${getPosition(event.active.id)}.`)
  }

  const handleDragCancel = () => {
    setAnnouncement('Project move canceled.')
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) {
      return
    }

    const oldIndex = projectIds.indexOf(String(active.id))
    const newIndex = projectIds.indexOf(String(over.id))
    if (oldIndex === -1 || newIndex === -1) {
      return
    }
    onReorder(arrayMove(projectIds, oldIndex, newIndex))
    setAnnouncement(`Dropped project at position ${newIndex + 1}.`)
  }

  return (
    <>
      <span id="dnd-instructions-projects" className="sr-only">
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
        <SortableContext items={projectIds} strategy={verticalListSortingStrategy}>
          <div className="library-grid">
            {projects.map((project) => {
              const key = `project:${project.id}`
              const included = includedByKey[key] ?? includedByKey[project.id] ?? getPriorityForVector(project.vectors, selectedVector) !== 'exclude'
              const hasVariant = selectedVector !== 'all' && Boolean(project.variants?.[selectedVector])
              return (
                <SortableProjectCard
                  key={project.id}
                  project={project}
                  vectorDefs={vectorDefs}
                  selectedVector={selectedVector}
                  included={included}
                  hasVariant={hasVariant}
                  onUpdate={onUpdate}
                  onUpdateVectors={onUpdateVectors}
                  onToggleIncluded={onToggleIncluded}
                  onResetVariant={onResetVariant}
                />
              )
            })}
          </div>
        </SortableContext>
      </DndContext>
    </>
  )
})
