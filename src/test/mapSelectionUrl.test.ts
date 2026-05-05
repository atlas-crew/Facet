import { describe, expect, it } from 'vitest'
import type { MapSelection } from '../types/identity'
import {
  buildStaleSelectionNotice,
  getEntityNoun,
  parseMapSelection,
  serializeMapSelection,
} from '../utils/mapSelectionUrl'

const allVariants: MapSelection[] = [
  { type: 'thesis' },
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

  it('preserves ids that contain colons via percent-encoding', () => {
    const sel: MapSelection = { type: 'arc-stop', id: 'Some:Company:With:Colons' }
    const serialized = serializeMapSelection(sel)
    expect(serialized).not.toContain('Some:Company')
    expect(parseMapSelection(serialized)).toEqual(sel)
  })

  it('preserves ids that contain spaces, slashes, and unicode', () => {
    const sel: MapSelection = { type: 'skill-item', groupId: 'platform', itemId: 'Apache Spark / 2.x — café' }
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
