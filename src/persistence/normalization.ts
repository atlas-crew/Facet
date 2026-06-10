import { cloneValue } from './clone'
import { defaultResumeData } from '../store/defaultData'
import { FACET_WORKSPACE_SNAPSHOT_VERSION } from './contracts'
import type {
  DebriefArtifactSnapshot,
  FacetLocalPreferencesSnapshot,
  FacetWorkspaceSnapshot,
  IdentityArtifactSnapshot,
  JDAnalysisArtifactSnapshot,
  LinkedInArtifactSnapshot,
  RecruiterArtifactSnapshot,
} from './contracts'
import { normalizeResumeWorkspacePayload } from '../utils/resumeEntities'

const buildEmptyLinkedInArtifact = (
  workspaceId: string,
  updatedAt: string,
  revision = 0,
): LinkedInArtifactSnapshot => ({
  artifactId: `${workspaceId}:linkedin`,
  artifactType: 'linkedin',
  workspaceId,
  schemaVersion: 1,
  revision,
  updatedAt,
  payload: {
    drafts: [],
  },
})

const buildEmptyJDAnalysisArtifact = (
  workspaceId: string,
  updatedAt: string,
  revision = 0,
): JDAnalysisArtifactSnapshot => ({
  artifactId: `${workspaceId}:jdAnalysis`,
  artifactType: 'jdAnalysis',
  workspaceId,
  schemaVersion: 1,
  revision,
  updatedAt,
  payload: {
    analyses: [],
  },
})

const buildEmptyDebriefArtifact = (
  workspaceId: string,
  updatedAt: string,
  revision = 0,
): DebriefArtifactSnapshot => ({
  artifactId: `${workspaceId}:debrief`,
  artifactType: 'debrief',
  workspaceId,
  schemaVersion: 1,
  revision,
  updatedAt,
  payload: {
    sessions: [],
  },
})

const buildEmptyRecruiterArtifact = (
  workspaceId: string,
  updatedAt: string,
  revision = 0,
): RecruiterArtifactSnapshot => ({
  artifactId: `${workspaceId}:recruiter`,
  artifactType: 'recruiter',
  workspaceId,
  schemaVersion: 1,
  revision,
  updatedAt,
  payload: {
    cards: [],
  },
})

const buildEmptyIdentityArtifact = (
  workspaceId: string,
  updatedAt: string,
  revision = 0,
): IdentityArtifactSnapshot => ({
  artifactId: `${workspaceId}:identity`,
  artifactType: 'identity',
  workspaceId,
  schemaVersion: 1,
  revision,
  updatedAt,
  // A null identity is the "no identity captured" default. Hydration treats it
  // as a no-op so a defaulted artifact can never clobber a populated local model.
  payload: {
    identity: null,
  },
})

export const normalizeWorkspaceSnapshot = (
  snapshot: FacetWorkspaceSnapshot,
): FacetWorkspaceSnapshot => {
  const normalized = cloneValue(snapshot) as FacetWorkspaceSnapshot & {
    artifacts: FacetWorkspaceSnapshot['artifacts'] & {
      linkedin?: LinkedInArtifactSnapshot
      jdAnalysis?: JDAnalysisArtifactSnapshot
      recruiter?: RecruiterArtifactSnapshot
      debrief?: DebriefArtifactSnapshot
      identity?: IdentityArtifactSnapshot
    }
  }

  // Upgrade the v1 envelope (which predates the identity artifact) to v2 in
  // place. Only the known prior version is upgraded; an unknown/future version
  // is left untouched so validation still rejects it. The runtime value can be
  // a legacy 1 even though the type says 2, hence the number-widening read.
  if ((normalized.snapshotVersion as number) === 1) {
    normalized.snapshotVersion = FACET_WORKSPACE_SNAPSHOT_VERSION
  }

  if (!normalized.artifacts.identity) {
    normalized.artifacts.identity = buildEmptyIdentityArtifact(
      normalized.workspace.id,
      normalized.workspace.updatedAt || normalized.exportedAt,
    )
  }

  if (!normalized.artifacts.jdAnalysis) {
    normalized.artifacts.jdAnalysis = buildEmptyJDAnalysisArtifact(
      normalized.workspace.id,
      normalized.workspace.updatedAt || normalized.exportedAt,
    )
  }

  if (!normalized.artifacts.linkedin) {
    normalized.artifacts.linkedin = buildEmptyLinkedInArtifact(
      normalized.workspace.id,
      normalized.workspace.updatedAt || normalized.exportedAt,
    )
  }

  if (!normalized.artifacts.recruiter) {
    normalized.artifacts.recruiter = buildEmptyRecruiterArtifact(
      normalized.workspace.id,
      normalized.workspace.updatedAt || normalized.exportedAt,
    )
  }

  if (!normalized.artifacts.debrief) {
    normalized.artifacts.debrief = buildEmptyDebriefArtifact(
      normalized.workspace.id,
      normalized.workspace.updatedAt || normalized.exportedAt,
    )
  }

  normalized.artifacts.resume.payload = normalizeResumeWorkspacePayload(
    normalized.artifacts.resume.payload,
    defaultResumeData,
  )

  return normalized
}

export const normalizeLocalPreferencesSnapshot = (
  snapshot: FacetLocalPreferencesSnapshot,
): FacetLocalPreferencesSnapshot => {
  const normalized = cloneValue(snapshot) as FacetLocalPreferencesSnapshot & {
    linkedin?: { selectedDraftId: string | null }
    recruiter?: { selectedCardId: string | null }
    debrief?: { selectedSessionId: string | null }
  }

  if (!normalized.linkedin) {
    normalized.linkedin = {
      selectedDraftId: null,
    }
  }

  if (!normalized.recruiter) {
    normalized.recruiter = {
      selectedCardId: null,
    }
  }

  if (!normalized.debrief) {
    normalized.debrief = {
      selectedSessionId: null,
    }
  }

  return normalized
}

export const createEmptyLinkedInArtifactSnapshot = buildEmptyLinkedInArtifact
export const createEmptyJDAnalysisArtifactSnapshot = buildEmptyJDAnalysisArtifact
export const createEmptyRecruiterArtifactSnapshot = buildEmptyRecruiterArtifact
export const createEmptyDebriefArtifactSnapshot = buildEmptyDebriefArtifact
export const createEmptyIdentityArtifactSnapshot = buildEmptyIdentityArtifact
