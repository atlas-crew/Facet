---
id: TASK-79.1
title: Expand hosted workspace store edge-case and concurrency coverage
status: Done
assignee:
  - '@codex'
created_date: '2026-03-14 02:23'
updated_date: '2026-03-14 04:00'
labels:
  - remediation
  - persistence
  - testing
dependencies: []
references:
  - .agents/reviews/test-audit-20260313-222207.md
  - src/test/hostedWorkspaceStore.test.ts
  - proxy/hostedWorkspaceStore.js
parent_task_id: TASK-79
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Independent test audit after TASK-79 still flagged follow-up coverage gaps around the file-backed hosted workspace store. Capture the remaining store-hardening work explicitly instead of hiding it under the main delivery task.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Verify multi-actor and cross-tenant isolation in hostedWorkspaceStore tests.
- [x] #2 Cover saveWorkspace edge cases such as stale revisions, repeated saves, and invalid timestamps or names.
- [x] #3 Exercise concurrent file-write behavior or document/guard the unsupported concurrency model.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add multi-actor fixtures and cross-tenant access assertions for hostedWorkspaceStore.
2. Add edge-case save/create tests for idempotency, stale revisions, and invalid inputs.
3. Decide whether concurrent writes are supported; either add a race test and fix issues or document a clear limitation with guardrails.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented hosted workspace store hardening beyond the initial file-backed durability slice. Added same-process file-write serialization with atomic temp-file rename writes, stricter direct-store validation for workspace ids/names/timestamps/revisions, conflict rejection for same-revision divergent saves, and stronger in-queue authorization checks for save/rename/delete. Expanded regression coverage across multi-actor isolation, same-id cross-tenant safety, invalid ids and timestamps, stale/conflicting revisions, idempotent saves, owner-only rename/delete, default-name/id generation, and concurrent multi-instance writes.
Verification: npm run test -- src/test/hostedWorkspaceStore.test.ts src/test/facetServer.test.ts; npm run typecheck; npx eslint proxy/hostedWorkspaceStore.js src/test/hostedWorkspaceStore.test.ts; git diff --check.
Review artifacts: .agents/reviews/review-20260313-235530.md surfaced additional store-boundary findings that were remediated in the final diff. Latest test audit (.agents/reviews/test-audit-20260313-235218.md) still recommends additional depth coverage on in-memory/normalization/clone-isolation paths, captured as a new follow-up task rather than blocking this slice.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Hardened the hosted workspace store with atomic file-backed writes, queued same-process mutation serialization, stricter store-boundary validation and conflict checks, plus broader regression coverage for multi-actor isolation, workspace CRUD edge cases, and concurrent file-backed writes. Captured remaining audit-only depth work in a follow-up task so TASK-79/TASK-79.1 can stop blocking the next hosted Wave 1 slice.
<!-- SECTION:FINAL_SUMMARY:END -->

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
