---
id: TASK-196.5
title: Retarget per-item signal toggle UI to canonical thesis signals
status: Done
assignee:
  - '@codex'
created_date: '2026-04-29 08:42'
updated_date: '2026-05-08 08:37'
labels:
  - search-redesign
  - ui
dependencies:
  - TASK-196.3
references:
  - src/routes/research/searchWorkspaceComponents.tsx
  - src/routes/research/research.css
  - src/store/searchStore.ts
  - src/routes/identity/inspectorSlots/MatchRuleInspector.tsx
  - src/test/ResearchPage.test.tsx
documentation:
  - backlog doc-39
  - backlog doc-34 (Search Parameters Surface — Design)
  - backlog doc-24 (Search Workspace Redesign)
parent_task_id: TASK-196
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Reconciled by TASK-204.4 after doc-39 and TASK-204.3.

Do not build per-item toggle UI against legacy SearchInstancePreferences Prioritize/Avoid text inputs or searchOverrides.filters.prioritize/avoid arrays. Those arrays are deleted migration input after TASK-204.1, and TASK-204.3 routes canonical lookFor/avoid editing to the Search Thesis editor.

If per-search signal disablement remains desired, render any toggle list from canonical SearchThesis.lookFor/SearchThesis.avoid entries and persist disabled state by canonical SearchThesisSignal id via the storage shape decided in TASK-196.3. The toggle UI must not mutate canonical thesis signals.

If product scope no longer needs per-search disabling after the thesis-signal cleanup, close/de-scope this toggle UI explicitly and leave SearchInstancePreferences with the read-only thesis signal readout plus Search Thesis edit actions delivered by TASK-204.3.

TASK-196 hard-constraints work remains unaffected: hard-constraint controls in SearchInstancePreferences remain in TASK-196.4 / the surviving TASK-196 scope.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 No SearchInstancePreferences UI restores free-text Prioritize/Avoid inputs or legacy searchOverrides.filters.* editing
- [x] #2 If toggles remain in scope, rows render from canonical SearchThesis.lookFor/SearchThesis.avoid signals and use canonical signal ids
- [x] #3 Toggling a row updates only the per-search disable state decided in TASK-196.3 and does not mutate canonical thesis signals
- [x] #4 Edit actions for canonical signal content route to the Search Thesis editor, not the retired IdentityStrategyWorkbench or legacy filter arrays
- [x] #5 If per-search signal toggles are de-scoped, this task records that decision and leaves hard-constraint TASK-196 scope intact
- [x] #6 Focused tests cover either canonical signal-id toggling or the explicit de-scope/no-toggle behavior
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inspect SearchInstancePreferences and thesis signal readout behavior.
2. Preserve canonical SearchThesis lookFor/avoid as the only source of signal rows, without legacy free-text Prioritize/Avoid controls.
3. Add focused UI tests for the reconciled canonical-toggle or explicit de-scope behavior.
4. Run focused tests, typecheck/build as needed, update backlog AC/DoD, and commit atomically with cortex git commit.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Closed by explicit no-toggle de-scope: SearchInstancePreferences does not restore free-text Prioritize/Avoid inputs, does not render per-search toggle rows, and leaves canonical signal content edits routed to the Search Thesis editor. Focused ResearchPage coverage verifies the no-legacy-toggle behavior. Verification: focused ResearchPage test passed; focused searchStore regression tests passed; scoped ESLint passed; npm run typecheck passed; npm run build passed with existing chunk-size warnings.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Explicitly de-scoped per-item signal toggles after canonical thesis-signal cleanup. Kept hard-constraint scope intact and added focused regression coverage for the no legacy filter toggle behavior.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [x] #3 All tests pass successfully
- [x] #4 Automatic formatting was applied.
- [x] #5 Linters report no WARNINGS or ERRORS
- [x] #6 The project builds successfully
<!-- DOD:END -->
