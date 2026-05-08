---
id: TASK-245
title: Build golden E2E fixture coverage
status: To Do
assignee: []
created_date: '2026-05-08 23:27'
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
- [ ] #1 A parent-level golden fixture strategy exists and child tasks cover fixture data, validation, hosted mocks, E2E tests, and optional demo loading.
- [ ] #2 All child tasks keep Pipeline as canonical owner of per-job context and keep candidate-only data sourced from Identity.
- [ ] #3 The milestone can close only after at least one deterministic test proves the golden workspace hydrates and renders across multiple workspaces without live AI.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 Automatic formatting was applied to touched files
- [ ] #4 Regression tests pass (scoped to touched files)
- [ ] #5 Linters report no warnings or errors in touched files
- [ ] #6 Relevant documentation updates landed or tasks created
- [ ] #7 Child tasks are filed with dependencies and references to doc-43.
- [ ] #8 Milestone m-29 exists and groups the work.
<!-- DOD:END -->
