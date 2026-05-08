---
id: TASK-196.4
title: Add hard-constraints controls to SearchInstancePreferences
status: To Do
assignee: []
created_date: '2026-04-29 08:41'
updated_date: '2026-05-08 07:49'
labels:
  - search-redesign
  - ui
dependencies:
  - TASK-204.1
references:
  - src/routes/research/searchWorkspaceComponents.tsx
  - src/routes/research/research.css
  - src/store/searchStore.ts
  - src/types/search.ts
  - src/test/ResearchPage.test.tsx
documentation:
  - backlog doc-34 (Search Parameters Surface — Design)
  - backlog doc-24 (Search Workspace Redesign)
parent_task_id: TASK-196
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add UI controls to `SearchInstancePreferences` (in `src/routes/research/searchWorkspaceComponents.tsx`) for the hard constraints surfaced by subtasks .1 and .2: multi-select chips for industries-to-avoid, funding-stages-acceptable, remote-policies, employment-types; a dual-handle salary slider; a clearance toggle.

Bank values must render with display labels (per the label maps from subtask .1) — raw enum values like `"series-a"` should never appear in the UI; users see "Series A".

Hard constraints are infrequently edited per the spec; controls should be visually de-emphasized vs. the per-search composer area, e.g. via a collapsible section or secondary panel.

Depends on subtasks .1 and .2 having landed (the types and adapter must exist before the UI binds to them).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 SearchInstancePreferences renders multi-select chip controls for industries, funding stages, remote policies, employment types, bound to the bank enums from subtask .1
- [ ] #2 Each chip displays the human-readable label from the bank's label map; raw enum values are not visible in the UI
- [ ] #3 Dual-handle salary slider binds to SearchProfileConstraints.salary.{min, max}; min cannot exceed max; reasonable upper bound (e.g. $1M) for the slider scale
- [ ] #4 Clearance control is a 3-state selector (required / not-required / either) bound to SearchProfileConstraints.clearance
- [ ] #5 All edits route through searchStore actions — components do not mutate state directly
- [ ] #6 Constraint section is visually de-emphasized or collapsible; opening/closing state persists per-session
- [ ] #7 Empty/default states render cleanly when no constraints are set
- [ ] #8 Component tests cover: changing each chip persists, slider edits persist, toggle changes persist, all values round-trip through the store and survive rehydration
- [ ] #9 ResearchPage tests pass; no regressions in existing search workspace tests
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 All tests pass successfully
- [ ] #4 Automatic formatting was applied.
- [ ] #5 Linters report no WARNINGS or ERRORS
- [ ] #6 The project builds successfully
<!-- DOD:END -->
