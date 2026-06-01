import { useEffect, useRef, useState } from 'react'
import { HardDrive, RefreshCw, Sparkles, Trash2, X } from 'lucide-react'
import type { PersistenceStatus } from '../persistence'
import { useFocusTrap } from '../utils/useFocusTrap'

interface LocalWorkspaceDialogProps {
  open: boolean
  status: PersistenceStatus
  onClose: () => void
  onSaveNow: () => Promise<void> | void
  onClearWorkspace?: () => Promise<void> | void
  onLoadDemoWorkspace?: () => Promise<{ identityName: string; workspaceName: string }>
}

const formatSavedAt = (value: string | null): string =>
  value ? new Date(value).toLocaleString() : 'Not saved yet'

export function LocalWorkspaceDialog({
  open,
  status,
  onClose,
  onSaveNow,
  onClearWorkspace,
  onLoadDemoWorkspace,
}: LocalWorkspaceDialogProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const [busyAction, setBusyAction] = useState<'saving' | 'demo' | 'clearing' | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const canLoadDemoWorkspace = import.meta.env.DEV && Boolean(onLoadDemoWorkspace)

  useFocusTrap(open, modalRef, onClose)

  useEffect(() => {
    if (!open) {
      return
    }
    setBusyAction(null)
    setMessage(null)
    setError(null)
  }, [open])

  if (!open) {
    return null
  }

  const runAction = async (
    action: 'saving' | 'demo' | 'clearing',
    task: () => Promise<void> | void,
  ) => {
    setBusyAction(action)
    setMessage(null)
    setError(null)
    try {
      await task()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Workspace action failed.')
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="local-workspace-title"
    >
      <div className="modal-card hosted-workspace-dialog" ref={modalRef} tabIndex={-1}>
        <header className="modal-header">
          <div>
            <h3 id="local-workspace-title">Workspace Controls</h3>
            <p className="hosted-workspace-dialog-subtitle">Local browser workspace</p>
          </div>
          <button className="btn-ghost" type="button" onClick={onClose} aria-label="Close dialog">
            <X size={14} />
          </button>
        </header>

        <section className="workspace-dialog-section">
          <div className="local-workspace-status">
            <HardDrive size={18} aria-hidden="true" />
            <div>
              <strong>{status.activeWorkspaceId}</strong>
              <p>
                Saves automatically in this browser. Last saved: {formatSavedAt(status.lastSavedAt)}
                .
              </p>
              {status.lastError ? <p role="alert">{status.lastError}</p> : null}
            </div>
          </div>
          <div className="hosted-workspace-create-actions">
            <button
              className="btn-secondary"
              type="button"
              onClick={() =>
                busyAction === null
                  ? void runAction('saving', async () => {
                      await onSaveNow()
                      setMessage('Workspace saved.')
                    })
                  : undefined
              }
              aria-disabled={busyAction !== null}
            >
              <RefreshCw size={15} />
              {busyAction === 'saving' ? 'Saving...' : 'Save Now'}
            </button>
            {canLoadDemoWorkspace ? (
              <button
                className="btn-secondary"
                type="button"
                onClick={() =>
                  busyAction === null
                    ? void runAction('demo', async () => {
                        if (!onLoadDemoWorkspace) {
                          return
                        }
                        const result = await onLoadDemoWorkspace()
                        setMessage(`Loaded ${result.identityName}'s demo workspace.`)
                      })
                    : undefined
                }
                aria-disabled={busyAction !== null}
              >
                <Sparkles size={15} />
                {busyAction === 'demo' ? 'Loading...' : 'Load Demo Workspace'}
              </button>
            ) : null}
          </div>
        </section>

        {onClearWorkspace ? (
          <section className="workspace-dialog-section workspace-danger-zone">
            <div>
              <h4>Clear workspace data</h4>
              <p>
                Removes resumes, pipeline entries, research, prep, letters, LinkedIn drafts,
                recruiter cards, debriefs, and the current job match. Your identity stays loaded.
              </p>
            </div>
            <button
              className="btn-danger-soft"
              type="button"
              onClick={() => {
                if (busyAction !== null) {
                  return
                }
                const confirmed = window.confirm(
                  'Clear this workspace? This removes workspace artifacts but keeps your identity.',
                )
                if (!confirmed) {
                  return
                }
                void runAction('clearing', async () => {
                  await onClearWorkspace()
                  setMessage('Workspace data cleared.')
                })
              }}
              disabled={busyAction !== null}
            >
              <Trash2 size={15} />
              {busyAction === 'clearing' ? 'Clearing...' : 'Clear Workspace'}
            </button>
          </section>
        ) : null}

        <p
          className={`hosted-workspace-dialog-success workspace-dialog-feedback ${message ? '' : 'is-empty'}`}
          role="status"
        >
          {message}
        </p>
        <p
          className={`hosted-workspace-dialog-error workspace-dialog-feedback ${error ? '' : 'is-empty'}`}
          role="alert"
        >
          {error}
        </p>
      </div>
    </div>
  )
}
