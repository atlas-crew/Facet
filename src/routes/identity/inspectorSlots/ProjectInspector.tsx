import { useEffect, useRef, useState } from 'react'
import type { ProfessionalIdentityV3 } from '../../../identity/schema'
import { useIdentityStore } from '../../../store/identityStore'
import { facetClientEnv } from '../../../utils/facetEnv'
import { sanitizeEndpointUrl } from '../../../utils/idUtils'
import { deepenIdentityProject } from '../../../utils/identityExtraction'
import { InspectorSheet } from './InspectorSheet'
import {
  Actions,
  BulletPair,
  MetaRows,
  NotFound,
  SlotShell,
  inputToTags,
  tagsToInput,
} from './slotPrimitives'

type Project = ProfessionalIdentityV3['projects'][number]

interface SourceTextSheetState {
  draft: string
}

interface MetricsSheetState {
  draft: string
  error: string | null
}

type DeepenStatus =
  | { status: 'idle'; error: null }
  | { status: 'running'; error: null }
  | { status: 'failed'; error: string }

const metricsToDocument = (
  metrics: Record<string, string | number | boolean> | undefined,
): string => JSON.stringify(metrics ?? {}, null, 2)

const listToLines = (items: readonly string[] | undefined): string => (items ?? []).join('\n')

const linesToList = (value: string): string[] =>
  value
    .split('\n')
    .map((entry) => entry.trim())
    .filter(Boolean)

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

    const entries = Object.entries(parsed)
    const invalidMetric = entries.find(
      ([, entry]) =>
        typeof entry !== 'string' && typeof entry !== 'number' && typeof entry !== 'boolean',
    )
    if (invalidMetric) {
      return {
        data: null,
        error: 'Metrics values must be strings, numbers, or booleans before you save.',
      }
    }

    return {
      data: Object.fromEntries(entries) as Record<string, string | number | boolean>,
      error: null,
    }
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

function MetricsRows({ metrics }: { metrics: Project['metrics'] }) {
  const entries = Object.entries(metrics ?? {})
  if (entries.length === 0) return null

  return (
    <div className="inspector-read-section">
      <p className="inspector-read-label label-tracked">Metrics</p>
      <dl className="inspector-kv-list">
        {entries.map(([key, value]) => (
          <div key={key} className="inspector-kv-row">
            <dt>{key}</dt>
            <dd>{String(value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

const preferDeepenedString = (incoming: string | undefined, fallback: string | undefined) =>
  incoming?.trim() ? incoming : fallback

const preferDeepenedArray = (incoming: string[] | undefined, fallback: string[] | undefined) =>
  incoming && incoming.length > 0 ? incoming : fallback

const preferDeepenedMetrics = (
  incoming: Project['metrics'],
  fallback: Project['metrics'],
): Project['metrics'] => (incoming && Object.keys(incoming).length > 0 ? incoming : fallback)

const mergeDeepenedProject = (current: Project, incoming: Project): Project => ({
  ...current,
  name: preferDeepenedString(incoming.name, current.name) ?? current.name,
  description:
    preferDeepenedString(incoming.description, current.description) ?? current.description,
  url: preferDeepenedString(incoming.url, current.url),
  source_text: current.source_text,
  problem: preferDeepenedString(incoming.problem, current.problem),
  action: preferDeepenedString(incoming.action, current.action),
  outcome: preferDeepenedString(incoming.outcome, current.outcome),
  impact: preferDeepenedArray(incoming.impact, current.impact),
  metrics: preferDeepenedMetrics(incoming.metrics, current.metrics),
  technologies: preferDeepenedArray(incoming.technologies, current.technologies),
  assumptions: preferDeepenedArray(incoming.assumptions, current.assumptions),
  tags: preferDeepenedArray(incoming.tags, current.tags) ?? current.tags,
})

export function ProjectInspector({
  identity,
  projectId,
}: {
  identity: ProfessionalIdentityV3
  projectId: string
}) {
  const updateProjects = useIdentityStore((s) => s.updateCurrentProjects)
  const correctionNotes = useIdentityStore((s) => s.correctionNotes)
  const project = identity.projects.find((p) => p.id === projectId)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({
    name: '',
    description: '',
    url: '',
    problem: '',
    action: '',
    outcome: '',
    impact: '',
    technologies: '',
    assumptions: '',
    tags: '',
  })
  const [sheetState, setSheetState] = useState<SourceTextSheetState | null>(null)
  const [metricsSheetState, setMetricsSheetState] = useState<MetricsSheetState | null>(null)
  const [deepenState, setDeepenState] = useState<DeepenStatus>({ status: 'idle', error: null })
  const [deepenNotes, setDeepenNotes] = useState<string[]>([])
  const deepenAbortRef = useRef<AbortController | null>(null)
  const aiEndpoint = sanitizeEndpointUrl(facetClientEnv.anthropicProxyUrl)

  useEffect(
    () => () => {
      deepenAbortRef.current?.abort()
    },
    [],
  )

  if (!project) return <NotFound label="project" />

  const updateProject = (updater: (project: Project) => Project) => {
    updateProjects(
      identity.projects.map((entry) => (entry.id === projectId ? updater(entry) : entry)),
    )
  }

  const startEditing = () => {
    setDraft({
      name: project.name,
      description: project.description,
      url: project.url ?? '',
      problem: project.problem ?? '',
      action: project.action ?? '',
      outcome: project.outcome ?? '',
      impact: listToLines(project.impact),
      technologies: tagsToInput(project.technologies ?? []),
      assumptions: listToLines(project.assumptions),
      tags: tagsToInput(project.tags),
    })
    setDeepenNotes([])
    setEditing(true)
  }

  const openSourceTextSheet = () => {
    setSheetState({ draft: project.source_text ?? '' })
  }

  const saveSourceText = () => {
    if (!sheetState) return
    const trimmed = sheetState.draft.trim()
    updateProject((entry) => ({
      ...entry,
      source_text: trimmed ? trimmed : undefined,
    }))
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

    updateProject((entry) => ({
      ...entry,
      metrics: Object.keys(nextMetrics).length > 0 ? nextMetrics : undefined,
    }))
    setMetricsSheetState(null)
  }

  const openMetricsSheet = () => {
    setMetricsSheetState({
      draft: metricsToDocument(project.metrics),
      error: null,
    })
  }

  const handleSave = () => {
    const trimmedUrl = draft.url.trim()
    updateProject((entry) => ({
      ...entry,
      name: draft.name.trim(),
      description: draft.description.trim(),
      url: trimmedUrl ? trimmedUrl : undefined,
      problem: draft.problem.trim() || undefined,
      action: draft.action.trim() || undefined,
      outcome: draft.outcome.trim() || undefined,
      impact: linesToList(draft.impact),
      technologies: inputToTags(draft.technologies),
      assumptions: linesToList(draft.assumptions),
      tags: inputToTags(draft.tags),
    }))
    setDeepenNotes([])
    setEditing(false)
  }

  const hasSourceText = Boolean(project.source_text?.trim() || project.description.trim())
  const deepenDisabled = !aiEndpoint || !hasSourceText || deepenState.status === 'running'
  const deepenLabel = (() => {
    if (deepenState.status === 'running') return 'Deepening…'
    if (!aiEndpoint) return 'AI not configured'
    if (!hasSourceText) return 'Add source text first'
    if (deepenState.status === 'failed') return 'Retry deepen'
    return 'Deepen project'
  })()

  const handleDeepen = async () => {
    if (deepenDisabled) return
    const liveIdentity = useIdentityStore.getState().currentIdentity
    if (!liveIdentity) return
    let controller: AbortController | null = null
    try {
      deepenAbortRef.current?.abort()
      controller = new AbortController()
      deepenAbortRef.current = controller
      setDeepenState({ status: 'running', error: null })
      setDeepenNotes([])
      const result = await deepenIdentityProject({
        endpoint: aiEndpoint,
        identity: liveIdentity,
        projectId,
        correctionNotes: correctionNotes || undefined,
        signal: controller.signal,
      })
      if (controller.signal.aborted) return
      const latestIdentity = useIdentityStore.getState().currentIdentity
      if (!latestIdentity) {
        setDeepenState({ status: 'idle', error: null })
        return
      }
      if (!latestIdentity.projects.some((entry) => entry.id === projectId)) {
        setDeepenState({ status: 'idle', error: null })
        return
      }
      updateProjects(
        latestIdentity.projects.map((entry) =>
          entry.id === projectId ? mergeDeepenedProject(entry, result.project) : entry,
        ),
      )
      setDeepenNotes([
        ...result.warnings,
        ...result.assumptions.map((assumption) => `${assumption.label} (${assumption.confidence})`),
      ])
      setDeepenState({ status: 'idle', error: null })
    } catch (error) {
      if (controller?.signal.aborted) return
      setDeepenState({
        status: 'failed',
        error: error instanceof Error ? error.message : 'Deepening this project failed.',
      })
    } finally {
      if (controller && deepenAbortRef.current === controller) {
        deepenAbortRef.current = null
      }
    }
  }

  const sourceTextButtonLabel = project.source_text?.trim() ? 'Edit source text' : 'Add source text'
  const metricsButtonLabel = Object.keys(project.metrics ?? {}).length
    ? 'Edit metrics'
    : 'Add metrics'

  const sourceTextSheet = (
    <InspectorSheet
      open={sheetState !== null}
      eyebrow={`Project · ${project.id}`}
      title={sourceTextButtonLabel}
      onSave={saveSourceText}
      onCancel={() => setSheetState(null)}
    >
      <label className="inspector-field">
        <span className="inspector-field-label label-tracked">Source text</span>
        <textarea
          className="inspector-textarea"
          rows={12}
          value={sheetState?.draft ?? ''}
          onChange={(event) =>
            setSheetState((prev) => (prev ? { ...prev, draft: event.target.value } : prev))
          }
          aria-label="Source text"
        />
      </label>
    </InspectorSheet>
  )

  const metricsSheet = (
    <InspectorSheet
      open={metricsSheetState !== null}
      eyebrow={`Project · ${project.id}`}
      title={metricsButtonLabel}
      onSave={saveMetrics}
      onCancel={() => setMetricsSheetState(null)}
    >
      <label className="inspector-field">
        <span className="inspector-field-label label-tracked">Metrics JSON</span>
        <textarea
          className="inspector-textarea"
          rows={10}
          value={metricsSheetState?.draft ?? ''}
          onChange={(event) =>
            setMetricsSheetState((prev) =>
              prev ? { ...prev, draft: event.target.value, error: null } : prev,
            )
          }
          aria-label="Metrics JSON"
          aria-invalid={metricsSheetState?.error ? 'true' : undefined}
          aria-describedby={metricsSheetState?.error ? `${projectId}-metrics-error` : undefined}
        />
      </label>
      {metricsSheetState?.error ? (
        <p className="inspector-warning" id={`${projectId}-metrics-error`} role="alert">
          {metricsSheetState.error}
        </p>
      ) : null}
    </InspectorSheet>
  )

  if (editing) {
    return (
      <>
        <SlotShell eyebrow={`Project · ${project.id}`} title="Refine the project">
          <label className="inspector-field">
            <span className="inspector-field-label label-tracked">Name</span>
            <input
              className="inspector-input"
              type="text"
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
          </label>
          <label className="inspector-field">
            <span className="inspector-field-label label-tracked">Description</span>
            <textarea
              className="inspector-textarea"
              value={draft.description}
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              rows={3}
            />
          </label>
          <label className="inspector-field">
            <span className="inspector-field-label label-tracked">Problem</span>
            <textarea
              className="inspector-textarea"
              value={draft.problem}
              onChange={(event) => setDraft({ ...draft, problem: event.target.value })}
              rows={2}
            />
          </label>
          <label className="inspector-field">
            <span className="inspector-field-label label-tracked">Action</span>
            <textarea
              className="inspector-textarea"
              value={draft.action}
              onChange={(event) => setDraft({ ...draft, action: event.target.value })}
              rows={2}
            />
          </label>
          <label className="inspector-field">
            <span className="inspector-field-label label-tracked">Outcome</span>
            <textarea
              className="inspector-textarea"
              value={draft.outcome}
              onChange={(event) => setDraft({ ...draft, outcome: event.target.value })}
              rows={2}
            />
          </label>
          <label className="inspector-field">
            <span className="inspector-field-label label-tracked">Impact (one per line)</span>
            <textarea
              className="inspector-textarea"
              value={draft.impact}
              onChange={(event) => setDraft({ ...draft, impact: event.target.value })}
              rows={3}
            />
          </label>
          <label className="inspector-field">
            <span className="inspector-field-label label-tracked">
              Technologies (comma-separated)
            </span>
            <input
              className="inspector-input"
              type="text"
              value={draft.technologies}
              onChange={(event) => setDraft({ ...draft, technologies: event.target.value })}
            />
          </label>
          <label className="inspector-field">
            <span className="inspector-field-label label-tracked">Assumptions (one per line)</span>
            <textarea
              className="inspector-textarea"
              value={draft.assumptions}
              onChange={(event) => setDraft({ ...draft, assumptions: event.target.value })}
              rows={3}
            />
          </label>
          <label className="inspector-field">
            <span className="inspector-field-label label-tracked">URL</span>
            <input
              className="inspector-input"
              type="url"
              value={draft.url}
              onChange={(event) => setDraft({ ...draft, url: event.target.value })}
              placeholder="https://"
            />
          </label>
          <label className="inspector-field">
            <span className="inspector-field-label label-tracked">Tags (comma-separated)</span>
            <input
              className="inspector-input"
              type="text"
              value={draft.tags}
              onChange={(event) => setDraft({ ...draft, tags: event.target.value })}
            />
          </label>
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
          </Actions>
        </SlotShell>
        {sourceTextSheet}
        {metricsSheet}
      </>
    )
  }

  return (
    <>
      <SlotShell eyebrow="Project · Cross-cutting" title={project.name}>
        <p className="inspector-body-text">{project.description}</p>
        {project.problem?.trim() ? (
          <BulletPair label="Problem" value={project.problem} tone="problem" />
        ) : null}
        {project.action?.trim() ? (
          <BulletPair label="Action" value={project.action} tone="action" />
        ) : null}
        {project.outcome?.trim() ? (
          <BulletPair label="Outcome" value={project.outcome} tone="outcome" />
        ) : null}
        <BulletListSection label="Impact" items={project.impact ?? []} />
        <MetricsRows metrics={project.metrics} />
        <BulletListSection label="Technologies" items={project.technologies ?? []} />
        <BulletListSection label="Assumptions" items={project.assumptions ?? []} />
        <MetaRows
          rows={[
            ['Tags', project.tags.join(' · ') || '—'],
            ['URL', project.url ?? '—'],
          ]}
        />
        {deepenState.status === 'failed' ? (
          <p className="inspector-warning" role="alert">
            {deepenState.error}
          </p>
        ) : null}
        {deepenNotes.length > 0 ? (
          <div className="inspector-warning" role="status">
            <p>Project deepening notes</p>
            <ul>
              {deepenNotes.map((note, index) => (
                <li key={`${note}:${index}`}>{note}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <Actions>
          <button type="button" className="inspector-btn primary" onClick={startEditing}>
            Edit project
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
