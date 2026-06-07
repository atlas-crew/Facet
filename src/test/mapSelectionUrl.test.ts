import { describe, expect, it } from 'vitest'
import type { MapSelection } from '../types/identity'
import {
  buildStaleSelectionNotice,
  getBandDataLayerForFocus,
  getEntityNoun,
  getReturnOriginName,
  IDENTITY_BAND_FOCUS_VALUES,
  parseMapSelection,
  serializeMapSelection,
  validateBandFocus,
  validateReturnUrl,
} from '../utils/mapSelectionUrl'

const allVariants: MapSelection[] = [
  { type: 'contact-basics' },
  { type: 'thesis' },
  { type: 'competitive-moat' },
  { type: 'philosophy', id: 'phil-1' },
  { type: 'arc-stop', id: 'Contoso Networks:0' },
  { type: 'profile', id: 'profile-platform' },
  { type: 'role', id: 'role-contoso' },
  { type: 'bullet', roleId: 'role-contoso', bulletId: 'bullet-platform-migration' },
  { type: 'project', id: 'project-1' },
  { type: 'skill-group', id: 'platform' },
  { type: 'skill-item', groupId: 'platform', itemId: 'Kubernetes' },
  { type: 'pref-field', field: 'compensation.base_floor' },
  { type: 'match-rule', kind: 'prioritize', id: 'rule-abc' },
  { type: 'match-rule', kind: 'avoid', id: 'rule-xyz' },
  { type: 'search-vector', id: 'vector-1' },
  { type: 'awareness-question', id: 'q-1' },
]

describe('serializeMapSelection / parseMapSelection round-trip', () => {
  for (const variant of allVariants) {
    it(`round-trips ${variant.type}${'kind' in variant ? `:${variant.kind}` : ''}`, () => {
      const serialized = serializeMapSelection(variant)
      const parsed = parseMapSelection(serialized)
      expect(parsed).toEqual(variant)
    })
  }

  it('strips justAdded? on serialize (it is a session creation marker, not a stable identity reference)', () => {
    const withJustAdded: MapSelection = {
      type: 'match-rule',
      kind: 'prioritize',
      id: 'rule-abc',
      justAdded: true,
    }
    const parsed = parseMapSelection(serializeMapSelection(withJustAdded))
    expect(parsed).toEqual({ type: 'match-rule', kind: 'prioritize', id: 'rule-abc' })
    expect(parsed).not.toHaveProperty('justAdded')
  })

  it('strips draft? on serialize (it is a one-shot AI action marker, not a stable identity reference)', () => {
    const withDraft: MapSelection = {
      type: 'skill-item',
      groupId: 'platform',
      itemId: 'TypeScript',
      draft: true,
    }
    const parsed = parseMapSelection(serializeMapSelection(withDraft))
    expect(parsed).toEqual({ type: 'skill-item', groupId: 'platform', itemId: 'TypeScript' })
    expect(parsed).not.toHaveProperty('draft')
  })

  it('preserves ids that contain colons via percent-encoding', () => {
    const sel: MapSelection = { type: 'arc-stop', id: 'Some:Company:With:Colons' }
    const serialized = serializeMapSelection(sel)
    expect(serialized).not.toContain('Some:Company')
    expect(parseMapSelection(serialized)).toEqual(sel)
  })

  it('preserves ids that contain spaces, slashes, and unicode', () => {
    const sel: MapSelection = {
      type: 'skill-item',
      groupId: 'platform',
      itemId: 'Apache Spark / 2.x — café',
    }
    const serialized = serializeMapSelection(sel)
    expect(parseMapSelection(serialized)).toEqual(sel)
  })
})

describe('parseMapSelection rejection paths', () => {
  it('returns null for empty input', () => {
    expect(parseMapSelection('')).toBeNull()
    expect(parseMapSelection(undefined)).toBeNull()
    expect(parseMapSelection(null)).toBeNull()
  })

  it('returns null for unknown discriminant (parse-success-but-unknown-variant per Decision 1 refinement)', () => {
    expect(parseMapSelection('future-variant:abc')).toBeNull()
  })

  it('returns null for missing required fields', () => {
    expect(parseMapSelection('philosophy')).toBeNull()
    expect(parseMapSelection('philosophy:')).toBeNull()
    expect(parseMapSelection('bullet:role-only')).toBeNull()
    expect(parseMapSelection('match-rule:prioritize')).toBeNull()
  })

  it('returns null when thesis carries unexpected payload', () => {
    expect(parseMapSelection('thesis:unexpected')).toBeNull()
  })

  it('returns null when contact basics carries unexpected payload', () => {
    expect(parseMapSelection('contact-basics:unexpected')).toBeNull()
  })

  it('returns null when competitive moat carries unexpected payload', () => {
    expect(parseMapSelection('competitive-moat:unexpected')).toBeNull()
  })

  it('returns null for invalid match-rule kind narrowing', () => {
    expect(parseMapSelection('match-rule:soft:rule-id')).toBeNull()
    expect(parseMapSelection('match-rule::rule-id')).toBeNull()
  })

  it('returns null for unknown PreferenceFieldKey', () => {
    expect(parseMapSelection('pref-field:invented.key')).toBeNull()
    expect(parseMapSelection('pref-field:compensation.base_floor')).toEqual({
      type: 'pref-field',
      field: 'compensation.base_floor',
    })
  })

  it('returns null for malformed percent-encoding', () => {
    expect(parseMapSelection('philosophy:%E0%A4%A')).toBeNull()
  })
})

describe('getEntityNoun', () => {
  it('returns a user-friendly noun for every variant', () => {
    for (const variant of allVariants) {
      const noun = getEntityNoun(variant)
      expect(noun).not.toBe('')
      expect(noun).not.toContain('-')
    }
  })
})

describe('buildStaleSelectionNotice', () => {
  it('uses the variant-specific noun when a selection is provided', () => {
    expect(buildStaleSelectionNotice({ type: 'match-rule', kind: 'prioritize', id: 'x' })).toBe(
      "That match rule isn't there anymore. Dropped you at the Identity Map landing instead.",
    )
  })

  it('uses the generic "link target" noun when selection is null (parse-failed path)', () => {
    expect(buildStaleSelectionNotice(null)).toBe(
      "That link target isn't there anymore. Dropped you at the Identity Map landing instead.",
    )
  })
})

describe('validateReturnUrl', () => {
  it('returns the URL unchanged for an internal route prefix', () => {
    expect(validateReturnUrl('/research')).toBe('/research')
    expect(validateReturnUrl('/pipeline')).toBe('/pipeline')
    expect(validateReturnUrl('/build')).toBe('/build')
    expect(validateReturnUrl('/match')).toBe('/match')
    expect(validateReturnUrl('/letters')).toBe('/letters')
    expect(validateReturnUrl('/prep')).toBe('/prep')
    expect(validateReturnUrl('/debrief')).toBe('/debrief')
  })

  it('preserves the URL when query or fragment are appended', () => {
    expect(validateReturnUrl('/research?tab=preferences')).toBe('/research?tab=preferences')
    expect(validateReturnUrl('/pipeline?entry=pipe-77')).toBe('/pipeline?entry=pipe-77')
    expect(validateReturnUrl('/prep#anchors')).toBe('/prep#anchors')
  })

  it('honors deep paths within an allowed prefix', () => {
    expect(validateReturnUrl('/research/some-detail')).toBe('/research/some-detail')
  })

  it('rejects external/scheme-bearing URLs', () => {
    expect(validateReturnUrl('https://evil.com/research')).toBeNull()
    expect(validateReturnUrl('http://evil.com')).toBeNull()
    expect(validateReturnUrl('javascript:alert(1)')).toBeNull()
    expect(validateReturnUrl('data:text/html,oops')).toBeNull()
    expect(validateReturnUrl('//evil.com/research')).toBeNull()
  })

  it('rejects paths not in the allowlist', () => {
    expect(validateReturnUrl('/admin')).toBeNull()
    expect(validateReturnUrl('/random/path')).toBeNull()
  })

  it('rejects empty / undefined / null inputs', () => {
    expect(validateReturnUrl('')).toBeNull()
    expect(validateReturnUrl(undefined)).toBeNull()
    expect(validateReturnUrl(null)).toBeNull()
  })

  it('does not match a sibling path that shares a prefix substring', () => {
    expect(validateReturnUrl('/researchers')).toBeNull()
    expect(validateReturnUrl('/preparation')).toBeNull()
  })
})

describe('validateBandFocus', () => {
  it('returns the focus value when it matches a known band identifier', () => {
    expect(validateBandFocus('preferences')).toBe('preferences')
  })

  it('returns null for unknown band identifiers (per TASK-217 Decision 1 refinement)', () => {
    expect(validateBandFocus('not-a-band')).toBeNull()
    expect(validateBandFocus('preference')).toBeNull() // off-by-one typo
    expect(validateBandFocus('Preferences')).toBeNull() // case-sensitive
  })

  it('returns null for empty / undefined / null inputs', () => {
    expect(validateBandFocus('')).toBeNull()
    expect(validateBandFocus(undefined)).toBeNull()
    expect(validateBandFocus(null)).toBeNull()
  })

  it('every value in IDENTITY_BAND_FOCUS_VALUES has a data-layer mapping', () => {
    for (const focus of IDENTITY_BAND_FOCUS_VALUES) {
      const layer = getBandDataLayerForFocus(focus)
      expect(typeof layer).toBe('string')
      expect(layer.length).toBeGreaterThan(0)
    }
  })
})

describe('getReturnOriginName', () => {
  it('returns the user-facing name for each allowed origin', () => {
    expect(getReturnOriginName('/research')).toBe('Research')
    expect(getReturnOriginName('/pipeline?entry=x')).toBe('Pipeline')
    expect(getReturnOriginName('/prep')).toBe('Prep')
    expect(getReturnOriginName('/debrief')).toBe('Debrief')
  })

  it('returns the defensive fallback for unrecognized paths (caller should validate first)', () => {
    expect(getReturnOriginName('/admin')).toBe('origin')
  })
})
