import type { ProfessionalIdentityV3, ProfessionalSkillGroup } from '../identity/schema'
import { callLlmProxy, extractJsonBlock, JsonExtractionError, isString } from './llmProxy'
import { isGenericSkillGroupLabel } from './identityEnrichment'

const MAX_SKILL_GROUP_LABEL_LENGTH = 60
const SKILL_GROUP_NAMING_TIMEOUT_MS = 45000

export interface SkillGroupNameSuggestion {
  groupId: string
  currentLabel: string
  suggestedLabel: string
  rationale?: string
}

export interface GenerateSkillGroupNameSuggestionsInput {
  endpoint: string
  identity: ProfessionalIdentityV3
  signal?: AbortSignal
}

const normalizeSpace = (value: string): string => value.replace(/\s+/g, ' ').trim()
const labelKey = (value: string): string => normalizeSpace(value).toLocaleLowerCase()

const normalizeAcceptableLabel = (
  group: ProfessionalSkillGroup,
  candidate: string,
): string | null => {
  const label = normalizeSpace(candidate)
  if (
    !label ||
    label.length > MAX_SKILL_GROUP_LABEL_LENGTH ||
    label === normalizeSpace(group.label) ||
    isGenericSkillGroupLabel(label)
  ) {
    return null
  }
  return label
}

const buildPrompt = (identity: ProfessionalIdentityV3): string =>
  JSON.stringify(
    {
      identity: {
        title: identity.identity.title ?? null,
        thesis: identity.identity.thesis,
        location: identity.identity.location,
      },
      profiles: identity.profiles,
      search_vectors: identity.search_vectors,
      skill_groups: identity.skills.groups.map((group) => ({
        id: group.id,
        current_label: group.label,
        positioning: group.positioning ?? null,
        calibration: group.calibration ?? null,
        is_differentiator: Boolean(group.is_differentiator),
        skills: group.items.map((item) => ({
          name: item.name,
          tags: item.tags,
          depth: item.depth ?? null,
          context: item.context ?? null,
          positioning: item.positioning ?? null,
        })),
      })),
    },
    null,
    2,
  )

const normalizeSuggestions = (
  payload: unknown,
  groups: ProfessionalSkillGroup[],
): SkillGroupNameSuggestion[] => {
  const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}
  const rawSuggestions = Array.isArray(record.groups)
    ? record.groups
    : Array.isArray(record.suggestions)
      ? record.suggestions
      : []
  const existingGroups = new Map(groups.map((group) => [group.id, group]))
  const seen = new Set<string>()
  const acceptedLabels = new Set(groups.map((group) => labelKey(group.label)))

  return rawSuggestions.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const suggestion = entry as Record<string, unknown>
    const groupId =
      (isString(suggestion.groupId) && suggestion.groupId.trim()) ||
      (isString(suggestion.group_id) && suggestion.group_id.trim()) ||
      (isString(suggestion.id) && suggestion.id.trim()) ||
      ''
    const group = existingGroups.get(groupId)
    if (!group || seen.has(groupId)) return []

    const label =
      (isString(suggestion.suggestedLabel) && suggestion.suggestedLabel.trim()) ||
      (isString(suggestion.suggested_label) && suggestion.suggested_label.trim()) ||
      (isString(suggestion.label) && suggestion.label.trim()) ||
      (isString(suggestion.name) && suggestion.name.trim()) ||
      ''
    const normalizedLabel = normalizeAcceptableLabel(group, label)
    if (!normalizedLabel) return []
    const normalizedLabelKey = labelKey(normalizedLabel)
    if (acceptedLabels.has(normalizedLabelKey)) return []

    seen.add(groupId)
    acceptedLabels.add(normalizedLabelKey)
    const rationale = isString(suggestion.rationale)
      ? normalizeSpace(suggestion.rationale)
      : isString(suggestion.reason)
        ? normalizeSpace(suggestion.reason)
        : ''

    return [
      {
        groupId,
        currentLabel: group.label,
        suggestedLabel: normalizedLabel,
        ...(rationale ? { rationale } : {}),
      },
    ]
  })
}

export const applySkillGroupNameSuggestions = (
  groups: ProfessionalSkillGroup[],
  suggestions: readonly SkillGroupNameSuggestion[],
): ProfessionalSkillGroup[] => {
  const suggestionsByGroupId = new Map(
    suggestions.map((suggestion) => [suggestion.groupId, suggestion.suggestedLabel] as const),
  )
  const acceptedLabels = new Set(groups.map((group) => labelKey(group.label)))

  return groups.map((group) => {
    const candidate = suggestionsByGroupId.get(group.id)
    if (!candidate) return group
    const nextLabel = normalizeAcceptableLabel(group, candidate)
    if (!nextLabel) return group
    const nextLabelKey = labelKey(nextLabel)
    if (acceptedLabels.has(nextLabelKey)) return group
    acceptedLabels.add(nextLabelKey)
    return { ...group, label: nextLabel }
  })
}

export async function generateSkillGroupNameSuggestions({
  endpoint,
  identity,
  signal,
}: GenerateSkillGroupNameSuggestionsInput): Promise<SkillGroupNameSuggestion[]> {
  const systemPrompt = `You are renaming skill groups in a professional identity model.
Return JSON only.
Use only the provided identity and skill group data.

Naming rules:
- Return suggestions only for skill groups whose label should change.
- Suggested labels should be concise professional taxonomy names, usually 2 to 4 words.
- Avoid generic labels such as "Skills", "Skills 1", "Technical Skills", "Other", or "Also".
- The label must reflect the actual skills inside the group and any positioning/calibration.
- Preserve specificity: name platforms, domains, or systems when the group clearly clusters around them.
- Do not invent skills, titles, employers, certifications, or claims.
- If a current label is already strong, omit that group from the response.

Response schema:
{
  "groups": [
    {
      "groupId": "existing group id",
      "suggestedLabel": "short label",
      "rationale": "brief reason"
    }
  ]
}`

  const rawResponse = await callLlmProxy(endpoint, systemPrompt, buildPrompt(identity), {
    feature: 'identity.skill-group-naming',
    timeoutMs: SKILL_GROUP_NAMING_TIMEOUT_MS,
    signal,
  })

  try {
    const parsed = JSON.parse(extractJsonBlock(rawResponse)) as unknown
    return normalizeSuggestions(parsed, identity.skills.groups)
  } catch (error) {
    if (error instanceof JsonExtractionError) {
      throw error
    }
    throw new Error(error instanceof Error ? error.message : 'Unable to parse skill group names.')
  }
}
