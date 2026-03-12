import { useMemo, useRef, useState, type ReactNode, useCallback, useEffect } from 'react'
import { Search, ChevronRight, Plus, X, PlusCircle } from 'lucide-react'
import type {
  AddComponentPayload,
  AddComponentType,
  PriorityByVector,
  ResumeData,
  Role,
  SkillGroupVectorConfig,
  VectorSelection,
  ComponentSuggestion,
} from '../types'
import { getPriorityForVector } from '../engine/assembler'
import { hasCustomVectorOrder } from '../utils/bulletOrder'
import { componentKeys } from '../utils/componentKeys'
import { reorderById } from '../utils/reorderById'
import { defaultVectorsForSelection } from '../utils/vectorPriority'
import { useFocusTrap } from '../utils/useFocusTrap'
import { BulletList } from './BulletList'
import { ComponentCard } from './ComponentCard'
import { HelpHint } from './HelpHint'
import { SkillGroupList } from './SkillGroupList'
import { ProjectList } from './ProjectList'
import { EducationList } from './EducationList'
import { CertificationList } from './CertificationList'
import { VectorPriorityEditor } from './VectorPriorityEditor'
import { resolveDisplayText } from '../utils/resolveDisplayText'

type LibrarySectionId =
  | 'header'
  | 'target-lines'
  | 'profiles'
  | 'skill-groups'
  | 'roles-bullets'
  | 'projects'
  | 'education'
  | 'certifications'

interface ComponentLibraryProps {
  data: ResumeData
  selectedVector: VectorSelection
  includedByKey: Record<string, boolean>
  bulletOrderByRole: Record<string, string[]>
  activeVectorBulletOrderByRole: Record<string, string[]>
  defaultBulletOrderByRole: Record<string, string[]>
  onToggleComponent: (componentKey: string, vectors: PriorityByVector) => void
  onUpdateTargetLine: (id: string, text: string) => void
  onUpdateTargetLineVectors: (id: string, vectors: PriorityByVector) => void
  onUpdateTargetLineVariant: (id: string, text: string) => void
  onResetTargetLineVariant: (id: string) => void
  onUpdateProfile: (id: string, text: string) => void
  onUpdateProfileVectors: (id: string, vectors: PriorityByVector) => void
  onUpdateProfileVariant: (id: string, text: string) => void
  onResetProfileVariant: (id: string) => void
  onUpdateProject: (id: string, field: 'name' | 'url' | 'text', value: string) => void
  onUpdateProjectVectors: (id: string, vectors: PriorityByVector) => void
  onUpdateProjectVariant: (id: string, text: string) => void
  onResetProjectVariant: (id: string) => void
  onReorderProjects: (order: string[]) => void
  onUpdateSkillGroup: (id: string, field: 'label' | 'content', value: string) => void
  onUpdateSkillGroupVectors: (id: string, vectors: Record<string, SkillGroupVectorConfig>) => void
  onReorderSkillGroups: (order: string[]) => void
  onUpdateRole: (roleId: string, field: 'company' | 'title' | 'dates' | 'location' | 'subtitle', value: string | null) => void
  onUpdateBullet: (roleId: string, bulletId: string, text: string) => void
  onUpdateBulletLabel: (roleId: string, bulletId: string, label: string) => void
  onUpdateBulletVectors: (roleId: string, bulletId: string, vectors: PriorityByVector) => void
  onUpdateBulletVariant: (roleId: string, bulletId: string, text: string) => void
  onResetBulletVariant: (roleId: string, bulletId: string) => void
  onToggleBullet: (roleId: string, bulletId: string, vectors: PriorityByVector) => void
  onReorderBullets: (roleId: string, order: string[]) => void
  onResetRoleBulletOrder: (roleId: string) => void
  onReframeBullet: (roleId: string, bulletId: string) => void
  reframeLoadingId: string | null
  aiEnabled: boolean
  onAddComponent: (type: AddComponentType, payload: AddComponentPayload) => void
  onUpdateMetaField: (field: 'name' | 'email' | 'phone' | 'location', value: string) => void
  onUpdateMetaLink: (index: number, field: 'label' | 'url', value: string) => void
  onUpdateEducation: (id: string, field: 'school' | 'location' | 'degree' | 'year', value: string) => void
  onToggleEducation: (id: string) => void
  onDeleteEducation: (id: string) => void
  onReorderEducation: (order: string[]) => void
  onUpdateCertification: (id: string, field: 'name' | 'issuer' | 'date' | 'credential_id' | 'url', value: string) => void
  onUpdateCertificationVectors: (id: string, vectors: PriorityByVector) => void
  onDeleteCertification: (id: string) => void
  onReorderCertifications: (order: string[]) => void
  onAddMetaLink: () => void
  onRemoveMetaLink: (index: number) => void
  bulletSuggestions?: Record<string, ComponentSuggestion>
  onAcceptBulletSuggestion?: (roleId: string, bulletId: string, suggestion: ComponentSuggestion) => void
  onIgnoreBulletSuggestion?: (roleId: string, bulletId: string) => void
  targetLineSuggestion?: ComponentSuggestion
  onAcceptTargetLineSuggestion?: (id: string, suggestion: ComponentSuggestion) => void
  onIgnoreTargetLineSuggestion?: (id: string) => void
}

function requiresVectorPriority(type: AddComponentType): boolean {
  return type === 'target_line' || type === 'profile' || type === 'project' || type === 'bullet' || type === 'certification'
}

function useFilteredList<T>(
  items: T[],
  query: string,
  getSearchableText: (item: T) => string[],
): T[] {
  return useMemo(() => {
    if (!query) return items
    const q = query.toLowerCase()
    return items.filter((item) =>
      getSearchableText(item).some((text) => text.toLowerCase().includes(q)),
    )
  }, [items, query, getSearchableText])
}

export function ComponentLibrary({
  data,
  selectedVector,
  includedByKey,
  bulletOrderByRole,
  activeVectorBulletOrderByRole,
  defaultBulletOrderByRole,
  onToggleComponent,
  onUpdateTargetLine,
  onUpdateTargetLineVectors,
  onUpdateTargetLineVariant,
  onResetTargetLineVariant,
  onUpdateProfile,
  onUpdateProfileVectors,
  onUpdateProfileVariant,
  onResetProfileVariant,
  onUpdateProject,
  onUpdateProjectVectors,
  onUpdateProjectVariant,
  onResetProjectVariant,
  onReorderProjects,
  onUpdateSkillGroup,
  onUpdateSkillGroupVectors,
  onReorderSkillGroups,
  onUpdateRole,
  onUpdateBullet,
  onUpdateBulletLabel,
  onUpdateBulletVectors,
  onUpdateBulletVariant,
  onResetBulletVariant,
  onToggleBullet,
  onReorderBullets,
  onResetRoleBulletOrder,
  onReframeBullet,
  reframeLoadingId,
  aiEnabled,
  onAddComponent,
  onUpdateEducation,
  onToggleEducation,
  onDeleteEducation,
  onReorderEducation,
  onUpdateCertification,
  onUpdateCertificationVectors,
  onDeleteCertification,
  onReorderCertifications,
  onUpdateMetaField,
  onUpdateMetaLink,
  onAddMetaLink,
  onRemoveMetaLink,
  bulletSuggestions = {},
  onAcceptBulletSuggestion,
  onIgnoreBulletSuggestion,
  targetLineSuggestion,
  onAcceptTargetLineSuggestion,
  onIgnoreTargetLineSuggestion,
}: ComponentLibraryProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [addType, setAddType] = useState<AddComponentType>('bullet')
  const [payload, setPayload] = useState<AddComponentPayload>({})
  const [addError, setAddError] = useState<string | null>(null)
  const [addAnnouncement, setAddAnnouncement] = useState('')
  const [openSections, setOpenSections] = useState<Record<LibrarySectionId, boolean>>({
    header: true,
    'target-lines': true,
    profiles: false,
    'skill-groups': false,
    'roles-bullets': true,
    projects: false,
    education: false,
    certifications: false,
  })
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!addOpen) {
      return
    }

    const typeLabels: Record<AddComponentType, string> = {
      bullet: 'Bullet',
      project: 'Project',
      skill_group: 'Skill Group',
      profile: 'Profile',
      target_line: 'Target Line',
      role: 'Role',
      education: 'Education',
      certification: 'Certification',
    }

    const clearAnnouncementId = window.setTimeout(() => {
      setAddAnnouncement('')
    }, 0)

    const announcementId = window.setTimeout(() => {
      setAddAnnouncement(`Switched to ${typeLabels[addType]} form`)
    }, 10)

    return () => {
      window.clearTimeout(clearAnnouncementId)
      window.clearTimeout(announcementId)
    }
  }, [addType, addOpen])

  const filteredTargetLines = useFilteredList(data.target_lines, searchQuery, (line) => [
    line.text,
    line.id,
  ])

  const filteredProfiles = useFilteredList(data.profiles, searchQuery, (profile) => [
    profile.text,
    profile.id,
  ])

  const filteredSkillGroups = useFilteredList(data.skill_groups, searchQuery, (group) => [
    group.label,
    group.content,
  ])

  const filteredRoles = useMemo(() => {
    if (!searchQuery) return data.roles
    const q = searchQuery.toLowerCase()
    return data.roles
      .map((role) => {
        const matchRole =
          role.company.toLowerCase().includes(q) ||
          role.title.toLowerCase().includes(q) ||
          (role.subtitle?.toLowerCase().includes(q) ?? false) ||
          (role.location?.toLowerCase().includes(q) ?? false)

        const matchBullets = role.bullets.some((bullet) => bullet.text.toLowerCase().includes(q))

        if (matchRole || matchBullets) {
          return role
        }
        return null
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
  }, [data.roles, searchQuery])

  const filteredProjects = useFilteredList(data.projects, searchQuery, (project) => [
    project.name,
    project.text,
    project.url ?? '',
  ])

  const filteredEducation = useFilteredList(data.education, searchQuery, (entry) => [
    entry.school,
    entry.location,
    entry.degree,
    entry.year ?? '',
  ])

  const filteredCertifications = useFilteredList(data.certifications ?? [], searchQuery, (cert) => [
    cert.name,
    cert.issuer,
    cert.date ?? '',
  ])

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

    if (addType === 'education') {
      if (!name) {
        setAddError('School name is required.')
        return
      }
    }

    if (addType === 'certification') {
      if (!name || !(payload.issuer?.trim())) {
        setAddError('Certification name and issuer are required.')
        return
      }
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

  const renderSection = (
    sectionId: LibrarySectionId,
    title: string,
    content: ReactNode,
    options: {
      summary?: string
      onAdd?: () => void
      isEmpty?: boolean
      dataTour?: string
      titleAdornment?: ReactNode
    } = {},
  ) => {
    const { summary, onAdd, isEmpty, dataTour, titleAdornment } = options
    const hasActiveSearch = searchQuery.length > 0
    const expanded = (hasActiveSearch && !isEmpty) || openSections[sectionId]
    const panelId = `library-section-${sectionId}`
    const buttonId = `${panelId}-toggle`

    const ariaAddLabel = `Add to ${title}`

    return (
      <section className="library-section" key={sectionId} data-tour={dataTour}>
        <div className="section-header-wrapper">
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
              <span className="section-title-text">{title}</span>
              {summary && <span className="section-summary-pill">{summary}</span>}
            </button>
            {titleAdornment}
          </h3>
          {onAdd && (
            <button
              className="btn-ghost btn-icon-only section-add-btn"
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onAdd()
              }}
              aria-label={ariaAddLabel}
              title={ariaAddLabel}
            >
              <PlusCircle size={16} />
            </button>
          )}
        </div>
        <div
          className={`library-section-collapse ${expanded ? 'expanded' : ''}`}
          role="region"
          id={panelId}
          aria-labelledby={buttonId}
          aria-hidden={!expanded}
        >
          <div className="library-section-panel">
            {isEmpty ? (
              <p className="section-empty-state">No matching {title.toLowerCase()}.</p>
            ) : (
              content
            )}
          </div>
        </div>
      </section>
    )
  }

  const activeVectorColor = selectedVector === 'all'
    ? undefined
    : data.vectors.find((v) => v.id === selectedVector)?.color

  // Variant-aware body change handlers
  const handleTargetLineBodyChange = useCallback((id: string, text: string) => {
    if (selectedVector === 'all') {
      onUpdateTargetLine(id, text)
    } else {
      onUpdateTargetLineVariant(id, text)
    }
  }, [selectedVector, onUpdateTargetLine, onUpdateTargetLineVariant])

  const handleProfileBodyChange = useCallback((id: string, text: string) => {
    if (selectedVector === 'all') {
      onUpdateProfile(id, text)
    } else {
      onUpdateProfileVariant(id, text)
    }
  }, [selectedVector, onUpdateProfile, onUpdateProfileVariant])

  const handleProjectTextChange = useCallback((id: string, field: 'name' | 'url' | 'text', value: string) => {
    if (field === 'text' && selectedVector !== 'all') {
      onUpdateProjectVariant(id, value)
    } else {
      onUpdateProject(id, field, value)
    }
  }, [selectedVector, onUpdateProject, onUpdateProjectVariant])

  const handleBulletTextChange = useCallback((roleId: string, bulletId: string, text: string) => {
    if (selectedVector === 'all') {
      onUpdateBullet(roleId, bulletId, text)
    } else {
      onUpdateBulletVariant(roleId, bulletId, text)
    }
  }, [selectedVector, onUpdateBullet, onUpdateBulletVariant])

  // Memoized handlers for ComponentCard children
  const handleToggleTargetLine = useCallback((id: string, vectors: PriorityByVector) => {
    onToggleComponent(componentKeys.targetLine(id), vectors)
  }, [onToggleComponent])

  const handleToggleProfile = useCallback((id: string, vectors: PriorityByVector) => {
    onToggleComponent(componentKeys.profile(id), vectors)
  }, [onToggleComponent])

  const handleToggleSkillGroup = useCallback((id: string) => {
    onToggleComponent(id, {})
  }, [onToggleComponent])

  const handleToggleProjectBound = useCallback((id: string, vectors: PriorityByVector) => {
    onToggleComponent(componentKeys.project(id), vectors)
  }, [onToggleComponent])

  const handleToggleBulletBound = useCallback((roleId: string, bulletId: string, vectors: PriorityByVector) => {
    onToggleBullet(roleId, bulletId, vectors)
  }, [onToggleBullet])

  const handleToggleEducation = useCallback((id: string) => {
    onToggleEducation(id)
  }, [onToggleEducation])

  const handleToggleCertificationBound = useCallback((id: string, vectors: PriorityByVector) => {
    onToggleComponent(componentKeys.certification(id), vectors)
  }, [onToggleComponent])

  return (
    <aside
      className="library-panel"
      data-tour="component-library"
      style={activeVectorColor ? { '--active-vector-color': activeVectorColor } as React.CSSProperties : undefined}
    >
      <span id="dnd-instructions-global" className="sr-only">
        To reorder items, press Space or Enter to lift, use Arrow keys to move, and Space or Enter to drop. Press Escape to cancel.
      </span>

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

      <div className="library-search" role="search">
        <div className="search-input-wrapper">
          <Search size={14} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search bullets, roles, skills..."
            aria-label="Search components"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="search-clear"
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>
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
        { summary: `${data.meta.links.length + 4} fields` },
      )}

      {renderSection(
        'target-lines',
        'Target Lines',
        <div className="library-grid">
          {filteredTargetLines.map((line) => {
            const key = componentKeys.targetLine(line.id)
            const autoIncluded = getPriorityForVector(line.vectors, selectedVector) !== 'exclude'
            const hasVariant = selectedVector !== 'all' && Boolean(line.variants?.[selectedVector])
            return (
              <ComponentCard
                key={line.id}
                id={line.id}
                title={line.id}
                body={resolveDisplayText(line.text, line.variants, selectedVector)}
                vectors={line.vectors}
                vectorDefs={data.vectors}
                selectedVector={selectedVector}
                included={includedByKey[key] ?? autoIncluded}
                hasVariant={hasVariant}
                onToggleIncluded={handleToggleTargetLine}
                onBodyChange={handleTargetLineBodyChange}
                onVectorsChange={onUpdateTargetLineVectors}
                onResetVariant={onResetTargetLineVariant}
                suggestion={targetLineSuggestion?.recommendedPriority ? targetLineSuggestion : undefined}
                onAcceptSuggestion={onAcceptTargetLineSuggestion}
                onIgnoreSuggestion={onIgnoreTargetLineSuggestion}
              />
            )
          })}
        </div>,
        {
          summary: `${filteredTargetLines.length} items`,
          onAdd: () => {
            setAddType('target_line')
            setAddOpen(true)
          },
          isEmpty: searchQuery ? filteredTargetLines.length === 0 : false,
          dataTour: 'component-card',
        },
      )}

      {renderSection(
        'profiles',
        'Profiles',
        <div className="library-grid">
          {filteredProfiles.map((profile) => {
            const key = componentKeys.profile(profile.id)
            const autoIncluded = getPriorityForVector(profile.vectors, selectedVector) !== 'exclude'
            const hasVariant = selectedVector !== 'all' && Boolean(profile.variants?.[selectedVector])
            return (
              <ComponentCard
                key={profile.id}
                id={profile.id}
                title={profile.id}
                body={resolveDisplayText(profile.text, profile.variants, selectedVector)}
                vectors={profile.vectors}
                vectorDefs={data.vectors}
                selectedVector={selectedVector}
                included={includedByKey[key] ?? autoIncluded}
                hasVariant={hasVariant}
                onToggleIncluded={handleToggleProfile}
                onBodyChange={handleProfileBodyChange}
                onVectorsChange={onUpdateProfileVectors}
                onResetVariant={onResetProfileVariant}
              />
            )
          })}
        </div>,
        {
          summary: `${filteredProfiles.length} items`,
          onAdd: () => {
            setAddType('profile')
            setAddOpen(true)
          },
          isEmpty: searchQuery ? filteredProfiles.length === 0 : false,
        },
      )}

      {renderSection(
        'skill-groups',
        'Skill Groups',
        <SkillGroupList
          skillGroups={filteredSkillGroups}
          vectorDefs={data.vectors}
          selectedVector={selectedVector}
          includedByKey={includedByKey}
          onReorder={onReorderSkillGroups}
          onUpdate={onUpdateSkillGroup}
          onUpdateVectors={onUpdateSkillGroupVectors}
          onToggleIncluded={handleToggleSkillGroup}
        />,
        {
          summary: `${filteredSkillGroups.length} groups`,
          onAdd: () => {
            setAddType('skill_group')
            setAddOpen(true)
          },
          isEmpty: searchQuery ? filteredSkillGroups.length === 0 : false,
          titleAdornment: <HelpHint text="Skill groups can have vector-specific content and ordering." placement="right" />,
        },
      )}

      {renderSection(
        'roles-bullets',
        'Roles & Bullets',
        <div className="library-grid role-grid">
          {filteredRoles.map((role) => {
            const orderedRole: Role = {
              ...role,
              bullets: reorderById(role.bullets, bulletOrderByRole[role.id]),
            }

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
                onResetOrder={onResetRoleBulletOrder}
                onUpdateRole={onUpdateRole}
                includedByKey={includedByKey}
                onToggleBullet={handleToggleBulletBound}
                onReorder={onReorderBullets}
                onChangeBulletText={handleBulletTextChange}
                onChangeBulletLabel={onUpdateBulletLabel}
                onSetBulletVectors={onUpdateBulletVectors}
                onReframe={onReframeBullet}
                onResetBulletVariant={onResetBulletVariant}
                reframeLoadingId={reframeLoadingId}
                aiEnabled={aiEnabled}
                suggestions={bulletSuggestions}
                onAcceptSuggestion={onAcceptBulletSuggestion}
                onIgnoreSuggestion={onIgnoreBulletSuggestion}
              />
            )
          })}
        </div>,
        {
          summary: `${filteredRoles.length} roles`,
          onAdd: () => {
            setAddType('bullet')
            setAddOpen(true)
          },
          isEmpty: searchQuery ? filteredRoles.length === 0 : false,
          titleAdornment: (
            <HelpHint
              text="Each role has bullets with per-vector priorities. Drag to reorder, toggle to include/exclude."
              placement="right"
            />
          ),
        },
      )}

      {renderSection(
        'projects',
        'Projects',
        <ProjectList
          projects={filteredProjects}
          vectorDefs={data.vectors}
          selectedVector={selectedVector}
          includedByKey={includedByKey}
          onReorder={onReorderProjects}
          onUpdate={handleProjectTextChange}
          onUpdateVectors={onUpdateProjectVectors}
          onToggleIncluded={handleToggleProjectBound}
          onResetVariant={onResetProjectVariant}
        />,
        {
          summary: `${filteredProjects.length} projects`,
          onAdd: () => {
            setAddType('project')
            setAddOpen(true)
          },
          isEmpty: searchQuery ? filteredProjects.length === 0 : false,
        },
      )}

      {renderSection(
        'education',
        'Education',
        <EducationList
          education={filteredEducation}
          includedByKey={includedByKey}
          onReorder={onReorderEducation}
          onUpdate={onUpdateEducation}
          onToggleIncluded={handleToggleEducation}
          onDelete={onDeleteEducation}
        />,
        {
          summary: `${filteredEducation.length} entries`,
          onAdd: () => {
            setAddType('education')
            setAddOpen(true)
          },
          isEmpty: searchQuery ? filteredEducation.length === 0 : false,
        },
      )}

      {renderSection(
        'certifications',
        'Certifications',
        <CertificationList
          certifications={filteredCertifications}
          vectorDefs={data.vectors}
          selectedVector={selectedVector}
          includedByKey={includedByKey}
          onReorder={onReorderCertifications}
          onUpdate={onUpdateCertification}
          onUpdateVectors={onUpdateCertificationVectors}
          onToggleIncluded={handleToggleCertificationBound}
          onDelete={onDeleteCertification}
        />,
        {
          summary: `${filteredCertifications.length} certs`,
          onAdd: () => {
            setAddType('certification')
            setAddOpen(true)
          },
          isEmpty: searchQuery ? filteredCertifications.length === 0 : false,
        },
      )}

      {addOpen ? (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="add-component-title">
          <div className="modal-card" ref={modalRef} tabIndex={-1}>
            <p className="sr-only" aria-live="polite">{addAnnouncement}</p>
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
                <option value="education">Education</option>
                <option value="certification">Certification</option>
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

            {addType === 'education' ? (
              <>
                <label className="field-label">
                  School
                  <input
                    className="component-input compact"
                    value={payload.name ?? ''}
                    onChange={(event) => setPayload((prev) => ({ ...prev, name: event.target.value }))}
                  />
                </label>
                <label className="field-label">
                  Location
                  <input
                    className="component-input compact"
                    value={payload.label ?? ''}
                    onChange={(event) => setPayload((prev) => ({ ...prev, label: event.target.value }))}
                  />
                </label>
                <label className="field-label">
                  Degree
                  <input
                    className="component-input compact"
                    value={payload.text ?? ''}
                    onChange={(event) => setPayload((prev) => ({ ...prev, text: event.target.value }))}
                  />
                </label>
                <label className="field-label">
                  Year
                  <input
                    className="component-input compact"
                    value={payload.url ?? ''}
                    onChange={(event) => setPayload((prev) => ({ ...prev, url: event.target.value }))}
                  />
                </label>
              </>
            ) : null}

            {addType === 'certification' ? (
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
                  Issuer
                  <input
                    className="component-input compact"
                    value={payload.issuer ?? ''}
                    onChange={(event) => setPayload((prev) => ({ ...prev, issuer: event.target.value }))}
                  />
                </label>
                <label className="field-label">
                  Date
                  <input
                    className="component-input compact"
                    value={payload.date ?? ''}
                    onChange={(event) => setPayload((prev) => ({ ...prev, date: event.target.value }))}
                  />
                </label>
                <label className="field-label">
                  Credential ID
                  <input
                    className="component-input compact"
                    value={payload.content ?? ''}
                    onChange={(event) => setPayload((prev) => ({ ...prev, content: event.target.value }))}
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
