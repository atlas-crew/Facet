---
id: TASK-94
title: Polish Wave 1 readiness gate template portability and command stability
status: To Do
assignee: []
created_date: '2026-04-08 06:54'
updated_date: '2026-04-08 09:52'
labels:
  - documentation
dependencies: []
references:
  - /Users/nick/Developer/Facet/.agents/reviews/review-20260408-025234.md
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Deferred from review artifact /Users/nick/Developer/Facet/.agents/reviews/review-20260408-025234.md. The current readiness gate content is accurate, but the reviewer flagged maintainability follow-ups: markdown portability of multi-line table cells, a note about the template field-name migration, and the long manual Vitest command used as a local receipt.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Reduce portability risk in the decision-log blocker formatting without losing scanability.
- [ ] #2 Document or normalize the readiness gate template field migration so future validators are not confused by older snapshots.
- [ ] #3 Replace the long manual Wave 1 Vitest receipt command with a stable script or alias if that path remains part of local validation.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Decide whether the readiness gate is GFM-only or should stay renderer-agnostic.
2. If portability matters, replace the current multi-line blocker formatting with a more portable representation.
3. Add a stable scripted Wave 1 validation command or explicitly document why the manual command remains acceptable.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-04-08: Follow-on readiness-gate review /Users/nick/Developer/Facet/.agents/reviews/review-20260408-054907.md flagged one deferred evidence-quality item: operator-reported validations should eventually link to a traceable artifact instead of only naming the release thread.

2026-04-08: Additional deferred readiness-gate review /Users/nick/Developer/Facet/.agents/reviews/review-20260408-055106.md noted that operator-reported validations should eventually point at a durable reference, and that template guidance could be made more visually prominent.
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
