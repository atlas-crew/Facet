---
id: TASK-245
title: Build golden E2E fixture coverage
status: In Progress
assignee:
  - '@codex'
created_date: '2026-05-08 23:27'
updated_date: '2026-05-09 00:05'
labels:
  - feature
milestone: m-29
dependencies: []
documentation:
  - backlog/docs/doc-43 - Golden-E2E-Fixture-Coverage-Plan.md
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Parent task for milestone m-29. Deliver one coherent, fictional golden workspace fixture that lets Facet test cross-workspace behavior end-to-end instead of stitching together route-local samples. Maya Patel is the seed persona unless the implementation discovers a better fit.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A parent-level golden fixture strategy exists and child tasks cover fixture data, validation, hosted mocks, E2E tests, and optional demo loading.
- [x] #2 All child tasks keep Pipeline as canonical owner of per-job context and keep candidate-only data sourced from Identity.
- [ ] #3 The milestone can close only after at least one deterministic test proves the golden workspace hydrates and renders across multiple workspaces without live AI.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Started TASK-245 by taking the first executable slice, TASK-245.1. Parallel exploration is covering Maya fixture/validator shape, downstream artifact type fixtures, and workspace snapshot/hosted hydration paths.

Completed first child slice TASK-245.1 and committed code as 65a4da7 (feat(fixtures): add Maya golden artifact graph). Next executable child is TASK-245.2: build the golden workspace snapshot composer that consumes Maya's new artifact graph.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 Automatic formatting was applied to touched files
- [ ] #4 Regression tests pass (scoped to touched files)
- [ ] #5 Linters report no warnings or errors in touched files
- [x] #6 Relevant documentation updates landed or tasks created
- [x] #7 Child tasks are filed with dependencies and references to doc-43.
- [x] #8 Milestone m-29 exists and groups the work.
<!-- DOD:END -->
