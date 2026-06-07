---
id: TASK-271
title: Propagate workspace clear to cross-tab match state
status: To Do
assignee: []
created_date: '2026-06-01 14:39'
updated_date: '2026-06-07 02:44'
labels:
  - bug
  - remediation
milestone: m-36
dependencies: []
modified_files:
  - src/persistence/runtime.ts
  - src/store/matchStore.ts
  - src/test/persistenceRuntime.test.ts
priority: medium
ordinal: 27000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Deferred from the clear-workspace review after aaa66c6. clearWorkspace resets the local tab's facet-match-workspace state, but matchStore is persisted separately from the durable workspace snapshot and other tabs only receive the workspace-saved broadcast. That means another tab can reload empty workspace artifacts while still showing the previous job description, analysis, and report. Decide whether match state should be cross-tab workspace-scoped or explicitly per-tab, then implement the chosen behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Cross-tab clear behavior for matchStore is explicitly defined in code comments or docs as workspace-scoped or per-tab.
- [ ] #2 If workspace-scoped, workspace clear broadcasts or otherwise triggers matchStore reset in other tabs.
- [ ] #3 Regression coverage proves a clear in one tab does not leave stale match report state in the expected target scope.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Trace workspace sync broadcast handling and matchStore persistence behavior.\n2. Choose scoped reset behavior consistent with the user-facing clear-workspace promise.\n3. Add a clear-specific sync message or documented per-tab boundary.\n4. Cover the chosen behavior with persistence/runtime or storage-event tests.
<!-- SECTION:PLAN:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 Automatic formatting was applied to touched files
- [ ] #4 Regression tests pass (scoped to touched files)
- [ ] #5 Linters report no warnings or errors in touched files
- [ ] #6 Relevant documentation updates landed or tasks created
<!-- DOD:END -->
