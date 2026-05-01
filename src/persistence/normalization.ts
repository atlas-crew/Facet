import { cloneValue } from './clone'
import type {
  DebriefArtifactSnapshot,
  FacetLocalPreferencesSnapshot,
  FacetWorkspaceSnapshot,
  JDAnalysisArtifactSnapshot,
  LinkedInArtifactSnapshot,
  RecruiterArtifactSnapshot,
} from './contracts'

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

export const normalizeWorkspaceSnapshot = (
  snapshot: FacetWorkspaceSnapshot,
): FacetWorkspaceSnapshot => {
  const normalized = cloneValue(snapshot) as FacetWorkspaceSnapshot & {
    artifacts: FacetWorkspaceSnapshot['artifacts'] & {
      linkedin?: LinkedInArtifactSnapshot
      jdAnalysis?: JDAnalysisArtifactSnapshot
      recruiter?: RecruiterArtifactSnapshot
      debrief?: DebriefArtifactSnapshot
    }
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
