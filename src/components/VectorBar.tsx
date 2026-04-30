import { useMemo, type CSSProperties } from 'react'
import { List, Pencil, Plus, RotateCcw, Target, Trash2 } from 'lucide-react'
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
  onResetOverrides: () => void
}

const vectorColorStyle = (color: string): CSSProperties =>
  ({ '--vector-color': color } as CSSProperties)

export function VectorBar({
  vectors,
  selectedVector,
  onSelect,
  onAddVector,
  onResetOverrides,
}: VectorBarProps) {
  const updateData = useResumeStore((state) => state.updateData)
  const currentVector = useMemo(
    () =>
      selectedVector === 'all'
        ? null
        : vectors.find((vector) => vector.id === selectedVector) ?? null,
    [selectedVector, vectors],
  )
  const activeVectorLabel = currentVector?.label ?? 'Select a vector'
  const hasSelectedVector = Boolean(currentVector)
  const actionScopeLabel = hasSelectedVector
    ? `Actions for ${activeVectorLabel}`
    : 'Select a vector for actions'
  const activeVectorStyle = currentVector
    ? ({ '--active-vector-color': currentVector.color } as CSSProperties)
    : undefined

  const handleRenameVector = () => {
    if (selectedVector === 'all' || !currentVector) return

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
    if (selectedVector === 'all' || !currentVector) return

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
      <div id="vector-pills-list" className="vector-pills-scroll" role="group" aria-label="Resume vector choices">
        <div className="vector-pills">
          {vectors.map((vector, index) => (
            <button
              className={`vector-pill ${selectedVector === vector.id ? 'active' : ''}`}
              style={vectorColorStyle(vector.color)}
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
          <button
            className="vector-pill add-pill vector-add-pill"
            onClick={onAddVector}
            type="button"
            aria-label="New Vector"
            title="New Vector"
          >
            <Plus size={14} />
            <span className="vector-add-label">New</span>
          </button>
        </div>
      </div>
      <div className="vector-actions" style={activeVectorStyle}>
        <div className="vector-action-context">
          <HelpHint text="Vectors are positioning angles. Select one to assemble a resume tailored to that direction." placement="bottom" />
          <span
            className="vector-action-scope"
            title={actionScopeLabel}
          >
            {actionScopeLabel}
          </span>
        </div>
        <div className="vector-action-group vector-view-actions" role="group" aria-label="Vector view actions">
          <button
            className="btn-ghost vector-view-all-btn"
            onClick={() => onSelect('all')}
            type="button"
            aria-pressed={selectedVector === 'all'}
            aria-label="View All Bullets"
            title="Show bullets across every vector"
          >
            <List size={14} />
            <span className="vector-action-label" aria-hidden="true">View All</span>
          </button>
        </div>
        <div className="vector-action-group vector-edit-actions" role="group" aria-label="Vector edit actions">
          <button
            className="btn-ghost"
            type="button"
            onClick={handleRenameVector}
            disabled={!hasSelectedVector}
            aria-label={hasSelectedVector ? `Rename ${activeVectorLabel}` : 'Rename vector'}
            title={hasSelectedVector ? `Rename ${activeVectorLabel}` : 'Select a vector to rename it'}
          >
            <Pencil size={14} />
            <span className="vector-action-label" aria-hidden="true">Rename</span>
          </button>
          <button
            className="btn-ghost btn-danger-soft"
            type="button"
            onClick={handleRemoveVector}
            disabled={!hasSelectedVector}
            aria-label={hasSelectedVector ? `Delete ${activeVectorLabel}` : 'Delete vector'}
            title={hasSelectedVector ? `Delete ${activeVectorLabel}` : 'Select a vector to remove it'}
          >
            <Trash2 size={14} />
            <span className="vector-action-label" aria-hidden="true">Delete</span>
          </button>
          <button
            className="btn-ghost"
            type="button"
            onClick={onResetOverrides}
            disabled={!hasSelectedVector}
            aria-label={
              hasSelectedVector
                ? `Reset overrides for ${activeVectorLabel}`
                : 'Reset overrides'
            }
            title={
              hasSelectedVector
                ? `Reset overrides for ${activeVectorLabel}`
                : 'Select a vector to reset overrides'
            }
          >
            <RotateCcw size={14} />
            <span className="vector-action-label" aria-hidden="true">Reset Overrides</span>
          </button>
        </div>
      </div>
    </div>
  )
}
