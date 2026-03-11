import type { DurableMetadata } from '../types/durable'
import {
  DEFAULT_DURABLE_SCHEMA_VERSION,
  DEFAULT_LOCAL_WORKSPACE_ID,
} from '../types/durable'

const now = () => new Date().toISOString()

const normalizeNullableString = (value: unknown): string | null => (
  typeof value === 'string' ? value : null
)

const normalizeNumber = (value: unknown, fallback: number): number => (
  typeof value === 'number' && Number.isFinite(value) ? value : fallback
)

export const ensureDurableMetadata = (
  value: Partial<DurableMetadata> | undefined,
  fallbackTimestamp = now(),
): DurableMetadata => {
  const createdAt = typeof value?.createdAt === 'string' ? value.createdAt : fallbackTimestamp

  return {
    workspaceId:
      typeof value?.workspaceId === 'string' && value.workspaceId.length > 0
        ? value.workspaceId
        : DEFAULT_LOCAL_WORKSPACE_ID,
    tenantId: normalizeNullableString(value?.tenantId),
    userId: normalizeNullableString(value?.userId),
    schemaVersion: normalizeNumber(value?.schemaVersion, DEFAULT_DURABLE_SCHEMA_VERSION),
    revision: normalizeNumber(value?.revision, 0),
    createdAt,
    updatedAt:
      typeof value?.updatedAt === 'string' && value.updatedAt.length > 0
        ? value.updatedAt
        : createdAt,
  }
}

export const createDurableMetadata = (
  timestamp = now(),
  overrides?: Partial<DurableMetadata>,
): DurableMetadata => {
  const base = ensureDurableMetadata(overrides, timestamp)
  return {
    ...base,
    createdAt: timestamp,
    updatedAt: timestamp,
    revision: 0,
  }
}

export const touchDurableMetadata = (
  value: Partial<DurableMetadata> | undefined,
  timestamp = now(),
): DurableMetadata => {
  const current = ensureDurableMetadata(value, timestamp)

  return {
    ...current,
    updatedAt: timestamp,
    revision: current.revision + 1,
  }
}

export const normalizeDurableTimestamp = (
  value: string | undefined,
  fallbackTimestamp = now(),
): string => {
  if (typeof value !== 'string' || value.length === 0) {
    return fallbackTimestamp
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? fallbackTimestamp : parsed.toISOString()
}

export const stripDurableMetadataPatch = <T extends { durableMeta?: unknown }>(
  patch: Partial<T>,
): Omit<Partial<T>, 'durableMeta'> => {
  const restPatch = { ...patch } as Partial<T> & { durableMeta?: unknown }
  delete restPatch.durableMeta
  return restPatch as Omit<Partial<T>, 'durableMeta'>
}
