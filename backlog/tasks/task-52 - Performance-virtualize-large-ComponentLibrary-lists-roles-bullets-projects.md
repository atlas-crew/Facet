---
id: TASK-52
title: 'Performance: virtualize large ComponentLibrary lists (roles/bullets/projects)'
status: In Progress
assignee:
  - '@codex'
created_date: '2026-03-10 03:54'
updated_date: '2026-05-28 14:20'
labels:
  - performance
milestone: m-1
dependencies:
  - TASK-1
  - TASK-2
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
For large resumes, rendering every card/bullet can be slow. Introduce list virtualization for the largest sections while preserving DnD and keyboard navigation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Roles/bullets (and at least one other large section) are virtualized to reduce DOM/render cost.
- [ ] #2 Drag-and-drop still works correctly; keyboard access remains intact.
- [ ] #3 No visual regressions in normal-sized datasets.
- [ ] #4 Verification commands pass.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Codex starting TASK-52. Plan: add an internal measured virtual-list primitive that falls back to the existing DOM for normal-sized lists; apply it to ComponentLibrary roles, per-role bullets, and projects above conservative thresholds so DnD/keyboard affordances remain intact for rendered items; add focused regression tests for normal-list parity and large-list DOM reduction; run independent review/audit plus lint/test/build; commit via cortex.
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
