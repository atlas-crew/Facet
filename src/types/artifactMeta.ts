import type { ProfessionalIdentityV3 } from '../identity/schema'

/**
 * Metadata every long-lived artifact (search thesis, search run, prep deck, cover letter)
 * records so staleness can be detected when the identity model changes.
 *
 * Staleness model: `identityVersion` snapshots the identity's `model_revision` at generation
 * time. When `currentIdentity.model_revision > artifact.identityVersion`, the artifact was
 * generated against an earlier identity and may benefit from a fresh-context refresh.
 *
 * `identityFingerprint` is an optional content hash reserved for field-level staleness
 * tracking (e.g., a cover letter that only cares whether the identity fields it *referenced*
 * changed). Not populated in MVP — TASK-168 will layer in that precision.
 */
export interface ArtifactMetadata {
  createdAt: string
  identityVersion: number
  identityFingerprint?: string
}

/**
 * Whether the current identity has mutated since the artifact was generated.
 *
 * Coarse signal: based on revision comparison alone. Returns `true` whenever the identity
 * has been mutated at all since the artifact was recorded. Field-level staleness (TASK-168)
 * will refine this to return `false` when changes didn't touch fields the artifact references.
 */
export const isArtifactStale = (
  metadata: Pick<ArtifactMetadata, 'identityVersion'>,
  currentIdentityVersion: number,
): boolean => currentIdentityVersion > metadata.identityVersion

/**
 * Human-readable summary of identity changes between two revisions.
 *
 * MVP: revision-delta message. The shepherding "refresh available" UI (doc-26, TASK-158)
 * consumes this string. TASK-168 will enrich this with actual field-level diff text like
 * "your Kubernetes depth correction changed this sentence."
 */
export const describeIdentityDiff = (
  fromRevision: number,
  toRevision: number,
): string[] => {
  if (toRevision <= fromRevision) {
    return []
  }
  const delta = toRevision - fromRevision
  return [
    `Identity has changed ${delta} ${delta === 1 ? 'time' : 'times'} since this was generated.`,
  ]
}

/**
 * Snapshot artifact metadata against the current identity. Use at generation time to
 * stamp theses, runs, decks, and letters with the identity version they were built from.
 */
export const recordIdentityMetadata = (
  identity: Pick<ProfessionalIdentityV3, 'model_revision'>,
  createdAt: string = new Date().toISOString(),
): ArtifactMetadata => ({
  createdAt,
  identityVersion: identity.model_revision,
})
