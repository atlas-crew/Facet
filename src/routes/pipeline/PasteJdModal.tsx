import { useState, useRef } from 'react'
import { X } from 'lucide-react'
import { useFocusTrap } from '../../utils/useFocusTrap'
import { parseJobDescription } from '../../utils/jdParser'
import type { PipelineEntry } from '../../types/pipeline'

interface PasteJdModalProps {
  onClose: () => void
  onParse: (data: Partial<PipelineEntry>) => void
}

export function PasteJdModal({ onClose, onParse }: PasteJdModalProps) {
  const [text, setText] = useState('')
  const dialogRef = useRef<HTMLDivElement>(null)

  useFocusTrap(true, dialogRef, onClose)

  const handleParse = () => {
    if (!text.trim()) return
    const parsed = parseJobDescription(text)
    
    onParse({
      company: parsed.company,
      role: parsed.role,
      comp: parsed.comp,
      jobDescription: parsed.jobDescription,
      notes: parsed.location ? `Location: ${parsed.location}` : ''
    })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        ref={dialogRef}
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="paste-jd-title"
        style={{ maxWidth: 600, width: '100%' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <h2 id="paste-jd-title" style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
            Paste Job Description
          </h2>
          <button className="pipeline-btn pipeline-btn-ghost pipeline-btn-sm" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
          Paste the raw text of a job posting (e.g. from LinkedIn). We'll try to extract the company, role, and compensation automatically.
        </p>

        <textarea
          className="pipeline-form-textarea"
          style={{ minHeight: 300, marginBottom: 'var(--space-4)', fontFamily: 'var(--font-mono)' }}
          placeholder="Software Engineer, Backend&#10;Google&#10;Mountain View, CA&#10;$150k - $200k&#10;&#10;About the job..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
        />

        <div className="pipeline-modal-actions">
          <button type="button" className="pipeline-btn" onClick={onClose}>Cancel</button>
          <button 
            type="button" 
            className="pipeline-btn pipeline-btn-primary" 
            onClick={handleParse}
            disabled={!text.trim()}
          >
            Parse & Continue
          </button>
        </div>
      </div>
    </div>
  )
}
