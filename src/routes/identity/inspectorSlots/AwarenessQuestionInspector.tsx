import { useId, useState } from 'react'
import type {
  ProfessionalAwarenessSeverity,
  ProfessionalIdentityV3,
  ProfessionalOpenQuestion,
} from '../../../identity/schema'
import { useIdentityStore } from '../../../store/identityStore'
import { Actions, MetaRows, NotFound, SlotShell } from './slotPrimitives'
import { hasRequiredText } from './slotValidation'

type SeverityChoice = ProfessionalAwarenessSeverity | ''

interface QuestionDraft {
  topic: string
  severity: SeverityChoice
  description: string
  action: string
  evidence: string
}

const SEVERITY_OPTIONS: SeverityChoice[] = ['', 'high', 'medium', 'low']

const draftFromQuestion = (question: ProfessionalOpenQuestion): QuestionDraft => ({
  topic: question.topic,
  severity: question.severity ?? '',
  description: question.description,
  action: question.action,
  evidence: (question.evidence ?? []).join('\n'),
})

const linesToList = (value: string): string[] =>
  value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

export function AwarenessQuestionInspector({
  identity,
  questionId,
  justAdded,
}: {
  identity: ProfessionalIdentityV3
  questionId: string
  justAdded?: boolean
}) {
  const updateQuestions = useIdentityStore((s) => s.updateCurrentAwarenessQuestions)
  const setSelection = useIdentityStore((s) => s.setMapSelection)
  const question = identity.awareness?.open_questions.find((q) => q.id === questionId)
  const topicHintId = useId()
  const actionHintId = useId()
  const [editing, setEditing] = useState<boolean>(() => justAdded ?? false)
  const [draft, setDraft] = useState<QuestionDraft>(() =>
    question
      ? draftFromQuestion(question)
      : { topic: '', severity: '', description: '', action: '', evidence: '' },
  )

  if (!question) return <NotFound label="open question" />

  const topicValid = hasRequiredText(draft.topic)
  const actionValid = hasRequiredText(draft.action)
  const canSave = topicValid && actionValid

  const startEditing = () => {
    setDraft(draftFromQuestion(question))
    setEditing(true)
  }

  const replaceQuestions = (
    updater: (current: ProfessionalOpenQuestion[]) => ProfessionalOpenQuestion[],
  ) => {
    const current = identity.awareness?.open_questions ?? []
    updateQuestions(updater(current))
  }

  const handleSave = () => {
    const evidence = linesToList(draft.evidence)
    replaceQuestions((current) =>
      current.map((q) =>
        q.id === questionId
          ? {
              ...q,
              topic: draft.topic.trim(),
              description: draft.description.trim(),
              action: draft.action.trim(),
              ...(draft.severity ? { severity: draft.severity } : { severity: undefined }),
              ...(evidence.length > 0 ? { evidence } : { evidence: undefined }),
            }
          : q,
      ),
    )
    if (justAdded) {
      setSelection({ type: 'awareness-question', id: questionId })
    }
    setEditing(false)
  }

  const handleRemove = () => {
    replaceQuestions((current) => current.filter((q) => q.id !== questionId))
    setSelection(null)
  }

  const handleCancel = () => {
    if (justAdded) {
      handleRemove()
    } else {
      setDraft(draftFromQuestion(question))
      setEditing(false)
    }
  }

  const toggleReviewed = () => {
    replaceQuestions((current) =>
      current.map((q) => (q.id === questionId ? { ...q, needs_review: !q.needs_review } : q)),
    )
  }

  if (editing) {
    return (
      <SlotShell
        eyebrow={`Awareness · ${draft.severity || 'open'}`}
        title={draft.topic.trim() || 'New question'}
      >
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">Topic</span>
          <input
            className="inspector-input"
            type="text"
            value={draft.topic}
            onChange={(e) => setDraft({ ...draft, topic: e.target.value })}
            aria-invalid={!topicValid}
            aria-describedby={!topicValid ? topicHintId : undefined}
          />
        </label>
        {!topicValid ? (
          <span id={topicHintId} className="inspector-field-hint">
            Topic is required.
          </span>
        ) : null}
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">Severity</span>
          <select
            className="inspector-input"
            value={draft.severity}
            onChange={(e) => setDraft({ ...draft, severity: e.target.value as SeverityChoice })}
          >
            {SEVERITY_OPTIONS.map((opt) => (
              <option key={opt || 'unset'} value={opt}>
                {opt || '— unset'}
              </option>
            ))}
          </select>
        </label>
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">Description</span>
          <textarea
            className="inspector-textarea"
            rows={3}
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />
        </label>
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">Action</span>
          <textarea
            className="inspector-textarea"
            rows={2}
            value={draft.action}
            onChange={(e) => setDraft({ ...draft, action: e.target.value })}
            aria-invalid={!actionValid}
            aria-describedby={!actionValid ? actionHintId : undefined}
          />
        </label>
        {!actionValid ? (
          <span id={actionHintId} className="inspector-field-hint">
            Action is required.
          </span>
        ) : null}
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">Evidence</span>
          <textarea
            className="inspector-textarea"
            rows={3}
            value={draft.evidence}
            onChange={(e) => setDraft({ ...draft, evidence: e.target.value })}
            placeholder="one bullet per line"
          />
        </label>
        <Actions>
          <button
            type="button"
            className="inspector-btn primary"
            onClick={handleSave}
            disabled={!canSave}
          >
            Save
          </button>
          <button type="button" className="inspector-btn" onClick={handleCancel}>
            {justAdded ? 'Discard' : 'Cancel'}
          </button>
          {!justAdded && (
            <button type="button" className="inspector-btn" onClick={handleRemove}>
              Remove question
            </button>
          )}
        </Actions>
      </SlotShell>
    )
  }

  const evidenceLines = question.evidence ?? []

  return (
    <SlotShell
      eyebrow={`Awareness · ${question.severity ?? 'open'}`}
      title={question.topic.trim() || 'Untitled question'}
    >
      <p className="inspector-body-text">
        {question.description.trim() || <em>No description yet.</em>}
      </p>
      <MetaRows
        rows={[
          ['Action', question.action || '—'],
          ['Severity', question.severity ?? '—'],
          ['Needs review', question.needs_review ? 'Yes' : 'No'],
        ]}
      />
      {evidenceLines.length > 0 ? (
        <div className="inspector-evidence">
          <p className="inspector-field-label label-tracked">Evidence</p>
          <ul>
            {evidenceLines.map((line, idx) => (
              <li key={idx}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <Actions>
        <button type="button" className="inspector-btn primary" onClick={startEditing}>
          Edit question
        </button>
        <button type="button" className="inspector-btn" onClick={toggleReviewed}>
          {question.needs_review ? 'Mark reviewed' : 'Reopen for review'}
        </button>
        <button type="button" className="inspector-btn" onClick={handleRemove}>
          Remove question
        </button>
      </Actions>
    </SlotShell>
  )
}
