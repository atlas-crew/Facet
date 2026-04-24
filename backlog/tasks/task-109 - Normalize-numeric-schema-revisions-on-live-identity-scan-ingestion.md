---
id: TASK-109
title: Normalize numeric schema revisions on live identity scan ingestion
status: Done
assignee: []
created_date: '2026-04-12 06:11'
updated_date: '2026-04-12 06:19'
labels:
  - bug
  - identity
  - frontend
dependencies: []
references:
  - ./src/store/identityStore.ts
  - ./src/identity/schema.ts
  - ./src/test/identityStore.test.ts
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Patch the remaining live identity path that still accepts a numeric schema_revision into state, so deepening and validation no longer fail with "schema_revision must be a string."
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Live scan ingestion normalizes schema_revision 3.1 into the canonical string before storing scanResult identity state.
- [x] #2 The affected regression path is covered by an automated test.
- [x] #3 Identity validation and deepening code paths no longer fail when an incoming scan identity carries numeric schema_revision 3.1.
- [x] #4 npm run typecheck and the relevant targeted tests pass.
- [x] #5 npm run build passes for the slice.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Normalize incoming scanResult.identity through normalizeRuntimeIdentitySchemaRevision inside setScanResult before recalculating progress or counts. 2. Add a store-level regression test that injects a scan result with schema_revision 3.1 as a number and asserts the stored scan identity is canonicalized to "3.1". 3. Run targeted identity store tests plus typecheck/build, then capture any remaining lint debt separately if it is unrelated to the touched lines.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Patched identityStore.setScanResult to normalize incoming scanResult.identity through normalizeRuntimeIdentitySchemaRevision before progress/count recalculation or draft document formatting.

Tightened normalizeRuntimeIdentitySchemaRevision in schema.ts so callers retain type context and documented the intentional runtime repair cast.

Added a regression test that injects a live scan result with numeric schema_revision 3.1, asserts the stored scan identity is canonicalized to "3.1", and verifies parseDeepenIdentityBulletResponse no longer throws against the stored identity.

Independent review artifacts: .agents/reviews/review-20260412-021643.md and .agents/reviews/test-audit-20260412-021245.md.

Verification: npx vitest run src/test/identityStore.test.ts; npm run typecheck; npm run build; npx eslint --no-warn-ignored src/identity/schema.ts src/store/identityStore.ts src/test/identityStore.test.ts; npm run test.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Normalized live scan ingestion so numeric schema_revision values are canonicalized before scan identities enter store state, preventing downstream validation and bullet-deepening failures that still surfaced "schema_revision must be a string." Added a store-level regression that exercises the live setter and the deepening parser against the normalized scan identity. Verified with targeted identityStore Vitest, typecheck, build, ESLint on the touched files, and a passing full npm run test. Committed as d176c59.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [x] #3 All tests pass successfully
- [x] #4 Automatic formatting was applied.
- [x] #5 Linters report no WARNINGS or ERRORS
- [x] #6 The project builds successfully
<!-- DOD:END -->
