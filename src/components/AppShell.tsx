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
  Home,
  X,
  ShieldCheck,
} from 'lucide-react'
import { useUiStore } from '../store/uiStore'
import { useCoverLetterStore } from '../store/coverLetterStore'
import { IDENTITY_STORE_STORAGE_KEY } from '../store/identityStore'
import { usePrepStore } from '../store/prepStore'
import { useSearchStore } from '../store/searchStore'
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
import { useIsAdmin } from '../hooks/useIsAdmin'
import { findStaleArtifacts } from '../types/artifactMeta'
import { FacetWordmark } from './FacetWordmark'
import { HostedWorkspaceDialog } from './HostedWorkspaceDialog'
import { PublicLandingPage } from '../routes/public/PublicLandingPage'
import { WorkspaceBackupDialog } from './WorkspaceBackupDialog'
import { WorkspaceBackupReminder } from './WorkspaceBackupReminder'

const CURRENT_YEAR = new Date().getFullYear()
const AI_ENABLED = Boolean(facetClientEnv.anthropicProxyUrl)
const AI_ROUTES: ReadonlySet<string> = new Set([
  '/identity',
  '/match',
  '/research',
  '/prep',
  '/letters',
  '/linkedin',
  '/debrief',
])
const HELP_ROUTE = '/help' as const
const HOME_ROUTE = '/' as const
const CROSS_TAB_IDENTITY_REVIEW_HREF = '/research?review=stale'
const CROSS_TAB_IDENTITY_TOAST_MS = 8000

const NAV_ITEMS = [
  {
    to: HOME_ROUTE,
    icon: Home,
    label: 'Overview',
    description: 'Monitor workspace readiness and jump into the next useful action.',
  },
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
    description:
      'Generate tailored resumes from your identity model, AI vector suggestions, and per-job pipeline context.',
  },
  {
    to: '/pipeline' as const,
    icon: ListChecks,
    label: 'Pipeline',
    description:
      'Track opportunities, investigate openings, and keep momentum across applications.',
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
  {
    to: '/admin' as const,
    icon: ShieldCheck,
    label: 'Admin',
    description: 'Inspect platform operations and hosted billing webhook receipts.',
  },
] as const

type NavRoute = (typeof NAV_ITEMS)[number]['to']
type NavGroup = {
  id: string
  label: string
  eyebrow: string
  hideLabel: boolean
  routes: readonly NavRoute[]
}

const NAV_GROUPS = [
  {
    id: 'overview',
    label: 'Overview',
    eyebrow: 'Workspace Overview',
    hideLabel: true,
    routes: [HOME_ROUTE] satisfies readonly NavRoute[],
  },
  {
    id: 'foundation',
    label: 'Foundation',
    eyebrow: 'Foundation Workspace',
    hideLabel: false,
    routes: ['/identity'] satisfies readonly NavRoute[],
  },
  {
    id: 'analyze',
    label: 'Analyze',
    eyebrow: 'Analyze Workspace',
    hideLabel: false,
    routes: ['/research', '/match'] satisfies readonly NavRoute[],
  },
  {
    id: 'apply',
    label: 'Apply',
    eyebrow: 'Apply Workspace',
    hideLabel: false,
    routes: ['/build', '/letters', '/linkedin', '/recruiter'] satisfies readonly NavRoute[],
  },
  {
    id: 'interview',
    label: 'Interview',
    eyebrow: 'Interview Workspace',
    hideLabel: false,
    routes: ['/pipeline', '/prep', '/debrief'] satisfies readonly NavRoute[],
  },
  {
    id: 'admin',
    label: 'Admin',
    eyebrow: 'Platform Admin',
    hideLabel: false,
    routes: ['/admin'] satisfies readonly NavRoute[],
  },
] as const satisfies readonly NavGroup[]

const isRouteActive = (currentPath: string, route: string) =>
  currentPath === route || currentPath.startsWith(`${route}/`)

type CrossTabIdentityToast = {
  id: number
  fromRevision: number
  toRevision: number
  staleArtifactCount: number
}

const parsePersistedIdentityRevision = (value: string | null): number | null => {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as {
      state?: { currentIdentity?: { model_revision?: unknown } | null }
      currentIdentity?: { model_revision?: unknown } | null
    }
    const revision =
      parsed.state?.currentIdentity?.model_revision ?? parsed.currentIdentity?.model_revision
    return typeof revision === 'number' && Number.isFinite(revision) ? revision : null
  } catch {
    return null
  }
}

const countStaleArtifactsForIdentityRevision = (identityRevision: number): number =>
  findStaleArtifacts(identityRevision, {
    theses: useSearchStore.getState().theses,
    runs: useSearchStore.getState().runs,
    prepDecks: usePrepStore.getState().decks,
    coverLetters: useCoverLetterStore.getState().templates,
  }).length

export function AppShell() {
  const { appearance, setAppearance } = useUiStore()
  const persistenceState = usePersistenceRuntimeStore()
  const hostedApp = useHostedAppStore()
  const isAdmin = useIsAdmin()
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname
  const isHelpRoute = isRouteActive(currentPath, HELP_ROUTE)
  const isHomeRoute = currentPath === HOME_ROUTE
  const visibleNavItems = useMemo(
    // Filter inputs are module constants, so this list is stable for the life of the app shell.
    () =>
      NAV_ITEMS.filter(
        ({ to }) => (AI_ENABLED || !AI_ROUTES.has(to)) && (to !== '/admin' || isAdmin),
      ),
    [isAdmin],
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
        eyebrow: 'Workspace Overview',
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
  const billingPass = hostedApp.context?.billingPass ?? null
  const hasPendingPass =
    billingPass?.status === 'paid' || billingPass?.history?.some((pass) => pass.status === 'paid')
  const accountDaysLeft = useMemo(() => {
    if (!entitlement?.effectiveThrough) return null
    const nowMs = new Date().getTime()
    return Math.max(
      0,
      Math.ceil((new Date(entitlement.effectiveThrough).getTime() - nowMs) / (1000 * 60 * 60 * 24)),
    )
  }, [entitlement])

  const accountLabel = useMemo(() => {
    if (hostedApp.deploymentMode !== 'hosted') return 'Account'
    if (!entitlement || entitlement.status === 'inactive') return 'Free'
    if (entitlement.status === 'paid') return 'Pro ready'
    if (entitlement.status === 'expired' && hasPendingPass) return 'Pro ready'
    if (entitlement.status === 'active' && accountDaysLeft !== null) {
      if (accountDaysLeft === 0) return hasPendingPass ? 'Pro ready' : 'Expired'
      if (hasPendingPass) return `Pro · ${accountDaysLeft}d + pass`
      if (accountDaysLeft <= 3) return `Pro · ${accountDaysLeft}d · Renew`
      if (accountDaysLeft <= 14) return `Pro · ${accountDaysLeft}d`
      return `Pro · ${accountDaysLeft}d`
    }
    if (entitlement.status === 'refunded') return 'Billing issue'
    if (entitlement.status === 'expired') return 'Expired'
    return 'Pro'
  }, [hostedApp.deploymentMode, entitlement, accountDaysLeft, hasPendingPass])

  const accountTone = useMemo(() => {
    if (hostedApp.deploymentMode !== 'hosted' || !entitlement) return ''
    if (entitlement.status === 'inactive') return ''
    if (hasPendingPass && entitlement.status !== 'refunded') return ''
    if (entitlement.status === 'expired' || entitlement.status === 'refunded') {
      return 'app-topbar-link-danger'
    }
    if (accountDaysLeft !== null && accountDaysLeft <= 3) return 'app-topbar-link-danger'
    if (accountDaysLeft !== null && accountDaysLeft <= 14) return 'app-topbar-link-warning'
    return ''
  }, [hostedApp.deploymentMode, entitlement, accountDaysLeft, hasPendingPass])

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
  const [crossTabIdentityToast, setCrossTabIdentityToast] = useState<CrossTabIdentityToast | null>(
    null,
  )
  const configuredHostedWorkspaceKeyRef = useRef<string | null>(null)
  const pendingMigrationRef = useRef<{
    workspaceId: string
    snapshot: FacetWorkspaceSnapshot
  } | null>(null)
  const appTopbarRef = useRef<HTMLElement | null>(null)

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

  // ── Publish topbar height as a CSS variable ───────────────
  // Layout regions like the Identity Map's inspector aside size themselves
  // against `100vh - var(--app-topbar-height)`. The topbar's height is
  // content-driven (brand lockup + nav cluster), so we measure it and
  // update the var on resize rather than hardcoding a value.
  useEffect(() => {
    const node = appTopbarRef.current
    if (!node) return
    const root = document.documentElement
    const publish = () => {
      root.style.setProperty('--app-topbar-height', `${node.offsetHeight}px`)
    }
    publish()
    const observer = new ResizeObserver(publish)
    observer.observe(node)
    return () => {
      observer.disconnect()
      root.style.removeProperty('--app-topbar-height')
    }
  }, [])

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== IDENTITY_STORE_STORAGE_KEY) return
      if (event.storageArea && event.storageArea !== globalThis.localStorage) return

      const fromRevision = parsePersistedIdentityRevision(event.oldValue)
      const toRevision = parsePersistedIdentityRevision(event.newValue)
      if (fromRevision === null || toRevision === null || toRevision <= fromRevision) {
        return
      }

      setCrossTabIdentityToast({
        id: Date.now(),
        fromRevision,
        toRevision,
        staleArtifactCount: countStaleArtifactsForIdentityRevision(toRevision),
      })
    }

    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  useEffect(() => {
    if (!crossTabIdentityToast) return
    const timeout = window.setTimeout(() => {
      setCrossTabIdentityToast((current) =>
        current?.id === crossTabIdentityToast.id ? null : current,
      )
    }, CROSS_TAB_IDENTITY_TOAST_MS)
    return () => window.clearTimeout(timeout)
  }, [crossTabIdentityToast])

  useEffect(() => {
    let cancelled = false

    const bootstrap = async () => {
      if (hostedApp.deploymentMode !== 'hosted') {
        void getPersistenceRuntime()
          .start()
          .catch((error) => {
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
    setAppearance(appearance === 'system' ? 'light' : appearance === 'light' ? 'dark' : 'system')

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
            <p>
              {hostedApp.lastError ?? 'Sign in to your hosted account to load your workspaces.'}
            </p>
            <div className="hosted-workspace-state-actions">
              <button
                className="btn-secondary"
                type="button"
                onClick={() => void signInWithGitHub()}
              >
                Sign in with GitHub
              </button>
              <button className="btn-ghost" type="button" onClick={handleSessionRefresh}>
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
              <button className="btn-secondary" type="button" onClick={handleHostedBootstrapRetry}>
                Retry Hosted Bootstrap
              </button>
              {isBillingStateError ? (
                <button className="btn-ghost" type="button" onClick={handleSessionRefresh}>
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
                <button className="btn-secondary" type="button" onClick={handleSessionRefresh}>
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
              <button className="btn-ghost" type="button" onClick={() => setBackupOpen(true)}>
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

  if (
    isHomeRoute &&
    hostedApp.deploymentMode === 'hosted' &&
    hostedApp.bootstrapStatus === 'auth-required'
  ) {
    return <PublicLandingPage />
  }

  return (
    <div className="app-root">
      <nav className="app-sidebar" aria-label="Main navigation">
        <div className="sidebar-nav">
          {visibleNavGroups.map((group) => {
            const groupItems = (
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
            )

            return (
              <section
                key={group.id}
                className={`sidebar-nav-group ${activeNavGroup?.id === group.id ? 'active' : ''}`}
                aria-label={group.hideLabel ? group.eyebrow : undefined}
                aria-labelledby={group.hideLabel ? undefined : `sidebar-nav-group-${group.id}`}
              >
                {group.hideLabel ? null : (
                  <p id={`sidebar-nav-group-${group.id}`} className="sidebar-nav-group-label">
                    {group.label}
                  </p>
                )}
                {groupItems}
              </section>
            )
          })}
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
        <header className="app-topbar" ref={appTopbarRef}>
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
                <span className="app-topbar-workspace-label">Workspace:</span>{' '}
                {displayedHostedWorkspace.name}
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
              <span>
                {appearance === 'system' ? 'System' : appearance === 'light' ? 'Light' : 'Dark'}
              </span>
            </button>
          </div>
        </header>
        <div className="app-main">{renderMainContent()}</div>

        <WorkspaceBackupReminder onOpenBackup={() => setBackupOpen(true)} />
        <footer className="app-footer">
          <span>&copy; {CURRENT_YEAR} Nicholas Crew Ferguson</span>
          <nav className="app-footer-links" aria-label="Footer links">
            <a href="https://github.com/atlas-crew/Facet" target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
            <a
              href="https://github.com/atlas-crew/Facet/issues"
              target="_blank"
              rel="noopener noreferrer"
            >
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
      {crossTabIdentityToast ? (
        <div
          className="toast info"
          role="status"
          aria-live="polite"
          title={`Identity changed from v${crossTabIdentityToast.fromRevision} to v${crossTabIdentityToast.toRevision}.`}
        >
          <span className="toast-message">
            Identity updated in another tab.{' '}
            {crossTabIdentityToast.staleArtifactCount === 1
              ? '1 artifact may need refresh.'
              : `${crossTabIdentityToast.staleArtifactCount} artifacts may need refresh.`}
          </span>
          <a className="toast-action" href={CROSS_TAB_IDENTITY_REVIEW_HREF}>
            Review
          </a>
          <button
            className="toast-dismiss"
            type="button"
            aria-label="Dismiss notification"
            onClick={() => setCrossTabIdentityToast(null)}
          >
            <X size={14} strokeWidth={1.75} />
          </button>
        </div>
      ) : null}
    </div>
  )
}
