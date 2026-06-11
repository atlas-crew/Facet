import { useId, useState } from 'react'
import type {
  ProfessionalIdentityV3,
  ProfessionalSearchVector,
  ProfessionalSearchVectorPriority,
} from '../../../identity/schema'
import { useIdentityStore } from '../../../store/identityStore'
import { Actions, MetaRows, NotFound, SlotShell, inputToTags, tagsToInput } from './slotPrimitives'
import { hasRequiredText } from './slotValidation'

interface SearchVectorDraft {
  title: string
  subtitle: string
  priority: ProfessionalSearchVectorPriority
  thesis: string
  targetRoles: string
  primaryKeywords: string
  secondaryKeywords: string
  supportingSkills: string
  evidence: string
}

const PRIORITY_OPTIONS: ProfessionalSearchVectorPriority[] = ['high', 'medium', 'low']

const draftFromVector = (vector: ProfessionalSearchVector): SearchVectorDraft => ({
  title: vector.title,
  subtitle: vector.subtitle ?? '',
  priority: vector.priority,
  thesis: vector.thesis,
  targetRoles: tagsToInput(vector.target_roles),
  primaryKeywords: tagsToInput(vector.keywords.primary),
  secondaryKeywords: tagsToInput(vector.keywords.secondary),
  supportingSkills: tagsToInput(vector.supporting_skills ?? []),
  evidence: (vector.evidence ?? []).join('\n'),
})

const linesToList = (value: string): string[] =>
  value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

export function SearchVectorInspector({
  identity,
  vectorId,
  justAdded,
}: {
  identity: ProfessionalIdentityV3
  vectorId: string
  justAdded?: boolean
}) {
  const updateVectors = useIdentityStore((s) => s.updateCurrentSearchVectors)
  const recordCorrection = useIdentityStore((s) => s.recordIdentityCorrection)
  const setSelection = useIdentityStore((s) => s.setMapSelection)
  const vector = identity.search_vectors?.find((v) => v.id === vectorId)
  const titleHintId = useId()
  const thesisHintId = useId()
  const [editing, setEditing] = useState<boolean>(() => justAdded ?? false)
  const [draft, setDraft] = useState<SearchVectorDraft>(() =>
    vector
      ? draftFromVector(vector)
      : draftFromVector({
          id: '',
          title: '',
          priority: 'medium',
          thesis: '',
          target_roles: [],
          keywords: { primary: [], secondary: [] },
        }),
  )

  if (!vector) return <NotFound label="search vector" />

  const titleValid = hasRequiredText(draft.title)
  const thesisValid = hasRequiredText(draft.thesis)
  const canSave = titleValid && thesisValid

  const startEditing = () => {
    setDraft(draftFromVector(vector))
    setEditing(true)
  }

  const replaceVector = (
    updater: (current: ProfessionalSearchVector[]) => ProfessionalSearchVector[],
  ) => {
    const current = identity.search_vectors ?? []
    updateVectors(updater(current))
    // Search vectors are the 'search' section's own output; re-authoring them
    // clears search's stale flag (terminal node — no downstream to mark).
    recordCorrection('search')
  }

  const handleSave = () => {
    const evidence = linesToList(draft.evidence)
    const supportingSkills = inputToTags(draft.supportingSkills)
    replaceVector((current) =>
      current.map((v) =>
        v.id === vectorId
          ? {
              ...v,
              title: draft.title.trim(),
              subtitle: draft.subtitle.trim() ? draft.subtitle.trim() : undefined,
              priority: draft.priority,
              thesis: draft.thesis.trim(),
              target_roles: inputToTags(draft.targetRoles),
              keywords: {
                primary: inputToTags(draft.primaryKeywords),
                secondary: inputToTags(draft.secondaryKeywords),
              },
              ...(supportingSkills.length > 0
                ? { supporting_skills: supportingSkills }
                : { supporting_skills: undefined }),
              ...(evidence.length > 0 ? { evidence } : { evidence: undefined }),
            }
          : v,
      ),
    )
    if (justAdded) {
      setSelection({ type: 'search-vector', id: vectorId })
    }
    setEditing(false)
  }

  const handleRemove = () => {
    replaceVector((current) => current.filter((v) => v.id !== vectorId))
    setSelection(null)
  }

  const handleCancel = () => {
    if (justAdded) {
      handleRemove()
    } else {
      setDraft(draftFromVector(vector))
      setEditing(false)
    }
  }

  const toggleReviewed = () => {
    replaceVector((current) =>
      current.map((v) => (v.id === vectorId ? { ...v, needs_review: !v.needs_review } : v)),
    )
  }

  if (editing) {
    return (
      <SlotShell eyebrow={`Vector · ${draft.priority}`} title={draft.title.trim() || 'New vector'}>
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">Title</span>
          <input
            className="inspector-input"
            type="text"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            aria-invalid={!titleValid}
            aria-describedby={!titleValid ? titleHintId : undefined}
          />
        </label>
        {!titleValid ? (
          <span id={titleHintId} className="inspector-field-hint">
            Title is required.
          </span>
        ) : null}
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">Subtitle</span>
          <input
            className="inspector-input"
            type="text"
            value={draft.subtitle}
            onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })}
          />
        </label>
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">Priority</span>
          <select
            className="inspector-input"
            value={draft.priority}
            onChange={(e) =>
              setDraft({ ...draft, priority: e.target.value as ProfessionalSearchVectorPriority })
            }
          >
            {PRIORITY_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">Thesis</span>
          <textarea
            className="inspector-textarea"
            rows={4}
            value={draft.thesis}
            onChange={(e) => setDraft({ ...draft, thesis: e.target.value })}
            aria-invalid={!thesisValid}
            aria-describedby={!thesisValid ? thesisHintId : undefined}
          />
        </label>
        {!thesisValid ? (
          <span id={thesisHintId} className="inspector-field-hint">
            Thesis is required.
          </span>
        ) : null}
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">Target roles</span>
          <input
            className="inspector-input"
            type="text"
            value={draft.targetRoles}
            onChange={(e) => setDraft({ ...draft, targetRoles: e.target.value })}
            placeholder="comma-separated values"
          />
        </label>
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">Primary keywords</span>
          <input
            className="inspector-input"
            type="text"
            value={draft.primaryKeywords}
            onChange={(e) => setDraft({ ...draft, primaryKeywords: e.target.value })}
            placeholder="comma-separated values"
          />
        </label>
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">Secondary keywords</span>
          <input
            className="inspector-input"
            type="text"
            value={draft.secondaryKeywords}
            onChange={(e) => setDraft({ ...draft, secondaryKeywords: e.target.value })}
            placeholder="comma-separated values"
          />
        </label>
        <label className="inspector-field">
          <span className="inspector-field-label label-tracked">Supporting skills</span>
          <input
            className="inspector-input"
            type="text"
            value={draft.supportingSkills}
            onChange={(e) => setDraft({ ...draft, supportingSkills: e.target.value })}
            placeholder="comma-separated values"
          />
        </label>
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
              Remove vector
            </button>
          )}
        </Actions>
      </SlotShell>
    )
  }

  const evidenceLines = vector.evidence ?? []

  return (
    <SlotShell
      eyebrow={`Vector · ${vector.priority}`}
      title={vector.title.trim() || 'Untitled vector'}
    >
      {vector.subtitle ? (
        <p className="inspector-eyebrow label-tracked">{vector.subtitle}</p>
      ) : null}
      <p className="inspector-body-text chapter-copy">
        {vector.thesis.trim() || <em>No thesis yet.</em>}
      </p>
      <MetaRows
        rows={[
          ['Target roles', vector.target_roles.join(' · ') || '—'],
          ['Primary keywords', vector.keywords.primary.join(' · ') || '—'],
          ['Secondary keywords', vector.keywords.secondary.join(' · ') || '—'],
          ['Supporting skills', (vector.supporting_skills ?? []).join(' · ') || '—'],
          ['Needs review', vector.needs_review ? 'Yes' : 'No'],
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
          Edit vector
        </button>
        <button type="button" className="inspector-btn" onClick={toggleReviewed}>
          {vector.needs_review ? 'Mark reviewed' : 'Reopen for review'}
        </button>
        <button type="button" className="inspector-btn" onClick={handleRemove}>
          Remove vector
        </button>
      </Actions>
    </SlotShell>
  )
}
