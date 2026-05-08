---
id: TASK-110
title: Harden remaining identity schema revision normalization paths
status: Done
assignee: []
created_date: '2026-04-12 07:03'
updated_date: '2026-04-12 07:59'
labels:
  - bug
  - identity
  - frontend
dependencies: []
references:
  - ./src/store/identityStore.ts
  - ./src/identity/schema.ts
  - ./src/test/identityStore.test.ts
  - ./src/test/IdentityPage.test.tsx
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Trace and patch the remaining path(s) where numeric schema_revision values can still reach runtime identity state and trigger deepening or validation failures.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 All store entry points that accept identity objects normalize schema_revision 3.1 into the canonical string before storing runtime state.
- [x] #2 A regression test covers the remaining failing path that previously surfaced schema_revision must be a string.
- [x] #3 Deepening and validation flows no longer fail when stale numeric schema_revision values re-enter via draft or current identity state.
- [x] #4 Relevant targeted tests, typecheck, and build pass for the slice.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Patched remaining runtime schema-revision hardening in three places: added a shared normalizeRuntimeProfessionalIdentity helper in schema.ts, routed identityStore scan/draft/current identity writes through it, and normalized deepenIdentityBullet requests before prompt construction and response validation. Added regressions covering stale scanResult edits, direct setDraft ingestion, stale currentIdentity mutation, and deepen request prompt normalization against numeric schema_revision values.

Verification: npx vitest run src/test/identityStore.test.ts src/test/identityExtraction.test.ts; npm run typecheck; npx eslint --no-warn-ignored src/identity/schema.ts src/store/identityStore.ts src/utils/identityExtraction.ts src/test/identityStore.test.ts src/test/identityExtraction.test.ts; npm run build.

Independent review artifacts: .agents/reviews/review-20260412-030849.md, .agents/reviews/review-20260412-031123.md, and .agents/reviews/test-audit-20260412-031424.md.

Follow-up hardening: persisted version-4 snapshots were still bypassing normalization on same-version rehydrate because Zustand persist.migrate only runs on version changes. Added merge-path normalization for currentIdentity, draft.identity, and scanResult.identity so stale numeric schema_revision values are repaired even when browser storage is already at the current version.

Additional hardening for the scanned editor path: stale in-memory scan identities could still survive into bullet-specific edit/deepen handlers if the tab had not rehydrated cleanly. Normalized the scanned bullet text/list/metrics mutation handlers and completeScannedBulletDeepen so the scan identity self-heals during the exact scanned-bullet deepen flow.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Closed the remaining schema_revision failure by hardening all whole-identity runtime boundaries and the deepen request path. Runtime identity normalization now flows through a shared ProfessionalIdentity helper, stale scan/draft/current identity state is repaired before reuse, and regressions cover the exact stale-runtime cases that could still surface 'schema_revision must be a string.'

Follow-up patch added same-version persist merge normalization in identityStore so existing browser snapshots with numeric schema_revision values are repaired during rehydrate, not only during versioned migration.

Verification for the follow-up patch: npx vitest run src/test/identityStore.test.ts, npm run typecheck, npx eslint --no-warn-ignored src/store/identityStore.ts src/test/identityStore.test.ts, npm run build.

Additional follow-up hardening normalized scanned bullet mutation and deepen-completion handlers so stale in-memory scan identities also repair themselves during bullet-specific deepen/edit actions.
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
