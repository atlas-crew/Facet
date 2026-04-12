import type {
  ProfessionalIdentityV3,
  ProfessionalMatchingSeverity,
  ProfessionalMatchingWeight,
  ProfessionalSearchVector,
  ProfessionalSkillDepth,
  ProfessionalSkillItem,
} from '../identity/schema'
import type {
  AvoidTrigger,
  FilterTrigger,
  JdMatchExtraction,
  MatchAdvantage,
  MatchAdvantageHypothesis,
  MatchAssetKind,
  MatchAssetScore,
  MatchConfidence,
  MatchGap,
  MatchGapSeverity,
  MatchHistoryEntry,
  MatchOverallFit,
  MatchRecommendation,
  MatchReport,
  MatchRequirement,
  MatchRequirementCoverage,
  MatchRequirementPriority,
  MatchedVector,
  PreparedMatchJobDescription,
  RelevantAwareness,
  SkillMatch,
  SkillMatchQuality,
  SkillRequirementStrength,
  VectorAwareMatchResult,
  WatchOut,
} from '../types/match'
import { callLlmProxy, extractJsonBlock, JsonExtractionError } from './llmProxy'
import { createId, slugify } from './idUtils'

const JD_MATCH_MODEL = 'sonnet'
const MAX_JD_WORDS = 1200
const MATCH_PROXY_TIMEOUT_MS = 60000
const PRIORITY_WEIGHTS: Record<MatchRequirementPriority, number> = {
  core: 3,
  important: 2,
  supporting: 1,
}
const VECTOR_PRIORITY_WEIGHTS = {
  high: 1,
  medium: 0.75,
  low: 0.5,
} as const satisfies Record<'high' | 'medium' | 'low', number>
const VECTOR_STRENGTH_SCORES = {
  strong: 1,
  moderate: 0.65,
  weak: 0.3,
} as const satisfies Record<'strong' | 'moderate' | 'weak', number>
const SKILL_MATCH_SCORES = {
  strong: 1,
  moderate: 0.68,
  weak: 0.34,
  negative: 0.05,
} as const satisfies Record<SkillMatchQuality, number>

interface FlattenedMatchAsset {
  kind: MatchAssetKind
  id: string
  label: string
  sourceLabel: string
  text: string
  tags: string[]
  searchTerms: string[]
}

interface RequirementMatchDetail {
  requirementId: string
  rawScore: number
  matchedTags: string[]
  matchedKeywords: string[]
}

interface SkillCandidate {
  name: string
  groupLabel: string
  item: ProfessionalSkillItem
  relatedRequirements: MatchRequirement[]
  requirementStrength: SkillRequirementStrength
}

interface HardFilterOutcome {
  filterOut: boolean
  reason: string | null
  watchOuts: WatchOut[]
  triggeredAvoid: AvoidTrigger[]
  warnings: string[]
}

interface NormalizedVectorPass {
  matchedVectors: MatchedVector[]
  warnings: string[]
}

interface NormalizedSkillPass {
  skillMatches: SkillMatch[]
  warnings: string[]
}

interface NormalizedFilterAwarenessPass {
  triggeredPrioritize: FilterTrigger[]
  triggeredAvoid: AvoidTrigger[]
  relevantAwareness: RelevantAwareness[]
  warnings: string[]
}

interface MatchArtifacts {
  analysis: VectorAwareMatchResult
  report: MatchReport
}

const JD_MATCH_SYSTEM_PROMPT = [
  "You are Facet's JD Matching Agent.",
  'Read a job description and decompose it into structured requirements that can be scored against a Professional Identity model.',
  'Return JSON only with this exact top-level shape:',
  '{',
  '  "summary": string,',
  '  "company": string,',
  '  "role": string,',
  '  "requirements": [',
  '    {',
  '      "id": string,',
  '      "label": string,',
  '      "priority": "core" | "important" | "supporting",',
  '      "evidence": string,',
  '      "tags": string[],',
  '      "keywords": string[]',
  '    }',
  '  ],',
  '  "advantage_hypotheses": [',
  '    {',
  '      "id": string,',
  '      "claim": string,',
  '      "requirement_ids": string[]',
  '    }',
  '  ],',
  '  "positioning_recommendations": string[],',
  '  "gap_focus": string[],',
  '  "warnings": string[]',
  '}',
  'Rules:',
  '- Requirements should describe real hiring needs, not generic resume advice.',
  '- Prefer tags from the provided candidate vocabulary when they fit.',
  '- Tags should be short normalized concepts like "platform", "kubernetes", "pm-communication", "linux", "observability".',
  '- Keywords should be literal JD terms worth preserving for matching.',
  '- Keep advantage hypotheses specific to this JD. They should point to combinations of requirements, not generic praise.',
  '- Use 4-8 requirements unless the JD is unusually sparse.',
  '- Do not wrap the JSON in markdown fences.',
].join('\n')

const VECTOR_MATCH_SYSTEM_PROMPT = [
  "You are Facet's vector matcher.",
  'Return JSON only:',
  '{',
  '  "vector_matches": [',
  '    {',
  '      "vector_id": string,',
  '      "match_strength": "strong" | "moderate" | "weak",',
  '      "evidence": string[],',
  '      "thesis_applies": boolean,',
  '      "thesis_fit_explanation": string',
  '    }',
  '  ]',
  '}',
  'Rules:',
  '- Only use vector ids provided in the prompt.',
  '- Evidence must be direct JD phrases or tight near-paraphrases.',
  '- Do not invent vectors.',
  '- Return an empty array when no vector is relevant.',
].join('\n')

const SKILL_MATCH_SYSTEM_PROMPT = [
  "You are Facet's skill matching pass.",
  'Return JSON only:',
  '{',
  '  "skill_matches": [',
  '    {',
  '      "skill_name": string,',
  '      "jd_requirement": string,',
  '      "presentation_guidance": string',
  '    }',
  '  ]',
  '}',
  'Rules:',
  '- Only use skill names provided in the prompt.',
  '- Provide one entry per relevant skill candidate.',
  '- Presentation guidance must be concrete and honest.',
  '- Do not invent new skill names.',
].join('\n')

const FILTER_AWARENESS_SYSTEM_PROMPT = [
  "You are Facet's filter and awareness matcher.",
  'Return JSON only:',
  '{',
  '  "triggered_prioritize": [',
  '    {',
  '      "filter_id": string,',
  '      "evidence": string',
  '    }',
  '  ],',
  '  "triggered_avoid": [',
  '    {',
  '      "filter_id": string,',
  '      "severity": "hard" | "soft",',
  '      "evidence": string',
  '    }',
  '  ],',
  '  "relevant_awareness": [',
  '    {',
  '      "awareness_id": string,',
  '      "applies_because": string',
  '    }',
  '  ]',
  '}',
  'Rules:',
  '- Only use ids provided in the prompt.',
  '- Evidence must stay grounded in the JD.',
  '- Return empty arrays when nothing applies.',
].join('\n')

const MATCH_RATIONALE_SYSTEM_PROMPT = [
  "You are Facet's match strategist.",
  'Return JSON only:',
  '{',
  '  "rationale": string',
  '}',
  'Rules:',
  '- Write one concise paragraph.',
  '- Speak directly about fit, strongest angle, and the main caution.',
  '- Stay grounded in the structured inputs.',
].join('\n')

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const assertRecord = (value: unknown, context: string): Record<string, unknown> => {
  if (!isRecord(value)) {
    throw new Error(context + ' must be an object.')
  }

  return value
}

const assertString = (value: unknown, context: string): string => {
  if (typeof value !== 'string') {
    throw new Error(context + ' must be a string.')
  }

  return value
}

const assertStringArray = (value: unknown, context: string): string[] => {
  if (!Array.isArray(value)) {
    throw new Error(context + ' must be an array.')
  }

  return value.map((entry, index) => assertString(entry, context + '[' + index + ']'))
}

const roundScore = (value: number): number => Math.round(value * 1000) / 1000

const clampScore = (value: number): number => Math.max(0, Math.min(1, roundScore(value)))

const normalizePriority = (value: unknown, context: string): MatchRequirementPriority => {
  const priority = assertString(value, context)
  if (priority === 'core' || priority === 'important' || priority === 'supporting') {
    return priority
  }

  throw new Error(context + ' must be core, important, or supporting.')
}

const normalizeTag = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const normalizeSearchText = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const dedupeNormalized = (values: string[]): string[] =>
  Array.from(new Set(values.map(normalizeTag).filter(Boolean)))

const dedupeTrimmed = (values: string[]): string[] => {
  const seen = new Set<string>()
  const next: string[] = []

  for (const value of values) {
    const trimmed = value.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    next.push(trimmed)
  }

  return next
}

const tokenizeText = (value: string): string[] =>
  Array.from(
    new Set(
      value
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 2),
    ),
  )

const escapeRegExp = (value: string): string =>
  value.replace(/[|\\{}()[\]^$+*?.-]/g, '\\$&')

const containsNormalizedPhrase = (haystack: string, needle: string): boolean => {
  const normalizedNeedle = normalizeSearchText(needle)
  if (normalizedNeedle.length < 2) {
    return false
  }

  return (' ' + haystack + ' ').includes(' ' + normalizedNeedle + ' ')
}

const containsRawPhrase = (haystack: string, needle: string): boolean => {
  const trimmedNeedle = needle.trim()
  if (trimmedNeedle.length < 2) {
    return false
  }

  return new RegExp('(^|[^a-z0-9])' + escapeRegExp(trimmedNeedle) + '(?=[^a-z0-9]|$)', 'i').test(
    haystack,
  )
}

const jdMentionsPhrase = (jdText: string, normalizedJdText: string, phrase: string): boolean =>
  containsNormalizedPhrase(normalizedJdText, phrase) || containsRawPhrase(jdText, phrase)

const normalizeRequirement = (value: unknown, index: number): MatchRequirement => {
  const record = assertRecord(value, 'requirements[' + index + ']')

  return {
    id: slugify(assertString(record.id, 'requirements[' + index + '].id')) || 'requirement-' + (index + 1),
    label: assertString(record.label, 'requirements[' + index + '].label').trim(),
    priority: normalizePriority(record.priority, 'requirements[' + index + '].priority'),
    evidence: assertString(record.evidence, 'requirements[' + index + '].evidence').trim(),
    tags: dedupeNormalized(assertStringArray(record.tags, 'requirements[' + index + '].tags')),
    keywords: dedupeTrimmed(assertStringArray(record.keywords, 'requirements[' + index + '].keywords')),
  }
}

const normalizeAdvantageHypothesis = (
  value: unknown,
  index: number,
): MatchAdvantageHypothesis => {
  const record = assertRecord(value, 'advantage_hypotheses[' + index + ']')

  return {
    id: slugify(assertString(record.id, 'advantage_hypotheses[' + index + '].id')) || 'advantage-' + (index + 1),
    claim: assertString(record.claim, 'advantage_hypotheses[' + index + '].claim').trim(),
    requirementIds: Array.from(
      new Set(
        assertStringArray(record.requirement_ids, 'advantage_hypotheses[' + index + '].requirement_ids')
          .map((entry) => slugify(entry))
          .filter(Boolean),
      ),
    ),
  }
}

const buildIdentityVocabulary = (identity: ProfessionalIdentityV3) => {
  const tagSet = new Set<string>()
  const keywordSet = new Set<string>()

  const collectTags = (values: string[]) => {
    for (const value of values) {
      const normalized = normalizeTag(value)
      if (normalized) {
        tagSet.add(normalized)
      }
    }
  }

  const collectKeywords = (value: string) => {
    for (const token of tokenizeText(value)) {
      keywordSet.add(token)
    }
  }

  collectKeywords(identity.identity.title ?? '')
  collectKeywords(identity.identity.thesis)

  for (const philosophy of identity.self_model.philosophy) {
    collectTags(philosophy.tags)
    collectKeywords(philosophy.text)
  }

  for (const profile of identity.profiles) {
    collectTags(profile.tags)
    collectKeywords(profile.text)
  }

  for (const group of identity.skills.groups) {
    collectKeywords(group.label)
    for (const item of group.items) {
      collectTags(item.tags)
      collectTags([item.name])
      collectKeywords(item.name)
    }
  }

  for (const role of identity.roles) {
    collectKeywords(role.company)
    collectKeywords(role.title)
    for (const bullet of role.bullets) {
      collectTags(bullet.tags)
      collectTags(bullet.technologies)
      collectKeywords(bullet.problem)
      collectKeywords(bullet.action)
      collectKeywords(bullet.outcome)
      collectKeywords(bullet.impact.join(' '))
    }
  }

  for (const project of identity.projects) {
    collectTags(project.tags)
    collectTags([project.name])
    collectKeywords(project.name)
    collectKeywords(project.description)
  }

  return {
    tags: Array.from(tagSet).sort(),
    keywords: Array.from(keywordSet).sort(),
  }
}

const buildIdentityContext = (identity: ProfessionalIdentityV3) => ({
  identity: {
    name: identity.identity.display_name ?? identity.identity.name,
    title: identity.identity.title ?? '',
    thesis: identity.identity.thesis,
  },
  roleArc: identity.self_model.arc,
  philosophy: identity.self_model.philosophy.map((entry) => ({
    id: entry.id,
    text: entry.text,
    tags: entry.tags,
  })),
  profiles: identity.profiles.map((profile) => ({
    id: profile.id,
    text: profile.text,
    tags: profile.tags,
  })),
  skills: identity.skills.groups.map((group) => ({
    id: group.id,
    label: group.label,
    items: group.items.map((item) => ({
      name: item.name,
      tags: item.tags,
      depth: item.depth ?? null,
      positioning: item.positioning ?? null,
    })),
  })),
  search_vectors: identity.search_vectors ?? [],
  awareness: identity.awareness?.open_questions ?? [],
  matching: identity.preferences.matching,
})

const flattenIdentityAssets = (identity: ProfessionalIdentityV3): FlattenedMatchAsset[] => {
  const assets: FlattenedMatchAsset[] = []

  for (const role of identity.roles) {
    for (const bullet of role.bullets) {
      const label =
        bullet.impact[0]?.trim() || bullet.outcome.trim() || bullet.action.trim() || bullet.problem.trim()
      const text = [bullet.problem, bullet.action, bullet.outcome]
        .map((value) => value.trim())
        .filter(Boolean)
        .join(' ')
      assets.push({
        kind: 'bullet',
        id: bullet.id,
        label,
        sourceLabel: role.company + ' - ' + role.title,
        text,
        tags: dedupeNormalized([...bullet.tags, ...bullet.technologies]),
        searchTerms: tokenizeText(
          label + ' ' + text + ' ' + bullet.impact.join(' ') + ' ' + bullet.technologies.join(' '),
        ),
      })
    }
  }

  for (const group of identity.skills.groups) {
    for (const item of group.items) {
      assets.push({
        kind: 'skill',
        id: group.id + '::' + slugify(item.name),
        label: item.name,
        sourceLabel: group.label,
        text: item.depth ? item.name + ' (' + item.depth + ')' : item.name,
        tags: dedupeNormalized([...item.tags, item.name, group.label]),
        searchTerms: tokenizeText(group.label + ' ' + item.name + ' ' + (item.depth ?? '') + ' ' + (item.context ?? '')),
      })
    }
  }

  for (const project of identity.projects) {
    assets.push({
      kind: 'project',
      id: project.id,
      label: project.name,
      sourceLabel: 'Project',
      text: project.description,
      tags: dedupeNormalized([...project.tags, project.name]),
      searchTerms: tokenizeText(project.name + ' ' + project.description),
    })
  }

  for (const profile of identity.profiles) {
    assets.push({
      kind: 'profile',
      id: profile.id,
      label: profile.id,
      sourceLabel: 'Profile',
      text: profile.text,
      tags: dedupeNormalized(profile.tags),
      searchTerms: tokenizeText(profile.text),
    })
  }

  for (const philosophy of identity.self_model.philosophy) {
    assets.push({
      kind: 'philosophy',
      id: philosophy.id,
      label: philosophy.text.slice(0, 72),
      sourceLabel: 'Philosophy',
      text: philosophy.text,
      tags: dedupeNormalized(philosophy.tags),
      searchTerms: tokenizeText(philosophy.text),
    })
  }

  return assets
}

const scoreAssetAgainstRequirement = (
  asset: FlattenedMatchAsset,
  requirement: MatchRequirement,
): RequirementMatchDetail => {
  const matchedTags = requirement.tags.filter((tag) => asset.tags.includes(tag))
  const requirementKeywords = requirement.keywords.map((keyword) => keyword.toLowerCase())
  const matchedKeywords = requirementKeywords.filter(
    (keyword) => asset.searchTerms.includes(keyword) || asset.tags.includes(normalizeTag(keyword)),
  )

  const tagCoverage =
    matchedTags.length === 0 ? 0 : matchedTags.length / Math.max(1, Math.min(requirement.tags.length, 4))
  const keywordCoverage =
    matchedKeywords.length === 0
      ? 0
      : matchedKeywords.length / Math.max(1, Math.min(requirementKeywords.length, 4))

  const synergyBoost = matchedTags.length > 0 && matchedKeywords.length > 0 ? 0.1 : 0
  const rawScore = Math.min(1, tagCoverage * 0.75 + keywordCoverage * 0.25 + synergyBoost)

  return {
    requirementId: requirement.id,
    rawScore,
    matchedTags,
    matchedKeywords,
  }
}

const rankAssets = (
  assets: FlattenedMatchAsset[],
  requirements: MatchRequirement[],
): {
  scoredAssets: MatchAssetScore[]
  requirements: MatchRequirementCoverage[]
  matchScore: number
} => {
  const totalWeight = requirements.reduce((sum, requirement) => sum + PRIORITY_WEIGHTS[requirement.priority], 0)
  const priorityByRequirementId = new Map(
    requirements.map((requirement) => [requirement.id, requirement.priority] as const),
  )

  const scoredAssets: MatchAssetScore[] = assets
    .map((asset) => {
      const details = requirements
        .map((requirement) => scoreAssetAgainstRequirement(asset, requirement))
        .filter((detail) => detail.rawScore > 0)
      const weightedScore = details.reduce(
        (total, detail) =>
          total +
          detail.rawScore * PRIORITY_WEIGHTS[priorityByRequirementId.get(detail.requirementId) ?? 'supporting'],
        0,
      )

      return {
        kind: asset.kind,
        id: asset.id,
        label: asset.label,
        sourceLabel: asset.sourceLabel,
        text: asset.text,
        tags: asset.tags,
        matchedTags: Array.from(new Set(details.flatMap((detail) => detail.matchedTags))),
        matchedKeywords: Array.from(new Set(details.flatMap((detail) => detail.matchedKeywords))),
        matchedRequirementIds: Array.from(new Set(details.map((detail) => detail.requirementId))),
        score: totalWeight > 0 ? roundScore(weightedScore / totalWeight) : 0,
      }
    })
    .filter((asset) => asset.score > 0)
    .sort((left, right) => right.score - left.score || left.label.localeCompare(right.label))

  const requirementCoverage: MatchRequirementCoverage[] = requirements.map((requirement) => {
    const matches = assets
      .map((asset) => scoreAssetAgainstRequirement(asset, requirement))
      .filter((detail) => detail.rawScore > 0)
    const coverageScore = matches.reduce((best, detail) => Math.max(best, detail.rawScore), 0)
    return {
      ...requirement,
      coverageScore: roundScore(coverageScore),
      matchedAssetCount: matches.filter((detail) => detail.rawScore >= 0.25).length,
      matchedTags: Array.from(new Set(matches.flatMap((detail) => detail.matchedTags))),
    }
  })

  const achievedWeight = requirementCoverage.reduce(
    (sum, requirement) => sum + requirement.coverageScore * PRIORITY_WEIGHTS[requirement.priority],
    0,
  )

  return {
    scoredAssets,
    requirements: requirementCoverage,
    matchScore: totalWeight > 0 ? roundScore(achievedWeight / totalWeight) : 0,
  }
}

const buildGapReason = (requirement: MatchRequirementCoverage): string => {
  if (requirement.coverageScore < 0.15) {
    return 'No strong evidence found for ' + requirement.label + ' in the current identity model.'
  }

  return 'Only partial evidence was found for ' + requirement.label + '; the identity model may need stronger stories or clearer tags.'
}

const buildGaps = (requirements: MatchRequirementCoverage[]): MatchGap[] =>
  requirements
    .filter((requirement) => requirement.coverageScore < 0.45)
    .map((requirement) => {
      let severity: MatchGapSeverity = 'low'
      if (requirement.priority === 'core') {
        severity = requirement.coverageScore < 0.15 ? 'high' : 'medium'
      } else if (requirement.priority === 'important') {
        severity = requirement.coverageScore < 0.15 ? 'medium' : 'low'
      }

      return {
        requirementId: requirement.id,
        label: requirement.label,
        severity,
        reason: buildGapReason(requirement),
        tags: requirement.tags,
      }
    })

const buildFallbackAdvantages = (
  requirements: MatchRequirementCoverage[],
  assets: MatchAssetScore[],
): MatchAdvantage[] =>
  requirements
    .filter((requirement) => requirement.coverageScore >= 0.6)
    .slice(0, 2)
    .map((requirement, index) => ({
      id: 'fallback-advantage-' + (index + 1),
      claim: 'You have credible evidence for ' + requirement.label + ' that can be positioned confidently for this role.',
      requirementIds: [requirement.id],
      evidence: assets.filter((asset) => asset.matchedRequirementIds.includes(requirement.id)).slice(0, 3),
    }))
    .filter((advantage) => advantage.evidence.length > 0)

const buildAdvantages = (
  hypotheses: MatchAdvantageHypothesis[],
  requirements: MatchRequirementCoverage[],
  assets: MatchAssetScore[],
): MatchAdvantage[] => {
  const advantages = hypotheses
    .map((hypothesis) => {
      const requirementIds = hypothesis.requirementIds.filter((requirementId) =>
        requirements.some((requirement) => requirement.id === requirementId),
      )
      const evidence = assets
        .filter((asset) =>
          asset.matchedRequirementIds.some((requirementId) => requirementIds.includes(requirementId)),
        )
        .slice(0, 4)

      return {
        id: hypothesis.id,
        claim: hypothesis.claim,
        requirementIds,
        evidence,
      }
    })
    .filter((advantage) => advantage.requirementIds.length > 0 && advantage.evidence.length > 0)

  return advantages.length > 0 ? advantages : buildFallbackAdvantages(requirements, assets)
}

const takeTopByKind = (
  assets: MatchAssetScore[],
  kind: MatchAssetKind,
  limit: number,
): MatchAssetScore[] => assets.filter((asset) => asset.kind === kind).slice(0, limit)

const findMatchingLine = (text: string, description: string): string => {
  const normalizedDescription = normalizeSearchText(description)
  const descriptionTokens = tokenizeText(description).filter((token) => token.length >= 4)
  const lines = text
    .split(/\n+/)
    .flatMap((entry) => entry.match(/[^.!?]+(?:[.!?]+|$)/g) ?? [entry])
    .map((entry) => entry.trim())
    .filter(Boolean)

  for (const line of lines) {
    const normalizedLine = normalizeSearchText(line)
    if (normalizedDescription && normalizedLine.includes(normalizedDescription)) {
      return line
    }

    const lineTokens = new Set(tokenizeText(line).filter((token) => token.length >= 4))
    const overlap = descriptionTokens.filter((token) => lineTokens.has(token))
    if (overlap.length >= Math.max(2, Math.ceil(descriptionTokens.length * 0.6))) {
      return line
    }
  }

  return description.trim()
}

const descriptionMatchesJd = (text: string, description: string): boolean => {
  const normalizedDescription = normalizeSearchText(description)
  const normalizedJd = normalizeSearchText(text)
  if (normalizedDescription && normalizedJd.includes(normalizedDescription)) {
    return true
  }

  const descriptionTokens = tokenizeText(description).filter((token) => token.length >= 4)
  if (descriptionTokens.length === 0) {
    return false
  }

  const overlap = descriptionTokens.filter((token) => normalizedJd.includes(token))
  return overlap.length >= Math.max(2, Math.ceil(descriptionTokens.length * 0.6))
}

const parseSalaryValues = (text: string): number[] => {
  const matches = text.matchAll(/(\$|usd\s*)?(\d{1,3}(?:,\d{3})+|\d+)(\s*[kK])?/gi)
  const values: number[] = []

  for (const match of matches) {
    const hasCurrencyPrefix = Boolean(match[1])
    const rawNumber = match[2]
    if (!rawNumber) continue
    const hasK = Boolean(match[3])
    const hasCommaThousands = rawNumber.includes(',')
    const normalized = Number(rawNumber.replace(/,/g, ''))
    if (!Number.isFinite(normalized)) continue
    if (!hasCurrencyPrefix && !hasK && !hasCommaThousands) continue

    let value = normalized
    if (hasK || (!hasCommaThousands && normalized < 1000)) {
      value *= 1000
    }

    if (value >= 30000 && value <= 1000000) {
      values.push(value)
    }
  }

  return values
}

const deriveUserDepth = (item: ProfessionalSkillItem): ProfessionalSkillDepth => {
  if (item.depth) {
    return item.depth
  }

  return 'basic'
}

const deriveRequirementStrength = (requirements: MatchRequirement[]): SkillRequirementStrength => {
  if (requirements.some((requirement) => requirement.priority === 'core')) {
    return 'required'
  }
  if (requirements.some((requirement) => requirement.priority === 'important')) {
    return 'preferred'
  }
  return 'nice-to-have'
}

const determineMatchQuality = (
  depth: ProfessionalSkillDepth,
  requirementStrength: SkillRequirementStrength,
): SkillMatchQuality => {
  if (depth === 'avoid') {
    return requirementStrength === 'nice-to-have' ? 'weak' : 'negative'
  }
  if (depth === 'expert') {
    return 'strong'
  }
  if (depth === 'strong') {
    return requirementStrength === 'nice-to-have' ? 'moderate' : 'strong'
  }
  if (depth === 'working') {
    return requirementStrength === 'nice-to-have' ? 'weak' : 'moderate'
  }

  return 'weak'
}

const buildFallbackSkillGuidance = (
  skillName: string,
  depth: ProfessionalSkillDepth,
  requirementStrength: SkillRequirementStrength,
  signal: string,
): string => {
  if (signal.trim()) {
    return signal.trim()
  }
  if (depth === 'avoid') {
    return 'Do not lead with ' + skillName + '. Acknowledge only if necessary and redirect to adjacent strengths.'
  }
  if (depth === 'working' && requirementStrength === 'required') {
    return 'Mention ' + skillName + ' honestly with a caveat. Position it as working depth, not deep specialization.'
  }
  if (depth === 'expert' || depth === 'strong') {
    return 'Lead with ' + skillName + ' as a credible strength for this role.'
  }

  return 'Standard match. Present neutrally.'
}

const normalizeVectorStrength = (value: unknown, context: string): 'strong' | 'moderate' | 'weak' => {
  const strength = assertString(value, context)
  if (strength === 'strong' || strength === 'moderate' || strength === 'weak') {
    return strength
  }

  throw new Error(context + ' must be strong, moderate, or weak.')
}

const normalizeSeverity = (
  value: unknown,
  context: string,
): ProfessionalMatchingSeverity => {
  const severity = assertString(value, context)
  if (severity === 'hard' || severity === 'soft') {
    return severity
  }

  throw new Error(context + ' must be hard or soft.')
}

const buildHardFilterWatchOut = ({
  type,
  referenceId,
  description,
  action,
}: {
  type: WatchOut['type']
  referenceId: string
  description: string
  action: string
}): WatchOut => ({
  type,
  referenceId,
  description,
  severity: 'hard',
  suggestedAction: action,
})

export const runHardFilters = (
  identity: ProfessionalIdentityV3,
  prepared: PreparedMatchJobDescription,
): HardFilterOutcome => {
  const watchOuts: WatchOut[] = []
  const triggeredAvoid: AvoidTrigger[] = []
  const warnings: string[] = []
  const matching = identity.preferences.matching

  for (const avoid of matching?.avoid ?? []) {
    if (avoid.severity !== 'hard') continue
    if (!descriptionMatchesJd(prepared.content, avoid.description)) continue

    triggeredAvoid.push({
      filterId: avoid.id,
      label: avoid.label,
      severity: 'hard',
      jdEvidence: findMatchingLine(prepared.content, avoid.description),
    })
    watchOuts.push(
      buildHardFilterWatchOut({
        type: 'filter_risk',
        referenceId: avoid.id,
        description: 'Hard avoid triggered: ' + avoid.label + '.',
        action: 'Skip this opportunity unless the JD is misleading or the role can be clarified.',
      }),
    )
  }

  const clearance = identity.preferences.constraints?.clearance
  if (clearance?.exclude_required && /clearance|ts\/sci|top secret|secret clearance|public trust/i.test(prepared.content)) {
    watchOuts.push(
      buildHardFilterWatchOut({
        type: 'filter_risk',
        referenceId: 'clearance-required',
        description: 'JD requires security clearance and the current preferences exclude required clearance roles.',
        action: 'Skip unless the requirement is flexible.',
      }),
    )
    warnings.push('Security clearance requirement triggered a hard filter.')
  }

  const baseFloor = identity.preferences.compensation?.base_floor
  if (typeof baseFloor === 'number') {
    const salaryValues = parseSalaryValues(prepared.content)
    const topRange = salaryValues.length > 0 ? Math.max(...salaryValues) : null
    if (topRange !== null && topRange < baseFloor) {
      watchOuts.push(
        buildHardFilterWatchOut({
          type: 'comp_concern',
          referenceId: 'comp-floor',
          description: 'JD top salary band (' + topRange.toLocaleString() + ') sits below the candidate base-floor preference.',
          action: 'Skip unless compensation flexibility is confirmed.',
        }),
      )
      warnings.push('Compensation floor triggered a hard filter.')
    }
  }

  const hardNo = identity.preferences.work_model?.hard_no?.trim()
  if (hardNo && descriptionMatchesJd(prepared.content, hardNo)) {
    watchOuts.push(
      buildHardFilterWatchOut({
        type: 'filter_risk',
        referenceId: 'work-model-hard-no',
        description: 'JD appears to match the work-model hard-no preference: ' + hardNo + '.',
        action: 'Skip unless the work model can be negotiated.',
      }),
    )
    warnings.push('Work model hard-no triggered a hard filter.')
  }

  const filterOut = watchOuts.length > 0
  return {
    filterOut,
    reason: filterOut ? watchOuts[0]?.description ?? 'Hard filter triggered.' : null,
    watchOuts,
    triggeredAvoid,
    warnings,
  }
}

export const prepareMatchJobDescription = (raw: string): PreparedMatchJobDescription => {
  const words = raw.split(/\s+/).filter((word) => word.length > 0)
  const wordCount = words.length
  const truncated = wordCount > MAX_JD_WORDS

  return {
    content: words.slice(0, MAX_JD_WORDS).join(' '),
    wordCount,
    truncated,
  }
}

export const parseJdMatchExtractionResponse = (rawResponse: string): JdMatchExtraction => {
  let parsed: unknown
  try {
    parsed = JSON.parse(extractJsonBlock(rawResponse))
  } catch (error) {
    if (error instanceof JsonExtractionError) {
      throw error
    }
    throw new Error(error instanceof Error ? error.message : 'Unable to parse JD match response.')
  }

  const root = assertRecord(parsed, 'jd match response')
  const requirementsValue = Array.isArray(root.requirements) ? root.requirements : []
  const hypothesesValue = Array.isArray(root.advantage_hypotheses) ? root.advantage_hypotheses : []

  return {
    summary: assertString(root.summary, 'summary').trim(),
    company: assertString(root.company ?? '', 'company').trim(),
    role: assertString(root.role ?? '', 'role').trim(),
    requirements: requirementsValue.map((entry, index) => normalizeRequirement(entry, index)),
    advantageHypotheses: hypothesesValue.map((entry, index) =>
      normalizeAdvantageHypothesis(entry, index),
    ),
    positioningRecommendations:
      root.positioning_recommendations === undefined
        ? []
        : assertStringArray(root.positioning_recommendations, 'positioning_recommendations')
            .map((entry) => entry.trim())
            .filter(Boolean),
    gapFocus:
      root.gap_focus === undefined
        ? []
        : assertStringArray(root.gap_focus, 'gap_focus')
            .map((entry) => entry.trim())
            .filter(Boolean),
    warnings:
      root.warnings === undefined
        ? []
        : assertStringArray(root.warnings, 'warnings')
            .map((entry) => entry.trim())
            .filter(Boolean),
  }
}

export const createJobMatchReport = ({
  identity,
  prepared,
  extraction,
  matchScoreOverride,
  summaryOverride,
  positioningRecommendationsOverride,
  gapFocusOverride,
  warningsOverride,
}: {
  identity: ProfessionalIdentityV3
  prepared: PreparedMatchJobDescription
  extraction: JdMatchExtraction
  matchScoreOverride?: number
  summaryOverride?: string
  positioningRecommendationsOverride?: string[]
  gapFocusOverride?: string[]
  warningsOverride?: string[]
}): MatchReport => {
  const flattenedAssets = flattenIdentityAssets(identity)
  const ranked = rankAssets(flattenedAssets, extraction.requirements)
  const gaps = buildGaps(ranked.requirements)
  const advantages = buildAdvantages(extraction.advantageHypotheses, ranked.requirements, ranked.scoredAssets)
  const baseWarnings = [
    ...extraction.warnings,
    ...(prepared.truncated ? ['Job description exceeded ' + MAX_JD_WORDS + ' words and was truncated for analysis.'] : []),
  ]

  return {
    generatedAt: new Date().toISOString(),
    identityVersion: identity.version,
    company: extraction.company,
    role: extraction.role,
    summary: (summaryOverride ?? extraction.summary).trim(),
    jobDescription: prepared.content,
    matchScore: clampScore(matchScoreOverride ?? ranked.matchScore),
    requirements: ranked.requirements,
    topBullets: takeTopByKind(ranked.scoredAssets, 'bullet', 8),
    topSkills: takeTopByKind(ranked.scoredAssets, 'skill', 8),
    topProjects: takeTopByKind(ranked.scoredAssets, 'project', 4),
    topProfiles: takeTopByKind(ranked.scoredAssets, 'profile', 4),
    topPhilosophy: takeTopByKind(ranked.scoredAssets, 'philosophy', 4),
    gaps,
    advantages,
    positioningRecommendations:
      positioningRecommendationsOverride ?? extraction.positioningRecommendations,
    gapFocus: gapFocusOverride ?? extraction.gapFocus,
    warnings: warningsOverride ?? dedupeTrimmed(baseWarnings),
  }
}

const buildMatchPrompt = ({
  identity,
  prepared,
}: {
  identity: ProfessionalIdentityV3
  prepared: PreparedMatchJobDescription
}) => {
  const vocabulary = buildIdentityVocabulary(identity)
  const identityContext = buildIdentityContext(identity)

  return [
    'Job description:',
    prepared.content,
    '',
    'Candidate tag vocabulary:',
    JSON.stringify(vocabulary, null, 2),
    '',
    'Candidate identity outline:',
    JSON.stringify(identityContext, null, 2),
    '',
    'Return the structured JD match report input as JSON only.',
  ].join('\n')
}

const callMatchPass = async ({
  endpoint,
  systemPrompt,
  userPrompt,
}: {
  endpoint: string
  systemPrompt: string
  userPrompt: string
}): Promise<string> => {
  let lastError: unknown
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await callLlmProxy(endpoint, systemPrompt, userPrompt, {
        feature: 'match.jd-analysis',
        model: JD_MATCH_MODEL,
        temperature: 0.1,
        timeoutMs: MATCH_PROXY_TIMEOUT_MS,
      })
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Match pass failed.')
}

const buildVectorPrompt = ({
  prepared,
  identity,
}: {
  prepared: PreparedMatchJobDescription
  identity: ProfessionalIdentityV3
}) =>
  [
    'Job description:',
    prepared.content,
    '',
    'Role arc:',
    JSON.stringify(identity.self_model.arc, null, 2),
    '',
    'Search vectors:',
    JSON.stringify(identity.search_vectors ?? [], null, 2),
  ].join('\n')

export const normalizeVectorMatchPayload = ({
  rawResponse,
  vectors,
  prepared,
}: {
  rawResponse: string
  vectors: ProfessionalSearchVector[]
  prepared: PreparedMatchJobDescription
}): NormalizedVectorPass => {
  let parsed: unknown
  try {
    parsed = JSON.parse(extractJsonBlock(rawResponse))
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Unable to parse vector match response.')
  }

  const root = assertRecord(parsed, 'vector match response')
  const entries = Array.isArray(root.vector_matches) ? root.vector_matches : []
  const vectorById = new Map(vectors.map((vector) => [vector.id, vector]))
  const matchedVectors: MatchedVector[] = []
  const warnings: string[] = []

  for (const [index, entry] of entries.entries()) {
    const record = assertRecord(entry, 'vector_matches[' + index + ']')
    const vectorId = assertString(record.vector_id, 'vector_matches[' + index + '].vector_id').trim()
    const vector = vectorById.get(vectorId)
    if (!vector) {
      warnings.push('Dropped unknown vector match id: ' + vectorId + '.')
      continue
    }

    let matchStrength = normalizeVectorStrength(
      record.match_strength,
      'vector_matches[' + index + '].match_strength',
    )
    if (vector.priority === 'low' && matchStrength === 'strong') {
      matchStrength = 'moderate'
    }

    const evidence = dedupeTrimmed(
      (Array.isArray(record.evidence)
        ? assertStringArray(record.evidence, 'vector_matches[' + index + '].evidence')
        : []
      ).map((line) => {
        const trimmed = line.trim()
        return normalizeSearchText(prepared.content).includes(normalizeSearchText(trimmed))
          ? trimmed
          : findMatchingLine(prepared.content, trimmed)
      }),
    )

    matchedVectors.push({
      vectorId: vector.id,
      title: vector.title,
      priority: vector.priority,
      matchStrength,
      evidence,
      thesisApplies: Boolean(record.thesis_applies),
      thesisFitExplanation: String(record.thesis_fit_explanation ?? '').trim(),
    })
  }

  matchedVectors.sort((left, right) => {
    const priorityDelta = VECTOR_PRIORITY_WEIGHTS[right.priority] - VECTOR_PRIORITY_WEIGHTS[left.priority]
    if (priorityDelta !== 0) return priorityDelta
    const strengthDelta =
      VECTOR_STRENGTH_SCORES[right.matchStrength] - VECTOR_STRENGTH_SCORES[left.matchStrength]
    if (strengthDelta !== 0) return strengthDelta
    return left.title.localeCompare(right.title)
  })

  return {
    matchedVectors,
    warnings,
  }
}

const buildSkillCandidates = (
  identity: ProfessionalIdentityV3,
  extraction: JdMatchExtraction,
  prepared: PreparedMatchJobDescription,
): SkillCandidate[] => {
  const normalizedJd = normalizeSearchText(prepared.content)
  const candidates: SkillCandidate[] = []

  for (const group of identity.skills.groups) {
    for (const item of group.items) {
      const normalizedName = normalizeTag(item.name)
      const normalizedTags = dedupeNormalized([...item.tags, item.name, group.label])
      const relatedRequirements = extraction.requirements.filter((requirement) => {
        const keywordHit = requirement.keywords.some((keyword) => {
          const keywordMentionsSkill =
            containsNormalizedPhrase(normalizeSearchText(keyword), item.name) ||
            containsRawPhrase(keyword, item.name)
          const keywordAppearsInJd = jdMentionsPhrase(prepared.content, normalizedJd, keyword)

          return keywordMentionsSkill || (keywordAppearsInJd && normalizedTags.includes(normalizeTag(keyword)))
        })
        const tagHit = requirement.tags.some((tag) => normalizedTags.includes(tag))
        const nameHit = requirement.keywords.some(
          (keyword) => normalizeTag(keyword) === normalizedName || containsRawPhrase(keyword, item.name),
        )
        return keywordHit || tagHit || nameHit
      })
      const directMention =
        jdMentionsPhrase(prepared.content, normalizedJd, item.name) ||
        item.tags.some((tag) => jdMentionsPhrase(prepared.content, normalizedJd, tag))

      if (!directMention && relatedRequirements.length === 0) {
        continue
      }

      candidates.push({
        name: item.name,
        groupLabel: group.label,
        item,
        relatedRequirements,
        requirementStrength: deriveRequirementStrength(relatedRequirements),
      })
    }
  }

  return candidates
    .sort((left, right) => {
      const requirementDelta = right.relatedRequirements.length - left.relatedRequirements.length
      if (requirementDelta !== 0) return requirementDelta
      return left.name.localeCompare(right.name)
    })
    .slice(0, 18)
}

const buildSkillPrompt = ({
  prepared,
  candidates,
}: {
  prepared: PreparedMatchJobDescription
  candidates: SkillCandidate[]
}) =>
  [
    'Job description:',
    prepared.content,
    '',
    'Skill candidates:',
    JSON.stringify(
      candidates.map((candidate) => ({
        skill_name: candidate.name,
        group: candidate.groupLabel,
        user_depth: deriveUserDepth(candidate.item),
        context: candidate.item.context ?? '',
        positioning: candidate.item.positioning ?? '',
        jd_requirement_strength: candidate.requirementStrength,
        related_requirements: candidate.relatedRequirements.map((requirement) => ({
          label: requirement.label,
          evidence: requirement.evidence,
        })),
      })),
      null,
      2,
    ),
  ].join('\n')

export const normalizeSkillMatchPayload = ({
  rawResponse,
  candidates,
}: {
  rawResponse: string
  candidates: SkillCandidate[]
}): NormalizedSkillPass => {
  let parsed: unknown
  try {
    parsed = JSON.parse(extractJsonBlock(rawResponse))
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Unable to parse skill match response.')
  }

  const root = assertRecord(parsed, 'skill match response')
  const entries = Array.isArray(root.skill_matches) ? root.skill_matches : []
  const candidateByName = new Map(candidates.map((candidate) => [candidate.name.toLowerCase(), candidate]))
  const skillMatches: SkillMatch[] = []
  const warnings: string[] = []
  const seen = new Set<string>()

  for (const [index, entry] of entries.entries()) {
    const record = assertRecord(entry, 'skill_matches[' + index + ']')
    const skillName = assertString(record.skill_name, 'skill_matches[' + index + '].skill_name').trim()
    const candidate = candidateByName.get(skillName.toLowerCase())
    if (!candidate) {
      warnings.push('Dropped unknown skill match: ' + skillName + '.')
      continue
    }
    if (seen.has(candidate.name.toLowerCase())) {
      continue
    }
    seen.add(candidate.name.toLowerCase())
    const userDepth = deriveUserDepth(candidate.item)
    const userPositioning = candidate.item.positioning?.trim() ?? ''

    skillMatches.push({
      skillName: candidate.name,
      jdRequirement:
        String(record.jd_requirement ?? '').trim() ||
        candidate.relatedRequirements[0]?.evidence ||
        'JD mentions or implies ' + candidate.name + '.',
      requirementStrength: candidate.requirementStrength,
      userDepth,
      userPositioning,
      matchQuality: determineMatchQuality(userDepth, candidate.requirementStrength),
      presentationGuidance:
        String(record.presentation_guidance ?? '').trim() ||
        buildFallbackSkillGuidance(
          candidate.name,
          userDepth,
          candidate.requirementStrength,
          userPositioning,
        ),
    })
  }

  for (const candidate of candidates) {
    if (seen.has(candidate.name.toLowerCase())) continue
    const userDepth = deriveUserDepth(candidate.item)
    const userPositioning = candidate.item.positioning?.trim() ?? ''
    skillMatches.push({
      skillName: candidate.name,
      jdRequirement:
        candidate.relatedRequirements[0]?.evidence ||
        'JD mentions or implies ' + candidate.name + '.',
      requirementStrength: candidate.requirementStrength,
      userDepth,
      userPositioning,
      matchQuality: determineMatchQuality(userDepth, candidate.requirementStrength),
      presentationGuidance: buildFallbackSkillGuidance(
        candidate.name,
        userDepth,
        candidate.requirementStrength,
        userPositioning,
      ),
    })
  }

  skillMatches.sort((left, right) => {
    const qualityDelta = SKILL_MATCH_SCORES[right.matchQuality] - SKILL_MATCH_SCORES[left.matchQuality]
    if (qualityDelta !== 0) return qualityDelta
    return left.skillName.localeCompare(right.skillName)
  })

  return {
    skillMatches,
    warnings,
  }
}

const buildFilterAwarenessPrompt = ({
  prepared,
  identity,
}: {
  prepared: PreparedMatchJobDescription
  identity: ProfessionalIdentityV3
}) =>
  [
    'Job description:',
    prepared.content,
    '',
    'Prioritize filters:',
    JSON.stringify(identity.preferences.matching?.prioritize ?? [], null, 2),
    '',
    'Avoid filters:',
    JSON.stringify(identity.preferences.matching?.avoid ?? [], null, 2),
    '',
    'Awareness items:',
    JSON.stringify(identity.awareness?.open_questions ?? [], null, 2),
  ].join('\n')

export const normalizeFilterAwarenessPayload = ({
  rawResponse,
  identity,
}: {
  rawResponse: string
  identity: ProfessionalIdentityV3
}): NormalizedFilterAwarenessPass => {
  let parsed: unknown
  try {
    parsed = JSON.parse(extractJsonBlock(rawResponse))
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : 'Unable to parse filter and awareness response.',
    )
  }

  const root = assertRecord(parsed, 'filter awareness response')
  const prioritizeById = new Map(
    (identity.preferences.matching?.prioritize ?? []).map((entry) => [entry.id, entry]),
  )
  const avoidById = new Map((identity.preferences.matching?.avoid ?? []).map((entry) => [entry.id, entry]))
  const awarenessById = new Map(
    (identity.awareness?.open_questions ?? []).map((entry) => [entry.id, entry]),
  )
  const warnings: string[] = []

  const triggeredPrioritize = (Array.isArray(root.triggered_prioritize) ? root.triggered_prioritize : [])
    .map((entry, index) => {
      const record = assertRecord(entry, 'triggered_prioritize[' + index + ']')
      const filterId = assertString(record.filter_id, 'triggered_prioritize[' + index + '].filter_id').trim()
      const filter = prioritizeById.get(filterId)
      if (!filter) {
        warnings.push('Dropped unknown prioritize filter id: ' + filterId + '.')
        return null
      }

      return {
        filterId,
        label: filter.label,
        weight: filter.weight,
        jdEvidence: String(record.evidence ?? '').trim() || filter.description,
      } satisfies FilterTrigger
    })
    .filter((entry): entry is FilterTrigger => entry !== null)

  const triggeredAvoid = (Array.isArray(root.triggered_avoid) ? root.triggered_avoid : [])
    .map((entry, index) => {
      const record = assertRecord(entry, 'triggered_avoid[' + index + ']')
      const filterId = assertString(record.filter_id, 'triggered_avoid[' + index + '].filter_id').trim()
      const filter = avoidById.get(filterId)
      if (!filter) {
        warnings.push('Dropped unknown avoid filter id: ' + filterId + '.')
        return null
      }

      return {
        filterId,
        label: filter.label,
        severity: normalizeSeverity(record.severity ?? filter.severity, 'triggered_avoid[' + index + '].severity'),
        jdEvidence: String(record.evidence ?? '').trim() || filter.description,
      } satisfies AvoidTrigger
    })
    .filter((entry): entry is AvoidTrigger => entry !== null)

  const relevantAwareness = (Array.isArray(root.relevant_awareness) ? root.relevant_awareness : [])
    .map((entry, index) => {
      const record = assertRecord(entry, 'relevant_awareness[' + index + ']')
      const awarenessId = assertString(record.awareness_id, 'relevant_awareness[' + index + '].awareness_id').trim()
      const awareness = awarenessById.get(awarenessId)
      if (!awareness) {
        warnings.push('Dropped unknown awareness id: ' + awarenessId + '.')
        return null
      }

      return {
        awarenessId,
        topic: awareness.topic,
        severity: awareness.severity ?? 'medium',
        appliesBecause: String(record.applies_because ?? '').trim() || awareness.description,
        action: awareness.action,
      } satisfies RelevantAwareness
    })
    .filter((entry): entry is RelevantAwareness => entry !== null)

  return {
    triggeredPrioritize,
    triggeredAvoid,
    relevantAwareness,
    warnings,
  }
}

const computeVectorScore = (matchedVectors: MatchedVector[]): number => {
  if (matchedVectors.length === 0) {
    return 0
  }

  return clampScore(
    Math.max(
      ...matchedVectors.map(
        (vector) => VECTOR_PRIORITY_WEIGHTS[vector.priority] * VECTOR_STRENGTH_SCORES[vector.matchStrength],
      ),
    ),
  )
}

const computeSkillScore = (skillMatches: SkillMatch[]): number => {
  if (skillMatches.length === 0) {
    return 0.25
  }

  return clampScore(
    skillMatches.reduce((sum, skillMatch) => sum + SKILL_MATCH_SCORES[skillMatch.matchQuality], 0) /
      skillMatches.length,
  )
}

const applyWeightDelta = (current: number, weight: ProfessionalMatchingWeight): number => {
  if (weight === 'high') return current + 0.2
  if (weight === 'medium') return current + 0.12
  return current + 0.06
}

const applySeverityDelta = (current: number, severity: ProfessionalMatchingSeverity): number =>
  severity === 'hard' ? current - 0.45 : current - 0.22

const computeFilterScore = ({
  triggeredPrioritize,
  triggeredAvoid,
  relevantAwareness,
}: Pick<VectorAwareMatchResult, 'triggeredPrioritize' | 'triggeredAvoid' | 'relevantAwareness'>): number => {
  let score = 0.55

  for (const trigger of triggeredPrioritize) {
    score = applyWeightDelta(score, trigger.weight)
  }
  for (const trigger of triggeredAvoid) {
    score = applySeverityDelta(score, trigger.severity)
  }
  for (const awareness of relevantAwareness) {
    if (awareness.severity === 'high') score -= 0.15
    else if (awareness.severity === 'medium') score -= 0.1
    else score -= 0.05
  }

  return clampScore(score)
}

const computeConfidence = ({
  extraction,
  matchedVectors,
  skillMatches,
  triggeredPrioritize,
  triggeredAvoid,
  hardFilter,
}: {
  extraction: JdMatchExtraction
  matchedVectors: MatchedVector[]
  skillMatches: SkillMatch[]
  triggeredPrioritize: FilterTrigger[]
  triggeredAvoid: AvoidTrigger[]
  hardFilter: HardFilterOutcome
}): MatchConfidence => {
  if (hardFilter.filterOut) {
    return 'high'
  }

  const evidenceCount =
    matchedVectors.reduce((sum, vector) => sum + vector.evidence.length, 0) +
    skillMatches.length +
    triggeredPrioritize.length +
    triggeredAvoid.length

  if (extraction.requirements.length >= 4 && evidenceCount >= 6) {
    return 'high'
  }
  if (extraction.requirements.length >= 2 && evidenceCount >= 3) {
    return 'medium'
  }
  return 'low'
}

const determineOverallFit = (fitScore: number, filterOut: boolean): MatchOverallFit => {
  if (filterOut) {
    return 'filter-out'
  }
  if (fitScore >= 0.78) {
    return 'strong'
  }
  if (fitScore >= 0.52) {
    return 'moderate'
  }
  return 'weak'
}

const determineRecommendation = ({
  overallFit,
  confidence,
}: {
  overallFit: MatchOverallFit
  confidence: MatchConfidence
}): MatchRecommendation => {
  if (overallFit === 'filter-out' || overallFit === 'weak') {
    return 'skip'
  }
  if (overallFit === 'moderate' && confidence === 'low') {
    return 'consider'
  }
  return 'apply'
}

const capitalizeFit = (value: MatchOverallFit): string =>
  value === 'filter-out' ? 'Filter-out' : value.charAt(0).toUpperCase() + value.slice(1)

const buildOneLineSummary = ({
  overallFit,
  primaryVector,
  hardFilter,
  skillMatches,
}: {
  overallFit: MatchOverallFit
  primaryVector: MatchedVector | undefined
  hardFilter: HardFilterOutcome
  skillMatches: SkillMatch[]
}): string => {
  if (overallFit === 'filter-out') {
    return 'Filter-out — ' + (hardFilter.reason ?? 'Hard filter triggered')
  }
  if (primaryVector) {
    return capitalizeFit(overallFit) + ' match — ' + primaryVector.title
  }
  if (skillMatches.length > 0) {
    return 'No vectors matched — skill-only assessment'
  }
  return 'Weak match — limited evidence'
}

const buildWatchOuts = ({
  hardFilter,
  skillMatches,
  triggeredAvoid,
  relevantAwareness,
}: {
  hardFilter: HardFilterOutcome
  skillMatches: SkillMatch[]
  triggeredAvoid: AvoidTrigger[]
  relevantAwareness: RelevantAwareness[]
}): WatchOut[] => {
  const watchOuts = [...hardFilter.watchOuts]

  for (const skillMatch of skillMatches) {
    if (skillMatch.matchQuality !== 'negative') continue
    watchOuts.push({
      type: 'avoid_skill',
      referenceId: skillMatch.skillName,
      description: skillMatch.skillName + ' is a red flag for this JD because the current profile treats it as avoid depth.',
      severity: skillMatch.requirementStrength === 'required' ? 'hard' : 'soft',
      suggestedAction: skillMatch.presentationGuidance,
    })
  }

  for (const avoid of triggeredAvoid) {
    watchOuts.push({
      type: 'filter_risk',
      referenceId: avoid.filterId,
      description: avoid.label + ' appears in the JD.',
      severity: avoid.severity,
      suggestedAction: avoid.jdEvidence,
    })
  }

  for (const awareness of relevantAwareness) {
    watchOuts.push({
      type: 'awareness_item',
      referenceId: awareness.awarenessId,
      description: awareness.appliesBecause,
      severity: awareness.severity === 'high' ? 'hard' : 'soft',
      suggestedAction: awareness.action,
    })
  }

  return watchOuts
}

const buildStrengthsToLead = (skillMatches: SkillMatch[]): string[] =>
  skillMatches
    .filter((entry) => entry.matchQuality === 'strong' || entry.matchQuality === 'moderate')
    .filter((entry) => entry.userDepth !== 'avoid')
    .slice(0, 5)
    .map((entry) => entry.skillName)

export const composeVectorAwareMatchResult = ({
  identity,
  prepared,
  extraction,
  matchedVectors,
  skillMatches,
  hardFilter,
  triggeredPrioritize,
  triggeredAvoid,
  relevantAwareness,
  rationale,
  warnings,
}: {
  identity: ProfessionalIdentityV3
  prepared: PreparedMatchJobDescription
  extraction: JdMatchExtraction
  matchedVectors: MatchedVector[]
  skillMatches: SkillMatch[]
  hardFilter: HardFilterOutcome
  triggeredPrioritize: FilterTrigger[]
  triggeredAvoid: AvoidTrigger[]
  relevantAwareness: RelevantAwareness[]
  rationale: string
  warnings: string[]
}): VectorAwareMatchResult => {
  const primaryVector = matchedVectors[0]
  const vectorScore = computeVectorScore(matchedVectors)
  const skillScore = computeSkillScore(skillMatches)
  const filterScore = computeFilterScore({ triggeredPrioritize, triggeredAvoid, relevantAwareness })
  const hasConfiguredVectors = (identity.search_vectors?.length ?? 0) > 0
  const fitScore = hardFilter.filterOut
    ? 0.05
    : hasConfiguredVectors
      ? clampScore(vectorScore * 0.45 + skillScore * 0.35 + filterScore * 0.2)
      : clampScore(skillScore * 0.8 + filterScore * 0.2)
  const confidence = computeConfidence({
    extraction,
    matchedVectors,
    skillMatches,
    triggeredPrioritize,
    triggeredAvoid,
    hardFilter,
  })
  const overallFit = determineOverallFit(fitScore, hardFilter.filterOut)
  const recommendation = determineRecommendation({ overallFit, confidence })
  const watchOuts = buildWatchOuts({
    hardFilter,
    skillMatches,
    triggeredAvoid,
    relevantAwareness,
  })

  return {
    id: createId('match-analysis'),
    generatedAt: new Date().toISOString(),
    identityVersion: identity.version,
    company: extraction.company,
    role: extraction.role,
    jobDescription: prepared.content,
    overallFit,
    fitScore,
    confidence,
    oneLineSummary: buildOneLineSummary({
      overallFit,
      primaryVector,
      hardFilter,
      skillMatches,
    }),
    matchedVectors,
    primaryVectorId: primaryVector?.vectorId ?? null,
    skillMatches,
    strengthsToLead: buildStrengthsToLead(skillMatches),
    watchOuts,
    triggeredPrioritize,
    triggeredAvoid,
    relevantAwareness,
    recommendation,
    rationale: rationale.trim() || extraction.summary,
    warnings: dedupeTrimmed([
      ...warnings,
      ...(prepared.truncated ? ['Job description exceeded ' + MAX_JD_WORDS + ' words and was truncated for analysis.'] : []),
      ...(identity.search_vectors?.length ? [] : ['No search vectors defined. Falling back to skill-first analysis.']),
    ]),
  }
}

const buildRationalePrompt = (analysis: Omit<VectorAwareMatchResult, 'id' | 'generatedAt' | 'identityVersion' | 'rationale'>) =>
  JSON.stringify(
    {
      overall_fit: analysis.overallFit,
      confidence: analysis.confidence,
      recommendation: analysis.recommendation,
      one_line_summary: analysis.oneLineSummary,
      company: analysis.company,
      role: analysis.role,
      primary_vector_id: analysis.primaryVectorId,
      matched_vectors: analysis.matchedVectors,
      strengths_to_lead: analysis.strengthsToLead,
      skill_matches: analysis.skillMatches,
      watch_outs: analysis.watchOuts,
      triggered_prioritize: analysis.triggeredPrioritize,
      triggered_avoid: analysis.triggeredAvoid,
      relevant_awareness: analysis.relevantAwareness,
      warnings: analysis.warnings,
    },
    null,
    2,
  )

const generateMatchRationale = async ({
  endpoint,
  analysis,
}: {
  endpoint: string
  analysis: Omit<VectorAwareMatchResult, 'id' | 'generatedAt' | 'identityVersion' | 'rationale'>
}): Promise<string> => {
  const rawResponse = await callMatchPass({
    endpoint,
    systemPrompt: MATCH_RATIONALE_SYSTEM_PROMPT,
    userPrompt: buildRationalePrompt(analysis),
  })
  const parsed = JSON.parse(extractJsonBlock(rawResponse))
  const root = assertRecord(parsed, 'match rationale response')
  return assertString(root.rationale, 'rationale').trim()
}

export const adaptVectorAwareMatchToReport = ({
  identity,
  prepared,
  extraction,
  analysis,
}: {
  identity: ProfessionalIdentityV3
  prepared: PreparedMatchJobDescription
  extraction: JdMatchExtraction
  analysis: VectorAwareMatchResult
}): MatchReport => {
  const positioningRecommendations = dedupeTrimmed([
    ...extraction.positioningRecommendations,
    ...analysis.skillMatches
      .filter((skillMatch) => skillMatch.matchQuality === 'strong' || skillMatch.matchQuality === 'moderate')
      .slice(0, 3)
      .map((skillMatch) => skillMatch.presentationGuidance),
  ])
  const gapFocus = dedupeTrimmed([
    ...extraction.gapFocus,
    ...analysis.watchOuts.map((watchOut) => watchOut.suggestedAction),
  ])

  return createJobMatchReport({
    identity,
    prepared,
    extraction,
    matchScoreOverride: analysis.fitScore,
    summaryOverride: analysis.rationale,
    positioningRecommendationsOverride: positioningRecommendations,
    gapFocusOverride: gapFocus,
    warningsOverride: dedupeTrimmed([...extraction.warnings, ...analysis.warnings]),
  })
}

export const analyzeIdentityJobMatch = async ({
  endpoint,
  identity,
  jobDescription,
}: {
  endpoint: string
  identity: ProfessionalIdentityV3
  jobDescription: string
}): Promise<MatchArtifacts> => {
  const prepared = prepareMatchJobDescription(jobDescription)
  const rawExtraction = await callMatchPass({
    endpoint,
    systemPrompt: JD_MATCH_SYSTEM_PROMPT,
    userPrompt: buildMatchPrompt({ identity, prepared }),
  })
  const extraction = parseJdMatchExtractionResponse(rawExtraction)
  const hardFilter = runHardFilters(identity, prepared)
  const warnings = [...hardFilter.warnings]

  let matchedVectors: MatchedVector[] = []
  let skillMatches: SkillMatch[] = []
  let triggeredPrioritize: FilterTrigger[] = []
  let triggeredAvoid: AvoidTrigger[] = [...hardFilter.triggeredAvoid]
  let relevantAwareness: RelevantAwareness[] = []

  if (!hardFilter.filterOut) {
    const skillCandidates = buildSkillCandidates(identity, extraction, prepared)
    const vectorPromise: Promise<NormalizedVectorPass> =
      (identity.search_vectors ?? []).length > 0
        ? callMatchPass({
            endpoint,
            systemPrompt: VECTOR_MATCH_SYSTEM_PROMPT,
            userPrompt: buildVectorPrompt({ prepared, identity }),
          })
            .then((rawResponse) =>
              normalizeVectorMatchPayload({
                rawResponse,
                vectors: identity.search_vectors ?? [],
                prepared,
              }),
            )
            .catch((error) => ({
              matchedVectors: [],
              warnings: [
                'Vector matching pass failed: ' + (error instanceof Error ? error.message : 'unknown error'),
              ],
            }))
        : Promise.resolve({ matchedVectors: [], warnings: [] })

    const skillPromise: Promise<NormalizedSkillPass> =
      skillCandidates.length > 0
        ? callMatchPass({
            endpoint,
            systemPrompt: SKILL_MATCH_SYSTEM_PROMPT,
            userPrompt: buildSkillPrompt({ prepared, candidates: skillCandidates }),
          })
            .then((rawResponse) =>
              normalizeSkillMatchPayload({
                rawResponse,
                candidates: skillCandidates,
              }),
            )
            .catch((error) => ({
              skillMatches: skillCandidates.map((candidate) => {
                const userDepth = deriveUserDepth(candidate.item)
                return {
                  skillName: candidate.name,
                  jdRequirement:
                    candidate.relatedRequirements[0]?.evidence ||
                    'JD mentions or implies ' + candidate.name + '.',
                  requirementStrength: candidate.requirementStrength,
                  userDepth,
                  userPositioning: candidate.item.positioning?.trim() ?? '',
                  matchQuality: determineMatchQuality(userDepth, candidate.requirementStrength),
                  presentationGuidance: buildFallbackSkillGuidance(
                    candidate.name,
                    userDepth,
                    candidate.requirementStrength,
                    candidate.item.positioning?.trim() ?? '',
                  ),
                }
              }),
              warnings: [
                'Skill matching pass failed: ' + (error instanceof Error ? error.message : 'unknown error'),
              ],
            }))
        : Promise.resolve({ skillMatches: [], warnings: [] })

    const filterPromise: Promise<NormalizedFilterAwarenessPass> = callMatchPass({
      endpoint,
      systemPrompt: FILTER_AWARENESS_SYSTEM_PROMPT,
      userPrompt: buildFilterAwarenessPrompt({ prepared, identity }),
    })
      .then((rawResponse) =>
        normalizeFilterAwarenessPayload({
          rawResponse,
          identity,
        }),
      )
      .catch((error) => ({
        triggeredPrioritize: [],
        triggeredAvoid: [],
        relevantAwareness: [],
        warnings: [
          'Filter and awareness pass failed: ' + (error instanceof Error ? error.message : 'unknown error'),
        ],
      }))

    const [vectorPass, skillPass, filterPass] = await Promise.all([
      vectorPromise,
      skillPromise,
      filterPromise,
    ])

    matchedVectors = vectorPass.matchedVectors
    skillMatches = skillPass.skillMatches
    triggeredPrioritize = filterPass.triggeredPrioritize
    const combinedAvoid = [...triggeredAvoid, ...filterPass.triggeredAvoid]
    const seenAvoidIds = new Set<string>()
    triggeredAvoid = combinedAvoid.filter((entry) => {
      if (seenAvoidIds.has(entry.filterId)) {
        return false
      }

      seenAvoidIds.add(entry.filterId)
      return true
    })
    relevantAwareness = filterPass.relevantAwareness
    warnings.push(...vectorPass.warnings, ...skillPass.warnings, ...filterPass.warnings)
  }

  const provisionalAnalysis = composeVectorAwareMatchResult({
    identity,
    prepared,
    extraction,
    matchedVectors,
    skillMatches,
    hardFilter,
    triggeredPrioritize,
    triggeredAvoid,
    relevantAwareness,
    rationale: hardFilter.reason ?? extraction.summary,
    warnings,
  })

  let rationale = provisionalAnalysis.rationale
  if (!hardFilter.filterOut) {
    try {
      const { rationale: _ignoredRationale, ...analysisForPrompt } = provisionalAnalysis
      rationale = await generateMatchRationale({
        endpoint,
        analysis: analysisForPrompt,
      })
    } catch (error) {
      warnings.push(
        'Rationale generation failed: ' + (error instanceof Error ? error.message : 'unknown error'),
      )
    }
  }

  const analysis = composeVectorAwareMatchResult({
    identity,
    prepared,
    extraction,
    matchedVectors,
    skillMatches,
    hardFilter,
    triggeredPrioritize,
    triggeredAvoid,
    relevantAwareness,
    rationale,
    warnings,
  })
  const report = adaptVectorAwareMatchToReport({ identity, prepared, extraction, analysis })

  return { analysis, report }
}

export const createMatchHistoryEntry = (report: MatchReport): MatchHistoryEntry => ({
  id: createId('match-history'),
  createdAt: report.generatedAt,
  company: report.company,
  role: report.role,
  matchScore: report.matchScore,
  requirementCount: report.requirements.length,
  gapCount: report.gaps.length,
  summary: report.summary,
})
