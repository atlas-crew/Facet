---
id: TASK-48
title: 'Pipeline: replace window.alert import/errors with in-app notices'
status: In Progress
assignee:
  - '@codex'
created_date: '2026-03-10 03:54'
updated_date: '2026-05-27 20:54'
labels:
  - remediation
  - pipeline
  - ux
milestone: m-4
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`src/routes/pipeline/PipelinePage.tsx` uses `window.alert` for import errors and summaries. Replace with the app’s notice/toast/status patterns for a consistent, non-jarring UX.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Pipeline import success/error messaging uses in-app notice UI (no `window.alert`).
- [ ] #2 Error messages include actionable details (skipped count, validation summary).
- [ ] #3 Behavior parity: import still works for both JSON and legacy localStorage path.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-05-27 Codex starting TASK-48 as part of m-4 completion push. Plan: inspect Pipeline import flows and existing notice/status patterns, replace window.alert success/error paths with in-app messaging, preserve JSON and legacy import behavior, add regression tests, run review/audit gates, and commit atomically.
<!-- SECTION:NOTES:END -->

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
