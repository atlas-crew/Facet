import type { ProfessionalIdentityV3, ProfessionalSkillItem } from '../identity/schema'
import type { BandLayer } from '../routes/identity/IdentityBand'
import type { MapSelection, PreferenceFieldKey } from '../types/identity'
import {
  profilesFillStrength,
  rolesFillStrength,
  searchStrategyFillStrength,
  selfModelFillStrength,
  skillsFillStrength,
  thesisFillStrength,
  preferencesFillStrength,
  type FillStrength,
} from './identityFillStrength'
import {
  isGenericSkillGroupLabel,
  isSkillEnrichmentStale,
  skillNamesMatch,
} from './identityEnrichment'

const ATTENTION_PREFERENCES_FIELD: PreferenceFieldKey = 'compensation.notes'

type IdentityAttentionKind =
  | 'awareness-question'
  | 'bullet-depth'
  | 'skill-inference'
  | 'skill-taxonomy'
  | 'fill-strength'

export interface IdentityAttentionItem {
  id: string
  kind: IdentityAttentionKind
  title: string
  body: string
  statusLabel: string
  layer: BandLayer
  selection: MapSelection
}

type SparseAttentionLayer = Exclude<BandLayer, 'skills'>

const selectionKey = (selection: MapSelection): string => {
  switch (selection.type) {
    case 'contact-basics':
    case 'thesis':
    case 'competitive-moat':
      return selection.type
    case 'philosophy':
    case 'arc-stop':
    case 'profile':
    case 'role':
    case 'project':
    case 'skill-group':
    case 'search-vector':
    case 'awareness-question':
      return `${selection.type}:${selection.id}`
    case 'bullet':
      return `bullet:${selection.roleId}:${selection.bulletId}`
    case 'skill-item':
      return `skill-item:${selection.groupId}:${selection.itemId}`
    case 'pref-field':
      return `pref-field:${selection.field}`
    case 'match-rule':
      return `match-rule:${selection.kind}:${selection.id}`
    default: {
      selection satisfies never
      return ''
    }
  }
}

export const identityAttentionSelectionMatches = (
  item: IdentityAttentionItem,
  selection: MapSelection | null,
): boolean => Boolean(selection && selectionKey(item.selection) === selectionKey(selection))

const isWeakFill = (fill: FillStrength, weakLabels: string[]) => weakLabels.includes(fill.label)

const hasText = (value: string | undefined) => Boolean(value?.trim())

const firstSkillTaxonomyIssue = (
  identity: ProfessionalIdentityV3,
): { groupId: string; skill?: ProfessionalSkillItem; label: string } | null => {
  for (const group of identity.skills?.groups ?? []) {
    if (isGenericSkillGroupLabel(group.label)) {
      return { groupId: group.id, label: 'Generic group' }
    }
    const seen: ProfessionalSkillItem[] = []
    for (const skill of group.items) {
      if (!skill.tags || skill.tags.length === 0) {
        return { groupId: group.id, skill, label: 'Untagged skill' }
      }
      if (seen.some((existing) => skillNamesMatch(existing.name, skill.name))) {
        return { groupId: group.id, label: 'Duplicate skill' }
      }
      seen.push(skill)
    }
  }
  return null
}

const duplicateSkillNamesForGroup = (items: ProfessionalSkillItem[]): Set<string> => {
  const duplicates = new Set<string>()
  for (let i = 0; i < items.length; i += 1) {
    const skill = items[i]
    if (!skill) continue
    if (items.some((other, index) => index !== i && skillNamesMatch(other.name, skill.name))) {
      duplicates.add(skill.name.trim().toLowerCase())
    }
  }
  return duplicates
}

const addSparseBandItem = (
  items: IdentityAttentionItem[],
  identity: ProfessionalIdentityV3,
  layer: SparseAttentionLayer,
  fill: FillStrength,
) => {
  switch (layer) {
    case 'thesis':
      items.push({
        id: 'fill:thesis',
        kind: 'fill-strength',
        title: 'Strengthen identity thesis',
        body: `Thesis is ${fill.label.toLowerCase()} at ${Math.round(fill.percent)}%. Add concrete evidence, named systems, or clearer positioning.`,
        statusLabel: fill.label,
        layer,
        selection: { type: 'thesis' },
      })
      break
    case 'self':
      items.push({
        id: 'fill:self',
        kind: 'fill-strength',
        title: 'Fill self-model narrative',
        body: `Self Model is ${fill.label.toLowerCase()} at ${Math.round(fill.percent)}%. Review moat, advantages, philosophy, or interview strategy.`,
        statusLabel: fill.label,
        layer,
        selection: { type: 'competitive-moat' },
      })
      break
    case 'profiles': {
      const profile = identity.profiles?.[0]
      if (!profile) return
      items.push({
        id: 'fill:profiles',
        kind: 'fill-strength',
        title: 'Review sparse profile lenses',
        body: `Profiles are ${fill.label.toLowerCase()} at ${Math.round(fill.percent)}%. Add tags or stronger reusable profile copy.`,
        statusLabel: fill.label,
        layer,
        selection: { type: 'profile', id: profile.id },
      })
      break
    }
    case 'roles': {
      const role = identity.roles?.[0]
      if (!role) return
      items.push({
        id: 'fill:roles',
        kind: 'fill-strength',
        title: 'Deepen role evidence',
        body: `Roles are ${fill.label.toLowerCase()} at ${Math.round(fill.percent)}%. Add bullets or project evidence where the role is thin.`,
        statusLabel: fill.label,
        layer,
        selection: { type: 'role', id: role.id },
      })
      break
    }
    case 'prefs':
      items.push({
        id: 'fill:prefs',
        kind: 'fill-strength',
        title: 'Complete search preferences',
        body: `Preferences are ${fill.label.toLowerCase()} at ${Math.round(fill.percent)}%. Fill constraints, compensation, and interview-process signals.`,
        statusLabel: fill.label,
        layer,
        selection: { type: 'pref-field', field: ATTENTION_PREFERENCES_FIELD },
      })
      break
    case 'search': {
      const vector = identity.search_vectors?.[0]
      if (!vector) return
      items.push({
        id: 'fill:search',
        kind: 'fill-strength',
        title: 'Tighten search strategy',
        body: `Search Strategy is ${fill.label.toLowerCase()} at ${Math.round(fill.percent)}%. Review vector thesis and open research questions.`,
        statusLabel: fill.label,
        layer,
        selection: { type: 'search-vector', id: vector.id },
      })
      break
    }
    default: {
      layer satisfies never
    }
  }
}

export const deriveIdentityAttentionItems = (
  identity: ProfessionalIdentityV3 | null,
): IdentityAttentionItem[] => {
  if (!identity) return []

  const items: IdentityAttentionItem[] = []

  for (const question of identity.awareness?.open_questions ?? []) {
    items.push({
      id: `awareness:${question.id}`,
      kind: 'awareness-question',
      title: question.topic || 'Resolve open assumption',
      body:
        question.action || question.description || 'Answer or remove this open identity question.',
      statusLabel: question.severity ?? 'open',
      layer: 'search',
      selection: { type: 'awareness-question', id: question.id },
    })
  }

  for (const role of identity.roles ?? []) {
    for (const bullet of role.bullets ?? []) {
      const hasStructuredDepth =
        hasText(bullet.problem) && hasText(bullet.action) && hasText(bullet.outcome)
      if (hasText(bullet.source_text) && !hasStructuredDepth) {
        items.push({
          id: `bullet:${role.id}:${bullet.id}`,
          kind: 'bullet-depth',
          title: 'Deepen bullet evidence',
          body: `${role.company || role.title}: source text exists but problem, action, and outcome are not fully structured.`,
          statusLabel: 'Needs depth',
          layer: 'roles',
          selection: { type: 'bullet', roleId: role.id, bulletId: bullet.id },
        })
      }
    }
  }

  if (skillsFillStrength(identity).label === 'Messy') {
    const issue = firstSkillTaxonomyIssue(identity)
    if (issue) {
      items.push({
        id: `skill-taxonomy:${issue.groupId}:${issue.skill?.name ?? 'group'}`,
        kind: 'skill-taxonomy',
        title: 'Clean skill taxonomy',
        body: `${issue.label}: review names, tags, duplicates, or generated group labels before deepening more skills.`,
        statusLabel: issue.label,
        layer: 'skills',
        selection: issue.skill
          ? { type: 'skill-item', groupId: issue.groupId, itemId: issue.skill.name }
          : { type: 'skill-group', id: issue.groupId },
      })
    }
  }

  for (const group of identity.skills?.groups ?? []) {
    const duplicateNames = duplicateSkillNamesForGroup(group.items)
    group.items.forEach((skill, skillIndex) => {
      if (duplicateNames.has(skill.name.trim().toLowerCase())) {
        return
      }
      if (hasText(skill.skipped_at)) {
        items.push({
          id: `skill-skipped:${group.id}:${skillIndex}:${skill.name}`,
          kind: 'skill-inference',
          title: 'Review skipped skill inference',
          body: `${skill.name} was skipped during enrichment. Review whether it should stay skipped or get depth evidence.`,
          statusLabel: 'Skipped',
          layer: 'skills',
          selection: { type: 'skill-item', groupId: group.id, itemId: skill.name },
        })
        return
      }
      if (!skill.depth) {
        items.push({
          id: `skill-pending:${group.id}:${skillIndex}:${skill.name}`,
          kind: 'skill-inference',
          title: 'Deepen skill evidence',
          body: `${skill.name} has no depth metadata yet.`,
          statusLabel: 'Pending',
          layer: 'skills',
          selection: { type: 'skill-item', groupId: group.id, itemId: skill.name, draft: true },
        })
        return
      }
      if (isSkillEnrichmentStale(skill)) {
        items.push({
          id: `skill-stale:${group.id}:${skillIndex}:${skill.name}`,
          kind: 'skill-inference',
          title: 'Review stale skill inference',
          body: `${skill.name} has enrichment copy marked stale after edits.`,
          statusLabel: 'Stale',
          layer: 'skills',
          selection: { type: 'skill-item', groupId: group.id, itemId: skill.name },
        })
        return
      }
      if (skill.depthSource === 'inferred') {
        items.push({
          id: `skill-inferred:${group.id}:${skillIndex}:${skill.name}`,
          kind: 'skill-inference',
          title: 'Review inferred skill depth',
          body: `${skill.name} has inferred depth. Confirm or correct it before relying on it downstream.`,
          statusLabel: 'Inferred',
          layer: 'skills',
          selection: { type: 'skill-item', groupId: group.id, itemId: skill.name },
        })
      }
    })
  }

  const fills: Array<[SparseAttentionLayer, FillStrength, string[]]> = [
    ['thesis', thesisFillStrength(identity), ['Empty', 'Draft', 'Sparse']],
    ['self', selfModelFillStrength(identity), ['Empty', 'Sparse']],
    ['profiles', profilesFillStrength(identity), ['Empty', 'Sparse']],
    ['roles', rolesFillStrength(identity), ['Empty', 'Thin', 'Sparse']],
    ['prefs', preferencesFillStrength(identity), ['Empty', 'Thin']],
    ['search', searchStrategyFillStrength(identity), ['Empty', 'Sparse']],
  ]

  for (const [layer, fill, weakLabels] of fills) {
    if (isWeakFill(fill, weakLabels)) {
      addSparseBandItem(items, identity, layer, fill)
    }
  }

  const seenSelections = new Set<string>()
  return items.filter((item) => {
    const key = selectionKey(item.selection)
    if (seenSelections.has(key)) return false
    seenSelections.add(key)
    return true
  })
}

export const getNextIdentityAttentionItem = (
  items: IdentityAttentionItem[],
  currentSelection: MapSelection | null,
): IdentityAttentionItem | null => {
  if (items.length === 0) return null
  if (!currentSelection) return items[0] ?? null

  const currentIndex = items.findIndex((item) =>
    identityAttentionSelectionMatches(item, currentSelection),
  )
  if (currentIndex === -1) return items[0] ?? null
  return items[(currentIndex + 1) % items.length] ?? null
}
