import { describe, expect, it } from 'vitest'
import {
  describeImpact,
  describeIdentityDiff,
  findStaleArtifacts,
  isArtifactStale,
  recordIdentityMetadata,
  sanitizeArtifactStalenessReview,
  sanitizeIdentityFields,
  sanitizeIdentityVersion,
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

  describe('findStaleArtifacts', () => {
    it('returns an empty list for an empty workspace', () => {
      expect(findStaleArtifacts(5, {})).toEqual([])
    })

    it('returns an empty list when every artifact is at the current revision', () => {
      const workspace = {
        theses: [{ id: 't-1', identityVersion: 5 }],
        runs: [{ id: 'r-1', identityVersion: 5 }],
        prepDecks: [{ id: 'd-1', identityVersion: 5 }],
        coverLetters: [{ id: 'c-1', identityVersion: 5 }],
      }
      expect(findStaleArtifacts(5, workspace)).toEqual([])
    })

    it('flags artifacts whose identityVersion is strictly behind current', () => {
      const workspace = {
        theses: [
          { id: 't-current', identityVersion: 5 },
          { id: 't-stale', identityVersion: 3 },
        ],
        runs: [{ id: 'r-stale', identityVersion: 4 }],
        prepDecks: [{ id: 'd-stale', identityVersion: 2 }],
        coverLetters: [{ id: 'c-current', identityVersion: 5 }],
      }
      expect(findStaleArtifacts(5, workspace)).toEqual([
        { artifactType: 'thesis', artifactId: 't-stale', identityVersion: 3 },
        { artifactType: 'run', artifactId: 'r-stale', identityVersion: 4 },
        { artifactType: 'prep-deck', artifactId: 'd-stale', identityVersion: 2 },
      ])
    })

    it('excludes artifacts that have no recorded identityVersion (no stamp = no comparison)', () => {
      const workspace = {
        theses: [{ id: 't-unstamped', identityVersion: undefined }],
        prepDecks: [{ id: 'd-null', identityVersion: null }],
      }
      expect(findStaleArtifacts(10, workspace)).toEqual([])
    })

    it('does not flag artifacts ahead of current revision (time-travel guard)', () => {
      const workspace = {
        theses: [{ id: 't-future', identityVersion: 9 }],
      }
      expect(findStaleArtifacts(5, workspace)).toEqual([])
    })

    it('preserves the canonical artifact-type order: thesis, run, prep-deck, cover-letter', () => {
      const workspace = {
        coverLetters: [{ id: 'c-1', identityVersion: 1 }],
        prepDecks: [{ id: 'd-1', identityVersion: 1 }],
        runs: [{ id: 'r-1', identityVersion: 1 }],
        theses: [{ id: 't-1', identityVersion: 1 }],
      }
      const stale = findStaleArtifacts(5, workspace)
      expect(stale.map((entry) => entry.artifactType)).toEqual([
        'thesis',
        'run',
        'prep-deck',
        'cover-letter',
      ])
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

  describe('sanitizeIdentityVersion', () => {
    it('normalizes persisted revision values', () => {
      expect(sanitizeIdentityVersion(undefined)).toBeUndefined()
      expect(sanitizeIdentityVersion(null)).toBeUndefined()
      expect(sanitizeIdentityVersion('4')).toBeUndefined()
      expect(sanitizeIdentityVersion(Number.NaN)).toBeUndefined()
      expect(sanitizeIdentityVersion(Number.POSITIVE_INFINITY)).toBeUndefined()
      expect(sanitizeIdentityVersion(4.7)).toBe(4)
      expect(sanitizeIdentityVersion(-3)).toBe(0)
      expect(sanitizeIdentityVersion(0)).toBe(0)
    })
  })

  describe('sanitizeIdentityFields', () => {
    it('trims string field paths and drops empty or invalid entries', () => {
      expect(sanitizeIdentityFields()).toBeUndefined()
      expect(sanitizeIdentityFields([])).toBeUndefined()
      expect(sanitizeIdentityFields(['  skills.Kubernetes.depth ', '', 'skills.Rust.depth']))
        .toEqual(['skills.Kubernetes.depth', 'skills.Rust.depth'])
      expect(sanitizeIdentityFields(['  ', ''])).toBeUndefined()
    })
  })

  describe('sanitizeArtifactStalenessReview', () => {
    it('requires at least one concrete mutation field for persisted review records', () => {
      const review = {
        decision: 'accepted-current',
        reviewedAt: '2026-04-28T00:00:00.000Z',
        reviewedIdentityVersion: 3,
        artifactIdentityVersionAtReview: 2,
        mutationLabel: 'Kubernetes depth correction',
        mutationFields: ['  skills.Kubernetes.depth  '],
        mutationFromRevision: 2,
        mutationToRevision: 3,
        reason: 'Generated from an older identity revision.',
      }

      expect(sanitizeArtifactStalenessReview(review)).toMatchObject({
        mutationLabel: 'Kubernetes depth correction',
        mutationFields: ['skills.Kubernetes.depth'],
        reason: 'Generated from an older identity revision.',
      })
      expect(sanitizeArtifactStalenessReview({ ...review, decision: 'not-stale' }))
        .toMatchObject({ decision: 'not-stale' })
      expect(sanitizeArtifactStalenessReview(null)).toBeUndefined()
      expect(sanitizeArtifactStalenessReview('not a review')).toBeUndefined()
      expect(sanitizeArtifactStalenessReview({ ...review, decision: 'deferred' }))
        .toBeUndefined()
      expect(sanitizeArtifactStalenessReview({ ...review, reviewedAt: '' })).toBeUndefined()
      expect(sanitizeArtifactStalenessReview({ ...review, mutationLabel: '  ' }))
        .toBeUndefined()
      expect(sanitizeArtifactStalenessReview({ ...review, reason: '' })).toBeUndefined()
      expect(sanitizeArtifactStalenessReview({ ...review, reviewedIdentityVersion: Number.NaN }))
        .toBeUndefined()
      expect(sanitizeArtifactStalenessReview({ ...review, mutationFields: [] })).toBeUndefined()
      expect(sanitizeArtifactStalenessReview({ ...review, mutationFields: ['  '] }))
        .toBeUndefined()
      expect(sanitizeArtifactStalenessReview({ ...review, mutationFields: 'skills.Kubernetes.depth' }))
        .toBeUndefined()
      expect(sanitizeArtifactStalenessReview({ ...review, mutationFromRevision: 4 }))
        .toBeUndefined()
      expect(sanitizeArtifactStalenessReview({ ...review, reviewedIdentityVersion: 1 }))
        .toBeUndefined()
      expect(sanitizeArtifactStalenessReview({ ...review, artifactIdentityVersionAtReview: 4 }))
        .toBeUndefined()
      expect(sanitizeArtifactStalenessReview({
        ...review,
        reviewedIdentityVersion: 3.9,
        artifactIdentityVersionAtReview: -1,
        mutationFromRevision: -2,
        mutationToRevision: 3.2,
        mutationLabel: '  Kubernetes depth correction  ',
        mutationFields: ['  skills.Kubernetes.depth  ', ''],
        reason: '  Reviewed from batch staleness panel.  ',
      })).toMatchObject({
        reviewedIdentityVersion: 3,
        artifactIdentityVersionAtReview: 0,
        mutationFromRevision: 0,
        mutationToRevision: 3,
        mutationLabel: 'Kubernetes depth correction',
        mutationFields: ['skills.Kubernetes.depth'],
        reason: 'Reviewed from batch staleness panel.',
      })
    })
  })

  describe('describeImpact', () => {
    it('returns an empty impact summary when no artifacts are affected', () => {
      const impact = describeImpact(
        {
          label: 'Kubernetes depth correction',
          fields: ['skills.Kubernetes.depth'],
          fromRevision: 2,
          toRevision: 3,
        },
        [],
      )

      expect(impact.totalCount).toBe(0)
      expect(impact.artifactsAffected).toEqual([])
      expect(impact.counts).toEqual({
        thesis: 0,
        run: 0,
        'prep-deck': 0,
        'cover-letter': 0,
      })
      expect(impact.summary).toBe('No downstream artifacts are expected to need review.')
    })

    it('returns field-level affected artifacts with per-artifact reasoning', () => {
      const impact = describeImpact(
        {
          label: 'Kubernetes depth correction',
          fields: ['skills.Kubernetes.depth'],
          fromRevision: 2,
          toRevision: 3,
        },
        [
          {
            artifactType: 'run',
            artifactId: 'run-1',
            label: 'Search run',
            identityVersion: 3,
            identityFields: ['skills.Kubernetes.depth', 'skills.Rust.depth'],
            detail: '4 search results',
          },
          {
            artifactType: 'prep-deck',
            artifactId: 'deck-1',
            label: 'Acme prep deck',
            identityVersion: 3,
            identityFields: ['skills.Rust.depth'],
          },
        ],
      )

      expect(impact.totalCount).toBe(1)
      expect(impact.counts.run).toBe(1)
      expect(impact.artifactsAffected[0]).toMatchObject({
        artifactType: 'run',
        artifactId: 'run-1',
        fallback: 'field',
        matchedFields: ['skills.Kubernetes.depth'],
      })
      expect(impact.artifactsAffected[0]?.reason).toContain('References skills.Kubernetes.depth')
    })

    it('falls back to version-only impact when field dependencies are absent', () => {
      const impact = describeImpact(
        {
          label: 'Kubernetes depth correction',
          fields: ['skills.Kubernetes.depth'],
          fromRevision: 2,
          toRevision: 3,
        },
        [
          {
            artifactType: 'thesis',
            artifactId: 'thesis-1',
            label: 'Search thesis',
            identityVersion: 2,
          },
          {
            artifactType: 'cover-letter',
            artifactId: 'letter-1',
            label: 'Cover letter',
            identityVersion: 3,
          },
          {
            artifactType: 'prep-deck',
            artifactId: 'deck-1',
            label: 'Prep deck',
          },
        ],
      )

      expect(impact.totalCount).toBe(1)
      expect(impact.counts.thesis).toBe(1)
      expect(impact.artifactsAffected[0]).toMatchObject({
        artifactType: 'thesis',
        fallback: 'version',
        matchedFields: [],
      })
      expect(impact.artifactsAffected[0]?.reason).toContain(
        'Generated from identity v2 before this correction moves identity to v3',
      )
    })

    it('summarizes affected artifact counts across supported domains', () => {
      const impact = describeImpact(
        {
          label: 'Kubernetes depth correction',
          fields: ['skills.Kubernetes.depth'],
          fromRevision: 4,
          toRevision: 5,
        },
        [
          { artifactType: 'thesis', artifactId: 'thesis-1', label: 'Thesis', identityVersion: 4 },
          { artifactType: 'run', artifactId: 'run-1', label: 'Run', identityVersion: 4 },
          { artifactType: 'prep-deck', artifactId: 'deck-1', label: 'Deck', identityVersion: 4 },
          { artifactType: 'cover-letter', artifactId: 'letter-1', label: 'Letter', identityVersion: 4 },
        ],
      )

      expect(impact.counts).toEqual({
        thesis: 1,
        run: 1,
        'prep-deck': 1,
        'cover-letter': 1,
      })
      expect(impact.summary).toBe(
        '4 downstream artifacts may need review: 1 search thesis, 1 search run, 1 prep deck, and 1 cover letter.',
      )
    })
  })
})
