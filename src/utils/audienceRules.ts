import {
  type AudienceAssignment,
  type AudienceTag,
  type AudienceTagged,
  type TaggedNote,
  hasAudiences,
} from '../types/audience'
import type { JDAnalysis } from '../types/jdAnalysis'
import type {
  AvoidTrigger,
  FilterTrigger,
  MatchAdvantage,
  MatchAdvantageHypothesis,
  MatchAssetScore,
  MatchedVector,
  MatchGap,
  MatchRequirementCoverage,
  RelevantAwareness,
  SkillMatch,
  WatchOut,
} from '../types/match'

// Bump this string when the rules logic changes. On hydration, JDAnalyses
// stamped with an older version are re-normalized by `applyRulesBasedAudiences`
// (LLM-asserted tags are preserved across rules-version bumps).
//
// Versioning policy:
//   - Coarse-grained: one version covers all rules. Mismatch => full re-apply.
//   - Stamped on every JDAnalysis at production time (analyzer pipeline) and at
//     hydration time (jdAnalysisStore.sanitizeAnalysis).
//   - `asserted` tags are *never* recomputed by rules. Only `inferred` is.
export const AUDIENCE_RULES_VERSION = 'audience-rules.v2'

// Default audience set per insight kind. Production audiences (candidate,
// recruiter, hiring_manager, internal) only receive items whose effective
// audience set explicitly includes them. The 'unclassified' sentinel is the
// floor: it never reaches a production audience unless the rules engine
// explicitly assigns it.
//
// Editing these defaults is a versioned change — bump AUDIENCE_RULES_VERSION
// so existing analyses re-normalize on next load.

const DEFAULT_REQUIREMENT_AUDIENCES: AudienceTag[] = ['recruiter', 'hiring_manager']
const DEFAULT_MATCHED_VECTOR_AUDIENCES: AudienceTag[] = ['internal', 'candidate']
const DEFAULT_SKILL_MATCH_AUDIENCES: AudienceTag[] = ['recruiter', 'hiring_manager', 'candidate']
const DEFAULT_EVIDENCE_AUDIENCES: AudienceTag[] = ['internal', 'recruiter', 'hiring_manager']
const DEFAULT_ADVANTAGE_AUDIENCES: AudienceTag[] = ['recruiter', 'hiring_manager']
const DEFAULT_ADVANTAGE_HYPOTHESIS_AUDIENCES: AudienceTag[] = ['internal', 'candidate']
const DEFAULT_GAP_AUDIENCES: AudienceTag[] = ['candidate']
const DEFAULT_WATCH_OUT_AUDIENCES: AudienceTag[] = ['candidate']
const DEFAULT_FILTER_TRIGGER_AUDIENCES: AudienceTag[] = ['internal']
const DEFAULT_AVOID_TRIGGER_AUDIENCES: AudienceTag[] = ['internal', 'candidate']
const DEFAULT_RELEVANT_AWARENESS_AUDIENCES: AudienceTag[] = ['candidate']
const DEFAULT_STRENGTH_NOTE_AUDIENCES: AudienceTag[] = ['recruiter', 'hiring_manager', 'candidate']
const DEFAULT_GAP_FOCUS_NOTE_AUDIENCES: AudienceTag[] = ['candidate']
const DEFAULT_POSITIONING_NOTE_AUDIENCES: AudienceTag[] = ['candidate', 'recruiter']
const DEFAULT_WARNING_NOTE_AUDIENCES: AudienceTag[] = ['internal']

// === Per-insight enrichment hooks ===========================================
// Adjust the inferred set based on per-item signals (severity, confidence,
// score thresholds). Keep these small and well-named — they're audience
// promotion rules, not arbitrary content classification.

const enrichRequirementAudiences = (req: MatchRequirementCoverage): AudienceTag[] => {
  const set = new Set<AudienceTag>(DEFAULT_REQUIREMENT_AUDIENCES)
  // Strongly-covered core requirements are recruiter advocacy material.
  if (req.priority === 'core' && req.coverageScore >= 0.7) set.add('candidate')
  return [...set]
}

const enrichGapAudiences = (gap: MatchGap): AudienceTag[] => {
  const set = new Set<AudienceTag>(DEFAULT_GAP_AUDIENCES)
  // High-severity gaps need to surface in recruiter framing too — the
  // recruiter card's "gap bridges" pattern depends on this.
  if (gap.severity === 'high') set.add('recruiter')
  return [...set]
}

const enrichWatchOutAudiences = (watchOut: WatchOut): AudienceTag[] => {
  const set = new Set<AudienceTag>(DEFAULT_WATCH_OUT_AUDIENCES)
  // Hard watch-outs (filter risks, comp concerns) escalate to internal so
  // Facet system surfaces can flag them in pipeline triage.
  if (watchOut.severity === 'hard') set.add('internal')
  return [...set]
}

const enrichSkillMatchAudiences = (skill: SkillMatch): AudienceTag[] => {
  const set = new Set<AudienceTag>(DEFAULT_SKILL_MATCH_AUDIENCES)
  // Negative-quality matches are candidate prep material, not advocacy.
  if (skill.matchQuality === 'negative' || skill.matchQuality === 'weak') {
    set.delete('recruiter')
    set.delete('hiring_manager')
  }
  return [...set]
}

const enrichEvidenceAudiences = (asset: MatchAssetScore): AudienceTag[] => {
  const set = new Set<AudienceTag>(DEFAULT_EVIDENCE_AUDIENCES)
  // Strong-score evidence (proof points) is also useful candidate prep.
  if (asset.score >= 0.8) set.add('candidate')
  return [...set]
}

const enrichRelevantAwarenessAudiences = (item: RelevantAwareness): AudienceTag[] => {
  const set = new Set<AudienceTag>(DEFAULT_RELEVANT_AWARENESS_AUDIENCES)
  if (item.severity === 'high') set.add('recruiter')
  return [...set]
}

const enrichAvoidTriggerAudiences = (trigger: AvoidTrigger): AudienceTag[] => {
  const set = new Set<AudienceTag>(DEFAULT_AVOID_TRIGGER_AUDIENCES)
  // Hard avoid triggers are filter-out signals — recruiter shouldn't pitch.
  if (trigger.severity === 'hard') set.add('recruiter')
  return [...set]
}

const enrichFilterTriggerAudiences = (_: FilterTrigger): AudienceTag[] =>
  [...DEFAULT_FILTER_TRIGGER_AUDIENCES]

const enrichAdvantageAudiences = (_: MatchAdvantage): AudienceTag[] =>
  [...DEFAULT_ADVANTAGE_AUDIENCES]

const enrichAdvantageHypothesisAudiences = (_: MatchAdvantageHypothesis): AudienceTag[] =>
  [...DEFAULT_ADVANTAGE_HYPOTHESIS_AUDIENCES]

const enrichMatchedVectorAudiences = (_: MatchedVector): AudienceTag[] =>
  [...DEFAULT_MATCHED_VECTOR_AUDIENCES]

// === Assignment construction ================================================

const buildAssignment = (
  inferred: AudienceTag[],
  existing?: AudienceAssignment,
): AudienceAssignment => {
  // Floor: if rules produced no inference, stamp 'unclassified' so the item
  // is never silently visible to production audiences.
  const inferredFloor = inferred.length > 0 ? inferred : (['unclassified'] as AudienceTag[])
  // Preserve LLM-asserted tags across rules-version bumps. `null` distinguishes
  // "LLM phase 5 hasn't shipped" from `[]` "LLM ran, no override".
  const asserted = existing?.asserted ?? null
  return { inferred: inferredFloor, asserted }
}

const tagWith = <T extends AudienceTagged>(
  item: T,
  computeInferred: (item: T) => AudienceTag[],
): T => ({
  ...item,
  audiences: buildAssignment(computeInferred(item), item.audiences),
})

const tagNotes = (
  notes: TaggedNote[] | undefined,
  defaults: AudienceTag[],
): TaggedNote[] => {
  if (!Array.isArray(notes)) return []
  return notes.map((entry) => ({
    text: entry.text,
    audiences: buildAssignment(defaults, entry.audiences),
  }))
}

const NOTE_FIELDS = [
  'strengthsToLead',
  'gapFocus',
  'positioningRecommendations',
  'warnings',
] as const

const isNoteTextArray = (value: unknown): value is Array<Pick<TaggedNote, 'text'>> =>
  Array.isArray(value) &&
  value.every(
    (entry) => entry !== null && typeof entry === 'object' && typeof (entry as { text?: unknown }).text === 'string',
  )

const isTaggedNoteArray = (value: unknown): value is TaggedNote[] =>
  Array.isArray(value) &&
  value.every(
    (entry) => hasAudiences(entry) && typeof (entry as { text?: unknown }).text === 'string',
  )

const assertNoteFields = (input: JDAnalysisLike): void => {
  for (const field of NOTE_FIELDS) {
    if (!isNoteTextArray(input[field])) {
      throw new Error(`JDAnalysisLike.${field} must contain TaggedNote entries.`)
    }
  }
}

// === Public entry point =====================================================

// Input shape allows partial data — missing `audiences` fields on insights and
// missing rulesVersion stamps. Legacy string notes are converted at persistence
// boundaries before callers reach this type.
// Output is a fully-tagged JDAnalysis with `audienceRulesVersion` set to the
// current AUDIENCE_RULES_VERSION.
export interface JDAnalysisLike extends Omit<
  JDAnalysis,
  | 'audienceRulesVersion'
  | 'requirements'
  | 'matchedVectors'
  | 'skillMatches'
  | 'evidenceMapping'
  | 'advantages'
  | 'advantageHypotheses'
  | 'gaps'
  | 'watchOuts'
  | 'triggeredPrioritize'
  | 'triggeredAvoid'
  | 'relevantAwareness'
  | 'strengthsToLead'
  | 'gapFocus'
  | 'positioningRecommendations'
  | 'warnings'
> {
  audienceRulesVersion?: string
  requirements: MatchRequirementCoverage[]
  matchedVectors: MatchedVector[]
  skillMatches: SkillMatch[]
  evidenceMapping: JDAnalysis['evidenceMapping']
  advantages: MatchAdvantage[]
  advantageHypotheses: MatchAdvantageHypothesis[]
  gaps: MatchGap[]
  watchOuts: WatchOut[]
  triggeredPrioritize: FilterTrigger[]
  triggeredAvoid: AvoidTrigger[]
  relevantAwareness: RelevantAwareness[]
  strengthsToLead: TaggedNote[]
  gapFocus: TaggedNote[]
  positioningRecommendations: TaggedNote[]
  warnings: TaggedNote[]
}

export const applyRulesBasedAudiences = (input: JDAnalysisLike): JDAnalysis => {
  assertNoteFields(input)

  if (
    input.audienceRulesVersion === AUDIENCE_RULES_VERSION &&
    NOTE_FIELDS.every((field) => isTaggedNoteArray(input[field]))
  ) {
    return input as JDAnalysis
  }

  const evidenceMapping: JDAnalysis['evidenceMapping'] = {
    topBullets: input.evidenceMapping.topBullets.map((asset) => tagWith(asset, enrichEvidenceAudiences)),
    topSkills: input.evidenceMapping.topSkills.map((asset) => tagWith(asset, enrichEvidenceAudiences)),
    topProjects: input.evidenceMapping.topProjects.map((asset) => tagWith(asset, enrichEvidenceAudiences)),
    topProfiles: input.evidenceMapping.topProfiles.map((asset) => tagWith(asset, enrichEvidenceAudiences)),
    topPhilosophy: input.evidenceMapping.topPhilosophy.map((asset) => tagWith(asset, enrichEvidenceAudiences)),
  }

  return {
    ...(input as JDAnalysis),
    audienceRulesVersion: AUDIENCE_RULES_VERSION,
    requirements: input.requirements.map((req) => tagWith(req, enrichRequirementAudiences)),
    matchedVectors: input.matchedVectors.map((v) => tagWith(v, enrichMatchedVectorAudiences)),
    skillMatches: input.skillMatches.map((s) => tagWith(s, enrichSkillMatchAudiences)),
    evidenceMapping,
    advantages: input.advantages.map((a) => ({
      ...tagWith(a, enrichAdvantageAudiences),
      evidence: a.evidence.map((asset) => tagWith(asset, enrichEvidenceAudiences)),
    })),
    advantageHypotheses: input.advantageHypotheses.map((h) =>
      tagWith(h, enrichAdvantageHypothesisAudiences),
    ),
    gaps: input.gaps.map((g) => tagWith(g, enrichGapAudiences)),
    watchOuts: input.watchOuts.map((w) => tagWith(w, enrichWatchOutAudiences)),
    triggeredPrioritize: input.triggeredPrioritize.map((t) =>
      tagWith(t, enrichFilterTriggerAudiences),
    ),
    triggeredAvoid: input.triggeredAvoid.map((t) => tagWith(t, enrichAvoidTriggerAudiences)),
    relevantAwareness: input.relevantAwareness.map((a) =>
      tagWith(a, enrichRelevantAwarenessAudiences),
    ),
    strengthsToLead: tagNotes(input.strengthsToLead, DEFAULT_STRENGTH_NOTE_AUDIENCES),
    gapFocus: tagNotes(input.gapFocus, DEFAULT_GAP_FOCUS_NOTE_AUDIENCES),
    positioningRecommendations: tagNotes(
      input.positioningRecommendations,
      DEFAULT_POSITIONING_NOTE_AUDIENCES,
    ),
    warnings: tagNotes(input.warnings, DEFAULT_WARNING_NOTE_AUDIENCES),
  }
}
