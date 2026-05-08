---
id: TASK-11
title: Implement save/load/delete named variants with unsaved-change tracking
status: Done
assignee: []
created_date: '2026-02-28 06:14'
updated_date: '2026-02-28 06:29'
labels:
  - feature
  - vector-resume-v0.2
milestone: m-0
dependencies:
  - TASK-10
references:
  - docs/development/plans/active/vector-resume-v0.2-features.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add named saved variants that capture current vector and manual overrides, can be loaded/deleted, persist in localStorage, and participate in JSON import/export.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Users can save current configuration as a named variant with optional description.
- [x] #2 Users can load a saved variant and restore vector plus overrides.
- [x] #3 Users can delete saved variants.
- [x] #4 Unsaved changes indicator appears when loaded variant diverges from persisted state.
- [x] #5 Variants persist across sessions and are included in JSON import/export.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added persisted saved variant data model (`saved_variants`) and serializer/import/merge support so variants round-trip in JSON import/export.

Implemented top-bar Saved Variants controls: Save Current, Load, Delete, plus active variant tracking and unsaved-change detection.

Implemented load behavior that restores base vector + manual/variant/bullet-order overrides for that variant.

Surfaced active variant and unsaved marker in StatusBar.

Added test coverage for saved-variant helpers, serializer schema support, and import-merge behavior; verification: npm run typecheck; npm run test.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented named saved variants end-to-end: capture current vector override state, save/load/delete through toolbar controls, dirty-state tracking, and status-bar visibility. Added persisted `saved_variants` schema support through serializer and merge/import flows so variants round-trip with JSON data and survive sessions via persisted resume data. Added deterministic variant helper tests plus serializer/import merge coverage with passing verification.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Store and UI tests cover save/load/delete/dirty-state behavior.
- [x] #2 Local verification commands pass for changed code paths.
<!-- DOD:END -->
