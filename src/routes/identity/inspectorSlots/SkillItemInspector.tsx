import { type FormEvent, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type {
  ProfessionalIdentityV3,
  ProfessionalSkillDepth,
  ProfessionalSkillDepthConfidence,
  ProfessionalSkillItem,
} from '../../../identity/schema'
import { useIdentityStore } from '../../../store/identityStore'
import { facetClientEnv } from '../../../utils/facetEnv'
import { sanitizeEndpointUrl } from '../../../utils/idUtils'
import {
  applySkillEnrichmentSuggestion,
  applySkillDepthEdit,
  hasSkillEnrichmentData,
  skillNamesMatch,
  updateIdentityEnrichmentSkill,
} from '../../../utils/identityEnrichment'
import {
  type SkillEnrichmentSuggestion,
  generateSkillEnrichmentSuggestion,
  hasSkillEnrichmentBulletEvidence,
} from '../../../utils/skillEnrichment'
import {
  CUSTOM_POSITIONING_EXAMPLES,
  CUSTOM_POSITIONING_VALUE,
  POSITIONING_EXAMPLES,
  type PositioningSelection,
  resolvePositioningSelection,
} from '../../../utils/skillPositioning'
import {
  Actions,
  MetaRows,
  NotFound,
  Prompt,
  SlotShell,
  inputToTags,
  tagsToInput,
} from './slotPrimitives'

type EditableSkillDepth = ProfessionalSkillDepth | ''
type EditableDepthConfidence = ProfessionalSkillDepthConfidence | ''

const DEPTH_OPTIONS: Array<{ value: ProfessionalSkillDepth; label: string }> = [
  { value: 'expert', label: 'Expert' },
  { value: 'strong', label: 'Strong' },
  { value: 'hands-on-working', label: 'Hands-on working' },
  { value: 'architectural', label: 'Architectural' },
  { value: 'conceptual', label: 'Conceptual' },
  { value: 'working', label: 'Working' },
  { value: 'basic', label: 'Basic' },
  { value: 'avoid', label: 'Avoid' },
]

const computeStaleFlag = ({
  text,
  textChanged,
  depthChanged,
  wasStale,
}: {
  text: string
  textChanged: boolean
  depthChanged: boolean
  wasStale?: boolean
}): boolean | undefined => {
  if (!text) return undefined
  if (textChanged) return undefined
  return depthChanged || wasStale ? true : undefined
}

export function SkillItemInspector({
  identity,
  groupId,
  itemName,
  autoDraft,
}: {
  identity: ProfessionalIdentityV3
  groupId: string
  itemName: string
  autoDraft?: boolean
}) {
  const updateGroups = useIdentityStore((s) => s.updateCurrentSkillGroups)
  const removeSkill = useIdentityStore((s) => s.removeSkillFromCurrentIdentity)
  const setSelection = useIdentityStore((s) => s.setMapSelection)
  const group = identity.skills.groups.find((g) => g.id === groupId)
  const item: ProfessionalSkillItem | undefined = group?.items.find((i) =>
    skillNamesMatch(i.name, itemName),
  )
  const [editing, setEditing] = useState(false)
  const [removePending, setRemovePending] = useState(false)
  const [draftDepth, setDraftDepth] = useState<EditableSkillDepth>('')
  const [draftConfidence, setDraftConfidence] = useState<EditableDepthConfidence>('')
  const [draftContext, setDraftContext] = useState('')
  const [draftPositioning, setDraftPositioning] = useState('')
  const [draftPositioningSelection, setDraftPositioningSelection] =
    useState<PositioningSelection>('')
  const [draftTags, setDraftTags] = useState('')
  const [suggestion, setSuggestion] = useState<SkillEnrichmentSuggestion | null>(null)
  const [suggestionNotice, setSuggestionNotice] = useState<string | null>(null)
  const [suggestionError, setSuggestionError] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const confirmCopyId = useId()
  const confirmRowId = useId()
  const positioningFieldId = useId()
  const customPositioningFieldId = useId()
  const removeButtonRef = useRef<HTMLButtonElement>(null)
  const editButtonRef = useRef<HTMLButtonElement>(null)
  const suggestAbortRef = useRef<AbortController | null>(null)
  const autoDraftKeyRef = useRef<string | null>(null)
  const aiEndpoint = useMemo(() => sanitizeEndpointUrl(facetClientEnv.anthropicProxyUrl), [])

  const hasBulletEvidence =
    group && item ? hasSkillEnrichmentBulletEvidence(identity, group, item) : false
  const confidence = item?.depthConfidence
  const confidenceLabel = confidence ? `${confidence} confidence` : '—'

  const startEditing = () => {
    if (!item) return
    setRemovePending(false)
    setDraftDepth(item.depth ?? '')
    setDraftConfidence(item.depthConfidence ?? '')
    setDraftContext(item.context ?? '')
    setDraftPositioning(item.positioning ?? '')
    setDraftPositioningSelection(resolvePositioningSelection(item.positioning ?? ''))
    setDraftTags(tagsToInput(item.tags))
    setEditing(true)
  }

  const handleSave = () => {
    if (!item) return
    const editedAt = new Date().toISOString()
    const nextContext = draftContext.trim()
    const nextPositioning = draftPositioning.trim()
    const nextIdentity = updateIdentityEnrichmentSkill(identity, groupId, itemName, (skill) => {
      const depthChanged = draftDepth !== (skill.depth ?? '')
      const contextChanged = nextContext !== (skill.context ?? '')
      const positioningChanged = nextPositioning !== (skill.positioning ?? '')
      const enrichmentChanged =
        depthChanged ||
        draftConfidence !== (skill.depthConfidence ?? '') ||
        contextChanged ||
        positioningChanged
      const enrichedBy =
        skill.enriched_by === 'llm-accepted' || skill.enriched_by === 'user-edited-llm'
          ? 'user-edited-llm'
          : 'user'
      return {
        ...applySkillDepthEdit(skill, draftDepth, editedAt),
        depthConfidence: draftDepth ? draftConfidence || undefined : undefined,
        context: nextContext || undefined,
        context_stale: computeStaleFlag({
          text: nextContext,
          textChanged: contextChanged,
          depthChanged,
          wasStale: skill.context_stale,
        }),
        positioning: nextPositioning || undefined,
        positioning_stale: computeStaleFlag({
          text: nextPositioning,
          textChanged: positioningChanged,
          depthChanged,
          wasStale: skill.positioning_stale,
        }),
        ...(enrichmentChanged
          ? {
              enriched_at: editedAt,
              enriched_by: enrichedBy,
              skipped_at: undefined,
            }
          : {}),
        tags: inputToTags(draftTags),
      }
    })
    updateGroups(nextIdentity.skills.groups)
    setEditing(false)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    handleSave()
  }

  const handleRemove = () => {
    if (!item) return
    removeSkill(groupId, item.name)
    setSelection({ type: 'skill-group', id: groupId })
  }

  const cancelRemove = () => {
    setRemovePending(false)
    removeButtonRef.current?.focus()
  }

  const handleGenerateDraft = useCallback(async () => {
    if (!group || !item) return
    if (isGenerating) return
    if (!hasBulletEvidence && !item.depth) {
      setSuggestionError('No bullet evidence matched this skill. Set the depth manually.')
      setSuggestionNotice(null)
      return
    }
    if (!aiEndpoint) {
      setSuggestionError('AI suggestions are disabled. Configure VITE_ANTHROPIC_PROXY_URL.')
      setSuggestionNotice(null)
      return
    }

    suggestAbortRef.current?.abort()
    const controller = new AbortController()
    suggestAbortRef.current = controller

    try {
      setIsGenerating(true)
      setSuggestionError(null)
      setSuggestionNotice(null)
      const preserveCurrentDepth = Boolean(item.depth)
      const nextSuggestion = await generateSkillEnrichmentSuggestion({
        endpoint: aiEndpoint,
        identity,
        group,
        skill: item,
        draftDepth: item.depth,
        preserveDepth: preserveCurrentDepth,
        signal: controller.signal,
      })

      if (controller.signal.aborted) return

      const normalizedSuggestion = {
        ...nextSuggestion,
        ...(preserveCurrentDepth
          ? {
              depth: item.depth,
              depthConfidence: nextSuggestion.depthConfidence ?? item.depthConfidence,
            }
          : {}),
        context: nextSuggestion.context?.trim() ? nextSuggestion.context : (item.context ?? ''),
        positioning: nextSuggestion.positioning?.trim()
          ? nextSuggestion.positioning
          : (item.positioning ?? ''),
      }
      setSuggestion(normalizedSuggestion)
      setSuggestionNotice('Draft ready. Review the depth, context, and positioning before applying.')
    } catch (caughtError) {
      if (controller.signal.aborted) return
      setSuggestionError(
        caughtError instanceof Error ? caughtError.message : 'Failed to generate skill draft.',
      )
      setSuggestionNotice(null)
    } finally {
      if (suggestAbortRef.current === controller) {
        suggestAbortRef.current = null
        setIsGenerating(false)
      }
    }
  }, [aiEndpoint, group, hasBulletEvidence, identity, isGenerating, item])

  const handleApplyDraft = () => {
    if (!item) return
    if (!suggestion?.depth) {
      setSuggestionError('The draft did not include a depth. Set this skill manually.')
      setSuggestionNotice(null)
      return
    }

    const suggestionDepth = suggestion.depth
    const editedAt = new Date().toISOString()
    const nextIdentity = updateIdentityEnrichmentSkill(identity, groupId, itemName, (skill) =>
      applySkillEnrichmentSuggestion(skill, { ...suggestion, depth: suggestionDepth }, editedAt),
    )
    updateGroups(nextIdentity.skills.groups)
    setSuggestion(null)
    setSuggestionNotice('Applied skill draft.')
    setSuggestionError(null)
    editButtonRef.current?.focus()
  }

  const handleDiscardDraft = () => {
    setSuggestion(null)
    editButtonRef.current?.focus()
  }

  useEffect(() => {
    return () => {
      suggestAbortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    suggestAbortRef.current?.abort()
    setSuggestion(null)
    setSuggestionNotice(null)
    setSuggestionError(null)
    setEditing(false)
    setRemovePending(false)
  }, [groupId, itemName])

  const applyDraftPositioningSelection = (nextSelection: PositioningSelection) => {
    setDraftPositioningSelection(nextSelection)
    if (!nextSelection) {
      setDraftPositioning('')
      return
    }
    if (nextSelection === CUSTOM_POSITIONING_VALUE) {
      return
    }
    setDraftPositioning(nextSelection)
  }

  useEffect(() => {
    if (!autoDraft) {
      autoDraftKeyRef.current = null
      return
    }
    if (!group || !item) return
    const key = `${groupId}:${itemName}`
    if (autoDraftKeyRef.current === key) return
    autoDraftKeyRef.current = key
    setSelection({ type: 'skill-item', groupId, itemId: itemName })
    void handleGenerateDraft()
  }, [autoDraft, group, groupId, handleGenerateDraft, item, itemName, setSelection])

  if (!group || !item) return <NotFound label="skill" />

  if (editing) {
    return (
      <SlotShell eyebrow={`Skill · ${group.label}`} title={item.name}>
        <form onSubmit={handleSubmit}>
          <label className="inspector-field">
            <span className="inspector-field-label label-tracked">Depth</span>
            <select
              className="inspector-input"
              value={draftDepth}
              onChange={(e) => {
                setDraftDepth(e.target.value as EditableSkillDepth)
                setDraftConfidence('')
              }}
              autoFocus
            >
              <option value="">Not set</option>
              {DEPTH_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="inspector-field">
            <span className="inspector-field-label label-tracked">Depth confidence</span>
            <select
              className="inspector-input"
              value={draftConfidence}
              onChange={(e) => setDraftConfidence(e.target.value as EditableDepthConfidence)}
              disabled={!draftDepth}
            >
              <option value="">Not set</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>
          <label className="inspector-field">
            <span className="inspector-field-label label-tracked">Context</span>
            <textarea
              className="inspector-textarea"
              value={draftContext}
              onChange={(e) => setDraftContext(e.target.value)}
            />
          </label>
          <div className="inspector-field">
            <label className="inspector-field-label label-tracked" htmlFor={positioningFieldId}>
              Positioning
            </label>
            <select
              id={positioningFieldId}
              className="inspector-input"
              value={draftPositioningSelection}
              onChange={(e) =>
                applyDraftPositioningSelection(e.target.value as PositioningSelection)
              }
            >
              <option value="">Not set</option>
              {POSITIONING_EXAMPLES.map((example) => (
                <option key={example} value={example}>
                  {example}
                </option>
              ))}
              <option value={CUSTOM_POSITIONING_VALUE}>Custom...</option>
            </select>
            {draftPositioningSelection === CUSTOM_POSITIONING_VALUE ? (
              <>
                <label
                  className="inspector-field-label label-tracked"
                  htmlFor={customPositioningFieldId}
                >
                  Custom positioning
                </label>
                <textarea
                  id={customPositioningFieldId}
                  className="inspector-textarea"
                  value={draftPositioning}
                  onChange={(e) => {
                    setDraftPositioning(e.target.value)
                  }}
                />
                <details className="identity-field-examples">
                  <summary>Example custom positioning directives</summary>
                  <ul className="identity-example-list">
                    {CUSTOM_POSITIONING_EXAMPLES.map((example) => (
                      <li key={example}>{example}</li>
                    ))}
                  </ul>
                </details>
              </>
            ) : null}
          </div>
          <label className="inspector-field">
            <span className="inspector-field-label label-tracked">Tags (comma-separated)</span>
            <input
              className="inspector-input"
              type="text"
              value={draftTags}
              onChange={(e) => setDraftTags(e.target.value)}
            />
          </label>
          <Actions>
            <button type="submit" className="inspector-btn primary">
              Save skill
            </button>
            <button type="button" className="inspector-btn" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </Actions>
        </form>
      </SlotShell>
    )
  }

  return (
    <SlotShell eyebrow={`Skill · ${group.label}`} title={item.name}>
      <MetaRows
        rows={[
          ['Depth', item.depth ?? '—'],
          ['Confidence', confidenceLabel],
          ['Context', item.context?.trim() || '—'],
          ['Positioning', item.positioning?.trim() || '—'],
          ['Tags', item.tags?.join(' · ') || '—'],
        ]}
      />
      {!item.depth ? (
        <Prompt
          label="Cleanup"
          text="Depth is missing. Draft depth, context, and positioning here before using this skill downstream."
        />
      ) : null}
      {!hasBulletEvidence ? (
        <Prompt
          label="Review"
          text="No direct bullet evidence matched this skill. Confirm the depth before relying on it."
        />
      ) : null}
      {confidence === 'low' ? (
        <Prompt
          label="Confirm"
          text="The depth inference is low confidence. Review it before treating this as a strong signal."
        />
      ) : null}
      {suggestion ? (
        <div className={`skill-draft-card confidence-${suggestion.depthConfidence ?? 'unknown'}`}>
          <div className="skill-draft-card-head">
            <span className="label-tracked">AI draft</span>
            <span className="skill-draft-confidence label-tracked">
              {suggestion.depthConfidence ? `${suggestion.depthConfidence} confidence` : 'no confidence'}
            </span>
          </div>
          <MetaRows
            rows={[
              ['Depth', suggestion.depth ?? '—'],
              ['Context', suggestion.context?.trim() || '—'],
              ['Positioning', suggestion.positioning?.trim() || '—'],
            ]}
          />
          <Actions>
            <button type="button" className="inspector-btn primary" onClick={handleApplyDraft}>
              Apply draft
            </button>
            <button type="button" className="inspector-btn" onClick={handleDiscardDraft}>
              Discard
            </button>
          </Actions>
        </div>
      ) : null}
      {suggestionNotice ? (
        <p className="inspector-status-message" role="status">
          {suggestionNotice}
        </p>
      ) : null}
      {suggestionError ? (
        <p className="inspector-error-message" role="alert">
          {suggestionError}
        </p>
      ) : null}
      <Actions>
        <button
          type="button"
          className={item.depth ? 'inspector-btn' : 'inspector-btn primary'}
          onClick={() => {
            if (isGenerating) return
            void handleGenerateDraft()
          }}
          aria-disabled={isGenerating || undefined}
          aria-busy={isGenerating || undefined}
        >
          {isGenerating ? 'Drafting...' : item.depth ? 'Re-draft skill' : 'Draft skill'}
        </button>
        <button
          ref={editButtonRef}
          type="button"
          className={item.depth ? 'inspector-btn primary' : 'inspector-btn'}
          onClick={startEditing}
        >
          Edit skill
        </button>
        <button
          ref={removeButtonRef}
          type="button"
          className="inspector-btn danger"
          onClick={() => setRemovePending(true)}
          aria-expanded={removePending}
          aria-controls={removePending ? confirmRowId : undefined}
        >
          Remove skill
        </button>
      </Actions>
      {removePending ? (
        <div id={confirmRowId} className="inspector-confirm-row" role="alert">
          <span id={confirmCopyId} className="inspector-confirm-copy">
            Remove {item.name}
            {hasSkillEnrichmentData(item) ? ' and its enrichment data' : ''}?
          </span>
          <button
            type="button"
            className="inspector-btn danger"
            onClick={handleRemove}
            aria-describedby={confirmCopyId}
          >
            Confirm remove
          </button>
          <button type="button" className="inspector-btn" onClick={cancelRemove}>
            Cancel
          </button>
        </div>
      ) : null}
    </SlotShell>
  )
}
