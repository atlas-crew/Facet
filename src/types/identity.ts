import type {
  ProfessionalBulletLevel,
  ProfessionalBulletLevelConfidence,
  ProfessionalIdentityV3,
  ProfessionalSearchVector,
} from '../identity/schema'

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

export interface IdentityDeepenedProject {
  summary: string
  projectId: string
  project: ProfessionalIdentityV3['projects'][number]
  rewrite: string
  assumptions: IdentityAssumptionTag[]
  warnings: string[]
}

/**
 * Result of `retellIdentityBullet` (Thread 2 / #38). The re-tell loop is a sibling of
 * deepen: deepen *writes* a bullet's factual PAIO, whereas re-tell only *interprets* it —
 * it assesses the scope-of-ownership `level` the work demonstrates and surfaces the
 * assumption for the user to confirm or step.
 *
 * The only durable artifact is `level` + `rationale` (persisted as `level` /
 * `level_rationale` / `level_source: 'corrected'`). `rewrites` are **ephemeral preview**
 * re-narrations at the assessed register — presentation, not evidence — never persisted
 * and never written back into the bullet's problem/action/outcome/impact or source_text.
 */
export interface IdentityRetoldBullet {
  summary: string
  roleId: string
  bulletId: string
  level: ProfessionalBulletLevel
  levelConfidence: ProfessionalBulletLevelConfidence
  rationale: string
  rewrites: string[]
  warnings: string[]
}

export type ResumeScanBulletExplanation = Pick<
  IdentityDeepenedBullet,
  'summary' | 'rewrite' | 'assumptions' | 'warnings'
>

/**
 * A search vector the extraction LLM proposes from multi-source positioning
 * hints (m-33). Carries the same shape as a live `ProfessionalSearchVector`
 * plus `evidenceSources` — free-form human-readable descriptions of which
 * intake sources supported this angle (e.g. "2 resumes labeled platform").
 *
 * Lives on `IdentityExtractionDraft.proposedVectors` as a staging slot. The
 * review pane (TASK-263) is responsible for moving accepted vectors into
 * `identity.search_vectors[]`; this type is never persisted directly into the
 * live identity to keep the user's explicit-acceptance gate honest.
 */
export interface ProposedSearchVector extends ProfessionalSearchVector {
  evidenceSources: string[]
}

/**
 * Patch shape for in-place edits to a staged proposed vector (TASK-263). The
 * review pane lets users adjust title / thesis / keywords before accepting;
 * priority, subtitle, target_roles, and supporting_bullets stay read-only so
 * the editor doesn't broaden into a full search-vector form.
 */
export interface ProposedSearchVectorPatch {
  title?: string
  thesis?: string
  keywords?: {
    primary: string[]
    secondary: string[]
  }
}

/**
 * Proposed patch from `proposeAnswerPatch` — routes a user's free-text answer
 * into the correct identity layer. Discriminated by `kind` so callers can
 * apply each case without a cast.
 *
 * evidence-vs-narrative: role-bullet/skill = evidence layer;
 * self-model-* = narrative layer.
 */
export type AnswerPatch =
  | {
      kind: 'role-bullet'
      roleId: string
      bullet: {
        problem: string
        action: string
        outcome: string
        impact?: string[]
        metrics?: Record<string, string | number | boolean>
        technologies?: string[]
        tags?: string[]
      }
    }
  | { kind: 'skill'; groupId: string; skillName: string }
  | { kind: 'self-model-arc'; entry: { company: string; chapter: string } }
  | { kind: 'competitive-moat'; text: string }
  | { kind: 'unfair-advantage'; items: string[] }

export interface IdentityExtractionDraft {
  generatedAt: string
  summary: string
  followUpQuestions: string[]
  identity: ProfessionalIdentityV3
  bullets: IdentityDraftBullet[]
  warnings: string[]
  /**
   * Staging slot for LLM-proposed positioning vectors from multi-source intake.
   * Optional and absent for legacy single-file extractions. Accepted vectors
   * move to `identity.search_vectors[]` only through the explicit review flow.
   */
  proposedVectors?: ProposedSearchVector[]
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
  failed: number
  failedBaseline: number
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
 * Phase 1 started with the `resume` arm — a parsed PDF resume scan with an
 * optional positioning-hint label. Free context sources extend the same
 * intake-time union without persisting into ProfessionalIdentityV3:
 *
 *   { kind: 'jd';         id; userLabel?; sourceUrl?; analysis: JDAnalysis }
 *
 * Discriminate on `kind` before destructuring. Intake-time state only — never
 * persisted into `ProfessionalIdentityV3`; discarded after draft acceptance.
 */
export type IntakeSource =
  | { kind: 'resume'; id: string; userLabel?: string; scan: ResumeScanResult }
  | { kind: 'agent-dump'; id: string; userLabel?: string; agentName?: string; text: string }
  | { kind: 'brag-doc'; id: string; userLabel?: string; fileName?: string; text: string }
// Phase 2 plug point: | { kind: 'jd'; id: string; userLabel?: string; sourceUrl?: string; analysis: JDAnalysis }

export type SupplementalContextSource = Extract<IntakeSource, { kind: 'agent-dump' | 'brag-doc' }>

export const SUPPLEMENTAL_CONTEXT_MAX_CHARS = 100_000
export const SUPPLEMENTAL_CONTEXT_TOTAL_MAX_CHARS = 200_000
export const SUPPLEMENTAL_CONTEXT_MAX_BYTES = 2 * 1024 * 1024

export const getSupplementalContextSourceLabel = (source: SupplementalContextSource): string =>
  source.userLabel ??
  (source.kind === 'agent-dump'
    ? (source.agentName ?? 'AI conversation export')
    : (source.fileName ?? 'Brag doc'))

export const getSupplementalContextLengthError = (
  kind: SupplementalContextSource['kind'],
  text: string,
): string | null => {
  if (text.length <= SUPPLEMENTAL_CONTEXT_MAX_CHARS) {
    return null
  }

  return kind === 'agent-dump'
    ? 'AI conversation export must be 100,000 characters or fewer.'
    : 'Brag doc text must be 100,000 characters or fewer.'
}

/**
 * Soft cap on intake sources fed into a single synthesis run (m-33 LOCKED
 * decision). Sources beyond this index remain in the array and can be removed
 * by the user, but the UI flags them as "above cap" and downstream synthesis
 * is responsible for ignoring them. Exported so both surfaces share one rule.
 */
export const INTAKE_SOURCE_CAP = 10

/**
 * One raw bullet line from a single source, attributed back to the file it
 * came from. Variant pools feed the prompt-time synthesis prompt; they are
 * not persisted into the final identity (the LLM draft strips them).
 */
export interface IntakeBulletVariant {
  /** Source filename (resume) or future-source agent name; whichever identifies the contributing file in the UI. */
  source: string
  /** Optional user-supplied positioning hint for this source ("platform", "security"...). */
  label?: string
  /** Raw bullet source text from the contributing scan. */
  text: string
}

/**
 * Result of the Stage-2 cross-source merge (m-33). Carries a unified seed
 * identity plus per-role bullet variant pools attributed to source files.
 * The seed identity is what the Stage-3 LLM consumes as `seedIdentity`; the
 * variant pools are prompt-time fuel rendered into the synthesis prompt body.
 *
 * Roles are clustered by `(company.toLowerCase(), date_range_overlap)`. Within
 * a cluster, the most-recently-scanned source wins on title and other scalar
 * fields; older titles are preserved in `roleVariantTitles[roleId]` so the
 * prompt can surface them as candidate alternatives.
 */
export interface SynthesisSeed {
  identity: ProfessionalIdentityV3
  /** Per-role-id list of raw bullet lines from every contributing source. */
  bulletVariantPools: Record<string, IntakeBulletVariant[]>
  /** Per-role-id list of older role titles superseded by the most-recent scan. */
  roleVariantTitles: Record<string, string[]>
}

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
  | { type: 'contact-basics' }
  | { type: 'thesis' }
  | { type: 'competitive-moat' }
  | { type: 'philosophy'; id: string }
  | { type: 'arc-stop'; id: string }
  | { type: 'profile'; id: string }
  | { type: 'role'; id: string }
  | { type: 'bullet'; roleId: string; bulletId: string }
  | { type: 'project'; id: string }
  | { type: 'skill-group'; id: string }
  | { type: 'skill-item'; groupId: string; itemId: string; draft?: boolean }
  | { type: 'pref-field'; field: PreferenceFieldKey }
  | { type: 'match-rule'; kind: 'prioritize' | 'avoid'; id: string; justAdded?: boolean }
  | { type: 'search-vector'; id: string; justAdded?: boolean }
  | { type: 'awareness-question'; id: string; justAdded?: boolean }
