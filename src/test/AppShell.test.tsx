// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { AppShell } from '../components/AppShell'
import { usePersistenceRuntimeStore } from '../persistence/runtime'
import { IDENTITY_STORE_STORAGE_KEY } from '../store/identityStore'
import { useCoverLetterStore } from '../store/coverLetterStore'
import { useHostedAppStore } from '../store/hostedAppStore'
import { usePrepStore } from '../store/prepStore'
import { useSearchStore } from '../store/searchStore'
import { useUiStore } from '../store/uiStore'
import type { SearchThesis } from '../types/search'
import { FacetApiError } from '../utils/facetApiErrors'
import { cloneIdentityFixture } from './fixtures/identityFixture'
import { buildWorkspaceSnapshot } from './fixtures/workspaceSnapshot'

const routerMocks = vi.hoisted(() => ({
  currentPath: '/build',
}))

const runtimeMocks = vi.hoisted(() => ({
  captureLocalWorkspaceSnapshotForMigration: vi.fn(),
  getPersistenceRuntimeStart: vi.fn(),
  replacePersistenceRuntime: vi.fn(),
}))

const remoteBackendMocks = vi.hoisted(() => ({
  createRemotePersistenceBackend: vi.fn(() => ({ kind: 'remote' })),
}))

const locationMocks = vi.hoisted(() => ({
  reloadPage: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  Outlet: () => <div data-testid="app-shell-outlet">Hosted Editor</div>,
  useRouterState: () => ({
    location: {
      pathname: routerMocks.currentPath,
    },
  }),
}))

vi.mock('../persistence/runtime', async () => {
  const actual =
    await vi.importActual<typeof import('../persistence/runtime')>('../persistence/runtime')

  return {
    ...actual,
    captureLocalWorkspaceSnapshotForMigration:
      runtimeMocks.captureLocalWorkspaceSnapshotForMigration,
    getPersistenceRuntime: () => ({
      start: runtimeMocks.getPersistenceRuntimeStart,
    }),
    replacePersistenceRuntime: runtimeMocks.replacePersistenceRuntime,
  }
})

vi.mock('../persistence/remoteBackend', () => remoteBackendMocks)
vi.mock('../utils/windowLocation', () => locationMocks)
vi.mock('../utils/hostedApi', async () => {
  const actual = await vi.importActual<typeof import('../utils/hostedApi')>('../utils/hostedApi')

  return {
    ...actual,
    getHostedPersistenceEndpoint: () => 'https://facet.example/api/persistence',
  }
})
vi.mock('../components/FacetWordmark', () => ({
  FacetWordmark: () => <span>Facet</span>,
}))
vi.mock('../components/WorkspaceBackupReminder', () => ({
  WorkspaceBackupReminder: () => null,
}))
vi.mock('../components/WorkspaceBackupDialog', () => ({
  WorkspaceBackupDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="workspace-backup-dialog">Backup Dialog</div> : null,
}))

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as typeof globalThis.ResizeObserver
}

const hostedContext = {
  deploymentMode: 'hosted' as const,
  account: {
    tenantId: 'tenant-1',
    accountId: 'account-1',
    deploymentMode: 'hosted' as const,
    defaultWorkspaceId: 'ws-1',
  },
  actor: {
    userId: 'user-1',
    tenantId: 'tenant-1',
    email: 'member@example.com',
  },
  memberships: [],
  billingCustomer: null,
  billingPass: null,
  entitlement: null,
}

const baseWorkspace = {
  workspaceId: 'ws-1',
  name: 'Hosted Workspace',
  revision: 1,
  updatedAt: '2026-03-14T12:00:00.000Z',
  role: 'owner' as const,
  isDefault: true,
}

const buildShellThesis = (overrides: Partial<SearchThesis> = {}): SearchThesis => ({
  id: 'thesis-stale',
  createdAt: '2026-03-14T11:00:00.000Z',
  updatedAt: '2026-03-14T11:00:00.000Z',
  competitiveMoat: 'Platform execution.',
  unfairAdvantages: [],
  searchLanes: [
    {
      id: 'lane-platform',
      title: 'Platform modernization',
      rationale: 'Targets platform modernization roles.',
      targetSignals: ['platform'],
    },
  ],
  lookFor: [],
  avoid: [],
  keywordCombinations: [],
  skillDepthMap: [],
  source: 'generated',
  identityVersion: 1,
  feedbackIncorporated: [],
  ...overrides,
})

const persistedIdentityValue = (modelRevision: number) => {
  const identity = {
    ...cloneIdentityFixture(),
    model_revision: modelRevision,
  }
  return JSON.stringify({ state: { currentIdentity: identity }, version: 4 })
}

const setPersistenceHydration = (
  hydrated: boolean,
  activeWorkspaceId = 'facet-local-workspace',
) => {
  usePersistenceRuntimeStore.setState({
    hydrated,
    usingLegacyMigration: false,
    status: {
      phase: hydrated ? 'ready' : 'idle',
      backend: 'remote',
      activeWorkspaceId,
      lastHydratedAt: hydrated ? '2026-03-14T12:00:00.000Z' : null,
      lastSavedAt: hydrated ? '2026-03-14T12:00:00.000Z' : null,
      lastError: null,
    },
  })
}

const setHostedStore = (overrides: Partial<ReturnType<typeof useHostedAppStore.getState>>) => {
  const reportError = vi.fn(
    (message: string, code: string | null = null, reason: string | null = null) => {
      useHostedAppStore.setState({
        lastError: message,
        lastErrorCode: code,
        lastErrorReason: reason,
      })
    },
  )
  const clearError = vi.fn(() => {
    useHostedAppStore.setState({ lastError: null, lastErrorCode: null, lastErrorReason: null })
  })
  const selectWorkspace = vi.fn((workspaceId: string | null) => {
    useHostedAppStore.setState({ selectedWorkspaceId: workspaceId })
  })

  useHostedAppStore.setState({
    deploymentMode: 'hosted',
    bootstrapStatus: 'ready',
    mutationState: null,
    endpoint: 'https://facet.example',
    bearerToken: 'token-123',
    context: hostedContext,
    workspaces: [baseWorkspace],
    selectedWorkspaceId: 'ws-1',
    localMigrationSnapshot: null,
    lastError: null,
    lastErrorCode: null,
    lastErrorReason: null,
    bootstrap: vi.fn().mockResolvedValue(undefined),
    selectWorkspace,
    refresh: vi.fn().mockResolvedValue(undefined),
    createWorkspace: vi.fn(),
    renameWorkspace: vi.fn().mockResolvedValue(baseWorkspace),
    deleteWorkspace: vi.fn().mockResolvedValue({
      deletedWorkspaceId: 'ws-1',
      defaultWorkspaceId: null,
    }),
    reportError,
    clearError,
    ...overrides,
  })

  return {
    reportError,
    clearError,
    selectWorkspace,
  }
}

describe('AppShell hosted workspace bootstrap', () => {
  beforeEach(() => {
    cleanup()
    vi.restoreAllMocks()
    routerMocks.currentPath = '/build'
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    })

    useUiStore.setState({
      appearance: 'light',
      selectedVector: 'all',
      panelRatio: 0.45,
      viewMode: 'pdf',
      showHeatmap: false,
      showDesignHealth: false,
      suggestionModeActive: false,
      comparisonVector: null,
      backupRemindersEnabled: true,
      backupReminderIntervalDays: 7,
      backupReminderSnoozedUntil: null,
      lastBackupAt: null,
      tourCompleted: false,
    })

    runtimeMocks.captureLocalWorkspaceSnapshotForMigration.mockReset()
    runtimeMocks.getPersistenceRuntimeStart.mockReset()
    runtimeMocks.replacePersistenceRuntime.mockReset()
    remoteBackendMocks.createRemotePersistenceBackend.mockClear()
    locationMocks.reloadPage.mockReset()
    setPersistenceHydration(false)
  })

  afterEach(() => {
    cleanup()
  })

  it('bootstraps hosted mode with the captured local snapshot and starts the remote runtime', async () => {
    const migrationSnapshot = buildWorkspaceSnapshot()
    runtimeMocks.captureLocalWorkspaceSnapshotForMigration.mockResolvedValue(migrationSnapshot)

    const bootstrap = vi.fn().mockImplementation(async ({ localMigrationSnapshot }) => {
      useHostedAppStore.setState({
        bootstrapStatus: 'ready',
        bearerToken: 'token-123',
        context: hostedContext,
        workspaces: [baseWorkspace],
        selectedWorkspaceId: 'ws-1',
        localMigrationSnapshot: localMigrationSnapshot ?? null,
        lastError: null,
      })
    })

    setHostedStore({
      bootstrapStatus: 'idle',
      bearerToken: null,
      context: null,
      workspaces: [],
      selectedWorkspaceId: null,
      bootstrap,
    })

    runtimeMocks.replacePersistenceRuntime.mockResolvedValue({
      start: vi.fn(async () => {
        setPersistenceHydration(true, 'ws-1')
      }),
      flush: vi.fn().mockResolvedValue(undefined),
      exportWorkspaceSnapshot: vi.fn().mockResolvedValue(migrationSnapshot),
      importWorkspaceSnapshot: vi.fn().mockResolvedValue(migrationSnapshot),
      dispose: vi.fn(),
    })

    render(<AppShell />)

    await waitFor(() => {
      expect(bootstrap).toHaveBeenCalledWith({
        localMigrationSnapshot: migrationSnapshot,
      })
    })
    await waitFor(() => {
      expect(runtimeMocks.replacePersistenceRuntime).toHaveBeenCalledWith({
        workspaceId: 'ws-1',
        workspaceName: 'Hosted Workspace',
        backend: { kind: 'remote' },
      })
    })
    await waitFor(() => {
      expect(screen.getByTestId('app-shell-outlet')).toBeTruthy()
    })

    expect(remoteBackendMocks.createRemotePersistenceBackend).toHaveBeenCalledWith({
      authMode: 'hosted',
      endpoint: 'https://facet.example/api/persistence',
      bearerToken: 'token-123',
    })
    expect(document.querySelector('.app-topbar-workspace')?.textContent).toContain('Workspace:')
    expect(document.querySelector('.app-topbar-workspace')?.textContent).toContain(
      'Hosted Workspace',
    )
  })

  it('bootstraps hosted mode without a local migration snapshot', async () => {
    runtimeMocks.captureLocalWorkspaceSnapshotForMigration.mockResolvedValue(null)

    const bootstrap = vi.fn().mockImplementation(async ({ localMigrationSnapshot }) => {
      useHostedAppStore.setState({
        bootstrapStatus: 'ready',
        bearerToken: 'token-123',
        context: hostedContext,
        workspaces: [baseWorkspace],
        selectedWorkspaceId: 'ws-1',
        localMigrationSnapshot: localMigrationSnapshot ?? null,
        lastError: null,
      })
    })

    setHostedStore({
      bootstrapStatus: 'idle',
      bearerToken: null,
      context: null,
      workspaces: [],
      selectedWorkspaceId: null,
      bootstrap,
    })

    runtimeMocks.replacePersistenceRuntime.mockResolvedValue({
      start: vi.fn(async () => {
        setPersistenceHydration(true, 'ws-1')
      }),
      flush: vi.fn().mockResolvedValue(undefined),
      exportWorkspaceSnapshot: vi.fn().mockResolvedValue(buildWorkspaceSnapshot()),
      importWorkspaceSnapshot: vi.fn().mockResolvedValue(buildWorkspaceSnapshot()),
      dispose: vi.fn(),
    })

    render(<AppShell />)

    await waitFor(() => {
      expect(bootstrap).toHaveBeenCalledWith({
        localMigrationSnapshot: null,
      })
    })
    await waitFor(() => {
      expect(screen.getByTestId('app-shell-outlet')).toBeTruthy()
    })
  })

  it('cycles appearance from the header theme button', () => {
    setHostedStore({})
    runtimeMocks.replacePersistenceRuntime.mockResolvedValue({
      start: vi.fn(async () => {
        setPersistenceHydration(true, 'ws-1')
      }),
      flush: vi.fn().mockResolvedValue(undefined),
      exportWorkspaceSnapshot: vi.fn().mockResolvedValue(buildWorkspaceSnapshot()),
      importWorkspaceSnapshot: vi.fn().mockResolvedValue(buildWorkspaceSnapshot()),
      dispose: vi.fn(),
    })

    render(<AppShell />)

    const lightButton = screen.getByRole('button', { name: 'Theme: light' })
    fireEvent.click(lightButton)
    expect(useUiStore.getState().appearance).toBe('dark')
    expect(screen.getByRole('button', { name: 'Theme: dark' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Theme: dark' }))
    expect(useUiStore.getState().appearance).toBe('system')
    expect(screen.getByRole('button', { name: 'Theme: system' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Theme: system' }))
    expect(useUiStore.getState().appearance).toBe('light')
    expect(screen.getByRole('button', { name: 'Theme: light' })).toBeTruthy()
  })

  it('follows system color-scheme changes when appearance is system', () => {
    const colorSchemeListeners: Array<(event: { matches: boolean }) => void> = []
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(
          (_event: string, listener: (event: { matches: boolean }) => void) => {
            colorSchemeListeners.push(listener)
          },
        ),
        removeEventListener: vi.fn(),
      }),
    })
    useUiStore.setState({
      appearance: 'system',
    })
    setHostedStore({})
    runtimeMocks.replacePersistenceRuntime.mockResolvedValue({
      start: vi.fn(async () => {
        setPersistenceHydration(true, 'ws-1')
      }),
      flush: vi.fn().mockResolvedValue(undefined),
      exportWorkspaceSnapshot: vi.fn().mockResolvedValue(buildWorkspaceSnapshot()),
      importWorkspaceSnapshot: vi.fn().mockResolvedValue(buildWorkspaceSnapshot()),
      dispose: vi.fn(),
    })

    render(<AppShell />)

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(colorSchemeListeners).toHaveLength(1)
    colorSchemeListeners[0]({ matches: false })
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('groups workspace navigation by search stage and shows route context in the topbar', () => {
    routerMocks.currentPath = '/research'
    setHostedStore({})
    runtimeMocks.replacePersistenceRuntime.mockResolvedValue({
      start: vi.fn(async () => {
        setPersistenceHydration(true, 'ws-1')
      }),
      flush: vi.fn().mockResolvedValue(undefined),
      exportWorkspaceSnapshot: vi.fn().mockResolvedValue(buildWorkspaceSnapshot()),
      importWorkspaceSnapshot: vi.fn().mockResolvedValue(buildWorkspaceSnapshot()),
      dispose: vi.fn(),
    })

    render(<AppShell />)

    const sidebarNav = document.querySelector('.sidebar-nav') as HTMLElement
    expect(
      within(sidebarNav)
        .getAllByRole('link')
        .map((link) => link.textContent?.trim()),
    ).toEqual([
      'Overview',
      'Identity',
      'Research',
      'Match',
      'Build',
      'Letters',
      'LinkedIn',
      'Recruiter',
      'Pipeline',
      'Prep',
      'Debrief',
    ])
    expect(within(sidebarNav).getByRole('link', { name: /^Overview$/i })).toBeTruthy()
    const overviewGroup = document.querySelector('.sidebar-nav-group:first-child') as HTMLElement
    expect(overviewGroup.tagName).toBe('SECTION')
    expect(overviewGroup.getAttribute('aria-label')).toBe('Workspace Overview')
    expect(overviewGroup.hasAttribute('aria-labelledby')).toBe(false)
    expect(within(overviewGroup).queryByText('Overview')).toBeTruthy()
    expect(overviewGroup.querySelector('.sidebar-nav-group-label')).toBeNull()
    const labelledGroups = Array.from(
      sidebarNav.querySelectorAll('section.sidebar-nav-group[aria-labelledby]'),
    )
    expect(labelledGroups).toHaveLength(4)
    labelledGroups.forEach((group) => {
      expect(group.getAttribute('aria-labelledby')).toMatch(/^sidebar-nav-group-/)
    })
    expect(screen.getByRole('heading', { name: 'Research' })).toBeTruthy()
    expect(within(sidebarNav).getByText('Foundation')).toBeTruthy()
    expect(within(sidebarNav).getByText('Analyze')).toBeTruthy()
    expect(within(sidebarNav).getByText('Apply')).toBeTruthy()
    expect(within(sidebarNav).getByText('Interview')).toBeTruthy()
    expect(within(sidebarNav).queryByText('Core')).toBeNull()
    expect(within(sidebarNav).queryByText('Execution')).toBeNull()
    expect(within(sidebarNav).queryByText('Output')).toBeNull()
    expect(document.querySelector('.app-topbar-eyebrow')?.textContent).toBe('Analyze Workspace')
    expect(
      screen.getByText(
        'Turn your identity into targeted searches and pipeline-ready opportunities.',
      ),
    ).toBeTruthy()
  })

  it('links the topbar brand to the landing page', () => {
    setHostedStore({})
    runtimeMocks.replacePersistenceRuntime.mockResolvedValue({
      start: vi.fn(async () => {
        setPersistenceHydration(true, 'ws-1')
      }),
      flush: vi.fn().mockResolvedValue(undefined),
      exportWorkspaceSnapshot: vi.fn().mockResolvedValue(buildWorkspaceSnapshot()),
      importWorkspaceSnapshot: vi.fn().mockResolvedValue(buildWorkspaceSnapshot()),
      dispose: vi.fn(),
    })

    render(<AppShell />)

    expect(screen.getByRole('link', { name: /facet home/i }).getAttribute('href')).toBe('/')
  })

  it('renders docs, account, and sync controls in the topbar', () => {
    setHostedStore({})
    setPersistenceHydration(true, 'ws-1')
    runtimeMocks.replacePersistenceRuntime.mockResolvedValue({
      start: vi.fn(async () => {
        setPersistenceHydration(true, 'ws-1')
      }),
      flush: vi.fn().mockResolvedValue(undefined),
      exportWorkspaceSnapshot: vi.fn().mockResolvedValue(buildWorkspaceSnapshot()),
      importWorkspaceSnapshot: vi.fn().mockResolvedValue(buildWorkspaceSnapshot()),
      dispose: vi.fn(),
    })

    render(<AppShell />)

    expect(screen.getByRole('link', { name: /help and docs/i }).getAttribute('href')).toBe('/help')
    expect(screen.getByRole('link', { name: /account/i }).getAttribute('href')).toBe('/account')
    expect(document.querySelector('.app-topbar-sync')?.textContent).toContain('Ready')
  })

  it('renders AppShell in local mode without hosted bootstrap', () => {
    useHostedAppStore.setState({
      deploymentMode: 'self-hosted',
      bootstrapStatus: 'ready',
      mutationState: null,
      endpoint: 'https://facet.example',
      bearerToken: null,
      context: null,
      workspaces: [],
      selectedWorkspaceId: null,
      localMigrationSnapshot: null,
      lastError: null,
      lastErrorCode: null,
      lastErrorReason: null,
    })
    setPersistenceHydration(true, 'facet-local-workspace')

    render(<AppShell />)

    expect(screen.getByTestId('app-shell-outlet')).toBeTruthy()
    expect(runtimeMocks.captureLocalWorkspaceSnapshotForMigration).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: /hosted workspaces/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /retry hosted bootstrap/i })).toBeNull()
    expect(screen.queryByText(/connecting your hosted account/i)).toBeNull()
  })

  it('shows a queued hosted pass in the account topbar while access is active', () => {
    setHostedStore({
      context: {
        ...hostedContext,
        billingPass: {
          provider: 'stripe',
          paymentIntentId: 'pi_paid_extension',
          planId: 'ai-pro',
          status: 'paid',
          purchasedAt: '2026-05-10T12:00:00.000Z',
          activatedAt: null,
          expiresAt: null,
        },
        entitlement: {
          planId: 'ai-pro',
          status: 'active',
          source: 'stripe',
          features: ['research.search'],
          effectiveThrough: '2099-05-10T12:00:00.000Z',
        },
      },
    })
    setPersistenceHydration(true, 'ws-1')
    runtimeMocks.replacePersistenceRuntime.mockResolvedValue({
      start: vi.fn().mockResolvedValue(undefined),
      dispose: vi.fn(),
    })

    render(<AppShell />)

    expect(screen.getByText(/Pro · \d+d \+ pass/)).toBeTruthy()
  })

  it('does not warn for expiring active access when a queued pass exists', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-05-24T12:00:00.000Z'))
      setHostedStore({
        context: {
          ...hostedContext,
          billingPass: {
            provider: 'stripe',
            paymentIntentId: 'pi_paid_extension',
            planId: 'ai-pro',
            status: 'paid',
            purchasedAt: '2026-05-10T12:00:00.000Z',
            activatedAt: null,
            expiresAt: null,
          },
          entitlement: {
            planId: 'ai-pro',
            status: 'active',
            source: 'stripe',
            features: ['research.search'],
            effectiveThrough: '2026-05-26T12:00:00.000Z',
          },
        },
      })
      setPersistenceHydration(true, 'ws-1')
      runtimeMocks.replacePersistenceRuntime.mockResolvedValue({
        start: vi.fn().mockResolvedValue(undefined),
        dispose: vi.fn(),
      })

      render(<AppShell />)

      expect(screen.getByText('Pro · 2d + pass')).toBeTruthy()
      const accountLink = screen.getByRole('link', { name: 'Account' })
      expect(accountLink.className).not.toContain('app-topbar-link-danger')
      expect(accountLink.className).not.toContain('app-topbar-link-warning')
    } finally {
      vi.useRealTimers()
    }
  })

  it('shows Pro ready without a danger tone when expired access has a queued pass', () => {
    setHostedStore({
      context: {
        ...hostedContext,
        billingPass: {
          provider: 'stripe',
          paymentIntentId: 'pi_paid_extension',
          planId: 'ai-pro',
          status: 'paid',
          purchasedAt: '2026-05-10T12:00:00.000Z',
          activatedAt: null,
          expiresAt: null,
        },
        entitlement: {
          planId: 'ai-pro',
          status: 'active',
          source: 'stripe',
          features: ['research.search'],
          effectiveThrough: '2020-05-10T12:00:00.000Z',
        },
      },
    })
    setPersistenceHydration(true, 'ws-1')
    runtimeMocks.replacePersistenceRuntime.mockResolvedValue({
      start: vi.fn().mockResolvedValue(undefined),
      dispose: vi.fn(),
    })

    render(<AppShell />)

    expect(screen.getByText('Pro ready')).toBeTruthy()
    const accountLink = screen.getByRole('link', { name: 'Account' })
    expect(accountLink).toBeTruthy()
    expect(accountLink.className).not.toContain('app-topbar-link-danger')
  })

  it('shows danger account labels for expired and refunded hosted entitlements', () => {
    setHostedStore({
      context: {
        ...hostedContext,
        billingPass: {
          provider: 'stripe',
          paymentIntentId: 'pi_expired',
          planId: 'ai-pro',
          status: 'expired',
          purchasedAt: '2026-01-01T12:00:00.000Z',
          activatedAt: '2026-01-01T12:00:00.000Z',
          expiresAt: '2026-04-01T12:00:00.000Z',
        },
        entitlement: {
          planId: 'ai-pro',
          status: 'expired',
          source: 'stripe',
          features: ['research.search'],
          effectiveThrough: '2026-04-01T12:00:00.000Z',
        },
      },
    })
    setPersistenceHydration(true, 'ws-1')
    runtimeMocks.replacePersistenceRuntime.mockResolvedValue({
      start: vi.fn().mockResolvedValue(undefined),
      dispose: vi.fn(),
    })

    const { rerender } = render(<AppShell />)

    expect(screen.getByText('Expired')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Account' }).className).toContain(
      'app-topbar-link-danger',
    )

    setHostedStore({
      context: {
        ...hostedContext,
        billingPass: {
          provider: 'stripe',
          paymentIntentId: 'pi_refunded',
          planId: 'ai-pro',
          status: 'refunded',
          purchasedAt: '2026-01-01T12:00:00.000Z',
          activatedAt: null,
          expiresAt: null,
        },
        entitlement: {
          planId: 'ai-pro',
          status: 'refunded',
          source: 'stripe',
          features: ['research.search'],
          effectiveThrough: null,
        },
      },
    })
    rerender(<AppShell />)

    expect(screen.getByText('Billing issue')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Account' }).className).toContain(
      'app-topbar-link-danger',
    )
  })

  it('shows a non-blocking cross-tab Identity toast with a staleness review link', () => {
    useHostedAppStore.setState({
      deploymentMode: 'self-hosted',
      bootstrapStatus: 'ready',
      mutationState: null,
      endpoint: 'https://facet.example',
      bearerToken: null,
      context: null,
      workspaces: [],
      selectedWorkspaceId: null,
      localMigrationSnapshot: null,
      lastError: null,
      lastErrorCode: null,
      lastErrorReason: null,
    })
    setPersistenceHydration(true, 'facet-local-workspace')
    runtimeMocks.getPersistenceRuntimeStart.mockResolvedValue(undefined)
    useSearchStore.setState({
      theses: [buildShellThesis({ identityVersion: 2 })],
      runs: [],
    })
    usePrepStore.setState({ decks: [] })
    useCoverLetterStore.setState({ templates: [] })

    render(<AppShell />)

    fireEvent(
      window,
      new StorageEvent('storage', {
        key: IDENTITY_STORE_STORAGE_KEY,
        oldValue: persistedIdentityValue(2),
        newValue: persistedIdentityValue(3),
      }),
    )

    expect(screen.getByText(/Identity updated in another tab/)).toBeTruthy()
    expect(screen.getByText(/1 artifact may need refresh/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Review' }).getAttribute('href')).toBe(
      '/research?review=stale',
    )

    fireEvent.click(screen.getByRole('button', { name: /dismiss notification/i }))

    expect(screen.queryByText(/Identity updated in another tab/)).toBeNull()
  })

  it('ignores storage events that do not represent a newer Identity revision', () => {
    useHostedAppStore.setState({
      deploymentMode: 'self-hosted',
      bootstrapStatus: 'ready',
      mutationState: null,
      endpoint: 'https://facet.example',
      bearerToken: null,
      context: null,
      workspaces: [],
      selectedWorkspaceId: null,
      localMigrationSnapshot: null,
      lastError: null,
      lastErrorCode: null,
      lastErrorReason: null,
    })
    setPersistenceHydration(true, 'facet-local-workspace')

    render(<AppShell />)

    fireEvent(
      window,
      new StorageEvent('storage', {
        key: 'facet.other.store',
        oldValue: persistedIdentityValue(2),
        newValue: persistedIdentityValue(3),
      }),
    )
    fireEvent(
      window,
      new StorageEvent('storage', {
        key: IDENTITY_STORE_STORAGE_KEY,
        oldValue: persistedIdentityValue(3),
        newValue: persistedIdentityValue(3),
      }),
    )
    fireEvent(
      window,
      new StorageEvent('storage', {
        key: IDENTITY_STORE_STORAGE_KEY,
        oldValue: persistedIdentityValue(3),
        newValue: '{not json',
      }),
    )
    fireEvent(
      window,
      new StorageEvent('storage', {
        key: IDENTITY_STORE_STORAGE_KEY,
        oldValue: null,
        newValue: persistedIdentityValue(3),
      }),
    )
    fireEvent(
      window,
      new StorageEvent('storage', {
        key: IDENTITY_STORE_STORAGE_KEY,
        oldValue: persistedIdentityValue(3),
        newValue: null,
      }),
    )

    expect(screen.getByTestId('app-shell-outlet')).toBeTruthy()
    expect(screen.queryByText(/Identity updated in another tab/)).toBeNull()
  })

  it('counts stale artifacts across derived Identity surfaces in the cross-tab toast', () => {
    useHostedAppStore.setState({
      deploymentMode: 'self-hosted',
      bootstrapStatus: 'ready',
      mutationState: null,
      endpoint: 'https://facet.example',
      bearerToken: null,
      context: null,
      workspaces: [],
      selectedWorkspaceId: null,
      localMigrationSnapshot: null,
      lastError: null,
      lastErrorCode: null,
      lastErrorReason: null,
    })
    setPersistenceHydration(true, 'facet-local-workspace')
    useSearchStore.setState({
      theses: [
        buildShellThesis({ id: 'thesis-stale-1', identityVersion: 2 }),
        buildShellThesis({ id: 'thesis-stale-2', identityVersion: 2 }),
        buildShellThesis({ id: 'thesis-fresh', identityVersion: 3 }),
      ],
      runs: [],
    })
    usePrepStore.setState({
      decks: [
        {
          id: 'deck-stale',
          pipelineEntryId: 'entry-1',
          updatedAt: '2026-03-14T11:00:00.000Z',
          identityVersion: 2,
          title: 'Stale Prep Deck',
          company: 'Facet',
          role: 'Staff Engineer',
          cards: [],
        },
      ],
    })
    useCoverLetterStore.setState({
      templates: [
        {
          id: 'letter-stale',
          name: 'Stale Letter',
          header: 'Header',
          greeting: 'Hello',
          paragraphs: [{ id: 'letter-stale-p', text: 'Letter content', vectors: {} }],
          signOff: 'Regards',
          identityVersion: 2,
        },
      ],
    })

    render(<AppShell />)

    fireEvent(
      window,
      new StorageEvent('storage', {
        key: IDENTITY_STORE_STORAGE_KEY,
        oldValue: persistedIdentityValue(2),
        newValue: persistedIdentityValue(3),
      }),
    )

    expect(screen.getByText(/4 artifacts may need refresh/)).toBeTruthy()
  })

  it('shows bootstrap loading while hosted account context is still connecting', () => {
    setHostedStore({
      bootstrapStatus: 'loading',
      workspaces: [],
      selectedWorkspaceId: null,
      context: null,
      bearerToken: null,
    })

    render(<AppShell />)

    expect(screen.getByText('Connecting your hosted account…')).toBeTruthy()
    expect(
      screen.getByText(/Loading account context, workspaces, and local migration state/),
    ).toBeTruthy()
    expect(screen.queryByTestId('app-shell-outlet')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('clears stale hosted error state after a successful runtime recovery', async () => {
    const { clearError } = setHostedStore({
      bootstrapStatus: 'ready',
      workspaces: [baseWorkspace],
      selectedWorkspaceId: 'ws-1',
      lastError: 'Old hosted error',
      lastErrorCode: 'offline',
      lastErrorReason: null,
    })

    runtimeMocks.captureLocalWorkspaceSnapshotForMigration.mockResolvedValue(null)
    runtimeMocks.replacePersistenceRuntime.mockResolvedValue({
      start: vi.fn(async () => {
        setPersistenceHydration(true, 'ws-1')
      }),
      flush: vi.fn().mockResolvedValue(undefined),
      exportWorkspaceSnapshot: vi.fn().mockResolvedValue(buildWorkspaceSnapshot()),
      importWorkspaceSnapshot: vi.fn().mockResolvedValue(buildWorkspaceSnapshot()),
      dispose: vi.fn(),
    })

    render(<AppShell />)

    await waitFor(() => {
      expect(screen.getByTestId('app-shell-outlet')).toBeTruthy()
    })

    expect(clearError).toHaveBeenCalled()
    expect(useHostedAppStore.getState().lastError).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it.each([
    ['idle', 'Starting'],
    ['ready', 'Ready'],
    ['saving', 'Saving'],
    ['error', 'Sync error'],
    ['offline', 'Offline'],
  ] as const)('renders %s sync state in the topbar', (phase, expectedLabel) => {
    setHostedStore({})
    usePersistenceRuntimeStore.setState({
      hydrated: phase !== 'idle',
      usingLegacyMigration: false,
      status: {
        phase,
        backend: 'remote',
        activeWorkspaceId: 'ws-1',
        lastHydratedAt: phase === 'idle' ? null : '2026-03-14T12:00:00.000Z',
        lastSavedAt: '2026-03-14T12:00:00.000Z',
        lastError: phase === 'error' ? 'Sync failed' : null,
      },
    })

    render(<AppShell />)

    expect(document.querySelector('.app-topbar-sync')?.textContent).toContain(expectedLabel)
  })

  it.each([
    ['/', 'Overview', 'Workspace Overview', 'Overview'],
    ['/build', 'Build', 'Apply Workspace', 'Build'],
    ['/letters', 'Letters', 'Apply Workspace', 'Letters'],
    ['/letters/draft-1', 'Letters', 'Apply Workspace', 'Letters'],
    ['/linkedin', 'LinkedIn', 'Apply Workspace', 'LinkedIn'],
    ['/recruiter', 'Recruiter', 'Apply Workspace', 'Recruiter'],
    ['/research', 'Research', 'Analyze Workspace', 'Research'],
    ['/match', 'Match', 'Analyze Workspace', 'Match'],
    ['/pipeline', 'Pipeline', 'Interview Workspace', 'Pipeline'],
    ['/prep', 'Prep', 'Interview Workspace', 'Prep'],
    ['/debrief', 'Debrief', 'Interview Workspace', 'Debrief'],
    ['/identity', 'Identity', 'Foundation Workspace', 'Identity'],
  ] as const)(
    'renders route context and active nav state for %s',
    (pathname, heading, eyebrow, navLabel) => {
      routerMocks.currentPath = pathname
      setHostedStore({})
      setPersistenceHydration(true, 'ws-1')

      render(<AppShell />)

      expect(screen.getByRole('heading', { name: heading })).toBeTruthy()
      expect(document.querySelector('.app-topbar-eyebrow')?.textContent).toBe(eyebrow)
      expect(
        screen.getByRole('link', { name: new RegExp(`^${navLabel}$`, 'i') }).className,
      ).toContain('active')
    },
  )

  it('blocks the editor and surfaces an error when the hosted runtime fails to load', async () => {
    setHostedStore({})
    setPersistenceHydration(true, 'ws-previous')

    runtimeMocks.captureLocalWorkspaceSnapshotForMigration.mockResolvedValue(null)
    runtimeMocks.replacePersistenceRuntime.mockResolvedValue({
      start: vi.fn().mockRejectedValue(new Error('Remote load failed')),
      flush: vi.fn().mockResolvedValue(undefined),
      exportWorkspaceSnapshot: vi.fn().mockResolvedValue(buildWorkspaceSnapshot()),
      importWorkspaceSnapshot: vi.fn().mockResolvedValue(buildWorkspaceSnapshot()),
      dispose: vi.fn(),
    })

    render(<AppShell />)

    await waitFor(() => {
      expect(screen.getByText(/hosted workspace sync failed/i)).toBeTruthy()
    })

    expect(screen.queryByTestId('app-shell-outlet')).toBeNull()
    expect(document.querySelector('.app-topbar-workspace')?.textContent ?? '').not.toContain(
      'Hosted Workspace',
    )
    expect(screen.getByRole('alert').textContent).toContain('Remote load failed')
    expect(useHostedAppStore.getState().lastError).toBe('Remote load failed')
  })

  it('surfaces billing-state bootstrap failures distinctly from generic hosted errors', async () => {
    setHostedStore({
      bootstrapStatus: 'error',
      selectedWorkspaceId: null,
      workspaces: [],
      lastError: 'Hosted billing state unavailable (500)',
      lastErrorCode: 'billing_state_error',
    })

    render(<AppShell />)

    expect(screen.getByRole('alert').textContent).toContain('Hosted billing state unavailable')
    expect(screen.getByRole('button', { name: /refresh billing state/i })).toBeTruthy()
  })

  it('surfaces generic bootstrap failures with retry recovery', () => {
    const bootstrap = vi.fn().mockResolvedValue(undefined)
    setHostedStore({
      bootstrapStatus: 'error',
      selectedWorkspaceId: null,
      workspaces: [],
      lastError: 'Something went wrong',
      lastErrorCode: null,
      lastErrorReason: null,
      bootstrap,
    })

    render(<AppShell />)

    expect(screen.getByRole('alert').textContent).toContain('Hosted bootstrap failed')
    expect(screen.getByRole('alert').textContent).toContain('Something went wrong')
    fireEvent.click(screen.getByRole('button', { name: /retry hosted bootstrap/i }))

    expect(bootstrap).toHaveBeenCalledTimes(1)
    expect(bootstrap).toHaveBeenCalledWith({
      localMigrationSnapshot: null,
    })
  })

  it('retries a failed hosted bootstrap and clears the error path after recovery', async () => {
    const bootstrap = vi.fn().mockImplementation(async ({ localMigrationSnapshot }) => {
      useHostedAppStore.setState({
        bootstrapStatus: 'ready',
        bearerToken: 'token-123',
        context: hostedContext,
        workspaces: [baseWorkspace],
        selectedWorkspaceId: 'ws-1',
        localMigrationSnapshot,
        lastError: null,
        lastErrorCode: null,
        lastErrorReason: null,
      })
    })

    setHostedStore({
      bootstrapStatus: 'error',
      selectedWorkspaceId: null,
      workspaces: [],
      localMigrationSnapshot: buildWorkspaceSnapshot(),
      lastError: 'Temporary hosted outage',
      lastErrorCode: 'offline',
      lastErrorReason: null,
      bootstrap,
    })

    runtimeMocks.replacePersistenceRuntime.mockResolvedValue({
      start: vi.fn(async () => {
        setPersistenceHydration(true, 'ws-1')
      }),
      flush: vi.fn().mockResolvedValue(undefined),
      exportWorkspaceSnapshot: vi.fn().mockResolvedValue(buildWorkspaceSnapshot()),
      importWorkspaceSnapshot: vi.fn().mockResolvedValue(buildWorkspaceSnapshot()),
      dispose: vi.fn(),
    })

    render(<AppShell />)

    expect(screen.getByRole('alert').textContent).toContain('Temporary hosted outage')
    fireEvent.click(screen.getByRole('button', { name: /retry hosted bootstrap/i }))

    await waitFor(() => {
      expect(bootstrap).toHaveBeenCalledTimes(1)
    })
    expect(bootstrap).toHaveBeenCalledWith({
      localMigrationSnapshot: useHostedAppStore.getState().localMigrationSnapshot,
    })
    await waitFor(() => {
      expect(screen.getByTestId('app-shell-outlet')).toBeTruthy()
    })

    expect(useHostedAppStore.getState().lastError).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('switches hosted workspaces through the dialog and reinitializes the runtime', async () => {
    const alternateWorkspace = {
      workspaceId: 'ws-2',
      name: 'Interview Workspace',
      revision: 1,
      updatedAt: '2026-03-14T12:30:00.000Z',
      role: 'owner' as const,
      isDefault: false,
    }

    const { selectWorkspace } = setHostedStore({
      workspaces: [baseWorkspace, alternateWorkspace],
      selectedWorkspaceId: 'ws-1',
    })

    const firstRuntime = {
      start: vi.fn(async () => {
        setPersistenceHydration(true, 'ws-1')
      }),
      flush: vi.fn().mockResolvedValue(undefined),
      exportWorkspaceSnapshot: vi.fn().mockResolvedValue(buildWorkspaceSnapshot()),
      importWorkspaceSnapshot: vi.fn().mockResolvedValue(buildWorkspaceSnapshot()),
      dispose: vi.fn(),
    }
    const secondRuntime = {
      start: vi.fn(async () => {
        setPersistenceHydration(true, 'ws-2')
      }),
      flush: vi.fn().mockResolvedValue(undefined),
      exportWorkspaceSnapshot: vi.fn().mockResolvedValue(buildWorkspaceSnapshot()),
      importWorkspaceSnapshot: vi.fn().mockResolvedValue(buildWorkspaceSnapshot()),
      dispose: vi.fn(),
    }

    runtimeMocks.replacePersistenceRuntime
      .mockResolvedValueOnce(firstRuntime)
      .mockResolvedValueOnce(secondRuntime)

    render(<AppShell />)

    await waitFor(() => {
      expect(document.querySelector('.app-topbar-workspace')?.textContent).toContain(
        'Hosted Workspace',
      )
    })

    fireEvent.click(screen.getByRole('button', { name: /hosted workspaces/i }))
    const dialog = screen.getByRole('dialog', { name: /hosted workspaces/i })
    const alternateCard = within(dialog)
      .getByText('Interview Workspace')
      .closest('article') as HTMLElement
    fireEvent.click(within(alternateCard).getByRole('button', { name: 'Open' }))

    expect(selectWorkspace).toHaveBeenCalledWith('ws-2')
    await waitFor(() => {
      expect(runtimeMocks.replacePersistenceRuntime).toHaveBeenCalledTimes(2)
    })
    expect(runtimeMocks.replacePersistenceRuntime).toHaveBeenLastCalledWith({
      workspaceId: 'ws-2',
      workspaceName: 'Interview Workspace',
      backend: { kind: 'remote' },
    })
    await waitFor(() => {
      expect(document.querySelector('.app-topbar-workspace')?.textContent).toContain(
        'Interview Workspace',
      )
    })
  })

  it('closes the hosted workspace dialog without switching workspaces', async () => {
    const alternateWorkspace = {
      workspaceId: 'ws-2',
      name: 'Interview Workspace',
      revision: 1,
      updatedAt: '2026-03-14T12:30:00.000Z',
      role: 'owner' as const,
      isDefault: false,
    }
    const { selectWorkspace } = setHostedStore({
      workspaces: [baseWorkspace, alternateWorkspace],
      selectedWorkspaceId: 'ws-1',
    })

    runtimeMocks.replacePersistenceRuntime.mockResolvedValue({
      start: vi.fn(async () => {
        setPersistenceHydration(true, 'ws-1')
      }),
      flush: vi.fn().mockResolvedValue(undefined),
      exportWorkspaceSnapshot: vi.fn().mockResolvedValue(buildWorkspaceSnapshot()),
      importWorkspaceSnapshot: vi.fn().mockResolvedValue(buildWorkspaceSnapshot()),
      dispose: vi.fn(),
    })

    render(<AppShell />)

    await waitFor(() => {
      expect(document.querySelector('.app-topbar-workspace')?.textContent).toContain(
        'Hosted Workspace',
      )
    })

    fireEvent.click(screen.getByRole('button', { name: /hosted workspaces/i }))
    fireEvent.click(screen.getByRole('button', { name: /close dialog/i }))

    expect(screen.queryByRole('dialog', { name: /hosted workspaces/i })).toBeNull()
    expect(selectWorkspace).not.toHaveBeenCalled()
    expect(runtimeMocks.replacePersistenceRuntime).toHaveBeenCalledTimes(1)
    expect(document.querySelector('.app-topbar-workspace')?.textContent).toContain(
      'Hosted Workspace',
    )
  })

  it('prompts for onboarding when the selected hosted workspace is missing', () => {
    setHostedStore({
      workspaces: [baseWorkspace],
      selectedWorkspaceId: 'ws-deleted',
    })
    runtimeMocks.replacePersistenceRuntime.mockResolvedValue({
      start: vi.fn(async () => {
        setPersistenceHydration(true, 'ws-deleted')
      }),
      flush: vi.fn().mockResolvedValue(undefined),
      exportWorkspaceSnapshot: vi.fn().mockResolvedValue(buildWorkspaceSnapshot()),
      importWorkspaceSnapshot: vi.fn().mockResolvedValue(buildWorkspaceSnapshot()),
      dispose: vi.fn(),
    })

    render(<AppShell />)

    expect(screen.getByText('No hosted workspace selected')).toBeTruthy()
    expect(runtimeMocks.replacePersistenceRuntime).not.toHaveBeenCalled()
    expect(screen.queryByTestId('app-shell-outlet')).toBeNull()
  })

  it('reloads the session when the hosted billing recovery button is clicked', async () => {
    locationMocks.reloadPage.mockReset()

    setHostedStore({
      bootstrapStatus: 'error',
      selectedWorkspaceId: null,
      workspaces: [],
      lastError: 'Hosted billing state unavailable (500)',
      lastErrorCode: 'billing_state_error',
    })

    render(<AppShell />)
    fireEvent.click(screen.getByRole('button', { name: /refresh billing state/i }))

    expect(locationMocks.reloadPage).toHaveBeenCalledTimes(1)
  })

  it('surfaces hosted billing issues distinctly during bootstrap recovery', async () => {
    setHostedStore({
      bootstrapStatus: 'error',
      selectedWorkspaceId: null,
      workspaces: [],
      lastError: 'Your hosted pass needs attention (402)',
      lastErrorCode: 'ai_access_denied',
      lastErrorReason: 'billing_issue',
    })

    render(<AppShell />)

    expect(screen.getByRole('alert').textContent).toContain('Hosted billing issue')
    expect(screen.getByRole('alert').textContent).not.toContain('Hosted bootstrap failed')
  })

  it('surfaces hosted upgrade requirements distinctly during bootstrap recovery', async () => {
    setHostedStore({
      bootstrapStatus: 'error',
      selectedWorkspaceId: null,
      workspaces: [],
      lastError: 'Upgrade required for hosted access (402)',
      lastErrorCode: 'ai_access_denied',
      lastErrorReason: 'upgrade_required',
    })

    render(<AppShell />)

    expect(screen.getByRole('alert').textContent).toContain('Hosted upgrade required')
    expect(screen.getByRole('alert').textContent).not.toContain('Hosted bootstrap failed')
  })

  it('offers session refresh recovery when hosted runtime auth expires', async () => {
    setHostedStore({})
    setPersistenceHydration(true, 'ws-previous')

    runtimeMocks.captureLocalWorkspaceSnapshotForMigration.mockResolvedValue(null)
    runtimeMocks.replacePersistenceRuntime.mockResolvedValue({
      start: vi.fn().mockRejectedValue(
        new FacetApiError('Hosted session expired (401)', {
          status: 401,
          code: 'auth_required',
        }),
      ),
      flush: vi.fn().mockResolvedValue(undefined),
      exportWorkspaceSnapshot: vi.fn().mockResolvedValue(buildWorkspaceSnapshot()),
      importWorkspaceSnapshot: vi.fn().mockResolvedValue(buildWorkspaceSnapshot()),
      dispose: vi.fn(),
    })

    render(<AppShell />)

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Hosted session expired')
    })

    expect(screen.getByRole('button', { name: /refresh session/i })).toBeTruthy()
    expect(
      within(screen.getByRole('alert')).getByRole('button', { name: /backup workspace/i }),
    ).toBeTruthy()
  })

  it('reloads the session when hosted runtime auth expires', async () => {
    setHostedStore({})
    setPersistenceHydration(true, 'ws-previous')
    locationMocks.reloadPage.mockReset()

    runtimeMocks.captureLocalWorkspaceSnapshotForMigration.mockResolvedValue(null)
    runtimeMocks.replacePersistenceRuntime.mockResolvedValue({
      start: vi.fn().mockRejectedValue(
        new FacetApiError('Hosted session expired (401)', {
          status: 401,
          code: 'auth_required',
        }),
      ),
      flush: vi.fn().mockResolvedValue(undefined),
      exportWorkspaceSnapshot: vi.fn().mockResolvedValue(buildWorkspaceSnapshot()),
      importWorkspaceSnapshot: vi.fn().mockResolvedValue(buildWorkspaceSnapshot()),
      dispose: vi.fn(),
    })

    render(<AppShell />)

    const alert = await waitFor(() => screen.getByRole('alert'))
    fireEvent.click(within(alert).getByRole('button', { name: /refresh session/i }))

    expect(locationMocks.reloadPage).toHaveBeenCalledTimes(1)
  })

  it('opens the backup dialog from the hosted runtime recovery screen', async () => {
    setHostedStore({})
    setPersistenceHydration(true, 'ws-previous')

    runtimeMocks.captureLocalWorkspaceSnapshotForMigration.mockResolvedValue(null)
    runtimeMocks.replacePersistenceRuntime.mockResolvedValue({
      start: vi.fn().mockRejectedValue(
        new FacetApiError('Hosted session expired (401)', {
          status: 401,
          code: 'auth_required',
        }),
      ),
      flush: vi.fn().mockResolvedValue(undefined),
      exportWorkspaceSnapshot: vi.fn().mockResolvedValue(buildWorkspaceSnapshot()),
      importWorkspaceSnapshot: vi.fn().mockResolvedValue(buildWorkspaceSnapshot()),
      dispose: vi.fn(),
    })

    render(<AppShell />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /backup workspace/i })).toBeTruthy()
    })

    fireEvent.click(
      within(screen.getByRole('alert')).getByRole('button', { name: /backup workspace/i }),
    )
    expect(screen.getByTestId('workspace-backup-dialog')).toBeTruthy()
  })

  it('surfaces hosted upgrade requirements distinctly from generic runtime sync failures', async () => {
    setHostedStore({})
    setPersistenceHydration(true, 'ws-previous')

    runtimeMocks.captureLocalWorkspaceSnapshotForMigration.mockResolvedValue(null)
    runtimeMocks.replacePersistenceRuntime.mockResolvedValue({
      start: vi.fn().mockRejectedValue(
        new FacetApiError('Upgrade required to keep this hosted workspace in sync (402)', {
          status: 402,
          code: 'ai_access_denied',
          reason: 'upgrade_required',
        }),
      ),
      flush: vi.fn().mockResolvedValue(undefined),
      exportWorkspaceSnapshot: vi.fn().mockResolvedValue(buildWorkspaceSnapshot()),
      importWorkspaceSnapshot: vi.fn().mockResolvedValue(buildWorkspaceSnapshot()),
      dispose: vi.fn(),
    })

    render(<AppShell />)

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Hosted upgrade required')
    })

    expect(screen.getByRole('alert').textContent).not.toContain('Hosted workspace sync failed')
    expect(useHostedAppStore.getState()).toMatchObject({
      lastErrorCode: 'ai_access_denied',
      lastErrorReason: 'upgrade_required',
    })
  })

  it.each([
    [
      new FacetApiError('Hosted billing state unavailable (500)', {
        status: 500,
        code: 'billing_state_error',
      }),
      'Hosted billing state unavailable',
    ],
    [
      new FacetApiError('Billing issue on hosted account (402)', {
        status: 402,
        code: 'ai_access_denied',
        reason: 'billing_issue',
      }),
      'Hosted billing issue',
    ],
  ])(
    'surfaces %s distinctly during hosted runtime recovery',
    async (runtimeError, expectedLabel) => {
      setHostedStore({})
      setPersistenceHydration(true, 'ws-previous')

      runtimeMocks.captureLocalWorkspaceSnapshotForMigration.mockResolvedValue(null)
      runtimeMocks.replacePersistenceRuntime.mockResolvedValue({
        start: vi.fn().mockRejectedValue(runtimeError),
        flush: vi.fn().mockResolvedValue(undefined),
        exportWorkspaceSnapshot: vi.fn().mockResolvedValue(buildWorkspaceSnapshot()),
        importWorkspaceSnapshot: vi.fn().mockResolvedValue(buildWorkspaceSnapshot()),
        dispose: vi.fn(),
      })

      render(<AppShell />)

      await waitFor(() => {
        expect(screen.getByRole('alert').textContent).toContain(expectedLabel)
      })

      expect(screen.getByRole('alert').textContent).not.toContain('Hosted workspace sync failed')
    },
  )

  it('surfaces migration import failures after create-from-local-data instead of treating them as success', async () => {
    const migrationSnapshot = buildWorkspaceSnapshot({
      workspace: {
        id: 'facet-local-workspace',
        name: 'Local Workspace',
        revision: 3,
        updatedAt: '2026-03-14T12:20:00.000Z',
      },
    })

    const createWorkspace = vi.fn().mockImplementation(async ({ name }: { name?: string }) => {
      const createdWorkspace = {
        workspaceId: 'ws-import',
        name: name ?? 'Imported Workspace',
        revision: 0,
        updatedAt: '2026-03-14T12:21:00.000Z',
        role: 'owner' as const,
        isDefault: true,
      }

      useHostedAppStore.setState({
        workspaces: [createdWorkspace],
        selectedWorkspaceId: createdWorkspace.workspaceId,
        context: {
          ...hostedContext,
          account: {
            ...hostedContext.account,
            defaultWorkspaceId: createdWorkspace.workspaceId,
          },
          memberships: [
            {
              workspaceId: createdWorkspace.workspaceId,
              role: 'owner',
              isDefault: true,
            },
          ],
        },
      })

      return createdWorkspace
    })

    setHostedStore({
      workspaces: [],
      selectedWorkspaceId: null,
      localMigrationSnapshot: migrationSnapshot,
      createWorkspace,
    })

    runtimeMocks.captureLocalWorkspaceSnapshotForMigration.mockResolvedValue(migrationSnapshot)
    runtimeMocks.replacePersistenceRuntime.mockResolvedValue({
      start: vi.fn(async () => {
        setPersistenceHydration(true, 'ws-import')
      }),
      flush: vi.fn().mockResolvedValue(undefined),
      exportWorkspaceSnapshot: vi.fn().mockResolvedValue(migrationSnapshot),
      importWorkspaceSnapshot: vi.fn().mockRejectedValue(new Error('Hosted import failed')),
      dispose: vi.fn(),
    })

    render(<AppShell />)
    fireEvent.click(screen.getByRole('button', { name: /import local workspace/i }))

    await waitFor(() => {
      expect(createWorkspace).toHaveBeenCalledWith({
        name: 'Imported Workspace',
      })
    })
    await waitFor(() => {
      expect(screen.getByText(/hosted workspace sync failed/i)).toBeTruthy()
    })

    expect(screen.queryByTestId('app-shell-outlet')).toBeNull()
    expect(screen.getByRole('alert').textContent).toContain('Hosted import failed')
    expect(useHostedAppStore.getState().lastError).toBe('Hosted import failed')
  })

  it('surfaces create-workspace failures during local import onboarding', async () => {
    const migrationSnapshot = buildWorkspaceSnapshot()
    const createWorkspace = vi.fn().mockImplementation(async () => {
      useHostedAppStore.setState({ lastError: 'Hosted workspace creation failed' })
      throw new Error('Hosted workspace creation failed')
    })

    setHostedStore({
      workspaces: [],
      selectedWorkspaceId: null,
      localMigrationSnapshot: migrationSnapshot,
      createWorkspace,
      lastError: null,
    })

    runtimeMocks.captureLocalWorkspaceSnapshotForMigration.mockResolvedValue(migrationSnapshot)

    render(<AppShell />)
    fireEvent.click(screen.getByRole('button', { name: /import local workspace/i }))

    await waitFor(() => {
      expect(createWorkspace).toHaveBeenCalledWith({
        name: 'Imported Workspace',
      })
    })
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Hosted workspace creation failed')
    })

    expect(screen.queryByTestId('app-shell-outlet')).toBeNull()
  })

  it('starts fresh from hosted onboarding and clears stale recovery errors', async () => {
    const { clearError } = setHostedStore({
      workspaces: [],
      selectedWorkspaceId: null,
      localMigrationSnapshot: null,
      lastError: 'Previous hosted workspace error',
    })

    const createWorkspace = vi.fn().mockImplementation(async () => {
      useHostedAppStore.setState({
        workspaces: [baseWorkspace],
        selectedWorkspaceId: 'ws-1',
        lastError: null,
        lastErrorCode: null,
        lastErrorReason: null,
      })

      return baseWorkspace
    })

    useHostedAppStore.setState({ createWorkspace })
    runtimeMocks.captureLocalWorkspaceSnapshotForMigration.mockResolvedValue(null)
    runtimeMocks.replacePersistenceRuntime.mockResolvedValue({
      start: vi.fn(async () => {
        setPersistenceHydration(true, 'ws-1')
      }),
      flush: vi.fn().mockResolvedValue(undefined),
      exportWorkspaceSnapshot: vi.fn().mockResolvedValue(buildWorkspaceSnapshot()),
      importWorkspaceSnapshot: vi.fn().mockResolvedValue(buildWorkspaceSnapshot()),
      dispose: vi.fn(),
    })

    render(<AppShell />)

    expect(screen.getByRole('alert').textContent).toContain('Previous hosted workspace error')
    fireEvent.click(screen.getByRole('button', { name: /create empty workspace/i }))

    await waitFor(() => {
      expect(createWorkspace).toHaveBeenCalledWith({})
    })
    await waitFor(() => {
      expect(screen.getByTestId('app-shell-outlet')).toBeTruthy()
    })

    expect(clearError).toHaveBeenCalled()
    expect(useHostedAppStore.getState().lastError).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('abandons a pending migration import when the user switches workspaces mid-load', async () => {
    const migrationSnapshot = buildWorkspaceSnapshot()
    const importedWorkspace = {
      workspaceId: 'ws-import',
      name: 'Imported Workspace',
      revision: 0,
      updatedAt: '2026-03-14T12:21:00.000Z',
      role: 'owner' as const,
      isDefault: true,
    }
    const recoveryWorkspace = {
      workspaceId: 'ws-recovery',
      name: 'Recovery Workspace',
      revision: 1,
      updatedAt: '2026-03-14T12:22:00.000Z',
      role: 'owner' as const,
      isDefault: false,
    }

    let resolveFirstStart!: () => void
    const runtimeOne = {
      start: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveFirstStart = resolve
          }),
      ),
      flush: vi.fn().mockResolvedValue(undefined),
      exportWorkspaceSnapshot: vi.fn().mockResolvedValue(migrationSnapshot),
      importWorkspaceSnapshot: vi.fn().mockResolvedValue(migrationSnapshot),
      dispose: vi.fn(),
    }
    const runtimeTwo = {
      start: vi.fn(async () => {
        setPersistenceHydration(true, 'ws-recovery')
      }),
      flush: vi.fn().mockResolvedValue(undefined),
      exportWorkspaceSnapshot: vi.fn().mockResolvedValue(migrationSnapshot),
      importWorkspaceSnapshot: vi.fn().mockResolvedValue(migrationSnapshot),
      dispose: vi.fn(),
    }

    const createWorkspace = vi.fn().mockImplementation(async ({ name }: { name?: string }) => {
      useHostedAppStore.setState({
        workspaces: [importedWorkspace, recoveryWorkspace],
        selectedWorkspaceId: importedWorkspace.workspaceId,
        localMigrationSnapshot: migrationSnapshot,
        context: {
          ...hostedContext,
          account: {
            ...hostedContext.account,
            defaultWorkspaceId: importedWorkspace.workspaceId,
          },
          memberships: [
            {
              workspaceId: importedWorkspace.workspaceId,
              role: 'owner',
              isDefault: true,
            },
            {
              workspaceId: recoveryWorkspace.workspaceId,
              role: 'owner',
              isDefault: false,
            },
          ],
        },
      })

      return {
        ...importedWorkspace,
        name: name ?? importedWorkspace.name,
      }
    })

    setHostedStore({
      workspaces: [],
      selectedWorkspaceId: null,
      localMigrationSnapshot: migrationSnapshot,
      createWorkspace,
    })

    runtimeMocks.captureLocalWorkspaceSnapshotForMigration.mockResolvedValue(migrationSnapshot)
    runtimeMocks.replacePersistenceRuntime
      .mockImplementationOnce(async () => runtimeOne)
      .mockImplementationOnce(async () => {
        runtimeOne.dispose()
        return runtimeTwo
      })

    render(<AppShell />)
    fireEvent.click(screen.getByRole('button', { name: /import local workspace/i }))

    await waitFor(() => {
      expect(createWorkspace).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(runtimeOne.start).toHaveBeenCalledTimes(1)
    })

    useHostedAppStore.setState({
      workspaces: [importedWorkspace, recoveryWorkspace],
      selectedWorkspaceId: recoveryWorkspace.workspaceId,
      context: {
        ...hostedContext,
        account: {
          ...hostedContext.account,
          defaultWorkspaceId: importedWorkspace.workspaceId,
        },
        memberships: [
          {
            workspaceId: importedWorkspace.workspaceId,
            role: 'owner',
            isDefault: true,
          },
          {
            workspaceId: recoveryWorkspace.workspaceId,
            role: 'owner',
            isDefault: false,
          },
        ],
      },
    })

    await waitFor(() => {
      expect(runtimeMocks.replacePersistenceRuntime).toHaveBeenCalledTimes(2)
    })

    resolveFirstStart()

    await waitFor(() => {
      expect(document.querySelector('.app-topbar-workspace')?.textContent).toContain(
        'Recovery Workspace',
      )
    })

    expect(runtimeOne.importWorkspaceSnapshot).not.toHaveBeenCalled()
  })
})
