import type { ProfessionalIdentityV3 } from '../../identity/schema'
import type {
  FacetArtifactSnapshot,
  FacetArtifactType,
  FacetWorkspaceSnapshot,
} from '../../persistence/contracts'
import {
  DEFAULT_LOCAL_WORKSPACE_ID,
  FACET_WORKSPACE_SNAPSHOT_VERSION,
} from '../../persistence/contracts'
import { buildMayaPatelPersona, type PersonaData, assertValidPersona } from './personas'

export const MAYA_PATEL_GOLDEN_WORKSPACE_ID = `${DEFAULT_LOCAL_WORKSPACE_ID}:maya-patel-golden`
export const MAYA_PATEL_GOLDEN_WORKSPACE_NAME = 'Maya Patel Golden Workspace'
export const MAYA_PATEL_GOLDEN_EXPORTED_AT = '2026-04-22T15:00:00.000Z'
export const IDENTITY_STORE_VERSION = 4
export const MAYA_PATEL_IDENTITY_STORAGE_KEY = 'facet-identity-workspace'

export interface GoldenIdentityStorageEnvelope {
  state: {
    intakeMode: 'paste'
    sourceMaterial: string
    correctionNotes: string
    currentIdentity: ProfessionalIdentityV3
    draft: null
    draftDocument: string
    scanResult: null
    warnings: string[]
    changelog: []
  }
  version: typeof IDENTITY_STORE_VERSION
}

export interface MayaPatelGoldenWorkspace {
  snapshot: FacetWorkspaceSnapshot
  identity: ProfessionalIdentityV3
  identityStorageKey: typeof MAYA_PATEL_IDENTITY_STORAGE_KEY
  identityStorageEnvelope: GoldenIdentityStorageEnvelope
  hydrateIntoStores: () => Promise<void>
}

const clone = <T>(value: T): T => structuredClone(value)

const buildArtifactSnapshot = <TType extends FacetArtifactType, TPayload>(
  artifactType: TType,
  payload: TPayload,
  workspaceId: string,
  exportedAt: string,
): FacetArtifactSnapshot<TType, TPayload> => ({
  artifactId: `${workspaceId}:${artifactType}`,
  artifactType,
  workspaceId,
  schemaVersion: 1,
  revision: 0,
  updatedAt: exportedAt,
  payload,
})

export const buildMayaPatelIdentityStorageEnvelope = (
  identity: ProfessionalIdentityV3,
): GoldenIdentityStorageEnvelope => ({
  state: {
    intakeMode: 'paste',
    sourceMaterial: '',
    correctionNotes: '',
    currentIdentity: clone(identity),
    draft: null,
    draftDocument: JSON.stringify(identity, null, 2),
    scanResult: null,
    warnings: [],
    changelog: [],
  },
  version: IDENTITY_STORE_VERSION,
})

const buildSnapshotFromPersona = (
  persona: PersonaData,
  workspaceId: string,
  workspaceName: string,
  exportedAt: string,
): FacetWorkspaceSnapshot => {
  if (!persona.resumeWorkspace) {
    throw new Error('Maya golden persona must include a resume workspace payload.')
  }
  if (
    !persona.jdAnalyses ||
    !persona.coverLetters ||
    !persona.linkedInDrafts ||
    !persona.recruiterCards ||
    !persona.debriefSessions ||
    !persona.research
  ) {
    throw new Error('Maya golden persona must include all golden artifact payloads.')
  }

  return {
    snapshotVersion: FACET_WORKSPACE_SNAPSHOT_VERSION,
    tenantId: null,
    userId: null,
    workspace: {
      id: workspaceId,
      name: workspaceName,
      revision: 0,
      updatedAt: exportedAt,
    },
    artifacts: {
      resume: buildArtifactSnapshot(
        'resume',
        clone(persona.resumeWorkspace),
        workspaceId,
        exportedAt,
      ),
      pipeline: buildArtifactSnapshot(
        'pipeline',
        { entries: clone(persona.pipelineEntries) },
        workspaceId,
        exportedAt,
      ),
      jdAnalysis: buildArtifactSnapshot(
        'jdAnalysis',
        { analyses: clone(persona.jdAnalyses) },
        workspaceId,
        exportedAt,
      ),
      prep: buildArtifactSnapshot(
        'prep',
        { decks: clone(persona.prepDecks) },
        workspaceId,
        exportedAt,
      ),
      coverLetters: buildArtifactSnapshot(
        'coverLetters',
        clone(persona.coverLetters),
        workspaceId,
        exportedAt,
      ),
      linkedin: buildArtifactSnapshot(
        'linkedin',
        { drafts: clone(persona.linkedInDrafts) },
        workspaceId,
        exportedAt,
      ),
      recruiter: buildArtifactSnapshot(
        'recruiter',
        { cards: clone(persona.recruiterCards) },
        workspaceId,
        exportedAt,
      ),
      debrief: buildArtifactSnapshot(
        'debrief',
        { sessions: clone(persona.debriefSessions) },
        workspaceId,
        exportedAt,
      ),
      research: buildArtifactSnapshot('research', clone(persona.research), workspaceId, exportedAt),
    },
    exportedAt,
  }
}

export const hydrateMayaPatelIdentityIntoStore = async (
  identity: ProfessionalIdentityV3,
): Promise<void> => {
  const { useIdentityStore } = await import('../../store/identityStore')

  useIdentityStore.setState({
    intakeMode: 'paste',
    currentIdentity: clone(identity),
    draft: null,
    draftDocument: JSON.stringify(identity, null, 2),
    scanResult: null,
    warnings: [],
    changelog: [],
    lastError: null,
    mapSelection: null,
    sourceMaterial: '',
    correctionNotes: '',
  })
}

export const buildMayaPatelGoldenWorkspace = (
  options: {
    workspaceId?: string
    workspaceName?: string
    exportedAt?: string
  } = {},
): MayaPatelGoldenWorkspace => {
  const persona = buildMayaPatelPersona()
  assertValidPersona(persona, 'maya-golden')

  const workspaceId = options.workspaceId ?? MAYA_PATEL_GOLDEN_WORKSPACE_ID
  const workspaceName = options.workspaceName ?? MAYA_PATEL_GOLDEN_WORKSPACE_NAME
  const exportedAt = options.exportedAt ?? MAYA_PATEL_GOLDEN_EXPORTED_AT
  const snapshot = buildSnapshotFromPersona(persona, workspaceId, workspaceName, exportedAt)
  const identity = clone(persona.identity)

  return {
    snapshot,
    identity,
    identityStorageKey: MAYA_PATEL_IDENTITY_STORAGE_KEY,
    identityStorageEnvelope: buildMayaPatelIdentityStorageEnvelope(identity),
    hydrateIntoStores: async () => {
      const { applyWorkspaceSnapshotToStores } = await import('../../persistence/hydration')
      applyWorkspaceSnapshotToStores(snapshot)
      await hydrateMayaPatelIdentityIntoStore(identity)
    },
  }
}
