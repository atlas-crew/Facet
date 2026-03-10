import { Pencil, Plus, RotateCcw, Target, Trash2 } from 'lucide-react'
import type { VectorDef, VectorSelection } from '../types'
import { HelpHint } from './HelpHint'
import { useResumeStore } from '../store/resumeStore'
import { useUiStore } from '../store/uiStore'
import { usePipelineStore } from '../store/pipelineStore'
import { slugify } from '../utils/idUtils'

interface VectorBarProps {
  vectors: VectorDef[]
  selectedVector: VectorSelection
  onSelect: (vector: VectorSelection) => void
  onAddVector: () => void
  onResetAuto: () => void
}

export function VectorBar({
  vectors,
  selectedVector,
  onSelect,
  onAddVector,
  onResetAuto,
}: VectorBarProps) {
  const updateData = useResumeStore((state) => state.updateData)

  const handleRenameVector = () => {
    if (selectedVector === 'all') return

    const currentVector = vectors.find((vector) => vector.id === selectedVector)
    if (!currentVector) return

    const nextLabel = window.prompt('Rename vector', currentVector.label)?.trim()
    if (!nextLabel || nextLabel === currentVector.label) return

    const nextId = slugify(nextLabel)
    if (!nextId) {
      window.alert('Vector name must include at least one letter or number.')
      return
    }

    if (
      vectors.some(
        (vector) =>
          vector.id !== currentVector.id &&
          (vector.id === nextId || vector.label.toLowerCase() === nextLabel.toLowerCase()),
      )
    ) {
      window.alert('A vector with that name already exists.')
      return
    }

    updateData((current) => {
      const remapPriorityRecord = <
        T extends Record<string, unknown> | undefined,
      >(record: T): T => {
        if (!record || !(currentVector.id in record)) return record
        const nextRecord = { ...record }
        nextRecord[nextId] = nextRecord[currentVector.id]
        delete nextRecord[currentVector.id]
        return nextRecord as T
      }

      return {
        ...current,
        vectors: current.vectors.map((vector) =>
          vector.id === currentVector.id ? { ...vector, id: nextId, label: nextLabel } : vector,
        ),
        target_lines: current.target_lines.map((line) => ({
          ...line,
          vectors: remapPriorityRecord(line.vectors),
          variants: remapPriorityRecord(line.variants),
        })),
        profiles: current.profiles.map((profile) => ({
          ...profile,
          vectors: remapPriorityRecord(profile.vectors),
          variants: remapPriorityRecord(profile.variants),
        })),
        skill_groups: current.skill_groups.map((group) => ({
          ...group,
          vectors: remapPriorityRecord(group.vectors),
        })),
        roles: current.roles.map((role) => ({
          ...role,
          vectors: remapPriorityRecord(role.vectors),
          bullets: role.bullets.map((bullet) => ({
            ...bullet,
            vectors: remapPriorityRecord(bullet.vectors),
            variants: remapPriorityRecord(bullet.variants),
          })),
        })),
        projects: current.projects.map((project) => ({
          ...project,
          vectors: remapPriorityRecord(project.vectors),
          variants: remapPriorityRecord(project.variants),
        })),
        education: current.education.map((entry) => ({
          ...entry,
          vectors: remapPriorityRecord(entry.vectors),
        })),
        certifications: current.certifications.map((certification) => ({
          ...certification,
          vectors: remapPriorityRecord(certification.vectors),
        })),
        manualOverrides: remapPriorityRecord(current.manualOverrides),
        bulletOrders: remapPriorityRecord(current.bulletOrders),
        presets: (current.presets ?? []).map((preset) => ({
          ...preset,
          baseVector: preset.baseVector === currentVector.id ? nextId : preset.baseVector,
          overrides: {
            ...preset.overrides,
            priorityOverrides: preset.overrides.priorityOverrides?.map((override) =>
              override.vectorId === currentVector.id ? { ...override, vectorId: nextId } : override,
            ),
          },
        })),
      }
    })

    if (selectedVector === currentVector.id) {
      useUiStore.getState().setSelectedVector(nextId)
    }
    if (useUiStore.getState().comparisonVector === currentVector.id) {
      useUiStore.getState().setComparisonVector(nextId)
    }
    usePipelineStore.setState((state) => ({
      entries: state.entries.map((entry) =>
        entry.vectorId === currentVector.id ? { ...entry, vectorId: nextId } : entry,
      ),
    }))
  }

  const handleRemoveVector = () => {
    if (selectedVector === 'all') return

    const currentVector = vectors.find((vector) => vector.id === selectedVector)
    if (!currentVector) return

    const confirmed = window.confirm(
      `Delete "${currentVector.label}"? This removes vector-specific priorities, variants, presets, and pipeline links.`,
    )
    if (!confirmed) return

    updateData((current) => {
      const stripVector = <T extends Record<string, unknown> | undefined>(record: T): T => {
        if (!record || !(currentVector.id in record)) return record
        const nextRecord = { ...record }
        delete nextRecord[currentVector.id]
        return Object.keys(nextRecord).length > 0 ? (nextRecord as T) : (undefined as T)
      }

      return {
        ...current,
        vectors: current.vectors.filter((vector) => vector.id !== currentVector.id),
        target_lines: current.target_lines.map((line) => ({
          ...line,
          vectors: stripVector(line.vectors) ?? {},
          variants: stripVector(line.variants),
        })),
        profiles: current.profiles.map((profile) => ({
          ...profile,
          vectors: stripVector(profile.vectors) ?? {},
          variants: stripVector(profile.variants),
        })),
        skill_groups: current.skill_groups.map((group) => ({
          ...group,
          vectors: stripVector(group.vectors) ?? {},
        })),
        roles: current.roles.map((role) => ({
          ...role,
          vectors: stripVector(role.vectors) ?? {},
          bullets: role.bullets.map((bullet) => ({
            ...bullet,
            vectors: stripVector(bullet.vectors) ?? {},
            variants: stripVector(bullet.variants),
          })),
        })),
        projects: current.projects.map((project) => ({
          ...project,
          vectors: stripVector(project.vectors) ?? {},
          variants: stripVector(project.variants),
        })),
        education: current.education.map((entry) => ({
          ...entry,
          vectors: stripVector(entry.vectors) ?? {},
        })),
        certifications: current.certifications.map((certification) => ({
          ...certification,
          vectors: stripVector(certification.vectors) ?? {},
        })),
        manualOverrides: stripVector(current.manualOverrides),
        bulletOrders: stripVector(current.bulletOrders),
        presets: (current.presets ?? []).filter((preset) => preset.baseVector !== currentVector.id),
      }
    })

    if (selectedVector === currentVector.id) {
      useUiStore.getState().setSelectedVector('all')
    }
    if (useUiStore.getState().comparisonVector === currentVector.id) {
      useUiStore.getState().setComparisonVector(null)
    }
    usePipelineStore.setState((state) => ({
      entries: state.entries.map((entry) =>
        entry.vectorId === currentVector.id ? { ...entry, vectorId: null } : entry,
      ),
    }))
  }

  return (
    <div className="vector-bar" data-tour="vector-bar">
      <div className="vector-pills">
        <button
          className={`vector-pill ${selectedVector === 'all' ? 'active' : ''}`}
          onClick={() => onSelect('all')}
          type="button"
          aria-pressed={selectedVector === 'all'}
          title="All vectors (0)"
        >
          All
        </button>
        {vectors.map((vector, index) => (
          <button
            className={`vector-pill ${selectedVector === vector.id ? 'active' : ''}`}
            style={{ ['--vector-color' as string]: vector.color }}
            key={vector.id}
            onClick={() => onSelect(vector.id)}
            type="button"
            aria-pressed={selectedVector === vector.id}
            title={index < 9 ? `${vector.label} (${index + 1})` : vector.label}
          >
            <Target size={14} />
            {vector.label}
          </button>
        ))}
      </div>
      <div className="vector-actions">
        <HelpHint text="Vectors are positioning angles. Select one to assemble a resume tailored to that direction." placement="bottom" />
        <button className="vector-pill add-pill" onClick={onAddVector} type="button">
          <Plus size={14} />
          New Vector
        </button>
        <button
          className="btn-ghost"
          type="button"
          onClick={handleRenameVector}
          disabled={selectedVector === 'all'}
          title={selectedVector === 'all' ? 'Select a vector to rename it' : 'Rename selected vector'}
        >
          <Pencil size={14} />
          Rename
        </button>
        <button
          className="btn-ghost btn-danger-soft"
          type="button"
          onClick={handleRemoveVector}
          disabled={selectedVector === 'all'}
          title={selectedVector === 'all' ? 'Select a vector to remove it' : 'Delete selected vector'}
        >
          <Trash2 size={14} />
          Delete
        </button>
        <button className="btn-ghost" type="button" onClick={onResetAuto}>
          <RotateCcw size={14} />
          Reset to Auto
        </button>
      </div>
    </div>
  )
}
