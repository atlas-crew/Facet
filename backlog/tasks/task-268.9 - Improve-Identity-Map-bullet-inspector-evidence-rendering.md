---
id: TASK-268.9
title: Improve Identity Map bullet inspector evidence rendering
status: To Do
assignee: []
created_date: '2026-05-31 20:48'
updated_date: '2026-06-07 02:44'
labels:
  - bug
  - identity
  - ux
milestone: m-35
dependencies: []
references:
  - TODO.md
modified_files:
  - src/routes/identity/inspectorSlots/BulletInspector.tsx
  - src/routes/identity/ScanReviewPane.tsx
  - src/test/BulletInspector.sheet.test.tsx
parent_task_id: TASK-268
priority: medium
ordinal: 25000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TODO reports that the Identity Map right rail formats bullets poorly: bullets are not rendered as bullets, metrics need formatting, technologies are not shown, and assumptions from the original import workspace are not surfaced. Current BulletInspector shows problem/action/outcome pairs plus impact/metrics as joined text, but does not render technologies or assumptions in read mode.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 BulletInspector read mode renders bullet decomposition in a readable list/section layout instead of dense joined text.
- [ ] #2 Metrics render as key/value rows with human-readable labels and values.
- [ ] #3 Technologies and tags are visible in read mode.
- [ ] #4 Assumptions/warnings imported or produced by deepening are surfaced with confidence labels, matching the scan review semantics where possible.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Compare ScanReviewPane bullet evidence rendering against BulletInspector read mode.
2. Add a reusable formatting helper or local rendering that handles impact, metrics, technologies, tags, and assumptions.
3. Preserve existing edit sheets/actions.
4. Add focused BulletInspector tests for technologies, metrics formatting, and assumptions visibility.
<!-- SECTION:PLAN:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 Automatic formatting was applied to touched files
- [ ] #4 Regression tests pass (scoped to touched files)
- [ ] #5 Linters report no warnings or errors in touched files
- [ ] #6 Relevant documentation updates landed or tasks created
<!-- DOD:END -->
