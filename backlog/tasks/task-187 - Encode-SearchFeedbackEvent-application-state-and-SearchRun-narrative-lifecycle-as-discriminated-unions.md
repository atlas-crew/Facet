---
id: TASK-187
title: >-
  Encode SearchFeedbackEvent application state and SearchRun narrative lifecycle
  as discriminated unions
status: In Progress
assignee: []
created_date: '2026-04-20 07:07'
updated_date: '2026-05-08 09:10'
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
modified_files:
  - src/utils/searchExecutor.ts
  - src/utils/deepSearchClient.ts
  - src/test/searchExecutor.test.ts
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
- [x] #1 SearchFeedbackEvent uses discriminated union for application state (appliedToIdentity: false | true + required appliedAtVersion)
- [x] #2 Illegal states unrepresentable in type — TypeScript rejects { appliedToIdentity: true } without appliedAtVersion
- [x] #3 SearchRun narrative encoded as tagged lifecycle (pending | generating | failed | ready)
- [x] #4 contractViolations migrates into the failed variant as a required field
- [x] #5 migrateSearchState handles all four legacy shapes (applied-no-version, applied-with-version, narrative-present, violations-present)
- [x] #6 Store mutations (addFeedbackEvent, markFeedbackApplied, addRun, updateRun) produce only valid variants
- [x] #7 workspaceImportMerge mergeFeedbackEventState dispatches on the tag rather than checking optional fields
- [x] #8 searchExecutor normalizeRunNarrative returns the discriminated union instead of separate narrative/violations
- [x] #9 All !== undefined guards on appliedAtVersion and narrative fields removed (type checker does the work)
- [x] #10 Regression tests cover migration of each legacy shape
- [ ] #11 Existing 1324 tests still pass after the refactor
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-187 sub-slice committed scope: SearchFeedbackEvent application state now uses FeedbackApplicationState discriminated union; migrateSearchState drops false+version and coerces true-without-version to pending; workspace import merge now dispatches on appliedToIdentity tag and preserves monotonic applied versions. SearchRun narrative lifecycle remains open.

Second TASK-187 sub-slice: normalizeRunNarrative now returns a tagged ready/failed result with contractViolations instead of the old narrative?/violations pair; deep search hydration consumes the tag while preserving existing SearchRun persistence fields for a later lifecycle slice. Verification: focused normalizeRunNarrative/deepSearchClient Vitest passed; scoped ESLint passed; npm run typecheck passed; npm run build passed with existing large chunk warnings.

Final lifecycle slice: SearchRun now persists narrativeState as pending/generating/failed/ready instead of loose narrative/contractViolations fields. hydrateRun migrates legacy ready narratives, failed validation payloads, pending no-narrative records, and existing tagged states; deep research hydration writes ready/failed narrative states; ResearchPage renders narrative and output warnings through the tag. Verification: npx vitest run src/test/searchStore.test.ts passed 38/38; deepSearchClient passed 15/15; normalizeRunNarrative focused tests passed 14; ResearchPage focused narrative/job tests passed; persistence activeResearchJob focused test passed; workspaceBackup research/feedback focused tests passed; scoped ESLint passed; npm run typecheck passed; npm run build passed with existing chunk warnings. Did not check AC #11 because the full suite was not run; an unrelated router-harness failure remains in searchRedesignRoundTrip when run directly.

Full-suite attempt after formatting did not pass, so AC #11 / DoD #3 remain open. One lifecycle-related ResearchPage assumptions fixture was fixed after the run in commit test(search): use narrative lifecycle in assumptions test and passed focused verification; remaining failures were outside the TASK-187 narrative lifecycle files (PrepPage behavior, facetServer persistence API, jdAnalysis soft-delete expectation, searchRedesignRoundTrip router harness). Formatting was applied to touched files via npm run format:files and committed separately.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [ ] #3 All tests pass successfully
- [x] #4 Automatic formatting was applied.
- [x] #5 Linters report no WARNINGS or ERRORS
- [x] #6 The project builds successfully
<!-- DOD:END -->
