import type {
  ProfessionalIdentityV3,
  ProfessionalOpenQuestion,
  ProfessionalSearchVector,
} from '../../identity/schema'
import type { ProfessionalStrategicInference } from '../../utils/identityParametersGeneration'
import { createId } from '../../utils/idUtils'
import { getUniqueUnfairAdvantages } from '../../utils/unfairAdvantagesDedupe'

const normalizeGenerationSignature = (value: string | null | undefined) =>
  (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase()

export const getPositioningGenerationKey = (identity: ProfessionalIdentityV3) =>
  // identityStore advances model_revision for every canonical identity mutation.
  // The collection signatures below are a narrow belt-and-suspenders guard for
  // generated strategy fields only; they catch any future direct list writes
  // around the draft target without serializing the full evidence model.
  [
    identity.model_revision ?? 0,
    normalizeGenerationSignature(identity.self_model?.competitive_moat),
    ...(identity.self_model?.unfair_advantages ?? []).map((advantage) =>
      normalizeGenerationSignature(advantage),
    ),
    ...(identity.search_vectors ?? []).map((vector) =>
      normalizeGenerationSignature(`${vector.id} ${vector.title}`),
    ),
    ...(identity.awareness?.open_questions ?? []).map((question) =>
      normalizeGenerationSignature(`${question.id} ${question.topic}`),
    ),
  ].join('\u0000')

export const hasPositioningDraftSections = (draft: ProfessionalStrategicInference | null) =>
  Boolean(
    draft?.competitive_moat?.trim() ||
      draft?.unfair_advantages.length ||
      draft?.search_vectors.length ||
      draft?.open_questions.length,
  )

export const uniquifyGeneratedItems = <Item extends { id: string }>({
  existing,
  generated,
  idPrefix,
  getSignature,
}: {
  existing: Item[]
  generated: Item[]
  idPrefix: string
  getSignature: (item: Item) => string
}) => {
  const signatures = new Set(
    existing.map((item) => normalizeGenerationSignature(getSignature(item))).filter(Boolean),
  )

  return generated.flatMap((item) => {
    const signature = normalizeGenerationSignature(getSignature(item))
    if (!signature) return []
    if (signatures.has(signature)) return []
    signatures.add(signature)
    return [{ ...item, id: createId(idPrefix) }]
  })
}

export const formatPositioningApplyMessage = ({
  replacedMoat,
  advantageCount,
  vectorCount,
  questionCount,
}: {
  replacedMoat: boolean
  advantageCount: number
  vectorCount: number
  questionCount: number
}) => {
  const parts = [
    replacedMoat ? 'moat' : '',
    advantageCount > 0
      ? `${advantageCount} ${advantageCount === 1 ? 'advantage' : 'advantages'}`
      : '',
    vectorCount > 0 ? `${vectorCount} ${vectorCount === 1 ? 'vector' : 'vectors'}` : '',
    questionCount > 0
      ? `${questionCount} ${questionCount === 1 ? 'question' : 'questions'}`
      : '',
  ].filter(Boolean)

  return parts.length > 0
    ? `Applied ${parts.join(', ')} from the positioning draft.`
    : 'Draft matched the current identity; nothing new was applied.'
}

export interface PositioningDraftApplySections {
  moat?: boolean
  advantages?: boolean
  vectors?: boolean
  questions?: boolean
}

export const computePositioningDraftApplication = ({
  draft,
  identity,
  sections,
}: {
  draft: ProfessionalStrategicInference
  identity: ProfessionalIdentityV3
  sections: PositioningDraftApplySections
}) => {
  const draftMoat = draft.competitive_moat?.trim() ?? ''
  const existingMoat = identity.self_model?.competitive_moat?.trim() ?? ''
  const shouldReplaceMoat = Boolean(sections.moat && draftMoat && draftMoat !== existingMoat)
  const existingAdvantages = identity.self_model?.unfair_advantages ?? []
  const nextAdvantages = sections.advantages
    ? getUniqueUnfairAdvantages(existingAdvantages, draft.unfair_advantages)
    : []
  const existingVectors = identity.search_vectors ?? []
  const nextVectors = sections.vectors
    ? uniquifyGeneratedItems<ProfessionalSearchVector>({
        existing: existingVectors,
        generated: draft.search_vectors,
        idPrefix: 'search-vector',
        getSignature: (vector) => vector.title,
      })
    : []
  const existingQuestions = identity.awareness?.open_questions ?? []
  const nextQuestions = sections.questions
    ? uniquifyGeneratedItems<ProfessionalOpenQuestion>({
        existing: existingQuestions,
        generated: draft.open_questions,
        idPrefix: 'open-question',
        getSignature: (question) => question.topic,
      })
    : []

  return {
    draftMoat,
    shouldReplaceMoat,
    existingAdvantages,
    nextAdvantages,
    existingVectors,
    nextVectors,
    existingQuestions,
    nextQuestions,
  }
}

export const getResidualPositioningDraft = (
  draft: ProfessionalStrategicInference,
  applied: PositioningDraftApplySections,
): ProfessionalStrategicInference | null => {
  const nextDraft: ProfessionalStrategicInference = {
    unfair_advantages: applied.advantages ? [] : draft.unfair_advantages,
    search_vectors: applied.vectors ? [] : draft.search_vectors,
    open_questions: applied.questions ? [] : draft.open_questions,
  }
  if (!applied.moat && draft.competitive_moat) {
    nextDraft.competitive_moat = draft.competitive_moat
  }

  return hasPositioningDraftSections(nextDraft) ? nextDraft : null
}
