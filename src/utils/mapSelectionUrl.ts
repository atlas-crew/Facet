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
    case 'contact-basics':
      return 'contact-basics'
    case 'thesis':
      return 'thesis'
    case 'competitive-moat':
      return 'competitive-moat'
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
    case 'contact-basics':
      if (rest.length !== 0) return null
      return { type: 'contact-basics' }
    case 'thesis':
      if (rest.length !== 0) return null
      return { type: 'thesis' }
    case 'competitive-moat':
      if (rest.length !== 0) return null
      return { type: 'competitive-moat' }
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
    case 'contact-basics':
      return 'contact basics'
    case 'thesis':
      return 'thesis selection'
    case 'competitive-moat':
      return 'competitive moat'
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

/**
 * Bounded set of band-focus identifiers honored by the `?focus=<band>` URL
 * param. Used by cross-workspace deep links that want to land users at a
 * region of the Identity Map without selecting a specific slot — the
 * "preferences landing" pattern documented in TASK-217 retrofit 1.
 *
 * Adding a new band: extend the array AND `BAND_FOCUS_TO_DATA_LAYER`. Per
 * TASK-217's lock, the param is bounded to URL-readable identifiers; arbitrary
 * strings are rejected via `validateBandFocus` and fall back to the same
 * stale-selection notice path as invalid `?sel=` values.
 *
 * Focus is orthogonal to selection: a URL may carry both `?sel=…&focus=…`,
 * and the page honors them independently (selection drives the inspector;
 * focus drives the scroll position on mount).
 */
export const IDENTITY_BAND_FOCUS_VALUES = ['preferences', 'self-model'] as const
export type IdentityBandFocus = (typeof IDENTITY_BAND_FOCUS_VALUES)[number]

const IDENTITY_BAND_FOCUS_SET: ReadonlySet<string> = new Set(IDENTITY_BAND_FOCUS_VALUES)

const BAND_FOCUS_TO_DATA_LAYER: Record<IdentityBandFocus, string> = {
  preferences: 'prefs',
  'self-model': 'self',
}

export function validateBandFocus(value: string | undefined | null): IdentityBandFocus | null {
  if (!value) return null
  return IDENTITY_BAND_FOCUS_SET.has(value) ? (value as IdentityBandFocus) : null
}

/**
 * Map a validated focus identifier to the `data-layer` attribute value its
 * matching band renders. Used by `IdentityMapPage` to find the band element
 * and scroll it into view via `[data-layer="..."]` selector.
 */
export function getBandDataLayerForFocus(focus: IdentityBandFocus): string {
  return BAND_FOCUS_TO_DATA_LAYER[focus]
}

/**
 * Origin-name table for the return-URL breadcrumb. Keys are the path prefixes
 * the validator accepts; values are the user-facing names rendered as
 * `← Back to {name}`. Order matters for prefix matching: longer prefixes must
 * come before their shorter parents.
 *
 * Per TASK-217 Decision 2, only paths whose prefix matches one of these keys
 * are honored as valid `return` targets — anything else falls back to "no
 * back affordance shown."
 */
const RETURN_ORIGIN_TABLE: ReadonlyArray<readonly [string, string]> = [
  ['/research', 'Research'],
  ['/pipeline', 'Pipeline'],
  ['/build', 'Build'],
  ['/match', 'Match'],
  ['/letters', 'Letters'],
  ['/prep', 'Prep'],
  ['/debrief', 'Debrief'],
  ['/account', 'Account'],
  ['/help', 'Help'],
  ['/terms', 'Terms'],
  ['/privacy', 'Privacy'],
]

const matchOrigin = (path: string): readonly [string, string] | null => {
  for (const entry of RETURN_ORIGIN_TABLE) {
    const [prefix] = entry
    if (path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`)) {
      return entry
    }
  }
  return null
}

/**
 * Validate a return URL against the internal-route allowlist. Returns the URL
 * unchanged if its path component matches a known prefix; returns null
 * otherwise. Reject scheme-bearing URLs (http://, javascript:, data:, etc.)
 * outright — only same-origin internal paths are allowed. Per TASK-217
 * Decision 2, the validation cost is tiny and the habit lands before
 * external-origin links are part of the threat model.
 */
export function validateReturnUrl(url: string | undefined | null): string | null {
  if (!url) return null
  // Reject anything that smells like an absolute URL or a non-path scheme.
  // Only same-origin paths starting with a single `/` are honored.
  if (!url.startsWith('/')) return null
  if (url.startsWith('//')) return null
  // Split off the path component (drop query / fragment for prefix matching).
  const queryIndex = url.indexOf('?')
  const fragmentIndex = url.indexOf('#')
  const cutoff =
    [queryIndex, fragmentIndex].filter((i) => i >= 0).sort((a, b) => a - b)[0] ?? url.length
  const path = url.slice(0, cutoff)
  return matchOrigin(path) ? url : null
}

/**
 * Derive the user-facing origin name for a validated return URL. Caller
 * MUST pass a URL that already passed `validateReturnUrl`; the function
 * returns 'origin' as a defensive fallback if no prefix matches (which
 * shouldn't happen post-validation).
 */
export function getReturnOriginName(validatedUrl: string): string {
  const queryIndex = validatedUrl.indexOf('?')
  const fragmentIndex = validatedUrl.indexOf('#')
  const cutoff =
    [queryIndex, fragmentIndex].filter((i) => i >= 0).sort((a, b) => a - b)[0] ??
    validatedUrl.length
  const path = validatedUrl.slice(0, cutoff)
  return matchOrigin(path)?.[1] ?? 'origin'
}
