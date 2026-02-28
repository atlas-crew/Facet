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
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { useState } from 'react'
import type { SkillGroup } from '../types'

interface SkillGroupListProps {
  skillGroups: SkillGroup[]
  onReorder: (nextOrder: string[]) => void
  onUpdate: (skillGroupId: string, field: 'label' | 'content', value: string) => void
}

interface SortableSkillGroupCardProps {
  skillGroup: SkillGroup
  onUpdate: (field: 'label' | 'content', value: string) => void
}

function SortableSkillGroupCard({ skillGroup, onUpdate }: SortableSkillGroupCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: skillGroup.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <article className="component-card" ref={setNodeRef} style={style}>
      <header className="component-card-header">
        <div className="bullet-title-row">
          <button
            className="drag-handle"
            type="button"
            aria-label="Reorder skill group"
            {...attributes}
            {...listeners}
          >
            <GripVertical size={14} />
          </button>
          <h4>Skill Group</h4>
        </div>
      </header>
      <input
        className="component-input compact"
        aria-label="Skill group name"
        value={skillGroup.label}
        onChange={(event) => onUpdate('label', event.target.value)}
      />
      <textarea
        className="component-input"
        aria-label="Skill group content"
        value={skillGroup.content}
        onChange={(event) => onUpdate('content', event.target.value)}
      />
    </article>
  )
}

export function SkillGroupList({ skillGroups, onReorder, onUpdate }: SkillGroupListProps) {
  const skillIds = skillGroups.map((skill) => skill.id)
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

  return (
    <>
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
                onUpdate={(field, value) => onUpdate(skillGroup.id, field, value)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </>
  )
}
