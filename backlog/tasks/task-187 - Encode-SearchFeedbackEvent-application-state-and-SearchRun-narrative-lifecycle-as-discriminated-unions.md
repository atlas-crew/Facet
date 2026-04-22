---
id: TASK-187
title: >-
  Encode SearchFeedbackEvent application state and SearchRun narrative lifecycle
  as discriminated unions
status: To Do
assignee: []
created_date: '2026-04-20 07:07'
labels:
  - search-redesign
  - types
  - refactor
  - 'origin:ai-review'
milestone: m-20
dependencies:
  - TASK-160
  - TASK-163
references:
  - src/types/search.ts
  - src/store/searchStore.ts
  - src/utils/searchExecutor.ts
  - src/persistence/workspaceImportMerge.ts
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Follow-up from the post-TASK-163 multi-specialist review (typescript-pro + code-reviewer both flagged this independently).

Two adjacent type-design weaknesses share a common fix: replace optional-field coupling with explicit discriminated unions so the invariants are type-checked rather than runtime-checked.

**1. SearchFeedbackEvent application state**

Current shape permits 3 illegal configurations:
```ts
appliedToIdentity: boolean
appliedAtVersion?: number
```

- `{ appliedToIdentity: true, appliedAtVersion: undefined }` — applied but no version recorded
- `{ appliedToIdentity: false, appliedAtVersion: 5 }` — not applied but has a version
- `{ appliedToIdentity: true, appliedAtVersion: 5 }` — valid

Collapse to:
```ts
type FeedbackApplicationState =
  | { readonly appliedToIdentity: false }
  | { readonly appliedToIdentity: true; readonly appliedAtVersion: number }
```

Intersect into SearchFeedbackEvent. This removes `!== undefined` guards at every call site in searchStore.ts (markFeedbackApplied), workspaceImportMerge.ts (mergeFeedbackEventState), and any consumer that reads the field. The two-state encoding also pairs naturally with TASK-186's updatedAt timestamp (applied state gets updatedAt; pending state doesn't).

**2. SearchRun narrative lifecycle**

All narrative fields on SearchRun are currently optional strings. This conflates four distinct states:

- not yet generated (pending)
- generation in flight (generating)
- generation failed validation (failed + contractViolations)
- generated successfully (ready)

Replace the loose optional fields with a tagged lifecycle:
```ts
type SearchRunNarrativeState =
  | { status: 'pending' }
  | { status: 'generating' }
  | { status: 'failed'; error: string; contractViolations: readonly string[] }
  | { status: 'ready'; narrative: SearchRunNarrative }
```

The `contractViolations` array that's currently optional on SearchRun migrates into the `'failed'` variant where it's mandatory — matching the executor's actual invariant ("violations only exist when normalization failed").

**Migration**

Both changes break persisted snapshots. Extend `migrateSearchState` to:
- Legacy event with `appliedToIdentity: false` → drop `appliedAtVersion` if present
- Legacy event with `appliedToIdentity: true` + missing `appliedAtVersion` → coerce to `false` (safest — forces re-application rather than fabricating a version)
- Legacy run with `narrative` fields present → wrap in `{ status: 'ready', narrative: {...} }`
- Legacy run with `contractViolations` present → wrap in `{ status: 'failed', error: 'migrated', contractViolations: [...] }`
- Legacy run with neither → `{ status: 'pending' }`

**Scope**

Touches:
- `src/types/search.ts` — new union types
- `src/store/searchStore.ts` — mutation sites (addFeedbackEvent, markFeedbackApplied, addRun, updateRun), migrateSearchState
- `src/persistence/workspaceImportMerge.ts` — merge logic keyed off the tag rather than the optional field
- `src/utils/searchExecutor.ts` — normalizeRunNarrative returns the union instead of a `{ narrative?, violations[] }` pair
- Tests: searchStore.test.ts, workspaceBackup.test.ts, searchExecutor.test.ts, professionalIdentity.test.ts (if any cross-refs)

Coordinate with TASK-186 — if both land, prefer shipping 186 first (smaller scope) so 187 can assume the updatedAt field exists on the applied variant.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 SearchFeedbackEvent uses discriminated union for application state (appliedToIdentity: false | true + required appliedAtVersion)
- [ ] #2 Illegal states unrepresentable in type — TypeScript rejects { appliedToIdentity: true } without appliedAtVersion
- [ ] #3 SearchRun narrative encoded as tagged lifecycle (pending | generating | failed | ready)
- [ ] #4 contractViolations migrates into the failed variant as a required field
- [ ] #5 migrateSearchState handles all four legacy shapes (applied-no-version, applied-with-version, narrative-present, violations-present)
- [ ] #6 Store mutations (addFeedbackEvent, markFeedbackApplied, addRun, updateRun) produce only valid variants
- [ ] #7 workspaceImportMerge mergeFeedbackEventState dispatches on the tag rather than checking optional fields
- [ ] #8 searchExecutor normalizeRunNarrative returns the discriminated union instead of separate narrative/violations
- [ ] #9 All !== undefined guards on appliedAtVersion and narrative fields removed (type checker does the work)
- [ ] #10 Regression tests cover migration of each legacy shape
- [ ] #11 Existing 1324 tests still pass after the refactor
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 All tests pass successfully
- [ ] #4 Automatic formatting was applied.
- [ ] #5 Linters report no WARNINGS or ERRORS
- [ ] #6 The project builds successfully
<!-- DOD:END -->
