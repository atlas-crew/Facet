import type {
  ComponentPriority,
  ResumeVector,
  SkillGroupComponent,
  SkillGroupVectorConfig,
  VectorSelection,
} from '../types'

const DEFAULT_SKILL_PRIORITY: ComponentPriority = 'include'

const getLegacyOrder = (
  skillGroup: SkillGroupComponent,
  vectorId: string,
  fallbackOrder: number,
): number => {
  const value = skillGroup.order?.[vectorId] ?? skillGroup.order?.default
  return typeof value === 'number' ? value : fallbackOrder
}

export const ensureSkillGroupVectors = (
  skillGroup: SkillGroupComponent,
  vectors: ResumeVector[],
): Record<string, SkillGroupVectorConfig> =>
  Object.fromEntries(
    vectors.map((vector, index) => {
      const current = skillGroup.vectors?.[vector.id]
      const fallbackOrder = index + 1
      return [
        vector.id,
        {
          priority: current?.priority ?? DEFAULT_SKILL_PRIORITY,
          order: current?.order ?? getLegacyOrder(skillGroup, vector.id, fallbackOrder),
          content: current?.content,
        },
      ]
    }),
  )

export const reorderSkillGroupForSelection = (
  skillGroup: SkillGroupComponent,
  selectedVector: VectorSelection,
  vectors: ResumeVector[],
  order: number,
): SkillGroupComponent => {
  const normalized = ensureSkillGroupVectors(skillGroup, vectors)

  if (selectedVector === 'all') {
    const updated = Object.fromEntries(
      Object.entries(normalized).map(([vectorId, config]) => [vectorId, { ...config, order }]),
    )
    return {
      ...skillGroup,
      vectors: updated,
    }
  }

  return {
    ...skillGroup,
    vectors: {
      ...normalized,
      [selectedVector]: {
        ...normalized[selectedVector],
        order,
      },
    },
  }
}
