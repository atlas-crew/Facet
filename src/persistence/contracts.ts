export { DEFAULT_LOCAL_WORKSPACE_ID } from '../types/durable'
import type { CoverLetterTemplate } from '../types/coverLetter'
import type { DebriefSession } from '../types/debrief'
import type { LinkedInProfileDraft } from '../types/linkedin'
import type { PipelineEntry } from '../types/pipeline'
import type { PrepDeck, PrepWorkspaceMode } from '../types/prep'
import type { RecruiterCard } from '../types/recruiter'
import type { SearchProfile, SearchRequest, SearchRun } from '../types/search'
import type { ResumeData, VectorSelection } from '../types'

export const FACET_WORKSPACE_SNAPSHOT_VERSION = 1 as const
export const FACET_LOCAL_PREFERENCES_VERSION = 1 as const
export const DEFAULT_LOCAL_WORKSPACE_NAME = 'Facet Local Workspace'

export const FACET_ARTIFACT_TYPES = [
  'resume',
  'pipeline',
  'prep',
  'coverLetters',
  'linkedin',
  'recruiter',
  'debrief',
  'research',
] as const

export type FacetArtifactType = (typeof FACET_ARTIFACT_TYPES)[number]

export interface PipelineWorkspaceData {
  entries: PipelineEntry[]
}

export interface PrepWorkspaceData {
  decks: PrepDeck[]
}

export interface CoverLettersWorkspaceData {
  templates: CoverLetterTemplate[]
}

export interface LinkedInWorkspaceData {
  drafts: LinkedInProfileDraft[]
}

export interface RecruiterWorkspaceData {
  cards: RecruiterCard[]
}

export interface DebriefWorkspaceData {
  sessions: DebriefSession[]
}

export interface ResearchWorkspaceData {
  profile: SearchProfile | null
  requests: SearchRequest[]
  runs: SearchRun[]
}

export interface FacetWorkspaceDescriptor {
  id: string
  name: string
  revision: number
  updatedAt: string
}

export interface FacetArtifactSnapshot<TType extends FacetArtifactType, TPayload> {
  artifactId: string
  artifactType: TType
  workspaceId: string
  schemaVersion: number
  revision: number
  updatedAt: string
  payload: TPayload
}

export type ResumeArtifactSnapshot = FacetArtifactSnapshot<'resume', ResumeData>
export type PipelineArtifactSnapshot = FacetArtifactSnapshot<'pipeline', PipelineWorkspaceData>
export type PrepArtifactSnapshot = FacetArtifactSnapshot<'prep', PrepWorkspaceData>
export type CoverLettersArtifactSnapshot = FacetArtifactSnapshot<'coverLetters', CoverLettersWorkspaceData>
export type LinkedInArtifactSnapshot = FacetArtifactSnapshot<'linkedin', LinkedInWorkspaceData>
export type RecruiterArtifactSnapshot = FacetArtifactSnapshot<'recruiter', RecruiterWorkspaceData>
export type DebriefArtifactSnapshot = FacetArtifactSnapshot<'debrief', DebriefWorkspaceData>
export type ResearchArtifactSnapshot = FacetArtifactSnapshot<'research', ResearchWorkspaceData>

export interface FacetWorkspaceArtifacts {
  resume: ResumeArtifactSnapshot
  pipeline: PipelineArtifactSnapshot
  prep: PrepArtifactSnapshot
  coverLetters: CoverLettersArtifactSnapshot
  linkedin: LinkedInArtifactSnapshot
  recruiter: RecruiterArtifactSnapshot
  debrief: DebriefArtifactSnapshot
  research: ResearchArtifactSnapshot
}

export interface FacetWorkspaceSnapshotV1 {
  snapshotVersion: typeof FACET_WORKSPACE_SNAPSHOT_VERSION
  tenantId: string | null
  userId: string | null
  workspace: FacetWorkspaceDescriptor
  artifacts: FacetWorkspaceArtifacts
  exportedAt: string
}

export type FacetWorkspaceSnapshot = FacetWorkspaceSnapshotV1

export interface FacetUiLocalPreferences {
  selectedVector: VectorSelection
  panelRatio: number
  appearance: 'light' | 'dark' | 'system'
  viewMode: 'pdf' | 'live'
  showHeatmap: boolean
  showDesignHealth: boolean
  suggestionModeActive: boolean
  backupRemindersEnabled: boolean
  backupReminderIntervalDays: number
  backupReminderSnoozedUntil: string | null
  lastBackupAt: string | null
  tourCompleted: boolean
}

export interface FacetPipelineLocalPreferences {
  sortField: string
  sortDir: 'asc' | 'desc'
}

export interface FacetPrepLocalPreferences {
  activeDeckId: string | null
  activeMode: PrepWorkspaceMode
}

export interface FacetLinkedInLocalPreferences {
  selectedDraftId: string | null
}

export interface FacetRecruiterLocalPreferences {
  selectedCardId: string | null
}

export interface FacetDebriefLocalPreferences {
  selectedSessionId: string | null
}

export interface FacetLocalPreferencesSnapshotV1 {
  snapshotVersion: typeof FACET_LOCAL_PREFERENCES_VERSION
  workspaceId: string
  ui: FacetUiLocalPreferences
  pipeline: FacetPipelineLocalPreferences
  prep: FacetPrepLocalPreferences
  linkedin: FacetLinkedInLocalPreferences
  recruiter: FacetRecruiterLocalPreferences
  debrief: FacetDebriefLocalPreferences
  exportedAt: string
}

export type FacetLocalPreferencesSnapshot = FacetLocalPreferencesSnapshotV1
