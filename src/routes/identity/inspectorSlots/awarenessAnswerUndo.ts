import type { ProfessionalIdentityV3 } from '../../../identity/schema'
import type { AnswerPatch } from '../../../types/identity'
import { cloneValue } from '../../../utils/clone'

type RecordAiGenerationUndo = (label: string, beforeIdentity: ProfessionalIdentityV3) => void

export type AwarenessAnswerCommitResult =
  | 'committed'
  | 'missing-identity'
  | 'failed-no-changes'
  | 'failed-partial'

export const commitAwarenessAnswerUndoablePatch = ({
  label,
  beforeIdentity,
  patch,
  questionId,
  answer,
  applyPatch,
  resolveQuestion,
  recordAiGenerationUndo,
}: {
  label: string
  beforeIdentity: ProfessionalIdentityV3 | null
  patch: AnswerPatch
  questionId: string
  answer: string
  applyPatch: (patch: AnswerPatch) => void
  resolveQuestion: (id: string, answer: string) => void
  recordAiGenerationUndo: RecordAiGenerationUndo
}): AwarenessAnswerCommitResult => {
  if (!beforeIdentity) return 'missing-identity'
  // Keep the undo payload isolated if a future store action accidentally mutates in place.
  const undoSnapshot = cloneValue(beforeIdentity)
  let patchApplied = false
  let result: AwarenessAnswerCommitResult = 'committed'
  try {
    applyPatch(patch)
    patchApplied = true
    resolveQuestion(questionId, answer)
  } catch (error) {
    console.error(error)
    result = patchApplied ? 'failed-partial' : 'failed-no-changes'
  }

  // The patch and question resolution are separate store actions. If resolution
  // fails after the patch lands, this records a recovery snapshot for the partial change.
  if (patchApplied) {
    recordAiGenerationUndo(label, undoSnapshot)
  }
  return result
}
