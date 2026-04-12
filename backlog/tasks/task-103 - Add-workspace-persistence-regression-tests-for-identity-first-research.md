---
id: TASK-103
title: Add workspace persistence regression tests for identity-first research
status: To Do
assignee: []
created_date: '2026-04-12 01:37'
labels:
  - tests
  - persistence
  - research
dependencies: []
references:
  - src/persistence/hydration.ts
  - src/persistence/snapshot.ts
  - src/persistence/workspaceImportMerge.ts
  - .agents/reviews/test-audit-20260411-213121.md
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add focused tests for snapshot creation, hydration, and workspace import merge so identity-sourced research profiles stay non-durable and workspace import paths preserve data correctly.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Snapshot tests verify identity-sourced research profiles are stripped from persisted workspace data.
- [ ] #2 Hydration tests verify workspace snapshot application, local preference hydration, and legacy storage migration behavior.
- [ ] #3 Workspace import merge tests cover nested prep/cover-letter merges and identity-sourced research profile stripping.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 All tests pass successfully
- [ ] #4 Automatic formatting was applied.
- [ ] #5 Linters report no WARNINGS or ERRORS
- [ ] #6 The project builds successfully
<!-- DOD:END -->
