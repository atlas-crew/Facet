import {
  SOFTWARE_ENGINEERING_SKILL_CATEGORIES,
  type ProfessionalSkillProvenance,
} from '../identity/schema'

export type EditableSkillProvenance = ProfessionalSkillProvenance | ''

export const resolveCorrectedSkillProvenance = ({
  draftProvenance,
  currentProvenance,
  taxonomyDetailChanged,
}: {
  draftProvenance: EditableSkillProvenance
  currentProvenance?: ProfessionalSkillProvenance
  taxonomyDetailChanged: boolean
}): ProfessionalSkillProvenance | undefined => {
  const provenanceChanged = draftProvenance !== (currentProvenance ?? '')
  if (provenanceChanged || !taxonomyDetailChanged) {
    return draftProvenance || undefined
  }

  return 'corrected'
}

export const getSkillCategoryLabel = (category: string | undefined): string | undefined => {
  if (!category) return undefined

  return (
    SOFTWARE_ENGINEERING_SKILL_CATEGORIES.find((entry) => entry.id === category)?.label ?? category
  )
}
