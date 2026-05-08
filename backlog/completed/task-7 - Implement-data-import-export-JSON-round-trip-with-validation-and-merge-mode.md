---
id: TASK-7
title: Implement data import/export JSON round-trip with validation and merge mode
status: Done
assignee: []
created_date: '2026-02-28 06:14'
updated_date: '2026-02-28 06:20'
labels:
  - feature
  - vector-resume-v0.2
milestone: m-0
dependencies: []
references:
  - docs/development/plans/active/vector-resume-v0.2-features.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add v0.2 import/export flow so users can paste/upload JSON, validate schema with readable errors, choose Replace All or Merge behavior, and round-trip exported JSON back into the app without data loss.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Users can paste JSON and import it after validation in one action.
- [x] #2 Users can upload a .json file and import it.
- [x] #3 Import supports Replace All and Merge modes; Merge preserves existing manual reorder/override state where possible.
- [x] #4 Export downloads JSON that can be re-imported with equivalent resume data.
- [x] #5 Validation errors are human-readable and include useful location context.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Starting implementation per agent-loops: import/export JSON validation + merge mode, then tests and verification evidence.

Implemented merge-aware import flow in ImportExport/App with Replace All vs Merge selection and success warning toasts.

Added src/engine/importMerge.ts to merge records by id, merge role bullets by id, and preserve existing data for duplicate ids.

Hardened serializer validation: duplicate id detection, required role+bullet enforcement, approximate-line context on schema errors, non-blocking warnings for empty text/missing vector priorities, and auto-creation of missing vectors referenced by components.

Added/updated tests: src/test/importMerge.test.ts and expanded src/test/serializer.test.ts coverage for duplicate ids, warnings, and vector auto-creation.

Verification: npm run typecheck; npm run test.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Delivered JSON import/export round-trip upgrades with merge mode and stronger schema validation. Import now supports Replace All vs Merge, merge preserves existing records while adding new ids, serializer reports actionable errors and warnings, and missing vectors referenced by content are auto-created. Added dedicated merge tests plus serializer edge-case tests, with typecheck and test suite passing.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Serializer and import/export UI tests cover valid, invalid, and merge behavior paths.
- [x] #2 Local verification commands pass for changed code paths.
<!-- DOD:END -->
