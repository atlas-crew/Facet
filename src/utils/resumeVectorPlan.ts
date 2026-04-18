import type { JdAnalysisResult, ResumeVector } from '../types'
import type {
  ResumeGenerationMode,
  ResumeGenerationVectorMode,
  ResumeWorkspaceGenerationState,
} from '../types/resumeGeneration'

export interface ResumeVectorPlan {
  mode: ResumeGenerationMode
  vectorMode: ResumeGenerationVectorMode
  primaryVectorId: string | null
  vectorIds: string[]
  suggestedVectorIds: string[]
}

const dedupeKnownVectorIds = (vectorIds: string[], knownVectorIds: Set<string>): string[] =>
  Array.from(new Set(vectorIds.filter((vectorId) => knownVectorIds.has(vectorId))))

export const buildInitialResumeVectorPlan = (
  analysis: JdAnalysisResult,
  vectors: ResumeVector[],
  currentGeneration: ResumeWorkspaceGenerationState,
): ResumeVectorPlan => {
  const knownVectorIds = new Set(vectors.map((vector) => vector.id))
  const suggestedVectorIds = dedupeKnownVectorIds(
    [...analysis.suggested_vectors, analysis.primary_vector],
    knownVectorIds,
  )
  const fallbackVectorId =
    (analysis.primary_vector && knownVectorIds.has(analysis.primary_vector) ? analysis.primary_vector : null) ??
    (currentGeneration.primaryVectorId && knownVectorIds.has(currentGeneration.primaryVectorId)
      ? currentGeneration.primaryVectorId
      : null) ??
    vectors[0]?.id ??
    null

  const vectorIds =
    suggestedVectorIds.length > 0
      ? suggestedVectorIds
      : fallbackVectorId
        ? [fallbackVectorId]
        : []
  const primaryVectorId = vectorIds[0] ?? fallbackVectorId

  return {
    mode: vectorIds.length > 1 ? 'multi-vector' : 'single',
    vectorMode: 'auto',
    primaryVectorId,
    vectorIds,
    suggestedVectorIds,
  }
}

export const resolvePlannedVectorIds = (
  vectors: ResumeVector[],
  mode: ResumeGenerationMode,
  vectorMode: ResumeGenerationVectorMode,
  selectedVectorIds: string[],
  suggestedVectorIds: string[],
  primaryVectorId: string | null,
): string[] => {
  const knownVectorIds = new Set(vectors.map((vector) => vector.id))
  const fallbackVectorId =
    (primaryVectorId && knownVectorIds.has(primaryVectorId) ? primaryVectorId : null) ?? vectors[0]?.id ?? null
  const preferredVectorIds =
    vectorMode === 'manual'
      ? dedupeKnownVectorIds(selectedVectorIds, knownVectorIds)
      : dedupeKnownVectorIds(suggestedVectorIds, knownVectorIds)

  if (mode === 'single') {
    const nextVectorId = preferredVectorIds[0] ?? fallbackVectorId
    return nextVectorId ? [nextVectorId] : []
  }

  if (preferredVectorIds.length > 0) {
    return preferredVectorIds
  }

  if (vectorMode === 'manual') {
    return []
  }

  return fallbackVectorId ? [fallbackVectorId] : []
}

export const applyResumeVectorPlan = (
  currentGeneration: ResumeWorkspaceGenerationState,
  plan: ResumeVectorPlan,
  vectors: ResumeVector[],
  selectedVectorIds: string[],
): ResumeWorkspaceGenerationState => {
  const vectorIds = resolvePlannedVectorIds(
    vectors,
    plan.mode,
    plan.vectorMode,
    selectedVectorIds,
    plan.suggestedVectorIds,
    plan.primaryVectorId,
  )
  let primaryVectorId: string | null = null
  if (plan.primaryVectorId && vectorIds.includes(plan.primaryVectorId)) {
    primaryVectorId = plan.primaryVectorId
  } else if (vectorIds[0]) {
    primaryVectorId = vectorIds[0]
  }

  return {
    ...currentGeneration,
    mode:
      currentGeneration.mode === 'dynamic' || currentGeneration.source === 'pipeline'
        ? 'dynamic'
        : plan.mode,
    vectorMode: plan.vectorMode,
    primaryVectorId,
    vectorIds,
    suggestedVectorIds: plan.suggestedVectorIds,
  }
}
