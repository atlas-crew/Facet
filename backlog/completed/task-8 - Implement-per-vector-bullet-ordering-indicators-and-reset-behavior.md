---
id: TASK-8
title: 'Implement per-vector bullet ordering, indicators, and reset behavior'
status: Done
assignee: []
created_date: '2026-02-28 06:14'
updated_date: '2026-02-28 06:20'
labels:
  - feature
  - vector-resume-v0.2
milestone: m-0
dependencies:
  - TASK-7
references:
  - docs/development/plans/active/vector-resume-v0.2-features.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement per-vector bullet ordering so each role can maintain independent bullet order for each vector with default fallback, clear indicators, and reset behavior integrated with assembly/preview/export.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Reordering bullets in a specific vector only affects that vector’s ordering.
- [x] #2 Switching vectors shows that vector’s saved order or default fallback.
- [x] #3 Live preview and DOCX export respect vector-specific bullet order.
- [x] #4 Global reset clears vector-specific order overrides and restores default behavior.
- [x] #5 Per-role control exists to reset order for the active vector.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementing per-vector bullet order fallback model (_default via all-vector order), role-level reset control, and custom-order indicator badges.

Added effective bullet order resolution with default fallback through src/utils/bulletOrder.ts and wired App assembly/library paths to use it.

Added per-role Reset Order control in BulletList plus UI affordances for custom-order indicators on vector-specific overrides.

Extended UI store with resetAllOverrides and resetRoleBulletOrder to support global reset from All view and per-role reset behavior.

Added tests: src/test/bulletOrder.test.ts for fallback/custom detection and expanded src/test/uiStore.test.ts coverage for role reset and global reset paths.

Verification: npm run typecheck; npm run test.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented per-vector bullet ordering with explicit default fallback, visual custom-order signaling, and reset controls. The app now resolves active-vector order with fallback to default ordering, exposes per-role reset for active vector ordering, and supports clearing all overrides from All view. Added bullet-order and UI store tests to validate fallback and reset behavior, with typecheck/tests passing.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Assembler and UI store tests cover vector-specific ordering behavior and resets.
- [x] #2 Local verification commands pass for changed code paths.
<!-- DOD:END -->
