---
id: TASK-121.3
title: >-
  Expand pipeline page regression coverage for filters sorting and loading
  states
status: In Progress
assignee:
  - '@codex'
created_date: '2026-04-14 10:54'
updated_date: '2026-05-25 14:33'
labels:
  - pipeline
  - tests
dependencies: []
references:
  - .agents/reviews/test-audit-20260414-064240.md
  - src/test/PipelinePage.test.tsx
  - src/routes/pipeline/PipelinePage.tsx
parent_task_id: TASK-121
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Cover the remaining non-blocking PipelinePage gaps called out by the independent test audit, especially empty state, filters, sorting, multiple entries, and in-flight investigate loading behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 PipelinePage tests cover the empty state and multiple-entry rendering paths.
- [ ] #2 PipelinePage tests cover tier, status, and search filtering plus at least one sort-order assertion.
- [ ] #3 PipelinePage tests cover the in-flight investigate loading/disabled state to guard against duplicate AI calls.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-05-25 Codex starting TASK-121.3. Plan: inspect existing PipelinePage tests and component behavior; add focused regression coverage for empty state, multiple-entry rendering, tier/status/search filtering with a sort-order assertion, and in-flight investigate loading/disabled behavior; keep edits primarily in src/test/PipelinePage.test.tsx unless a real product bug appears; run focused tests, lint, format, typecheck/build, independent test audit, commit with cortex git commit, then close with verification receipts.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 All tests pass successfully
- [ ] #4 Automatic formatting was applied.
- [ ] #5 Linters report no WARNINGS or ERRORS
- [ ] #6 The project builds successfully
<!-- DOD:END -->
