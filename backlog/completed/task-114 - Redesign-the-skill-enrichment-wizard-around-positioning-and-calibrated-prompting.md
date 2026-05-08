---
id: TASK-114
title: >-
  Redesign the skill enrichment wizard around positioning and calibrated
  prompting
status: Done
assignee: []
created_date: '2026-04-12 14:52'
updated_date: '2026-04-12 20:18'
labels:
  - identity
  - skill-enrichment
  - frontend
  - ai
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the skill enrichment wizard positioning redesign spec from Basic Memory, split into a pure search_signal -> positioning rename/migration slice and a second behavior/UI slice for prompt calibration, optional fields, and stale tracking.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Field rename from search_signal to positioning is complete across schema, UI, and downstream consumers
- [x] #2 Any existing search_signal data is preserved during migration
- [x] #3 Depth is never AI-inferred as avoid and skills without bullet evidence have no pre-filled depth
- [x] #4 Context and positioning prompts generate the calibrated shapes described in the spec
- [x] #5 Context and positioning remain optional and stale tracking appears when depth changes
- [x] #6 Each commit is independently verified with typecheck, vitest, eslint, and build
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Delivered the skill enrichment wizard redesign in two commits: first renaming search_signal to positioning with persisted-state migration, then calibrating AI prompt behavior and UI semantics around optional context/positioning, manual depth selection, and stale tracking.
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
