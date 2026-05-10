---
id: TASK-79.2
title: >-
  Broaden hosted workspace store coverage for in-memory, normalization, and
  clone-isolation paths
status: In Progress
assignee:
  - '@worker-d'
created_date: '2026-03-14 04:00'
updated_date: '2026-05-10 00:27'
labels:
  - remediation
  - persistence
  - testing
milestone: m-13
dependencies: []
references:
  - .agents/reviews/test-audit-20260313-235218.md
  - proxy/hostedWorkspaceStore.js
  - src/test/hostedWorkspaceStore.test.ts
parent_task_id: TASK-79
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Follow-up from the latest hostedWorkspaceStore audit after TASK-79.1. The critical file-backed hardening gaps were addressed, but the independent audit still surfaced additional coverage depth work around the in-memory store variant, normalization/repair behavior for malformed seed data, and clone-isolation guarantees on returned values.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Add direct regression coverage for createInMemoryHostedWorkspaceStore CRUD behavior and write isolation.
- [x] #2 Add malformed-directory normalization tests for incomplete actors, invalid memberships/roles, default normalization, and orphaned workspace references.
- [x] #3 Add clone-isolation regressions for actor/workspace/list reads so mutating returned values cannot corrupt store state.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inspect hostedWorkspaceStore contracts and existing tests for fixture style and current gaps.
2. Add focused regressions in src/test/hostedWorkspaceStore.test.ts for in-memory CRUD/write isolation, malformed directory normalization, and clone-isolated reads.
3. Run the hosted workspace store test file, targeted lint, diff-check, typecheck/build probes, and the diff-scoped test audit.
4. Update TASK-79.2 acceptance/DoD/final notes and commit the test slice atomically with cortex git commit.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-05-09 Worker D: Added in-memory hosted workspace store coverage in src/test/hostedWorkspaceStore.test.ts for CRUD/write isolation, malformed seed normalization, missing-default repair, orphaned workspace references, and clone-isolated actor/workspace/list reads. Focused tests, touched-file eslint, and diff whitespace check pass. Independent diff test audit passed with no prioritized gaps at .agents/reviews/test-audit-20260509-202556.md. Full typecheck/build are blocked by unrelated hosted billing context test drift in aiAccess/AppShell/hostedAppStore.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented TASK-79.2 as a test-only hosted workspace store slice. Added direct createInMemoryHostedWorkspaceStore regressions for CRUD, caller write isolation, malformed directory normalization, default repair, orphan filtering in lists, and clone-isolated reads. Verification: npm run test -- src/test/hostedWorkspaceStore.test.ts; npx eslint src/test/hostedWorkspaceStore.test.ts; git diff --check -- src/test/hostedWorkspaceStore.test.ts; diff-test-audit clean at .agents/reviews/test-audit-20260509-202556.md. Blocked: npm run typecheck and npm run build fail on unrelated hosted billing context drift outside this worker scope.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Documentation has been created/modified/removed as needed.
- [ ] #3 Documentation changes were approved by the docs-architect (8/10 score required)
- [x] #4 Test changes were approved by a test gap analysis review
- [x] #5 Changes to integration points are covered by tests
- [ ] #6 All tests pass successfully
- [x] #7 Automatic formatting was applied.
- [x] #8 Linters report no WARNINGS or ERRORS
- [ ] #9 The project builds successfully
<!-- DOD:END -->
