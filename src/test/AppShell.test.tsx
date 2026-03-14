// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { AppShell } from '../components/AppShell'
import { usePersistenceRuntimeStore } from '../persistence/runtime'
import { useHostedAppStore } from '../store/hostedAppStore'
import { useUiStore } from '../store/uiStore'
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
  const actual = await vi.importActual<typeof import('../persistence/runtime')>(
    '../persistence/runtime',
  )

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
vi.mock('../utils/hostedApi', async () => {
  const actual = await vi.importActual<typeof import('../utils/hostedApi')>(
    '../utils/hostedApi',
  )

  return {
    ...actual,
    getHostedPersistenceEndpoint: () => 'https://facet.example/api/persistence',
  }
})
vi.mock('../components/FacetWordmark', () => ({
  FacetGemMark: () => <span>Facet</span>,
}))
vi.mock('../components/WorkspaceBackupReminder', () => ({
  WorkspaceBackupReminder: () => null,
}))
vi.mock('../components/WorkspaceBackupDialog', () => ({
  WorkspaceBackupDialog: () => null,
}))

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
  billingSubscription: null,
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

const setPersistenceHydration = (hydrated: boolean, activeWorkspaceId = 'facet-local-workspace') => {
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

const setHostedStore = (
  overrides: Partial<ReturnType<typeof useHostedAppStore.getState>>,
) => {
  const reportError = vi.fn((message: string) => {
    useHostedAppStore.setState({ lastError: message })
  })
  const clearError = vi.fn(() => {
    useHostedAppStore.setState({ lastError: null })
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
    bootstrap: vi.fn().mockResolvedValue(undefined),
    selectWorkspace: vi.fn((workspaceId: string | null) => {
      useHostedAppStore.setState({ selectedWorkspaceId: workspaceId })
    }),
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
  }
}

describe('AppShell hosted workspace bootstrap', () => {
  beforeEach(() => {
    cleanup()
    vi.restoreAllMocks()

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
      endpoint: 'https://facet.example/api/persistence',
      bearerToken: 'token-123',
    })
    expect(screen.getByText(/workspace: hosted workspace/i)).toBeTruthy()
  })

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
    expect(screen.queryByText(/workspace: hosted workspace/i)).toBeNull()
    expect(screen.getByRole('alert').textContent).toContain('Remote load failed')
    expect(useHostedAppStore.getState().lastError).toBe('Remote load failed')
  })

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
      expect(screen.getByText(/workspace: recovery workspace/i)).toBeTruthy()
    })

    expect(runtimeOne.importWorkspaceSnapshot).not.toHaveBeenCalled()
  })
})
