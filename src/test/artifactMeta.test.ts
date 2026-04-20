import { describe, expect, it } from 'vitest'
import {
  describeIdentityDiff,
  isArtifactStale,
  recordIdentityMetadata,
} from '../types/artifactMeta'

describe('artifactMeta helpers', () => {
  describe('isArtifactStale', () => {
    it('returns false when current revision equals artifact revision', () => {
      expect(isArtifactStale({ identityVersion: 5 }, 5)).toBe(false)
    })

    it('returns false when artifact is ahead of current (guards against time-travel)', () => {
      expect(isArtifactStale({ identityVersion: 7 }, 5)).toBe(false)
    })

    it('returns true when current revision exceeds artifact revision', () => {
      expect(isArtifactStale({ identityVersion: 3 }, 10)).toBe(true)
    })

    it('returns false at the initial zero state', () => {
      expect(isArtifactStale({ identityVersion: 0 }, 0)).toBe(false)
    })
  })

  describe('describeIdentityDiff', () => {
    it('returns an empty list when revisions match', () => {
      expect(describeIdentityDiff(5, 5)).toEqual([])
    })

    it('returns an empty list when target is behind source', () => {
      expect(describeIdentityDiff(10, 3)).toEqual([])
    })

    it('singular phrasing for a single-step delta', () => {
      expect(describeIdentityDiff(0, 1)).toEqual([
        'Identity has changed 1 time since this was generated.',
      ])
    })

    it('plural phrasing for multi-step deltas', () => {
      expect(describeIdentityDiff(2, 7)).toEqual([
        'Identity has changed 5 times since this was generated.',
      ])
    })
  })

  describe('recordIdentityMetadata', () => {
    it('snapshots the identity revision into metadata', () => {
      const metadata = recordIdentityMetadata({ model_revision: 42 }, '2026-04-20T00:00:00.000Z')

      expect(metadata).toEqual({
        createdAt: '2026-04-20T00:00:00.000Z',
        identityVersion: 42,
      })
    })

    it('defaults createdAt to the current time when not supplied', () => {
      const before = Date.now()
      const metadata = recordIdentityMetadata({ model_revision: 3 })
      const after = Date.now()

      const ts = Date.parse(metadata.createdAt)
      expect(ts).toBeGreaterThanOrEqual(before)
      expect(ts).toBeLessThanOrEqual(after)
    })

    it('round-trips through isArtifactStale as expected across mutations', () => {
      const metadata = recordIdentityMetadata({ model_revision: 4 })

      expect(isArtifactStale(metadata, 4)).toBe(false)
      expect(isArtifactStale(metadata, 5)).toBe(true)
      expect(isArtifactStale(metadata, 100)).toBe(true)
    })
  })
})
