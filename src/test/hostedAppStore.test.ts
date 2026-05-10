import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FacetApiError } from '../utils/facetApiErrors'
import { buildWorkspaceSnapshot } from './fixtures/workspaceSnapshot'

const createDeferred = <T>() => {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const hostedSessionMocks = vi.hoisted(() => ({
  getFacetDeploymentMode: vi.fn(),
  getHostedAccessToken: vi.fn(),
}))

const hostedAccountClientMocks = vi.hoisted(() => ({
  fetchHostedAccountContext: vi.fn(),
  listHostedWorkspaces: vi.fn(),
  createHostedWorkspace: vi.fn(),
  renameHostedWorkspace: vi.fn(),
  deleteHostedWorkspace: vi.fn(),
}))

const hostedApiMocks = vi.hoisted(() => ({
  getHostedApiBaseUrl: vi.fn(),
}))

vi.mock('../utils/hostedSession', () => hostedSessionMocks)
vi.mock('../utils/hostedAccountClient', () => hostedAccountClientMocks)
vi.mock('../utils/hostedApi', () => hostedApiMocks)

const hostedContext = {
  deploymentMode: 'hosted' as const,
  account: {
    tenantId: 'tenant-1',
    accountId: 'account-1',
    deploymentMode: 'hosted' as const,
    defaultWorkspaceId: 'ws-2',
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

const workspaces = [
  {
    workspaceId: 'ws-1',
    name: 'Alpha Workspace',
    revision: 2,
    updatedAt: '2026-03-14T12:00:00.000Z',
    role: 'owner' as const,
    isDefault: false,
  },
  {
    workspaceId: 'ws-2',
    name: 'Bravo Workspace',
    revision: 3,
    updatedAt: '2026-03-14T12:05:00.000Z',
    role: 'owner' as const,
    isDefault: true,
  },
]

describe('hostedAppStore', () => {
  beforeEach(() => {
    vi.resetModules()
    hostedSessionMocks.getFacetDeploymentMode.mockReset()
    hostedSessionMocks.getHostedAccessToken.mockReset()
    hostedAccountClientMocks.fetchHostedAccountContext.mockReset()
    hostedAccountClientMocks.listHostedWorkspaces.mockReset()
    hostedAccountClientMocks.createHostedWorkspace.mockReset()
    hostedAccountClientMocks.renameHostedWorkspace.mockReset()
    hostedAccountClientMocks.deleteHostedWorkspace.mockReset()
    hostedApiMocks.getHostedApiBaseUrl.mockReset()

    hostedSessionMocks.getFacetDeploymentMode.mockReturnValue('hosted')
    hostedSessionMocks.getHostedAccessToken.mockResolvedValue('token-123')
    hostedApiMocks.getHostedApiBaseUrl.mockReturnValue('https://facet.example')
    hostedAccountClientMocks.fetchHostedAccountContext.mockResolvedValue({
      context: hostedContext,
    })
    hostedAccountClientMocks.listHostedWorkspaces.mockResolvedValue({
      workspaces,
    })
  })

  it('bootstraps hosted context and selects the default workspace', async () => {
    const { useHostedAppStore } = await import('../store/hostedAppStore')

    await useHostedAppStore.getState().bootstrap()

    const state = useHostedAppStore.getState()
    expect(state.bootstrapStatus).toBe('ready')
    expect(state.endpoint).toBe('https://facet.example')
    expect(state.selectedWorkspaceId).toBe('ws-2')
    expect(state.context?.memberships).toEqual([
      {
        workspaceId: 'ws-2',
        role: 'owner',
        isDefault: true,
      },
      {
        workspaceId: 'ws-1',
        role: 'owner',
        isDefault: false,
      },
    ])
  })

  it('sorts non-default hosted workspaces alphabetically after the default workspace', async () => {
    hostedAccountClientMocks.listHostedWorkspaces.mockResolvedValue({
      workspaces: [
        {
          workspaceId: 'ws-z',
          name: 'Zulu Workspace',
          revision: 1,
          updatedAt: '2026-03-14T12:00:00.000Z',
          role: 'owner',
          isDefault: false,
        },
        {
          workspaceId: 'ws-b',
          name: 'Bravo Workspace',
          revision: 1,
          updatedAt: '2026-03-14T12:00:00.000Z',
          role: 'owner',
          isDefault: false,
        },
        {
          workspaceId: 'ws-a',
          name: 'Alpha Workspace',
          revision: 1,
          updatedAt: '2026-03-14T12:00:00.000Z',
          role: 'owner',
          isDefault: true,
        },
      ],
    })
    const { useHostedAppStore } = await import('../store/hostedAppStore')

    await useHostedAppStore.getState().bootstrap()

    expect(useHostedAppStore.getState().workspaces.map((workspace) => workspace.workspaceId)).toEqual([
      'ws-a',
      'ws-b',
      'ws-z',
    ])
  })

  it('surfaces auth-required state when no hosted session token exists', async () => {
    hostedSessionMocks.getHostedAccessToken.mockResolvedValue(null)
    const { useHostedAppStore } = await import('../store/hostedAppStore')

    await useHostedAppStore.getState().bootstrap()

    expect(useHostedAppStore.getState()).toMatchObject({
      bootstrapStatus: 'auth-required',
      bearerToken: null,
      selectedWorkspaceId: null,
    })
  })

  it('treats hosted auth API failures as auth-required bootstrap state', async () => {
    hostedAccountClientMocks.fetchHostedAccountContext.mockRejectedValue(
      new FacetApiError('Hosted session expired (401)', {
        status: 401,
        code: 'auth_required',
      }),
    )
    const { useHostedAppStore } = await import('../store/hostedAppStore')

    await useHostedAppStore.getState().bootstrap()

    expect(useHostedAppStore.getState()).toMatchObject({
      bootstrapStatus: 'auth-required',
      lastErrorCode: 'auth_required',
      lastError: 'Hosted session expired (401)',
    })
  })

  it('resets to local-ready state when deployment mode is self-hosted', async () => {
    hostedSessionMocks.getFacetDeploymentMode.mockReturnValue('self-hosted')
    const { useHostedAppStore } = await import('../store/hostedAppStore')

    useHostedAppStore.setState({
      deploymentMode: 'hosted',
      bootstrapStatus: 'error',
      bearerToken: 'token-123',
      context: hostedContext,
      workspaces,
      selectedWorkspaceId: 'ws-2',
      localMigrationSnapshot: buildWorkspaceSnapshot(),
      lastError: 'Previous hosted failure',
    })

    await useHostedAppStore.getState().bootstrap({
      localMigrationSnapshot: buildWorkspaceSnapshot(),
    })

    expect(useHostedAppStore.getState()).toMatchObject({
      deploymentMode: 'self-hosted',
      bootstrapStatus: 'ready',
      bearerToken: null,
      context: null,
      workspaces: [],
      selectedWorkspaceId: null,
      localMigrationSnapshot: null,
      lastError: null,
    })
  })

  it('surfaces bootstrap failures from hosted account loading', async () => {
    hostedAccountClientMocks.fetchHostedAccountContext.mockRejectedValue(
      new Error('Hosted account lookup failed'),
    )
    const { useHostedAppStore } = await import('../store/hostedAppStore')

    await useHostedAppStore.getState().bootstrap()

    expect(useHostedAppStore.getState()).toMatchObject({
      bootstrapStatus: 'error',
      bearerToken: null,
      context: null,
      workspaces: [],
      selectedWorkspaceId: null,
      lastError: 'Hosted account lookup failed',
    })
  })

  it('retains billing-state bootstrap failures distinctly from generic errors', async () => {
    hostedAccountClientMocks.fetchHostedAccountContext.mockRejectedValue(
      new FacetApiError('Hosted billing state unavailable (500)', {
        status: 500,
        code: 'billing_state_error',
      }),
    )
    const { useHostedAppStore } = await import('../store/hostedAppStore')

    await useHostedAppStore.getState().bootstrap()

    expect(useHostedAppStore.getState()).toMatchObject({
      bootstrapStatus: 'error',
      lastErrorCode: 'billing_state_error',
      lastError: 'Hosted billing state unavailable (500)',
    })
  })

  it('retains entitlement-related bootstrap reasons for recovery UX', async () => {
    hostedAccountClientMocks.fetchHostedAccountContext.mockRejectedValue(
      new FacetApiError('Upgrade required for hosted access (402)', {
        status: 402,
        code: 'ai_access_denied',
        reason: 'upgrade_required',
      }),
    )
    const { useHostedAppStore } = await import('../store/hostedAppStore')

    await useHostedAppStore.getState().bootstrap()

    expect(useHostedAppStore.getState()).toMatchObject({
      bootstrapStatus: 'error',
      lastErrorCode: 'ai_access_denied',
      lastErrorReason: 'upgrade_required',
      lastError: 'Upgrade required for hosted access (402)',
    })
  })

  it('refreshes workspace listings while preserving or falling back selection', async () => {
    const { useHostedAppStore } = await import('../store/hostedAppStore')
    await useHostedAppStore.getState().bootstrap()
    useHostedAppStore.getState().selectWorkspace('ws-1')

    hostedAccountClientMocks.fetchHostedAccountContext.mockResolvedValue({
      context: {
        ...hostedContext,
        account: {
          ...hostedContext.account,
          defaultWorkspaceId: 'ws-1',
        },
      },
    })
    hostedAccountClientMocks.listHostedWorkspaces.mockResolvedValue({
      workspaces: [
        {
          workspaceId: 'ws-1',
          name: 'Alpha Workspace Renamed',
          revision: 4,
          updatedAt: '2026-03-14T12:15:00.000Z',
          role: 'owner',
          isDefault: true,
        },
        {
          workspaceId: 'ws-3',
          name: 'Charlie Workspace',
          revision: 1,
          updatedAt: '2026-03-14T12:16:00.000Z',
          role: 'owner',
          isDefault: false,
        },
      ],
    })

    await useHostedAppStore.getState().refresh()

    expect(useHostedAppStore.getState().selectedWorkspaceId).toBe('ws-1')
    expect(useHostedAppStore.getState().workspaces.map((workspace) => workspace.workspaceId)).toEqual([
      'ws-1',
      'ws-3',
    ])

    hostedAccountClientMocks.fetchHostedAccountContext.mockResolvedValue({
      context: {
        ...hostedContext,
        account: {
          ...hostedContext.account,
          defaultWorkspaceId: 'ws-3',
        },
      },
    })
    hostedAccountClientMocks.listHostedWorkspaces.mockResolvedValue({
      workspaces: [
        {
          workspaceId: 'ws-3',
          name: 'Charlie Workspace',
          revision: 2,
          updatedAt: '2026-03-14T12:17:00.000Z',
          role: 'owner',
          isDefault: true,
        },
      ],
    })

    await useHostedAppStore.getState().refresh()

    expect(useHostedAppStore.getState().selectedWorkspaceId).toBe('ws-3')
    expect(useHostedAppStore.getState().context?.account.defaultWorkspaceId).toBe('ws-3')
  })

  it('returns from refresh without network calls when not hosted or missing a token', async () => {
    const { useHostedAppStore } = await import('../store/hostedAppStore')

    useHostedAppStore.setState({
      deploymentMode: 'self-hosted',
      bearerToken: null,
    })
    await expect(useHostedAppStore.getState().refresh()).resolves.toBeUndefined()

    useHostedAppStore.setState({
      deploymentMode: 'hosted',
      bearerToken: null,
    })
    await expect(useHostedAppStore.getState().refresh()).resolves.toBeUndefined()

    expect(hostedAccountClientMocks.fetchHostedAccountContext).not.toHaveBeenCalled()
    expect(hostedAccountClientMocks.listHostedWorkspaces).not.toHaveBeenCalled()
  })

  it('stores refresh failures for recovery UI', async () => {
    const { useHostedAppStore } = await import('../store/hostedAppStore')
    await useHostedAppStore.getState().bootstrap()

    hostedAccountClientMocks.listHostedWorkspaces.mockRejectedValue(
      new Error('Hosted directory refresh failed'),
    )

    await expect(useHostedAppStore.getState().refresh()).rejects.toThrow(
      'Hosted directory refresh failed',
    )
    expect(useHostedAppStore.getState().lastError).toBe('Hosted directory refresh failed')
  })

  it('stores offline refresh failures with a structured error code', async () => {
    const { useHostedAppStore } = await import('../store/hostedAppStore')
    await useHostedAppStore.getState().bootstrap()

    hostedAccountClientMocks.listHostedWorkspaces.mockRejectedValue(
      new FacetApiError('Facet could not reach the network.', {
        status: 0,
        code: 'offline',
      }),
    )

    await expect(useHostedAppStore.getState().refresh()).rejects.toThrow(
      'Facet could not reach the network.',
    )
    expect(useHostedAppStore.getState()).toMatchObject({
      lastError: 'Facet could not reach the network.',
      lastErrorCode: 'offline',
    })
  })

  it('stores billing-issue refresh failures with a structured reason', async () => {
    const { useHostedAppStore } = await import('../store/hostedAppStore')
    await useHostedAppStore.getState().bootstrap()

    hostedAccountClientMocks.listHostedWorkspaces.mockRejectedValue(
      new FacetApiError('Billing issue on hosted account (402)', {
        status: 402,
        code: 'ai_access_denied',
        reason: 'billing_issue',
      }),
    )

    await expect(useHostedAppStore.getState().refresh()).rejects.toThrow(
      'Billing issue on hosted account (402)',
    )
    expect(useHostedAppStore.getState()).toMatchObject({
      lastError: 'Billing issue on hosted account (402)',
      lastErrorCode: 'ai_access_denied',
      lastErrorReason: 'billing_issue',
    })
  })

  it('ignores stale bootstrap results when a newer bootstrap resolves first', async () => {
    const firstContext = createDeferred<{ context: typeof hostedContext }>()
    const firstDirectory = createDeferred<{ workspaces: typeof workspaces }>()
    const secondContext = createDeferred<{ context: typeof hostedContext }>()
    const secondDirectory = createDeferred<{ workspaces: typeof workspaces }>()
    const { useHostedAppStore } = await import('../store/hostedAppStore')

    hostedAccountClientMocks.fetchHostedAccountContext
      .mockImplementationOnce(() => firstContext.promise)
      .mockImplementationOnce(() => secondContext.promise)
    hostedAccountClientMocks.listHostedWorkspaces
      .mockImplementationOnce(() => firstDirectory.promise)
      .mockImplementationOnce(() => secondDirectory.promise)

    const firstBootstrap = useHostedAppStore.getState().bootstrap({
      localMigrationSnapshot: buildWorkspaceSnapshot({
        workspace: { id: 'local-1', name: 'Local One', revision: 1, updatedAt: '2026-03-14T12:00:00.000Z' },
      }),
    })
    await vi.waitFor(() => {
      expect(hostedAccountClientMocks.fetchHostedAccountContext).toHaveBeenCalledTimes(1)
      expect(hostedAccountClientMocks.listHostedWorkspaces).toHaveBeenCalledTimes(1)
    })
    const secondBootstrap = useHostedAppStore.getState().bootstrap({
      localMigrationSnapshot: buildWorkspaceSnapshot({
        workspace: { id: 'local-2', name: 'Local Two', revision: 2, updatedAt: '2026-03-14T12:01:00.000Z' },
      }),
    })

    secondContext.resolve({
      context: {
        ...hostedContext,
        account: {
          ...hostedContext.account,
          defaultWorkspaceId: 'ws-9',
        },
      },
    })
    secondDirectory.resolve({
      workspaces: [
        {
          workspaceId: 'ws-9',
          name: 'Newest Workspace',
          revision: 1,
          updatedAt: '2026-03-14T12:20:00.000Z',
          role: 'owner',
          isDefault: true,
        },
      ],
    })
    await secondBootstrap

    expect(useHostedAppStore.getState()).toMatchObject({
      bootstrapStatus: 'ready',
      selectedWorkspaceId: 'ws-9',
      localMigrationSnapshot: expect.objectContaining({
        workspace: expect.objectContaining({ id: 'local-2' }),
      }),
    })

    firstContext.resolve({ context: hostedContext })
    firstDirectory.resolve({ workspaces })
    await firstBootstrap

    expect(useHostedAppStore.getState()).toMatchObject({
      bootstrapStatus: 'ready',
      selectedWorkspaceId: 'ws-9',
      workspaces: [
        expect.objectContaining({
          workspaceId: 'ws-9',
          name: 'Newest Workspace',
        }),
      ],
      localMigrationSnapshot: expect.objectContaining({
        workspace: expect.objectContaining({ id: 'local-2' }),
      }),
    })
  })

  it('ignores stale hosted bootstrap results after switching to self-hosted mode', async () => {
    const firstContext = createDeferred<{ context: typeof hostedContext }>()
    const firstDirectory = createDeferred<{ workspaces: typeof workspaces }>()
    const { useHostedAppStore } = await import('../store/hostedAppStore')

    hostedAccountClientMocks.fetchHostedAccountContext.mockImplementationOnce(() => firstContext.promise)
    hostedAccountClientMocks.listHostedWorkspaces.mockImplementationOnce(() => firstDirectory.promise)

    const firstBootstrap = useHostedAppStore.getState().bootstrap()
    await vi.waitFor(() => {
      expect(hostedAccountClientMocks.fetchHostedAccountContext).toHaveBeenCalledTimes(1)
      expect(hostedAccountClientMocks.listHostedWorkspaces).toHaveBeenCalledTimes(1)
    })

    hostedSessionMocks.getFacetDeploymentMode.mockReturnValue('self-hosted')
    await useHostedAppStore.getState().bootstrap()

    firstContext.resolve({ context: hostedContext })
    firstDirectory.resolve({ workspaces })
    await firstBootstrap

    expect(useHostedAppStore.getState()).toMatchObject({
      deploymentMode: 'self-hosted',
      bootstrapStatus: 'ready',
      bearerToken: null,
      context: null,
      workspaces: [],
      selectedWorkspaceId: null,
    })
  })

  it('ignores stale refresh failures when a newer refresh succeeds', async () => {
    const { useHostedAppStore } = await import('../store/hostedAppStore')
    await useHostedAppStore.getState().bootstrap()

    const firstContext = createDeferred<{ context: typeof hostedContext }>()
    const firstDirectory = createDeferred<{ workspaces: typeof workspaces }>()
    const secondContext = createDeferred<{ context: typeof hostedContext }>()
    const secondDirectory = createDeferred<{ workspaces: typeof workspaces }>()

    hostedAccountClientMocks.fetchHostedAccountContext
      .mockImplementationOnce(() => firstContext.promise)
      .mockImplementationOnce(() => secondContext.promise)
    hostedAccountClientMocks.listHostedWorkspaces
      .mockImplementationOnce(() => firstDirectory.promise)
      .mockImplementationOnce(() => secondDirectory.promise)

    const firstRefresh = useHostedAppStore.getState().refresh()
    const secondRefresh = useHostedAppStore.getState().refresh()

    secondContext.resolve({
      context: {
        ...hostedContext,
        account: {
          ...hostedContext.account,
          defaultWorkspaceId: 'ws-3',
        },
      },
    })
    secondDirectory.resolve({
      workspaces: [
        {
          workspaceId: 'ws-3',
          name: 'Recovered Workspace',
          revision: 1,
          updatedAt: '2026-03-14T12:30:00.000Z',
          role: 'owner',
          isDefault: true,
        },
      ],
    })
    await secondRefresh

    firstContext.resolve({ context: hostedContext })
    firstDirectory.reject(new Error('Stale refresh failed'))
    await expect(firstRefresh).resolves.toBeUndefined()

    expect(useHostedAppStore.getState()).toMatchObject({
      selectedWorkspaceId: 'ws-3',
      workspaces: [
        expect.objectContaining({
          workspaceId: 'ws-3',
          name: 'Recovered Workspace',
        }),
      ],
      lastError: null,
      lastErrorCode: null,
      lastErrorReason: null,
    })
  })

  it('ignores invalid workspace selections and clears transient errors on valid selection', async () => {
    const { useHostedAppStore } = await import('../store/hostedAppStore')
    await useHostedAppStore.getState().bootstrap()

    useHostedAppStore.setState({
      selectedWorkspaceId: 'ws-2',
      lastError: 'Previous workspace error',
      lastErrorCode: 'offline',
      lastErrorReason: 'billing_issue',
    })

    useHostedAppStore.getState().selectWorkspace('missing-workspace')
    expect(useHostedAppStore.getState().selectedWorkspaceId).toBe('ws-2')

    useHostedAppStore.getState().selectWorkspace(null)
    expect(useHostedAppStore.getState().selectedWorkspaceId).toBe('ws-2')

    useHostedAppStore.getState().selectWorkspace('ws-1')
    expect(useHostedAppStore.getState()).toMatchObject({
      selectedWorkspaceId: 'ws-1',
      lastError: null,
      lastErrorCode: null,
      lastErrorReason: null,
    })
  })

  it('updates workspace directory state for create, rename, and delete mutations', async () => {
    const { useHostedAppStore } = await import('../store/hostedAppStore')
    await useHostedAppStore.getState().bootstrap()

    hostedAccountClientMocks.createHostedWorkspace.mockResolvedValue({
      workspace: {
        workspaceId: 'ws-3',
        name: 'Created Workspace',
        revision: 0,
        updatedAt: '2026-03-14T12:10:00.000Z',
        role: 'owner',
        isDefault: false,
      },
    })
    hostedAccountClientMocks.renameHostedWorkspace.mockResolvedValue({
      workspace: {
        workspaceId: 'ws-3',
        name: 'Renamed Workspace',
        revision: 1,
        updatedAt: '2026-03-14T12:11:00.000Z',
        role: 'owner',
        isDefault: false,
      },
    })
    hostedAccountClientMocks.deleteHostedWorkspace.mockResolvedValue({
      deletedWorkspaceId: 'ws-3',
      defaultWorkspaceId: 'ws-2',
    })

    const created = await useHostedAppStore.getState().createWorkspace({
      name: 'Created Workspace',
    })
    expect(created.workspaceId).toBe('ws-3')
    expect(useHostedAppStore.getState().selectedWorkspaceId).toBe('ws-3')

    const renamed = await useHostedAppStore.getState().renameWorkspace('ws-3', 'Renamed Workspace')
    expect(renamed.name).toBe('Renamed Workspace')
    expect(
      useHostedAppStore.getState().workspaces.find((workspace) => workspace.workspaceId === 'ws-3')
        ?.name,
    ).toBe('Renamed Workspace')

    await useHostedAppStore.getState().deleteWorkspace('ws-3')
    expect(useHostedAppStore.getState().workspaces.map((workspace) => workspace.workspaceId)).toEqual([
      'ws-2',
      'ws-1',
    ])
    expect(useHostedAppStore.getState().selectedWorkspaceId).toBe('ws-2')
  })

  it('handles deleting the final workspace without leaving a dangling selection', async () => {
    const { useHostedAppStore } = await import('../store/hostedAppStore')
    await useHostedAppStore.getState().bootstrap()

    useHostedAppStore.setState({
      workspaces: [
        {
          workspaceId: 'ws-2',
          name: 'Bravo Workspace',
          revision: 3,
          updatedAt: '2026-03-14T12:05:00.000Z',
          role: 'owner',
          isDefault: true,
        },
      ],
      selectedWorkspaceId: 'ws-2',
      context: {
        ...hostedContext,
        memberships: [
          {
            workspaceId: 'ws-2',
            role: 'owner',
            isDefault: true,
          },
        ],
        account: {
          ...hostedContext.account,
          defaultWorkspaceId: 'ws-2',
        },
      },
    })

    hostedAccountClientMocks.deleteHostedWorkspace.mockResolvedValue({
      deletedWorkspaceId: 'ws-2',
      defaultWorkspaceId: null,
    })

    await useHostedAppStore.getState().deleteWorkspace('ws-2')

    expect(useHostedAppStore.getState()).toMatchObject({
      workspaces: [],
      selectedWorkspaceId: null,
    })
    expect(useHostedAppStore.getState().context?.account.defaultWorkspaceId).toBeNull()
    expect(useHostedAppStore.getState().context?.memberships).toEqual([])
  })

  it('cleans up mutation state when a create request fails', async () => {
    const { useHostedAppStore } = await import('../store/hostedAppStore')
    await useHostedAppStore.getState().bootstrap()
    hostedAccountClientMocks.createHostedWorkspace.mockRejectedValue(new Error('Create failed'))

    await expect(
      useHostedAppStore.getState().createWorkspace({
        name: 'Broken Workspace',
      }),
    ).rejects.toThrow('Create failed')

    expect(useHostedAppStore.getState()).toMatchObject({
      mutationState: null,
      lastError: 'Create failed',
    })
  })

  it('rejects hosted mutations without a bearer token and resets mutation state', async () => {
    const { useHostedAppStore } = await import('../store/hostedAppStore')
    await useHostedAppStore.getState().bootstrap()
    useHostedAppStore.setState({ bearerToken: null })

    await expect(
      useHostedAppStore.getState().createWorkspace({
        name: 'Broken Workspace',
      }),
    ).rejects.toThrow('Hosted session is not available.')
    expect(useHostedAppStore.getState()).toMatchObject({
      mutationState: null,
      lastError: 'Hosted session is not available.',
    })

    await expect(useHostedAppStore.getState().renameWorkspace('ws-1', 'Broken Rename')).rejects.toThrow(
      'Hosted session is not available.',
    )
    expect(useHostedAppStore.getState().mutationState).toBeNull()

    await expect(useHostedAppStore.getState().deleteWorkspace('ws-1')).rejects.toThrow(
      'Hosted session is not available.',
    )
    expect(useHostedAppStore.getState().mutationState).toBeNull()
  })

  it('cleans up mutation state when a rename request fails', async () => {
    const { useHostedAppStore } = await import('../store/hostedAppStore')
    await useHostedAppStore.getState().bootstrap()
    hostedAccountClientMocks.renameHostedWorkspace.mockRejectedValue(new Error('Rename failed'))

    await expect(
      useHostedAppStore.getState().renameWorkspace('ws-1', 'Broken Rename'),
    ).rejects.toThrow('Rename failed')

    expect(useHostedAppStore.getState()).toMatchObject({
      mutationState: null,
      lastError: 'Rename failed',
    })
  })

  it('cleans up mutation state when a delete request fails', async () => {
    const { useHostedAppStore } = await import('../store/hostedAppStore')
    await useHostedAppStore.getState().bootstrap()
    hostedAccountClientMocks.deleteHostedWorkspace.mockRejectedValue(new Error('Delete failed'))

    await expect(useHostedAppStore.getState().deleteWorkspace('ws-1')).rejects.toThrow(
      'Delete failed',
    )

    expect(useHostedAppStore.getState()).toMatchObject({
      mutationState: null,
      lastError: 'Delete failed',
    })
  })

  it('reports and clears manual error state', async () => {
    const { useHostedAppStore } = await import('../store/hostedAppStore')

    useHostedAppStore.getState().reportError('Manual error', 'manual_code', 'billing_issue')
    expect(useHostedAppStore.getState()).toMatchObject({
      lastError: 'Manual error',
      lastErrorCode: 'manual_code',
      lastErrorReason: 'billing_issue',
    })

    useHostedAppStore.getState().clearError()
    expect(useHostedAppStore.getState()).toMatchObject({
      lastError: null,
      lastErrorCode: null,
      lastErrorReason: null,
    })
  })
})
