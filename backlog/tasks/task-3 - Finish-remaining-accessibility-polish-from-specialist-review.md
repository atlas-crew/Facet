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
- [ ] #2 Changing Add Component type announces the new form context
- [ ] #3 Toast notifications can be dismissed manually
- [ ] #4 Verification commands pass
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
<!-- SECTION:NOTES:END -->
