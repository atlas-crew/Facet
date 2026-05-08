---
id: TASK-87
title: Align scan store field typing and normalization conventions
status: Done
assignee:
  - '@codex'
created_date: '2026-04-07 05:00'
updated_date: '2026-05-08 21:06'
labels:
  - scanner
dependencies: []
references:
  - ./.agents/reviews/review-20260407-005752.md
modified_files:
  - src/store/identityStore.ts
  - src/test/identityStore.test.ts
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Deferred from source review artifact ./.agents/reviews/review-20260407-005752.md.

Findings bundled into this task:
- P2-001: align scanned updater field typing safety between project and education editors
- P2-002: make optional-field normalization rule explicit and extensible for scanned project fields
- P3-001: normalize or document primary scan count ordering for easier debugging
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Scanned project and education updater field types are derived from the schema rather than freestanding literal unions or broad keyof usage.
- [x] #2 Optional scanned field normalization is handled through a named shared helper or explicit optional-field table.
- [x] #3 Scan count ordering is either standardized across the object or documented inline where it is intentionally non-alphabetical.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Introduce a typed editable-field alias for scanned education entries.
2. Replace ad hoc optional-field checks with a small shared normalizer or optional-field set.
3. Decide whether scan count ordering should be standardized or documented, then apply the chosen convention.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented TASK-87: scan project/education editable field types now use schema-derived keyof Pick aliases; optional scanned string normalization is shared via explicit optional-field sets; scan count key order is documented inline and regression-tested. Verification: npx vitest run src/test/identityStore.test.ts (56 passed); npm run typecheck (passed); npx eslint src/store/identityStore.ts src/test/identityStore.test.ts (passed); npm run format:files:check -- src/store/identityStore.ts src/test/identityStore.test.ts (passed); npm run build (passed with existing large-chunk warnings). Reviews: specialist review .agents/reviews/review-20260508-170255.md CLEAN; test audit .agents/reviews/test-audit-20260508-170539.md no prioritized gaps.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
TASK-87 aligned scan-store field typing and normalization conventions. Project and education edit fields are schema-derived, optional scanned fields are table-driven through a shared helper, count ordering is documented/tested, and focused scan-store coverage now covers education optional clearing, required-field preservation, out-of-bounds education updates, project URL regression, and count key ordering.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Documentation has been created/modified/removed as needed.
- [ ] #3 Documentation changes were approved by the docs-architect (8/10 score required)
- [x] #4 Test changes were approved by a test gap analysis review
- [x] #5 Changes to integration points are covered by tests
- [ ] #6 All tests pass successfully
- [x] #7 Automatic formatting was applied.
- [x] #8 Linters report no WARNINGS or ERRORS
- [x] #9 The project builds successfully
<!-- DOD:END -->
