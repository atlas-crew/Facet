---
id: TASK-147
title: Make prep library company groups collapsible
status: Done
assignee: []
created_date: '2026-04-17 21:45'
updated_date: '2026-04-17 22:03'
labels:
  - prep
  - ui
dependencies: []
references:
  - src/routes/prep/PrepPage.tsx
  - src/routes/prep/prep.css
  - src/test/PrepPage.test.tsx
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Allow each company section in the prep library to collapse/expand while preserving existing active-deck behavior and overflow expansion for large groups.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Company groups in the prep library can be collapsed and expanded
- [x] #2 Collapsing a company group hides its deck cards without changing the active deck
- [x] #3 Existing per-group show more/show less behavior still works when a group is expanded
- [x] #4 Regression coverage verifies the collapse and expand behavior
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented collapsible company groups in the prep library while preserving active deck selection and per-group overflow expansion.

Verification:
- npx vitest run src/test/PrepPage.test.tsx
- npx eslint src/routes/prep/PrepPage.tsx src/test/PrepPage.test.tsx
- npm run typecheck
- npm run build

Independent source review rerun at .agents/reviews/review-20260417-180010.md finished PASS WITH ISSUES with no remaining P0/P1 findings.
Quick test audit at .agents/reviews/test-audit-20260417-175452.md still reports broader pre-existing PrepPage module gaps outside this collapsible-group slice.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [x] #3 All tests pass successfully
- [ ] #4 Automatic formatting was applied.
- [x] #5 Linters report no WARNINGS or ERRORS
- [x] #6 The project builds successfully
<!-- DOD:END -->
