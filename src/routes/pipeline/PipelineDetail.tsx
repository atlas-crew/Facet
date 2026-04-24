import { useId } from 'react'
import { Edit3, Trash2, Zap, BookOpen, ArrowRight, Search, Plus, BookMarked } from 'lucide-react'
import { AiActivityIndicator } from '../../components/AiActivityIndicator'
import type {
  InterviewFormat,
  PipelineEntry,
  PipelineInterviewer,
  PipelineRound,
} from '../../types/pipeline'
import { INTERVIEW_FORMAT_VALUES } from '../../types/pipeline'
import { usePipelineStore } from '../../store/pipelineStore'
import { useResumeStore } from '../../store/resumeStore'
import {
  getPipelineResumePresetId,
  getPipelineResumePrimaryVectorId,
  getPipelineResumeVariantLabel,
} from '../../utils/resumeGeneration'
import { sanitizeUrl } from '../../utils/sanitizeUrl'

interface PipelineDetailProps {
  entry: PipelineEntry
  onEdit: () => void
  onDelete: () => void
  onAnalyze: () => void
  onPrep: () => void
  onOpenInBuilder: () => void
  onInvestigate: () => void
  canInvestigate: boolean
  isInvestigating: boolean
  investigationError?: string
}

const ACTIVE_STATUSES = new Set(['screening', 'interviewing'])

export function PipelineDetail({
  entry,
  onEdit,
  onDelete,
  onAnalyze,
  onPrep,
  onOpenInBuilder,
  onInvestigate,
  canInvestigate,
  isInvestigating,
  investigationError,
}: PipelineDetailProps) {
  const actionGroupId = useId()
  const primaryVectorId = getPipelineResumePrimaryVectorId(entry)
  const linkedPresetId = getPipelineResumePresetId(entry)
  const showExecutionActions =
    Boolean(primaryVectorId) || Boolean(entry.jobDescription) || ACTIVE_STATUSES.has(entry.status)
  const linkedPreset = useResumeStore((s) =>
    linkedPresetId ? (s.data.presets ?? []).find((p) => p.id === linkedPresetId) ?? null : null
  )
  const resumeVariantLabel = getPipelineResumeVariantLabel(entry) || '\u2014'
  const hasStructuredRounds = (entry.interviewRounds?.length ?? 0) > 0

  return (
    <div className="pipeline-detail">
      <div className="pipeline-detail-grid">
        <Field label="Company" value={entry.company} />
        <Field label="Role" value={entry.role} />
        <Field label="Comp" value={entry.comp || '\u2014'} />
        <Field label="Contact" value={entry.contact || '\u2014'} />
        <Field label="Application Method" value={entry.appMethod} />
        <Field label="Response" value={entry.response} />
        <Field label="Days to Response" value={entry.daysToResponse != null ? String(entry.daysToResponse) : '\u2014'} />
        {!hasStructuredRounds && (
          <Field label="Rounds" value={entry.rounds != null ? String(entry.rounds) : '\u2014'} />
        )}
        <Field label="Resume Variant" value={resumeVariantLabel} />
        {entry.resumeGeneration && (
          <Field label="Generation Mode" value={entry.resumeGeneration.mode} />
        )}
        {entry.resumeGeneration && (
          <Field
            label="Vector Plan"
            value={entry.resumeGeneration.vectorMode === 'auto' ? 'AI suggested' : 'Manual'}
          />
        )}
        {entry.resumeGeneration?.lastGeneratedAt && (
          <Field label="Last Generated" value={entry.resumeGeneration.lastGeneratedAt} />
        )}
        {linkedPresetId && (
          <Field label="Linked Preset" value={linkedPreset ? linkedPreset.name : '(deleted)'} />
        )}
        <Field label="Date Applied" value={entry.dateApplied || '\u2014'} />
        {entry.rejectionStage && (
          <Field label="Rejection Stage" value={entry.rejectionStage} />
        )}
        {entry.rejectionReason && (
          <Field label="Rejection Reason" value={entry.rejectionReason} />
        )}
        {entry.offerAmount && (
          <Field label="Offer Amount" value={entry.offerAmount} />
        )}
        {entry.url && (
          <div className="pipeline-detail-field">
            <span className="pipeline-detail-field-label">URL</span>
            <span className="pipeline-detail-field-value">
              {sanitizeUrl(entry.url) ? (
                <a href={sanitizeUrl(entry.url)!} target="_blank" rel="noopener noreferrer">{entry.url}</a>
              ) : (
                <span title="Not a valid http/https URL">{entry.url}</span>
              )}
            </span>
          </div>
        )}
        {entry.format.length > 0 && (
          <Field label="Interview Formats" value={entry.format.join(', ')} />
        )}
        {entry.positioning && (
          <div className="pipeline-detail-field pipeline-detail-notes">
            <span className="pipeline-detail-field-label">Positioning</span>
            <span className="pipeline-detail-field-value">{entry.positioning}</span>
          </div>
        )}
        {entry.skillMatch && (
          <div className="pipeline-detail-field pipeline-detail-notes">
            <span className="pipeline-detail-field-label">Skill Match</span>
            <span className="pipeline-detail-field-value">{entry.skillMatch}</span>
          </div>
        )}
        {entry.notes && (
          <div className="pipeline-detail-field pipeline-detail-notes">
            <span className="pipeline-detail-field-label">Notes</span>
            <span className="pipeline-detail-field-value">{entry.notes}</span>
          </div>
        )}
        {entry.jobDescription && (
          <div className="pipeline-detail-field pipeline-detail-notes">
            <span className="pipeline-detail-field-label">Job Description</span>
            <div className="pipeline-detail-jd">{entry.jobDescription}</div>
          </div>
        )}
      </div>

      {(entry.research || investigationError) && (
        <div className="pipeline-research">
          <div className="pipeline-research-header">
            <span className="pipeline-history-title">Research</span>
            {entry.research && (
              <span
                className={`pipeline-research-status ${entry.research.status === 'investigated' ? 'is-investigated' : 'is-seeded'}`}
              >
                {entry.research.status === 'investigated' ? 'Investigated with AI' : 'Seeded from Research'}
              </span>
            )}
          </div>

          {investigationError && (
            <div className="pipeline-research-error" role="alert">
              {investigationError}
            </div>
          )}

          {entry.research?.summary && (
            <div className="pipeline-detail-field pipeline-detail-notes">
              <span className="pipeline-detail-field-label">Research Summary</span>
              <span className="pipeline-detail-field-value">{entry.research.summary}</span>
            </div>
          )}

          {entry.research?.jobDescriptionSummary && (
            <div className="pipeline-detail-field pipeline-detail-notes">
              <span className="pipeline-detail-field-label">Role Snapshot</span>
              <span className="pipeline-detail-field-value">{entry.research.jobDescriptionSummary}</span>
            </div>
          )}

          {entry.research?.interviewSignals?.length ? (
            <div className="pipeline-detail-field pipeline-detail-notes">
              <span className="pipeline-detail-field-label">Interview Signals</span>
              <ul className="pipeline-research-list">
                {entry.research.interviewSignals.map((signal, index) => (
                  <li key={`${signal}-${index}`}>{signal}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {entry.research?.sources?.length ? (
            <div className="pipeline-detail-field pipeline-detail-notes">
              <span className="pipeline-detail-field-label">Sources</span>
              <ul className="pipeline-research-list">
                {entry.research.sources.map((source) => (
                  (() => {
                    const safeSourceUrl = sanitizeUrl(source.url)
                    return (
                      <li key={[
                        source.kind,
                        source.label,
                        source.url ?? '',
                      ].join('|')}>
                        {safeSourceUrl ? (
                          <a href={safeSourceUrl} target="_blank" rel="noopener noreferrer">
                            {source.label}
                          </a>
                        ) : (
                          <span>{source.label}</span>
                        )}
                        <span className="pipeline-research-source-kind">{source.kind}</span>
                      </li>
                    )
                  })()
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}

      <PipelineRoundsSection entry={entry} />

      {entry.history.length > 0 && (
        <div className="pipeline-history">
          <span className="pipeline-history-title">History</span>
          {[...entry.history].reverse().map((h, i) => (
            <div key={i} className="pipeline-history-entry">
              <span className="pipeline-history-date">{h.date}</span>
              <span className="pipeline-history-note">{h.note}</span>
            </div>
          ))}
        </div>
      )}

      <div className="pipeline-detail-action-groups">
        <div
          className="pipeline-detail-action-group"
          role="group"
          aria-labelledby={`${actionGroupId}-research`}
        >
          <span id={`${actionGroupId}-research`} className="pipeline-detail-action-label">Research</span>
          <div className="pipeline-detail-actions">
            <button
              className={`pipeline-btn pipeline-btn-sm ${isInvestigating ? 'ai-working-button' : ''}`}
              onClick={onInvestigate}
              disabled={isInvestigating || !canInvestigate}
              aria-busy={isInvestigating}
              title={canInvestigate ? undefined : 'Configure VITE_ANTHROPIC_PROXY_URL to investigate from the pipeline.'}
            >
              <Search size={14} /> {isInvestigating ? 'Investigating…' : entry.research?.status === 'investigated' ? 'Refresh Research' : 'Investigate with AI'}
            </button>
            <AiActivityIndicator
              active={isInvestigating}
              label="AI researching"
              className="pipeline-investigation-indicator"
            />
            {!canInvestigate ? (
              <span className="pipeline-action-hint">AI research unavailable until the proxy is configured.</span>
            ) : null}
          </div>
        </div>

        {showExecutionActions ? (
          <div
            className="pipeline-detail-action-group"
            role="group"
            aria-labelledby={`${actionGroupId}-execution`}
          >
            <span id={`${actionGroupId}-execution`} className="pipeline-detail-action-label">Execution</span>
            <div className="pipeline-detail-actions">
              {primaryVectorId && (
                <button className="pipeline-btn pipeline-btn-sm" onClick={onOpenInBuilder}>
                  <ArrowRight size={14} /> Open in Builder
                </button>
              )}
              {entry.jobDescription && (
                <button className="pipeline-btn pipeline-btn-sm pipeline-btn-primary" onClick={onAnalyze}>
                  <Zap size={14} /> Analyze in Builder
                </button>
              )}
              {ACTIVE_STATUSES.has(entry.status) && (
                <button className="pipeline-btn pipeline-btn-sm" onClick={onPrep}>
                  <BookOpen size={14} /> Prep for Interview
                </button>
              )}
            </div>
          </div>
        ) : null}

        <div
          className="pipeline-detail-action-group"
          role="group"
          aria-labelledby={`${actionGroupId}-management`}
        >
          <span id={`${actionGroupId}-management`} className="pipeline-detail-action-label">Management</span>
          <div className="pipeline-detail-actions">
            <button className="pipeline-btn pipeline-btn-sm" onClick={onEdit}>
              <Edit3 size={14} /> Edit
            </button>
            <button className="pipeline-btn pipeline-btn-sm pipeline-btn-danger" onClick={onDelete}>
              <Trash2 size={14} /> Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="pipeline-detail-field">
      <span className="pipeline-detail-field-label">{label}</span>
      <span className="pipeline-detail-field-value">{value}</span>
    </div>
  )
}

function parseScheduledFor(value: string | undefined): number | null {
  if (!value) return null
  const ts = Date.parse(value)
  return Number.isNaN(ts) ? null : ts
}

function sortRoundsForDisplay(rounds: PipelineRound[]): PipelineRound[] {
  return [...rounds].sort((a, b) => {
    const ta = parseScheduledFor(a.scheduledFor)
    const tb = parseScheduledFor(b.scheduledFor)
    if (ta != null && tb != null) return ta - tb
    if (ta != null) return -1
    if (tb != null) return 1
    return a.createdAt.localeCompare(b.createdAt)
  })
}

/** <input type="datetime-local"> needs `YYYY-MM-DDTHH:mm`; ISO strings include seconds/tz. */
function toLocalDateTimeInput(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromLocalDateTimeInput(value: string): string | undefined {
  if (!value) return undefined
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
}

function PipelineRoundsSection({ entry }: { entry: PipelineEntry }) {
  const rounds = entry.interviewRounds ?? []
  const addRound = usePipelineStore((s) => s.addRound)
  const sorted = sortRoundsForDisplay(rounds)

  const handleAdd = () => {
    addRound(entry.id, { label: 'New round', format: 'hr-screen' })
  }

  return (
    <div className="pipeline-rounds">
      <div className="pipeline-rounds-header">
        <span className="pipeline-history-title">Rounds ({rounds.length})</span>
        <button
          type="button"
          className="pipeline-btn pipeline-btn-sm"
          onClick={handleAdd}
        >
          <Plus size={14} /> Add Round
        </button>
      </div>

      {rounds.length === 0 ? (
        <p className="pipeline-rounds-empty">
          No rounds yet. Add a round to track interviewers and link prep decks.
        </p>
      ) : (
        <div className="pipeline-rounds-list">
          {sorted.map((round) => (
            <PipelineRoundCard key={round.id} entryId={entry.id} round={round} />
          ))}
        </div>
      )}
    </div>
  )
}

function PipelineRoundCard({ entryId, round }: { entryId: string; round: PipelineRound }) {
  const updateRound = usePipelineStore((s) => s.updateRound)
  const deleteRound = usePipelineStore((s) => s.deleteRound)
  const addInterviewer = usePipelineStore((s) => s.addInterviewer)
  const fieldId = useId()

  const patch = (p: Partial<PipelineRound>) => updateRound(entryId, round.id, p)

  return (
    <div className="pipeline-round-card">
      <div className="pipeline-round-header">
        <input
          type="text"
          className="pipeline-round-label-input"
          value={round.label}
          onChange={(e) => patch({ label: e.target.value })}
          placeholder="Round label (e.g. Doug technical)"
          aria-label="Round label"
        />
        <button
          type="button"
          className="pipeline-btn pipeline-btn-sm pipeline-btn-danger"
          onClick={() => deleteRound(entryId, round.id)}
          aria-label={`Delete round ${round.label}`}
        >
          <Trash2 size={14} /> Delete
        </button>
      </div>

      <div className="pipeline-round-fields">
        <label className="pipeline-round-field">
          <span>Format</span>
          <select
            value={round.format}
            onChange={(e) => patch({ format: e.target.value as InterviewFormat })}
          >
            {INTERVIEW_FORMAT_VALUES.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </label>
        <label className="pipeline-round-field">
          <span>Scheduled for</span>
          <input
            type="datetime-local"
            value={toLocalDateTimeInput(round.scheduledFor)}
            onChange={(e) => patch({ scheduledFor: fromLocalDateTimeInput(e.target.value) })}
          />
        </label>
        <label className="pipeline-round-field">
          <span>Duration (min)</span>
          <input
            type="number"
            min={0}
            value={round.durationMinutes ?? ''}
            onChange={(e) => {
              const v = e.target.value
              patch({ durationMinutes: v === '' ? undefined : Number(v) })
            }}
          />
        </label>
      </div>

      <label className="pipeline-round-field pipeline-round-field-full">
        <span>Notes</span>
        <textarea
          id={`${fieldId}-notes`}
          rows={2}
          value={round.notes ?? ''}
          onChange={(e) => patch({ notes: e.target.value || undefined })}
          placeholder="Context, prompts to remember, etc."
        />
      </label>

      <div className="pipeline-round-interviewers">
        <div className="pipeline-round-interviewers-header">
          <span className="pipeline-round-interviewers-title">
            Interviewers ({round.interviewers.length})
          </span>
          <button
            type="button"
            className="pipeline-btn pipeline-btn-sm"
            onClick={() =>
              addInterviewer(entryId, round.id, { name: '' })
            }
          >
            <Plus size={14} /> Add Interviewer
          </button>
        </div>
        {round.interviewers.length === 0 ? (
          <p className="pipeline-round-interviewers-empty">
            Paste names from the calendar invite. Dossiers fill in when you generate prep.
          </p>
        ) : (
          <div className="pipeline-round-interviewer-list">
            {round.interviewers.map((iv) => (
              <PipelineInterviewerRow
                key={iv.id}
                entryId={entryId}
                roundId={round.id}
                interviewer={iv}
              />
            ))}
          </div>
        )}
      </div>

      <div className="pipeline-round-actions">
        <button
          type="button"
          className="pipeline-btn pipeline-btn-sm"
          disabled
          title="Coming soon — triggers per-interviewer research and generates a prep deck."
        >
          <BookMarked size={14} /> Generate Prep Deck
        </button>
      </div>
    </div>
  )
}

function PipelineInterviewerRow({
  entryId,
  roundId,
  interviewer,
}: {
  entryId: string
  roundId: string
  interviewer: PipelineInterviewer
}) {
  const updateInterviewer = usePipelineStore((s) => s.updateInterviewer)
  const deleteInterviewer = usePipelineStore((s) => s.deleteInterviewer)

  const patch = (p: Partial<PipelineInterviewer>) =>
    updateInterviewer(entryId, roundId, interviewer.id, p)

  return (
    <div className="pipeline-round-interviewer">
      <input
        type="text"
        value={interviewer.name}
        onChange={(e) => patch({ name: e.target.value })}
        placeholder="Name"
        aria-label="Interviewer name"
      />
      <input
        type="text"
        value={interviewer.title ?? ''}
        onChange={(e) => patch({ title: e.target.value || undefined })}
        placeholder="Title (optional)"
        aria-label="Interviewer title"
      />
      <input
        type="url"
        value={interviewer.linkedInUrl ?? ''}
        onChange={(e) => patch({ linkedInUrl: e.target.value || undefined })}
        placeholder="LinkedIn URL (optional)"
        aria-label="LinkedIn URL"
      />
      <button
        type="button"
        className="pipeline-btn pipeline-btn-sm pipeline-btn-icon"
        onClick={() => deleteInterviewer(entryId, roundId, interviewer.id)}
        aria-label={`Remove ${interviewer.name || 'interviewer'}`}
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}
