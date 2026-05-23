import { useState } from 'react'
import type { ProfessionalIdentityV3 } from '../../identity/schema'
import type { IdentityExtractionDraft, ProposedSearchVectorPatch } from '../../types/identity'

interface ProposedVectorsCardProps {
  draft: IdentityExtractionDraft | null
  onAccept: (id: string) => void
  onReject: (id: string) => void
  onEdit: (id: string, patch: ProposedSearchVectorPatch) => void
}

interface EditFormState {
  title: string
  thesis: string
  primaryKeywords: string
  secondaryKeywords: string
  error: string | null
}

const PRIORITY_LABELS: Record<'high' | 'medium' | 'low', string> = {
  high: 'High priority',
  medium: 'Medium priority',
  low: 'Low priority',
}

const PRIORITY_CHIP_CLASSES: Record<'high' | 'medium' | 'low', string> = {
  high: 'identity-chip-confirmed',
  medium: 'identity-chip-stated',
  low: 'identity-chip-empty',
}

const keywordsToInput = (keywords: string[]): string => keywords.join(', ')

const parseKeywordsInput = (value: string): string[] =>
  value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)

/**
 * Resolve a supporting_bullets entry to a human-readable label. The LLM is
 * instructed to emit bullet ids, but may occasionally emit raw text — fall back
 * to the raw value when no matching role/bullet is found so users still see
 * something they can act on.
 */
const resolveBulletLabel = (
  bulletRef: string,
  identity: ProfessionalIdentityV3,
): string => {
  for (let roleIndex = 0; roleIndex < identity.roles.length; roleIndex += 1) {
    const role = identity.roles[roleIndex]
    const bulletIndex = role.bullets.findIndex((bullet) => bullet.id === bulletRef)
    if (bulletIndex === -1) {
      continue
    }
    const company = role.company || 'Untitled company'
    const title = role.title || 'Untitled role'
    return `${company} · ${title} · Bullet ${bulletIndex + 1}`
  }
  return bulletRef
}

export function ProposedVectorsCard({
  draft,
  onAccept,
  onReject,
  onEdit,
}: ProposedVectorsCardProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editState, setEditState] = useState<EditFormState | null>(null)

  if (!draft || !draft.proposedVectors || draft.proposedVectors.length === 0) {
    return null
  }

  const beginEdit = (vectorId: string) => {
    const vector = draft.proposedVectors?.find((entry) => entry.id === vectorId)
    if (!vector) {
      return
    }
    setEditingId(vectorId)
    setEditState({
      title: vector.title,
      thesis: vector.thesis,
      primaryKeywords: keywordsToInput(vector.keywords.primary),
      secondaryKeywords: keywordsToInput(vector.keywords.secondary),
      error: null,
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditState(null)
  }

  const saveEdit = (vectorId: string) => {
    if (!editState) {
      return
    }
    const title = editState.title.trim()
    const thesis = editState.thesis.trim()
    if (!title || !thesis) {
      setEditState({
        ...editState,
        error: 'Title and thesis are required before saving.',
      })
      return
    }
    onEdit(vectorId, {
      title,
      thesis,
      keywords: {
        primary: parseKeywordsInput(editState.primaryKeywords),
        secondary: parseKeywordsInput(editState.secondaryKeywords),
      },
    })
    setEditingId(null)
    setEditState(null)
  }

  return (
    <section
      className="identity-proposed-vectors"
      aria-labelledby="identity-proposed-vectors-heading"
    >
      <div className="identity-proposed-vectors-header">
        <h2 id="identity-proposed-vectors-heading">Proposed Vectors</h2>
        <p className="identity-muted">
          The extractor inferred these positioning angles from your sources. Accept the ones
          you want to keep, edit any that need refinement, or reject the rest. Accepted
          vectors land in your identity model; nothing here is saved automatically.
        </p>
      </div>

      <div className="identity-proposed-vectors-list">
        {draft.proposedVectors.map((vector) => {
          const isEditing = editingId === vector.id && editState !== null

          return (
            <article
              className="identity-card identity-proposed-vector"
              key={vector.id}
              aria-labelledby={`proposed-vector-${vector.id}-title`}
            >
              {isEditing && editState ? (
                <form
                  className="identity-proposed-vector-form"
                  onSubmit={(event) => {
                    event.preventDefault()
                    saveEdit(vector.id)
                  }}
                >
                  <label className="identity-field">
                    <span className="identity-label">Title</span>
                    <input
                      className="identity-input"
                      value={editState.title}
                      onChange={(event) =>
                        setEditState({ ...editState, title: event.target.value, error: null })
                      }
                    />
                  </label>
                  <label className="identity-field identity-field-wide">
                    <span className="identity-label">Thesis</span>
                    <textarea
                      className="identity-textarea"
                      value={editState.thesis}
                      onChange={(event) =>
                        setEditState({ ...editState, thesis: event.target.value, error: null })
                      }
                    />
                  </label>
                  <label className="identity-field">
                    <span className="identity-label">Primary keywords</span>
                    <input
                      className="identity-input"
                      value={editState.primaryKeywords}
                      placeholder="Comma-separated"
                      onChange={(event) =>
                        setEditState({
                          ...editState,
                          primaryKeywords: event.target.value,
                          error: null,
                        })
                      }
                    />
                  </label>
                  <label className="identity-field">
                    <span className="identity-label">Secondary keywords</span>
                    <input
                      className="identity-input"
                      value={editState.secondaryKeywords}
                      placeholder="Comma-separated"
                      onChange={(event) =>
                        setEditState({
                          ...editState,
                          secondaryKeywords: event.target.value,
                          error: null,
                        })
                      }
                    />
                  </label>
                  {editState.error ? (
                    <p className="identity-muted" role="alert">
                      {editState.error}
                    </p>
                  ) : null}
                  <div className="identity-card-actions">
                    <button className="identity-btn identity-btn-primary" type="submit">
                      Save
                    </button>
                    <button className="identity-btn" type="button" onClick={cancelEdit}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="identity-card-header">
                    <div>
                      <h3 id={`proposed-vector-${vector.id}-title`}>{vector.title}</h3>
                      {vector.subtitle ? (
                        <p className="identity-muted">{vector.subtitle}</p>
                      ) : null}
                    </div>
                    <span className={`identity-chip ${PRIORITY_CHIP_CLASSES[vector.priority]}`}>
                      {PRIORITY_LABELS[vector.priority]}
                    </span>
                  </div>

                  <p className="identity-proposed-vector-thesis">{vector.thesis}</p>

                  {vector.keywords.primary.length > 0 ||
                  vector.keywords.secondary.length > 0 ? (
                    <div className="identity-proposed-vector-keywords">
                      {vector.keywords.primary.length > 0 ? (
                        <div>
                          <span className="identity-label">Primary keywords</span>
                          <div className="identity-chip-row">
                            {vector.keywords.primary.map((keyword) => (
                              <span
                                className="identity-chip identity-chip-confirmed"
                                key={`primary-${keyword}`}
                              >
                                {keyword}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {vector.keywords.secondary.length > 0 ? (
                        <div>
                          <span className="identity-label">Secondary keywords</span>
                          <div className="identity-chip-row">
                            {vector.keywords.secondary.map((keyword) => (
                              <span
                                className="identity-chip identity-chip-empty"
                                key={`secondary-${keyword}`}
                              >
                                {keyword}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {vector.supporting_bullets && vector.supporting_bullets.length > 0 ? (
                    <div className="identity-proposed-vector-section">
                      <span className="identity-label">Supporting bullets</span>
                      <ul className="identity-proposed-vector-bullets">
                        {vector.supporting_bullets.map((bulletRef) => (
                          <li key={`bullet-${bulletRef}`}>
                            {resolveBulletLabel(bulletRef, draft.identity)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {vector.evidenceSources.length > 0 ? (
                    <div className="identity-proposed-vector-section">
                      <span className="identity-label">Evidence sources</span>
                      <ul className="identity-proposed-vector-bullets">
                        {vector.evidenceSources.map((entry) => (
                          <li key={`evidence-${entry}`}>{entry}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div className="identity-card-actions">
                    <button
                      className="identity-btn identity-btn-primary"
                      type="button"
                      onClick={() => onAccept(vector.id)}
                    >
                      Accept
                    </button>
                    <button
                      className="identity-btn"
                      type="button"
                      onClick={() => beginEdit(vector.id)}
                    >
                      Edit
                    </button>
                    <button
                      className="identity-btn"
                      type="button"
                      onClick={() => onReject(vector.id)}
                    >
                      Reject
                    </button>
                  </div>
                </>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
