import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Sparkles } from 'lucide-react'
import type { ProfessionalIdentityArcEntry } from '../../../identity/schema'
import { useIdentityStore } from '../../../store/identityStore'
import { selfModelFillStrength } from '../../../utils/identityFillStrength'
import {
  generateSelfKnowledgeFromIdentity,
  generateStrategicPositioningFromIdentity,
  type ProfessionalStrategicInference,
} from '../../../utils/identityParametersGeneration'
import { IdentityBand } from '../IdentityBand'
import {
  ensureIdentityInferenceEndpoint,
  IdentityInferenceConfigError,
} from '../identityInferenceRuntime'
import {
  computePositioningDraftApplication,
  formatPositioningApplyMessage,
  getPositioningGenerationKey,
  getResidualPositioningDraft,
  hasPositioningDraftSections,
  type PositioningDraftApplySections,
} from '../positioningDraft'
import { useInferenceRequest } from '../useInferenceRequest'

interface ArcStop extends ProfessionalIdentityArcEntry {
  id: string
}

type GenerationMessage = {
  id: number
  tone: 'info' | 'error'
  text: string
  autoDismiss: boolean
}

const GENERATION_MESSAGE_DISMISS_MS = 8000

const ensurePositioningEndpoint = () => {
  return ensureIdentityInferenceEndpoint('Connect the AI proxy before refreshing positioning.')
}

const ensureSelfKnowledgeEndpoint = () => {
  return ensureIdentityInferenceEndpoint(
    'Connect the AI proxy before generating philosophy and interview self-knowledge.',
  )
}

/**
 * Build arc stops from persisted `self_model.arc[]` only. We deliberately do
 * NOT auto-derive chapters from `roles[]` — that would produce a degenerate
 * copy of the Roles band (same company + same role title in both places).
 * Roles is the evidence layer; arc is the narrative layer. They only show
 * different content when the arc has actually been authored.
 */
function buildArcStops(arc: ProfessionalIdentityArcEntry[]): ArcStop[] {
  return arc.map((entry, index) => ({ ...entry, id: `${entry.company}:${index}` }))
}

export function SelfModelBand({
  chapterRequestId = 0,
  selfKnowledgeRequestId = 0,
  positioningRequestId = 0,
}: {
  chapterRequestId?: number
  selfKnowledgeRequestId?: number
  positioningRequestId?: number
}) {
  const identity = useIdentityStore((s) => s.currentIdentity)
  const selection = useIdentityStore((s) => s.mapSelection)
  const setSelection = useIdentityStore((s) => s.setMapSelection)
  const updateCompetitiveMoat = useIdentityStore((s) => s.updateCurrentCompetitiveMoat)
  const updateUnfairAdvantages = useIdentityStore((s) => s.updateCurrentUnfairAdvantages)
  const updateArc = useIdentityStore((s) => s.updateCurrentSelfModelArc)
  const updatePhilosophy = useIdentityStore((s) => s.updateCurrentPhilosophy)
  const updateInterviewStyle = useIdentityStore((s) => s.updateCurrentInterviewStyle)
  const updateVectors = useIdentityStore((s) => s.updateCurrentSearchVectors)
  const updateQuestions = useIdentityStore((s) => s.updateCurrentAwarenessQuestions)
  const fill = selfModelFillStrength(identity)
  const identityGenerationKey = useMemo(
    () => (identity ? getPositioningGenerationKey(identity) : null),
    [identity],
  )
  const positioningGenerationRef = useRef(false)
  const selfKnowledgeGenerationRef = useRef(false)
  const positioningMessageIdRef = useRef(0)
  const selfKnowledgeMessageIdRef = useRef(0)
  const positioningAbortRef = useRef<AbortController | null>(null)
  const selfKnowledgeAbortRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)

  const self = identity?.self_model
  const arc = useMemo(() => buildArcStops(self?.arc ?? []), [self?.arc])
  const philosophy = self?.philosophy ?? []
  const interview = self?.interview_style
  const moat = self?.competitive_moat ?? ''
  const advantages = useMemo(() => self?.unfair_advantages ?? [], [self?.unfair_advantages])
  const isMoatSelected = selection?.type === 'competitive-moat'

  // Local draft state for advantages-add input. Re-syncs when the
  // canonical identity values change (e.g., after import or reset).
  const [newAdvantage, setNewAdvantage] = useState('')
  const [positioningDraft, setPositioningDraft] =
    useState<ProfessionalStrategicInference | null>(null)
  const [positioningDraftKey, setPositioningDraftKey] = useState<string | null>(null)
  const [generatingPositioning, setGeneratingPositioning] = useState(false)
  const [generatingSelfKnowledge, setGeneratingSelfKnowledge] = useState(false)
  const [positioningMessage, setPositioningMessage] =
    useState<GenerationMessage | null>(null)
  const [selfKnowledgeMessage, setSelfKnowledgeMessage] =
    useState<GenerationMessage | null>(null)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      positioningAbortRef.current?.abort()
      selfKnowledgeAbortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    if (!positioningMessage?.autoDismiss) return undefined

    const messageId = positioningMessage.id
    const timeoutId = window.setTimeout(() => {
      setPositioningMessage((current) => (current?.id === messageId ? null : current))
    }, GENERATION_MESSAGE_DISMISS_MS)

    return () => window.clearTimeout(timeoutId)
  }, [positioningMessage])

  useEffect(() => {
    if (!selfKnowledgeMessage?.autoDismiss) return undefined

    const messageId = selfKnowledgeMessage.id
    const timeoutId = window.setTimeout(() => {
      setSelfKnowledgeMessage((current) => (current?.id === messageId ? null : current))
    }, GENERATION_MESSAGE_DISMISS_MS)

    return () => window.clearTimeout(timeoutId)
  }, [selfKnowledgeMessage])

  useEffect(() => {
    if (!positioningDraftKey) return
    if (identityGenerationKey === positioningDraftKey) return

    setPositioningDraft(null)
    setPositioningDraftKey(null)
    setPositioningMessage(null)
  }, [identityGenerationKey, positioningDraftKey])

  const showPositioningMessage = useCallback((message: Omit<GenerationMessage, 'id'>) => {
    positioningMessageIdRef.current += 1
    setPositioningMessage({ ...message, id: positioningMessageIdRef.current })
  }, [])

  const showSelfKnowledgeMessage = useCallback(
    (message: Omit<GenerationMessage, 'id'>) => {
      selfKnowledgeMessageIdRef.current += 1
      setSelfKnowledgeMessage({ ...message, id: selfKnowledgeMessageIdRef.current })
    },
    [],
  )

  const handleGenerateChaptersFromRoles = useCallback(() => {
    const currentIdentity = useIdentityStore.getState().currentIdentity
    if (!currentIdentity) return
    if (currentIdentity.self_model.arc.length > 0) {
      showSelfKnowledgeMessage({
        tone: 'info',
        text: 'Career chapters already exist. Review or edit them in the arc instead of replacing them from roles.',
        autoDismiss: true,
      })
      return
    }

    const chapters = currentIdentity.roles.map<ProfessionalIdentityArcEntry>((role) => {
      const bullets = role.bullets ?? []
      const firstImpact = bullets
        .flatMap((bullet) => bullet.impact ?? [])
        .map((impact) => impact.trim())
        .find(Boolean)
      const firstOutcome = bullets
        .map((bullet) => bullet.outcome?.trim())
        .find(Boolean)
      const proof = firstImpact || firstOutcome || 'delivered key outcomes'

      return {
        company: role.company,
        chapter: `${role.title} chapter focused on ${proof}.`,
      }
    })

    if (chapters.length === 0) {
      showSelfKnowledgeMessage({
        tone: 'info',
        text: 'Add roles before generating career chapters.',
        autoDismiss: true,
      })
      return
    }

    updateArc(chapters)
    showSelfKnowledgeMessage({
      tone: 'info',
      text: `Generated ${chapters.length} career chapter${chapters.length === 1 ? '' : 's'} from roles.`,
      autoDismiss: true,
    })
  }, [showSelfKnowledgeMessage, updateArc])

  useInferenceRequest({
    requestId: chapterRequestId,
    handler: handleGenerateChaptersFromRoles,
  })

  const handleGenerateSelfKnowledge = useCallback(async () => {
    const currentIdentity = useIdentityStore.getState().currentIdentity
    if (!currentIdentity || selfKnowledgeGenerationRef.current) return

    try {
      selfKnowledgeGenerationRef.current = true
      selfKnowledgeAbortRef.current?.abort()
      const abortController = new AbortController()
      selfKnowledgeAbortRef.current = abortController
      const endpoint = ensureSelfKnowledgeEndpoint()
      const generationRevision = currentIdentity.model_revision ?? 0
      setGeneratingSelfKnowledge(true)
      showSelfKnowledgeMessage({
        tone: 'info',
        text: 'Generating philosophy and interview self-knowledge...',
        autoDismiss: false,
      })

      const generated = await generateSelfKnowledgeFromIdentity(currentIdentity, endpoint, {
        signal: abortController.signal,
      })
      if (abortController.signal.aborted || !mountedRef.current) return
      const latestIdentity = useIdentityStore.getState().currentIdentity
      if (!latestIdentity || (latestIdentity.model_revision ?? 0) !== generationRevision) {
        showSelfKnowledgeMessage({
          tone: 'info',
          text: 'Identity changed during generation; discarded the self-knowledge draft.',
          autoDismiss: true,
        })
        return
      }

      const generatedPhilosophy = generated.philosophy ?? []
      const generatedInterview = generated.interview_style ?? {
        strengths: [],
        weaknesses: [],
        prep_strategy: '',
      }
      const hasPhilosophy = generatedPhilosophy.length > 0
      const hasInterview =
        (generatedInterview.strengths?.length ?? 0) > 0 ||
        (generatedInterview.weaknesses?.length ?? 0) > 0 ||
        Boolean(generatedInterview.prep_strategy?.trim())
      if (!hasPhilosophy && !hasInterview) {
        showSelfKnowledgeMessage({
          tone: 'info',
          text: 'The generated draft did not return new self-knowledge.',
          autoDismiss: true,
        })
        return
      }

      if (hasPhilosophy) updatePhilosophy(generatedPhilosophy)
      if (hasInterview) {
        updateInterviewStyle({
          strengths: generatedInterview.strengths ?? [],
          weaknesses: generatedInterview.weaknesses ?? [],
          prep_strategy: generatedInterview.prep_strategy ?? '',
        })
      }

      showSelfKnowledgeMessage({
        tone: 'info',
        text: `Generated ${generatedPhilosophy.length} philosophy position${
          generatedPhilosophy.length === 1 ? '' : 's'
        } and interview self-knowledge.`,
        autoDismiss: true,
      })
    } catch (error) {
      const isAbortError =
        (error instanceof DOMException && error.name === 'AbortError') ||
        (error instanceof Error && error.name === 'AbortError')
      if (isAbortError) return

      const message = error instanceof Error ? error.message : ''
      const isConfigError = error instanceof IdentityInferenceConfigError
      if (!isConfigError) {
        console.error(error)
      }
      showSelfKnowledgeMessage({
        tone: 'error',
        text: isConfigError ? message : 'Unable to generate philosophy and interview self-knowledge.',
        autoDismiss: false,
      })
    } finally {
      if (mountedRef.current) {
        selfKnowledgeAbortRef.current = null
        selfKnowledgeGenerationRef.current = false
        setGeneratingSelfKnowledge(false)
      }
    }
  }, [showSelfKnowledgeMessage, updateInterviewStyle, updatePhilosophy])

  useInferenceRequest({
    requestId: selfKnowledgeRequestId,
    handler: handleGenerateSelfKnowledge,
    skipWhen: () => selfKnowledgeGenerationRef.current,
    onSkipped: () => {
      showSelfKnowledgeMessage({
        tone: 'info',
        text: 'Self-knowledge generation is already running.',
        autoDismiss: true,
      })
    },
  })

  const dismissPositioningDraft = () => {
    setPositioningDraft(null)
    setPositioningDraftKey(null)
    setPositioningMessage(null)
  }

  const handleAddAdvantage = () => {
    const trimmed = newAdvantage.trim()
    if (!trimmed) return
    updateUnfairAdvantages([...advantages, trimmed])
    setNewAdvantage('')
  }
  const handleRemoveAdvantage = (index: number) => {
    updateUnfairAdvantages(advantages.filter((_, i) => i !== index))
  }

  const handleRefreshPositioning = useCallback(async () => {
    if (!identity || positioningGenerationRef.current) return

    try {
      const currentIdentity = useIdentityStore.getState().currentIdentity
      if (!currentIdentity) return

      positioningGenerationRef.current = true
      positioningAbortRef.current?.abort()
      const abortController = new AbortController()
      positioningAbortRef.current = abortController
      const endpoint = ensurePositioningEndpoint()
      const generationKey = getPositioningGenerationKey(currentIdentity)
      setGeneratingPositioning(true)
      setPositioningDraft(null)
      setPositioningDraftKey(null)
      showPositioningMessage({
        tone: 'info',
        text: 'Generating a reviewed positioning draft...',
        autoDismiss: false,
      })

      const generated = await generateStrategicPositioningFromIdentity(currentIdentity, endpoint, {
        mode: 'regenerate',
        signal: abortController.signal,
      })
      if (abortController.signal.aborted || !mountedRef.current) return
      const latestIdentity = useIdentityStore.getState().currentIdentity
      if (!latestIdentity || getPositioningGenerationKey(latestIdentity) !== generationKey) {
        showPositioningMessage({
          tone: 'info',
          text: 'Identity changed during generation; discarded the positioning draft.',
          autoDismiss: true,
        })
        return
      }

      setPositioningDraft(generated)
      setPositioningDraftKey(generationKey)
      const hasDraftSections = hasPositioningDraftSections(generated)
      showPositioningMessage({
        tone: 'info',
        text: hasDraftSections
          ? 'Review the generated positioning before applying it.'
          : 'The generated draft did not return new positioning sections.',
        autoDismiss: !hasDraftSections,
      })
    } catch (error) {
      const isAbortError =
        (error instanceof DOMException && error.name === 'AbortError') ||
        (error instanceof Error && error.name === 'AbortError')
      if (isAbortError) {
        return
      }
      const message = error instanceof Error ? error.message : ''
      const isConfigError = error instanceof IdentityInferenceConfigError
      if (!isConfigError) {
        console.error(error)
      }
      showPositioningMessage({
        tone: 'error',
        text: isConfigError ? message : 'Unable to refresh positioning.',
        autoDismiss: false,
      })
    } finally {
      if (mountedRef.current) {
        positioningAbortRef.current = null
        positioningGenerationRef.current = false
        setGeneratingPositioning(false)
      }
    }
  }, [identity, showPositioningMessage])
  useInferenceRequest({
    requestId: positioningRequestId,
    handler: handleRefreshPositioning,
    skipWhen: () => positioningGenerationRef.current,
    onSkipped: () => {
      showPositioningMessage({
        tone: 'info',
        text: 'Positioning refresh is already running.',
        autoDismiss: true,
      })
    },
  })

  const applyDraftSections = (sections: PositioningDraftApplySections) => {
    if (!positioningDraft) return
    // The draft is the rendered review snapshot; identity is read live so apply
    // operations respect edits made while the draft was open.
    const latestIdentity = useIdentityStore.getState().currentIdentity
    if (!latestIdentity) return
    if (
      positioningDraftKey &&
      getPositioningGenerationKey(latestIdentity) !== positioningDraftKey
    ) {
      setPositioningDraft(null)
      setPositioningDraftKey(null)
      showPositioningMessage({
        tone: 'info',
        text: 'Identity changed since this draft was generated; discarded the positioning draft.',
        autoDismiss: true,
      })
      return
    }
    const application = computePositioningDraftApplication({
      draft: positioningDraft,
      identity: latestIdentity,
      sections,
    })

    if (application.shouldReplaceMoat) {
      updateCompetitiveMoat(application.draftMoat)
    }
    if (application.nextAdvantages.length > 0) {
      updateUnfairAdvantages([
        ...application.existingAdvantages,
        ...application.nextAdvantages,
      ])
    }
    if (application.nextVectors.length > 0) {
      updateVectors([...application.existingVectors, ...application.nextVectors])
    }
    if (application.nextQuestions.length > 0) {
      updateQuestions([...application.existingQuestions, ...application.nextQuestions])
    }

    showPositioningMessage({
      tone: 'info',
      text: formatPositioningApplyMessage({
        replacedMoat: application.shouldReplaceMoat,
        advantageCount: application.nextAdvantages.length,
        vectorCount: application.nextVectors.length,
        questionCount: application.nextQuestions.length,
      }),
      autoDismiss: true,
    })

    const nextDraft = getResidualPositioningDraft(positioningDraft, {
      moat: sections.moat,
      advantages: sections.advantages,
      vectors: sections.vectors,
      questions: sections.questions,
    })
    setPositioningDraft(nextDraft)
    const updatedIdentity = useIdentityStore.getState().currentIdentity
    setPositioningDraftKey(
      nextDraft && updatedIdentity ? getPositioningGenerationKey(updatedIdentity) : null,
    )
  }

  return (
    <IdentityBand
      layer="self"
      name="Self Model"
      subtitle="arc · philosophy · interview self-knowledge"
      fill={fill}
    >
      <div className="self-grid">
        <div className="self-knowledge-controls">
          <div>
            <div className="arc-label label-tracked">Inference</div>
            <p className="chapter-copy">
              Generate durable philosophy and interview self-knowledge from the current evidence.
            </p>
          </div>
          <button
            type="button"
            className="inspector-btn primary self-knowledge-generate"
            onClick={handleGenerateSelfKnowledge}
            disabled={!identity || generatingSelfKnowledge}
            aria-busy={generatingSelfKnowledge}
          >
            <Sparkles size={14} aria-hidden="true" />
            {generatingSelfKnowledge ? 'Generating...' : 'Generate self-knowledge'}
          </button>
          <div className="strategy-generation-stack self-knowledge-status">
            <PositioningGenerationStatus message={selfKnowledgeMessage} tone="info" />
            <PositioningGenerationStatus message={selfKnowledgeMessage} tone="error" />
          </div>
        </div>

        <div className="self-arc">
          <div className="arc-label label-tracked">Career Arc</div>
          {arc.length === 0 ? (
            <div className="self-arc-empty">
              <p className="chapter-copy">
                No narrative chapters yet. Roles tell what you did; arc tells what each chapter meant — the interpretive layer that powers interview prep.
              </p>
              <button
                type="button"
                className="inspector-btn primary self-arc-cta"
                onClick={handleGenerateChaptersFromRoles}
              >
                Draft chapters from roles
              </button>
            </div>
          ) : (
            <div className="arc-flow">
              {arc.map((stop) => {
                const isSelected = selection?.type === 'arc-stop' && selection.id === stop.id
                return (
                  <button
                    key={stop.id}
                    type="button"
                    className={`arc-stop${isSelected ? ' selected' : ''}`}
                    onClick={() => setSelection({ type: 'arc-stop', id: stop.id })}
                    aria-pressed={isSelected}
                  >
                    <span className="arc-stop-company">{stop.company}</span>
                    <span className="arc-stop-chapter chapter-copy">{stop.chapter}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="self-philosophy">
          <div className="arc-label label-tracked">
            Philosophy <span className="self-count">{philosophy.length} positions</span>
          </div>
          {philosophy.length === 0 ? (
            <p className="chapter-copy self-empty">No philosophy positions captured yet.</p>
          ) : (
            <ul className="self-philosophy-list">
              {philosophy.map((p) => {
                const isSelected = selection?.type === 'philosophy' && selection.id === p.id
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      className={`philosophy-item${isSelected ? ' selected' : ''}`}
                      onClick={() => setSelection({ type: 'philosophy', id: p.id })}
                      aria-pressed={isSelected}
                    >
                      <span className="philosophy-id label-tracked">{p.id}</span>
                      <span className="philosophy-text">{p.text}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="self-interview">
          <div className="arc-label label-tracked">Interview Self-Knowledge</div>
          <InterviewBlock label="Strengths" items={interview?.strengths ?? []} />
          <InterviewBlock label="Weaknesses" items={interview?.weaknesses ?? []} weak />
          <InterviewBlock
            label="Prep Strategy"
            items={interview?.prep_strategy?.trim() ? [interview.prep_strategy.trim()] : []}
          />
        </div>

        <div className="self-positioning">
          <div className="self-positioning-header">
            <div className="arc-label label-tracked">Strategic Positioning</div>
            <button
              type="button"
              className="inspector-btn self-positioning-refresh"
              onClick={handleRefreshPositioning}
              disabled={!identity || generatingPositioning}
              aria-busy={generatingPositioning}
            >
              <Sparkles size={14} aria-hidden="true" />
              {generatingPositioning ? 'Refreshing...' : 'Refresh positioning'}
            </button>
          </div>
          <div className="strategy-generation-stack self-positioning-status">
            {/* Keep both live regions mounted so polite and assertive updates are stable. */}
            <PositioningGenerationStatus message={positioningMessage} tone="info" />
            <PositioningGenerationStatus message={positioningMessage} tone="error" />
          </div>
          {positioningDraft && hasPositioningDraftSections(positioningDraft) ? (
            <div
              className="self-strategy-draft"
              role="region"
              aria-label="Generated positioning draft"
            >
              <div className="self-strategy-draft-header">
                <div>
                  <div className="self-positioning-label label-tracked">
                    Review Generated Positioning
                  </div>
                  <p className="chapter-copy">
                    Apply only the sections that feel stronger than the current identity.
                  </p>
                </div>
                <div className="self-strategy-draft-actions">
                  <button
                    type="button"
                    className="inspector-btn primary"
                    onClick={() =>
                      applyDraftSections({
                        moat: true,
                        advantages: true,
                        vectors: true,
                        questions: true,
                      })
                    }
                  >
                    Apply all draft
                  </button>
                  <button
                    type="button"
                    className="inspector-btn"
                    onClick={dismissPositioningDraft}
                  >
                    Dismiss
                  </button>
                </div>
              </div>

              {positioningDraft.competitive_moat?.trim() ? (
                <DraftSection
                  label="Proposed competitive moat"
                  action="Replace moat"
                  onApply={() => applyDraftSections({ moat: true })}
                >
                  <p>{positioningDraft.competitive_moat.trim()}</p>
                </DraftSection>
              ) : null}

              {positioningDraft.unfair_advantages.length > 0 ? (
                <DraftSection
                  label={`Unfair advantages (${positioningDraft.unfair_advantages.length})`}
                  action="Add advantages"
                  onApply={() => applyDraftSections({ advantages: true })}
                >
                  <ul>
                    {positioningDraft.unfair_advantages.map((advantage, index) => (
                      <li key={`${index}-${advantage}`}>{advantage}</li>
                    ))}
                  </ul>
                </DraftSection>
              ) : null}

              {positioningDraft.search_vectors.length > 0 ? (
                <DraftSection
                  label={`Search vectors (${positioningDraft.search_vectors.length})`}
                  action="Add vectors"
                  onApply={() => applyDraftSections({ vectors: true })}
                >
                  <ul>
                    {positioningDraft.search_vectors.map((vector, index) => (
                      <li key={`${index}-${vector.title}`}>
                        <strong>{vector.title}</strong>
                        <span>{vector.thesis}</span>
                      </li>
                    ))}
                  </ul>
                </DraftSection>
              ) : null}

              {positioningDraft.open_questions.length > 0 ? (
                <DraftSection
                  label={`Open questions (${positioningDraft.open_questions.length})`}
                  action="Add questions"
                  onApply={() => applyDraftSections({ questions: true })}
                >
                  <ul>
                    {positioningDraft.open_questions.map((question, index) => (
                      <li key={`${index}-${question.topic}`}>
                        <strong>{question.topic}</strong>
                        <span>{question.action}</span>
                      </li>
                    ))}
                  </ul>
                </DraftSection>
              ) : null}
            </div>
          ) : null}
          <div className="self-positioning-block">
            <div className="self-positioning-label label-tracked">Competitive Moat</div>
            <button
              type="button"
              className={`self-moat-card${isMoatSelected ? ' selected' : ''}`}
              onClick={() => setSelection({ type: 'competitive-moat' })}
              aria-pressed={isMoatSelected}
            >
              <span className="self-moat-text chapter-copy">
                {moat.trim() ||
                  'No competitive moat captured yet. Click to add the structural difference you want positioning to honor.'}
              </span>
              <span className="self-moat-action label-tracked">
                {moat.trim() ? 'Edit in inspector' : 'Add in inspector'}
              </span>
            </button>
          </div>

          <div className="self-positioning-block">
            <div className="self-positioning-label label-tracked">
              Unfair Advantages <span className="self-count">{advantages.length}</span>
            </div>
            {advantages.length === 0 ? (
              <p className="chapter-copy self-empty">
                No unfair advantages captured yet. The thesis generator expands each
                advantage into a target-company-profile lens at search time.
              </p>
            ) : (
              <ul className="self-advantage-list">
                {advantages.map((advantage, index) => (
                  <li key={`${index}-${advantage}`} className="self-advantage-item">
                    <span className="self-advantage-text">{advantage}</span>
                    <button
                      type="button"
                      className="inspector-btn self-advantage-remove"
                      onClick={() => handleRemoveAdvantage(index)}
                      aria-label={`Remove "${advantage}"`}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="self-advantage-add">
              <input
                className="self-advantage-input"
                value={newAdvantage}
                onChange={(event) => setNewAdvantage(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    handleAddAdvantage()
                  }
                }}
                placeholder='e.g. "Platform engineering plus security depth"'
                aria-label="New unfair advantage"
                disabled={!identity}
              />
              <button
                type="button"
                className="inspector-btn"
                onClick={handleAddAdvantage}
                disabled={!identity || !newAdvantage.trim()}
              >
                + Add
              </button>
            </div>
          </div>
        </div>
      </div>
    </IdentityBand>
  )
}

function PositioningGenerationStatus({
  message,
  tone,
}: {
  message: GenerationMessage | null
  tone: GenerationMessage['tone']
}) {
  const hasMessage = message?.tone === tone
  const ariaLive = tone === 'info' ? 'polite' : 'assertive'
  const role = tone === 'info' ? 'status' : 'alert'

  return (
    <div
      className={`strategy-generation-message ${tone} ${hasMessage ? '' : 'empty'}`}
      role={role}
      aria-live={ariaLive}
      aria-atomic="true"
    >
      {hasMessage ? message.text : ''}
    </div>
  )
}

function DraftSection({
  label,
  action,
  onApply,
  children,
}: {
  label: string
  action: string
  onApply: () => void
  children: ReactNode
}) {
  return (
    <section className="self-strategy-draft-section" aria-label={label}>
      <div className="self-strategy-draft-section-header">
        <div className="self-positioning-label label-tracked">{label}</div>
        <button type="button" className="inspector-btn" onClick={onApply}>
          {action}
        </button>
      </div>
      <div className="self-strategy-draft-content">{children}</div>
    </section>
  )
}

function InterviewBlock({ label, items, weak = false }: { label: string; items: string[]; weak?: boolean }) {
  return (
    <div className={`interview-block${weak ? ' interview-weak' : ''}`}>
      <div className="interview-block-label label-tracked">{label}</div>
      {items.length === 0 ? (
        <p className="chapter-copy self-empty">— not captured</p>
      ) : (
        <ul>
          {items.map((item, index) => (
            <li key={`${label}-${index}`}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
