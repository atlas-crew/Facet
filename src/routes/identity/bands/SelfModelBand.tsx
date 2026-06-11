import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Sparkles } from 'lucide-react'
import { AiWorkingStatus } from '../../../components/AiWorkingStatus'
import type {
  ProfessionalExpertise,
  ProfessionalExpertiseEvidence,
  ProfessionalIdentityArcEntry,
} from '../../../identity/schema'
import { useIdentityStore } from '../../../store/identityStore'
import { createId } from '../../../utils/idUtils'
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

const normalizeExpertiseTags = (value: string): string[] =>
  Array.from(
    new Set(
      value
        .split(',')
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean),
    ),
  )

const MAX_EVIDENCE_CHIP_TEXT = 56

const truncateEvidenceChipText = (value: string): string =>
  value.length > MAX_EVIDENCE_CHIP_TEXT
    ? `${value.slice(0, MAX_EVIDENCE_CHIP_TEXT - 1).trimEnd()}...`
    : value

const formatExpertiseEvidenceChip = (evidence: ProfessionalExpertiseEvidence): string => {
  const parts = [
    evidence.kind,
    evidence.role_id ? `role ${evidence.role_id}` : '',
    evidence.bullet_id ? `bullet ${evidence.bullet_id}` : '',
    evidence.project_id ? `project ${evidence.project_id}` : '',
    evidence.label ? `label ${evidence.label}` : '',
    evidence.kind === 'source' && evidence.source_text
      ? truncateEvidenceChipText(evidence.source_text)
      : '',
  ].filter(Boolean)

  return parts.join(' · ')
}

const getSourceEvidenceText = (evidence: ProfessionalExpertiseEvidence): string =>
  evidence.source_text ?? evidence.label ?? ''

export function SelfModelBand({
  chapterRequestId = 0,
  selfKnowledgeRequestId = 0,
  positioningRequestId = 0,
  onChapterRequestSettled,
  onSelfKnowledgeRequestSettled,
  onPositioningRequestSettled,
  onSelfKnowledgeRequestStarted,
}: {
  chapterRequestId?: number
  selfKnowledgeRequestId?: number
  positioningRequestId?: number
  onChapterRequestSettled?: (requestId: number, status: 'succeeded' | 'failed') => void
  onSelfKnowledgeRequestSettled?: (requestId: number, status: 'succeeded' | 'failed') => void
  onPositioningRequestSettled?: (requestId: number, status: 'succeeded' | 'failed') => void
  onSelfKnowledgeRequestStarted?: () => void
}) {
  const identity = useIdentityStore((s) => s.currentIdentity)
  const selection = useIdentityStore((s) => s.mapSelection)
  const setSelection = useIdentityStore((s) => s.setMapSelection)
  const updateCompetitiveMoat = useIdentityStore((s) => s.updateCurrentCompetitiveMoat)
  const updateUnfairAdvantages = useIdentityStore((s) => s.updateCurrentUnfairAdvantages)
  const updateExpertise = useIdentityStore((s) => s.updateCurrentExpertise)
  const updateArc = useIdentityStore((s) => s.updateCurrentSelfModelArc)
  const updatePhilosophy = useIdentityStore((s) => s.updateCurrentPhilosophy)
  const updateInterviewStyle = useIdentityStore((s) => s.updateCurrentInterviewStyle)
  const updateVectors = useIdentityStore((s) => s.updateCurrentSearchVectors)
  const updateQuestions = useIdentityStore((s) => s.updateCurrentAwarenessQuestions)
  // Manual edits below tag the correction; the generation writebacks in this
  // band (chapters, philosophy, positioning application) deliberately do not.
  const recordCorrection = useIdentityStore((s) => s.recordIdentityCorrection)
  const recordAiGenerationUndo = useIdentityStore((s) => s.recordAiGenerationUndo)
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
  const expertise = useMemo(() => identity?.expertise ?? [], [identity?.expertise])
  const isMoatSelected = selection?.type === 'competitive-moat'

  // Local draft state for advantages-add input. Re-syncs when the
  // canonical identity values change (e.g., after import or reset).
  const [newAdvantage, setNewAdvantage] = useState('')
  const [newExpertiseLabel, setNewExpertiseLabel] = useState('')
  const [expertiseTagDrafts, setExpertiseTagDrafts] = useState<Record<string, string>>({})
  const [expertiseEvidenceDrafts, setExpertiseEvidenceDrafts] = useState<Record<string, string>>({})
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
    recordAiGenerationUndo('drafted career chapters', currentIdentity)
    showSelfKnowledgeMessage({
      tone: 'info',
      text: `Generated ${chapters.length} career chapter${chapters.length === 1 ? '' : 's'} from roles.`,
      autoDismiss: true,
    })
  }, [recordAiGenerationUndo, showSelfKnowledgeMessage, updateArc])

  useInferenceRequest({
    requestId: chapterRequestId,
    handler: handleGenerateChaptersFromRoles,
    onSettled: onChapterRequestSettled,
  })

  const handleGenerateSelfKnowledge = useCallback(async () => {
    const currentIdentity = useIdentityStore.getState().currentIdentity
    if (!currentIdentity || selfKnowledgeGenerationRef.current) return false

    try {
      selfKnowledgeGenerationRef.current = true
      selfKnowledgeAbortRef.current?.abort()
      const abortController = new AbortController()
      selfKnowledgeAbortRef.current = abortController
      const endpoint = ensureSelfKnowledgeEndpoint()
      const generationRevision = currentIdentity.model_revision ?? 0
      onSelfKnowledgeRequestStarted?.()
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
        return false
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
        return false
      }

      const beforeIdentity = latestIdentity
      if (hasPhilosophy) {
        updatePhilosophy(generatedPhilosophy)
      }
      if (hasInterview) {
        updateInterviewStyle({
          strengths: generatedInterview.strengths ?? [],
          weaknesses: generatedInterview.weaknesses ?? [],
          prep_strategy: generatedInterview.prep_strategy ?? '',
        })
      }
      recordAiGenerationUndo('generated self-knowledge', beforeIdentity)

      showSelfKnowledgeMessage({
        tone: 'info',
        text: `Generated ${generatedPhilosophy.length} philosophy position${
          generatedPhilosophy.length === 1 ? '' : 's'
        } and interview self-knowledge.`,
        autoDismiss: true,
      })
      return true
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
      return false
    } finally {
      if (mountedRef.current) {
        selfKnowledgeAbortRef.current = null
        selfKnowledgeGenerationRef.current = false
        setGeneratingSelfKnowledge(false)
      }
    }
  }, [
    onSelfKnowledgeRequestStarted,
    showSelfKnowledgeMessage,
    recordAiGenerationUndo,
    updateInterviewStyle,
    updatePhilosophy,
  ])

  useInferenceRequest({
    requestId: selfKnowledgeRequestId,
    handler: handleGenerateSelfKnowledge,
    onSettled: onSelfKnowledgeRequestSettled,
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
    recordCorrection('positioning')
    setNewAdvantage('')
  }
  const handleRemoveAdvantage = (index: number) => {
    updateUnfairAdvantages(advantages.filter((_, i) => i !== index))
    recordCorrection('positioning')
  }
  const handleAddExpertise = () => {
    const label = newExpertiseLabel.trim()
    if (!label) return
    const next: ProfessionalExpertise = {
      id: createId('expertise'),
      label,
      summary: '',
      tags: [],
      evidence: [],
      provenance: 'claimed',
      needs_review: false,
    }
    updateExpertise([...expertise, next])
    recordCorrection('skills')
    setNewExpertiseLabel('')
  }
  const handleUpdateExpertise = (id: string, patch: Partial<ProfessionalExpertise>) => {
    updateExpertise(
      expertise.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              ...patch,
            }
          : entry,
      ),
    )
    recordCorrection('skills')
  }
  const handleUpdateExpertiseTags = (id: string, value: string) => {
    const tags = normalizeExpertiseTags(value)
    handleUpdateExpertise(id, { tags })
    setExpertiseTagDrafts((drafts) => ({ ...drafts, [id]: tags.join(', ') }))
  }
  const handleUpdateExpertiseEvidence = (id: string, value: string) => {
    const current = expertise.find((entry) => entry.id === id)
    const structuredEvidence =
      current?.evidence.filter((evidence) => evidence.kind !== 'source') ?? []
    const existingSourceEvidence =
      current?.evidence.filter((evidence) => evidence.kind === 'source') ?? []
    const sourceEvidenceByText = new Map(
      existingSourceEvidence.map((evidence) => [getSourceEvidenceText(evidence), evidence]),
    )
    const sourceEvidence = value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((source_text) => {
        const existing = sourceEvidenceByText.get(source_text)
        if (existing) {
          return existing
        }

        return { kind: 'source' as const, source_text }
      })
    const evidence = [...structuredEvidence, ...sourceEvidence]
    handleUpdateExpertise(id, { evidence })
    setExpertiseEvidenceDrafts((drafts) => ({
      ...drafts,
      [id]: sourceEvidence.map(getSourceEvidenceText).join('\n'),
    }))
  }
  const handleRemoveExpertise = (id: string) => {
    updateExpertise(expertise.filter((entry) => entry.id !== id))
    recordCorrection('skills')
  }

  const handleRefreshPositioning = useCallback(async () => {
    if (!identity || positioningGenerationRef.current) return false

    try {
      const currentIdentity = useIdentityStore.getState().currentIdentity
      if (!currentIdentity) return false

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
        return false
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
      return hasDraftSections
    } catch (error) {
      const isAbortError =
        (error instanceof DOMException && error.name === 'AbortError') ||
        (error instanceof Error && error.name === 'AbortError')
      if (isAbortError) {
        return false
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
      return false
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
    onSettled: onPositioningRequestSettled,
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

    const beforeIdentity = latestIdentity
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
    recordAiGenerationUndo('applied positioning draft', beforeIdentity)

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
            <AiWorkingStatus
              active={generatingSelfKnowledge}
              label="Generating self-knowledge"
              caption="AI is drafting durable philosophy positions, interview strengths, weaknesses, and prep guidance."
              expectedDurationMs={90000}
            />
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
          <InterviewBlock label="Strengths" items={interview?.strengths ?? []} tone="strength" />
          <InterviewBlock label="Weaknesses" items={interview?.weaknesses ?? []} tone="weakness" />
          <InterviewBlock
            label="Prep Strategy"
            items={interview?.prep_strategy?.trim() ? [interview.prep_strategy.trim()] : []}
            tone="strategy"
          />
        </div>

        <div className="self-expertise">
          <div className="self-positioning-label label-tracked">
            Areas of Expertise <span className="self-count">{expertise.length}</span>
          </div>
          {expertise.length === 0 ? (
            <p className="chapter-copy self-empty">
              No expertise areas captured yet. Use these for domains of judgment, not tool proficiency.
            </p>
          ) : (
            <ul className="self-expertise-list">
              {expertise.map((entry, index) => {
                const labelForControls = `expertise area ${index + 1}`
                const sourceEvidence = entry.evidence
                  .filter((evidence) => evidence.kind === 'source')
                  .map(getSourceEvidenceText)
                  .filter(Boolean)
                  .join('\n')
                return (
                  <li key={entry.id} className="self-expertise-item">
                    <div className="self-expertise-item-header">
                      <input
                        className="self-advantage-input self-expertise-title"
                        value={entry.label}
                        onChange={(event) =>
                          handleUpdateExpertise(entry.id, { label: event.target.value })
                        }
                        aria-label={`Expertise label for ${labelForControls}`}
                      />
                      <span
                        className={`identity-action-status label-tracked ${
                          entry.needs_review ? 'review' : 'accepted'
                        }`}
                      >
                        {entry.needs_review ? 'Review' : 'Accepted'}
                      </span>
                    </div>
                    <textarea
                      className="self-expertise-textarea"
                      value={entry.summary}
                      onChange={(event) =>
                        handleUpdateExpertise(entry.id, { summary: event.target.value })
                      }
                      aria-label={`Expertise summary for ${labelForControls}`}
                      placeholder="Describe the domain judgment this captures."
                    />
                    <input
                      className="self-advantage-input"
                      value={expertiseTagDrafts[entry.id] ?? entry.tags.join(', ')}
                      onChange={(event) =>
                        setExpertiseTagDrafts((drafts) => ({
                          ...drafts,
                          [entry.id]: event.target.value,
                        }))
                      }
                      onBlur={(event) => handleUpdateExpertiseTags(entry.id, event.target.value)}
                      aria-label={`Expertise tags for ${labelForControls}`}
                      placeholder="tags, comma-separated"
                    />
                    <textarea
                      className="self-expertise-textarea compact"
                      value={expertiseEvidenceDrafts[entry.id] ?? sourceEvidence}
                      onChange={(event) =>
                        setExpertiseEvidenceDrafts((drafts) => ({
                          ...drafts,
                          [entry.id]: event.target.value,
                        }))
                      }
                      onBlur={(event) =>
                        handleUpdateExpertiseEvidence(entry.id, event.target.value)
                      }
                      aria-label={`Expertise evidence for ${labelForControls}`}
                      placeholder="Evidence or source context, one per line"
                    />
                    <div className="self-expertise-evidence">
                      {entry.evidence.length === 0 ? (
                        <span className="chapter-copy self-empty">No evidence linked yet.</span>
                      ) : (
                        entry.evidence.map((evidence, evidenceIndex) => (
                          <span
                            key={`${entry.id}-evidence-${evidenceIndex}`}
                            className="identity-action-status label-tracked"
                          >
                            {formatExpertiseEvidenceChip(evidence)}
                          </span>
                        ))
                      )}
                    </div>
                    <div className="self-expertise-actions">
                      <button
                        type="button"
                        className="inspector-btn"
                        aria-label={`Mark expertise area reviewed: ${entry.label || labelForControls}`}
                        onClick={() =>
                          handleUpdateExpertise(entry.id, {
                            needs_review: false,
                            provenance:
                              entry.provenance === 'inferred' ? 'corrected' : entry.provenance,
                          })
                        }
                        disabled={!entry.needs_review}
                      >
                        Mark reviewed
                      </button>
                      <button
                        type="button"
                        className="inspector-btn self-advantage-remove"
                        aria-label={`Remove expertise area: ${entry.label || labelForControls}`}
                        onClick={() => handleRemoveExpertise(entry.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          <div className="self-advantage-add">
            <input
              className="self-advantage-input"
              value={newExpertiseLabel}
              onChange={(event) => setNewExpertiseLabel(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  handleAddExpertise()
                }
              }}
              placeholder='e.g. "Observability cost control"'
              aria-label="New area of expertise"
              disabled={!identity}
            />
            <button
              type="button"
              className="inspector-btn"
              onClick={handleAddExpertise}
              disabled={!identity || !newExpertiseLabel.trim()}
            >
              + Add
            </button>
          </div>
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
            <AiWorkingStatus
              active={generatingPositioning}
              label="Refreshing strategic positioning"
              caption="AI is reviewing the current identity model and preparing a positioning draft."
              expectedDurationMs={90000}
            />
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

function InterviewBlock({
  label,
  items,
  tone,
}: {
  label: string
  items: string[]
  tone: 'strength' | 'weakness' | 'strategy'
}) {
  return (
    <div className={`interview-block interview-${tone}`}>
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
