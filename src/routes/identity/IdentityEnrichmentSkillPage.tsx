import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import type { ProfessionalIdentityV3, ProfessionalSkillDepth } from '../../identity/schema'
import { useIdentityStore } from '../../store/identityStore'
import { facetClientEnv } from '../../utils/facetEnv'
import { sanitizeEndpointUrl } from '../../utils/idUtils'
import {
  findAdjacentIdentityEnrichmentSkills,
  findNextPendingIdentitySkill,
  getIdentityEnrichmentProgress,
  getSkillEnrichmentStatus,
  resolveIdentityEnrichmentSkill,
  updateIdentityEnrichmentSkill,
} from '../../utils/identityEnrichment'
import {
  type SkillEnrichmentSuggestion,
  generateSkillEnrichmentSuggestion,
} from '../../utils/skillEnrichment'
import './identity.css'

const DEPTH_OPTIONS: ProfessionalSkillDepth[] = ['expert', 'strong', 'working', 'basic', 'avoid']

const toSuggestion = (
  depth: ProfessionalSkillDepth,
  context: string,
  positioning: string,
): SkillEnrichmentSuggestion => ({
  depth,
  context: context.trim(),
  positioning: positioning.trim(),
})

const areSuggestionsEqual = (
  left: SkillEnrichmentSuggestion | null,
  right: SkillEnrichmentSuggestion,
): boolean =>
  Boolean(
    left &&
      left.depth === right.depth &&
      left.context === right.context &&
      left.positioning === right.positioning,
  )

export function IdentityEnrichmentSkillPage() {
  const navigate = useNavigate()
  const { groupId, skillName } = useParams({ from: '/identity/enrich/$groupId/$skillName' })
  const currentIdentity = useIdentityStore((state) => state.currentIdentity)
  const saveSkillEnrichment = useIdentityStore((state) => state.saveSkillEnrichment)
  const skipSkillEnrichment = useIdentityStore((state) => state.skipSkillEnrichment)
  const aiEndpoint = useMemo(
    () => sanitizeEndpointUrl(facetClientEnv.anthropicProxyUrl),
    [],
  )

  const resolved = useMemo(
    () =>
      currentIdentity ? resolveIdentityEnrichmentSkill(currentIdentity, groupId, skillName) : null,
    [currentIdentity, groupId, skillName],
  )
  const progress = useMemo(
    () => (currentIdentity ? getIdentityEnrichmentProgress(currentIdentity) : null),
    [currentIdentity],
  )
  const adjacentSkills = useMemo(
    () =>
      currentIdentity
        ? findAdjacentIdentityEnrichmentSkills(currentIdentity, { groupId, skillName })
        : { previous: null, next: null },
    [currentIdentity, groupId, skillName],
  )
  const fieldBaseId = useId()
  const depthFieldId = `${fieldBaseId}-depth`
  const contextFieldId = `${fieldBaseId}-context`
  const positioningFieldId = `${fieldBaseId}-positioning`
  const errorId = `${fieldBaseId}-error`

  const [depth, setDepth] = useState<ProfessionalSkillDepth>('working')
  const [context, setContext] = useState('')
  const [positioning, setPositioning] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [lastSuggestion, setLastSuggestion] = useState<SkillEnrichmentSuggestion | null>(null)
  const suggestAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    suggestAbortRef.current?.abort()
    if (!resolved) {
      return
    }

    setDepth(resolved.skill.depth ?? 'working')
    setContext(resolved.skill.context ?? '')
    setPositioning(resolved.skill.positioning ?? '')
    setNotice(null)
    setError(null)
    setLastSuggestion(null)
  }, [resolved])

  useEffect(
    () => () => {
      suggestAbortRef.current?.abort()
    },
    [],
  )

  useEffect(() => {
    if (!currentIdentity || !resolved) {
      void navigate({ to: '/identity/enrich' })
    }
  }, [currentIdentity, navigate, resolved])

  const goToNextPending = (identity: ProfessionalIdentityV3) => {
    const nextSkill = findNextPendingIdentitySkill(identity, { groupId, skillName })
    if (!nextSkill) {
      void navigate({ to: '/identity/enrich' })
      return
    }

    navigateToSkill(nextSkill)
  }

  if (!currentIdentity || !resolved || !progress) {
    return null
  }

  const currentStatus = getSkillEnrichmentStatus({
    depth,
    context,
    positioning,
    skipped_at: resolved.skill.skipped_at,
  })
  const skipDisabled = resolved.status === 'complete'
  const isDirty =
    depth !== (resolved.skill.depth ?? 'working') ||
    context !== (resolved.skill.context ?? '') ||
    positioning !== (resolved.skill.positioning ?? '')
  const isContextInvalid = Boolean(error && !context.trim())
  const isPositioningInvalid = Boolean(error && !positioning.trim())
  const previousSkill = adjacentSkills.previous
  const nextSkill = adjacentSkills.next

  const navigateToSkill = (
    target: { groupId: string; skillName: string } | null,
    options?: { confirmDirty?: boolean },
  ) => {
    if (!target) {
      return
    }

    if (options?.confirmDirty && isDirty && !window.confirm('You have unsaved changes. Leave this skill anyway?')) {
      return
    }

    void navigate({
      to: '/identity/enrich/$groupId/$skillName',
      params: {
        groupId: target.groupId,
        skillName: target.skillName,
      },
    })
  }

  const buildSavedIdentity = () =>
    updateIdentityEnrichmentSkill(currentIdentity, groupId, skillName, (skill) => ({
      ...skill,
      depth,
      context: context.trim(),
      positioning: positioning.trim(),
      skipped_at: undefined,
    }))

  const handleSuggest = async () => {
    if (!aiEndpoint) {
      setError('AI suggestions are disabled. Configure VITE_ANTHROPIC_PROXY_URL.')
      setNotice(null)
      return
    }

    suggestAbortRef.current?.abort()
    const controller = new AbortController()
    suggestAbortRef.current = controller

    try {
      setIsGenerating(true)
      setError(null)
      setNotice(null)
      const suggestion = await generateSkillEnrichmentSuggestion({
        endpoint: aiEndpoint,
        identity: currentIdentity,
        group: resolved.group,
        skill: resolved.skill,
        signal: controller.signal,
      })

      if (controller.signal.aborted) {
        return
      }

      setDepth(suggestion.depth)
      setContext(suggestion.context)
      setPositioning(suggestion.positioning)
      setLastSuggestion(suggestion)
      setNotice('Applied AI suggestions. Review them before saving.')
    } catch (caughtError) {
      if (controller.signal.aborted) {
        return
      }
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to generate suggestions.')
      setNotice(null)
    } finally {
      if (suggestAbortRef.current === controller) {
        suggestAbortRef.current = null
      }
      setIsGenerating(false)
    }
  }

  const handleSave = (mode: 'continue' | 'exit') => {
    const nextContext = context.trim()
    const nextPositioning = positioning.trim()
    if (!nextContext || !nextPositioning) {
      setError('Context and positioning are required before saving this skill.')
      setNotice(null)
      return
    }

    const suggestion = toSuggestion(depth, nextContext, nextPositioning)
    const enrichedBy = !lastSuggestion
      ? 'user'
      : areSuggestionsEqual(lastSuggestion, suggestion)
        ? 'llm-accepted'
        : 'user-edited-llm'

    saveSkillEnrichment(
      groupId,
      skillName,
      {
        depth,
        context: nextContext,
        positioning: nextPositioning,
      },
      enrichedBy,
    )
    setError(null)

    if (mode === 'exit') {
      setNotice('Saved skill enrichment.')
      void navigate({ to: '/identity/enrich' })
      return
    }

    goToNextPending(buildSavedIdentity())
  }

  const handleSkip = () => {
    skipSkillEnrichment(groupId, skillName)
    setError(null)
    setNotice(null)
    const nextIdentity = updateIdentityEnrichmentSkill(currentIdentity, groupId, skillName, (skill) => ({
      ...skill,
      skipped_at: new Date().toISOString(),
    }))
    goToNextPending(nextIdentity)
  }

  const handleBackToOverview = () => {
    if (isDirty && !window.confirm('You have unsaved changes. Leave this skill anyway?')) {
      return
    }

    void navigate({ to: '/identity/enrich' })
  }

  return (
    <div className="identity-page">
      <header className="identity-header">
        <div>
          <p className="identity-eyebrow">Phase 0</p>
          <h1>{resolved.skill.name}</h1>
          <p className="identity-copy">
            {resolved.group.label}
            {resolved.group.positioning ? ` • ${resolved.group.positioning}` : ''}
          </p>
        </div>

        <div className="identity-header-actions">
          <button
            className="identity-btn"
            type="button"
            onClick={() => navigateToSkill(previousSkill, { confirmDirty: true })}
            disabled={!previousSkill}
          >
            Previous skill
          </button>
          <button
            className="identity-btn"
            type="button"
            onClick={() => navigateToSkill(nextSkill, { confirmDirty: true })}
            disabled={!nextSkill}
          >
            Next skill
          </button>
          <button className="identity-btn" type="button" onClick={handleBackToOverview}>
            Back to Overview
          </button>
        </div>
      </header>

      <div
        className={`identity-alert${error ? '' : ' identity-message-empty'}`}
        role="alert"
        id={errorId}
        aria-live="assertive"
      >
        {error ?? ''}
      </div>
      <div
        className={`identity-notice${notice ? '' : ' identity-message-empty'}`}
        role="status"
        aria-live="polite"
      >
        {notice ?? ''}
      </div>

      <section className="identity-card">
        <div className="identity-card-header">
          <div>
            <h2>Progress</h2>
            <p>Pending {progress.pending} · Skipped {progress.skipped} · Complete {progress.complete}</p>
          </div>
          <span className={`identity-chip identity-chip-${currentStatus}`}>
            {currentStatus === 'complete'
              ? 'Complete'
              : currentStatus === 'skipped'
                ? 'Skipped'
                : 'Pending'}
          </span>
        </div>

        {resolved.skill.tags.length > 0 ? (
          <div className="identity-chip-row">
            {resolved.skill.tags.map((tag) => (
              <span key={tag} className="identity-chip identity-chip-empty">
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </section>

      <section className="identity-card">
        <div className="identity-card-header">
          <div>
            <h2>Skill Details</h2>
            <p>Start with an AI draft, then correct the depth and context before saving.</p>
          </div>
        </div>

        <div className="identity-scan-guidance">
          <p className="identity-scan-guidance-text">
            The AI should draft all three fields first.
          </p>
          <p className="identity-scan-guess-text">
            <strong>Depth</strong> and <strong>Context</strong> are first-pass guesses you can
            correct. <strong>Positioning</strong> is an AI-derived positioning line that you can
            refine before saving.
          </p>
        </div>

        <label className="identity-field" htmlFor={depthFieldId}>
          <span className="identity-label">Depth</span>
          <select
            id={depthFieldId}
            className="identity-input"
            value={depth}
            onChange={(event) => setDepth(event.target.value as ProfessionalSkillDepth)}
          >
            {DEPTH_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="identity-field" htmlFor={contextFieldId}>
          <span className="identity-label">Context</span>
          <textarea
            id={contextFieldId}
            className="identity-textarea"
            placeholder="AI should draft the operating context for this skill, then you can correct scope or nuance."
            aria-invalid={isContextInvalid || undefined}
            aria-describedby={isContextInvalid ? errorId : undefined}
            value={context}
            onChange={(event) => setContext(event.target.value)}
          />
        </label>

        <label className="identity-field" htmlFor={positioningFieldId}>
          <span className="identity-label">Positioning</span>
          <textarea
            id={positioningFieldId}
            className="identity-textarea"
            placeholder="AI should draft the recruiter-readable signal this skill should send in search and matching."
            aria-invalid={isPositioningInvalid || undefined}
            aria-describedby={isPositioningInvalid ? errorId : undefined}
            value={positioning}
            onChange={(event) => setPositioning(event.target.value)}
          />
        </label>

        <div className="identity-card-actions">
          <button className="identity-btn" type="button" onClick={() => void handleSuggest()} disabled={isGenerating}>
            {isGenerating
              ? 'Generating...'
              : lastSuggestion
                ? 'Regenerate AI draft'
                : 'Draft with AI'}
          </button>
          <button className="identity-btn identity-btn-primary" type="button" onClick={() => handleSave('continue')}>
            Save and continue
          </button>
          <button className="identity-btn" type="button" onClick={() => handleSave('exit')}>
            Save and exit
          </button>
          <button className="identity-btn" type="button" onClick={handleSkip} disabled={skipDisabled}>
            Skip for now
          </button>
        </div>
      </section>
    </div>
  )
}
