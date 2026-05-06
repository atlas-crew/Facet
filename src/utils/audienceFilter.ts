import {
  type AudienceTag,
  type AudienceTagged,
  type TaggedNote,
  effectiveAudiences,
} from '../types/audience'
import type { JDAnalysis } from '../types/jdAnalysis'

// Filter any collection of audience-tagged items to the ones that should be
// visible to `audience`. The 'unclassified' sentinel never matches a
// production audience by accident — it only appears in `effective` if the
// rules engine explicitly assigned it.
export const filterInsights = <T extends AudienceTagged>(
  items: ReadonlyArray<T>,
  audience: AudienceTag,
): T[] => items.filter((item) => effectiveAudiences(item.audiences).includes(audience))

// Audience-scoped projection of TaggedNote arrays. Same shape as
// `filterInsights` but kept as a named helper so call sites read clearly.
export const notesForAudience = (
  notes: ReadonlyArray<TaggedNote>,
  audience: AudienceTag,
): TaggedNote[] => filterInsights(notes, audience)

// === Audience projection ====================================================
//
// AudienceProjection is JDAnalysis with every tagged-array field filtered to
// a single audience. We derive it from JDAnalysis via a mapped type so the
// shape stays in lockstep with the source — adding a new tagged field to
// JDAnalysis automatically participates in the projection without a manual
// edit here.

type IsTaggedArrayField<V> = V extends ReadonlyArray<AudienceTagged> ? true : false

export type AudienceProjection = {
  readonly [K in keyof JDAnalysis]: IsTaggedArrayField<JDAnalysis[K]> extends true
    ? JDAnalysis[K]
    : JDAnalysis[K]
} & {
  readonly audience: AudienceTag
}

const filterIfTagged = <T>(value: T, audience: AudienceTag): T => {
  if (!Array.isArray(value)) return value
  if (value.length === 0) return value
  // Only filter when every element is audience-tagged. Mixed/untagged arrays
  // pass through unchanged so we never drop content silently from a legacy
  // record that hasn't been re-normalized.
  const allTagged = value.every(
    (item) =>
      item !== null &&
      typeof item === 'object' &&
      'audiences' in item &&
      typeof (item as AudienceTagged).audiences === 'object',
  )
  if (!allTagged) return value
  return filterInsights(value as ReadonlyArray<AudienceTagged>, audience) as T
}

export const projectForAudience = (
  analysis: JDAnalysis,
  audience: AudienceTag,
): AudienceProjection => {
  const projected = {} as Record<string, unknown>
  for (const [key, value] of Object.entries(analysis)) {
    // evidenceMapping is a nested object whose properties are tagged arrays —
    // filter each branch independently.
    if (key === 'evidenceMapping' && value && typeof value === 'object') {
      const branch = value as JDAnalysis['evidenceMapping']
      projected.evidenceMapping = {
        topBullets: filterInsights(branch.topBullets, audience),
        topSkills: filterInsights(branch.topSkills, audience),
        topProjects: filterInsights(branch.topProjects, audience),
        topProfiles: filterInsights(branch.topProfiles, audience),
        topPhilosophy: filterInsights(branch.topPhilosophy, audience),
      }
      continue
    }
    projected[key] = filterIfTagged(value, audience)
  }
  projected.audience = audience
  return projected as AudienceProjection
}
