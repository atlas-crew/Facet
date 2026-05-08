---
id: TASK-245.2
title: Build golden workspace snapshot composer
status: To Do
assignee: []
created_date: '2026-05-08 23:27'
labels:
  - feature
milestone: m-29
dependencies:
  - TASK-245.1
documentation:
  - backlog/docs/doc-43 - Golden-E2E-Fixture-Coverage-Plan.md
modified_files:
  - src/test/fixtures/workspaceSnapshot.ts
parent_task_id: TASK-245
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create a reusable builder that composes the Maya golden artifacts into a workspace/snapshot-shaped fixture for Vitest and hosted Playwright tests. Keep Identity hydration explicit if Identity remains outside FacetWorkspaceSnapshot.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A builder such as buildMayaPatelGoldenWorkspace() or buildGoldenWorkspaceSnapshot() returns a complete reusable fixture without mutating shared singleton data.
- [ ] #2 The builder includes all persisted workspace artifacts plus an explicit Identity hydration payload or helper.
- [ ] #3 A focused round-trip test proves the golden workspace validates, hydrates, and re-exports without dropping required artifacts.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 Automatic formatting was applied to touched files
- [ ] #4 Regression tests pass (scoped to touched files)
- [ ] #5 Linters report no warnings or errors in touched files
- [ ] #6 Relevant documentation updates landed or tasks created
<!-- DOD:END -->
