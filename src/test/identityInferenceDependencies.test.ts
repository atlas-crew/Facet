import { describe, expect, it } from 'vitest'
import {
  IDENTITY_INFERENCE_ORDER,
  IDENTITY_INFERENCE_SECTION_FIELDS,
  getDownstreamIdentityInferenceSections,
  getIdentityInferenceInputFields,
  getIdentityInferenceSectionForField,
  getUpstreamIdentityInferenceSections,
  sortIdentityInferenceSections,
  type IdentityInferenceSection,
} from '../routes/identity/identityInferenceDependencies'

describe('identityInferenceDependencies', () => {
  it('resolves precise downstream sections via the authored DAG, not a linear chain', () => {
    // Correcting a bullet reaches the whole narrative layer (everything downstream of root).
    expect(getDownstreamIdentityInferenceSections('bullets')).toEqual([
      'skills',
      'thesis',
      'profiles',
      'chapters',
      'selfKnowledge',
      'positioning',
      'search',
    ])

    // Skills feeds thesis/profiles/positioning/search directly, and selfKnowledge via thesis —
    // but NOT chapters (the career arc is authored from roles, never from skills).
    expect(getDownstreamIdentityInferenceSections('skills')).toEqual([
      'thesis',
      'profiles',
      'selfKnowledge',
      'positioning',
      'search',
    ])

    // The precision win: editing the thesis no longer flags `chapters`. Linear chain did.
    expect(getDownstreamIdentityInferenceSections('thesis')).toEqual([
      'profiles',
      'selfKnowledge',
      'positioning',
      'search',
    ])

    expect(getDownstreamIdentityInferenceSections('chapters')).toEqual([
      'selfKnowledge',
      'positioning',
      'search',
    ])

    expect(getDownstreamIdentityInferenceSections('positioning')).toEqual(['search'])
    expect(getDownstreamIdentityInferenceSections('search')).toEqual([])
  })

  it('treats profiles and self-knowledge as downstream leaves', () => {
    // Authored under-approximation: profiles is a presentation lens (a sibling of the other
    // narrative outputs), named a material driver by no later section, so correcting it cascades
    // to nothing. Self-knowledge, by contrast, feeds positioning and search via `self_model`.
    expect(getDownstreamIdentityInferenceSections('profiles')).toEqual([])
    expect(getDownstreamIdentityInferenceSections('selfKnowledge')).toEqual([
      'positioning',
      'search',
    ])
  })

  it('exposes direct upstream inputs in inference order', () => {
    expect(getUpstreamIdentityInferenceSections('bullets')).toEqual([])
    expect(getUpstreamIdentityInferenceSections('thesis')).toEqual(['bullets', 'skills'])
    expect(getUpstreamIdentityInferenceSections('positioning')).toEqual([
      'bullets',
      'skills',
      'thesis',
      'chapters',
      'selfKnowledge',
    ])
    expect(getUpstreamIdentityInferenceSections('search')).toEqual([
      'skills',
      'thesis',
      'chapters',
      'selfKnowledge',
      'positioning',
    ])
  })

  it('keeps the graph forward-only (acyclic, consistent with IDENTITY_INFERENCE_ORDER)', () => {
    const orderIndex = new Map(
      IDENTITY_INFERENCE_ORDER.map((section, index) => [section, index] as const),
    )
    for (const section of IDENTITY_INFERENCE_ORDER) {
      for (const input of getUpstreamIdentityInferenceSections(section)) {
        expect(orderIndex.get(input)!).toBeLessThan(orderIndex.get(section)!)
      }
    }
  })

  it('downstream is the transpose closure of upstream', () => {
    // A section S is downstream of U iff U is (transitively) upstream of S.
    const reachableUpstream = (section: IdentityInferenceSection): Set<IdentityInferenceSection> => {
      const acc = new Set<IdentityInferenceSection>()
      const visit = (current: IdentityInferenceSection) => {
        for (const input of getUpstreamIdentityInferenceSections(current)) {
          if (acc.has(input)) continue
          acc.add(input)
          visit(input)
        }
      }
      visit(section)
      return acc
    }

    for (const upstream of IDENTITY_INFERENCE_ORDER) {
      const downstream = new Set(getDownstreamIdentityInferenceSections(upstream))
      for (const candidate of IDENTITY_INFERENCE_ORDER) {
        expect(downstream.has(candidate)).toBe(reachableUpstream(candidate).has(upstream))
      }
    }
  })

  it('maps identity field paths back to their owning inference section', () => {
    expect(getIdentityInferenceSectionForField('skills.Kubernetes.depth')).toBe('skills')
    expect(getIdentityInferenceSectionForField('self_model.arc')).toBe('chapters')
    expect(getIdentityInferenceSectionForField('self_model.arc.0.chapter')).toBe('chapters')
    expect(getIdentityInferenceSectionForField('self_model.competitive_moat')).toBe('positioning')
    expect(getIdentityInferenceSectionForField('identity.thesis')).toBe('thesis')
    expect(getIdentityInferenceSectionForField('search_vectors')).toBe('search')
    expect(getIdentityInferenceSectionForField('roles.0.bullets.2')).toBe('bullets')
  })

  it('returns undefined for fields no inference section owns', () => {
    // Contact basics live in the `identity` region but are not a thesis sub-field.
    expect(getIdentityInferenceSectionForField('identity.name')).toBeUndefined()
    expect(getIdentityInferenceSectionForField('identity.email')).toBeUndefined()
    // External regions carry no intra-identity edge.
    expect(getIdentityInferenceSectionForField('expertise')).toBeUndefined()
    expect(getIdentityInferenceSectionForField('preferences.compensation')).toBeUndefined()
    expect(getIdentityInferenceSectionForField('  ')).toBeUndefined()
  })

  it('scopes a section input fingerprint to its upstream owned fields', () => {
    // thesis consumes bullets + skills → roles/projects + skills field roots.
    expect(getIdentityInferenceInputFields('thesis').sort()).toEqual(
      ['projects', 'roles', 'skills'].sort(),
    )
    // Root evidence consumes no inference section, so nothing to hash.
    expect(getIdentityInferenceInputFields('bullets')).toEqual([])
    // positioning consumes bullets/skills/thesis/chapters/selfKnowledge.
    expect(getIdentityInferenceInputFields('positioning').sort()).toEqual(
      [
        'roles',
        'projects',
        'skills',
        'identity.thesis',
        'identity.title',
        'identity.origin',
        'identity.elaboration',
        'self_model.arc',
        'self_model.philosophy',
        'self_model.interview_style',
      ].sort(),
    )
  })

  it('every section owns at least one field path, with no cross-section overlap', () => {
    const seen = new Map<string, IdentityInferenceSection>()
    for (const section of IDENTITY_INFERENCE_ORDER) {
      const roots = IDENTITY_INFERENCE_SECTION_FIELDS[section]
      expect(roots.length).toBeGreaterThan(0)
      for (const root of roots) {
        expect(seen.has(root)).toBe(false)
        seen.set(root, section)
      }
    }
  })

  it('sorts and deduplicates selected downstream sections', () => {
    expect(sortIdentityInferenceSections(['search', 'profiles', 'search', 'thesis'])).toEqual([
      'thesis',
      'profiles',
      'search',
    ])
  })
})
