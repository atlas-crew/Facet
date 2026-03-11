export const DEFAULT_DURABLE_SCHEMA_VERSION = 1
export const DEFAULT_LOCAL_WORKSPACE_ID = 'facet-local-workspace'

export interface WorkspaceOwnership {
  workspaceId: string
  tenantId: string | null
  userId: string | null
}

export interface DurableMetadata extends WorkspaceOwnership {
  schemaVersion: number
  revision: number
  createdAt: string
  updatedAt: string
}
