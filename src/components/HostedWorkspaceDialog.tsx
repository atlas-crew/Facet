import { useMemo, useRef, useState } from 'react'
import { CloudUpload, FolderPlus, Pencil, RefreshCw, Trash2, X } from 'lucide-react'
import type { FacetEntitlement, FacetHostedWorkspaceSummary } from '../types/hosted'
import { useFocusTrap } from '../utils/useFocusTrap'

interface HostedWorkspaceDialogProps {
  open: boolean
  email: string | null
  entitlement: FacetEntitlement | null
  workspaces: FacetHostedWorkspaceSummary[]
  selectedWorkspaceId: string | null
  localMigrationAvailable: boolean
  mutationState: 'creating' | 'renaming' | 'deleting' | null
  lastError: string | null
  onClose: () => void
  onRefresh: () => Promise<void> | void
  onSelectWorkspace: (workspaceId: string) => void
  onCreateWorkspace: (input: { name?: string; importLocalSnapshot?: boolean }) => Promise<void> | void
  onRenameWorkspace: (workspaceId: string, name: string) => Promise<void> | void
  onDeleteWorkspace: (workspaceId: string) => Promise<void> | void
}

const planLabel = (entitlement: FacetEntitlement | null) => {
  if (!entitlement) {
    return 'Free plan'
  }

  return entitlement.planId === 'ai-pro' ? 'AI Pro' : 'Free plan'
}

export function HostedWorkspaceDialog({
  open,
  email,
  entitlement,
  workspaces,
  selectedWorkspaceId,
  localMigrationAvailable,
  mutationState,
  lastError,
  onClose,
  onRefresh,
  onSelectWorkspace,
  onCreateWorkspace,
  onRenameWorkspace,
  onDeleteWorkspace,
}: HostedWorkspaceDialogProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const [renameDrafts, setRenameDrafts] = useState<Record<string, string>>({})

  useFocusTrap(open, modalRef, onClose)

  const renameValues = useMemo(
    () =>
      Object.fromEntries(
        workspaces.map((workspace) => [
          workspace.workspaceId,
          renameDrafts[workspace.workspaceId] ?? workspace.name,
        ]),
      ),
    [renameDrafts, workspaces],
  )

  if (!open) {
    return null
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="hosted-workspaces-title">
      <div className="modal-card hosted-workspace-dialog" ref={modalRef} tabIndex={-1}>
        <header className="modal-header">
          <div>
            <h3 id="hosted-workspaces-title">Hosted Workspaces</h3>
            <p className="hosted-workspace-dialog-subtitle">
              {email ?? 'Hosted account'} · {planLabel(entitlement)}
            </p>
          </div>
          <button className="btn-ghost" type="button" onClick={onClose} aria-label="Close dialog">
            <X size={14} />
          </button>
        </header>

        <div className="hosted-workspace-toolbar">
          <button
            className="btn-secondary"
            type="button"
            onClick={() => {
              void Promise.resolve(onRefresh()).catch(() => undefined)
            }}
            disabled={mutationState !== null}
          >
            <RefreshCw size={15} />
            Refresh
          </button>
        </div>

        <section className="hosted-workspace-create">
          <label className="workspace-backup-field">
            <span>New workspace</span>
            <input
              className="component-input"
              value={newWorkspaceName}
              onChange={(event) => setNewWorkspaceName(event.target.value)}
              placeholder="Facet Workspace"
            />
          </label>
          <div className="hosted-workspace-create-actions">
            <button
              className="btn-secondary"
              type="button"
              onClick={() => {
                void Promise.resolve(
                  onCreateWorkspace({ name: newWorkspaceName }),
                ).catch(() => undefined)
              }}
              disabled={mutationState !== null}
            >
              <FolderPlus size={15} />
              Create Empty Workspace
            </button>
            {localMigrationAvailable ? (
              <button
                className="btn-secondary"
                type="button"
                onClick={() => {
                  void Promise.resolve(
                    onCreateWorkspace({
                      name: newWorkspaceName || 'Imported Workspace',
                      importLocalSnapshot: true,
                    }),
                  ).catch(() => undefined)
                }}
                disabled={mutationState !== null}
              >
                <CloudUpload size={15} />
                Create From Local Data
              </button>
            ) : null}
          </div>
        </section>

        {lastError ? (
          <p className="hosted-workspace-dialog-error" role="alert">
            {lastError}
          </p>
        ) : null}

        <section className="hosted-workspace-list" aria-label="Hosted workspace list">
          {workspaces.length === 0 ? (
            <div className="hosted-workspace-empty">
              <p>No hosted workspaces yet.</p>
              <p>Create an empty one or import your local workspace to start syncing.</p>
            </div>
          ) : (
            workspaces.map((workspace) => {
              const draftName = renameValues[workspace.workspaceId] ?? workspace.name
              const isSelected = workspace.workspaceId === selectedWorkspaceId

              return (
                <article
                  key={workspace.workspaceId}
                  className={`hosted-workspace-item ${isSelected ? 'selected' : ''}`}
                >
                  <div className="hosted-workspace-item-header">
                    <div>
                      <strong>{workspace.name}</strong>
                      <div className="hosted-workspace-meta">
                        <span>{workspace.workspaceId}</span>
                        {workspace.isDefault ? <span>Default</span> : null}
                        {isSelected ? <span>Current</span> : null}
                      </div>
                    </div>
                    <button
                      className="btn-secondary"
                      type="button"
                      onClick={() => onSelectWorkspace(workspace.workspaceId)}
                      disabled={mutationState !== null}
                    >
                      Open
                    </button>
                  </div>

                  <div className="hosted-workspace-item-controls">
                    <input
                      className="component-input compact"
                      value={draftName}
                      onChange={(event) =>
                        setRenameDrafts((current) => ({
                          ...current,
                          [workspace.workspaceId]: event.target.value,
                        }))
                      }
                      aria-label={`Rename ${workspace.name}`}
                    />
                    <button
                      className="btn-ghost"
                      type="button"
                      onClick={() => {
                        void Promise.resolve(
                          onRenameWorkspace(workspace.workspaceId, draftName),
                        ).catch(() => undefined)
                      }}
                      disabled={mutationState !== null}
                      aria-label={`Rename ${workspace.name}`}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      className="btn-ghost"
                      type="button"
                      onClick={() => {
                        void Promise.resolve(
                          onDeleteWorkspace(workspace.workspaceId),
                        ).catch(() => undefined)
                      }}
                      disabled={mutationState !== null || workspaces.length === 1}
                      aria-label={`Delete ${workspace.name}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </article>
              )
            })
          )}
        </section>
      </div>
    </div>
  )
}
