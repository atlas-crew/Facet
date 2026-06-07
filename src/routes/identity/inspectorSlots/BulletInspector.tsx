import { useEffect, useId, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import type { ProfessionalIdentityV3 } from '../../../identity/schema'
import {
  getActiveResumeScan,
  getCurrentBulletDeepenKey,
  useIdentityStore,
} from '../../../store/identityStore'
import type { IdentityConfidence, ResumeScanBulletExplanation } from '../../../types/identity'
import { facetClientEnv } from '../../../utils/facetEnv'
import { sanitizeEndpointUrl } from '../../../utils/idUtils'
import { deepenIdentityBullet } from '../../../utils/identityExtraction'
import { InspectorSheet } from './InspectorSheet'
import {
  Actions,
  BulletPair,
  NotFound,
  SlotShell,
  inputToTags,
  tagsToInput,
} from './slotPrimitives'

interface SourceTextSheetState {
  bulletId: string
  draft: string
}

interface MetricsSheetState {
  bulletId: string
  draft: string
  error: string | null
}

const metricsToDocument = (metrics: Record<string, string | number | boolean>): string =>
  JSON.stringify(metrics, null, 2)

const formatMetricLabel = (key: string) =>
  key
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^./, (char) => char.toUpperCase())

const CONFIDENCE_LABELS: Record<IdentityConfidence, string> = {
  stated: 'Stated',
  confirmed: 'Confirmed',
  guessing: 'Guessing',
  corrected: 'Corrected',
}

const tagKey = (tag: string): string => tag.trim().toLowerCase()

const normalizeBulletTagItems = (items: readonly string[]): string[] => {
  const seen = new Set<string>()
  const tags: string[] = []
  for (const item of items) {
    const tag = item.trim()
    if (!tag) continue
    const key = tagKey(tag)
    if (seen.has(key)) continue
    seen.add(key)
    tags.push(tag)
  }
  return tags
}

const normalizeBulletTags = (value: string): string[] => normalizeBulletTagItems(inputToTags(value))

const parseMetricsDocument = (
  value: string,
): {
  data: Record<string, string | number | boolean> | null
  error: string | null
} => {
  if (!value.trim()) {
    return { data: {}, error: null }
  }

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return {
        data: null,
        error: 'Metrics must be a JSON object before you save.',
      }
    }

    const normalized = Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string | number | boolean] =>
          typeof entry[1] === 'string' ||
          typeof entry[1] === 'number' ||
          typeof entry[1] === 'boolean',
      ),
    )
    return { data: normalized, error: null }
  } catch {
    return {
      data: null,
      error: 'Metrics must be valid JSON before you save.',
    }
  }
}

function BulletListSection({ label, items }: { label: string; items: readonly string[] }) {
  const normalizedItems = items.map((item) => item.trim()).filter(Boolean)
  if (normalizedItems.length === 0) return null

  return (
    <div className="inspector-read-section">
      <p className="inspector-read-label label-tracked">{label}</p>
      <ul className="inspector-read-list">
        {normalizedItems.map((item, index) => (
          <li key={`${label}:${index}`}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

function BulletTagsSection({ items }: { items: readonly string[] }) {
  const labelId = useId()
  const normalizedItems = normalizeBulletTagItems(items)
  if (normalizedItems.length === 0) return null

  return (
    <div className="inspector-read-section">
      <p className="inspector-read-label label-tracked" id={labelId}>
        Tags
      </p>
      <ul className="inspector-tag-list" aria-labelledby={labelId}>
        {normalizedItems.map((item) => (
          <li key={item} className="inspector-tag-pill">
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

function MetricsRows({ metrics }: { metrics: Record<string, string | number | boolean> }) {
  const entries = Object.entries(metrics)
  if (entries.length === 0) return null

  return (
    <div className="inspector-read-section">
      <p className="inspector-read-label label-tracked">Metrics</p>
      <dl className="inspector-kv-list">
        {entries.map(([key, value]) => (
          <div key={key} className="inspector-kv-row">
            <dt>{formatMetricLabel(key)}</dt>
            <dd>{String(value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function DeepenEvidence({ explanation }: { explanation: ResumeScanBulletExplanation }) {
  const showExplanation =
    Boolean(explanation.summary.trim()) ||
    Boolean(explanation.rewrite.trim()) ||
    explanation.assumptions.length > 0 ||
    explanation.warnings.length > 0

  if (!showExplanation) return null

  return (
    <section className="inspector-deepen-evidence" aria-label="Deepening evidence">
      {explanation.summary.trim() ? (
        <p className="inspector-deepen-summary">{explanation.summary}</p>
      ) : null}
      {explanation.rewrite.trim() ? (
        <div className="inspector-read-section">
          <p className="inspector-read-label label-tracked">Current AI rewrite</p>
          <p className="inspector-deepen-rewrite">{explanation.rewrite}</p>
        </div>
      ) : null}
      {explanation.assumptions.length > 0 ? (
        <div className="inspector-read-section">
          <p className="inspector-read-label label-tracked">Assumptions</p>
          <div className="inspector-chip-row">
            {explanation.assumptions.map((assumption, index) => (
              <span
                key={`assumption:${index}`}
                className={`inspector-confidence-chip tone-${assumption.confidence}`}
              >
                {assumption.label} · {CONFIDENCE_LABELS[assumption.confidence]}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      {explanation.warnings.length > 0 ? (
        <div className="inspector-read-section">
          <p className="inspector-read-label label-tracked">Warnings</p>
          <ul className="inspector-read-list warning">
            {explanation.warnings.map((warning, index) => (
              <li key={`warning:${index}`}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}

export function BulletInspector({
  identity,
  roleId,
  bulletId,
}: {
  identity: ProfessionalIdentityV3
  roleId: string
  bulletId: string
}) {
  const updateRoles = useIdentityStore((s) => s.updateCurrentRoles)
  const startCurrentBulletDeepen = useIdentityStore((s) => s.startCurrentBulletDeepen)
  const completeCurrentBulletDeepen = useIdentityStore((s) => s.completeCurrentBulletDeepen)
  const failCurrentBulletDeepen = useIdentityStore((s) => s.failCurrentBulletDeepen)
  const currentBulletDeepen = useIdentityStore((s) => s.currentBulletDeepen)
  const correctionNotes = useIdentityStore((s) => s.correctionNotes)
  const scanResult = useIdentityStore(getActiveResumeScan)
  const role = identity.roles.find((r) => r.id === roleId)
  const bullet = role?.bullets.find((b) => b.id === bulletId)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({
    problem: '',
    action: '',
    outcome: '',
    impact: '',
    technologies: '',
    tags: [] as string[],
  })
  const [newTag, setNewTag] = useState('')
  const newTagInputRef = useRef<HTMLInputElement>(null)
  const [sheetState, setSheetState] = useState<SourceTextSheetState | null>(null)
  const [metricsSheetState, setMetricsSheetState] = useState<MetricsSheetState | null>(null)
  const sheetOpen = sheetState !== null && sheetState.bulletId === bulletId
  const metricsSheetOpen = metricsSheetState !== null && metricsSheetState.bulletId === bulletId
  const deepenAbortRef = useRef<AbortController | null>(null)
  const aiEndpoint = sanitizeEndpointUrl(facetClientEnv.anthropicProxyUrl)

  useEffect(
    () => () => {
      deepenAbortRef.current?.abort()
    },
    [],
  )

  if (!role || !bullet) return <NotFound label="bullet" />

  const startEditing = () => {
    setDraft({
      problem: bullet.problem,
      action: bullet.action,
      outcome: bullet.outcome,
      impact: tagsToInput(bullet.impact),
      technologies: tagsToInput(bullet.technologies),
      tags: normalizeBulletTagItems(bullet.tags),
    })
    setNewTag('')
    setEditing(true)
  }

  const openSourceTextSheet = () => {
    setSheetState({ bulletId, draft: bullet.source_text ?? '' })
  }

  const openMetricsSheet = () => {
    setMetricsSheetState({
      bulletId,
      draft: metricsToDocument(bullet.metrics),
      error: null,
    })
  }

  const saveSourceText = () => {
    if (!sheetState) return
    const trimmed = sheetState.draft.trim()
    const next = identity.roles.map((r) =>
      r.id !== roleId
        ? r
        : {
            ...r,
            bullets: r.bullets.map((b) =>
              b.id !== bulletId ? b : { ...b, source_text: trimmed ? trimmed : undefined },
            ),
          },
    )
    updateRoles(next)
    setSheetState(null)
  }

  const saveMetrics = () => {
    if (!metricsSheetState) return
    const parsed = parseMetricsDocument(metricsSheetState.draft)
    if (!parsed.data) {
      setMetricsSheetState({ ...metricsSheetState, error: parsed.error })
      return
    }
    const nextMetrics = parsed.data

    const next = identity.roles.map((r) =>
      r.id !== roleId
        ? r
        : {
            ...r,
            bullets: r.bullets.map((b) => (b.id !== bulletId ? b : { ...b, metrics: nextMetrics })),
          },
    )
    updateRoles(next)
    setMetricsSheetState(null)
  }

  const cancelSourceText = () => {
    setSheetState(null)
  }

  const cancelMetrics = () => {
    setMetricsSheetState(null)
  }

  const sourceTextButtonLabel = bullet.source_text?.trim() ? 'Edit source text' : 'Add source text'
  const metricsEntries = Object.entries(bullet.metrics)
  const metricsButtonLabel = metricsEntries.length ? 'Edit metrics' : 'Add metrics'
  const scanBulletProgress = scanResult?.progress.bullets[`${roleId}::${bulletId}`] ?? null
  const deepenExplanation = scanBulletProgress?.explanation ?? null

  const deepenKey = getCurrentBulletDeepenKey(roleId, bulletId)
  const deepenEntry = currentBulletDeepen[deepenKey]
  const deepenStatus = deepenEntry?.status
  const anyOtherDeepenRunning = Object.entries(currentBulletDeepen).some(
    ([key, entry]) => key !== deepenKey && entry.status === 'running',
  )
  const hasSourceText = Boolean(bullet.source_text?.trim())
  const deepenDisabled =
    !aiEndpoint || !hasSourceText || deepenStatus === 'running' || anyOtherDeepenRunning
  const deepenLabel = (() => {
    if (deepenStatus === 'running') return 'Deepening…'
    if (!aiEndpoint) return 'AI not configured'
    if (!hasSourceText) return 'Add source text first'
    if (deepenStatus === 'failed') return 'Retry deepen'
    return 'Deepen'
  })()

  const handleDeepen = async () => {
    if (deepenDisabled) return
    let controller: AbortController | null = null
    try {
      deepenAbortRef.current?.abort()
      controller = new AbortController()
      deepenAbortRef.current = controller
      startCurrentBulletDeepen(roleId, bulletId)
      const liveIdentity = useIdentityStore.getState().currentIdentity
      if (!liveIdentity) return
      const result = await deepenIdentityBullet({
        endpoint: aiEndpoint,
        identity: liveIdentity,
        roleId,
        bulletId,
        correctionNotes: correctionNotes || undefined,
        signal: controller.signal,
      })
      if (controller.signal.aborted) return
      completeCurrentBulletDeepen(result)
    } catch (error) {
      if (controller?.signal.aborted && error instanceof DOMException) return
      const message = error instanceof Error ? error.message : 'Deepening this bullet failed.'
      failCurrentBulletDeepen(roleId, bulletId, message)
    } finally {
      if (controller && deepenAbortRef.current === controller) {
        deepenAbortRef.current = null
      }
    }
  }

  const handleSave = () => {
    // Preserve visible pending input if the user types a tag and goes straight to Save.
    const finalTags = normalizeBulletTagItems([...draft.tags, ...normalizeBulletTags(newTag)])
    const next = identity.roles.map((r) =>
      r.id !== roleId
        ? r
        : {
            ...r,
            bullets: r.bullets.map((b) =>
              b.id !== bulletId
                ? b
                : {
                    ...b,
                    problem: draft.problem.trim(),
                    action: draft.action.trim(),
                    outcome: draft.outcome.trim(),
                    impact: inputToTags(draft.impact),
                    technologies: inputToTags(draft.technologies),
                    tags: finalTags,
                  },
            ),
          },
    )
    updateRoles(next)
    setNewTag('')
    setEditing(false)
  }
  const draftTags = draft.tags
  const setDraftTags = (tags: string[]) => {
    setDraft({ ...draft, tags: normalizeBulletTagItems(tags) })
  }
  const removeDraftTag = (indexToRemove: number) => {
    setDraftTags(draftTags.filter((_, index) => index !== indexToRemove))
    newTagInputRef.current?.focus()
  }
  const pendingTags = normalizeBulletTags(newTag)
  const pendingNewTags = pendingTags.filter(
    (tag) => !draftTags.some((current) => tagKey(current) === tagKey(tag)),
  )
  const canAddTags = pendingNewTags.length > 0
  const addDraftTags = () => {
    if (pendingTags.length === 0 || pendingNewTags.length === 0) {
      return
    }
    setDraftTags([...draftTags, ...pendingNewTags])
    setNewTag('')
  }

  const sourceTextSheet = (
    <InspectorSheet
      open={sheetOpen}
      eyebrow={`Bullet · ${role.company}`}
      title={sourceTextButtonLabel}
      onSave={saveSourceText}
      onCancel={cancelSourceText}
    >
      <label className="inspector-field">
        <span className="inspector-field-label label-tracked">Source text</span>
        <textarea
          className="inspector-textarea"
          rows={12}
          value={sheetState?.draft ?? ''}
          onChange={(e) =>
            setSheetState((prev) => (prev ? { ...prev, draft: e.target.value } : prev))
          }
          aria-label="Source text"
        />
      </label>
    </InspectorSheet>
  )

  const metricsSheet = (
    <InspectorSheet
      open={metricsSheetOpen}
      eyebrow={`Bullet · ${role.company}`}
      title={metricsButtonLabel}
      onSave={saveMetrics}
      onCancel={cancelMetrics}
    >
      <label className="inspector-field">
        <span className="inspector-field-label label-tracked">Metrics JSON</span>
        <textarea
          className="inspector-textarea"
          rows={10}
          value={metricsSheetState?.draft ?? ''}
          onChange={(e) =>
            setMetricsSheetState((prev) =>
              prev ? { ...prev, draft: e.target.value, error: null } : prev,
            )
          }
          aria-label="Metrics JSON"
          aria-invalid={metricsSheetState?.error ? 'true' : undefined}
          aria-describedby={metricsSheetState?.error ? `${bulletId}-metrics-error` : undefined}
        />
      </label>
      {metricsSheetState?.error ? (
        <p className="inspector-warning" id={`${bulletId}-metrics-error`} role="alert">
          {metricsSheetState.error}
        </p>
      ) : null}
    </InspectorSheet>
  )

  if (editing) {
    return (
      <>
        <SlotShell eyebrow={`Bullet · ${role.company}`} title="Refine the bullet">
          <label className="inspector-field">
            <span className="inspector-field-label label-tracked">Problem</span>
            <textarea
              className="inspector-textarea"
              value={draft.problem}
              onChange={(e) => setDraft({ ...draft, problem: e.target.value })}
              rows={2}
            />
          </label>
          <label className="inspector-field">
            <span className="inspector-field-label label-tracked">Action</span>
            <textarea
              className="inspector-textarea"
              value={draft.action}
              onChange={(e) => setDraft({ ...draft, action: e.target.value })}
              rows={2}
            />
          </label>
          <label className="inspector-field">
            <span className="inspector-field-label label-tracked">Outcome</span>
            <textarea
              className="inspector-textarea"
              value={draft.outcome}
              onChange={(e) => setDraft({ ...draft, outcome: e.target.value })}
              rows={2}
            />
          </label>
          <label className="inspector-field">
            <span className="inspector-field-label label-tracked">Impact (comma-sep)</span>
            <input
              className="inspector-input"
              type="text"
              value={draft.impact}
              onChange={(e) => setDraft({ ...draft, impact: e.target.value })}
            />
          </label>
          <label className="inspector-field">
            <span className="inspector-field-label label-tracked">Technologies (comma-sep)</span>
            <input
              className="inspector-input"
              type="text"
              value={draft.technologies}
              onChange={(e) => setDraft({ ...draft, technologies: e.target.value })}
            />
          </label>
          <fieldset className="inspector-field inspector-tag-field">
            <legend className="inspector-field-label label-tracked">Tags</legend>
            {draftTags.length > 0 ? (
              <ul className="inspector-tag-list editable">
                {draftTags.map((tag, index) => (
                  <li key={`${tag}:${index}`} className="inspector-tag-pill editable">
                    <span>{tag}</span>
                    <button
                      type="button"
                      className="inspector-tag-remove"
                      aria-label={`Remove ${tag} tag`}
                      onClick={() => removeDraftTag(index)}
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="inspector-tag-empty">No tags yet</p>
            )}
            <div className="inspector-tag-add">
              <input
                className="inspector-input"
                type="text"
                ref={newTagInputRef}
                value={newTag}
                aria-label="New bullet tags"
                placeholder="Add tag, comma to separate"
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addDraftTags()
                  }
                }}
              />
              <button
                type="button"
                className="inspector-btn icon"
                aria-label="Add bullet tag"
                onClick={addDraftTags}
                disabled={!canAddTags}
              >
                <Plus size={16} aria-hidden="true" />
              </button>
            </div>
          </fieldset>
          <Actions>
            <button type="button" className="inspector-btn primary" onClick={handleSave}>
              Save
            </button>
            <button type="button" className="inspector-btn" onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button type="button" className="inspector-btn" onClick={openSourceTextSheet}>
              {sourceTextButtonLabel}
            </button>
            <button type="button" className="inspector-btn" onClick={openMetricsSheet}>
              {metricsButtonLabel}
            </button>
            <button
              type="button"
              className="inspector-btn"
              onClick={() => void handleDeepen()}
              disabled={deepenDisabled}
            >
              {deepenLabel}
            </button>
          </Actions>
        </SlotShell>
        {sourceTextSheet}
        {metricsSheet}
      </>
    )
  }

  return (
    <>
      <SlotShell
        eyebrow={`Bullet · ${role.company}`}
        title={bullet.problem || bullet.action || '(no summary)'}
      >
        <BulletPair label="Problem" value={bullet.problem} tone="problem" />
        <BulletPair label="Action" value={bullet.action} tone="action" />
        <BulletPair label="Outcome" value={bullet.outcome} tone="outcome" />
        <BulletListSection label="Impact" items={bullet.impact} />
        <MetricsRows metrics={bullet.metrics} />
        <BulletListSection label="Technologies" items={bullet.technologies} />
        <BulletTagsSection items={bullet.tags} />
        {deepenExplanation ? <DeepenEvidence explanation={deepenExplanation} /> : null}
        {deepenStatus === 'failed' && deepenEntry?.lastError ? (
          <p className="inspector-warning" role="alert">
            {deepenEntry.lastError}
          </p>
        ) : null}
        <Actions>
          <button type="button" className="inspector-btn primary" onClick={startEditing}>
            Edit bullet
          </button>
          <button type="button" className="inspector-btn" onClick={openSourceTextSheet}>
            {sourceTextButtonLabel}
          </button>
          <button type="button" className="inspector-btn" onClick={openMetricsSheet}>
            {metricsButtonLabel}
          </button>
          <button
            type="button"
            className="inspector-btn"
            onClick={() => void handleDeepen()}
            disabled={deepenDisabled}
          >
            {deepenLabel}
          </button>
        </Actions>
      </SlotShell>
      {sourceTextSheet}
      {metricsSheet}
    </>
  )
}
