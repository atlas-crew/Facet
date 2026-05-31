---
id: TASK-268.6
title: Explain Identity fill-strength indicators with targeted advice chips
status: To Do
assignee: []
created_date: '2026-05-31 20:48'
labels:
  - feature
  - identity
  - ux
dependencies: []
references:
  - TODO.md
modified_files:
  - src/routes/identity/IdentityBand.tsx
  - src/utils/identityFillStrength.ts
parent_task_id: TASK-268
priority: low
ordinal: 22000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TODO requests help chips beside indicators such as Strong, Sparse, Thin, Messy, Solid, and Empty. The chip should explain what the meter is measuring and offer targeted advice for that Identity section.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Each Identity band fill indicator has an accessible help affordance.
- [ ] #2 Help copy explains the local heuristic for that band and gives targeted next actions.
- [ ] #3 Warnings like Messy/Sparse/Thin tell the user what to correct, not only that quality is low.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extend fill-strength metadata or add a helper that maps band + label to concise advice.
2. Add an accessible tooltip/popover/chip next to the fill bar using existing visual conventions.
3. Cover at least one warning and one healthy state in component tests.
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
