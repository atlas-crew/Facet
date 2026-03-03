import { useMemo, useRef, useState, type ReactNode } from 'react'
import { ChevronRight, Plus, X } from 'lucide-react'
import type {
  PriorityByVector,
  ResumeData,
  Role,
  SkillGroupVectorConfig,
  VectorSelection,
} from '../types'
import { getPriorityForVector } from '../engine/assembler'
import { hasCustomVectorOrder } from '../utils/bulletOrder'
import { componentKeys } from '../utils/componentKeys'
import { reorderById } from '../utils/reorderById'
import { defaultVectorsForSelection } from '../utils/vectorPriority'
import { useFocusTrap } from '../utils/useFocusTrap'
import { BulletList } from './BulletList'
import { ComponentCard } from './ComponentCard'
import { SkillGroupList } from './SkillGroupList'
import { ProjectList } from './ProjectList'
import { VectorPriorityEditor } from './VectorPriorityEditor'

type AddComponentType = 'target_line' | 'profile' | 'skill_group' | 'project' | 'bullet'
type LibrarySectionId =
  | 'header'
  | 'target-lines'
  | 'profiles'
  | 'skill-groups'
  | 'roles-bullets'
  | 'projects'

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
  activeVectorBulletOrderByRole: Record<string, string[]>
  defaultBulletOrderByRole: Record<string, string[]>
  onToggleComponent: (componentKey: string, vectors: PriorityByVector) => void
  onSetVariant: (componentKey: string, variant: string | null) => void
  onUpdateTargetLine: (id: string, text: string) => void
  onUpdateTargetLineVectors: (id: string, vectors: PriorityByVector) => void
  onUpdateProfile: (id: string, text: string) => void
  onUpdateProfileVectors: (id: string, vectors: PriorityByVector) => void
  onUpdateProject: (id: string, field: 'name' | 'url' | 'text', value: string) => void
  onUpdateProjectVectors: (id: string, vectors: PriorityByVector) => void
  onReorderProjects: (order: string[]) => void
  onUpdateSkillGroup: (id: string, field: 'label' | 'content', value: string) => void
  onUpdateSkillGroupVectors: (id: string, vectors: Record<string, SkillGroupVectorConfig>) => void
  onReorderSkillGroups: (order: string[]) => void
  onUpdateRole: (roleId: string, field: 'company' | 'title' | 'dates' | 'location' | 'subtitle', value: string | null) => void
  onUpdateBullet: (roleId: string, bulletId: string, text: string) => void
  onUpdateBulletVectors: (roleId: string, bulletId: string, vectors: PriorityByVector) => void
  onToggleBullet: (roleId: string, bulletId: string, vectors: PriorityByVector) => void
  onReorderBullets: (roleId: string, order: string[]) => void
  onResetRoleBulletOrder: (roleId: string) => void
  onReframeBullet: (roleId: string, bulletId: string) => void
  reframeLoadingId: string | null
  onAddComponent: (type: AddComponentType, payload: AddComponentPayload) => void
  onUpdateMetaField: (field: 'name' | 'email' | 'phone' | 'location', value: string) => void
  onUpdateMetaLink: (index: number, field: 'label' | 'url', value: string) => void
  onAddMetaLink: () => void
  onRemoveMetaLink: (index: number) => void
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
  activeVectorBulletOrderByRole,
  defaultBulletOrderByRole,
  onToggleComponent,
  onSetVariant,
  onUpdateTargetLine,
  onUpdateTargetLineVectors,
  onUpdateProfile,
  onUpdateProfileVectors,
  onUpdateProject,
  onUpdateProjectVectors,
  onReorderProjects,
  onUpdateSkillGroup,
  onUpdateSkillGroupVectors,
  onReorderSkillGroups,
  onUpdateRole,
  onUpdateBullet,
  onUpdateBulletVectors,
  onToggleBullet,
  onReorderBullets,
  onResetRoleBulletOrder,
  onReframeBullet,
  reframeLoadingId,
  onAddComponent,
  onUpdateMetaField,
  onUpdateMetaLink,
  onAddMetaLink,
  onRemoveMetaLink,
}: ComponentLibraryProps) {
  const [addOpen, setAddOpen] = useState(false)
  const [addType, setAddType] = useState<AddComponentType>('bullet')
  const [payload, setPayload] = useState<AddComponentPayload>({})
  const [addError, setAddError] = useState<string | null>(null)
  const [openSections, setOpenSections] = useState<Record<LibrarySectionId, boolean>>({
    header: true,
    'target-lines': true,
    profiles: false,
    'skill-groups': false,
    'roles-bullets': true,
    projects: false,
  })
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

  const toggleSection = (sectionId: LibrarySectionId) => {
    setOpenSections((current) => ({
      ...current,
      [sectionId]: !current[sectionId],
    }))
  }

  const renderSection = (sectionId: LibrarySectionId, title: string, content: ReactNode) => {
    const expanded = openSections[sectionId]
    const panelId = `library-section-${sectionId}`
    const buttonId = `${panelId}-toggle`

    return (
      <section className="library-section" key={sectionId}>
        <h3 className="section-header">
          <button
            id={buttonId}
            className={`library-section-toggle ${expanded ? 'expanded' : ''}`}
            type="button"
            aria-expanded={expanded}
            aria-controls={panelId}
            onClick={() => toggleSection(sectionId)}
          >
            <ChevronRight size={14} />
            <span>{title}</span>
          </button>
        </h3>
        <div
          className={`library-section-collapse ${expanded ? 'expanded' : ''}`}
          role="region"
          id={panelId}
          aria-labelledby={buttonId}
          aria-hidden={!expanded}
        >
          <div className="library-section-panel">
            {content}
          </div>
        </div>
      </section>
    )
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

      {renderSection(
        'header',
        'Header',
        <div className="library-grid">
          <label className="field-label">
            Name
            <input
              className="component-input compact"
              value={data.meta.name}
              onChange={(event) => onUpdateMetaField('name', event.target.value)}
            />
          </label>
          <label className="field-label">
            Location
            <input
              className="component-input compact"
              value={data.meta.location}
              onChange={(event) => onUpdateMetaField('location', event.target.value)}
            />
          </label>
          <label className="field-label">
            Email
            <input
              className="component-input compact"
              value={data.meta.email}
              onChange={(event) => onUpdateMetaField('email', event.target.value)}
            />
          </label>
          <label className="field-label">
            Phone
            <input
              className="component-input compact"
              value={data.meta.phone}
              onChange={(event) => onUpdateMetaField('phone', event.target.value)}
            />
          </label>
          {data.meta.links.map((link, index) => (
            <div className="header-link-row" key={`meta-link-${index}`}>
              <label className="field-label">
                Link label (optional)
                <input
                  className="component-input compact"
                  placeholder="GitHub"
                  value={link.label ?? ''}
                  onChange={(event) => onUpdateMetaLink(index, 'label', event.target.value)}
                />
              </label>
              <label className="field-label">
                Link URL
                <input
                  className="component-input compact"
                  placeholder="github.com/username"
                  value={link.url}
                  onChange={(event) => onUpdateMetaLink(index, 'url', event.target.value)}
                />
              </label>
              <button
                className="btn-ghost"
                type="button"
                onClick={() => onRemoveMetaLink(index)}
                aria-label={`Remove link ${index + 1}`}
              >
                Remove
              </button>
            </div>
          ))}
          <button className="btn-secondary" type="button" onClick={onAddMetaLink}>
            <Plus size={16} />
            Add Link
          </button>
        </div>,
      )}

      {renderSection(
        'target-lines',
        'Target Lines',
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
        </div>,
      )}

      {renderSection(
        'profiles',
        'Profiles',
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
        </div>,
      )}

      {renderSection(
        'skill-groups',
        'Skill Groups',
        <SkillGroupList
          skillGroups={data.skill_groups}
          vectorDefs={data.vectors}
          onReorder={onReorderSkillGroups}
          onUpdate={(skillGroupId, field, value) => onUpdateSkillGroup(skillGroupId, field, value)}
          onUpdateVectors={(skillGroupId, vectors) => onUpdateSkillGroupVectors(skillGroupId, vectors)}
        />,
      )}

      {renderSection(
        'roles-bullets',
        'Roles & Bullets',
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
                customOrderLabel={
                  hasCustomVectorOrder(selectedVector, orderedRole.id, {
                    all: defaultBulletOrderByRole,
                    [selectedVector]: activeVectorBulletOrderByRole,
                  })
                    ? `Custom order for ${
                        data.vectors.find((vector) => vector.id === selectedVector)?.label ?? selectedVector
                      }`
                    : undefined
                }
                canResetOrder={
                  selectedVector === 'all'
                    ? Boolean(defaultBulletOrderByRole[orderedRole.id])
                    : Boolean(activeVectorBulletOrderByRole[orderedRole.id])
                }
                onResetOrder={() => onResetRoleBulletOrder(orderedRole.id)}
                onUpdateRole={(field, value) => onUpdateRole(orderedRole.id, field, value)}
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
                onReframe={(bulletId) => onReframeBullet(orderedRole.id, bulletId)}
                reframeLoadingId={reframeLoadingId}
              />
            )
          })}
        </div>,
      )}

      {renderSection(
        'projects',
        'Projects',
        <ProjectList
          projects={data.projects}
          vectorDefs={data.vectors}
          selectedVector={selectedVector}
          includedByKey={includedByKey}
          variantByKey={variantByKey}
          onReorder={onReorderProjects}
          onUpdate={onUpdateProject}
          onUpdateVectors={onUpdateProjectVectors}
          onToggleIncluded={(id, vectors) => onToggleComponent(componentKeys.project(id), vectors)}
          onSetVariant={(id, variant) => onSetVariant(componentKeys.project(id), variant)}
        />,
      )}

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
