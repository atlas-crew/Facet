import { FACET_WORKSPACE_SNAPSHOT_VERSION } from './contracts'
import type { FacetWorkspaceSnapshot } from './contracts'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const assertValidArtifactPayload = (
  artifactType: keyof FacetWorkspaceSnapshot['artifacts'],
  payload: unknown,
) => {
  if (!isRecord(payload)) {
    throw new Error(`Workspace snapshot has invalid artifacts.${artifactType}.payload shape.`)
  }

  switch (artifactType) {
    case 'resume':
      if (!isRecord(payload.meta) || !Array.isArray(payload.vectors)) {
        throw new Error('Workspace snapshot has invalid artifacts.resume.payload shape.')
      }
      break
    case 'pipeline':
      if (!Array.isArray(payload.entries)) {
        throw new Error('Workspace snapshot has invalid artifacts.pipeline.payload.entries.')
      }
      break
    case 'prep':
      if (!Array.isArray(payload.decks)) {
        throw new Error('Workspace snapshot has invalid artifacts.prep.payload.decks.')
      }
      break
    case 'coverLetters':
      if (!Array.isArray(payload.templates)) {
        throw new Error('Workspace snapshot has invalid artifacts.coverLetters.payload.templates.')
      }
      break
    case 'linkedin':
      if (!Array.isArray(payload.drafts)) {
        throw new Error('Workspace snapshot has invalid artifacts.linkedin.payload.drafts.')
      }
      break
    case 'recruiter':
      if (!Array.isArray(payload.cards)) {
        throw new Error('Workspace snapshot has invalid artifacts.recruiter.payload.cards.')
      }
      break
    case 'debrief':
      if (!Array.isArray(payload.sessions)) {
        throw new Error('Workspace snapshot has invalid artifacts.debrief.payload.sessions.')
      }
      break
    case 'research':
      if (
        (payload.profile !== null && payload.profile !== undefined && !isRecord(payload.profile)) ||
        !Array.isArray(payload.requests) ||
        !Array.isArray(payload.runs)
      ) {
        throw new Error('Workspace snapshot has invalid artifacts.research.payload shape.')
      }
      // feedbackEvents added in TASK-163; optional for backward compatibility with
      // snapshots written before the field existed.
      if (payload.feedbackEvents !== undefined && !Array.isArray(payload.feedbackEvents)) {
        throw new Error(
          'Workspace snapshot has invalid artifacts.research.payload.feedbackEvents (expected array).',
        )
      }
      break
    default: {
      const exhaustiveCheck: never = artifactType
      throw new Error(`Unsupported artifact type: ${String(exhaustiveCheck)}`)
    }
  }
}

export function assertValidWorkspaceSnapshot(
  snapshot: unknown,
): asserts snapshot is FacetWorkspaceSnapshot {
  if (!isRecord(snapshot)) {
    throw new Error('Workspace snapshot must be an object.')
  }

  if (snapshot.snapshotVersion !== FACET_WORKSPACE_SNAPSHOT_VERSION) {
    throw new Error(
      `Unsupported workspace snapshot version: expected ${FACET_WORKSPACE_SNAPSHOT_VERSION}, got ${String(snapshot.snapshotVersion)}`,
    )
  }

  if (!isRecord(snapshot.workspace) || typeof snapshot.workspace.id !== 'string') {
    throw new Error('Workspace snapshot must include a workspace.id string.')
  }

  if (
    typeof snapshot.workspace.name !== 'string' ||
    !isFiniteNumber(snapshot.workspace.revision) ||
    typeof snapshot.workspace.updatedAt !== 'string'
  ) {
    throw new Error('Workspace snapshot must include valid workspace metadata.')
  }

  if (
    (
      snapshot.tenantId !== null &&
      snapshot.tenantId !== undefined &&
      typeof snapshot.tenantId !== 'string'
    ) ||
    (
      snapshot.userId !== null &&
      snapshot.userId !== undefined &&
      typeof snapshot.userId !== 'string'
    ) ||
    typeof snapshot.exportedAt !== 'string'
  ) {
    throw new Error('Workspace snapshot must include valid tenant, user, and export metadata.')
  }

  if (!isRecord(snapshot.artifacts)) {
    throw new Error('Workspace snapshot must include artifacts.')
  }

  for (const key of ['resume', 'pipeline', 'prep', 'coverLetters', 'linkedin', 'recruiter', 'debrief', 'research'] as const) {
    const artifact = snapshot.artifacts[key]

    if (!isRecord(artifact)) {
      throw new Error(`Workspace snapshot is missing artifacts.${key}.`)
    }

    if (artifact.artifactType !== key) {
      throw new Error(`Workspace snapshot has mismatched artifacts.${key}.artifactType.`)
    }

    if (!('payload' in artifact) || artifact.payload == null) {
      throw new Error(`Workspace snapshot is missing artifacts.${key}.payload.`)
    }

    if (
      typeof artifact.artifactId !== 'string' ||
      typeof artifact.workspaceId !== 'string' ||
      !isFiniteNumber(artifact.schemaVersion) ||
      !isFiniteNumber(artifact.revision) ||
      typeof artifact.updatedAt !== 'string'
    ) {
      throw new Error(`Workspace snapshot has invalid artifacts.${key} metadata.`)
    }

    assertValidArtifactPayload(key, artifact.payload)
  }
}
