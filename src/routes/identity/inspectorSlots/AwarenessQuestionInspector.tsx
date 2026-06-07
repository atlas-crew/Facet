import { useId, useState } from 'react'
import type {
  ProfessionalAwarenessSeverity,
  ProfessionalIdentityV3,
  ProfessionalOpenQuestion,
} from '../../../identity/schema'
import { useIdentityStore } from '../../../store/identityStore'
import type { AnswerPatch } from '../../../types/identity'
import { proposeAnswerPatch } from '../../../utils/identityParametersGeneration'
import {
  ensureIdentityInferenceEndpoint,
  IdentityInferenceConfigError,
} from '../identityInferenceRuntime'
import { Actions, BulletPair, MetaRows, NotFound, SlotShell } from './slotPrimitives'
import { hasRequiredText } from './slotValidation'

type SeverityChoice = ProfessionalAwarenessSeverity | ''
type AnswerPhase = 'idle' | 'proposing' | 'review' | 'editing'

interface QuestionDraft {
  topic: string
  severity: SeverityChoice
  description: string
  action: string
  evidence: string
}

// ─────────────────────────────────────────────────────────────
// Proposal editing draft — editable slice of AnswerPatch
// ─────────────────────────────────────────────────────────────

type ProposalEditDraft =
  | { kind: 'role-bullet'; problem: string; action: string; outcome: string }
  | { kind: 'skill'; skillName: string }
  | { kind: 'self-model-arc'; chapter: string }
  | { kind: 'competitive-moat'; text: string }
  | { kind: 'unfair-advantage'; items: string }

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

const buildEditDraft = (patch: AnswerPatch): ProposalEditDraft => {
  switch (patch.kind) {
    case 'role-bullet':
      return {
        kind: 'role-bullet',
        problem: patch.bullet.problem,
        action: patch.bullet.action,
        outcome: patch.bullet.outcome,
      }
    case 'skill':
      return { kind: 'skill', skillName: patch.skillName }
    case 'self-model-arc':
      return { kind: 'self-model-arc', chapter: patch.entry.chapter }
    case 'competitive-moat':
      return { kind: 'competitive-moat', text: patch.text }
    case 'unfair-advantage':
      return { kind: 'unfair-advantage', items: patch.items.join('\n') }
  }
}

const applyEditToPatch = (draft: ProposalEditDraft, original: AnswerPatch): AnswerPatch => {
  switch (draft.kind) {
    case 'role-bullet': {
      const orig = original as Extract<AnswerPatch, { kind: 'role-bullet' }>
      return {
        ...orig,
        bullet: {
          ...orig.bullet,
          problem: draft.problem.trim(),
          action: draft.action.trim(),
          outcome: draft.outcome.trim(),
        },
      }
    }
    case 'skill': {
      const orig = original as Extract<AnswerPatch, { kind: 'skill' }>
      return { ...orig, skillName: draft.skillName.trim() }
    }
    case 'self-model-arc': {
      const orig = original as Extract<AnswerPatch, { kind: 'self-model-arc' }>
      return { ...orig, entry: { ...orig.entry, chapter: draft.chapter.trim() } }
    }
    case 'competitive-moat':
      return { kind: 'competitive-moat', text: draft.text.trim() }
    case 'unfair-advantage':
      return {
        kind: 'unfair-advantage',
        items: draft.items
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
      }
  }
}

const describeProposal = (patch: AnswerPatch, identity: ProfessionalIdentityV3): string => {
  switch (patch.kind) {
    case 'role-bullet': {
      const role = identity.roles.find((r) => r.id === patch.roleId)
      return `Add a bullet to ${role?.title ?? patch.roleId}`
    }
    case 'skill': {
      const group = identity.skills.groups.find((g) => g.id === patch.groupId)
      return `Add skill "${patch.skillName}" to ${group?.label ?? patch.groupId}`
    }
    case 'self-model-arc':
      return `Add arc chapter at ${patch.entry.company}`
    case 'competitive-moat':
      return 'Set competitive moat'
    case 'unfair-advantage':
      return `Add unfair advantage${patch.items.length !== 1 ? 's' : ''}`
  }
}

// ─────────────────────────────────────────────────────────────
// ProposalCard — read-only review of the AI-proposed patch
// ─────────────────────────────────────────────────────────────

function ProposalCard({
  proposal,
  identity,
  onAccept,
  onEdit,
  onSkip,
}: {
  proposal: AnswerPatch
  identity: ProfessionalIdentityV3
  onAccept: () => void
  onEdit: () => void
  onSkip: () => void
}) {
  const description = describeProposal(proposal, identity)

  const renderDetail = () => {
    switch (proposal.kind) {
      case 'role-bullet':
        return (
          <>
            <BulletPair label="Problem" value={proposal.bullet.problem} tone="problem" />
            <BulletPair label="Action" value={proposal.bullet.action} tone="action" />
            <BulletPair label="Outcome" value={proposal.bullet.outcome} tone="outcome" />
            {proposal.bullet.technologies && proposal.bullet.technologies.length > 0 ? (
              <BulletPair label="Technologies" value={proposal.bullet.technologies.join(', ')} />
            ) : null}
          </>
        )
      case 'skill': {
        const group = identity.skills.groups.find((g) => g.id === proposal.groupId)
        return (
          <MetaRows
            rows={[
              ['Skill', proposal.skillName],
              ['Group', group?.label ?? proposal.groupId],
            ]}
          />
        )
      }
      case 'self-model-arc':
        return (
          <>
            <BulletPair label="Company" value={proposal.entry.company} />
            <BulletPair label="Chapter" value={proposal.entry.chapter} />
          </>
        )
      case 'competitive-moat':
        return <BulletPair label="Moat" value={proposal.text} />
      case 'unfair-advantage':
        return (
          <div className="inspector-proposal-items">
            <ul>
              {proposal.items.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        )
    }
  }

  return (
    <div className="inspector-proposal-card" aria-label="Proposed identity update">
      <p className="inspector-proposal-header label-tracked">Proposed update</p>
      <p className="inspector-proposal-kind">{description}</p>
      {renderDetail()}
      <Actions>
        <button type="button" className="inspector-btn primary" onClick={onAccept}>
          Accept
        </button>
        <button type="button" className="inspector-btn" onClick={onEdit}>
          Edit
        </button>
        <button type="button" className="inspector-btn" onClick={onSkip}>
          Skip
        </button>
      </Actions>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// ProposalEditForm — inline editing of the proposed patch fields
// ─────────────────────────────────────────────────────────────

function ProposalEditForm({
  draft,
  onChange,
  onAccept,
  onBack,
}: {
  draft: ProposalEditDraft
  onChange: (next: ProposalEditDraft) => void
  onAccept: () => void
  onBack: () => void
}) {
  const canAccept = (() => {
    switch (draft.kind) {
      case 'role-bullet':
        return (
          hasRequiredText(draft.problem) &&
          hasRequiredText(draft.action) &&
          hasRequiredText(draft.outcome)
        )
      case 'skill':
        return hasRequiredText(draft.skillName)
      case 'self-model-arc':
        return hasRequiredText(draft.chapter)
      case 'competitive-moat':
        return hasRequiredText(draft.text)
      case 'unfair-advantage':
        return draft.items.split('\n').some((s) => s.trim().length > 0)
    }
  })()

  const renderFields = () => {
    switch (draft.kind) {
      case 'role-bullet': {
        const d = draft
        return (
          <>
            <label className="inspector-field">
              <span className="inspector-field-label label-tracked">Problem</span>
              <textarea
                className="inspector-textarea"
                rows={2}
                value={d.problem}
                onChange={(e) => onChange({ ...d, problem: e.target.value })}
              />
            </label>
            <label className="inspector-field">
              <span className="inspector-field-label label-tracked">Action</span>
              <textarea
                className="inspector-textarea"
                rows={2}
                value={d.action}
                onChange={(e) => onChange({ ...d, action: e.target.value })}
              />
            </label>
            <label className="inspector-field">
              <span className="inspector-field-label label-tracked">Outcome</span>
              <textarea
                className="inspector-textarea"
                rows={2}
                value={d.outcome}
                onChange={(e) => onChange({ ...d, outcome: e.target.value })}
              />
            </label>
          </>
        )
      }
      case 'skill': {
        const d = draft
        return (
          <label className="inspector-field">
            <span className="inspector-field-label label-tracked">Skill name</span>
            <input
              className="inspector-input"
              type="text"
              value={d.skillName}
              onChange={(e) => onChange({ ...d, skillName: e.target.value })}
            />
          </label>
        )
      }
      case 'self-model-arc': {
        const d = draft
        return (
          <label className="inspector-field">
            <span className="inspector-field-label label-tracked">Chapter</span>
            <textarea
              className="inspector-textarea"
              rows={3}
              value={d.chapter}
              onChange={(e) => onChange({ ...d, chapter: e.target.value })}
            />
          </label>
        )
      }
      case 'competitive-moat': {
        const d = draft
        return (
          <label className="inspector-field">
            <span className="inspector-field-label label-tracked">Moat</span>
            <textarea
              className="inspector-textarea"
              rows={3}
              value={d.text}
              onChange={(e) => onChange({ ...d, text: e.target.value })}
            />
          </label>
        )
      }
      case 'unfair-advantage': {
        const d = draft
        return (
          <label className="inspector-field">
            <span className="inspector-field-label label-tracked">Advantages (one per line)</span>
            <textarea
              className="inspector-textarea"
              rows={4}
              value={d.items}
              onChange={(e) => onChange({ ...d, items: e.target.value })}
            />
          </label>
        )
      }
    }
  }

  return (
    <div className="inspector-proposal-card">
      <p className="inspector-proposal-header label-tracked">Edit proposal</p>
      {renderFields()}
      <Actions>
        <button
          type="button"
          className="inspector-btn primary"
          onClick={onAccept}
          disabled={!canAccept}
        >
          Accept
        </button>
        <button type="button" className="inspector-btn" onClick={onBack}>
          Back
        </button>
      </Actions>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Main inspector
// ─────────────────────────────────────────────────────────────

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
  const applyPatch = useIdentityStore((s) => s.applyAnswerPatch)
  const resolveQuestion = useIdentityStore((s) => s.resolveAwarenessQuestion)
  const question = identity.awareness?.open_questions.find((q) => q.id === questionId)

  const topicHintId = useId()
  const actionHintId = useId()

  // Question metadata edit state (existing)
  const [editing, setEditing] = useState<boolean>(() => justAdded ?? false)
  const [draft, setDraft] = useState<QuestionDraft>(() =>
    question
      ? draftFromQuestion(question)
      : { topic: '', severity: '', description: '', action: '', evidence: '' },
  )

  // Answer flow state (ephemeral — never persisted)
  const [answer, setAnswer] = useState('')
  const [answerPhase, setAnswerPhase] = useState<AnswerPhase>('idle')
  const [proposal, setProposal] = useState<AnswerPatch | null>(null)
  const [answerError, setAnswerError] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<ProposalEditDraft | null>(null)

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

  // ─── Answer flow handlers ─────────────────────────────────

  const handlePropose = async () => {
    if (!answer.trim() || answerPhase === 'proposing') return
    setAnswerPhase('proposing')
    setAnswerError(null)
    setProposal(null)
    try {
      const endpoint = ensureIdentityInferenceEndpoint(
        'Connect the AI proxy before answering questions.',
      )
      const patch = await proposeAnswerPatch(identity, question, answer, endpoint)
      setProposal(patch)
      setAnswerPhase('review')
    } catch (error) {
      const isConfigError = error instanceof IdentityInferenceConfigError
      if (!isConfigError) {
        console.error(error)
      }
      setAnswerError(
        isConfigError
          ? (error as Error).message
          : "Couldn't propose an update — try again.",
      )
      setAnswerPhase('idle')
    }
  }

  const handleAccept = () => {
    if (!proposal) return
    applyPatch(proposal)
    resolveQuestion(question.id, answer)
    setProposal(null)
    setAnswerPhase('idle')
  }

  const handleEdit = () => {
    if (!proposal) return
    setEditDraft(buildEditDraft(proposal))
    setAnswerPhase('editing')
  }

  const handleAcceptEdit = () => {
    if (!editDraft || !proposal) return
    const updatedPatch = applyEditToPatch(editDraft, proposal)
    applyPatch(updatedPatch)
    resolveQuestion(question.id, answer)
    setProposal(null)
    setEditDraft(null)
    setAnswerPhase('idle')
  }

  const handleBackToReview = () => {
    setEditDraft(null)
    setAnswerPhase('review')
  }

  const handleSkip = () => {
    setProposal(null)
    setAnswerPhase('idle')
  }

  // ─── Edit-question form ───────────────────────────────────

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

  // ─── Read view ────────────────────────────────────────────

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

      {question.resolved ? (
        <div className="inspector-resolved-section">
          <span className="inspector-resolved-badge">Resolved</span>
          {question.answer ? (
            <div className="inspector-resolved-answer">
              <p className="inspector-field-label label-tracked">Your answer</p>
              <p className="inspector-resolved-answer-text">{question.answer}</p>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="inspector-answer-section">
          <label className="inspector-field">
            <span className="inspector-field-label label-tracked">Your answer</span>
            <textarea
              className="inspector-textarea"
              rows={4}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Type your answer here…"
              disabled={answerPhase === 'proposing'}
              aria-busy={answerPhase === 'proposing'}
            />
          </label>

          {answerError ? (
            <p className="inspector-error-message" role="alert">
              {answerError}
            </p>
          ) : null}

          {answerPhase === 'idle' || answerPhase === 'proposing' ? (
            <Actions>
              <button
                type="button"
                className="inspector-btn primary"
                onClick={() => void handlePropose()}
                disabled={!answer.trim() || answerPhase === 'proposing'}
                aria-busy={answerPhase === 'proposing'}
              >
                {answerPhase === 'proposing' ? 'Proposing…' : 'Propose update'}
              </button>
            </Actions>
          ) : null}

          {answerPhase === 'review' && proposal ? (
            <ProposalCard
              proposal={proposal}
              identity={identity}
              onAccept={handleAccept}
              onEdit={handleEdit}
              onSkip={handleSkip}
            />
          ) : null}

          {answerPhase === 'editing' && editDraft ? (
            <ProposalEditForm
              draft={editDraft}
              onChange={(next) => setEditDraft(next)}
              onAccept={handleAcceptEdit}
              onBack={handleBackToReview}
            />
          ) : null}
        </div>
      )}

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
