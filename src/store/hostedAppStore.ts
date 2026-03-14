import { create } from 'zustand'
import type { FacetWorkspaceSnapshot } from '../persistence'
import type {
  FacetHostedAccountContext,
  FacetHostedWorkspaceDeleteResponse,
  FacetHostedWorkspaceSummary,
  FacetWorkspaceMembership,
} from '../types/hosted'
import {
  createHostedWorkspace,
  deleteHostedWorkspace,
  fetchHostedAccountContext,
  listHostedWorkspaces,
  renameHostedWorkspace,
} from '../utils/hostedAccountClient'
import { getHostedApiBaseUrl } from '../utils/hostedApi'
import { getFacetDeploymentMode, getHostedAccessToken } from '../utils/hostedSession'

type HostedAppBootstrapStatus = 'idle' | 'loading' | 'ready' | 'auth-required' | 'error'

type HostedMutationState = 'creating' | 'renaming' | 'deleting' | null

interface HostedClientConfig {
  endpoint: string
  bearerToken: string
}

export interface HostedAppState {
  deploymentMode: 'hosted' | 'self-hosted'
  bootstrapStatus: HostedAppBootstrapStatus
  mutationState: HostedMutationState
  endpoint: string
  bearerToken: string | null
  context: FacetHostedAccountContext | null
  workspaces: FacetHostedWorkspaceSummary[]
  selectedWorkspaceId: string | null
  localMigrationSnapshot: FacetWorkspaceSnapshot | null
  lastError: string | null
  bootstrap: (options?: { localMigrationSnapshot?: FacetWorkspaceSnapshot | null }) => Promise<void>
  selectWorkspace: (workspaceId: string | null) => void
  refresh: () => Promise<void>
  createWorkspace: (input?: {
    name?: string
    workspaceId?: string
  }) => Promise<FacetHostedWorkspaceSummary>
  renameWorkspace: (workspaceId: string, name: string) => Promise<FacetHostedWorkspaceSummary>
  deleteWorkspace: (workspaceId: string) => Promise<FacetHostedWorkspaceDeleteResponse>
  reportError: (message: string) => void
  clearError: () => void
}

const sortWorkspaces = (workspaces: FacetHostedWorkspaceSummary[]) =>
  [...workspaces].sort((left, right) => {
    if (left.isDefault !== right.isDefault) {
      return left.isDefault ? -1 : 1
    }

    return left.name.localeCompare(right.name)
  })

const deriveMemberships = (workspaces: FacetHostedWorkspaceSummary[]): FacetWorkspaceMembership[] =>
  workspaces.map(({ workspaceId, role, isDefault }) => ({
    workspaceId,
    role,
    isDefault,
  }))

const resolveSelectedWorkspaceId = (
  context: FacetHostedAccountContext,
  workspaces: FacetHostedWorkspaceSummary[],
  selectedWorkspaceId: string | null,
) => {
  if (selectedWorkspaceId && workspaces.some((workspace) => workspace.workspaceId === selectedWorkspaceId)) {
    return selectedWorkspaceId
  }

  return (
    context.account.defaultWorkspaceId ??
    workspaces.find((workspace) => workspace.isDefault)?.workspaceId ??
    workspaces[0]?.workspaceId ??
    null
  )
}

const resolveHostedClientConfig = (state: HostedAppState): HostedClientConfig => {
  if (!state.bearerToken) {
    throw new Error('Hosted session is not available.')
  }

  return {
    endpoint: state.endpoint,
    bearerToken: state.bearerToken,
  }
}

export const useHostedAppStore = create<HostedAppState>((set, get) => ({
  deploymentMode: getFacetDeploymentMode(),
  bootstrapStatus: getFacetDeploymentMode() === 'hosted' ? 'idle' : 'ready',
  mutationState: null,
  endpoint: getHostedApiBaseUrl(),
  bearerToken: null,
  context: null,
  workspaces: [],
  selectedWorkspaceId: null,
  localMigrationSnapshot: null,
  lastError: null,

  bootstrap: async (options = {}) => {
    const deploymentMode = getFacetDeploymentMode()
    if (deploymentMode !== 'hosted') {
      set({
        deploymentMode,
        bootstrapStatus: 'ready',
        endpoint: getHostedApiBaseUrl(),
        bearerToken: null,
        context: null,
        workspaces: [],
        selectedWorkspaceId: null,
        localMigrationSnapshot: null,
        lastError: null,
      })
      return
    }

    set({
      deploymentMode,
      bootstrapStatus: 'loading',
      endpoint: getHostedApiBaseUrl(),
      localMigrationSnapshot: options.localMigrationSnapshot ?? null,
      lastError: null,
    })

    try {
      const bearerToken = await getHostedAccessToken()
      if (!bearerToken) {
        set({
          bearerToken: null,
          bootstrapStatus: 'auth-required',
          context: null,
          workspaces: [],
          selectedWorkspaceId: null,
          lastError: 'Hosted sign-in is required before we can load your account.',
        })
        return
      }

      const endpoint = getHostedApiBaseUrl()
      const client = {
        endpoint,
        bearerToken,
      }
      const [{ context }, { workspaces }] = await Promise.all([
        fetchHostedAccountContext(client),
        listHostedWorkspaces(client),
      ])
      const sortedWorkspaces = sortWorkspaces(workspaces)
      const selectedWorkspaceId = resolveSelectedWorkspaceId(context, sortedWorkspaces, null)

      set({
        deploymentMode,
        bootstrapStatus: 'ready',
        endpoint,
        bearerToken,
        context: {
          ...context,
          memberships: deriveMemberships(sortedWorkspaces),
          account: {
            ...context.account,
            defaultWorkspaceId:
              sortedWorkspaces.find((workspace) => workspace.isDefault)?.workspaceId ??
              context.account.defaultWorkspaceId,
          },
        },
        workspaces: sortedWorkspaces,
        selectedWorkspaceId,
        lastError: null,
      })
    } catch (error) {
      set({
        bootstrapStatus: 'error',
        bearerToken: null,
        context: null,
        workspaces: [],
        selectedWorkspaceId: null,
        lastError: error instanceof Error ? error.message : 'Failed to bootstrap hosted account.',
      })
    }
  },

  selectWorkspace: (workspaceId) => {
    set((state) => ({
      selectedWorkspaceId:
        workspaceId && state.workspaces.some((workspace) => workspace.workspaceId === workspaceId)
          ? workspaceId
          : state.selectedWorkspaceId,
      lastError: null,
    }))
  },

  refresh: async () => {
    const state = get()
    if (state.deploymentMode !== 'hosted' || !state.bearerToken) {
      return
    }

    try {
      const client = resolveHostedClientConfig(state)
      const [{ context }, { workspaces }] = await Promise.all([
        fetchHostedAccountContext(client),
        listHostedWorkspaces(client),
      ])
      const sortedWorkspaces = sortWorkspaces(workspaces)

      set((current) => ({
        context: {
          ...context,
          memberships: deriveMemberships(sortedWorkspaces),
        },
        workspaces: sortedWorkspaces,
        selectedWorkspaceId: resolveSelectedWorkspaceId(
          context,
          sortedWorkspaces,
          current.selectedWorkspaceId,
        ),
        lastError: null,
      }))
    } catch (error) {
      set({
        lastError:
          error instanceof Error ? error.message : 'Failed to refresh hosted workspace directory.',
      })
      throw error
    }
  },

  createWorkspace: async (input = {}) => {
    set({ mutationState: 'creating', lastError: null })

    try {
      const client = resolveHostedClientConfig(get())
      const response = await createHostedWorkspace(client, input)
      const createdWorkspace = response.workspace

      set((state) => {
        const workspaces = sortWorkspaces(
          state.workspaces
            .filter((workspace) => workspace.workspaceId !== createdWorkspace.workspaceId)
            .concat(createdWorkspace),
        )

        return {
          mutationState: null,
          workspaces,
          selectedWorkspaceId: createdWorkspace.workspaceId,
          context: state.context
            ? {
                ...state.context,
                memberships: deriveMemberships(workspaces),
                account: {
                  ...state.context.account,
                  defaultWorkspaceId:
                    workspaces.find((workspace) => workspace.isDefault)?.workspaceId ??
                    state.context.account.defaultWorkspaceId,
                },
              }
            : state.context,
          lastError: null,
        }
      })

      return createdWorkspace
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create hosted workspace.'
      set({
        mutationState: null,
        lastError: message,
      })
      throw error
    }
  },

  renameWorkspace: async (workspaceId, name) => {
    set({ mutationState: 'renaming', lastError: null })

    try {
      const client = resolveHostedClientConfig(get())
      const response = await renameHostedWorkspace(client, workspaceId, name)
      const renamedWorkspace = response.workspace

      set((state) => {
        const workspaces = sortWorkspaces(
          state.workspaces.map((workspace) =>
            workspace.workspaceId === workspaceId ? renamedWorkspace : workspace,
          ),
        )

        return {
          mutationState: null,
          workspaces,
          context: state.context
            ? {
                ...state.context,
                memberships: deriveMemberships(workspaces),
              }
            : state.context,
          lastError: null,
        }
      })

      return renamedWorkspace
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to rename hosted workspace.'
      set({
        mutationState: null,
        lastError: message,
      })
      throw error
    }
  },

  deleteWorkspace: async (workspaceId) => {
    set({ mutationState: 'deleting', lastError: null })

    try {
      const client = resolveHostedClientConfig(get())
      const response = await deleteHostedWorkspace(client, workspaceId)

      set((state) => {
        const workspaces = sortWorkspaces(
          state.workspaces.filter((workspace) => workspace.workspaceId !== workspaceId),
        )
        const nextDefaultWorkspaceId =
          response.defaultWorkspaceId ??
          workspaces.find((workspace) => workspace.isDefault)?.workspaceId ??
          workspaces[0]?.workspaceId ??
          null

        return {
          mutationState: null,
          workspaces,
          selectedWorkspaceId:
            state.selectedWorkspaceId === workspaceId
              ? nextDefaultWorkspaceId
              : state.selectedWorkspaceId,
          context: state.context
            ? {
                ...state.context,
                memberships: deriveMemberships(workspaces),
                account: {
                  ...state.context.account,
                  defaultWorkspaceId: nextDefaultWorkspaceId,
                },
              }
            : state.context,
          lastError: null,
        }
      })

      return response
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete hosted workspace.'
      set({
        mutationState: null,
        lastError: message,
      })
      throw error
    }
  },

  reportError: (message) => set({ lastError: message }),

  clearError: () => set({ lastError: null }),
}))
