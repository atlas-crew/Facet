---
id: TASK-245.6
title: Document golden fixture usage and maintenance
status: In Progress
assignee:
  - '@codex'
created_date: '2026-05-08 23:28'
updated_date: '2026-05-09 04:48'
labels:
  - documentation
milestone: m-29
dependencies:
  - TASK-245.2
documentation:
  - backlog/docs/doc-43 - Golden-E2E-Fixture-Coverage-Plan.md
modified_files:
  - docs/development/sample-data-and-fixtures.md
parent_task_id: TASK-245
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update developer documentation so future agents know when to use route-local samples, persona fixtures, the golden workspace fixture, and hosted Playwright mocks.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Sample-data docs explain the golden workspace fixture lane separately from in-app samples, dev-only source samples, and small unit fixtures.
- [ ] #2 Docs include commands for validating the golden fixture and hosted mock path.
- [ ] #3 Docs spell out the maintenance rule: update the golden fixture when cross-workspace contracts change, but keep unit fixtures minimal.
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
