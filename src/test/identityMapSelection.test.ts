import { afterEach, describe, expect, it } from 'vitest'
import { useIdentityStore, isMapSelectionValid } from '../store/identityStore'
import { cloneIdentityFixture } from './fixtures/identityFixture'

const resetStore = () => {
  useIdentityStore.setState({
    intakeMode: 'upload',
    sourceMaterial: '',
    correctionNotes: '',
    currentIdentity: null,
    draft: null,
    draftDocument: '',
    scanResult: null,
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
    useIdentityStore.setState({ currentIdentity: cloneIdentityFixture(), mapSelection: { type: 'thesis' } })
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
      isMapSelectionValid({ type: 'bullet', roleId: 'contoso', bulletId: 'platform-migration' }, id),
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
    const persisted = JSON.stringify(useIdentityStore.persist.getOptions().partialize?.(useIdentityStore.getState()))
    expect(persisted).not.toContain('mapSelection')
  })
})
