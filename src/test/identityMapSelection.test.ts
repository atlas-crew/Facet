import { afterEach, describe, expect, it } from 'vitest'
import { useIdentityStore, isMapSelectionValid } from '../store/identityStore'
import type { ProfessionalIdentityV3 } from '../identity/schema'
import type { MapSelection } from '../types/identity'
import { cloneIdentityFixture } from './fixtures/identityFixture'

const resetStore = () => {
  useIdentityStore.setState({
    intakeMode: 'upload',
    sourceMaterial: '',
    correctionNotes: '',
    currentIdentity: null,
    draft: null,
    draftDocument: '',
    intakeSources: [],
    warnings: [],
    changelog: [],
    lastError: null,
    mapSelection: null,
  })
}

describe('identityStore mapSelection', () => {
  afterEach(() => {
    resetStore()
  })

  it('initial state is null', () => {
    resetStore()
    expect(useIdentityStore.getState().mapSelection).toBeNull()
  })

  it('setMapSelection accepts valid selection when identity is loaded', () => {
    useIdentityStore.setState({ currentIdentity: cloneIdentityFixture() })
    useIdentityStore.getState().setMapSelection({ type: 'thesis' })
    expect(useIdentityStore.getState().mapSelection).toEqual({ type: 'thesis' })
  })

  it('setMapSelection rejects selection that references a missing entity', () => {
    useIdentityStore.setState({ currentIdentity: cloneIdentityFixture() })
    useIdentityStore.getState().setMapSelection({ type: 'role', id: 'does-not-exist' })
    expect(useIdentityStore.getState().mapSelection).toBeNull()
  })

  it('setMapSelection(null) always clears selection', () => {
    useIdentityStore.setState({
      currentIdentity: cloneIdentityFixture(),
      mapSelection: { type: 'thesis' },
    })
    useIdentityStore.getState().setMapSelection(null)
    expect(useIdentityStore.getState().mapSelection).toBeNull()
  })

  it('rejects any selection when no identity is loaded', () => {
    useIdentityStore.setState({ currentIdentity: null })
    useIdentityStore.getState().setMapSelection({ type: 'thesis' })
    expect(useIdentityStore.getState().mapSelection).toBeNull()
  })

  it('rejects arc-stop ids that are not persisted in self_model.arc[]', () => {
    const id = cloneIdentityFixture()
    id.self_model.arc = []
    // Arc-stops require a real persisted entry. We deliberately removed the
    // `derived:` synthetic-id support so the Self Model arc only renders
    // narrative the user has authored.
    expect(isMapSelectionValid({ type: 'arc-stop', id: 'Contoso:0' }, id)).toBe(false)
    expect(isMapSelectionValid({ type: 'arc-stop', id: 'derived:Contoso:0' }, id)).toBe(false)

    id.self_model.arc = [{ company: 'Contoso', chapter: 'Foundation Builder' }]
    expect(isMapSelectionValid({ type: 'arc-stop', id: 'Contoso:0' }, id)).toBe(true)
  })

  it('accepts a real philosophy id from the fixture', () => {
    const id = cloneIdentityFixture()
    expect(isMapSelectionValid({ type: 'philosophy', id: 'absorb-complexity' }, id)).toBe(true)
    expect(isMapSelectionValid({ type: 'philosophy', id: 'missing' }, id)).toBe(false)
  })

  it('accepts a real bullet by (roleId, bulletId)', () => {
    const id = cloneIdentityFixture()
    expect(
      isMapSelectionValid(
        { type: 'bullet', roleId: 'contoso', bulletId: 'platform-migration' },
        id,
      ),
    ).toBe(true)
    expect(
      isMapSelectionValid({ type: 'bullet', roleId: 'contoso', bulletId: 'missing' }, id),
    ).toBe(false)
  })

  it('mapSelection is excluded from persistence', () => {
    // The persist middleware uses partialize to choose what to write. We confirm shape here
    // by inspecting the store's persist options indirectly: setting a selection and then
    // round-tripping through the persist serialization should drop it. Light check: the
    // serialized snapshot does not include mapSelection.
    useIdentityStore.setState({ currentIdentity: cloneIdentityFixture() })
    useIdentityStore.getState().setMapSelection({ type: 'thesis' })
    const persisted = JSON.stringify(
      useIdentityStore.persist.getOptions().partialize?.(useIdentityStore.getState()),
    )
    expect(persisted).not.toContain('mapSelection')
  })
})

/**
 * Build an identity that has at least one entity of every kind addressable by
 * MapSelection. Lets us drive a positive validator/round-trip case for every
 * variant of the discriminated union — without this, the validator could
 * silently reject most kinds and the existing rejection-biased tests would
 * still pass (a real coverage hole flagged by review).
 */
function buildCompleteIdentity(): ProfessionalIdentityV3 {
  const id = cloneIdentityFixture()
  id.self_model.arc = [{ company: 'Contoso Networks', chapter: 'Foundation Builder' }]
  id.profiles = [
    ...id.profiles,
    { id: 'leader-profile', tags: ['leadership'], text: 'Technical leader profile.' },
  ]
  id.projects = [
    {
      id: 'project-x',
      name: 'Project X',
      description: 'Cross-cutting platform tooling.',
      tags: ['platform'],
    },
  ]
  id.preferences.matching = {
    prioritize: [
      { id: 'prio-platform', label: 'Platform focus', description: 'd', weight: 'high' },
    ],
    avoid: [
      { id: 'avoid-maintenance', label: 'Pure maintenance', description: 'd', severity: 'soft' },
    ],
  }
  id.search_vectors = [
    {
      id: 'vec-platform',
      title: 'Platform Engineer',
      priority: 'high',
      thesis: 'Platform thesis.',
      target_roles: ['Senior Platform Engineer'],
      keywords: { primary: ['platform'], secondary: [] },
    },
  ]
  id.awareness = {
    open_questions: [
      {
        id: 'q-tenure',
        topic: 'Tenure',
        description: 'Verify dates align across resume and LinkedIn.',
        action: 'Confirm before next interview',
      },
    ],
  }
  return id
}

describe('isMapSelectionValid — positive coverage for every MapSelection variant', () => {
  // 16 cases (15 type discriminants, with `match-rule` exercised on both `prioritize`
  // and `avoid` kinds since they read from different lists).
  const cases: Array<{ name: string; selection: MapSelection }> = [
    { name: 'contact basics', selection: { type: 'contact-basics' } },
    { name: 'thesis', selection: { type: 'thesis' } },
    { name: 'competitive moat', selection: { type: 'competitive-moat' } },
    { name: 'philosophy', selection: { type: 'philosophy', id: 'absorb-complexity' } },
    { name: 'arc-stop', selection: { type: 'arc-stop', id: 'Contoso Networks:0' } },
    { name: 'profile', selection: { type: 'profile', id: 'platform-profile' } },
    { name: 'role', selection: { type: 'role', id: 'contoso' } },
    {
      name: 'bullet',
      selection: { type: 'bullet', roleId: 'contoso', bulletId: 'platform-migration' },
    },
    { name: 'project', selection: { type: 'project', id: 'project-x' } },
    { name: 'skill-group', selection: { type: 'skill-group', id: 'platform' } },
    {
      name: 'skill-item',
      selection: { type: 'skill-item', groupId: 'platform', itemId: 'Kubernetes' },
    },
    { name: 'pref-field', selection: { type: 'pref-field', field: 'work_model.preference' } },
    {
      name: 'match-rule prioritize',
      selection: { type: 'match-rule', kind: 'prioritize', id: 'prio-platform' },
    },
    {
      name: 'match-rule avoid',
      selection: { type: 'match-rule', kind: 'avoid', id: 'avoid-maintenance' },
    },
    { name: 'search-vector', selection: { type: 'search-vector', id: 'vec-platform' } },
    {
      name: 'awareness-question',
      selection: { type: 'awareness-question', id: 'q-tenure' },
    },
  ]

  afterEach(() => {
    resetStore()
  })

  it.each(cases)('isMapSelectionValid accepts $name', ({ selection }) => {
    expect(isMapSelectionValid(selection, buildCompleteIdentity())).toBe(true)
  })

  it.each(cases)('setMapSelection round-trips $name without rejection', ({ selection }) => {
    useIdentityStore.setState({
      currentIdentity: buildCompleteIdentity(),
      mapSelection: null,
    })
    useIdentityStore.getState().setMapSelection(selection)
    expect(useIdentityStore.getState().mapSelection).toEqual(selection)
  })
})
