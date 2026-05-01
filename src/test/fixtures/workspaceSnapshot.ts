import type { FacetWorkspaceSnapshot } from '../../persistence/contracts'

type ForgedWorkspaceSnapshot = Omit<FacetWorkspaceSnapshot, 'artifacts'> & {
  artifacts: Omit<FacetWorkspaceSnapshot['artifacts'], 'resume'> & {
    resume: Omit<FacetWorkspaceSnapshot['artifacts']['resume'], 'artifactType'> & {
      artifactType: string
    }
  }
}

const DEFAULT_WORKSPACE_ID = 'ws-1'
const DEFAULT_TENANT_ID = 'tenant-1'
const DEFAULT_USER_ID = 'user-1'
const DEFAULT_TIMESTAMP = '2026-03-11T12:00:00.000Z'
const DEFAULT_REVISION = 3
const DEFAULT_SCHEMA_VERSION = 1

const FORGED_WORKSPACE_ID = 'forged-workspace'
const FORGED_SCOPE = 'forged'
const FORGED_TENANT_ID = 'forged-tenant'
const FORGED_USER_ID = 'forged-user'
const FORGED_TIMESTAMP = '2020-01-01T00:00:00.000Z'
const FORGED_WORKSPACE_REVISION = 999
const FORGED_ARTIFACT_REVISION = 77
const FORGED_RESUME_SCHEMA_VERSION = 7

function buildArtifact<TType extends FacetWorkspaceSnapshot['artifacts'][keyof FacetWorkspaceSnapshot['artifacts']]['artifactType'], TPayload>(
  artifactType: TType,
  payload: TPayload,
  options: {
    workspaceId?: string
    schemaVersion?: number
    revision?: number
    updatedAt?: string
    artifactId?: string
  } = {},
) {
  const workspaceId = options.workspaceId ?? DEFAULT_WORKSPACE_ID

  return {
    artifactId: options.artifactId ?? `${workspaceId}:${artifactType}`,
    artifactType,
    workspaceId,
    schemaVersion: options.schemaVersion ?? DEFAULT_SCHEMA_VERSION,
    revision: options.revision ?? DEFAULT_REVISION,
    updatedAt: options.updatedAt ?? DEFAULT_TIMESTAMP,
    payload,
  }
}

/**
 * Shared happy-path snapshot fixture for coordinator and remote backend tests.
 * `overrides` only replace top-level fields; nested customizations should use
 * object spreads on the returned snapshot.
 */
export function buildWorkspaceSnapshot(
  overrides: Partial<FacetWorkspaceSnapshot> = {},
): FacetWorkspaceSnapshot {
  return {
    snapshotVersion: 1 as const,
    tenantId: DEFAULT_TENANT_ID,
    userId: DEFAULT_USER_ID,
    workspace: {
      id: DEFAULT_WORKSPACE_ID,
      name: 'Workspace One',
      revision: DEFAULT_REVISION,
      updatedAt: DEFAULT_TIMESTAMP,
    },
    artifacts: {
      resume: buildArtifact('resume', {
        version: 1,
        meta: { name: 'Jane Smith', email: '', phone: '', location: '', links: [] },
        target_lines: [],
        profiles: [],
        skill_groups: [],
        roles: [],
        projects: [],
        education: [],
        certifications: [],
        vectors: [],
        presets: [],
      }),
      pipeline: buildArtifact('pipeline', { entries: [] }),
      jdAnalysis: buildArtifact('jdAnalysis', { analyses: [] }),
      prep: buildArtifact('prep', { decks: [] }),
      coverLetters: buildArtifact('coverLetters', { templates: [] }),
      linkedin: buildArtifact('linkedin', { drafts: [] }),
      recruiter: buildArtifact('recruiter', { cards: [] }),
      debrief: buildArtifact('debrief', { sessions: [] }),
      research: buildArtifact('research', { profile: null, requests: [], runs: [] }),
    },
    exportedAt: DEFAULT_TIMESTAMP,
    ...overrides,
  }
}

/**
 * Deliberately malformed snapshot used by `facetServer.test.ts` to verify the
 * server rewrites client-owned identity and artifact metadata before save.
 *
 * Forged values cover:
 * - tenant, user, workspace, and export metadata
 * - artifact ids, workspace scope, schema version, revisions, and timestamps
 * - a resume artifact with the wrong `artifactType`
 */
export function buildForgedWorkspaceSnapshot(): ForgedWorkspaceSnapshot {
  const base = buildWorkspaceSnapshot()
  const forgedHeader = {
    tenantId: FORGED_TENANT_ID,
    userId: FORGED_USER_ID,
    workspace: {
      id: FORGED_WORKSPACE_ID,
      name: 'Incoming Workspace',
      revision: FORGED_WORKSPACE_REVISION,
      updatedAt: FORGED_TIMESTAMP,
    },
    exportedAt: FORGED_TIMESTAMP,
  } satisfies Partial<FacetWorkspaceSnapshot>

  return {
    ...buildWorkspaceSnapshot(forgedHeader),
    artifacts: {
      ...base.artifacts,
      resume: {
        ...base.artifacts.resume,
        artifactId: `${FORGED_SCOPE}:resume`,
        artifactType: 'pipeline',
        workspaceId: FORGED_SCOPE,
        schemaVersion: FORGED_RESUME_SCHEMA_VERSION,
        revision: FORGED_ARTIFACT_REVISION,
        updatedAt: FORGED_TIMESTAMP,
      },
      pipeline: {
        ...base.artifacts.pipeline,
        artifactId: `${FORGED_SCOPE}:pipeline`,
        workspaceId: FORGED_SCOPE,
        revision: FORGED_ARTIFACT_REVISION,
        updatedAt: FORGED_TIMESTAMP,
      },
      jdAnalysis: {
        ...base.artifacts.jdAnalysis,
        artifactId: `${FORGED_SCOPE}:jdAnalysis`,
        workspaceId: FORGED_SCOPE,
        revision: FORGED_ARTIFACT_REVISION,
        updatedAt: FORGED_TIMESTAMP,
      },
      prep: {
        ...base.artifacts.prep,
        artifactId: `${FORGED_SCOPE}:prep`,
        workspaceId: FORGED_SCOPE,
        revision: FORGED_ARTIFACT_REVISION,
        updatedAt: FORGED_TIMESTAMP,
      },
      coverLetters: {
        ...base.artifacts.coverLetters,
        artifactId: `${FORGED_SCOPE}:coverLetters`,
        workspaceId: FORGED_SCOPE,
        revision: FORGED_ARTIFACT_REVISION,
        updatedAt: FORGED_TIMESTAMP,
      },
      linkedin: {
        ...base.artifacts.linkedin,
        artifactId: `${FORGED_SCOPE}:linkedin`,
        workspaceId: FORGED_SCOPE,
        revision: FORGED_ARTIFACT_REVISION,
        updatedAt: FORGED_TIMESTAMP,
      },
      recruiter: {
        ...base.artifacts.recruiter,
        artifactId: `${FORGED_SCOPE}:recruiter`,
        workspaceId: FORGED_SCOPE,
        revision: FORGED_ARTIFACT_REVISION,
        updatedAt: FORGED_TIMESTAMP,
      },
      debrief: {
        ...base.artifacts.debrief,
        artifactId: `${FORGED_SCOPE}:debrief`,
        workspaceId: FORGED_SCOPE,
        revision: FORGED_ARTIFACT_REVISION,
        updatedAt: FORGED_TIMESTAMP,
      },
      research: {
        ...base.artifacts.research,
        artifactId: `${FORGED_SCOPE}:research`,
        workspaceId: FORGED_SCOPE,
        revision: FORGED_ARTIFACT_REVISION,
        updatedAt: FORGED_TIMESTAMP,
      },
    },
  }
}
