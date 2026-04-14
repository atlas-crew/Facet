import { useEffect, useMemo, useRef, useState } from 'react'
import { Outlet, Link, useRouterState } from '@tanstack/react-router'
import {
  Cloud,
  HardDrive,
  Layers,
  Fingerprint,
  Target,
  ListChecks,
  Search,
  BookOpen,
  FileText,
  AtSign,
  BadgeCheck,
  MessageSquareQuote,
  HelpCircle,
  CircleUserRound,
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
import { isFacetApiError } from '../utils/facetApiErrors'
import { facetClientEnv } from '../utils/facetEnv'
import { getHostedPersistenceEndpoint } from '../utils/hostedApi'
import { reloadPage } from '../utils/windowLocation'
import { signInWithGitHub } from '../utils/hostedSession'
import { FacetWordmark } from './FacetWordmark'
import { HostedWorkspaceDialog } from './HostedWorkspaceDialog'
import { WorkspaceBackupDialog } from './WorkspaceBackupDialog'
import { WorkspaceBackupReminder } from './WorkspaceBackupReminder'

const CURRENT_YEAR = new Date().getFullYear()
const AI_ENABLED = Boolean(facetClientEnv.anthropicProxyUrl)
const AI_ROUTES: ReadonlySet<string> = new Set([
  '/identity', '/match', '/research', '/prep', '/letters', '/linkedin', '/debrief',
])
const HELP_ROUTE = '/help' as const
const HOME_ROUTE = '/' as const

const NAV_ITEMS = [
  {
    to: '/identity' as const,
    icon: Fingerprint,
    label: 'Identity',
    description: 'Shape your professional identity, evidence, and search strategy.',
  },
  {
    to: '/research' as const,
    icon: Search,
    label: 'Research',
    description: 'Turn your identity into targeted searches and pipeline-ready opportunities.',
  },
  {
    to: '/match' as const,
    icon: Target,
    label: 'Match',
    description: 'Compare your profile to a role and analyze alignment before you tailor.',
  },
  {
    to: '/build' as const,
    icon: Layers,
    label: 'Build',
    description: 'Assemble and export tailored resumes from your identity and strategy.',
  },
  {
    to: '/pipeline' as const,
    icon: ListChecks,
    label: 'Pipeline',
    description: 'Track opportunities, investigate openings, and keep momentum across applications.',
  },
  {
    to: '/prep' as const,
    icon: BookOpen,
    label: 'Prep',
    description: 'Prepare for interviews with company context, likely questions, and story drills.',
  },
  {
    to: '/debrief' as const,
    icon: MessageSquareQuote,
    label: 'Debrief',
    description: 'Capture interview outcomes and feed learnings back into your identity.',
  },
  {
    to: '/letters' as const,
    icon: FileText,
    label: 'Letters',
    description: 'Draft role-specific outreach and cover letters from your current materials.',
  },
  {
    to: '/linkedin' as const,
    icon: AtSign,
    label: 'LinkedIn',
    description: 'Turn your identity into polished LinkedIn-ready profile language.',
  },
  {
    to: '/recruiter' as const,
    icon: BadgeCheck,
    label: 'Recruiter',
    description: 'Generate a concise recruiter-facing brief from your current match context.',
  },
] as const

type NavRoute = (typeof NAV_ITEMS)[number]['to']

const NAV_GROUPS = [
  {
    id: 'core',
    label: 'Core',
    eyebrow: 'Core Workspace',
    routes: ['/identity', '/research', '/match', '/build'] satisfies readonly NavRoute[],
  },
  {
    id: 'execution',
    label: 'Execution',
    eyebrow: 'Execution Workspace',
    routes: ['/pipeline', '/prep', '/debrief'] satisfies readonly NavRoute[],
  },
  {
    id: 'output',
    label: 'Output',
    eyebrow: 'Output Workspace',
    routes: ['/letters', '/linkedin', '/recruiter'] satisfies readonly NavRoute[],
  },
] as const

const isRouteActive = (currentPath: string, route: string) =>
  currentPath === route || currentPath.startsWith(`${route}/`)

export function AppShell() {
  const { appearance, setAppearance } = useUiStore()
  const persistenceState = usePersistenceRuntimeStore()
  const hostedApp = useHostedAppStore()
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname
  const isHelpRoute = isRouteActive(currentPath, HELP_ROUTE)
  const isHomeRoute = currentPath === HOME_ROUTE
  const visibleNavItems = useMemo(
    // Filter inputs are module constants, so this list is stable for the life of the app shell.
    () => NAV_ITEMS.filter(({ to }) => AI_ENABLED || !AI_ROUTES.has(to)),
    [],
  )
  const visibleNavGroups = useMemo(
    () =>
      NAV_GROUPS.map((group) => ({
        ...group,
        items: group.routes
          .map((route) => visibleNavItems.find((item) => item.to === route))
          .filter((item): item is (typeof NAV_ITEMS)[number] => Boolean(item)),
      })).filter((group) => group.items.length > 0),
    [visibleNavItems],
  )
  const activeNavItem = useMemo(
    () => visibleNavItems.find(({ to }) => isRouteActive(currentPath, to)) ?? null,
    [currentPath, visibleNavItems],
  )
  const activeNavGroup = useMemo(
    () =>
      visibleNavGroups.find((group) =>
        group.items.some((item) => isRouteActive(currentPath, item.to)),
      ) ?? null,
    [currentPath, visibleNavGroups],
  )
  const routeContext = useMemo(() => {
    if (isHomeRoute) {
      return {
        title: 'Overview',
        eyebrow: 'Workspace Hub',
        description: 'Jump into the next step of your search system and monitor overall readiness.',
      }
    }

    if (activeNavItem) {
      return {
        title: activeNavItem.label,
        eyebrow: activeNavGroup?.eyebrow ?? 'Workspace',
        description: activeNavItem.description,
      }
    }

    if (isHelpRoute) {
      return {
        title: 'Help',
        eyebrow: 'Utility Workspace',
        description: 'Find product guidance, troubleshooting notes, and usage details.',
      }
    }

    if (isRouteActive(currentPath, '/account')) {
      return {
        title: 'Account',
        eyebrow: 'Utility Workspace',
        description: 'Manage hosted access, billing state, and account-level settings.',
      }
    }

    return {
      title: 'Facet',
      eyebrow: 'Workspace',
      description: 'Move through the core search workflow and supporting tools.',
    }
  }, [activeNavGroup, activeNavItem, currentPath, isHelpRoute, isHomeRoute])

  const entitlement = hostedApp.context?.entitlement ?? null
  const accountDaysLeft = useMemo(() => {
    if (!entitlement?.effectiveThrough) return null
    const nowMs = new Date().getTime()
    return Math.max(0, Math.ceil(
      (new Date(entitlement.effectiveThrough).getTime() - nowMs) / (1000 * 60 * 60 * 24),
    ))
  }, [entitlement])

  const accountLabel = useMemo(() => {
    if (hostedApp.deploymentMode !== 'hosted') return 'Account'
    if (!entitlement || entitlement.status === 'inactive') return 'Free'
    if (entitlement.status === 'active' && accountDaysLeft !== null) {
      if (accountDaysLeft === 0) return 'Expired'
      if (accountDaysLeft <= 3) return `Pro · ${accountDaysLeft}d · Renew`
      if (accountDaysLeft <= 14) return `Pro · ${accountDaysLeft}d`
      return `Pro · ${accountDaysLeft}d`
    }
    if (entitlement.status === 'delinquent') return 'Billing issue'
    if (entitlement.status === 'grace') return 'Grace'
    if (entitlement.status === 'trial') return 'Trial'
    return 'Pro'
  }, [hostedApp.deploymentMode, entitlement, accountDaysLeft])

  const accountTone = useMemo(() => {
    if (hostedApp.deploymentMode !== 'hosted' || !entitlement) return ''
    if (entitlement.status === 'inactive') return ''
    if (entitlement.status === 'delinquent') return 'app-topbar-link-danger'
    if (accountDaysLeft !== null && accountDaysLeft <= 3) return 'app-topbar-link-danger'
    if (accountDaysLeft !== null && accountDaysLeft <= 14) return 'app-topbar-link-warning'
    return ''
  }, [hostedApp.deploymentMode, entitlement, accountDaysLeft])

  const [backupOpen, setBackupOpen] = useState(false)
  const [workspaceDialogOpen, setWorkspaceDialogOpen] = useState(false)
  const [hostedRuntimePhase, setHostedRuntimePhase] = useState<
    'idle' | 'loading' | 'ready' | 'error'
  >('idle')
  const [hostedRuntimeError, setHostedRuntimeError] = useState<string | null>(null)
  const [hostedRuntimeErrorCode, setHostedRuntimeErrorCode] = useState<string | null>(null)
  const [hostedRuntimeErrorReason, setHostedRuntimeErrorReason] = useState<string | null>(null)
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
      setHostedRuntimeErrorCode(null)
      setHostedRuntimeErrorReason(null)
      setActiveHostedWorkspaceId(null)
      useHostedAppStore.getState().clearError()

      const runtime = await replacePersistenceRuntime({
        workspaceId: selectedHostedWorkspace.workspaceId,
        workspaceName: selectedHostedWorkspace.name,
        backend: createRemotePersistenceBackend({
          authMode: 'hosted',
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
        setHostedRuntimeErrorCode(null)
        setHostedRuntimeErrorReason(null)
        setActiveHostedWorkspaceId(selectedHostedWorkspace.workspaceId)
        setWorkspaceDialogOpen(false)
      }
    }

    void startHostedRuntime().catch((error) => {
      const message =
        error instanceof Error ? error.message : 'Failed to start hosted workspace sync.'
      const errorCode = isFacetApiError(error) ? error.code : null
      const errorReason = isFacetApiError(error) ? error.reason : null
      console.error('[hosted-runtime]', error)
      configuredHostedWorkspaceKeyRef.current = null
      useHostedAppStore.getState().reportError(message, errorCode, errorReason)
      if (!cancelled) {
        setHostedRuntimePhase('error')
        setHostedRuntimeError(message)
        setHostedRuntimeErrorCode(errorCode)
        setHostedRuntimeErrorReason(errorReason)
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

  const handleHostedBootstrapRetry = () =>
    void useHostedAppStore.getState().bootstrap({
      localMigrationSnapshot: hostedApp.localMigrationSnapshot,
    })

  const handleSessionRefresh = () => {
    reloadPage()
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
  const syncTone =
    persistenceState.status.phase === 'error'
      ? 'error'
      : persistenceState.status.phase === 'offline'
        ? 'offline'
        : persistenceState.status.phase === 'saving'
          ? 'saving'
          : 'ready'

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
            <div className="hosted-workspace-state-actions">
              <button
                className="btn-secondary"
                type="button"
                onClick={() => void signInWithGitHub()}
              >
                Sign in with GitHub
              </button>
              <button
                className="btn-ghost"
                type="button"
                onClick={handleSessionRefresh}
              >
                Refresh Session
              </button>
            </div>
          </div>
        </div>
      )
    }

    if (hostedApp.bootstrapStatus === 'error') {
      const isBillingStateError = hostedApp.lastErrorCode === 'billing_state_error'
      const isBillingIssue = hostedApp.lastErrorReason === 'billing_issue'
      const isUpgradeRequired = hostedApp.lastErrorReason === 'upgrade_required'
      const isOffline = hostedApp.lastErrorCode === 'offline'
      return (
        <div className="hosted-workspace-state-card" role="alert">
          <HardDrive size={20} />
          <div>
            <strong>
              {isBillingStateError
                ? 'Hosted billing state unavailable'
                : isBillingIssue
                  ? 'Hosted billing issue'
                  : isUpgradeRequired
                    ? 'Hosted upgrade required'
                : isOffline
                  ? 'You appear to be offline'
                  : 'Hosted bootstrap failed'}
            </strong>
            <p>{hostedApp.lastError ?? 'We could not load your hosted account.'}</p>
            <div className="hosted-workspace-state-actions">
              <button
                className="btn-secondary"
                type="button"
                onClick={handleHostedBootstrapRetry}
              >
                Retry Hosted Bootstrap
              </button>
              {isBillingStateError ? (
                <button
                  className="btn-ghost"
                  type="button"
                  onClick={handleSessionRefresh}
                >
                  Refresh Billing State
                </button>
              ) : null}
            </div>
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
            {hostedApp.lastError ? <p role="alert">{hostedApp.lastError}</p> : null}
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
      const isAuthError = hostedRuntimeErrorCode === 'auth_required'
      const isBillingStateError = hostedRuntimeErrorCode === 'billing_state_error'
      const isBillingIssue = hostedRuntimeErrorReason === 'billing_issue'
      const isUpgradeRequired = hostedRuntimeErrorReason === 'upgrade_required'
      const isOffline = hostedRuntimeErrorCode === 'offline'
      return (
        <div className="hosted-workspace-state-card" role="alert">
          <HardDrive size={20} />
          <div>
            <strong>
              {isAuthError
                ? 'Hosted session expired'
                : isBillingStateError
                  ? 'Hosted billing state unavailable'
                  : isBillingIssue
                    ? 'Hosted billing issue'
                    : isUpgradeRequired
                      ? 'Hosted upgrade required'
                : isOffline
                  ? 'Hosted sync is offline'
                  : 'Hosted workspace sync failed'}
            </strong>
            <p>{hostedRuntimeError ?? 'We could not load the selected hosted workspace.'}</p>
            <div className="hosted-workspace-state-actions">
              {isAuthError ? (
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={handleSessionRefresh}
                >
                  Refresh Session
                </button>
              ) : (
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={() => setHostedRuntimeRetryToken((current) => current + 1)}
                >
                  Retry Hosted Workspace
                </button>
              )}
              <button
                className="btn-ghost"
                type="button"
                onClick={() => setBackupOpen(true)}
              >
                Backup Workspace
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
        <div className="sidebar-nav">
          {visibleNavGroups.map((group) => (
            <section
              key={group.id}
              className={`sidebar-nav-group ${activeNavGroup?.id === group.id ? 'active' : ''}`}
              aria-labelledby={`sidebar-nav-group-${group.id}`}
            >
              <p id={`sidebar-nav-group-${group.id}`} className="sidebar-nav-group-label">
                {group.label}
              </p>
              <div className="sidebar-nav-group-items">
                {group.items.map(({ to, icon: Icon, label }) => (
                  <Link
                    key={to}
                    to={to}
                    className={`sidebar-nav-item ${isRouteActive(currentPath, to) ? 'active' : ''}`}
                    title={label}
                  >
                    <Icon size={20} strokeWidth={1.5} />
                    <span className="sidebar-nav-label">{label}</span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="sidebar-bottom">
          {hostedApp.deploymentMode === 'hosted' ? (
            <button
              className="sidebar-nav-item"
              type="button"
              onClick={() => setWorkspaceDialogOpen(true)}
              aria-label="Hosted workspaces"
              title="Workspaces"
            >
              <HardDrive size={18} strokeWidth={1.5} />
              <span className="sidebar-nav-label">Workspaces</span>
            </button>
          ) : null}
          <button
            className="sidebar-nav-item"
            type="button"
            onClick={() => setBackupOpen(true)}
            aria-label="Backup workspace"
            title="Backup"
          >
            <Cloud size={18} strokeWidth={1.5} />
            <span className="sidebar-nav-label">Backup</span>
          </button>
          <Link
            to="/help"
            className={`sidebar-nav-item ${isHelpRoute ? 'active' : ''}`}
            title="Help"
          >
            <HelpCircle size={18} strokeWidth={1.5} />
            <span className="sidebar-nav-label">Help</span>
          </Link>
        </div>
      </nav>

      <div className="app-content-column">
        <header className="app-topbar">
          <div className="app-topbar-start">
            <Link to={HOME_ROUTE} className="app-topbar-brand" aria-label="Facet home">
              <FacetWordmark />
            </Link>
            <div className="app-topbar-divider" aria-hidden="true" />
            <div className="app-topbar-copy">
              <p className="app-topbar-eyebrow">{routeContext.eyebrow}</p>
              <h1 className="app-topbar-title">{routeContext.title}</h1>
              <p className="app-topbar-description">{routeContext.description}</p>
            </div>
          </div>
          <div className="app-topbar-actions">
            {displayedHostedWorkspace ? (
              <span className="app-topbar-workspace" title={displayedHostedWorkspace.workspaceId}>
                <span className="app-topbar-workspace-label">Workspace:</span> {displayedHostedWorkspace.name}
              </span>
            ) : null}
            <div
              className={`app-topbar-sync app-topbar-sync-${syncTone}`}
              role="status"
              aria-live="polite"
              title={persistenceState.status.lastSavedAt ?? undefined}
            >
              <span className="app-topbar-sync-dot" aria-hidden="true" />
              <span className="app-topbar-sync-label">{syncLabel}</span>
            </div>
            <Link
              to={HELP_ROUTE}
              className={`app-topbar-icon-link ${isHelpRoute ? 'active' : ''}`}
              aria-label="Help and docs"
              title="Help and docs"
            >
              <HelpCircle size={16} strokeWidth={1.75} />
            </Link>
            <Link
              to="/account"
              className={`app-topbar-link ${accountTone} ${isRouteActive(currentPath, '/account') ? 'active' : ''}`}
              aria-label="Account"
              title="Account and AI access"
            >
              <CircleUserRound size={16} strokeWidth={1.75} />
              <span>{accountLabel}</span>
            </Link>
            <button
              className="app-topbar-theme-toggle"
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
              <span>{appearance === 'system' ? 'System' : appearance === 'light' ? 'Light' : 'Dark'}</span>
            </button>
          </div>
        </header>
        <div className="app-main">{renderMainContent()}</div>

        <WorkspaceBackupReminder onOpenBackup={() => setBackupOpen(true)} />
        <footer className="app-footer">
          <span>&copy; {CURRENT_YEAR} Nicholas Crew Ferguson</span>
          <nav className="app-footer-links" aria-label="Footer links">
            <a href="https://github.com/NickCrew/Facet" target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
            <a href="https://github.com/NickCrew/Facet/issues" target="_blank" rel="noopener noreferrer">
              Report an Issue
            </a>
            <Link to="/terms">Terms</Link>
            <Link to="/privacy">Privacy</Link>
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
