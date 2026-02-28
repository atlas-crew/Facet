import { useMemo, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import type { PriorityByVector, ResumeData, Role, VectorSelection } from '../types'
import { getPriorityForVector } from '../engine/assembler'
import { componentKeys } from '../utils/componentKeys'
import { reorderById } from '../utils/reorderById'
import { defaultVectorsForSelection } from '../utils/vectorPriority'
import { useFocusTrap } from '../utils/useFocusTrap'
import { BulletList } from './BulletList'
import { ComponentCard } from './ComponentCard'
import { SkillGroupList } from './SkillGroupList'
import { VectorPriorityEditor } from './VectorPriorityEditor'

type AddComponentType = 'target_line' | 'profile' | 'skill_group' | 'project' | 'bullet'

interface AddComponentPayload {
  text?: string
  label?: string
  content?: string
  name?: string
  url?: string
  roleId?: string
  vectors?: PriorityByVector
}

interface ComponentLibraryProps {
  data: ResumeData
  selectedVector: VectorSelection
  includedByKey: Record<string, boolean>
  variantByKey: Record<string, string>
  bulletOrderByRole: Record<string, string[]>
  onToggleComponent: (componentKey: string, vectors: PriorityByVector) => void
  onSetVariant: (componentKey: string, variant: string | null) => void
  onUpdateTargetLine: (id: string, text: string) => void
  onUpdateTargetLineVectors: (id: string, vectors: PriorityByVector) => void
  onUpdateProfile: (id: string, text: string) => void
  onUpdateProfileVectors: (id: string, vectors: PriorityByVector) => void
  onUpdateProject: (id: string, field: 'name' | 'url' | 'text', value: string) => void
  onUpdateProjectVectors: (id: string, vectors: PriorityByVector) => void
  onUpdateSkillGroup: (id: string, field: 'label' | 'content', value: string) => void
  onReorderSkillGroups: (order: string[]) => void
  onUpdateBullet: (roleId: string, bulletId: string, text: string) => void
  onUpdateBulletVectors: (roleId: string, bulletId: string, vectors: PriorityByVector) => void
  onToggleBullet: (roleId: string, bulletId: string, vectors: PriorityByVector) => void
  onReorderBullets: (roleId: string, order: string[]) => void
  onAddComponent: (type: AddComponentType, payload: AddComponentPayload) => void
}

function requiresVectorPriority(type: AddComponentType): boolean {
  return type === 'target_line' || type === 'profile' || type === 'project' || type === 'bullet'
}

export function ComponentLibrary({
  data,
  selectedVector,
  includedByKey,
  variantByKey,
  bulletOrderByRole,
  onToggleComponent,
  onSetVariant,
  onUpdateTargetLine,
  onUpdateTargetLineVectors,
  onUpdateProfile,
  onUpdateProfileVectors,
  onUpdateProject,
  onUpdateProjectVectors,
  onUpdateSkillGroup,
  onReorderSkillGroups,
  onUpdateBullet,
  onUpdateBulletVectors,
  onToggleBullet,
  onReorderBullets,
  onAddComponent,
}: ComponentLibraryProps) {
  const [addOpen, setAddOpen] = useState(false)
  const [addType, setAddType] = useState<AddComponentType>('bullet')
  const [payload, setPayload] = useState<AddComponentPayload>({})
  const [addError, setAddError] = useState<string | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  const roleChoices = useMemo(() => data.roles.map((role) => ({ id: role.id, label: role.company })), [data.roles])
  const defaultRoleId = roleChoices[0]?.id
  const defaultAddVectors = useMemo(
    () => defaultVectorsForSelection(selectedVector, data.vectors),
    [selectedVector, data.vectors],
  )
  useFocusTrap(addOpen, modalRef, () => setAddOpen(false))

  const submitAdd = () => {
    const text = payload.text?.trim() ?? ''
    const name = payload.name?.trim() ?? ''
    const label = payload.label?.trim() ?? ''
    const content = payload.content?.trim() ?? ''
    const roleId = payload.roleId ?? defaultRoleId

    if (addType === 'bullet') {
      if (!roleId) {
        setAddError('Select a role before adding a bullet.')
        return
      }
      if (!text) {
        setAddError('Bullet text is required.')
        return
      }
    }

    if (addType === 'project') {
      if (!name || !text) {
        setAddError('Project name and description are required.')
        return
      }
    }

    if (addType === 'skill_group') {
      if (!label || !content) {
        setAddError('Skill group label and content are required.')
        return
      }
    }

    if ((addType === 'profile' || addType === 'target_line') && !text) {
      setAddError('Text is required.')
      return
    }

    onAddComponent(addType, payload)
    setAddError(null)
    setPayload({})
    setAddOpen(false)
  }

  return (
    <aside className="library-panel">
      <div className="library-panel-header">
        <h2>Component Library</h2>
        <button
          className="btn-secondary"
          type="button"
          onClick={() => {
            setAddOpen(true)
            setAddError(null)
            setPayload(() => {
              const next: AddComponentPayload = {}
              if (addType === 'bullet' && !next.roleId && defaultRoleId) {
                next.roleId = defaultRoleId
              }
              if (requiresVectorPriority(addType)) {
                next.vectors = defaultAddVectors
              }
              return next
            })
          }}
        >
          <Plus size={16} />
          Add Component
        </button>
      </div>

      <div className="library-section">
        <h3 className="section-header">Target Lines</h3>
        <div className="library-grid">
          {data.target_lines.map((line) => (
            <ComponentCard
              key={line.id}
              title={line.id}
              body={line.text}
              vectors={line.vectors}
              vectorDefs={data.vectors}
              selectedVector={selectedVector}
              included={includedByKey[componentKeys.targetLine(line.id)] ?? getPriorityForVector(line.vectors, selectedVector) !== 'exclude'}
              variants={line.variants}
              selectedVariant={variantByKey[componentKeys.targetLine(line.id)]}
              onToggleIncluded={() => onToggleComponent(componentKeys.targetLine(line.id), line.vectors)}
              onVariantChange={(variant) => onSetVariant(componentKeys.targetLine(line.id), variant)}
              onBodyChange={(value) => onUpdateTargetLine(line.id, value)}
              onVectorsChange={(vectors) => onUpdateTargetLineVectors(line.id, vectors)}
            />
          ))}
        </div>
      </div>

      <div className="library-section">
        <h3 className="section-header">Profiles</h3>
        <div className="library-grid">
          {data.profiles.map((profile) => (
            <ComponentCard
              key={profile.id}
              title={profile.id}
              body={profile.text}
              vectors={profile.vectors}
              vectorDefs={data.vectors}
              selectedVector={selectedVector}
              included={includedByKey[componentKeys.profile(profile.id)] ?? getPriorityForVector(profile.vectors, selectedVector) !== 'exclude'}
              variants={profile.variants}
              selectedVariant={variantByKey[componentKeys.profile(profile.id)]}
              onToggleIncluded={() => onToggleComponent(componentKeys.profile(profile.id), profile.vectors)}
              onVariantChange={(variant) => onSetVariant(componentKeys.profile(profile.id), variant)}
              onBodyChange={(value) => onUpdateProfile(profile.id, value)}
              onVectorsChange={(vectors) => onUpdateProfileVectors(profile.id, vectors)}
            />
          ))}
        </div>
      </div>

      <div className="library-section">
        <h3 className="section-header">Skill Groups</h3>
        <SkillGroupList
          skillGroups={data.skill_groups}
          onReorder={onReorderSkillGroups}
          onUpdate={(skillGroupId, field, value) => onUpdateSkillGroup(skillGroupId, field, value)}
        />
      </div>

      <div className="library-section">
        <h3 className="section-header">Roles & Bullets</h3>
        <div className="library-grid role-grid">
          {data.roles.map((role) => {
            const orderedRole: Role = {
              ...role,
              bullets: reorderById(role.bullets, bulletOrderByRole[role.id]),
            }
            const includedByBulletId = Object.fromEntries(
              orderedRole.bullets.map((bullet) => {
                const key = componentKeys.bullet(orderedRole.id, bullet.id)
                const autoIncluded = getPriorityForVector(bullet.vectors, selectedVector) !== 'exclude'
                return [bullet.id, includedByKey[key] ?? autoIncluded]
              }),
            )
            const variantByBulletId = Object.fromEntries(
              orderedRole.bullets.map((bullet) => {
                const key = componentKeys.bullet(orderedRole.id, bullet.id)
                return [bullet.id, variantByKey[key]]
              }),
            )

            return (
              <BulletList
                key={orderedRole.id}
                role={orderedRole}
                vectorDefs={data.vectors}
                selectedVector={selectedVector}
                includedByBulletId={includedByBulletId}
                variantByBulletId={variantByBulletId}
                onToggleBullet={(bulletId) => {
                  const bullet = orderedRole.bullets.find((item) => item.id === bulletId)
                  if (!bullet) {
                    return
                  }
                  onToggleBullet(orderedRole.id, bullet.id, bullet.vectors)
                }}
                onReorder={(nextOrder) => onReorderBullets(orderedRole.id, nextOrder)}
                onChangeBulletText={(bulletId, text) => onUpdateBullet(orderedRole.id, bulletId, text)}
                onSetBulletVariant={(bulletId, variant) =>
                  onSetVariant(componentKeys.bullet(orderedRole.id, bulletId), variant)
                }
                onSetBulletVectors={(bulletId, vectors) =>
                  onUpdateBulletVectors(orderedRole.id, bulletId, vectors)
                }
              />
            )
          })}
        </div>
      </div>

      <div className="library-section">
        <h3 className="section-header">Projects</h3>
        <div className="library-grid">
          {data.projects.map((project) => (
            <article className="component-card" key={project.id}>
              <header className="component-card-header">
                <h4>{project.id}</h4>
                <button
                  type="button"
                  className="btn-ghost"
                  aria-pressed={
                    includedByKey[componentKeys.project(project.id)] ??
                    getPriorityForVector(project.vectors, selectedVector) !== 'exclude'
                  }
                  onClick={() => onToggleComponent(componentKeys.project(project.id), project.vectors)}
                >
                  {includedByKey[componentKeys.project(project.id)] ??
                  getPriorityForVector(project.vectors, selectedVector) !== 'exclude'
                    ? 'Included'
                    : 'Excluded'}
                </button>
              </header>
              <input
                className="component-input compact"
                aria-label="Project name"
                value={project.name}
                onChange={(event) => onUpdateProject(project.id, 'name', event.target.value)}
              />
              <input
                className="component-input compact"
                aria-label="Project URL"
                value={project.url ?? ''}
                placeholder="URL"
                onChange={(event) => onUpdateProject(project.id, 'url', event.target.value)}
              />
              <textarea
                className="component-input"
                aria-label="Project description"
                value={project.text}
                onChange={(event) => onUpdateProject(project.id, 'text', event.target.value)}
              />
              <VectorPriorityEditor
                vectors={project.vectors}
                vectorDefs={data.vectors}
                onChange={(vectors) => onUpdateProjectVectors(project.id, vectors)}
              />
              {project.variants && Object.keys(project.variants).length > 0 ? (
                <label className="field-label variant-control">
                  Variant
                  <select
                    className="component-input compact"
                    value={variantByKey[componentKeys.project(project.id)] ?? 'auto'}
                    onChange={(event) =>
                      onSetVariant(
                        componentKeys.project(project.id),
                        event.target.value === 'auto' ? null : event.target.value,
                      )
                    }
                  >
                    <option value="auto">Auto</option>
                    <option value="default">Default</option>
                    {Object.keys(project.variants).map((variantId) => {
                      const vector = data.vectors.find((item) => item.id === variantId)
                      return (
                        <option key={variantId} value={variantId}>
                          {vector?.label ?? variantId}
                        </option>
                      )
                    })}
                  </select>
                </label>
              ) : null}
            </article>
          ))}
        </div>
      </div>

      {addOpen ? (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="add-component-title">
          <div className="modal-card" ref={modalRef} tabIndex={-1}>
            <header className="modal-header">
              <h3 id="add-component-title">Add Component</h3>
              <button
                className="btn-ghost"
                type="button"
                onClick={() => setAddOpen(false)}
                aria-label="Close dialog"
              >
                <X size={14} />
              </button>
            </header>

            <label className="field-label">
              Type
              <select
                value={addType}
                onChange={(event) => {
                  const nextType = event.target.value as AddComponentType
                  setAddType(nextType)
                  setAddError(null)
                  setPayload(() => {
                    const next: AddComponentPayload = {}
                    if (nextType === 'bullet' && defaultRoleId) {
                      next.roleId = defaultRoleId
                    }
                    if (requiresVectorPriority(nextType)) {
                      next.vectors = defaultAddVectors
                    }
                    return next
                  })
                }}
                className="component-input compact"
              >
                <option value="bullet">Bullet</option>
                <option value="project">Project</option>
                <option value="skill_group">Skill Group</option>
                <option value="profile">Profile</option>
                <option value="target_line">Target Line</option>
              </select>
            </label>

            {addType === 'bullet' ? (
              <>
                <label className="field-label">
                  Role
                  <select
                    className="component-input compact"
                    value={payload.roleId ?? defaultRoleId ?? ''}
                    onChange={(event) => setPayload((prev) => ({ ...prev, roleId: event.target.value }))}
                  >
                    {roleChoices.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field-label">
                  Bullet text
                  <textarea
                    className="component-input"
                    value={payload.text ?? ''}
                    onChange={(event) => setPayload((prev) => ({ ...prev, text: event.target.value }))}
                  />
                </label>
              </>
            ) : null}

            {addType === 'project' ? (
              <>
                <label className="field-label">
                  Name
                  <input
                    className="component-input compact"
                    value={payload.name ?? ''}
                    onChange={(event) => setPayload((prev) => ({ ...prev, name: event.target.value }))}
                  />
                </label>
                <label className="field-label">
                  URL
                  <input
                    className="component-input compact"
                    value={payload.url ?? ''}
                    onChange={(event) => setPayload((prev) => ({ ...prev, url: event.target.value }))}
                  />
                </label>
                <label className="field-label">
                  Description
                  <textarea
                    className="component-input"
                    value={payload.text ?? ''}
                    onChange={(event) => setPayload((prev) => ({ ...prev, text: event.target.value }))}
                  />
                </label>
              </>
            ) : null}

            {addType === 'skill_group' ? (
              <>
                <label className="field-label">
                  Label
                  <input
                    className="component-input compact"
                    value={payload.label ?? ''}
                    onChange={(event) => setPayload((prev) => ({ ...prev, label: event.target.value }))}
                  />
                </label>
                <label className="field-label">
                  Content
                  <textarea
                    className="component-input"
                    value={payload.content ?? ''}
                    onChange={(event) => setPayload((prev) => ({ ...prev, content: event.target.value }))}
                  />
                </label>
              </>
            ) : null}

            {addType === 'profile' || addType === 'target_line' ? (
              <label className="field-label">
                Text
                <textarea
                  className="component-input"
                  value={payload.text ?? ''}
                  onChange={(event) => setPayload((prev) => ({ ...prev, text: event.target.value }))}
                />
              </label>
            ) : null}

            {requiresVectorPriority(addType) ? (
              <VectorPriorityEditor
                vectors={payload.vectors ?? defaultAddVectors}
                vectorDefs={data.vectors}
                onChange={(vectors) => setPayload((previous) => ({ ...previous, vectors }))}
              />
            ) : null}

            {addError ? <p className="error-text">{addError}</p> : null}

            <button className="btn-primary" type="button" onClick={submitAdd}>
              <Plus size={16} />
              Add
            </button>
          </div>
        </div>
      ) : null}
    </aside>
  )
}
