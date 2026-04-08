import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import type { ProfessionalIdentityV3, ProfessionalSkillDepth } from '../../identity/schema'
import { useIdentityStore } from '../../store/identityStore'
import { facetClientEnv } from '../../utils/facetEnv'
import { sanitizeEndpointUrl } from '../../utils/idUtils'
import {
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
  searchSignal: string,
): SkillEnrichmentSuggestion => ({
  depth,
  context: context.trim(),
  searchSignal: searchSignal.trim(),
})

const areSuggestionsEqual = (
  left: SkillEnrichmentSuggestion | null,
  right: SkillEnrichmentSuggestion,
): boolean =>
  Boolean(
    left &&
      left.depth === right.depth &&
      left.context === right.context &&
      left.searchSignal === right.searchSignal,
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
  const fieldBaseId = useId()
  const depthFieldId = `${fieldBaseId}-depth`
  const contextFieldId = `${fieldBaseId}-context`
  const searchSignalFieldId = `${fieldBaseId}-search-signal`
  const errorId = `${fieldBaseId}-error`

  const [depth, setDepth] = useState<ProfessionalSkillDepth>('working')
  const [context, setContext] = useState('')
  const [searchSignal, setSearchSignal] = useState('')
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
    setSearchSignal(resolved.skill.search_signal ?? '')
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

    void navigate({
      to: '/identity/enrich/$groupId/$skillName',
      params: {
        groupId: nextSkill.groupId,
        skillName: nextSkill.skillName,
      },
    })
  }

  if (!currentIdentity || !resolved || !progress) {
    return null
  }

  const currentStatus = getSkillEnrichmentStatus({
    depth,
    context,
    search_signal: searchSignal,
    skipped_at: resolved.skill.skipped_at,
  })
  const skipDisabled = resolved.status === 'complete'
  const isDirty =
    depth !== (resolved.skill.depth ?? 'working') ||
    context !== (resolved.skill.context ?? '') ||
    searchSignal !== (resolved.skill.search_signal ?? '')
  const isContextInvalid = Boolean(error && !context.trim())
  const isSearchSignalInvalid = Boolean(error && !searchSignal.trim())

  const buildSavedIdentity = () =>
    updateIdentityEnrichmentSkill(currentIdentity, groupId, skillName, (skill) => ({
      ...skill,
      depth,
      context: context.trim(),
      search_signal: searchSignal.trim(),
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
      setSearchSignal(suggestion.searchSignal)
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
    const nextSearchSignal = searchSignal.trim()
    if (!nextContext || !nextSearchSignal) {
      setError('Context and search signal are required before saving this skill.')
      setNotice(null)
      return
    }

    const suggestion = toSuggestion(depth, nextContext, nextSearchSignal)
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
        search_signal: nextSearchSignal,
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
          <button className="identity-btn" type="button" onClick={handleBackToOverview}>
            Back to Overview
          </button>
          <button className="identity-btn identity-btn-primary" type="button" onClick={() => handleSave('continue')}>
            Save and continue
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
            <p>Capture depth, grounded context, and a recruiter-readable search signal.</p>
          </div>
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
            aria-invalid={isContextInvalid || undefined}
            aria-describedby={isContextInvalid ? errorId : undefined}
            value={context}
            onChange={(event) => setContext(event.target.value)}
          />
        </label>

        <label className="identity-field" htmlFor={searchSignalFieldId}>
          <span className="identity-label">Search Signal</span>
          <textarea
            id={searchSignalFieldId}
            className="identity-textarea"
            aria-invalid={isSearchSignalInvalid || undefined}
            aria-describedby={isSearchSignalInvalid ? errorId : undefined}
            value={searchSignal}
            onChange={(event) => setSearchSignal(event.target.value)}
          />
        </label>

        <div className="identity-card-actions">
          <button className="identity-btn" type="button" onClick={() => void handleSuggest()} disabled={isGenerating}>
            {isGenerating
              ? 'Generating...'
              : lastSuggestion
                ? 'Regenerate suggestions'
                : 'Suggest with AI'}
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
