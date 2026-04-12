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
  isSkillEnrichmentStale,
  resolveIdentityEnrichmentSkill,
  updateIdentityEnrichmentSkill,
} from '../../utils/identityEnrichment'
import {
  type SkillEnrichmentSuggestion,
  generateSkillEnrichmentSuggestion,
  hasSkillEnrichmentBulletEvidence,
} from '../../utils/skillEnrichment'
import './identity.css'

type EditableSkillDepth = ProfessionalSkillDepth | ''
type PositioningPreset = (typeof POSITIONING_EXAMPLES)[number]
type PositioningSelection = '' | PositioningPreset | typeof CUSTOM_POSITIONING_VALUE

const DEPTH_OPTIONS: ProfessionalSkillDepth[] = ['expert', 'strong', 'working', 'basic', 'avoid']
const CONTEXT_EXAMPLES = [
  'Ansible: "writes libraries/plugins in Python, uses roles/skills architecture"',
  'Rust: "primarily for proxy/server infrastructure and CLI tools, not embedded"',
  'Python: "primary language for platform backends, automation, custom Ansible modules"',
  'C#: "full platform work - ASP.NET, SQL Server, build systems, tooling"',
] as const
const POSITIONING_EXAMPLES = [
  'Strong match signal. List first.',
  'Strong match signal, especially with Python. Rare combo.',
  "Standard. Don't oversell.",
  'Expected for Linux roles.',
  'Can mention. Avoid deep Rust required roles.',
  "Don't lead with this.",
  'Can apply if other signals are strong. Flag as ramping.',
] as const
const CUSTOM_POSITIONING_VALUE = '__custom__'

const isPositioningPreset = (value: string): value is PositioningPreset =>
  POSITIONING_EXAMPLES.includes(value as PositioningPreset)

const resolvePositioningSelection = (value: string): PositioningSelection => {
  const trimmed = value.trim()
  if (!trimmed) {
    return ''
  }

  return isPositioningPreset(trimmed) ? trimmed : CUSTOM_POSITIONING_VALUE
}

const toSuggestion = (
  depth: EditableSkillDepth,
  context: string,
  positioning: string,
): SkillEnrichmentSuggestion => ({
  ...(depth ? { depth } : {}),
  context: context.trim(),
  positioning: positioning.trim(),
})

const areSuggestionsEqual = (
  left: SkillEnrichmentSuggestion | null,
  right: SkillEnrichmentSuggestion,
): boolean =>
  Boolean(
    left &&
      (left.depth ?? '') === (right.depth ?? '') &&
      left.context === right.context &&
      left.positioning === right.positioning,
  )

export function IdentityEnrichmentSkillPage() {
  const navigate = useNavigate()
  const { groupId, skillName } = useParams({ from: '/identity/enrich/$groupId/$skillName' })
  const currentIdentity = useIdentityStore((state) => state.currentIdentity)
  const saveSkillEnrichment = useIdentityStore((state) => state.saveSkillEnrichment)
  const skipSkillEnrichment = useIdentityStore((state) => state.skipSkillEnrichment)
  const aiEndpoint = useMemo(() => sanitizeEndpointUrl(facetClientEnv.anthropicProxyUrl), [])

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
  const hasBulletEvidence = useMemo(
    () =>
      Boolean(
        currentIdentity &&
          resolved &&
          hasSkillEnrichmentBulletEvidence(currentIdentity, resolved.group, resolved.skill),
      ),
    [currentIdentity, resolved],
  )
  const fieldBaseId = useId()
  const depthFieldId = `${fieldBaseId}-depth`
  const depthLabelId = `${fieldBaseId}-depth-label`
  const contextFieldId = `${fieldBaseId}-context`
  const positioningFieldId = `${fieldBaseId}-positioning`
  const customPositioningFieldId = `${fieldBaseId}-positioning-custom`
  const contextLabelId = `${fieldBaseId}-context-label`
  const positioningLabelId = `${fieldBaseId}-positioning-label`
  const customPositioningLabelId = `${fieldBaseId}-positioning-custom-label`
  const errorId = `${fieldBaseId}-error`

  const [depth, setDepth] = useState<EditableSkillDepth>('')
  const [context, setContext] = useState('')
  const [positioning, setPositioning] = useState('')
  const [positioningSelection, setPositioningSelection] = useState<PositioningSelection>('')
  const [contextStale, setContextStale] = useState(false)
  const [positioningStale, setPositioningStale] = useState(false)
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

    setDepth(resolved.skill.depth ?? '')
    setContext(resolved.skill.context ?? '')
    setPositioning(resolved.skill.positioning ?? '')
    setPositioningSelection(resolvePositioningSelection(resolved.skill.positioning ?? ''))
    setContextStale(Boolean(resolved.skill.context_stale && resolved.skill.context?.trim()))
    setPositioningStale(
      Boolean(resolved.skill.positioning_stale && resolved.skill.positioning?.trim()),
    )
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

  const savedDepth = resolved.skill.depth ?? ''
  const savedContext = resolved.skill.context ?? ''
  const savedPositioning = resolved.skill.positioning ?? ''
  const savedContextStale = Boolean(resolved.skill.context_stale && savedContext.trim())
  const savedPositioningStale = Boolean(
    resolved.skill.positioning_stale && savedPositioning.trim(),
  )
  const currentStatus = getSkillEnrichmentStatus({
    depth: depth || undefined,
    context,
    positioning,
    skipped_at: resolved.skill.skipped_at,
  })
  const skipDisabled = resolved.status === 'complete'
  const isDirty =
    depth !== savedDepth ||
    context !== savedContext ||
    positioning !== savedPositioning ||
    contextStale !== savedContextStale ||
    positioningStale !== savedPositioningStale
  const isStale = isSkillEnrichmentStale({
    context,
    context_stale: contextStale,
    positioning,
    positioning_stale: positioningStale,
  })
  const previousSkill = adjacentSkills.previous
  const nextSkill = adjacentSkills.next

  const navigateToSkill = (
    target: { groupId: string; skillName: string } | null,
    options?: { confirmDirty?: boolean },
  ) => {
    if (!target) {
      return
    }

    if (
      options?.confirmDirty &&
      isDirty &&
      !window.confirm('You have unsaved changes. Leave this skill anyway?')
    ) {
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

  const buildSavedIdentity = () => {
    const nextContext = context.trim()
    const nextPositioning = positioning.trim()
    const patch: Partial<typeof resolved.skill> = {
      skipped_at: undefined,
    }

    if (depth) {
      patch.depth = depth
    }

    if (nextContext) {
      patch.context = nextContext
      patch.context_stale = contextStale ? true : undefined
    } else {
      patch.context = undefined
      patch.context_stale = undefined
    }

    if (nextPositioning) {
      patch.positioning = nextPositioning
      patch.positioning_stale = positioningStale ? true : undefined
    } else {
      patch.positioning = undefined
      patch.positioning_stale = undefined
    }

    return updateIdentityEnrichmentSkill(currentIdentity, groupId, skillName, (skill) => ({
      ...skill,
      ...patch,
    }))
  }

  const applyDepthChange = (nextDepth: EditableSkillDepth) => {
    suggestAbortRef.current?.abort()
    setDepth(nextDepth)
    setError(null)

    if (nextDepth === savedDepth) {
      setContextStale(savedContextStale)
      setPositioningStale(savedPositioningStale)
      return
    }

    setContextStale(Boolean(context.trim()))
    setPositioningStale(Boolean(positioning.trim()))
  }

  const applyPositioningSelection = (nextSelection: PositioningSelection) => {
    setPositioningSelection(nextSelection)
    setPositioningStale(false)
    setError(null)

    if (!nextSelection) {
      setPositioning('')
      return
    }

    if (nextSelection === CUSTOM_POSITIONING_VALUE) {
      return
    }

    setPositioning(nextSelection)
  }

  const handleSuggest = async () => {
    if (isGenerating) {
      return
    }

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
      const preserveCurrentDepth = Boolean(depth)
      const suggestion = await generateSkillEnrichmentSuggestion({
        endpoint: aiEndpoint,
        identity: currentIdentity,
        group: resolved.group,
        skill: resolved.skill,
        draftDepth: depth || undefined,
        preserveDepth: preserveCurrentDepth,
        signal: controller.signal,
      })

      if (controller.signal.aborted) {
        return
      }

      const nextContext = suggestion.context ?? context
      const nextPositioning = suggestion.positioning ?? positioning
      const appliedSuggestion = toSuggestion(
        preserveCurrentDepth ? depth : suggestion.depth || '',
        nextContext,
        nextPositioning,
      )
      if (!preserveCurrentDepth && suggestion.depth) {
        setDepth(suggestion.depth)
      }
      setContext(nextContext)
      setPositioning(nextPositioning)
      setPositioningSelection(resolvePositioningSelection(nextPositioning))
      setContextStale(false)
      setPositioningStale(false)
      setLastSuggestion(appliedSuggestion)
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
    if (!depth) {
      setError('Select a depth before saving this skill.')
      setNotice(null)
      return
    }

    const nextContext = context.trim()
    const nextPositioning = positioning.trim()
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
        contextStale,
        positioningStale,
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
          <div className="identity-chip-row">
            <span className={`identity-chip identity-chip-${currentStatus}`}>
              {currentStatus === 'complete'
                ? 'Complete'
                : currentStatus === 'skipped'
                  ? 'Skipped'
                  : 'Pending'}
            </span>
            {isStale ? <span className="identity-chip identity-chip-empty">Needs refresh</span> : null}
          </div>
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
            <p>Set the depth first, then let AI draft optional context and positioning if they help.</p>
          </div>
        </div>

        <div className="identity-scan-guidance">
          <p className="identity-scan-guidance-text">
            Depth is required. Context and positioning are optional per skill.
          </p>
          <p className="identity-scan-guess-text">
            <strong>Context</strong> should describe the shape of engagement with the skill.
            <strong> Positioning</strong> should tell downstream generators how to surface it.
          </p>
        </div>

        <label className="identity-field" htmlFor={depthFieldId}>
          <span id={depthLabelId} className="identity-label">
            Depth
          </span>
          <select
            id={depthFieldId}
            className="identity-input"
            aria-labelledby={depthLabelId}
            aria-describedby={error ? errorId : undefined}
            aria-invalid={Boolean(error && !depth) || undefined}
            value={depth}
            onChange={(event) => applyDepthChange(event.target.value as EditableSkillDepth)}
          >
            <option value="">Select depth</option>
            {DEPTH_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          {!hasBulletEvidence ? (
            <span className="identity-field-help">
              No bullet evidence for this skill. You'll need to set depth manually.
            </span>
          ) : null}
        </label>

        <div className="identity-field">
          <div className="identity-field-header">
            <label htmlFor={contextFieldId} id={contextLabelId} className="identity-label">
              Context
            </label>
            <div className="identity-field-actions-inline">
              {contextStale && context.trim() ? (
                <button className="identity-btn identity-btn-ghost" type="button" onClick={() => void handleSuggest()}>
                  Depth changed - re-draft all fields?
                </button>
              ) : null}
              <button
                className="identity-btn identity-btn-ghost"
                type="button"
                onClick={() => {
                  setContext('')
                  setContextStale(false)
                  setError(null)
                }}
              >
                Not needed
              </button>
            </div>
          </div>
          <textarea
            id={contextFieldId}
            className="identity-textarea"
            placeholder="Optional. Capture the domain, patterns, or unusual shape of engagement with this skill."
            aria-labelledby={contextLabelId}
            value={context}
            onChange={(event) => {
              setContext(event.target.value)
              setContextStale(false)
              setError(null)
            }}
          />
          {contextStale && context.trim() ? (
            <span className="identity-field-help">
              Depth changed. Re-draft or confirm this context still fits.
            </span>
          ) : null}
          <details className="identity-field-examples">
            <summary>Examples</summary>
            <ul className="identity-example-list">
              {CONTEXT_EXAMPLES.map((example) => (
                <li key={example}>{example}</li>
              ))}
            </ul>
          </details>
        </div>

        <div className="identity-field">
          <div className="identity-field-header">
            <label htmlFor={positioningFieldId} id={positioningLabelId} className="identity-label">
              Positioning
            </label>
            <div className="identity-field-actions-inline">
              {positioningStale && positioning.trim() ? (
                <button className="identity-btn identity-btn-ghost" type="button" onClick={() => void handleSuggest()}>
                  Depth changed - re-draft all fields?
                </button>
              ) : null}
              <button
                className="identity-btn identity-btn-ghost"
                type="button"
                onClick={() => {
                  applyPositioningSelection('')
                }}
              >
                Not needed
              </button>
            </div>
          </div>
          <select
            id={positioningFieldId}
            className="identity-input"
            aria-labelledby={positioningLabelId}
            value={positioningSelection}
            onChange={(event) => applyPositioningSelection(event.target.value as PositioningSelection)}
          >
            <option value="">Select positioning</option>
            {POSITIONING_EXAMPLES.map((example) => (
              <option key={example} value={example}>
                {example}
              </option>
            ))}
            <option value={CUSTOM_POSITIONING_VALUE}>Custom...</option>
          </select>
          <span className="identity-field-help">Choose a preset or select Custom to write your own.</span>
          {positioningSelection === CUSTOM_POSITIONING_VALUE ? (
            <>
              <label
                htmlFor={customPositioningFieldId}
                id={customPositioningLabelId}
                className="identity-label"
              >
                Custom positioning
              </label>
              <textarea
                id={customPositioningFieldId}
                className="identity-textarea"
                placeholder="Optional. Add a short directive for how generators should surface this skill."
                aria-labelledby={customPositioningLabelId}
                value={positioning}
                onChange={(event) => {
                  setPositioning(event.target.value)
                  setPositioningSelection(CUSTOM_POSITIONING_VALUE)
                  setPositioningStale(false)
                  setError(null)
                }}
              />
            </>
          ) : null}
          {positioningStale && positioning.trim() ? (
            <span className="identity-field-help">
              Depth changed. Re-draft or confirm this positioning still fits.
            </span>
          ) : null}
        </div>

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
