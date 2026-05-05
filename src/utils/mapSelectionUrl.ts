import type { MapSelection, PreferenceFieldKey } from '../types/identity'

const PREFERENCE_FIELD_KEYS: ReadonlySet<PreferenceFieldKey> = new Set<PreferenceFieldKey>([
  'compensation.base_floor',
  'compensation.base_target',
  'compensation.notes',
  'work_model.preference',
  'work_model.flexibility',
  'work_model.hard_no',
  'constraints.clearance',
  'constraints.education',
  'constraints.title_flexibility',
  'interview_process.accepted_formats',
  'interview_process.strong_fit_signals',
  'interview_process.red_flags',
  'interview_process.max_rounds',
  'interview_process.onsite_preferences',
])

const isPreferenceFieldKey = (value: string): value is PreferenceFieldKey =>
  PREFERENCE_FIELD_KEYS.has(value as PreferenceFieldKey)

const enc = (value: string): string => encodeURIComponent(value)

const safeDecode = (value: string): string | null => {
  try {
    return decodeURIComponent(value)
  } catch {
    return null
  }
}

export function serializeMapSelection(selection: MapSelection): string {
  switch (selection.type) {
    case 'thesis':
      return 'thesis'
    case 'philosophy':
      return `philosophy:${enc(selection.id)}`
    case 'arc-stop':
      return `arc-stop:${enc(selection.id)}`
    case 'profile':
      return `profile:${enc(selection.id)}`
    case 'role':
      return `role:${enc(selection.id)}`
    case 'bullet':
      return `bullet:${enc(selection.roleId)}:${enc(selection.bulletId)}`
    case 'project':
      return `project:${enc(selection.id)}`
    case 'skill-group':
      return `skill-group:${enc(selection.id)}`
    case 'skill-item':
      return `skill-item:${enc(selection.groupId)}:${enc(selection.itemId)}`
    case 'pref-field':
      return `pref-field:${enc(selection.field)}`
    case 'match-rule':
      return `match-rule:${selection.kind}:${enc(selection.id)}`
    case 'search-vector':
      return `search-vector:${enc(selection.id)}`
    case 'awareness-question':
      return `awareness-question:${enc(selection.id)}`
    default: {
      selection satisfies never
      throw new Error(`Unhandled MapSelection variant: ${(selection as { type: string }).type}`)
    }
  }
}

export function parseMapSelection(serialized: string | undefined | null): MapSelection | null {
  if (!serialized) return null
  const rawParts = serialized.split(':')
  const decoded: string[] = []
  for (const part of rawParts) {
    const value = safeDecode(part)
    if (value === null) return null
    decoded.push(value)
  }
  const [type, ...rest] = decoded
  if (!type) return null

  switch (type) {
    case 'thesis':
      if (rest.length !== 0) return null
      return { type: 'thesis' }
    case 'philosophy':
      if (rest.length !== 1 || !rest[0]) return null
      return { type: 'philosophy', id: rest[0] }
    case 'arc-stop':
      if (rest.length !== 1 || !rest[0]) return null
      return { type: 'arc-stop', id: rest[0] }
    case 'profile':
      if (rest.length !== 1 || !rest[0]) return null
      return { type: 'profile', id: rest[0] }
    case 'role':
      if (rest.length !== 1 || !rest[0]) return null
      return { type: 'role', id: rest[0] }
    case 'bullet':
      if (rest.length !== 2 || !rest[0] || !rest[1]) return null
      return { type: 'bullet', roleId: rest[0], bulletId: rest[1] }
    case 'project':
      if (rest.length !== 1 || !rest[0]) return null
      return { type: 'project', id: rest[0] }
    case 'skill-group':
      if (rest.length !== 1 || !rest[0]) return null
      return { type: 'skill-group', id: rest[0] }
    case 'skill-item':
      if (rest.length !== 2 || !rest[0] || !rest[1]) return null
      return { type: 'skill-item', groupId: rest[0], itemId: rest[1] }
    case 'pref-field':
      if (rest.length !== 1 || !rest[0]) return null
      if (!isPreferenceFieldKey(rest[0])) return null
      return { type: 'pref-field', field: rest[0] }
    case 'match-rule': {
      if (rest.length !== 2 || !rest[1]) return null
      const kind = rest[0]
      if (kind !== 'prioritize' && kind !== 'avoid') return null
      return { type: 'match-rule', kind, id: rest[1] }
    }
    case 'search-vector':
      if (rest.length !== 1 || !rest[0]) return null
      return { type: 'search-vector', id: rest[0] }
    case 'awareness-question':
      if (rest.length !== 1 || !rest[0]) return null
      return { type: 'awareness-question', id: rest[0] }
    default:
      return null
  }
}

export function getEntityNoun(selection: MapSelection): string {
  switch (selection.type) {
    case 'thesis':
      return 'thesis selection'
    case 'philosophy':
      return 'philosophy entry'
    case 'arc-stop':
      return 'arc stop'
    case 'profile':
      return 'profile'
    case 'role':
      return 'role'
    case 'bullet':
      return 'bullet'
    case 'project':
      return 'project'
    case 'skill-group':
      return 'skill group'
    case 'skill-item':
      return 'skill'
    case 'pref-field':
      return 'preference'
    case 'match-rule':
      return 'match rule'
    case 'search-vector':
      return 'search vector'
    case 'awareness-question':
      return 'awareness question'
    default: {
      selection satisfies never
      return 'link target'
    }
  }
}

export function buildStaleSelectionNotice(selection: MapSelection | null): string {
  const noun = selection ? getEntityNoun(selection) : 'link target'
  return `That ${noun} isn't there anymore. Dropped you at the Identity Map landing instead.`
}
