import { useEffect, useMemo, useRef, useState } from 'react'
import { Outlet, Link, useRouterState } from '@tanstack/react-router'
import {
  Cloud,
  HardDrive,
  Layers,
  ListChecks,
  Search,
  BookOpen,
  FileText,
  HelpCircle,
  Moon,
  Sun,
  Monitor,
} from 'lucide-react'
import { useUiStore } from '../store/uiStore'
import type { FacetWorkspaceSnapshot } from '../persistence'
import {
  captureLocalWorkspaceSnapshotForMigration,
  getPersistenceRuntime,
  replacePersistenceRuntime,
  usePersistenceRuntimeStore,
} from '../persistence/runtime'
import { createRemotePersistenceBackend } from '../persistence/remoteBackend'
import { useHostedAppStore } from '../store/hostedAppStore'
import { getHostedPersistenceEndpoint } from '../utils/hostedApi'
import { FacetGemMark } from './FacetWordmark'
import { HostedWorkspaceDialog } from './HostedWorkspaceDialog'
import { WorkspaceBackupDialog } from './WorkspaceBackupDialog'
import { WorkspaceBackupReminder } from './WorkspaceBackupReminder'

const CURRENT_YEAR = new Date().getFullYear()

const NAV_ITEMS = [
  { to: '/build' as const, icon: Layers, label: 'Build' },
  { to: '/pipeline' as const, icon: ListChecks, label: 'Pipeline' },
  { to: '/research' as const, icon: Search, label: 'Research' },
  { to: '/prep' as const, icon: BookOpen, label: 'Prep' },
  { to: '/letters' as const, icon: FileText, label: 'Letters' },
] as const

export function AppShell() {
  const { appearance, setAppearance } = useUiStore()
  const persistenceState = usePersistenceRuntimeStore()
  const hostedApp = useHostedAppStore()
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname
  const [backupOpen, setBackupOpen] = useState(false)
  const [workspaceDialogOpen, setWorkspaceDialogOpen] = useState(false)
  const [hostedRuntimePhase, setHostedRuntimePhase] = useState<
    'idle' | 'loading' | 'ready' | 'error'
  >('idle')
  const [hostedRuntimeError, setHostedRuntimeError] = useState<string | null>(null)
  const [activeHostedWorkspaceId, setActiveHostedWorkspaceId] = useState<string | null>(null)
  const [hostedRuntimeRetryToken, setHostedRuntimeRetryToken] = useState(0)
  const configuredHostedWorkspaceKeyRef = useRef<string | null>(null)
  const pendingMigrationRef = useRef<{
    workspaceId: string
    snapshot: FacetWorkspaceSnapshot
  } | null>(null)

  // ── Global appearance management ──────────────────────────
  useEffect(() => {
    const root = document.documentElement
    if (appearance === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const updateTheme = (event: MediaQueryListEvent | { matches: boolean }) => {
        root.setAttribute('data-theme', event.matches ? 'dark' : 'light')
      }
      updateTheme(mediaQuery)
      mediaQuery.addEventListener('change', updateTheme)
      return () => mediaQuery.removeEventListener('change', updateTheme)
    }
    root.setAttribute('data-theme', appearance)
  }, [appearance])

  useEffect(() => {
    let cancelled = false

    const bootstrap = async () => {
      if (hostedApp.deploymentMode !== 'hosted') {
        void getPersistenceRuntime().start().catch((error) => {
          console.error('[persistence-runtime]', error)
        })
        return
      }

      let migrationSnapshot: FacetWorkspaceSnapshot | null = null
      try {
        migrationSnapshot = await captureLocalWorkspaceSnapshotForMigration()
      } catch (error) {
        console.error('[hosted-bootstrap][local-migration]', error)
      }

      if (cancelled) {
        return
      }

      await useHostedAppStore.getState().bootstrap({
        localMigrationSnapshot: migrationSnapshot,
      })
    }

    void bootstrap().catch((error) => {
      console.error('[app-shell-bootstrap]', error)
    })

    return () => {
      cancelled = true
    }
  }, [hostedApp.deploymentMode])

  const selectedHostedWorkspace = useMemo(
    () =>
      hostedApp.workspaces.find(
        (workspace) => workspace.workspaceId === hostedApp.selectedWorkspaceId,
      ) ?? null,
    [hostedApp.selectedWorkspaceId, hostedApp.workspaces],
  )
  const activeHostedWorkspace = useMemo(
    () =>
      hostedApp.workspaces.find((workspace) => workspace.workspaceId === activeHostedWorkspaceId) ??
      null,
    [activeHostedWorkspaceId, hostedApp.workspaces],
  )
  const displayedHostedWorkspace =
    hostedRuntimePhase === 'ready' &&
    selectedHostedWorkspace?.workspaceId === activeHostedWorkspace?.workspaceId
      ? activeHostedWorkspace
      : null

  useEffect(() => {
    if (hostedApp.deploymentMode !== 'hosted') {
      configuredHostedWorkspaceKeyRef.current = null
      pendingMigrationRef.current = null
      return
    }

    if (
      hostedApp.bootstrapStatus !== 'ready' ||
      !hostedApp.bearerToken ||
      !selectedHostedWorkspace
    ) {
      configuredHostedWorkspaceKeyRef.current = null
      return
    }

    const workspaceKey = `${selectedHostedWorkspace.workspaceId}:${selectedHostedWorkspace.name}`
    if (configuredHostedWorkspaceKeyRef.current === workspaceKey) {
      return
    }

    let cancelled = false

    const startHostedRuntime = async () => {
      setHostedRuntimePhase('loading')
      setHostedRuntimeError(null)
      setActiveHostedWorkspaceId(null)
      useHostedAppStore.getState().clearError()

      const runtime = await replacePersistenceRuntime({
        workspaceId: selectedHostedWorkspace.workspaceId,
        workspaceName: selectedHostedWorkspace.name,
        backend: createRemotePersistenceBackend({
          endpoint: getHostedPersistenceEndpoint(),
          bearerToken: hostedApp.bearerToken ?? '',
        }),
      })
      if (cancelled) {
        runtime.dispose()
        return
      }

      await runtime.start()
      if (cancelled) {
        runtime.dispose()
        return
      }

      const pendingMigration = pendingMigrationRef.current
      if (
        pendingMigration &&
        pendingMigration.workspaceId === selectedHostedWorkspace.workspaceId
      ) {
        await runtime.importWorkspaceSnapshot(pendingMigration.snapshot, {
          mode: 'replace',
        })
        pendingMigrationRef.current = null
      }

      if (!cancelled) {
        configuredHostedWorkspaceKeyRef.current = workspaceKey
        setHostedRuntimePhase('ready')
        setHostedRuntimeError(null)
        setActiveHostedWorkspaceId(selectedHostedWorkspace.workspaceId)
        setWorkspaceDialogOpen(false)
      }
    }

    void startHostedRuntime().catch((error) => {
      const message =
        error instanceof Error ? error.message : 'Failed to start hosted workspace sync.'
      console.error('[hosted-runtime]', error)
      configuredHostedWorkspaceKeyRef.current = null
      useHostedAppStore.getState().reportError(message)
      if (!cancelled) {
        setHostedRuntimePhase('error')
        setHostedRuntimeError(message)
        setActiveHostedWorkspaceId(null)
      }
    })

    return () => {
      cancelled = true
    }
  }, [
    hostedApp.bearerToken,
    hostedApp.bootstrapStatus,
    hostedApp.deploymentMode,
    hostedRuntimeRetryToken,
    selectedHostedWorkspace,
  ])

  const cycleAppearance = () =>
    setAppearance(
      appearance === 'system' ? 'light' : appearance === 'light' ? 'dark' : 'system',
    )

  const handleCreateHostedWorkspace = async ({
    name,
    importLocalSnapshot = false,
  }: {
    name?: string
    importLocalSnapshot?: boolean
  }) => {
    const createdWorkspace = await useHostedAppStore.getState().createWorkspace({ name })
    if (importLocalSnapshot && hostedApp.localMigrationSnapshot) {
      pendingMigrationRef.current = {
        workspaceId: createdWorkspace.workspaceId,
        snapshot: hostedApp.localMigrationSnapshot,
      }
      return
    }
    setWorkspaceDialogOpen(false)
  }

  const handleRenameHostedWorkspace = async (workspaceId: string, name: string) => {
    await useHostedAppStore.getState().renameWorkspace(workspaceId, name)
  }

  const handleDeleteHostedWorkspace = async (workspaceId: string) => {
    await useHostedAppStore.getState().deleteWorkspace(workspaceId)
  }

  const handleSelectHostedWorkspace = (workspaceId: string) => {
    useHostedAppStore.getState().selectWorkspace(workspaceId)
    setWorkspaceDialogOpen(false)
  }

  const syncLabelByPhase: Partial<Record<typeof persistenceState.status.phase, string>> = {
    saving: 'Saving',
    saved: 'Saved',
    error: 'Sync error',
    offline: 'Offline',
  }
  const syncLabel =
    syncLabelByPhase[persistenceState.status.phase] ??
    (persistenceState.hydrated ? 'Ready' : 'Starting')

  const renderMainContent = () => {
    if (hostedApp.deploymentMode !== 'hosted') {
      return persistenceState.hydrated ? (
        <Outlet />
      ) : (
        <div role="status" aria-live="polite" className="hosted-workspace-state-card">
          Loading workspace...
        </div>
      )
    }

    if (hostedApp.bootstrapStatus === 'loading') {
      return (
        <div className="hosted-workspace-state-card" role="status" aria-live="polite">
          <Cloud size={20} />
          <div>
            <strong>Connecting your hosted account…</strong>
            <p>Loading account context, workspaces, and local migration state.</p>
          </div>
        </div>
      )
    }

    if (hostedApp.bootstrapStatus === 'auth-required') {
      return (
        <div className="hosted-workspace-state-card" role="status" aria-live="polite">
          <HardDrive size={20} />
          <div>
            <strong>Hosted sign-in required</strong>
            <p>{hostedApp.lastError ?? 'Sign in to your hosted account to load your workspaces.'}</p>
          </div>
        </div>
      )
    }

    if (hostedApp.bootstrapStatus === 'error') {
      return (
        <div className="hosted-workspace-state-card" role="alert">
          <HardDrive size={20} />
          <div>
            <strong>Hosted bootstrap failed</strong>
            <p>{hostedApp.lastError ?? 'We could not load your hosted account.'}</p>
            <button
              className="btn-secondary"
              type="button"
              onClick={() => void useHostedAppStore.getState().bootstrap({
                localMigrationSnapshot: hostedApp.localMigrationSnapshot,
              })}
            >
              Retry Hosted Bootstrap
            </button>
          </div>
        </div>
      )
    }

    if (!selectedHostedWorkspace) {
      return (
        <div className="hosted-workspace-state-card hosted-workspace-onboarding">
          <Cloud size={20} />
          <div>
            <strong>No hosted workspace selected</strong>
            <p>Create your first hosted workspace, or import your existing local workspace.</p>
            <div className="hosted-workspace-state-actions">
              <button
                className="btn-secondary"
                type="button"
                onClick={() => {
                  void handleCreateHostedWorkspace({}).catch(() => undefined)
                }}
                disabled={hostedApp.mutationState !== null}
              >
                Create Empty Workspace
              </button>
              {hostedApp.localMigrationSnapshot ? (
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={() => {
                    void handleCreateHostedWorkspace({
                      name: 'Imported Workspace',
                      importLocalSnapshot: true,
                    }).catch(() => undefined)
                  }}
                  disabled={hostedApp.mutationState !== null}
                >
                  Import Local Workspace
                </button>
              ) : null}
              <button
                className="btn-ghost"
                type="button"
                onClick={() => setWorkspaceDialogOpen(true)}
              >
                Manage Workspaces
              </button>
            </div>
          </div>
        </div>
      )
    }

    if (hostedRuntimePhase === 'error') {
      return (
        <div className="hosted-workspace-state-card" role="alert">
          <HardDrive size={20} />
          <div>
            <strong>Hosted workspace sync failed</strong>
            <p>{hostedRuntimeError ?? 'We could not load the selected hosted workspace.'}</p>
            <div className="hosted-workspace-state-actions">
              <button
                className="btn-secondary"
                type="button"
                onClick={() => setHostedRuntimeRetryToken((current) => current + 1)}
              >
                Retry Hosted Workspace
              </button>
              <button
                className="btn-ghost"
                type="button"
                onClick={() => setWorkspaceDialogOpen(true)}
              >
                Manage Workspaces
              </button>
            </div>
          </div>
        </div>
      )
    }

    return hostedRuntimePhase === 'ready' && persistenceState.hydrated ? (
      <Outlet />
    ) : (
      <div className="hosted-workspace-state-card" role="status" aria-live="polite">
        Loading hosted workspace…
      </div>
    )
  }

  return (
    <div className="app-root">
      <nav className="app-sidebar" aria-label="Main navigation">
        <div className="sidebar-top">
          <Link to="/build" className="sidebar-brand" aria-label="Facet home">
            <FacetGemMark size={22} />
          </Link>
        </div>

        <div className="sidebar-nav">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <Link
              key={to}
              to={to}
              className={`sidebar-nav-item ${currentPath.startsWith(to) ? 'active' : ''}`}
              title={label}
            >
              <Icon size={20} strokeWidth={1.5} />
              <span className="sidebar-nav-label">{label}</span>
            </Link>
          ))}
        </div>

        <div className="sidebar-bottom">
          {hostedApp.deploymentMode === 'hosted' ? (
            <button
              className="sidebar-nav-item"
              type="button"
              onClick={() => setWorkspaceDialogOpen(true)}
              aria-label="Hosted workspaces"
              title="Hosted workspaces"
            >
              <HardDrive size={18} strokeWidth={1.5} />
            </button>
          ) : null}
          <Link
            to="/help"
            className={`sidebar-nav-item ${currentPath.startsWith('/help') ? 'active' : ''}`}
            title="Help"
          >
            <HelpCircle size={18} strokeWidth={1.5} />
          </Link>
          <button
            className="sidebar-nav-item"
            type="button"
            onClick={cycleAppearance}
            aria-label={`Theme: ${appearance}`}
            title={`Theme: ${appearance}`}
          >
            {appearance === 'dark' ? (
              <Moon size={18} strokeWidth={1.5} />
            ) : appearance === 'light' ? (
              <Sun size={18} strokeWidth={1.5} />
            ) : (
              <Monitor size={18} strokeWidth={1.5} />
            )}
          </button>
        </div>
      </nav>

      <div className="app-content-column">
        <div className="app-main">{renderMainContent()}</div>

        <WorkspaceBackupReminder onOpenBackup={() => setBackupOpen(true)} />
        <footer className="app-footer">
          <span>&copy; {CURRENT_YEAR} Nicholas Crew Ferguson</span>
          {displayedHostedWorkspace ? (
            <span title={displayedHostedWorkspace.workspaceId}>
              Workspace: {displayedHostedWorkspace.name}
            </span>
          ) : null}
          <span
            role="status"
            aria-live="polite"
            title={persistenceState.status.lastSavedAt ?? undefined}
          >
            Sync: {syncLabel}
          </span>
          <nav className="app-footer-links" aria-label="Footer links">
            {hostedApp.deploymentMode === 'hosted' ? (
              <button
                type="button"
                className="app-footer-link-button"
                onClick={() => setWorkspaceDialogOpen(true)}
              >
                Workspaces
              </button>
            ) : null}
            <button type="button" className="app-footer-link-button" onClick={() => setBackupOpen(true)}>
              Backup
            </button>
            <Link to="/help">Docs</Link>
            <a href="https://github.com/NickCrew/Facet" target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
            <a href="https://github.com/NickCrew/Facet/issues" target="_blank" rel="noopener noreferrer">
              Report an Issue
            </a>
          </nav>
        </footer>
      </div>

      <HostedWorkspaceDialog
        open={workspaceDialogOpen}
        email={hostedApp.context?.actor.email ?? null}
        entitlement={hostedApp.context?.entitlement ?? null}
        workspaces={hostedApp.workspaces}
        selectedWorkspaceId={hostedApp.selectedWorkspaceId}
        localMigrationAvailable={hostedApp.localMigrationSnapshot !== null}
        mutationState={hostedApp.mutationState}
        lastError={hostedApp.lastError}
        onClose={() => setWorkspaceDialogOpen(false)}
        onRefresh={() => useHostedAppStore.getState().refresh()}
        onSelectWorkspace={handleSelectHostedWorkspace}
        onCreateWorkspace={handleCreateHostedWorkspace}
        onRenameWorkspace={handleRenameHostedWorkspace}
        onDeleteWorkspace={handleDeleteHostedWorkspace}
      />
      <WorkspaceBackupDialog open={backupOpen} onClose={() => setBackupOpen(false)} />
    </div>
  )
}
