import { create } from 'zustand'
import type {
  PriorityByVector,
  ResumeData,
  SkillGroupVectorConfig,
  VectorId,
  EducationEntry,
  CertificationComponent,
  ProjectComponent,
  SkillGroupComponent,
  RoleComponent,
  RoleBulletComponent,
  TargetLineComponent,
  ProfileComponent,
  ComponentPriority,
} from '../types'
import type { ResumeWorkspaceGenerationState } from '../types/resumeGeneration'
import { defaultResumeData } from './defaultData'
import { reorderSkillGroupForSelection } from '../utils/skillGroupVectors'
import { reorderById } from '../utils/reorderById'
import { createId } from '../utils/idUtils'
import { normalizeResumeWorkspaceGeneration } from '../utils/resumeGeneration'
import { ensureDurableMetadata, touchDurableMetadata } from './durableMetadata'
import { useUiStore } from './uiStore'

const MAX_HISTORY = 50

let legacyUiStoreRaw: string | null = null
if (typeof globalThis.localStorage !== 'undefined' && typeof globalThis.localStorage.getItem === 'function') {
  try {
    legacyUiStoreRaw = globalThis.localStorage.getItem('vector-resume-ui')
  } catch {
    legacyUiStoreRaw = null
  }
}

/**
 * ⚠️ Cache legacy UI store data for migration before hydration race condition.
 * We capture this at module load time to ensure we have the data before uiStore 
 * version bump wipes it.
 */
const legacyUiStoreSnapshot = legacyUiStoreRaw

interface ResumeState {
  data: ResumeData
  past: ResumeData[]
  future: ResumeData[]
  setData: (data: ResumeData) => void
  updateData: (fn: (current: ResumeData) => ResumeData) => void
  resetToDefaults: () => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  updateGeneration: (generation: Partial<ResumeWorkspaceGenerationState>) => void
  
  // Positioning actions (Moved from uiStore for Global Undo/Redo)
  setOverride: (vectorId: VectorId | 'all', componentKey: string, included: boolean | null) => void
  resetOverridesForVector: (vectorId: VectorId | 'all') => void
  resetAllOverrides: () => void
  setRoleBulletOrder: (vectorId: VectorId | 'all', roleId: string, order: string[]) => void
  resetRoleBulletOrder: (vectorId: VectorId | 'all', roleId: string) => void

  // Variant actions (implicit vector-aware editing)
  updateTargetLineVariant: (id: string, vectorId: VectorId, text: string) => void
  resetTargetLineVariant: (id: string, vectorId: VectorId) => void
  updateProfileVariant: (id: string, vectorId: VectorId, text: string) => void
  resetProfileVariant: (id: string, vectorId: VectorId) => void
  updateBulletVariant: (roleId: string, bulletId: string, vectorId: VectorId, text: string) => void
  resetBulletVariant: (roleId: string, bulletId: string, vectorId: VectorId) => void
  updateProjectVariant: (id: string, vectorId: VectorId, text: string) => void
  resetProjectVariant: (id: string, vectorId: VectorId) => void

  // Entity Update Actions
  updateMetaField: (field: 'name' | 'email' | 'phone' | 'location', value: string) => void
  updateMetaLink: (index: number, field: 'label' | 'url', value: string) => void
  addMetaLink: () => void
  removeMetaLink: (index: number) => void
  updateTargetLine: (id: string, text: string) => void
  updateTargetLineVectors: (id: string, vectors: PriorityByVector) => void
  updateProfile: (id: string, text: string) => void
  updateProfileVectors: (id: string, vectors: PriorityByVector) => void
  updateProject: (id: string, field: 'name' | 'url' | 'text', value: string) => void
  updateProjectVectors: (id: string, vectors: PriorityByVector) => void
  reorderProjects: (order: string[]) => void
  updateSkillGroup: (id: string, field: 'label' | 'content', value: string) => void
  updateSkillGroupVectors: (id: string, vectors: Record<string, SkillGroupVectorConfig>) => void
  reorderSkillGroups: (order: string[]) => void
  updateRole: (roleId: string, field: 'company' | 'title' | 'dates' | 'location' | 'subtitle', value: string | null) => void
  updateBullet: (roleId: string, bulletId: string, text: string) => void
  updateBulletLabel: (roleId: string, bulletId: string, label: string) => void
  updateBulletVectors: (roleId: string, bulletId: string, vectors: PriorityByVector) => void
  updateVariables: (variables: Record<string, string>) => void

  // Entity Creation Actions (Type-safe)
  addTargetLine: (line: TargetLineComponent) => void
  addProfile: (profile: ProfileComponent) => void
  addSkillGroup: (group: Omit<SkillGroupComponent, 'vectors'>) => void
  addProject: (project: ProjectComponent) => void
  addBullet: (roleId: string, bullet: RoleBulletComponent) => void
  addRole: (role: RoleComponent) => void
  addEducation: (entry: EducationEntry) => void
  updateEducation: (id: string, field: 'school' | 'location' | 'degree' | 'year', value: string) => void
  updateEducationVectors: (id: string, vectors: PriorityByVector) => void
  deleteEducation: (id: string) => void
  reorderEducation: (order: string[]) => void
  addCertification: (cert: CertificationComponent) => void
  updateCertification: (id: string, field: 'name' | 'issuer' | 'date' | 'credential_id' | 'url', value: string) => void
  updateCertificationVectors: (id: string, vectors: PriorityByVector) => void
  deleteCertification: (id: string) => void
  reorderCertifications: (order: string[]) => void
}

const normalizePriorityValue = (value: unknown): ComponentPriority => {
  if (value === 'exclude') {
    return 'exclude'
  }

  return 'include'
}

const normalizePriorityMap = (value: unknown): PriorityByVector => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([vectorId, priority]) => [
      vectorId,
      normalizePriorityValue(priority),
    ]),
  )
}

type PersistedRecord = Record<string, unknown>

const normalizeResumeData = (
  data: ResumeData,
  options: { touch?: boolean } = {},
): ResumeData => {
  const timestamp = new Date().toISOString()

  return {
    ...data,
    generation: normalizeResumeWorkspaceGeneration(data.generation),
    durableMeta: options.touch
      ? touchDurableMetadata(data.durableMeta, timestamp)
      : ensureDurableMetadata(data.durableMeta, timestamp),
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration handles raw persisted state with unknown shape
export function resumeMigration(persistedState: any, version: number, legacyUiData: string | null = legacyUiStoreSnapshot) {
  if (version < 2 && !persistedState.data._overridesMigrated) {
    // Attempt to recover positioning overrides from the old uiStore location
    try {
      if (legacyUiData) {
        const uiStored = JSON.parse(legacyUiData)
        const uiState = uiStored.state
        if (uiState && persistedState.data) {
          persistedState.data = {
            ...persistedState.data,
            manualOverrides: uiState.manualOverrides,
            bulletOrders: uiState.bulletOrders,
            _overridesMigrated: true,
          }
        }
      }
    } catch (e) {
      console.warn('Resume data migration: Failed to pull overrides from uiStore.', e)
    }
  }
  // v2 → v3: rename saved_variants → presets
  if (version < 3 && persistedState.data) {
    if (persistedState.data.saved_variants && !persistedState.data.presets) {
      persistedState.data.presets = persistedState.data.saved_variants
    }
    delete persistedState.data.saved_variants
  }

  // v3 → v4 (implicit or step): backfill EducationEntry.id and RoleComponent.vectors
  // Idempotent — safe to run on all versions; only acts if fields are missing.
  if (version < 4 && persistedState.data) {
    if (persistedState.data.education) {
      persistedState.data.education = persistedState.data.education.map((e: PersistedRecord) => {
        if (!e.id) {
          return { ...e, id: createId('edu') }
        }
        return e
      })
    }
    if (persistedState.data.roles) {
      persistedState.data.roles = persistedState.data.roles.map((r: PersistedRecord) => {
        if (!r.vectors) {
          return { ...r, vectors: {} }
        }
        return r
      })
    }
  }

  // v4 → v5: backfill EducationEntry.vectors and initialize certifications
  if (version < 5 && persistedState.data) {
    if (persistedState.data.education) {
      persistedState.data.education = persistedState.data.education.map((e: PersistedRecord) => {
        if (!e.vectors) {
          return { ...e, vectors: {} }
        }
        return e
      })
    }
    if (!persistedState.data.certifications) {
      persistedState.data.certifications = []
    }
  }

  // v5 -> v6: collapse legacy four-tier priority values into include/exclude
  if (version < 6 && persistedState.data) {
    if (persistedState.data.target_lines) {
      persistedState.data.target_lines = persistedState.data.target_lines.map((line: PersistedRecord) => ({
        ...line,
        vectors: normalizePriorityMap(line.vectors),
      }))
    }
    if (persistedState.data.profiles) {
      persistedState.data.profiles = persistedState.data.profiles.map((profile: PersistedRecord) => ({
        ...profile,
        vectors: normalizePriorityMap(profile.vectors),
      }))
    }
    if (persistedState.data.skill_groups) {
      persistedState.data.skill_groups = persistedState.data.skill_groups.map((group: PersistedRecord) => {
        const vectors =
          group.vectors && typeof group.vectors === 'object'
            ? Object.fromEntries(
                Object.entries(group.vectors as PersistedRecord).map(([vectorId, config]) => [
                  vectorId,
                  {
                    ...(config as PersistedRecord),
                    priority: normalizePriorityValue((config as PersistedRecord).priority),
                  },
                ]),
              )
            : group.vectors

        return {
          ...group,
          vectors,
        }
      })
    }
    if (persistedState.data.roles) {
      persistedState.data.roles = persistedState.data.roles.map((role: PersistedRecord) => ({
        ...role,
        vectors: normalizePriorityMap(role.vectors),
        bullets: Array.isArray(role.bullets)
          ? role.bullets.map((bullet: PersistedRecord) => ({
              ...bullet,
              vectors: normalizePriorityMap(bullet.vectors),
            }))
          : [],
      }))
    }
    if (persistedState.data.projects) {
      persistedState.data.projects = persistedState.data.projects.map((project: PersistedRecord) => ({
        ...project,
        vectors: normalizePriorityMap(project.vectors),
      }))
    }
    if (persistedState.data.education) {
      persistedState.data.education = persistedState.data.education.map((entry: PersistedRecord) => ({
        ...entry,
        vectors: normalizePriorityMap(entry.vectors),
      }))
    }
    if (persistedState.data.certifications) {
      persistedState.data.certifications = persistedState.data.certifications.map((cert: PersistedRecord) => ({
        ...cert,
        vectors: normalizePriorityMap(cert.vectors),
      }))
    }
    if (persistedState.data.presets) {
      persistedState.data.presets = persistedState.data.presets.map((preset: PersistedRecord) => {
        const overrides =
          preset.overrides && typeof preset.overrides === 'object'
            ? (preset.overrides as PersistedRecord)
            : {}
        const priorityOverrides = Array.isArray(overrides.priorityOverrides)
          ? overrides.priorityOverrides.map((override: PersistedRecord) => ({
              ...override,
              priority: normalizePriorityValue(override.priority),
            }))
          : overrides.priorityOverrides

        return {
          ...preset,
          overrides: {
            ...overrides,
            priorityOverrides,
          },
        }
      })
    }
  }

  if (version < 8 && persistedState.data) {
    persistedState.data = normalizeResumeData(persistedState.data)
  }

  return persistedState
}

export const useResumeStore = create<ResumeState>()((set, get) => ({
      data: normalizeResumeData(defaultResumeData),
      past: [],
      future: [],
      canUndo: false,
      canRedo: false,

      updateGeneration: (generation) => {
        get().updateData((current) => ({
          ...current,
          generation: normalizeResumeWorkspaceGeneration({
            ...current.generation,
            ...generation,
          }),
        }))
      },

      setData: (data) => {
        const { data: current } = get()
        if (data === current) return
        get().updateData(() => data)
      },

      updateData: (fn) => {
        const { data: current, past } = get()
        const nextState = fn(current)
        if (nextState === current) return
        const next = normalizeResumeData(nextState, { touch: true })
        set({
          data: next,
          past: [...past, current].slice(-MAX_HISTORY),
          future: [],
          canUndo: true,
          canRedo: false,
        })
      },

      resetToDefaults: () => {
        const { data: current, past } = get()
        set({
          data: normalizeResumeData(defaultResumeData),
          past: [...past, current].slice(-MAX_HISTORY),
          future: [],
          canUndo: true,
          canRedo: false,
        })
      },

      undo: () => {
        const { past, data: current, future } = get()
        const previous = past.at(-1)
        if (!previous) return
        
        const nextPast = past.slice(0, -1)
        set({
          data: previous,
          past: nextPast,
          future: [current, ...future].slice(0, MAX_HISTORY),
          canUndo: nextPast.length > 0,
          canRedo: true,
        })
      },

      redo: () => {
        const { past, data: current, future } = get()
        const next = future.at(0)
        if (!next) return
        
        const nextFuture = future.slice(1)
        set({
          data: next,
          past: [...past, current],
          future: nextFuture,
          canUndo: true,
          canRedo: nextFuture.length > 0,
        })
      },

      setOverride: (vector, componentKey, included) => {
        get().updateData((current) => {
          const manualOverrides = current.manualOverrides ?? {}
          const currentForVector = manualOverrides[vector] ?? {}
          
          let nextForVector: Record<string, boolean>
          if (included === null) {
            nextForVector = { ...currentForVector }
            delete nextForVector[componentKey]
          } else {
            nextForVector = {
              ...currentForVector,
              [componentKey]: included,
            }
          }

          return {
            ...current,
            manualOverrides: {
              ...manualOverrides,
              [vector]: nextForVector,
            },
          }
        })
      },

      resetOverridesForVector: (vector) => {
        get().updateData((current) => {
          const manualOverrides = { ...(current.manualOverrides ?? {}) }
          delete manualOverrides[vector]
          const bulletOrders = { ...(current.bulletOrders ?? {}) }
          delete bulletOrders[vector]

          return {
            ...current,
            manualOverrides,
            bulletOrders,
          }
        })
      },

      resetAllOverrides: () => {
        get().updateData((current) => ({
          ...current,
          manualOverrides: {},
          bulletOrders: {},
        }))
      },

      setRoleBulletOrder: (vector, roleId, order) => {
        get().updateData((current) => {
          const bulletOrders = current.bulletOrders ?? {}
          return {
            ...current,
            bulletOrders: {
              ...bulletOrders,
              [vector]: {
                ...(bulletOrders[vector] ?? {}),
                [roleId]: order,
              },
            },
          }
        })
      },

      resetRoleBulletOrder: (vector, roleId) => {
        get().updateData((current) => {
          const bulletOrders = current.bulletOrders ?? {}
          const currentForVector = bulletOrders[vector] ?? {}
          if (!(roleId in currentForVector)) return current

          const nextForVector = { ...currentForVector }
          delete nextForVector[roleId]
          
          return {
            ...current,
            bulletOrders: {
              ...bulletOrders,
              [vector]: nextForVector,
            },
          }
        })
      },

      // Update implementations
      // Note: We avoid trimming on every onChange to support mid-keystroke spacing.
      // Trimming is handled at creation time or during export/serialization.
      updateMetaField: (field, value) => {
        get().updateData((current) => ({
          ...current,
          meta: { ...current.meta, [field]: value }
        }))
      },

      updateMetaLink: (index, field, value) => {
        get().updateData((current) => ({
          ...current,
          meta: {
            ...current.meta,
            links: current.meta.links.map((link, linkIndex) =>
              linkIndex === index ? { 
                ...link, 
                [field]: field === 'label' ? (value === '' ? undefined : value) : value 
              } : link
            )
          }
        }))
      },

      addMetaLink: () => {
        get().updateData((current) => ({
          ...current,
          meta: { ...current.meta, links: [...current.meta.links, { url: '' }] }
        }))
      },

      removeMetaLink: (index) => {
        get().updateData((current) => ({
          ...current,
          meta: { ...current.meta, links: current.meta.links.filter((_, i) => i !== index) }
        }))
      },

      updateTargetLine: (id, text) => {
        get().updateData((current) => ({
          ...current,
          target_lines: current.target_lines.map((l) => l.id === id ? { ...l, text } : l)
        }))
      },

      updateTargetLineVectors: (id, vectors) => {
        get().updateData((current) => ({
          ...current,
          target_lines: current.target_lines.map((l) => l.id === id ? { ...l, vectors } : l)
        }))
      },

      updateProfile: (id, text) => {
        get().updateData((current) => ({
          ...current,
          profiles: current.profiles.map((p) => p.id === id ? { ...p, text } : p)
        }))
      },

      updateProfileVectors: (id, vectors) => {
        get().updateData((current) => ({
          ...current,
          profiles: current.profiles.map((p) => p.id === id ? { ...p, vectors } : p)
        }))
      },

      updateProject: (id, field, value) => {
        get().updateData((current) => ({
          ...current,
          projects: current.projects.map((p) => 
            p.id === id ? { ...p, [field]: field === 'url' ? (value === '' ? undefined : value) : value } : p
          )
        }))
      },

      updateProjectVectors: (id, vectors) => {
        get().updateData((current) => ({
          ...current,
          projects: current.projects.map((p) => p.id === id ? { ...p, vectors } : p)
        }))
      },

      reorderProjects: (order) => {
        get().updateData((current) => ({
          ...current,
          projects: reorderById(current.projects, order)
        }))
      },

      updateSkillGroup: (id, field, value) => {
        get().updateData((current) => ({
          ...current,
          skill_groups: current.skill_groups.map((group) => {
            if (group.id !== id) return group
            return { ...group, [field]: value }
          })
        }))
      },

      updateSkillGroupVectors: (id, vectors) => {
        get().updateData((current) => ({
          ...current,
          skill_groups: current.skill_groups.map((group) => group.id === id ? { ...group, vectors } : group)
        }))
      },

      reorderSkillGroups: (order) => {
        const { selectedVector } = useUiStore.getState()
        get().updateData((current) => {
          const reordered = reorderById(current.skill_groups, order)
          return {
            ...current,
            skill_groups: reordered.map((skill, index) => 
              reorderSkillGroupForSelection(skill, selectedVector, current.vectors, index + 1)
            )
          }
        })
      },

      updateRole: (roleId, field, value) => {
        get().updateData((current) => ({
          ...current,
          roles: current.roles.map((r) => r.id === roleId ? { ...r, [field]: value } : r)
        }))
      },

      updateBullet: (roleId, bulletId, text) => {
        get().updateData((current) => ({
          ...current,
          roles: current.roles.map((r) => 
            r.id === roleId 
              ? { ...r, bullets: r.bullets.map((b) => b.id === bulletId ? { ...b, text } : b) } 
              : r
          )
        }))
      },

      updateBulletLabel: (roleId, bulletId, label) => {
        get().updateData((current) => ({
          ...current,
          roles: current.roles.map((r) => 
            r.id === roleId 
              ? { ...r, bullets: r.bullets.map((b) => b.id === bulletId ? { ...b, label: label === '' ? undefined : label } : b) } 
              : r
          )
        }))
      },

      updateBulletVectors: (roleId, bulletId, vectors) => {
        get().updateData((current) => ({
          ...current,
          roles: current.roles.map((r) => 
            r.id === roleId 
              ? { ...r, bullets: r.bullets.map((b) => b.id === bulletId ? { ...b, vectors } : b) } 
              : r
          )
        }))
      },

      updateVariables: (variables) => {
        get().updateData((current) => ({
          ...current,
          variables,
        }))
      },

      // Variant update/reset actions
      updateTargetLineVariant: (id, vectorId, text) => {
        get().updateData((current) => ({
          ...current,
          target_lines: current.target_lines.map((l) =>
            l.id === id ? { ...l, variants: { ...(l.variants ?? {}), [vectorId]: text } } : l
          ),
        }))
      },

      resetTargetLineVariant: (id, vectorId) => {
        get().updateData((current) => ({
          ...current,
          target_lines: current.target_lines.map((l) => {
            if (l.id !== id) return l
            const variants = { ...(l.variants ?? {}) }
            delete variants[vectorId]
            return { ...l, variants: Object.keys(variants).length > 0 ? variants : undefined }
          }),
        }))
      },

      updateProfileVariant: (id, vectorId, text) => {
        get().updateData((current) => ({
          ...current,
          profiles: current.profiles.map((p) =>
            p.id === id ? { ...p, variants: { ...(p.variants ?? {}), [vectorId]: text } } : p
          ),
        }))
      },

      resetProfileVariant: (id, vectorId) => {
        get().updateData((current) => ({
          ...current,
          profiles: current.profiles.map((p) => {
            if (p.id !== id) return p
            const variants = { ...(p.variants ?? {}) }
            delete variants[vectorId]
            return { ...p, variants: Object.keys(variants).length > 0 ? variants : undefined }
          }),
        }))
      },

      updateBulletVariant: (roleId, bulletId, vectorId, text) => {
        get().updateData((current) => ({
          ...current,
          roles: current.roles.map((r) =>
            r.id === roleId
              ? {
                  ...r,
                  bullets: r.bullets.map((b) =>
                    b.id === bulletId
                      ? { ...b, variants: { ...(b.variants ?? {}), [vectorId]: text } }
                      : b
                  ),
                }
              : r
          ),
        }))
      },

      resetBulletVariant: (roleId, bulletId, vectorId) => {
        get().updateData((current) => ({
          ...current,
          roles: current.roles.map((r) =>
            r.id === roleId
              ? {
                  ...r,
                  bullets: r.bullets.map((b) => {
                    if (b.id !== bulletId) return b
                    const variants = { ...(b.variants ?? {}) }
                    delete variants[vectorId]
                    return { ...b, variants: Object.keys(variants).length > 0 ? variants : undefined }
                  }),
                }
              : r
          ),
        }))
      },

      updateProjectVariant: (id, vectorId, text) => {
        get().updateData((current) => ({
          ...current,
          projects: current.projects.map((p) =>
            p.id === id ? { ...p, variants: { ...(p.variants ?? {}), [vectorId]: text } } : p
          ),
        }))
      },

      resetProjectVariant: (id, vectorId) => {
        get().updateData((current) => ({
          ...current,
          projects: current.projects.map((p) => {
            if (p.id !== id) return p
            const variants = { ...(p.variants ?? {}) }
            delete variants[vectorId]
            return { ...p, variants: Object.keys(variants).length > 0 ? variants : undefined }
          }),
        }))
      },

      // Creation implementations (Type-safe)
      addTargetLine: (line) => {
        get().updateData((current) => ({
          ...current,
          target_lines: [...current.target_lines, { ...line, text: line.text.trim() }]
        }))
      },

      addProfile: (profile) => {
        get().updateData((current) => ({
          ...current,
          profiles: [...current.profiles, { ...profile, text: profile.text.trim() }]
        }))
      },

      addSkillGroup: (group) => {
        get().updateData((current) => {
          // Resolve vectors and fresh order in the store
          const vectors: Record<string, SkillGroupVectorConfig> = Object.fromEntries(
            current.vectors.map((vector) => [
              vector.id,
              {
                priority: 'include' as ComponentPriority,
                order: current.skill_groups.length + 1,
              },
            ]),
          )
          return {
            ...current,
            skill_groups: [...current.skill_groups, { ...group, label: group.label.trim(), content: group.content.trim(), vectors }]
          }
        })
      },

      addProject: (project) => {
        get().updateData((current) => ({
          ...current,
          projects: [...current.projects, { 
            ...project, 
            name: project.name.trim(), 
            text: project.text.trim(),
            url: project.url?.trim()
          }]
        }))
      },

      addBullet: (roleId, bullet) => {
        get().updateData((current) => {
          if (!current.roles.some(r => r.id === roleId)) return current
          return {
            ...current,
            roles: current.roles.map(r => 
              r.id === roleId ? { ...r, bullets: [...r.bullets, { ...bullet, text: bullet.text.trim() }] } : r
            )
          }
        })
      },

      addRole: (role) => {
        get().updateData((current) => ({
          ...current,
          roles: [...current.roles, { 
            ...role, 
            company: role.company.trim(), 
            title: role.title.trim(),
            dates: role.dates.trim(),
            location: role.location?.trim(),
            subtitle: role.subtitle?.trim(),
          }]
        }))
      },

      addEducation: (entry) => {
        get().updateData((current) => ({
          ...current,
          education: [...current.education, {
            ...entry,
            school: entry.school.trim(),
            degree: entry.degree.trim(),
            location: entry.location.trim(),
            year: entry.year?.trim(),
            vectors: entry.vectors ?? {},
          }]
        }))
      },

      updateEducation: (id, field, value) => {
        get().updateData((current) => ({
          ...current,
          education: current.education.map((e) =>
            e.id === id ? { ...e, [field]: field === 'year' ? (value === '' ? undefined : value) : value } : e
          )
        }))
      },

      updateEducationVectors: (id, vectors) => {
        get().updateData((current) => ({
          ...current,
          education: current.education.map((e) => e.id === id ? { ...e, vectors } : e)
        }))
      },

      deleteEducation: (id) => {
        get().updateData((current) => ({
          ...current,
          education: current.education.filter((e) => e.id !== id)
        }))
      },

      reorderEducation: (order) => {
        get().updateData((current) => ({
          ...current,
          education: reorderById(current.education, order)
        }))
      },

      addCertification: (cert) => {
        get().updateData((current) => ({
          ...current,
          certifications: [...(current.certifications ?? []), {
            ...cert,
            name: cert.name.trim(),
            issuer: cert.issuer.trim(),
            date: cert.date?.trim(),
            credential_id: cert.credential_id?.trim(),
            url: cert.url?.trim(),
          }]
        }))
      },

      updateCertification: (id, field, value) => {
        get().updateData((current) => ({
          ...current,
          certifications: (current.certifications ?? []).map((c) =>
            c.id === id ? { ...c, [field]: value === '' ? undefined : value } : c
          )
        }))
      },

      updateCertificationVectors: (id, vectors) => {
        get().updateData((current) => ({
          ...current,
          certifications: (current.certifications ?? []).map((c) => c.id === id ? { ...c, vectors } : c)
        }))
      },

      deleteCertification: (id) => {
        get().updateData((current) => ({
          ...current,
          certifications: (current.certifications ?? []).filter((c) => c.id !== id)
        }))
      },

      reorderCertifications: (order) => {
        get().updateData((current) => ({
          ...current,
          certifications: reorderById(current.certifications ?? [], order)
        }))
      },
    }))
