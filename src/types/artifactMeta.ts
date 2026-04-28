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

export type ArtifactImpactType = 'thesis' | 'run' | 'prep-deck' | 'cover-letter'

export interface ArtifactFieldDependency {
  artifactType: ArtifactImpactType
  artifactId: string
  fields: string[]
}

export interface IdentityMutation {
  label: string
  fields: string[]
  fromRevision: number
  toRevision: number
}

export interface ImpactArtifactInput {
  artifactType: ArtifactImpactType
  artifactId: string
  label: string
  identityVersion?: number
  identityFields?: string[]
  detail?: string
}

export interface DownstreamImpactItem {
  artifactType: ArtifactImpactType
  artifactId: string
  label: string
  reason: string
  identityVersion?: number
  matchedFields: string[]
  fallback: 'field' | 'version'
}

export interface DownstreamImpact {
  mutation: IdentityMutation
  artifactsAffected: DownstreamImpactItem[]
  totalCount: number
  counts: Record<ArtifactImpactType, number>
  summary: string
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

export const sanitizeIdentityVersion = (value: unknown): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  return Math.max(0, Math.trunc(value))
}

export const sanitizeIdentityFields = (values?: string[]): string[] | undefined => {
  if (!Array.isArray(values)) return undefined
  const filtered = values.flatMap((value) => {
    if (typeof value !== 'string') return []
    const trimmed = value.trim()
    return trimmed ? [trimmed] : []
  })
  return filtered.length > 0 ? filtered : undefined
}

const ARTIFACT_LABELS: Record<ArtifactImpactType, { singular: string; plural: string }> = {
  thesis: { singular: 'search thesis', plural: 'search theses' },
  run: { singular: 'search run', plural: 'search runs' },
  'prep-deck': { singular: 'prep deck', plural: 'prep decks' },
  'cover-letter': { singular: 'cover letter', plural: 'cover letters' },
}

const IMPACT_TYPE_ORDER: ArtifactImpactType[] = ['thesis', 'run', 'prep-deck', 'cover-letter']

const createEmptyImpactCounts = (): Record<ArtifactImpactType, number> =>
  Object.fromEntries(IMPACT_TYPE_ORDER.map((artifactType) => [artifactType, 0])) as Record<
    ArtifactImpactType,
    number
  >

const normalizeField = (field: string): string => field.trim().toLowerCase()

const formatCount = (count: number, singular: string, plural: string): string =>
  count + ' ' + (count === 1 ? singular : plural)

const joinSummaryParts = (parts: string[]): string => {
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0]
  if (parts.length === 2) return parts[0] + ' and ' + parts[1]
  return parts.slice(0, -1).join(', ') + ', and ' + parts[parts.length - 1]
}

const summarizeImpact = (
  totalCount: number,
  counts: Record<ArtifactImpactType, number>,
): string => {
  if (totalCount === 0) {
    return 'No downstream artifacts are expected to need review.'
  }

  const parts = IMPACT_TYPE_ORDER.flatMap((artifactType) => {
    const count = counts[artifactType]
    if (count === 0) return []
    const labels = ARTIFACT_LABELS[artifactType]
    return [formatCount(count, labels.singular, labels.plural)]
  })

  return (
    formatCount(totalCount, 'downstream artifact', 'downstream artifacts') +
    ' may need review: ' +
    joinSummaryParts(parts) +
    '.'
  )
}

/**
 * Computes the downstream artifacts affected by an identity mutation.
 *
 * Prefer field-level dependency matches when artifacts record identityFields.
 * Older artifacts that only recorded identityVersion fall back to coarse
 * revision comparison so the UX can still show useful impact instead of silence.
 */
export const describeImpact = (
  mutation: IdentityMutation,
  artifacts: ImpactArtifactInput[],
): DownstreamImpact => {
  const mutationFields = new Set(
    mutation.fields
      .map(normalizeField)
      .filter(Boolean),
  )
  const artifactsAffected = artifacts.flatMap((artifact): DownstreamImpactItem[] => {
    const identityFields = artifact.identityFields
      ?.map((field) => field.trim())
      .filter(Boolean)
    const matchedFields = identityFields?.filter((field) =>
      mutationFields.has(normalizeField(field)),
    ) ?? []

    if (matchedFields.length > 0) {
      return [{
        artifactType: artifact.artifactType,
        artifactId: artifact.artifactId,
        label: artifact.label,
        reason:
          'References ' +
          joinSummaryParts(matchedFields) +
          (artifact.detail ? '; ' + artifact.detail : '') +
          '.',
        identityVersion: artifact.identityVersion,
        matchedFields,
        fallback: 'field',
      }]
    }

    if (identityFields && identityFields.length > 0) {
      return []
    }

    if (
      typeof artifact.identityVersion === 'number' &&
      Number.isFinite(artifact.identityVersion) &&
      artifact.identityVersion < mutation.toRevision
    ) {
      return [{
        artifactType: artifact.artifactType,
        artifactId: artifact.artifactId,
        label: artifact.label,
        reason:
          'Generated from identity v' +
          artifact.identityVersion +
          ' before this correction moves identity to v' +
          mutation.toRevision +
          (artifact.detail ? '; ' + artifact.detail : '') +
          '.',
        identityVersion: artifact.identityVersion,
        matchedFields: [],
        fallback: 'version',
      }]
    }

    return []
  })

  const counts = artifactsAffected.reduce<Record<ArtifactImpactType, number>>(
    (nextCounts, artifact) =>
      artifact.artifactType in nextCounts
        ? {
            ...nextCounts,
            [artifact.artifactType]: nextCounts[artifact.artifactType] + 1,
          }
        : nextCounts,
    createEmptyImpactCounts(),
  )

  return {
    mutation,
    artifactsAffected,
    totalCount: artifactsAffected.length,
    counts,
    summary: summarizeImpact(artifactsAffected.length, counts),
  }
}
