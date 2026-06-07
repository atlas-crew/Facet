---
id: TASK-268.6
title: Explain Identity fill-strength indicators with targeted advice chips
status: Done
assignee: []
created_date: '2026-05-31 20:48'
updated_date: '2026-06-07 07:05'
labels:
  - feature
  - identity
  - ux
milestone: m-35
dependencies: []
references:
  - TODO.md
modified_files:
  - src/utils/identityFillStrength.ts
  - src/routes/identity/IdentityBand.tsx
  - src/components/FillBar.tsx
  - src/test/identityFillStrength.test.ts
  - src/test/IdentityBand.test.tsx
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
- [x] #1 Each Identity band fill indicator has an accessible help affordance.
- [x] #2 Help copy explains the local heuristic for that band and gives targeted next actions.
- [x] #3 Warnings like Messy/Sparse/Thin tell the user what to correct, not only that quality is low.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extend fill-strength metadata or add a helper that maps band + label to concise advice.
2. Add an accessible tooltip/popover/chip next to the fill bar using existing visual conventions.
3. Cover at least one warning and one healthy state in component tests.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added accessible fill-strength help affordances to Identity band meters. Help copy is derived per band and meter label, explains each local heuristic, and gives corrective next actions for weak states like Messy, Sparse, Thin, Draft, and Empty. FillBar progressbars now have accessible labels, and focused tests cover helper copy, warning and healthy states, fallback behavior, and the rendered HelpHint affordance. Verification: npx vitest run src/test/identityFillStrength.test.ts src/test/IdentityBand.test.tsx; npx eslint src/utils/identityFillStrength.ts src/routes/identity/IdentityBand.tsx src/components/FillBar.tsx src/test/identityFillStrength.test.ts src/test/IdentityBand.test.tsx; npm run typecheck; agent-loop source review PASS WITH ISSUES no P0/P1; diff test audit no P0/P1.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [x] #3 Automatic formatting was applied to touched files
- [x] #4 Regression tests pass (scoped to touched files)
- [x] #5 Linters report no warnings or errors in touched files
- [x] #6 Relevant documentation updates landed or tasks created
<!-- DOD:END -->
