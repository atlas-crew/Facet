// Audience tagging system for JD-analysis insights.
//
// Each insight (a requirement, a gap, a proof point, a watch-out, etc.) can be
// tagged with one or more audiences so downstream consumers — recruiter cards,
// candidate-prep briefs, internal debug surfaces — can mechanically filter the
// canonical analysis to the slice their reader cares about.
//
// Two layers contribute tags:
//   - inferred: rules-based defaults from `src/utils/audienceRules.ts`. Always
//     non-empty (floor sentinel: 'unclassified').
//   - asserted: tags emitted by the LLM during JdMatchExtraction. Optional
//     until phase 5 of the rollout. When non-empty, takes precedence over
//     inferred. `null` means "LLM phase 5 hasn't shipped"; `[]` means
//     "LLM ran and chose not to override" (falls through to inferred).
//
// Production audiences (candidate, recruiter, hiring_manager, internal) only
// receive items whose effective audience set explicitly includes them. The
// 'unclassified' sentinel is a fail-closed floor: it never reaches a
// production audience unless the rules engine explicitly assigns it. Debug or
// audit views can opt in to see unclassified content.
//
// To extend the taxonomy (e.g., add 'legal' for an enterprise tier), add to
// the union below and update DEFAULT_AUDIENCES_BY_INSIGHT_TYPE in
// `audienceRules.ts`. Pair with `assertNever` discipline at switch sites.

export type AudienceTag = 'candidate' | 'recruiter' | 'hiring_manager' | 'internal' | 'unclassified'

export const UNCLASSIFIED_AUDIENCE: AudienceTag = 'unclassified'

export const PRODUCTION_AUDIENCES: ReadonlyArray<AudienceTag> = [
  'candidate',
  'recruiter',
  'hiring_manager',
  'internal',
]

export interface AudienceAssignment {
  inferred: AudienceTag[]
  asserted: AudienceTag[] | null
}

export interface AudienceTagged {
  audiences: AudienceAssignment
}

export interface TaggedNote extends AudienceTagged {
  text: string
}

export type AudienceResolutionSource = 'asserted' | 'inferred'

export interface AudienceResolution {
  effective: AudienceTag[]
  source: AudienceResolutionSource
}

export const resolveAudiences = (assignment: AudienceAssignment): AudienceResolution => {
  if (assignment.asserted && assignment.asserted.length > 0) {
    return { effective: assignment.asserted, source: 'asserted' }
  }
  return { effective: assignment.inferred, source: 'inferred' }
}

// Hot-path accessor for filter sites that don't need the source tag.
export const effectiveAudiences = (assignment: AudienceAssignment): AudienceTag[] =>
  resolveAudiences(assignment).effective

// === TaggedNote helpers =====================================================
//
// Lint discipline: when iterating `TaggedNote[]`, prefer these helpers over
// `.map(n => n.text)` so audience metadata isn't silently stripped at the
// consumer boundary. Direct `.text` access is fine for individual notes once
// audience filtering has already happened upstream.

export const noteText = (note: TaggedNote): string => note.text

export const notesText = (notes: ReadonlyArray<TaggedNote>): string[] => notes.map(noteText)

// Construction-site helper. Use at every site that creates a typed insight
// whose final audience tags will be set later by `applyRulesBasedAudiences`
// (the analyzer pipeline, hydration normalization, etc.). The item is
// stamped with the 'unclassified' floor sentinel — fail-closed behavior:
// items that miss the rules engine never silently leak to production
// audiences. Tests can also use this to build minimal fixtures.
export const untagged = <T>(item: T): T & AudienceTagged => ({
  ...item,
  audiences: { inferred: ['unclassified'], asserted: null },
})

// Convenience for TaggedNote construction at sites that don't have
// audience opinions yet (string-to-note upgrades, default bodies).
export const untaggedNote = (text: string): TaggedNote => ({
  text,
  audiences: { inferred: ['unclassified'], asserted: null },
})

// === Insight-shape helpers ==================================================

const isAudienceAssignment = (value: unknown): value is AudienceAssignment => {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return (
    Array.isArray(candidate.inferred) &&
    (candidate.asserted === null || Array.isArray(candidate.asserted))
  )
}

export const hasAudiences = (value: unknown): value is AudienceTagged =>
  typeof value === 'object' &&
  value !== null &&
  isAudienceAssignment((value as Record<string, unknown>).audiences)
