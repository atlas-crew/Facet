---
id: TASK-245.3
title: Use golden workspace in hosted Playwright fixtures
status: To Do
assignee: []
created_date: '2026-05-08 23:27'
labels:
  - feature
milestone: m-29
dependencies:
  - TASK-245.2
documentation:
  - backlog/docs/doc-43 - Golden-E2E-Fixture-Coverage-Plan.md
modified_files:
  - tests/hosted/fixtures.ts
parent_task_id: TASK-245
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Teach hosted API mocks to serve the golden workspace fixture when tests need realistic cross-workspace data, while preserving the minimal empty snapshot path for persistence edge cases.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Hosted mock helpers can opt into the golden workspace snapshot without changing existing minimal-snapshot tests.
- [ ] #2 At least one hosted Playwright test hydrates the golden workspace and verifies representative data renders after account/workspace bootstrap.
- [ ] #3 The fixture remains deterministic and does not require live AI, network calls, or real personal data.
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
