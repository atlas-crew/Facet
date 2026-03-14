import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildWorkspaceSnapshot } from './fixtures/workspaceSnapshot'

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
  billingSubscription: null,
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
})
