export const FACET_WORKSPACE_SNAPSHOT_VERSION = 1

export const FACET_ARTIFACT_TYPES = [
  'resume',
  'pipeline',
  'jdAnalysis',
  'prep',
  'coverLetters',
  'linkedin',
  'recruiter',
  'debrief',
  'research',
]

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function cloneValue(value) {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }

  return JSON.parse(JSON.stringify(value))
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`
  }

  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`
  }

  return JSON.stringify(value) ?? 'null'
}

function hashResumeContent(content) {
  // Mirrors src/utils/resumeEntities.ts so seeded server snapshots match client hashes.
  const input = stableStringify(content)
  let hash = 0x811c9dc5

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }

  return (hash >>> 0).toString(16).padStart(8, '0')
}

function createEmptyResumeData() {
  return {
    version: 1,
    // The seeded data starts in the post-migration override shape.
    _overridesMigrated: true,
    generation: {
      mode: 'single',
      vectorMode: 'manual',
      source: 'manual',
      pipelineEntryId: null,
      presetId: null,
      variantId: null,
      variantLabel: '',
      primaryVectorId: null,
      vectorIds: [],
      suggestedVectorIds: [],
    },
    theme: {
      preset: 'ferguson-v12',
    },
    meta: {
      name: '',
      email: '',
      phone: '',
      location: '',
      links: [],
    },
    target_lines: [],
    profiles: [],
    skill_groups: [],
    roles: [],
    projects: [],
    education: [],
    certifications: [],
    vectors: [],
    presets: [],
  }
}

function createEmptyResumePayload(workspaceId, timestamp) {
  const data = createEmptyResumeData()
  const resumeId = `${workspaceId}-default-resume`
  const contentHash = hashResumeContent(data)

  return {
    data,
    resumes: [
      {
        id: resumeId,
        content: cloneValue(data),
        contentHash,
        origin: {
          type: 'vector',
          vectorId: null,
          vectorIds: [],
          pipelineEntryId: null,
        },
        identityVersion: null,
        pipelineEntryId: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    snapshots: [],
    activeResumeId: resumeId,
  }
}

function createEmptyArtifactPayload(artifactType, workspaceId, timestamp) {
  switch (artifactType) {
    case 'resume':
      return createEmptyResumePayload(workspaceId, timestamp)
    case 'pipeline':
      return { entries: [] }
    case 'jdAnalysis':
      return { analyses: [] }
    case 'prep':
      return { decks: [] }
    case 'coverLetters':
      return { letters: [], snapshots: [] }
    case 'linkedin':
      return { drafts: [] }
    case 'recruiter':
      return { cards: [] }
    case 'debrief':
      return { sessions: [] }
    case 'research':
      return {
        profile: null,
        requests: [],
        runs: [],
        theses: [],
        activeThesisId: null,
        feedbackEvents: [],
        activeResearchJob: null,
      }
    default:
      return {}
  }
}

function normalizeResumePayload(payload, workspaceId, timestamp) {
  const fallback = createEmptyResumePayload(workspaceId, timestamp)
  if (!isRecord(payload)) {
    return fallback
  }

  if (
    isRecord(payload.data) ||
    Array.isArray(payload.resumes) ||
    Array.isArray(payload.snapshots)
  ) {
    const data = isRecord(payload.data) ? cloneValue(payload.data) : cloneValue(fallback.data)
    const resumes = Array.isArray(payload.resumes)
      ? payload.resumes.filter(isRecord).map((resume) => ({
          ...cloneValue(resume),
          content: isRecord(resume.content) ? cloneValue(resume.content) : cloneValue(data),
          contentHash:
            typeof resume.contentHash === 'string'
              ? resume.contentHash
              : hashResumeContent(isRecord(resume.content) ? resume.content : data),
          origin: isRecord(resume.origin)
            ? cloneValue(resume.origin)
            : {
                type: 'vector',
                vectorId: null,
                vectorIds: [],
                pipelineEntryId: null,
              },
          identityVersion:
            typeof resume.identityVersion === 'number' && Number.isFinite(resume.identityVersion)
              ? resume.identityVersion
              : null,
          createdAt: typeof resume.createdAt === 'string' ? resume.createdAt : timestamp,
          updatedAt: typeof resume.updatedAt === 'string' ? resume.updatedAt : timestamp,
        }))
      : []
    const activeResumeId =
      typeof payload.activeResumeId === 'string' &&
      resumes.some((resume) => resume.id === payload.activeResumeId)
        ? payload.activeResumeId
        : resumes[0]?.id

    if (resumes.length > 0 && activeResumeId) {
      return {
        ...cloneValue(payload),
        data,
        resumes,
        snapshots: Array.isArray(payload.snapshots) ? cloneValue(payload.snapshots) : [],
        activeResumeId,
      }
    }

    return {
      ...fallback,
      data,
      resumes: [
        {
          ...fallback.resumes[0],
          content: cloneValue(data),
          contentHash: hashResumeContent(data),
        },
      ],
    }
  }

  const data = isRecord(payload.meta)
    ? {
        ...cloneValue(fallback.data),
        ...cloneValue(payload),
        _overridesMigrated: true,
        meta: {
          ...fallback.data.meta,
          ...cloneValue(payload.meta),
          links: Array.isArray(payload.meta.links) ? cloneValue(payload.meta.links) : [],
        },
        vectors: Array.isArray(payload.vectors) ? cloneValue(payload.vectors) : [],
      }
    : cloneValue(fallback.data)

  return {
    ...fallback,
    data,
    resumes: [
      {
        ...fallback.resumes[0],
        content: cloneValue(data),
        contentHash: hashResumeContent(data),
      },
    ],
  }
}

function normalizeArtifactPayload(artifactType, payload, workspaceId, timestamp) {
  const fallback = createEmptyArtifactPayload(artifactType, workspaceId, timestamp)

  if (!isRecord(payload)) {
    return fallback
  }

  switch (artifactType) {
    case 'resume':
      return normalizeResumePayload(payload, workspaceId, timestamp)
    case 'coverLetters':
      // The legacy hosted seed used { templates: [] }; the current workspace
      // artifact is letter/snapshot based, so stale template placeholders drop.
      return {
        letters: Array.isArray(payload.letters) ? cloneValue(payload.letters) : [],
        snapshots: Array.isArray(payload.snapshots) ? cloneValue(payload.snapshots) : [],
      }
    case 'research':
      return {
        ...fallback,
        ...cloneValue(payload),
        profile:
          payload.profile === null || payload.profile === undefined || isRecord(payload.profile)
            ? cloneValue(payload.profile ?? null)
            : null,
        requests: Array.isArray(payload.requests) ? cloneValue(payload.requests) : [],
        runs: Array.isArray(payload.runs) ? cloneValue(payload.runs) : [],
        theses: Array.isArray(payload.theses) ? cloneValue(payload.theses) : [],
        feedbackEvents: Array.isArray(payload.feedbackEvents)
          ? cloneValue(payload.feedbackEvents)
          : [],
        activeThesisId:
          typeof payload.activeThesisId === 'string' || payload.activeThesisId === null
            ? payload.activeThesisId
            : null,
        activeResearchJob:
          payload.activeResearchJob === null ||
          payload.activeResearchJob === undefined ||
          isRecord(payload.activeResearchJob)
            ? cloneValue(payload.activeResearchJob ?? null)
            : null,
      }
    default:
      return {
        ...fallback,
        ...cloneValue(payload),
      }
  }
}

export function createEmptyWorkspaceSnapshot(actor, workspaceId, workspaceName, timestamp) {
  const artifacts = Object.fromEntries(
    FACET_ARTIFACT_TYPES.map((artifactType) => [
      artifactType,
      {
        artifactId: `${workspaceId}:${artifactType}`,
        artifactType,
        workspaceId,
        schemaVersion: 1,
        revision: 0,
        updatedAt: timestamp,
        payload: createEmptyArtifactPayload(artifactType, workspaceId, timestamp),
      },
    ]),
  )

  return {
    snapshotVersion: FACET_WORKSPACE_SNAPSHOT_VERSION,
    tenantId: actor.tenantId,
    userId: actor.userId,
    workspace: {
      id: workspaceId,
      name: workspaceName,
      revision: 0,
      updatedAt: timestamp,
    },
    artifacts,
    exportedAt: timestamp,
  }
}

export function normalizeWorkspaceSnapshotDefaults(snapshot) {
  if (!isRecord(snapshot)) {
    throw new Error('Workspace snapshot must be an object.')
  }

  if (!isRecord(snapshot.workspace)) {
    throw new Error('Workspace snapshot must include workspace metadata.')
  }

  // snapshot.userId is the last writer stored with the snapshot, not the
  // current requester. Request authorization stays at the persistence API edge.
  const workspaceId =
    typeof snapshot.workspace.id === 'string' && snapshot.workspace.id
      ? snapshot.workspace.id
      : 'workspace'
  const timestamp =
    typeof snapshot.exportedAt === 'string'
      ? snapshot.exportedAt
      : typeof snapshot.workspace.updatedAt === 'string'
        ? snapshot.workspace.updatedAt
        : new Date().toISOString()
  const workspaceName =
    typeof snapshot.workspace.name === 'string' && snapshot.workspace.name.trim()
      ? snapshot.workspace.name
      : 'Facet Workspace'
  const actor = {
    tenantId:
      typeof snapshot.tenantId === 'string' || snapshot.tenantId === null
        ? snapshot.tenantId
        : null,
    userId:
      typeof snapshot.userId === 'string' || snapshot.userId === null ? snapshot.userId : null,
  }
  const base = createEmptyWorkspaceSnapshot(actor, workspaceId, workspaceName, timestamp)

  return {
    ...base,
    ...cloneValue(snapshot),
    workspace: {
      ...base.workspace,
      ...cloneValue(snapshot.workspace),
      id: workspaceId,
      name: workspaceName,
    },
    artifacts: Object.fromEntries(
      FACET_ARTIFACT_TYPES.map((artifactType) => {
        const fallbackArtifact = base.artifacts[artifactType]
        const incomingArtifact = isRecord(snapshot.artifacts)
          ? snapshot.artifacts[artifactType]
          : null
        const artifact = isRecord(incomingArtifact) ? incomingArtifact : {}

        return [
          artifactType,
          {
            ...fallbackArtifact,
            ...cloneValue(artifact),
            artifactId:
              typeof artifact.artifactId === 'string'
                ? artifact.artifactId
                : `${workspaceId}:${artifactType}`,
            artifactType,
            workspaceId,
            payload: normalizeArtifactPayload(
              artifactType,
              artifact.payload,
              workspaceId,
              typeof artifact.updatedAt === 'string' ? artifact.updatedAt : timestamp,
            ),
          },
        ]
      }),
    ),
    exportedAt: timestamp,
  }
}
