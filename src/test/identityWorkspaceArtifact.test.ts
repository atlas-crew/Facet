// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FACET_WORKSPACE_SNAPSHOT_VERSION } from '../persistence/contracts'
import type { FacetWorkspaceSnapshot } from '../persistence/contracts'
import { createWorkspaceSnapshotFromStores } from '../persistence/snapshot'
import { normalizeWorkspaceSnapshot } from '../persistence/normalization'
import { applyWorkspaceSnapshotToStores } from '../persistence/hydration'
import { mergeWorkspaceSnapshots } from '../persistence/workspaceImportMerge'
import { assertValidWorkspaceSnapshot } from '../persistence/validation'
import { normalizeRuntimeProfessionalIdentity } from '../identity/schema'
import { useIdentityStore } from '../store/identityStore'
import { buildWorkspaceSnapshot } from './fixtures/workspaceSnapshot'
import { cloneIdentityFixture } from './fixtures/identityFixture'

// A snapshot that predates the identity artifact (TASK-40): snapshotVersion 1,
// no `identity` key under artifacts. Built by stripping identity off the shared
// happy-path fixture, exactly mirroring a localStorage/indexedDb snapshot
// written before the promotion.
const buildLegacyV1Snapshot = (): FacetWorkspaceSnapshot => {
  const snapshot = buildWorkspaceSnapshot() as Omit<
    FacetWorkspaceSnapshot,
    'snapshotVersion' | 'artifacts'
  > & {
    snapshotVersion: number
    artifacts: Partial<FacetWorkspaceSnapshot['artifacts']>
  }
  snapshot.snapshotVersion = 1
  delete snapshot.artifacts.identity
  return snapshot as FacetWorkspaceSnapshot
}

const snapshotWithIdentity = (
  identity: FacetWorkspaceSnapshot['artifacts']['identity']['payload']['identity'],
): FacetWorkspaceSnapshot => {
  const snapshot = buildWorkspaceSnapshot()
  snapshot.artifacts.identity = {
    ...snapshot.artifacts.identity,
    payload: { identity },
  }
  return snapshot
}

const resetIdentityStore = () => {
  useIdentityStore.setState({ currentIdentity: null, draft: null, draftDocument: '' })
}

describe('identity workspace artifact (TASK-40)', () => {
  beforeEach(resetIdentityStore)
  afterEach(resetIdentityStore)

  it('captures the live identity model into the snapshot artifact', () => {
    const identity = cloneIdentityFixture()
    useIdentityStore.setState({ currentIdentity: identity })

    const snapshot = createWorkspaceSnapshotFromStores({ workspaceId: 'ws-1' })

    expect(snapshot.snapshotVersion).toBe(FACET_WORKSPACE_SNAPSHOT_VERSION)
    expect(snapshot.artifacts.identity.artifactType).toBe('identity')
    expect(snapshot.artifacts.identity.payload.identity).toEqual(identity)
    // The snapshot must hold an independent clone, not a live store reference.
    expect(snapshot.artifacts.identity.payload.identity).not.toBe(identity)
  })

  it('round-trips an additive bullet level through capture and hydration (#38)', () => {
    // level / level_source / level_rationale are additive optional fields. They survive without a
    // migration only because the artifact is cloned wholesale, validated at the object-or-null
    // boundary, and spread through the runtime normalizer — this asserts that end to end.
    const identity = cloneIdentityFixture()
    identity.roles[0].bullets[0].level = 'owns'
    identity.roles[0].bullets[0].level_source = 'corrected'
    identity.roles[0].bullets[0].level_rationale = 'Owned the rollout and on-call.'
    useIdentityStore.setState({ currentIdentity: identity })

    const snapshot = createWorkspaceSnapshotFromStores({ workspaceId: 'ws-1' })
    expect(snapshot.artifacts.identity.payload.identity?.roles[0].bullets[0].level).toBe('owns')

    resetIdentityStore()
    applyWorkspaceSnapshotToStores(snapshot)
    const restored = useIdentityStore.getState().currentIdentity!.roles[0].bullets[0]
    expect(restored.level).toBe('owns')
    expect(restored.level_source).toBe('corrected')
    expect(restored.level_rationale).toBe('Owned the rollout and on-call.')
  })

  it('captures a null identity when no model is loaded', () => {
    const snapshot = createWorkspaceSnapshotFromStores({ workspaceId: 'ws-1' })
    expect(snapshot.artifacts.identity.payload.identity).toBeNull()
  })

  describe('normalization', () => {
    it('upgrades a legacy v1 snapshot to v2 and defaults a null identity artifact', () => {
      const normalized = normalizeWorkspaceSnapshot(buildLegacyV1Snapshot())

      expect(normalized.snapshotVersion).toBe(FACET_WORKSPACE_SNAPSHOT_VERSION)
      expect(normalized.artifacts.identity.artifactType).toBe('identity')
      expect(normalized.artifacts.identity.payload.identity).toBeNull()
    })

    it('leaves an unknown/future snapshot version untouched so validation still rejects it', () => {
      const snapshot = buildWorkspaceSnapshot() as Omit<
        FacetWorkspaceSnapshot,
        'snapshotVersion'
      > & {
        snapshotVersion: number
      }
      snapshot.snapshotVersion = 999

      expect(
        normalizeWorkspaceSnapshot(snapshot as FacetWorkspaceSnapshot).snapshotVersion,
      ).toBe(999)
    })
  })

  describe('hydration clobber rule', () => {
    it('restores a populated identity from the snapshot (through the runtime normalizer)', () => {
      const identity = cloneIdentityFixture()
      applyWorkspaceSnapshotToStores(snapshotWithIdentity(identity))

      // Hydration reinstates the model through the same runtime normalizer the
      // persist merge uses, so the restored model is the normalized form.
      expect(useIdentityStore.getState().currentIdentity).toEqual(
        normalizeRuntimeProfessionalIdentity(identity),
      )
    })

    it('does NOT overwrite a populated local identity with a null snapshot identity', () => {
      const local = cloneIdentityFixture()
      useIdentityStore.setState({ currentIdentity: local })

      applyWorkspaceSnapshotToStores(snapshotWithIdentity(null))

      expect(useIdentityStore.getState().currentIdentity).toEqual(local)
    })

    it('does NOT overwrite a populated local identity when the snapshot predates the artifact', () => {
      const local = cloneIdentityFixture()
      useIdentityStore.setState({ currentIdentity: local })

      // A legacy v1 snapshot has no identity artifact at all.
      applyWorkspaceSnapshotToStores(buildLegacyV1Snapshot())

      expect(useIdentityStore.getState().currentIdentity).toEqual(local)
    })
  })

  describe('merge semantics (singleton, keep-existing-unless-empty)', () => {
    it('keeps the local identity when both sides carry a model', () => {
      const local = cloneIdentityFixture()
      const imported = { ...cloneIdentityFixture(), model_revision: 999 }

      const merged = mergeWorkspaceSnapshots(
        snapshotWithIdentity(local),
        snapshotWithIdentity(imported),
      )

      expect(merged.artifacts.identity.payload.identity).toEqual(local)
    })

    it('fills the identity from the import when the local side is empty', () => {
      const imported = cloneIdentityFixture()

      const merged = mergeWorkspaceSnapshots(
        snapshotWithIdentity(null),
        snapshotWithIdentity(imported),
      )

      expect(merged.artifacts.identity.payload.identity).toEqual(imported)
    })
  })

  describe('validation', () => {
    it('accepts a model-or-null identity payload', () => {
      expect(() => assertValidWorkspaceSnapshot(snapshotWithIdentity(null))).not.toThrow()
      expect(() =>
        assertValidWorkspaceSnapshot(snapshotWithIdentity(cloneIdentityFixture())),
      ).not.toThrow()
    })

    it('rejects an identity payload that is neither an object nor null', () => {
      const snapshot = buildWorkspaceSnapshot()
      ;(snapshot.artifacts.identity.payload as { identity: unknown }).identity = 42

      expect(() => assertValidWorkspaceSnapshot(snapshot)).toThrow(/artifacts.identity.payload/)
    })
  })
})
