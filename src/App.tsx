import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Copy, Download, FileDown, FileJson, Upload } from 'lucide-react'
import './index.css'
import type { PriorityByVector, ResumeData } from './types'
import { assembleResume, getPriorityForVector } from './engine/assembler'
import { renderResumeAsText } from './utils/textRenderer'
import { renderResumeAsMarkdown } from './utils/markdownRenderer'
import { useResumeStore } from './store/resumeStore'
import { toVectorKey, useUiStore } from './store/uiStore'
import { componentKeys } from './utils/componentKeys'
import { VectorBar } from './components/VectorBar'
import { ComponentLibrary } from './components/ComponentLibrary'
import { LivePreview } from './components/LivePreview'
import { StatusBar } from './components/StatusBar'
import { ImportExport } from './components/ImportExport'
import { reorderById } from './utils/reorderById'
import { defaultVectorsForSelection } from './utils/vectorPriority'

const vectorFallbackColors = ['#2563EB', '#0D9488', '#7C3AED', '#EA580C', '#4F46E5', '#0891B2']

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function createId(prefix: string) {
  const uuid = globalThis.crypto?.randomUUID?.()
  if (uuid) {
    return `${prefix}-${uuid}`
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function App() {
  const { data, setData } = useResumeStore()
  const {
    selectedVector,
    setSelectedVector,
    panelRatio,
    setPanelRatio,
    manualOverrides,
    variantOverrides,
    resetOverridesForVector,
    setOverride,
    setVariantOverride,
    bulletOrders,
    setRoleBulletOrder,
  } = useUiStore()

  const [draggingSplit, setDraggingSplit] = useState(false)
  const [importExportMode, setImportExportMode] = useState<'import' | 'export' | null>(null)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)
  const noticeTimeoutRef = useRef<number | null>(null)

  const vectorKey = toVectorKey(selectedVector)
  const overridesForVector = useMemo(
    () => manualOverrides[vectorKey] ?? {},
    [manualOverrides, vectorKey],
  )
  const variantsForVector = useMemo(
    () => variantOverrides[vectorKey] ?? {},
    [variantOverrides, vectorKey],
  )

  const assembledResult = useMemo(
    () =>
      assembleResume(data, {
        selectedVector,
        manualOverrides: overridesForVector,
        variantOverrides: variantsForVector,
        bulletOrderByRole: bulletOrders[vectorKey] ?? {},
        targetPages: 2,
      }),
    [data, selectedVector, overridesForVector, variantsForVector, bulletOrders, vectorKey],
  )

  useEffect(() => {
    if (!draggingSplit) {
      return
    }

    const onMouseMove = (event: MouseEvent) => {
      const next = Math.min(0.7, Math.max(0.3, event.clientX / window.innerWidth))
      setPanelRatio(next)
    }

    const onMouseUp = () => setDraggingSplit(false)

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)

    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [draggingSplit, setPanelRatio])

  const showNotice = (tone: 'success' | 'error', message: string) => {
    if (noticeTimeoutRef.current !== null) {
      window.clearTimeout(noticeTimeoutRef.current)
    }
    setNotice({ tone, message })
    noticeTimeoutRef.current = window.setTimeout(() => {
      setNotice(null)
      noticeTimeoutRef.current = null
    }, 2500)
  }

  useEffect(
    () => () => {
      if (noticeTimeoutRef.current !== null) {
        window.clearTimeout(noticeTimeoutRef.current)
      }
    },
    [],
  )

  const toggleComponentWithPriority = (componentKey: string, vectors: PriorityByVector) => {
    const autoIncluded = getPriorityForVector(vectors, selectedVector) !== 'exclude'
    const currentOverride = overridesForVector[componentKey]
    const currentIncluded = currentOverride ?? autoIncluded
    const nextIncluded = !currentIncluded
    if (nextIncluded === autoIncluded) {
      setOverride(vectorKey, componentKey, null)
      return
    }
    setOverride(vectorKey, componentKey, nextIncluded)
  }

  const updateData = (fn: (current: ResumeData) => ResumeData) => {
    setData(fn(data))
  }

  const onDownloadDocx = async () => {
    try {
      const { renderResumeAsDocx } = await import('./utils/docxRenderer')
      const blob = await renderResumeAsDocx(assembledResult.resume)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `vector-resume-${selectedVector}.docx`
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 10000)
      showNotice('success', 'DOCX downloaded')
    } catch {
      showNotice('error', 'Unable to generate DOCX. Please try again.')
    }
  }

  const onCopyText = async () => {
    try {
      await navigator.clipboard.writeText(renderResumeAsText(assembledResult.resume))
      showNotice('success', 'Copied plain text')
    } catch {
      showNotice('error', 'Clipboard write failed for plain text.')
    }
  }

  const onCopyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(renderResumeAsMarkdown(assembledResult.resume))
      showNotice('success', 'Copied Markdown')
    } catch {
      showNotice('error', 'Clipboard write failed for Markdown.')
    }
  }

  const onAddVector = () => {
    const label = window.prompt('Vector label')?.trim()
    if (!label) {
      return
    }

    const id = slugify(label)
    if (!id) {
      window.alert('Label must contain at least one alphanumeric character.')
      return
    }
    const alreadyExists = data.vectors.some((vector) => vector.id === id)
    if (alreadyExists) {
      window.alert('Vector id already exists. Choose a unique label.')
      return
    }

    const color =
      vectorFallbackColors[data.vectors.length % vectorFallbackColors.length] ?? vectorFallbackColors[0]

    updateData((current) => ({
      ...current,
      vectors: [...current.vectors, { id, label, color }],
    }))
    setSelectedVector(id)
  }

  const onAddComponent = (
    type: 'target_line' | 'profile' | 'skill_group' | 'project' | 'bullet',
    payload: {
      text?: string
      label?: string
      content?: string
      name?: string
      url?: string
      roleId?: string
      vectors?: PriorityByVector
    },
  ) => {
    const baseVectors = payload.vectors ?? defaultVectorsForSelection(selectedVector, data.vectors)

    if (type === 'target_line') {
      updateData((current) => ({
        ...current,
        target_lines: [
          ...current.target_lines,
          {
            id: createId('target-line'),
            vectors: baseVectors,
            text: payload.text?.trim() ?? '',
          },
        ],
      }))
      return
    }

    if (type === 'profile') {
      updateData((current) => ({
        ...current,
        profiles: [
          ...current.profiles,
          {
            id: createId('profile'),
            vectors: baseVectors,
            text: payload.text?.trim() ?? '',
          },
        ],
      }))
      return
    }

    if (type === 'skill_group') {
      updateData((current) => ({
        ...current,
        skill_groups: [
          ...current.skill_groups,
          {
            id: createId('skill'),
            label: payload.label?.trim() || 'New Skill Group',
            content: payload.content?.trim() ?? '',
            // Skill groups are ordered per-vector, but they are not included/excluded per-vector.
            order: {
              default: current.skill_groups.length + 1,
            },
          },
        ],
      }))
      return
    }

    if (type === 'project') {
      updateData((current) => ({
        ...current,
        projects: [
          ...current.projects,
          {
            id: createId('project'),
            name: payload.name?.trim() || 'New Project',
            url: payload.url?.trim() || undefined,
            vectors: baseVectors,
            text: payload.text?.trim() ?? '',
          },
        ],
      }))
      return
    }

    if (type === 'bullet') {
      const targetRoleId = payload.roleId ?? data.roles[0]?.id
      if (!targetRoleId) {
        return
      }

      updateData((current) => ({
        ...current,
        roles: current.roles.map((role) =>
          role.id === targetRoleId
            ? {
                ...role,
                bullets: [
                  ...role.bullets,
                  {
                    id: createId('bullet'),
                    vectors: baseVectors,
                    text: payload.text?.trim() ?? '',
                  },
                ],
              }
            : role,
        ),
      }))
    }
  }

  const handleRoleBulletReorder = (roleId: string, order: string[]) => {
    setRoleBulletOrder(vectorKey, roleId, order)
  }

  const onSplitterKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      setPanelRatio(Math.min(0.7, Math.max(0.3, panelRatio - 0.03)))
      return
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault()
      setPanelRatio(Math.min(0.7, Math.max(0.3, panelRatio + 0.03)))
      return
    }

    if (event.key === 'Home') {
      event.preventDefault()
      setPanelRatio(0.3)
      return
    }

    if (event.key === 'End') {
      event.preventDefault()
      setPanelRatio(0.7)
    }
  }

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div>
          <h1>Vector Resume</h1>
          <p>Strategic resume assembly for multi-vector applications.</p>
        </div>
        <div className="top-bar-actions">
          <button className="btn-secondary" type="button" onClick={() => setImportExportMode('import')}>
            <Upload size={16} />
            Import
          </button>
          <button className="btn-secondary" type="button" onClick={() => setImportExportMode('export')}>
            <FileJson size={16} />
            Export
          </button>
          <button className="btn-secondary" type="button" onClick={onCopyText}>
            <Copy size={16} />
            Copy Text
          </button>
          <button className="btn-secondary" type="button" onClick={onCopyMarkdown}>
            <FileDown size={16} />
            Copy Markdown
          </button>
          <button className="btn-primary" type="button" onClick={onDownloadDocx}>
            <Download size={16} />
            Download DOCX
          </button>
        </div>
      </header>

      <VectorBar
        vectors={data.vectors}
        selectedVector={selectedVector}
        onSelect={setSelectedVector}
        onAddVector={onAddVector}
        onResetAuto={() => resetOverridesForVector(vectorKey)}
      />

      {!data.vectors.length ? (
        <main className="empty-state-wrap">
          <div className="empty-state">
            <h2>No vectors yet.</h2>
            <p>Import a YAML config or start adding components to build your resume library.</p>
            <div className="empty-actions">
              <button className="btn-primary" type="button" onClick={() => setImportExportMode('import')}>
                Import YAML
              </button>
              <button className="btn-secondary" type="button" onClick={onAddVector}>
                Start from Scratch
              </button>
            </div>
          </div>
        </main>
      ) : (
        <main className="workspace">
          <section className="library-column" style={{ width: `${panelRatio * 100}%` }}>
            <ComponentLibrary
              data={data}
              selectedVector={selectedVector}
              includedByKey={overridesForVector}
              variantByKey={variantsForVector}
              bulletOrderByRole={bulletOrders[vectorKey] ?? {}}
              onToggleComponent={toggleComponentWithPriority}
              onSetVariant={(componentKey, variant) => setVariantOverride(vectorKey, componentKey, variant)}
              onUpdateTargetLine={(id, text) =>
                updateData((current) => ({
                  ...current,
                  target_lines: current.target_lines.map((line) =>
                    line.id === id ? { ...line, text } : line,
                  ),
                }))
              }
              onUpdateTargetLineVectors={(id, vectors) =>
                updateData((current) => ({
                  ...current,
                  target_lines: current.target_lines.map((line) =>
                    line.id === id ? { ...line, vectors } : line,
                  ),
                }))
              }
              onUpdateProfile={(id, text) =>
                updateData((current) => ({
                  ...current,
                  profiles: current.profiles.map((profile) =>
                    profile.id === id ? { ...profile, text } : profile,
                  ),
                }))
              }
              onUpdateProfileVectors={(id, vectors) =>
                updateData((current) => ({
                  ...current,
                  profiles: current.profiles.map((profile) =>
                    profile.id === id ? { ...profile, vectors } : profile,
                  ),
                }))
              }
              onUpdateProject={(id, field, value) =>
                updateData((current) => ({
                  ...current,
                  projects: current.projects.map((project) =>
                    project.id === id ? { ...project, [field]: field === 'url' ? value || undefined : value } : project,
                  ),
                }))
              }
              onUpdateProjectVectors={(id, vectors) =>
                updateData((current) => ({
                  ...current,
                  projects: current.projects.map((project) =>
                    project.id === id ? { ...project, vectors } : project,
                  ),
                }))
              }
              onUpdateSkillGroup={(id, field, value) =>
                updateData((current) => ({
                  ...current,
                  skill_groups: current.skill_groups.map((skillGroup) =>
                    skillGroup.id === id ? { ...skillGroup, [field]: value } : skillGroup,
                  ),
                }))
              }
              onReorderSkillGroups={(order) =>
                updateData((current) => {
                  const reordered = reorderById(current.skill_groups, order)
                  return {
                    ...current,
                    skill_groups: reordered.map((skill, index) => {
                      const orderKey = selectedVector === 'all' ? 'default' : selectedVector
                      return {
                        ...skill,
                        order: {
                          ...skill.order,
                          [orderKey]: index + 1,
                        },
                      }
                    }),
                  }
                })
              }
              onUpdateBullet={(roleId, bulletId, text) =>
                updateData((current) => ({
                  ...current,
                  roles: current.roles.map((role) =>
                    role.id !== roleId
                      ? role
                      : {
                          ...role,
                          bullets: role.bullets.map((bullet) =>
                            bullet.id === bulletId ? { ...bullet, text } : bullet,
                          ),
                        },
                  ),
                }))
              }
              onUpdateBulletVectors={(roleId, bulletId, vectors) =>
                updateData((current) => ({
                  ...current,
                  roles: current.roles.map((role) =>
                    role.id !== roleId
                      ? role
                      : {
                          ...role,
                          bullets: role.bullets.map((bullet) =>
                            bullet.id === bulletId ? { ...bullet, vectors } : bullet,
                          ),
                        },
                  ),
                }))
              }
              onToggleBullet={(roleId, bulletId, vectors) =>
                toggleComponentWithPriority(componentKeys.bullet(roleId, bulletId), vectors)
              }
              onReorderBullets={handleRoleBulletReorder}
              onAddComponent={onAddComponent}
            />
          </section>

          <div
            className="splitter"
            role="separator"
            tabIndex={0}
            aria-label="Resize panels"
            aria-orientation="vertical"
            aria-valuemin={30}
            aria-valuemax={70}
            aria-valuenow={Math.round(panelRatio * 100)}
            onMouseDown={() => setDraggingSplit(true)}
            onKeyDown={onSplitterKeyDown}
          />

          <section className="preview-column" style={{ width: `${(1 - panelRatio) * 100}%` }}>
            <LivePreview assembled={assembledResult.resume} />
          </section>
        </main>
      )}

      <StatusBar
        pageCount={assembledResult.estimatedPages}
        bulletCount={assembledResult.resume.roles.reduce((acc, role) => acc + role.bullets.length, 0)}
        skillGroupCount={assembledResult.resume.skillGroups.length}
        overBudget={assembledResult.warnings.length > 0}
        mustOverBudget={assembledResult.warnings.some((warning) => warning.code === 'must_over_budget')}
      />

      <ImportExport
        key={importExportMode ?? 'closed'}
        open={importExportMode !== null}
        mode={importExportMode ?? 'import'}
        data={data}
        onClose={() => setImportExportMode(null)}
        onImport={(nextData) => setData(nextData)}
      />
      {notice ? (
        <div
          className={`toast ${notice.tone}`}
          role={notice.tone === 'error' ? 'alert' : 'status'}
          aria-live={notice.tone === 'error' ? 'assertive' : 'polite'}
        >
          {notice.message}
        </div>
      ) : null}
    </div>
  )
}

export default App
