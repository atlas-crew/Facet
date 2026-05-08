---
id: TASK-114.2
title: Rename search_signal to positioning across the identity enrichment stack
status: Done
assignee: []
created_date: '2026-04-12 14:53'
updated_date: '2026-04-12 19:48'
labels:
  - identity
  - skill-enrichment
  - frontend
  - ai
dependencies: []
parent_task_id: TASK-114
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Pure rename slice: change schema, UI labels, downstream readers, and persisted-data migration from search_signal to positioning after verifying all writers of the current field.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 All schema and TypeScript references use positioning instead of search_signal
- [x] #2 Existing persisted search_signal values are preserved as positioning
- [x] #3 UI and exports use Positioning copy
- [x] #4 Targeted tests are updated and pass with no behavior change beyond the rename
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Renamed search_signal to positioning across schema, UI, downstream readers, and persisted state normalization. Added migration coverage for legacy persisted identities and draft documents, and verified with targeted typecheck, vitest, eslint, and build receipts.
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
