import { useState, useRef } from 'react'
import { X } from 'lucide-react'
import { useFocusTrap } from '../../utils/useFocusTrap'
import { useResumeStore } from '../../store/resumeStore'
import {
  getPipelineResumePresetId,
  getPipelineResumeVariantLabel,
} from '../../utils/resumeGeneration'
import type {
  PipelineEntry,
  PipelineStatus,
  PipelineTier,
  ApplicationMethod,
  ResponseType,
  InterviewFormat,
  RejectionStage,
} from '../../types/pipeline'

type EntryDraft = Omit<PipelineEntry, 'id' | 'createdAt' | 'lastAction' | 'history'>

interface PipelineEntryModalProps {
  entry: PipelineEntry | null
  initialData?: Partial<PipelineEntry>
  onSave: (data: EntryDraft) => void
  onClose: () => void
}

const STATUSES: PipelineStatus[] = [
  'researching', 'applied', 'screening', 'interviewing',
  'offer', 'accepted', 'rejected', 'withdrawn', 'closed',
]

const TIERS: PipelineTier[] = ['1', '2', '3', 'watch']

const APP_METHODS: ApplicationMethod[] = [
  'direct-apply', 'referral', 'recruiter-inbound',
  'recruiter-outbound', 'cold-email', 'linkedin', 'unknown',
]

const RESPONSE_TYPES: ResponseType[] = [
  'none', 'auto-reject', 'human-reject',
  'screen-scheduled', 'interview-scheduled', 'direct-to-hm',
]

const INTERVIEW_FORMATS: InterviewFormat[] = [
  'hr-screen', 'hm-screen', 'tech-discussion', 'system-design',
  'take-home', 'live-coding', 'leetcode', 'pair-programming',
  'behavioral', 'peer-panel', 'cross-team', 'exec', 'presentation',
]

const REJECTION_STAGES: RejectionStage[] = [
  '', 'resume-screen', 'recruiter-screen', 'hm-screen',
  'technical', 'final', 'offer-declined', 'withdrew', 'ghosted',
]

function blankDraft(): EntryDraft {
  return {
    company: '',
    role: '',
    tier: '2',
    status: 'researching',
    comp: '',
    url: '',
    contact: '',
    vectorId: null,
    jobDescription: '',
    presetId: null,
    resumeVariant: '',
    resumeGeneration: null,
    positioning: '',
    skillMatch: '',
    nextStep: '',
    notes: '',
    appMethod: 'unknown',
    response: 'none',
    daysToResponse: null,
    rounds: null,
    format: [],
    rejectionStage: '',
    rejectionReason: '',
    offerAmount: '',
    dateApplied: '',
    dateClosed: '',
  }
}

function entryToDraft(e: PipelineEntry): EntryDraft {
  const { id: _, createdAt: _c, lastAction: _l, history: _h, ...rest } = e
  return rest
}

export function PipelineEntryModal({ entry, initialData, onSave, onClose }: PipelineEntryModalProps) {
  const [draft, setDraft] = useState<EntryDraft>(() => {
    if (entry) return entryToDraft(entry)
    const blank = blankDraft()
    if (initialData) {
      return { ...blank, ...initialData }
    }
    return blank
  })
  const dialogRef = useRef<HTMLDivElement>(null)
  const vectors = useResumeStore((s) => s.data.vectors)
  const presets = useResumeStore((s) => s.data.presets ?? [])
  const structuredPresetId = getPipelineResumePresetId(draft)
  const structuredPreset = structuredPresetId
    ? presets.find((preset) => preset.id === structuredPresetId) ?? null
    : null
  const structuredVariantLabel = draft.resumeGeneration
    ? getPipelineResumeVariantLabel(draft) || '(unnamed)'
    : ''

  useFocusTrap(true, dialogRef, onClose)

  const set = <K extends keyof EntryDraft>(key: K, value: EntryDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))

  const toggleFormat = (f: InterviewFormat) =>
    setDraft((d) => ({
      ...d,
      format: d.format.includes(f) ? d.format.filter((v) => v !== f) : [...d.format, f],
    }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(draft)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        ref={dialogRef}
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pipeline-modal-title"
        style={{ maxWidth: 720, maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 id="pipeline-modal-title" style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
            {entry ? 'Edit Entry' : 'Add Entry'}
          </h2>
          <button className="pipeline-btn pipeline-btn-ghost pipeline-btn-sm" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form className="pipeline-form" onSubmit={handleSubmit}>
          {/* Basic Info */}
          <div className="pipeline-form-section">
            <span className="pipeline-form-section-title">Basic Info</span>
            <div className="pipeline-form-row">
              <label className="pipeline-form-field">
                <span className="pipeline-form-label">Company</span>
                <input className="pipeline-form-input" value={draft.company} onChange={(e) => set('company', e.target.value)} required />
              </label>
              <label className="pipeline-form-field">
                <span className="pipeline-form-label">Role</span>
                <input className="pipeline-form-input" value={draft.role} onChange={(e) => set('role', e.target.value)} required />
              </label>
            </div>
            <div className="pipeline-form-row">
              <label className="pipeline-form-field">
                <span className="pipeline-form-label">Tier</span>
                <select className="pipeline-form-select" value={draft.tier} onChange={(e) => set('tier', e.target.value as PipelineTier)}>
                  {TIERS.map((t) => <option key={t} value={t}>{t === 'watch' ? 'Watch' : `Tier ${t}`}</option>)}
                </select>
              </label>
              <label className="pipeline-form-field">
                <span className="pipeline-form-label">Status</span>
                <select className="pipeline-form-select" value={draft.status} onChange={(e) => set('status', e.target.value as PipelineStatus)}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
            </div>
            <div className="pipeline-form-row">
              <label className="pipeline-form-field">
                <span className="pipeline-form-label">Comp</span>
                <input className="pipeline-form-input" value={draft.comp} onChange={(e) => set('comp', e.target.value)} placeholder="$170K–$210K" />
              </label>
              <label className="pipeline-form-field">
                <span className="pipeline-form-label">Contact</span>
                <input className="pipeline-form-input" value={draft.contact} onChange={(e) => set('contact', e.target.value)} />
              </label>
            </div>
            <label className="pipeline-form-field">
              <span className="pipeline-form-label">URL</span>
              <input className="pipeline-form-input" type="url" value={draft.url} onChange={(e) => set('url', e.target.value)} />
            </label>
          </div>

          {/* Positioning */}
          <div className="pipeline-form-section">
            <span className="pipeline-form-section-title">Positioning</span>
            <label className="pipeline-form-field">
              <span className="pipeline-form-label">Positioning</span>
              <textarea className="pipeline-form-textarea" value={draft.positioning} onChange={(e) => set('positioning', e.target.value)} />
            </label>
            <label className="pipeline-form-field">
              <span className="pipeline-form-label">Skill Match</span>
              <input className="pipeline-form-input" value={draft.skillMatch} onChange={(e) => set('skillMatch', e.target.value)} placeholder="Comma-separated skills" />
            </label>
            <label className="pipeline-form-field">
              <span className="pipeline-form-label">Next Step</span>
              <input className="pipeline-form-input" value={draft.nextStep} onChange={(e) => set('nextStep', e.target.value)} />
            </label>
            <label className="pipeline-form-field">
              <span className="pipeline-form-label">Notes</span>
              <textarea className="pipeline-form-textarea" value={draft.notes} onChange={(e) => set('notes', e.target.value)} />
            </label>
            <label className="pipeline-form-field">
              <span className="pipeline-form-label">Job Description</span>
              <textarea className="pipeline-form-textarea" style={{ minHeight: 100 }} value={draft.jobDescription} onChange={(e) => set('jobDescription', e.target.value)} placeholder="Paste JD text for analysis..." />
            </label>
            <div className="pipeline-form-row">
              <label className="pipeline-form-field">
                <span className="pipeline-form-label">Vector</span>
                <select
                  className="pipeline-form-select"
                  value={draft.vectorId ?? ''}
                  disabled={Boolean(draft.resumeGeneration)}
                  onChange={(e) => set('vectorId', e.target.value || null)}
                >
                  <option value="">(none)</option>
                  {vectors.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
                </select>
              </label>
              <label className="pipeline-form-field">
                <span className="pipeline-form-label">
                  {draft.resumeGeneration ? 'Legacy Resume Variant Label' : 'Resume Variant'}
                </span>
                <input
                  className="pipeline-form-input"
                  value={draft.resumeVariant}
                  disabled={Boolean(draft.resumeGeneration)}
                  onChange={(e) => set('resumeVariant', e.target.value)}
                />
              </label>
            </div>
            {draft.resumeGeneration ? (
              <div className="pipeline-generated-variant-card" role="note" aria-label="Generated resume variant">
                <strong>{structuredVariantLabel}</strong>
                <span>
                  {draft.resumeGeneration.mode} ·{' '}
                  {draft.resumeGeneration.vectorMode === 'auto' ? 'AI suggested vectors' : 'Manual vector plan'}
                </span>
                {structuredPreset ? <span>Linked preset: {structuredPreset.name}</span> : null}
                {draft.resumeGeneration.lastGeneratedAt ? (
                  <span>Last generated: {draft.resumeGeneration.lastGeneratedAt}</span>
                ) : (
                  <span>Managed from Build when you run the per-job resume flow.</span>
                )}
              </div>
            ) : null}
          </div>

          {/* Outcome Tracking */}
          <div className="pipeline-form-section">
            <span className="pipeline-form-section-title">Outcome Tracking</span>
            <div className="pipeline-form-row">
              <label className="pipeline-form-field">
                <span className="pipeline-form-label">Application Method</span>
                <select className="pipeline-form-select" value={draft.appMethod} onChange={(e) => set('appMethod', e.target.value as ApplicationMethod)}>
                  {APP_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </label>
              <label className="pipeline-form-field">
                <span className="pipeline-form-label">Response</span>
                <select className="pipeline-form-select" value={draft.response} onChange={(e) => set('response', e.target.value as ResponseType)}>
                  {RESPONSE_TYPES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </label>
            </div>
            <div className="pipeline-form-row">
              <label className="pipeline-form-field">
                <span className="pipeline-form-label">Days to Response</span>
                <input className="pipeline-form-input" type="number" value={draft.daysToResponse ?? ''} onChange={(e) => set('daysToResponse', e.target.value ? Number(e.target.value) : null)} />
              </label>
              <label className="pipeline-form-field">
                <span className="pipeline-form-label">Rounds</span>
                <input className="pipeline-form-input" type="number" value={draft.rounds ?? ''} onChange={(e) => set('rounds', e.target.value ? Number(e.target.value) : null)} />
              </label>
            </div>
            <div className="pipeline-form-field">
              <span className="pipeline-form-label">Interview Formats</span>
              <div className="pipeline-format-pills">
                {INTERVIEW_FORMATS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={`pipeline-pill ${draft.format.includes(f) ? 'pipeline-pill-active' : ''}`}
                    onClick={() => toggleFormat(f)}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <div className="pipeline-form-row">
              <label className="pipeline-form-field">
                <span className="pipeline-form-label">Rejection Stage</span>
                <select className="pipeline-form-select" value={draft.rejectionStage} onChange={(e) => set('rejectionStage', e.target.value as RejectionStage)}>
                  {REJECTION_STAGES.map((s) => <option key={s} value={s}>{s || '(none)'}</option>)}
                </select>
              </label>
              <label className="pipeline-form-field">
                <span className="pipeline-form-label">Offer Amount</span>
                <input className="pipeline-form-input" value={draft.offerAmount} onChange={(e) => set('offerAmount', e.target.value)} />
              </label>
            </div>
            <label className="pipeline-form-field">
              <span className="pipeline-form-label">Rejection Reason</span>
              <input className="pipeline-form-input" value={draft.rejectionReason} onChange={(e) => set('rejectionReason', e.target.value)} />
            </label>
          </div>

          {/* Dates */}
          <div className="pipeline-form-section">
            <span className="pipeline-form-section-title">Dates</span>
            <div className="pipeline-form-row">
              <label className="pipeline-form-field">
                <span className="pipeline-form-label">Date Applied</span>
                <input className="pipeline-form-input" type="date" value={draft.dateApplied} onChange={(e) => set('dateApplied', e.target.value)} />
              </label>
              <label className="pipeline-form-field">
                <span className="pipeline-form-label">Date Closed</span>
                <input className="pipeline-form-input" type="date" value={draft.dateClosed} onChange={(e) => set('dateClosed', e.target.value)} />
              </label>
            </div>
          </div>

          <div className="pipeline-modal-actions">
            <button type="button" className="pipeline-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="pipeline-btn pipeline-btn-primary">
              {entry ? 'Save Changes' : 'Add Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
