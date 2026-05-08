---
id: TASK-79.2
title: >-
  Broaden hosted workspace store coverage for in-memory, normalization, and
  clone-isolation paths
status: To Do
assignee: []
created_date: '2026-03-14 04:00'
updated_date: '2026-05-08 23:20'
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
- [ ] #1 Add direct regression coverage for createInMemoryHostedWorkspaceStore CRUD behavior and write isolation.
- [ ] #2 Add malformed-directory normalization tests for incomplete actors, invalid memberships/roles, default normalization, and orphaned workspace references.
- [ ] #3 Add clone-isolation regressions for actor/workspace/list reads so mutating returned values cannot corrupt store state.
<!-- AC:END -->

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
