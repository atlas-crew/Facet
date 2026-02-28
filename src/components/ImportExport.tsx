import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Download, Upload, X } from 'lucide-react'
import type { ResumeData } from '../types'
import { exportResumeConfig, importResumeConfig } from '../engine/serializer'
import { useFocusTrap } from '../utils/useFocusTrap'

type Format = 'yaml' | 'json'

interface ImportExportProps {
  open: boolean
  mode: 'import' | 'export'
  data: ResumeData
  onClose: () => void
  onImport: (data: ResumeData) => void
}

export function ImportExport({ open, mode, data, onClose, onImport }: ImportExportProps) {
  const [format, setFormat] = useState<Format>('yaml')
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const exportContent = useMemo(
    () => (mode === 'export' ? exportResumeConfig(data, format) : ''),
    [data, format, mode],
  )
  useFocusTrap(open, modalRef, onClose)

  if (!open) {
    return null
  }

  const handleImport = () => {
    try {
      const parsed = importResumeConfig(input, format)
      onImport(parsed.data)
      setInput('')
      setError(null)
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to parse config'
      setError(message)
    }
  }

  const downloadExport = () => {
    const blob = new Blob([exportContent], {
      type: format === 'yaml' ? 'text/yaml;charset=utf-8' : 'application/json;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `vector-resume-config.${format === 'yaml' ? 'yaml' : 'json'}`
    document.body.append(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 10000)
  }

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    try {
      const content = await file.text()
      setInput(content)
      setError(null)
      const lowered = file.name.toLowerCase()
      if (lowered.endsWith('.json')) {
        setFormat('json')
      } else if (lowered.endsWith('.yaml') || lowered.endsWith('.yml')) {
        setFormat('yaml')
      }
    } catch {
      setError('Unable to read uploaded file.')
    } finally {
      event.target.value = ''
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="import-export-title">
      <div className="modal-card" ref={modalRef} tabIndex={-1}>
        <header className="modal-header">
          <h3 id="import-export-title">{mode === 'import' ? 'Import Config' : 'Export Config'}</h3>
          <button className="btn-ghost" type="button" onClick={onClose} aria-label="Close dialog">
            <X size={14} />
          </button>
        </header>

        <div className="format-toggle">
          <button
            className={`btn-secondary ${format === 'yaml' ? 'selected' : ''}`}
            type="button"
            onClick={() => setFormat('yaml')}
            aria-pressed={format === 'yaml'}
          >
            YAML
          </button>
          <button
            className={`btn-secondary ${format === 'json' ? 'selected' : ''}`}
            type="button"
            onClick={() => setFormat('json')}
            aria-pressed={format === 'json'}
          >
            JSON
          </button>
        </div>

        {mode === 'import' ? (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".yaml,.yml,.json,text/plain"
              className="sr-only"
              onChange={handleFileUpload}
            />
            <button
              type="button"
              className="btn-secondary"
              onClick={() => fileInputRef.current?.click()}
            >
              Upload File
            </button>
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={`Paste ${format.toUpperCase()} here...`}
              className="import-textarea"
              aria-label="Imported configuration input"
            />
            {error ? <p className="error-text">{error}</p> : null}
            <button type="button" className="btn-primary" onClick={handleImport}>
              <Upload size={16} />
              Import {format.toUpperCase()}
            </button>
          </>
        ) : (
          <>
            <textarea
              value={exportContent}
              readOnly
              className="import-textarea"
              aria-label="Exported configuration"
            />
            <button type="button" className="btn-primary" onClick={downloadExport}>
              <Download size={16} />
              Download {format.toUpperCase()}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
