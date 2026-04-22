---
id: TASK-159
title: Add identity version counter and skill depth writeback precedence
status: Done
assignee: []
created_date: '2026-04-19 09:00'
updated_date: '2026-04-20 03:12'
labels:
  - identity-model
  - search-redesign
  - foundation
milestone: m-20
dependencies:
  - TASK-150
references:
  - src/identity/schema.ts
  - src/utils/identitySearchProfile.ts
  - src/store/identityStore.ts
documentation:
  - 'backlog doc-24: Identity Model Lifecycle section'
  - 'backlog doc-26: Fresh-Context Critique Triggers'
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a monotonic `version: number` counter to the identity model and establish a writeback precedence rule that prevents AI inference from overwriting user corrections.

These two changes unblock every staleness-detection and fresh-context-critique feature in the redesign. Without the version counter, thesis/cover-letter/prep staleness is undetectable. Without precedence rules, the shepherding design's writeback loop silently leaks corrections on every identity regeneration.

**Identity versioning:**
- Add `version: number` to `ProfessionalIdentityV3` (or a metadata sub-object)
- Increment on any mutation: skill change, vector change, preference change, role/bullet edit, profile edit
- Identity store exposes `bumpVersion()` or automatic increment on store mutations
- Zod validation and schema migration to initialize existing identities to version 0 or 1

**Writeback precedence rule — user correction > explicit schema value > AI inference:**

Implementation (pick one):

1. **Provenance flag per field (preferred):** Add `depthSource?: 'inferred' | 'corrected'` to `SkillItem`. `inferSkillDepth()` in `identitySearchProfile.ts` runs only when source is `inferred` or absent. Corrections from thesis editor set `depthSource: 'corrected'`.

2. **Immutable-once-set semantics:** `inferSkillDepth()` only fills values when `depth === undefined`. Works if we accept that schema-populated depths are also protected.

Apply the same pattern to:
- `SkillGroup.calibration` (once set, preserve)
- `MatchingFilter.condition` (once set, preserve)
- `search_vectors[]` user-added entries (tag with provenance)

**Artifact metadata type:**
```typescript
interface ArtifactMetadata {
  createdAt: string
  identityVersion: number
  identityFingerprint?: string
}
```

This type is consumed by `SearchThesis`, `SearchRun`, `ResearchJob`, and future artifact types (cover letters, prep decks) to support staleness detection.

**Staleness detection helpers:**
- `isArtifactStale(artifact, currentIdentityVersion): boolean` — version comparison
- `describeIdentityDiff(fromVersion, toVersion): string[]` — human-readable list of changes for the refresh affordance
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 ProfessionalIdentityV3 has a version: number field (monotonic counter)
- [ ] #2 Identity store bumps version on every mutation (skills, vectors, preferences, roles, profiles)
- [ ] #3 SkillItem has depthSource?: 'inferred' | 'corrected' (or equivalent precedence mechanism)
- [ ] #4 inferSkillDepth() only runs when depth is absent or depthSource is 'inferred'
- [ ] #5 User-corrected calibration, condition, and vector entries are preserved across identity regeneration
- [ ] #6 ArtifactMetadata type is exported and consumable by SearchThesis, SearchRun, ResearchJob
- [ ] #7 Helpers isArtifactStale() and describeIdentityDiff() exist and are unit-tested
- [ ] #8 Schema migration initializes existing identities with version=0 and depthSource='inferred' where depth is already set
- [ ] #9 Existing tests pass; new tests cover precedence rule and version incrementing
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Shipped identity version counter (`model_revision`) and skill depth writeback precedence (`depthSource`) plus artifact staleness helpers.

**Schema changes (additive, backward-compatible):**
- `ProfessionalIdentityV3.model_revision: number` — monotonic content-revision counter that bumps on every mutation. Distinct from `version` (schema major) and `schema_revision` (minor).
- `ProfessionalSkillItem.depthSource?: 'inferred' | 'corrected'` — writeback precedence signal. User corrections are marked 'corrected' and must not be overwritten by regeneration flows that run through AI inference.
- Parser auto-populates `model_revision` (defaults to 0) and back-fills `depthSource='inferred'` on legacy items carrying depth without provenance.
- Normalizer migrates persisted state: injects `model_revision=0` when missing and tags pre-existing depths as 'inferred'.

**Store changes:**
- `advanceModelRevision()` helper: every mutation produces a revision strictly greater than previous. On import/replace, new revision is `max(incoming, previous) + 1` — prevents artifacts from appearing fresh after full replacement that would otherwise reset the counter.
- Threaded through `syncIdentityDocument`, `updateScanIdentity`, `importIdentity`, `applyDraft`.
- `saveSkillEnrichment` marks `depthSource='corrected'` on any user-affirmed depth save.

**New type file `src/types/artifactMeta.ts`:**
- `ArtifactMetadata { createdAt, identityVersion, identityFingerprint? }` — consumed by SearchThesis, SearchRun, ResearchJob, prep decks, cover letters for staleness detection.
- `isArtifactStale(metadata, currentVersion)` — revision comparison.
- `describeIdentityDiff(from, to)` — human-readable delta (MVP; TASK-168 will refine).
- `recordIdentityMetadata(identity, createdAt?)` — snapshot helper.

**Tests added (24):** schema parsing (model_revision parsing/defaults/clamping, depthSource inferred/explicit/rejection), store mutations (bump on update/save/scan, import/applyDraft advancement), artifactMeta helpers.

All 1255 prior-passing tests remain green. The one pre-existing failure in `searchExecutor.test.ts:405` (unrelated error message format mismatch) still fails — not touched.

Commit: 8370681 `feat(identity): add model_revision counter and skill depth writeback precedence`

Shipped on top of three foundational commits that cleared uncommitted prior Done work:
- d605812 TASK-150 (semantic skill depth + calibration + filter conditions)
- a99903f TASK-152 (SearchThesis + enriched SearchResultEntry)
- ad50412 TASK-154 (prep meta-strategy + delivery coaching)
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 All tests pass successfully
- [ ] #4 Automatic formatting was applied.
- [ ] #5 Linters report no WARNINGS or ERRORS
- [ ] #6 The project builds successfully
<!-- DOD:END -->
