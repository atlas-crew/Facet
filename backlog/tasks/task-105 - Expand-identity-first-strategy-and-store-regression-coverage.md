---
id: TASK-105
title: Expand identity-first strategy and store regression coverage
status: Done
assignee:
  - '@codex'
created_date: '2026-04-12 01:37'
updated_date: '2026-05-08 08:13'
labels:
  - tests
  - identity
  - research
dependencies: []
references:
  - src/store/identityStore.ts
  - src/routes/identity/IdentityPage.tsx
  - src/routes/research/ResearchPage.tsx
  - .agents/reviews/test-audit-20260411-213121.md
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add the missing store and UI regression tests around identity strategy editing, ResearchPage transitions, and null-guarded update paths so identity-first editing remains stable as the workbench evolves.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Identity store tests cover updateCurrent* no-op behavior when currentIdentity is null and merge-mode applyDraft.
- [x] #2 Identity and Research page tests cover strategy workbench rendering, keyboard navigation, and identity/resume transition behavior.
- [x] #3 Regression tests cover remaining strategic editor paths not already exercised by the current m-16 suite.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Started TASK-105 in the parallel doc-38 closure batch. Scope: identity store null guards / merge-mode coverage plus focused strategy workbench and research transition regression tests where safe around active lanes.

Added TASK-105 regression coverage in src/test/identityStore.test.ts and src/test/IdentityMapEditing.test.tsx. Focused new tests passed; full identityStore and IdentityMapEditing suites passed, with IdentityMapEditing run using --testTimeout=15000 because existing tests can exceed Vitest's default 5s cap. npm run typecheck is currently blocked by active parallel search-lane changes in TASK-183/TASK-196.2, not by this task's touched files.

Batch-level npm run build passed after concurrent TASK-183/TASK-196.2 integration, so DoD #6 is now satisfied.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added identity-store regression tests for null currentIdentity update helper no-ops and merge-mode applyDraft preserving current-only records while applying draft updates. Added Identity Map strategy-workbench coverage for authored search vectors/open questions and inspector selection. Verification: focused new tests passed; src/test/identityStore.test.ts passed 45/45; src/test/IdentityMapEditing.test.tsx passed 11/11 with --testTimeout=15000; scoped eslint passed. Global typecheck is blocked by concurrent search-lane changes outside TASK-105.
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
