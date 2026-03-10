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
import { GripVertical, Settings, Eye, EyeOff, X } from 'lucide-react'
import { useState, memo, useMemo, useCallback } from 'react'
import type { ComponentPriority, SkillGroup, SkillGroupVectorConfig, VectorDef, VectorSelection } from '../types'
import { ensureSkillGroupVectors } from '../utils/skillGroupVectors'
import { useSortableItem } from '../hooks/useSortableItem'

interface SkillGroupListProps {
  skillGroups: SkillGroup[]
  vectorDefs: VectorDef[]
  selectedVector: VectorSelection
  includedByKey: Record<string, boolean>
  onReorder: (nextOrder: string[]) => void
  onUpdate: (skillGroupId: string, field: 'label' | 'content', value: string) => void
  onUpdateVectors: (skillGroupId: string, vectors: Record<string, SkillGroupVectorConfig>) => void
  onToggleIncluded: (skillGroupId: string) => void
}

interface SortableSkillGroupCardProps {
  skillGroup: SkillGroup
  vectorDefs: VectorDef[]
  selectedVector: VectorSelection
  included: boolean
  onToggleIncluded: (id: string) => void
  onUpdate: (id: string, field: 'label' | 'content', value: string) => void
  onUpdateVectors: (id: string, vectors: Record<string, SkillGroupVectorConfig>) => void
}

function cyclePriority(current: ComponentPriority): ComponentPriority {
  return current === 'exclude' ? 'include' : 'exclude'
}

const SortableSkillGroupCard = memo(function SortableSkillGroupCard({
  skillGroup,
  vectorDefs,
  selectedVector: _selectedVector,
  included,
  onToggleIncluded,
  onUpdate,
  onUpdateVectors,
}: SortableSkillGroupCardProps) {
  const { setNodeRef, style, dragHandleProps, isDragging } = useSortableItem(skillGroup.id)
  const [showConfig, setShowConfig] = useState(false)
  const normalizedVectors = ensureSkillGroupVectors(skillGroup, vectorDefs)

  const handleMatrixDotClick = (vectorId: string) => {
    const config = normalizedVectors[vectorId]
    const next = cyclePriority(config.priority)
    onUpdateVectors(skillGroup.id, {
      ...normalizedVectors,
      [vectorId]: {
        ...config,
        priority: next,
      },
    })
  }

  const handleToggle = useCallback(() => {
    onToggleIncluded(skillGroup.id)
  }, [skillGroup.id, onToggleIncluded])

  const handleUpdateLabel = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate(skillGroup.id, 'label', e.target.value)
  }, [skillGroup.id, onUpdate])

  const handleUpdateContent = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onUpdate(skillGroup.id, 'content', e.target.value)
  }, [skillGroup.id, onUpdate])

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
            aria-label={`Reorder skill group ${skillGroup.label}`}
            {...dragHandleProps}
            aria-describedby="dnd-instructions-skills"
          >
            <GripVertical size={14} />
          </button>
          <h4>Skill Group</h4>
        </div>
        <div className="component-card-actions">
          <button 
            type="button" 
            className={`btn-ghost ${showConfig ? 'active' : ''}`}
            onClick={() => setShowConfig(!showConfig)}
            title="Vector-specific settings"
          >
            <Settings size={14} />
            Config
          </button>
          <button type="button" className="btn-ghost" aria-pressed={included} onClick={handleToggle}>
            {included ? <Eye size={14} /> : <EyeOff size={14} />}
            {included ? 'Included' : 'Excluded'}
          </button>
        </div>
      </header>

      <input
        className="component-input compact"
        aria-label="Skill group name"
        value={skillGroup.label}
        onChange={handleUpdateLabel}
      />
      <textarea
        className="component-input"
        aria-label="Default skill group content"
        value={skillGroup.content}
        onChange={handleUpdateContent}
      />

      {showConfig && (
        <div className="skill-vector-config-drawer">
          <header className="drawer-header">
            <h5>Vector Configurations</h5>
            <button type="button" className="btn-ghost btn-icon-only" onClick={() => setShowConfig(false)}>
              <X size={14} />
            </button>
          </header>
          <div className="skill-vector-grid">
            {vectorDefs.map((vector) => {
              const config = normalizedVectors[vector.id]
              return (
                <div className="skill-vector-card" key={vector.id}>
                  <div className="skill-vector-heading">
                    <span className="vector-dot" style={{ ['--vector-color' as string]: vector.color }} />
                    <strong>{vector.label}</strong>
                  </div>
                  <div className="skill-vector-fields">
                    <label className="field-label">
                      Order
                      <input
                        className="component-input compact"
                        type="number"
                        min={1}
                        value={config.order}
                        onChange={(event) => {
                          const nextOrder = Math.max(1, Number.parseInt(event.target.value || '1', 10) || 1)
                          onUpdateVectors(skillGroup.id, {
                            ...normalizedVectors,
                            [vector.id]: {
                              ...config,
                              order: nextOrder,
                            },
                          })
                        }}
                      />
                    </label>
                    <label className="field-label">
                      Content Override
                      <textarea
                        className="component-input compact"
                        placeholder={skillGroup.content}
                        value={config.content ?? ''}
                        onChange={(event) =>
                          onUpdateVectors(skillGroup.id, {
                            ...normalizedVectors,
                            [vector.id]: {
                              ...config,
                              content: event.target.value.trim().length > 0 ? event.target.value : undefined,
                            },
                          })
                        }
                      />
                    </label>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="bullet-footer-row">
        <div />
        <div className="vector-matrix">
          {vectorDefs.map((vector, idx) => {
            const config = normalizedVectors[vector.id]
            const p = config.priority
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

export const SkillGroupList = memo(function SkillGroupList({
  skillGroups,
  vectorDefs,
  selectedVector,
  includedByKey,
  onReorder,
  onUpdate,
  onUpdateVectors,
  onToggleIncluded,
}: SkillGroupListProps) {
  const skillIds = useMemo(() => skillGroups.map((skill) => skill.id), [skillGroups])
  const [announcement, setAnnouncement] = useState('')
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const getPosition = (id: string | number) => skillIds.indexOf(String(id)) + 1

  const handleDragStart = (event: { active: { id: string | number } }) => {
    setAnnouncement(`Picked up skill group ${getPosition(event.active.id)}.`)
  }

  const handleDragCancel = () => {
    setAnnouncement('Skill group move canceled.')
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) {
      return
    }

    const oldIndex = skillIds.indexOf(String(active.id))
    const newIndex = skillIds.indexOf(String(over.id))
    if (oldIndex === -1 || newIndex === -1) {
      return
    }
    onReorder(arrayMove(skillIds, oldIndex, newIndex))
    setAnnouncement(`Dropped skill group at position ${newIndex + 1}.`)
  }

  // Identity forwarding
  const handleUpdate = useCallback((id: string, field: 'label' | 'content', value: string) => onUpdate(id, field, value), [onUpdate])
  const handleUpdateVectors = useCallback((id: string, vectors: Record<string, SkillGroupVectorConfig>) => onUpdateVectors(id, vectors), [onUpdateVectors])
  const handleToggleIncluded = useCallback((id: string) => onToggleIncluded(id), [onToggleIncluded])

  return (
    <>
      <span id="dnd-instructions-skills" className="sr-only">
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
        <SortableContext items={skillIds} strategy={verticalListSortingStrategy}>
          <div className="library-grid">
            {skillGroups.map((skillGroup) => (
              <SortableSkillGroupCard
                key={skillGroup.id}
                skillGroup={skillGroup}
                vectorDefs={vectorDefs}
                selectedVector={selectedVector}
                included={includedByKey[skillGroup.id] ?? true}
                onToggleIncluded={handleToggleIncluded}
                onUpdate={handleUpdate}
                onUpdateVectors={handleUpdateVectors}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </>
  )
})
