---
id: TASK-103
title: Add workspace persistence regression tests for identity-first research
status: Done
assignee:
  - '@codex'
created_date: '2026-04-12 01:37'
updated_date: '2026-05-08 05:11'
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
- [x] #1 Snapshot tests verify identity-sourced research profiles are stripped from persisted workspace data.
- [x] #2 Hydration tests verify workspace snapshot application, local preference hydration, and legacy storage migration behavior.
- [x] #3 Workspace import merge tests cover nested prep/cover-letter merges and identity-sourced research profile stripping.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Add focused persistence regression coverage for identity-sourced research profile stripping across snapshot creation, hydration/local preference preservation, legacy hydration, and workspace import merge; run targeted persistence/workspace backup tests plus typecheck/lint/build; close and commit TASK-103 files only.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added focused regression coverage for identity-first research persistence. Snapshot creation now verifies identity-sourced research profiles are stripped from durable workspace data; workspace and legacy hydration verify identity-sourced profiles hydrate as null while preserving local/session data; workspace import merge now explicitly covers stripping identity-sourced research profiles alongside existing nested prep/cover-letter merge coverage.

Verification:
- npx vitest run src/test/persistence.test.ts src/test/workspaceBackup.test.ts (pass: 64 tests)
- npm run format:files -- src/test/persistence.test.ts src/test/workspaceBackup.test.ts "backlog/tasks/task-103 - Add-workspace-persistence-regression-tests-for-identity-first-research.md" (pass)
- npx eslint src/test/persistence.test.ts src/test/workspaceBackup.test.ts (pass)
- npm run typecheck (pass)
- npm run build (pass; existing large chunk warnings)
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
