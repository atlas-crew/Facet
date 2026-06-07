---
id: TASK-288
title: 'Bullet inspector: render tags as removable pills with add control in edit mode'
status: Done
assignee:
  - codex
created_date: '2026-06-07 20:27'
updated_date: '2026-06-07 21:46'
labels:
  - identity
  - ui
milestone: m-35
dependencies: []
priority: medium
ordinal: 44000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
In the bullet detail view (left rail / BulletInspector), tags should render as pills rather than plain text. When edit mode is active, each pill gets an "x" affordance to remove that tag, and a "+" control adds a new tag.

This is an interaction change, not just styling: removing/adding tags must update the bullet's tags in the identity store using the existing immutable update patterns.

Relevant files: src/routes/identity/inspectorSlots/BulletInspector.tsx, src/routes/identity/identityMap.css. Follow docs/development/ui/facet-style-guide.md (status badges / pill patterns, content-typed tokens) and the immutable-state-update rule for the store mutation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Bullet tags render as pills in the bullet detail view (read mode)
- [x] #2 In edit mode, each tag pill shows an 'x' control that removes that tag from the bullet
- [x] #3 In edit mode, a '+' control lets the user add a new tag to the bullet
- [x] #4 Tag add/remove persists via the identity store using immutable update patterns
- [x] #5 Empty / whitespace-only tags cannot be added; duplicate tags are prevented or de-duplicated
- [x] #6 Pills use design-system tokens (no hardcoded colors/spacing)
- [x] #7 Unit test covers add and remove tag store behavior
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented BulletInspector tag pills in read and edit modes. Edit mode now uses removable pill controls plus a comma-aware add input, normalizes and dedupes tags immutably via updateRoles, preserves pending input on Save, and covers read, add, remove, duplicate, blank, pending-save, placeholder, and cancel paths.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Rendered bullet tags as design-token pills in read mode and replaced the edit-mode comma field with removable tag pills plus a plus/add control. Tags are normalized, case-insensitive deduped, and persisted through immutable role updates; pending input is folded into Save to avoid data loss. Added focused BulletInspector tests for read pills, blank hiding, edit add/remove, Enter and button add paths, duplicate/blank prevention, pending-save persistence, edit-mode dedupe, placeholder, and Cancel.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [x] #3 Automatic formatting was applied to touched files
- [x] #4 Regression tests pass (scoped to touched files)
- [x] #5 Linters report no warnings or errors in touched files
- [x] #6 Relevant documentation updates landed or tasks created
<!-- DOD:END -->
