---
id: TASK-3
title: Finish remaining accessibility polish from specialist review
status: In Progress
assignee:
  - '@codex'
created_date: '2026-02-28 05:46'
updated_date: '2026-05-28 17:41'
labels:
  - remediation
  - accessibility
dependencies: []
references:
  - .agents/reviews/review-20260227-175002.md
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
After core a11y fixes, review feedback still calls out keyboard guidance and announcement polish. Implement remaining non-blocking accessibility improvements in component library interactions.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Drag handles expose discoverable keyboard instructions
- [x] #2 Changing Add Component type announces the new form context
- [x] #3 Toast notifications can be dismissed manually
- [x] #4 Verification commands pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add concise keyboard drag instructions and hook via aria-describedby for bullet and skill drag handles.
2. Announce add-modal type changes via polite live region.
3. Add user-controlled dismiss for toast notices while preserving auto-expire behavior.
4. Re-run accessibility-focused manual checks plus lint/typecheck/test/build.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Starting TASK-3. I will target the existing ComponentLibrary/Build accessibility polish surface: verify current drag-handle aria wiring, add discoverable keyboard instructions where missing, announce Add Component type changes with a polite live region, add a manual dismiss affordance for toast notices, then cover the behavior with focused tests plus lint/typecheck/build and independent review/audit.

Completed TASK-3 as an accessibility proof/closeout slice. The drag-instruction wiring, add-modal live announcement, and manual toast dismiss affordance were already present in the product code; this change adds focused regression coverage for those acceptance criteria. Validation: npm run typecheck; npx vitest run src/test/ComponentLibrary.accessibility.test.tsx src/test/BulletList.test.tsx src/test/BuildPage.test.tsx; scoped eslint; touched-file format check; npm run lint; npm run test; npm run build. Independent diff test audit .agents/reviews/task3-a11y/test-audit-20260528-133925.md reports no prioritized gaps.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Closed the remaining Component Library accessibility polish by pinning the existing behaviors with focused tests: drag handles resolve aria-describedby to keyboard instructions, Add Component type changes announce the new form in a polite live region, and Build toast notifications can be dismissed manually. This was a tests-only closeout slice; no production code changes were required. Verification passed for typecheck, focused tests, scoped eslint, touched-file formatting, full lint, full test suite, and production build. Independent diff test audit found no prioritized gaps.
<!-- SECTION:FINAL_SUMMARY:END -->
