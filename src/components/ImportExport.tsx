import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { JSON_SCHEMA, load } from 'js-yaml'
import { CheckCircle, Download, ShieldCheck, Upload, X } from 'lucide-react'
import type { ResumeData } from '../types'
import { exportResumeConfig, importResumeConfig } from '../engine/serializer'
import type { ResumeConfigSourceKind } from '../engine/serializer'
import { looksLikeProfessionalIdentity } from '../identity/schema'
import { useFocusTrap } from '../utils/useFocusTrap'

type Format = 'yaml' | 'json'
type ImportMode = 'replace' | 'merge'

interface ImportExportProps {
  open: boolean
  mode: 'import' | 'export'
  data: ResumeData
  onClose: () => void
  onImport: (result: {
    data: ResumeData
    importMode: ImportMode
    warnings: string[]
    sourceKind: ResumeConfigSourceKind
  }) => void
}

export function ImportExport({ open, mode, data, onClose, onImport }: ImportExportProps) {
  const [format, setFormat] = useState<Format>('json')
  const [importMode, setImportMode] = useState<ImportMode>('replace')
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [validationWarnings, setValidationWarnings] = useState<string[] | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const detectedSourceKind = useMemo<ResumeConfigSourceKind | null>(() => {
    const trimmed = input.trim()
    if (!trimmed) {
      return null
    }

    try {
      const parsed = format === 'json' ? JSON.parse(trimmed) : load(trimmed, { schema: JSON_SCHEMA })
      return looksLikeProfessionalIdentity(parsed) ? 'professional-identity-v3' : 'resume'
    } catch {
      return null
    }
  }, [format, input])
  const mergeDisabled = mode === 'import' && detectedSourceKind === 'professional-identity-v3'

  useEffect(() => {
    if (mergeDisabled && importMode === 'merge') {
      setImportMode('replace')
    }
  }, [importMode, mergeDisabled])

  const exportContent = useMemo(
    () => (mode === 'export' ? exportResumeConfig(data, format) : ''),
    [data, format, mode],
  )
  useFocusTrap(open, modalRef, onClose)

  if (!open) {
    return null
  }

  const handleValidate = () => {
    try {
      const parsed = importResumeConfig(input, format)
      setError(null)
      setValidationWarnings(parsed.warnings)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse config')
      setValidationWarnings(null)
    }
  }

  const handleImport = () => {
    try {
      const parsed = importResumeConfig(input, format)
      if (parsed.sourceKind === 'professional-identity-v3' && importMode === 'merge') {
        setError('Professional Identity Schema v3.1 imports currently support Replace All only.')
        setValidationWarnings(null)
        return
      }

      onImport({
        data: parsed.data,
        importMode,
        warnings: parsed.warnings,
        sourceKind: parsed.sourceKind,
      })
      setInput('')
      setError(null)
      setValidationWarnings(null)
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to parse config'
      setError(message)
      setValidationWarnings(null)
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
      setValidationWarnings(null)
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
          <h3 id="import-export-title">{mode === 'import' ? 'Import Data' : 'Export Config'}</h3>
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
            <div className="format-toggle">
              <button
                className={`btn-secondary ${importMode === 'replace' ? 'selected' : ''}`}
                type="button"
                onClick={() => setImportMode('replace')}
                aria-pressed={importMode === 'replace'}
              >
                Replace All
              </button>
              <button
                className={`btn-secondary ${importMode === 'merge' ? 'selected' : ''}`}
                type="button"
                onClick={() => setImportMode('merge')}
                aria-pressed={importMode === 'merge'}
                disabled={mergeDisabled}
                title={mergeDisabled ? 'Merge is not supported for Professional Identity v3 imports' : undefined}
              >
                Merge
              </button>
            </div>
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
              onChange={(event) => {
                setInput(event.target.value)
                setError(null)
                setValidationWarnings(null)
              }}
              placeholder={`Paste ${format.toUpperCase()} resume config or Professional Identity v3.1 here...`}
              className="import-textarea"
              aria-label="Imported configuration input"
            />
            {detectedSourceKind === 'professional-identity-v3' ? (
              <p className="warning-text" style={{ margin: 0 }}>
                Professional Identity v3.1 imports are adapted into the current Facet resume model and currently support
                {' '}<strong>Replace All</strong> only.
              </p>
            ) : null}
            {error ? <p className="error-text">{error}</p> : null}
            {validationWarnings !== null && !error && (
              validationWarnings.length === 0 ? (
                <p className="warning-text" style={{ color: 'var(--success, #16a34a)' }}>
                  <CheckCircle size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                  Validation passed — no warnings.
                </p>
              ) : (
                <ul className="warning-text" style={{ paddingLeft: 16 }}>
                  {validationWarnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              )
            )}
            <div className="format-toggle">
              <button type="button" className="btn-secondary" onClick={handleValidate} disabled={!input.trim()}>
                <ShieldCheck size={16} />
                Validate
              </button>
              <button type="button" className="btn-primary" onClick={handleImport} disabled={!input.trim()}>
                <Upload size={16} />
                Import ({importMode === 'replace' ? 'Replace All' : 'Merge'})
              </button>
            </div>
            <p style={{ margin: 0, fontSize: 11, color: 'var(--text-dim)' }}>
              <a href="/resume-schema.json" download style={{ color: 'var(--accent-primary)' }}>
                Resume schema
              </a>
              {' '}or{' '}
              <a href="/identity-schema-v3.json" download style={{ color: 'var(--accent-primary)' }}>
                Professional Identity v3.1 schema
              </a>
              {' '}for IDE autocomplete
            </p>
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
