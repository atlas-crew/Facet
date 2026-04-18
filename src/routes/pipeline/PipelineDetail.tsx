import { useId } from 'react'
import { Edit3, Trash2, Zap, BookOpen, ArrowRight, Search } from 'lucide-react'
import { AiActivityIndicator } from '../../components/AiActivityIndicator'
import type { PipelineEntry } from '../../types/pipeline'
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
        <Field label="Rounds" value={entry.rounds != null ? String(entry.rounds) : '\u2014'} />
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

          {entry.research?.people?.length ? (
            <div className="pipeline-detail-field pipeline-detail-notes">
              <span className="pipeline-detail-field-label">Relevant People</span>
              <div className="pipeline-research-people">
                {entry.research.people.map((person) => (
                  (() => {
                    const safeProfileUrl = sanitizeUrl(person.profileUrl)
                    return (
                      <div
                        key={[
                          person.name,
                          person.title,
                          person.company,
                          person.profileUrl ?? '',
                        ].join('|')}
                        className="pipeline-research-person"
                      >
                        <strong>{person.name}</strong>
                        <span>
                          {[person.title, person.company].filter(Boolean).join(' · ') || 'Public profile'}
                        </span>
                        {person.relevance ? <span>{person.relevance}</span> : null}
                        {safeProfileUrl ? (
                          <a href={safeProfileUrl} target="_blank" rel="noopener noreferrer">
                            View profile
                          </a>
                        ) : null}
                      </div>
                    )
                  })()
                ))}
              </div>
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
