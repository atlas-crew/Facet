import {
  UNCLASSIFIED_AUDIENCE,
  type AudienceTag,
  type AudienceTagged,
  type AudienceResolutionSource,
  type TaggedNote,
  effectiveAudiences,
  resolveAudiences,
} from '../types/audience'
import type { JDAnalysis } from '../types/jdAnalysis'

const UNCLASSIFIED_WARN_THRESHOLD = 0.1
const MAX_WARNED_ANALYSES = 200

type AudienceCollectionKey =
  | Exclude<
      {
        [K in keyof JDAnalysis]: JDAnalysis[K] extends ReadonlyArray<AudienceTagged> ? K : never
      }[keyof JDAnalysis],
      undefined
    >
  | `evidenceMapping.${keyof JDAnalysis['evidenceMapping'] & string}`

type TaggedArrayTopLevelKey = Exclude<
  {
    [K in keyof JDAnalysis]: JDAnalysis[K] extends ReadonlyArray<AudienceTagged> ? K : never
  }[keyof JDAnalysis],
  undefined
>

const TOP_LEVEL_AUDIENCE_COLLECTIONS = [
  'warnings',
  'requirements',
  'matchedVectors',
  'skillMatches',
  'strengthsToLead',
  'advantages',
  'advantageHypotheses',
  'gaps',
  'gapFocus',
  'watchOuts',
  'triggeredPrioritize',
  'triggeredAvoid',
  'relevantAwareness',
  'positioningRecommendations',
] as const satisfies ReadonlyArray<TaggedArrayTopLevelKey>

type MissingTopLevelAudienceCollection = Exclude<
  TaggedArrayTopLevelKey,
  (typeof TOP_LEVEL_AUDIENCE_COLLECTIONS)[number]
>
const TOP_LEVEL_AUDIENCE_COLLECTIONS_ARE_EXHAUSTIVE: MissingTopLevelAudienceCollection extends never
  ? true
  : never = true
void TOP_LEVEL_AUDIENCE_COLLECTIONS_ARE_EXHAUSTIVE

export interface UnclassifiedAudienceInsight {
  key: string
  analysisId: string
  analysisLabel: string
  collection: AudienceCollectionKey
  index: number
  label: string
  text: string
}

export interface AudienceReviewInsight extends UnclassifiedAudienceInsight {
  inferredAudiences: AudienceTag[]
  assertedAudiences: AudienceTag[] | null
  effectiveAudiences: AudienceTag[]
  effectiveSource: AudienceResolutionSource
}

export interface UnclassifiedAudienceSummary {
  totalTaggedCount: number
  unclassifiedCount: number
  unclassifiedRatio: number
  insights: UnclassifiedAudienceInsight[]
}

export interface AudienceReviewSummary extends Omit<UnclassifiedAudienceSummary, 'insights'> {
  insights: AudienceReviewInsight[]
}

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

export type AudienceProjection = Readonly<JDAnalysis> & {
  readonly audience: AudienceTag
  readonly unclassifiedCount: number
  readonly unclassifiedTotal: number
  readonly unclassifiedRatio: number
  readonly unclassifiedInsights: UnclassifiedAudienceInsight[]
}

const warnedUnclassifiedAnalyses = new Set<string>()
const warnedUnclassifiedAnalysisKeys: string[] = []
const audienceReviewSummaryCache = new WeakMap<
  JDAnalysis,
  { updatedAt: string; summary: AudienceReviewSummary }
>()
const unclassifiedSummaryCache = new WeakMap<
  JDAnalysis,
  { updatedAt: string; summary: UnclassifiedAudienceSummary }
>()

const isTaggedItem = (item: unknown): item is AudienceTagged =>
  item !== null &&
  typeof item === 'object' &&
  'audiences' in item &&
  typeof (item as AudienceTagged).audiences === 'object'

const isTaggedArray = (value: unknown): value is ReadonlyArray<AudienceTagged> =>
  Array.isArray(value) && value.length > 0 && value.every(isTaggedItem)

const insightString = (item: AudienceTagged, keys: ReadonlyArray<string>): string => {
  const record = item as unknown as Record<string, unknown>
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }
  return 'Unclassified insight'
}

export const formatAudienceLabel = (value: string): string =>
  value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase())

const insightLabel = (collection: AudienceCollectionKey, item: AudienceTagged): string => {
  const text = insightString(item, [
    'label',
    'skillName',
    'title',
    'topic',
    'claim',
    'description',
    'text',
    'sourceLabel',
    'id',
  ])
  return `${formatAudienceLabel(collection)}: ${text}`
}

const insightText = (item: AudienceTagged): string =>
  insightString(item, [
    'text',
    'evidence',
    'reason',
    'presentationGuidance',
    'claim',
    'description',
    'appliesBecause',
    'action',
    'jdEvidence',
    'suggestedAction',
    'label',
  ])

const collectAudienceReviewFromArray = (
  analysis: JDAnalysis,
  collection: AudienceCollectionKey,
  items: ReadonlyArray<AudienceTagged>,
): AudienceReviewSummary => {
  const insights = items.reduce<AudienceReviewInsight[]>((accumulator, item, index) => {
    const resolution = resolveAudiences(item.audiences)
    accumulator.push({
      key: `${analysis.id}:${collection}:${index}`,
      analysisId: analysis.id,
      analysisLabel: `${analysis.company} - ${analysis.role}`,
      collection,
      index,
      label: insightLabel(collection, item),
      text: insightText(item),
      inferredAudiences: item.audiences.inferred,
      assertedAudiences: item.audiences.asserted,
      effectiveAudiences: resolution.effective,
      effectiveSource: resolution.source,
    })
    return accumulator
  }, [])
  const unclassifiedCount = insights.filter((insight) =>
    insight.effectiveAudiences.includes(UNCLASSIFIED_AUDIENCE),
  ).length

  return {
    totalTaggedCount: items.length,
    unclassifiedCount,
    unclassifiedRatio: items.length > 0 ? unclassifiedCount / items.length : 0,
    insights,
  }
}

const combineSummaries = (
  summaries: ReadonlyArray<AudienceReviewSummary>,
): AudienceReviewSummary => {
  const combined = summaries.reduce(
    (accumulator, summary) => ({
      totalTaggedCount: accumulator.totalTaggedCount + summary.totalTaggedCount,
      unclassifiedCount: accumulator.unclassifiedCount + summary.unclassifiedCount,
      insights: [...accumulator.insights, ...summary.insights],
    }),
    {
      totalTaggedCount: 0,
      unclassifiedCount: 0,
      insights: [] as AudienceReviewInsight[],
    },
  )
  return {
    ...combined,
    unclassifiedRatio:
      combined.totalTaggedCount > 0 ? combined.unclassifiedCount / combined.totalTaggedCount : 0,
  }
}

export const buildAudienceReviewSummary = (
  analysis: JDAnalysis,
): AudienceReviewSummary => {
  const cached = audienceReviewSummaryCache.get(analysis)
  if (cached?.updatedAt === analysis.updatedAt) {
    return cached.summary
  }

  const summaries: AudienceReviewSummary[] = []

  for (const key of TOP_LEVEL_AUDIENCE_COLLECTIONS) {
    const value = analysis[key]
    if (!isTaggedArray(value)) {
      continue
    }
    summaries.push(collectAudienceReviewFromArray(analysis, key, value))
  }

  for (const [key, value] of Object.entries(analysis.evidenceMapping)) {
    if (isTaggedArray(value)) {
      summaries.push(
        collectAudienceReviewFromArray(
          analysis,
          `evidenceMapping.${key}` as AudienceCollectionKey,
          value,
        ),
      )
    }
  }

  const summary = combineSummaries(summaries)
  audienceReviewSummaryCache.set(analysis, { updatedAt: analysis.updatedAt, summary })
  return summary
}

export const buildUnclassifiedAudienceSummary = (
  analysis: JDAnalysis,
): UnclassifiedAudienceSummary => {
  const cached = unclassifiedSummaryCache.get(analysis)
  if (cached?.updatedAt === analysis.updatedAt) {
    return cached.summary
  }

  const summary = buildAudienceReviewSummary(analysis)
  const insights = summary.insights.filter((insight) =>
    insight.effectiveAudiences.includes(UNCLASSIFIED_AUDIENCE),
  )
  const unclassifiedSummary = {
    totalTaggedCount: summary.totalTaggedCount,
    unclassifiedCount: summary.unclassifiedCount,
    unclassifiedRatio: summary.unclassifiedRatio,
    insights,
  }
  unclassifiedSummaryCache.set(analysis, {
    updatedAt: analysis.updatedAt,
    summary: unclassifiedSummary,
  })
  return unclassifiedSummary
}

const rememberUnclassifiedWarningKey = (warningKey: string) => {
  warnedUnclassifiedAnalyses.add(warningKey)
  warnedUnclassifiedAnalysisKeys.push(warningKey)
  while (warnedUnclassifiedAnalysisKeys.length > MAX_WARNED_ANALYSES) {
    const evicted = warnedUnclassifiedAnalysisKeys.shift()
    if (evicted) {
      warnedUnclassifiedAnalyses.delete(evicted)
    }
  }
}

const warnForUnclassifiedAudience = (
  analysis: JDAnalysis,
  audience: AudienceTag,
  summary: UnclassifiedAudienceSummary,
) => {
  if (!import.meta.env.DEV || summary.unclassifiedRatio <= UNCLASSIFIED_WARN_THRESHOLD) {
    return
  }

  const warningKey = [
    analysis.id,
    analysis.updatedAt,
    audience,
    summary.unclassifiedCount,
    summary.totalTaggedCount,
  ].join(':')
  if (warnedUnclassifiedAnalyses.has(warningKey)) {
    return
  }
  rememberUnclassifiedWarningKey(warningKey)

  console.warn(
    `[Facet] ${summary.unclassifiedCount}/${summary.totalTaggedCount} JD analysis insight(s) are unclassified for ${analysis.company} - ${analysis.role}; they are hidden from the ${audience} projection until reviewed.`,
    {
      analysisId: analysis.id,
      audience,
      unclassifiedCount: summary.unclassifiedCount,
      totalTaggedCount: summary.totalTaggedCount,
      unclassifiedInsights: summary.insights,
    },
  )
}

const filterIfTagged = <T>(value: T, audience: AudienceTag): T => {
  if (!Array.isArray(value)) return value
  if (value.length === 0) return value
  // Only filter when every element is audience-tagged. Mixed/untagged arrays
  // pass through unchanged so we never drop content silently from a legacy
  // record that hasn't been re-normalized.
  if (!isTaggedArray(value)) return value
  return filterInsights(value as ReadonlyArray<AudienceTagged>, audience) as T
}

export const projectForAudience = (
  analysis: JDAnalysis,
  audience: AudienceTag,
): AudienceProjection => {
  const unclassifiedSummary = buildUnclassifiedAudienceSummary(analysis)
  warnForUnclassifiedAudience(analysis, audience, unclassifiedSummary)

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
  projected.unclassifiedCount = unclassifiedSummary.unclassifiedCount
  projected.unclassifiedTotal = unclassifiedSummary.totalTaggedCount
  projected.unclassifiedRatio = unclassifiedSummary.unclassifiedRatio
  projected.unclassifiedInsights = unclassifiedSummary.insights
  return projected as AudienceProjection
}

const setAudienceOverride = <T extends AudienceTagged>(
  item: T,
  audiences: ReadonlyArray<AudienceTag>,
): T => {
  const asserted = Array.from(new Set(audiences))
  return {
    ...item,
    audiences: {
      ...item.audiences,
      asserted,
    },
  }
}

const patchTaggedArray = <T extends AudienceTagged>(
  items: ReadonlyArray<T>,
  index: number,
  audiences: ReadonlyArray<AudienceTag>,
): T[] =>
  items.map((item, itemIndex) =>
    itemIndex === index ? setAudienceOverride(item, audiences) : item,
  )

const resolveInsightItem = (
  analysis: JDAnalysis,
  insight: UnclassifiedAudienceInsight,
): AudienceTagged | null => {
  if (insight.collection.startsWith('evidenceMapping.')) {
    const evidenceKey = insight.collection.replace(
      'evidenceMapping.',
      '',
    ) as keyof JDAnalysis['evidenceMapping']
    const items = analysis.evidenceMapping[evidenceKey]
    return Array.isArray(items) ? items[insight.index] ?? null : null
  }

  const collection = insight.collection as keyof JDAnalysis
  const value = analysis[collection]
  if (!Array.isArray(value)) {
    return null
  }
  const item = value[insight.index]
  return isTaggedItem(item) ? item : null
}

export const setAudienceOverrideForInsightAudiences = (
  analysis: JDAnalysis,
  insight: UnclassifiedAudienceInsight,
  audiences: ReadonlyArray<AudienceTag>,
): JDAnalysis => {
  if (!resolveInsightItem(analysis, insight)) {
    return analysis
  }

  if (insight.collection.startsWith('evidenceMapping.')) {
    const evidenceKey = insight.collection.replace(
      'evidenceMapping.',
      '',
    ) as keyof JDAnalysis['evidenceMapping']
    const value = analysis.evidenceMapping[evidenceKey]
    if (!Array.isArray(value)) {
      return analysis
    }
    return {
      ...analysis,
      evidenceMapping: {
        ...analysis.evidenceMapping,
        [evidenceKey]: patchTaggedArray(value, insight.index, audiences),
      },
    }
  }

  const collection = insight.collection as keyof JDAnalysis
  const value = analysis[collection]
  if (!Array.isArray(value)) {
    return analysis
  }

  return {
    ...analysis,
    [collection]: patchTaggedArray(value as ReadonlyArray<AudienceTagged>, insight.index, audiences),
  }
}

export const setAudienceOverrideForInsight = (
  analysis: JDAnalysis,
  insight: UnclassifiedAudienceInsight,
  audience: AudienceTag,
): JDAnalysis =>
  setAudienceOverrideForInsightAudiences(
    analysis,
    insight,
    Array.from(
      new Set([
        ...((resolveInsightItem(analysis, insight)?.audiences.asserted ?? []).filter(
          (tag) => tag !== UNCLASSIFIED_AUDIENCE,
        )),
        audience,
      ]),
    ),
  )
