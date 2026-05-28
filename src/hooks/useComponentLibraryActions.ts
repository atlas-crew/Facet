import { useCallback, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type {
  AddComponentPayload,
  AddComponentType,
  PriorityByVector,
  ResumeData,
  SkillGroupVectorConfig,
  VectorSelection,
} from '../types'
import { getPriorityForVector } from '../engine/assembler'
import { useResumeStore } from '../store/resumeStore'
import { componentKeys } from '../utils/componentKeys'
import { createId } from '../utils/idUtils'

const CURRENT_YEAR = new Date().getFullYear()

const ID_MAP: Record<AddComponentType, string> = {
  target_line: 'target-line',
  profile: 'profile',
  skill_group: 'skill',
  project: 'project',
  bullet: 'bullet',
  role: 'role',
  education: 'education',
  certification: 'cert',
}

interface UseComponentLibraryActionsOptions {
  data: Pick<ResumeData, 'roles'>
  selectedVector: VectorSelection
  vectorKey: VectorSelection
  overridesForVector: Record<string, boolean>
}

export interface ComponentLibraryActions {
  toggleComponent: (componentKey: string, vectors: PriorityByVector) => void
  updateTargetLine: (id: string, text: string) => void
  updateTargetLineVectors: (id: string, vectors: PriorityByVector) => void
  updateTargetLineVariant: (id: string, text: string) => void
  resetTargetLineVariant: (id: string) => void
  updateProfile: (id: string, text: string) => void
  updateProfileVectors: (id: string, vectors: PriorityByVector) => void
  updateProfileVariant: (id: string, text: string) => void
  resetProfileVariant: (id: string) => void
  updateProject: (id: string, field: 'name' | 'url' | 'text', value: string) => void
  updateProjectVectors: (id: string, vectors: PriorityByVector) => void
  updateProjectVariant: (id: string, text: string) => void
  resetProjectVariant: (id: string) => void
  reorderProjects: (order: string[]) => void
  updateSkillGroup: (id: string, field: 'label' | 'content', value: string) => void
  updateSkillGroupVectors: (id: string, vectors: Record<string, SkillGroupVectorConfig>) => void
  reorderSkillGroups: (order: string[]) => void
  updateRole: (
    roleId: string,
    field: 'company' | 'title' | 'dates' | 'location' | 'subtitle',
    value: string | null,
  ) => void
  updateBullet: (roleId: string, bulletId: string, text: string) => void
  updateBulletLabel: (roleId: string, bulletId: string, label: string) => void
  updateBulletVectors: (roleId: string, bulletId: string, vectors: PriorityByVector) => void
  updateBulletVariant: (roleId: string, bulletId: string, text: string) => void
  resetBulletVariant: (roleId: string, bulletId: string) => void
  toggleBullet: (roleId: string, bulletId: string, vectors: PriorityByVector) => void
  reorderBullets: (roleId: string, order: string[]) => void
  resetRoleBulletOrder: (roleId: string) => void
  addComponent: (type: AddComponentType, payload: AddComponentPayload) => void
  updateMetaField: (field: 'name' | 'email' | 'phone' | 'location', value: string) => void
  updateMetaLink: (index: number, field: 'label' | 'url', value: string) => void
  addMetaLink: () => void
  removeMetaLink: (index: number) => void
  updateEducation: (
    id: string,
    field: 'school' | 'location' | 'degree' | 'year',
    value: string,
  ) => void
  toggleEducation: (id: string) => void
  deleteEducation: (id: string) => void
  reorderEducation: (order: string[]) => void
  updateCertification: (
    id: string,
    field: 'name' | 'issuer' | 'date' | 'credential_id' | 'url',
    value: string,
  ) => void
  updateCertificationVectors: (id: string, vectors: PriorityByVector) => void
  deleteCertification: (id: string) => void
  reorderCertifications: (order: string[]) => void
}

export function useComponentLibraryActions({
  data,
  selectedVector,
  vectorKey,
  overridesForVector,
}: UseComponentLibraryActionsOptions): ComponentLibraryActions {
  const {
    addBullet,
    addCertification,
    addEducation,
    addMetaLink,
    addProfile,
    addProject,
    addRole,
    addSkillGroup,
    addTargetLine,
    deleteCertification,
    deleteEducation,
    removeMetaLink,
    reorderCertifications,
    reorderEducation,
    reorderProjects,
    reorderSkillGroups,
    resetBulletVariantStore,
    resetProfileVariantStore,
    resetProjectVariantStore,
    resetRoleBulletOrderStore,
    resetTargetLineVariantStore,
    setOverride,
    setRoleBulletOrder,
    updateBullet,
    updateBulletLabel,
    updateBulletVariantStore,
    updateBulletVectors,
    updateCertification,
    updateCertificationVectors,
    updateEducation,
    updateMetaField,
    updateMetaLink,
    updateProfile,
    updateProfileVariantStore,
    updateProfileVectors,
    updateProject,
    updateProjectVariantStore,
    updateProjectVectors,
    updateRole,
    updateSkillGroup,
    updateSkillGroupVectors,
    updateTargetLine,
    updateTargetLineVariantStore,
    updateTargetLineVectors,
  } = useResumeStore(
    useShallow((state) => ({
      addBullet: state.addBullet,
      addCertification: state.addCertification,
      addEducation: state.addEducation,
      addMetaLink: state.addMetaLink,
      addProfile: state.addProfile,
      addProject: state.addProject,
      addRole: state.addRole,
      addSkillGroup: state.addSkillGroup,
      addTargetLine: state.addTargetLine,
      deleteCertification: state.deleteCertification,
      deleteEducation: state.deleteEducation,
      removeMetaLink: state.removeMetaLink,
      reorderCertifications: state.reorderCertifications,
      reorderEducation: state.reorderEducation,
      reorderProjects: state.reorderProjects,
      reorderSkillGroups: state.reorderSkillGroups,
      resetBulletVariantStore: state.resetBulletVariant,
      resetProfileVariantStore: state.resetProfileVariant,
      resetProjectVariantStore: state.resetProjectVariant,
      resetRoleBulletOrderStore: state.resetRoleBulletOrder,
      resetTargetLineVariantStore: state.resetTargetLineVariant,
      setOverride: state.setOverride,
      setRoleBulletOrder: state.setRoleBulletOrder,
      updateBullet: state.updateBullet,
      updateBulletLabel: state.updateBulletLabel,
      updateBulletVariantStore: state.updateBulletVariant,
      updateBulletVectors: state.updateBulletVectors,
      updateCertification: state.updateCertification,
      updateCertificationVectors: state.updateCertificationVectors,
      updateEducation: state.updateEducation,
      updateMetaField: state.updateMetaField,
      updateMetaLink: state.updateMetaLink,
      updateProfile: state.updateProfile,
      updateProfileVariantStore: state.updateProfileVariant,
      updateProfileVectors: state.updateProfileVectors,
      updateProject: state.updateProject,
      updateProjectVariantStore: state.updateProjectVariant,
      updateProjectVectors: state.updateProjectVectors,
      updateRole: state.updateRole,
      updateSkillGroup: state.updateSkillGroup,
      updateSkillGroupVectors: state.updateSkillGroupVectors,
      updateTargetLine: state.updateTargetLine,
      updateTargetLineVariantStore: state.updateTargetLineVariant,
      updateTargetLineVectors: state.updateTargetLineVectors,
    })),
  )

  const toggleComponent = useCallback(
    (componentKey: string, vectors: PriorityByVector) => {
      const autoIncluded = getPriorityForVector(vectors, selectedVector) !== 'exclude'
      const currentOverride = overridesForVector[componentKey]
      const currentIncluded = currentOverride ?? autoIncluded
      const nextIncluded = !currentIncluded

      setOverride(vectorKey, componentKey, nextIncluded === autoIncluded ? null : nextIncluded)
    },
    [overridesForVector, selectedVector, setOverride, vectorKey],
  )

  const toggleEducation = useCallback(
    (id: string) => {
      const componentKey = componentKeys.education(id)
      const currentOverride = overridesForVector[componentKey]
      const currentIncluded = currentOverride ?? true
      const nextIncluded = !currentIncluded

      setOverride(vectorKey, componentKey, nextIncluded ? null : false)
    },
    [overridesForVector, setOverride, vectorKey],
  )

  const updateTargetLineVariant = useCallback(
    (id: string, text: string) => {
      if (selectedVector === 'all') {
        updateTargetLine(id, text)
        return
      }
      updateTargetLineVariantStore(id, selectedVector, text)
    },
    [selectedVector, updateTargetLine, updateTargetLineVariantStore],
  )

  const resetTargetLineVariant = useCallback(
    (id: string) => {
      if (selectedVector !== 'all') {
        resetTargetLineVariantStore(id, selectedVector)
      }
    },
    [resetTargetLineVariantStore, selectedVector],
  )

  const updateProfileVariant = useCallback(
    (id: string, text: string) => {
      if (selectedVector === 'all') {
        updateProfile(id, text)
        return
      }
      updateProfileVariantStore(id, selectedVector, text)
    },
    [selectedVector, updateProfile, updateProfileVariantStore],
  )

  const resetProfileVariant = useCallback(
    (id: string) => {
      if (selectedVector !== 'all') {
        resetProfileVariantStore(id, selectedVector)
      }
    },
    [resetProfileVariantStore, selectedVector],
  )

  const updateProjectVariant = useCallback(
    (id: string, text: string) => {
      if (selectedVector === 'all') {
        updateProject(id, 'text', text)
        return
      }
      updateProjectVariantStore(id, selectedVector, text)
    },
    [selectedVector, updateProject, updateProjectVariantStore],
  )

  const resetProjectVariant = useCallback(
    (id: string) => {
      if (selectedVector !== 'all') {
        resetProjectVariantStore(id, selectedVector)
      }
    },
    [resetProjectVariantStore, selectedVector],
  )

  const updateBulletVariant = useCallback(
    (roleId: string, bulletId: string, text: string) => {
      if (selectedVector === 'all') {
        updateBullet(roleId, bulletId, text)
        return
      }
      updateBulletVariantStore(roleId, bulletId, selectedVector, text)
    },
    [selectedVector, updateBullet, updateBulletVariantStore],
  )

  const resetBulletVariant = useCallback(
    (roleId: string, bulletId: string) => {
      if (selectedVector !== 'all') {
        resetBulletVariantStore(roleId, bulletId, selectedVector)
      }
    },
    [resetBulletVariantStore, selectedVector],
  )

  const toggleBullet = useCallback(
    (roleId: string, bulletId: string, vectors: PriorityByVector) => {
      toggleComponent(componentKeys.bullet(roleId, bulletId), vectors)
    },
    [toggleComponent],
  )

  const reorderBullets = useCallback(
    (roleId: string, order: string[]) => {
      setRoleBulletOrder(vectorKey, roleId, order)
    },
    [setRoleBulletOrder, vectorKey],
  )

  const resetRoleBulletOrder = useCallback(
    (roleId: string) => {
      resetRoleBulletOrderStore(vectorKey, roleId)
    },
    [resetRoleBulletOrderStore, vectorKey],
  )

  const addComponent = useCallback(
    (type: AddComponentType, payload: AddComponentPayload) => {
      const id = createId(ID_MAP[type])
      const baseVectors = payload.vectors ?? { [vectorKey]: 'include' as const }

      switch (type) {
        case 'target_line':
          addTargetLine({ id, vectors: baseVectors, text: (payload.text ?? '').trim() })
          break
        case 'profile':
          addProfile({ id, vectors: baseVectors, text: (payload.text ?? '').trim() })
          break
        case 'skill_group':
          addSkillGroup({
            id,
            label: payload.label?.trim() || 'New Skill Group',
            content: (payload.content ?? '').trim(),
          })
          break
        case 'project':
          addProject({
            id,
            name: payload.name?.trim() || 'New Project',
            url: payload.url?.trim() || undefined,
            vectors: baseVectors,
            text: (payload.text ?? '').trim(),
          })
          break
        case 'bullet': {
          const targetRoleId = payload.roleId ?? data.roles[0]?.id
          if (!targetRoleId) return
          addBullet(targetRoleId, {
            id,
            vectors: baseVectors,
            text: (payload.text ?? '').trim(),
          })
          break
        }
        case 'role':
          addRole({
            id,
            company: 'New Company',
            title: 'Role Title',
            dates: 'Jan 2024 – Present',
            vectors: { [vectorKey]: 'include' },
            bullets: [],
          })
          break
        case 'education':
          addEducation({
            id,
            school: payload.name?.trim() || 'New School',
            location: payload.label?.trim() || 'Location',
            degree: payload.text?.trim() || 'Degree',
            year: payload.url?.trim() || CURRENT_YEAR.toString(),
            vectors: {},
          })
          break
        case 'certification':
          addCertification({
            id,
            name: payload.name?.trim() || 'New Certification',
            issuer: payload.issuer?.trim() || 'Issuer',
            date: payload.date?.trim() || undefined,
            credential_id: payload.content?.trim() || undefined,
            url: payload.url?.trim() || undefined,
            vectors: baseVectors,
          })
          break
      }
    },
    [
      addBullet,
      addCertification,
      addEducation,
      addProfile,
      addProject,
      addRole,
      addSkillGroup,
      addTargetLine,
      data.roles,
      vectorKey,
    ],
  )

  return useMemo(
    () => ({
      toggleComponent,
      updateTargetLine,
      updateTargetLineVectors,
      updateTargetLineVariant,
      resetTargetLineVariant,
      updateProfile,
      updateProfileVectors,
      updateProfileVariant,
      resetProfileVariant,
      updateProject,
      updateProjectVectors,
      updateProjectVariant,
      resetProjectVariant,
      reorderProjects,
      updateSkillGroup,
      updateSkillGroupVectors,
      reorderSkillGroups,
      updateRole,
      updateBullet,
      updateBulletLabel,
      updateBulletVectors,
      updateBulletVariant,
      resetBulletVariant,
      toggleBullet,
      reorderBullets,
      resetRoleBulletOrder,
      addComponent,
      updateMetaField,
      updateMetaLink,
      addMetaLink,
      removeMetaLink,
      updateEducation,
      toggleEducation,
      deleteEducation,
      reorderEducation,
      updateCertification,
      updateCertificationVectors,
      deleteCertification,
      reorderCertifications,
    }),
    [
      addComponent,
      addMetaLink,
      deleteCertification,
      deleteEducation,
      removeMetaLink,
      reorderBullets,
      reorderCertifications,
      reorderEducation,
      reorderProjects,
      reorderSkillGroups,
      resetBulletVariant,
      resetProfileVariant,
      resetProjectVariant,
      resetRoleBulletOrder,
      resetTargetLineVariant,
      toggleBullet,
      toggleComponent,
      toggleEducation,
      updateBullet,
      updateBulletLabel,
      updateBulletVariant,
      updateBulletVectors,
      updateCertification,
      updateCertificationVectors,
      updateEducation,
      updateMetaField,
      updateMetaLink,
      updateProfile,
      updateProfileVariant,
      updateProfileVectors,
      updateProject,
      updateProjectVariant,
      updateProjectVectors,
      updateRole,
      updateSkillGroup,
      updateSkillGroupVectors,
      updateTargetLine,
      updateTargetLineVariant,
      updateTargetLineVectors,
    ],
  )
}
