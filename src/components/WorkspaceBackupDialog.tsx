import { useRef, useState, type ChangeEvent } from 'react'
import { Download, ShieldCheck, Upload, X } from 'lucide-react'
import {
  buildWorkspaceBackupFileName,
  createEncryptedWorkspaceBackup,
  decryptEncryptedWorkspaceBackup,
  getPersistenceRuntime,
} from '../persistence'
import { slugify } from '../utils/idUtils'
import { useFocusTrap } from '../utils/useFocusTrap'

type DialogMode = 'export' | 'import'
type ImportMode = 'replace' | 'merge'

interface WorkspaceBackupDialogProps {
  open: boolean
  onClose: () => void
}

export function WorkspaceBackupDialog({ open, onClose }: WorkspaceBackupDialogProps) {
  const [mode, setMode] = useState<DialogMode>('export')
  const [importMode, setImportMode] = useState<ImportMode>('replace')
  const [passphrase, setPassphrase] = useState('')
  const [confirmPassphrase, setConfirmPassphrase] = useState('')
  const [bundleText, setBundleText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useFocusTrap(open, modalRef, onClose)

  if (!open) {
    return null
  }

  const clearStatus = () => {
    setError(null)
    setSuccess(null)
  }

  const resetForm = () => {
    setPassphrase('')
    setConfirmPassphrase('')
    setBundleText('')
    clearStatus()
  }

  const ensureMatchingPassphrases = () => {
    if (passphrase !== confirmPassphrase) {
      throw new Error('Passphrases do not match.')
    }
  }

  const downloadBundleText = (bundle: string, fileName: string) => {
    const blob = new Blob([bundle], {
      type: 'application/json;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.append(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 10000)
  }

  const handleCreateBackup = async () => {
    clearStatus()

    try {
      ensureMatchingPassphrases()
      setBusy(true)
      const runtime = getPersistenceRuntime()
      const snapshot = await runtime.exportWorkspaceSnapshot()
      const backupText = await createEncryptedWorkspaceBackup(snapshot, passphrase)
      setBundleText(backupText)
      downloadBundleText(
        backupText,
        buildWorkspaceBackupFileName(snapshot.workspace.name, snapshot.exportedAt, slugify),
      )
      setSuccess('Encrypted backup created and downloaded.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create encrypted backup.')
      setSuccess(null)
    } finally {
      setBusy(false)
    }
  }

  const handleImportBackup = async () => {
    clearStatus()

    try {
      setBusy(true)
      const runtime = getPersistenceRuntime()
      const snapshot = await decryptEncryptedWorkspaceBackup(bundleText, passphrase)
      await runtime.importWorkspaceSnapshot(snapshot, { mode: importMode })
      setSuccess(importMode === 'merge' ? 'Backup merged successfully.' : 'Backup restored successfully.')
      setBundleText('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import encrypted backup.')
      setSuccess(null)
    } finally {
      setBusy(false)
    }
  }

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    try {
      const content = await file.text()
      setBundleText(content)
      clearStatus()
    } catch {
      setError('Unable to read uploaded backup file.')
      setSuccess(null)
    } finally {
      event.target.value = ''
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="workspace-backup-title">
      <div className="modal-card workspace-backup-modal" ref={modalRef} tabIndex={-1}>
        <header className="modal-header">
          <h3 id="workspace-backup-title">Encrypted Workspace Backup</h3>
          <button className="btn-ghost" type="button" onClick={onClose} aria-label="Close dialog">
            <X size={14} />
          </button>
        </header>

        <div className="format-toggle">
          <button
            className={`btn-secondary ${mode === 'export' ? 'selected' : ''}`}
            type="button"
            onClick={() => {
              setMode('export')
              resetForm()
            }}
            aria-pressed={mode === 'export'}
          >
            Export Backup
          </button>
          <button
            className={`btn-secondary ${mode === 'import' ? 'selected' : ''}`}
            type="button"
            onClick={() => {
              setMode('import')
              resetForm()
            }}
            aria-pressed={mode === 'import'}
          >
            Import Backup
          </button>
        </div>

        {mode === 'import' ? (
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
            >
              Merge
            </button>
          </div>
        ) : null}

        <label className="workspace-backup-field">
          <span>Passphrase</span>
          <input
            className="component-input"
            type="password"
            value={passphrase}
            onChange={(event) => {
              setPassphrase(event.target.value)
              clearStatus()
            }}
            placeholder="At least 8 characters"
            autoComplete="new-password"
          />
        </label>

        {mode === 'export' ? (
          <label className="workspace-backup-field">
            <span>Confirm passphrase</span>
            <input
              className="component-input"
              type="password"
              value={confirmPassphrase}
              onChange={(event) => {
                setConfirmPassphrase(event.target.value)
                clearStatus()
              }}
              placeholder="Re-enter passphrase"
              autoComplete="new-password"
            />
          </label>
        ) : null}

        {mode === 'import' ? (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,text/plain"
              className="sr-only"
              onChange={handleFileUpload}
            />
            <button
              type="button"
              className="btn-secondary"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={16} />
              Upload Backup File
            </button>
          </>
        ) : null}

        <textarea
          value={bundleText}
          onChange={(event) => {
            setBundleText(event.target.value)
            clearStatus()
          }}
          readOnly={mode === 'export'}
          placeholder={
            mode === 'export'
              ? 'Encrypted backup JSON will appear here after export.'
              : 'Paste encrypted backup JSON here or upload a file.'
          }
          className="import-textarea"
          aria-label={mode === 'export' ? 'Encrypted backup output' : 'Encrypted backup input'}
        />

        {error ? <p className="error-text">{error}</p> : null}
        {success ? (
          <p className="warning-text workspace-backup-success">
            <ShieldCheck size={12} />
            {success}
          </p>
        ) : null}

        <div className="format-toggle">
          {mode === 'export' ? (
            <button
              type="button"
              className="btn-primary"
              onClick={handleCreateBackup}
              disabled={busy || !passphrase.trim() || !confirmPassphrase.trim()}
            >
              <Download size={16} />
              {busy ? 'Creating…' : 'Create Encrypted Backup'}
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary"
              onClick={handleImportBackup}
              disabled={busy || !passphrase.trim() || !bundleText.trim()}
            >
              <Upload size={16} />
              {busy ? 'Importing…' : `Import Backup (${importMode === 'merge' ? 'Merge' : 'Replace'})`}
            </button>
          )}
        </div>

        <p className="workspace-backup-note">
          Passphrases never leave this browser and are not stored in local persistence.
        </p>
      </div>
    </div>
  )
}
