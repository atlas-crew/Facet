declare module '../../proxy/facetServer.js' {
  import type { IncomingMessage, Server } from 'node:http'
  import type { JWK } from 'jose'

  interface CreateFacetServerOptions {
    authMode?: 'local' | 'hosted'
    allowedOrigins?: string[]
    proxyApiKey?: string
    persistenceAuthTokens?: Array<{
      token: string
      tenantId: string
      userId: string
      workspaces: string[]
    }>
    persistenceStore?: {
      loadWorkspace: (tenantId: string, workspaceId: string) => unknown
      saveWorkspace: (snapshot: unknown) => unknown
      listWorkspaces: (tenantId: string, workspaceIds: string[]) => unknown[]
    }
    anthropicClient?: {
      messages: {
        create: (params: unknown) => Promise<unknown>
      }
    }
    persistenceActorResolver?: (req: IncomingMessage) => Promise<unknown>
    hostedAuth?: {
      issuer?: string
      audience?: string
      jwksUrl?: string
      jwks?: { keys: JWK[] }
      membershipStore?: {
        getActor: (userId: string) => Promise<unknown>
      }
    }
    now?: () => string
  }

  export function createFacetServer(
    options?: CreateFacetServerOptions,
  ): {
    server: Server
    persistenceStore: NonNullable<CreateFacetServerOptions['persistenceStore']>
  }
}

declare module '../../proxy/persistenceApi.js' {
  import type { IncomingMessage } from 'node:http'
  import type { FacetWorkspaceSnapshot } from '../persistence/contracts'

  export function createInMemoryWorkspaceStore(): {
    loadWorkspace: (tenantId: string, workspaceId: string) => FacetWorkspaceSnapshot | null
    saveWorkspace: (snapshot: FacetWorkspaceSnapshot) => FacetWorkspaceSnapshot
    listWorkspaces: (tenantId: string, workspaceIds: string[]) => FacetWorkspaceSnapshot[]
  }

  export function createTokenActorResolver(authTokens: Array<{
    token: string
    tenantId: string
    userId: string
    workspaces: string[]
  }>): (req: IncomingMessage) => Promise<unknown>
}

declare module '../../proxy/hostedAuth.js' {
  import type { IncomingMessage } from 'node:http'
  import type { JWK } from 'jose'

  export function createInMemoryHostedMembershipStore(actorRecords?: Array<{
    tenantId: string
    accountId: string
    userId: string
    email: string
    workspaces: Array<{
      workspaceId: string
      role: 'owner'
      isDefault?: boolean
    }>
  }>): {
    getActor: (userId: string) => Promise<unknown>
  }

  export function createHostedSessionActorResolver(options: {
    issuer: string
    audience: string
    jwks?: { keys: JWK[] }
    jwksUrl?: string
    membershipStore: {
      getActor: (userId: string) => Promise<unknown>
    }
  }): (req: IncomingMessage) => Promise<unknown>
}
