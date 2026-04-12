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

export interface IdentityChangeLogEntry {
  id: string
  createdAt: string
  action: IdentityChangeAction
  summary: string
  details: string[]
  mode?: IdentityApplyMode
}
