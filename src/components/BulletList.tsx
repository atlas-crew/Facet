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
import { Eye, EyeOff, GripVertical } from 'lucide-react'
import { useState } from 'react'
import type { PriorityByVector, Role, TextVariantMap, VectorDef, VectorSelection } from '../types'
import { getPriorityForVector } from '../engine/assembler'
import { VectorPriorityEditor } from './VectorPriorityEditor'

interface BulletListProps {
  role: Role
  vectorDefs: VectorDef[]
  selectedVector: VectorSelection
  includedByBulletId: Record<string, boolean>
  variantByBulletId: Record<string, string | undefined>
  onToggleBullet: (bulletId: string) => void
  onReorder: (nextOrder: string[]) => void
  onChangeBulletText: (bulletId: string, text: string) => void
  onSetBulletVariant: (bulletId: string, variant: string | null) => void
  onSetBulletVectors: (bulletId: string, vectors: PriorityByVector) => void
}

interface SortableBulletProps {
  id: string
  text: string
  vectors: PriorityByVector
  priority: string
  included: boolean
  variants?: TextVariantMap
  selectedVariant?: string
  vectorDefs: VectorDef[]
  onToggle: () => void
  onChangeText: (value: string) => void
  onVariantChange: (variant: string | null) => void
  onVectorsChange: (vectors: PriorityByVector) => void
}

function SortableBullet({
  id,
  text,
  vectors,
  priority,
  included,
  variants,
  selectedVariant,
  vectorDefs,
  onToggle,
  onChangeText,
  onVariantChange,
  onVectorsChange,
}: SortableBulletProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id })
  const variantEntries = Object.entries(variants ?? {})
  const showVariantPicker = variantEntries.length > 0

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <article className={`component-card bullet-card ${included ? '' : 'dimmed'}`} ref={setNodeRef} style={style}>
      <header className="component-card-header">
        <div className="bullet-title-row">
          <button
            className="drag-handle"
            type="button"
            aria-label="Reorder bullet"
            {...attributes}
            {...listeners}
          >
            <GripVertical size={14} />
          </button>
          <h4>Bullet</h4>
        </div>
        <div className="component-card-actions">
          <span className={`priority-badge priority-${priority}`}>{priority}</span>
          <button type="button" className="btn-ghost" aria-pressed={included} onClick={onToggle}>
            {included ? <Eye size={14} /> : <EyeOff size={14} />}
            {included ? 'Included' : 'Excluded'}
          </button>
        </div>
      </header>
      <textarea
        value={text}
        className="component-input"
        aria-label="Bullet text"
        onChange={(event) => onChangeText(event.target.value)}
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
      <VectorPriorityEditor vectors={vectors} vectorDefs={vectorDefs} onChange={onVectorsChange} />
    </article>
  )
}

export function BulletList({
  role,
  vectorDefs,
  selectedVector,
  includedByBulletId,
  variantByBulletId,
  onToggleBullet,
  onReorder,
  onChangeBulletText,
  onSetBulletVariant,
  onSetBulletVectors,
}: BulletListProps) {
  const bulletIds = role.bullets.map((bullet) => bullet.id)
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
    onReorder(moved)
    setAnnouncement(`Dropped bullet at position ${newIndex + 1}.`)
  }

  return (
    <section className="role-block">
      <header className="role-header">
        <h3>
          {role.company} <span>{role.title}</span>
        </h3>
        <p>{role.dates}</p>
      </header>

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
            {role.bullets.map((bullet) => (
              <SortableBullet
                key={bullet.id}
                id={bullet.id}
                text={bullet.text}
                vectors={bullet.vectors}
                priority={getPriorityForVector(bullet.vectors, selectedVector)}
                included={includedByBulletId[bullet.id] ?? true}
                variants={bullet.variants}
                selectedVariant={variantByBulletId[bullet.id]}
                vectorDefs={vectorDefs}
                onToggle={() => onToggleBullet(bullet.id)}
                onChangeText={(value) => onChangeBulletText(bullet.id, value)}
                onVariantChange={(value) => onSetBulletVariant(bullet.id, value)}
                onVectorsChange={(vectors) => onSetBulletVectors(bullet.id, vectors)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="vector-badges">
        {vectorDefs.map((vector) => (
          <span
            className="vector-badge"
            key={vector.id}
            style={{ ['--vector-color' as string]: vector.color }}
          >
            {vector.label}
          </span>
        ))}
      </div>
    </section>
  )
}
