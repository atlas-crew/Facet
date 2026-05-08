---
id: TASK-123.5
title: 'Expand AppShell coverage for local mode, recovery, and shell state transitions'
status: Done
assignee: []
created_date: '2026-04-14 13:24'
updated_date: '2026-04-14 14:40'
labels:
  - testing
  - workspace-shell
dependencies: []
references:
  - .agents/reviews/test-audit-20260414-092158.md
parent_task_id: TASK-123
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Broaden AppShell regression coverage beyond the TASK-123.1 nav shell slice. Cover local-mode rendering, post-recovery error clearing, bootstrap loading, sync status variants, and additional route/nav shell states called out in the AppShell test audit.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 AppShell tests cover non-hosted local mode without remote bootstrap
- [x] #2 A successful recovery path clears stale error state from the shell
- [x] #3 Bootstrap loading and non-ready sync states are asserted
- [x] #4 Additional route and active-nav shell states are covered or intentionally deferred with notes
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Expanded AppShell regression coverage for self-hosted/local mode, hosted bootstrap loading, successful recovery clearing stale shell errors, sync-state variants, and additional route/active-nav shell states.
Kept the slice test-only so the AppShell implementation stayed stable while the shell behavior audit gaps were addressed.
Verification: npx vitest run src/test/AppShell.test.tsx; npm run typecheck; npx eslint --no-warn-ignored src/test/AppShell.test.tsx; npm run build.
Audit artifact: .agents/reviews/test-audit-20260414-103737.md. Remaining deeper AppShell resilience gaps were intentionally deferred into TASK-124 instead of stretching TASK-123.5 beyond the agreed shell-coverage slice.
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
