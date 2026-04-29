import type { ProfessionalIdentityV3 } from '../../../identity/schema'
import { useIdentityStore } from '../../../store/identityStore'
import { Actions, MetaRows, NotFound, SlotShell } from './slotPrimitives'

export function AwarenessQuestionInspector({
  identity,
  questionId,
}: {
  identity: ProfessionalIdentityV3
  questionId: string
}) {
  const updateQuestions = useIdentityStore((s) => s.updateCurrentAwarenessQuestions)
  const question = identity.awareness?.open_questions.find((q) => q.id === questionId)
  if (!question) return <NotFound label="open question" />

  const toggleReviewed = () => {
    const questions = identity.awareness?.open_questions ?? []
    const next = questions.map((q) => (q.id === questionId ? { ...q, needs_review: !q.needs_review } : q))
    updateQuestions(next)
  }

  return (
    <SlotShell eyebrow={`Awareness · ${question.severity ?? 'open'}`} title={question.topic}>
      <p className="inspector-body-text">{question.description}</p>
      <MetaRows rows={[['Action', question.action], ['Needs review', question.needs_review ? 'Yes' : 'No']]} />
      <Actions>
        <button type="button" className="inspector-btn primary" onClick={toggleReviewed}>
          {question.needs_review ? 'Mark reviewed' : 'Reopen for review'}
        </button>
      </Actions>
    </SlotShell>
  )
}
