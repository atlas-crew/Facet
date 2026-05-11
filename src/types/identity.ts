import type { ProfessionalIdentityV3 } from '../identity/schema'

export type IdentityConfidence = 'stated' | 'confirmed' | 'guessing' | 'corrected'

export interface IdentityAssumptionTag {
  label: string
  confidence: IdentityConfidence
}

export interface IdentityDraftBullet {
  roleId: string
  roleLabel: string
  bulletId: string
  rewrite: string
  tags: string[]
  assumptions: IdentityAssumptionTag[]
}

export interface IdentityDeepenedBullet {
  summary: string
  roleId: string
  bulletId: string
  bullet: ProfessionalIdentityV3['roles'][number]['bullets'][number]
  rewrite: string
  assumptions: IdentityAssumptionTag[]
  warnings: string[]
}

export type ResumeScanBulletExplanation = Pick<
  IdentityDeepenedBullet,
  'summary' | 'rewrite' | 'assumptions' | 'warnings'
>

export interface IdentityExtractionDraft {
  generatedAt: string
  summary: string
  followUpQuestions: string[]
  identity: ProfessionalIdentityV3
  bullets: IdentityDraftBullet[]
  warnings: string[]
}

export type IdentityApplyMode = 'replace' | 'merge'

export type IdentityIntakeMode = 'upload' | 'paste'

export type IdentityEnrichmentStatus = 'pending' | 'complete' | 'skipped'

export interface IdentityEnrichmentSkillRef {
  groupId: string
  skillName: string
  groupLabel: string
  tags: string[]
  status: IdentityEnrichmentStatus
  stale: boolean
}

export interface IdentityEnrichmentProgress {
  total: number
  pending: number
  complete: number
  skipped: number
}

export interface IdentityApplyResult {
  data: ProfessionalIdentityV3
  warnings: string[]
  summary: string
  details: string[]
}

export type IdentityChangeAction = 'draft-generated' | 'draft-applied' | 'identity-imported'

export interface ResumeScanWarning {
  code:
    | 'two-column-layout'
    | 'role-parse-fallback'
    | 'missing-skills'
    | 'missing-education'
    | 'missing-contact'
  severity: 'info' | 'warning'
  message: string
}

export type ResumeScanBulletStatus = 'idle' | 'running' | 'completed' | 'failed' | 'edited'

export interface ResumeScanBulletProgress {
  status: ResumeScanBulletStatus
  confidence: IdentityConfidence
  lastError: string | null
  explanation: ResumeScanBulletExplanation | null
  updatedAt: string
}

export interface ResumeScanBulkProgress {
  status: 'idle' | 'running' | 'cancelling'
  total: number
  completed: number
  currentBulletKey: string | null
  lastUpdatedAt: string | null
}

export interface ResumeScanProgress {
  bullets: Record<string, ResumeScanBulletProgress>
  bulk: ResumeScanBulkProgress
}

export interface ResumeScanCounts {
  roles: number
  bullets: number
  projects: number
  skillGroups: number
  education: number
  extractedBullets: number
  decomposedBullets: number
  scannedBullets: number
  deepenedBullets: number
  editedBullets: number
  failedBullets: number
}

export interface ResumeScanResult {
  fileName: string
  pageCount: number
  scannedAt: string
  rawText: string
  identity: ProfessionalIdentityV3
  warnings: ResumeScanWarning[]
  counts: ResumeScanCounts
  layout: 'single-column' | 'ambiguous-columns'
  progress: ResumeScanProgress
}

/**
 * Discriminated union for sources fed into multi-source identity intake (m-33).
 *
 * Phase 1 wires only the `resume` arm — a parsed PDF resume scan with an
 * optional positioning-hint label. Future arms are reserved as seam plug
 * points so adding them later is purely additive:
 *
 *   { kind: 'jd';         id; userLabel?; sourceUrl?; analysis: JDAnalysis }
 *   { kind: 'agent-dump'; id; agentName?; text: string }
 *
 * Discriminate on `kind` before destructuring. Intake-time state only — never
 * persisted into `ProfessionalIdentityV3`; discarded after draft acceptance.
 */
export type IntakeSource =
  | { kind: 'resume'; id: string; userLabel?: string; scan: ResumeScanResult }
  // Phase 2 plug point: | { kind: 'jd'; id: string; userLabel?: string; sourceUrl?: string; analysis: JDAnalysis }
  // Phase 3 plug point: | { kind: 'agent-dump'; id: string; agentName?: string; text: string }

/**
 * Soft cap on intake sources fed into a single synthesis run (m-33 LOCKED
 * decision). Sources beyond this index remain in the array and can be removed
 * by the user, but the UI flags them as "above cap" and downstream synthesis
 * is responsible for ignoring them. Exported so both surfaces share one rule.
 */
export const INTAKE_SOURCE_CAP = 10

export interface IdentityChangeLogEntry {
  id: string
  createdAt: string
  action: IdentityChangeAction
  summary: string
  details: string[]
  mode?: IdentityApplyMode
}

/**
 * Single field key inside ProfessionalPreferences. Used by the Identity Map's
 * inspector to address one editable preference field. Format: `<section>.<field>`.
 */
export type PreferenceFieldKey =
  | 'compensation.base_floor'
  | 'compensation.base_target'
  | 'compensation.notes'
  | 'work_model.preference'
  | 'work_model.flexibility'
  | 'work_model.hard_no'
  | 'constraints.clearance'
  | 'constraints.education'
  | 'constraints.title_flexibility'
  | 'interview_process.accepted_formats'
  | 'interview_process.strong_fit_signals'
  | 'interview_process.red_flags'
  | 'interview_process.max_rounds'
  | 'interview_process.onsite_preferences'

/**
 * Discriminated union describing what is currently selected on the Identity Map.
 * UI ephemera — never persisted across reloads. The Map page sets this via
 * `useIdentityStore.setMapSelection`; the inspector reads it to render a slot.
 */
export type MapSelection =
  | { type: 'thesis' }
  | { type: 'philosophy'; id: string }
  | { type: 'arc-stop'; id: string }
  | { type: 'profile'; id: string }
  | { type: 'role'; id: string }
  | { type: 'bullet'; roleId: string; bulletId: string }
  | { type: 'project'; id: string }
  | { type: 'skill-group'; id: string }
  | { type: 'skill-item'; groupId: string; itemId: string }
  | { type: 'pref-field'; field: PreferenceFieldKey }
  | { type: 'match-rule'; kind: 'prioritize' | 'avoid'; id: string; justAdded?: boolean }
  | { type: 'search-vector'; id: string; justAdded?: boolean }
  | { type: 'awareness-question'; id: string; justAdded?: boolean }

