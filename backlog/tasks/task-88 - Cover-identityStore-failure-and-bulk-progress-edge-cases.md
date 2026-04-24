---
id: TASK-88
title: Cover identityStore failure and bulk-progress edge cases
status: To Do
assignee: []
created_date: '2026-04-07 05:00'
labels:
  - scanner
dependencies: []
references:
  - ./.agents/reviews/test-audit-20260407-005817.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Deferred from test audit artifact ./.agents/reviews/test-audit-20260407-005817.md.

High-severity gaps to cover:
- P0-001: assert failScannedBulletDeepen stores lastError
- P0-002: non-existent role/bullet input to completeScannedBulletDeepen
- P1-001: failure-state assertions in isolation
- P1-002: startScanBulkDeepen and updateScanBulkProgress intermediate state
- P1-003: out-of-bounds project updates
- P1-005: mixed multi-bullet count consistency
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 identityStore tests assert failed bullet status, lastError, and failedBullets before any later state overwrite.
- [ ] #2 identityStore tests cover completeScannedBulletDeepen with a missing roleId or bulletId without corrupting existing state.
- [ ] #3 identityStore tests cover running and in-progress bulk state transitions, including currentBulletKey and cancellation requests.
- [ ] #4 identityStore tests cover invalid project indexes and mixed-status multi-bullet count arithmetic.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extend the fixture set to include missing-role/bullet and multi-bullet cases.
2. Add isolated tests for failed bullet state and lastError retention.
3. Add dedicated bulk-progress transition assertions, including running/currentBulletKey/cancelling paths.
4. Add boundary tests for invalid project indexes and mixed-status count arithmetic.
<!-- SECTION:PLAN:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Documentation has been created/modified/removed as needed.
- [ ] #3 Documentation changes were approved by the docs-architect (8/10 score required)
- [ ] #4 Test changes were approved by a test gap analysis review
- [ ] #5 Changes to integration points are covered by tests
- [ ] #6 All tests pass successfully
- [ ] #7 Automatic formatting was applied.
- [ ] #8 Linters report no WARNINGS or ERRORS
- [ ] #9 The project builds successfully
<!-- DOD:END -->
